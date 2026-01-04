/**
 * OTP Extractor - Extract LATEST OTP from Gmail
 *
 * Flow:
 * 1. Go to Gmail
 * 2. Find Namso emails (noreply@namso.network)
 * 3. Click the NEWEST email (first in list)
 * 4. Open and scroll to load full content
 * 5. Extract OTP from opened email
 * 6. If multiple OTP codes found, return the LAST one (after scrolling)
 */

import type { Page, Browser } from 'puppeteer';
import { logger } from '../infrastructure/logger.js';

export class OTPExtractor {
  private readonly timeout: number;
  private gmailWarned = false;

  constructor(timeoutMs: number = 60000) {
    this.timeout = timeoutMs;
  }

  /**
   * Extract OTP from Gmail
   */
  async extractFromGmail(browser: Browser, namsoPage: Page, email: string): Promise<string> {
    logger.info(`Extracting OTP for ${email}...`);

    const startTime = Date.now();

    while (Date.now() - startTime < this.timeout) {
      try {
        const code = await this.extractLatestOTP(browser);
        if (code) {
          logger.info(`OTP: ${code}`);
          return code;
        }
      } catch {
        // Continue polling
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    throw new Error(`OTP timeout (${this.timeout}ms)`);
  }

  /**
   * Extract LATEST OTP from Gmail
   * - Finds Namso emails
   * - Clicks newest (first in list)
   * - Scrolls to load all content
   * - Returns last OTP found
   */
  private async extractLatestOTP(browser: Browser): Promise<string | null> {
    const gmailPage = await browser.newPage();

    try {
      await gmailPage.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));

      // Check logged in
      if (!await this.isGmailLoggedIn(gmailPage)) {
        if (!this.gmailWarned) {
          logger.warn('Gmail not logged in');
          this.gmailWarned = true;
        }
        await gmailPage.close();
        return null;
      }

      // Wait for inbox to load
      await new Promise(r => setTimeout(r, 2000));

      // Find Namso email and click it
      const clicked = await gmailPage.evaluate(() => {
        // Find all email rows with Namso sender
        const emails = Array.from(document.querySelectorAll('[role="listitem"], tr, [data-thread-id]'));
        for (const email of emails) {
          const text = email.textContent || '';
          // Look for "Namso" or "noreply@namso.network"
          if (text.includes('Namso') || text.includes('namso.network')) {
            (email as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!clicked) {
        await gmailPage.close();
        return null;
      }

      // Wait for email to open
      await new Promise(r => setTimeout(r, 3000));

      // Scroll down in email to load all content (handle long emails)
      await gmailPage.evaluate(async () => {
        const scrollHeight = document.documentElement.scrollHeight;
        const steps = 3;

        for (let i = 0; i <= steps; i++) {
          window.scrollTo({ top: (scrollHeight * i) / steps, behavior: 'smooth' });
          await new Promise(r => setTimeout(r, 300));
        }
      });

      await new Promise(r => setTimeout(r, 1000));

      // Extract OTP from opened email
      const otpCode = await gmailPage.evaluate(() => {
        const bodyText = document.body?.innerText || '';

        // Find all OTP codes in the email
        const otpPattern = /is:\s*(\d{6})/g;  // "is: XXXXXX"
        const matches = Array.from(bodyText.matchAll(otpPattern));

        if (matches.length > 0) {
          // Return the LAST OTP code (after scrolling, this is the final one)
          return matches[matches.length - 1][1];
        }

        // Fallback: any 6-digit code
        const allCodes = bodyText.match(/\b\d{6}\b/g);
        if (allCodes && allCodes.length > 0) {
          return allCodes[allCodes.length - 1];
        }

        return null;
      });

      return otpCode;

    } finally {
      await gmailPage.close();
    }
  }

  /**
   * Check if Gmail is logged in
   */
  private async isGmailLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector('body', { timeout: 5000 });
      const url = page.url();

      // Redirected to login = not logged in
      if (url.includes('accounts.google.com') || url.includes('ServiceLogin')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Submit OTP (delegated to LoginService)
   */
  async submitOTP(page: Page, code: string): Promise<boolean> {
    try {
      await page.type('#otp', code, { delay: 50 });
      await new Promise(r => setTimeout(r, 1000));
      return true;
    } catch (error) {
      logger.error(`OTP submit failed: ${(error as Error).message}`);
      return false;
    }
  }
}
