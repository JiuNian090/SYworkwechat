// @ts-nocheck
'use strict';
const changelogData = require('../../utils/changelog');
const CloudManager = require('../../utils/cloudManager');
const AvatarManager = require('../../utils/avatarManager');
const DataExportManager = require('../../utils/dataExportManager');
const DataImportManager = require('../../utils/dataImportManager');
const DataClearManager = require('../../utils/dataClearManager');
const { store } = require('../../utils/store');
const { encryptPassword, decryptPassword, isOldFormat, calculateHash, hashPassword } = require('../../utils/encrypt');
const { getDailyMessage } = require('../../utils/dailyMessage');

const STATUS_TEXT: Record<string, string> = {
  SYNCED: '已同步',
  LOCAL_NEWER: '本地最新',
  CLOUD_NEWER: '云端最新',
  UNBACKED: '未备份',
  NOT_LOGGED_IN: '未备份 / 未登录',
  CHECKING: '检查中...',
  ERROR: '检查失败'
};

const CACHE_TTL = 300000;

interface BackupStatus {
  type: string;
  label: string;
}

interface SavedAccount {
  account: string;
  password: string;
  passwordHash: string;
  lastLogin: string;
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
  avatarEmojiEmotion: string;
}

Page({
  data: {
    todayMessage: '',
    _lastMessage: '',
    _lastTimePeriod: '',
    _lastEmoji: '',
    _lastShiftsHash: '',
    exportFileName: '',
    exportedFilePath: '',
    exportedFileName: '',
    exportedTemplateFilePath: '',
    exportedTemplateFileName: '',
    exportSuccess: false,
    exportFail: false,
    fileExt: 'json' as string,
    loading: false,
    username: '',
    avatarText: '用' as string,
    avatarEmoji: '' as string,
    avatarType: 'text' as string,
    emojiText: '',
    emojiEmotion: '',
    showUsernameModal: false,
    tempUsername: '',
    showFileNameModal: false,
    tempFileName: '',
    defaultFileNameHint: '',
    showDataTypeModal: false,
    selectedDataTypes: [] as string[],
    dataTypes: [
      { id: 'shiftTemplates', name: '班次模板', checked: false },
      { id: 'shifts', name: '排班数据', checked: false },
      { id: 'scheduleImages', name: '排班图片', checked: false }
    ],
    cloudManager: null as unknown,
    cloudLoggedIn: false,
    cloudAccount: '',
    showCloudRegisterModal: false,
    showCloudLoginModal: false,
    cloudAccountInput: '',
    cloudPasswordInput: '',
    cloudConfirmPassword: '',
    cloudNicknameInput: '',
    showCloudPassword: false,
    rememberPassword: false,
    showDataManagementHelpModal: false,
    changelog: [] as unknown[],
    lastCloudCheckTime: 0,
    cachedCloudStatus: null as unknown,
    lastLocalUpdate: 0,
    backupStatus: null as BackupStatus | null,
    lastSyncHash: '',
    shiftColor: '#07c160',
    shiftGlowColor: 'rgba(7, 193, 96, 0.6)',
    savedAccounts: [] as SavedAccount[],
    autoRestoreMap: {} as Record<string, boolean>,
    cloudUserInfo: null as unknown
  },

  onLoad(): void {
    this.cloudManager = new CloudManager();
    this.avatarManager = new AvatarManager();
    this.dataExportManager = new DataExportManager();
    this.dataImportManager = new DataImportManager();
    this.dataClearManager = new DataClearManager();

    this.initPageData();
  },

  getTodayShiftColorInfo(): { shiftColor: string; shiftGlowColor: string } {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const shifts = wx.getStorageSync('shifts') || {};
    const todayShift = shifts[dateStr] as Record<string, unknown> | undefined;
    const color = (todayShift && todayShift.color) ? (todayShift.color as string) : '#07c160';
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      shiftColor: color,
      shiftGlowColor: `rgba(${r}, ${g}, ${b}, 0.6)`
    };
  },

  _getTimePeriod(hour: number): string {
    if (hour >= 0 && hour < 6) return '凌晨';
    if (hour >= 6 && hour < 8) return '清晨';
    if (hour >= 8 && hour < 12) return '上午';
    if (hour >= 12 && hour < 18) return '下午';
    if (hour >= 18 && hour < 22) return '晚上';
    return '深夜';
  },

  _getShiftsHash(shifts: Record<string, unknown>): string {
    const today = new Date();
    const todayStr = this._formatDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this._formatDate(yesterday);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this._formatDate(tomorrow);

    const relevantShifts: Record<string, unknown> = {
      [yesterdayStr]: shifts[yesterdayStr],
      [todayStr]: shifts[todayStr],
      [tomorrowStr]: shifts[tomorrowStr]
    };

    return JSON.stringify(relevantShifts);
  },

  _formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  refreshDailyMessage(force?: boolean): void {
    const now = new Date();
    const currentHour = now.getHours();
    const currentTimePeriod = this._getTimePeriod(currentHour);

    let nickname = '';
    const cloudUserInfo = this.data.cloudUserInfo || store.getState('cloudUserInfo');
    if (cloudUserInfo && (cloudUserInfo as Record<string, unknown>).nickname) {
      nickname = (cloudUserInfo as Record<string, unknown>).nickname as string;
    } else {
      const username = this.data.username || store.getState('username') as string;
      if (username) nickname = username;
    }

    let avatarEmoji = '';
    const avatarType = this.data.avatarType || store.getState('avatarType') as string;
    if (avatarType === 'emoji') {
      avatarEmoji = this.data.avatarEmoji || store.getState('avatarEmoji') as string;
    }

    const shifts = wx.getStorageSync('shifts') || {};
    const currentShiftsHash = this._getShiftsHash(shifts);

    const newMessage = getDailyMessage(nickname, shifts, avatarEmoji, now);

    const shouldUpdate = force ||
      newMessage !== this.data._lastMessage ||
      currentTimePeriod !== this.data._lastTimePeriod ||
      avatarEmoji !== this.data._lastEmoji ||
      currentShiftsHash !== this.data._lastShiftsHash;

    if (shouldUpdate) {
      this.setData({
        todayMessage: newMessage,
        _lastMessage: newMessage,
        _lastTimePeriod: currentTimePeriod,
        _lastEmoji: avatarEmoji,
        _lastShiftsHash: currentShiftsHash
      });
    }
  },

  onRefreshDailyMessage(): void {
    this.refreshDailyMessage(true);
  },

  initPageData(): void {
    const cloudInitialized = store.getState('cloudInitialized') as boolean;

    this.refreshDailyMessage();

    const cloudUserId = store.getState('cloudUserId') as string;
    const cloudAccount = store.getState('cloudAccount') as string || '';
    const cloudUserInfo = store.getState('cloudUserInfo');
    const cloudLoggedIn = !!cloudUserId;

    let username = store.getState('username') as string || '';
    if (cloudLoggedIn && cloudUserInfo) {
      username = (cloudUserInfo as Record<string, unknown>).nickname as string || cloudAccount;
      store.setState({ username }, ['username']);
    }
    (this as unknown as Record<string, unknown>).userId = cloudUserId;

    let avatarInfo: Record<string, unknown>;
    if (cloudLoggedIn && cloudUserInfo) {
      avatarInfo = this.avatarManager.initAvatarFromCloud(cloudUserInfo);
    } else {
      avatarInfo = this.avatarManager.initAvatarInfo();
    }

    const changelog = this.parseChangelog();

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

    let lastSyncHash = '';
    try {
      lastSyncHash = wx.getStorageSync('lastSyncHash') || '';
    } catch (e) {}

    this.setData({
      username: avatarInfo.username as string,
      avatarText: avatarInfo.avatarText as string,
      avatarEmoji: avatarInfo.avatarEmoji as string,
      avatarType: avatarInfo.avatarType as string,
      emojiText: avatarInfo.emojiText as string,
      emojiEmotion: avatarInfo.emojiEmotion as string,
      cloudManager: this.cloudManager,
      cloudLoggedIn: cloudLoggedIn,
      cloudAccount: cloudAccount,
      cloudUserInfo: cloudUserInfo || null,
      changelog: changelog,
      savedAccounts: savedAccounts,
      autoRestoreMap: autoRestoreMap,
      lastSyncHash: lastSyncHash,
      backupStatus: cloudLoggedIn
        ? { type: 'checking', label: STATUS_TEXT.CHECKING }
        : { type: 'unbacked', label: STATUS_TEXT.NOT_LOGGED_IN }
    });

    const shiftColorInfo = this.getTodayShiftColorInfo();
    this.setData({
      shiftColor: shiftColorInfo.shiftColor,
      shiftGlowColor: shiftColorInfo.shiftGlowColor
    });

    if (cloudLoggedIn && cloudInitialized) {
      this.getLatestAvatarFromCloud();
    }
  },

  navigateToDocs(e: WechatMiniprogram.TouchEvent): void {
    const type = (e.currentTarget.dataset as { type: string }).type;
    wx.navigateTo({
      url: '/subpkg-common/pages/docs/docs?type=' + type
    });
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
          cloudUserInfo: avatarInfo.cloudUserInfo
        });
        this.updateAvatarInOtherPages();
      }
    } catch (e) {
      console.error('从云端获取头像信息失败', e);
    }
  },

  showUsernameModal(): void {
    this.setData({
      tempUsername: this.data.username,
      showUsernameModal: true
    });
  },

  hideUsernameModal(): void {
    this.setData({ showUsernameModal: false });
  },

  onTempUsernameInput(e: WechatMiniprogram.Input): void {
    this.setData({ tempUsername: e.detail.value });
  },

  confirmUsername(): void {
    const username = this.data.tempUsername;
    if (!username.trim()) {
      wx.showToast({ title: '用户名不能为空', icon: 'none' });
      return;
    }

    const avatarText = this.generateAvatarText(username);

    this.setData({
      username: username,
      avatarText: avatarText,
      showUsernameModal: false
    });

    store.setState({ username }, ['username']);

    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  showDataTypeModal(): void {
    const resetDataTypes = this.data.dataTypes.map(type => ({
      ...type,
      checked: false
    }));

    this.setData({
      dataTypes: resetDataTypes,
      selectedDataTypes: [],
      showDataTypeModal: true
    });
  },

  hideDataTypeModal(): void {
    this.setData({ showDataTypeModal: false });
  },

  onDataTypeSelect(e: WechatMiniprogram.TouchEvent): void {
    const dataTypeId = (e.currentTarget.dataset as { typeid: string }).typeid;

    const updatedDataTypes = this.data.dataTypes.map(type => {
      if (type.id === dataTypeId) {
        return { ...type, checked: !type.checked };
      }
      return type;
    });

    const selectedDataTypes = updatedDataTypes
      .filter(type => type.checked)
      .map(type => type.id);

    this.setData({
      dataTypes: updatedDataTypes,
      selectedDataTypes: selectedDataTypes
    });
  },

  confirmDataTypeSelect(): void {
    if (this.data.selectedDataTypes.length === 0) {
      wx.showToast({ title: '请至少选择一种数据类型', icon: 'none' });
      return;
    }

    this.hideDataTypeModal();
    this.showFileNameModal();
  },

  showFileNameModal(): void {
    const username = this.data.username || '未命名用户';
    const selectedDataTypes = this.data.selectedDataTypes;
    const allDataTypes = this.data.dataTypes.map(type => type.id);

    const currentDate = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/[\/\s:]/g, '-');

    let defaultFileNameHint: string;

    const isAllSelected = selectedDataTypes.length === allDataTypes.length &&
      selectedDataTypes.every(type => allDataTypes.includes(type));

    if (isAllSelected) {
      defaultFileNameHint = `${username}+备份+${currentDate}`;
    } else {
      const dataTypeNames = this.data.dataTypes
        .filter(type => selectedDataTypes.includes(type.id))
        .map(type => type.name)
        .join('+');
      defaultFileNameHint = `${username}+${dataTypeNames}+${currentDate}`;
    }

    const includeImages = selectedDataTypes.includes('scheduleImages');
    const fileExt = includeImages ? 'zip' : 'json';

    this.setData({
      tempFileName: '',
      defaultFileNameHint: defaultFileNameHint,
      fileExt: fileExt,
      showFileNameModal: true
    });
  },

  hideFileNameModal(): void {
    this.setData({ showFileNameModal: false });
  },

  onTempFileNameInput(e: WechatMiniprogram.Input): void {
    this.setData({ tempFileName: e.detail.value });
  },

  confirmExport(): void {
    const customFileName = this.data.tempFileName;
    this.hideFileNameModal();

    this.dataExportManager.exportSelectedData(this.data.selectedDataTypes, customFileName, (result: Record<string, unknown> | null) => {
      if (result) {
        this.setData({
          exportedFilePath: result.filePath,
          exportedFileName: result.fileName
        });
      }
    });
  },

  shareExportedFile(): void {
    this.dataExportManager.shareExportedFile();
  },

  shareTemplate(): void {
    this.dataExportManager.shareTemplate();
  },

  importData(): void {
    this.dataImportManager.importData();
  },

  clearAllData(): void {
    this.dataClearManager.clearAllData();
  },

  contactAuthor(): void {
    wx.showModal({
      title: '联系作者',
      content: '是否要发送邮件给qiuqile@petalmail.com？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          if (wx.canIUse('openEmail')) {
            wx.openEmail({
              recipients: ['qiuqile@petalmail.com'],
              subject: '关于SYwork排班管理系统',
              body: '您好，我在使用SYwork排班管理系统时遇到了一些问题，希望能得到您的帮助。'
            });
          } else {
            wx.setClipboardData({
              data: 'qiuqile@petalmail.com',
              success: () => {
                wx.showToast({ title: '邮箱已复制', icon: 'success' });
                wx.showModal({
                  title: '提示',
                  content: '您的微信版本不支持直接发送邮件，邮箱地址已复制到剪贴板，请您手动发送邮件至qiuqile@petalmail.com',
                  showCancel: false,
                  confirmText: '知道了'
                });
              }
            });
          }
        }
      }
    });
  },

  donate(): void {
    wx.showModal({
      title: '捐赠支持',
      content: '即将跳转到腾讯公益小程序，感谢您的支持！',
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateToMiniProgram({
            appId: 'wxfdcee92a299bcaf1',
            path: 'tKUOWaEQmgv5gId',
            extraData: { from: 'SYwork排班管理系统' },
            success: () => {},
            fail: (err) => {
              console.error('跳转到腾讯公益小程序失败', err);
              wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
            }
          });
        }
      }
    });
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

  onShareAppMessage(): WechatMiniprogram.Page.IShareAppMessageOption {
    return {
      title: 'SYwork排班管理系统 - 个人中心',
      path: '/pages/profile/profile'
    };
  },

  parseChangelog(): unknown[] {
    const changelogContent = changelogData.changelogContent;

    const versions = changelogContent.split('##');
    const changelog: unknown[] = [];

    for (let i = 1; i < versions.length; i++) {
      const versionContent = versions[i].trim();
      if (!versionContent) continue;

      const lines = versionContent.split('\n');
      const versionLine = lines[0].trim();

      const versionMatch = versionLine.match(/([vV]\d+\.\d+\.\d+)(?:\.\d+)?\s+\((\d{4}-\d{2}-\d{2})\)/);

      if (versionMatch) {
        const version = versionMatch[1];
        const date = versionMatch[2];
        const contentLines = lines.slice(1);
        const content = contentLines.join('\n').trim();

        changelog.push({ version, date, content });
      }
    }

    return changelog;
  },

  onShow(): void {
    const changelog = this.parseChangelog();
    if (calculateHash(JSON.stringify(changelog)) !== calculateHash(JSON.stringify(this.data.changelog))) {
      this.setData({ changelog: changelog });
    }

    const shiftColorInfo = this.getTodayShiftColorInfo();
    if (shiftColorInfo.shiftColor !== this.data.shiftColor) {
      this.setData({
        shiftColor: shiftColorInfo.shiftColor,
        shiftGlowColor: shiftColorInfo.shiftGlowColor
      });
    }

    this.refreshDailyMessage();
    this.updateLocalUpdateTime();
    this.checkBackupStatus(false);
  },

  onShareTimeline(): WechatMiniprogram.Page.IShareTimelineOption {
    return {
      title: 'SYwork排班管理系统 - 个人中心',
      query: 'page=profile'
    };
  },

  showDataManagementHelpModal(): void {
    this.setData({ showDataManagementHelpModal: true });
  },

  hideDataManagementHelpModal(): void {
    this.setData({ showDataManagementHelpModal: false });
  },

  showCloudLoginOrRegisterModal(): void {
    if (this.data.cloudLoggedIn) {
      const pages = getCurrentPages();
      if (pages.length >= 10) {
        wx.redirectTo({
          url: '/pages/user-manage/index',
          fail: () => { this.setData({ showUserManagementModal: true }); }
        });
      } else {
        wx.navigateTo({
          url: '/pages/user-manage/index',
          fail: () => { this.setData({ showUserManagementModal: true }); }
        });
      }
      return;
    }

    wx.showActionSheet({
      itemList: ['登录已有账号', '注册新账号'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.showCloudLoginModal();
        } else if (res.tapIndex === 1) {
          this.showCloudRegisterModal();
        }
      },
      fail: (err) => {
        if ((err as Record<string, string>).errMsg !== 'showActionSheet:fail cancel') {
          console.error('showActionSheet 失败:', err);
        }
      }
    });
  },

  refreshUserInfo(): void {
    this.initPageData();
  },

  showCloudLoginModal(): void {
    this.setData({
      showCloudLoginModal: true,
      cloudAccountInput: '',
      cloudPasswordInput: '',
      rememberPassword: false
    });
  },

  hideCloudLoginModal(): void {
    this.setData({ showCloudLoginModal: false });
  },

  showCloudRegisterModal(): void {
    this.setData({
      showCloudRegisterModal: true,
      cloudAccountInput: '',
      cloudPasswordInput: '',
      cloudConfirmPassword: '',
      cloudNicknameInput: '',
      showCloudPassword: false
    });
  },

  hideCloudRegisterModal(): void {
    this.setData({ showCloudRegisterModal: false, cloudNicknameInput: '' });
  },

  async onCloudLogin(): Promise<void> {
    const { cloudAccountInput, cloudPasswordInput, rememberPassword } = this.data;
    if (!cloudAccountInput) { wx.showToast({ title: '请输入账号', icon: 'none' }); return; }
    if (!cloudPasswordInput) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }

    wx.showLoading({ title: '登录中...' });
    try {
      const result = await this.cloudManager.login(cloudAccountInput, cloudPasswordInput);
      wx.hideLoading();

      if (result.success) {
        this.handleLoginSuccess(cloudAccountInput, result);
        if (rememberPassword) { this.saveAccount(cloudAccountInput, cloudPasswordInput); }
        this.setData({ showCloudLoginModal: false });
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
      } else {
        wx.showToast({ title: result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async registerToCloud(): Promise<void> {
    const { cloudAccountInput, cloudPasswordInput, cloudConfirmPassword, cloudNicknameInput } = this.data;
    if (!cloudAccountInput) { wx.showToast({ title: '请输入账号', icon: 'none' }); return; }
    if (!cloudPasswordInput) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }
    if (cloudPasswordInput !== cloudConfirmPassword) { wx.showToast({ title: '两次密码输入不一致', icon: 'none' }); return; }

    wx.showLoading({ title: '注册中...' });
    try {
      const result = await this.cloudManager.register(cloudAccountInput, cloudPasswordInput, cloudNicknameInput || '');
      wx.hideLoading();

      if (result.success) {
        this.handleLoginSuccess(cloudAccountInput, result);
        this.setData({ showCloudRegisterModal: false });
        wx.showToast({ title: '注册成功', icon: 'success', duration: 1000 });
      } else {
        wx.showToast({ title: result.errMsg || '注册失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '注册失败', icon: 'none' });
    }
  },

  handleLoginSuccess(account: string, result: Record<string, unknown>): void {
    const data = result.data as Record<string, unknown> || {};
    const cloudUserInfo: Record<string, unknown> = {
      userId: data.userId as string,
      account: account,
      nickname: (data.nickname as string) || account,
      avatarType: (data.avatarType as string) || 'emoji',
      avatarEmoji: (data.avatarEmoji as string) || '😊',
      avatarText: (data.avatarText as string) || ''
    };
    const displayUsername = (data.nickname as string) || account;

    store.setState({
      username: displayUsername,
      avatarType: cloudUserInfo.avatarType,
      avatarEmoji: cloudUserInfo.avatarEmoji,
      cloudAccount: account,
      cloudLoggedIn: true,
      cloudUserId: data.userId as string,
      cloudUserInfo
    }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);

    (this as unknown as Record<string, unknown>).userId = data.userId;
    this.initPageData();
  },

  onCloudAccountInput(e: WechatMiniprogram.Input): void {
    this.setData({ cloudAccountInput: e.detail.value });
  },

  onCloudPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ cloudPasswordInput: e.detail.value });
  },

  onCloudConfirmPasswordInput(e: WechatMiniprogram.Input): void {
    this.setData({ cloudConfirmPassword: e.detail.value });
  },

  onCloudNicknameInput(e: WechatMiniprogram.Input): void {
    this.setData({ cloudNicknameInput: e.detail.value });
  },

  toggleCloudPasswordVisibility(): void {
    this.setData({ showCloudPassword: !this.data.showCloudPassword });
  },

  saveAccount(account: string, password: string): void {
    try {
      let savedAccounts = store.getState('savedAccounts') as SavedAccount[] || [];

      const avatarEmoji = this.data.avatarEmoji;
      const avatarType = this.data.avatarType;
      const avatarText = this.data.avatarText;
      const emojiEmotion = this.data.emojiEmotion || 'neutral';

      const existingIndex = savedAccounts.findIndex(item => item.account === account);

      const encryptedPwd = this.data.rememberPassword ? encryptPassword(password) : '';
      const pwdHash = this.data.rememberPassword ? hashPassword(password) : '';

      const accountData: SavedAccount = {
        account: account,
        password: encryptedPwd,
        passwordHash: pwdHash,
        lastLogin: new Date().toISOString(),
        avatarType: avatarType || 'emoji',
        avatarEmoji: avatarEmoji || '😊',
        avatarText: avatarText || '',
        avatarEmojiEmotion: emojiEmotion
      };

      if (existingIndex >= 0) {
        savedAccounts[existingIndex] = accountData;
      } else {
        savedAccounts.push(accountData);
      }

      if (savedAccounts.length > 5) {
        savedAccounts = savedAccounts.sort((a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()).slice(0, 5);
      }

      store.setState({ savedAccounts }, ['savedAccounts']);
      this.setData({ savedAccounts: savedAccounts });
    } catch (e) {
      console.error('保存账号失败:', e);
    }
  },

  toggleRememberPassword(): void {
    this.setData({ rememberPassword: !this.data.rememberPassword });
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
      lastCloudCheckTime: 0,
      cachedCloudStatus: null,
      backupStatus: { type: 'unbacked', label: STATUS_TEXT.NOT_LOGGED_IN }
    });
    store.removeState(
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo'],
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']
    );
    (this as unknown as Record<string, unknown>).userId = null;

    wx.showToast({ title: '已退出登录', icon: 'success' });
  },

  async backupToCloud(): Promise<void> {
    if (!this.data.cloudLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认备份',
      content: '备份操作将把本地数据同步到云端，是否继续？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const cloudManager = this.data.cloudManager as { backup(): Promise<Record<string, unknown>> };
          const result = await cloudManager.backup();

          if (result.success) {
            const syncHash = this.computeLocalHash();
            wx.setStorageSync('lastSyncHash', syncHash);
            const now = Date.now();
            store.setState({ _lastDataModified: now, lastBackupTime: now }, ['_lastDataModified', 'lastBackupTime']);
            this.updateLocalUpdateTime();

            // 直接缓存为 SYNCED，不依赖云端查询
            const syncTimeStr = this.formatBackupTime(new Date(now).toISOString());
            this.setData({
              lastSyncHash: syncHash,
              lastCloudCheckTime: now,
              cachedCloudStatus: {
                status: 'has_backup',
                time: new Date(now).toISOString(),
                hash: syncHash
              },
              backupStatus: {
                type: 'synced',
                label: STATUS_TEXT.SYNCED + ' ' + syncTimeStr
              }
            });
          }
        } catch (e) {
          console.error('备份失败', e);
          wx.showToast({ title: '备份失败', icon: 'none' });
        }
      }
    });
  },

  async restoreFromCloud(): Promise<void> {
    if (!this.data.cloudLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认恢复',
      content: '恢复操作将把云端数据同步到本地，是否继续？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const cloudManager = this.data.cloudManager as { restore(): Promise<Record<string, unknown>> };
          const result = await cloudManager.restore();

          if (result.success) {
            const syncHash = this.computeLocalHash();
            wx.setStorageSync('lastSyncHash', syncHash);
            const now = Date.now();
            store.setState({ _lastDataModified: now, lastBackupTime: now, lastRestoreTime: now }, ['_lastDataModified', 'lastBackupTime', 'lastRestoreTime']);
            this.updateLocalUpdateTime();

            // 直接缓存为 SYNCED，不依赖云端查询
            const syncTimeStr = this.formatBackupTime(new Date(now).toISOString());
            this.setData({
              lastSyncHash: syncHash,
              lastCloudCheckTime: now,
              cachedCloudStatus: {
                status: 'has_backup',
                time: new Date(now).toISOString(),
                hash: syncHash
              },
              backupStatus: {
                type: 'synced',
                label: STATUS_TEXT.SYNCED + ' ' + syncTimeStr
              }
            });
          }
        } catch (e) {
          console.error('恢复失败', e);
          wx.showToast({ title: '恢复失败', icon: 'none' });
        }
      }
    });
  },

  formatDate(isoString: string): string {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `今天 ${hours}:${minutes}`;
      } else if (diffDays === 1) {
        return '昨天';
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      }

      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      if (year === now.getFullYear().toString()) {
        return `${month}/${day}`;
      }
      return `${year}/${month}/${day}`;
    } catch (e) {
      return isoString.substring(0, 10);
    }
  },

  computeLocalHash(): string {
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    const shifts = wx.getStorageSync('shifts') || {};
    const combined = JSON.stringify(shiftTemplates) + JSON.stringify(shifts);
    return calculateHash(combined);
  },

  updateLocalUpdateTime(): void {
    let latestTime = store.getState('_lastDataModified') as number || 0;
    const lastBackupTime = store.getState('lastBackupTime') as number || 0;
    if (lastBackupTime > latestTime) latestTime = lastBackupTime;
    this.setData({ lastLocalUpdate: latestTime || Date.now() });
  },

  formatBackupTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return month + '-' + day + ' ' + hh + ':' + mm;
  },

  updateBackupStatusUI(cache: Record<string, unknown>): void {
    if (!cache || !cache.status || cache.status === 'no_backup') {
      this.setData({ backupStatus: { type: 'unbacked', label: STATUS_TEXT.UNBACKED } });
      return;
    }
    const localHash = this.computeLocalHash();
    const effectiveHash = (cache.hash as string) || '';
    const { lastLocalUpdate, lastSyncHash } = this.data;
    const backupTime = cache.time ? new Date(cache.time as string).getTime() : 0;

    // 核心原则：只要 lastSyncHash 存在且 localHash === lastSyncHash，
    // 就说明自上次备份以来本地数据没有变动，状态必须是 "已同步"。
    // 云端 hash 仅作快速匹配用，不作为唯一判定依据 ——
    // JSON.stringify 的 key 顺序差异（wx.getStorageSync 与 MongoDB BSON 反序列化之间）
    // 可能导致相同数据计算出不同 hash，但 localHash vs lastSyncHash 永远是同一环境下的一致性比较。
    if (lastSyncHash && localHash === lastSyncHash) {
      const syncTime = backupTime || lastLocalUpdate;
      const syncTimeStr = syncTime ? this.formatBackupTime(new Date(syncTime).toISOString()) : '';
      this.setData({
        backupStatus: { type: 'synced', label: STATUS_TEXT.SYNCED + (syncTimeStr ? ' ' + syncTimeStr : '') }
      });
      return;
    }

    // localHash !== lastSyncHash：本地确实有变动
    // 再尝试用云端 hash 做快速匹配（云端刚完成备份的情况）
    // 注意：如果 lastSyncHash 为空，说明设备从未执行过同步操作，
    // 即使 localHash === effectiveHash，也应该显示"云端最新"，而不是"已同步"
    if (effectiveHash && localHash === effectiveHash && lastSyncHash) {
      const syncTime = backupTime || lastLocalUpdate;
      const syncTimeStr = syncTime ? this.formatBackupTime(new Date(syncTime).toISOString()) : '';
      this.setData({
        backupStatus: { type: 'synced', label: STATUS_TEXT.SYNCED + (syncTimeStr ? ' ' + syncTimeStr : '') }
      });
      return;
    }

    // 本地有变动且云端 hash 不匹配 → 按时间判断谁更新
    const localTimeStr = lastLocalUpdate ? this.formatBackupTime(new Date(lastLocalUpdate).toISOString()) : '';
    const cloudTimeStr = cache.time ? this.formatBackupTime(cache.time as string) : '';

    if (!cache.time || (backupTime && lastLocalUpdate > backupTime)) {
      this.setData({
        backupStatus: { type: 'local_newer', label: STATUS_TEXT.LOCAL_NEWER + (localTimeStr ? ' ' + localTimeStr : '') }
      });
    } else {
      this.setData({
        backupStatus: { type: 'cloud_newer', label: STATUS_TEXT.CLOUD_NEWER + (cloudTimeStr ? ' ' + cloudTimeStr : '') }
      });
    }
  },

  useCachedStatus(fallback?: BackupStatus): void {
    const { cachedCloudStatus } = this.data;
    if (cachedCloudStatus) {
      this.updateBackupStatusUI(cachedCloudStatus as Record<string, unknown>);
    } else if (fallback) {
      this.setData({ backupStatus: fallback });
    } else if (this.data.cloudLoggedIn) {
      // 没有缓存也没有显式回退值 → 兜底为未备份
      this.setData({ backupStatus: { type: 'unbacked', label: STATUS_TEXT.UNBACKED } });
    }
  },

  handleFetchSuccess(info: Record<string, unknown>): void {
    const now = Date.now();
    const cloudTime = (info.backupTime as string) || store.getState('lastBackupTime') || null;
    // 注意：空字符串 "" 应明确视为"无云端hash"，不应 fallthrough 到 lastSyncHash
    // 只有 null/undefined 时才降级使用本地缓存的 lastSyncHash
    const rawHash = info.backupHash;
    const cloudHash = (typeof rawHash === 'string' && rawHash.length > 0)
      ? rawHash
      : (this.data.lastSyncHash || null);
    const newCache = {
      status: info.hasBackup ? 'has_backup' : 'no_backup',
      time: cloudTime,
      hash: cloudHash
    };
    this.setData({ lastCloudCheckTime: now, cachedCloudStatus: newCache });
    this.updateBackupStatusUI(newCache);
  },

  tryLocalHashShortCircuit(): boolean {
    const localHash = this.computeLocalHash();
    const { lastSyncHash, cachedCloudStatus } = this.data;
    if (lastSyncHash && localHash === lastSyncHash) {
      // 只在缓存未过期时走短路，避免忽略云端更新
      if (cachedCloudStatus && (Date.now() - this.data.lastCloudCheckTime < CACHE_TTL)) {
        this.setData({ lastCloudCheckTime: Date.now() });
        this.useCachedStatus();
        return true;
      }
      // 缓存已过期但本地无变化 → 不走短路，让远端请求判断
      return false;
    }
    return false;
  },

  shouldRefreshCache(forceRefresh: boolean): boolean {
    const { lastCloudCheckTime, lastSyncHash } = this.data;
    const now = Date.now();
    if (forceRefresh) return true;
    // 本地数据是否真的有变动（用 hash 比对，不用不可靠的时间戳）
    const localHash = this.computeLocalHash();
    if (lastSyncHash && localHash !== lastSyncHash) return true;
    // 缓存过期则刷新
    if (now - lastCloudCheckTime > CACHE_TTL) return true;
    return false;
  },

  async checkBackupStatus(forceRefresh: boolean): Promise<void> {
    if (!this.data.cloudLoggedIn) {
      this.setData({ backupStatus: { type: 'unbacked', label: STATUS_TEXT.NOT_LOGGED_IN } });
      return;
    }
    if (forceRefresh) {
      this.setData({ backupStatus: { type: 'checking', label: STATUS_TEXT.CHECKING } });
    }
    if (!this.shouldRefreshCache(forceRefresh)) {
      this.useCachedStatus();
      return;
    }
    if (!forceRefresh && this.tryLocalHashShortCircuit()) {
      return;
    }
    try {
      const cloudManager = this.data.cloudManager as { getLatestBackupInfo(): Promise<Record<string, unknown>> };
      const info = await cloudManager.getLatestBackupInfo();
      if (info.success) {
        this.handleFetchSuccess(info);
      } else {
        // info.success === false 且无缓存 → 降级为未备份 / 错误提示
        if (!this.data.cachedCloudStatus) {
          this.setData({ backupStatus: { type: 'unbacked', label: STATUS_TEXT.UNBACKED } });
        } else {
          this.useCachedStatus({ type: 'unbacked', label: STATUS_TEXT.UNBACKED });
        }
      }
    } catch (e) {
      console.error('检查备份状态失败', e);
      // 异常降级：有缓存用缓存，无缓存显示错误
      if (this.data.cachedCloudStatus) {
        this.useCachedStatus();
      } else {
        this.setData({ backupStatus: { type: 'error', label: STATUS_TEXT.ERROR } });
      }
    }
  },

  onCloudStatusTap(): void {
    this.checkBackupStatus(true);
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

  navigateToAgreement(): void {
    wx.navigateTo({
      url: '/subpkg-common/pages/agreement/agreement'
    });
  }
});
