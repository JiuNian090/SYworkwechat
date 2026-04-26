'use strict';
// pages/statistics/statistics.js
const { formatDate, getWeekday, formatDayDisplay, getWeekOfMonth: getWOM, getMondayOfWeek } = require('../../utils/date.js');
const { calculateHash } = require('../../utils/encrypt.js');
const { store } = require('../../utils/store.js');

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
    chartData: [], // 图表数据
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

  // 日期范围持久化存储键名
  STATISTICS_DATE_KEY: 'statisticsDateRange',

  /**
   * 保存当前日期范围状态到本地存储
   */
  saveDateRangeState() {
    const { startDate, endDate, activeQuickBtn, activePeriodBtn, weekPickerValue, monthPickerValue, yearPickerValue } = this.data;
    wx.setStorageSync(this.STATISTICS_DATE_KEY, {
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
      return wx.getStorageSync(this.STATISTICS_DATE_KEY) || null;
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

  // 获取上周日期范围
  getLastWeekRange(referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const start = new Date(now);
    const end = new Date(now);

    // 计算上周一（周一为一周第一天）
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // 如果是周日，则上周一是6天前；否则是day-1天前
    start.setDate(now.getDate() - diff - 7);
    // 计算上周日（正确处理跨月份情况）
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000); // 通过时间戳加6天，避免月份计算问题

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
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

  // 快速选择按钮事件处理函数
  selectLastWeek() {
    // 添加点击动画
    this.triggerButtonAnimation('lastWeek');
    // 使用当前结束日期作为参考日期来计算上周
    const referenceDate = this.data.endDate ? new Date(this.data.endDate) : new Date();
    const range = this.getLastWeekRange(referenceDate);
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      activeQuickBtn: 'lastWeek',
      activePeriodBtn: ''
    });
    this.saveDateRangeState();
    this.calculateStatistics();
  },

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

    // 自动计算最优的图表时间单位
    const optimalUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const chartTimeUnit = optimalUnit;

    try {
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
        this.drawChart();
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
      this.drawChart();
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
  changeChartType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      chartType: type
    });
    // 保存用户选择的图表类型
    store.setState({ chartType: type }, ['chartType']);
    this.drawChart();
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

    // 根据时间单位生成数据
    if (chartTimeUnit === 'day') {
      // 日视图：≤14天，显示单个日期
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        const dayData = shifts.find(shift => shift.date === dateStr);
        const dayNum = d.getDate();
        labels.push(`${dayNum}号`);
        data.push(parseFloat(dayData?.workHours) || 0);
        standardData.push(dailyStandardHours);
      }
    } else if (chartTimeUnit === 'week') {
      // 周视图：>15天且≤2个月，显示第几周，纵轴显示一周的总小时数
      const weeklyData = {};

      // 找到起始周的周一
      const firstMonday = new Date(start);
      const dayOfWeek = firstMonday.getDay();
      firstMonday.setDate(firstMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      // 遍历所有日期，按周分组
      for (let d = new Date(firstMonday); d <= end; d.setDate(d.getDate() + 7)) {
        const weekStart = new Date(d);
        const weekEnd = new Date(d);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // 计算这是第几周（从起始周开始算）
        const weekNumber = Math.floor((weekStart - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
        const weekKey = `week_${weekNumber}`;
        weeklyData[weekKey] = {
          label: `第${weekNumber}周`,
          total: 0
        };

        // 统计这一周的数据
        for (let day = new Date(weekStart); day <= weekEnd; day.setDate(day.getDate() + 1)) {
          if (day >= start && day <= end) {
            const dateStr = this.formatDate(day);
            const dayData = shifts.find(shift => shift.date === dateStr);
            weeklyData[weekKey].total += parseFloat(dayData?.workHours) || 0;
          }
        }
      }

      // 生成标签和数据
      Object.keys(weeklyData).forEach(key => {
        labels.push(weeklyData[key].label);
        data.push(weeklyData[key].total);
        standardData.push(customHours);
      });
    } else if (chartTimeUnit === 'month') {
      // 月视图：>2个月，显示12个月，纵轴显示每月总小时数
      const monthlyData = {};

      // 初始化全年12个月
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${start.getFullYear()}-${String(m).padStart(2, '0')}`;
        monthlyData[monthKey] = {
          label: `${m}月`,
          total: 0
        };
      }

      // 只遍历有数据的日期
      shifts.forEach(shift => {
        const monthKey = shift.date.substring(0, 7); // YYYY-MM
        if (monthlyData.hasOwnProperty(monthKey)) {
          monthlyData[monthKey].total += parseFloat(shift.workHours) || 0;
        }
      });

      // 生成标签和数据
      Object.keys(monthlyData).forEach(key => {
        labels.push(monthlyData[key].label);
        data.push(monthlyData[key].total);
        // 月视图标准工时：每周标准工时 × 4周
        standardData.push(customHours * 4);
      });
    }

    // 计算纵轴范围（考虑标准工时）
    const allValues = [...data, ...standardData];
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 10;
    const yAxisMin = minValue < 0 ? Math.floor(minValue * 1.1) : 0;

    return {
      labels,
      data,
      standardData,
      yAxisMax,
      yAxisMin
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

  // 绘制图表（支持折线图和柱状图）
  drawChart() {
    const { startDate, endDate, chartType } = this.data;
    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const chartData = this.generateChartData();
    const windowInfo = wx.getWindowInfo();
    const windowWidth = windowInfo.windowWidth;
    const chartWidth = windowWidth - 60;
    const chartHeight = 310;
    const padding = { left: 52, right: 24, top: 64, bottom: 62 };
    const plotLeft = padding.left;
    const plotTop = padding.top;
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    const unitLabelMap = { day: '小时/天', week: '小时/周', month: '小时/月' };
    const yAxisUnit = unitLabelMap[chartTimeUnit] || '小时';

    const query = wx.createSelectorQuery();
    query.select('#lineCanvas').fields({
      node: true,
      size: true
    }).exec((res) => {
      if (!res || !res[0]) return;

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');

      const dpr = wx.getWindowInfo().pixelRatio;
      canvas.width = chartWidth * dpr;
      canvas.height = chartHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // 绘图区背景
      ctx.fillStyle = '#fafbfc';
      ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

      // Y轴刻度线
      const yRange = chartData.yAxisMax - chartData.yAxisMin;
      const yScale = plotHeight / (yRange || 1);
      const ySteps = 5;
      const yStepPx = plotHeight / ySteps;

      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.8;
      for (let i = 0; i <= ySteps; i++) {
        const y = plotTop + yStepPx * i;
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotLeft + plotWidth, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // X轴网格线（仅日视图显示，减少视觉噪声）
      const extraPadding = 16;
      const dataPlotWidth = plotWidth - extraPadding * 2;
      const adjustedXStep = chartData.labels.length > 1
        ? dataPlotWidth / (chartData.labels.length - 1)
        : dataPlotWidth;

      if (chartTimeUnit === 'day' && chartData.labels.length <= 14) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = '#e5e7eb';
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

      // 绘制坐标轴
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(plotLeft, plotTop);
      ctx.lineTo(plotLeft, plotTop + plotHeight);
      ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
      ctx.stroke();

      // 纵轴标签
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px -apple-system, sans-serif';
      for (let i = 0; i <= ySteps; i++) {
        const y = plotTop + yStepPx * i;
        const value = chartData.yAxisMax - (yRange / ySteps) * i;
        ctx.fillText(value.toFixed(1), plotLeft - 8, y);
      }

      // 纵轴单位（横向，位于顶部轴标签上方）
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(yAxisUnit, plotLeft + 6, plotTop - 6);

      // 绘制数据
      if (chartData.data.length > 0) {
        if (chartType === 'line') {
          this.drawLineChart(ctx, chartData, plotLeft, plotTop, plotHeight, extraPadding, adjustedXStep, yScale, chartData.yAxisMin);
        } else if (chartType === 'bar') {
          this.drawBarChart(ctx, chartData, plotLeft, plotTop, plotHeight, extraPadding, adjustedXStep, yScale, chartData.yAxisMin);
        }
      }

      // 横轴标签
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px -apple-system, sans-serif';
      const labelY = plotTop + plotHeight + 8;

      for (let i = 0; i < chartData.labels.length; i++) {
        const x = plotLeft + extraPadding + (chartData.labels.length > 1
          ? adjustedXStep * i : dataPlotWidth / 2);
        ctx.fillText(chartData.labels[i], x, labelY);
      }

      // 图例 — 居中显示
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

      // 实际工时 — 折线图画短线，柱状图画小方块
      if (isBar) {
        const gradient = ctx.createLinearGradient(legendStartX, legendY - 6, legendStartX, legendY + 6);
        gradient.addColorStop(0, '#34d399');
        gradient.addColorStop(1, '#6ee7b7');
        ctx.fillStyle = gradient;
        ctx.fillRect(legendStartX, legendY - 6, 14, 12);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(legendStartX, legendY - 6, 14, 12);
      } else {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(legendStartX, legendY);
        ctx.lineTo(legendStartX + legendIconW, legendY);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(legendStartX + legendIconW / 2, legendY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(legendStartX + legendIconW / 2, legendY, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#374151';
      ctx.fillText(actualLabel, legendStartX + (isBar ? 20 : legendIconW + 6), legendY);
      legendStartX += (isBar ? 14 : legendIconW) + actualLabelW + 6 + legendGap;

      // 标准工时 — 蓝色虚线 + 细点
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(legendStartX, legendY);
      ctx.lineTo(legendStartX + legendIconW, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(legendStartX + legendIconW / 2, legendY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#374151';
      ctx.fillText(standardLabel, legendStartX + legendIconW + 6, legendY);

      // 标题 — 日期范围（居中带装饰线）
      const titleText = `${startDate} ~ ${endDate}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // 标题背景条
      ctx.fillStyle = 'rgba(31,41,55,0.04)';
      const titleBarW = 220;
      const titleBarH = 30;
      const titleBarX = chartWidth / 2 - titleBarW / 2;
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

      // 标题文字
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText(titleText, chartWidth / 2, titleBarY + 8);

    });
  },

  // 绘制折线图
  drawLineChart(ctx, chartData, plotLeft, plotTop, plotHeight, extraPadding, adjustedXStep, yScale, yAxisMin) {
    const plotBottom = plotTop + plotHeight;

    // 面积填充（增强可视深度）
    if (chartData.data.length > 1) {
      ctx.beginPath();
      const firstX = plotLeft + extraPadding;
      const firstY = plotBottom - (chartData.data[0] - yAxisMin) * yScale;
      ctx.moveTo(firstX, plotBottom);
      ctx.lineTo(firstX, firstY);
      for (let i = 1; i < chartData.data.length; i++) {
        const x = plotLeft + extraPadding + adjustedXStep * i;
        const y = plotBottom - (chartData.data[i] - yAxisMin) * yScale;
        ctx.lineTo(x, y);
      }
      const lastX = plotLeft + extraPadding + adjustedXStep * (chartData.data.length - 1);
      ctx.lineTo(lastX, plotBottom);
      ctx.closePath();
      const areaGradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
      areaGradient.addColorStop(0, 'rgba(52,211,153,0.15)');
      areaGradient.addColorStop(1, 'rgba(52,211,153,0.01)');
      ctx.fillStyle = areaGradient;
      ctx.fill();
    }

    // 标准工时线（蓝色虚线）
    if (chartData.standardData && chartData.standardData.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i < chartData.standardData.length; i++) {
        const x = plotLeft + extraPadding + (chartData.labels.length > 1
          ? adjustedXStep * i : 0);
        const y = plotBottom - (chartData.standardData[i] - yAxisMin) * yScale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 数据线（绿色实线 + 贝塞尔平滑）
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < chartData.data.length; i++) {
      const x = plotLeft + extraPadding + (chartData.labels.length > 1
        ? adjustedXStep * i : 0);
      const y = plotBottom - (chartData.data[i] - yAxisMin) * yScale;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = plotLeft + extraPadding + adjustedXStep * (i - 1);
        const prevY = plotBottom - (chartData.data[i - 1] - yAxisMin) * yScale;
        const cp1x = prevX + adjustedXStep * 0.35;
        const cp1y = prevY;
        const cp2x = x - adjustedXStep * 0.35;
        const cp2y = y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    }
    ctx.stroke();

    // 数据点和标签
    for (let i = 0; i < chartData.data.length; i++) {
      const x = plotLeft + extraPadding + (chartData.labels.length > 1
        ? adjustedXStep * i : 0);
      const y = plotBottom - (chartData.data[i] - yAxisMin) * yScale;

      // 外圈光环
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(52,211,153,0.2)';
      ctx.fill();

      // 数据点
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 数据标签
      if (chartData.data[i] > 0) {
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(chartData.data[i].toFixed(1), x, y - 10);
      }
    }
  },

  // 绘制柱状图
  drawBarChart(ctx, chartData, plotLeft, plotTop, plotHeight, extraPadding, adjustedXStep, yScale, yAxisMin) {
    const plotBottom = plotTop + plotHeight;

    // 标准工时线（蓝色虚线）
    if (chartData.standardData && chartData.standardData.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i < chartData.standardData.length; i++) {
        const x = plotLeft + extraPadding + (chartData.labels.length > 1
          ? adjustedXStep * i : 0);
        const y = plotBottom - (chartData.standardData[i] - yAxisMin) * yScale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 柱状图
    const barWidth = Math.min(36, adjustedXStep * 0.55);
    const halfBar = barWidth / 2;

    for (let i = 0; i < chartData.data.length; i++) {
      const centerX = plotLeft + extraPadding + (chartData.labels.length > 1
        ? adjustedXStep * i : 0);
      const value = chartData.data[i];
      const barHeight = (value - yAxisMin) * yScale;
      const x = centerX - halfBar;
      const y = plotBottom - barHeight;

      // 圆角矩形
      const radius = 5;
      const drawBar = () => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, plotBottom);
        ctx.lineTo(x, plotBottom);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };
      drawBar();

      // 渐变填充
      const gradient = ctx.createLinearGradient(x, y, x, plotBottom);
      gradient.addColorStop(0, '#34d399');
      gradient.addColorStop(0.7, '#6ee7b7');
      gradient.addColorStop(1, '#a7f3d0');
      ctx.fillStyle = gradient;
      ctx.fill();

      // 顶部高光线
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 数据标签
      if (value > 0) {
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(value.toFixed(1), centerX, y - 6);
      }
    }
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
      this.drawChart();
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

    // 计算月份跨度
    const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

    // 规则1：≤14天 → 日视图
    if (dayCount <= 14) {
      return 'day';
    }

    // 规则2：>15天且≤2个月 → 周视图
    if (dayCount > 14 && monthCount <= 2) {
      return 'week';
    }

    // 规则3：>2个月 → 月视图
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


