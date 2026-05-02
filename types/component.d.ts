export interface ColorPickerProps {
  color: string;
  showPicker: boolean;
}

export interface ColorPickerData {
  currentColor: string;
  colors: string[];
  hue: number;
  saturation: number;
  lightness: number;
}

export interface ChartViewProps {
  chartData: unknown;
  chartType: string;
  width: number;
  height: number;
}

export interface ChartViewData {
  canvasWidth: number;
  canvasHeight: number;
  isDrawing: boolean;
}

export interface ShiftSelectorProps {
  shifts: unknown[];
  selectedId: string;
  showSelector: boolean;
}

export interface ShiftSelectorData {
  shiftList: unknown[];
  currentSelected: string;
}
