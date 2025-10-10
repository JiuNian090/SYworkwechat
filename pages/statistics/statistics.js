// pages/statistics/statistics.js
Page({
  data: {
    startDate: '',
    endDate: '',
    totalHours: 0,
    shifts: [],
    showExportTip: false,
    // 新增统计数据
    statistics: {
      totalDays: 0,
      workDays: 0,
      offDays: 0,
      overtimeHours: 0
    }
  },

  onLoad() {
    // 初始化日期范围为最近7天
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const startDate = this.formatDate(sevenDaysAgo);
    const endDate = this.formatDate(today);
    
    this.setData({
      startDate,
      endDate
    }, () => {
      this.calculateStatistics();
    });
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    }, () => {
      this.calculateStatistics();
    });
  },

  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    }, () => {
      this.calculateStatistics();
    });
  },

  calculateStatistics() {
    const { startDate, endDate } = this.data;
    
    if (!startDate || !endDate) return;
    
    try {
      const allShifts = wx.getStorageSync('shifts') || {};
      const shiftsInRange = [];
      let totalHours = 0;
      let workDays = 0;
      let offDays = 0;
      let overtimeHours = 0;
      
      // 遍历日期范围内的所有排班
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        if (allShifts[dateStr]) {
          const shift = {
            date: dateStr,
            ...allShifts[dateStr]
          };
          shiftsInRange.push(shift);
          totalHours += parseFloat(allShifts[dateStr].workHours) || 0;
          
          // 统计白天班、跨夜班和休息日
      if (allShifts[dateStr].type === '白天班' || allShifts[dateStr].type === '跨夜班') {
        workDays++;
      } else if (allShifts[dateStr].type === '休息日') {
        offDays++;
      }
          
          // 统计加班时间（假设超过8小时为加班）
          if (parseFloat(allShifts[dateStr].workHours) > 8) {
            overtimeHours += parseFloat(allShifts[dateStr].workHours) - 8;
          }
        }
      }
      
      this.setData({
        shifts: shiftsInRange,
        totalHours: totalHours.toFixed(1),
        statistics: {
          totalDays: shiftsInRange.length,
          workDays: workDays,
          offDays: offDays,
          overtimeHours: overtimeHours.toFixed(1)
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

  exportToExcel() {
    const { startDate, endDate, shifts, totalHours, statistics } = this.data;
    
    // 构造CSV数据
    let csvContent = '\uFEFF日期,班次名称,开始时间,结束时间,工时(小时),类型\n';
    shifts.forEach(shift => {
      csvContent += `${shift.date},${shift.name},${shift.startTime},${shift.endTime},${shift.workHours},${shift.type}\n`;
    });
    csvContent += `\n统计汇总\n`;
    csvContent += `统计区间,${startDate}至${endDate}\n`;
    csvContent += `总工时,${totalHours}小时\n`;
    csvContent += `排班天数,${statistics.totalDays}天\n`;
    csvContent += `工作班次,${statistics.workDays}天\n`;
    csvContent += `休息日,${statistics.offDays}天\n`;
    csvContent += `加班时间,${statistics.overtimeHours}小时\n`;
    
    // 创建并下载文件
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/排班统计_${startDate}_至_${endDate}.csv`;
    
    fs.writeFile({
      filePath: filePath,
      data: csvContent,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({
          filePath: filePath,
          success: () => {
            wx.showToast({
              title: '导出成功',
              icon: 'success'
            });
          },
          fail: () => {
            wx.showToast({
              title: '分享失败',
              icon: 'none'
            });
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
      }
    });
  }
});