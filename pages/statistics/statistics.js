// pages/statistics/statistics.js
const { formatDate, getWeekday, formatDayDisplay, getWeekOfMonth: getWOM, getMondayOfWeek } = require('../../utils/dateUtils.js');
const { calculateHash } = require('../../utils/hashUtils.js');

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
    filteredSchedules: [], // 用于显示的班次明细列表
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
    hasTooManyRecords: false // 班次明细是否超过30条
  },

  /**
   * 跳转到使用说明页面
   */
  navigateToDocs(e) {
    const type = e.currentTarget.dataset.type || 'statistics';
    wx.navigateTo({
      url: `/pages/docs/docs?type=${type}`
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
    this.calculateStatistics();
    this.drawChart();
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
    wx.setStorageSync('customHours', customHours);
    
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
        // 使用缓存数据
        this.setData(this._cache.lastStatistics);
        this.drawChart();
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
      
      // 只在非年视图时生成详细的filteredSchedules，减少年视图的计算量
      let filteredSchedules = [];
      let hasTooManyRecords = false;
      if (chartTimeUnit !== 'month') {
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
            
            // 按班次类型统计工作班次和休息日
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
            
            // 添加到显示列表（限制30条）
            if (filteredSchedules.length < 30) {
              filteredSchedules.push({
                date: dateStr,
                day: this.formatDayDisplay(dateStr),
                weekday: this.getWeekday(dateStr),
                shiftType: shiftType,
                startTime: shiftData.startTime || '--:--'
              });
            } else {
              hasTooManyRecords = true;
            }
          } else {
            // 没有排班数据的日期也显示为休息
            if (filteredSchedules.length < 30) {
              filteredSchedules.push({
                date: dateStr,
                day: this.formatDayDisplay(dateStr),
                weekday: this.getWeekday(dateStr),
                shiftType: '休息日',
                startTime: '--:--'
              });
            } else {
              hasTooManyRecords = true;
            }
            offDays++;
          }
        }
      } else {
        // 年视图优化：只计算统计数据，不生成详细列表
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
            
            // 按班次类型统计工作班次和休息日
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
          } else {
            offDays++;
          }
        }
        // 年视图不需要显示详细的班次明细，清空列表以提高性能
        filteredSchedules = [];
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
      
      const newData = {
        shifts: shiftsInRange,
        filteredSchedules: filteredSchedules,
        hasTooManyRecords: hasTooManyRecords,
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
      
      // 更新缓存
      this._cache.lastShiftsHash = currentShiftsHash;
      this._cache.lastDateRange = currentDateRange;
      this._cache.lastStatistics = newData;
      
      this.setData(newData);
      
      // 绘制图表
      this.drawChart();
    } catch (e) {
      console.error('计算统计数据失败', e);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    }
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
    
    // 页面加载时默认选定本周
    this.selectThisWeek();
  },
  
  // 切换图表类型
  changeChartType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      chartType: type
    });
    // 保存用户选择的图表类型
    wx.setStorageSync('statisticsChartType', type);
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

  // 绘制图表（支持折线图和柱状图）
  drawChart() {
    const { startDate, endDate } = this.data;
    const chartTimeUnit = this.calculateOptimalChartUnit(startDate, endDate);
    const chartData = this.generateChartData();
    const windowInfo = wx.getWindowInfo();
    const windowWidth = windowInfo.windowWidth;
    const chartWidth = windowWidth - 60; // 减去左右边距
    const chartHeight = 220; // 增加高度以容纳图例
    const padding = 40;
    const topPadding = 55; // 增加顶部间距
    const contentWidth = chartWidth - padding * 2;
    const contentHeight = chartHeight - topPadding - padding - 20; // 减少以容纳图例

    // 使用新的Canvas 2D API
    const query = wx.createSelectorQuery();
    query.select('#lineCanvas').fields({
      node: true,
      size: true
    }).exec((res) => {
      if (!res || !res[0]) return;
      
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      
      // 设置画布尺寸
      const dpr = wx.getWindowInfo().pixelRatio;
      canvas.width = chartWidth * dpr;
      canvas.height = chartHeight * dpr;
      ctx.scale(dpr, dpr);
      
      // 清除画布
      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // 绘制网格
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      
      // 纵轴网格
      const yStep = contentHeight / 5;
      for (let i = 0; i <= 5; i++) {
        const y = topPadding + yStep * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(chartWidth - padding, y);
        ctx.stroke();
      }

      // 给图表添加额外的左右边距
      const extraPadding = 20;
      const adjustedContentWidth = contentWidth - 2 * extraPadding;
      const adjustedXStep = chartData.labels.length > 1 ? 
        adjustedContentWidth / (chartData.labels.length - 1) : adjustedContentWidth;
      
      // 横轴网格
      for (let i = 0; i < chartData.labels.length; i++) {
        const x = padding + extraPadding + (chartData.labels.length > 1 ? 
          adjustedXStep * i : adjustedContentWidth / 2);
        ctx.beginPath();
        ctx.moveTo(x, topPadding);
        ctx.lineTo(x, chartHeight - padding - 20);
        ctx.stroke();
      }

      const yRange = chartData.yAxisMax - chartData.yAxisMin;
      const yScale = contentHeight / yRange;
      
      // 绘制数据
      if (chartData.data.length > 0) {
        if (this.data.chartType === 'line') {
          this.drawLineChart(ctx, chartData, topPadding, padding, extraPadding, adjustedXStep, yStep, yRange, yScale, chartWidth, chartHeight);
        } else if (this.data.chartType === 'bar') {
          this.drawBarChart(ctx, chartData, topPadding, padding, extraPadding, adjustedXStep, yStep, yRange, yScale, chartWidth, chartHeight);
        }
      }

      // 绘制标签
      ctx.font = '12px Arial';
      
      // 纵轴标签
      ctx.textAlign = 'right';
      ctx.fillStyle = '#999';
      for (let i = 0; i <= 5; i++) {
        const y = topPadding + yStep * i;
        const value = chartData.yAxisMax - (chartData.yAxisMax - chartData.yAxisMin) / 5 * i;
        ctx.fillText(value.toFixed(0), padding - 8, y + 4);
      }

      // 纵轴标题（竖写）
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px Arial';
      const yAxisTitle = '小时';
      const lineHeight = 28;
      const titleY = (topPadding + (chartHeight - padding - 20)) / 2 - (yAxisTitle.length * lineHeight) / 2;
      
      for (let i = 0; i < yAxisTitle.length; i++) {
        ctx.fillText(yAxisTitle[i], 10, titleY + i * lineHeight);
      }

      // 横轴标签 - 使用实际标签
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      
      for (let i = 0; i < chartData.labels.length; i++) {
        const x = padding + extraPadding + (chartData.labels.length > 1 ? 
          adjustedXStep * i : adjustedContentWidth / 2);
        ctx.fillText(chartData.labels[i], x, chartHeight - padding - 12);
      }

      // 绘制图例（在横轴标题左侧，左对齐，往下放一点，再往左去一点）
      const legendY = chartHeight - padding + 22;
      const legendStartX = padding - 10;
      
      // 实际工时图例
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(legendStartX, legendY + 6, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.fillText('实际', legendStartX + 12, legendY + 6);
      
      // 标准工时图例
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(legendStartX + 60, legendY + 6, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#333';
      ctx.fillText('标准', legendStartX + 72, legendY + 6);

      // 横轴标题
      let xAxisUnit = '';
      if (chartTimeUnit === 'day') {
        xAxisUnit = '天   数';
      } else if (chartTimeUnit === 'week') {
        xAxisUnit = '周   数';
      } else if (chartTimeUnit === 'month') {
        xAxisUnit = '月   份';
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px Arial';
      ctx.fillText(xAxisUnit, chartWidth / 2, chartHeight - padding + 15);

      // 绘制标题（显示日期范围）
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#1f2937';
      const chartTitle = `${this.data.startDate} ~ ${this.data.endDate}`;
      ctx.fillText(chartTitle, chartWidth / 2, 8);
    });
  },
  
  // 绘制折线图
  drawLineChart(ctx, chartData, topPadding, padding, extraPadding, adjustedXStep, yStep, yRange, yScale, chartWidth, chartHeight) {
    // 绘制标准工时线（蓝色）
    if (chartData.standardData && chartData.standardData.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // 虚线
      ctx.beginPath();
      
      for (let i = 0; i < chartData.standardData.length; i++) {
        const x = padding + extraPadding + (chartData.labels.length > 1 ? 
          adjustedXStep * i : (chartWidth - 2 * padding - 2 * extraPadding) / 2);
        const y = chartHeight - padding - 20 - (chartData.standardData[i] - chartData.yAxisMin) * yScale;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]); // 恢复实线
    }

    // 绘制数据线条（绿色）
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    for (let i = 0; i < chartData.data.length; i++) {
      const x = padding + extraPadding + (chartData.labels.length > 1 ? 
        adjustedXStep * i : (chartWidth - 2 * padding - 2 * extraPadding) / 2);
      const y = chartHeight - padding - 20 - (chartData.data[i] - chartData.yAxisMin) * yScale;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding + extraPadding + (chartData.labels.length > 1 ? 
          adjustedXStep * (i - 1) : (chartWidth - 2 * padding - 2 * extraPadding) / 2);
        const prevY = chartHeight - padding - 20 - (chartData.data[i - 1] - chartData.yAxisMin) * yScale;
        const controlX1 = prevX + adjustedXStep * 0.3;
        const controlY1 = prevY;
        const controlX2 = x - adjustedXStep * 0.3;
        const controlY2 = y;
        ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, x, y);
      }
    }
    ctx.stroke();

    // 绘制数据点和数据标签
    ctx.fillStyle = '#34d399';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '11px Arial';
    
    for (let i = 0; i < chartData.data.length; i++) {
      const x = padding + extraPadding + (chartData.labels.length > 1 ? 
        adjustedXStep * i : (chartWidth - 2 * padding - 2 * extraPadding) / 2);
      const y = chartHeight - padding - 20 - (chartData.data[i] - chartData.yAxisMin) * yScale;
      
      // 绘制数据点
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // 绘制数据标签（只在有数据时显示）
      if (chartData.data[i] > 0) {
        ctx.fillStyle = '#666';
        ctx.fillText(chartData.data[i].toFixed(1), x, y - 10);
        ctx.fillStyle = '#34d399';
      }
    }
  },
  
  // 绘制柱状图
  drawBarChart(ctx, chartData, topPadding, padding, extraPadding, adjustedXStep, yStep, yRange, yScale, chartWidth, chartHeight) {
    // 绘制标准工时线（蓝色虚线，和折线图一样连续）
    if (chartData.standardData && chartData.standardData.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // 虚线
      ctx.beginPath();
      
      for (let i = 0; i < chartData.standardData.length; i++) {
        const x = padding + extraPadding + (chartData.labels.length > 1 ? 
          adjustedXStep * i : (chartWidth - 2 * padding - 2 * extraPadding) / 2);
        const y = chartHeight - padding - 20 - (chartData.standardData[i] - chartData.yAxisMin) * yScale;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]); // 恢复实线
    }

    // 绘制柱状图
    const adjustedContentWidth = chartWidth - 2 * padding - 2 * extraPadding;
    const barWidth = Math.min(40, adjustedXStep * 0.6); // 柱子宽度
    
    for (let i = 0; i < chartData.data.length; i++) {
      const x = padding + extraPadding + (chartData.labels.length > 1 ? 
        adjustedXStep * i : adjustedContentWidth / 2) - barWidth / 2;
      const value = chartData.data[i];
      const barHeight = (value - chartData.yAxisMin) * yScale;
      const y = chartHeight - padding - 20 - barHeight;
      
      // 绘制渐变背景
      const gradient = ctx.createLinearGradient(x, y, x, chartHeight - padding - 20);
      gradient.addColorStop(0, '#34d399');
      gradient.addColorStop(1, '#6ee7b7');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // 绘制柱子边框
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
      
      // 绘制数据标签
      if (value > 0) {
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '11px Arial';
        ctx.fillText(value.toFixed(1), x + barWidth / 2, y - 5);
      }
    }
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
    
    let newRange = [...weekPickerRange];
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
      this._cache = { lastShiftsHash: '', lastStatistics: null, lastDateRange: null };
      this.calculateStatistics();
    }
  },

  // 月选择器列变化事件
  onMonthPickerColumnChange(e) {
    const column = e.detail.column;
    const value = e.detail.value;
    const { periodData, monthPickerRange, monthPickerValue } = this.data;
    
    let newRange = [...monthPickerRange];
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
  },

});


