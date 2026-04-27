'use strict';
// pages/statistics/statistics.js
const { formatDate, getWeekday, formatDayDisplay, getWeekOfMonth: getWOM, getMondayOfWeek } = require('../../utils/date.js');
const { calculateHash } = require('../../utils/encrypt.js');
const { store } = require('../../utils/store.js');

const DAY_THRESHOLD = 7;
const WEEK_THRESHOLD = 62;
const STATISTICS_DATE_KEY = 'statisticsDateRange';

const formatMonthDay = (dateStr) => dateStr.substring(5, 10);

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
    customHours: 35, // 自定义每周标准工时，默认35小时
    dailyStandardHours: 5, // 每天标准工时，根据customHours计算
    showHoursModal: false, // 控制每周标准工时弹窗显示/隐藏
    tempCustomHours: 35, // 临时存储用户输入的每周标准工时
    exportFilename: '', // 导出的文件名
    lastExportedFilePath: '', // 用于存储上次导出的文件路径
    shifts: [], // 用于存储排班数据
    filteredSchedules: [], // 用于显示的班次明细列表（虚拟滚动可见切片）
    visibleSchedules: [], // 虚拟滚动当前可见项
    listTopPadding: 0, // 虚拟列表顶部填充(px)
    listBottomPadding: 0, // 虚拟列表底部填充(px)
    listTotalCount: 0, // 班次明细总条数
    activeQuickBtn: 'thisWeek', // 用于跟踪当前选中的快速选择按钮
    showFilenameModal: false, // 控制文件名设置弹窗显示/隐藏
    tempFilename: '', // 临时存储用户输入的文件名
    defaultFilenameHint: '', // 默认文件名提示
    statistics: {
      totalDays: 0,
      workDays: 0,
      dayShifts: 0, // 白天班天数
      nightShifts: 0, // 跨夜班天数
      offDays: 0,
      totalHours: 0,
      hourDifference: 0
    },
    chartTimeUnit: 'day', // 图表时间单位：day, week, month, year
    chartType: 'line', // 图表类型：line（折线图）, bar（柱状图）
    chartData: { labels: [], data: [], standardData: [], yAxisMin: 0, yAxisMax: 10, subtext: '' }, // 图表数据
    // 周期选择器相关数据
    weekPickerRange: [], // 周选择器的数据范围
    weekPickerValue: [0, 0, 0], // 周选择器当前选中的值
    monthPickerRange: [], // 月选择器的数据范围
    monthPickerValue: [0, 0], // 月选择器当前选中的值
    yearOptions: [], // 年份选项
    yearPickerValue: 0, // 年选择器当前选中的值
    activePeriodBtn: '', // 当前选中的周期按钮：'week' | 'month' | 'year' | ''
    periodData: { // 存储解析后的周期数据
      years: [], // 所有有数据的年份
      months: {}, // 按年份分组的月份
      weeks: {} // 按年月分组的周数
    },
    hasTooManyRecords: false, // 班次明细是否超过30条
    heatmapWeeks: [], // 热力图数据（按周分组）
    heatmapCellSizeRpx: 60, // 热力图单元格大小(rpx)
    heatmapGapRpx: 6, // 热力图单元格间距(rpx)
    heatmapWeekLabels: ['一', '二', '三', '四', '五', '六', '日'], // 星期标签
    heatmapColumnsPerRow: 7, // 热力图每行的列数
    cumulativeTotalHours: 0, // 累计总工时
    cumulativeDays: 0, // 累计有数据的天数
    cumulativeStartDate: '', // 最早有数据的日期
    cumulativeEndDate: '', // 最新有数据的日期
    cumulativeDailyAvg: 0 // 日均工时
  },

  /**
   * 保存当前日期范围状态到本地存储
   */
  saveDateRangeState() {
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

  /**
   * 从本地存储恢复日期范围状态
   */
  loadDateRangeState() {
    try {
      return wx.getStorageSync(STATISTICS_DATE_KEY) || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * 跳转到使用说明页面
   */
  navigateToDocs(e) {
    const type = e.currentTarget.dataset.type || 'statistics';
    wx.navigateTo({
      url: `/subpkg-common/pages/docs/docs?type=${type}`
    });
  },

  // 获取本周日期范围
  getThisWeekRange(referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const start = new Date(now);
    const end = new Date(now);

    // 计算本周一（周一为一周第一天）
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // 如果是周日，则本周一是6天前；否则是day-1天前
    start.setDate(now.getDate() - diff);
    // 计算本周日（正确处理跨月份情况）
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000); // 通过时间戳加6天，避免月份计算问题

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  // 获取下周日期范围
  getNextWeekRange(referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const start = new Date(now);
    const end = new Date(now);

    // 计算下周一（周一为一周第一天）
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // 如果是周日，则本周一是6天前；否则是day-1天前
    start.setDate(now.getDate() - diff + 7);
    // 计算下周日（正确处理跨月份情况）
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000); // 通过时间戳加6天，避免月份计算问题

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  // 获取本月日期范围
  getThisMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  // 获取本年日期范围
  getThisYearRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  },

  // 快速选择按钮事件处理函数
  selectThisWeek() {
    // 添加点击动画
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

  selectNextWeek() {
    // 添加点击动画
    this.triggerButtonAnimation('nextWeek');
    // 使用当前结束日期作为参考日期来计算下周
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

  selectThisMonth() {
    // 添加点击动画
    this.triggerButtonAnimation('thisMonth');
    const range = this.getThisMonthRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      activeQuickBtn: 'thisMonth',
      activePeriodBtn: '',
      chartTimeUnit: 'week' // 选择本月时切换到周视图
    });
    this.saveDateRangeState();
    this.calculateStatistics();
  },

  selectThisYear() {
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

  // 触发按钮动画
  triggerButtonAnimation(buttonType) {
    // 这里可以通过DOM操作或数据绑定来添加动画类
    // 由于小程序的限制，我们通过数据绑定来实现
    // 实际效果已经通过CSS的:active伪类和::after伪元素实现
  },

  // 开始日期变更事件
  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value,
      activeQuickBtn: '', // 清除快捷按钮选中状态
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    this._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
    this.calculateStatistics();
  },

  // 结束日期变更事件
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value,
      activeQuickBtn: '', // 清除快捷按钮选中状态
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    this._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
    this.calculateStatistics();
  },

  // 显示文件名设置弹窗
  onExportBtnTap() {
    // 设置默认文件名提示：用户名+排班统计
    const username = wx.getStorageSync('username') || '未命名用户';
    const defaultFilenameHint = `${username}+排班统计`;

    this.setData({
      tempFilename: '',
      defaultFilenameHint: defaultFilenameHint,
      showFilenameModal: true
    });
  },

  // 隐藏文件名设置弹窗
  hideFilenameModal() {
    this.setData({
      showFilenameModal: false
    });
  },

  // 处理临时文件名输入
  onFilenameInput(e) {
    this.setData({
      tempFilename: e.detail.value
    });
  },

  // 确认导出
  confirmExport() {
    // 获取用户输入的文件名
    const customFilename = this.data.tempFilename;

    // 隐藏弹窗
    this.hideFilenameModal();

    // 调用导出数据方法
    this.exportToCSV(customFilename);
  },

  // 显示自定义每周标准工时弹窗
  showCustomHoursModal() {
    this.setData({
      tempCustomHours: this.data.customHours,
      showHoursModal: true
    });
  },

  // 隐藏自定义每周标准工时弹窗
  hideCustomHoursModal() {
    this.setData({
      showHoursModal: false
    });
  },

  // 临时存储用户输入的每周标准工时
  onCustomHoursInput(e) {
    const tempCustomHours = e.detail.value;
    this.setData({
      tempCustomHours: tempCustomHours
    });
  },

  // 确认自定义每周标准工时设置
  saveCustomHours() {
    const customHours = parseFloat(this.data.tempCustomHours) || 35;
    const dailyStandardHours = customHours / 7;

    this.setData({
      customHours: customHours,
      dailyStandardHours: dailyStandardHours,
      showHoursModal: false
    });

    // 保存到本地存储
    store.setState({ customHours }, ['customHours']);

    // 重新计算统计数据
    this.calculateStatistics();

    wx.showToast({
      title: '设置已保存',
      icon: 'success'
    });
  },

  // 阻止事件冒泡
  preventBubble() {
    // 什么都不做，只是阻止冒泡
  },

  // 计算统计数据
  calculateStatistics() {
    const { startDate, endDate, customHours, dailyStandardHours, chartTimeUnit: currentChartTimeUnit } = this.data;

    if (!startDate || !endDate) return;

    // 开始日期不能晚于结束日期
    if (new Date(startDate) > new Date(endDate)) {
      wx.showToast({
        title: '开始日期不能晚于结束日期',
        icon: 'none'
      });
      return;
    }

    // 自动计算最优的图表时间单位
    const optimalUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const chartTimeUnit = optimalUnit;

    try {
      // TODO: 后续改为云数据库按需查询时，在此加上日期条件过滤以减少数据传输量
      const allShifts = wx.getStorageSync('shifts') || {};
      const currentShiftsHash = calculateHash(JSON.stringify(allShifts));
      const currentDateRange = `${startDate}_${endDate}_${chartTimeUnit}_${customHours}`;

      // 确保缓存对象初始化
      if (!this._cache) {
        this._cache = {
          lastShiftsHash: '',
          lastStatistics: null,
          lastDateRange: null
        };
      }

      // 检查缓存
      if (this._cache.lastShiftsHash === currentShiftsHash &&
          this._cache.lastDateRange === currentDateRange &&
          this._cache.lastStatistics) {
        this._allSchedules = this._cache._allSchedules || this._cache.lastStatistics.filteredSchedules || [];
        this._initVirtualScrollParams();
        const initialSlice = this._computeVisibleSlice(0);
        const cachedData = Object.assign({}, this._cache.lastStatistics, {
          filteredSchedules: initialSlice.items,
          visibleSchedules: initialSlice.items,
          listTopPadding: initialSlice.topPadding,
          listBottomPadding: initialSlice.bottomPadding,
          listTotalCount: this._allSchedules.length
        });
        this.setData(cachedData);
        this.updateChartData();
        this.drawPieChart();
        this.calculateCumulativeStats();
        return;
      }

      const shiftsInRange = [];
      let totalHours = 0;
      let workDays = 0;
      let dayShifts = 0; // 白天班天数
      let nightShifts = 0; // 跨夜班天数
      let offDays = 0;

      // 遍历日期范围内的所有排班
      const start = new Date(startDate);
      const end = new Date(endDate);

      // 计算统计周期内的天数
      const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      const filteredSchedules = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        const shiftData = allShifts[dateStr];

        if (shiftData) {
          const shift = {
            date: dateStr,
            ...shiftData
          };
          shiftsInRange.push(shift);
          totalHours += parseFloat(shiftData.workHours) || 0;

          const shiftType = shiftData.type;
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
            workHours: shiftData.workHours || '--:--'
          });
        } else {
          filteredSchedules.push({
            date: dateStr,
            day: this.formatDayDisplay(dateStr),
            weekday: this.getWeekday(dateStr),
            shiftType: '休息日',
            workHours: '--:--'
          });
          offDays++;
        }
      }

      // 计算标准工时和工时差额
      let standardHours = 0;

      // 根据统计类型计算标准工时
      if (dayCount === 7) {
        // 整周统计（上周、本周、下周）：使用自定义每周标准工时
        standardHours = customHours;
      } else {
        // 自定义日期范围或本月统计：使用自定义每天标准工时
        standardHours = dayCount * dailyStandardHours;
      }

      // 计算工时差额
      const hourDifference = totalHours - standardHours;

      // 生成差额文本描述
      let differenceText = '';
      if (hourDifference > 0) {
        differenceText = `超额 +${hourDifference.toFixed(1)} 小时`;
      } else if (hourDifference < 0) {
        differenceText = `差额 ${hourDifference.toFixed(1)} 小时`;
      } else {
        differenceText = '工时正好';
      }

      // 生成进度文本
      const progressPercent = standardHours > 0 ? (totalHours / standardHours * 100).toFixed(1) : '0.0';
      const progressStatus = totalHours >= standardHours ? '已完成' : '进行中';
      const progressText = `${progressStatus} ${progressPercent}%`;

      // 生成用于显示和导出的带符号差额值
      const hourDifferenceWithSign = hourDifference > 0 ? `+${hourDifference.toFixed(1)}` : hourDifference.toFixed(1);

      this._allSchedules = filteredSchedules;
      this._initVirtualScrollParams();
      const initialSlice = this._computeVisibleSlice(0);

      const newData = {
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

      // 生成热力图数据
      const heatmapResult = this.generateHeatmapData(filteredSchedules);
      newData.heatmapWeeks = heatmapResult.weeks;
      newData.heatmapCellSizeRpx = heatmapResult.cellSizeRpx;
      newData.heatmapGapRpx = heatmapResult.gapRpx;
      newData.heatmapColumnsPerRow = heatmapResult.columnsPerRow;

      // 更新缓存
      this._cache.lastShiftsHash = currentShiftsHash;
      this._cache.lastDateRange = currentDateRange;
      this._cache.lastStatistics = newData;
      this._cache._allSchedules = filteredSchedules;

      this.setData(newData);

      // 绘制图表
      this.updateChartData();
      // 绘制饼图
      this.drawPieChart();
      // 计算累计工时
      this.calculateCumulativeStats();
    } catch (e) {
      console.error('计算统计数据失败', e);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    }
  },

  _initVirtualScrollParams() {
    if (this._itemHeightPx) return;
    const windowInfo = wx.getWindowInfo();
    this._rpxRatio = windowInfo.windowWidth / 750;
    this._itemHeightRpx = 110;
    this._itemHeightPx = Math.ceil(this._itemHeightRpx * this._rpxRatio);
    this._visibleBuffer = 7;
    this._visibleCount = Math.ceil(600 / this._itemHeightRpx) + this._visibleBuffer * 2;
    this._lastRenderStart = -1;
  },

  _computeVisibleSlice(scrollTop) {
    if (!this._allSchedules || !this._allSchedules.length) {
      return { items: [], topPadding: 0, bottomPadding: 0 };
    }
    const totalCount = this._allSchedules.length;
    const itemH = this._itemHeightPx || 55;
    const visibleCount = this._visibleCount || 20;

    let startIndex = Math.max(0, Math.floor(scrollTop / itemH) - this._visibleBuffer);
    startIndex = Math.min(startIndex, Math.max(0, totalCount - visibleCount));
    const endIndex = Math.min(startIndex + visibleCount, totalCount);

    return {
      items: this._allSchedules.slice(startIndex, endIndex),
      topPadding: startIndex * itemH,
      bottomPadding: Math.max(0, (totalCount - endIndex) * itemH)
    };
  },

  onScheduleScroll(e) {
    this._pendingScrollTop = e.detail.scrollTop;
    if (this._scrollScheduled) return;
    this._scrollScheduled = true;
    setTimeout(() => {
      this._scrollScheduled = false;
      const scrollTop = this._pendingScrollTop;
      const itemH = this._itemHeightPx || 55;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemH) - this._visibleBuffer);
      if (Math.abs(startIndex - this._lastRenderStart) < 3) return;
      this._lastRenderStart = startIndex;
      const slice = this._computeVisibleSlice(scrollTop);
      this.setData({
        visibleSchedules: slice.items,
        filteredSchedules: slice.items,
        listTopPadding: slice.topPadding,
        listBottomPadding: slice.bottomPadding
      });
    }, 50);
  },

  // 导出为CSV文件
  exportToCSV(customFilename) {
    const { startDate, endDate, shifts, totalHours, standardHours, hourDifference, hourDifferenceWithSign, statistics, customHours } = this.data;

    wx.showLoading({
      title: '正在导出...'
    });

    try {
      // 获取用户名
      const username = wx.getStorageSync('username') || '未命名用户';

      // 转义包含逗号或引号的字段
      const escapeField = (field) => {
        if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        // 强制所有字段作为文本处理
        return `"${field}"`;
      };

      // 生成由等号组成的字符串
      const generateEquals = (length) => {
        return '='.repeat(Math.max(4, length));
      };

      // 计算第一部分的列宽度（统计信息）
      const section1Cols = [
        { header: '统计范围', values: [`${startDate}至${endDate}`] },
        { header: '标准工时', values: [standardHours] },
        { header: '实际工时', values: [totalHours] },
        { header: '工时差/超额', values: [hourDifferenceWithSign] },
        { header: '白天班', values: [String(statistics.dayShifts)] },
        { header: '跨夜班', values: [String(statistics.nightShifts)] },
        { header: '休息日', values: [String(statistics.offDays)] }
      ];

      const section1Widths = section1Cols.map(col => {
        const maxLength = Math.max(
          col.header.length,
          ...col.values.map(val => String(val).length)
        );
        return maxLength;
      });

      // 计算第二部分的列宽度（班次明细）
      const section2Cols = [
        { header: '日期', values: shifts.map(s => s.date) },
        { header: '班次名称', values: shifts.map(s => s.name) },
        { header: '工时', values: shifts.map(s => s.workHours) },
        { header: '班次类型', values: shifts.map(s => s.type) },
        { header: '开始时间', values: shifts.map(s => s.startTime) },
        { header: '结束时间', values: shifts.map(s => s.endTime) }
      ];

      const section2Widths = section2Cols.map(col => {
        const maxLength = Math.max(
          col.header.length,
          ...col.values.map(val => String(val).length)
        );
        return maxLength;
      });

      // 生成分隔行
      const generateSeparator = (widths) => {
        return widths.map(w => escapeField(generateEquals(w))).join(',');
      };

      // 创建CSV内容
      let csvContent = '';

      // 第一行：nickname排班统计报表，时间范围
      const titleText = username + '排班统计报表';
      csvContent += escapeField(titleText) + '\n';

      // 第二行：====
      // 确保分隔符至少和标题一样宽
      csvContent += escapeField(generateEquals(titleText.length)) + '\n';

      // 第三行：统计范围，标准工时，实际工时，工时差/超额，白天班，跨夜班，休息日
      csvContent += section1Cols.map(col => escapeField(col.header)).join(',') + '\n';

      // 第四行：填写第三行的信息
      csvContent += [
        escapeField(startDate + '至' + endDate),
        escapeField(standardHours),
        escapeField(totalHours),
        escapeField(hourDifferenceWithSign),
        escapeField(statistics.dayShifts),
        escapeField(statistics.nightShifts),
        escapeField(statistics.offDays)
      ].join(',') + '\n';

      // 第五行：====
      csvContent += generateSeparator(section1Widths) + '\n';

      // 第六行：日期，班次名称，工时，班次类型，开始时间，结束时间
      csvContent += section2Cols.map(col => escapeField(col.header)).join(',') + '\n';

      // 第七行...：填写第六行的信息
      shifts.forEach(shift => {
        csvContent += [
          escapeField(shift.date),
          // 在前添加单引号确保Excel将其识别为纯文本而不是日期
          escapeField(`'${shift.name}`),
          escapeField(shift.workHours),
          escapeField(shift.type),
          escapeField(shift.startTime),
          escapeField(shift.endTime)
        ].join(',') + '\n';
      });

      // 生成默认文件名：用户名+时间段
      const fileName = customFilename ? customFilename : `${username}_排班统计_${startDate}_至_${endDate}`;

      // 创建临时文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.csv`;

      fs.writeFile({
        filePath: filePath,
        data: csvContent,
        encoding: 'utf8',
        success: () => {
          // 保存文件路径到data中
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

  // 分享CSV文件
  shareCSV() {
    const { lastExportedFilePath, startDate, endDate } = this.data;

    // 如果没有导出过文件，提示用户先导出
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

    // 从文件路径中提取文件名
    const fileName = lastExportedFilePath.substring(lastExportedFilePath.lastIndexOf('/') + 1, lastExportedFilePath.lastIndexOf('.'));

    // 分享文件
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

  onLoad() {
    // 初始化缓存对象
    this._cache = {
      lastShiftsHash: '',
      lastStatistics: null,
      lastDateRange: null
    };
    this._periodDataCache = null;

    // 页面加载时读取本地存储的自定义每周标准工时
    const savedCustomHours = wx.getStorageSync('customHours') || 35;
    const dailyStandardHours = savedCustomHours / 7;

    // 页面加载时读取本地存储的图表类型
    const savedChartType = wx.getStorageSync('statisticsChartType') || 'line';

    this.setData({
      customHours: savedCustomHours,
      dailyStandardHours: dailyStandardHours,
      chartType: savedChartType
    });

    // 解析周期数据
    this.parsePeriodData();

    // 尝试恢复上次选中的日期范围
    const savedState = this.loadDateRangeState();
    if (savedState && savedState.startDate && savedState.endDate) {
      this.setData({
        startDate: savedState.startDate,
        endDate: savedState.endDate,
        activeQuickBtn: savedState.activeQuickBtn || '',
        activePeriodBtn: savedState.activePeriodBtn || '',
        weekPickerValue: savedState.weekPickerValue || [0, 0, 0],
        monthPickerValue: savedState.monthPickerValue || [0, 0],
        yearPickerValue: savedState.yearPickerValue || 0
      });
      this.calculateStatistics();
    } else {
      // 没有保存的记录，默认选中本周
      this.selectThisWeek();
    }

    const statsPage = this;
    this._storeUnsub = store.subscribe('_lastDataRestore', function () {
      statsPage.parsePeriodData();
      statsPage.calculateStatistics();
      statsPage.drawChart();
    });
  },

  // 切换图表类型
  onChartInit(e) {
    this._chartComponent = e.detail.component;
  },

  changeChartType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      chartType: type
    });
    store.setState({ chartType: type }, ['chartType']);
    this.updateChartData();
  },

  // 好友分享功能
  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统 - 统计页面',
      path: '/pages/statistics/statistics'
    };
  },

  // 朋友圈分享功能
  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统 - 统计页面',
      query: 'page=statistics'
    };
  },

  // 切换图表时间单位
  changeChartTimeUnit(e) {
    const unit = e.currentTarget.dataset.unit;
    let startDate, endDate;
    const now = new Date();

    // 根据时间单位调整日期范围
    if (unit === 'day') {
      // 日：显示本周每日
      const range = this.getThisWeekRange();
      startDate = range.startDate;
      endDate = range.endDate;
    } else if (unit === 'week') {
      // 周：显示本月的周
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); // 本月1日
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 本月最后一天
      startDate = this.formatDate(monthStart);
      endDate = this.formatDate(monthEnd);
    } else if (unit === 'month') {
      // 月：显示这一年的12个月
      const yearStart = new Date(now.getFullYear(), 0, 1); // 1月1日
      const yearEnd = new Date(now.getFullYear(), 11, 31); // 12月31日
      startDate = this.formatDate(yearStart);
      endDate = this.formatDate(yearEnd);
    }

    this.setData({
      chartTimeUnit: unit,
      startDate: startDate,
      endDate: endDate,
      activeQuickBtn: unit === 'day' ? 'thisWeek' : '', // 选择日视图时选中本周按钮
      activePeriodBtn: ''
    });

    // 重新计算统计数据
    this.calculateStatistics();
  },

  // 生成图表数据
  generateChartData() {
    const { startDate, endDate, shifts, customHours, dailyStandardHours } = this.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const labels = [];
    const data = [];
    const standardData = [];
    const longLabels = [];
    const unitLabelMap = { day: '按天汇总', week: '按周汇总', month: '按月汇总' };
    let subtext = unitLabelMap[chartTimeUnit] || '';

    if (shifts.length === 0) {
      return { labels: [], data: [], standardData: [], yAxisMax: 10, yAxisMin: 0, longLabels: [], subtext: '暂无数据' };
    }

    // 大数据量时使用 Map 缓存按日期分组的工时，避免多次 find 循环
    const useCache = shifts.length > 2000;
    let hoursByDate = null;
    if (useCache) {
      hoursByDate = new Map();
      shifts.forEach(shift => {
        hoursByDate.set(shift.date, parseFloat(shift.workHours) || 0);
      });
    }

    // 根据时间单位生成数据
    if (chartTimeUnit === 'day') {
      // 日视图：≤7天，显示单个日期
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        let hours = 0;
        if (useCache && hoursByDate) {
          hours = hoursByDate.get(dateStr) || 0;
        } else {
          const dayData = shifts.find(shift => shift.date === dateStr);
          hours = parseFloat(dayData?.workHours) || 0;
        }
        const dayNum = d.getDate();
        labels.push(`${dayNum}号`);
        data.push(hours);
        standardData.push(dailyStandardHours);
        longLabels.push(dateStr);
      }
    } else if (chartTimeUnit === 'week') {
      // 周视图：8~60天，按顺序显示1周、2周...
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
            const dayData = shifts.find(shift => shift.date === dateStr);
            weekTotal += parseFloat(dayData?.workHours) || 0;
          }
        }

        labels.push(`${weekIndex}周`);
        data.push(weekTotal);
        standardData.push(customHours);
        longLabels.push(`${this.formatDate(actualStart)}~${this.formatDate(actualEnd)}`);
      }
    } else if (chartTimeUnit === 'month') {
      // 月视图：>60天，显示YYYY-MM格式，只显示有数据的月份
      const yearStart = start.getFullYear();
      const monthStart = start.getMonth();
      const yearEnd = end.getFullYear();
      const monthEnd = end.getMonth();

      // 构建按月份分组的数据映射
      const monthHoursMap = {};
      const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

      if (useCache && hoursByDate) {
        hoursByDate.forEach((hours, dateStr) => {
          if (dateStr >= startDate && dateStr <= endDate) {
            const monthKey = dateStr.substring(0, 7);
            monthHoursMap[monthKey] = (monthHoursMap[monthKey] || 0) + hours;
          }
        });
      } else {
        shifts.forEach(shift => {
          const monthKey = shift.date.substring(0, 7);
          monthHoursMap[monthKey] = (monthHoursMap[monthKey] || 0) + parseFloat(shift.workHours) || 0;
        });
      }

      let currentYear = yearStart;
      let currentMonth = monthStart;
      while (currentYear < yearEnd || (currentYear === yearEnd && currentMonth <= monthEnd)) {
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        if (monthHoursMap.hasOwnProperty(monthKey)) {
          labels.push(`${currentMonth + 1}月`);
          data.push(monthHoursMap[monthKey]);
          standardData.push(customHours * 4.35);
          longLabels.push(`${currentYear}年${monthNames[currentMonth]}`);
        }
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
    }

    // 计算纵轴范围（考虑标准工时）
    const allValues = data.length > 0 ? [...data, ...standardData] : [0];
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 10;
    const yAxisMin = minValue < 0 ? Math.floor(minValue * 1.1) : 0;

    return {
      labels,
      data,
      standardData,
      yAxisMax,
      yAxisMin,
      longLabels,
      subtext
    };
  },

  // 生成热力图数据
  generateHeatmapData(filteredSchedules) {
    const days = filteredSchedules || [];
    const totalDays = days.length;

    if (totalDays === 0) {
      return { weeks: [], cellSizeRpx: 60, gapRpx: 6, columnsPerRow: 7 };
    }

    // 根据天数确定单元格大小（rpx）
    let cellSizeRpx, gapRpx;
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

    // 计算每行列数：卡片内容区宽度 = 750rpx - 60rpx(左右margin) - 60rpx(左右padding) = 630rpx
    const cardContentWidth = 630;
    let columnsPerRow = Math.floor(cardContentWidth / (cellSizeRpx + gapRpx));
    columnsPerRow = Math.max(7, Math.min(columnsPerRow, 31));

    // 当数据量不大时保持 7 列（星期对齐），数据量大时填满宽度
    if (totalDays <= 35) {
      columnsPerRow = 7;
    }

    // 构建热力图格子数据
    const cellItems = days.map(d => {
      const hours = parseFloat(d.workHours);
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

    // 按列数分组为行
    const rows = [];
    let currentRow = [];

    if (totalDays <= 35) {
      // 小数据量：按星期对齐，相邻月份用模糊块补齐
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
      // 大数据量：按宽度填充，从左到右排列
      cellItems.forEach(cell => {
        currentRow.push(cell);
        if (currentRow.length === columnsPerRow) {
          rows.push(currentRow);
          currentRow = [];
        }
      });

      // 末行不填充空白（让剩余空间自然留白，视觉上更自然）
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
    }

    return { weeks: rows, cellSizeRpx, gapRpx, columnsPerRow };
  },

  // 根据工时获取热力图颜色（由浅到深）
  getHeatmapColor(hours) {
    if (hours <= 0) return '#ebedf0';
    if (hours <= 6) return '#c6e48b';
    if (hours <= 7) return '#7bc96f';
    if (hours <= 8) return '#5aad4a';
    if (hours < 9) return '#3d8b37';
    return '#2d6a2b';
  },

  // 热力图单元格点击事件
  onHeatmapCellTap(e) {
    const { date, hours, type } = e.currentTarget.dataset;
    wx.showToast({
      title: `${date} ${hours}小时`,
      icon: 'none',
      duration: 1500
    });
  },

  updateChartData() {
    const { startDate, endDate, chartType } = this.data;
    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const chartData = this.generateChartData();
    this.setData({
      chartData: chartData,
      chartTimeUnit: chartTimeUnit
    });
  },

  // 绘制扇形图
  drawPieChart() {
    const { statistics } = this.data;
    const total = statistics.dayShifts + statistics.nightShifts + statistics.offDays;
    if (total === 0) return;

    const query = wx.createSelectorQuery();
    query.select('#pieCanvas').fields({ node: true, size: true }).exec(res => {
      const canvas = res[0]?.node;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo().pixelRatio;
      const width = res[0].width;
      const height = res[0].height;
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

      // 过滤掉0值的项
      const validData = pieData.filter(d => d.value > 0);
      if (validData.length === 0) return;

      const totalValue = validData.reduce((sum, d) => sum + d.value, 0);

      // 计算起始角度，使白天班与跨夜班的分界线位于正上方（12点钟方向）
      const daySliceAngle = (statistics.dayShifts / total) * 2 * Math.PI;
      let startAngle = -Math.PI / 2 - daySliceAngle;

      // 绘制扇形图
      validData.forEach((d, i) => {
        const sliceAngle = (d.value / totalValue) * 2 * Math.PI;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();

        ctx.fillStyle = d.color;
        ctx.fill();

        // 扇区之间加白色分割线
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        startAngle += sliceAngle;
      });
    });
  },

  // 计算累计工时数据
  calculateCumulativeStats() {
    const allShifts = wx.getStorageSync('shifts') || {};
    const dates = Object.keys(allShifts).sort();
    if (dates.length === 0) return;

    let totalHours = 0;
    let daysWithData = 0;
    let firstDate = '';
    let lastDate = '';

    dates.forEach(dateStr => {
      const shiftData = allShifts[dateStr];
      const hours = parseFloat(shiftData.workHours) || 0;
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

  onShow() {
    // 页面显示时只在排班数据发生变化时重新计算统计数据
    const allShifts = wx.getStorageSync('shifts') || {};
    const currentShifts = this.data.shifts;

    // 检查排班数据是否发生变化
    const shiftsChanged = calculateHash(JSON.stringify(allShifts)) !== calculateHash(JSON.stringify(currentShifts));

    if (shiftsChanged) {
      this.parsePeriodData();
      this.calculateStatistics();
      this.updateChartData();
      this.drawPieChart();
      this.calculateCumulativeStats();
    }
  },

  // 解析周期数据：从排班数据中提取年、月、周信息（带缓存）
  parsePeriodData() {
    const allShifts = wx.getStorageSync('shifts') || {};
    const currentHash = calculateHash(JSON.stringify(allShifts));

    // 检查缓存
    if (this._periodDataCache && this._periodDataCache.hash === currentHash) {
      return;
    }

    const dateKeys = Object.keys(allShifts);

    if (dateKeys.length === 0) {
      // 如果没有数据，使用当前日期作为默认
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

      // 保存缓存
      this._periodDataCache = {
        hash: currentHash,
        data: periodData
      };
      return;
    }

    const years = new Set();
    const months = {};
    const weeks = {};

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

    // 转换为数组并排序
    const sortedYears = Array.from(years).sort((a, b) => a - b);
    const sortedMonths = {};
    const sortedWeeks = {};

    Object.keys(months).forEach(year => {
      sortedMonths[year] = Array.from(months[year]).sort((a, b) => a - b);
    });

    Object.keys(weeks).forEach(key => {
      sortedWeeks[key] = Array.from(weeks[key]).sort((a, b) => a - b);
    });

    const periodData = {
      years: sortedYears,
      months: sortedMonths,
      weeks: sortedWeeks
    };

    // 获取当前日期
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentWeek = this.getWeekOfMonth(now);

    // 初始化周选择器数据 - 默认选中当周
    let weekRange = [];
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

      weekValue = [
        yearIndex >= 0 ? yearIndex : 0,
        monthIndex,
        weekIndex
      ];
    }

    // 初始化月选择器数据 - 默认选中当月
    let monthRange = [];
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

      monthValue = [
        yearIndex >= 0 ? yearIndex : 0,
        monthIndex
      ];
    }

    // 初始化年选择器数据 - 默认选中当年
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

    // 保存缓存
    this._periodDataCache = {
      hash: currentHash,
      data: periodData
    };
  },

  // 获取日期所在月份的第几周（周一为一周开始）
  getWeekOfMonth(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    // 计算第一天是星期几（0=周日，1=周一，...6=周六）
    let firstDayWeekday = firstDay.getDay();
    // 调整为周一为0
    firstDayWeekday = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

    const dayOfMonth = date.getDate();
    const weekNum = Math.ceil((dayOfMonth + firstDayWeekday) / 7);
    return weekNum;
  },

  // 周选择器列变化事件
  onWeekPickerColumnChange(e) {
    const column = e.detail.column;
    const value = e.detail.value;
    const { periodData, weekPickerRange, weekPickerValue } = this.data;

    const newRange = [...weekPickerRange];
    let newValue = [...weekPickerValue];

    if (column === 0) {
      // 年份改变
      const selectedYear = periodData.years[value];
      const monthsForYear = periodData.months[selectedYear] || [];
      const firstMonth = monthsForYear[0] || 1;
      const yearMonthKey = `${selectedYear}-${String(firstMonth).padStart(2, '0')}`;
      const weeksForMonth = periodData.weeks[yearMonthKey] || [1];

      newRange[1] = monthsForYear.map(m => `${m}月`);
      newRange[2] = weeksForMonth.map(w => `第${w}周`);
      newValue = [value, 0, 0];

      this.setData({
        weekPickerRange: newRange,
        weekPickerValue: newValue
      });
    } else if (column === 1) {
      // 月份改变
      const yearIndex = newValue[0];
      const selectedYear = periodData.years[yearIndex];
      const monthsForYear = periodData.months[selectedYear] || [];
      const selectedMonth = monthsForYear[value];
      const yearMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const weeksForMonth = periodData.weeks[yearMonthKey] || [1];

      newRange[2] = weeksForMonth.map(w => `第${w}周`);
      newValue = [yearIndex, value, 0];

      this.setData({
        weekPickerRange: newRange,
        weekPickerValue: newValue
      });
    }
  },

  // 周选择器确认事件
  onWeekPickerChange(e) {
    const value = e.detail.value;
    const { periodData } = this.data;

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
      this._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  // 月选择器列变化事件
  onMonthPickerColumnChange(e) {
    const column = e.detail.column;
    const value = e.detail.value;
    const { periodData, monthPickerRange, monthPickerValue } = this.data;

    const newRange = [...monthPickerRange];
    let newValue = [...monthPickerValue];

    if (column === 0) {
      // 年份改变
      const selectedYear = periodData.years[value];
      const monthsForYear = periodData.months[selectedYear] || [];

      newRange[1] = monthsForYear.map(m => `${m}月`);
      newValue = [value, 0];

      this.setData({
        monthPickerRange: newRange,
        monthPickerValue: newValue
      });
    }
  },

  // 月选择器确认事件
  onMonthPickerChange(e) {
    const value = e.detail.value;
    const { periodData } = this.data;

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
      this._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  // 年选择器确认事件
  onYearPickerChange(e) {
    const value = e.detail.value;
    const { periodData } = this.data;

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
      this._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  // 获取指定年月周的日期范围（周一至周日）
  getWeekDateRange(year, month, weekNum) {
    const firstDay = new Date(year, month - 1, 1);
    // 计算第一天是星期几（0=周日，1=周一，...6=周六）
    let firstDayWeekday = firstDay.getDay();
    // 调整为周一为0
    firstDayWeekday = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

    // 计算该周第一天的偏移
    const startOffset = (weekNum - 1) * 7 - firstDayWeekday;
    const startDate = new Date(year, month - 1, 1 + startOffset);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  },

  // 根据时间跨度自动计算合适的横轴单位
  calculateOptimalChartUnit(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // 规则1：≤7天 → 日视图
    if (dayCount <= DAY_THRESHOLD) {
      return 'day';
    }

    // 规则2：8~60天 → 周视图
    if (dayCount <= WEEK_THRESHOLD) {
      return 'week';
    }

    // 规则3：>60天 → 月视图
    return 'month';
  },

  // 获取指定年月的日期范围
  getMonthDateRange(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  },

  // 获取指定年的日期范围
  getYearDateRange(year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    };
  }

});


