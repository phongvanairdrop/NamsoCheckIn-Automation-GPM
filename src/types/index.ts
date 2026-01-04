/**
 * Core types for Namso Validator Automation
 */

// ============================================================
// GPM Types
// ============================================================

export interface GPMProfile {
  profile_id: string;
  profile_name: string;
  [key: string]: any;
}

export interface GPMStartResult {
  success: boolean;
  data: {
    profile_id: string;
    remote_debugging_address: string;  // CRITICAL: Save for reconnect
    browser_location: string;
    driver_path: string;
    success?: boolean;
  };
  message?: string;
}

// ============================================================
// Credential Types
// ============================================================

export interface Credential {
  gpm_profile_id: string;
  gpm_profile_name?: string;
  email: string;
  password: string;
  notes?: string;
}

// ============================================================
// Namso Types
// ============================================================

export enum LoginStatus {
  SUCCESS = 'success',
  NEEDS_OTP = 'needs_otp',
  FAILED = 'failed',
  ALREADY_LOGGED_IN = 'already_logged_in'
}

export interface NamsoState {
  isLoggedIn: boolean;
  sharePoints: number;
  lastCheckIn?: Date;
  canConvert: boolean;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ActionStatus {
  status: 'SUCCESS' | 'ALREADY_DONE' | 'FAILED';
  message: string;
}

// ============================================================
// Processing Types
// ============================================================

export interface ProcessingResult {
  profileId: string;
  profileName?: string;
  email: string;
  loginSuccess: boolean;
  checkInSuccess: boolean;
  convertSuccess: boolean;
  sharePoints: number;
  checkInStreak?: string;
  error?: string;
  timestamp: Date;
}

// ============================================================
// Window Position Types
// ============================================================

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowOptions {
  size?: WindowSize;
  position?: WindowPosition;
  scale?: number;
}
