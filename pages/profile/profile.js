// pages/profile/profile.js
const api = require('../../utils/api.js');
const changelogData = require('../../utils/changelog.js');
const emojiManager = require('../../utils/emojiManager.js');
const CloudManager = require('../../utils/cloudManager.js');
const AvatarManager = require('../../utils/avatarManager.js');
const DataExportManager = require('../../utils/dataExportManager.js');
const DataImportManager = require('../../utils/dataImportManager.js');
const DataClearManager = require('../../utils/dataClearManager.js');
const WebDAVManager = require('../../utils/webdavManager.js');

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
    selectedEmoji: '', // 当前选中的表情
    // WebDAV配置
    showWebDAVModal: false,
    showWebDAVHelpModal: false,
    showPassword: false,
    webdavConfig: {
      url: '',
      username: '',
      password: '',
      folder: ''
    }
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
    // 初始化WebDAV管理器
    this.webDAVManager = new WebDAVManager();
    
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
  
  // WebDAV备份相关方法
  
  // 显示WebDAV配置弹窗
  showWebDAVModal() {
    this.setData({
      showWebDAVModal: true
    });
  },
  
  // 隐藏WebDAV配置弹窗
  hideWebDAVModal() {
    this.setData({
      showWebDAVModal: false
    });
  },
  
  // 显示WebDAV使用说明弹窗
  showWebDAVHelpModal() {
    this.setData({
      showWebDAVHelpModal: true
    });
  },
  
  // 隐藏WebDAV使用说明弹窗
  hideWebDAVHelpModal() {
    this.setData({
      showWebDAVHelpModal: false
    });
  },
  
  // 切换密码显示/隐藏状态
  togglePasswordVisibility() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },
  
  // WebDAV服务器地址输入处理
  onWebDAVUrlInput(e) {
    this.setData({
      'webdavConfig.url': e.detail.value
    });
  },
  
  // WebDAV用户名输入处理
  onWebDAVUsernameInput(e) {
    this.setData({
      'webdavConfig.username': e.detail.value
    });
  },
  
  // WebDAV密码输入处理
  onWebDAVPasswordInput(e) {
    this.setData({
      'webdavConfig.password': e.detail.value
    });
  },
  
  // WebDAV文件夹输入处理
  onWebDAVFolderInput(e) {
    this.setData({
      'webdavConfig.folder': e.detail.value
    });
  },
  
  // 保存WebDAV配置
  saveWebDAVConfig() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url) {
      wx.showToast({
        title: '请输入服务器地址',
        icon: 'none'
      });
      return;
    }
    
    if (!username) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      });
      return;
    }
    
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }
    
    // 保存配置到WebDAV管理器
    this.webDAVManager.saveWebDAVConfig(this.data.webdavConfig);
    
    // 关闭弹窗
    this.hideWebDAVModal();
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },
  
  // 测试WebDAV连接
  testWebDAVConnection() {
    this.webDAVManager.testWebDAVConnection();
  },

  
  // 检查WebDAV服务器上文件是否存在
  checkWebDAVFileExists(url, username, password, folder, fileName) {
    return new Promise((resolve, reject) => {
      const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      // 使用HEAD方法检查文件是否存在
      wx.request({
        url: fileUrl,
        method: 'HEAD',
        header: {
          'Authorization': authHeader
        },
        success: (res) => {
          if (res.statusCode === 200) {
            // 文件存在
            resolve(true);
          } else if (res.statusCode === 404) {
            // 文件不存在
            resolve(false);
          } else {
            console.error('检查文件存在性失败', res.statusCode);
            resolve(false);
          }
        },
        fail: (err) => {
          console.error('检查文件存在性请求失败', err);
          // HEAD请求失败后尝试GET请求
          wx.request({
            url: fileUrl,
            method: 'GET',
            header: {
              'Authorization': authHeader
            },
            success: (res) => {
              if (res.statusCode === 200) {
                // 文件存在
                resolve(true);
              } else {
                resolve(false);
              }
            },
            fail: (err) => {
              console.error('GET请求检查文件存在性失败', err);
              resolve(false);
            }
          });
        }
      });
    });
  },
  
  // 获取当前年月格式（YYYY-MM）
  getCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  // Base64编码函数
  base64Encode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let encoded = '';
    let i = 0;
    while (i < str.length) {
      const c1 = str.charCodeAt(i++) & 0xff;
      if (i === str.length) {
        encoded += chars.charAt(c1 >> 2);
        encoded += chars.charAt((c1 & 0x3) << 4);
        encoded += '==';
        break;
      }
      const c2 = str.charCodeAt(i++) & 0xff;
      if (i === str.length) {
        encoded += chars.charAt(c1 >> 2);
        encoded += chars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
        encoded += chars.charAt((c2 & 0xf) << 2);
        encoded += '=';
        break;
      }
      const c3 = str.charCodeAt(i++) & 0xff;
      encoded += chars.charAt(c1 >> 2);
      encoded += chars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
      encoded += chars.charAt(((c2 & 0xf) << 2) | ((c3 & 0xc0) >> 6));
      encoded += chars.charAt(c3 & 0x3f);
    }
    return encoded;
  },
  
  // WebDAV备份功能（全部备份为ZIP文件）
  backupToWebDAV() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写并保存WebDAV配置',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '备份中...'
    });
    
    try {
      const fs = wx.getFileSystemManager();
      // 生成固定的文件夹名：用户名排班备份
      let folder = this.data.webdavConfig.folder;
      if (!folder) {
        const user = this.data.username || '未命名用户';
        folder = `${user}排班备份`;
      }
      
      // 生成备份文件名，固定为：排班备份.zip
      const backupFileName = `排班备份.zip`;
      // 使用持久路径，避免临时路径
      const backupFilePath = `${wx.env.USER_DATA_PATH}/${backupFileName}`;
      // 确保本地文件不存在，避免写入失败
      try {
        const fs = wx.getFileSystemManager();
        fs.unlinkSync(backupFilePath);
      } catch (e) {
        // 文件不存在，忽略错误
      }
      
      // 生成ZIP文件
      this.generateBackupZip(backupFilePath, fs).then(() => {
        // 上传ZIP文件到WebDAV
        this.uploadToWebDAV(backupFilePath, backupFileName, url, username, password, folder);
        // 更新备份时间戳
        wx.setStorageSync('lastBackupTime', Date.now());
        // 删除旧的备份文件，只保留最新版本
        setTimeout(() => {
          this.cleanupOldBackups(url, username, password, folder, backupFileName);
        }, 1000);
      }).catch((err) => {
        console.error('生成备份ZIP失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '备份失败',
          icon: 'none'
        });
      });
      
    } catch (e) {
      console.error('备份失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
    }
  },
  
  // 生成备份ZIP文件
  generateBackupZip(backupFilePath, fs) {
    return new Promise((resolve, reject) => {
      try {
        const zip = new JSZip();
        
        // 添加班次模板数据
        const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
        zip.file('班次模板.json', JSON.stringify({
          data: shiftTemplates,
          lastModified: new Date().toISOString()
        }, null, 2));
        
        // 添加排班数据
        const shifts = wx.getStorageSync('shifts') || {};
        // 计算统计数据
        let totalHours = 0;
        let workDays = 0;
        let offDays = 0;
        let totalDays = 0;
        
        Object.keys(shifts).forEach(date => {
          const shift = shifts[date];
          totalHours += parseFloat(shift.workHours) || 0;
          totalDays++;
          
          const shiftType = shift.type;
          if (shiftType === '白天班' || shiftType === '跨夜班') {
            workDays++;
          } else if (shiftType === '休息日') {
            offDays++;
          }
        });
        
        const statistics = {
          totalHours: totalHours.toFixed(1),
          totalDays: totalDays,
          workDays: workDays,
          offDays: offDays
        };
        
        zip.file('排班数据.json', JSON.stringify({
          shifts: shifts,
          statistics: statistics,
          lastModified: new Date().toISOString()
        }, null, 2));
        
        // 添加图片文件
        const storageInfo = wx.getStorageInfoSync();
        const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
        
        const imagePromises = [];
        const validWeekImageKeys = []; // 用于跟踪包含有效图片的周
        
        weekImageKeys.forEach(key => {
          const weekImages = wx.getStorageSync(key) || [];
          const validWeekImages = weekImages.filter(image => {
            // 过滤掉名称为"0"的图片和无效图片
            return image && image.name !== '0' && image.path;
          });
          
          // 只处理有有效图片的周
          if (validWeekImages.length > 0) {
            validWeekImageKeys.push(key);
            
            validWeekImages.forEach((image, index) => {
              // 从weekKey中提取年月（格式：YYYY-MM）
              const weekKey = key.replace('week_images_', '');
              let yearMonth;
              try {
                const weekDate = new Date(weekKey);
                // 检查日期是否有效
                if (!isNaN(weekDate.getTime())) {
                  const year = weekDate.getFullYear();
                  const month = String(weekDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                } else {
                  // 如果日期无效，使用当前日期
                  const currentDate = new Date();
                  const year = currentDate.getFullYear();
                  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                }
              } catch (e) {
                // 如果发生错误，使用当前日期
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                yearMonth = `${year}-${month}`;
              }
              // 使用原始图片名称
              const imageName = image.name || `image_${index}.jpg`;
              const imageFileName = `image/${yearMonth}/${imageName}`;
              const localImagePath = image.path;
              
              const imagePromise = new Promise((resolveImage) => {
                fs.readFile({
                  filePath: localImagePath,
                  success: (res) => {
                    // 添加图片到ZIP
                    zip.file(imageFileName, res.data);
                    resolveImage();
                  },
                  fail: (err) => {
                    console.error('读取图片失败', err);
                    resolveImage(); // 忽略失败的图片
                  }
                });
              });
              
              imagePromises.push(imagePromise);
            });
          }
        });
        
        // 等待所有图片处理完成
        Promise.all(imagePromises).then(() => {
          // 生成图片周关联表数据
          const imageWeekRelation = {};
          validWeekImageKeys.forEach(key => {
            const weekImages = wx.getStorageSync(key) || [];
            const validWeekImages = weekImages.filter(image => {
              // 过滤掉名称为"0"的图片和无效图片
              return image && image.name !== '0' && image.path;
            });
            imageWeekRelation[key] = [];
            validWeekImages.forEach((image, index) => {
              // 从weekKey中提取年月（格式：YYYY-MM）
              const weekKey = key.replace('week_images_', '');
              let yearMonth;
              try {
                const weekDate = new Date(weekKey);
                if (!isNaN(weekDate.getTime())) {
                  const year = weekDate.getFullYear();
                  const month = String(weekDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                } else {
                  const currentDate = new Date();
                  const year = currentDate.getFullYear();
                  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                }
              } catch (e) {
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                yearMonth = `${year}-${month}`;
              }
              const imageName = image.name || `image_${index}.jpg`;
              const imagePath = `image/${yearMonth}/${imageName}`;
              imageWeekRelation[key].push({ name: imageName, path: imagePath });
            });
          });
          
          // 添加图片周关联表.json文件
          zip.file('图片周关联表.json', JSON.stringify(imageWeekRelation, null, 2));
          
          // 生成ZIP文件
          zip.generateAsync({ type: 'arraybuffer' }).then((content) => {
            // 写入ZIP文件
            fs.writeFile({
              filePath: backupFilePath,
              data: content,
              success: () => {
                resolve();
              },
              fail: (err) => {
                console.error('写入ZIP文件失败', err);
                reject(err);
              }
            });
          }).catch((err) => {
            console.error('生成ZIP失败', err);
            reject(err);
          });
        });
        
      } catch (e) {
        console.error('生成备份ZIP失败', e);
        reject(e);
      }
    });
  },
  
  // WebDAV备份功能（全部备份为ZIP文件）
  backupToWebDAV() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写并保存WebDAV配置',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '备份中...'
    });
    
    try {
      const fs = wx.getFileSystemManager();
      // 生成固定的文件夹名：用户名排班备份
      let folder = this.data.webdavConfig.folder;
      if (!folder) {
        const user = this.data.username || '未命名用户';
        folder = `${user}排班备份`;
      }
      
      // 生成备份文件名，固定为：排班备份.zip
      const backupFileName = `排班备份.zip`;
      const backupFilePath = `${wx.env.USER_DATA_PATH}/${backupFileName}`;
      
      // 生成ZIP文件
      this.generateBackupZip(backupFilePath, fs).then(() => {
        // 上传ZIP文件到WebDAV（不显示单独的提示）
        return this.uploadToWebDAV(backupFilePath, backupFileName, url, username, password, folder, false);
      }).then(() => {
        // 生成并上传索引文件（不显示单独的提示）
        return this.generateAndUploadBackupIndex(backupFileName, url, username, password, folder);
      }).then(() => {
        // 更新备份时间戳
        wx.setStorageSync('lastBackupTime', Date.now());
        // 删除旧的备份文件，只保留最新版本
        this.cleanupOldBackups(url, username, password, folder, backupFileName);
        // 显示最终的成功提示
        wx.hideLoading();
        wx.showToast({
          title: '备份成功',
          icon: 'success'
        });
      }).catch((err) => {
        console.error('备份失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '备份失败',
          icon: 'none'
        });
      });
      
    } catch (e) {
      console.error('备份失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
    }
  },
  
  // 生成并上传备份索引文件
  generateAndUploadBackupIndex(backupFileName, url, username, password, folder) {
    return new Promise((resolve, reject) => {
      try {
        const fs = wx.getFileSystemManager();
        // 确保本地索引文件不存在，避免写入失败
        const indexFilePath = `${wx.env.USER_DATA_PATH}/backup-index.json`;
        try {
          fs.unlinkSync(indexFilePath);
        } catch (e) {
          // 文件不存在，忽略错误
        }
        
        // 生成索引文件内容
        const backupIndex = {
          appid: 'wx1234567890abcdef', // 替换为你的小程序 AppID
          timestamp: Date.now(),
          davHost: url, // 坚果云固定WebDAV地址
          backupFile: {
            fileName: backupFileName,
            davPath: `${folder}/${backupFileName}`,
            lastModified: new Date().toISOString()
          },
          files: [
            {
              fileName: backupFileName,
              davPath: `${folder}/${backupFileName}`,
              localPath: `${wx.env.USER_DATA_PATH}/${backupFileName}`,
              type: 'zip',
              lastModified: new Date().toISOString()
            }
          ]
        };
        
        // 写入索引文件
        fs.writeFile({
          filePath: indexFilePath,
          data: JSON.stringify(backupIndex, null, 2),
          encoding: 'utf8',
          success: () => {
            // 上传索引文件到WebDAV（不显示单独的提示）
            this.uploadToWebDAV(indexFilePath, 'backup-index.json', url, username, password, folder, false).then(() => {
              resolve();
            }).catch((err) => {
              console.error('上传索引文件失败', err);
              reject(err);
            });
          },
          fail: (err) => {
            console.error('写入索引文件失败', err);
            reject(err);
          }
        });
      } catch (e) {
        console.error('生成索引文件失败', e);
        reject(e);
      }
    });
  },
  
  // 判断是否需要备份
  needBackup(dataType, serverInfo, localTime) {
    // 如果服务器上没有文件，需要备份
    if (!serverInfo) {
      return true;
    }
    
    // 如果本地时间戳为0（首次备份），需要备份
    if (localTime === 0) {
      return true;
    }
    
    // 对比服务器文件和本地数据的修改时间
    try {
      const serverTime = new Date(serverInfo.lastModified).getTime();
      // 如果本地数据比服务器文件新，需要备份
      return localTime > serverTime;
    } catch (e) {
      // 解析时间失败，默认需要备份
      return true;
    }
  },
  
  // 判断是否需要备份图片
  needBackupImages(localImagesTime) {
    // 获取所有图片的最后修改时间
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    let latestImageTime = 0;
    weekImageKeys.forEach(key => {
      const weekImages = wx.getStorageSync(key) || [];
      weekImages.forEach(image => {
        if (image.addedTime) {
          const imageTime = new Date(image.addedTime).getTime();
          if (imageTime > latestImageTime) {
            latestImageTime = imageTime;
          }
        }
      });
    });
    
    // 如果有新图片或首次备份，需要备份
    return latestImageTime > localImagesTime || localImagesTime === 0;
  },
  
  // 备份班次模板
  backupShiftTemplates(url, username, password, folder, fs) {
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    const fileName = '班次模板.json';
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    
    // 添加时间戳，用于增量备份对比
    const shiftTemplatesData = {
      data: shiftTemplates,
      lastModified: new Date().toISOString()
    };
    
    fs.writeFile({
      filePath: filePath,
      data: JSON.stringify(shiftTemplatesData, null, 2),
      encoding: 'utf8',
      success: () => {
        this.uploadToWebDAV(filePath, fileName, url, username, password, folder);
      },
      fail: (err) => {
        console.error('备份班次模板失败', err);
      }
    });
  },
  
  // 备份排班数据
  backupShifts(url, username, password, folder, fs) {
    const shifts = wx.getStorageSync('shifts') || {};
    
    // 计算统计数据
    let totalHours = 0;
    let workDays = 0;
    let offDays = 0;
    let totalDays = 0;
    
    Object.keys(shifts).forEach(date => {
      const shift = shifts[date];
      totalHours += parseFloat(shift.workHours) || 0;
      totalDays++;
      
      const shiftType = shift.type;
      if (shiftType === '白天班' || shiftType === '跨夜班') {
        workDays++;
      } else if (shiftType === '休息日') {
        offDays++;
      }
    });
    
    const statistics = {
      totalHours: totalHours.toFixed(1),
      totalDays: totalDays,
      workDays: workDays,
      offDays: offDays
    };
    
    // 添加时间戳，用于增量备份对比
    const shiftsData = {
      shifts: shifts,
      statistics: statistics,
      lastModified: new Date().toISOString()
    };
    
    const fileName = '排班数据.json';
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    
    fs.writeFile({
      filePath: filePath,
      data: JSON.stringify(shiftsData, null, 2),
      encoding: 'utf8',
      success: () => {
        this.uploadToWebDAV(filePath, fileName, url, username, password, folder);
      },
      fail: (err) => {
        console.error('备份排班数据失败', err);
      }
    });
  },
  
  // 备份图片文件夹（增量备份）
  backupImages(url, username, password, folder, fs) {
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    if (weekImageKeys.length === 0) {
      wx.hideLoading();
      wx.showToast({
        title: '备份成功',
        icon: 'success'
      });
      return;
    }
    
    // 获取本地图片最后备份时间
    const lastBackupTime = wx.getStorageSync('imagesLastModified') || 0;
    
    let imageCount = 0;
    let uploadedCount = 0;
    let hasNewImages = false;
    
    weekImageKeys.forEach(key => {
      const weekImages = wx.getStorageSync(key) || [];
      weekImages.forEach((image, index) => {
        // 检查图片是否是新添加的（在最后备份时间之后）
        const imageTime = image.addedTime ? new Date(image.addedTime).getTime() : 0;
        if (imageTime > lastBackupTime || lastBackupTime === 0) {
          hasNewImages = true;
          imageCount++;
          // 从weekKey中提取年月（格式：YYYY-MM）
          const weekKey = key.replace('week_images_', '');
          let yearMonth;
          try {
            const weekDate = new Date(weekKey);
            // 检查日期是否有效
            if (!isNaN(weekDate.getTime())) {
              const year = weekDate.getFullYear();
              const month = String(weekDate.getMonth() + 1).padStart(2, '0');
              yearMonth = `${year}-${month}`;
            } else {
              // 如果日期无效，使用当前日期
              const currentDate = new Date();
              const year = currentDate.getFullYear();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              yearMonth = `${year}-${month}`;
            }
          } catch (e) {
            // 如果发生错误，使用当前日期
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            yearMonth = `${year}-${month}`;
          }
          const imageFileName = `image/${yearMonth}/${key}_${index}_${image.name || `image_${index}.jpg`}`;
          const localImagePath = image.path;
          
          fs.readFile({
          filePath: localImagePath,
          success: (res) => {
            const uploadUrl = this.buildWebDAVUrl(url, folder, imageFileName);
            const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
              
              wx.request({
                url: uploadUrl,
                method: 'PUT',
                header: {
                  'Authorization': authHeader,
                  'Content-Type': 'image/jpeg'
                },
                data: res.data,
                success: () => {
                  uploadedCount++;
                  if (uploadedCount === imageCount) {
                    // 更新图片最后备份时间戳
                    wx.setStorageSync('imagesLastModified', Date.now());
                    wx.hideLoading();
                    wx.showToast({
                      title: '备份成功',
                      icon: 'success'
                    });
                  }
                },
                fail: (err) => {
                  console.error('上传图片失败', err);
                  uploadedCount++;
                  if (uploadedCount === imageCount) {
                    // 更新图片最后备份时间戳
                    wx.setStorageSync('imagesLastModified', Date.now());
                    wx.hideLoading();
                    wx.showToast({
                      title: '备份成功（部分图片上传失败）',
                      icon: 'none'
                    });
                  }
                }
              });
            },
            fail: (err) => {
              console.error('读取图片失败', err);
              uploadedCount++;
              if (uploadedCount === imageCount) {
                wx.hideLoading();
                wx.showToast({
                  title: '备份成功（部分图片读取失败）',
                  icon: 'none'
                });
              }
            }
          });
        }
      });
    });
    
    // 如果没有新图片需要上传
    if (!hasNewImages) {
      // 更新图片最后备份时间戳
      wx.setStorageSync('imagesLastModified', Date.now());
      wx.hideLoading();
      wx.showToast({
        title: '备份成功（无新图片）',
        icon: 'success'
      });
    }
  },
  
  // 构建WebDAV URL，确保符合坚果云要求
  buildWebDAVUrl(url, folder, fileName) {
    // 确保URL包含协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    
    // 确保URL以/结尾，符合坚果云要求
    let webDavUrl = url.endsWith('/') ? url : url + '/';
    
    // 处理文件夹路径，确保无特殊字符
    if (folder) {
      // 移除文件夹路径中的特殊字符，符合坚果云命名规则
      const safeFolder = folder.replace(/[\\/:*?"<>|]/g, '_').trim();
      webDavUrl += safeFolder.endsWith('/') ? safeFolder : safeFolder + '/';
    }
    
    // 处理文件名，确保无特殊字符
    const safeFileName = fileName.replace(/[\\/:*?"<>|]/g, '_').trim();
    webDavUrl += safeFileName;
    
    return webDavUrl;
  },
  
  // 获取WebDAV服务器上文件的详细信息
  getWebDAVFileInfo(url, username, password, folder, fileName) {
    return new Promise((resolve, reject) => {
      const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      // 使用HEAD方法获取文件信息（微信小程序支持的方法）
      wx.request({
        url: fileUrl,
        method: 'HEAD',
        header: {
          'Authorization': authHeader
        },
        success: (res) => {
          if (res.statusCode === 200) { // HEAD请求成功
            // 从响应头中提取Last-Modified信息
            const lastModified = res.header['Last-Modified'] || res.header['last-modified'] || null;
            resolve({ lastModified });
          } else if (res.statusCode === 404) {
            // 文件不存在，返回null
            resolve(null);
          } else {
            console.error('获取WebDAV文件信息失败', res.statusCode);
            resolve(null);
          }
        },
        fail: (err) => {
          console.error('获取WebDAV文件信息请求失败', err);
          // HEAD请求失败后尝试GET请求
          this.getWebDAVFileInfoWithGET(fileUrl, authHeader, resolve);
        }
      });
    });
  },
  
  // 使用GET方法获取WebDAV文件信息（备用方法）
  getWebDAVFileInfoWithGET(fileUrl, authHeader, resolve) {
    wx.request({
      url: fileUrl,
      method: 'GET',
      header: {
        'Authorization': authHeader
      },
      success: (res) => {
        if (res.statusCode === 200) { // GET请求成功
          // 从响应头中提取Last-Modified信息
          const lastModified = res.header['Last-Modified'] || res.header['last-modified'] || null;
          resolve({ lastModified });
        } else if (res.statusCode === 404) {
          // 文件不存在，返回null
          resolve(null);
        } else {
          console.error('获取WebDAV文件信息失败', res.statusCode);
          resolve(null);
        }
      },
      fail: (err) => {
        console.error('GET请求获取WebDAV文件信息失败', err);
        resolve(null);
      }
    });
  },
  
  // 上传文件到WebDAV
  uploadToWebDAV(filePath, fileName, url, username, password, folder, showToast = true) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      
      // 读取文件内容
      fs.readFile({
        filePath: filePath,
        success: (res) => {
          const fileContent = res.data;
          // 构建上传URL，考虑自定义文件夹
          let uploadUrl = url.endsWith('/') ? url : url + '/';
          if (folder) {
            uploadUrl += folder.endsWith('/') ? folder : folder + '/';
          }
          uploadUrl += fileName;
          const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
          
          // 根据文件扩展名设置正确的Content-Type
          let contentType = 'application/octet-stream';
          if (fileName.endsWith('.zip')) {
            contentType = 'application/zip';
          } else if (fileName.endsWith('.json')) {
            contentType = 'application/json';
          } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
          } else if (fileName.endsWith('.png')) {
            contentType = 'image/png';
          }
          
          // 上传文件
          wx.request({
            url: uploadUrl,
            method: 'PUT',
            header: {
              'Authorization': authHeader,
              'Content-Type': contentType
            },
            data: fileContent,
            success: (res) => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                if (showToast) {
                  wx.hideLoading();
                  wx.showToast({
                    title: '备份成功',
                    icon: 'success'
                  });
                }
                resolve();
              } else {
                if (showToast) {
                  wx.hideLoading();
                  wx.showToast({
                    title: `备份失败: ${res.statusCode}`,
                    icon: 'none'
                  });
                }
                reject(new Error(`备份失败: ${res.statusCode}`));
              }
            },
            fail: (err) => {
              if (showToast) {
                wx.hideLoading();
                wx.showToast({
                  title: '备份失败，请检查网络连接',
                  icon: 'none'
                });
              }
              reject(err);
            }
          });
        },
        fail: (err) => {
          if (showToast) {
            wx.hideLoading();
            wx.showToast({
              title: '读取文件失败',
              icon: 'none'
            });
          }
          reject(err);
        }
      });
    });
  },
  
  // 从WebDAV恢复备份（从ZIP文件恢复）
  restoreFromWebDAV() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写并保存WebDAV配置',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '获取备份文件列表...'
    });
    
    try {
      // 生成固定的文件夹名：用户名排班备份
      let folder = this.data.webdavConfig.folder;
      if (!folder) {
        const user = this.data.username || '未命名用户';
        folder = `${user}排班备份`;
      }
      
      // 尝试下载并使用索引文件
      this.downloadBackupIndex(url, username, password, folder).then((backupIndex) => {
        wx.hideLoading();
        
        if (backupIndex && backupIndex.backupFile) {
          // 使用索引文件中的备份信息
          const selectedFile = backupIndex.backupFile.fileName;
          wx.showLoading({
            title: '恢复中...'
          });
          
          // 下载并恢复选中的备份文件
          this.downloadAndRestoreBackup(url, username, password, folder, selectedFile).then(() => {
            wx.hideLoading();
            wx.showToast({
              title: '恢复成功',
              icon: 'success'
            });
            
            // 延迟刷新页面数据，确保所有恢复操作完成
            setTimeout(() => {
              this.refreshPageData();
            }, 500);
          }).catch((err) => {
            console.error('恢复备份失败', err);
            wx.hideLoading();
            wx.showToast({
              title: '恢复失败',
              icon: 'none'
            });
          });
        } else {
          // 索引文件不存在或无效，使用原来的方法
          this.getWebDAVBackupFiles(url, username, password, folder).then((backupFiles) => {
            wx.hideLoading();
            
            if (backupFiles.length === 0) {
              wx.showToast({
                title: '未找到备份文件',
                icon: 'none'
              });
              return;
            }
            
            // 按文件名排序（最新的备份文件在前面）
            backupFiles.sort((a, b) => {
              return b.localeCompare(a);
            });
            
            // 自动选择最新的备份文件
            const selectedFile = backupFiles[0];
            wx.showLoading({
              title: '恢复中...'
            });
            
            // 下载并恢复选中的备份文件
            this.downloadAndRestoreBackup(url, username, password, folder, selectedFile).then(() => {
              wx.hideLoading();
              wx.showToast({
                title: '恢复成功',
                icon: 'success'
              });
              
              // 延迟刷新页面数据，确保所有恢复操作完成
              setTimeout(() => {
                this.refreshPageData();
              }, 500);
            }).catch((err) => {
              console.error('恢复备份失败', err);
              wx.hideLoading();
              wx.showToast({
                title: '恢复失败',
                icon: 'none'
              });
            });
          }).catch((err) => {
            console.error('获取备份文件列表失败', err);
            wx.hideLoading();
            wx.showToast({
              title: '获取备份文件列表失败',
              icon: 'none'
            });
          });
        }
      }).catch((err) => {
        console.error('下载索引文件失败，使用原方法', err);
        // 索引文件下载失败，使用原来的方法
        this.getWebDAVBackupFiles(url, username, password, folder).then((backupFiles) => {
          wx.hideLoading();
          
          if (backupFiles.length === 0) {
            wx.showToast({
              title: '未找到备份文件',
              icon: 'none'
            });
            return;
          }
          
          // 按文件名排序（最新的备份文件在前面）
          backupFiles.sort((a, b) => {
            return b.localeCompare(a);
          });
          
          // 自动选择最新的备份文件
          const selectedFile = backupFiles[0];
          wx.showLoading({
            title: '恢复中...'
          });
          
          // 下载并恢复选中的备份文件
          this.downloadAndRestoreBackup(url, username, password, folder, selectedFile).then(() => {
            wx.hideLoading();
            wx.showToast({
              title: '恢复成功',
              icon: 'success'
            });
            
            // 延迟刷新页面数据，确保所有恢复操作完成
            setTimeout(() => {
              this.refreshPageData();
            }, 500);
          }).catch((err) => {
            console.error('恢复备份失败', err);
            wx.hideLoading();
            wx.showToast({
              title: '恢复失败',
              icon: 'none'
            });
          });
        }).catch((err) => {
          console.error('获取备份文件列表失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '获取备份文件列表失败',
            icon: 'none'
          });
        });
      });
      
    } catch (e) {
      console.error('恢复备份异常', e);
      wx.hideLoading();
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
    }
  },
  
  // 从WebDAV下载备份索引文件
  downloadBackupIndex(url, username, password, folder) {
    return new Promise((resolve, reject) => {
      const indexFilePath = `${wx.env.USER_DATA_PATH}/backup-index.json`;
      const indexUrl = this.buildWebDAVUrl(url, folder, 'backup-index.json');
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      wx.request({
        url: indexUrl,
        method: 'GET',
        header: {
          'Authorization': authHeader
        },
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode === 200) {
            const fs = wx.getFileSystemManager();
            // 确保本地文件不存在，避免写入失败
            try {
              fs.unlinkSync(indexFilePath);
            } catch (e) {
              // 文件不存在，忽略错误
            }
            
            fs.writeFile({
              filePath: indexFilePath,
              data: res.data,
              success: () => {
                try {
                  const indexContent = fs.readFileSync(indexFilePath, 'utf8');
                  const backupIndex = JSON.parse(indexContent);
                  resolve(backupIndex);
                } catch (e) {
                  console.error('解析索引文件失败', e);
                  resolve(null);
                }
              },
              fail: (err) => {
                console.error('写入索引文件失败', err);
                resolve(null);
              }
            });
          } else {
            console.error('下载索引文件失败', res.statusCode);
            resolve(null);
          }
        },
        fail: (err) => {
          console.error('下载索引文件请求失败', err);
          resolve(null);
        }
      });
    });
  },
  
  // 获取WebDAV服务器上的备份文件列表
  getWebDAVBackupFiles(url, username, password, folder) {
    return new Promise((resolve, reject) => {
      // 构建文件夹URL
      const folderUrl = this.buildWebDAVUrl(url, folder, '');
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      // 直接使用GET方法获取文件夹内容（微信小程序支持的方法）
      this.tryGetWithGET(folderUrl, authHeader, resolve, reject);
    });
  },
  
  // 尝试使用GET方法获取文件夹内容
  tryGetWithGET(folderUrl, authHeader, resolve, reject) {
    wx.request({
      url: folderUrl,
      method: 'GET',
      header: {
        'Authorization': authHeader
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 解析HTML或XML响应，提取备份文件列表
          const backupFiles = this.parseBackupFilesFromResponse(res.data);
          resolve(backupFiles);
        } else {
          console.error('获取备份文件列表失败', res.statusCode);
          resolve([]);
        }
      },
      fail: (err) => {
        console.error('获取备份文件列表请求失败', err);
        resolve([]);
      }
    });
  },
  
  // 解析WebDAV PROPFIND响应，提取备份文件列表
  parseWebDAVBackupFiles(xmlData) {
    const backupFiles = [];
    const regex = /<d:response>([\s\S]*?)<\/d:response>/g;
    let match;
    
    while ((match = regex.exec(xmlData)) !== null) {
      const response = match[1];
      const hrefMatch = /<d:href>([\s\S]*?)<\/d:href>/.exec(response);
      const propstatMatch = /<d:propstat>([\s\S]*?)<\/d:propstat>/.exec(response);
      
      if (hrefMatch && propstatMatch) {
        const href = hrefMatch[1];
        const propstat = propstatMatch[1];
        const isCollectionMatch = /<d:collection\/>/.exec(propstat);
        
        if (!isCollectionMatch) {
          // 从href中提取文件名
          let fileName;
          if (href.includes('/')) {
            fileName = href.split('/').pop();
          } else {
            fileName = href;
          }
          
          // 清理文件名，移除可能的URL编码
          fileName = decodeURIComponent(fileName);
          
          // 检查是否是备份文件（以"排班备份"开头，以".zip"结尾）
          if (fileName.includes('排班备份') && fileName.endsWith('.zip') && !backupFiles.includes(fileName)) {
            backupFiles.push(fileName);
          }
        }
      }
    }
    
    // 按文件名排序（最新的备份文件在前面）
    backupFiles.sort((a, b) => {
      return b.localeCompare(a);
    });
    
    return backupFiles;
  },
  
  // 解析响应数据，提取备份文件列表
  parseBackupFilesFromResponse(responseData) {
    const backupFiles = [];
    const responseStr = String(responseData);
    
    // 方法1：尝试解析HTML链接
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = linkRegex.exec(responseStr)) !== null) {
      const href = match[1];
      const linkText = match[2];
      
      // 检查链接文本或href是否包含备份文件名
      if ((linkText.includes('排班备份') && linkText.endsWith('.zip')) || (href.includes('排班备份') && href.endsWith('.zip'))) {
        // 从href中提取文件名
        let fileName;
        if (href.includes('/')) {
          fileName = href.split('/').pop();
        } else {
          fileName = linkText;
        }
        
        // 清理文件名，移除可能的URL编码
        fileName = decodeURIComponent(fileName);
        
        if (fileName.includes('排班备份') && fileName.endsWith('.zip') && !backupFiles.includes(fileName)) {
          backupFiles.push(fileName);
        }
      }
    }
    
    // 方法2：如果方法1没有找到文件，尝试直接搜索文件名模式
    if (backupFiles.length === 0) {
      const fileRegex = /[^"]*排班备份[^"]*\.zip/g;
      let fileMatch;
      
      while ((fileMatch = fileRegex.exec(responseStr)) !== null) {
        let fileName = fileMatch[0].trim();
        
        // 清理文件名
        fileName = fileName.replace(/[<>"'&]/g, '').trim();
        
        if (fileName.includes('排班备份') && fileName.endsWith('.zip') && !backupFiles.includes(fileName)) {
          backupFiles.push(fileName);
        }
      }
    }
    
    // 方法3：如果还是没有找到，尝试更宽松的匹配
    if (backupFiles.length === 0) {
      const looseRegex = /排班备份[^\s<>"'&]+\.zip/g;
      let looseMatch;
      
      while ((looseMatch = looseRegex.exec(responseStr)) !== null) {
        let fileName = looseMatch[0].trim();
        
        if (fileName.endsWith('.zip') && !backupFiles.includes(fileName)) {
          backupFiles.push(fileName);
        }
      }
    }
    
    // 按文件名排序（最新的备份文件在前面）
    backupFiles.sort((a, b) => {
      return b.localeCompare(a);
    });
    
    return backupFiles;
  },
  
  // 显示备份文件选择器
  showBackupFileSelector(backupFiles, callback) {
    wx.showActionSheet({
      itemList: backupFiles,
      success: (res) => {
        const selectedFile = backupFiles[res.tapIndex];
        callback(selectedFile);
      },
      fail: (err) => {
        console.error('选择备份文件失败', err);
      }
    });
  },
  
  // 下载并恢复备份文件
  downloadAndRestoreBackup(url, username, password, folder, backupFileName) {
    return new Promise((resolve, reject) => {
      const backupUrl = this.buildWebDAVUrl(url, folder, backupFileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      const backupFilePath = `${wx.env.USER_DATA_PATH}/${backupFileName}`;
      
      const fs = wx.getFileSystemManager();
      
      // 确保本地文件不存在，避免写入失败
      try {
        fs.unlinkSync(backupFilePath);
      } catch (e) {
        // 文件不存在，忽略错误
      }
      
      // 下载备份文件
      wx.request({
        url: backupUrl,
        method: 'GET',
        header: {
          'Authorization': authHeader
        },
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode === 200) {
            // 写入下载的ZIP文件
            fs.writeFile({
              filePath: backupFilePath,
              data: res.data,
              success: () => {
                // 解压并恢复ZIP文件
                this.extractAndRestoreBackup(backupFilePath, fs).then(() => {
                  resolve();
                }).catch((err) => {
                  console.error('解压并恢复备份失败', err);
                  reject(err);
                });
              },
              fail: (err) => {
                console.error('写入备份文件失败', err);
                reject(err);
              }
            });
          } else {
            console.error('下载备份文件失败', res.statusCode);
            reject(new Error('下载备份文件失败'));
          }
        },
        fail: (err) => {
          console.error('下载备份文件请求失败', err);
          reject(err);
        }
      });
    });
  },
  
  // 计算文件MD5（简化版，实际项目中可能需要更复杂的实现）
  calculateFileMD5(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: filePath,
        success: (res) => {
          // 注意：微信小程序中没有内置的MD5计算函数
          // 这里使用一个简化的方法，实际项目中可能需要引入第三方库
          // 或者使用云函数来计算MD5
          const data = res.data;
          let hash = 0;
          for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
          }
          resolve(hash.toString(16));
        },
        fail: (err) => {
          console.error('读取文件失败', err);
          reject(err);
        }
      });
    });
  },
  
  // 解压并恢复备份文件
  extractAndRestoreBackup(backupFilePath, fs) {
    return new Promise((resolve, reject) => {
      try {
        const zip = new JSZip();
        
        // 读取并解压ZIP文件
        fs.readFile({
          filePath: backupFilePath,
          success: (res) => {
            zip.loadAsync(res.data).then((zip) => {
              // 提取并恢复班次模板
              this.extractAndRestoreFile(zip, '班次模板.json', (data) => {
                if (data.data) {
                  wx.setStorageSync('shiftTemplates', data.data);
                }
              });
              
              // 提取并恢复排班数据
              this.extractAndRestoreFile(zip, '排班数据.json', (data) => {
                if (data.shifts) {
                  wx.setStorageSync('shifts', data.shifts);
                }
              });
              
              // 提取图片周关联表和恢复图片
              const imageWeekRelationFile = zip.file('图片周关联表.json');
              if (imageWeekRelationFile) {
                imageWeekRelationFile.async('string').then((content) => {
                  try {
                    const imageWeekRelation = JSON.parse(content);
                    // 先清空所有图片存储，避免重复
                    const storageInfo = wx.getStorageInfoSync();
                    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
                    weekImageKeys.forEach(key => {
                      wx.removeStorageSync(key);
                    });
                    // 提取并恢复图片
                    this.extractAndRestoreImages(zip, fs, imageWeekRelation).then(() => {
                      // 所有图片恢复完成后更新时间戳并 resolve
                      wx.setStorageSync('lastRestoreTime', Date.now());
                      resolve();
                    }).catch((err) => {
                      console.error('恢复图片失败', err);
                      wx.setStorageSync('lastRestoreTime', Date.now());
                      resolve();
                    });
                  } catch (e) {
                    console.error('解析图片周关联表失败', e);
                    // 先清空所有图片存储，避免重复
                    const storageInfo = wx.getStorageInfoSync();
                    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
                    weekImageKeys.forEach(key => {
                      wx.removeStorageSync(key);
                    });
                    // 即使解析失败，也要尝试恢复图片
                    this.extractAndRestoreImages(zip, fs, {}).then(() => {
                      wx.setStorageSync('lastRestoreTime', Date.now());
                      resolve();
                    }).catch((err) => {
                      console.error('恢复图片失败', err);
                      wx.setStorageSync('lastRestoreTime', Date.now());
                      resolve();
                    });
                  }
                }).catch((err) => {
                  console.error('提取图片周关联表失败', err);
                  // 先清空所有图片存储，避免重复
                  const storageInfo = wx.getStorageInfoSync();
                  const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
                  weekImageKeys.forEach(key => {
                    wx.removeStorageSync(key);
                  });
                  // 即使提取失败，也要尝试恢复图片
                  this.extractAndRestoreImages(zip, fs, {}).then(() => {
                    wx.setStorageSync('lastRestoreTime', Date.now());
                    resolve();
                  }).catch((err) => {
                    console.error('恢复图片失败', err);
                    wx.setStorageSync('lastRestoreTime', Date.now());
                    resolve();
                  });
                });
              } else {
                // 如果没有图片周关联表，先清空所有图片存储，避免重复
                const storageInfo = wx.getStorageInfoSync();
                const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
                weekImageKeys.forEach(key => {
                  wx.removeStorageSync(key);
                });
                // 尝试直接恢复图片
                this.extractAndRestoreImages(zip, fs, {}).then(() => {
                  wx.setStorageSync('lastRestoreTime', Date.now());
                  resolve();
                }).catch((err) => {
                  console.error('恢复图片失败', err);
                  wx.setStorageSync('lastRestoreTime', Date.now());
                  resolve();
                });
              }
            }).catch((err) => {
              console.error('解压ZIP文件失败', err);
              reject(err);
            });
          },
          fail: (err) => {
            console.error('读取备份文件失败', err);
            reject(err);
          }
        });
      } catch (e) {
        console.error('解压并恢复备份异常', e);
        reject(e);
      }
    });
  },
  
  // 提取并恢复单个文件
  extractAndRestoreFile(zip, fileName, callback) {
    const file = zip.file(fileName);
    if (file) {
      file.async('string').then((content) => {
        try {
          const data = JSON.parse(content);
          callback(data);
        } catch (e) {
          console.error(`解析${fileName}失败`, e);
        }
      }).catch((err) => {
        console.error(`提取${fileName}失败`, err);
      });
    }
  },
  
  // 提取并恢复图片（兼容新旧路径格式），返回 Promise 以便等待所有图片处理完成
  extractAndRestoreImages(zip, fs, imageWeekRelation = {}) {
    return new Promise((resolve, reject) => {
      // 尝试获取新旧两种路径格式的图片文件夹
      const imageFolder = zip.folder('image') || zip.folder('images');
      if (!imageFolder) {
        console.log('没有图片文件夹');
        resolve(); // 没有图片文件夹，直接返回成功
        return;
      }
      
      console.log('开始恢复图片，图片周关联表:', JSON.stringify(imageWeekRelation));
      
      const imagePromises = []; // 存储所有图片处理的 Promise
      
      // 先收集所有文件，再处理
      const files = [];
      const collectFiles = (folder, basePath = '') => {
        folder.forEach((relativePath, file) => {
          if (!file.dir) {
            files.push({ relativePath, file, basePath });
          } else {
            const subFolder = folder.folder(relativePath);
            if (subFolder) {
              collectFiles(subFolder, `${basePath}${relativePath}/`);
            }
          }
        });
      };
      
      collectFiles(imageFolder);
      console.log('收集到的图片文件数量:', files.length);
      
      // 处理所有收集到的文件
      files.forEach(({ relativePath, file, basePath }) => {
        const promise = file.async('arraybuffer').then((content) => {
          return new Promise((resolveImage) => {
            // 完整的图片路径
            const fullImagePath = `${basePath}${relativePath}`;
            console.log('处理图片:', fullImagePath);
            
            // 路径规范化函数
            const normalizePath = (path) => {
              // 移除 "image/" 前缀
              let normalized = path.replace(/^image\//, '');
              // 替换双斜杠为单斜杠
              normalized = normalized.replace(/\/\//g, '/');
              // 移除首尾斜杠
              normalized = normalized.replace(/^\/|\/$/g, '');
              return normalized;
            };
            
            // 尝试从图片周关联表中查找对应的周存储
            let weekImageKey = null;
            let imageName = null;
            
            // 遍历图片周关联表，查找匹配的图片路径
            Object.keys(imageWeekRelation).forEach(key => {
              const images = imageWeekRelation[key] || [];
              for (const img of images) {
                const normalizedImgPath = normalizePath(img.path);
                const normalizedFullPath = normalizePath(fullImagePath);
                console.log('检查关联表项:', normalizedImgPath, 'vs', normalizedFullPath);
                if (normalizedImgPath === normalizedFullPath) {
                  weekImageKey = key;
                  imageName = img.name;
                  console.log('找到匹配的关联表项:', weekImageKey, imageName);
                  return;
                }
              }
            });
            
            if (weekImageKey && imageName) {
              // 使用图片周关联表中的信息恢复图片
              const existingImages = wx.getStorageSync(weekImageKey) || [];
              console.log('当前周的现有图片数量:', existingImages.length);
              
              // 生成图片唯一标识（基于周 key、图片名和内容长度）
              const imageId = `${weekImageKey}_${imageName}_${content.byteLength}`;
              
              // 检查图片是否已存在
              const imageExists = existingImages.some(img => 
                img.id === imageId || 
                (img.name === imageName && img.path.includes(imageName))
              );
              
              if (!imageExists) {
                // 生成临时图片路径
                const tempPath = `${wx.env.USER_DATA_PATH}/${imageId}.jpg`;
                console.log('生成临时图片路径:', tempPath);
                
                // 写入图片文件
                fs.writeFile({
                  filePath: tempPath,
                  data: content,
                  success: () => {
                    console.log('图片写入成功:', tempPath);
                    // 添加新图片
                    existingImages.push({
                      id: imageId,
                      name: imageName,
                      path: tempPath,
                      addedTime: new Date().toISOString()
                    });
                    
                    // 保存图片数据
                    wx.setStorageSync(weekImageKey, existingImages);
                    console.log('保存图片数据到存储:', weekImageKey, existingImages.length);
                    
                    // 同步更新到图片关联表
                    try {
                      const { addImageToRelation } = require('../../utils/imageRelation.js');
                      addImageToRelation(weekImageKey, {
                        id: imageId,
                        name: imageName,
                        path: tempPath,
                        addedTime: new Date().toISOString()
                      });
                      console.log('更新图片关联表成功');
                    } catch (e) {
                      console.error('更新图片关联表失败', e);
                    }
                    
                    resolveImage();
                  },
                  fail: (err) => {
                    console.error('写入图片文件失败', err);
                    resolveImage();
                  }
                });
              } else {
                console.log('图片已存在，跳过:', imageName);
                resolveImage();
              }
            } else {
              console.log('没有找到匹配的关联表项，使用默认处理');
              // 兼容处理：如果没有图片周关联表，尝试从路径中提取日期信息
              const fileName = relativePath.split('/').pop();
              const pathParts = basePath.split('/').filter(Boolean);
              
              // 尝试从路径中提取年月信息（如 YYYY-MM）
              let yearMonth = null;
              if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                if (/^\d{4}-\d{2}$/.test(lastPart)) {
                  yearMonth = lastPart;
                }
              }
              
              // 直接使用文件名作为图片名
              const imgName = fileName;
              
              // 尝试从文件名中解析周信息（如果可能）
              let weekKey = 'unknown';
              
              // 如果有年月信息，尝试生成一个合理的周 key
              if (yearMonth) {
                const [year, month] = yearMonth.split('-');
                // 使用该月的第一天作为默认周 key
                weekKey = `${year}-${month}-01`;
              } else {
                // 简单处理：使用当前日期作为默认周 key
                const currentDate = new Date();
                weekKey = currentDate.toISOString().split('T')[0];
              }
              
              const weekImgKey = `week_images_${weekKey}`;
              const existingImages = wx.getStorageSync(weekImgKey) || [];
              
              // 生成图片唯一标识
              const imageId = `${weekImgKey}_${imgName}_${content.byteLength}`;
              
              // 检查图片是否已存在
              const imageExists = existingImages.some(img => 
                img.id === imageId || 
                (img.name === imgName && img.path.includes(imgName))
              );
              
              if (!imageExists) {
                // 生成临时图片路径
                const tempPath = `${wx.env.USER_DATA_PATH}/${imageId}.jpg`;
                
                // 写入图片文件
                fs.writeFile({
                  filePath: tempPath,
                  data: content,
                  success: () => {
                    // 添加新图片
                    existingImages.push({
                      id: imageId,
                      name: imgName,
                      path: tempPath,
                      addedTime: new Date().toISOString()
                    });
                    
                    // 保存图片数据
                    wx.setStorageSync(weekImgKey, existingImages);
                    
                    // 同步更新到图片关联表
                    try {
                      const { addImageToRelation } = require('../../utils/imageRelation.js');
                      addImageToRelation(weekImgKey, {
                        id: imageId,
                        name: imgName,
                        path: tempPath,
                        addedTime: new Date().toISOString()
                      });
                    } catch (e) {
                      console.error('更新图片关联表失败', e);
                    }
                    
                    resolveImage();
                  },
                  fail: (err) => {
                    console.error('写入图片文件失败', err);
                    resolveImage();
                  }
                });
              } else {
                resolveImage();
              }
            }
          });
        }).catch((err) => {
          console.error('提取图片失败', err);
          return Promise.resolve();
        });
        
        imagePromises.push(promise);
      });
      
      // 等待所有图片处理完成
      Promise.all(imagePromises).then(() => {
        console.log(`图片恢复完成，共处理 ${imagePromises.length} 张图片`);
        
        // 同步所有周的关联表
        try {
          const { syncRelationWithLocal } = require('../../utils/imageRelation.js');
          Object.keys(imageWeekRelation).forEach(weekKey => {
            syncRelationWithLocal(weekKey);
            console.log('同步图片关联表:', weekKey);
          });
        } catch (e) {
          console.error('同步图片关联表失败', e);
        }
        
        resolve();
      }).catch((err) => {
        console.error('恢复图片失败', err);
        reject(err);
      });
    });
  },

  // 刷新页面数据
  refreshPageData() {
    // 刷新所有相关页面数据
    const pages = getCurrentPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.route === 'pages/plan/plan') {
        // 重新加载班次模板数据
        if (page.loadShiftTemplates) {
          page.loadShiftTemplates();
        }
      } else if (page.route === 'pages/schedule/schedule') {
        // 重新加载排班数据和班次模板
        if (page.loadShifts) {
          page.loadShifts();
        }
        if (page.loadShiftTemplates) {
          page.loadShiftTemplates();
        }
        // 重新生成日期数据
        if (page.generateWeekDates) {
          page.generateWeekDates();
        }
        if (page.generateMonthDates) {
          page.generateMonthDates();
        }
      } else if (page.route === 'pages/statistics/statistics') {
        // 重新计算统计数据
        if (page.calculateStatistics) {
          page.calculateStatistics();
        }
      }
    }
  },
  
  // 清理旧的备份文件，只保留最新版本
  cleanupOldBackups(url, username, password, folder, currentBackupFileName) {
    // 获取服务器上的备份文件列表
    this.getWebDAVBackupFiles(url, username, password, folder).then((backupFiles) => {
      if (backupFiles.length > 1) {
        // 按文件名排序（最新的备份文件在前面）
        backupFiles.sort((a, b) => {
          return b.localeCompare(a);
        });
        
        // 保留第一个（最新的），删除其余的
        const filesToDelete = backupFiles.slice(1); // 从第二个开始删除，保留第一个
        
        filesToDelete.forEach((fileName) => {
          this.deleteWebDAVFile(url, username, password, folder, fileName);
        });
      }
    }).catch((err) => {
      console.error('清理旧备份文件失败', err);
    });
  },
  
  // 删除WebDAV服务器上的文件
  deleteWebDAVFile(url, username, password, folder, fileName) {
    const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
    const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
    
    wx.request({
      url: fileUrl,
      method: 'DELETE',
      header: {
        'Authorization': authHeader
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`删除旧备份文件成功: ${fileName}`);
        } else {
          console.error(`删除旧备份文件失败: ${fileName}`, res.statusCode);
        }
      },
      fail: (err) => {
        console.error(`删除旧备份文件请求失败: ${fileName}`, err);
      }
    });
  },
  
  // 恢复班次模板
  restoreShiftTemplates(url, username, password, folder) {
    const fileName = '班次模板.json';
    const downloadUrl = this.buildWebDAVUrl(url, folder, fileName);
    const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
    
    wx.request({
      url: downloadUrl,
      method: 'GET',
      header: {
        'Authorization': authHeader
      },
      responseType: 'arraybuffer',
      success: (res) => {
        if (res.statusCode === 200) {
          const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
          const fs = wx.getFileSystemManager();
          
          fs.writeFile({
            filePath: filePath,
            data: res.data,
            success: () => {
              fs.readFile({
                filePath: filePath,
                encoding: 'utf8',
                success: (readRes) => {
                  try {
                    const data = JSON.parse(readRes.data);
                    // 处理带有时间戳的数据格式
                    if (data.data) {
                      // 新格式：{ data: [...], lastModified: "..." }
                      wx.setStorageSync('shiftTemplates', data.data);
                    } else if (data.shiftTemplates) {
                      // 旧格式：{ shiftTemplates: [...] }
                      wx.setStorageSync('shiftTemplates', data.shiftTemplates);
                    }
                  } catch (e) {
                    console.error('解析班次模板失败', e);
                  }
                },
                fail: (err) => {
                  console.error('读取班次模板文件失败', err);
                }
              });
            },
            fail: (err) => {
              console.error('写入班次模板文件失败', err);
            }
          });
        }
      },
      fail: (err) => {
        console.error('下载班次模板失败', err);
      }
    });
  },
  
  // 恢复排班数据
  restoreShifts(url, username, password, folder) {
    const fileName = '排班数据.json';
    const downloadUrl = this.buildWebDAVUrl(url, folder, fileName);
    const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
    
    wx.request({
      url: downloadUrl,
      method: 'GET',
      header: {
        'Authorization': authHeader
      },
      responseType: 'arraybuffer',
      success: (res) => {
        if (res.statusCode === 200) {
          const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
          const fs = wx.getFileSystemManager();
          
          fs.writeFile({
            filePath: filePath,
            data: res.data,
            success: () => {
              fs.readFile({
                filePath: filePath,
                encoding: 'utf8',
                success: (readRes) => {
                  try {
                    const data = JSON.parse(readRes.data);
                    // 处理带有时间戳的数据格式
                    if (data.shifts) {
                      // 新格式和旧格式都包含shifts字段
                      wx.setStorageSync('shifts', data.shifts);
                    }
                  } catch (e) {
                    console.error('解析排班数据失败', e);
                  }
                },
                fail: (err) => {
                  console.error('读取排班数据文件失败', err);
                }
              });
            },
            fail: (err) => {
              console.error('写入排班数据文件失败', err);
            }
          });
        }
      },
      fail: (err) => {
        console.error('下载排班数据失败', err);
      }
    });
  },
  
  // 恢复图片文件夹（兼容image和images两种路径）
  restoreImages(url, username, password, folder) {
    // 尝试访问image文件夹（新路径格式）
    const imageListUrl = this.buildWebDAVUrl(url, folder, 'image/');
    const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
    
    wx.request({
      url: imageListUrl,
      method: 'PROPFIND',
      header: {
        'Authorization': authHeader,
        'Depth': '2' // 设置为2以递归获取子文件夹内容
      },
      success: (res) => {
        if (res.statusCode === 207) {
          const images = this.parseWebDAVImageFiles(res.data);
          this.downloadAndRestoreImages(images, url, username, password, folder);
        } else {
          // 如果image文件夹不存在，尝试访问images文件夹（旧路径格式）
          const imagesListUrl = this.buildWebDAVUrl(url, folder, 'images/');
          wx.request({
            url: imagesListUrl,
            method: 'PROPFIND',
            header: {
              'Authorization': authHeader,
              'Depth': '1'
            },
            success: (res2) => {
              if (res2.statusCode === 207) {
                const images = this.parseWebDAVImageFiles(res2.data);
                this.downloadAndRestoreImages(images, url, username, password, folder);
              } else {
                wx.hideLoading();
                wx.showToast({
                  title: '恢复成功',
                  icon: 'success'
                });
              }
            },
            fail: (err2) => {
              console.error('列出images文件夹失败', err2);
              wx.hideLoading();
              wx.showToast({
                title: '恢复成功（图片恢复失败）',
                icon: 'none'
              });
            }
          });
        }
      },
      fail: (err) => {
        console.error('列出image文件夹失败', err);
        // 如果image文件夹不存在，尝试访问images文件夹（旧路径格式）
        const imagesListUrl = this.buildWebDAVUrl(url, folder, 'images/');
        wx.request({
          url: imagesListUrl,
          method: 'PROPFIND',
          header: {
            'Authorization': authHeader,
            'Depth': '1'
          },
          success: (res2) => {
            if (res2.statusCode === 207) {
              const images = this.parseWebDAVImageFiles(res2.data);
              this.downloadAndRestoreImages(images, url, username, password, folder);
            } else {
              wx.hideLoading();
              wx.showToast({
                title: '恢复成功',
                icon: 'success'
              });
            }
          },
          fail: (err2) => {
            console.error('列出images文件夹失败', err2);
            wx.hideLoading();
            wx.showToast({
              title: '恢复成功（图片恢复失败）',
              icon: 'none'
            });
          }
        });
      }
    });
  },
  
  // 解析WebDAV图片文件响应
  parseWebDAVImageFiles(xmlData) {
    const images = [];
    const regex = /<d:response>([\s\S]*?)<\/d:response>/g;
    let match;
    
    while ((match = regex.exec(xmlData)) !== null) {
      const response = match[1];
      const hrefMatch = /<d:href>([\s\S]*?)<\/d:href>/.exec(response);
      const propstatMatch = /<d:propstat>([\s\S]*?)<\/d:propstat>/.exec(response);
      
      if (hrefMatch && propstatMatch) {
        const href = hrefMatch[1];
        const propstat = propstatMatch[1];
        const isCollectionMatch = /<d:collection\/>/.exec(propstat);
        
        if (!isCollectionMatch) {
          const fileName = href.split('/').pop();
          if (fileName && (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png'))) {
            images.push(href);
          }
        }
      }
    }
    
    return images;
  },
  
  // 下载并恢复图片
  downloadAndRestoreImages(images, url, username, password, folder) {
    if (images.length === 0) {
      wx.hideLoading();
      wx.showToast({
        title: '恢复成功',
        icon: 'success'
      });
      return;
    }
    
    let downloadedCount = 0;
    const totalCount = images.length;
    
    images.forEach(imagePath => {
      const downloadUrl = url.endsWith('/') ? url : url + '/';
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      wx.request({
        url: downloadUrl + imagePath,
        method: 'GET',
        header: {
          'Authorization': authHeader
        },
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode === 200) {
            const fs = wx.getFileSystemManager();
            const tempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${imagePath.split('/').pop()}`;
            
            fs.writeFile({
              filePath: tempPath,
              data: res.data,
              success: () => {
                // 解析图片信息，恢复到对应的周存储
                const fileNameParts = imagePath.split('/').pop().split('_');
                if (fileNameParts.length > 2 && fileNameParts[0] === 'week' && fileNameParts[1] === 'images') {
                  const weekKey = fileNameParts.slice(2, -2).join('_');
                  const weekImageKey = `week_images_${weekKey}`;
                  
                  // 获取现有图片数据
                  const existingImages = wx.getStorageSync(weekImageKey) || [];
                  
                  // 添加新图片
                  existingImages.push({
                    id: Date.now().toString(),
                    name: fileNameParts.slice(-1)[0].replace('.jpg', ''),
                    path: tempPath,
                    addedTime: new Date().toISOString()
                  });
                  
                  // 保存图片数据
                  wx.setStorageSync(weekImageKey, existingImages);
                }
              },
              fail: (err) => {
                console.error('保存图片失败', err);
              }
            });
          }
          
          downloadedCount++;
          if (downloadedCount === totalCount) {
            wx.hideLoading();
            wx.showToast({
              title: '恢复成功',
              icon: 'success'
            });
          }
        },
        fail: (err) => {
          console.error('下载图片失败', err);
          downloadedCount++;
          if (downloadedCount === totalCount) {
            wx.hideLoading();
            wx.showToast({
              title: '恢复成功（部分图片恢复失败）',
              icon: 'none'
            });
          }
        }
      });
    });
  },
  
  // 列出WebDAV中的文件
  listWebDAVFiles(url, username, password, folder) {
    // 构建列表URL，考虑自定义文件夹
    let listUrl = url.endsWith('/') ? url : url + '/';
    if (folder) {
      listUrl += folder.endsWith('/') ? folder : folder + '/';
    }
    const authHeader = 'Basic ' + wx.arrayBufferToBase64(new Uint8Array(encodeURIComponent(`${username}:${password}`).split(',').map(c => c.charCodeAt(0))));
    
    wx.request({
      url: listUrl,
      method: 'PROPFIND',
      header: {
        'Authorization': authHeader,
        'Depth': '1'
      },
      success: (res) => {
        wx.hideLoading();
        // 解析XML响应，获取文件列表
        const files = this.parseWebDAVResponse(res.data);
        
        if (files.length === 0) {
          wx.showToast({
            title: '未找到备份文件',
            icon: 'none'
          });
          return;
        }
        
        // 显示文件选择弹窗
        this.showBackupFileList(files, url, username, password);
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '获取文件列表失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 解析WebDAV响应
  parseWebDAVResponse(xmlData) {
    // 简单的XML解析，实际项目中可能需要更复杂的解析
    const files = [];
    const regex = /<d:response>([\s\S]*?)<\/d:response>/g;
    let match;
    
    while ((match = regex.exec(xmlData)) !== null) {
      const response = match[1];
      const hrefMatch = /<d:href>([\s\S]*?)<\/d:href>/.exec(response);
      const propstatMatch = /<d:propstat>([\s\S]*?)<\/d:propstat>/.exec(response);
      
      if (hrefMatch && propstatMatch) {
        const href = hrefMatch[1];
        const propstat = propstatMatch[1];
        const isCollectionMatch = /<d:collection\/>/.exec(propstat);
        
        if (!isCollectionMatch) {
          const fileName = href.split('/').pop();
          if (fileName && fileName.startsWith('SYwork_backup_') && fileName.endsWith('.json')) {
            files.push(fileName);
          }
        }
      }
    }
    
    return files;
  },
  
  // 显示备份文件列表
  showBackupFileList(files, url, username, password) {
    // 按日期倒序排序
    files.sort((a, b) => {
      const dateA = a.replace('SYwork_backup_', '').replace('.json', '');
      const dateB = b.replace('SYwork_backup_', '').replace('.json', '');
      return new Date(dateB) - new Date(dateA);
    });
    
    // 显示文件选择菜单
    wx.showActionSheet({
      itemList: files,
      success: (res) => {
        const selectedFile = files[res.tapIndex];
        this.downloadBackupFile(selectedFile, url, username, password);
      }
    });
  },
  
  // 下载备份文件
  downloadBackupFile(fileName, url, username, password) {
    wx.showLoading({
      title: '下载备份文件...'
    });
    
    // 构建下载URL，考虑自定义文件夹
    let downloadUrl = url.endsWith('/') ? url : url + '/';
    if (this.data.webdavConfig.folder) {
      downloadUrl += this.data.webdavConfig.folder.endsWith('/') ? this.data.webdavConfig.folder : this.data.webdavConfig.folder + '/';
    }
    downloadUrl += fileName;
    const authHeader = 'Basic ' + wx.arrayBufferToBase64(new Uint8Array(encodeURIComponent(`${username}:${password}`).split(',').map(c => c.charCodeAt(0))));
    
    wx.request({
      url: downloadUrl,
      method: 'GET',
      header: {
        'Authorization': authHeader
      },
      responseType: 'arraybuffer',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
          const fs = wx.getFileSystemManager();
          
          // 写入文件
          fs.writeFile({
            filePath: filePath,
            data: res.data,
            success: () => {
              // 读取并解析文件
              fs.readFile({
                filePath: filePath,
                encoding: 'utf8',
                success: (readRes) => {
                  try {
                    const data = JSON.parse(readRes.data);
                    this.restoreData(data);
                  } catch (e) {
                    wx.showToast({
                      title: '文件格式错误',
                      icon: 'none'
                    });
                  }
                },
                fail: (err) => {
                  wx.showToast({
                    title: '读取文件失败',
                    icon: 'none'
                  });
                }
              });
            },
            fail: (err) => {
              wx.showToast({
                title: '写入文件失败',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: `下载失败: ${res.statusCode}`,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '下载失败，请检查网络连接',
          icon: 'none'
        });
      }
    });
  },
  
  // 恢复数据
  restoreData(data) {
    try {
      // 保存数据到本地存储
      if (data.shiftTemplates) {
        wx.setStorageSync('shiftTemplates', data.shiftTemplates);
      }
      if (data.shifts) {
        wx.setStorageSync('shifts', data.shifts);
      }
      
      wx.showToast({
        title: '恢复成功',
        icon: 'success'
      });
      
      // 刷新页面数据
      setTimeout(() => {
        const pages = getCurrentPages();
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          if (page.route === 'pages/plan/plan') {
            if (page.loadShiftTemplates) {
              page.loadShiftTemplates();
            }
          } else if (page.route === 'pages/schedule/schedule') {
            if (page.loadShifts) {
              page.loadShifts();
            }
            if (page.loadShiftTemplates) {
              page.loadShiftTemplates();
            }
            if (page.generateWeekDates) {
              page.generateWeekDates();
            }
            if (page.generateMonthDates) {
              page.generateMonthDates();
            }
          } else if (page.route === 'pages/statistics/statistics') {
            if (page.calculateStatistics) {
              page.calculateStatistics();
            }
          }
        }
      }, 500);
    } catch (e) {
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
    }
  },
  
  // WebDAV 备份功能（增量备份）
  async backupToWebDAV() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写并保存 WebDAV 配置',
        icon: 'none'
      });
      return;
    }
    
    try {
      // 创建 WebDAV 管理器实例
      const webdav = new WebDAVManager({
        url: url,
        username: username,
        password: password,
        folder: this.data.webdavConfig.folder || `${this.data.username || '用户'}排班备份`
      });
      
      // 执行备份
      const result = await webdav.backup();
      
      if (result.success) {
        // 更新备份时间戳
        wx.setStorageSync('lastBackupTime', Date.now());
      }
      
    } catch (e) {
      console.error('备份失败', e);
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
    }
  },
  
  // WebDAV 恢复功能（增量恢复）
  async restoreFromWebDAV() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写并保存 WebDAV 配置',
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
          // 创建 WebDAV 管理器实例
          const webdav = new WebDAVManager({
            url: url,
            username: username,
            password: password,
            folder: this.data.webdavConfig.folder || `${this.data.username || '用户'}排班备份`
          });
          
          // 执行恢复
          const result = await webdav.restore();
          
          if (result.success) {
            // 更新恢复时间戳
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
  }
});