// pages/profile/profile.js
const api = require('../../utils/api.js');
const changelogData = require('../../utils/changelog.js');
const JSZip = require('../../utils/jszip.min.js');

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
    // WebDAV备份设置
    webdavConfig: {
      url: '',
      username: '',
      password: '',
      folder: ''
    },
    // WebDAV配置弹窗
    showWebDAVModal: false,
    // 密码显示/隐藏状态
    showPassword: false,
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



  onLoad() {
    const username = wx.getStorageSync('username') || '';
    // 读取本地存储的头像信息
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    
    // 读取WebDAV配置
    const webdavConfig = wx.getStorageSync('webdavConfig') || {
      url: '',
      username: '',
      password: ''
    };
    
    // 生成头像文字
    const avatarText = this.generateAvatarText(username);
    
    // 获取表情对应的文字和情绪类型
    const emojiText = avatarType === 'emoji' && avatarEmoji ? this.data.emojiTextMap[avatarEmoji] || '' : '';
    const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? this.data.emojiEmotionMap[avatarEmoji] || 'neutral' : '';
    
    this.setData({
      username: username,
      avatarText: avatarText,
      avatarEmoji: avatarEmoji,
      avatarType: avatarType,
      emojiText: emojiText,
      emojiEmotion: emojiEmotion,
      webdavConfig: webdavConfig
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
      
      // 添加JSON数据文件
      zip.file('data.json', JSON.stringify(data, null, 2));
      
      // 添加图片文件
      const images = [];
      const fs = wx.getFileSystemManager();
      const imagePromises = [];
      
      // 获取所有周的图片
      // 注意：这里需要根据实际存储结构调整，例如按周存储的图片
      // 假设图片是按周存储的，键格式为 week_images_{weekKey}
      const storageInfo = wx.getStorageInfoSync();
      const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
      
      weekImageKeys.forEach(key => {
        const weekImages = wx.getStorageSync(key) || [];
        weekImages.forEach((image, index) => {
          const promise = new Promise((resolve) => {
            try {
              // 读取图片文件
              fs.readFile({
                filePath: image.path,
                success: (res) => {
                  // 生成图片文件名
                  const imageFileName = `images/${key}_${index}_${image.name || `image_${index}.jpg`}`;
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
        });
      });
      
      // 等待所有图片处理完成
      Promise.all(imagePromises).then(() => {
        // 生成ZIP文件
        zip.generateAsync({ type: 'uint8array' }).then((content) => {
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
          
          this.finishImport();
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
    
    fs.readFile({
      filePath: filePath,
      success: (readRes) => {
        try {
          const zip = new JSZip();
          
          zip.loadAsync(readRes.data).then((zip) => {
            // 读取data.json文件
            zip.file('data.json').async('string').then((jsonStr) => {
              const data = JSON.parse(jsonStr);
              
              // 验证数据格式
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
              
              // 处理图片文件
              const imageDir = zip.folder('images');
              if (imageDir) {
                const imagePromises = [];
                
                // 遍历图片文件夹中的文件
                imageDir.forEach((relativePath, file) => {
                  const promise = file.async('uint8array').then((content) => {
                    // 生成临时图片路径
                    const tempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${relativePath.split('/').pop()}`;
                    // 写入图片文件
                    fs.writeFile({
                      filePath: tempPath,
                      data: content,
                      success: () => {
                        // 解析图片信息，恢复到对应的周存储
                        // 假设图片文件名格式为：week_images_{weekKey}_index_name.jpg
                        const fileNameParts = relativePath.split('/').pop().split('_');
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
                });
                
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
    
    wx.showLoading({
      title: '测试连接中...'
    });
    
    // 构建测试请求 - 使用GET方法测试连接
    const testUrl = url;
    // 生成Base64编码的认证信息
    const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
    
    // 使用wx.request测试连接
    wx.request({
      url: testUrl,
      method: 'GET',
      header: {
        'Authorization': authHeader
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          wx.showToast({
            title: '连接成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: `连接失败: ${res.statusCode}`,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '连接失败，请检查服务器信息',
          icon: 'none'
        });
      }
    });
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
  
  // WebDAV备份功能（增量备份）
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
      
      // 并行获取服务器上的文件信息
      Promise.all([
        this.getWebDAVFileInfo(url, username, password, folder, '班次模板.json'),
        this.getWebDAVFileInfo(url, username, password, folder, '排班数据.json'),
        this.getWebDAVFileInfo(url, username, password, folder, 'images/')
      ]).then(([templateInfo, shiftInfo, imagesInfo]) => {
        // 获取本地数据的修改时间
        const localTemplateTime = wx.getStorageSync('shiftTemplatesLastModified') || 0;
        const localShiftTime = wx.getStorageSync('shiftsLastModified') || 0;
        const localImagesTime = wx.getStorageSync('imagesLastModified') || 0;
        
        // 检查是否需要备份班次模板
        if (!templateInfo || this.needBackup('shiftTemplates', templateInfo, localTemplateTime)) {
          this.backupShiftTemplates(url, username, password, folder, fs);
          // 更新本地时间戳
          wx.setStorageSync('shiftTemplatesLastModified', Date.now());
        }
        
        // 检查是否需要备份排班数据
        if (!shiftInfo || this.needBackup('shifts', shiftInfo, localShiftTime)) {
          this.backupShifts(url, username, password, folder, fs);
          // 更新本地时间戳
          wx.setStorageSync('shiftsLastModified', Date.now());
        }
        
        // 检查是否需要备份图片
        if (!imagesInfo || this.needBackupImages(localImagesTime)) {
          this.backupImages(url, username, password, folder, fs);
          // 更新本地时间戳
          wx.setStorageSync('imagesLastModified', Date.now());
        }
        
        // 如果没有需要备份的内容，直接显示成功
        if (templateInfo && !this.needBackup('shiftTemplates', templateInfo, localTemplateTime) &&
            shiftInfo && !this.needBackup('shifts', shiftInfo, localShiftTime) &&
            imagesInfo && !this.needBackupImages(localImagesTime)) {
          wx.hideLoading();
          wx.showToast({
            title: '备份成功（无变化）',
            icon: 'success'
          });
        }
      }).catch((err) => {
        console.error('增量备份检查失败', err);
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
          const imageFileName = `images/${key}_${index}_${image.name || `image_${index}.jpg`}`;
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
      wx.hideLoading();
      wx.showToast({
        title: '备份成功（无新图片）',
        icon: 'success'
      });
    }
  },
  
  // 构建WebDAV URL
  buildWebDAVUrl(url, folder, fileName) {
    let webDavUrl = url.endsWith('/') ? url : url + '/';
    if (folder) {
      webDavUrl += folder.endsWith('/') ? folder : folder + '/';
    }
    webDavUrl += fileName;
    return webDavUrl;
  },
  
  // 获取WebDAV服务器上文件的详细信息
  getWebDAVFileInfo(url, username, password, folder, fileName) {
    return new Promise((resolve, reject) => {
      const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      wx.request({
        url: fileUrl,
        method: 'PROPFIND',
        header: {
          'Authorization': authHeader,
          'Depth': '1' // 获取文件详细信息
        },
        success: (res) => {
          if (res.statusCode === 207) { // WebDAV PROPFIND成功响应码
            // 解析XML响应，提取文件信息（如修改时间）
            try {
              // 简单解析XML，提取lastModified时间
              const xmlData = res.data;
              const lastModifiedMatch = xmlData.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/);
              const lastModified = lastModifiedMatch ? lastModifiedMatch[1] : null;
              resolve({ lastModified });
            } catch (e) {
              console.error('解析WebDAV响应失败', e);
              resolve(null);
            }
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
          resolve(null);
        }
      });
    });
  },
  
  // 上传文件到WebDAV
  uploadToWebDAV(filePath, fileName, url, username, password, folder) {
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
        
        // 上传文件
        wx.request({
          url: uploadUrl,
          method: 'PUT',
          header: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          data: fileContent,
          success: (res) => {
            wx.hideLoading();
            if (res.statusCode >= 200 && res.statusCode < 300) {
              wx.showToast({
                title: '备份成功',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: `备份失败: ${res.statusCode}`,
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '备份失败，请检查网络连接',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 从WebDAV恢复备份（多设备同步时以最新备份为准）
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
      title: '恢复中...'
    });
    
    try {
      // 生成固定的文件夹名：用户名排班备份
      let folder = this.data.webdavConfig.folder;
      if (!folder) {
        const user = this.data.username || '未命名用户';
        folder = `${user}排班备份`;
      }
      
      // 并行获取服务器上的文件信息
      Promise.all([
        this.getWebDAVFileInfo(url, username, password, folder, '班次模板.json'),
        this.getWebDAVFileInfo(url, username, password, folder, '排班数据.json'),
        this.getWebDAVFileInfo(url, username, password, folder, 'images/')
      ]).then(([templateInfo, shiftInfo, imagesInfo]) => {
        // 获取本地数据的修改时间
        const localTemplateTime = wx.getStorageSync('shiftTemplatesLastModified') || 0;
        const localShiftTime = wx.getStorageSync('shiftsLastModified') || 0;
        const localImagesTime = wx.getStorageSync('imagesLastModified') || 0;
        
        // 检查是否需要恢复班次模板（服务器备份比本地数据新）
        if (templateInfo) {
          try {
            const serverTemplateTime = new Date(templateInfo.lastModified).getTime();
            if (serverTemplateTime > localTemplateTime || localTemplateTime === 0) {
              this.restoreShiftTemplates(url, username, password, folder);
              // 更新本地时间戳
              wx.setStorageSync('shiftTemplatesLastModified', serverTemplateTime);
            }
          } catch (e) {
            console.error('解析服务器班次模板时间失败', e);
            this.restoreShiftTemplates(url, username, password, folder);
          }
        }
        
        // 检查是否需要恢复排班数据（服务器备份比本地数据新）
        if (shiftInfo) {
          try {
            const serverShiftTime = new Date(shiftInfo.lastModified).getTime();
            if (serverShiftTime > localShiftTime || localShiftTime === 0) {
              this.restoreShifts(url, username, password, folder);
              // 更新本地时间戳
              wx.setStorageSync('shiftsLastModified', serverShiftTime);
            }
          } catch (e) {
            console.error('解析服务器排班数据时间失败', e);
            this.restoreShifts(url, username, password, folder);
          }
        }
        
        // 检查是否需要恢复图片（服务器备份存在）
        if (imagesInfo) {
          this.restoreImages(url, username, password, folder);
          // 更新本地时间戳
          wx.setStorageSync('imagesLastModified', Date.now());
        }
        
        // 延迟显示成功提示，确保所有恢复操作完成
        setTimeout(() => {
          wx.hideLoading();
          wx.showToast({
            title: '恢复成功',
            icon: 'success'
          });
        }, 1000);
        
      }).catch((err) => {
        console.error('恢复备份失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '恢复失败',
          icon: 'none'
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
  
  // 恢复图片文件夹
  restoreImages(url, username, password, folder) {
    const listUrl = this.buildWebDAVUrl(url, folder, 'images/');
    const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
    
    wx.request({
      url: listUrl,
      method: 'PROPFIND',
      header: {
        'Authorization': authHeader,
        'Depth': '1'
      },
      success: (res) => {
        if (res.statusCode === 207) {
          const images = this.parseWebDAVImageFiles(res.data);
          this.downloadAndRestoreImages(images, url, username, password, folder);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '恢复成功',
            icon: 'success'
          });
        }
      },
      fail: (err) => {
        console.error('列出图片文件失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '恢复成功（图片恢复失败）',
          icon: 'none'
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
  }
});