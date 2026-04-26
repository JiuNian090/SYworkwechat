'use strict';
// pages/plan/plan.js
const { calculateHash } = require('../../utils/hashUtils.js');
const { store } = require('../../utils/store.js');
Page({
  data: {
    shiftTemplates: [],
    showAddTemplate: false,
    showEditTemplate: false,
    editIndex: -1,
    hoursRange: Array.from({length: 25}, (_, i) => i), // 0-24小时
    minutesRange: Array.from({length: 13}, (_, i) => i * 5), // 0-60分钟，5分钟间隔
    newTemplate: {
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      hours: 8,
      minutes: 0,
      hoursIndex: 8,
      minutesIndex: 0,
      workHours: 8.0,
      type: '白天班',
      color: '#07c160'
    },
    editTemplate: {
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      hours: 8,
      minutes: 0,
      hoursIndex: 8,
      minutesIndex: 0,
      workHours: 8.0,
      typeIndex: 0,
      color: '#07c160'
    },
    shiftTypes: ['白天班', '跨夜班', '休息日'],
    presetColors: ['#07c160', '#faad14', '#1890ff', '#ff4d4f', '#722ed1', '#13c2c2'],
    colorNames: {
      '#07c160': '翠绿',
      '#faad14': '暖橙',
      '#1890ff': '湛蓝',
      '#ff4d4f': '嫣红',
      '#722ed1': '魅紫',
      '#13c2c2': '黛青'
    },
    customColor: '#34d399',
    editCustomColor: '#34d399',
    selectedColorType: 'preset',
    showColorPicker: false,
    colorPickerMode: 'add',
    pickerHue: 120,
    pickerSaturation: 100,
    pickerBrightness: 50,
    pickerColor: '#34d399',
    pickerHueColor: '#34d399'
  },

  onLoad() {
    this.loadShiftTemplates();
  },

  onShow() {
    // 页面显示时只在数据发生变化时重新加载班次模板
    const templates = store.getState('shiftTemplates') || [];
    if (calculateHash(JSON.stringify(templates)) !== calculateHash(JSON.stringify(this.data.shiftTemplates))) {
      this.setData({
        shiftTemplates: templates
      });
    }
  },

  loadShiftTemplates() {
    try {
      const templates = store.getState('shiftTemplates') || [];
      this.setData({
        shiftTemplates: templates
      });
    } catch (e) {
      console.error('读取班次模板失败', e);
    }
  },

  showAddTemplateModal() {
    const initialColor = '#07c160';
    const hsv = this.hexToHsv(initialColor);
    const hueColor = this.hsvToHex(hsv.h, 100, 100);
    this.setData({
      showAddTemplate: true,
      newTemplate: {
        name: '',
        startTime: '09:00',
        endTime: '17:00',
        hours: 8,
        minutes: 0,
        hoursIndex: 8,
        minutesIndex: 0,
        workHours: 8.0,
        typeIndex: 0,
        color: initialColor
      },
      selectedColorType: 'preset',
      customColor: '#34d399',
      showColorPicker: false,
      pickerHue: hsv.h,
      pickerSaturation: hsv.s,
      pickerBrightness: hsv.v,
      pickerColor: initialColor,
      pickerHueColor: hueColor
    });
  },

  hideAddTemplateModal() {
    this.setData({
      showAddTemplate: false
    });
  },

  onTemplateInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`newTemplate.${field}`]: value
    });
  },

  onEditTemplateInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`editTemplate.${field}`]: value
    });
  },

  onHoursChange(e) {
    const hoursIndex = e.detail.value;
    const hours = this.data.hoursRange[hoursIndex];
    const minutes = this.data.newTemplate.minutes || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'newTemplate.hoursIndex': hoursIndex,
      'newTemplate.hours': hours,
      'newTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onEditHoursChange(e) {
    const hoursIndex = e.detail.value;
    const hours = this.data.hoursRange[hoursIndex];
    const minutes = this.data.editTemplate.minutes || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'editTemplate.hoursIndex': hoursIndex,
      'editTemplate.hours': hours,
      'editTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onMinutesChange(e) {
    const minutesIndex = e.detail.value;
    const minutes = this.data.minutesRange[minutesIndex];
    const hours = this.data.newTemplate.hours || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'newTemplate.minutesIndex': minutesIndex,
      'newTemplate.minutes': minutes,
      'newTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onEditMinutesChange(e) {
    const minutesIndex = e.detail.value;
    const minutes = this.data.minutesRange[minutesIndex];
    const hours = this.data.editTemplate.hours || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'editTemplate.minutesIndex': minutesIndex,
      'editTemplate.minutes': minutes,
      'editTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },



  onTypeChange(e) {
    this.setData({
      'newTemplate.typeIndex': e.detail.value
    });
  },

  onEditTypeChange(e) {
    this.setData({
      'editTemplate.typeIndex': e.detail.value
    });
  },

  saveTemplate() {
    const { newTemplate, shiftTemplates } = this.data;

    if (!newTemplate.name) {
      wx.showToast({
        title: '请输入班次名称',
        icon: 'none'
      });
      return;
    }

    // 确保工时计算正确
    const workHours = (newTemplate.hours || 0) + ((newTemplate.minutes || 0) / 60);
    // 获取班次类型
    const type = this.data.shiftTypes[newTemplate.typeIndex] || '白天班';
    const templateToSave = {
      ...newTemplate,
      type: type,
      workHours: parseFloat(workHours.toFixed(2))
    };

    const templates = [...shiftTemplates, templateToSave];
    try {
      store.setState({ shiftTemplates: templates }, ['shiftTemplates']);
      this.setData({
        shiftTemplates: templates,
        showAddTemplate: false
      });

      // 通知排班页面模板已更新
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          if (pages[i].onShiftTemplatesUpdate) {
            pages[i].onShiftTemplatesUpdate(templates);
          }
          break;
        }
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } catch (e) {
      console.error('保存班次模板失败', e);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  saveTemplates() {
    try {
      store.setState({ shiftTemplates: this.data.shiftTemplates }, ['shiftTemplates']);
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 通知排班页面模板已更新
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          if (pages[i].onShiftTemplatesUpdate) {
            pages[i].onShiftTemplatesUpdate(this.data.shiftTemplates);
          }
          break;
        }
      }
    } catch (e) {
      console.error('保存班次模板失败', e);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  showEditTemplateModal(e) {
    const index = e.currentTarget.dataset.index;
    const tpl = this.data.shiftTemplates[index];

    // 确保模板包含hours和minutes字段
    const hours = tpl.hours || Math.floor(tpl.workHours || 0);
    const minutes = tpl.minutes || Math.round(((tpl.workHours || 0) - Math.floor(tpl.workHours || 0)) * 60);

    // 计算小时和分钟的索引
    const hoursIndex = hours;
    const minutesIndex = minutes / 5; // 因为分钟是5分钟间隔

    // 查找班次类型索引
    const typeIndex = this.data.shiftTypes.indexOf(tpl.type);

    // 判断当前颜色是否为预设颜色
    const isPreset = this.data.presetColors.indexOf(tpl.color) >= 0;
    const selectedColorType = isPreset ? 'preset' : 'custom';

    // 初始化颜色选择器状态
    const hsv = this.hexToHsv(tpl.color);
    const hueColor = this.hsvToHex(hsv.h, 100, 100);

    const templateWithTime = {
      ...tpl,
      hours: hours,
      minutes: minutes,
      hoursIndex: hoursIndex,
      minutesIndex: minutesIndex,
      typeIndex: typeIndex >= 0 ? typeIndex : 0
    };

    this.setData({
      showEditTemplate: true,
      editIndex: index,
      editTemplate: templateWithTime,
      selectedColorType: selectedColorType,
      editCustomColor: isPreset ? '#34d399' : tpl.color,
      showColorPicker: false,
      pickerHue: hsv.h,
      pickerSaturation: hsv.s,
      pickerBrightness: hsv.v,
      pickerColor: tpl.color,
      pickerHueColor: hueColor
    });
  },

  hideEditTemplateModal() {
    this.setData({ showEditTemplate: false, editIndex: -1 });
  },

  saveEditTemplate() {
    const { editTemplate, shiftTemplates, editIndex } = this.data;
    if (!editTemplate.name) {
      wx.showToast({ title: '请输入班次名称', icon: 'none' });
      return;
    }

    // 确保工时计算正确
    const workHours = (editTemplate.hours || 0) + ((editTemplate.minutes || 0) / 60);
    // 获取班次类型
    const type = this.data.shiftTypes[editTemplate.typeIndex] || '白天班';
    const templateToSave = {
      ...editTemplate,
      type: type,
      workHours: parseFloat(workHours.toFixed(2))
    };

    const templates = [...shiftTemplates];
    templates[editIndex] = templateToSave;
    try {
      store.setState({ shiftTemplates: templates }, ['shiftTemplates']);
      this.setData({
        shiftTemplates: templates,
        showEditTemplate: false,
        editIndex: -1
      });

      // 通知排班页面模板已更新
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          if (pages[i].onShiftTemplatesUpdate) {
            pages[i].onShiftTemplatesUpdate(templates);
          }
          break;
        }
      }

      wx.showToast({ title: '编辑成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '编辑失败', icon: 'none' });
    }
  },

  deleteTemplate(e) {
    const index = e.currentTarget.dataset.index;
    const templateToDelete = this.data.shiftTemplates[index];
    const templates = this.data.shiftTemplates.filter((_, i) => i !== index);

    try {
      store.setState({ shiftTemplates: templates }, ['shiftTemplates']);
      this.setData({
        shiftTemplates: templates
      });

      // 通知排班页面模板已更新
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          if (pages[i].onShiftTemplatesUpdate) {
            pages[i].onShiftTemplatesUpdate(templates);
          }
          break;
        }
      }

      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
    } catch (e) {
      console.error('删除班次模板失败', e);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },

  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统 - 计划页面',
      path: '/pages/plan/plan',
      imageUrl: '' // 可以设置自定义分享图片
    };
  },

  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统 - 计划页面',
      query: '',
      imageUrl: '' // 可以设置自定义分享图片
    };
  },

  // ============ 颜色圆圈选择器 ============

  /**
   * 选择预设颜色
   */
  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    const mode = e.currentTarget.dataset.mode || 'add';

    if (mode === 'edit') {
      this.setData({
        'editTemplate.color': color,
        selectedColorType: 'preset'
      });
    } else {
      this.setData({
        'newTemplate.color': color,
        selectedColorType: 'preset'
      });
    }
  },

  /**
   * 打开颜色调色器
   */
  openColorPicker(e) {
    const mode = e.currentTarget.dataset.mode || 'add';
    const currentColor = mode === 'edit' ? this.data.editTemplate.color : this.data.newTemplate.color;
    const hsv = this.hexToHsv(currentColor);
    const hueColor = this.hsvToHex(hsv.h, 100, 100);

    this.setData({
      showColorPicker: true,
      colorPickerMode: mode,
      pickerHue: hsv.h,
      pickerSaturation: hsv.s,
      pickerBrightness: hsv.v,
      pickerColor: currentColor,
      pickerHueColor: hueColor
    });

    this._cachePickerRects();
  },

  /**
   * 取消颜色选择
   */
  cancelColorPicker() {
    this.setData({ showColorPicker: false });
  },

  /**
   * 确认颜色选择
   */
  confirmColorPicker() {
    const color = this.data.pickerColor;
    const mode = this.data.colorPickerMode;

    if (mode === 'edit') {
      this.setData({
        'editTemplate.color': color,
        editCustomColor: color,
        selectedColorType: 'custom',
        showColorPicker: false
      });
    } else {
      this.setData({
        'newTemplate.color': color,
        customColor: color,
        selectedColorType: 'custom',
        showColorPicker: false
      });
    }
  },

  // ============ 颜色调色器交互 ============

  _cachePickerRects() {
    setTimeout(() => {
      try {
        const page = this;
        const query = wx.createSelectorQuery();
        query.select('.palette-area').boundingClientRect();
        query.select('.hue-slider').boundingClientRect();
        query.exec(function (res) {
          if (res[0]) page._paletteRect = res[0];
          if (res[1]) page._hueSliderRect = res[1];
        });
      } catch (e) {}
    }, 300);
  },

  onPaletteTouchStart(e) {
    this._updatePaletteColor(e);
  },

  onPaletteTouchMove(e) {
    if (this._paletteMoveTimer) return;
    this._paletteMoveTimer = setTimeout(() => {
      this._paletteMoveTimer = null;
      this._updatePaletteColor(e);
    }, 10);
  },

  onPaletteTouchEnd() {
    // 无需额外操作
  },

  _updatePaletteColor(e) {
    if (!this._paletteRect || !this._paletteRect.width) {
      this._cachePickerRects();
      return;
    }
    const touch = e.touches[0];
    const rect = this._paletteRect;
    const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, touch.clientY - rect.top));

    const saturation = Math.round((x / rect.width) * 100);
    const brightness = Math.round((1 - y / rect.height) * 100);
    const color = this.hsvToHex(this.data.pickerHue, saturation, brightness);

    this.setData({
      pickerSaturation: saturation,
      pickerBrightness: brightness,
      pickerColor: color
    });
  },

  onHueSliderTouchStart(e) {
    this._updateHueFromTouch(e);
  },

  onHueSliderTouchMove(e) {
    if (this._hueMoveTimer) return;
    this._hueMoveTimer = setTimeout(() => {
      this._hueMoveTimer = null;
      this._updateHueFromTouch(e);
    }, 10);
  },

  onHueSliderTouchEnd() {
    // 无需额外操作
  },

  _updateHueFromTouch(e) {
    if (!this._hueSliderRect || !this._hueSliderRect.width) return;
    const touch = e.touches[0];
    const rect = this._hueSliderRect;
    const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
    const hue = Math.round((x / rect.width) * 360);
    const hueColor = this.hsvToHex(hue, 100, 100);
    const color = this.hsvToHex(hue, this.data.pickerSaturation, this.data.pickerBrightness);

    this.setData({
      pickerHue: hue,
      pickerHueColor: hueColor,
      pickerColor: color
    });
  },

  // ============ 颜色转换工具 ============

  /**
   * HSV 转 HEX 颜色
   */
  hsvToHex(h, s, v) {
    h = h / 360;
    s = s / 100;
    v = v / 100;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }

    const toHex = (c) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  /**
   * HEX 转 HSV
   */
  hexToHsv(hex) {
    if (!hex || hex.length < 7) return { h: 0, s: 0, v: 0 };
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.substr(0, 2), 16) / 255;
    const g = parseInt(rgb.substr(2, 2), 16) / 255;
    const b = parseInt(rgb.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h = (h / 6) * 360;
    }

    return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
  },

  /**
   * 判断颜色是否为浅色
   */
  isLightColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  },

  stopPropagation() {
  }
});
