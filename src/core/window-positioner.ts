/**
 * Window Positioner - Calculate grid layout for browser windows
 *
 * Automatically arranges windows in a grid based on screen size
 * and concurrency level for easy monitoring
 */

import type { WindowPosition, WindowSize } from '../types/index.js';

export interface PositionerConfig {
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  maxConcurrency: number;
  startX?: number;
  startY?: number;
  padding?: number;
}

export class WindowPositioner {
  private readonly config: PositionerConfig;
  private currentSlot = 0;

  constructor(config: PositionerConfig) {
    this.config = {
      ...config,
      startX: config.startX ?? 0,
      startY: config.startY ?? 0,
      padding: config.padding ?? 10
    };
  }

  /**
   * Calculate grid columns based on screen width and window width
   */
  private calculateColumns(): number {
    const availableWidth = this.config.screenWidth - (this.config.startX ?? 0);
    const columnsWithPadding = Math.floor(availableWidth / (this.config.windowWidth + (this.config.padding ?? 0)));
    return Math.max(1, columnsWithPadding);
  }

  /**
   * Get next window position in grid
   * Slots are assigned in order: top-left to bottom-right
   */
  getNextPosition(): { position: WindowPosition; slot: number } {
    const columns = this.calculateColumns();
    const row = Math.floor(this.currentSlot / columns);
    const col = this.currentSlot % columns;

    const x = (this.config.startX ?? 0) + col * (this.config.windowWidth + (this.config.padding ?? 0));
    const y = (this.config.startY ?? 0) + row * (this.config.windowHeight + (this.config.padding ?? 0));

    // Wrap around if max slots exceeded
    this.currentSlot = (this.currentSlot + 1) % (this.config.maxConcurrency || 999);

    return {
      position: { x, y },
      slot: this.currentSlot - 1
    };
  }

  /**
   * Get position for specific slot number
   */
  getPositionForSlot(slot: number): WindowPosition {
    const columns = this.calculateColumns();
    const row = Math.floor(slot / columns);
    const col = slot % columns;

    return {
      x: (this.config.startX ?? 0) + col * (this.config.windowWidth + (this.config.padding ?? 0)),
      y: (this.config.startY ?? 0) + row * (this.config.windowHeight + (this.config.padding ?? 0))
    };
  }

  /**
   * Reset slot counter
   */
  reset(): void {
    this.currentSlot = 0;
  }

  /**
   * Create positioner from environment variables
   */
  static fromEnv(env: Record<string, string | undefined>): WindowPositioner {
    const screenWidth = parseInt(env.SCREEN_WIDTH || '1920');
    const screenHeight = parseInt(env.SCREEN_HEIGHT || '1080');
    const concurrency = parseInt(env.CONCURRENCY || '8');

    // Parse WINDOW_SIZE from format "WIDTHxHEIGHT"
    const windowSizeStr = env.WINDOW_SIZE || '800x600';
    const [width, height] = windowSizeStr.split('x').map(Number);

    return new WindowPositioner({
      screenWidth,
      screenHeight,
      windowWidth: width || 800,
      windowHeight: height || 600,
      maxConcurrency: concurrency
    });
  }

  /**
   * Create positioner with default values (1920x1080 screen, 800x600 windows)
   */
  static createDefault(): WindowPositioner {
    return new WindowPositioner({
      screenWidth: 1920,
      screenHeight: 1080,
      windowWidth: 800,
      windowHeight: 600,
      maxConcurrency: 8
    });
  }
}
