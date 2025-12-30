// pages/profile/profile.js
const api = require('../../utils/api.js');
const changelogData = require('../../utils/changelog.js');

Page({
  data: {
    exportFileName: '',
    exportedFilePath: '',
    exportedFileName: '',
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
    emojiList: ['😊', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑'], // 表情列表
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
    // 读取本地存储的用户名
    const username = wx.getStorageSync('username') || '';
    // 读取本地存储的头像信息
    const avatarType = wx.getStorageSync('avatarType') || 'text';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '';
    
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
      emojiEmotion: emojiEmotion
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

  // 显示文件名设置弹窗
  showFileNameModal() {
    // 设置默认文件名提示：用户名+备份
    const username = this.data.username || '未命名用户';
    const defaultFileNameHint = `${username}+备份`;
    
    this.setData({
      tempFileName: '',
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
    
    // 调用导出数据方法
    this.exportData(customFileName);
  },

  

  exportData(customFileName) {
    wx.showLoading({
      title: '正在导出...'
    });
    
    try {
      // 获取班次模板数据和排班数据
      const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      const shifts = wx.getStorageSync('shifts') || {};
      
      // 获取自定义每周标准工时
      const customWeeklyHours = wx.getStorageSync('customWeeklyHours') || 35;
      
      // 构造导出数据结构
      const data = {
        shiftTemplates: shiftTemplates,
        shifts: shifts,
        customWeeklyHours: customWeeklyHours
      };
      
      // 添加统计数据（根据排班实时计算）
      const allShifts = data.shifts;
      let totalHours = 0;
      let workDays = 0;
      let offDays = 0;
      let totalDays = 0;
      
      // 计算统计数据
      Object.keys(allShifts).forEach(date => {
        const shift = allShifts[date];
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
      
      const jsonData = JSON.stringify(data, null, 2);
      
      // 获取用户名
      const username = this.data.username || '未命名用户';
      
      // 生成默认文件名：用户名+备份时间
      const backupTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/[\/\s:]/g, '-');
      const fileName = customFileName ? customFileName : `${username}_备份_${backupTime}`;
      
      // 创建临时文件
      const fs = wx.getFileSystemManager();
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
            content: '数据已导出为JSON文件，请点击下方"分享给好友"按钮将文件发送给好友',
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
    } catch (e) {
      wx.hideLoading();
      console.error('导出数据失败', e);
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

  // 分享文件给好友
  shareFile(filePath, fileName) {
    // 检查是否支持分享文件
    if (wx.shareFileMessage) {
      wx.shareFileMessage({
        filePath: filePath,
        fileName: `${fileName}.json`,
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
      extension: ['json'],
      // 提示用户选择JSON文件，提高用户体验
      success: (res) => {
        // 额外验证文件扩展名，确保是JSON文件
        const fileName = res.tempFiles[0].name;
        if (!fileName.toLowerCase().endsWith('.json')) {
          wx.showToast({
            title: '请选择JSON格式文件',
            icon: 'none'
          });
          return;
        }
        wx.showLoading({
          title: '正在导入...'
        });
        
        const filePath = res.tempFiles[0].path;
        
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

  

  
  
  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作不可恢复！',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...'
          });
          
          try {
            // 清空所有相关的本地存储数据
            wx.removeStorageSync('shiftTemplates');
            wx.removeStorageSync('shifts');
            // 如果还有其他需要清空的数据，可以在这里添加
            
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
                  // 重新加载班次模板数据（空数组）
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
      const versionMatch = versionLine.match(/([vV]\d+\.\d+\.\d+\.\d+)\s+\((\d{4}-\d{2}-\d{2})\)/);
      
      if (versionMatch) {
        const version = versionMatch[1];
        const date = versionMatch[2];
        
        // 提取版本内容（去掉版本号和日期行）
        const contentLines = lines.slice(1).filter(line => line.trim() !== '');
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
  }
});