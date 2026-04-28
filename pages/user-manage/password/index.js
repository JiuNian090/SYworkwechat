'use strict';
const { store } = require('../../../utils/store.js');

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  onOldPasswordInput(e) {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewPasswordInput(e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  goBack() {
    wx.navigateBack();
  },

  async confirmUpdatePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    const cloudUserInfo = store.getState('cloudUserInfo');

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常，请重新登录', icon: 'none' });
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      wx.showToast({ title: '请填写完整密码信息', icon: 'none' });
      return;
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }

    if (newPassword.length < 6) {
      wx.showToast({ title: '密码长度不能少于 6 位', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '修改中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { action: 'updatePassword', userId: cloudUserInfo.userId, password: oldPassword, newPassword }
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({ title: '密码修改成功', icon: 'success' });
        wx.navigateBack();
      } else {
        wx.showToast({ title: result.result.errMsg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  }
});
