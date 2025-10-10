// pages/plan/plan.js
Page({
  data: {
    shiftTemplates: [],
    showAddTemplate: false,
    newTemplate: {
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      workHours: 8,
      type: '工作日'
    },
    shiftTypes: ['工作日', '休息日', '节假日']
  },

  onLoad() {
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
        workHours: 8,
        type: '工作日'
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

  onWorkHoursChange(e) {
    this.setData({
      'newTemplate.workHours': parseFloat(e.detail.value) || 0
    });
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

    const templates = [...shiftTemplates, newTemplate];
    
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({
        shiftTemplates: templates,
        showAddTemplate: false
      });
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

  deleteTemplate(e) {
    const index = e.currentTarget.dataset.index;
    const templates = this.data.shiftTemplates.filter((_, i) => i !== index);
    
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({
        shiftTemplates: templates
      });
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