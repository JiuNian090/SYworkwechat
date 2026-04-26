'use strict';
// pages/plan/plan.js
const { calculateHash } = require('../../utils/encrypt.js');
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
    }
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
      editTemplate: templateWithTime
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

  onColorChange(e) {
    const { color } = e.detail;
    const mode = e.currentTarget.dataset.mode;
    if (mode === 'edit') {
      this.setData({
        'editTemplate.color': color
      });
    } else {
      this.setData({
        'newTemplate.color': color
      });
    }
  }
});
