/**
 * Excel Writer - Append results with history tracking
 */

import xlsx from 'xlsx';
import type { ProcessingResult } from '../types/index.js';
import { logger } from './logger.js';

interface ExcelRow {
  ProfileName: string;
  Email: string;
  Login_Success: string;
  CheckIn_Success: string;
  Convert_Success: string;
  SHARE_Points: number;
  CheckIn_Streak: string;
  Last_Check_In: string;
  Error?: string;
}

export class ExcelWriter {
  private outputPath: string;

  constructor(outputPath: string = './config/results.xlsx') {
    this.outputPath = outputPath;
  }

  /**
   * Append/Update results - keeps history
   */
  async writeResults(results: ProcessingResult[]): Promise<void> {
    try {
      let existingData: ExcelRow[] = [];

      // Read existing
      try {
        const workbook = xlsx.readFile(this.outputPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        existingData = xlsx.utils.sheet_to_json(sheet) as ExcelRow[];
      } catch {
        // New file
      }

      // Create map for quick lookup by ProfileName
      const existingMap = new Map<string, ExcelRow>();
      for (const row of existingData) {
        existingMap.set(row.ProfileName, row);
      }

      // Update/add new results
      for (const r of results) {
        const row: ExcelRow = {
          ProfileName: r.profileName || 'N/A',
          Email: r.email,
          Login_Success: r.loginSuccess ? '✓' : '✗',
          CheckIn_Success: r.checkInSuccess ? '✓' : '✗',
          Convert_Success: r.convertSuccess ? '✓' : '✗',
          SHARE_Points: r.sharePoints,
          CheckIn_Streak: r.checkInStreak || 'N/A',
          Last_Check_In: this.formatDate(r.timestamp),
          Error: r.error || ''
        };
        existingMap.set(row.ProfileName, row);
      }

      // Write all data
      const allRows = Array.from(existingMap.values());
      const worksheet = xlsx.utils.json_to_sheet(allRows);
      worksheet['!cols'] = [
        { wch: 15 }, // ProfileName
        { wch: 30 }, // Email
        { wch: 12 }, // Login_Success
        { wch: 12 }, // CheckIn_Success
        { wch: 12 }, // Convert_Success
        { wch: 12 }, // SHARE_Points
        { wch: 12 }, // CheckIn_Streak
        { wch: 20 }, // Last_Check_In
        { wch: 30 }  // Error
      ];

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');
      xlsx.writeFile(workbook, this.outputPath);

      logger.info(`Results saved: ${this.outputPath}`);

    } catch (error) {
      logger.error(`Excel write failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  }
}
