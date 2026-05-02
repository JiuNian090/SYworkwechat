'use strict';

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ShiftColors {
  solid: string;
  background: string;
  border: string;
  light: string;
}

function hexToRgb(hex: string): RGBColor | null {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) {
    return null;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

function rgbToHex(rgb: RGBColor): string {
  if (!rgb || typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') {
    return '#000000';
  }

  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenColor(color: string, amount?: number): string {
  amount = amount === undefined ? 0.5 : amount;
  if (!color || !color.startsWith('#') || color.length !== 7) {
    return color || '#07c160';
  }

  const rgb = hexToRgb(color);
  if (!rgb) {
    return color || '#07c160';
  }

  const r = Math.min(240, Math.floor((240 - rgb.r) * amount + rgb.r));
  const g = Math.min(240, Math.floor((240 - rgb.g) * amount + rgb.g));
  const b = Math.min(240, Math.floor((240 - rgb.b) * amount + rgb.b));

  return rgbToHex({ r, g, b });
}

function colorWithAlpha(color: string, alpha: number): string {
  if (!color || !color.startsWith('#') || color.length !== 7) {
    return color || '#07c160';
  }

  alpha = Math.max(0, Math.min(1, alpha));
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return color + alphaHex;
}

function getShiftColors(baseColor: string): ShiftColors {
  const lightenedColorValue = lightenColor(baseColor, 0.7);
  return {
    solid: baseColor,
    background: lightenedColorValue,
    border: lightenedColorValue,
    light: lightenColor(baseColor)
  };
}

const DEFAULT_SHIFT_COLORS: { day: string; night: string; off: string } = {
  day: '#fbbf24',
  night: '#6366f1',
  off: '#999999'
};

module.exports = {
  hexToRgb,
  rgbToHex,
  lightenColor,
  colorWithAlpha,
  getShiftColors,
  DEFAULT_SHIFT_COLORS
};

export {};
