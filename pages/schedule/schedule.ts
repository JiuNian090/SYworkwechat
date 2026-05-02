// @ts-nocheck
'use strict';
const { lightenColor } = require('../../utils/color');
const { addImageToRelation, removeImageFromRelation, syncRelationWithLocal } = require('../../utils/imageRelation');
const { formatDate, formatMonthTitle, getWeekOfMonth, getMondayOfWeek, isCurrentWeek: isCurWeek, isCurrentMonth: isCurMonth } = require('../../utils/date');
const { calculateHash } = require('../../utils/encrypt');
const { store } = require('../../utils/store');

interface WeekDayData {
  date: string;
  day: number;
  month?: number;
  weekday: string;
  isToday: boolean;
  isCurrentMonth?: boolean;
  shift: Record<string, unknown> | null;
}

Page({
  formatDate,
  formatMonthTitle,
  getWeekOfMonth,
  getMondayOfWeek,

  data: {
    currentView: 'week' as string,
    currentDate: '',
    currentWeekTitle: '',
    currentMonthTitle: '',
    isCurrentWeek: false,
    isCurrentMonth: false,
    currentWeekShiftColor: '',
    currentMonthShiftColor: '',
    weekDates: [] as WeekDayData[],
    monthDates: [] as WeekDayData[][],
    shifts: {} as Record<string, unknown>,
    selectedDate: '',
    selectedShift: null as Record<string, unknown> | null,
    shiftTemplates: [] as unknown[],
    showShiftSelectorModal: false,
    selectedShiftIndex: -1,
    weekTotalHours: 0,
    weekDifference: 0,
    differenceType: '',
    differenceValue: '0.0',
    customWeeklyHours: 35,
    monthTotalHours: 0,
    monthDifference: 0,
    monthDifferenceType: '',
    monthDifferenceValue: '0.0',
    avatarType: 'text' as string,
    weekImages: [] as unknown[],
    showAddImageModal: false,
    selectedImagePath: '',
    imageName: null as string | null,
    avatarText: '用' as string,
    avatarEmoji: '' as string,
    showTagInputModal: false,
    currentTag: ''
  },

  onLoad(): void {
    const today = new Date();
    const isCurrentWeek = isCurWeek(today);
    const isCurrentMonth = isCurMonth(today);
    const customWeeklyHours = wx.getStorageSync('customWeeklyHours') || 35;
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    const username = wx.getStorageSync('username') || '';
    const avatarText = username ? (username as string).charAt(0).toUpperCase() : '用';

    this.setData({
      currentDate: this.formatDate(today),
      currentWeekTitle: this.formatWeekTitle(today),
      currentMonthTitle: this.formatMonthTitle(today),
      isCurrentWeek: isCurrentWeek,
      isCurrentMonth: isCurrentMonth,
      customWeeklyHours: customWeeklyHours,
      avatarType: avatarType,
      avatarEmoji: avatarEmoji,
      avatarText: avatarText
    });
    this.loadShiftTemplates();
    this.loadShifts();
    this.generateWeekDates();
    this.generateMonthDates();
    this.loadWeekImages();

    const schedulePage = this;
    this._storeUnsubRestore = store.subscribe('_lastDataRestore', function () {
      schedulePage.loadShiftTemplates();
      schedulePage.loadShifts();
      schedulePage.generateWeekDates();
      schedulePage.generateMonthDates();
      schedulePage.loadWeekImages();
    });
    this._storeUnsubAvatar = store.subscribe('avatarType', function () {
      const data: Record<string, unknown> = {};
      const storedEmoji = wx.getStorageSync('avatarEmoji') || '';
      const storedType = wx.getStorageSync('avatarType') || 'text';
      const storedUsername = wx.getStorageSync('username') || '';
      data.avatarType = storedType;
      data.avatarEmoji = storedEmoji;
      data.avatarText = storedUsername ? (storedUsername as string).charAt(0).toUpperCase() : '用';
      schedulePage.setData(data);
    });
  },

  onShow(): void {
    const customWeeklyHours = wx.getStorageSync('customWeeklyHours') || 35;
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    const username = wx.getStorageSync('username') || '';
    const avatarText = username ? (username as string).charAt(0).toUpperCase() : '用';

    const dataToUpdate: Record<string, unknown> = {};

    if (customWeeklyHours !== this.data.customWeeklyHours ||
        avatarType !== this.data.avatarType ||
        avatarEmoji !== this.data.avatarEmoji ||
        avatarText !== this.data.avatarText) {
      dataToUpdate.customWeeklyHours = customWeeklyHours;
      dataToUpdate.avatarType = avatarType;
      dataToUpdate.avatarEmoji = avatarEmoji;
      dataToUpdate.avatarText = avatarText;
    }

    const shifts = wx.getStorageSync('shifts') || {};
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];

    if (calculateHash(JSON.stringify(shifts)) !== calculateHash(JSON.stringify(this.data.shifts)) ||
        calculateHash(JSON.stringify(shiftTemplates)) !== calculateHash(JSON.stringify(this.data.shiftTemplates))) {
      dataToUpdate.shifts = shifts;
      dataToUpdate.shiftTemplates = shiftTemplates;
    }

    const currentDate = new Date(this.data.currentDate);
    const isCurrentMonth = isCurMonth(currentDate);
    if (isCurrentMonth !== this.data.isCurrentMonth) {
      dataToUpdate.isCurrentMonth = isCurrentMonth;
    }

    if (Object.keys(dataToUpdate).length > 0) {
      this.setData(dataToUpdate);
    }

    if (dataToUpdate.shifts || dataToUpdate.shiftTemplates) {
      this.generateWeekDates();
      this.generateMonthDates();
    }

    this.loadWeekImages();
  },

  loadShiftTemplates(): void {
    try {
      const templates = wx.getStorageSync('shiftTemplates') || [];
      this.setData({
        shiftTemplates: templates
      });
    } catch (e) {
      console.error('读取班次模板失败', e);
    }
  },

  onShiftTemplatesUpdate(templates: unknown[]): void {
    const dataToUpdate: Record<string, unknown> = { shiftTemplates: templates };

    const updatedShifts = { ...this.data.shifts as Record<string, unknown> };
    let shiftsChanged = false;

    for (const date in updatedShifts) {
      const shift = updatedShifts[date] as Record<string, unknown>;
      const matchingTemplate = (templates as Record<string, unknown>[]).find(template =>
        (template as Record<string, unknown>).name === shift.name &&
        (template as Record<string, unknown>).startTime === shift.startTime &&
        (template as Record<string, unknown>).endTime === shift.endTime
      );

      if (matchingTemplate && (matchingTemplate as Record<string, unknown>).color !== shift.color) {
        updatedShifts[date] = {
          ...shift,
          color: (matchingTemplate as Record<string, unknown>).color
        };
        shiftsChanged = true;
      }
    }

    if (shiftsChanged) {
      try {
        store.setState({ shifts: updatedShifts }, ['shifts']);
        dataToUpdate.shifts = updatedShifts;
      } catch (e) {
        console.error('更新排班数据失败', e);
      }
    }

    this.setData(dataToUpdate);
    this.generateWeekDates();
    this.generateMonthDates();
  },

  loadShifts(): void {
    try {
      const shifts = wx.getStorageSync('shifts') || {};
      this.setData({
        shifts: shifts
      });
    } catch (e) {
      console.error('读取排班数据失败', e);
    }
  },

  formatWeekTitle(date: Date): string {
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const month = date.getMonth();
    const weekNumber = this.getWeekOfMonth(date);
    return `${monthNames[month]} 第${weekNumber}周`;
  },

  getWeekShiftColor(weekDates: WeekDayData[]): string {
    const today = new Date();
    const todayStr = this.formatDate(today);

    for (let i = 0; i < weekDates.length; i++) {
      if (weekDates[i].date === todayStr && weekDates[i].shift) {
        return lightenColor(weekDates[i].shift!.color as string);
      }
    }

    for (let i = 0; i < weekDates.length; i++) {
      if (weekDates[i].shift) {
        return lightenColor(weekDates[i].shift!.color as string);
      }
    }

    return lightenColor('#07c160');
  },

  getMonthShiftColor(monthDates: WeekDayData[][]): string {
    const today = new Date();
    const todayStr = this.formatDate(today);

    for (let i = 0; i < monthDates.length; i++) {
      const week = monthDates[i];
      for (let j = 0; j < week.length; j++) {
        if (week[j].date === todayStr && week[j].shift) {
          return lightenColor(week[j].shift!.color as string);
        }
      }
    }

    for (let i = 0; i < monthDates.length; i++) {
      const week = monthDates[i];
      for (let j = 0; j < week.length; j++) {
        if (week[j].shift) {
          return lightenColor(week[j].shift!.color as string);
        }
      }
    }

    return lightenColor('#07c160');
  },

  getTagBackgroundColor(color: string): string {
    if (color && color.startsWith('#') && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return 'rgba(0, 0, 0, 0.12)';
      }

      const brightness = (r * 299 + g * 587 + b * 114) / 1000;

      if (brightness > 200) {
        return `rgba(${r - 40}, ${g - 40}, ${b - 40}, 0.25)`;
      } else if (brightness > 150) {
        return `rgba(${r}, ${g}, ${b}, 0.20)`;
      } else {
        return `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 0.30)`;
      }
    }
    return 'rgba(0, 0, 0, 0.12)';
  },

  generateWeekDates(): void {
    const currentDate = new Date(this.data.currentDate);
    const dayOfWeek = currentDate.getDay();
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const weekDates: WeekDayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = this.formatDate(date);
      const shift = (this.data.shifts as Record<string, unknown>)[dateStr] as Record<string, unknown> | null || null;
      let modifiedShift = shift;
      if (shift) {
        modifiedShift = {
          ...shift,
          lightColor: lightenColor(shift.color as string),
          tagBackgroundColor: this.getTagBackgroundColor(shift.color as string)
        };
      }
      weekDates.push({
        date: dateStr,
        day: date.getDate(),
        month: date.getMonth() + 1,
        weekday: ['一', '二', '三', '四', '五', '六', '日'][date.getDay() === 0 ? 6 : date.getDay() - 1],
        isToday: dateStr === this.formatDate(new Date()),
        shift: modifiedShift
      });
    }

    const weekShiftColor = this.getWeekShiftColor(weekDates);

    let weekTotalHours = 0;
    weekDates.forEach(day => {
      if (day.shift) {
        weekTotalHours += parseFloat(day.shift.workHours as string) || 0;
      }
    });

    const weekDifference = weekTotalHours - this.data.customWeeklyHours;
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

  generateMonthDates(): void {
    const currentDate = new Date(this.data.currentDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    const firstDayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

    const endDate = new Date(lastDay);
    const lastDayOfWeek = lastDay.getDay();
    endDate.setDate(lastDay.getDate() + (lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek));

    const monthDates: WeekDayData[][] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const week: WeekDayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(current);
        const dateStr = this.formatDate(date);
        const shift = (this.data.shifts as Record<string, unknown>)[dateStr] as Record<string, unknown> | null || null;
        let modifiedShift = shift;
        if (shift) {
          modifiedShift = {
            ...shift,
            lightColor: lightenColor(shift.color as string),
            tagBackgroundColor: this.getTagBackgroundColor(shift.color as string)
          };
        }
        week.push({
          date: dateStr,
          day: date.getDate(),
          isCurrentMonth: date.getMonth() === month,
          isToday: dateStr === this.formatDate(new Date()),
          shift: modifiedShift
        });
        current.setDate(current.getDate() + 1);
      }
      monthDates.push(week);
    }

    const monthShiftColor = this.getMonthShiftColor(monthDates);

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    let monthTotalHours = 0;
    monthDates.forEach(week => {
      week.forEach(day => {
        if (day.isCurrentMonth && day.shift) {
          monthTotalHours += parseFloat(day.shift.workHours as string) || 0;
        }
      });
    });

    const daysInMonth = lastDay.getDate();
    const weeksInMonth = daysInMonth / 7;
    const monthStandardHours = this.data.customWeeklyHours * weeksInMonth;

    const monthDifference = monthTotalHours - monthStandardHours;
    const monthDifferenceType = monthDifference >= 0 ? '超额' : '差额';
    const monthDifferenceValue = Math.abs(monthDifference).toFixed(1);

    this.setData({
      monthDates: monthDates,
      currentMonthShiftColor: monthShiftColor,
      isCurrentMonth: isCurrentMonth,
      monthTotalHours: monthTotalHours.toFixed(1),
      monthStandardHours: monthStandardHours,
      monthDifference: monthDifference,
      monthDifferenceType: monthDifferenceType,
      monthDifferenceValue: monthDifferenceValue
    });
  },

  switchView(e: WechatMiniprogram.TouchEvent): void {
    const view = (e.currentTarget.dataset as { view: string }).view;

    if (view === 'month') {
      const currentDate = new Date(this.data.currentDate);
      const isCurrentMonth = isCurMonth(currentDate);
      const monthDates = this.data.monthDates;
      if (monthDates && monthDates.length > 0) {
        const monthShiftColor = this.getMonthShiftColor(monthDates as WeekDayData[][]);
        this.setData({
          currentView: view,
          isCurrentMonth: isCurrentMonth,
          currentMonthShiftColor: monthShiftColor
        });
        return;
      }
    }
    this.setData({
      currentView: view
    });
  },

  prevWeek(): void {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setDate(currentDate.getDate() - 7);
    const isCurrentWeek = isCurWeek(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentWeekTitle: this.formatWeekTitle(currentDate),
      isCurrentWeek: isCurrentWeek
    });
    this.generateWeekDates();
    this.loadWeekImages();
  },

  nextWeek(): void {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    const isCurrentWeek = isCurWeek(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentWeekTitle: this.formatWeekTitle(currentDate),
      isCurrentWeek: isCurrentWeek
    });
    this.generateWeekDates();
    this.loadWeekImages();
  },

  prevMonth(): void {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setMonth(currentDate.getMonth() - 1);
    const isCurrentMonth = isCurMonth(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentMonthTitle: this.formatMonthTitle(currentDate),
      isCurrentMonth: isCurrentMonth
    });
    this.generateMonthDates();
  },

  nextMonth(): void {
    const currentDate = new Date(this.data.currentDate);
    currentDate.setMonth(currentDate.getMonth() + 1);
    const isCurrentMonth = isCurMonth(currentDate);
    this.setData({
      currentDate: this.formatDate(currentDate),
      currentMonthTitle: this.formatMonthTitle(currentDate),
      isCurrentMonth: isCurrentMonth
    });
    this.generateMonthDates();
  },

  goToToday(): void {
    const today = new Date();
    const isCurrentWeek = isCurWeek(today);
    const isCurrentMonth = isCurMonth(today);
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

  showShiftSelector(e: WechatMiniprogram.TouchEvent): void {
    try {
      const date = (e.currentTarget.dataset as { date: string }).date;
      const selectedShift = (this.data.shifts as Record<string, unknown>)[date] as Record<string, unknown> || null;

      this.loadShiftTemplates();

      const templates = this.data.shiftTemplates as Record<string, unknown>[];
      if (templates.length === 0) {
        wx.showToast({
          title: '暂无班次模板',
          icon: 'none'
        });
        return;
      }

      let selectedShiftIndex = -1;

      if (selectedShift) {
        const matchingIndex = templates.findIndex(template =>
          template.name === selectedShift.name &&
          template.startTime === selectedShift.startTime &&
          template.endTime === selectedShift.endTime
        );

        if (matchingIndex !== -1) {
          selectedShiftIndex = matchingIndex;
        }
      }

      this.setData({
        selectedDate: date,
        selectedShift: selectedShift,
        currentTag: (selectedShift && (selectedShift.tag as string)) ? (selectedShift.tag as string) : '',
        selectedShiftIndex: selectedShiftIndex,
        showShiftSelectorModal: true
      });
    } catch (error) {
      console.error('显示班次选择器失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  showTagInputModal(): void {
    this.setData({
      showTagInputModal: true
    });
  },

  hideTagInputModal(): void {
    this.setData({
      showTagInputModal: false
    });
  },

  onTagInput(e: WechatMiniprogram.Input): void {
    this.setData({
      currentTag: e.detail.value
    });
  },

  confirmTag(): void {
    this.setData({
      showTagInputModal: false
    });
  },

  hideShiftSelectorModal(): void {
    this.setData({
      showShiftSelectorModal: false
    });
  },

  onShiftSelectorConfirm(e: WechatMiniprogram.TouchEvent): void {
    try {
      const { index, template } = e.detail as { index: number; template: Record<string, unknown> };

      this.setData({
        showShiftSelectorModal: false
      });

      if (index === -1 || !template) {
        this.removeShift();
      } else {
        this.saveShift(template);
      }
    } catch (error) {
      console.error('确认选择班次失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
      this.setData({
        showShiftSelectorModal: false
      });
    }
  },

  saveShift(template: Record<string, unknown>): void {
    const { selectedDate, shifts, currentTag } = this.data as { selectedDate: string; shifts: Record<string, unknown>; currentTag: string };

    if (!template) {
      wx.showToast({
        title: '请选择有效的班次模板',
        icon: 'none'
      });
      return;
    }

    const shiftData = {
      ...template,
      name: (template.name as string) || '未命名班次',
      startTime: (template.startTime as string) || '00:00',
      endTime: (template.endTime as string) || '00:00',
      workHours: (template.workHours as number) || 0,
      type: (template.type as string) || '其他',
      color: (template.color as string) || '#07c160',
      tag: currentTag || ''
    };

    const newShifts = {
      ...shifts,
      [selectedDate]: shiftData
    };

    try {
      store.setState({ shifts: newShifts }, ['shifts']);
      this.setData({
        shifts: newShifts
      });

      this.generateWeekDates();
      this.generateMonthDates();

      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as Record<string, unknown>;
        if (page.route === 'pages/statistics/statistics') {
          if (typeof page.refreshStatistics === 'function') {
            page.refreshStatistics();
          } else if (typeof page.calculateStatistics === 'function') {
            (page.calculateStatistics as () => void)();
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

  onDeleteShiftClick(e: WechatMiniprogram.TouchEvent): void {
    const date = (e.currentTarget.dataset as { date: string }).date;
    const selectedShift = (this.data.shifts as Record<string, unknown>)[date] as Record<string, unknown> || null;

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

  stopPropagation(e: WechatMiniprogram.TouchEvent): void {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
  },

  confirmDeleteShift(): void {
    const date = this.data.selectedDate;

    if (!date) {
      wx.showToast({
        title: '未选择日期',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${date} 的排班吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.removeShift();
          this.setData({
            showShiftSelectorModal: false
          });
        }
      }
    });
  },

  onAddImageBtnTap(): void {
    const currentViewDate = new Date(this.data.currentDate);
    const year = currentViewDate.getFullYear();
    const month = String(currentViewDate.getMonth() + 1).padStart(2, '0');
    const week = this.getWeekOfMonth(currentViewDate);
    const baseImageName = `${year}-${month}-${week}`;

    let defaultImageName = baseImageName;
    let counter = 1;
    const { weekImages } = this.data as { weekImages: Record<string, unknown>[] };
    const imageNames = new Set(weekImages.map((image: Record<string, unknown>) => image.name));

    while (imageNames.has(defaultImageName)) {
      defaultImageName = `${baseImageName}(${counter})`;
      counter++;
    }

    this.setData({
      showAddImageModal: true,
      selectedImagePath: '',
      imageName: defaultImageName
    });
  },

  hideAddImageModal(): void {
    this.setData({
      showAddImageModal: false,
      selectedImagePath: '',
      imageName: null
    });
  },

  chooseImage(): void {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = (res.tempFiles as Array<{ tempFilePath: string }>)[0].tempFilePath;
        that.setData({
          selectedImagePath: tempFilePath
        });
      }
    });
  },

  onImageNameInput(e: WechatMiniprogram.Input): void {
    this.setData({
      imageName: e.detail.value
    });
  },

  addImage(): void {
    const { selectedImagePath, imageName, weekImages } = this.data as { selectedImagePath: string; imageName: string; weekImages: Record<string, unknown>[] };

    const imageId = Date.now().toString();

    let finalImageName = imageName;
    const currentViewDate = new Date(this.data.currentDate);
    const year = currentViewDate.getFullYear();
    const month = String(currentViewDate.getMonth() + 1).padStart(2, '0');
    const week = this.getWeekOfMonth(currentViewDate);
    const newNameFormat = `${year}-${month}-${week}`;

    if (!finalImageName) {
      finalImageName = newNameFormat;
    }

    let uniqueImageName = finalImageName;
    let counter = 1;
    const baseName = finalImageName.replace(/\(\d+\)$/, '').trim();
    const uniqueImageNames = new Set(weekImages.map((image: Record<string, unknown>) => image.name));

    while (uniqueImageNames.has(uniqueImageName)) {
      uniqueImageName = `${baseName}(${counter})`;
      counter++;
    }

    const newImage = {
      id: imageId,
      name: uniqueImageName,
      path: selectedImagePath,
      addedTime: new Date().toISOString(),
      hash: ''
    };

    const updatedImages = [...weekImages, newImage];
    this.setData({
      weekImages: updatedImages
    });

    const weekKey = this.getWeekKey();
    const storageKey = `week_images_${weekKey}`;
    wx.setStorageSync(storageKey, updatedImages);

    addImageToRelation(storageKey, newImage);

    this.hideAddImageModal();

    wx.showToast({
      title: '图片添加成功',
      icon: 'success'
    });
  },

  viewImage(e: WechatMiniprogram.TouchEvent): void {
    const index = (e.currentTarget.dataset as { index: number }).index;
    const { weekImages } = this.data as { weekImages: Array<{ path: string }> };
    const image = weekImages[index];

    wx.previewImage({
      urls: [image.path],
      current: image.path
    });
  },

  deleteImage(e: WechatMiniprogram.TouchEvent): void {
    const index = (e.currentTarget.dataset as { index: number }).index;
    const { weekImages } = this.data as { weekImages: Array<{ id?: string }> };
    const imageToDelete = weekImages[index];

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          const updatedImages = weekImages.filter((_, i) => i !== index);
          this.setData({
            weekImages: updatedImages
          });

          const weekKey = this.getWeekKey();
          const storageKey = `week_images_${weekKey}`;
          wx.setStorageSync(storageKey, updatedImages);

          if (imageToDelete && imageToDelete.id) {
            removeImageFromRelation(storageKey, imageToDelete.id);
          }

          wx.setStorageSync('imagesLastModified', Date.now());

          wx.showToast({
            title: '图片删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  getWeekKey(): string {
    const currentDate = new Date(this.data.currentDate);
    const dayOfWeek = currentDate.getDay();
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return startDate.toISOString().split('T')[0];
  },

  loadWeekImages(): void {
    const weekKey = this.getWeekKey();
    const storageKey = `week_images_${weekKey}`;
    const weekImages = wx.getStorageSync(storageKey) || [];

    let hasOldFormat = false;
    const updatedImages = weekImages.map((image: Record<string, unknown>) => {
      if (image.name && typeof image.name === 'string' && (image.name.includes('年') || image.name.includes('月') || image.name.includes('第') || image.name.includes('周'))) {
        hasOldFormat = true;
        try {
          const match = (image.name as string).match(/(\d{4}) 年 (\d{1,2}) 月第 (\d+) 周/);
          if (match) {
            const year = match[1];
            const month = String(match[2]).padStart(2, '0');
            const week = match[3];
            const newName = `${year}-${month}-${week}`;
            return {
              ...image,
              name: newName,
              updatedTime: new Date().toISOString()
            };
          }
        } catch (e) {
          console.error('解析旧格式图片名称失败', e);
        }
      }
      return image;
    });

    if (hasOldFormat) {
      wx.setStorageSync(storageKey, updatedImages);
    }

    syncRelationWithLocal(storageKey);

    this.setData({
      weekImages: updatedImages
    });
  },

  removeShift(): void {
    const date = this.data.selectedDate;
    const { shifts } = this.data as { shifts: Record<string, unknown> };

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

      this.generateWeekDates();
      this.generateMonthDates();

      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as Record<string, unknown>;
        if (page.route === 'pages/statistics/statistics') {
          if (typeof page.refreshStatistics === 'function') {
            page.refreshStatistics();
          } else if (typeof page.calculateStatistics === 'function') {
            (page.calculateStatistics as () => void)();
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

  onShareAppMessage(): WechatMiniprogram.Page.IShareAppMessageOption {
    return {
      title: 'SYwork排班管理系统 - 排班页面',
      path: '/pages/schedule/schedule'
    };
  },

  onShareTimeline(): WechatMiniprogram.Page.IShareTimelineOption {
    return {
      title: 'SYwork排班管理系统 - 排班页面',
      query: 'page=schedule'
    };
  }
});
