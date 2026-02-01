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
    }
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
      activeQuickBtn: 'thisMonth'
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
    const { startDate, endDate, customHours, dailyStandardHours } = this.data;

    if (!startDate || !endDate) return;

    try {
      const allShifts = wx.getStorageSync('shifts') || {};
      const shiftsInRange = [];
      const filteredSchedules = [];
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
    // 页面显示时重新计算统计数据，确保数据同步
    this.calculateStatistics();
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
  }
});
