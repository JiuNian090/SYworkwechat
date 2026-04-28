'use strict';
const CloudManager = require('../../utils/cloudManager.js');
const AvatarManager = require('../../utils/avatarManager.js');
const emojiManager = require('../../utils/emojiManager.js');
const { store } = require('../../utils/store.js');
const { encryptPassword, decryptPassword, isOldFormat, hashPassword, verifyPassword } = require('../../utils/encrypt.js');

Page({
  data: {
    cloudUserInfo: null,
    cloudLoggedIn: false,
    cloudAccount: '',
    username: '',
    avatarText: '用',
    avatarEmoji: '',
    avatarType: 'text',
    emojiText: '',
    emojiEmotion: '',
    savedAccounts: [],
    autoRestoreMap: {},
    currentModal: '',
    newNickname: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    deleteAccountPassword: '',
    cloudAccountInput: '',
    cloudPasswordInput: '',
    showCloudPassword: false,
    rememberPassword: false,
    avatarMode: 'emoji',
    avatarModeCategory: 'face',
    avatarModeEmojis: emojiManager.getCategoryEmojis('face'),
    avatarModeEmoji: '',
    avatarModeText: '',
    avatarModeTextInput: '',
    emojiCategories: emojiManager.getCategories()
  },

  onLoad() {
    this.cloudManager = new CloudManager();
    this.avatarManager = new AvatarManager();
    this.initPageData();
  },

  onShow() {
    this.initPageData();
  },

  initPageData() {
    const cloudUserId = store.getState('cloudUserId');
    const cloudAccount = store.getState('cloudAccount') || '';
    const cloudUserInfo = store.getState('cloudUserInfo');
    const cloudLoggedIn = !!cloudUserId;

    this.userId = cloudUserId;

    let avatarInfo;
    if (cloudLoggedIn && cloudUserInfo) {
      avatarInfo = this.avatarManager.initAvatarFromCloud(cloudUserInfo);
    } else {
      avatarInfo = this.avatarManager.initAvatarInfo();
    }

    let savedAccounts = [];
    let migrated = false;
    try {
      savedAccounts = store.getState('savedAccounts') || [];
      savedAccounts.forEach(item => {
        if (item.password && item.password.length > 0) {
          const decrypted = decryptPassword(item.password);
          if (decrypted && isOldFormat(item.password)) {
            item.password = encryptPassword(decrypted);
            migrated = true;
          } else if (!decrypted) {
            item.password = '';
            migrated = true;
          }
        }
      });
      if (migrated) {
        store.setState({ savedAccounts }, ['savedAccounts']);
      }
    } catch (e) {
      console.error('加载保存的账号列表失败:', e);
    }

    let autoRestoreMap = {};
    try {
      autoRestoreMap = store.getState('autoRestoreMap') || {};
    } catch (e) {
      console.error('加载自动恢复勾选状态失败:', e);
    }

    const cloudInitialized = store.getState('cloudInitialized');

    this.setData({
      username: avatarInfo.username,
      avatarText: avatarInfo.avatarText,
      avatarEmoji: avatarInfo.avatarEmoji,
      avatarType: avatarInfo.avatarType,
      emojiText: avatarInfo.emojiText,
      emojiEmotion: avatarInfo.emojiEmotion,
      cloudManager: this.cloudManager,
      cloudLoggedIn: cloudLoggedIn,
      cloudAccount: cloudAccount,
      cloudUserInfo: cloudUserInfo,
      savedAccounts: savedAccounts,
      autoRestoreMap: autoRestoreMap,
      avatarMode: avatarInfo.avatarType || 'emoji',
      avatarModeEmoji: avatarInfo.avatarType === 'emoji' ? avatarInfo.avatarEmoji || '' : '',
      avatarModeText: avatarInfo.avatarType === 'text' ? avatarInfo.avatarText || '' : ''
    });

    if (cloudLoggedIn && cloudInitialized) {
      this.getLatestAvatarFromCloud();
    }
  },

  async getLatestAvatarFromCloud() {
    try {
      const { cloudUserInfo } = this.data;
      const avatarInfo = await this.avatarManager.getLatestAvatarFromCloud(cloudUserInfo);
      if (avatarInfo) {
        this.setData({
          username: avatarInfo.username,
          avatarType: avatarInfo.avatarType,
          avatarEmoji: avatarInfo.avatarEmoji,
          avatarText: avatarInfo.avatarText,
          emojiText: avatarInfo.emojiText,
          emojiEmotion: avatarInfo.emojiEmotion,
          cloudUserInfo: avatarInfo.cloudUserInfo,
          avatarMode: avatarInfo.avatarType || 'emoji',
          avatarModeEmoji: avatarInfo.avatarType === 'emoji' ? avatarInfo.avatarEmoji || '' : '',
          avatarModeText: avatarInfo.avatarType === 'text' ? avatarInfo.avatarText || '' : ''
        });
        this.updateAvatarInOtherPages();
      }
    } catch (e) {
      console.error('从云端获取头像信息失败', e);
    }
  },

  showModal(e) {
    const page = e.currentTarget.dataset.page;
    this.setData({ currentModal: page });
    
    if (page === 'updateNickname') {
      this.setData({ newNickname: this.data.cloudUserInfo?.nickname || '' });
    } else if (page === 'updatePassword') {
      this.setData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } else if (page === 'deleteAccount') {
      this.setData({ deleteAccountPassword: '' });
    } else if (page === 'avatar') {
      const { avatarType, avatarEmoji, username } = this.data;
      const currentText = avatarType === 'text' ? (username ? username.charAt(0).toUpperCase() : '') : '';
      this.setData({
        avatarMode: avatarType || 'emoji',
        avatarModeCategory: 'face',
        avatarModeEmojis: emojiManager.getCategoryEmojis('face'),
        avatarModeEmoji: avatarType === 'emoji' ? (avatarEmoji || '😊') : '',
        avatarModeText: currentText || '',
        avatarModeTextInput: currentText || ''
      });
    }
  },

  hideModal() {
    this.setData({ currentModal: '' });
  },

  showLoginModal() {
    this.setData({
      currentModal: 'login',
      cloudAccountInput: '',
      cloudPasswordInput: '',
      rememberPassword: false
    });
  },

  onNicknameInput(e) {
    this.setData({ newNickname: e.detail.value });
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

  onDeleteAccountPasswordInput(e) {
    this.setData({ deleteAccountPassword: e.detail.value });
  },

  onCloudAccountInput(e) {
    this.setData({ cloudAccountInput: e.detail.value });
  },

  onCloudPasswordInput(e) {
    this.setData({ cloudPasswordInput: e.detail.value });
  },

  toggleCloudPasswordVisibility() {
    this.setData({ showCloudPassword: !this.data.showCloudPassword });
  },

  toggleRememberPassword() {
    this.setData({ rememberPassword: !this.data.rememberPassword });
  },

  async confirmUpdateNickname() {
    const { newNickname, cloudUserInfo } = this.data;

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '修改中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'updateNickname',
          userId: cloudUserInfo.userId,
          nickname: newNickname.trim()
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        const updatedCloudUserInfo = { ...cloudUserInfo, nickname: newNickname.trim() };
        this.setData({
          cloudUserInfo: updatedCloudUserInfo,
          username: newNickname.trim(),
          currentModal: ''
        });
        store.setState({ cloudUserInfo: updatedCloudUserInfo, username: newNickname.trim() }, ['cloudUserInfo', 'username']);
        wx.showToast({ title: '昵称修改成功', icon: 'success' });
      } else {
        wx.showToast({ title: result.result.errMsg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  async confirmUpdatePassword() {
    const { oldPassword, newPassword, confirmPassword, cloudUserInfo } = this.data;

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常', icon: 'none' });
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
        data: {
          action: 'updatePassword',
          userId: cloudUserInfo.userId,
          password: oldPassword,
          newPassword: newPassword
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        this.setData({ currentModal: '', oldPassword: '', newPassword: '', confirmPassword: '' });
        wx.showToast({ title: '密码修改成功', icon: 'success' });
      } else {
        wx.showToast({ title: result.result.errMsg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  async confirmDeleteAccount() {
    const { deleteAccountPassword, cloudUserInfo } = this.data;

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常', icon: 'none' });
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
              data: {
                action: 'deleteAccount',
                userId: cloudUserInfo.userId,
                password: deleteAccountPassword
              }
            });

            wx.hideLoading();

            if (result.result.success) {
              let savedAccounts = store.getState('savedAccounts') || [];
              savedAccounts = savedAccounts.filter(item => item.account !== cloudUserInfo.account);
              const autoRestoreMap = { ...this.data.autoRestoreMap };
              delete autoRestoreMap[cloudUserInfo.account];
              store.setState({ savedAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);
              this.setData({ savedAccounts, autoRestoreMap });

              this.logoutFromCloud();
              this.setData({ currentModal: '' });
              wx.showToast({ title: '账户已删除', icon: 'success' });
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
  },

  onAvatarModeSwitch(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.avatarMode) return;
    this.setData({ avatarMode: mode });
  },

  onAvatarCategorySwitch(e) {
    const categoryId = e.currentTarget.dataset.category;
    this.setData({
      avatarModeCategory: categoryId,
      avatarModeEmojis: emojiManager.getCategoryEmojis(categoryId)
    });
  },

  onAvatarEmojiPick(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ avatarModeEmoji: emoji });
  },

  onAvatarTextInput(e) {
    const val = e.detail.value.trim();
    this.setData({ avatarModeTextInput: val, avatarModeText: val || '' });
  },

  onAvatarTextConfirm() {},

  getEmojiDesc(emoji) {
    return emojiManager.getEmojiText(emoji) || '';
  },

  onAvatarConfirm() {
    const { avatarMode, avatarModeEmoji, avatarModeText } = this.data;

    if (avatarMode === 'emoji') {
      if (!avatarModeEmoji) {
        wx.showToast({ title: '请选择一个表情', icon: 'none' });
        return;
      }
      const emojiText = emojiManager.getEmojiText(avatarModeEmoji) || '';
      const emojiEmotion = emojiManager.getEmojiEmotion(avatarModeEmoji) || 'neutral';

      this.setData({
        avatarEmoji: avatarModeEmoji,
        avatarType: 'emoji',
        emojiText: emojiText,
        emojiEmotion: emojiEmotion,
        currentModal: ''
      });
      store.setState({ avatarType: 'emoji', avatarEmoji: avatarModeEmoji }, ['avatarType', 'avatarEmoji']);
      this.syncAvatarToCloud('emoji', avatarModeEmoji, '');
    } else {
      const textChar = avatarModeText || '用';
      this.setData({
        avatarType: 'text',
        avatarText: textChar,
        avatarEmoji: '',
        emojiText: '',
        emojiEmotion: '',
        currentModal: ''
      });
      store.setState({ avatarType: 'text', avatarText: textChar, avatarEmoji: '' }, ['avatarType', 'avatarText', 'avatarEmoji']);
      this.syncAvatarToCloud('text', '', textChar);
    }

    this.updateAvatarInOtherPages();
    if (this.data.cloudAccount) {
      this.updateSavedAccountAvatar(this.data.cloudAccount, {
        avatarType: this.data.avatarType,
        avatarEmoji: this.data.avatarEmoji,
        avatarText: this.data.avatarText,
        avatarEmojiEmotion: this.data.emojiEmotion || 'neutral'
      });
    }

    wx.showToast({ title: '头像已更新', icon: 'success' });
  },

  toggleAutoRestore(e) {
    const account = e.currentTarget.dataset.account;
    const currentValue = this.data.autoRestoreMap[account] || false;
    const newValue = !currentValue;

    if (newValue) {
      wx.showModal({
        title: '自动恢复数据',
        content: '勾选此项后，下次点击此账号登录时会自动静默恢复云备份数据。确定要开启吗？',
        confirmText: '确定',
        cancelText: '取消',
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
    let savedAccounts = store.getState('savedAccounts') || [];
    savedAccounts = savedAccounts.filter(item => item.account !== account);
    const autoRestoreMap = { ...this.data.autoRestoreMap };
    delete autoRestoreMap[account];
    store.setState({ savedAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);
    this.setData({ savedAccounts, autoRestoreMap });
  },

  selectAccount(e) {
    const index = e.currentTarget.dataset.index;
    const savedAccounts = this.data.savedAccounts;
    if (index === undefined || !savedAccounts[index]) return;

    const account = savedAccounts[index].account;
    const encryptedPassword = savedAccounts[index].password;
    const storedHash = savedAccounts[index].passwordHash;

    if (!encryptedPassword) {
      this.setData({ cloudAccountInput: account, cloudPasswordInput: '', currentModal: 'login' });
      return;
    }

    const password = decryptPassword(encryptedPassword);
    if (password) {
      if (storedHash && !verifyPassword(password, storedHash)) {
        this.setData({ cloudAccountInput: account, cloudPasswordInput: '', currentModal: 'login' });
        return;
      }
      this.loginWithSavedAccount(account, password);
    } else {
      this.setData({ cloudAccountInput: account, cloudPasswordInput: '', currentModal: 'login' });
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
        await this.handleLoginSuccess(account, result);
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
      } else {
        wx.showToast({ title: result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async loginToCloud() {
    const { cloudAccountInput, cloudPasswordInput, rememberPassword } = this.data;

    if (!cloudAccountInput || !cloudPasswordInput) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const result = await this.cloudManager.login(cloudAccountInput, cloudPasswordInput);
      wx.hideLoading();

      if (result.success) {
        await this.handleLoginSuccess(cloudAccountInput, result);
        
        if (rememberPassword) {
          this.saveAccount(cloudAccountInput, cloudPasswordInput);
        }

        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
      } else {
        wx.showToast({ title: result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async handleLoginSuccess(account, result) {
    const cloudUserInfo = {
      userId: result.data.userId,
      account: account,
      nickname: result.data.nickname || account,
      avatarType: result.data.avatarType || 'emoji',
      avatarEmoji: result.data.avatarEmoji || '😊',
      avatarText: result.data.avatarText || ''
    };
    const displayUsername = result.data.nickname || account;
    const avatarType = result.data.avatarType || 'emoji';
    const avatarEmoji = result.data.avatarEmoji || '😊';

    const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
    const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

    store.setState({
      username: displayUsername,
      avatarType,
      avatarEmoji,
      cloudAccount: account,
      cloudLoggedIn: true,
      cloudUserId: result.data.userId,
      cloudUserInfo
    }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);

    this.setData({
      cloudLoggedIn: true,
      cloudAccount: account,
      username: displayUsername,
      avatarType,
      avatarEmoji,
      avatarText: '',
      emojiText,
      emojiEmotion,
      cloudUserInfo,
      currentModal: ''
    });

    this.userId = result.data.userId;

    this.updateSavedAccountAvatar(account, { avatarType, avatarEmoji, avatarText: '', avatarEmojiEmotion: emojiEmotion });
  },

  saveAccount(account, password) {
    try {
      let savedAccounts = store.getState('savedAccounts') || [];
      const index = savedAccounts.findIndex(item => item.account === account);
      const passwordHash = hashPassword(password);

      if (index !== -1) {
        savedAccounts[index] = {
          ...savedAccounts[index],
          password: encryptPassword(password),
          passwordHash
        };
      } else {
        savedAccounts.push({
          account,
          password: encryptPassword(password),
          passwordHash,
          avatarType: 'emoji',
          avatarEmoji: '😊',
          avatarText: ''
        });
      }

      store.setState({ savedAccounts }, ['savedAccounts']);
      this.setData({ savedAccounts });
    } catch (e) {
      console.error('保存账号失败:', e);
    }
  },

  updateAvatarInOtherPages() {
    const { avatarType, avatarText, avatarEmoji } = this.data;
    this.avatarManager.updateAvatarInOtherPages(avatarType, avatarText, avatarEmoji);
  },

  async syncAvatarToCloud(avatarType, avatarEmoji, avatarText) {
    try {
      const { cloudLoggedIn, cloudUserInfo } = this.data;
      const updatedUserInfo = await this.avatarManager.syncAvatarToCloud(avatarType, avatarEmoji, avatarText, cloudLoggedIn, cloudUserInfo);
      if (updatedUserInfo) {
        this.setData({ cloudUserInfo: updatedUserInfo });
      }
    } catch (e) {
      console.error('同步头像信息到云端失败', e);
    }
  },

  confirmLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出当前账号吗？',
      cancelText: '取消',
      confirmText: '退出登录',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          this.logoutFromCloud();
          wx.navigateBack();
        }
      }
    });
  },

  logoutFromCloud() {
    const cloudManager = this.data.cloudManager;
    cloudManager.logout();
    this.setData({
      cloudLoggedIn: false,
      cloudAccount: '',
      username: '',
      avatarType: 'emoji',
      avatarText: '',
      avatarEmoji: '😊',
      emojiText: '',
      emojiEmotion: 'neutral',
      currentModal: ''
    });
    store.removeState(
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo'],
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']
    );
    this.userId = null;

    wx.showToast({ title: '已退出登录', icon: 'success' });
  },

  updateSavedAccountAvatar(account, avatarInfo) {
    try {
      const savedAccounts = store.getState('savedAccounts') || [];
      const index = savedAccounts.findIndex(item => item.account === account);
      if (index !== -1) {
        savedAccounts[index] = {
          ...savedAccounts[index],
          avatarType: avatarInfo.avatarType,
          avatarEmoji: avatarInfo.avatarEmoji,
          avatarText: avatarInfo.avatarText,
          avatarEmojiEmotion: avatarInfo.avatarEmojiEmotion
        };
        store.setState({ savedAccounts }, ['savedAccounts']);
        this.setData({ savedAccounts });
      }
    } catch (e) {
      console.error('更新 savedAccounts 头像失败:', e);
    }
  },

  onUnload() {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage) {
      if (typeof prevPage.refreshUserInfo === 'function') {
        prevPage.refreshUserInfo();
      } else if (typeof prevPage.initPageData === 'function') {
        prevPage.initPageData();
      } else if (typeof prevPage.onShow === 'function') {
        prevPage.onShow();
      }
    }
  }
});