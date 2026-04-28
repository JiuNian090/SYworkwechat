'use strict';
const CloudManager = require('../../../utils/cloudManager.js');
const AvatarManager = require('../../../utils/avatarManager.js');
const emojiManager = require('../../../utils/emojiManager.js');
const { store } = require('../../../utils/store.js');
const { decryptPassword, verifyPassword, encryptPassword, hashPassword } = require('../../../utils/encrypt.js');

Page({
  data: {
    savedAccounts: [],
    autoRestoreMap: {},
    cloudManager: null,
    avatarManager: null
  },

  onLoad() {
    this.cloudManager = new CloudManager();
    this.avatarManager = new AvatarManager();

    const savedAccounts = store.getState('savedAccounts') || [];
    const autoRestoreMap = store.getState('autoRestoreMap') || {};

    this.setData({ savedAccounts, autoRestoreMap });
    this.checkAndCleanInvalidAccounts();
  },

  navigateToLogin() {
    wx.navigateTo({ url: '/pages/user-manage/login/index' });
  },

  goBack() {
    wx.navigateBack();
  },

  async checkAndCleanInvalidAccounts() {
    try {
      const savedAccounts = store.getState('savedAccounts') || [];
      if (savedAccounts.length === 0) return;
      if (!store.getState('cloudInitialized')) return;

      const validAccounts = [];
      const autoRestoreMap = { ...this.data.autoRestoreMap };

      for (const account of savedAccounts) {
        try {
          const result = await wx.cloud.callFunction({
            name: 'userLogin',
            data: { action: 'checkAccountExists', account: account.account },
            timeout: 5000
          });
          if (result.result.success && result.result.exists) {
            validAccounts.push(account);
          } else {
            delete autoRestoreMap[account.account];
          }
        } catch (e) {
          validAccounts.push(account);
        }
      }

      if (validAccounts.length !== savedAccounts.length) {
        store.setState({ savedAccounts: validAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);
        this.setData({ savedAccounts: validAccounts, autoRestoreMap });
      }
    } catch (e) {
      console.error('检查和清理无效账户失败:', e);
    }
  },

  selectAccount(e) {
    const index = e.currentTarget.dataset.index;
    const savedAccounts = this.data.savedAccounts;
    if (index === undefined || !savedAccounts[index]) return;

    const account = savedAccounts[index].account;
    const encryptedPassword = savedAccounts[index].password;
    const storedHash = savedAccounts[index].passwordHash;

    if (!encryptedPassword) {
      wx.navigateTo({ url: '/pages/user-manage/login/index' });
      return;
    }

    const password = decryptPassword(encryptedPassword);

    if (password) {
      if (storedHash && !verifyPassword(password, storedHash)) {
        wx.navigateTo({ url: '/pages/user-manage/login/index' });
        return;
      }
      this.loginWithSavedAccount(account, password);
    } else {
      wx.navigateTo({ url: '/pages/user-manage/login/index' });
    }
  },

  async loginWithSavedAccount(account, password) {
    if (!account || !password) {
      wx.showToast({ title: '账号或密码为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const result = await this.cloudManager.login(account, password);
      wx.hideLoading();

      if (result.success) {
        const cloudUserInfo = {
          userId: result.data.userId, account, nickname: result.data.nickname || account,
          avatarType: result.data.avatarType || 'emoji', avatarEmoji: result.data.avatarEmoji || '😊', avatarText: result.data.avatarText || ''
        };
        const displayUsername = result.data.nickname || account;
        const avatarType = result.data.avatarType || 'emoji';
        const avatarEmoji = result.data.avatarEmoji || '😊';
        const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
        const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

        store.setState({
          username: displayUsername, avatarType, avatarEmoji, cloudAccount: account,
          cloudLoggedIn: true, cloudUserId: result.data.userId, cloudUserInfo
        }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);

        this.saveAccount(account, password);
        this.updateSavedAccountAvatar(account, { avatarType, avatarEmoji, avatarText: '', avatarEmojiEmotion: emojiEmotion });

        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });

        const autoRestoreMap = store.getState('autoRestoreMap') || {};
        if (autoRestoreMap[account]) {
          this.autoRestoreData();
        }

        wx.navigateBack({ delta: 2 });
      } else {
        wx.showToast({ title: result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  saveAccount(account, password) {
    try {
      let savedAccounts = store.getState('savedAccounts') || [];
      const avatarEmoji = store.getState('avatarEmoji') || '';
      const avatarType = store.getState('avatarType') || 'emoji';
      const emojiEmotion = 'neutral';
      const encryptedPwd = encryptPassword(password);
      const pwdHash = hashPassword(password);
      const existingIndex = savedAccounts.findIndex(item => item.account === account);
      const entry = { account, password: encryptedPwd, passwordHash: pwdHash, lastLogin: new Date().toISOString(), avatarType, avatarEmoji, avatarText: '', avatarEmojiEmotion: emojiEmotion };

      if (existingIndex >= 0) savedAccounts[existingIndex] = entry;
      else savedAccounts.push(entry);

      if (savedAccounts.length > 5) {
        savedAccounts = savedAccounts.sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin)).slice(0, 5);
      }
      store.setState({ savedAccounts }, ['savedAccounts']);
    } catch (e) {
      console.error('保存账号失败:', e);
    }
  },

  updateSavedAccountAvatar(account, avatarInfo) {
    try {
      const savedAccounts = store.getState('savedAccounts') || [];
      const index = savedAccounts.findIndex(item => item.account === account);
      if (index !== -1) {
        savedAccounts[index] = { ...savedAccounts[index], ...avatarInfo };
        store.setState({ savedAccounts }, ['savedAccounts']);
        this.setData({ savedAccounts });
      }
    } catch (e) {
      console.error('更新 savedAccounts 头像失败:', e);
    }
  },

  toggleAutoRestore(e) {
    const account = e.currentTarget.dataset.account;
    const currentValue = this.data.autoRestoreMap[account] || false;
    const newValue = !currentValue;

    if (newValue) {
      wx.showModal({
        title: '自动恢复数据',
        content: '勾选此项后，下次点击此账号登录时会自动静默恢复云备份数据。确定要开启吗？',
        success: (res) => {
          if (res.confirm) {
            const autoRestoreMap = { ...this.data.autoRestoreMap };
            autoRestoreMap[account] = true;
            this.setData({ autoRestoreMap });
            store.setState({ autoRestoreMap }, ['autoRestoreMap']);
          }
        }
      });
    } else {
      const autoRestoreMap = { ...this.data.autoRestoreMap };
      autoRestoreMap[account] = false;
      this.setData({ autoRestoreMap });
      store.setState({ autoRestoreMap }, ['autoRestoreMap']);
    }
  },

  deleteSavedAccount(e) {
    const account = e.currentTarget.dataset.account;
    try {
      let savedAccounts = store.getState('savedAccounts') || [];
      savedAccounts = savedAccounts.filter(item => item.account !== account);
      const autoRestoreMap = { ...this.data.autoRestoreMap };
      delete autoRestoreMap[account];
      store.setState({ savedAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);
      this.setData({ savedAccounts, autoRestoreMap });
    } catch (e) {
      console.error('删除保存的账号失败:', e);
    }
  },

  async autoRestoreData() {
    try {
      const backupInfo = await this.cloudManager.getBackupInfo();
      if (!backupInfo.success || !backupInfo.hasBackup) return;
      wx.showLoading({ title: '恢复数据中...' });
      const result = await this.cloudManager.restore();
      wx.hideLoading();
      if (result.success) {
        store.setState({ lastRestoreTime: Date.now() }, ['lastRestoreTime']);
      }
    } catch (e) {
      wx.hideLoading();
      console.error('自动恢复数据异常:', e);
    }
  }
});
