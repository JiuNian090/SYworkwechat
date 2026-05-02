export interface CloudResult {
  success: boolean;
  errMsg?: string;
  data?: Record<string, unknown>;
}

export interface BackupData {
  shiftTemplates?: ShiftTemplate[];
  shifts?: ShiftsData;
  images?: CloudImageInfo[];
  imageWeekRelation?: ImageWeekRelation;
  avatarInfo?: AvatarInfo;
  backupIndex?: Record<string, unknown>;
  version?: string;
}

export interface CloudImageInfo {
  weekKey: string;
  imageName: string;
  remotePath: string;
  fileID: string;
  hash: string;
  addedTime?: string;
  name?: string;
  path?: string;
}

export interface AvatarInfo {
  avatarType: string;
  avatarEmoji: string;
  username: string;
}

export interface BackupInfo {
  success: boolean;
  hasBackup: boolean;
  backupTime?: string;
  data?: {
    backupTime?: string;
    backupHash?: string;
  };
  errMsg?: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  hours?: number;
}

interface ShiftsData {
  [date: string]: Array<{
    date: string;
    templateId: string;
    templateName?: string;
    startTime?: string;
    endTime?: string;
    color?: string;
    hours?: number;
    note?: string;
  }>;
}

interface ImageWeekRelation {
  [weekKey: string]: Array<{
    name: string;
    path: string;
    hash?: string;
    id?: string;
  }>;
}
