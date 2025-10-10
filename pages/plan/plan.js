// pages/plan/plan.js
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
    ]
  },

  onLoad() {
    this.loadShiftTemplates();
  },

  onShow() {
    // 页面显示时重新加载班次模板，确保数据同步
    this.loadShiftTemplates();
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
        type: '白天班',
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



  onColorChange(e) {
    const selectedColor = this.data.colorOptions[e.detail.value];
    this.setData({ 'newTemplate.color': selectedColor.value });
  },

  onTypeChange(e) {
    this.setData({
      'newTemplate.type': this.data.shiftTypes[e.detail.value]
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
    const templateToSave = {
      ...newTemplate,
      workHours: parseFloat(workHours.toFixed(2))
    };

    const templates = [...shiftTemplates, templateToSave];
    
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({
        shiftTemplates: templates,
        showAddTemplate: false
      });
      
      // 通知其他页面更新班次模板
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          pages[i].loadShiftTemplates();
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

  showEditTemplateModal(e) {
    const index = e.currentTarget.dataset.index;
    const tpl = this.data.shiftTemplates[index];
    
    // 确保模板包含hours和minutes字段
    const hours = tpl.hours || Math.floor(tpl.workHours || 0);
    const minutes = tpl.minutes || Math.round(((tpl.workHours || 0) - Math.floor(tpl.workHours || 0)) * 60);
    
    // 计算小时和分钟的索引
    const hoursIndex = hours;
    const minutesIndex = minutes / 5; // 因为分钟是5分钟间隔
    
    const templateWithTime = {
      ...tpl,
      hours: hours,
      minutes: minutes,
      hoursIndex: hoursIndex,
      minutesIndex: minutesIndex
    };
    
    this.setData({
      showEditTemplate: true,
      editIndex: index,
      newTemplate: templateWithTime
    });
  },

  hideEditTemplateModal() {
    this.setData({ showEditTemplate: false, editIndex: -1 });
  },

  saveEditTemplate() {
    const { newTemplate, shiftTemplates, editIndex } = this.data;
    if (!newTemplate.name) {
      wx.showToast({ title: '请输入班次名称', icon: 'none' });
      return;
    }
    
    // 确保工时计算正确
    const workHours = (newTemplate.hours || 0) + ((newTemplate.minutes || 0) / 60);
    const templateToSave = {
      ...newTemplate,
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
      
      // 通知其他页面更新班次模板
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          pages[i].loadShiftTemplates();
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
    const templates = this.data.shiftTemplates.filter((_, i) => i !== index);
    
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({
        shiftTemplates: templates
      });
      
      // 通知其他页面更新班次模板
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].route === 'pages/schedule/schedule') {
          pages[i].loadShiftTemplates();
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
  }
});