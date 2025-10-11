// pages/schedule/schedule.js
Page({
  data: {
    currentView: 'week', // week 或 month
    currentDate: '',
    weekDates: [],
    monthDates: [],
    shifts: {},
    showShiftModal: false,
    selectedDate: '',
    selectedShift: null,
    shiftTemplates: [],
    pickerValue: [0]
  },

  onLoad() {
    const today = new Date();
    this.setData({
      currentDate: this.formatDate(today)
    });
    this.loadShiftTemplates();
    this.loadShifts();
    this.generateWeekDates();
    this.generateMonthDates();
  },

  onShow() {
    // 页面显示时重新加载班次模板和排班数据，确保数据同步
    this.loadShiftTemplates();
    this.loadShifts();
    this.generateWeekDates();
    this.generateMonthDates();
  },

  loadShiftTemplates() {
    try {
      const templates = wx.getStorageSync('shiftTemplates') || [];
      this.setData({
        shiftTemplates: templates
      });
    } catch (e) {
      console.error('读取班次模板失败', e);
    }
  },

  loadShifts() {
    try {
      const shifts = wx.getStorageSync('shifts') || {};
      this.setData({
        shifts: shifts
      });
    } catch (e) {
      console.error('读取排班数据失败', e);
    }
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  generateWeekDates() {
    const currentDate = new Date(this.data.currentDate);
    const dayOfWeek = currentDate.getDay(); // 0 is Sunday
    const startDate = new Date(currentDate);
    // 修改为周一作为每周第一天 (周一为1，周日为0)
    startDate.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = this.formatDate(date);
      // 修改星期几的显示顺序，从周一开始
      weekDates.push({
        date: dateStr,
        day: date.getDate(),
        month: date.getMonth() + 1, // 添加月份信息
        weekday: ['一', '二', '三', '四', '五', '六', '日'][date.getDay() === 0 ? 6 : date.getDay() - 1],
        isToday: dateStr === this.formatDate(new Date()),
        shift: this.data.shifts[dateStr] || null
      });
    }
    
    this.setData({
      weekDates: weekDates
    });
  },

  generateMonthDates() {
    const currentDate = new Date(this.data.currentDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    // 修改为周一作为每周第一天
    const firstDayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));
    
    const endDate = new Date(lastDay);
    // 修改为周一作为每周第一天
    const lastDayOfWeek = lastDay.getDay();
    endDate.setDate(lastDay.getDate() + (lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek));
    
    const monthDates = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(current);
        const dateStr = this.formatDate(date);
        week.push({
          date: dateStr,
          day: date.getDate(),
          isCurrentMonth: date.getMonth() === month,
          isToday: dateStr === this.formatDate(new Date()),
          shift: this.data.shifts[dateStr] || null
        });
        current.setDate(current.getDate() + 1);
      }
      monthDates.push(week);
    }
    
    this.setData({
      monthDates: monthDates
    });
  },

  switchView(e) {
    const view = e.currentTarget.dataset.view;
    this.setData({
      currentView: view
    });
  },

  prevWeek() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setDate(currentDate.getDate() - 7);
    this.setData({
      currentDate: this.formatDate(currentDate)
    });
    this.generateWeekDates();
  },

  nextWeek() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    this.setData({
      currentDate: this.formatDate(currentDate)
    });
    this.generateWeekDates();
  },

  prevMonth() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setMonth(currentDate.getMonth() - 1);
    this.setData({
      currentDate: this.formatDate(currentDate)
    });
    this.generateMonthDates();
  },

  nextMonth() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setMonth(currentDate.getMonth() + 1);
    this.setData({
      currentDate: this.formatDate(currentDate)
    });
    this.generateMonthDates();
  },

  // 添加回到今天的功能
  goToToday() {
    const today = new Date();
    this.setData({
      currentDate: this.formatDate(today)
    });
    this.generateWeekDates();
    this.generateMonthDates();
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    const selectedShift = this.data.shifts[date] || null;
    
    // 重置pickerValue为默认值或匹配当前排班的索引
    let pickerValue = [0];
    if (selectedShift && this.data.shiftTemplates.length > 0) {
      // 尝试找到当前排班对应的模板索引
      const matchingIndex = this.data.shiftTemplates.findIndex(template => 
        template.name === selectedShift.name && 
        template.startTime === selectedShift.startTime && 
        template.endTime === selectedShift.endTime
      );
      if (matchingIndex !== -1) {
        pickerValue = [matchingIndex];
      }
    }
    
    this.setData({
      selectedDate: date,
      selectedShift: selectedShift,
      pickerValue: pickerValue,
      showShiftModal: true
    });
  },

  hideShiftModal() {
    this.setData({
      showShiftModal: false
    });
  },

  bindPickerChange(e) {
    this.setData({
      pickerValue: e.detail.value
    });
  },

  assignShiftFromPicker() {
    const selectedIndex = this.data.pickerValue[0];
    const template = this.data.shiftTemplates[selectedIndex];
    const { selectedDate, shifts } = this.data;
    
    // 确保班次数据包含所有必要字段，包括工时数
    const shiftData = {
      ...template,
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      workHours: template.workHours || 0,
      type: template.type,
      color: template.color
    };
    
    const newShifts = {
      ...shifts,
      [selectedDate]: shiftData
    };
    
    try {
      wx.setStorageSync('shifts', newShifts);
      this.setData({
        shifts: newShifts,
        showShiftModal: false
      });
      
      // 更新视图
      this.generateWeekDates();
      this.generateMonthDates();
      
      // 通知统计页面更新数据
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/statistics/statistics') {
          // 使用专门的刷新方法，而不是直接调用计算方法
          if (pages[i].refreshStatistics) {
            pages[i].refreshStatistics();
          } else if (pages[i].calculateStatistics) {
            // 兼容旧版本
            pages[i].calculateStatistics();
          }
          break;
        }
      }
      
      wx.showToast({
        title: '排班成功',
        icon: 'success'
      });
    } catch (e) {
      console.error('保存排班失败', e);
      wx.showToast({
        title: '排班失败',
        icon: 'none'
      });
    }
  },



  removeShift(e) {
    const date = e.currentTarget.dataset.date;
    const { shifts } = this.data;
    
    const newShifts = { ...shifts };
    delete newShifts[date];
    
    try {
      wx.setStorageSync('shifts', newShifts);
      this.setData({
        shifts: newShifts
      });
      
      // 更新视图
      this.generateWeekDates();
      this.generateMonthDates();
      
      // 通知统计页面更新数据
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/statistics/statistics') {
          // 使用专门的刷新方法，而不是直接调用计算方法
          if (pages[i].refreshStatistics) {
            pages[i].refreshStatistics();
          } else if (pages[i].calculateStatistics) {
            // 兼容旧版本
            pages[i].calculateStatistics();
          }
          break;
        }
      }
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
    } catch (e) {
      console.error('删除排班失败', e);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },
  

});