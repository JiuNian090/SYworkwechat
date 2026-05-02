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

interface PolicySection {
  heading: string;
  icon: string;
  items: string[];
}

interface PolicyContent {
  title: string;
  icon: string;
  color: string;
  sections: PolicySection[];
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
    showPolicyModal: false,
    currentPolicyType: '',
    policyTitle: '',
    policyIcon: '',
    policyColor: '',
    policySections: [] as PolicySection[],
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
            success: (res) => { console.log('跳转到腾讯公益小程序成功', res); },
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

      const cloudUserInfo = this.data.cloudUserInfo as Record<string, unknown> | null;
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
            this.setData({ lastSyncHash: syncHash });
            store.setState({ lastBackupTime: Date.now() }, ['lastBackupTime']);
            this.updateLocalUpdateTime();
            this.checkBackupStatus(true);
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
            this.setData({ lastSyncHash: syncHash });
            store.setState({ lastBackupTime: Date.now(), lastRestoreTime: Date.now() }, ['lastBackupTime', 'lastRestoreTime']);
            this.updateLocalUpdateTime();
            this.checkBackupStatus(true);
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
    let latestTime = 0;
    const shifts = wx.getStorageSync('shifts') || {};
    Object.keys(shifts).forEach(dateKey => {
      const ts = new Date(dateKey).getTime();
      if (!isNaN(ts) && ts > latestTime) { latestTime = ts; }
    });
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    shiftTemplates.forEach((tpl: Record<string, unknown>) => {
      if (tpl.updatedTime) {
        const ts = new Date(tpl.updatedTime as string).getTime();
        if (!isNaN(ts) && ts > latestTime) { latestTime = ts; }
      }
    });
    const lastBackupTime = store.getState('lastBackupTime') as number || 0;
    if (lastBackupTime > latestTime) { latestTime = lastBackupTime; }
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
    const effectiveHash = (cache.hash as string) || this.data.lastSyncHash || '';
    const timeStr = cache.time ? this.formatBackupTime(cache.time as string) : '';
    if (effectiveHash && localHash === effectiveHash) {
      this.setData({
        backupStatus: { type: 'synced', label: STATUS_TEXT.SYNCED + (timeStr ? ' ' + timeStr : '') }
      });
      return;
    }
    const { lastLocalUpdate } = this.data;
    const backupTime = cache.time ? new Date(cache.time as string).getTime() : 0;
    if (!cache.time || (backupTime && lastLocalUpdate > backupTime)) {
      this.setData({
        backupStatus: { type: 'local_newer', label: STATUS_TEXT.LOCAL_NEWER + (timeStr ? ' ' + timeStr : '') }
      });
    } else {
      this.setData({
        backupStatus: { type: 'cloud_newer', label: STATUS_TEXT.CLOUD_NEWER + (timeStr ? ' ' + timeStr : '') }
      });
    }
  },

  async checkBackupStatus(forceRefresh: boolean): Promise<void> {
    const { cloudLoggedIn } = this.data;
    if (!cloudLoggedIn) {
      this.setData({ backupStatus: { type: 'unbacked', label: STATUS_TEXT.NOT_LOGGED_IN } });
      return;
    }
    if (forceRefresh) {
      this.setData({ backupStatus: { type: 'checking', label: STATUS_TEXT.CHECKING } });
    }
    const now = Date.now();
    const { lastCloudCheckTime, cachedCloudStatus, lastLocalUpdate } = this.data;
    let shouldFetch = !!forceRefresh;
    if (!shouldFetch && lastLocalUpdate > lastCloudCheckTime) { shouldFetch = true; }
    if (!shouldFetch && (now - lastCloudCheckTime > CACHE_TTL)) { shouldFetch = true; }
    if (shouldFetch) {
      try {
        const cloudManager = this.data.cloudManager as { getLatestBackupInfo(): Promise<Record<string, unknown>> };
        const info = await cloudManager.getLatestBackupInfo();
        if (info.success) {
          const cloudTime = (info.backupTime as string) || store.getState('lastBackupTime') || null;
          const cloudHash = (info.backupHash as string) || this.data.lastSyncHash || null;
          const newCache = {
            status: info.hasBackup ? 'has_backup' : 'no_backup',
            time: cloudTime,
            hash: cloudHash
          };
          this.setData({ lastCloudCheckTime: now, cachedCloudStatus: newCache });
          this.updateBackupStatusUI(newCache);
        } else {
          if (cachedCloudStatus) {
            this.updateBackupStatusUI(cachedCloudStatus as Record<string, unknown>);
          } else {
            this.setData({ backupStatus: { type: 'unbacked', label: STATUS_TEXT.UNBACKED } });
          }
        }
      } catch (e) {
        console.error('检查备份状态失败', e);
        if (cachedCloudStatus) {
          this.updateBackupStatusUI(cachedCloudStatus as Record<string, unknown>);
        }
      }
    } else {
      if (cachedCloudStatus) {
        this.updateBackupStatusUI(cachedCloudStatus as Record<string, unknown>);
      } else {
        this.setData({ backupStatus: { type: 'checking', label: STATUS_TEXT.CHECKING } });
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

  getPolicyContent(type: string): PolicyContent | null {
    const policies: Record<string, PolicyContent> = {
      dataSecurity: {
        title: '数据安全声明',
        icon: '🔒',
        color: '#10b981',
        sections: [
          { heading: '数据存储', icon: '💾', items: ['本小程序默认将所有数据存储在您的微信小程序本地存储中，不会上传至任何第三方服务器', '本地数据存储采用微信小程序的安全机制，保障数据的安全性'] },
          { heading: '云备份功能', icon: '☁️', items: ['云备份功能为可选功能，您可以选择是否使用', '使用云备份功能时，数据将存储在腾讯云微信云开发服务中', '云备份的数据采用加密存储，您的账号和密码将进行加密处理'] },
          { heading: '数据保护', icon: '🛡️', items: ['您的数据属于您个人，我们不会查看、使用或分享您的数据', '请妥善保管您的云备份账号和密码，避免数据泄露', '建议您定期备份重要数据，以防数据丢失'] },
          { heading: '免责声明', icon: '⚠️', items: ['本小程序致力于保护您的数据安全，但无法保证绝对的安全', '因不可抗力、设备故障等原因造成的数据丢失，开发者不承担责任'] }
        ]
      },
      privacy: {
        title: '隐私政策',
        icon: '🔐',
        color: '#3b82f6',
        sections: [
          { heading: '信息收集', icon: '📋', items: ['本小程序仅收集您主动填写的信息，包括用户名、排班数据等', '我们不会收集您的微信个人信息、通讯录、地理位置等敏感信息', '您可以随时编辑或删除您的个人信息'] },
          { heading: '信息使用', icon: '✅', items: ['您提供的信息仅用于小程序的功能运行，不会用于其他目的', '我们不会将您的信息出售、出租或分享给任何第三方'] },
          { heading: '信息保护', icon: '🛡️', items: ['我们采取合理的技术措施保护您的信息安全', '数据传输过程中采用加密技术，防止数据泄露', '本地数据存储在您的设备上，您拥有完全控制权'] },
          { heading: '变更说明', icon: '📝', items: ['我们可能会不时更新本隐私政策', '隐私政策更新后，将在小程序中公示'] }
        ]
      },
      disclaimer: {
        title: '免责声明',
        icon: '⚠️',
        color: '#f59e0b',
        sections: [
          { heading: '使用说明', icon: '📱', items: ['本小程序为免费公益项目，仅供个人使用', '您可以自由使用本小程序，但请遵守法律法规'] },
          { heading: '功能说明', icon: '⚙️', items: ['本小程序尽力提供准确、稳定的功能，但不保证功能的绝对可用性', '因网络问题、系统升级等原因导致的服务中断，开发者不承担责任'] },
          { heading: '内容责任', icon: '📄', items: ['您对自己输入和使用的数据负全部责任', '您不应使用本小程序存储敏感或重要信息', '因数据丢失、泄露造成的损失，开发者不承担赔偿责任'] },
          { heading: '法律合规', icon: '⚖️', items: ['使用本小程序即表示您同意本免责声明', '本免责声明的解释权归开发者所有', '如有争议，应通过友好协商解决'] }
        ]
      }
    };
    return policies[type] || null;
  },

  showDataSecurity(): void {
    const policy = this.getPolicyContent('dataSecurity');
    if (policy) {
      this.setData({
        showPolicyModal: true,
        currentPolicyType: 'dataSecurity',
        policyTitle: policy.title,
        policyIcon: policy.icon,
        policyColor: policy.color,
        policySections: policy.sections
      });
    }
  },

  showPrivacyPolicy(): void {
    const policy = this.getPolicyContent('privacy');
    if (policy) {
      this.setData({
        showPolicyModal: true,
        currentPolicyType: 'privacy',
        policyTitle: policy.title,
        policyIcon: policy.icon,
        policyColor: policy.color,
        policySections: policy.sections
      });
    }
  },

  showDisclaimer(): void {
    const policy = this.getPolicyContent('disclaimer');
    if (policy) {
      this.setData({
        showPolicyModal: true,
        currentPolicyType: 'disclaimer',
        policyTitle: policy.title,
        policyIcon: policy.icon,
        policyColor: policy.color,
        policySections: policy.sections
      });
    }
  },

  hidePolicyModal(): void {
    this.setData({
      showPolicyModal: false,
      currentPolicyType: '',
      policyTitle: '',
      policyIcon: '',
      policyColor: '',
      policySections: []
    });
  }
});
