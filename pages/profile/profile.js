'use strict';
// pages/profile/profile.js
const changelogData = require('../../utils/changelog.js');
const CloudManager = require('../../utils/cloudManager.js');
const AvatarManager = require('../../utils/avatarManager.js');
const DataExportManager = require('../../utils/dataExportManager.js');
const DataImportManager = require('../../utils/dataImportManager.js');
const DataClearManager = require('../../utils/dataClearManager.js');
const { store } = require('../../utils/store.js');
const { encryptPassword, decryptPassword, isOldFormat, calculateHash, hashPassword } = require('../../utils/encrypt.js');
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
    _lastEmoji: '',
    _lastShiftsHash: '',
    exportFileName: '',
    // 完整数据导出相关变量
    exportedFilePath: '',
    exportedFileName: '',
    // 模板导出相关变量
    exportedTemplateFilePath: '',
    exportedTemplateFileName: '',
    exportSuccess: false,
    exportFail: false,
    fileExt: 'json',
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
    showCloudRegisterModal: false,
    showCloudLoginModal: false,
    cloudAccountInput: '',
    cloudPasswordInput: '',
    cloudConfirmPassword: '',
    cloudNicknameInput: '',
    showCloudPassword: false,
    rememberPassword: false,

    
    // 数据管理使用说明弹窗
    showDataManagementHelpModal: false,
    // 更新日志数据
    changelog: [],
    // 声明相关
    showPolicyModal: false,
    currentPolicyType: '', // 'dataSecurity', 'privacy', 'disclaimer'
    policyTitle: '',
    policyIcon: '',
    policyColor: '',
    policySections: [],

    // 云备份状态指示器
    lastCloudCheckTime: 0,
    cachedCloudStatus: null,
    lastLocalUpdate: 0,
    backupStatus: null,
    lastSyncHash: '',
    shiftColor: '#07c160',
    shiftGlowColor: 'rgba(7, 193, 96, 0.6)'
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
   * 获取排班数据的简单hash，用于检测班次变化
   * @param {Object} shifts 排班数据
   * @returns {string} hash值
   */
  _getShiftsHash(shifts) {
    const today = new Date();
    const todayStr = this._formatDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this._formatDate(yesterday);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this._formatDate(tomorrow);
    
    // 只关心最近三天的班次变化
    const relevantShifts = {
      [yesterdayStr]: shifts[yesterdayStr],
      [todayStr]: shifts[todayStr],
      [tomorrowStr]: shifts[tomorrowStr]
    };
    
    return JSON.stringify(relevantShifts);
  },

  /**
   * 格式化日期为 YYYY-MM-DD
   * @param {Date} date 日期对象
   * @returns {string}
   */
  _formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 刷新今日心语
   * @param {boolean} force 是否强制刷新（忽略缓存对比）
   */
  refreshDailyMessage(force) {
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
    
    // 获取表情头像
    let avatarEmoji = '';
    const avatarType = this.data.avatarType || store.getState('avatarType');
    if (avatarType === 'emoji') {
      avatarEmoji = this.data.avatarEmoji || store.getState('avatarEmoji');
    }
    
    // 获取排班数据
    const shifts = wx.getStorageSync('shifts') || {};
    const currentShiftsHash = this._getShiftsHash(shifts);
    
    // 生成消息（传入表情参数）
    const newMessage = getDailyMessage(nickname, shifts, avatarEmoji, now);
    
    // 检查是否需要更新：消息变化、时段变化、头像变化、班次变化
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

  // 手动刷新今日心语
  onRefreshDailyMessage() {
    this.refreshDailyMessage(true);
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

      defaultFileNameHint = `${username}+${dataTypeNames}+${currentDate}`;
    }

    // 判断导出格式：含图片→.zip，否则→.json
    const includeImages = selectedDataTypes.includes('scheduleImages');
    const fileExt = includeImages ? 'zip' : 'json';

    this.setData({
      tempFileName: '',
      defaultFileNameHint: defaultFileNameHint,
      fileExt: fileExt,
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
    if (this.data.cloudLoggedIn) {
      const pages = getCurrentPages();
      if (pages.length >= 10) {
        wx.redirectTo({
          url: '/pages/user-manage/index',
          fail: () => {
            this.setData({ showUserManagementModal: true });
          }
        });
      } else {
        wx.navigateTo({
          url: '/pages/user-manage/index',
          fail: () => {
            this.setData({ showUserManagementModal: true });
          }
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
        if (err.errMsg !== 'showActionSheet:fail cancel') {
          console.error('showActionSheet 失败:', err);
        }
      }
    });
  },

  refreshUserInfo() {
    this.initPageData();
  },

  showCloudLoginModal() {
    this.setData({
      showCloudLoginModal: true,
      cloudAccountInput: '',
      cloudPasswordInput: '',
      rememberPassword: false
    });
  },

  hideCloudLoginModal() {
    this.setData({ showCloudLoginModal: false });
  },

  showCloudRegisterModal() {
    this.setData({
      showCloudRegisterModal: true,
      cloudAccountInput: '',
      cloudPasswordInput: '',
      cloudConfirmPassword: '',
      cloudNicknameInput: '',
      showCloudPassword: false
    });
  },

  hideCloudRegisterModal() {
    this.setData({
      showCloudRegisterModal: false,
      cloudNicknameInput: ''
    });
  },

  async onCloudLogin() {
    const { cloudAccountInput, cloudPasswordInput, rememberPassword } = this.data;
    if (!cloudAccountInput) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!cloudPasswordInput) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });
    try {
      const result = await this.cloudManager.login(cloudAccountInput, cloudPasswordInput);
      wx.hideLoading();

      if (result.success) {
        this.handleLoginSuccess(cloudAccountInput, result);
        if (rememberPassword) {
          this.saveAccount(cloudAccountInput, cloudPasswordInput);
        }
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

  async registerToCloud() {
    const { cloudAccountInput, cloudPasswordInput, cloudConfirmPassword, cloudNicknameInput } = this.data;
    if (!cloudAccountInput) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!cloudPasswordInput) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (cloudPasswordInput !== cloudConfirmPassword) {
      wx.showToast({ title: '两次密码输入不一致', icon: 'none' });
      return;
    }

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

  handleLoginSuccess(account, result) {
    const cloudUserInfo = {
      userId: result.data.userId,
      account: account,
      nickname: result.data.nickname || account,
      avatarType: result.data.avatarType || 'emoji',
      avatarEmoji: result.data.avatarEmoji || '😊',
      avatarText: result.data.avatarText || ''
    };
    const displayUsername = result.data.nickname || account;

    store.setState({
      username: displayUsername,
      avatarType: cloudUserInfo.avatarType,
      avatarEmoji: cloudUserInfo.avatarEmoji,
      cloudAccount: account,
      cloudLoggedIn: true,
      cloudUserId: result.data.userId,
      cloudUserInfo
    }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);

    this.userId = result.data.userId;
    this.initPageData();
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
  },

  // 获取声明内容
  getPolicyContent(type) {
    const policies = {
      dataSecurity: {
        title: '数据安全声明',
        icon: '🔒',
        color: '#10b981',
        sections: [
          {
            heading: '数据存储',
            icon: '💾',
            items: [
              '本小程序默认将所有数据存储在您的微信小程序本地存储中，不会上传至任何第三方服务器',
              '本地数据存储采用微信小程序的安全机制，保障数据的安全性'
            ]
          },
          {
            heading: '云备份功能',
            icon: '☁️',
            items: [
              '云备份功能为可选功能，您可以选择是否使用',
              '使用云备份功能时，数据将存储在腾讯云微信云开发服务中',
              '云备份的数据采用加密存储，您的账号和密码将进行加密处理'
            ]
          },
          {
            heading: '数据保护',
            icon: '🛡️',
            items: [
              '您的数据属于您个人，我们不会查看、使用或分享您的数据',
              '请妥善保管您的云备份账号和密码，避免数据泄露',
              '建议您定期备份重要数据，以防数据丢失'
            ]
          },
          {
            heading: '免责声明',
            icon: '⚠️',
            items: [
              '本小程序致力于保护您的数据安全，但无法保证绝对的安全',
              '因不可抗力、设备故障等原因造成的数据丢失，开发者不承担责任'
            ]
          }
        ]
      },
      privacy: {
        title: '隐私政策',
        icon: '🔐',
        color: '#3b82f6',
        sections: [
          {
            heading: '信息收集',
            icon: '📋',
            items: [
              '本小程序仅收集您主动填写的信息，包括用户名、排班数据等',
              '我们不会收集您的微信个人信息、通讯录、地理位置等敏感信息',
              '您可以随时编辑或删除您的个人信息'
            ]
          },
          {
            heading: '信息使用',
            icon: '✅',
            items: [
              '您提供的信息仅用于小程序的功能运行，不会用于其他目的',
              '我们不会将您的信息出售、出租或分享给任何第三方'
            ]
          },
          {
            heading: '信息保护',
            icon: '🛡️',
            items: [
              '我们采取合理的技术措施保护您的信息安全',
              '数据传输过程中采用加密技术，防止数据泄露',
              '本地数据存储在您的设备上，您拥有完全控制权'
            ]
          },
          {
            heading: '变更说明',
            icon: '📝',
            items: [
              '我们可能会不时更新本隐私政策',
              '隐私政策更新后，将在小程序中公示'
            ]
          }
        ]
      },
      disclaimer: {
        title: '免责声明',
        icon: '⚠️',
        color: '#f59e0b',
        sections: [
          {
            heading: '使用说明',
            icon: '📱',
            items: [
              '本小程序为免费公益项目，仅供个人使用',
              '您可以自由使用本小程序，但请遵守法律法规'
            ]
          },
          {
            heading: '功能说明',
            icon: '⚙️',
            items: [
              '本小程序尽力提供准确、稳定的功能，但不保证功能的绝对可用性',
              '因网络问题、系统升级等原因导致的服务中断，开发者不承担责任'
            ]
          },
          {
            heading: '内容责任',
            icon: '📄',
            items: [
              '您对自己输入和使用的数据负全部责任',
              '您不应使用本小程序存储敏感或重要信息',
              '因数据丢失、泄露造成的损失，开发者不承担赔偿责任'
            ]
          },
          {
            heading: '法律合规',
            icon: '⚖️',
            items: [
              '使用本小程序即表示您同意本免责声明',
              '本免责声明的解释权归开发者所有',
              '如有争议，应通过友好协商解决'
            ]
          }
        ]
      }
    };
    return policies[type] || null;
  },

  // 显示数据安全声明
  showDataSecurity() {
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

  // 显示隐私政策
  showPrivacyPolicy() {
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

  // 显示免责声明
  showDisclaimer() {
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

  // 隐藏声明弹窗
  hidePolicyModal() {
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
