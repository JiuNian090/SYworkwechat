// pages/profile/profile.js
const api = require('../../utils/api.js');
const changelogData = require('../../utils/changelog.js');
const JSZip = require('../../utils/jszip.min.js');
const { getAllValidImages, addImageToRelation, syncRelationWithLocal, importImageWeekRelation } = require('../../utils/imageRelation.js');

/**
 * 云开发工具类 - 增量备份和恢复
 * 支持微信云开发，通过账号密码实现数据同步
 */
class CloudManager {
  constructor() {
    this.userId = null;
  }
  
  // 用户注册
  async register(account, password) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'register',
          account: account,
          password: password
        }
      });
      
      if (result.result.success) {
        this.userId = result.result.data.userId;
        wx.setStorageSync('cloudUserId', this.userId);
        wx.setStorageSync('cloudAccount', account);
        return result.result;
      } else {
        return result.result;
      }
    } catch (e) {
      console.error('注册失败', e);
      return {
        success: false,
        errMsg: e.message || '注册失败'
      };
    }
  }
  
  // 用户登录
  async login(account, password) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'login',
          account: account,
          password: password
        }
      });
      
      if (result.result.success) {
        this.userId = result.result.data.userId;
        wx.setStorageSync('cloudUserId', this.userId);
        wx.setStorageSync('cloudAccount', account);
        return result.result;
      } else {
        return result.result;
      }
    } catch (e) {
      console.error('登录失败', e);
      return {
        success: false,
        errMsg: e.message || '登录失败'
      };
    }
  }
  
  // 检查是否已登录
  isLoggedIn() {
    if (!this.userId) {
      this.userId = wx.getStorageSync('cloudUserId');
    }
    return !!this.userId;
  }
  
  // 退出登录
  logout() {
    this.userId = null;
    wx.removeStorageSync('cloudUserId');
    wx.removeStorageSync('cloudAccount');
  }
  
  // 获取当前账号
  getCurrentAccount() {
    return wx.getStorageSync('cloudAccount') || '';
  }
  
  // 计算哈希值（用于差异检测）
  calculateHash(data) {
    if (typeof data === 'string') {
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    }
    return '0';
  }
  
  // 获取本地数据
  getLocalData() {
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    const shifts = wx.getStorageSync('shifts') || {};
    
    const shiftTemplatesJson = JSON.stringify(shiftTemplates);
    const shiftsJson = JSON.stringify(shifts);
    
    return {
      shiftTemplates: {
        data: shiftTemplates,
        hash: this.calculateHash(shiftTemplatesJson),
        size: shiftTemplatesJson.length
      },
      shifts: {
        data: shifts,
        hash: this.calculateHash(shiftsJson),
        size: shiftsJson.length
      }
    };
  }
  
  // 检测并更新旧格式图片名称
  checkAndUpdateOldImageNames() {
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    let hasUpdated = false;
    
    weekImageKeys.forEach(weekKey => {
      const weekImages = wx.getStorageSync(weekKey) || [];
      
      // 检测并更新旧格式图片
      const updatedImages = weekImages.map(image => {
        // 检查是否为旧格式：包含"年"、"月"、"周"等中文字符
        if (image.name && (image.name.includes('年') || image.name.includes('月') || 
            image.name.includes('第') || image.name.includes('周'))) {
          hasUpdated = true;
          
          // 从 weekKey 中提取日期信息
          const weekDateStr = weekKey.replace('week_images_', '');
          const weekDate = new Date(weekDateStr);
          const year = weekDate.getFullYear();
          const month = String(weekDate.getMonth() + 1).padStart(2, '0');
          const week = this.getWeekOfMonth(weekDate);
          
          // 生成新格式名称：年 - 月 - 周数字
          const newName = `${year}-${month}-${week}`;
          
          return {
            ...image,
            name: newName,
            updatedTime: new Date().toISOString()
          };
        }
        return image;
      });
      
      // 如果有更新，保存到本地存储
      if (hasUpdated) {
        wx.setStorageSync(weekKey, updatedImages);
        console.log(`已更新周 ${weekKey} 的图片名称格式`);
      }
    });
    
    return hasUpdated;
  }
  
  // 获取本地所有图片
  getAllLocalImages() {
    // 首先检测并更新旧格式图片名称
    this.checkAndUpdateOldImageNames();
    
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    const images = [];
    const imageWeekRelation = {};
    
    weekImageKeys.forEach(weekKey => {
      const weekImages = wx.getStorageSync(weekKey) || [];
      if (weekImages.length > 0) {
        imageWeekRelation[weekKey] = weekImages.map(img => ({
          name: img.name,
          path: img.path
        }));
        
        weekImages.forEach((image, index) => {
          // 解析周信息，生成新格式图片名：年 - 月 - 周数字
          const weekDateStr = weekKey.replace('week_images_', '');
          const weekDate = new Date(weekDateStr);
          const year = weekDate.getFullYear();
          const month = String(weekDate.getMonth() + 1).padStart(2, '0');
          const week = this.getWeekOfMonth(weekDate);
          
          const yearMonth = `${year}-${month}`;
          const imageName = `${year}-${month}-${week}`;
          const remotePath = `images/${yearMonth}/${imageName}_${index}.jpg`;
          
          images.push({
            weekKey: weekKey,
            image: image,
            yearMonth: yearMonth,
            imageName: imageName,
            remotePath: remotePath,
            index: index
          });
        });
      }
    });
    
    return { images, imageWeekRelation };
  }

  // 获取某个日期是当月的第几周
  getWeekOfMonth(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    const adjustedDate = date.getDate() + dayOfWeek;
    return Math.ceil(adjustedDate / 7);
  }

  // 验证图片文件是否存在
  validateImageExists(imagePath) {
    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath: imagePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  }
  
  // 备份数据
  async backup() {
    try {
      if (!this.isLoggedIn()) {
        return {
          success: false,
          errMsg: '请先登录'
        };
      }
      
      wx.showLoading({ title: '备份中...' });
      
      // 1. 获取本地数据
      const localData = this.getLocalData();
      
      // 使用新的图片关联表工具获取所有有效图片
      const { images: validImages, imageWeekRelation: validImageWeekRelation } = await getAllValidImages();
      
      // 2. 备份图片到云存储
      const uploadedImages = [];
      for (const imgInfo of validImages) {
        try {
          // 上传图片到云存储
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: `schedule_images/${this.userId}/${imgInfo.remotePath}`,
            filePath: imgInfo.image.path
          });
          
          uploadedImages.push({
            ...imgInfo,
            fileID: uploadResult.fileID
          });
        } catch (e) {
          console.error('上传图片失败', imgInfo.remotePath, e);
        }
      }
      
      // 3. 调用云函数备份数据
      const backupResult = await wx.cloud.callFunction({
        name: 'backupRestore',
        data: {
          action: 'backup',
          userId: this.userId,
          data: {
            shiftTemplates: localData.shiftTemplates.data,
            shifts: localData.shifts.data,
            images: uploadedImages,
            imageWeekRelation: validImageWeekRelation,
            backupIndex: {}
          }
        }
      });
      
      wx.hideLoading();
      
      if (backupResult.result.success) {
        wx.showToast({
          title: `备份成功（${uploadedImages.length}张图片）`,
          icon: 'success'
        });
        return {
          success: true,
          uploadedImages: uploadedImages.length
        };
      } else {
        wx.showToast({
          title: backupResult.result.errMsg || '备份失败',
          icon: 'none'
        });
        return backupResult.result;
      }
      
    } catch (e) {
      console.error('备份失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
      return {
        success: false,
        errMsg: e.message
      };
    }
  }
  
  // 恢复数据
  async restore() {
    try {
      if (!this.isLoggedIn()) {
        return {
          success: false,
          errMsg: '请先登录'
        };
      }
      
      wx.showLoading({ title: '恢复中...' });
      
      // 1. 调用云函数获取备份数据
      const restoreResult = await wx.cloud.callFunction({
        name: 'backupRestore',
        data: {
          action: 'restore',
          userId: this.userId
        }
      });
      
      if (!restoreResult.result.success) {
        wx.hideLoading();
        wx.showToast({
          title: restoreResult.result.errMsg || '恢复失败',
          icon: 'none'
        });
        return restoreResult.result;
      }
      
      const backupData = restoreResult.result.data;
      
      // 2. 恢复数据文件
      if (backupData.shiftTemplates) {
        wx.setStorageSync('shiftTemplates', backupData.shiftTemplates);
      }
      if (backupData.shifts) {
        wx.setStorageSync('shifts', backupData.shifts);
      }
      
      // 3. 恢复图片
      const restoredImages = [];
      const images = backupData.images || [];
      const restoredWeekKeys = new Set();
      
      // 导入图片周关联表到新的图片关联表
      if (backupData.imageWeekRelation) {
        importImageWeekRelation(backupData.imageWeekRelation);
      }
      
      for (const imgInfo of images) {
        try {
          // 从云存储下载图片
          const downloadResult = await wx.cloud.downloadFile({
            fileID: imgInfo.fileID
          });
          
          // 保存到本地存储
          const weekKey = imgInfo.weekKey;
          const existingImages = wx.getStorageSync(weekKey) || [];
          
          const exists = existingImages.some(img => 
            img.path === downloadResult.tempFilePath || img.name === imgInfo.imageName
          );
          
          if (!exists) {
            const newImage = {
              id: `${weekKey}_${Date.now()}`,
              name: imgInfo.imageName,
              path: downloadResult.tempFilePath,
              addedTime: new Date().toISOString()
            };
            
            existingImages.push(newImage);
            wx.setStorageSync(weekKey, existingImages);
            
            // 同步更新到图片关联表
            addImageToRelation(weekKey, newImage);
            restoredWeekKeys.add(weekKey);
            
            restoredImages.push(imgInfo.remotePath);
          }
        } catch (e) {
          console.error('恢复图片失败', imgInfo.remotePath, e);
        }
      }
      
      // 同步所有恢复过的周的关联表
      restoredWeekKeys.forEach(weekKey => {
        syncRelationWithLocal(weekKey);
      });
      
      wx.hideLoading();
      wx.showToast({
        title: `恢复成功（${restoredImages.length}张图片）`,
        icon: 'success'
      });
      
      // 4. 刷新页面数据
      setTimeout(() => {
        const pages = getCurrentPages();
        pages.forEach(page => {
          if (page.refreshPageData) {
            page.refreshPageData();
          }
        });
      }, 500);
      
      return {
        success: true,
        restoredImages: restoredImages.length
      };
      
    } catch (e) {
      console.error('恢复失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
      return {
        success: false,
        errMsg: e.message
      };
    }
  }
  
  // 获取备份信息
  async getBackupInfo() {
    try {
      if (!this.isLoggedIn()) {
        return {
          success: false,
          errMsg: '请先登录'
        };
      }
      
      const result = await wx.cloud.callFunction({
        name: 'backupRestore',
        data: {
          action: 'getBackupInfo',
          userId: this.userId
        }
      });
      
      return result.result;
    } catch (e) {
      console.error('获取备份信息失败', e);
      return {
        success: false,
        errMsg: e.message
      };
    }
  }
}

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
    showCloudPassword: false,
    // 用户管理弹窗
    showUserManagementModal: false,
    // 数据管理使用说明弹窗
    showDataManagementHelpModal: false,
    // 更新日志数据
    changelog: [],
    emojiList: ['😊', '😃', '😄', '😁', '😆', '😂', '🤣', '😅', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😚', '😋', '😛', '😝', '😜', '🤪', '😎', '🤩', '🥳', '😏', '🤓', '🧐', '🤨', '🤔', '🤗', '🤭', '😮', '😯', '😲', '😧', '😦', '😨', '😱', '😖', '😣', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😳', '🥵', '🥶', '😴', '😪', '🤤', '😓', '😟', '😔', '😞', '😒', '🙁', '☹️', '😕', '🤫', '😶', '😐', '😑', '😬', '🙄', '😵', '🤐', '🥴', '🤯', '🤥', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑'], // 表情列表，按情绪从积极到消极排列
    selectedEmoji: '', // 当前选中的表情
    emojiTextMap: {
      '😊': '微笑',
      '😃': '开心',
      '😄': '大笑',
      '😁': '露齿笑',
      '😆': '大笑',
      '😅': '汗颜',
      '🤣': '捧腹大笑',
      '😂': '笑哭',
      '🙂': '略微微笑',
      '🙃': '倒脸',
      '😉': '眨眼',
      '😌': '安心',
      '😍': '爱心眼',
      '🥰': '爱慕',
      '😘': '飞吻',
      '😗': '亲吻',
      '😙': '亲吻',
      '😚': '闭唇亲吻',
      '😋': '美味',
      '😛': '吐舌',
      '😝': '调皮吐舌',
      '😜': '眨眼吐舌',
      '🤪': '搞怪',
      '🤨': '挑眉',
      '🧐': '思考',
      '🤓': '书呆子',
      '😎': '酷',
      '🤩': '崇拜',
      '🥳': '庆祝',
      '😏': '得意',
      '😒': '无语',
      '😞': '失望',
      '😔': '难过',
      '😟': '担心',
      '😕': '困惑',
      '🙁': '沮丧',
      '☹️': '不满',
      '😣': '痛苦',
      '😖': '折磨',
      '😫': '压力',
      '😩': '好累',
      '🥺': '恳求',
      '😢': '哭泣',
      '😭': '痛哭',
      '😤': '生气',
      '😠': '愤怒',
      '😡': '暴怒',
      '🤬': '暴怒',
      '🤯': '爆炸',
      '😳': '脸红',
      '🥵': '热',
      '🥶': '冷',
      '😱': '尖叫',
      '😨': '害怕',
      '😰': '冷汗',
      '😥': '担忧',
      '😓': '汗',
      '🤗': '拥抱',
      '🤔': '思考',
      '🤭': '捂嘴笑',
      '🤫': '安静',
      '🤥': '说谎',
      '😶': '无语',
      '😐': '中性',
      '😑': '无奈',
      '😬': '尴尬',
      '🙄': '翻白眼',
      '😯': '惊讶',
      '😦': '震惊',
      '😧': '惊恐',
      '😮': '惊讶',
      '😲': '震惊',
      '🥱': '打哈欠',
      '😴': '睡觉',
      '🤤': '流口水',
      '😪': '困倦',
      '😵': '头晕',
      '🤐': '闭嘴',
      '🥴': '眩晕',
      '🤢': '恶心',
      '🤮': '呕吐',
      '🤧': '打喷嚏',
      '😷': '口罩',
      '🤒': '发烧',
      '🤕': '受伤',
      '🤑': '金钱眼'
    }, // 表情对应的文字信息
    emojiEmotionMap: {
      // 积极情绪
      '😊': 'positive',
      '😃': 'positive',
      '😄': 'positive',
      '😁': 'positive',
      '😆': 'positive',
      '🤣': 'positive',
      '😂': 'positive',
      '🙂': 'positive',
      '😉': 'positive',
      '😌': 'positive',
      '😍': 'positive',
      '🥰': 'positive',
      '😘': 'positive',
      '😗': 'positive',
      '😙': 'positive',
      '😚': 'positive',
      '😋': 'positive',
      '😛': 'positive',
      '😝': 'positive',
      '😜': 'positive',
      '🤪': 'positive',
      '😎': 'positive',
      '🤩': 'positive',
      '🥳': 'positive',
      '😏': 'positive',
      '🤗': 'positive',
      '🤭': 'positive',
      '🤑': 'positive',
      // 中性情绪
      '😅': 'neutral',
      '🙃': 'neutral',
      '🤨': 'neutral',
      '🧐': 'neutral',
      '🤓': 'neutral',
      '🤔': 'neutral',
      '🤫': 'neutral',
      '😶': 'neutral',
      '😐': 'neutral',
      '😑': 'neutral',
      '😬': 'neutral',
      '🙄': 'neutral',
      '😯': 'neutral',
      '😮': 'neutral',
      '🥱': 'neutral',
      '😴': 'neutral',
      '🤤': 'neutral',
      '😪': 'neutral',
      '😵': 'neutral',
      '🤐': 'neutral',
      '🥴': 'neutral',
      '😷': 'neutral',
      '🤒': 'neutral',
      '🤕': 'neutral',
      '😧': 'neutral',
      '😲': 'neutral',
      // 消极情绪
      '😒': 'negative',
      '😞': 'negative',
      '😔': 'negative',
      '😟': 'negative',
      '😕': 'negative',
      '🙁': 'negative',
      '☹️': 'negative',
      '😣': 'negative',
      '😖': 'negative',
      '😫': 'negative',
      '😩': 'negative',
      '🥺': 'negative',
      '😢': 'negative',
      '😭': 'negative',
      '😤': 'negative',
      '😠': 'negative',
      '😡': 'negative',
      '🤬': 'negative',
      '🤯': 'negative',
      '😳': 'negative',
      '🥵': 'negative',
      '🥶': 'negative',
      '😱': 'negative',
      '😨': 'negative',
      '😰': 'negative',
      '😥': 'negative',
      '😓': 'negative',
      '🤥': 'negative',
      '😦': 'negative',
      '🤢': 'negative',
      '🤮': 'negative',
      '🤧': 'negative'
    } // 表情对应的情绪类型
  },

  // 跳转到使用说明页面
  navigateToDocs(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: '/pages/docs/docs?type=' + type
    });
  },

  onLoad() {
    // 读取本地存储的头像信息
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'YOUR_CLOUD_ENV_ID',
        traceUser: true,
      });
    }
    
    // 创建云开发管理器
    const cloudManager = new CloudManager();
    
    // 检查是否已登录
    const cloudUserId = wx.getStorageSync('cloudUserId');
    const cloudAccount = wx.getStorageSync('cloudAccount') || '';
    const cloudLoggedIn = !!cloudUserId;
    
    // 同步云账号到用户名：优先使用云账号
    let username = wx.getStorageSync('username') || '';
    if (cloudLoggedIn && cloudAccount) {
      username = cloudAccount;
      // 确保本地存储的 username 与 cloudAccount 同步
      wx.setStorageSync('username', cloudAccount);
    }
    this.userId = cloudUserId;
    
    // 生成头像文字
    const avatarText = this.generateAvatarText(username);
    
    // 获取表情对应的文字和情绪类型
    const emojiText = avatarType === 'emoji' && avatarEmoji ? this.data.emojiTextMap[avatarEmoji] || '' : '';
    const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? this.data.emojiEmotionMap[avatarEmoji] || 'neutral' : '';
    
    // 解析更新日志
    const changelog = this.parseChangelog();
    
    this.setData({
      username: username,
      avatarText: avatarText,
      avatarEmoji: avatarEmoji,
      avatarType: avatarType,
      emojiText: emojiText,
      emojiEmotion: emojiEmotion,
      cloudManager: cloudManager,
      cloudLoggedIn: cloudLoggedIn,
      cloudAccount: cloudAccount,
      changelog: changelog
    });
  },

  // 生成头像文字
  generateAvatarText(username) {
    if (!username) {
      return '用';
    }
    // 取用户名的第一个字符作为头像文字
    return username.charAt(0).toUpperCase();
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
    this.setData({
      showEmojiModal: true,
      selectedEmoji: this.data.avatarEmoji
    });
  },

  // 隐藏表情选择弹窗
  hideEmojiModal() {
    this.setData({
      showEmojiModal: false
    });
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
    const emojiText = this.data.emojiTextMap[emoji] || '';
    const emojiEmotion = this.data.emojiEmotionMap[emoji] || 'neutral';
    
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
    
    // 通知其他页面更新头像信息
    this.updateAvatarInOtherPages();
    
    wx.showToast({
      title: '表情已设置为头像',
      icon: 'success'
    });
  },

  // 切换回文字头像
  switchToTextAvatar() {
    const username = this.data.username;
    const avatarText = this.generateAvatarText(username);
    
    this.setData({
      avatarType: 'text',
      avatarText: avatarText,
      emojiText: '',
      emojiEmotion: ''
    });
    
    // 保存到本地存储
    wx.setStorageSync('avatarType', 'text');
    wx.removeStorageSync('avatarEmoji');
    
    // 通知其他页面更新头像信息
    this.updateAvatarInOtherPages();
    
    wx.showToast({
      title: '已切换到文字头像',
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
    this.exportSelectedData(customFileName);
  },

  // 导出选择的数据类型
  exportSelectedData(customFileName) {
    wx.showLoading({
      title: '正在导出...'
    });
    
    try {
      // 构造导出数据结构
      const data = {};
      
      // 根据选择的数据类型获取对应的数据
      if (this.data.selectedDataTypes.includes('shiftTemplates')) {
        // 获取班次模板数据
        data.shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      }
      
      if (this.data.selectedDataTypes.includes('shifts')) {
        // 获取排班数据
        data.shifts = wx.getStorageSync('shifts') || {};
      }
      
      // 添加统计数据（如果包含排班数据）
      if (data.shifts) {
        let totalHours = 0;
        let workDays = 0;
        let offDays = 0;
        let totalDays = 0;
        
        // 计算统计数据
        Object.keys(data.shifts).forEach(date => {
          const shift = data.shifts[date];
          totalHours += parseFloat(shift.workHours) || 0;
          totalDays++;
          
          // 按班次类型统计工作班次和休息日
          const shiftType = shift.type;
          if (shiftType === '白天班' || shiftType === '跨夜班') {
            workDays++;
          } else if (shiftType === '休息日') {
            offDays++;
          }
        });
        
        // 添加统计数据到导出数据中
        data.statistics = {
          totalHours: totalHours.toFixed(1),
          totalDays: totalDays,
          workDays: workDays,
          offDays: offDays
        };
      }
      
      // 检查数据是否为空
      const isDataEmpty = Object.keys(data).length === 0 || 
        (Object.keys(data).length === 1 && data.shiftTemplates && data.shiftTemplates.length === 0) ||
        (Object.keys(data).length === 1 && data.shifts && Object.keys(data.shifts).length === 0);
      
      if (isDataEmpty) {
        wx.hideLoading();
        wx.showToast({
          title: '没有数据可导出',
          icon: 'none'
        });
        return;
      }
      
      // 使用用户输入的文件名
      const fileName = customFileName;
      const fs = wx.getFileSystemManager();
      
      // 检查是否选择了图片
      const includeImages = this.data.selectedDataTypes.includes('scheduleImages');
      
      if (includeImages) {
        // 生成ZIP文件
        this.exportAsZip(fileName, data);
      } else {
        // 生成JSON文件
        const jsonData = JSON.stringify(data, null, 2);
        const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.json`;
        
        // 检查jsonData是否为空
        if (!jsonData || jsonData === '{}') {
          wx.hideLoading();
          wx.showToast({
            title: '没有数据可导出',
            icon: 'none'
          });
          return;
        }
        
        fs.writeFile({
          filePath: filePath,
          data: jsonData,
          encoding: 'utf8',
          success: () => {
            wx.hideLoading();
            // 保存文件路径和文件名到页面数据中，等待用户点击分享按钮
            this.setData({
              exportedFilePath: filePath,
              exportedFileName: fileName
            });
            
            // 显示提示，让用户点击分享按钮
            wx.showModal({
              title: '导出成功',
              content: '数据已导出为JSON文件，请点击下方"分享数据"按钮将文件发送给好友',
              showCancel: false,
              confirmText: '知道了'
            });
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('写入文件失败', err);
            wx.showToast({
              title: '导出失败',
              icon: 'none'
            });
          }
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('导出数据失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },
  
  // 导出为ZIP文件
  exportAsZip(fileName, data) {
    try {
      const zip = new JSZip();
      
      // 添加班次模板文件（如果用户选择了导出班次模板）
      if (this.data.selectedDataTypes.includes('shiftTemplates') && data.shiftTemplates) {
        zip.file('班次模板.json', JSON.stringify({ data: data.shiftTemplates }, null, 2));
      }
      
      // 添加排班数据文件（如果用户选择了导出排班数据）
      if (this.data.selectedDataTypes.includes('shifts') && data.shifts) {
        zip.file('排班数据.json', JSON.stringify({ shifts: data.shifts, statistics: data.statistics }, null, 2));
      }
      
      // 添加图片文件（如果用户选择了导出图片）
      if (this.data.selectedDataTypes.includes('scheduleImages')) {
        const images = [];
        const fs = wx.getFileSystemManager();
        const imagePromises = [];
        const processedImages = new Set(); // 用于跟踪已处理的图片
        const validWeekImageKeys = []; // 用于跟踪包含有效图片的周
        
        // 获取所有周的图片
        // 注意：这里需要根据实际存储结构调整，例如按周存储的图片
        // 假设图片是按周存储的，键格式为 week_images_{weekKey}
        const storageInfo = wx.getStorageInfoSync();
        const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
        
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
              // 生成图片唯一标识（基于图片路径和名称）
              const imageKey = `${key}_${image.name}_${image.path}`;
              
              // 检查图片是否已经处理过
              if (!processedImages.has(imageKey)) {
                processedImages.add(imageKey);
                
                const promise = new Promise((resolve) => {
                  try {
                    // 读取图片文件
                    fs.readFile({
                      filePath: image.path,
                      success: (res) => {
                        // 生成图片文件名（使用年月文件夹结构：image/YYYY-MM/）
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
                        // 添加图片到ZIP
                        zip.file(imageFileName, res.data);
                        // 保存图片信息
                        images.push({
                          ...image,
                          key: key,
                          zipPath: imageFileName
                        });
                        resolve();
                      },
                      fail: (err) => {
                        console.error('读取图片失败', err);
                        resolve(); // 忽略失败的图片
                      }
                    });
                  } catch (e) {
                    console.error('处理图片失败', e);
                    resolve();
                  }
                });
                imagePromises.push(promise);
              }
            });
          }
        });
        
        // 等待所有图片处理完成
        Promise.all(imagePromises).then(() => {
          // 生成图片周关联表
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
          
          // 添加图片周关联表.json文件
          zip.file('图片周关联表.json', JSON.stringify(imageWeekRelation, null, 2));
          
          // 生成ZIP文件
          zip.generateAsync({ type: 'arraybuffer' }).then((content) => {
            // 检查content是否为空
            if (!content || content.byteLength === 0) {
              wx.hideLoading();
              wx.showToast({
                title: '没有数据可导出',
                icon: 'none'
              });
              return;
            }
            
            // 创建临时文件
            const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.zip`;
            
            fs.writeFile({
              filePath: filePath,
              data: content,
              success: () => {
                wx.hideLoading();
                // 保存文件路径和文件名到页面数据中，等待用户点击分享按钮
                this.setData({
                  exportedFilePath: filePath,
                  exportedFileName: fileName
                });
                
                // 显示提示，让用户点击分享按钮
                wx.showModal({
                  title: '导出成功',
                  content: '数据已导出为ZIP文件（包含图片），请点击下方"分享数据"按钮将文件发送给好友',
                  showCancel: false,
                  confirmText: '知道了'
                });
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('写入ZIP文件失败', err);
                wx.showToast({
                  title: '导出失败',
                  icon: 'none'
                });
              }
            });
          }).catch((err) => {
            wx.hideLoading();
            console.error('生成ZIP失败', err);
            wx.showToast({
              title: '导出失败',
              icon: 'none'
            });
          });
        });
        });
      } else {
        // 如果不需要导出图片，直接生成ZIP文件
        zip.generateAsync({ type: 'arraybuffer' }).then((content) => {
          // 检查content是否为空
          if (!content || content.byteLength === 0) {
            wx.hideLoading();
            wx.showToast({
              title: '没有数据可导出',
              icon: 'none'
            });
            return;
          }
          
          // 创建临时文件
          const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.zip`;
          
          const fs = wx.getFileSystemManager();
          fs.writeFile({
            filePath: filePath,
            data: content,
            success: () => {
              wx.hideLoading();
              // 保存文件路径和文件名到页面数据中，等待用户点击分享按钮
              this.setData({
                exportedFilePath: filePath,
                exportedFileName: fileName
              });
              
              // 显示提示，让用户点击分享按钮
              wx.showModal({
                title: '导出成功',
                content: '数据已导出为ZIP文件，请点击下方"分享数据"按钮将文件发送给好友',
                showCancel: false,
                confirmText: '知道了'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('写入ZIP文件失败', err);
              wx.showToast({
                title: '导出失败',
                icon: 'none'
              });
            }
          });
        }).catch((err) => {
          wx.hideLoading();
          console.error('生成ZIP失败', err);
          wx.showToast({
            title: '导出失败',
            icon: 'none'
          });
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('导出ZIP失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  // 分享导出的文件给好友
  shareExportedFile() {
    // 检查是否有导出的文件
    if (this.data.exportedFilePath && this.data.exportedFileName) {
      this.shareFile(this.data.exportedFilePath, this.data.exportedFileName);
    } else {
      wx.showToast({
        title: '请先导出数据',
        icon: 'none'
      });
    }
  },

  // 分享导出的模板文件给好友
  shareTemplate() {
    // 检查是否有导出的模板文件
    if (this.data.exportedTemplateFilePath && this.data.exportedTemplateFileName) {
      this.shareFile(this.data.exportedTemplateFilePath, this.data.exportedTemplateFileName);
    } else {
      wx.showToast({
        title: '请先导出模板',
        icon: 'none'
      });
    }
  },

  // 分享文件给好友
  shareFile(filePath, fileName) {
    // 检查是否支持分享文件
    if (wx.shareFileMessage) {
      // 确定文件扩展名
      const extension = filePath.endsWith('.zip') ? '.zip' : '.json';
      
      wx.shareFileMessage({
        filePath: filePath,
        fileName: `${fileName}${extension}`,
        success: () => {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('分享失败', err);
          wx.showToast({
            title: '分享失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 如果不支持分享文件，则提示用户手动发送
      wx.showModal({
        title: '提示',
        content: '当前微信版本不支持直接分享文件，您可以手动发送文件给好友。文件已保存到本地。',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  importData() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'zip'],
      // 提示用户选择JSON或ZIP文件，提高用户体验
      success: (res) => {
        const fileName = res.tempFiles[0].name;
        const filePath = res.tempFiles[0].path;
        
        wx.showLoading({
          title: '正在导入...'
        });
        
        if (fileName.toLowerCase().endsWith('.zip')) {
          // 处理ZIP文件
          this.importFromZip(filePath);
        } else if (fileName.toLowerCase().endsWith('.json')) {
          // 处理JSON文件
          this.importFromJson(filePath);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '请选择JSON或ZIP格式文件',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '选择文件失败',
            icon: 'none'
          });
        }
      }
    });
  },
  
  // 从JSON文件导入
  importFromJson(filePath) {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'utf-8',
      success: (readRes) => {
        try {
          const data = JSON.parse(readRes.data);
          
          // 获取文件名，判断文件类型
          const fileName = filePath.split('/').pop();
          let importSuccess = false;
          
          // 处理班次模板.json文件
          if (fileName === '班次模板.json') {
            // 验证数据格式
            const shiftTemplatesData = data.data || data.shiftTemplates;
            if (Array.isArray(shiftTemplatesData)) {
              wx.setStorageSync('shiftTemplates', shiftTemplatesData);
              importSuccess = true;
            } else {
              throw new Error('班次模板数据格式不正确');
            }
          }
          // 处理排班数据.json文件
          else if (fileName === '排班数据.json') {
            // 验证数据格式
            const shiftsData = data.shifts;
            if (shiftsData && typeof shiftsData === 'object') {
              wx.setStorageSync('shifts', shiftsData);
              if (data.customWeeklyHours !== undefined) {
                wx.setStorageSync('customWeeklyHours', data.customWeeklyHours);
              }
              importSuccess = true;
            } else {
              throw new Error('排班数据格式不正确');
            }
          }
          // 处理完整备份文件（包含两种数据）
          else {
            // 验证数据格式 - 检查必需的数据结构
            if (!data.hasOwnProperty('shiftTemplates') || !data.hasOwnProperty('shifts')) {
              throw new Error('数据格式不正确');
            }
            
            // 保存数据到本地存储
            if (data.shiftTemplates) {
              wx.setStorageSync('shiftTemplates', data.shiftTemplates);
            }
            if (data.shifts) {
              wx.setStorageSync('shifts', data.shifts);
            }
            if (data.customWeeklyHours !== undefined) {
              wx.setStorageSync('customWeeklyHours', data.customWeeklyHours);
            }
            importSuccess = true;
          }
          
          if (importSuccess) {
            this.finishImport();
          }
        } catch (e) {
          wx.hideLoading();
          console.error('解析数据失败', e);
          wx.showToast({
            title: '数据格式错误',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('读取文件失败', err);
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 从ZIP文件导入
  importFromZip(filePath) {
    const fs = wx.getFileSystemManager();
    
    // 直接使用WebDAV恢复的解压和恢复逻辑
    this.extractAndRestoreBackup(filePath, fs).then(() => {
      this.finishImport();
    }).catch((err) => {
      wx.hideLoading();
      console.error('导入失败', err);
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      });
    });
  },
  
  // 原从ZIP文件导入方法（保留作为备份）
  oldImportFromZip(filePath) {
    const fs = wx.getFileSystemManager();
    
    fs.readFile({
      filePath: filePath,
      success: (readRes) => {
        try {
          const zip = new JSZip();
          
          zip.loadAsync(readRes.data).then((zip) => {
            // 检查是否存在班次模板.json文件
            const shiftTemplatesFile = zip.file('班次模板.json');
            // 检查是否存在排班数据.json文件
            const shiftsFile = zip.file('排班数据.json');
            // 检查是否存在旧格式的data.json文件
            const dataJsonFile = zip.file('data.json');
            
            // 用于存储导入的数据
            const importData = {
              shiftTemplates: [],
              shifts: {},
              customWeeklyHours: 35
            };
            
            // 处理班次模板文件
            const processShiftTemplates = () => {
              return new Promise((resolve) => {
                if (shiftTemplatesFile) {
                  shiftTemplatesFile.async('string').then((jsonStr) => {
                    try {
                      const data = JSON.parse(jsonStr);
                      if (data.data) {
                        importData.shiftTemplates = data.data;
                      }
                    } catch (e) {
                      console.error('解析班次模板.json失败', e);
                    }
                    resolve();
                  }).catch((err) => {
                    console.error('读取班次模板.json失败', err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };
            
            // 处理排班数据文件
            const processShifts = () => {
              return new Promise((resolve) => {
                if (shiftsFile) {
                  shiftsFile.async('string').then((jsonStr) => {
                    try {
                      const data = JSON.parse(jsonStr);
                      if (data.shifts) {
                        importData.shifts = data.shifts;
                      }
                      if (data.customWeeklyHours !== undefined) {
                        importData.customWeeklyHours = data.customWeeklyHours;
                      }
                    } catch (e) {
                      console.error('解析排班数据.json失败', e);
                    }
                    resolve();
                  }).catch((err) => {
                    console.error('读取排班数据.json失败', err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };
            
            // 处理旧格式的data.json文件
            const processDataJson = () => {
              return new Promise((resolve) => {
                if (dataJsonFile && (!shiftTemplatesFile || !shiftsFile)) {
                  dataJsonFile.async('string').then((jsonStr) => {
                    try {
                      const data = JSON.parse(jsonStr);
                      if (data.shiftTemplates) {
                        importData.shiftTemplates = data.shiftTemplates;
                      }
                      if (data.shifts) {
                        importData.shifts = data.shifts;
                      }
                      if (data.customWeeklyHours !== undefined) {
                        importData.customWeeklyHours = data.customWeeklyHours;
                      }
                    } catch (e) {
                      console.error('解析data.json失败', e);
                    }
                    resolve();
                  }).catch((err) => {
                    console.error('读取data.json失败', err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };
            
            // 按顺序处理所有文件
            Promise.all([
              processShiftTemplates(),
              processShifts(),
              processDataJson()
            ]).then(() => {
              // 保存数据到本地存储
              if (importData.shiftTemplates.length > 0) {
                wx.setStorageSync('shiftTemplates', importData.shiftTemplates);
              }
              if (Object.keys(importData.shifts).length > 0) {
                wx.setStorageSync('shifts', importData.shifts);
              }
              if (importData.customWeeklyHours !== undefined) {
                wx.setStorageSync('customWeeklyHours', importData.customWeeklyHours);
              }
              
              // 处理图片文件（兼容新旧路径格式：image/YYYY-MM/ 或 images/）
              const imageDir = zip.folder('image') || zip.folder('images');
              if (imageDir) {
                const imagePromises = [];
                
                // 递归处理图片文件夹中的所有文件
                const processImageFolder = (folder, basePath = '') => {
                  folder.forEach((relativePath, file) => {
                    if (file.dir) {
                      // 如果是子文件夹（如 YYYY-MM），递归处理
                      const subFolder = folder.folder(relativePath);
                      if (subFolder) {
                        processImageFolder(subFolder, `${basePath}${relativePath}/`);
                      }
                    } else {
                      // 处理图片文件
                      const promise = file.async('arraybuffer').then((content) => {
                        // 生成临时图片路径
                        const fileName = relativePath.split('/').pop();
                        const tempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${fileName}`;
                        // 写入图片文件
                        fs.writeFile({
                          filePath: tempPath,
                          data: content,
                          success: () => {
                            // 解析图片信息，恢复到对应的周存储
                            // 文件名格式：week_images_{weekKey}_index_name.jpg
                            const fileNameParts = fileName.split('_');
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
                      });
                      imagePromises.push(promise);
                    }
                  });
                };
                
                processImageFolder(imageDir);
                
                // 等待所有图片处理完成
                Promise.all(imagePromises).then(() => {
                  this.finishImport();
                });
              } else {
                this.finishImport();
              }
            }).catch((err) => {
              wx.hideLoading();
              console.error('解析JSON失败', err);
              wx.showToast({
                title: '数据格式错误',
                icon: 'none'
              });
            });
          }).catch((err) => {
            wx.hideLoading();
            console.error('解压ZIP失败', err);
            wx.showToast({
              title: '压缩包格式错误',
              icon: 'none'
            });
          });
        } catch (e) {
          wx.hideLoading();
          console.error('导入失败', e);
          wx.showToast({
            title: '导入失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('读取文件失败', err);
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 完成导入，刷新页面数据
  finishImport() {
    wx.showToast({
      title: '导入成功',
      icon: 'success'
    });
    
    // 延迟一段时间确保数据保存完成后再刷新页面
    setTimeout(() => {
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
      
      // 如果当前在tab页面，也需要刷新当前页面数据
      if (this.loadUserData && typeof this.loadUserData === 'function') {
        this.loadUserData();
      }
      
      // 隐藏loading
      wx.hideLoading();
    }, 500);
  },

  

  
  
  // 清空所有数据（包括班次模板）
  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作将清空包括班次模板在内的所有数据，且不可恢复！',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...'
          });
          
          try {
            // 清空所有相关的本地存储数据
            wx.removeStorageSync('shifts');
            wx.removeStorageSync('customWeeklyHours');
            wx.removeStorageSync('shiftTemplates');
            // 可以添加其他需要清空的数据
            
            wx.showToast({
              title: '数据已清空',
              icon: 'success'
              });
            
            // 延迟一段时间确保数据清空完成后再刷新页面
            setTimeout(() => {
              // 通知所有相关页面刷新数据
              const pages = getCurrentPages();
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (page.route === 'pages/plan/plan') {
                  // 重新加载班次模板数据（保留原有数据）
                  if (page.loadShiftTemplates) {
                    page.loadShiftTemplates();
                  }
                } else if (page.route === 'pages/schedule/schedule') {
                  // 重新加载排班数据（空对象）和班次模板
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
                  // 重新计算统计数据（应该为空）
                  if (page.calculateStatistics) {
                    page.calculateStatistics();
                  }
                }
              }
              
              // 隐藏loading
              wx.hideLoading();
            }, 500);
          } catch (e) {
            wx.hideLoading();
            console.error('清空数据失败', e);
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            });
          }
        }
      }
    });
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
    // 获取当前所有页面实例
    const pages = getCurrentPages();
    const avatarType = this.data.avatarType;
    const avatarText = this.data.avatarText;
    const avatarEmoji = this.data.avatarEmoji;
    
    // 遍历所有页面，更新头像信息
    pages.forEach(page => {
      // 排除当前页面
      if (page.route !== 'pages/profile/profile') {
        // 更新头像信息
        page.setData({
          avatarType: avatarType,
          avatarText: avatarText,
          avatarEmoji: avatarEmoji
        });
      }
    });
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
    // 页面显示时重新解析更新日志，确保内容同步
    const changelog = this.parseChangelog();
    this.setData({
      changelog: changelog
    });
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
    
    // 保存配置到本地存储
    wx.setStorageSync('webdavConfig', this.data.webdavConfig);
    
    // 关闭弹窗
    this.hideWebDAVModal();
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },
  
  // 测试WebDAV连接
  testWebDAVConnection() {
    const { url, username, password } = this.data.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写完整的服务器信息',
        icon: 'none'
      });
      return;
    }
    
    // 验证URL格式
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      wx.showToast({
        title: 'URL格式错误，请包含http://或https://',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '测试连接中...'
    });
    
    try {
      // 生成测试文件内容
      const testContent = JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        message: 'WebDAV连接测试文件'
      }, null, 2);
      
      // 生成测试文件名
      const testFileName = `webdav_test_${Date.now()}.json`;
      const testFilePath = `${wx.env.USER_DATA_PATH}/${testFileName}`;
      const fs = wx.getFileSystemManager();
      
      // 写入测试文件
      fs.writeFile({
        filePath: testFilePath,
        data: testContent,
        encoding: 'utf8',
        success: () => {
          // 生成固定的测试文件夹名
          let folder = this.data.webdavConfig.folder;
          if (!folder) {
            const user = this.data.username || '未命名用户';
            folder = `${user}排班备份`;
          }
          
          // 上传测试文件到WebDAV
          this.uploadToWebDAV(testFilePath, testFileName, url, username, password, folder).then(() => {
            // 上传成功后，检查文件是否存在
            this.checkWebDAVFileExists(url, username, password, folder, testFileName).then((exists) => {
              if (exists) {
                // 文件存在，连接成功
                // 删除测试文件
                this.deleteWebDAVFile(url, username, password, folder, testFileName);
                // 删除本地测试文件
                fs.unlinkSync(testFilePath);
                wx.hideLoading();
                wx.showToast({
                  title: '连接成功',
                  icon: 'success'
                });
              } else {
                // 文件不存在，连接失败
                fs.unlinkSync(testFilePath);
                wx.hideLoading();
                wx.showToast({
                  title: '连接失败：无法验证文件上传',
                  icon: 'none'
                });
              }
            }).catch((err) => {
              console.error('检查测试文件失败', err);
              fs.unlinkSync(testFilePath);
              wx.hideLoading();
              wx.showToast({
                title: '连接失败：无法验证文件上传',
                icon: 'none'
              });
            });
          }).catch((err) => {
            console.error('上传测试文件失败', err);
            fs.unlinkSync(testFilePath);
            wx.hideLoading();
            wx.showToast({
              title: '连接失败：无法上传测试文件',
              icon: 'none'
            });
          });
        },
        fail: (err) => {
          console.error('创建测试文件失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '连接失败：无法创建测试文件',
            icon: 'none'
          });
        }
      });
    } catch (e) {
      console.error('测试连接失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '连接失败：测试过程中出现错误',
        icon: 'none'
      });
    }
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
        resolve(); // 没有图片文件夹，直接返回成功
        return;
      }
      
      const imagePromises = []; // 存储所有图片处理的 Promise
      
      // 递归处理图片文件夹中的所有文件
      const processImageFolder = (folder, basePath = '') => {
        folder.forEach((relativePath, file) => {
          if (file.dir) {
            // 如果是子文件夹（如 YYYY-MM），递归处理
            const subFolder = folder.folder(relativePath);
            if (subFolder) {
              processImageFolder(subFolder, `${basePath}${relativePath}/`);
            }
          } else {
            // 处理图片文件
            file.async('arraybuffer').then((content) => {
              // 完整的图片路径
              const fullImagePath = `${basePath}${relativePath}`;
              
              // 尝试从图片周关联表中查找对应的周存储
              let weekImageKey = null;
              let imageName = null;
              
              // 遍历图片周关联表，查找匹配的图片路径
              Object.keys(imageWeekRelation).forEach(key => {
                const images = imageWeekRelation[key] || [];
                for (const img of images) {
                  if (img.path === fullImagePath) {
                    weekImageKey = key;
                    imageName = img.name;
                    return;
                  }
                }
              });
              
              if (weekImageKey && imageName) {
                // 使用图片周关联表中的信息恢复图片
                const existingImages = wx.getStorageSync(weekImageKey) || [];
                
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
                  
                  // 写入图片文件
                  fs.writeFile({
                    filePath: tempPath,
                    data: content,
                    success: () => {
                      // 添加新图片
                      existingImages.push({
                        id: imageId,
                        name: imageName,
                        path: tempPath,
                        addedTime: new Date().toISOString()
                      });
                      
                      // 保存图片数据
                      wx.setStorageSync(weekImageKey, existingImages);
                    },
                    fail: (err) => {
                      console.error('写入图片文件失败', err);
                    }
                  });
                }
              } else {
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
                    },
                    fail: (err) => {
                      console.error('写入图片文件失败', err);
                    }
                  });
                }
              }
            }).catch((err) => {
              console.error('提取图片失败', err);
            });
          }
        });
      };
    
    processImageFolder(imageFolder);
    
    // 等待所有图片处理完成
    Promise.all(imagePromises).then(() => {
      console.log(`图片恢复完成，共恢复 ${imagePromises.length} 张图片`);
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
        console.error('showActionSheet 失败:', err);
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
      showCloudRegisterModal: false
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
      showUserManagementModal: false
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
        this.setData({
          cloudLoggedIn: true,
          cloudAccount: cloudAccountInput,
          username: cloudAccountInput
        });
        // 保存到本地存储
        wx.setStorageSync('username', cloudAccountInput);
        wx.setStorageSync('cloudAccount', cloudAccountInput);
        wx.setStorageSync('cloudLoggedIn', true);
        wx.setStorageSync('cloudUserId', result.userId);
        this.userId = result.userId;
        
        this.hideCloudLoginModal();
        wx.showToast({
          title: '登录成功',
          icon: 'success'
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
    const { cloudAccountInput, cloudPasswordInput, cloudConfirmPassword } = this.data;

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
      const cloudManager = this.data.cloudManager;
      const result = await cloudManager.register(cloudAccountInput, cloudPasswordInput);

      wx.hideLoading();

      if (result.success) {
        this.setData({
          cloudLoggedIn: true,
          cloudAccount: cloudAccountInput,
          username: cloudAccountInput
        });
        // 保存到本地存储
        wx.setStorageSync('username', cloudAccountInput);
        wx.setStorageSync('cloudAccount', cloudAccountInput);
        wx.setStorageSync('cloudLoggedIn', true);
        wx.setStorageSync('cloudUserId', result.userId);
        this.userId = result.userId;
        
        this.hideCloudRegisterModal();
        wx.showToast({
          title: '注册成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.errMsg || '注册失败',
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
            username: ''
          });
          // 清空本地存储
          wx.removeStorageSync('username');
          wx.removeStorageSync('cloudAccount');
          wx.removeStorageSync('cloudLoggedIn');
          wx.removeStorageSync('cloudUserId');
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