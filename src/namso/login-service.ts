/**
 * Login Service - Namso login flow with exact selectors from recording
 */

import type { Page } from 'puppeteer';
import { LoginStatus } from '../types/index.js';
import { logger } from '../infrastructure/logger.js';

const NAMSO_URL = 'https://app.namso.network/';
const DASHBOARD_URL = 'https://app.namso.network/dashboard/';

export class LoginService {
  /**
   * Check if already logged in
   * - On dashboard URL, definitely logged in
   * - Has email input = login form (logged out)
   * - Has "Sign Out" or Logout button = logged in
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    const url = page.url();
    // If on dashboard, definitely logged in
    if (url.includes('dashboard')) return true;

    // Check for login form elements (email input) = NOT logged in
    const hasEmailInput = await page.$('#email').then(el => el !== null).catch(() => false);
    if (hasEmailInput) return false;

    // Check for logged-in indicators
    const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    return bodyText.includes('Sign Out') ||
           bodyText.includes('Logout') ||
           bodyText.includes('Convert') ||  // Dashboard element
           bodyText.includes('Check-in');    // Dashboard element
  }

  /**
   * Full login flow: check if logged in → if not, fill credentials → get OTP → verify
   */
  async login(page: Page, email: string, password: string): Promise<LoginStatus> {
    try {
      await page.goto(NAMSO_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      // Check if already logged in
      if (await this.isLoggedIn(page)) {
        logger.info('Already logged in');
        return LoginStatus.ALREADY_LOGGED_IN;
      }

      // Clear and fill email - use evaluate to handle autofill
      await page.evaluate((email) => {
        const input = document.querySelector('#email') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.focus();
          input.value = email;
        }
      }, email);
      logger.info('Email entered');

      // Clear and fill password
      await page.evaluate((password) => {
        const input = document.querySelector('#password') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.focus();
          input.value = password;
        }
      }, password);
      logger.info('Password entered');

      // Click Verify button to send OTP
      const verifyBtn = await page.$('#send-code-btn');
      if (verifyBtn) {
        await verifyBtn.click();
        logger.info('OTP code requested');
      }

      await new Promise(r => setTimeout(r, 3000));

      return LoginStatus.NEEDS_OTP;

    } catch (error) {
      logger.error(`Login failed: ${(error as Error).message}`);
      return LoginStatus.FAILED;
    }
  }

  /**
   * Submit OTP code
   */
  async submitOTP(page: Page, code: string): Promise<boolean> {
    try {
      // Clear and type OTP code - handle autofill
      await page.evaluate((otp) => {
        const input = document.querySelector('#otp') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.focus();
          input.value = otp;
        }
      }, code);
      logger.info('OTP entered');

      // Wait a bit for any auto-navigation
      await new Promise(r => setTimeout(r, 2000));

      // Check if already navigated to dashboard
      if (page.url().includes('dashboard')) {
        logger.info('Auto-navigated to dashboard after OTP');
        return true;
      }

      // Try to click Enter Dashboard button (might have different selectors)
      const clickResult = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('enter') || text.includes('dashboard') || text.includes('verify')) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (clickResult) {
        await new Promise(r => setTimeout(r, 3000));
      }

      // Final check - navigate to dashboard directly if needed
      if (!page.url().includes('dashboard')) {
        logger.info('Navigating to dashboard manually...');
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));
      }

      return page.url().includes('dashboard');
    } catch (error) {
      logger.error(`OTP submit failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Navigate to dashboard
   */
  async gotoDashboard(page: Page): Promise<void> {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
  }
}
