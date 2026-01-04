/**
 * Namso Check-in Automation - Main Script
 *
 * REFACTORED:
 * - CLI menu input (no .env editing needed)
 * - Soft fail & data sync (always update Excel)
 * - Health checks & timeouts
 * - Staggered queue-based concurrency
 *
 * RUN MODES:
 * 1. Chạy TẤT CẢ profiles
 * 2. Chạy từ profile X đến Y (VD: Depin010-Depin180)
 * 3. Chạy lại profiles đang LỖI (không có trong results)
 */

import 'dotenv/config';
import type { Browser } from 'puppeteer';
import PQueue from 'p-queue';
import xlsx from 'xlsx';
import readline from 'readline';
import { GPMClient } from '../src/core/gpm-client.js';
import { WindowPositioner } from '../src/core/window-positioner.js';
import { CredentialManager } from '../src/core/credential-manager.js';
import { LoginService } from '../src/namso/login-service.js';
import { OTPExtractor } from '../src/namso/otp-extractor.js';
import { ActionService } from '../src/namso/action-service.js';
import { ExcelWriter } from '../src/infrastructure/excel-writer.js';
import { logger } from '../src/infrastructure/logger.js';
import type { ProcessingResult, Credential, ActionStatus } from '../src/types/index.js';

// Default config
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_STAGGER_DELAY_MS = 3000;
const PAUSE_MS = 2000;

// Window config
const WINDOW_SIZE = (process.env.WINDOW_SIZE || '800x600').split('x');
const WINDOW_WIDTH = parseInt(WINDOW_SIZE[0]);
const WINDOW_HEIGHT = parseInt(WINDOW_SIZE[1]);
const SCREEN_WIDTH = parseInt(process.env.SCREEN_WIDTH || '1920');
const SCREEN_HEIGHT = parseInt(process.env.SCREEN_HEIGHT || '1080');

/**
 * CLI Menu - Get user input
 */
async function getMenuChoice(): Promise<number> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`
================================
NAMSO CHECK-IN AUTOMATION
================================

Chọn chế độ chạy:
  1. Chạy TẤT CẢ profiles
  2. Chạy từ profile X đến Y
  3. Chạy lại các profile ĐANG LỖI

Lựa chọn của bạn (1-3): `, (answer) => {
      rl.close();
      const choice = parseInt(answer.trim());
      resolve(isNaN(choice) ? 1 : Math.max(1, Math.min(3, choice)));
    });
  });
}

/**
 * Get profile range from user
 */
async function getProfileRange(): Promise<{ start: string; end: string } | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\nNhập khoảng profiles (VD: Depin010-Depin180 hoặc Enter để hủy): ', (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (!trimmed) {
        resolve(null);
        return;
      }

      // Parse range like "Depin010-Depin180" or "Depin010 - Depin180"
      const match = trimmed.match(/^([a-zA-Z]+\d+)[-:\s]+([a-zA-Z]+\d+)$/);
      if (match) {
        resolve({ start: match[1], end: match[2] });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Load existing results
 */
function loadExistingResults(): Map<string, ProcessingResult> {
  try {
    const workbook = xlsx.readFile('./config/results.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet) as any[];

    const map = new Map<string, ProcessingResult>();
    for (const row of rows) {
      if (row.ProfileName && row.Last_Check_In) {
        map.set(row.ProfileName, {
          profileId: row.ProfileName,
          profileName: row.ProfileName,
          email: row.Email || '',
          loginSuccess: row.Login_Success === '✓',
          checkInSuccess: row.CheckIn_Success === '✓',
          convertSuccess: row.Convert_Success === '✓',
          sharePoints: row.SHARE_Points || 0,
          checkInStreak: row.CheckIn_Streak || '',
          timestamp: new Date(row.Last_Check_In)
        });
      }
    }
    logger.info(`Loaded ${map.size} existing results`);
    return map;
  } catch {
    logger.info('No existing results file');
    return new Map();
  }
}

/**
 * Save result immediately
 */
async function saveResult(result: ProcessingResult, excelWriter: ExcelWriter): Promise<void> {
  await excelWriter.writeResults([result]);
}

/**
 * Process single profile with soft fail & data sync
 */
async function processProfile(
  profileName: string,
  cred: Credential,
  slotNumber: number,
  positioner: WindowPositioner,
  excelWriter: ExcelWriter
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    profileId: cred.gpm_profile_id,
    profileName: cred.gpm_profile_name || profileName,
    email: cred.email,
    loginSuccess: false,
    checkInSuccess: false,
    convertSuccess: false,
    sharePoints: 0,
    timestamp: new Date()
  };

  let browser: Browser | null = null;
  const gpm = new GPMClient();

  try {
    const windowPos = positioner.getPositionForSlot(slotNumber);
    logger.info(`[${profileName}] Starting...`);

    if (!(await gpm.isHealthy())) {
      throw new Error('GPM not running');
    }

    const debugAddress = await gpm.startProfile(cred.gpm_profile_id, {
      size: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT },
      position: windowPos,
      scale: 0.8
    });

    browser = await gpm.connectBrowser(debugAddress);
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    await new Promise(r => setTimeout(r, PAUSE_MS));

    // Navigate & Login
    await page.goto('https://app.namso.network/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, PAUSE_MS));

    const loginService = new LoginService();
    const loginStatus = await loginService.login(page, cred.email, cred.password);

    await new Promise(r => setTimeout(r, PAUSE_MS));

    // Handle OTP
    if (loginStatus === 'needs_otp') {
      const otpExtractor = new OTPExtractor();
      const otp = await otpExtractor.extractFromGmail(browser, page, cred.email);
      logger.info(`[${profileName}] OTP: ${otp}`);

      const otpSuccess = await loginService.submitOTP(page, otp);
      result.loginSuccess = otpSuccess;

      if (!otpSuccess) throw new Error('OTP failed');
    } else if (loginStatus === 'already_logged_in') {
      result.loginSuccess = true;
    }

    await new Promise(r => setTimeout(r, PAUSE_MS));

    const actionService = new ActionService();

    // === SOFT FAIL: Check-in (don't stop on error) ===
    try {
      const checkInStatus: ActionStatus = await actionService.checkIn(page);
      result.checkInSuccess = checkInStatus.status !== 'FAILED';
      logger.info(`[${profileName}] Check-in: ${checkInStatus.status}`);
    } catch (e) {
      logger.warn(`[${profileName}] Check-in error (continuing): ${(e as Error).message}`);
      result.checkInSuccess = false;
    }

    await new Promise(r => setTimeout(r, PAUSE_MS));

    // === SOFT FAIL: Convert (don't stop on error) ===
    try {
      const balance = await actionService.getConvertibleSHARE(page);
      result.sharePoints = balance;
      logger.info(`[${profileName}] Balance: ${balance} SHARE`);

      if (balance > 10000) {
        const convertStatus: ActionStatus = await actionService.convertSHARE(page, balance);
        result.convertSuccess = convertStatus.status !== 'FAILED';
        logger.info(`[${profileName}] Convert: ${convertStatus.status}`);
      } else {
        result.convertSuccess = true; // Not enough to convert is OK
      }
    } catch (e) {
      logger.warn(`[${profileName}] Convert error (continuing): ${(e as Error).message}`);
      result.convertSuccess = false;
    }

    await new Promise(r => setTimeout(r, PAUSE_MS));

    // === DATA SYNC: MUST RUN ALWAYS (even if actions failed) ===
    try {
      // Update balance (may have failed above)
      result.sharePoints = await actionService.getConvertibleSHARE(page);

      // Get streak
      const streak = await actionService.getCheckInStreak(page);
      result.checkInStreak = streak;
      logger.info(`[${profileName}] Streak: ${streak}`);
    } catch (e) {
      logger.warn(`[${profileName}] Data sync error: ${(e as Error).message}`);
    }

    // Mark as successful if we got here
    result.loginSuccess = true;
    logger.info(`[${profileName}] ✓ Done`);

  } catch (error) {
    result.error = (error as Error).message;
    logger.error(`[${profileName}] ✗ ${(error as Error).message}`);

  } finally {
    // Cleanup
    if (browser) {
      try {
        await gpm.disconnect(browser);
        await gpm.stopProfile(cred.gpm_profile_id);
      } catch {
        // Ignore cleanup errors
      }
    }

    // SAVE IMMEDIATELY
    await saveResult(result, excelWriter);

    return result;
  }
}

/**
 * Main function
 */
async function main() {
  logger.info('================================');
  logger.info(`Namso Check-in Automation`);
  logger.info('================================');

  // Get menu choice from user
  const menuChoice = await getMenuChoice();
  let concurrency = DEFAULT_CONCURRENCY;
  let staggerDelay = DEFAULT_STAGGER_DELAY_MS;

  // Load credentials
  const credManager = new CredentialManager();
  await credManager.load('./config/credentials.xlsx');
  let allProfiles = credManager.getAll();

  if (allProfiles.length === 0) {
    logger.error('No profiles found in credentials.xlsx');
    return;
  }

  // Filter profiles based on menu choice
  let profilesToProcess: Credential[] = [];
  let runModeDesc = '';

  switch (menuChoice) {
    case 1:
      profilesToProcess = allProfiles;
      runModeDesc = `Running ALL ${allProfiles.length} profiles`;
      break;

    case 2:
      const range = await getProfileRange();
      if (!range) {
        logger.info('Cancelled');
        return;
      }

      const startIndex = allProfiles.findIndex(p => (p.gpm_profile_name || '') === range.start);
      const endIndex = allProfiles.findIndex(p => (p.gpm_profile_name || '') === range.end);

      if (startIndex < 0) {
        logger.error(`Start profile "${range.start}" not found`);
        return;
      }

      if (endIndex < 0) {
        logger.warn(`End profile "${range.end}" not found, using last profile`);
        profilesToProcess = allProfiles.slice(startIndex);
      } else {
        profilesToProcess = allProfiles.slice(startIndex, endIndex + 1);
      }

      runModeDesc = `Running from ${range.start} to ${profilesToProcess[profilesToProcess.length - 1].gpm_profile_name} (${profilesToProcess.length} profiles)`;
      break;

    case 3:
      const existingResults = loadExistingResults();
      const processedNames = new Set(existingResults.keys());

      // Run failed/missing profiles
      profilesToProcess = allProfiles.filter(p => {
        const name = p.gpm_profile_name || '';
        const existing = existingResults.get(name);

        // Include if: not in results OR has error
        if (!existing) return true;
        if (existing.error) return true;

        return false;
      });

      runModeDesc = `Running FAILED/MISSING profiles: ${profilesToProcess.length}`;
      break;
  }

  if (profilesToProcess.length === 0) {
    logger.info('No profiles to process');
    return;
  }

  // Ask for concurrency
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const concurAnswer = await new Promise<string>(resolve => {
    rl.question(`\nSố luồng song hành (Enter = ${DEFAULT_CONCURRENCY}): `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  if (concurAnswer) {
    const parsed = parseInt(concurAnswer);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
      concurrency = parsed;
    }
  }

  // Show summary
  logger.info('\n================================');
  logger.info(`Mode: ${runModeDesc}`);
  logger.info(`Concurrency: ${concurrency}`);
  logger.info(`Stagger: ${staggerDelay}ms`);
  logger.info('================================');

  // Create positioner and excel writer
  const positioner = new WindowPositioner({
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    windowWidth: WINDOW_WIDTH,
    windowHeight: WINDOW_HEIGHT,
    maxConcurrency: concurrency,
    padding: 10
  });

  const excelWriter = new ExcelWriter('./config/results.xlsx');

  const results: ProcessingResult[] = [];
  const queue = new PQueue({ concurrency });

  // Process with staggered start
  for (let i = 0; i < profilesToProcess.length; i++) {
    const cred = profilesToProcess[i];
    const profileName = cred.gpm_profile_name || `Profile_${i}`;

    if (i < concurrency && i > 0) {
      await new Promise(r => setTimeout(r, staggerDelay));
    }

    const slot = i % concurrency;

    queue.add(async () => {
      const result = await processProfile(profileName, cred, slot, positioner, excelWriter);
      results.push(result);
      return result;
    }).catch(error => {
      logger.error(`[${profileName}] Queue error: ${error}`);
    });
  }

  await queue.onIdle();

  // Final summary
  logger.info('\n================================');
  logger.info(`SUMMARY`);
  logger.info('================================');
  logger.info(`Processed: ${results.length}`);
  logger.info(`Login OK: ${results.filter(r => r.loginSuccess).length}`);
  logger.info(`Check-in OK: ${results.filter(r => r.checkInSuccess).length}`);
  logger.info(`Convert OK: ${results.filter(r => r.convertSuccess).length}`);
  logger.info(`Errors: ${results.filter(r => r.error).length}`);
  logger.info(`Total SHARE: ${results.reduce((sum, r) => sum + r.sharePoints, 0)}`);
  logger.info('================================');

  // List failed profiles
  const failed = results.filter(r => r.error || !r.loginSuccess);
  if (failed.length > 0) {
    logger.info('\nFailed profiles:');
    failed.forEach(f => logger.info(`  - ${f.profileName}: ${f.error || 'Login failed'}`));
  }

  logger.info('\n✓ Done! Check config/results.xlsx for details.');
}

main().catch(error => {
  logger.error('Fatal:', error);
  process.exit(1);
});
