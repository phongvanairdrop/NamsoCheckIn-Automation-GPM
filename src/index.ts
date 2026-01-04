/**
 * Namso Validator Bot - Main Entry Point
 *
 * Manual trigger mode (validation adjustment: no auto-scheduler)
 * Usage: npm run checkin
 */

import 'dotenv/config';
import { GPMClient } from './core/gpm-client.js';
import { CredentialManager } from './core/credential-manager.js';
import { ProfilePool } from './core/profile-pool.js';
import { TelegramNotifier, ExcelWriter, logger } from './infrastructure/index.js';

// Configuration
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_PROFILES || '8');
const CREDENTIALS_FILE = process.env.CREDENTIALS_FILE || './config/credentials.xlsx';
const RESULTS_FILE = process.env.RESULTS_FILE || './config/results.xlsx';

async function main() {
  logger.info('=================================');
  logger.info('Namso Validator Bot Starting...');
  logger.info('=================================');

  // Check GPM health
  logger.info('Checking GPM connection...');
  const gpm = new GPMClient();

  if (!(await gpm.isHealthy())) {
    throw new Error('GPM not running on http://127.0.0.1:19995. Please start GPM first.');
  }
  logger.info('GPM connection OK');

  // Load credentials
  logger.info(`Loading credentials from ${CREDENTIALS_FILE}...`);
  const credManager = new CredentialManager();
  await credManager.load(CREDENTIALS_FILE);

  const credentials = credManager.getAll();
  if (credentials.length === 0) {
    throw new Error('No credentials found. Check your credentials.xlsx file.');
  }
  logger.info(`Loaded ${credentials.length} credentials`);

  // Setup components
  const telegram = new TelegramNotifier();
  if (telegram.isEnabled()) {
    logger.info('Telegram notifications enabled');
  } else {
    logger.info('Telegram notifications disabled');
  }

  const excelWriter = new ExcelWriter(RESULTS_FILE);
  logger.info(`Excel output: ${RESULTS_FILE}`);

  const pool = new ProfilePool(gpm, telegram, excelWriter, MAX_CONCURRENT);

  // Process all profiles
  logger.info(`Starting check-in with concurrency ${MAX_CONCURRENT}...`);
  logger.info('-----------------------------------');

  const results = await pool.processAll(credentials);

  // Summary
  logger.info('=================================');
  logger.info('FINAL RESULTS');
  logger.info('=================================');

  const success = results.filter(r => r.loginSuccess && r.checkInSuccess).length;
  const failed = results.length - success;
  const totalPoints = results.reduce((sum, r) => sum + r.sharePoints, 0);

  logger.info(`✅ Success: ${success}/${results.length}`);
  logger.info(`❌ Failed: ${failed}`);
  logger.info(`📈 Total SHARE: ${totalPoints}`);

  if (failed > 0) {
    logger.info('');
    logger.info('Failed profiles:');
    results
      .filter(r => !r.loginSuccess || !r.checkInSuccess)
      .forEach(r => {
        logger.info(`  - ${r.email}: ${r.error || 'Unknown error'}`);
      });
  }

  logger.info('=================================');
  logger.info('Bot finished. Exiting.');
  logger.info('=================================');
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\nReceived SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\nReceived SIGTERM, shutting down...');
  process.exit(0);
});

// Run
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
