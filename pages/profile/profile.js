'use strict';
// pages/profile/profile.js
const changelogData = require('../../utils/changelog.js');
const emojiManager = require('../../utils/emojiManager.js');
const CloudManager = require('../../utils/cloudManager.js');
const AvatarManager = require('../../utils/avatarManager.js');
const DataExportManager = require('../../utils/dataExportManager.js');
const DataImportManager = require('../../utils/dataImportManager.js');
const DataClearManager = require('../../utils/dataClearManager.js');
const { store } = require('../../utils/store.js');
const { encryptPassword, decryptPassword, hashPassword, verifyPassword, isOldFormat, calculateHash } = require('../../utils/encrypt.js');
const { getDailyMessage } = require('../../utils/dailyMessage.js');

const STATUS_TEXT = {
  SYNCED: '已同步',
  LOCAL_NEWER: '本地最新',
  CLOUD_NEWER: '云端最新',
  UNBACKED: '未备份',
  NOT_LOGGED_IN: '未备份 / 未登录',
  CHECKING: '检查中...',
  ERROR: '检查失败'
};

const CACHE_TTL = 300000; // 5分钟缓存有效期

Page({
  data: {
    todayMessage: '',
    _lastMessage: '',
    _lastTimePeriod: '',
    exportFileName: '',
    // 完整数据导出相关变量
    exportedFilePath: '',
    exportedFileName: '',
    // 模板导出相关变量
    exportedTemplateFilePath: '',
    exportedTemplateFileName: '',
    exportSuccess: false,
    exportFail: false,
    loading: false,
    username: '', // 用户名
    avatarText: '用', // 头像文字
    avatarEmoji: '', // 头像表情
    avatarType: 'text', // 头像类型：text或emoji
    emojiText: '', // 表情对应的文字信息
    emojiEmotion: '', // 表情对应的情绪类型
    showUsernameModal: false, // 用户名设置弹窗显示状态
    tempUsername: '', // 临时存储用户输入的用户名
    showFileNameModal: false, // 文件名设置弹窗显示状态
    tempFileName: '', // 临时存储用户输入的文件名
    defaultFileNameHint: '', // 默认文件名提示
    // 数据类型选择相关变量
    showDataTypeModal: false, // 数据类型选择弹窗显示状态
    selectedDataTypes: [], // 选中的数据类型
    dataTypes: [ // 可选择的数据类型
      { id: 'shiftTemplates', name: '班次模板', checked: false },
      { id: 'shifts', name: '排班数据', checked: false },
      { id: 'scheduleImages', name: '排班图片', checked: false }
    ],
    // 云备份设置
    cloudManager: null,
    cloudLoggedIn: false,
    cloudAccount: '',
    // 云备份登录/注册弹窗
    showCloudLoginModal: false,
    showCloudRegisterModal: false,
    cloudAccountInput: '',
    cloudPasswordInput: '',
    cloudConfirmPassword: '',
    cloudNicknameInput: '',
    showCloudPassword: false,
    rememberPassword: false,
    // 已登录账号列表
    savedAccounts: [],
    // 账号自动恢复勾选状态
    autoRestoreMap: {},

    // 用户管理弹窗
    showUserManagementModal: false,
    currentUserPage: 'main', // main, updateNickname, updatePassword, deleteAccount, avatar
    showUpdateNicknameModal: false,
    showUpdatePasswordModal: false,
    showDeleteAccountModal: false,
    newNickname: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    deleteAccountPassword: '',
    // 数据管理使用说明弹窗
    showDataManagementHelpModal: false,
    // 更新日志数据
    changelog: [],

    // 云备份状态指示器
    lastCloudCheckTime: 0,
    cachedCloudStatus: null,
    lastLocalUpdate: 0,
    backupStatus: null,
    lastSyncHash: '',
    // 表情相关数据
    emojiCategories: emojiManager.getCategories(),
    currentEmojiCategory: 'face',
    selectedEmoji: '',
    shiftColor: '#07c160',
    shiftGlowColor: 'rgba(7, 193, 96, 0.6)',

    // 头像选择器
    avatarMode: 'emoji',          // 'emoji' | 'text'
    avatarModeCategory: 'face',   // 当前表情分类
    avatarModeEmojis: emojiManager.getCategoryEmojis('face'),
    avatarModeEmoji: '',          // 当前选中的表情
    avatarModeText: '',           // 当前文字头像字符
    avatarModeTextInput: '',      // 文字输入框内容
    textInputFocus: false        // 文字输入框自动聚焦
  },

  // 初始化各个管理器
  onLoad() {
    // 初始化云开发管理器
    this.cloudManager = new CloudManager();
    // 初始化头像管理器
    this.avatarManager = new AvatarManager();
    // 初始化数据导出管理器
    this.dataExportManager = new DataExportManager();
    // 初始化数据导入管理器
    this.dataImportManager = new DataImportManager();
    // 初始化数据清空管理器
    this.dataClearManager = new DataClearManager();

    // 调用原有的onLoad逻辑
    this.initPageData();
  },

  getTodayShiftColorInfo() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const shifts = wx.getStorageSync('shifts') || {};
    const todayShift = shifts[dateStr];
    const color = (todayShift && todayShift.color) ? todayShift.color : '#07c160';
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      shiftColor: color,
      shiftGlowColor: `rgba(${r}, ${g}, ${b}, 0.6)`
    };
  },

  /**
   * 获取当前时段
   * @param {number} hour 当前小时
   * @returns {string} 时段名称
   */
  _getTimePeriod(hour) {
    if (hour >= 0 && hour < 6) {
      return '凌晨';
    } else if (hour >= 6 && hour < 8) {
      return '清晨';
    } else if (hour >= 8 && hour < 12) {
      return '上午';
    } else if (hour >= 12 && hour < 18) {
      return '下午';
    } else if (hour >= 18 && hour < 22) {
      return '晚上';
    } else {
      return '深夜';
    }
  },

  /**
   * 刷新今日心语
   */
  refreshDailyMessage() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentTimePeriod = this._getTimePeriod(currentHour);
    
    // 获取昵称
    let nickname = '';
    const cloudUserInfo = this.data.cloudUserInfo || store.getState('cloudUserInfo');
    if (cloudUserInfo && cloudUserInfo.nickname) {
      nickname = cloudUserInfo.nickname;
    } else {
      const username = this.data.username || store.getState('username');
      if (username) {
        nickname = username;
      }
    }
    
    // 获取排班数据
    const shifts = wx.getStorageSync('shifts') || {};
    
    // 生成消息
    const newMessage = getDailyMessage(nickname, shifts, now);
    
    // 只有当消息变化或时段变化时才更新，避免闪烁
    if (newMessage !== this.data._lastMessage || currentTimePeriod !== this.data._lastTimePeriod) {
      this.setData({
        todayMessage: newMessage,
        _lastMessage: newMessage,
        _lastTimePeriod: currentTimePeriod
      });
    }
  },

  initPageData() {
    const cloudInitialized = store.getState('cloudInitialized');

    // 刷新今日心语
    this.refreshDailyMessage();

    const cloudUserId = store.getState('cloudUserId');
    const cloudAccount = store.getState('cloudAccount') || '';
    const cloudUserInfo = store.getState('cloudUserInfo');
    const cloudLoggedIn = !!cloudUserId;

    let username = store.getState('username') || '';
    if (cloudLoggedIn && cloudUserInfo) {
      username = cloudUserInfo.nickname || cloudAccount;
      store.setState({ username }, ['username']);
    }
    this.userId = cloudUserId;

    let avatarInfo;
    if (cloudLoggedIn && cloudUserInfo) {
      avatarInfo = this.avatarManager.initAvatarFromCloud(cloudUserInfo);
    } else {
      avatarInfo = this.avatarManager.initAvatarInfo();
    }

    const changelog = this.parseChangelog();

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

    let lastSyncHash = '';
    try {
      lastSyncHash = wx.getStorageSync('lastSyncHash') || '';
    } catch (e) {}

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

  // 跳转到使用说明页面
  navigateToDocs(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: '/subpkg-common/pages/docs/docs?type=' + type
    });
  },

  // 从云端获取最新的头像信息
  async getLatestAvatarFromCloud() {
    try {
      const { cloudUserInfo } = this.data;
      const avatarInfo = await this.avatarManager.getLatestAvatarFromCloud(cloudUserInfo);
      if (avatarInfo) {
        // 更新页面数据
        this.setData({
          username: avatarInfo.username,
          avatarType: avatarInfo.avatarType,
          avatarEmoji: avatarInfo.avatarEmoji,
          avatarText: avatarInfo.avatarText,
          emojiText: avatarInfo.emojiText,
          emojiEmotion: avatarInfo.emojiEmotion,
          cloudUserInfo: avatarInfo.cloudUserInfo
        });

        // 通知其他页面更新头像信息
        this.updateAvatarInOtherPages();
      }
    } catch (e) {
      console.error('从云端获取头像信息失败', e);
      // 获取失败不影响本地操作
    }
  },

  // 显示用户名设置弹窗
  showUsernameModal() {
    this.setData({
      tempUsername: this.data.username,
      showUsernameModal: true
    });
  },

  // 隐藏用户名设置弹窗
  hideUsernameModal() {
    this.setData({
      showUsernameModal: false
    });
  },

  // 处理临时用户名输入
  onTempUsernameInput(e) {
    this.setData({
      tempUsername: e.detail.value
    });
  },

  // 确认用户名设置
  confirmUsername() {
    const username = this.data.tempUsername;
    if (!username.trim()) {
      wx.showToast({
        title: '用户名不能为空',
        icon: 'none'
      });
      return;
    }

    // 生成新的头像文字
    const avatarText = this.generateAvatarText(username);

    this.setData({
      username: username,
      avatarText: avatarText,
      showUsernameModal: false
    });

    store.setState({ username }, ['username']);

    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 进入头像选择界面
  showEmojiModal() {
    const { avatarType, avatarEmoji, username } = this.data;
    const currentText = avatarType === 'text' ? (username ? username.charAt(0).toUpperCase() : '') : '';
    this.setData({
      avatarMode: avatarType || 'emoji',
      avatarModeCategory: 'face',
      avatarModeEmojis: emojiManager.getCategoryEmojis('face'),
      avatarModeEmoji: avatarType === 'emoji' ? (avatarEmoji || '😊') : '',
      avatarModeText: currentText || '用',
      avatarModeTextInput: currentText || '',
      currentUserPage: 'avatar'
    });
  },

  // 切换头像模式（表情/文字）
  onAvatarModeSwitch(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.avatarMode) return;
    this.setData({
      avatarMode: mode,
      textInputFocus: mode === 'text'
    });
  },

  // 切换表情分类
  onAvatarCategorySwitch(e) {
    const categoryId = e.currentTarget.dataset.category;
    this.setData({
      avatarModeCategory: categoryId,
      avatarModeEmojis: emojiManager.getCategoryEmojis(categoryId)
    });
  },

  // 选择表情
  onAvatarEmojiPick(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({
      avatarModeEmoji: emoji
    });
  },

  // 文字头像输入
  onAvatarTextInput(e) {
    const val = e.detail.value.trim();
    this.setData({
      avatarModeTextInput: val,
      avatarModeText: val || '用'
    });
  },

  // 文字头像确认（键盘回车）
  onAvatarTextConfirm() {
    // 不做特殊处理，用户点击"确定"按钮时统一提交
  },

  // 获取表情描述
  getEmojiDesc(emoji) {
    return emojiManager.getEmojiText(emoji) || '';
  },

  // 统一确认头像选择
  onAvatarConfirm() {
    const { avatarMode, avatarModeEmoji, avatarModeText } = this.data;

    if (avatarMode === 'emoji') {
      if (!avatarModeEmoji) {
        wx.showToast({
          title: '请选择一个表情',
          icon: 'none'
        });
        return;
      }
      const emojiText = emojiManager.getEmojiText(avatarModeEmoji) || '';
      const emojiEmotion = emojiManager.getEmojiEmotion(avatarModeEmoji) || 'neutral';

      this.setData({
        avatarEmoji: avatarModeEmoji,
        avatarType: 'emoji',
        emojiText: emojiText,
        emojiEmotion: emojiEmotion,
        selectedEmoji: avatarModeEmoji,
        currentUserPage: 'main'
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
        currentUserPage: 'main'
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

    wx.showToast({
      title: '头像已更新',
      icon: 'success'
    });
  },

  // 切换回文字头像 - 已禁用
  switchToTextAvatar() {
    wx.showToast({
      title: '文字头像功能已关闭',
      icon: 'none'
    });
  },

  // 显示数据类型选择弹窗
  showDataTypeModal() {
    // 重置数据类型选择状态
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

  // 隐藏数据类型选择弹窗
  hideDataTypeModal() {
    this.setData({
      showDataTypeModal: false
    });
  },

  // 处理数据类型选择
  onDataTypeSelect(e) {
    const dataTypeId = e.currentTarget.dataset.typeid;

    // 更新数据类型选择状态
    const updatedDataTypes = this.data.dataTypes.map(type => {
      if (type.id === dataTypeId) {
        return {
          ...type,
          checked: !type.checked
        };
      }
      return type;
    });

    // 获取选中的数据类型
    const selectedDataTypes = updatedDataTypes
      .filter(type => type.checked)
      .map(type => type.id);

    this.setData({
      dataTypes: updatedDataTypes,
      selectedDataTypes: selectedDataTypes
    });
  },

  // 确认数据类型选择，进入文件名设置
  confirmDataTypeSelect() {
    if (this.data.selectedDataTypes.length === 0) {
      wx.showToast({
        title: '请至少选择一种数据类型',
        icon: 'none'
      });
      return;
    }

    // 隐藏数据类型选择弹窗
    this.hideDataTypeModal();

    // 显示文件名设置弹窗
    this.showFileNameModal();
  },

  // 显示文件名设置弹窗
  showFileNameModal() {
    // 设置默认文件名提示：用户名+数据类型+当前时间
    const username = this.data.username || '未命名用户';
    const selectedDataTypes = this.data.selectedDataTypes;
    const allDataTypes = this.data.dataTypes.map(type => type.id);

    const currentDate = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/[\/\s:]/g, '-');

    let defaultFileNameHint;

    // 检查是否全选了所有导出项目
    const isAllSelected = selectedDataTypes.length === allDataTypes.length && selectedDataTypes.every(type => allDataTypes.includes(type));

    if (isAllSelected) {
      // 全选时使用"用户名+备份+日期"格式
      defaultFileNameHint = `${username}+备份+${currentDate}`;
    } else {
      // 非全选时使用原格式：用户名+数据类型+当前时间
      const dataTypeNames = this.data.dataTypes
        .filter(type => selectedDataTypes.includes(type.id))
        .map(type => type.name)
        .join('+');

      const currentTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/[\/\s:]/g, '-');

      defaultFileNameHint = `${username}+${dataTypeNames}+${currentTime}`;
    }

    this.setData({
      tempFileName: defaultFileNameHint,
      defaultFileNameHint: defaultFileNameHint,
      showFileNameModal: true
    });
  },

  // 隐藏文件名设置弹窗
  hideFileNameModal() {
    this.setData({
      showFileNameModal: false
    });
  },

  // 处理临时文件名输入
  onTempFileNameInput(e) {
    this.setData({
      tempFileName: e.detail.value
    });
  },

  // 确认导出
  confirmExport() {
    // 获取用户输入的文件名
    const customFileName = this.data.tempFileName;

    // 隐藏弹窗
    this.hideFileNameModal();

    // 导出选择的数据类型
    this.dataExportManager.exportSelectedData(this.data.selectedDataTypes, customFileName, (result) => {
      if (result) {
        // 更新页面数据
        this.setData({
          exportedFilePath: result.filePath,
          exportedFileName: result.fileName
        });
      }
    });
  },

  // 分享导出的文件给好友
  shareExportedFile() {
    this.dataExportManager.shareExportedFile();
  },

  // 分享导出的模板文件给好友
  shareTemplate() {
    this.dataExportManager.shareTemplate();
  },

  importData() {
    this.dataImportManager.importData();
  },






  // 清空所有数据（包括班次模板）
  clearAllData() {
    this.dataClearManager.clearAllData();
  },


  // 联系作者功能
  contactAuthor() {
    wx.showModal({
      title: '联系作者',
      content: '是否要发送邮件给qiuqile@petalmail.com？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 使用微信小程序的邮件功能
          if (wx.canIUse('openEmail')) {
            wx.openEmail({
              recipients: ['qiuqile@petalmail.com'],
              subject: '关于SYwork排班管理系统',
              body: '您好，我在使用SYwork排班管理系统时遇到了一些问题，希望能得到您的帮助。'
            });
          } else {
            // 如果不支持openEmail，则提示用户手动发送邮件
            wx.setClipboardData({
              data: 'qiuqile@petalmail.com',
              success: () => {
                wx.showToast({
                  title: '邮箱已复制',
                  icon: 'success'
                });
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

  // 捐赠支持功能
  donate() {
    wx.showModal({
      title: '捐赠支持',
      content: '即将跳转到腾讯公益小程序，感谢您的支持！',
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 跳转到腾讯公益小程序
          wx.navigateToMiniProgram({
            appId: 'wxfdcee92a299bcaf1', // 腾讯公益小程序的appId
            path: 'tKUOWaEQmgv5gId', // 小程序路径
            extraData: {
              from: 'SYwork排班管理系统'
            },
            success: (res) => {
              console.log('跳转到腾讯公益小程序成功', res);
            },
            fail: (err) => {
              console.error('跳转到腾讯公益小程序失败', err);
              wx.showToast({
                title: '跳转失败，请稍后重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 通知其他页面更新头像信息
  updateAvatarInOtherPages() {
    const { avatarType, avatarText, avatarEmoji } = this.data;
    this.avatarManager.updateAvatarInOtherPages(avatarType, avatarText, avatarEmoji);
  },

  // 同步头像信息到云端
  async syncAvatarToCloud(avatarType, avatarEmoji, avatarText) {
    try {
      const { cloudLoggedIn, cloudUserInfo } = this.data;
      const updatedUserInfo = await this.avatarManager.syncAvatarToCloud(avatarType, avatarEmoji, avatarText, cloudLoggedIn, cloudUserInfo);
      if (updatedUserInfo) {
        this.setData({
          cloudUserInfo: updatedUserInfo
        });
      }
    } catch (e) {
      console.error('同步头像信息到云端失败', e);
      // 同步失败不影响本地操作
    }
  },

  // 好友分享功能
  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统 - 个人中心',
      path: '/pages/profile/profile'
    };
  },

  // 朋友圈分享功能
  // 解析更新日志，按版本分割成小板块
  parseChangelog() {
    // 读取CHANGELOG.md文件内容
    // 从utils/changelog.js中获取更新日志内容，确保与实际的CHANGELOG.md文件保持一致
    const changelogContent = changelogData.changelogContent;

    // 按版本分割更新日志
    const versions = changelogContent.split('##');
    const changelog = [];

    // 跳过第一个空元素（标题部分）
    for (let i = 1; i < versions.length; i++) {
      const versionContent = versions[i].trim();
      if (!versionContent) continue;

      // 解析版本号和日期
      const lines = versionContent.split('\n');
      const versionLine = lines[0].trim();

      // 支持版本号格式：vX.X.X (YYYY-MM-DD)
      const versionMatch = versionLine.match(/([vV]\d+\.\d+\.\d+)(?:\.\d+)?\s+\((\d{4}-\d{2}-\d{2})\)/);

      if (versionMatch) {
        const version = versionMatch[1];
        const date = versionMatch[2];

        // 提取版本内容（去掉版本号和日期行）
        const contentLines = lines.slice(1);

        // 移除开头和结尾的空行，然后重新组合内容
        const content = contentLines.join('\n').trim();

        changelog.push({
          version: version,
          date: date,
          content: content
        });
      }
    }

    return changelog;
  },

  onShow() {
    // 页面显示时只在更新日志发生变化时重新解析
    const changelog = this.parseChangelog();
    if (calculateHash(JSON.stringify(changelog)) !== calculateHash(JSON.stringify(this.data.changelog))) {
      this.setData({
        changelog: changelog
      });
    }

    // 同步当天排班颜色到呼吸灯
    const shiftColorInfo = this.getTodayShiftColorInfo();
    if (shiftColorInfo.shiftColor !== this.data.shiftColor) {
      this.setData({
        shiftColor: shiftColorInfo.shiftColor,
        shiftGlowColor: shiftColorInfo.shiftGlowColor
      });
    }

    // 刷新今日心语
    this.refreshDailyMessage();

    // 更新本地时间并智能检查云备份状态
    this.updateLocalUpdateTime();
    this.checkBackupStatus(false);
  },

  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统 - 个人中心',
      query: 'page=profile'
    };
  },

  // 数据管理使用说明弹窗相关方法

  // 显示数据管理使用说明弹窗
  showDataManagementHelpModal() {
    this.setData({
      showDataManagementHelpModal: true
    });
  },

  // 隐藏数据管理使用说明弹窗
  hideDataManagementHelpModal() {
    this.setData({
      showDataManagementHelpModal: false
    });
  },

  // 云开发登录/注册弹窗相关方法
  showCloudLoginOrRegisterModal() {
    console.log('showCloudLoginOrRegisterModal 被调用');
    console.log('cloudLoggedIn:', this.data.cloudLoggedIn);

    // 根据当前是否已登录，选择显示用户管理或登录/注册弹窗
    if (this.data.cloudLoggedIn) {
      console.log('已登录，显示用户管理弹窗');
      // 已登录：显示用户管理弹窗
      this.setData({
        showUserManagementModal: true
      });
      return;
    }

    console.log('未登录，显示选择弹窗');
    // 未登录：显示选择弹窗
    wx.showActionSheet({
      itemList: ['登录已有账号', '注册新账号'],
      success: (res) => {
        console.log('用户选择:', res.tapIndex);
        if (res.tapIndex === 0) {
          console.log('显示切换账号弹窗');
          this.showSwitchAccountModal();
        } else if (res.tapIndex === 1) {
          console.log('显示注册弹窗');
          this.showCloudRegisterModal();
        }
      },
      fail: (err) => {
        // 用户取消操作是正常行为，不视为错误
        if (err.errMsg !== 'showActionSheet:fail cancel') {
          console.error('showActionSheet 失败:', err);
        }
      }
    });
  },

  showCloudLoginModal() {
    console.log('showCloudLoginModal 被调用');
    this.setData({
      showUserManagementModal: true,
      currentUserPage: 'login',
      cloudAccountInput: '',
      cloudPasswordInput: '',
      rememberPassword: false
    });
    console.log('设置 currentUserPage 为 login');
  },

  hideCloudLoginModal() {
    this.setData({
      showCloudLoginModal: false
    });
  },

  showCloudRegisterModal() {
    console.log('showCloudRegisterModal 被调用');
    this.setData({
      showCloudRegisterModal: true,
      cloudAccountInput: '',
      cloudPasswordInput: '',
      cloudConfirmPassword: ''
    });
    console.log('设置 showCloudRegisterModal 为 true');
  },

  hideCloudRegisterModal() {
    this.setData({
      showCloudRegisterModal: false,
      cloudNicknameInput: ''
    });
  },

  onCloudAccountInput(e) {
    this.setData({
      cloudAccountInput: e.detail.value
    });
  },

  onCloudPasswordInput(e) {
    this.setData({
      cloudPasswordInput: e.detail.value
    });
  },

  onCloudConfirmPasswordInput(e) {
    this.setData({
      cloudConfirmPassword: e.detail.value
    });
  },

  onCloudNicknameInput(e) {
    this.setData({
      cloudNicknameInput: e.detail.value
    });
  },

  toggleCloudPasswordVisibility() {
    this.setData({
      showCloudPassword: !this.data.showCloudPassword
    });
  },

  // 用户管理弹窗相关方法
  showUserManagementModal() {
    this.setData({
      showUserManagementModal: true,
      currentUserPage: 'main'
    });
  },

  hideUserManagementModal() {
    this.setData({
      showUserManagementModal: false,
      currentUserPage: 'main',
      showUpdateNicknameModal: false,
      showUpdatePasswordModal: false,
      showDeleteAccountModal: false
    });
  },

  // 切换用户管理页面
  switchUserPage(e) {
    const page = e.currentTarget.dataset.page;

    if (page === 'avatar') {
      this.showEmojiModal();
      return;
    }

    // 重置相应页面的表单数据
    if (page === 'updateNickname') {
      let cloudUserInfo = this.data.cloudUserInfo;
      if (!cloudUserInfo) {
        cloudUserInfo = store.getState('cloudUserInfo');
      }
      this.setData({
        newNickname: cloudUserInfo?.nickname || ''
      });
    } else if (page === 'updatePassword') {
      this.setData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } else if (page === 'deleteAccount') {
      this.setData({
        deleteAccountPassword: ''
      });
    }

    this.setData({
      currentUserPage: page
    });
  },

  // 返回用户管理主页面
  goBackToUserManagement() {
    this.setData({
      currentUserPage: 'main'
    });
  },

  // 显示修改昵称弹窗（已改为页面切换）
  showUpdateNicknameModal() {
    this.switchUserPage({ currentTarget: { dataset: { page: 'updateNickname' } } });
  },

  // 隐藏修改昵称弹窗（已改为页面切换）
  hideUpdateNicknameModal() {
    this.goBackToUserManagement();
  },

  // 确认修改昵称
  async confirmUpdateNickname() {
    const { newNickname } = this.data;
    let cloudUserInfo = this.data.cloudUserInfo;

    if (!cloudUserInfo) {
      cloudUserInfo = store.getState('cloudUserInfo');
    }

    console.log('修改昵称 - cloudUserInfo:', cloudUserInfo);

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({
        title: '用户信息异常，请重新登录',
        icon: 'none'
      });
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
        const updatedCloudUserInfo = {
          ...cloudUserInfo,
          nickname: newNickname.trim()
        };

        this.setData({
          cloudUserInfo: updatedCloudUserInfo,
          username: newNickname.trim(),
          currentUserPage: 'main'
        });
        store.setState({ cloudUserInfo: updatedCloudUserInfo, username: newNickname.trim() }, ['cloudUserInfo', 'username']);

        wx.showToast({
          title: '昵称修改成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.result.errMsg,
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('修改昵称失败', e);
      wx.showToast({
        title: '修改失败',
        icon: 'none'
      });
    }
  },

  // 显示修改密码弹窗（已改为页面切换）
  showUpdatePasswordModal() {
    this.switchUserPage({ currentTarget: { dataset: { page: 'updatePassword' } } });
  },

  // 隐藏修改密码弹窗（已改为页面切换）
  hideUpdatePasswordModal() {
    this.goBackToUserManagement();
  },

  // 确认修改密码
  async confirmUpdatePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    const cloudUserInfo = this.data.cloudUserInfo;

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({
        title: '用户信息异常，请重新登录',
        icon: 'none'
      });
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      wx.showToast({
        title: '请填写完整密码信息',
        icon: 'none'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的新密码不一致',
        icon: 'none'
      });
      return;
    }

    if (newPassword.length < 6) {
      wx.showToast({
        title: '密码长度不能少于 6 位',
        icon: 'none'
      });
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
        this.setData({
          currentUserPage: 'main',
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        wx.showToast({
          title: '密码修改成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.result.errMsg,
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('修改密码失败', e);
      wx.showToast({
        title: '修改失败',
        icon: 'none'
      });
    }
  },

  // 昵称输入事件
  onNicknameInput(e) {
    this.setData({
      newNickname: e.detail.value
    });
  },

  // 原密码输入事件
  onOldPasswordInput(e) {
    this.setData({
      oldPassword: e.detail.value
    });
  },

  // 新密码输入事件
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value
    });
  },

  // 确认密码输入事件
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  // 显示删除账户弹窗（已改为页面切换）
  showDeleteAccountModal() {
    this.switchUserPage({ currentTarget: { dataset: { page: 'deleteAccount' } } });
  },

  // 隐藏删除账户弹窗（已改为页面切换）
  hideDeleteAccountModal() {
    this.goBackToUserManagement();
  },

  // 删除账户密码输入事件
  onDeleteAccountPasswordInput(e) {
    this.setData({
      deleteAccountPassword: e.detail.value
    });
  },

  saveAccount(account, password) {
    try {
      let savedAccounts = store.getState('savedAccounts') || [];

      const cloudUserInfo = this.data.cloudUserInfo;
      const avatarEmoji = this.data.avatarEmoji;
      const avatarType = this.data.avatarType;
      const avatarText = this.data.avatarText;
      const emojiEmotion = this.data.emojiEmotion || 'neutral';

      // 检查账号是否已存在
      const existingIndex = savedAccounts.findIndex(item => item.account === account);

      const encryptedPwd = this.data.rememberPassword ? encryptPassword(password) : '';
      const pwdHash = this.data.rememberPassword ? hashPassword(password) : '';

      if (existingIndex >= 0) {
        savedAccounts[existingIndex] = {
          account: account,
          password: encryptedPwd,
          passwordHash: pwdHash,
          lastLogin: new Date().toISOString(),
          avatarType: avatarType || 'emoji',
          avatarEmoji: avatarEmoji || '😊',
          avatarText: avatarText || '',
          avatarEmojiEmotion: emojiEmotion
        };
      } else {
        savedAccounts.push({
          account: account,
          password: encryptedPwd,
          passwordHash: pwdHash,
          lastLogin: new Date().toISOString(),
          avatarType: avatarType || 'emoji',
          avatarEmoji: avatarEmoji || '😊',
          avatarText: avatarText || '',
          avatarEmojiEmotion: emojiEmotion
        });
      }

      if (savedAccounts.length > 5) {
        savedAccounts = savedAccounts.sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin)).slice(0, 5);
      }

      store.setState({ savedAccounts }, ['savedAccounts']);
      this.setData({
        savedAccounts: savedAccounts
      });
    } catch (e) {
      console.error('保存账号失败:', e);
    }
  },

  // 切换记住密码状态
  toggleRememberPassword() {
    this.setData({
      rememberPassword: !this.data.rememberPassword
    });
  },

  // 显示切换账号页面
  showSwitchAccountModal() {
    // 检查并清理无效账户
    this.checkAndCleanInvalidAccounts();

    this.setData({
      showUserManagementModal: true,
      currentUserPage: 'switchAccount'
    });
  },

  // 检查并清理无效账户
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
            data: {
              action: 'checkAccountExists',
              account: account.account
            },
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

        this.setData({
          savedAccounts: validAccounts,
          autoRestoreMap: autoRestoreMap
        });
      }
    } catch (e) {
      console.error('检查和清理无效账户失败:', e);
    }
  },

  // 选择账号进行登录
  selectAccount(e) {
    const index = e.currentTarget.dataset.index;
    const savedAccounts = this.data.savedAccounts;
    if (index === undefined || !savedAccounts[index]) return;

    const account = savedAccounts[index].account;
    const encryptedPassword = savedAccounts[index].password;
    const storedHash = savedAccounts[index].passwordHash;

    if (!encryptedPassword) {
      this.setData({
        cloudAccountInput: account,
        cloudPasswordInput: '',
        currentUserPage: 'login'
      });
      return;
    }

    const password = decryptPassword(encryptedPassword);

    if (password) {
      if (storedHash && !verifyPassword(password, storedHash)) {
        this.setData({
          cloudAccountInput: account,
          cloudPasswordInput: '',
          currentUserPage: 'login'
        });
        return;
      }
      this.loginWithSavedAccount(account, password);
    } else {
      this.setData({
        cloudAccountInput: account,
        cloudPasswordInput: '',
        currentUserPage: 'login'
      });
    }
  },

  // 使用保存的账号直接登录
  async loginWithSavedAccount(account, password) {
    if (!account || !password) {
      wx.showToast({
        title: '账号或密码为空',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const cloudManager = this.data.cloudManager;
      const result = await cloudManager.login(account, password);

      wx.hideLoading();

      if (result.success) {
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
        const avatarText = '';

        // 获取表情对应的文字和情绪类型
        const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
        const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

        this.setData({
          cloudLoggedIn: true,
          cloudAccount: account,
          username: displayUsername,
          avatarType: avatarType,
          avatarEmoji: avatarEmoji,
          avatarText: avatarText,
          emojiText: emojiText,
          emojiEmotion: emojiEmotion,
          cloudUserInfo: cloudUserInfo,
          currentUserPage: 'main'
        });
        store.setState({
          username: displayUsername,
          avatarType,
          avatarEmoji: avatarEmoji,
          cloudAccount: account,
          cloudLoggedIn: true,
          cloudUserId: result.data.userId,
          cloudUserInfo
        }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);
        this.userId = result.data.userId;

        this.saveAccount(account, password);
        this.updateSavedAccountAvatar(account, {
          avatarType,
          avatarEmoji,
          avatarText,
          avatarEmojiEmotion: emojiEmotion
        });

        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1000
        });

        // 重置缓存并强制检查备份状态
        this.setData({
          lastCloudCheckTime: 0,
          cachedCloudStatus: null
        });
        this.checkBackupStatus(true);

        if (this.data.autoRestoreMap[account]) {
          this.autoRestoreData();
        }
      } else {
        wx.showToast({
          title: result.errMsg || '登录失败',
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('登录失败', e);
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    }
  },

  // 切换自动恢复选项
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
            this.setData({
              autoRestoreMap: autoRestoreMap
            });
            store.setState({ autoRestoreMap }, ['autoRestoreMap']);
          }
        }
      });
    } else {
      const autoRestoreMap = { ...this.data.autoRestoreMap };
      autoRestoreMap[account] = false;
      this.setData({
        autoRestoreMap: autoRestoreMap
      });
      store.setState({ autoRestoreMap }, ['autoRestoreMap']);
    }
  },

  // 自动恢复数据
  async autoRestoreData() {
    try {
      const cloudManager = this.data.cloudManager;

      // 检查是否有备份
      const backupInfo = await cloudManager.getBackupInfo();
      if (!backupInfo.success || !backupInfo.hasBackup) {
        console.log('没有备份数据，跳过自动恢复');
        return;
      }

      // 静默恢复数据
      wx.showLoading({ title: '恢复数据中...' });

      const result = await cloudManager.restore();

      wx.hideLoading();

      if (result.success) {
        store.setState({ lastRestoreTime: Date.now() }, ['lastRestoreTime']);
        wx.showToast({
          title: '数据恢复成功',
          icon: 'success',
          duration: 1500
        });

        this.initPageData();
      } else {
        console.error('自动恢复失败:', result.errMsg);
      }
    } catch (e) {
      wx.hideLoading();
      console.error('自动恢复数据异常:', e);
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

      this.setData({
        savedAccounts: savedAccounts,
        autoRestoreMap: autoRestoreMap
      });
    } catch (e) {
      console.error('删除保存的账号失败:', e);
    }
  },

  // 确认删除账户
  async confirmDeleteAccount() {
    const { deleteAccountPassword } = this.data;
    const cloudUserInfo = this.data.cloudUserInfo;

    if (!cloudUserInfo || !cloudUserInfo.userId) {
      wx.showToast({
        title: '用户信息异常，请重新登录',
        icon: 'none'
      });
      return;
    }

    if (!deleteAccountPassword) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    // 二次确认
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
              let savedAccounts = [];
              try {
                savedAccounts = store.getState('savedAccounts') || [];
                const accountToDelete = cloudUserInfo.account;
                savedAccounts = savedAccounts.filter(item => item.account !== accountToDelete);

                const autoRestoreMap = { ...this.data.autoRestoreMap };
                delete autoRestoreMap[accountToDelete];

                store.setState({ savedAccounts, autoRestoreMap }, ['savedAccounts', 'autoRestoreMap']);

                this.setData({
                  savedAccounts: savedAccounts,
                  autoRestoreMap: autoRestoreMap
                });
              } catch (e) {
                console.error('从保存的账号列表中删除账户失败:', e);
              }

              this.logoutFromCloud();

              // 检查是否有其他保存的账户
              if (savedAccounts.length > 0) {
                // 有其他账户，跳转到切换账户界面
                this.setData({
                  currentUserPage: 'switchAccount',
                  showUserManagementModal: true
                });
              } else {
                // 没有其他账户，直接关闭弹窗
                this.hideUserManagementModal();
              }

              wx.showToast({
                title: '账户已删除',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: result.result.errMsg,
                icon: 'none'
              });
            }
          } catch (e) {
            wx.hideLoading();
            console.error('删除账户失败', e);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  confirmLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.hideUserManagementModal();
          this.logoutFromCloud();
        }
      }
    });
  },

  // 登录到云开发
  async loginToCloud() {
    const { cloudAccountInput, cloudPasswordInput } = this.data;

    if (!cloudAccountInput || !cloudPasswordInput) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const cloudManager = this.data.cloudManager;
      const result = await cloudManager.login(cloudAccountInput, cloudPasswordInput);

      wx.hideLoading();

      if (result.success) {
        const cloudUserInfo = {
          userId: result.data.userId,
          account: cloudAccountInput,
          nickname: result.data.nickname || cloudAccountInput,
          avatarType: result.data.avatarType || 'emoji',
          avatarEmoji: result.data.avatarEmoji || '😊',
          avatarText: result.data.avatarText || ''
        };
        const displayUsername = result.data.nickname || cloudAccountInput;
        const avatarType = result.data.avatarType || 'emoji';
        const avatarEmoji = result.data.avatarEmoji || '😊';
        const avatarText = '';

        // 获取表情对应的文字和情绪类型
        const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
        const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

        this.setData({
          cloudLoggedIn: true,
          cloudAccount: cloudAccountInput,
          username: displayUsername,
          avatarType: avatarType,
          avatarEmoji: avatarEmoji,
          avatarText: avatarText,
          emojiText: emojiText,
          emojiEmotion: emojiEmotion,
          cloudUserInfo: cloudUserInfo,
          currentUserPage: 'main'
        });
        store.setState({
          username: displayUsername,
          avatarType,
          avatarEmoji: avatarEmoji,
          cloudAccount: cloudAccountInput,
          cloudLoggedIn: true,
          cloudUserId: result.data.userId,
          cloudUserInfo
        }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);
        this.userId = result.data.userId;

        this.saveAccount(cloudAccountInput, cloudPasswordInput);
        this.updateSavedAccountAvatar(cloudAccountInput, {
          avatarType,
          avatarEmoji,
          avatarText,
          avatarEmojiEmotion: emojiEmotion
        });

        // 重置缓存并强制检查备份状态
        this.setData({
          lastCloudCheckTime: 0,
          cachedCloudStatus: null
        });
        this.checkBackupStatus(true);

        // 显示成功提示
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1000
        });

        // 检查是否需要自动恢复数据
        if (this.data.autoRestoreMap[cloudAccountInput]) {
          // 自动恢复数据
          this.autoRestoreData();
        }
      } else {
        wx.showToast({
          title: result.errMsg || '登录失败',
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('登录失败', e);
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    }
  },

  // 注册到云开发
  async registerToCloud() {
    const { cloudAccountInput, cloudPasswordInput, cloudConfirmPassword, cloudNicknameInput } = this.data;

    if (!cloudAccountInput || !cloudPasswordInput || !cloudConfirmPassword) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    if (cloudPasswordInput !== cloudConfirmPassword) {
      wx.showToast({
        title: '两次密码不一致',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '注册中...' });

    try {
      // 直接调用云函数，传递昵称
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'register',
          account: cloudAccountInput,
          password: cloudPasswordInput,
          nickname: cloudNicknameInput || ''
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        const cloudUserInfo = {
          userId: result.result.data.userId,
          account: cloudAccountInput,
          nickname: result.result.data.nickname || cloudAccountInput,
          avatarType: result.result.data.avatarType || 'emoji',
          avatarEmoji: result.result.data.avatarEmoji || '😊',
          avatarText: result.result.data.avatarText || ''
        };
        const displayUsername = result.result.data.nickname || cloudAccountInput;
        const avatarType = result.result.data.avatarType || 'emoji';
        const avatarEmoji = result.result.data.avatarEmoji || '😊';
        const avatarText = '';

        // 获取表情对应的文字和情绪类型
        const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
        const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

        this.setData({
          cloudLoggedIn: true,
          cloudAccount: cloudAccountInput,
          username: displayUsername,
          avatarType: avatarType,
          avatarEmoji: avatarEmoji,
          avatarText: avatarText,
          emojiText: emojiText,
          emojiEmotion: emojiEmotion,
          cloudUserInfo: cloudUserInfo
        });
        store.setState({
          username: displayUsername,
          avatarType,
          avatarEmoji: avatarEmoji,
          cloudAccount: cloudAccountInput,
          cloudLoggedIn: true,
          cloudUserId: result.result.data.userId,
          cloudUserInfo
        }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);
        this.userId = result.result.data.userId;

        // 重置缓存并强制检查备份状态
        this.setData({
          lastCloudCheckTime: 0,
          cachedCloudStatus: null
        });
        this.checkBackupStatus(true);

        this.hideCloudRegisterModal();
        // 显示成功提示并立即打开用户管理弹窗
        wx.showToast({
          title: '注册成功',
          icon: 'success',
          duration: 1000
        });

        // 立即打开用户管理弹窗，不需要延迟
        this.setData({
          showUserManagementModal: true
        });
      } else {
        wx.showToast({
          title: result.result.errMsg || '注册失败',
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('注册失败', e);
      wx.showToast({
        title: '注册失败',
        icon: 'none'
      });
    }
  },

  // 退出云开发登录
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
      lastCloudCheckTime: 0,
      cachedCloudStatus: null,
      backupStatus: { type: 'unbacked', label: STATUS_TEXT.NOT_LOGGED_IN }
    });
    store.removeState(
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo'],
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']
    );
    this.userId = null;

    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    });
  },

  // 备份到云开发
  async backupToCloud() {
    if (!this.data.cloudLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认备份',
      content: '备份操作将把本地数据同步到云端，是否继续？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          const cloudManager = this.data.cloudManager;
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
          wx.showToast({
            title: '备份失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 从云开发恢复
  async restoreFromCloud() {
    if (!this.data.cloudLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认恢复',
      content: '恢复操作将把云端数据同步到本地，是否继续？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          const cloudManager = this.data.cloudManager;
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
          wx.showToast({
            title: '恢复失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 格式化日期显示
  formatDate(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

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

  // 计算本地数据的哈希值，用于与云端对比
  computeLocalHash() {
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    const shifts = wx.getStorageSync('shifts') || {};
    const combined = JSON.stringify(shiftTemplates) + JSON.stringify(shifts);
    return calculateHash(combined);
  },

  // 更新本地数据最新变更时间
  updateLocalUpdateTime() {
    let latestTime = 0;
    const shifts = wx.getStorageSync('shifts') || {};
    Object.keys(shifts).forEach(dateKey => {
      const ts = new Date(dateKey).getTime();
      if (!isNaN(ts) && ts > latestTime) {
        latestTime = ts;
      }
    });
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    shiftTemplates.forEach(tpl => {
      if (tpl.updatedTime) {
        const ts = new Date(tpl.updatedTime).getTime();
        if (!isNaN(ts) && ts > latestTime) {
          latestTime = ts;
        }
      }
    });
    const lastBackupTime = store.getState('lastBackupTime') || 0;
    if (lastBackupTime > latestTime) {
      latestTime = lastBackupTime;
    }
    this.setData({ lastLocalUpdate: latestTime || Date.now() });
  },

  // 格式化备份时间：统一显示 MM-DD HH:mm
  formatBackupTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return month + '-' + day + ' ' + hh + ':' + mm;
  },

  // 根据缓存数据更新界面上的状态指示器
  updateBackupStatusUI(cache) {
    if (!cache || !cache.status || cache.status === 'no_backup') {
      this.setData({
        backupStatus: { type: 'unbacked', label: STATUS_TEXT.UNBACKED }
      });
      return;
    }
    const localHash = this.computeLocalHash();
    const effectiveHash = cache.hash || this.data.lastSyncHash || '';
    const timeStr = cache.time ? this.formatBackupTime(cache.time) : '';
    if (effectiveHash && localHash === effectiveHash) {
      this.setData({
        backupStatus: {
          type: 'synced',
          label: STATUS_TEXT.SYNCED + (timeStr ? ' ' + timeStr : '')
        }
      });
      return;
    }
    const { lastLocalUpdate } = this.data;
    const backupTime = cache.time ? new Date(cache.time).getTime() : 0;
    if (!cache.time || (backupTime && lastLocalUpdate > backupTime)) {
      this.setData({
        backupStatus: {
          type: 'local_newer',
          label: STATUS_TEXT.LOCAL_NEWER + (timeStr ? ' ' + timeStr : '')
        }
      });
    } else {
      this.setData({
        backupStatus: {
          type: 'cloud_newer',
          label: STATUS_TEXT.CLOUD_NEWER + (timeStr ? ' ' + timeStr : '')
        }
      });
    }
  },

  // 检查云备份状态（智能决策树）
  async checkBackupStatus(forceRefresh) {
    const { cloudLoggedIn } = this.data;
    if (!cloudLoggedIn) {
      this.setData({
        backupStatus: { type: 'unbacked', label: STATUS_TEXT.NOT_LOGGED_IN }
      });
      return;
    }
    if (forceRefresh) {
      this.setData({
        backupStatus: { type: 'checking', label: STATUS_TEXT.CHECKING }
      });
    }
    const now = Date.now();
    const { lastCloudCheckTime, cachedCloudStatus, lastLocalUpdate } = this.data;
    let shouldFetch = !!forceRefresh;
    if (!shouldFetch && lastLocalUpdate > lastCloudCheckTime) {
      shouldFetch = true;
    }
    if (!shouldFetch && (now - lastCloudCheckTime > CACHE_TTL)) {
      shouldFetch = true;
    }
    if (shouldFetch) {
      try {
        const cloudManager = this.data.cloudManager;
        const info = await cloudManager.getLatestBackupInfo();
        if (info.success) {
          const cloudTime = info.backupTime || store.getState('lastBackupTime') || null;
          const cloudHash = info.backupHash || this.data.lastSyncHash || null;
          const newCache = {
            status: info.hasBackup ? 'has_backup' : 'no_backup',
            time: cloudTime,
            hash: cloudHash
          };
          this.setData({
            lastCloudCheckTime: now,
            cachedCloudStatus: newCache
          });
          this.updateBackupStatusUI(newCache);
        } else {
          if (cachedCloudStatus) {
            this.updateBackupStatusUI(cachedCloudStatus);
          } else {
            this.setData({
              backupStatus: { type: 'unbacked', label: STATUS_TEXT.UNBACKED }
            });
          }
        }
      } catch (e) {
        console.error('检查备份状态失败', e);
        if (cachedCloudStatus) {
          this.updateBackupStatusUI(cachedCloudStatus);
        }
      }
    } else {
      if (cachedCloudStatus) {
        this.updateBackupStatusUI(cachedCloudStatus);
      } else {
        this.setData({
          backupStatus: { type: 'checking', label: STATUS_TEXT.CHECKING }
        });
      }
    }
  },

  // 点击呼吸灯手动刷新状态
  onCloudStatusTap() {
    this.checkBackupStatus(true);
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
  }
});
