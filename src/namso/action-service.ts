/**
 * Action Service - Check-in and Convert with exact selectors from recording
 *
 * REFACTORED:
 * - Page health validation before actions
 * - waitForSelector instead of setTimeout
 * - Soft fail for "already checked in" state
 * - Better error handling with retry support
 *
 * SELECTORS (from recording):
 * - Sidebar button: #openSidebar
 * - Check-in button: #check-in-btn-sidebar
 * - Convert link: 7th <a> in sidebar nav
 * - Convert amount input: #convert-amount-input
 * - Convert button: #convert-share-btn
 * - Confirm button: #modal-confirm-btn
 * - Convertible balance: #convertible-share-balance
 * - Notification: #notification
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionStatus } from '../types/index.js';
import { logger } from '../infrastructure/logger.js';
import { withRetry } from '../utils/retry.js';

const DASHBOARD_URL = 'https://app.namso.network/dashboard/';

// Page health check patterns
const SERVER_ERROR_PATTERNS = [
  '502 bad gateway',
  '503 service unavailable',
  'service unavailable',
  'maintenance mode',
  'under maintenance',
  'server error',
  'cloudflare'
];

export class ActionService {
  /**
   * Sleep helper
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise(r => setTimeout(r, ms));
  }

  /**
   * Validate page health before performing actions
   * Throws if server error detected
   */
  private async validatePageHealth(page: Page): Promise<void> {
    const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    const lowerText = bodyText.toLowerCase();

    for (const pattern of SERVER_ERROR_PATTERNS) {
      if (lowerText.includes(pattern)) {
        throw new Error(`Server error detected: ${pattern}`);
      }
    }
  }

  /**
   * Wait for navigation to complete
   */
  private async waitForNavigation(page: Page): Promise<void> {
    try {
      await page.waitForFunction(
        () => document.readyState === 'complete',
        { timeout: 10000 }
      );
    } catch {
      // Continue anyway
    }
  }

  /**
   * Get convertible SHARE balance from Convert page
   */
  async getConvertibleSHARE(page: Page): Promise<number> {
    try {
      if (!page.url().includes('dashboard')) {
        await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.waitForNavigation(page);
      }

      await this.validatePageHealth(page);

      // Open sidebar
      await page.evaluate(() => {
        const sidebarBtn = document.querySelector('#openSidebar') as HTMLElement;
        if (sidebarBtn) sidebarBtn.click();
      });

      // Wait for sidebar to be visible
      await page.waitForSelector('#sidebar', { timeout: 5000 }).catch(() => {});

      // Click Convert menu (7th <a> in sidebar nav)
      const convertClicked = await page.evaluate(() => {
        const links = document.querySelectorAll('#sidebar nav a');
        if (links.length >= 7) {
          (links[6] as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (!convertClicked) {
        logger.warn('Convert menu not found');
      }

      // Wait for Convert page content to load
      await this.waitForNavigation(page);
      await this.sleep(1000);

      // Get convertible balance from #convertible-share-balance
      const balanceText = await page.evaluate(() => {
        const el = document.querySelector('#convertible-share-balance');
        if (el) {
          return el.textContent?.trim() || '0';
        }
        return '0';
      });

      const balance = parseFloat(balanceText.replace(/,/g, ''));
      logger.info(`Convertible SHARE: ${balance}`);
      return balance;

    } catch (error) {
      logger.error(`Failed to get SHARE balance: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Perform daily check-in
   * Returns ActionStatus with SUCCESS | ALREADY_DONE | FAILED
   */
  async checkIn(page: Page): Promise<ActionStatus> {
    return await withRetry(async () => {
      try {
        logger.info('Attempting check-in...');

        // Ensure on dashboard
        if (!page.url().includes('dashboard')) {
          await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.waitForNavigation(page);
        }

        await this.validatePageHealth(page);

        // Open sidebar
        await page.evaluate(() => {
          const sidebarBtn = document.querySelector('#openSidebar') as HTMLElement;
          if (sidebarBtn) sidebarBtn.click();
        });

        await page.waitForSelector('#sidebar', { timeout: 5000 }).catch(() => {});
        await this.sleep(500);

        // Check if check-in button exists
        const buttonExists = await page.evaluate(() => {
          return !!document.querySelector('#check-in-btn-sidebar');
        });

        if (!buttonExists) {
          // Check if already checked in
          const alreadyCheckedIn = await page.evaluate(() => {
            const body = document.body?.innerText || '';
            return body.toLowerCase().includes('already checked') ||
                   body.toLowerCase().includes('come back tomorrow') ||
                   body.toLowerCase().includes('claimed today') ||
                   body.toLowerCase().includes('daily check in completed');
          });

          if (alreadyCheckedIn) {
            logger.info('Already checked in today');
            return { status: 'ALREADY_DONE', message: 'Already checked in today' };
          }

          // Button not found and not "already checked" - might be UI changed
          return { status: 'FAILED', message: 'Check-in button not found' };
        }

        // Click Check-in button
        await page.evaluate(() => {
          const btn = document.querySelector('#check-in-btn-sidebar') as HTMLElement;
          if (btn) btn.click();
        });

        // Wait for notification
        await page.waitForSelector('#notification', { timeout: 5000 }).catch(() => {});

        // Check notification text
        const notifText = await page.evaluate(() => {
          const notif = document.querySelector('#notification');
          return notif?.textContent?.toLowerCase() || '';
        });

        if (notifText.includes('success') || notifText.includes('checked')) {
          logger.info('Check-in successful');
          return { status: 'SUCCESS', message: 'Check-in completed' };
        }

        if (notifText.includes('already') || notifText.includes('come back')) {
          return { status: 'ALREADY_DONE', message: 'Already checked in today' };
        }

        // Assume success if no error notification
        logger.info('Check-in possibly completed');
        return { status: 'SUCCESS', message: 'Check-in completed' };

      } catch (error) {
        logger.error(`Check-in error: ${(error as Error).message}`);
        return { status: 'FAILED', message: (error as Error).message };
      }
    }, { maxRetries: 2, context: 'Check-in' });
  }

  /**
   * Convert SHARE to vNAMSO
   */
  async convertSHARE(page: Page, balance: number): Promise<ActionStatus> {
    return await withRetry(async () => {
      try {
        if (balance <= 10000) {
          return { status: 'ALREADY_DONE', message: `Balance (${balance}) <= 10000, skipping` };
        }

        logger.info(`Converting ${balance} SHARE...`);

        if (!page.url().includes('dashboard')) {
          await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.waitForNavigation(page);
        }

        await this.validatePageHealth(page);

        // Open sidebar
        await page.evaluate(() => {
          const sidebarBtn = document.querySelector('#openSidebar') as HTMLElement;
          if (sidebarBtn) sidebarBtn.click();
        });

        await page.waitForSelector('#sidebar', { timeout: 5000 }).catch(() => {});
        await this.sleep(500);

        // Click Convert link
        const convertClicked = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          if (links.length >= 7) {
            (links[6] as HTMLElement).click();
            return true;
          }
          return false;
        });

        if (!convertClicked) {
          throw new Error('Convert link not found');
        }

        // Wait for convert page
        await page.waitForFunction(() => {
          return document.querySelector('#convert-amount-input') !== null;
        }, { timeout: 10000 });

        const convertAmount = Math.floor(balance);

        // Enter convert amount
        await page.evaluate((amount) => {
          const input = document.querySelector('#convert-amount-input') as HTMLInputElement;
          if (input) {
            input.value = '';
            input.value = amount;
          }
        }, String(convertAmount));

        // Click Convert button
        await page.evaluate(() => {
          const btn = document.querySelector('#convert-share-btn') as HTMLElement;
          if (btn) btn.click();
        });

        await this.sleep(1000);

        // Click Confirm button
        await page.evaluate(() => {
          const btn = document.querySelector('#modal-confirm-btn') as HTMLElement;
          if (btn) btn.click();
        });

        await this.sleep(2000);

        logger.info(`Convert successful: ${convertAmount} SHARE`);
        return { status: 'SUCCESS', message: `Converted ${convertAmount} SHARE` };

      } catch (error) {
        logger.error(`Convert error: ${(error as Error).message}`);
        return { status: 'FAILED', message: (error as Error).message };
      }
    }, { maxRetries: 2, context: 'Convert' });
  }

  async getPoints(page: Page): Promise<number> {
    return await this.getConvertibleSHARE(page);
  }

  /**
   * Get Check-in Streak from Dashboard
   * Uses full page scroll to trigger all lazy loading
   */
  async getCheckInStreak(page: Page): Promise<string> {
    try {
      if (!page.url().includes('dashboard')) {
        await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.waitForNavigation(page);
      }

      await this.validatePageHealth(page);

      // Scroll entire page to trigger lazy loading
      logger.info('Scrolling page to trigger lazy loading...');
      await page.evaluate(async () => {
        const scrollHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        const steps = 5;

        for (let i = 0; i <= steps; i++) {
          window.scrollTo({
            top: (scrollHeight - windowHeight) * (i / steps),
            behavior: 'smooth'
          });
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      });

      await this.sleep(1000);

      const streakText = await page.evaluate(() => {
        const containers = ['#dashboard-page', 'main', 'body'];

        for (const container of containers) {
          const parent = document.querySelector(container);
          if (!parent) continue;

          const cards = Array.from(parent.querySelectorAll(':scope > div, div[class*="card"], div[class*="border"]'));
          for (const card of cards) {
            const heading = card.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
              const headingText = heading.textContent?.toLowerCase() || '';
              if (headingText.includes('check-in') && headingText.includes('streak')) {
                const valueEl = card.querySelector('.shuffle-text, .text-3xl, [class*="text-3xl"], [class*="font-bold"]');
                if (valueEl) {
                  const attrText = (valueEl as HTMLElement).getAttribute('data-final-text');
                  if (attrText) return attrText;
                  const text = valueEl.textContent?.trim() || '';
                  if (text) return text;
                }
              }
            }
          }
        }
        return 'N/A';
      });

      logger.info(`Check-in Streak: ${streakText}`);
      return streakText;

    } catch (error) {
      logger.error(`Failed to get check-in streak: ${(error as Error).message}`);
      return 'N/A';
    }
  }
}
