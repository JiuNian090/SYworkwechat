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

export interface ChartColors {
  plotBg: string;
  gridLine: string;
  gridLineLight: string;
  axisBorder: string;
  axisLabel: string;
  axisUnit: string;
  titleBg: string;
  titleText: string;
  legendText: string;
  dataLabel: string;
  chartLine: string;
  chartLine2: string;
  chartGrad1: string;
  chartGrad2: string;
  chartGrad3: string;
  areaGrad1: string;
  areaGrad2: string;
  pointOuter: string;
  pointInner: string;
  standardLine: string;
  shadowColor: string;
  shadowColor2: string;
  emptyText: string;
  barShadow: string;
}
