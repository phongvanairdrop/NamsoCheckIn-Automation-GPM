/**
 * Debug Script - Test automation with a single profile
 *
 * Usage: npm run debug
 *
 * This script runs interactively with step-by-step logging
 * and pauses between steps for inspection.
 */

import 'dotenv/config';
import readline from 'readline';
import type { Browser } from 'puppeteer';
import { GPMClient } from '../src/core/gpm-client.js';
import { CredentialManager } from '../src/core/credential-manager.js';
import { LoginService } from '../src/namso/login-service.js';
import { OTPExtractor } from '../src/namso/otp-extractor.js';
import { ActionService } from '../src/namso/action-service.js';
import { logger } from '../src/infrastructure/logger.js';

// Set up readline for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  logger.info('=================================');
  logger.info('Namso Validator - DEBUG MODE');
  logger.info('=================================');
  logger.info('');
  logger.info('This script will test the automation with a single profile.');
  logger.info('Browser will remain visible for inspection.');
  logger.info('');

  // Load credentials
  const CREDENTIALS_FILE = process.env.CREDENTIALS_FILE || './config/credentials.xlsx';
  logger.info(`Loading credentials from ${CREDENTIALS_FILE}...`);

  const credManager = new CredentialManager();
  await credManager.load(CREDENTIALS_FILE);

  // Get user input - Profile Name
  const profileName = await question('1. Enter GPM Profile Name (e.g., Depin002): ');

  const cred = credManager.getByProfileName(profileName);
  if (!cred) {
    logger.error(`Profile "${profileName}" not found in credentials file!`);
    logger.info('Available profiles:');
    credManager.getAll().forEach(c => {
      logger.info(`  - ${c.gpm_profile_name || c.gpm_profile_id}: ${c.email}`);
    });
    rl.close();
    process.exit(1);
  }

  logger.info(`✓ Found profile: ${cred.gpm_profile_name || cred.gpm_profile_id}`);
  logger.info(`  Email: ${cred.email}`);
  logger.info(`  Profile ID: ${cred.gpm_profile_id}`);

  const pauseStr = await question('2. Pause between steps (ms, or 0 for no pause): ');
  const pause = parseInt(pauseStr) || 0;

  const pauseIfNeeded = async (step: string) => {
    if (pause > 0) {
      logger.info(`[${step}] Pausing ${pause}ms...`);
      await new Promise(r => setTimeout(r, pause));
    }
  };

  let browser: Browser | null = null;
  const profileId = cred.gpm_profile_id;

  try {
    logger.info('');
    logger.info('=================================');
    logger.info('STEP 1: Starting GPM Profile');
    logger.info('=================================');

    const gpm = new GPMClient();

    if (!(await gpm.isHealthy())) {
      throw new Error('GPM not running. Please start GPM first.');
    }
    logger.info('✓ GPM is healthy');

    const debugAddress = await gpm.startProfile(profileId);
    logger.info(`✓ Profile started`);
    logger.info(`  Debug address: ${debugAddress}`);

    browser = await gpm.connectBrowser(debugAddress);
    logger.info(`✓ Puppeteer connected`);

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    logger.info(`✓ Page ready`);

    await pauseIfNeeded('STEP 1');

    // ========================================
    // STEP 2: Navigate to Namso
    // ========================================
    logger.info('');
    logger.info('=================================');
    logger.info('STEP 2: Navigate to Namso');
    logger.info('=================================');

    await page.goto('https://app.namso.network/', { waitUntil: 'networkidle2' });
    logger.info(`✓ Navigated to: ${page.url()}`);

    await pauseIfNeeded('STEP 2');

    // ========================================
    // STEP 3: Login
    // ========================================
    logger.info('');
    logger.info('=================================');
    logger.info('STEP 3: Login');
    logger.info('=================================');

    const loginService = new LoginService();
    const loginStatus = await loginService.login(page, cred.email, cred.password);
    logger.info(`✓ Login status: ${loginStatus}`);

    await pauseIfNeeded('STEP 3');

    // ========================================
    // STEP 4: Handle OTP if needed
    // ========================================
    if (loginStatus === 'needs_otp') {
      logger.info('');
      logger.info('=================================');
      logger.info('STEP 4: OTP Required');
      logger.info('=================================');

      const otpExtractor = new OTPExtractor();

      // Prompt for OTP
      const manualOTP = await question('Enter OTP (or press Enter to auto-extract): ');

      let otp: string;
      if (manualOTP) {
        otp = manualOTP;
        logger.info(`✓ Using manual OTP: ${otp}`);
      } else {
        logger.info('Attempting auto-extract from Gmail...');
        otp = await otpExtractor.extractFromGmail(browser, page, cred.email);
        logger.info(`✓ Extracted OTP: ${otp}`);
      }

      const otpSuccess = await loginService.submitOTP(page, otp);
      logger.info(`✓ OTP submit result: ${otpSuccess ? 'SUCCESS' : 'FAILED'}`);

      if (!otpSuccess) {
        throw new Error('OTP verification failed');
      }

      await pauseIfNeeded('STEP 4');
    }

    // ========================================
    // STEP 5: Get Convertible SHARE Balance
    // ========================================
    logger.info('');
    logger.info('=================================');
    logger.info('STEP 5: Get Convertible SHARE Balance');
    logger.info('=================================');

    const actionService = new ActionService();
    const balance = await actionService.getConvertibleSHARE(page);
    logger.info(`✓ Current convertible SHARE: ${balance}`);

    await pauseIfNeeded('STEP 5');

    // ========================================
    // STEP 6: Check-in
    // ========================================
    logger.info('');
    logger.info('=================================');
    logger.info('STEP 6: Check-in');
    logger.info('=================================');

    const checkInResult = await actionService.checkIn(page);
    logger.info(`✓ Check-in result: ${checkInResult.success ? 'SUCCESS' : 'FAILED'}`);
    logger.info(`  Message: ${checkInResult.message}`);

    await pauseIfNeeded('STEP 6');

    // ========================================
    // STEP 7: Convert (if eligible)
    // ========================================
    if (balance > 10000) {
      logger.info('');
      logger.info('=================================');
      logger.info('STEP 7: Convert SHARE Points');
      logger.info('=================================');

      const convertResult = await actionService.convertSHARE(page, balance);
      logger.info(`✓ Convert result: ${convertResult.success ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`  Message: ${convertResult.message}`);

      await pauseIfNeeded('STEP 7');
    } else {
      logger.info('');
      logger.info('=================================');
      logger.info('STEP 7: Skipped Convert');
      logger.info('=================================');
      logger.info(`Balance (${balance}) <= 10000, not converting.`);
    }

    // ========================================
    // DONE
    // ========================================
    logger.info('');
    logger.info('=================================');
    logger.info('DEBUG COMPLETE');
    logger.info('=================================');
    logger.info('');
    logger.info('Browser will remain open for inspection.');
    logger.info('Press Ctrl+C to exit and close the browser.');
    logger.info('');

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    logger.error('');
    logger.error('=================================');
    logger.error('DEBUG FAILED');
    logger.error('=================================');
    logger.error((error as Error).message);
    logger.error((error as Error).stack || '');

  } finally {
    rl.close();

    // Cleanup
    if (browser) {
      try {
        const gpm = new GPMClient();
        await gpm.disconnect(browser);
        await gpm.stopProfile(profileId);
        logger.info('Browser closed');
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }
}

main();
