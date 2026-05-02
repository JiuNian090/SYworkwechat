// @ts-nocheck
'use strict';
const CloudManager = require('../../utils/cloudManager');
const AvatarManager = require('../../utils/avatarManager');
const emojiManager = require('../../utils/emojiManager');
const config = require('../../config.js');
const { store } = require('../../utils/store');
const { encryptPassword, decryptPassword, isOldFormat, hashPassword, verifyPassword } = require('../../utils/encrypt');

interface SavedAccount {
  account: string;
  password: string;
  passwordHash: string;
  lastLogin?: string;
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
  avatarEmojiEmotion?: string;
}

interface CloudUserInfoData {
  userId: string;
  account: string;
  nickname: string;
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
}

Page({
  data: {
    cloudUserInfo: null as CloudUserInfoData | null,
    cloudLoggedIn: false,
    cloudAccount: '',
    username: '',
    avatarText: '用' as string,
    avatarEmoji: '' as string,
    avatarType: 'text' as string,
    emojiText: '',
    emojiEmotion: '',
    savedAccounts: [] as SavedAccount[],
    autoRestoreMap: {} as Record<string, boolean>,
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
    avatarMode: 'emoji' as string,
    avatarModeCategory: 'face' as string,
    avatarModeEmojis: [] as string[],
    avatarModeEmoji: '' as string,
    avatarModeText: '' as string,
    avatarModeTextInput: '' as string,
    emojiCategories: [] as Array<{ id: string; name: string; icon: string }>
  },

  onLoad(): void {
    this.cloudManager = new CloudManager();
    this.avatarManager = new AvatarManager();
    this.initPageData();
  },

  onShow(): void {
    this.initPageData();
  },

  initPageData(): void {
    const cloudUserId = store.getState('cloudUserId') as string;
    const cloudAccount = store.getState('cloudAccount') as string || '';
    const cloudUserInfo = store.getState('cloudUserInfo') as CloudUserInfoData | null;
    const cloudLoggedIn = !!cloudUserId;

    (this as unknown as Record<string, unknown>).userId = cloudUserId;

    let avatarInfo: Record<string, unknown>;
    if (cloudLoggedIn && cloudUserInfo) {
      avatarInfo = this.avatarManager.initAvatarFromCloud(cloudUserInfo);
    } else {
      avatarInfo = this.avatarManager.initAvatarInfo();
    }

    let savedAccounts: SavedAccount[] = [];
    let migrated = false;
    try {
      savedAccounts = store.getState('savedAccounts') as SavedAccount[] || [];
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

    let autoRestoreMap: Record<string, boolean> = {};
    try {
      autoRestoreMap = store.getState('autoRestoreMap') as Record<string, boolean> || {};
    } catch (e) {
      console.error('加载自动恢复勾选状态失败:', e);
    }

    const cloudInitialized = store.getState('cloudInitialized') as boolean;

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
      avatarMode: (avatarInfo.avatarType as string) || 'emoji',
      avatarModeEmoji: (avatarInfo.avatarType as string) === 'emoji' ? (avatarInfo.avatarEmoji as string) || '' : '',
      avatarModeText: (avatarInfo.avatarType as string) === 'text' ? (avatarInfo.avatarText as string) || '' : ''
    });

    if (cloudLoggedIn && cloudInitialized) {
      this.getLatestAvatarFromCloud();
    }
  },

  async getLatestAvatarFromCloud(): Promise<void> {
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

  showModal(e: WechatMiniprogram.TouchEvent): void {
    const page = (e.currentTarget.dataset as { page: string }).page;
    this.setData({ currentModal: page });

    if (page === 'updateNickname') {
      this.setData({ newNickname: (this.data.cloudUserInfo?.nickname) || '' });
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

  hideModal(): void {
    this.setData({ currentModal: '' });
  },

  showLoginModal(): void {
    this.setData({
      currentModal: 'login',
      cloudAccountInput: '',
      cloudPasswordInput: '',
      rememberPassword: false
    });
  },

  onNicknameInput(e: WechatMiniprogram.Input): void {
    this.setData({ newNickname: e.detail.value });
  },

  onOldPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ confirmPassword: e.detail.value });
  },

  onDeleteAccountPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ deleteAccountPassword: e.detail.value });
  },

  onCloudAccountInput(e: WechatMiniprogram.Input): void {
    this.setData({ cloudAccountInput: e.detail.value });
  },

  onCloudPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ cloudPasswordInput: e.detail.value });
  },

  toggleCloudPasswordVisibility(): void {
    this.setData({ showCloudPassword: !this.data.showCloudPassword });
  },

  toggleRememberPassword(): void {
    this.setData({ rememberPassword: !this.data.rememberPassword });
  },

  async confirmUpdateNickname(): Promise<void> {
    const { newNickname, cloudUserInfo } = this.data;

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({ title: '用户信息异常', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '修改中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: config.cloudFunctions.userLogin,
        data: {
          action: 'updateNickname',
          userId: cloudUserInfo.userId,
          nickname: newNickname.trim()
        }
      });

      wx.hideLoading();

      if ((result.result as Record<string, unknown>).success) {
        const updatedCloudUserInfo = { ...cloudUserInfo, nickname: newNickname.trim() };
        this.setData({
          cloudUserInfo: updatedCloudUserInfo,
          username: newNickname.trim(),
          currentModal: ''
        });
        store.setState({ cloudUserInfo: updatedCloudUserInfo, username: newNickname.trim() }, ['cloudUserInfo', 'username']);
        wx.showToast({ title: '昵称修改成功', icon: 'success' });
      } else {
        wx.showToast({ title: (result.result as Record<string, string>).errMsg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  async confirmUpdatePassword(): Promise<void> {
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
        name: config.cloudFunctions.userLogin,
        data: {
          action: 'updatePassword',
          userId: cloudUserInfo.userId,
          password: oldPassword,
          newPassword: newPassword
        }
      });

      wx.hideLoading();

      if ((result.result as Record<string, unknown>).success) {
        this.setData({ currentModal: '', oldPassword: '', newPassword: '', confirmPassword: '' });
        wx.showToast({ title: '密码修改成功', icon: 'success' });
      } else {
        wx.showToast({ title: (result.result as Record<string, string>).errMsg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  async confirmDeleteAccount(): Promise<void> {
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
              name: config.cloudFunctions.userLogin,
              data: {
                action: 'deleteAccount',
                userId: cloudUserInfo.userId,
                password: deleteAccountPassword
              }
            });

            wx.hideLoading();

            if ((result.result as Record<string, unknown>).success) {
              let savedAccounts = store.getState('savedAccounts') as SavedAccount[] || [];
              savedAccounts = savedAccounts.filter(item => item.account !== cloudUserInfo.account);
              const autoRestoreMap = { ...this.data.autoRestoreMap };
              delete autoRestoreMap[cloudUserInfo.account];
              store.setState({ savedAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);
              this.setData({ savedAccounts, autoRestoreMap });

              this.logoutFromCloud();
              this.setData({ currentModal: '' });
              wx.showToast({ title: '账户已删除', icon: 'success' });
            } else {
              wx.showToast({ title: (result.result as Record<string, string>).errMsg, icon: 'none' });
            }
          } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onAvatarModeSwitch(e: WechatMiniprogram.TouchEvent): void {
    const mode = (e.currentTarget.dataset as { mode: string }).mode;
    if (mode === this.data.avatarMode) return;
    this.setData({ avatarMode: mode });
  },

  onAvatarCategorySwitch(e: WechatMiniprogram.TouchEvent): void {
    const categoryId = (e.currentTarget.dataset as { category: string }).category;
    this.setData({
      avatarModeCategory: categoryId,
      avatarModeEmojis: emojiManager.getCategoryEmojis(categoryId)
    });
  },

  onAvatarEmojiPick(e: WechatMiniprogram.TouchEvent): void {
    const emoji = (e.currentTarget.dataset as { emoji: string }).emoji;
    this.setData({ avatarModeEmoji: emoji });
  },

  onAvatarTextInput(e: WechatMiniprogram.Input): void {
    const val = e.detail.value.trim();
    this.setData({ avatarModeTextInput: val, avatarModeText: val || '' });
  },

  onAvatarTextConfirm(): void {},

  getEmojiDesc(emoji: string): string {
    return emojiManager.getEmojiText(emoji) || '';
  },

  onAvatarConfirm(): void {
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

  toggleAutoRestore(e: WechatMiniprogram.TouchEvent): void {
    const account = (e.currentTarget.dataset as { account: string }).account;
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

  deleteSavedAccount(e: WechatMiniprogram.TouchEvent): void {
    const account = (e.currentTarget.dataset as { account: string }).account;
    let savedAccounts = store.getState('savedAccounts') as SavedAccount[] || [];
    savedAccounts = savedAccounts.filter(item => item.account !== account);
    const autoRestoreMap = { ...this.data.autoRestoreMap };
    delete autoRestoreMap[account];
    store.setState({ savedAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);
    this.setData({ savedAccounts, autoRestoreMap });
  },

  selectAccount(e: WechatMiniprogram.TouchEvent): void {
    const index = (e.currentTarget.dataset as { index: number }).index;
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

  async loginWithSavedAccount(account: string, password: string): Promise<void> {
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

  async loginToCloud(): Promise<void> {
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

        this.setData({ currentModal: '' });
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
      } else {
        wx.showToast({ title: result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async handleLoginSuccess(account: string, result: Record<string, unknown>): Promise<void> {
    const data = result.data as Record<string, unknown>;
    const cloudUserInfo: CloudUserInfoData = {
      userId: data.userId as string,
      account: account,
      nickname: (data.nickname as string) || account,
      avatarType: (data.avatarType as string) || 'emoji',
      avatarEmoji: (data.avatarEmoji as string) || '😊',
      avatarText: (data.avatarText as string) || ''
    };
    const displayUsername = (data.nickname as string) || account;
    const avatarType = (data.avatarType as string) || 'emoji';
    const avatarEmoji = (data.avatarEmoji as string) || '😊';

    const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
    const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

    store.setState({
      username: displayUsername,
      avatarType,
      avatarEmoji,
      cloudAccount: account,
      cloudLoggedIn: true,
      cloudUserId: data.userId as string,
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

    (this as unknown as Record<string, unknown>).userId = data.userId;

    this.updateSavedAccountAvatar(account, { avatarType, avatarEmoji, avatarText: '', avatarEmojiEmotion: emojiEmotion });
  },

  saveAccount(account: string, password: string): void {
    try {
      const savedAccounts = store.getState('savedAccounts') as SavedAccount[] || [];
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

  updateAvatarInOtherPages(): void {
    const { avatarType, avatarText, avatarEmoji } = this.data;
    this.avatarManager.updateAvatarInOtherPages(avatarType, avatarText, avatarEmoji);
  },

  async syncAvatarToCloud(avatarType: string, avatarEmoji: string, avatarText: string): Promise<void> {
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

  confirmLogout(): void {
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

  logoutFromCloud(): void {
    const cloudManager = this.data.cloudManager as { logout: () => void };
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
    (this as unknown as Record<string, unknown>).userId = null;

    wx.showToast({ title: '已退出登录', icon: 'success' });
  },

  updateSavedAccountAvatar(account: string, avatarInfo: Record<string, unknown>): void {
    try {
      const savedAccounts = store.getState('savedAccounts') as SavedAccount[] || [];
      const index = savedAccounts.findIndex(item => item.account === account);
      if (index !== -1) {
        savedAccounts[index] = {
          ...savedAccounts[index],
          avatarType: avatarInfo.avatarType as string,
          avatarEmoji: avatarInfo.avatarEmoji as string,
          avatarText: avatarInfo.avatarText as string,
          avatarEmojiEmotion: avatarInfo.avatarEmojiEmotion as string
        };
        store.setState({ savedAccounts }, ['savedAccounts']);
        this.setData({ savedAccounts });
      }
    } catch (e) {
      console.error('更新 savedAccounts 头像失败:', e);
    }
  },

  onUnload(): void {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2] as Record<string, unknown>;
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
