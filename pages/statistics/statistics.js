// pages/statistics/statistics.js
Page({
  data: {
    startDate: '',
    endDate: '',
    totalHours: 0,
    exportFileName: '',
    shifts: [],
    showExportTip: false,
    // 新增统计数据
    statistics: {
      totalDays: 0,
      workDays: 0,
      offDays: 0
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

  onShow() {
    // 页面显示时重新计算统计数据，确保数据实时更新
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

  // 处理文件名输入
  onFileNameInput(e) {
    this.setData({
      exportFileName: e.detail.value
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
      
      this.setData({
        shifts: shiftsInRange,
        totalHours: totalHours.toFixed(1),
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

  exportToExcel() {
    const { startDate, endDate, shifts, totalHours, statistics, exportFileName } = this.data;
    
    wx.showLoading({
      title: '正在导出...'
    });
    
    try {
      // 引入xlsx库
      const XLSX = require('xlsx');
      
      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      
      // 创建工作表数据
      const worksheetData = [
        ['排班统计'],
        [],
        ['统计区间', '总工时', '排班天数', '工作班次', '休息日'],
        [`${startDate}至${endDate}`, totalHours, statistics.totalDays, statistics.workDays, statistics.offDays],
        [],
        ['日期', '班次名称', '工时', '班次类型', '开始时间', '结束时间']
      ];
      
      // 添加排班数据
      shifts.forEach(shift => {
        worksheetData.push([
          shift.date,
          shift.name,
          shift.workHours,
          shift.type,
          shift.startTime,
          shift.endTime
        ]);
      });
      
      // 添加空行和总工时
      worksheetData.push([]);
      worksheetData.push(['', '', totalHours, '', '', '']);
      
      // 创建工作表
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // 设置单元格样式居中
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddress]) continue;
          
          // 设置单元格居中对齐
          if (!worksheet[cellAddress].s) {
            worksheet[cellAddress].s = {};
          }
          worksheet[cellAddress].s = {
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            }
          };
        }
      }
      
      // 设置列宽
      worksheet['!cols'] = [
        { wch: 12 }, // 日期
        { wch: 15 }, // 班次名称
        { wch: 10 }, // 工时
        { wch: 12 }, // 班次类型
        { wch: 12 }, // 开始时间
        { wch: 12 }  // 结束时间
      ];
      
      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, '排班统计');
      
      // 获取自定义文件名
      const customFileName = exportFileName;
      const fileName = customFileName ? customFileName : `排班统计_${startDate}_至_${endDate}`;
      
      // 生成Excel文件
      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array'
      });
      
      // 创建临时文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.xlsx`;
      
      fs.writeFile({
        filePath: filePath,
        data: excelBuffer,
        success: () => {
          // 分享文件
          wx.shareFileMessage({
            filePath: filePath,
            fileName: `${fileName}.xlsx`,
            success: () => {
              wx.hideLoading();
              wx.showToast({
                title: '导出成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('分享文件失败', err);
              wx.showToast({
                title: '导出失败',
                icon: 'none'
              });
            }
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
  }
});