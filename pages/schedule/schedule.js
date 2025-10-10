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
    shiftTemplates: []
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
    startDate.setDate(currentDate.getDate() - dayOfWeek);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = this.formatDate(date);
      weekDates.push({
        date: dateStr,
        day: date.getDate(),
        weekday: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
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
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    
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
    this.setData({
      selectedDate: date,
      selectedShift: this.data.shifts[date] || null,
      showShiftModal: true
    });
  },

  hideShiftModal() {
    this.setData({
      showShiftModal: false
    });
  },

  assignShift(e) {
    const templateIndex = e.currentTarget.dataset.index;
    const template = this.data.shiftTemplates[templateIndex];
    const { selectedDate, shifts } = this.data;
    
    const newShifts = {
      ...shifts,
      [selectedDate]: template
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
          pages[i].calculateStatistics();
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
          pages[i].calculateStatistics();
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
  
  // 批量排班功能
  batchAssignShift() {
    wx.showModal({
      title: '提示',
      content: '该功能将在后续版本中实现',
      showCancel: false
    });
  }
});