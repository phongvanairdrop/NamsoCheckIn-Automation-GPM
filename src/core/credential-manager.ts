/**
 * Credential Manager - Load credentials from Excel
 *
 * Excel format (4 columns):
 * ProfileName | ProfileID | Namso | Password
 *
 * - Namso: email = has account, "No" = skip
 */

import xlsx from 'xlsx';
import type { Credential } from '../types/index.js';

export class CredentialManager {
  private credentials = new Map<string, Credential>();
  private nameToIdMap = new Map<string, string>();

  async load(filePath: string): Promise<void> {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet) as any[];

      this.credentials.clear();
      this.nameToIdMap.clear();

      for (const row of rows) {
        const profileName = row.ProfileName || row.profileName || '';
        const profileId = row.ProfileID || row.profileID || row.profile_id || '';
        const namso = row.Namso || row.namso || '';
        const password = row.Password || row.password || '';

        // Skip if Namso = "No" (no account)
        if (namso.toString().toLowerCase() === 'no') {
          continue;
        }

        // Skip if no email or missing required fields
        if (!profileId || !namso || !password) {
          continue;
        }

        const cred: Credential = {
          gpm_profile_id: profileId,
          gpm_profile_name: profileName,
          email: namso, // Namso column = email
          password: String(password)
        };

        this.credentials.set(profileId, cred);
        if (profileName) {
          this.nameToIdMap.set(profileName, profileId);
        }
      }

      console.log(`Loaded ${this.credentials.size} credentials from ${filePath}`);
    } catch (error) {
      throw new Error(`Failed to load credentials: ${(error as Error).message}`);
    }
  }

  getByGPMId(profileId: string): Credential | undefined {
    return this.credentials.get(profileId);
  }

  getByProfileName(profileName: string): Credential | undefined {
    const profileId = this.nameToIdMap.get(profileName);
    return profileId ? this.credentials.get(profileId) : undefined;
  }

  getAll(): Credential[] {
    return Array.from(this.credentials.values());
  }

  get count(): number {
    return this.credentials.size;
  }
}
