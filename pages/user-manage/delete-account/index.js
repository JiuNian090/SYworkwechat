'use strict';
const CloudManager = require('../../../utils/cloudManager.js');
const { store } = require('../../../utils/store.js');

Page({
  data: {
    deleteAccountPassword: '',
    cloudManager: null
  },

  onLoad() {
    this.cloudManager = new CloudManager();
  },

  onDeleteAccountPasswordInput(e) {
    this.setData({ deleteAccountPassword: e.detail.value });
  },

  goBack() {
    wx.navigateBack();
  },

  async confirmDeleteAccount() {
    const { deleteAccountPassword } = this.data;
    const cloudUserInfo = store.getState('cloudUserInfo');

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常，请重新登录', icon: 'none' });
      return;
    }

    if (!deleteAccountPassword) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '警告',
      content: '删除账户将同时删除所有云端备份数据，此操作不可恢复！确定要继续吗？',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'userLogin',
              data: { action: 'deleteAccount', userId: cloudUserInfo.userId, password: deleteAccountPassword }
            });
            wx.hideLoading();

            if (result.result.success) {
              let savedAccounts = [];
              try {
                savedAccounts = store.getState('savedAccounts') || [];
                savedAccounts = savedAccounts.filter(item => item.account !== cloudUserInfo.account);
                store.setState({ savedAccounts }, ['savedAccounts']);
              } catch (e) {
                console.error('从保存的账号列表中删除账户失败:', e);
              }

              this.cloudManager.logout();
              store.removeState(
                ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo'],
                ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']
              );

              wx.showToast({ title: '账户已删除', icon: 'success' });
              wx.navigateBack({ delta: 2 });
            } else {
              wx.showToast({ title: result.result.errMsg, icon: 'none' });
            }
          } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  }
});
