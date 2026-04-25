// pages/plan/plan.js
const { calculateHash } = require('../../utils/hashUtils.js');
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
    colorList: ['#07c160', '#faad14', '#1890ff', '#ff4d4f', '#13c2c2', '#722ed1'],
    colorNames: {
      '#07c160': '绿色',
      '#faad14': '橙色',
      '#1890ff': '蓝色',
      '#ff4d4f': '红色',
      '#13c2c2': '青色',
      '#722ed1': '紫色'
    },
    colorOptions: [
      { value: '#07c160', name: '绿色' },
      { value: '#faad14', name: '橙色' },
      { value: '#1890ff', name: '蓝色' },
      { value: '#ff4d4f', name: '红色' },
      { value: '#13c2c2', name: '青色' },
      { value: '#722ed1', name: '紫色' }
    ],
    colorBarPosition: 50, // 添加颜色条位置（百分比）
    editColorBarPosition: 50, // 编辑颜色条位置（百分比）
    hue: 120,
    presetColors: ['#07c160', '#faad14', '#1890ff', '#ff4d4f', '#13c2c2', '#722ed1', '#000000', '#ffffff']
  },

  onLoad() {
    this.loadShiftTemplates();
  },

  onShow() {
    // 页面显示时只在数据发生变化时重新加载班次模板
    const templates = wx.getStorageSync('shiftTemplates') || [];
    if (calculateHash(JSON.stringify(templates)) !== calculateHash(JSON.stringify(this.data.shiftTemplates))) {
      this.setData({
        shiftTemplates: templates
      });
    }
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

  showAddTemplateModal() {
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
        color: '#07c160'
      }
    });
    this._cacheColorBarRect();
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



  onColorChange(e) {
    const selectedColor = this.data.colorOptions[e.detail.value];
    this.setData({ 'newTemplate.color': selectedColor.value });
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
      wx.setStorageSync('shiftTemplates', templates);
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
      wx.setStorageSync('shiftTemplates', this.data.shiftTemplates);
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
    
    // 计算颜色在颜色条上的位置
    const editColorBarPosition = this.getColorBarPositionFromColor(tpl.color);
    
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
      editColorBarPosition: editColorBarPosition
    });
    this._cacheColorBarRect();
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
      wx.setStorageSync('shiftTemplates', templates);
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
      wx.setStorageSync('shiftTemplates', templates);
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

  // 自定义颜色选择器相关方法
  /**
   * HSL转RGB颜色值
   * @param {number} h 色相 (0-360)
   * @param {number} s 饱和度 (0-100)
   * @param {number} l 亮度 (0-100)
   * @returns {string} RGB颜色字符串
   */
  hslToRgb(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // 灰色
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (c) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  /**
   * 判断颜色是否为浅色
   * @param {string} hexColor 十六进制颜色值
   * @returns {boolean} 是否为浅色
   */
  isLightColor(hexColor) {
    // 移除 # 符号
    const hex = hexColor.replace('#', '');
    
    // 解析RGB值
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 使用亮度公式计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128;
  },

  /**
   * 处理色相变化事件
   * @param {Object} e 事件对象
   */
  onHueChange(e) {
    const hue = e.detail.value;
    const color = this.hslToRgb(hue, 100, 50);
    
    this.setData({
      hue: hue,
      'newTemplate.color': color
    });
  },

  /**
   * 选择预设颜色
   * @param {Object} e 事件对象
   */
  selectPresetColor(e) {
    const color = e.currentTarget.dataset.color;
    
    // 如果选择的是白色或黑色，使用默认色相值
    let hue = this.data.hue;
    if (color === '#ffffff' || color === '#000000') {
      hue = color === '#ffffff' ? 0 : 0;
    } else {
      // 对于其他颜色，计算近似的色相值
      // 这里简化处理，实际应用中可能需要更精确的转换算法
      const colorMap = {
        '#07c160': 120,   // 绿色
        '#faad14': 39,    // 橙色
        '#1890ff': 210,   // 蓝色
        '#ff4d4f': 0,     // 红色
        '#13c2c2': 180,   // 青色
        '#722ed1': 270    // 紫色
      };
      hue = colorMap[color] || this.data.hue;
    }
    
    this.setData({
      hue: hue,
      'newTemplate.color': color
    });
  },

  // 颜色条选择功能相关方法
  getColorFromPosition(position) {
    // 定义颜色条的渐变色标（与wxml中的渐变保持一致）
    const colorStops = [
      { position: 0, color: [255, 0, 0] },      // #ff0000 红色
      { position: 17, color: [255, 255, 0] },   // #ffff00 黄色
      { position: 33, color: [0, 204, 0] },     // #00cc00 深绿色（修改后的绿色）
      { position: 50, color: [0, 204, 204] },   // #00cccc 深青色（修改后的天蓝色）
      { position: 67, color: [0, 0, 255] },     // #0000ff 蓝色
      { position: 83, color: [255, 0, 255] },   // #ff00ff 紫色
      { position: 100, color: [255, 0, 0] }     // #ff0000 红色（回到红色）
    ];
    
    // 确保位置在0-100范围内
    position = Math.max(0, Math.min(100, position));
    
    // 找到相邻的两个色标
    let leftStop = colorStops[0];
    let rightStop = colorStops[colorStops.length - 1];
    
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (position >= colorStops[i].position && position <= colorStops[i + 1].position) {
        leftStop = colorStops[i];
        rightStop = colorStops[i + 1];
        break;
      }
    }
    
    // 计算插值比例
    const range = rightStop.position - leftStop.position;
    const ratio = range === 0 ? 0 : (position - leftStop.position) / range;
    
    // 在两个色标之间进行线性插值
    const r = Math.round(leftStop.color[0] + (rightStop.color[0] - leftStop.color[0]) * ratio);
    const g = Math.round(leftStop.color[1] + (rightStop.color[1] - leftStop.color[1]) * ratio);
    const b = Math.round(leftStop.color[2] + (rightStop.color[2] - leftStop.color[2]) * ratio);
    
    // 转换为十六进制颜色值
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },

  /**
   * 根据颜色值计算在颜色条上的位置
   * @param {string} color 十六进制颜色值
   * @returns {number} 位置百分比 (0-100)
   */
  getColorBarPositionFromColor(color) {
    // 如果颜色不在预设颜色中，计算其在颜色条上的位置
    if (!color || !color.startsWith('#') || color.length !== 7) {
      return 50; // 默认位置
    }
    
    // 尝试匹配预设颜色
    const presetColors = this.data.presetColors;
    const index = presetColors.indexOf(color);
    if (index >= 0) {
      // 如果是预设颜色，均匀分布在颜色条上
      return (index / (presetColors.length - 1)) * 100;
    }
    
    // 对于自定义颜色，尝试计算其色相值
    try {
      // 移除 # 符号
      const hex = color.replace('#', '');
      
      // 解析RGB值
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      // 转换为HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h;
      
      if (max === min) {
        h = 0; // 灰色
      } else {
        const d = max - min;
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      
      // 转换为位置百分比
      return h * 100;
    } catch (e) {
      console.error('计算颜色位置失败', e);
      return 50; // 默认位置
    }
  },

  _cacheColorBarRect() {
    setTimeout(() => {
      try {
        const page = this;
        const query = wx.createSelectorQuery();
        query.select('.color-bar').boundingClientRect();
        query.exec(function (res) {
          if (res[0]) {
            page._barRect = res[0];
          }
        });
      } catch (e) {}
    }, 300);
  },

  _getColorBarPosition(clientX) {
    if (!this._barRect || !this._barRect.width) return -1;
    return Math.max(0, Math.min(100, ((clientX - this._barRect.left) / this._barRect.width) * 100));
  },

  onColorBarTouchStart(e) {
    try {
      const mode = e.currentTarget.dataset.mode || 'add';
      const clientX = e.touches ? e.touches[0].clientX : e.detail.x;
      const position = this._getColorBarPosition(clientX);
      if (position >= 0) this._updateColorBarPosition(mode, position);
    } catch (e) {
      console.error('颜色条触摸错误', e);
    }
  },

  onColorBarTouchMove(e) {
    if (!e.touches) return;
    if (this._colorBarMoveTimer) return;
    const mode = e.currentTarget.dataset.mode || 'add';
    const clientX = e.touches[0].clientX;
    this._colorBarMoveTimer = setTimeout(() => {
      this._colorBarMoveTimer = null;
      try {
        const position = this._getColorBarPosition(clientX);
        if (position >= 0) this._updateColorBarPosition(mode, position);
      } catch (e) {}
    }, 20);
  },

  _updateColorBarPosition(mode, position) {
    const color = this.getColorFromPosition(position);
    if (mode === 'edit') {
      this.setData({
        editColorBarPosition: position,
        'editTemplate.color': color
      });
    } else {
      this.setData({
        colorBarPosition: position,
        'newTemplate.color': color
      });
    }
  },

  stopPropagation() {
  }
});