// @ts-nocheck
'use strict';
const { formatDate, getWeekday, formatDayDisplay } = require('../../utils/date');
const { calculateHash } = require('../../utils/encrypt');
const { store } = require('../../utils/store');

const DAY_THRESHOLD = 7;
const WEEK_THRESHOLD = 62;
const STATISTICS_DATE_KEY = 'statisticsDateRange';

interface ChartDataSet {
  labels: string[];
  data: number[];
  standardData: number[];
  yAxisMin: number;
  yAxisMax: number;
  subtext?: string;
  longLabels?: string[];
}

interface FilteredSchedule {
  date: string;
  day: string;
  weekday: string;
  shiftType: string;
  shiftName: string;
  workHours: string;
}

interface HeatmapWeek {
  isPlaceholder?: boolean;
  color: string;
}

interface PeriodData {
  years: number[];
  months: Record<number, number[]>;
  weeks: Record<string, number[]>;
}

Page({
  formatDate,
  getWeekday,
  formatDayDisplay,

  data: {
    startDate: '',
    endDate: '',
    totalHours: 0,
    standardHours: 0,
    hourDifference: 0,
    differenceText: '',
    progressText: '进行中 0.0%',
    customHours: 35,
    dailyStandardHours: 5,
    showHoursModal: false,
    tempCustomHours: 35,
    exportFilename: '',
    lastExportedFilePath: '',
    shifts: [] as Record<string, unknown>[],
    filteredSchedules: [] as FilteredSchedule[],
    visibleSchedules: [] as FilteredSchedule[],
    listTopPadding: 0,
    listBottomPadding: 0,
    listTotalCount: 0,
    activeQuickBtn: 'thisWeek' as string,
    showFilenameModal: false,
    tempFilename: '',
    defaultFilenameHint: '',
    statistics: {
      totalDays: 0,
      workDays: 0,
      dayShifts: 0,
      nightShifts: 0,
      offDays: 0,
      totalHours: 0,
      hourDifference: 0,
      hourDifferenceWithSign: ''
    },
    chartTimeUnit: 'day' as string,
    chartType: 'line' as string,
    chartData: { labels: [], data: [], standardData: [], yAxisMin: 0, yAxisMax: 10, subtext: '' } as ChartDataSet,
    weekPickerRange: [] as string[][],
    weekPickerValue: [0, 0, 0] as number[],
    monthPickerRange: [] as string[][],
    monthPickerValue: [0, 0] as number[],
    yearOptions: [] as number[],
    yearPickerValue: 0,
    activePeriodBtn: '' as string,
    periodData: { years: [], months: {}, weeks: {} } as PeriodData,
    hasTooManyRecords: false,
    heatmapWeeks: [] as HeatmapWeek[][],
    heatmapCellSizeRpx: 60,
    heatmapGapRpx: 6,
    heatmapWeekLabels: ['一', '二', '三', '四', '五', '六', '日'] as string[],
    heatmapColumnsPerRow: 7,
    cumulativeTotalHours: 0,
    cumulativeDays: 0,
    cumulativeStartDate: '',
    cumulativeEndDate: '',
    cumulativeDailyAvg: 0
  },

  saveDateRangeState(): void {
    const { startDate, endDate, activeQuickBtn, activePeriodBtn, weekPickerValue, monthPickerValue, yearPickerValue } = this.data;
    wx.setStorageSync(STATISTICS_DATE_KEY, {
      startDate,
      endDate,
      activeQuickBtn,
      activePeriodBtn,
      weekPickerValue,
      monthPickerValue,
      yearPickerValue
    });
  },

  loadDateRangeState(): Record<string, unknown> | null {
    try {
      return wx.getStorageSync(STATISTICS_DATE_KEY) || null;
    } catch (e) {
      return null;
    }
  },

  navigateToDocs(e: WechatMiniprogram.TouchEvent): void {
    const type = (e.currentTarget.dataset as { type: string }).type || 'statistics';
    wx.navigateTo({
      url: `/subpkg-common/pages/docs/docs?type=${type}`
    });
  },

  getThisWeekRange(referenceDate: Date = new Date()): { startDate: string; endDate: string } {
    const now = new Date(referenceDate);
    const start = new Date(now);
    const end = new Date(now);

    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diff);
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  getNextWeekRange(referenceDate: Date = new Date()): { startDate: string; endDate: string } {
    const now = new Date(referenceDate);
    const start = new Date(now);
    const end = new Date(now);

    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diff + 7);
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  getThisMonthRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  getThisYearRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  selectThisWeek(): void {
    this.triggerButtonAnimation('thisWeek');
    const range = this.getThisWeekRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      activeQuickBtn: 'thisWeek',
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    this.calculateStatistics();
  },

  selectNextWeek(): void {
    this.triggerButtonAnimation('nextWeek');
    const referenceDate = this.data.endDate ? new Date(this.data.endDate) : new Date();
    const range = this.getNextWeekRange(referenceDate);
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      activeQuickBtn: 'nextWeek',
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    this.calculateStatistics();
  },

  selectThisMonth(): void {
    this.triggerButtonAnimation('thisMonth');
    const range = this.getThisMonthRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      activeQuickBtn: 'thisMonth',
      activePeriodBtn: '',
      chartTimeUnit: 'week'
    });
    this.saveDateRangeState();
    this.calculateStatistics();
  },

  selectThisYear(): void {
    this.triggerButtonAnimation('thisYear');
    const range = this.getThisYearRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      activeQuickBtn: 'thisYear',
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    this.calculateStatistics();
  },

  triggerButtonAnimation(_buttonType: string): void {},

  onStartDateChange(e: WechatMiniprogram.PickerChange): void {
    this.setData({
      startDate: e.detail.value as string,
      activeQuickBtn: '',
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    (this as unknown as Record<string, unknown>)._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
    this.calculateStatistics();
  },

  onEndDateChange(e: WechatMiniprogram.PickerChange): void {
    this.setData({
      endDate: e.detail.value as string,
      activeQuickBtn: '',
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    (this as unknown as Record<string, unknown>)._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
    this.calculateStatistics();
  },

  onExportBtnTap(): void {
    const username = wx.getStorageSync('username') || '未命名用户';
    const defaultFilenameHint = `${username}+排班统计`;

    this.setData({
      tempFilename: '',
      defaultFilenameHint: defaultFilenameHint,
      showFilenameModal: true
    });
  },

  hideFilenameModal(): void {
    this.setData({
      showFilenameModal: false
    });
  },

  onFilenameInput(e: WechatMiniprogram.Input): void {
    this.setData({
      tempFilename: e.detail.value
    });
  },

  confirmExport(): void {
    const customFilename = this.data.tempFilename;
    this.hideFilenameModal();
    this.exportToCSV(customFilename);
  },

  showCustomHoursModal(): void {
    this.setData({
      tempCustomHours: this.data.customHours,
      showHoursModal: true
    });
  },

  hideCustomHoursModal(): void {
    this.setData({
      showHoursModal: false
    });
  },

  onCustomHoursInput(e: WechatMiniprogram.Input): void {
    this.setData({
      tempCustomHours: e.detail.value
    });
  },

  saveCustomHours(): void {
    const customHours = parseFloat(this.data.tempCustomHours) || 35;
    const dailyStandardHours = customHours / 7;

    this.setData({
      customHours: customHours,
      dailyStandardHours: dailyStandardHours,
      showHoursModal: false
    });

    store.setState({ customHours }, ['customHours']);
    this.calculateStatistics();

    wx.showToast({
      title: '设置已保存',
      icon: 'success'
    });
  },

  preventBubble(): void {},

  calculateStatistics(): void {
    const { startDate, endDate, customHours, dailyStandardHours } = this.data;

    if (!startDate || !endDate) return;

    if (new Date(startDate) > new Date(endDate)) {
      wx.showToast({
        title: '开始日期不能晚于结束日期',
        icon: 'none'
      });
      return;
    }

    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);

    try {
      const allShifts = wx.getStorageSync('shifts') || {};
      const currentShiftsHash = calculateHash(JSON.stringify(allShifts));
      const currentDateRange = `${startDate}_${endDate}_${chartTimeUnit}_${customHours}`;

      const cache = (this as unknown as Record<string, unknown>)._cache as Record<string, unknown>;
      if (!cache) {
        (this as unknown as Record<string, unknown>)._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      }

      if ((cache?.lastShiftsHash as string) === currentShiftsHash &&
          (cache?.lastDateRange as string) === currentDateRange &&
          cache?.lastStatistics) {
        (this as unknown as Record<string, unknown>)._allSchedules = (cache as unknown as Record<string, unknown>)._allSchedules || [];
        this._initVirtualScrollParams();
        const initialSlice = this._computeVisibleSlice(0);
        const cachedData = Object.assign({}, cache.lastStatistics, {
          filteredSchedules: initialSlice.items,
          visibleSchedules: initialSlice.items,
          listTopPadding: initialSlice.topPadding,
          listBottomPadding: initialSlice.bottomPadding,
          listTotalCount: (this as unknown as Record<string, unknown>)._allSchedules.length
        });
        this.setData(cachedData);
        this.updateChartData();
        this.drawPieChart();
        this.calculateCumulativeStats();
        return;
      }

      const shiftsInRange: Record<string, unknown>[] = [];
      let totalHours = 0;
      let workDays = 0;
      let dayShifts = 0;
      let nightShifts = 0;
      let offDays = 0;

      const start = new Date(startDate);
      const end = new Date(endDate);

      const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const filteredSchedules: FilteredSchedule[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        const shiftData = allShifts[dateStr] as Record<string, unknown> | undefined;

        if (shiftData) {
          const shift = {
            date: dateStr,
            ...shiftData
          };
          shiftsInRange.push(shift);
          totalHours += parseFloat(shiftData.workHours as string) || 0;

          const shiftType = shiftData.type as string;
          if (shiftType === '白天班') {
            workDays++;
            dayShifts++;
          } else if (shiftType === '跨夜班') {
            workDays++;
            nightShifts++;
          } else if (shiftType === '休息日') {
            offDays++;
          }

          filteredSchedules.push({
            date: dateStr,
            day: this.formatDayDisplay(dateStr),
            weekday: this.getWeekday(dateStr),
            shiftType: shiftType,
            shiftName: (shiftData.name as string) || '',
            workHours: (shiftData.workHours as string) || '--:--'
          });
        } else {
          filteredSchedules.push({
            date: dateStr,
            day: this.formatDayDisplay(dateStr),
            weekday: this.getWeekday(dateStr),
            shiftType: '休息日',
            shiftName: '',
            workHours: '--:--'
          });
          offDays++;
        }
      }

      let standardHours = 0;

      if (dayCount === 7) {
        standardHours = customHours;
      } else {
        standardHours = dayCount * dailyStandardHours;
      }

      const hourDifference = totalHours - standardHours;
      let differenceText = '';
      if (hourDifference > 0) {
        differenceText = `超额 +${hourDifference.toFixed(1)} 小时`;
      } else if (hourDifference < 0) {
        differenceText = `差额 ${hourDifference.toFixed(1)} 小时`;
      } else {
        differenceText = '工时正好';
      }

      const progressPercent = standardHours > 0 ? (totalHours / standardHours * 100).toFixed(1) : '0.0';
      const progressStatus = totalHours >= standardHours ? '已完成' : '进行中';
      const progressText = `${progressStatus} ${progressPercent}%`;

      const hourDifferenceWithSign = hourDifference > 0 ? `+${hourDifference.toFixed(1)}` : hourDifference.toFixed(1);

      (this as unknown as Record<string, unknown>)._allSchedules = filteredSchedules;
      this._initVirtualScrollParams();
      const initialSlice = this._computeVisibleSlice(0);

      const newData: Record<string, unknown> = {
        shifts: shiftsInRange,
        filteredSchedules: initialSlice.items,
        visibleSchedules: initialSlice.items,
        listTopPadding: initialSlice.topPadding,
        listBottomPadding: initialSlice.bottomPadding,
        listTotalCount: filteredSchedules.length,
        totalHours: totalHours.toFixed(1),
        standardHours: standardHours.toFixed(1),
        hourDifference: hourDifference.toFixed(1),
        hourDifferenceWithSign: hourDifferenceWithSign,
        differenceText: differenceText,
        progressText: progressText,
        statistics: {
          totalDays: dayCount,
          workDays: workDays,
          dayShifts: dayShifts,
          nightShifts: nightShifts,
          offDays: offDays,
          totalHours: totalHours.toFixed(1),
          hourDifference: hourDifference.toFixed(1),
          hourDifferenceWithSign: hourDifferenceWithSign
        }
      };

      const heatmapResult = this.generateHeatmapData(filteredSchedules);
      newData.heatmapWeeks = heatmapResult.weeks;
      newData.heatmapCellSizeRpx = heatmapResult.cellSizeRpx;
      newData.heatmapGapRpx = heatmapResult.gapRpx;
      newData.heatmapColumnsPerRow = heatmapResult.columnsPerRow;

      const cacheStore = (this as unknown as Record<string, unknown>)._cache as Record<string, unknown>;
      cacheStore.lastShiftsHash = currentShiftsHash;
      cacheStore.lastDateRange = currentDateRange;
      cacheStore.lastStatistics = newData;
      cacheStore._allSchedules = filteredSchedules;

      this.setData(newData);
      this.updateChartData();
      this.calculateCumulativeStats();
      wx.nextTick(() => {
        this.drawPieChart();
      });
    } catch (e) {
      console.error('计算统计数据失败', e);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    }
  },

  _initVirtualScrollParams(): void {
    if ((this as unknown as Record<string, unknown>)._itemHeightPx) return;
    const windowInfo = wx.getWindowInfo();
    (this as unknown as Record<string, unknown>)._rpxRatio = windowInfo.windowWidth / 750;
    (this as unknown as Record<string, unknown>)._itemHeightRpx = 110;
    (this as unknown as Record<string, unknown>)._itemHeightPx = Math.ceil(110 * ((this as unknown as Record<string, unknown>)._rpxRatio as number));
    (this as unknown as Record<string, unknown>)._visibleBuffer = 7;
    (this as unknown as Record<string, unknown>)._visibleCount = Math.ceil(600 / 110) + 7 * 2;
    (this as unknown as Record<string, unknown>)._lastRenderStart = -1;
  },

  _computeVisibleSlice(scrollTop: number): { items: FilteredSchedule[]; topPadding: number; bottomPadding: number } {
    const allSchedules = (this as unknown as Record<string, unknown>)._allSchedules as FilteredSchedule[] | undefined;
    if (!allSchedules || !allSchedules.length) {
      return { items: [], topPadding: 0, bottomPadding: 0 };
    }
    const totalCount = allSchedules.length;
    const itemH = ((this as unknown as Record<string, unknown>)._itemHeightPx as number) || 55;
    const visibleCount = ((this as unknown as Record<string, unknown>)._visibleCount as number) || 20;

    let startIndex = Math.max(0, Math.floor(scrollTop / itemH) - ((this as unknown as Record<string, unknown>)._visibleBuffer as number));
    startIndex = Math.min(startIndex, Math.max(0, totalCount - visibleCount));
    const endIndex = Math.min(startIndex + visibleCount, totalCount);

    return {
      items: allSchedules.slice(startIndex, endIndex),
      topPadding: startIndex * itemH,
      bottomPadding: Math.max(0, (totalCount - endIndex) * itemH)
    };
  },

  onScheduleScroll(e: WechatMiniprogram.ScrollViewScroll): void {
    (this as unknown as Record<string, unknown>)._pendingScrollTop = e.detail.scrollTop;
    if ((this as unknown as Record<string, unknown>)._scrollScheduled) return;
    (this as unknown as Record<string, unknown>)._scrollScheduled = true;
    setTimeout(() => {
      (this as unknown as Record<string, unknown>)._scrollScheduled = false;
      const scrollTop = (this as unknown as Record<string, unknown>)._pendingScrollTop as number;
      const itemH = ((this as unknown as Record<string, unknown>)._itemHeightPx as number) || 55;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemH) - ((this as unknown as Record<string, unknown>)._visibleBuffer as number));
      if (Math.abs(startIndex - ((this as unknown as Record<string, unknown>)._lastRenderStart as number)) < 1) return;
      (this as unknown as Record<string, unknown>)._lastRenderStart = startIndex;
      const slice = this._computeVisibleSlice(scrollTop);
      this.setData({
        visibleSchedules: slice.items,
        filteredSchedules: slice.items,
        listTopPadding: slice.topPadding,
        listBottomPadding: slice.bottomPadding
      });
    }, 50);
  },

  exportToCSV(customFilename: string): void {
    const { startDate, endDate, shifts, totalHours, standardHours, hourDifferenceWithSign, statistics } = this.data;

    wx.showLoading({
      title: '正在导出...'
    });

    try {
      const username = wx.getStorageSync('username') || '未命名用户';

      const escapeField = (field: unknown): string => {
        const strField = String(field);
        if (strField.includes(',') || strField.includes('"')) {
          return `"${strField.replace(/"/g, '""')}"`;
        }
        return `"${strField}"`;
      };

      const generateEquals = (length: number): string => {
        return '='.repeat(Math.max(4, length));
      };

      const section1Widths = [
        Math.max('统计范围'.length, `${startDate}至${endDate}`.length),
        Math.max('标准工时'.length, String(standardHours).length),
        Math.max('实际工时'.length, String(totalHours).length),
        Math.max('工时差/超额'.length, String(hourDifferenceWithSign).length),
        Math.max('白天班'.length, String(statistics.dayShifts).length),
        Math.max('跨夜班'.length, String(statistics.nightShifts).length),
        Math.max('休息日'.length, String(statistics.offDays).length)
      ];

      const generateSeparator = (widths: number[]): string => {
        return widths.map(w => escapeField(generateEquals(w))).join(',');
      };

      let csvContent = '';

      const titleText = username + '排班统计报表';
      csvContent += escapeField(titleText) + '\n';
      csvContent += escapeField(generateEquals(titleText.length)) + '\n';
      csvContent += section1Widths.map((_, i) => escapeField(['统计范围', '标准工时', '实际工时', '工时差/超额', '白天班', '跨夜班', '休息日'][i])).join(',') + '\n';
      csvContent += [
        escapeField(startDate + '至' + endDate),
        escapeField(standardHours),
        escapeField(totalHours),
        escapeField(hourDifferenceWithSign),
        escapeField(statistics.dayShifts),
        escapeField(statistics.nightShifts),
        escapeField(statistics.offDays)
      ].join(',') + '\n';

      csvContent += generateSeparator(section1Widths) + '\n';

      csvContent += ['日期', '班次名称', '工时', '班次类型', '开始时间', '结束时间'].map(escapeField).join(',') + '\n';

      (shifts as Array<Record<string, unknown>>).forEach(shift => {
        csvContent += [
          escapeField(shift.date as string),
          escapeField(`'${shift.name}`),
          escapeField(shift.workHours),
          escapeField(shift.type),
          escapeField(shift.startTime),
          escapeField(shift.endTime)
        ].join(',') + '\n';
      });

      const fileName = customFilename || `${username}_排班统计_${startDate}_至_${endDate}`;

      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.csv`;

      fs.writeFile({
        filePath: filePath,
        data: csvContent,
        encoding: 'utf8',
        success: () => {
          this.setData({
            lastExportedFilePath: filePath
          });

          wx.hideLoading();
          wx.showToast({
            title: '导出成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('写入文件失败', err);
          wx.showToast({
            title: '导出失败',
            icon: 'none'
          });
        }
      });
    } catch (e) {
      wx.hideLoading();
      console.error('导出失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  shareCSV(): void {
    const { lastExportedFilePath } = this.data as { lastExportedFilePath: string };

    if (!lastExportedFilePath) {
      wx.showToast({
        title: '请先导出文件',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '正在分享...'
    });

    const fileName = lastExportedFilePath.substring(lastExportedFilePath.lastIndexOf('/') + 1, lastExportedFilePath.lastIndexOf('.'));

    wx.shareFileMessage({
      filePath: lastExportedFilePath,
      fileName: `${fileName}.csv`,
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('分享文件失败', err);
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    });
  },

  onLoad(): void {
    (this as unknown as Record<string, unknown>)._cache = {
      lastShiftsHash: '',
      lastStatistics: null,
      lastDateRange: null
    };
    (this as unknown as Record<string, unknown>)._periodDataCache = null;

    const savedCustomHours = wx.getStorageSync('customHours') || 35;
    const dailyStandardHours = savedCustomHours / 7;
    const savedChartType = wx.getStorageSync('statisticsChartType') || 'line';

    this.setData({
      customHours: savedCustomHours,
      dailyStandardHours: dailyStandardHours,
      chartType: savedChartType
    });

    this.parsePeriodData();

    const savedState = this.loadDateRangeState();
    if (savedState && (savedState.startDate as string) && (savedState.endDate as string)) {
      this.setData({
        startDate: savedState.startDate as string,
        endDate: savedState.endDate as string,
        activeQuickBtn: (savedState.activeQuickBtn as string) || '',
        activePeriodBtn: (savedState.activePeriodBtn as string) || '',
        weekPickerValue: (savedState.weekPickerValue as number[]) || [0, 0, 0],
        monthPickerValue: (savedState.monthPickerValue as number[]) || [0, 0],
        yearPickerValue: (savedState.yearPickerValue as number) || 0
      });
      this.calculateStatistics();
    } else {
      this.selectThisWeek();
    }

    const statsPage = this;
    this._storeUnsub = store.subscribe('_lastDataRestore', function () {
      statsPage.parsePeriodData();
      statsPage.calculateStatistics();
    });
  },

  onChartInit(e: WechatMiniprogram.TouchEvent): void {
    (this as unknown as Record<string, unknown>)._chartComponent = (e.detail as { component: unknown }).component;
    this.updateChartData();
  },

  changeChartType(e: WechatMiniprogram.TouchEvent): void {
    const type = (e.currentTarget.dataset as { type: string }).type;
    this.setData({
      chartType: type
    });
    store.setState({ chartType: type }, ['chartType']);
    this.updateChartData();
  },

  onShareAppMessage(): WechatMiniprogram.Page.IShareAppMessageOption {
    return {
      title: 'SYwork排班管理系统 - 统计页面',
      path: '/pages/statistics/statistics'
    };
  },

  onShareTimeline(): WechatMiniprogram.Page.IShareTimelineOption {
    return {
      title: 'SYwork排班管理系统 - 统计页面',
      query: 'page=statistics'
    };
  },

  changeChartTimeUnit(e: WechatMiniprogram.TouchEvent): void {
    const unit = (e.currentTarget.dataset as { unit: string }).unit;
    let startDate: string, endDate: string;
    const now = new Date();

    if (unit === 'day') {
      const range = this.getThisWeekRange();
      startDate = range.startDate;
      endDate = range.endDate;
    } else if (unit === 'week') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = this.formatDate(monthStart);
      endDate = this.formatDate(monthEnd);
    } else {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      startDate = this.formatDate(yearStart);
      endDate = this.formatDate(yearEnd);
    }

    this.setData({
      chartTimeUnit: unit,
      startDate: startDate,
      endDate: endDate,
      activeQuickBtn: unit === 'day' ? 'thisWeek' : '',
      activePeriodBtn: ''
    });

    this.calculateStatistics();
  },

  generateChartData(): ChartDataSet {
    const { startDate, endDate, shifts, customHours, dailyStandardHours } = this.data;
    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const labels: string[] = [];
    const data: number[] = [];
    const standardData: number[] = [];
    const longLabels: string[] = [];
    const unitLabelMap: Record<string, string> = { day: '按天汇总', week: '按周汇总', month: '按月汇总' };
    const subtext = unitLabelMap[chartTimeUnit] || '';

    if ((shifts as Record<string, unknown>[]).length === 0) {
      return { labels: [], data: [], standardData: [], yAxisMax: 10, yAxisMin: 0, longLabels: [], subtext: '暂无数据' };
    }

    const useCache = (shifts as Record<string, unknown>[]).length > 2000;
    let hoursByDate: Map<string, number> | null = null;
    if (useCache) {
      hoursByDate = new Map();
      (shifts as Array<Record<string, unknown>>).forEach(shift => {
        hoursByDate!.set(shift.date as string, parseFloat(shift.workHours as string) || 0);
      });
    }

    if (chartTimeUnit === 'day') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        let hours = 0;
        if (useCache && hoursByDate) {
          hours = hoursByDate.get(dateStr) || 0;
        } else {
          const dayData = (shifts as Array<Record<string, unknown>>).find(shift => shift.date === dateStr);
          hours = parseFloat(dayData?.workHours as string) || 0;
        }
        const dayNum = d.getDate();
        labels.push(`${dayNum}号`);
        data.push(hours);
        standardData.push(dailyStandardHours);
        longLabels.push(dateStr);
      }
    } else if (chartTimeUnit === 'week') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const firstMonday = new Date(start);
      const dayOfWeek = firstMonday.getDay();
      firstMonday.setDate(firstMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      let weekIndex = 0;
      for (let d = new Date(firstMonday); d <= end; d.setDate(d.getDate() + 7)) {
        weekIndex++;
        const weekStart = new Date(d);
        const weekEnd = new Date(d);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const actualStart = new Date(Math.max(weekStart.getTime(), start.getTime()));
        const actualEnd = new Date(Math.min(weekEnd.getTime(), end.getTime()));

        let weekTotal = 0;
        for (let day = new Date(actualStart); day <= actualEnd; day.setDate(day.getDate() + 1)) {
          const dateStr = this.formatDate(day);
          if (useCache && hoursByDate) {
            weekTotal += hoursByDate.get(dateStr) || 0;
          } else {
            const dayData = (shifts as Array<Record<string, unknown>>).find(shift => shift.date === dateStr);
            weekTotal += parseFloat(dayData?.workHours as string) || 0;
          }
        }

        labels.push(`${weekIndex}周`);
        data.push(weekTotal);
        standardData.push(customHours);
        longLabels.push(`${this.formatDate(actualStart)}~${this.formatDate(actualEnd)}`);
      }
    } else if (chartTimeUnit === 'month') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const yearStart = start.getFullYear();
      const monthStart = start.getMonth();
      const yearEnd = end.getFullYear();
      const monthEnd = end.getMonth();

      const monthHoursMap: Record<string, number> = {};

      if (useCache && hoursByDate) {
        hoursByDate.forEach((hours, dateStr) => {
          if (dateStr >= startDate && dateStr <= endDate) {
            const monthKey = dateStr.substring(0, 7);
            monthHoursMap[monthKey] = (monthHoursMap[monthKey] || 0) + hours;
          }
        });
      } else {
        (shifts as Array<Record<string, unknown>>).forEach(shift => {
          const monthKey = (shift.date as string).substring(0, 7);
          monthHoursMap[monthKey] = (monthHoursMap[monthKey] || 0) + parseFloat(shift.workHours as string) || 0;
        });
      }

      let currentYear = yearStart;
      let currentMonth = monthStart;
      while (currentYear < yearEnd || (currentYear === yearEnd && currentMonth <= monthEnd)) {
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        if (Object.prototype.hasOwnProperty.call(monthHoursMap, monthKey)) {
          labels.push(`${currentMonth + 1}月`);
          data.push(monthHoursMap[monthKey]);
          standardData.push(customHours * 4.35);
          longLabels.push(`${currentYear}年${currentMonth + 1}月`);
        }
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
    }

    const allValues = data.length > 0 ? [...data, ...standardData] : [0];
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 10;
    const yAxisMin = minValue < 0 ? Math.floor(minValue * 1.1) : 0;

    return { labels, data, standardData, yAxisMax, yAxisMin, longLabels, subtext };
  },

  generateHeatmapData(filteredSchedules: FilteredSchedule[]): { weeks: HeatmapWeek[][]; cellSizeRpx: number; gapRpx: number; columnsPerRow: number } {
    const days = filteredSchedules || [];
    const totalDays = days.length;

    if (totalDays === 0) {
      return { weeks: [], cellSizeRpx: 60, gapRpx: 6, columnsPerRow: 7 };
    }

    let cellSizeRpx: number, gapRpx: number;
    if (totalDays <= 14) {
      cellSizeRpx = 74;
      gapRpx = 8;
    } else if (totalDays <= 35) {
      cellSizeRpx = 58;
      gapRpx = 6;
    } else if (totalDays <= 90) {
      cellSizeRpx = 40;
      gapRpx = 5;
    } else if (totalDays <= 180) {
      cellSizeRpx = 28;
      gapRpx = 4;
    } else {
      cellSizeRpx = 20;
      gapRpx = 3;
    }

    const cardContentWidth = 630;
    let columnsPerRow = Math.floor(cardContentWidth / (cellSizeRpx + gapRpx));
    columnsPerRow = Math.max(7, Math.min(columnsPerRow, 31));

    if (totalDays <= 35) {
      columnsPerRow = 7;
    }

    const cellItems = days.map(d => {
      const hours = parseFloat(d.workHours as string);
      const validHours = !isNaN(hours) ? hours : 0;
      const color = this.getHeatmapColor(validHours);
      return {
        date: d.date,
        day: d.day,
        weekday: d.weekday,
        shiftType: d.shiftType,
        workHours: d.workHours,
        color: color
      };
    });

    const rows: HeatmapWeek[][] = [];
    let currentRow: HeatmapWeek[] = [];

    if (totalDays <= 35) {
      const firstDate = new Date(days[0].date);
      let firstDayOfWeek = firstDate.getDay();
      firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

      for (let i = 0; i < firstDayOfWeek; i++) {
        currentRow.push({ isPlaceholder: true, color: '#f0f0f0' });
      }

      cellItems.forEach(cell => {
        currentRow.push(cell);
        if (currentRow.length === columnsPerRow) {
          rows.push(currentRow);
          currentRow = [];
        }
      });

      if (currentRow.length > 0) {
        while (currentRow.length < columnsPerRow) {
          currentRow.push({ isPlaceholder: true, color: '#f0f0f0' });
        }
        rows.push(currentRow);
      }
    } else {
      cellItems.forEach(cell => {
        currentRow.push(cell);
        if (currentRow.length === columnsPerRow) {
          rows.push(currentRow);
          currentRow = [];
        }
      });

      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
    }

    return { weeks: rows, cellSizeRpx, gapRpx, columnsPerRow };
  },

  getHeatmapColor(hours: number): string {
    if (hours <= 0) return '#e3e3e3';
    if (hours <= 6) return '#c6e48b';
    if (hours <= 7) return '#7bc96f';
    if (hours <= 8) return '#5aad4a';
    if (hours < 9) return '#3d8b37';
    return '#2d6a2b';
  },

  onHeatmapCellTap(e: WechatMiniprogram.TouchEvent): void {
    const { date, hours } = (e.currentTarget.dataset as { date: string; hours: string });
    wx.showToast({
      title: `${date} ${hours}小时`,
      icon: 'none',
      duration: 1500
    });
  },

  updateChartData(): void {
    const { startDate, endDate } = this.data;
    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const chartData = this.generateChartData();
    this.setData({
      chartData: chartData,
      chartTimeUnit: chartTimeUnit
    });
  },

  drawPieChart(): void {
    const { statistics } = this.data as { statistics: { dayShifts: number; nightShifts: number; offDays: number } };
    const total = statistics.dayShifts + statistics.nightShifts + statistics.offDays;
    if (total === 0) return;

    const query = this.createSelectorQuery();
    query.select('#pieCanvas').fields({ node: true, size: true }).exec(res => {
      const canvas = (res?.[0] as unknown as { node: WechatMiniprogram.Canvas; width: number; height: number })?.node;
      if (!canvas) return;
      const ctx = canvas.getContext('2d') as WechatMiniprogram.CanvasRenderingContext2D;
      const dpr = wx.getWindowInfo().pixelRatio;
      const width = (res?.[0] as unknown as { width: number }).width;
      const height = (res?.[0] as unknown as { height: number }).height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 10;

      const pieData = [
        { label: '白天班', value: statistics.dayShifts, color: '#FCD34D' },
        { label: '跨夜班', value: statistics.nightShifts, color: '#93C5FD' },
        { label: '休息日', value: statistics.offDays, color: '#D8B4FE' }
      ];

      const validData = pieData.filter(d => d.value > 0);
      if (validData.length === 0) return;

      const totalValue = validData.reduce((sum, d) => sum + d.value, 0);
      const daySliceAngle = (statistics.dayShifts / total) * 2 * Math.PI;
      let startAngle = -Math.PI / 2 - daySliceAngle;

      validData.forEach(d => {
        const sliceAngle = (d.value / totalValue) * 2 * Math.PI;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();

        ctx.fillStyle = d.color;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        startAngle += sliceAngle;
      });
    });
  },

  calculateCumulativeStats(): void {
    const allShifts = wx.getStorageSync('shifts') || {};
    const dates = Object.keys(allShifts).sort();
    if (dates.length === 0) return;

    let totalHours = 0;
    let daysWithData = 0;
    let firstDate = '';
    let lastDate = '';

    dates.forEach(dateStr => {
      const shiftData = allShifts[dateStr] as Record<string, unknown>;
      const hours = parseFloat(shiftData.workHours as string) || 0;
      if (hours > 0) {
        totalHours += hours;
        daysWithData++;
        if (!firstDate) firstDate = dateStr;
        lastDate = dateStr;
      }
    });

    if (totalHours === 0) return;

    const dailyAvg = totalHours / daysWithData;

    this.setData({
      cumulativeTotalHours: totalHours.toFixed(1),
      cumulativeDays: daysWithData,
      cumulativeStartDate: firstDate,
      cumulativeEndDate: lastDate,
      cumulativeDailyAvg: dailyAvg.toFixed(1)
    });
  },

  onShow(): void {
    const allShifts = wx.getStorageSync('shifts') || {};
    const currentShifts = this.data.shifts;

    const shiftsChanged = calculateHash(JSON.stringify(allShifts)) !== calculateHash(JSON.stringify(currentShifts));

    if (shiftsChanged) {
      this.parsePeriodData();
      this.calculateStatistics();
    }
  },

  parsePeriodData(): void {
    const allShifts = wx.getStorageSync('shifts') || {};
    const currentHash = calculateHash(JSON.stringify(allShifts));

    const periodDataCache = (this as unknown as Record<string, unknown>)._periodDataCache as { hash: string; data: PeriodData } | null;
    if (periodDataCache && periodDataCache.hash === currentHash) {
      return;
    }

    const dateKeys = Object.keys(allShifts);

    if (dateKeys.length === 0) {
      const now = new Date();
      const defaultYear = now.getFullYear();
      const periodData = {
        years: [defaultYear],
        months: { [defaultYear]: [now.getMonth() + 1] },
        weeks: { [`${defaultYear}-${String(now.getMonth() + 1).padStart(2, '0')}`]: [1] }
      };

      this.setData({
        periodData: periodData,
        yearOptions: [defaultYear]
      });

      (this as unknown as Record<string, unknown>)._periodDataCache = { hash: currentHash, data: periodData };
      return;
    }

    const years = new Set<number>();
    const months: Record<number, Set<number>> = {};
    const weeks: Record<string, Set<number>> = {};

    dateKeys.forEach(dateStr => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const weekNum = this.getWeekOfMonth(date);
      const yearMonthKey = `${year}-${String(month).padStart(2, '0')}`;

      years.add(year);

      if (!months[year]) {
        months[year] = new Set();
      }
      months[year].add(month);

      if (!weeks[yearMonthKey]) {
        weeks[yearMonthKey] = new Set();
      }
      weeks[yearMonthKey].add(weekNum);
    });

    const sortedYears = Array.from(years).sort((a, b) => a - b);
    const sortedMonths: Record<number, number[]> = {};
    const sortedWeeks: Record<string, number[]> = {};

    Object.keys(months).forEach(year => {
      sortedMonths[parseInt(year, 10)] = Array.from(months[parseInt(year, 10)]).sort((a, b) => a - b);
    });

    Object.keys(weeks).forEach(key => {
      sortedWeeks[key] = Array.from(weeks[key]).sort((a, b) => a - b);
    });

    const periodData = { years: sortedYears, months: sortedMonths, weeks: sortedWeeks };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentWeek = this.getWeekOfMonth(now);

    let weekRange: string[][] = [];
    let weekValue = [0, 0, 0];
    if (sortedYears.length > 0) {
      const yearIndex = sortedYears.indexOf(currentYear);
      const targetYear = yearIndex >= 0 ? currentYear : sortedYears[0];
      const monthsForYear = sortedMonths[targetYear] || [];

      let targetMonth = currentMonth;
      let monthIndex = monthsForYear.indexOf(targetMonth);
      if (monthIndex < 0) {
        targetMonth = monthsForYear[0] || 1;
        monthIndex = 0;
      }

      const yearMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const weeksForMonth = sortedWeeks[yearMonthKey] || [1];

      let targetWeek = currentWeek;
      let weekIndex = weeksForMonth.indexOf(targetWeek);
      if (weekIndex < 0) {
        targetWeek = weeksForMonth[0] || 1;
        weekIndex = 0;
      }

      weekRange = [
        sortedYears.map(y => `${y}年`),
        monthsForYear.map(m => `${m}月`),
        weeksForMonth.map(w => `第${w}周`)
      ];

      weekValue = [yearIndex >= 0 ? yearIndex : 0, monthIndex, weekIndex];
    }

    let monthRange: string[][] = [];
    let monthValue = [0, 0];
    if (sortedYears.length > 0) {
      const yearIndex = sortedYears.indexOf(currentYear);
      const targetYear = yearIndex >= 0 ? currentYear : sortedYears[0];
      const monthsForYear = sortedMonths[targetYear] || [];

      let targetMonth = currentMonth;
      let monthIndex = monthsForYear.indexOf(targetMonth);
      if (monthIndex < 0) {
        targetMonth = monthsForYear[0] || 1;
        monthIndex = 0;
      }

      monthRange = [
        sortedYears.map(y => `${y}年`),
        monthsForYear.map(m => `${m}月`)
      ];

      monthValue = [yearIndex >= 0 ? yearIndex : 0, monthIndex];
    }

    let yearValue = 0;
    if (sortedYears.length > 0) {
      const yearIndex = sortedYears.indexOf(currentYear);
      yearValue = yearIndex >= 0 ? yearIndex : 0;
    }

    this.setData({
      periodData: periodData,
      yearOptions: sortedYears,
      yearPickerValue: yearValue,
      weekPickerRange: weekRange,
      weekPickerValue: weekValue,
      monthPickerRange: monthRange,
      monthPickerValue: monthValue
    });

    (this as unknown as Record<string, unknown>)._periodDataCache = { hash: currentHash, data: periodData };
  },

  getWeekOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    let firstDayWeekday = firstDay.getDay();
    firstDayWeekday = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

    const dayOfMonth = date.getDate();
    const weekNum = Math.ceil((dayOfMonth + firstDayWeekday) / 7);
    return weekNum;
  },

  onWeekPickerColumnChange(e: WechatMiniprogram.PickerChange): void {
    const column = (e.detail as { column: number; value: number }).column;
    const value = (e.detail as { column: number; value: number }).value;
    const { periodData, weekPickerRange, weekPickerValue } = this.data as { periodData: PeriodData; weekPickerRange: string[][]; weekPickerValue: number[] };

    const newRange = [...weekPickerRange];
    let newValue = [...weekPickerValue];

    if (column === 0) {
      const selectedYear = periodData.years[value];
      const monthsForYear = periodData.months[selectedYear] || [];
      const firstMonth = monthsForYear[0] || 1;
      const yearMonthKey = `${selectedYear}-${String(firstMonth).padStart(2, '0')}`;
      const weeksForMonth = periodData.weeks[yearMonthKey] || [1];

      newRange[1] = monthsForYear.map(m => `${m}月`);
      newRange[2] = weeksForMonth.map(w => `第${w}周`);
      newValue = [value, 0, 0];

      this.setData({ weekPickerRange: newRange, weekPickerValue: newValue });
    } else if (column === 1) {
      const yearIndex = newValue[0];
      const selectedYear = periodData.years[yearIndex];
      const monthsForYear = periodData.months[selectedYear] || [];
      const selectedMonth = monthsForYear[value];
      const yearMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const weeksForMonth = periodData.weeks[yearMonthKey] || [1];

      newRange[2] = weeksForMonth.map(w => `第${w}周`);
      newValue = [yearIndex, value, 0];

      this.setData({ weekPickerRange: newRange, weekPickerValue: newValue });
    }
  },

  onWeekPickerChange(e: WechatMiniprogram.PickerChange): void {
    const value = e.detail.value as number[];
    const { periodData } = this.data as { periodData: PeriodData };

    const yearIndex = value[0];
    const monthIndex = value[1];
    const weekIndex = value[2];

    const selectedYear = periodData.years[yearIndex];
    const monthsForYear = periodData.months[selectedYear] || [];
    const selectedMonth = monthsForYear[monthIndex];
    const yearMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const weeksForMonth = periodData.weeks[yearMonthKey] || [1];

    const dateRange = this.getWeekDateRange(selectedYear, selectedMonth, weeksForMonth[weekIndex]);

    if (dateRange) {
      this.setData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        activeQuickBtn: '',
        activePeriodBtn: 'week',
        weekPickerValue: value
      });
      this.saveDateRangeState();
      (this as unknown as Record<string, unknown>)._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  onMonthPickerColumnChange(e: WechatMiniprogram.PickerChange): void {
    const column = (e.detail as { column: number; value: number }).column;
    const value = (e.detail as { column: number; value: number }).value;
    const { periodData, monthPickerRange, monthPickerValue } = this.data as { periodData: PeriodData; monthPickerRange: string[][]; monthPickerValue: number[] };

    const newRange = [...monthPickerRange];
    let newValue = [...monthPickerValue];

    if (column === 0) {
      const selectedYear = periodData.years[value];
      const monthsForYear = periodData.months[selectedYear] || [];

      newRange[1] = monthsForYear.map(m => `${m}月`);
      newValue = [value, 0];

      this.setData({ monthPickerRange: newRange, monthPickerValue: newValue });
    }
  },

  onMonthPickerChange(e: WechatMiniprogram.PickerChange): void {
    const value = e.detail.value as number[];
    const { periodData } = this.data as { periodData: PeriodData };

    const yearIndex = value[0];
    const monthIndex = value[1];

    const selectedYear = periodData.years[yearIndex];
    const monthsForYear = periodData.months[selectedYear] || [];

    const dateRange = this.getMonthDateRange(selectedYear, monthsForYear[monthIndex]);

    if (dateRange) {
      this.setData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        activeQuickBtn: '',
        activePeriodBtn: 'month',
        monthPickerValue: value
      });
      this.saveDateRangeState();
      (this as unknown as Record<string, unknown>)._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  onYearPickerChange(e: WechatMiniprogram.PickerChange): void {
    const value = (e.detail.value as number[])[0];
    const { periodData } = this.data as { periodData: PeriodData };

    const selectedYear = periodData.years[value];
    const dateRange = this.getYearDateRange(selectedYear);

    if (dateRange) {
      this.setData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        activeQuickBtn: '',
        activePeriodBtn: 'year',
        yearPickerValue: value
      });
      this.saveDateRangeState();
      (this as unknown as Record<string, unknown>)._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  getWeekDateRange(year: number, month: number, weekNum: number): { startDate: string; endDate: string } {
    const firstDay = new Date(year, month - 1, 1);
    let firstDayWeekday = firstDay.getDay();
    firstDayWeekday = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

    const startOffset = (weekNum - 1) * 7 - firstDayWeekday;
    const startDate = new Date(year, month - 1, 1 + startOffset);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  },

  calculateOptimalChartUnit(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (dayCount <= DAY_THRESHOLD) {
      return 'day';
    }
    if (dayCount <= WEEK_THRESHOLD) {
      return 'week';
    }
    return 'month';
  },

  getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  },

  getYearDateRange(year: number): { startDate: string; endDate: string } {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  }
});
