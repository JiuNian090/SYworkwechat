// pages/profile/profile.js
const api = require('../../utils/api.js');
const changelogData = require('../../utils/changelog.js');
const emojiManager = require('../../utils/emojiManager.js');
const CloudManager = require('../../utils/cloudManager.js');
const AvatarManager = require('../../utils/avatarManager.js');
const DataExportManager = require('../../utils/dataExportManager.js');
const DataImportManager = require('../../utils/dataImportManager.js');
const DataClearManager = require('../../utils/dataClearManager.js');

Page({
  data: {
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
    showEmojiModal: false, // 表情选择弹窗显示状态
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
    // 用户管理弹窗
    showUserManagementModal: false,
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
    // 表情相关数据
    emojiCategories: emojiManager.getCategories(),
    currentEmojiCategory: 'face', // 当前选中的表情分类
    selectedEmoji: '' // 当前选中的表情
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
  
  // 初始化页面数据
  initPageData() {
    // 云开发已在 app.js 中初始化
    const app = getApp();
    const cloudInitialized = app.globalData.cloudInitialized;
    console.log('云开发初始化状态:', cloudInitialized);
    
    // 检查是否已登录
    const cloudUserId = wx.getStorageSync('cloudUserId');
    const cloudAccount = wx.getStorageSync('cloudAccount') || '';
    const cloudUserInfo = wx.getStorageSync('cloudUserInfo') || null;
    const cloudLoggedIn = !!cloudUserId;
    
    // 同步云账号到用户名：优先使用云昵称
    let username = wx.getStorageSync('username') || '';
    if (cloudLoggedIn && cloudUserInfo) {
      username = cloudUserInfo.nickname || cloudAccount;
      // 确保本地存储的 username 与昵称同步
      wx.setStorageSync('username', username);
    }
    this.userId = cloudUserId;
    
    // 初始化头像信息
    let avatarInfo;
    if (cloudLoggedIn && cloudUserInfo) {
      // 从云端用户信息初始化头像
      avatarInfo = this.avatarManager.initAvatarFromCloud(cloudUserInfo);
    } else {
      // 从本地存储初始化头像
      avatarInfo = this.avatarManager.initAvatarInfo();
    }
    
    // 解析更新日志
    const changelog = this.parseChangelog();
    
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
      changelog: changelog
    });
    
    // 如果已登录，尝试从云端获取最新的头像信息
    if (cloudLoggedIn && cloudInitialized) {
      this.getLatestAvatarFromCloud();
    }
  },

  // 跳转到使用说明页面
  navigateToDocs(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: '/pages/docs/docs?type=' + type
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
    
    // 保存到本地存储
    wx.setStorageSync('username', username);
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 显示表情选择弹窗
  showEmojiModal() {
    this.updateCurrentCategoryEmojis();
    this.setData({
      showEmojiModal: true,
      selectedEmoji: this.data.avatarEmoji
    });
  },
  
  // 更新当前分类的表情
  updateCurrentCategoryEmojis() {
    const currentEmojiCategory = this.data.currentEmojiCategory;
    const currentCategoryEmojis = emojiManager.getCategoryEmojis(currentEmojiCategory);
    this.setData({
      currentCategoryEmojis: currentCategoryEmojis
    });
  },

  // 隐藏表情选择弹窗
  hideEmojiModal() {
    this.setData({
      showEmojiModal: false
    });
  },

  // 切换表情分类
  switchEmojiCategory(e) {
    const categoryId = e.currentTarget.dataset.category;
    this.setData({
      currentEmojiCategory: categoryId
    });
    this.updateCurrentCategoryEmojis();
  },

  // 选择表情
  selectEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({
      selectedEmoji: emoji
    });
  },

  // 确认表情设置
  confirmEmoji() {
    const emoji = this.data.selectedEmoji;
    if (!emoji) {
      wx.showToast({
        title: '请选择一个表情',
        icon: 'none'
      });
      return;
    }
    
    // 获取表情对应的文字和情绪类型
    const emojiText = emojiManager.getEmojiText(emoji) || '';
    const emojiEmotion = emojiManager.getEmojiEmotion(emoji) || 'neutral';
    
    this.setData({
      avatarEmoji: emoji,
      avatarType: 'emoji',
      emojiText: emojiText,
      emojiEmotion: emojiEmotion,
      showEmojiModal: false
    });
    
    // 保存到本地存储
    wx.setStorageSync('avatarType', 'emoji');
    wx.setStorageSync('avatarEmoji', emoji);
    
    // 同步到云端
    this.syncAvatarToCloud('emoji', emoji, '');
    
    // 通知其他页面更新头像信息
    this.updateAvatarInOtherPages();
    
    wx.showToast({
      title: '表情已设为头像',
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
    const versions = changelogContent.split('###');
    const changelog = [];
    
    // 跳过第一个空元素
    for (let i = 1; i < versions.length; i++) {
      const versionContent = versions[i].trim();
      if (!versionContent) continue;
      
      // 解析版本号和日期
      const lines = versionContent.split('\n');
      const versionLine = lines[0].trim();
      
      // 支持两种版本号格式：v.x.w.z 和 v.x.w
      const versionMatch = versionLine.match(/([vV]\d+\.\d+\.\d+)(?:\.\d+)?\s+\((\d{4}-\d{2}-\d{2})\)/);
      
      if (versionMatch) {
        const version = versionMatch[1]; // 只保留v.x.w格式，去掉.z部分
        const date = versionMatch[2];
        
        // 提取版本内容（去掉版本号和日期行）
        let contentLines = lines.slice(1);
        
        // 在每个表情符号大标题前添加换行符，确保标题和内容之间有空行
        const processedLines = [];
        contentLines.forEach(line => {
          // 检查是否是表情符号大标题（以✨、🔧、🐛、📝、🎨等开头）
          if (/^[✨🔧🐛📝🎨]/.test(line.trim())) {
            // 如果不是第一个行且前一行不是空行，则添加换行符
            if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
              processedLines.push('');
            }
            processedLines.push(line);
          } else {
            processedLines.push(line);
          }
        });
        
        // 移除开头和结尾的空行，然后重新组合内容
        const content = processedLines.join('\n').trim();
        
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
    if (JSON.stringify(changelog) !== JSON.stringify(this.data.changelog)) {
      this.setData({
        changelog: changelog
      });
    }
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
          console.log('显示登录弹窗');
          this.showCloudLoginModal();
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
      showCloudLoginModal: true,
      cloudAccountInput: '',
      cloudPasswordInput: ''
    });
    console.log('设置 showCloudLoginModal 为 true');
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
      showUserManagementModal: true
    });
  },

  hideUserManagementModal() {
    this.setData({
      showUserManagementModal: false,
      showUpdateNicknameModal: false,
      showUpdatePasswordModal: false,
      showDeleteAccountModal: false
    });
  },

  // 显示修改昵称弹窗
  showUpdateNicknameModal() {
    let cloudUserInfo = this.data.cloudUserInfo;
    if (!cloudUserInfo) {
      cloudUserInfo = wx.getStorageSync('cloudUserInfo');
    }
    console.log('显示修改昵称弹窗 - cloudUserInfo:', cloudUserInfo);
    this.setData({
      showUpdateNicknameModal: true,
      newNickname: cloudUserInfo?.nickname || ''
    });
  },

  // 隐藏修改昵称弹窗
  hideUpdateNicknameModal() {
    this.setData({
      showUpdateNicknameModal: false
    });
  },

  // 确认修改昵称
  async confirmUpdateNickname() {
    const { newNickname } = this.data;
    let cloudUserInfo = this.data.cloudUserInfo;
    
    // 如果 data 中没有 cloudUserInfo，尝试从本地存储获取
    if (!cloudUserInfo) {
      cloudUserInfo = wx.getStorageSync('cloudUserInfo');
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
          showUpdateNicknameModal: false
        });
        // 同步更新本地存储
        wx.setStorageSync('cloudUserInfo', updatedCloudUserInfo);
        wx.setStorageSync('username', newNickname.trim());

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

  // 显示修改密码弹窗
  showUpdatePasswordModal() {
    this.setData({
      showUpdatePasswordModal: true,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  },

  // 隐藏修改密码弹窗
  hideUpdatePasswordModal() {
    this.setData({
      showUpdatePasswordModal: false
    });
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
          showUpdatePasswordModal: false,
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

  // 显示删除账户弹窗
  showDeleteAccountModal() {
    this.setData({
      showDeleteAccountModal: true,
      deleteAccountPassword: ''
    });
  },

  // 隐藏删除账户弹窗
  hideDeleteAccountModal() {
    this.setData({
      showDeleteAccountModal: false,
      deleteAccountPassword: ''
    });
  },

  // 删除账户密码输入事件
  onDeleteAccountPasswordInput(e) {
    this.setData({
      deleteAccountPassword: e.detail.value
    });
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
              // 清除本地登录信息
              this.hideDeleteAccountModal();
              this.hideUserManagementModal();
              this.logoutFromCloud();

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
          cloudUserInfo: cloudUserInfo
        });
        // 保存到本地存储（不保存密码，只保存用户信息）
        wx.setStorageSync('username', displayUsername);
        wx.setStorageSync('avatarType', avatarType);
        wx.setStorageSync('avatarEmoji', avatarEmoji);
        wx.setStorageSync('cloudAccount', cloudAccountInput);
        wx.setStorageSync('cloudLoggedIn', true);
        wx.setStorageSync('cloudUserId', result.data.userId);
        wx.setStorageSync('cloudUserInfo', cloudUserInfo);
        this.userId = result.data.userId;
        
        this.hideCloudLoginModal();
        // 显示成功提示并立即打开用户管理弹窗
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1000
        });
        
        // 立即打开用户管理弹窗，不需要延迟
        this.setData({
          showUserManagementModal: true
        });
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
        // 保存到本地存储（不保存密码，只保存用户信息）
        wx.setStorageSync('username', displayUsername);
        wx.setStorageSync('avatarType', avatarType);
        wx.setStorageSync('avatarEmoji', avatarEmoji);
        wx.setStorageSync('cloudAccount', cloudAccountInput);
        wx.setStorageSync('cloudLoggedIn', true);
        wx.setStorageSync('cloudUserId', result.result.data.userId);
        wx.setStorageSync('cloudUserInfo', cloudUserInfo);
        this.userId = result.result.data.userId;
        
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
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
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
            emojiEmotion: 'neutral'
          });
          // 清空本地存储
          wx.removeStorageSync('username');
          wx.removeStorageSync('avatarType');
          wx.removeStorageSync('avatarEmoji');
          wx.removeStorageSync('cloudAccount');
          wx.removeStorageSync('cloudLoggedIn');
          wx.removeStorageSync('cloudUserId');
          wx.removeStorageSync('cloudUserInfo');
          this.userId = null;
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
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
            wx.setStorageSync('lastBackupTime', Date.now());
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
            wx.setStorageSync('lastRestoreTime', Date.now());
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
});