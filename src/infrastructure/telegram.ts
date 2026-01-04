/**
 * Telegram Notifier - Send alerts and reports via Telegram bot
 */

import TelegramBot from 'node-telegram-bot-api';
import type { ProcessingResult } from '../types/index.js';
import { logger } from './logger.js';

export class TelegramNotifier {
  private bot?: TelegramBot;
  private chatId: string;
  private enabled: boolean;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.enabled = !!token && !!this.chatId;

    if (this.enabled) {
      try {
        this.bot = new TelegramBot(token!, { polling: false });
      } catch (error) {
        logger.warn('Failed to initialize Telegram bot', error as Error);
        this.enabled = false;
      }
    } else {
      logger.warn('Telegram notifications disabled (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
    }
  }

  /**
   * Send alert for a specific profile error
   */
  async sendAlert(profileEmail: string, message: string): Promise<void> {
    if (!this.enabled || !this.bot) return;

    try {
      const msg = `⚠️ *Namso Alert*\n\n📧 *Profile:* ${profileEmail}\n❗ *Issue:* ${message}`;
      await this.bot.sendMessage(this.chatId, msg, { parse_mode: 'Markdown' });
      logger.debug(`Telegram alert sent for ${profileEmail}`);
    } catch (error) {
      logger.error('Failed to send Telegram alert', error as Error);
    }
  }

  /**
   * Send summary report after processing all profiles
   */
  async sendReport(results: ProcessingResult[]): Promise<void> {
    if (!this.enabled || !this.bot) return;

    const success = results.filter(r => r.loginSuccess && r.checkInSuccess).length;
    const failed = results.length - success;
    const totalPoints = results.reduce((sum, r) => sum + r.sharePoints, 0);

    let msg = `📊 *Namso Check-in Report*\n`;
    msg += `⏰ ${new Date().toLocaleString('vi-VN')}\n\n`;
    msg += `✅ *Success:* ${success}\n`;
    msg += `❌ *Failed:* ${failed}\n`;
    msg += `📈 *Total SHARE:* ${totalPoints}\n`;

    if (failed > 0) {
      msg += `\n🚨 *Failed Profiles:*\n`;
      results
        .filter(r => !r.loginSuccess || !r.checkInSuccess)
        .forEach(r => {
          msg += `• ${r.email}: ${r.error || 'Unknown error'}\n`;
        });
    }

    try {
      await this.bot.sendMessage(this.chatId, msg, { parse_mode: 'Markdown' });
      logger.info('Telegram report sent');
    } catch (error) {
      logger.error('Failed to send Telegram report', error as Error);
    }
  }

  /**
   * Check if Telegram notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
