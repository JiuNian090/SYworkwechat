// pages/plan/plan.js
Page({
  data: {
    shiftTemplates: [],
    showAddTemplate: false,
    showEditTemplate: false,
    showBatchDelete: false,
    editIndex: -1,
    selectedTemplates: [],
    newTemplate: {
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      workHours: 8,
      type: '工作日',
      desc: '',
      color: '#07c160'
    },
    shiftTypes: ['工作日', '休息日', '节假日'],
    colorList: ['#07c160', '#faad14', '#1890ff', '#ff4d4f', '#13c2c2', '#722ed1']
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
        type: '工作日',
        desc: '',
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

  onWorkHoursChange(e) {
    this.setData({
      'newTemplate.workHours': parseFloat(e.detail.value) || 0
    });
  },

  onDescInput(e) {
    this.setData({ 'newTemplate.desc': e.detail.value });
  },

  onColorChange(e) {
    this.setData({ 'newTemplate.color': this.data.colorList[e.detail.value] });
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

  showEditTemplateModal(e) {
    const index = e.currentTarget.dataset.index;
    const tpl = this.data.shiftTemplates[index];
    this.setData({
      showEditTemplate: true,
      editIndex: index,
      newTemplate: { ...tpl }
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
    const templates = [...shiftTemplates];
    templates[editIndex] = newTemplate;
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({ 
        shiftTemplates: templates, 
        showEditTemplate: false, 
        editIndex: -1 
      });
      wx.showToast({ title: '编辑成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '编辑失败', icon: 'none' });
    }
  },

  copyTemplate(e) {
    const index = e.currentTarget.dataset.index;
    const tpl = { ...this.data.shiftTemplates[index], name: this.data.shiftTemplates[index].name + '_复制' };
    const templates = [...this.data.shiftTemplates, tpl];
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({ shiftTemplates: templates });
      wx.showToast({ title: '复制成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '复制失败', icon: 'none' });
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
  },

  showBatchDeleteModal() {
    this.setData({ showBatchDelete: true, selectedTemplates: [] });
  },

  toggleSelectTemplate(e) {
    const index = e.currentTarget.dataset.index;
    let selected = [...this.data.selectedTemplates];
    if (selected.includes(index)) {
      selected = selected.filter(i => i !== index);
    } else {
      selected.push(index);
    }
    this.setData({ selectedTemplates: selected });
  },

  selectAllTemplates() {
    const allIndexes = this.data.shiftTemplates.map((_, index) => index);
    this.setData({ selectedTemplates: allIndexes });
  },

  reverseSelectTemplates() {
    const allIndexes = this.data.shiftTemplates.map((_, index) => index);
    const selected = allIndexes.filter(index => !this.data.selectedTemplates.includes(index));
    this.setData({ selectedTemplates: selected });
  },

  batchDeleteTemplates() {
    const { shiftTemplates, selectedTemplates } = this.data;
    const templates = shiftTemplates.filter((_, i) => !selectedTemplates.includes(i));
    try {
      wx.setStorageSync('shiftTemplates', templates);
      this.setData({ 
        shiftTemplates: templates, 
        showBatchDelete: false, 
        selectedTemplates: [] 
      });
      wx.showToast({ title: '批量删除成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '批量删除失败', icon: 'none' });
    }
  },

  hideBatchDeleteModal() {
    this.setData({ showBatchDelete: false, selectedTemplates: [] });
  }
});