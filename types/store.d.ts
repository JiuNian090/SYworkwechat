import type { ShiftsData, ShiftTemplate } from './shift';
import type { CloudUserInfo } from './user';

export interface StoreState {
  cloudInitialized: boolean;
  cloudUserId: string;
  cloudAccount: string;
  cloudUserInfo: CloudUserInfo | null;
  username: string;
  avatarType: string;
  avatarEmoji: string;
  shifts: ShiftsData | Record<string, never>;
  shiftTemplates: ShiftTemplate[];
  customWeeklyHours: number;
  customHours: number;
  chartType: string;
  savedAccounts: string[];
  autoRestoreMap: Record<string, boolean>;
  lastBackupTime?: string;
  lastRestoreTime?: string;
  _lastDataRestore?: number;
}

export interface StoreAPI {
  getState: {
    (): StoreState;
    (keys: string): unknown;
    (keys: string[]): Partial<StoreState>;
  };
  setState: (updates: Partial<StoreState>, persistKeys?: string[]) => void;
  removeState: (keys: string[], persistKeys?: string[]) => void;
  subscribe: (key: string | null, callback: (newVal: unknown, prevVal: unknown) => void) => () => void;
  persistToStorage: (storageMap: Record<string, string>) => void;
}
