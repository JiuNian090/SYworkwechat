export interface StatData {
  [date: string]: {
    hours: number;
    shifts: number;
    [key: string]: unknown;
  };
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie';
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface HeatmapData {
  date: string;
  hours: number;
  level: number;
}

export interface WeeklyStat {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  dailyHours: number[];
}
