export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  hours?: number;
}

export interface ShiftData {
  date: string;
  templateId: string;
  templateName?: string;
  startTime?: string;
  endTime?: string;
  color?: string;
  hours?: number;
  note?: string;
}

export interface ShiftsData {
  [date: string]: ShiftData[];
}

export interface ShiftSelectorOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}
