// pages/schedule/schedule.js
Page({
  data: {
    currentView: 'week', // week 或 month
    currentDate: '',
    currentWeekTitle: '',
    currentMonthTitle: '',
    isCurrentWeek: false, // 是否为当前周
    isCurrentMonth: false, // 是否为当前月
    currentWeekShiftColor: '', // 当前周标题的背景色
    currentMonthShiftColor: '', // 当前月标题的背景色
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
    const isCurrentWeek = this.isCurrentWeek(today);
    const isCurrentMonth = this.isCurrentMonth(today);
    this.setData({
      currentDate: this.formatDate(today),
      currentWeekTitle: this.formatWeekTitle(today),
      currentMonthTitle: this.formatMonthTitle(today),
      isCurrentWeek: isCurrentWeek,
      isCurrentMonth: isCurrentMonth
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
    // 确保在onShow中也正确初始化当前月份的判断
    const currentDate = new Date(this.data.currentDate);
    const isCurrentMonth = this.isCurrentMonth(currentDate);
    this.setData({
      isCurrentMonth: isCurrentMonth
    });
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

  // 当班次模板更新时调用此方法
  onShiftTemplatesUpdate(templates) {
    this.setData({
      shiftTemplates: templates
    });
    
    // 更新视图以反映模板变化
    this.generateWeekDates();
    this.generateMonthDates();
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

  // 格式化月份标题为"年 月"格式
  formatMonthTitle(date) {
    const year = date.getFullYear();
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const month = date.getMonth();
    return `${year}年 ${monthNames[month]}`;
  },

  // 计算某日期是当月的第几周
  getWeekOfMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    // 获取当月第一天
    const firstDayOfMonth = new Date(year, month, 1);
    // 获取当月第一天是星期几（0-6，0表示周日）
    const firstDayWeek = firstDayOfMonth.getDay();
    // 计算第一天所在周的周一日期
    const firstMonday = new Date(firstDayOfMonth);
    firstMonday.setDate(firstDayOfMonth.getDate() - ((firstDayWeek + 6) % 7));
    
    // 计算当前日期所在周的周一日期
    const currentDay = date.getDate();
    const currentWeekMonday = new Date(firstDayOfMonth);
    currentWeekMonday.setDate(firstDayOfMonth.getDate() + currentDay - 1 - ((date.getDay() + 6) % 7));
    
    // 计算当前周是当月的第几周
    const weekNumber = Math.ceil((currentWeekMonday - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    return weekNumber;
  },

  // 格式化周视图标题为"几月 第几周"
  formatWeekTitle(date) {
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const month = date.getMonth();
    const weekNumber = this.getWeekOfMonth(date);
    return `${monthNames[month]} 第${weekNumber}周`;
  },

  // 判断当前显示的周是否为本周
  isCurrentWeek(displayDate) {
    const today = new Date();
    const displayWeekMonday = this.getMondayOfWeek(displayDate);
    const currentWeekMonday = this.getMondayOfWeek(today);
    return displayWeekMonday.getTime() === currentWeekMonday.getTime();
  },

  // 判断是否为当前月份
  isCurrentMonth(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  },

  // 获取某日期所在周的周一日期
  getMondayOfWeek(date) {
    const day = date.getDay();
    const monday = new Date(date);
    // 计算周一日期（周一为每周第一天）
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    // 设置时间为00:00:00，避免时间差异影响比较
    monday.setHours(0, 0, 0, 0);
    return monday;
  },

  // 获取当前周的班次颜色（根据本周内班次颜色决定）
  getWeekShiftColor(weekDates) {
    // 如果是当前周，获取今天班次的颜色
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    // 查找今天是否有排班
    for (let i = 0; i < weekDates.length; i++) {
      if (weekDates[i].date === todayStr && weekDates[i].shift) {
        return this.lightenColor(weekDates[i].shift.color);
      }
    }
    
    // 如果今天没有排班，查找本周其他天的班次颜色
    for (let i = 0; i < weekDates.length; i++) {
      if (weekDates[i].shift) {
        return this.lightenColor(weekDates[i].shift.color);
      }
    }
    
    // 如果本周都没有排班，返回默认绿色（更浅一些）
    return this.lightenColor('#07c160');
  },

  // 获取当前月的班次颜色（根据本月内班次颜色决定）
  getMonthShiftColor(monthDates) {
    // 如果是当前月，获取今天班次的颜色
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    // 查找今天是否有排班
    for (let i = 0; i < monthDates.length; i++) {
      const week = monthDates[i];
      for (let j = 0; j < week.length; j++) {
        if (week[j].date === todayStr && week[j].shift) {
          return this.lightenColor(week[j].shift.color);
        }
      }
    }
    
    // 如果今天没有排班，查找本月其他天的班次颜色
    for (let i = 0; i < monthDates.length; i++) {
      const week = monthDates[i];
      for (let j = 0; j < week.length; j++) {
        if (week[j].shift) {
          return this.lightenColor(week[j].shift.color);
        }
      }
    }
    
    // 如果本月都没有排班，返回默认绿色（更浅一些）
    return this.lightenColor('#07c160');
  },

  // 颜色变浅函数
  lightenColor(color) {
    // 如果是十六进制颜色值
    if (color.startsWith('#')) {
      // 将十六进制转换为RGB
      let r = parseInt(color.slice(1, 3), 16);
      let g = parseInt(color.slice(3, 5), 16);
      let b = parseInt(color.slice(5, 7), 16);
      
      // 将颜色值变得更浅（增加亮度，但不要超过240）
      r = Math.min(240, Math.floor((240 + r) / 2));
      g = Math.min(240, Math.floor((240 + g) / 2));
      b = Math.min(240, Math.floor((240 + b) / 2));
      
      // 转换回十六进制
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // 如果不是十六进制颜色值，直接返回原值
    return color;
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
    
    // 获取当前周的班次颜色
    const weekShiftColor = this.getWeekShiftColor(weekDates);
    
    this.setData({
      weekDates: weekDates,
      currentWeekShiftColor: weekShiftColor
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
    
    // 获取当前月的班次颜色
    const monthShiftColor = this.getMonthShiftColor(monthDates);
    
    // 判断是否为当前月
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    this.setData({
      monthDates: monthDates,
      currentMonthShiftColor: monthShiftColor,
      isCurrentMonth: isCurrentMonth
    });
  },

  switchView(e) {
    const view = e.currentTarget.dataset.view;
    this.setData({
      currentView: view
    });
    
    // 当切换到月视图时，确保当前月份判断正确
    if (view === 'month') {
      const currentDate = new Date(this.data.currentDate);
      const isCurrentMonth = this.isCurrentMonth(currentDate);
      const monthDates = this.data.monthDates;
      if (monthDates && monthDates.length > 0) {
        const monthShiftColor = this.getMonthShiftColor(monthDates);
        this.setData({
          isCurrentMonth: isCurrentMonth,
          currentMonthShiftColor: monthShiftColor
        });
      }
    }
  },

  prevWeek() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setDate(currentDate.getDate() - 7);
    const isCurrentWeek = this.isCurrentWeek(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentWeekTitle: this.formatWeekTitle(currentDate),
      isCurrentWeek: isCurrentWeek
    });
    this.generateWeekDates();
  },

  nextWeek() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    const isCurrentWeek = this.isCurrentWeek(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentWeekTitle: this.formatWeekTitle(currentDate),
      isCurrentWeek: isCurrentWeek
    });
    this.generateWeekDates();
  },

  prevMonth() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setMonth(currentDate.getMonth() - 1);
    const isCurrentMonth = this.isCurrentMonth(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentMonthTitle: this.formatMonthTitle(currentDate),
      isCurrentMonth: isCurrentMonth
    });
    this.generateMonthDates();
  },

  nextMonth() {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setMonth(currentDate.getMonth() + 1);
    const isCurrentMonth = this.isCurrentMonth(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentMonthTitle: this.formatMonthTitle(currentDate),
      isCurrentMonth: isCurrentMonth
    });
    this.generateMonthDates();
  },

  // 添加回到今天的功能
  goToToday() {
    const today = new Date();
    const isCurrentWeek = this.isCurrentWeek(today);
    const isCurrentMonth = this.isCurrentMonth(today);
    this.setData({
      currentDate: this.formatDate(today),
      currentWeekTitle: this.formatWeekTitle(today),
      currentMonthTitle: this.formatMonthTitle(today),
      isCurrentWeek: isCurrentWeek,
      isCurrentMonth: isCurrentMonth
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

  // 好友分享功能
  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统 - 排班页面',
      path: '/pages/schedule/schedule'
    };
  },

  // 朋友圈分享功能
  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统 - 排班页面',
      query: 'page=schedule'
    };
  }
});