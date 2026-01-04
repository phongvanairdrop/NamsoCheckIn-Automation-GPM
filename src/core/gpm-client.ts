/**
 * GPM Client - API wrapper for GPM-Login browser profiles
 *
 * Key pattern: Cache remote_debugging_address for Puppeteer reconnection
 * After task: Call stopProfile() to close browser via GPM
 *
 * REFACTORED: Added AbortController timeouts to ALL fetch requests
 */

import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import type { GPMProfile, GPMStartResult, WindowOptions } from '../types/index.js';
import { logger } from '../infrastructure/logger.js';

// Timeout for all GPM API calls (30 seconds)
const GPM_API_TIMEOUT = 30000;

export class GPMClient {
  private readonly apiBase: string;
  private readonly debugAddressCache = new Map<string, string>();

  constructor(apiBase: string = 'http://127.0.0.1:19995') {
    this.apiBase = apiBase;
  }

  /**
   * Fetch with timeout - Prevents infinite hangs
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = GPM_API_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`GPM API Timeout (${timeout}ms): ${url}`);
      }
      throw error;
    }
  }

  /**
   * Get all profiles from GPM
   */
  async getProfiles(): Promise<GPMProfile[]> {
    const res = await this.fetchWithTimeout(`${this.apiBase}/api/v3/profiles`);
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Start a GPM profile and return the debug address
   * CRITICAL: Cache the debug address for reconnection
   *
   * @param profileId - GPM profile ID
   * @param windowOptions - Optional window size, position, and scale
   */
  async startProfile(profileId: string, windowOptions?: WindowOptions): Promise<string> {
    let url = `${this.apiBase}/api/v3/profiles/start/${profileId}`;
    const params = new URLSearchParams();

    if (windowOptions?.size) {
      params.append('win_size', `${windowOptions.size.width},${windowOptions.size.height}`);
    }
    if (windowOptions?.position) {
      params.append('win_pos', `${windowOptions.position.x},${windowOptions.position.y}`);
    }
    if (windowOptions?.scale !== undefined) {
      params.append('win_scale', String(windowOptions.scale));
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const res = await this.fetchWithTimeout(url);
    const data = await res.json() as any;

    // Handle different response formats from GPM
    let debugAddress: string | undefined;

    if (data.data?.remote_debugging_address) {
      debugAddress = data.data.remote_debugging_address;
    } else if (data.remote_debugging_address) {
      debugAddress = data.remote_debugging_address;
    }

    if (!debugAddress) {
      throw new Error(`Failed to start profile ${profileId}: No debug address in response. Data: ${JSON.stringify(data)}`);
    }

    // CRITICAL: Cache debug address for reconnect
    this.debugAddressCache.set(profileId, debugAddress);

    return debugAddress;
  }

  /**
   * Stop and close a GPM profile browser
   * This closes the browser via GPM (not just disconnect)
   */
  async stopProfile(profileId: string): Promise<void> {
    await this.fetchWithTimeout(`${this.apiBase}/api/v3/profiles/close/${profileId}`);
    this.debugAddressCache.delete(profileId);
  }

  /**
   * Connect Puppeteer to running GPM profile using debug address
   * With retry for browser startup delay
   */
  async connectBrowser(debugAddress: string): Promise<Browser> {
    const maxRetries = 10;
    const retryDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await puppeteer.connect({
          browserURL: `http://${debugAddress}`,
          defaultViewport: null
        });
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }

    throw new Error('Failed to connect to browser after retries');
  }

  /**
   * Reconnect to a profile using cached debug address
   */
  async reconnect(profileId: string): Promise<Browser> {
    const debugAddress = this.debugAddressCache.get(profileId);
    if (!debugAddress) {
      throw new Error(`No cached debug address for profile ${profileId}`);
    }
    return await this.connectBrowser(debugAddress);
  }

  /**
   * Disconnect Puppeteer from browser (browser stays running)
   * Note: Use stopProfile() to fully close the browser
   */
  async disconnect(browser: Browser): Promise<void> {
    try {
      await browser.disconnect();
    } catch (error) {
      logger.warn(`Disconnect error: ${(error as Error).message}`);
    }
  }

  /**
   * Get cached debug address for a profile
   */
  getCachedDebugAddress(profileId: string): string | undefined {
    return this.debugAddressCache.get(profileId);
  }

  /**
   * Check if GPM API is healthy and running
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.apiBase}/api/v3/profiles`, {
        signal: controller.signal
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
