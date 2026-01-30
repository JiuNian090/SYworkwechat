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
    showActionMenu: false,
    selectedDate: '',
    selectedShift: null,
    shiftTemplates: [],
    weekTotalHours: 0, // 本周总工时
    weekDifference: 0, // 本周工时差额/超额
    differenceType: '', // 差额类型：超额或差额
    differenceValue: '0.0', // 差额值，显示为绝对值
    customWeeklyHours: 35, // 自定义每周标准工时，默认35小时
    monthTotalHours: 0, // 当月总工时
    monthDifference: 0, // 当月工时差额/超额
    monthDifferenceType: '', // 当月差额类型：超额或差额
    monthDifferenceValue: '0.0', // 当月差额值，显示为绝对值
    // 用户头像信息
    avatarType: 'text', // 头像类型：text 或 emoji
    // 图片管理相关数据
    weekImages: [],
    showAddImageModal: false,
    selectedImagePath: '',
    imageName: '',
    currentFolderName: '', // 当前文件夹名称
    avatarText: '用', // 头像文字
    avatarEmoji: '' // 头像表情
  },

  onLoad() {
    const today = new Date();
    const isCurrentWeek = this.isCurrentWeek(today);
    const isCurrentMonth = this.isCurrentMonth(today);
    // 读取自定义每周标准工时
    const customWeeklyHours = wx.getStorageSync('customWeeklyHours') || 35;
    // 读取用户头像信息
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    const username = wx.getStorageSync('username') || '';
    // 生成头像文字
    const avatarText = username ? username.charAt(0).toUpperCase() : '用';
    
    this.setData({
      currentDate: this.formatDate(today),
      currentWeekTitle: this.formatWeekTitle(today),
      currentMonthTitle: this.formatMonthTitle(today),
      isCurrentWeek: isCurrentWeek,
      isCurrentMonth: isCurrentMonth,
      customWeeklyHours: customWeeklyHours,
      // 设置用户头像信息
      avatarType: avatarType,
      avatarEmoji: avatarEmoji,
      avatarText: avatarText
    });
    this.loadShiftTemplates();
    this.loadShifts();
    this.generateWeekDates();
    this.generateMonthDates();
    this.loadWeekImages();
  },

  onShow() {
    // 页面显示时重新加载班次模板和排班数据，确保数据同步
    // 读取自定义每周标准工时
    const customWeeklyHours = wx.getStorageSync('customWeeklyHours') || 35;
    // 读取用户头像信息
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    const username = wx.getStorageSync('username') || '';
    // 生成头像文字
    const avatarText = username ? username.charAt(0).toUpperCase() : '用';
    
    this.setData({
      customWeeklyHours: customWeeklyHours,
      // 更新用户头像信息
      avatarType: avatarType,
      avatarEmoji: avatarEmoji,
      avatarText: avatarText
    });
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
    
    // 加载本周图片
    this.loadWeekImages();
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
    
    // 更新已有的排班数据，确保颜色与模板一致
    const updatedShifts = {...this.data.shifts};
    let shiftsChanged = false;
    
    // 遍历所有已有的排班数据
    for (const date in updatedShifts) {
      const shift = updatedShifts[date];
      // 查找匹配的模板（根据名称、开始时间和结束时间）
      const matchingTemplate = templates.find(template => 
        template.name === shift.name && 
        template.startTime === shift.startTime && 
        template.endTime === shift.endTime
      );
      
      // 如果找到了匹配的模板且颜色不同，则更新颜色
      if (matchingTemplate && matchingTemplate.color !== shift.color) {
        updatedShifts[date] = {
          ...shift,
          color: matchingTemplate.color
        };
        shiftsChanged = true;
      }
      // 如果没有找到匹配的模板，说明模板已被删除，但保留排班数据
      else if (!matchingTemplate) {
        // 保留排班数据，不做任何处理
        // 这样可以确保删除模板时不会影响已有的排班
      }
    }
    
    // 如果排班数据有变化，则更新存储和视图
    if (shiftsChanged) {
      try {
        wx.setStorageSync('shifts', updatedShifts);
        this.setData({
          shifts: updatedShifts
        });
      } catch (e) {
        console.error('更新排班数据失败', e);
      }
    }
    
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
    if (color && color.startsWith('#') && color.length === 7) {
      // 将十六进制转换为RGB
      let r = parseInt(color.slice(1, 3), 16);
      let g = parseInt(color.slice(3, 5), 16);
      let b = parseInt(color.slice(5, 7), 16);
      
      // 检查解析是否成功
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return color; // 如果解析失败，返回原值
      }
      
      // 将颜色值变得更浅（增加亮度，但不要超过240）
      r = Math.min(240, Math.floor((240 + r) / 2));
      g = Math.min(240, Math.floor((240 + g) / 2));
      b = Math.min(240, Math.floor((240 + b) / 2));
      
      // 转换回十六进制
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // 如果不是十六进制颜色值，直接返回原值
    return color || '#07c160'; // 如果颜色值为空，返回默认绿色
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
    
    // 计算本周总工时
    let weekTotalHours = 0;
    weekDates.forEach(day => {
      if (day.shift) {
        weekTotalHours += parseFloat(day.shift.workHours) || 0;
      }
    });
    
    // 计算本周工时差额/超额
    const weekDifference = weekTotalHours - this.data.customWeeklyHours;
    
    // 计算差额类型和显示值
    const differenceType = weekDifference >= 0 ? '超额' : '差额';
    const differenceValue = Math.abs(weekDifference).toFixed(1);
    
    this.setData({
      weekDates: weekDates,
      currentWeekShiftColor: weekShiftColor,
      weekTotalHours: weekTotalHours.toFixed(1),
      weekDifference: weekDifference,
      differenceType: differenceType,
      differenceValue: differenceValue
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
    
    // 计算当月总工时
    let monthTotalHours = 0;
    monthDates.forEach(week => {
      week.forEach(day => {
        if (day.isCurrentMonth && day.shift) {
          monthTotalHours += parseFloat(day.shift.workHours) || 0;
        }
      });
    });
    
    // 计算当月标准工时（每周标准工时 * 当月周数）
    // 计算当月天数
    const daysInMonth = lastDay.getDate();
    // 计算当月周数（按实际天数计算，每周7天）
    const weeksInMonth = daysInMonth / 7;
    // 当月标准工时 = 每周标准工时 * 当月周数
    const monthStandardHours = this.data.customWeeklyHours * weeksInMonth;
    
    // 计算当月工时差额/超额
    const monthDifference = monthTotalHours - monthStandardHours;
    
    // 计算差额类型和显示值
    const monthDifferenceType = monthDifference >= 0 ? '超额' : '差额';
    const monthDifferenceValue = Math.abs(monthDifference).toFixed(1);
    
    this.setData({
      monthDates: monthDates,
      currentMonthShiftColor: monthShiftColor,
      isCurrentMonth: isCurrentMonth,
      monthTotalHours: monthTotalHours.toFixed(1),
      monthDifference: monthDifference,
      monthDifferenceType: monthDifferenceType,
      monthDifferenceValue: monthDifferenceValue
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
    this.loadWeekImages();
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
    this.loadWeekImages();
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

  // 显示操作菜单（添加/删除排班）
  showActionMenu(e) {
    const date = e.currentTarget.dataset.date;
    const selectedShift = this.data.shifts[date] || null;

    this.setData({
      selectedDate: date,
      selectedShift: selectedShift,
      showActionMenu: true
    });
  },

  // 隐藏操作菜单
  hideActionMenu() {
    this.setData({
      showActionMenu: false
    });
  },

  // 点击"添加排班" - 直接调用系统ActionSheet
  onAddShiftClick() {
    // 隐藏操作菜单
    this.hideActionMenu();

    // 准备班次模板数据
    const templates = this.data.shiftTemplates;
    if (templates.length === 0) {
      wx.showToast({
        title: '暂无班次模板',
        icon: 'none'
      });
      return;
    }

    // 提取班次名称列表（仅显示名称）
    const templateNames = templates.map(t => t.name);

    // 直接使用系统ActionSheet选择班次
    wx.showActionSheet({
      itemList: templateNames,
      itemColor: '#333333',
      success: (res) => {
        const index = res.tapIndex;
        const selectedTemplate = templates[index];

        // 直接保存排班
        this.saveShift(selectedTemplate);
      },
      fail: (res) => {
        // 用户取消选择，不做处理
        console.log('用户取消选择班次');
      }
    });
  },

  // 保存排班（从ActionSheet选择后调用）
  saveShift(template) {
    const { selectedDate, shifts } = this.data;

    // 检查template是否存在
    if (!template) {
      wx.showToast({
        title: '请选择有效的班次模板',
        icon: 'none'
      });
      return;
    }

    // 确保班次数据包含所有必要字段，包括工时数
    const shiftData = {
      ...template,
      name: template.name || '未命名班次',
      startTime: template.startTime || '00:00',
      endTime: template.endTime || '00:00',
      workHours: template.workHours || 0,
      type: template.type || '其他',
      color: template.color || '#07c160'
    };

    const newShifts = {
      ...shifts,
      [selectedDate]: shiftData
    };

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

  // 长按日期 - 删除排班
  onDeleteShiftClick(e) {
    const date = e.currentTarget.dataset.date;
    const selectedShift = this.data.shifts[date] || null;

    // 检查是否有排班可删除
    if (!selectedShift) {
      wx.showToast({
        title: '当前日期暂无排班',
        icon: 'none'
      });
      return;
    }

    this.setData({
      selectedDate: date,
      selectedShift: selectedShift
    });

    // 显示确认弹窗
    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${date} 的排班吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.removeShift();
        }
      }
    });
  },

  stopPropagation(e) {
    // 阻止事件冒泡，防止点击弹窗内容时关闭弹窗
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
  },

  // 图片管理相关方法

  // 显示添加图片弹窗
  onAddImageBtnTap() {
    // 生成当周名称作为文件夹名称
    const currentDate = new Date(this.data.currentDate);
    const year = currentDate.getFullYear();
    const weekTitle = this.formatWeekTitle(currentDate);
    const folderName = `${year}年 ${weekTitle}`;

    this.setData({
      showAddImageModal: true,
      selectedImagePath: '',
      imageName: folderName,
      currentFolderName: folderName
    });
  },

  // 隐藏添加图片弹窗
  hideAddImageModal() {
    this.setData({
      showAddImageModal: false,
      selectedImagePath: '',
      imageName: '',
      currentFolderName: ''
    });
  },
  
  // 选择图片
  chooseImage() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        // 获取选中图片的临时路径
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.setData({
          selectedImagePath: tempFilePath
        });
      }
    });
  },
  
  // 处理图片名称输入
  onImageNameInput(e) {
    this.setData({
      imageName: e.detail.value
    });
  },
  
  // 添加图片
  addImage() {
    const { selectedImagePath, currentFolderName, weekImages } = this.data;

    // 生成唯一ID
    const imageId = Date.now().toString();

    // 构造图片对象 - 使用文件夹名称作为图片名称
    const newImage = {
      id: imageId,
      name: currentFolderName,
      path: selectedImagePath,
      addedTime: new Date().toISOString()
    };
    
    // 更新图片列表
    const updatedImages = [...weekImages, newImage];
    this.setData({
      weekImages: updatedImages
    });
    
    // 保存到本地存储（这里可以根据需要保存到合适的存储位置）
    // 由于用户要求图片放在本地，且不会被导出，我们可以保存到特定的存储键
    const weekKey = this.getWeekKey();
    wx.setStorageSync(`week_images_${weekKey}`, updatedImages);
    
    // 关闭弹窗
    this.hideAddImageModal();
    
    wx.showToast({
      title: '图片添加成功',
      icon: 'success'
    });
  },
  
  // 查看图片
  viewImage(e) {
    const index = e.currentTarget.dataset.index;
    const { weekImages } = this.data;
    const image = weekImages[index];
    
    // 使用微信的图片预览功能
    wx.previewImage({
      urls: [image.path],
      current: image.path
    });
  },
  
  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const { weekImages } = this.data;
    
    // 显示确认对话框
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          // 删除图片
          const updatedImages = weekImages.filter((_, i) => i !== index);
          this.setData({
            weekImages: updatedImages
          });
          
          // 更新本地存储
          const weekKey = this.getWeekKey();
          wx.setStorageSync(`week_images_${weekKey}`, updatedImages);
          
          wx.showToast({
            title: '图片删除成功',
            icon: 'success'
          });
        }
      }
    });
  },
  
  // 获取当前周的唯一标识（用于本地存储键）
  getWeekKey() {
    // 使用当前显示的周的起始日期作为唯一标识
    const currentDate = new Date(this.data.currentDate);
    const dayOfWeek = currentDate.getDay();
    const startDate = new Date(currentDate);
    // 周一作为每周第一天 (周一为1，周日为0)
    startDate.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return startDate.toISOString().split('T')[0];
  },
  
  // 加载本周图片
  loadWeekImages() {
    const weekKey = this.getWeekKey();
    const weekImages = wx.getStorageSync(`week_images_${weekKey}`) || [];
    this.setData({
      weekImages: weekImages
    });
  },


  removeShift() {
    const date = this.data.selectedDate;
    const { shifts } = this.data;
    
    if (!date) {
      wx.showToast({
        title: '未选择日期',
        icon: 'none'
      });
      return;
    }
    
    const newShifts = { ...shifts };
    delete newShifts[date];
    
    try {
      wx.setStorageSync('shifts', newShifts);
      this.setData({
        shifts: newShifts,
        selectedShift: null,
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