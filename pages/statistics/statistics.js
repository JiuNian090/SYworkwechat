// pages/statistics/statistics.js
Page({
  data: {
    startDate: '',
    endDate: '',
    totalHours: 0,
    standardHours: 0,
    hourDifference: 0,
    differenceText: '',
    customWeeklyHours: 35, // 自定义每周标准工时，默认35小时   dailyStandardHours: 5, // 每天标准工时，根据customWeeklyHours计算
    showModal: false, // 控制每周标准工时弹窗显示/隐藏
    tempCustomWeeklyHours: 35, // 临时存储用户输入的每周标准工时
    exportFileName: '',
    lastExportedFilePath: '', // 用于存储上次导出的文件路径
    shifts: [], // 用于存储排班数据
    selectedQuickBtn: 'thisWeek', // 用于跟踪当前选中的快速选择按钮
    showFileNameModal: false, // 控制文件名设置弹窗显示/隐藏
    tempFileName: '', // 临时存储用户输入的文件名
    defaultFileNameHint: '', // 默认文件名提示
    statistics: {
      totalDays: 0,
      workDays: 0,
      offDays: 0
    }
  },

  // 日期格式化函数
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取上周日期范围
  getLastWeekRange() {
    const now = new Date();
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
  getThisWeekRange() {
    const now = new Date();
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
  getNextWeekRange() {
    const now = new Date();
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
    const range = this.getLastWeekRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      selectedQuickBtn: 'lastWeek'
    });
    this.calculateStatistics();
  },

  selectThisWeek() {
    const range = this.getThisWeekRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      selectedQuickBtn: 'thisWeek'
    });
    this.calculateStatistics();
  },

  selectNextWeek() {
    const range = this.getNextWeekRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      selectedQuickBtn: 'nextWeek'
    });
    this.calculateStatistics();
  },

  selectThisMonth() {
    const range = this.getThisMonthRange();
    this.setData({
      startDate: range.startDate,
      endDate: range.endDate,
      selectedQuickBtn: 'thisMonth'
    });
    this.calculateStatistics();
  },

  // 开始日期变更事件
  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    });
    this.calculateStatistics();
  },

  // 结束日期变更事件
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    });
    this.calculateStatistics();
  },
  
  // 显示文件名设置弹窗
  showFileNameModal() {
    // 设置默认文件名提示：用户名+排班统计
    const username = wx.getStorageSync('username') || '未命名用户';
    const defaultFileNameHint = `${username}+排班统计`;
    
    this.setData({
      tempFileName: '',
      defaultFileNameHint: defaultFileNameHint,
      showFileNameModal: true
    });
  },

  // 隐藏文件名设置弹窗
  hideFileNameModal() {
    this.setData({
      showFileNameModal: false
    });
  },

  // 处理临时文件名输入
  onTempFileNameInput(e) {
    this.setData({
      tempFileName: e.detail.value
    });
  },

  // 确认导出
  confirmExport() {
    // 获取用户输入的文件名
    const customFileName = this.data.tempFileName;
    
    // 隐藏弹窗
    this.hideFileNameModal();
    
    // 调用导出数据方法
    this.exportToCSV(customFileName);
  },

  // 显示自定义每周标准工时弹窗
  showCustomHoursModal() {
    this.setData({
      tempCustomWeeklyHours: this.data.customWeeklyHours,
      showModal: true
    });
  },

  // 隐藏自定义每周标准工时弹窗
  hideCustomHoursModal() {
    this.setData({
      showModal: false
    });
  },

  // 临时存储用户输入的每周标准工时
  onTempCustomHoursChange(e) {
    const tempCustomWeeklyHours = e.detail.value;
    this.setData({
      tempCustomWeeklyHours: tempCustomWeeklyHours
    });
  },

  // 确认自定义每周标准工时设置
  confirmCustomHours() {
    const customWeeklyHours = parseFloat(this.data.tempCustomWeeklyHours) || 35;
    const dailyStandardHours = customWeeklyHours / 7;
    
    this.setData({
      customWeeklyHours: customWeeklyHours,
      dailyStandardHours: dailyStandardHours,
      showModal: false
    });
    
    // 保存到本地存储
    wx.setStorageSync('customWeeklyHours', customWeeklyHours);
    
    // 重新计算统计数据
    this.calculateStatistics();
  },

  // 计算统计数据
  calculateStatistics() {
    const { startDate, endDate, customWeeklyHours, dailyStandardHours } = this.data;

    if (!startDate || !endDate) return;

    try {
      const allShifts = wx.getStorageSync('shifts') || {};
      const shiftsInRange = [];
      let totalHours = 0;
      let workDays = 0;
      let offDays = 0;
      
      // 遍历日期范围内的所有排班
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 计算统计周期内的天数
      const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        if (allShifts[dateStr]) {
          const shift = {
            date: dateStr,
            ...allShifts[dateStr]
          };
          shiftsInRange.push(shift);
          totalHours += parseFloat(allShifts[dateStr].workHours) || 0;
          
          // 按班次类型统计工作班次和休息日
          // 工作班次：白天班、跨夜班
          // 休息日：休息日
          const shiftType = allShifts[dateStr].type;
          if (shiftType === '白天班' || shiftType === '跨夜班') {
            workDays++;
          } else if (shiftType === '休息日') {
            offDays++;
          }
        }
      }
      
      // 计算标准工时和工时差额
      let standardHours = 0;
      
      // 根据统计类型计算标准工时
      if (dayCount === 7) {
        // 整周统计（上周、本周、下周）：使用自定义每周标准工时
        standardHours = customWeeklyHours;
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
      
      this.setData({
        shifts: shiftsInRange,
        totalHours: totalHours.toFixed(1),
        standardHours: standardHours.toFixed(1),
        hourDifference: hourDifference.toFixed(1),
        differenceText: differenceText,
        statistics: {
          totalDays: shiftsInRange.length,
          workDays: workDays,
          offDays: offDays
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
  exportToCSV(customFileName) {
    const { startDate, endDate, shifts, totalHours, standardHours, hourDifference, statistics, customWeeklyHours } = this.data;

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
      csvContent += '"每周标准工时: ' + customWeeklyHours + ' 小时"\n\n';
      
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
      csvContent += '"统计区间","总工时","标准工时","工时差额","排班天数","工作班次","休息日"\n';
      csvContent += '"' + startDate + '至' + endDate + '","' + totalHours + '","' + standardHours + '","' + hourDifference + '","' + statistics.totalDays + '","' + statistics.workDays + '","' + statistics.offDays + '"\n';
      
      // 获取用户名
      const username = wx.getStorageSync('username') || '未命名用户';
      
      // 生成默认文件名：用户名+时间段
      const fileName = customFileName ? customFileName : `${username}_排班统计_${startDate}_至_${endDate}`;
      
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
    const savedCustomWeeklyHours = wx.getStorageSync('customWeeklyHours') || 35;
    const dailyStandardHours = savedCustomWeeklyHours / 7;
    
    this.setData({
      customWeeklyHours: savedCustomWeeklyHours,
      dailyStandardHours: dailyStandardHours
    });
    
    // 页面加载时默认选定本周
    this.selectThisWeek();
  },
  
  onShow() {
    // 页面显示时重新计算统计数据，确保数据同步
    this.calculateStatistics();
  },
  
  // 监听页面显示和隐藏的生命周期，确保在任何时候都能正确更新数据
  onHide() {
    // 页面隐藏前不需要特别处理
  },
  
  // 监听全局数据变化的方法，确保实时更新
  onPageScroll() {
    // 可以在滚动时选择性更新数据，但通常不需要
  },
  
  // 提供给其他页面调用的方法，用于主动刷新数据
  refreshStatistics() {
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