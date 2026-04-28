'use strict';
const { store } = require('../../../utils/store.js');

Page({
  data: {
    newNickname: ''
  },

  onLoad() {
    const cloudUserInfo = store.getState('cloudUserInfo');
    this.setData({
      newNickname: cloudUserInfo?.nickname || ''
    });
  },

  onNicknameInput(e) {
    this.setData({ newNickname: e.detail.value });
  },

  goBack() {
    wx.navigateBack();
  },

  async confirmUpdateNickname() {
    const { newNickname } = this.data;
    const cloudUserInfo = store.getState('cloudUserInfo');

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常，请重新登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '修改中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { action: 'updateNickname', userId: cloudUserInfo.userId, nickname: newNickname.trim() }
      });

      wx.hideLoading();

      if (result.result.success) {
        const updatedCloudUserInfo = { ...cloudUserInfo, nickname: newNickname.trim() };
        store.setState({ cloudUserInfo: updatedCloudUserInfo, username: newNickname.trim() }, ['cloudUserInfo', 'username']);
        wx.showToast({ title: '昵称修改成功', icon: 'success' });
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
