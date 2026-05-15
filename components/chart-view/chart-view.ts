'use strict';
import type { ChartColors } from '../../types/statistics';
type CanvasContext = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
const DAY_THRESHOLD = 7;

interface ChartDataItem {
  labels: string[];
  data: number[];
  standardData?: number[];
  yAxisMin: number;
  yAxisMax: number;
  subtext?: string;
}

interface Point {
  x: number;
  y: number;
}

interface ChartOption {
  chartData?: ChartDataItem;
  chartType?: string;
  startDate?: string;
  endDate?: string;
  chartTimeUnit?: string;
}

type ChartTimeUnit = 'day' | 'week' | 'month';

const THEME_COLORS: Record<string, ChartColors> = {
  dark: {
    plotBg: '#1f1f1f',
    gridLine: '#333333',
    gridLineLight: '#2a2a2a',
    axisBorder: '#444444',
    axisLabel: '#9ca3af',
    axisUnit: '#737373',
    titleBg: 'rgba(255,255,255,0.05)',
    titleText: '#e5e5e5',
    legendText: '#a3a3a3',
    dataLabel: '#a3a3a3',
    chartLine: '#34d399',
    chartLine2: '#10b981',
    chartGrad1: '#34d399',
    chartGrad2: '#6ee7b7',
    chartGrad3: '#2a8a6a',
    areaGrad1: 'rgba(52,211,153,0.15)',
    areaGrad2: 'rgba(52,211,153,0.02)',
    pointOuter: '#34d399',
    pointInner: '#e5e5e5',
    standardLine: '#3b82f6',
    shadowColor: 'rgba(52,211,153,0.2)',
    shadowColor2: 'rgba(52,211,153,0.35)',
    emptyText: '#737373',
    barShadow: 'rgba(52,211,153,0.15)',
  },
  light: {
    plotBg: '#fafbfc',
    gridLine: '#e5e7eb',
    gridLineLight: '#e5e7eb',
    axisBorder: '#d1d5db',
    axisLabel: '#6b7280',
    axisUnit: '#9ca3af',
    titleBg: 'rgba(31,41,55,0.04)',
    titleText: '#1f2937',
    legendText: '#374151',
    dataLabel: '#374151',
    chartLine: '#34d399',
    chartLine2: '#10b981',
    chartGrad1: '#34d399',
    chartGrad2: '#6ee7b7',
    chartGrad3: '#a7f3d0',
    areaGrad1: 'rgba(52,211,153,0.12)',
    areaGrad2: 'rgba(52,211,153,0.02)',
    pointOuter: '#34d399',
    pointInner: '#fff',
    standardLine: '#3b82f6',
    shadowColor: 'rgba(52,211,153,0.15)',
    shadowColor2: 'rgba(52,211,153,0.3)',
    emptyText: '#9ca3af',
    barShadow: 'rgba(52,211,153,0.12)',
  },
};

function getChartColors(): ChartColors {
  const theme = wx.getAppBaseInfo().theme;
  return THEME_COLORS[theme === 'dark' ? 'dark' : 'light'];
}

Component({
  properties: {
    chartData: {
      type: Object,
      value: { labels: [], data: [], standardData: [], yAxisMin: 0, yAxisMax: 10, subtext: '' }
    },
    chartType: {
      type: String,
      value: 'line'
    },
    startDate: {
      type: String,
      value: ''
    },
    endDate: {
      type: String,
      value: ''
    },
    chartTimeUnit: {
      type: String,
      value: 'day'
    }
  },

  data: {
    canvasWidth: 0,
    canvasHeight: 310
  },

  observers: {
    'chartData, chartType': function (): void {
      this.drawChart();
    }
  },

  lifetimes: {
    attached(): void {
      const windowInfo = wx.getWindowInfo();
      const chartWidth = windowInfo.windowWidth - 60;
      this.setData({ canvasWidth: chartWidth });
    },
    ready(): void {
      this.triggerEvent('chartinit', { component: this });
      this.drawChart();
      // 监听系统主题变化，自动重绘
      try {
        const self = this;
        const cb = function () { self.drawChart(); };
        (self as unknown as Record<string, WechatMiniprogram.OnThemeChangeCallback>)._onThemeChange = cb as unknown as WechatMiniprogram.OnThemeChangeCallback;
        wx.onThemeChange(cb as unknown as WechatMiniprogram.OnThemeChangeCallback);
      } catch (e) { /* 基础库不支持时忽略 */ }
    },
    detached(): void {
      try {
        const self = this as unknown as Record<string, unknown>;
        if (typeof self._onThemeChange === 'function') {
          wx.offThemeChange(self._onThemeChange as WechatMiniprogram.OffThemeChangeCallback);
        }
      } catch (e) { /* 忽略 */ }
    }
  },

  methods: {
    setOption(option: ChartOption): void {
      const patch: Record<string, unknown> = {};
      if (option.chartData) patch.chartData = option.chartData;
      if (option.chartType) patch.chartType = option.chartType;
      if (option.startDate) patch.startDate = option.startDate;
      if (option.endDate) patch.endDate = option.endDate;
      if (option.chartTimeUnit) patch.chartTimeUnit = option.chartTimeUnit;
      if (Object.keys(patch).length) this.setData(patch);
    },

    drawChart(): void {
      const { chartData, chartType, startDate, endDate, chartTimeUnit, canvasWidth, canvasHeight } = this.data as {
        chartData: ChartDataItem;
        chartType: string;
        startDate: string;
        endDate: string;
        chartTimeUnit: ChartTimeUnit;
        canvasWidth: number;
        canvasHeight: number;
      };
      if (!canvasWidth) return;

      const query = this.createSelectorQuery();
      query.select('#chartCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0]) return;

        const canvas = res[0].node;
        // @ts-ignore - Canvas 2D context type not recognized in WeChat environment
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const colors = getChartColors();

        if (!chartData || !chartData.labels || chartData.labels.length === 0) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = colors.emptyText;
          ctx.font = '14px -apple-system, sans-serif';
          ctx.fillText(chartData?.subtext || '暂无数据', canvasWidth / 2, canvasHeight / 2);
          return;
        }

        const padding = { left: 52, right: 24, top: 64, bottom: 62 };
        const useTiltLabels = chartTimeUnit === 'month' && chartData.labels.length >= 6;
        if (useTiltLabels) padding.bottom = 100;

        const plotLeft = padding.left;
        const plotTop = padding.top;
        const plotWidth = canvasWidth - padding.left - padding.right;
        const plotHeight = canvasHeight - padding.top - padding.bottom;

        const unitLabelMap: Record<string, string> = { day: '小时/天', week: '小时/周', month: '小时/月' };
        const yAxisUnit = unitLabelMap[chartTimeUnit] || '小时';

        ctx.fillStyle = colors.plotBg;
        ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

        const yRange = chartData.yAxisMax - chartData.yAxisMin;
        const yScale = plotHeight / (yRange || 1);
        const ySteps = 5;
        const yStepPx = plotHeight / ySteps;

        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = colors.gridLine;
        ctx.lineWidth = 0.8;
        for (let i = 0; i <= ySteps; i++) {
          const y = plotTop + yStepPx * i;
          ctx.beginPath();
          ctx.moveTo(plotLeft, y);
          ctx.lineTo(plotLeft + plotWidth, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        const extraPadding = 16;
        const dataPlotWidth = plotWidth - extraPadding * 2;
        const adjustedXStep = chartData.labels.length > 1
          ? dataPlotWidth / (chartData.labels.length - 1)
          : dataPlotWidth;

        if (chartTimeUnit === 'day' && chartData.labels.length <= DAY_THRESHOLD) {
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = colors.gridLineLight;
          ctx.lineWidth = 0.5;
          for (let i = 0; i < chartData.labels.length; i++) {
            const x = plotLeft + extraPadding + (chartData.labels.length > 1
              ? adjustedXStep * i : dataPlotWidth / 2);
            ctx.beginPath();
            ctx.moveTo(x, plotTop);
            ctx.lineTo(x, plotTop + plotHeight);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = colors.axisBorder;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(plotLeft, plotTop);
        ctx.lineTo(plotLeft, plotTop + plotHeight);
        ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colors.axisLabel;
        ctx.font = '11px -apple-system, sans-serif';
        for (let i = 0; i <= ySteps; i++) {
          const y = plotTop + yStepPx * i;
          const value = chartData.yAxisMax - (yRange / ySteps) * i;
          ctx.fillText(value.toFixed(1), plotLeft - 8, y);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = colors.axisUnit;
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(yAxisUnit, plotLeft + 6, plotTop - 6);

        if (chartData.data.length > 0) {
          if (chartType === 'line') {
            this.drawLineChart(ctx, chartData, plotLeft, plotTop, plotHeight, extraPadding, adjustedXStep, yScale, chartData.yAxisMin, colors);
          } else if (chartType === 'bar') {
            this.drawBarChart(ctx, chartData, plotLeft, plotTop, plotHeight, extraPadding, adjustedXStep, yScale, chartData.yAxisMin, colors);
          }
        }

        const labelY = plotTop + plotHeight + 8;
        if (useTiltLabels) {
          const tiltAngle = -Math.PI / 4;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = colors.axisLabel;
          ctx.font = '11px -apple-system, sans-serif';
          for (let i = 0; i < chartData.labels.length; i++) {
            const x = plotLeft + extraPadding + (chartData.labels.length > 1 ? adjustedXStep * i : dataPlotWidth / 2);
            ctx.save();
            ctx.translate(x, labelY);
            ctx.rotate(tiltAngle);
            ctx.fillText(chartData.labels[i], 0, 0);
            ctx.restore();
          }
        } else {
          const useLabelSkip = chartData.labels.length > 12;
          const labelFontSize = useLabelSkip ? 9 : 11;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = colors.axisLabel;
          ctx.font = `${labelFontSize}px -apple-system, sans-serif`;
          for (let i = 0; i < chartData.labels.length; i++) {
            if (useLabelSkip && i % 2 !== 0 && i !== chartData.labels.length - 1) continue;
            const x = plotLeft + extraPadding + (chartData.labels.length > 1 ? adjustedXStep * i : dataPlotWidth / 2);
            ctx.fillText(chartData.labels[i], x, labelY);
          }
        }

        const legendY = plotTop + plotHeight + 40;
        const isBar = chartType === 'bar';
        const actualLabel = '实际工时';
        const standardLabel = '标准工时';
        ctx.font = '11px -apple-system, sans-serif';
        const actualLabelW = ctx.measureText(actualLabel).width;
        const standardLabelW = ctx.measureText(standardLabel).width;
        const legendIconW = 24;
        const legendGap = 16;
        const legendTotalW = legendIconW + actualLabelW + legendGap + legendIconW + standardLabelW;
        let legendStartX = plotLeft + (plotWidth - legendTotalW) / 2;

        if (isBar) {
          const gradient = ctx.createLinearGradient(legendStartX, legendY - 6, legendStartX, legendY + 6);
          gradient.addColorStop(0, colors.chartGrad1);
          gradient.addColorStop(1, colors.chartGrad2);
          ctx.fillStyle = gradient;
          ctx.fillRect(legendStartX, legendY - 6, legendIconW - 10, 12);
          ctx.strokeStyle = colors.chartLine2;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(legendStartX, legendY - 6, legendIconW - 10, 12);
        } else {
          ctx.strokeStyle = colors.chartLine;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(legendStartX, legendY);
          ctx.lineTo(legendStartX + legendIconW, legendY);
          ctx.stroke();
          ctx.fillStyle = colors.chartLine;
          ctx.beginPath();
          ctx.arc(legendStartX + legendIconW / 2, legendY, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = colors.pointInner;
          ctx.beginPath();
          ctx.arc(legendStartX + legendIconW / 2, legendY, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colors.legendText;
        ctx.fillText(actualLabel, legendStartX + (isBar ? 20 : legendIconW + 6), legendY);
        legendStartX += (isBar ? 14 : legendIconW) + actualLabelW + 6 + legendGap;

        ctx.strokeStyle = colors.standardLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(legendStartX, legendY);
        ctx.lineTo(legendStartX + legendIconW, legendY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.standardLine;
        ctx.beginPath();
        ctx.arc(legendStartX + legendIconW / 2, legendY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors.legendText;
        ctx.fillText(standardLabel, legendStartX + legendIconW + 6, legendY);

        const titleText = `${startDate} ~ ${endDate}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = colors.titleBg;
        const titleBarW = 220;
        const titleBarH = 30;
        const titleBarX = canvasWidth / 2 - titleBarW / 2;
        const titleBarY = 4;
        ctx.beginPath();
        ctx.moveTo(titleBarX + 14, titleBarY);
        ctx.lineTo(titleBarX + titleBarW - 14, titleBarY);
        ctx.quadraticCurveTo(titleBarX + titleBarW, titleBarY, titleBarX + titleBarW, titleBarY + 14);
        ctx.lineTo(titleBarX + titleBarW, titleBarY + titleBarH);
        ctx.lineTo(titleBarX, titleBarY + titleBarH);
        ctx.lineTo(titleBarX, titleBarY + 14);
        ctx.quadraticCurveTo(titleBarX, titleBarY, titleBarX + 14, titleBarY);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillStyle = colors.titleText;
        ctx.fillText(titleText, canvasWidth / 2, 8);
      });
    },

    drawLineChart(ctx: CanvasContext, chartData: ChartDataItem, plotLeft: number, plotTop: number, plotHeight: number, extraPadding: number, adjustedXStep: number, yScale: number, yAxisMin: number, colors: Record<string, string>): void {
      const dataPlotWidth = adjustedXStep * (chartData.labels.length - 1);
      const plotBottom = plotTop + plotHeight;

      const points: Point[] = [];
      for (let i = 0; i < chartData.data.length; i++) {
        const x = plotLeft + extraPadding + (chartData.labels.length > 1 ? adjustedXStep * i : dataPlotWidth / 2);
        const y = plotBottom - (chartData.data[i] - yAxisMin) * yScale;
        points.push({ x, y });
      }

      if (points.length < 2) return;

      this.drawArea(ctx, points, plotTop, plotBottom, colors);

      ctx.save();
      ctx.shadowColor = 'rgba(52,211,153,0.15)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
      } else {
        const stepRatio = 0.35;
        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];
          const cp1x = current.x + (next.x - current.x) * stepRatio;
          const cp1y = current.y;
          const cp2x = next.x - (next.x - current.x) * stepRatio;
          const cp2y = next.y;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
        }
      }
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < points.length; i++) {
        ctx.save();
        ctx.shadowColor = 'rgba(52,211,153,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (chartData.data[i] > 0) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#374151';
          ctx.font = '10px -apple-system, sans-serif';
          ctx.fillText(chartData.data[i].toFixed(1), points[i].x, points[i].y - 10);
          ctx.restore();
        }
      }

      if (chartData.standardData && chartData.standardData.length > 0) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = colors.standardLine;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < chartData.standardData.length; i++) {
          const x = plotLeft + extraPadding + (chartData.labels.length > 1 ? adjustedXStep * i : dataPlotWidth / 2);
          const y = plotBottom - (chartData.standardData[i] - yAxisMin) * yScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    },

    drawArea(ctx: CanvasContext, points: Point[], plotTop: number, plotBottom: number, colors: Record<string, string>): void {
      if (points.length < 2) return;

      ctx.save();
      ctx.beginPath();
      const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
      gradient.addColorStop(0, colors.areaGrad1);
      gradient.addColorStop(1, colors.areaGrad2);
      ctx.fillStyle = gradient;
      ctx.moveTo(points[0].x, plotBottom);
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, plotBottom);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    drawBarChart(ctx: CanvasContext, chartData: ChartDataItem, plotLeft: number, plotTop: number, plotHeight: number, extraPadding: number, adjustedXStep: number, yScale: number, yAxisMin: number, colors: Record<string, string>): void {
      const barWidth = Math.min(36, adjustedXStep * 0.55);
      const dataPlotWidth = adjustedXStep * (chartData.labels.length - 1);
      const plotBottom = plotTop + plotHeight;

      if (chartData.standardData && chartData.standardData.length > 0) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = colors.standardLine;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < chartData.standardData.length; i++) {
          const x = plotLeft + extraPadding + (chartData.labels.length > 1 ? adjustedXStep * i : dataPlotWidth / 2);
          const y = plotBottom - (chartData.standardData[i] - yAxisMin) * yScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      for (let i = 0; i < chartData.data.length; i++) {
        const centerX = plotLeft + extraPadding + (chartData.labels.length > 1 ? adjustedXStep * i : dataPlotWidth / 2);
        const value = chartData.data[i];
        const barHeight = (value - yAxisMin) * yScale;
        const x = centerX - barWidth / 2;
        const y = plotBottom - barHeight;

        ctx.save();
        ctx.shadowColor = colors.barShadow;
        ctx.shadowBlur = 6;
        const gradient = ctx.createLinearGradient(x, y, x, plotBottom);
        gradient.addColorStop(0, colors.chartGrad1);
        gradient.addColorStop(0.7, colors.chartGrad2);
        gradient.addColorStop(1, colors.chartGrad3);
        ctx.fillStyle = gradient;

        const radius = 5;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, plotBottom);
        ctx.lineTo(x, plotBottom);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        if (value > 0) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = colors.dataLabel;
          ctx.font = '10px -apple-system, sans-serif';
          ctx.fillText(value.toFixed(1), centerX, y - 6);
          ctx.restore();
        }
      }
    }
  }
});

export {};
