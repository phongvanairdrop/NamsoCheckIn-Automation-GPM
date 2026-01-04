/**
 * Retry Utility - Exponential Backoff with Jitter
 *
 * Features:
 * - Max retries: Configurable (default 3)
 * - Backoff: 2^n seconds (2s, 4s, 8s...)
 * - Jitter: Random +/- 500ms to prevent thundering herd
 * - Fatal errors: Do NOT retry on logic errors
 * - Logging: Log warnings on each retry
 */

import { logger } from '../infrastructure/logger.js';

// Errors that should NOT be retried (logic errors, not transient)
const FATAL_ERROR_PATTERNS = [
  'invalid credentials',
  'invalid password',
  'authentication failed',
  'unauthorized',
  'balance too low',
  'insufficient balance',
  'not found'
];

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fatalErrorPatterns?: string[];
  context?: string;
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    fatalErrorPatterns = FATAL_ERROR_PATTERNS,
    context = 'Operation'
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();

    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message.toLowerCase();

      // Check if this is a fatal error (should not retry)
      const isFatal = fatalErrorPatterns.some(pattern =>
        errorMsg.includes(pattern.toLowerCase())
      );

      if (isFatal) {
        logger.error(`${context}: Fatal error - no retry: ${lastError.message}`);
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        logger.error(`${context}: Failed after ${maxRetries} retries: ${lastError.message}`);
        throw lastError;
      }

      // Calculate backoff with jitter
      const backoffMs = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      const jitter = Math.floor(Math.random() * 1000) - 500; // +/- 500ms
      const delay = Math.max(backoffMs + jitter, 500); // Min 500ms

      logger.warn(`${context}: Retry ${attempt + 1}/${maxRetries} after ${delay}ms - ${lastError.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const errorMsg = error.message.toLowerCase();
  return !FATAL_ERROR_PATTERNS.some(pattern => errorMsg.includes(pattern));
}

/**
 * Create a timeout promise that rejects after specified ms
 */
export function createTimeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}
