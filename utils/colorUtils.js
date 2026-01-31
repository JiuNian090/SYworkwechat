// 颜色处理工具函数

/**
 * 将十六进制颜色转换为RGB对象
 * @param {string} hex - 十六进制颜色值
 * @returns {object} RGB对象
 */
export function hexToRgb(hex) {
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

/**
 * 将RGB对象转换为十六进制颜色
 * @param {object} rgb - RGB对象
 * @returns {string} 十六进制颜色值
 */
export function rgbToHex(rgb) {
  if (!rgb || typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') {
    return '#000000';
  }
  
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 使颜色变浅
 * @param {string} color - 十六进制颜色值
 * @param {number} amount - 变浅程度 (0-1)
 * @returns {string} 变浅后的十六进制颜色值
 */
export function lightenColor(color, amount = 0.5) {
  if (!color || !color.startsWith('#') || color.length !== 7) {
    return color || '#07c160';
  }
  
  const rgb = hexToRgb(color);
  if (!rgb) {
    return color || '#07c160';
  }
  
  // 计算变浅后的RGB值
  const r = Math.min(240, Math.floor((240 - rgb.r) * amount + rgb.r));
  const g = Math.min(240, Math.floor((240 - rgb.g) * amount + rgb.g));
  const b = Math.min(240, Math.floor((240 - rgb.b) * amount + rgb.b));
  
  return rgbToHex({ r, g, b });
}

/**
 * 生成带透明度的颜色
 * @param {string} color - 十六进制颜色值
 * @param {number} alpha - 透明度 (0-1)
 * @returns {string} 带透明度的颜色值
 */
export function colorWithAlpha(color, alpha) {
  if (!color || !color.startsWith('#') || color.length !== 7) {
    return color || '#07c160';
  }
  
  // 确保alpha在0-1之间
  alpha = Math.max(0, Math.min(1, alpha));
  
  // 将alpha转换为十六进制 (00-FF)
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  
  return color + alphaHex;
}

/**
 * 获取排班相关的颜色配置
 * @param {string} baseColor - 基础颜色
 * @returns {object} 颜色配置对象
 */
export function getShiftColors(baseColor) {
  // 通过修改RGB值使颜色变浅，不使用透明度
  const lightenedColor = lightenColor(baseColor, 0.7);
  return {
    // 纯颜色（用于文字和徽章）
    solid: baseColor,
    // 背景色（通过修改RGB值实现浅淡效果）
    background: lightenedColor,
    // 边框色（与背景色相同，实现无缝融合）
    border: lightenedColor,
    // 浅色（用于标题背景）
    light: lightenColor(baseColor)
  };
}

/**
 * 默认班次颜色
 */
export const DEFAULT_SHIFT_COLORS = {
  day: '#fbbf24',  // 日班
  night: '#6366f1', // 夜班
  off: '#999999'    // 休息
};
