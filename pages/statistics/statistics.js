// pages/statistics/statistics.js

Page({
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
    chartData: [], // 图表数据
    // 选择器相关
    showWeekSelector: false,
    showMonthSelector: false,
    showYearSelector: false,
    weekOptions: [],
    monthOptions: [],
    yearOptions: []
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

  // 日期格式化函数
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取星期几
  getWeekday(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  },

  // 格式化日期显示（MM-DD）
  formatDayDisplay(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[1]}-${parts[2]}`;
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
      activeQuickBtn: 'lastWeek'
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
      activeQuickBtn: 'thisWeek'
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
      activeQuickBtn: 'nextWeek'
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
      chartTimeUnit: 'week' // 选择本月时切换到周视图
    });
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
      activeQuickBtn: '' // 清除快捷按钮选中状态
    });
    this.calculateStatistics();
  },

  // 结束日期变更事件
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value,
      activeQuickBtn: '' // 清除快捷按钮选中状态
    });
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
    const { startDate, endDate, customHours, dailyStandardHours, chartTimeUnit } = this.data;

    if (!startDate || !endDate) return;

    try {
      const allShifts = wx.getStorageSync('shifts') || {};
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
            
            // 添加到显示列表
            filteredSchedules.push({
              date: dateStr,
              day: this.formatDayDisplay(dateStr),
              weekday: this.getWeekday(dateStr),
              shiftType: shiftType,
              startTime: shiftData.startTime || '--:--'
            });
          } else {
            // 没有排班数据的日期也显示为休息
            filteredSchedules.push({
              date: dateStr,
              day: this.formatDayDisplay(dateStr),
              weekday: this.getWeekday(dateStr),
              shiftType: '休息日',
              startTime: '--:--'
            });
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
        differenceText = `超额 ${hourDifference.toFixed(1)} 小时`;
      } else if (hourDifference < 0) {
        differenceText = `差额 ${hourDifference.toFixed(1)} 小时`;
      } else {
        differenceText = '工时正好';
      }
      
      // 生成进度文本
      const progressPercent = standardHours > 0 ? (totalHours / standardHours * 100).toFixed(1) : '0.0';
      const progressStatus = totalHours >= standardHours ? '已完成' : '进行中';
      const progressText = `${progressStatus} ${progressPercent}%`;
      
      this.setData({
        shifts: shiftsInRange,
        filteredSchedules: filteredSchedules,
        totalHours: totalHours.toFixed(1),
        standardHours: standardHours.toFixed(1),
        hourDifference: hourDifference.toFixed(1),
        differenceText: differenceText,
        progressText: progressText,
        statistics: {
          totalDays: dayCount,
          workDays: workDays,
          dayShifts: dayShifts,
          nightShifts: nightShifts,
          offDays: offDays,
          totalHours: totalHours.toFixed(1),
          hourDifference: hourDifference.toFixed(1)
        }
      });
      
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
    const { startDate, endDate, shifts, totalHours, standardHours, hourDifference, statistics, customHours } = this.data;

    wx.showLoading({
      title: '正在导出...'
    });

    try {
      // 创建CSV内容
      let csvContent = '';
      
      // 添加增强的标题效果
      csvContent += '"排班统计报表"\n';
      csvContent += '"=================="\n';
      csvContent += '"统计时间范围: ' + startDate + ' 至 ' + endDate + '"\n';
      csvContent += '"每周标准工时: ' + customHours + ' 小时"\n\n';
      
      // 添加表头
      csvContent += '"日期","班次名称","工时","班次类型","开始时间","结束时间"\n';
      
      // 添加排班数据
      shifts.forEach(shift => {
        // 转义包含逗号或引号的字段
        const escapeField = (field) => {
          if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          // 强制所有字段作为文本处理
          return `"${field}"`;
        };
        
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
      
      // 添加空行分隔和分割线
      csvContent += '\n';
      csvContent += '"----","--------","----","--------","--------","--------"\n';
      csvContent += '\n';
      
      // 添加总工时行（调整列位置）
      csvContent += '"总工时",,"' + totalHours + '",,,\n';
      
      // 添加空行分隔和分割线
      csvContent += '\n';
      csvContent += '"--------","----","--------","--------","--------"\n';
      csvContent += '\n';
      
      // 添加统计摘要
      csvContent += '"统计区间","总工时","标准工时","工时差额","白天班","跨夜班","休息日"\n';
      csvContent += '"' + startDate + '至' + endDate + '","' + totalHours + '","' + standardHours + '","' + hourDifference + '","' + statistics.dayShifts + '","' + statistics.nightShifts + '","' + statistics.offDays + '"\n';
      
      // 获取用户名
      const username = wx.getStorageSync('username') || '未命名用户';
      
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
    // 页面加载时读取本地存储的自定义每周标准工时
    const savedCustomHours = wx.getStorageSync('customHours') || 35;
    const dailyStandardHours = savedCustomHours / 7;
    
    this.setData({
      customHours: savedCustomHours,
      dailyStandardHours: dailyStandardHours
    });
    
    // 页面加载时默认选定本周
    this.selectThisWeek();
  },
  
  onShow() {
    // 页面显示时只在排班数据发生变化时重新计算统计数据
    const allShifts = wx.getStorageSync('shifts') || {};
    const currentShifts = this.data.shifts;
    
    // 检查排班数据是否发生变化
    const shiftsChanged = JSON.stringify(allShifts) !== JSON.stringify(currentShifts);
    
    if (shiftsChanged) {
      this.calculateStatistics();
    }
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

  // 切换周选择器显示/隐藏
  toggleWeekSelector() {
    this.generateWeekOptions();
    this.setData({
      showWeekSelector: !this.data.showWeekSelector,
      showMonthSelector: false,
      showYearSelector: false
    });
  },

  // 切换月选择器显示/隐藏
  toggleMonthSelector() {
    this.generateMonthOptions();
    this.setData({
      showWeekSelector: false,
      showMonthSelector: !this.data.showMonthSelector,
      showYearSelector: false
    });
  },

  // 切换年选择器显示/隐藏
  toggleYearSelector() {
    this.generateYearOptions();
    this.setData({
      showWeekSelector: false,
      showMonthSelector: false,
      showYearSelector: !this.data.showYearSelector
    });
  },

  // 关闭所有选择器
  closeSelectors() {
    this.setData({
      showWeekSelector: false,
      showMonthSelector: false,
      showYearSelector: false
    });
  },

  // 生成周选择器选项（过去7周）
  generateWeekOptions() {
    const options = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const referenceDate = new Date(now);
      referenceDate.setDate(now.getDate() - i * 7);
      const range = this.getThisWeekRange(referenceDate);
      options.push({
        label: `${range.startDate} ~ ${range.endDate}`,
        startDate: range.startDate,
        endDate: range.endDate
      });
    }
    
    this.setData({ weekOptions: options });
  },

  // 生成月选择器选项（本年12个月）
  generateMonthOptions() {
    const options = [];
    const now = new Date();
    const year = now.getFullYear();
    
    for (let month = 0; month < 12; month++) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      options.push({
        label: `${year}年${month + 1}月`,
        startDate: this.formatDate(start),
        endDate: this.formatDate(end)
      });
    }
    
    this.setData({ monthOptions: options });
  },

  // 生成年选择器选项（只显示有数据的年份）
  generateYearOptions() {
    const options = [];
    const allShifts = wx.getStorageSync('shifts') || {};
    const yearsWithData = new Set();
    
    // 收集所有有数据的年份
    Object.keys(allShifts).forEach(dateStr => {
      const year = dateStr.substring(0, 4);
      yearsWithData.add(year);
    });
    
    // 转换为数组并排序
    const yearsArray = Array.from(yearsWithData).sort((a, b) => b - a);
    
    // 生成选项
    yearsArray.forEach(year => {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      options.push({
        label: `${year}年`,
        startDate: this.formatDate(start),
        endDate: this.formatDate(end)
      });
    });
    
    // 如果没有数据，添加当前年份
    if (options.length === 0) {
      const year = new Date().getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      options.push({
        label: `${year}年`,
        startDate: this.formatDate(start),
        endDate: this.formatDate(end)
      });
    }
    
    this.setData({ yearOptions: options });
  },

  // 选择周
  selectWeek(e) {
    const index = e.currentTarget.dataset.index;
    const selectedWeek = this.data.weekOptions[index];
    
    this.setData({
      startDate: selectedWeek.startDate,
      endDate: selectedWeek.endDate,
      chartTimeUnit: 'day',
      activeQuickBtn: '',
      showWeekSelector: false
    });
    
    this.calculateStatistics();
  },

  // 选择月
  selectMonth(e) {
    const index = e.currentTarget.dataset.index;
    const selectedMonth = this.data.monthOptions[index];
    
    this.setData({
      startDate: selectedMonth.startDate,
      endDate: selectedMonth.endDate,
      chartTimeUnit: 'week',
      activeQuickBtn: '',
      showMonthSelector: false
    });
    
    this.calculateStatistics();
  },

  // 选择年
  selectYear(e) {
    const index = e.currentTarget.dataset.index;
    const selectedYear = this.data.yearOptions[index];
    
    this.setData({
      startDate: selectedYear.startDate,
      endDate: selectedYear.endDate,
      chartTimeUnit: 'month',
      activeQuickBtn: '',
      showYearSelector: false
    });
    
    this.calculateStatistics();
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
      activeQuickBtn: unit === 'day' ? 'thisWeek' : '' // 选择日视图时选中本周按钮
    });

    // 重新计算统计数据
    this.calculateStatistics();
  },

  // 生成图表数据
  generateChartData() {
    const { startDate, endDate, chartTimeUnit, shifts } = this.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const labels = [];
    const data = [];

    // 根据时间单位生成数据
    if (chartTimeUnit === 'day') {
      // 按天统计
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        const dayData = shifts.find(shift => shift.date === dateStr);
        const weekday = weekdays[d.getDay()];
        labels.push(weekday);
        data.push(parseFloat(dayData?.workHours) || 0);
      }
    } else if (chartTimeUnit === 'week') {
      // 按周统计
      let currentWeek = [];
      let weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // 调整到周一
      let weekCount = 0;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        const dayData = shifts.find(shift => shift.date === dateStr);
        currentWeek.push(parseFloat(dayData?.workHours) || 0);

        if (d.getDay() === 0 || d >= end) { // 周日或结束日期
          const weekTotal = currentWeek.reduce((sum, hours) => sum + hours, 0);
          // 计算周数：第一周、第二周...
          weekCount++;
          const weekLabel = `第${weekCount}周`;
          labels.push(weekLabel);
          data.push(weekTotal);
          currentWeek = [];
          weekStart.setDate(d.getDate() + 1);
        }
      }
    } else if (chartTimeUnit === 'month') {
      // 按月统计 - 优化版
      // 直接从shifts数组中计算，避免遍历所有日期
      const months = {};
      
      // 初始化12个月的数据
      for (let i = 1; i <= 12; i++) {
        const monthKey = `${start.getFullYear()}-${String(i).padStart(2, '0')}`;
        months[monthKey] = 0;
      }
      
      // 只遍历有数据的日期，而不是所有日期
      shifts.forEach(shift => {
        const monthKey = shift.date.substring(0, 7); // YYYY-MM
        if (months.hasOwnProperty(monthKey)) {
          months[monthKey] += parseFloat(shift.workHours) || 0;
        }
      });
      
      // 生成标签和数据
      Object.keys(months).forEach(month => {
        const monthNum = month.substring(5); // MM
        labels.push(`${monthNum}月`);
        data.push(months[month]);
      });
    }

    // 计算纵轴范围
    const maxValue = Math.max(...data, 0);
    const minValue = Math.min(...data, 0);
    const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 10;
    const yAxisMin = minValue < 0 ? Math.floor(minValue * 1.1) : 0;

    return {
      labels,
      data,
      yAxisMax,
      yAxisMin
    };
  },

  // 绘制图表
  drawChart() {
    const chartData = this.generateChartData();
    const windowInfo = wx.getWindowInfo();
    const windowWidth = windowInfo.windowWidth;
    const chartWidth = windowWidth - 60; // 减去左右边距
    const chartHeight = 200;
    const padding = 40;
    const contentWidth = chartWidth - padding * 2;
    const contentHeight = chartHeight - padding * 2;

    // 使用新的Canvas 2D API
    const query = wx.createSelectorQuery();
    query.select('#lineCanvas').fields({
      node: true,
      size: true
    }).exec((res) => {
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      
      // 设置画布尺寸
      const dpr = wx.getWindowInfo().pixelRatio;
      canvas.width = chartWidth * dpr;
      canvas.height = chartHeight * dpr;
      ctx.scale(dpr, dpr);
      
      // 清除画布
      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // 绘制网格 - 优化UI
      ctx.strokeStyle = '#f0f0f0'; // 更浅的网格颜色
      ctx.lineWidth = 1;
      
      // 纵轴网格
      const yStep = contentHeight / 5;
      for (let i = 0; i <= 5; i++) {
        const y = padding + yStep * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(chartWidth - padding, y);
        ctx.stroke();
      }

      // 横轴网格
      const xStep = contentWidth / (chartData.labels.length - 1 || 1);
      for (let i = 0; i < chartData.labels.length; i++) {
        const x = padding + xStep * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, chartHeight - padding);
        ctx.stroke();
      }

      // 绘制数据线条 - 优化UI
      if (chartData.data.length > 0) {
        ctx.strokeStyle = '#34d399'; // 绿色
        ctx.lineWidth = 3; // 稍微加粗线条
        ctx.lineCap = 'round'; // 线条端点圆润
        ctx.lineJoin = 'round'; // 线条连接处圆润
        ctx.beginPath();
        
        const yRange = chartData.yAxisMax - chartData.yAxisMin;
        const yScale = contentHeight / yRange;
        
        for (let i = 0; i < chartData.data.length; i++) {
          const x = padding + xStep * i;
          const y = chartHeight - padding - (chartData.data[i] - chartData.yAxisMin) * yScale;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            // 绘制平滑曲线
            const prevX = padding + xStep * (i - 1);
            const prevY = chartHeight - padding - (chartData.data[i - 1] - chartData.yAxisMin) * yScale;
            const controlX1 = prevX + xStep * 0.3;
            const controlY1 = prevY;
            const controlX2 = x - xStep * 0.3;
            const controlY2 = y;
            ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, x, y);
          }
        }
        ctx.stroke();

        // 绘制数据点 - 优化UI
        ctx.fillStyle = '#34d399'; // 与线条相同的颜色
        ctx.strokeStyle = '#FFFFFF'; // 白色边框
        ctx.lineWidth = 2; // 边框宽度
        for (let i = 0; i < chartData.data.length; i++) {
          const x = padding + xStep * i;
          const y = chartHeight - padding - (chartData.data[i] - chartData.yAxisMin) * yScale;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI); // 稍微增大点的大小
          ctx.fill();
          ctx.stroke();
        }
      }

      // 绘制标签 - 优化UI
      ctx.font = '12px Arial';
      
      // 纵轴标签 - 只显示数字，确保不超出边界
      ctx.textAlign = 'right';
      ctx.fillStyle = '#999'; // 更柔和的颜色
      for (let i = 0; i <= 5; i++) {
        const y = padding + yStep * i;
        const value = chartData.yAxisMax - (chartData.yAxisMax - chartData.yAxisMin) / 5 * i;
        ctx.fillText(value.toFixed(0), padding - 8, y + 4); // 调整位置，确保不超出左边界
      }

      // 纵轴单位 - 优化UI
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399'; // 使用与数据线条相同的颜色
      ctx.font = '14px Arial'; // 稍微增大字体
      ctx.fillText('小时', padding - 8, padding - 20); // 调整位置，确保不超出左边界

      // 横轴标签 - 只显示数字
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#999'; // 更柔和的颜色
      ctx.font = '12px Arial'; // 恢复默认字体
      
      for (let i = 0; i < chartData.labels.length; i++) {
        const x = padding + xStep * i;
        ctx.fillText((i + 1).toString(), x, chartHeight - padding + 8); // 调整位置
      }

      // 横轴单位 - 优化UI
      let xAxisUnit = '';
      if (this.data.chartTimeUnit === 'day') {
        xAxisUnit = '星期';
      } else if (this.data.chartTimeUnit === 'week') {
        xAxisUnit = '周数';
      } else if (this.data.chartTimeUnit === 'month') {
        xAxisUnit = '月';
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#34d399'; // 使用与数据线条相同的颜色
      ctx.font = '14px Arial'; // 稍微增大字体
      ctx.fillText(xAxisUnit, chartWidth - padding + 20, chartHeight - padding + 3); // 调整位置，往左边移动

      // 绘制标题 - 优化UI
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '16px Arial'; // 增大标题字体
      ctx.fillStyle = '#333';
      ctx.fillText('工时趋势', chartWidth / 2, 15); // 调整位置
    });
  },

  // 页面显示时更新图表
  onShow() {
    // 页面显示时只在排班数据发生变化时重新计算统计数据
    const allShifts = wx.getStorageSync('shifts') || {};
    const currentShifts = this.data.shifts;
    
    // 检查排班数据是否发生变化
    const shiftsChanged = JSON.stringify(allShifts) !== JSON.stringify(currentShifts);
    
    if (shiftsChanged) {
      this.calculateStatistics();
    }
    // 绘制图表
    this.drawChart();
  }
});
