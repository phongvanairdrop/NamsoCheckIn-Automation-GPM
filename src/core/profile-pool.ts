/**
 * Profile Pool - Orchestrate multi-profile processing with concurrency control
 *
 * Validation adjustments applied:
 * - Removed auto-scheduler (manual trigger only)
 * - Close browser via GPM after task (not disconnect)
 * - Default concurrency: 8 profiles
 */

import PQueue from 'p-queue';
import type { Browser } from 'puppeteer';
import type { Credential, ProcessingResult } from '../types/index.js';
import { GPMClient } from './gpm-client.js';
import { LoginService } from '../namso/login-service.js';
import { OTPExtractor } from '../namso/otp-extractor.js';
import { ActionService } from '../namso/action-service.js';
import { TelegramNotifier } from '../infrastructure/telegram.js';
import { ExcelWriter } from '../infrastructure/excel-writer.js';
import { logger } from '../infrastructure/logger.js';

export class ProfilePool {
  private gpm: GPMClient;
  private telegram: TelegramNotifier;
  private excelWriter: ExcelWriter;
  private queue: PQueue;
  private loginService: LoginService;
  private otpExtractor: OTPExtractor;
  private actionService: ActionService;

  constructor(
    gpm: GPMClient,
    telegram: TelegramNotifier,
    excelWriter: ExcelWriter,
    maxConcurrent: number = 8
  ) {
    this.gpm = gpm;
    this.telegram = telegram;
    this.excelWriter = excelWriter;
    this.loginService = new LoginService();
    this.otpExtractor = new OTPExtractor(parseInt(process.env.OTP_TIMEOUT_MS || '60000'));
    this.actionService = new ActionService();
    this.queue = new PQueue({ concurrency: maxConcurrent });
  }

  /**
   * Process all credentials with concurrency control
   */
  async processAll(credentials: Credential[]): Promise<ProcessingResult[]> {
    logger.info(`Processing ${credentials.length} profiles with concurrency ${this.queue.concurrency}`);

    const startTime = Date.now();

    const results = await Promise.all(
      credentials.map(cred =>
        this.queue.add(() => this.processOne(cred)) as Promise<ProcessingResult>
      )
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Processing complete in ${duration}s`);

    // Send summary report
    await this.telegram.sendReport(results);

    // Write results to Excel with timestamp
    await this.excelWriter.writeResults(results);

    return results;
  }

  /**
   * Process a single profile through the full flow
   */
  private async processOne(cred: Credential): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      profileId: cred.gpm_profile_id,
      email: cred.email,
      loginSuccess: false,
      checkInSuccess: false,
      convertSuccess: false,
      sharePoints: 0,
      timestamp: new Date()
    };

    let browser: Browser | null = null;

    try {
      logger.info(`[${cred.gpm_profile_id}] Starting...`);

      // Step 1: Start GPM profile
      const debugAddress = await this.gpm.startProfile(cred.gpm_profile_id);
      logger.info(`[${cred.gpm_profile_id}] GPM started, debug address: ${debugAddress}`);

      browser = await this.gpm.connectBrowser(debugAddress);

      // Get or create page
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();

      // Step 2: Login flow
      logger.info(`[${cred.gpm_profile_id}] Attempting login...`);
      const loginStatus = await this.loginService.login(page, cred.email, cred.password);

      if (loginStatus === 'needs_otp') {
        logger.info(`[${cred.gpm_profile_id}] OTP required, extracting...`);
        const otp = await this.otpExtractor.extractFromGmail(browser, page, cred.email);
        const otpSuccess = await this.loginService.submitOTP(page, otp);
        result.loginSuccess = otpSuccess;

        if (!otpSuccess) {
          throw new Error('OTP verification failed');
        }
      } else if (loginStatus === 'success' || loginStatus === 'already_logged_in') {
        result.loginSuccess = true;
      }

      if (!result.loginSuccess) {
        throw new Error('Login failed');
      }

      logger.info(`[${cred.gpm_profile_id}] Login successful`);

      // Step 3: Get current points (convertible SHARE balance)
      result.sharePoints = await this.actionService.getConvertibleSHARE(page);
      logger.info(`[${cred.gpm_profile_id}] Current convertible SHARE: ${result.sharePoints}`);

      // Step 4: Check-in
      logger.info(`[${cred.gpm_profile_id}] Attempting check-in...`);
      const checkInResult = await this.actionService.checkIn(page);
      result.checkInSuccess = checkInResult.status !== 'FAILED';

      if (checkInResult.status === 'SUCCESS') {
        logger.info(`[${cred.gpm_profile_id}] Check-in: ${checkInResult.message}`);
      } else if (checkInResult.status === 'ALREADY_DONE') {
        logger.info(`[${cred.gpm_profile_id}] Check-in: ${checkInResult.message}`);
      } else {
        logger.warn(`[${cred.gpm_profile_id}] Check-in failed: ${checkInResult.message}`);
      }

      // Step 5: Convert if eligible (convertible SHARE > 10000)
      if (result.sharePoints > 10000) {
        logger.info(`[${cred.gpm_profile_id}] Converting SHARE points...`);
        const convertResult = await this.actionService.convertSHARE(page, result.sharePoints);
        result.convertSuccess = convertResult.status !== 'FAILED';

        if (convertResult.status === 'SUCCESS') {
          logger.info(`[${cred.gpm_profile_id}] Convert: ${convertResult.message}`);
        } else if (convertResult.status === 'ALREADY_DONE') {
          logger.info(`[${cred.gpm_profile_id}] Convert: ${convertResult.message}`);
        } else {
          logger.warn(`[${cred.gpm_profile_id}] Convert failed: ${convertResult.message}`);
        }
      }

      logger.info(`[${cred.gpm_profile_id}] Complete`);

    } catch (error) {
      result.error = (error as Error).message;
      await this.telegram.sendAlert(cred.email, (error as Error).message);
      logger.error(`[${cred.gpm_profile_id}] Failed: ${(error as Error).message}`);

    } finally {
      // Close browser via GPM (validation adjustment: close, not disconnect)
      if (browser) {
        try {
          await this.gpm.disconnect(browser);
          await this.gpm.stopProfile(cred.gpm_profile_id);
          logger.info(`[${cred.gpm_profile_id}] Browser closed via GPM`);
        } catch (err) {
          logger.warn(`[${cred.gpm_profile_id}] Error closing browser: ${(err as Error).message}`);
        }
      }
    }

    return result;
  }
}
