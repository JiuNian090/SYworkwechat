'use strict';
const { calculateHash } = require('../../utils/encrypt');
const { store } = require('../../utils/store');

interface NewTemplate {
  name: string;
  startTime: string;
  endTime: string;
  hours: number;
  minutes: number;
  hoursIndex: number;
  minutesIndex: number;
  workHours: number;
  typeIndex?: number;
  type?: string;
  color: string;
}

interface EditTemplate {
  name: string;
  startTime: string;
  endTime: string;
  hours: number;
  minutes: number;
  hoursIndex: number;
  minutesIndex: number;
  workHours: number;
  typeIndex: number;
  color: string;
}

Page({
  data: {
    shiftTemplates: [] as unknown[],
    showAddTemplate: false,
    showEditTemplate: false,
    editIndex: -1,
    hoursRange: Array.from({length: 25}, (_, i) => i) as number[],
    minutesRange: Array.from({length: 13}, (_, i) => i * 5) as number[],
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
    } as NewTemplate,
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
    } as EditTemplate,
    shiftTypes: ['白天班', '跨夜班', '休息日'] as string[],
    presetColors: ['#07c160', '#faad14', '#1890ff', '#ff4d4f', '#722ed1', '#13c2c2'] as string[],
    colorNames: {
      '#07c160': '翠绿',
      '#faad14': '暖橙',
      '#1890ff': '湛蓝',
      '#ff4d4f': '嫣红',
      '#722ed1': '魅紫',
      '#13c2c2': '黛青'
    }
  },

  onLoad(): void {
    this.loadShiftTemplates();
  },

  onShow(): void {
    const templates = store.getState('shiftTemplates') as unknown[] || [];
    if (calculateHash(JSON.stringify(templates)) !== calculateHash(JSON.stringify(this.data.shiftTemplates))) {
      this.setData({
        shiftTemplates: templates
      });
    }
  },

  loadShiftTemplates(): void {
    try {
      const templates = store.getState('shiftTemplates') as unknown[] || [];
      this.setData({
        shiftTemplates: templates
      });
    } catch (e) {
      console.error('读取班次模板失败', e);
    }
  },

  showAddTemplateModal(): void {
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

  hideAddTemplateModal(): void {
    this.setData({
      showAddTemplate: false
    });
  },

  onTemplateInput(e: WechatMiniprogram.Input): void {
    const field = (e.currentTarget.dataset as { field: string }).field;
    const value = e.detail.value;
    this.setData({
      [`newTemplate.${field}`]: value
    } as Record<string, unknown>);
  },

  onEditTemplateInput(e: WechatMiniprogram.Input): void {
    const field = (e.currentTarget.dataset as { field: string }).field;
    const value = e.detail.value;
    this.setData({
      [`editTemplate.${field}`]: value
    } as Record<string, unknown>);
  },

  onHoursChange(e: WechatMiniprogram.PickerChange): void {
    const hoursIndex = parseInt(e.detail.value as string);
    const hours = (this.data.hoursRange as number[])[hoursIndex];
    const minutes = (this.data.newTemplate as NewTemplate).minutes || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'newTemplate.hoursIndex': hoursIndex,
      'newTemplate.hours': hours,
      'newTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onEditHoursChange(e: WechatMiniprogram.PickerChange): void {
    const hoursIndex = parseInt(e.detail.value as string);
    const hours = (this.data.hoursRange as number[])[hoursIndex];
    const minutes = (this.data.editTemplate as EditTemplate).minutes || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'editTemplate.hoursIndex': hoursIndex,
      'editTemplate.hours': hours,
      'editTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onMinutesChange(e: WechatMiniprogram.PickerChange): void {
    const minutesIndex = parseInt(e.detail.value as string);
    const minutes = (this.data.minutesRange as number[])[minutesIndex];
    const hours = (this.data.newTemplate as NewTemplate).hours || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'newTemplate.minutesIndex': minutesIndex,
      'newTemplate.minutes': minutes,
      'newTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onEditMinutesChange(e: WechatMiniprogram.PickerChange): void {
    const minutesIndex = parseInt(e.detail.value as string);
    const minutes = (this.data.minutesRange as number[])[minutesIndex];
    const hours = (this.data.editTemplate as EditTemplate).hours || 0;
    const workHours = hours + (minutes / 60);
    this.setData({
      'editTemplate.minutesIndex': minutesIndex,
      'editTemplate.minutes': minutes,
      'editTemplate.workHours': parseFloat(workHours.toFixed(2))
    });
  },

  onTypeChange(e: WechatMiniprogram.PickerChange): void {
    this.setData({
      'newTemplate.typeIndex': parseInt(e.detail.value as string)
    });
  },

  onEditTypeChange(e: WechatMiniprogram.PickerChange): void {
    this.setData({
      'editTemplate.typeIndex': parseInt(e.detail.value as string)
    });
  },

  saveTemplate(): void {
    const { newTemplate, shiftTemplates } = this.data as { newTemplate: NewTemplate; shiftTemplates: unknown[] };

    if (!newTemplate.name) {
      wx.showToast({
        title: '请输入班次名称',
        icon: 'none'
      });
      return;
    }

    const workHours = (newTemplate.hours || 0) + ((newTemplate.minutes || 0) / 60);
    const type = (this.data.shiftTypes as string[])[newTemplate.typeIndex ?? 0] || '白天班';
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

      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if ((pages[i] as Record<string, unknown>).route === 'pages/schedule/schedule') {
          const schedulePage = pages[i] as Record<string, unknown>;
          if (typeof schedulePage.onShiftTemplatesUpdate === 'function') {
            schedulePage.onShiftTemplatesUpdate(templates);
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

  saveTemplates(): void {
    try {
      store.setState({ shiftTemplates: this.data.shiftTemplates }, ['shiftTemplates']);
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if ((pages[i] as Record<string, unknown>).route === 'pages/schedule/schedule') {
          const schedulePage = pages[i] as Record<string, unknown>;
          if (typeof schedulePage.onShiftTemplatesUpdate === 'function') {
            schedulePage.onShiftTemplatesUpdate(this.data.shiftTemplates);
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

  showEditTemplateModal(e: WechatMiniprogram.TouchEvent): void {
    const index = (e.currentTarget.dataset as { index: number }).index;
    const tpl = (this.data.shiftTemplates as Record<string, unknown>[])[index];

    const hours = (tpl.hours as number) || Math.floor((tpl.workHours as number) || 0);
    const minutes = (tpl.minutes as number) || Math.round(((tpl.workHours as number) || 0) - Math.floor((tpl.workHours as number) || 0)) * 60;
    const hoursIndex = hours;
    const minutesIndex = minutes / 5;
    const typeIndex = (this.data.shiftTypes as string[]).indexOf(tpl.type as string);

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

  hideEditTemplateModal(): void {
    this.setData({ showEditTemplate: false, editIndex: -1 });
  },

  saveEditTemplate(): void {
    const { editTemplate, shiftTemplates, editIndex } = this.data as { editTemplate: EditTemplate; shiftTemplates: unknown[]; editIndex: number };
    if (!editTemplate.name) {
      wx.showToast({ title: '请输入班次名称', icon: 'none' });
      return;
    }

    const workHours = (editTemplate.hours || 0) + ((editTemplate.minutes || 0) / 60);
    const type = (this.data.shiftTypes as string[])[editTemplate.typeIndex] || '白天班';
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

      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if ((pages[i] as Record<string, unknown>).route === 'pages/schedule/schedule') {
          const schedulePage = pages[i] as Record<string, unknown>;
          if (typeof schedulePage.onShiftTemplatesUpdate === 'function') {
            schedulePage.onShiftTemplatesUpdate(templates);
          }
          break;
        }
      }

      wx.showToast({ title: '编辑成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '编辑失败', icon: 'none' });
    }
  },

  deleteTemplate(e: WechatMiniprogram.TouchEvent): void {
    const index = (e.currentTarget.dataset as { index: number }).index;
    const templates = (this.data.shiftTemplates as unknown[]).filter((_, i) => i !== index);

    try {
      store.setState({ shiftTemplates: templates }, ['shiftTemplates']);
      this.setData({
        shiftTemplates: templates
      });

      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        if ((pages[i] as Record<string, unknown>).route === 'pages/schedule/schedule') {
          const schedulePage = pages[i] as Record<string, unknown>;
          if (typeof schedulePage.onShiftTemplatesUpdate === 'function') {
            schedulePage.onShiftTemplatesUpdate(templates);
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

  onShareAppMessage(): Record<string, unknown> {
    return {
      title: 'SYwork排班管理系统 - 计划页面',
      path: '/pages/plan/plan',
      imageUrl: ''
    };
  },

  onShareTimeline(): Record<string, unknown> {
    return {
      title: 'SYwork排班管理系统 - 计划页面',
      query: '',
      imageUrl: ''
    };
  },

  onColorChange(e: WechatMiniprogram.TouchEvent): void {
    const { color } = e.detail as { color: string };
    const mode = (e.currentTarget.dataset as { mode: string }).mode;
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

export {};
