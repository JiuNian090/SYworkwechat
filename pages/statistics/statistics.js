// pages/statistics/statistics.js
Page({
  data: {
    startDate: '',
    endDate: '',
    totalHours: 0,
    shifts: [],
    showExportTip: false
  },

  onLoad() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    
    const startDateStr = this.formatDate(startDate);
    const endDateStr = this.formatDate(today);
    
    this.setData({
      startDate: startDateStr,
      endDate: endDateStr
    });
    
    this.calculateStatistics();
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
    });
    this.calculateStatistics();
  },

  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    });
    this.calculateStatistics();
  },

  calculateStatistics() {
    const { startDate, endDate } = this.data;
    
    try {
      const allShifts = wx.getStorageSync('shifts') || {};
      const shifts = [];
      let totalHours = 0;
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.formatDate(d);
        if (allShifts[dateStr]) {
          shifts.push({
            date: dateStr,
            ...allShifts[dateStr]
          });
          totalHours += parseFloat(allShifts[dateStr].workHours) || 0;
        }
      }
      
      this.setData({
        shifts: shifts,
        totalHours: totalHours.toFixed(1)
      });
    } catch (e) {
      console.error('计算统计数据失败', e);
      wx.showToast({
        title: '统计失败',
        icon: 'none'
      });
    }
  },

  exportToExcel() {
    const { startDate, endDate, shifts, totalHours } = this.data;
    
    // 构造CSV格式数据
    let csvContent = '\uFEFF日期,班次名称,开始时间,结束时间,工时(小时),类型\n';
    
    shifts.forEach(shift => {
      csvContent += `${shift.date},${shift.name},${shift.startTime},${shift.endTime},${shift.workHours},${shift.type}\n`;
    });
    
    csvContent += `\n统计区间,${startDate} 至 ${endDate}\n`;
    csvContent += `总工时,${totalHours}小时\n`;
    
    // 将CSV内容保存到文件
    wx.downloadFile({
      url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent),
      success: (res) => {
        wx.saveFile({
          tempFilePath: res.tempFilePath,
          success: (saveRes) => {
            wx.showToast({
              title: '导出成功',
              icon: 'success'
            });
          },
          fail: () => {
            wx.showToast({
              title: '保存失败',
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