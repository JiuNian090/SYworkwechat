const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('schedule_users');
const backupCollection = db.collection('schedule_backups');

// 密码加密
function encryptPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

// 生成盐
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, account, password, newAccount, newPassword, nickname, userId } = event;

  try {
    if (action === 'login') {
      // 用户登录
      const userResult = await usersCollection.where({
        account: account
      }).get();

      if (userResult.data.length === 0) {
        return {
          success: false,
          errMsg: '账号不存在'
        };
      }

      const user = userResult.data[0];
      const encryptedPassword = encryptPassword(password, user.salt);

      if (encryptedPassword !== user.password) {
        return {
          success: false,
          errMsg: '密码错误'
        };
      }

      return {
        success: true,
        data: {
          userId: user._id,
          account: user.account,
          nickname: user.nickname,
          avatarType: user.avatarType || 'emoji',
          avatarEmoji: user.avatarEmoji || '😊',
          avatarText: user.avatarText || ''
        }
      };

    } else if (action === 'register') {
      // 用户注册
      const existingUser = await usersCollection.where({
        account: account
      }).get();

      if (existingUser.data.length > 0) {
        return {
          success: false,
          errMsg: '账号已存在'
        };
      }

      const salt = generateSalt();
      const encryptedPassword = encryptPassword(password, salt);
      const userNickname = nickname || `用户${account.slice(-4)}`;

      const result = await usersCollection.add({
        data: {
          account: account,
          password: encryptedPassword,
          salt: salt,
          nickname: userNickname,
          avatarType: 'emoji',
          avatarEmoji: '😊',
          avatarText: '',
          createTime: new Date(),
          updateTime: new Date()
        }
      });

      return {
        success: true,
        data: {
          userId: result._id,
          account: account,
          nickname: userNickname,
          avatarType: 'emoji',
          avatarEmoji: '😊',
          avatarText: ''
        }
      };

    } else if (action === 'updateNickname') {
      // 修改昵称
      if (!userId) {
        return {
          success: false,
          errMsg: '参数错误'
        };
      }

      // 更新昵称
      await usersCollection.doc(userId).update({
        data: {
          nickname: nickname || '',
          updateTime: new Date()
        }
      });

      return {
        success: true,
        data: {
          nickname: nickname || ''
        }
      };

    } else if (action === 'updatePassword') {
      // 修改密码
      if (!userId || !password || !newPassword) {
        return {
          success: false,
          errMsg: '参数错误'
        };
      }

      // 获取用户信息
      const user = await usersCollection.doc(userId).get();
      if (!user.data) {
        return {
          success: false,
          errMsg: '用户不存在'
        };
      }

      // 验证旧密码
      const encryptedOldPassword = encryptPassword(password, user.data.salt);
      if (encryptedOldPassword !== user.data.password) {
        return {
          success: false,
          errMsg: '原密码错误'
        };
      }

      // 生成新盐并加密新密码
      const newSalt = generateSalt();
      const encryptedNewPassword = encryptPassword(newPassword, newSalt);

      // 更新密码
      await usersCollection.doc(userId).update({
        data: {
          password: encryptedNewPassword,
          salt: newSalt,
          updateTime: new Date()
        }
      });

      return {
        success: true
      };

    } else if (action === 'updateAvatar') {
      // 更新头像信息
      if (!userId) {
        return {
          success: false,
          errMsg: '参数错误'
        };
      }

      const { avatarType, avatarEmoji, avatarText } = event;

      // 更新头像信息
      await usersCollection.doc(userId).update({
        data: {
          avatarType: avatarType || 'emoji',
          avatarEmoji: avatarEmoji || '😊',
          avatarText: avatarText || '',
          updateTime: new Date()
        }
      });

      return {
        success: true,
        data: {
          avatarType: avatarType || 'text',
          avatarEmoji: avatarEmoji || '',
          avatarText: avatarText || ''
        }
      };

    } else if (action === 'deleteAccount') {
      // 删除账户
      if (!userId || !password) {
        return {
          success: false,
          errMsg: '参数错误'
        };
      }

      // 获取用户信息
      const user = await usersCollection.doc(userId).get();
      if (!user.data) {
        return {
          success: false,
          errMsg: '用户不存在'
        };
      }

      // 验证密码
      const encryptedPassword = encryptPassword(password, user.data.salt);
      if (encryptedPassword !== user.data.password) {
        return {
          success: false,
          errMsg: '密码错误'
        };
      }

      // 删除用户的备份数据
      try {
        const backupResult = await backupCollection.where({
          userId: userId
        }).get();
        
        if (backupResult.data.length > 0) {
          const backup = backupResult.data[0];
          
          // 删除云存储中的图片
          if (backup.images && backup.images.length > 0) {
            const fileIDs = backup.images
              .filter(img => img.fileID)
              .map(img => img.fileID);
            
            if (fileIDs.length > 0) {
              await cloud.deleteFile({
                fileList: fileIDs
              });
            }
          }
          
          // 删除备份记录
          await backupCollection.doc(backup._id).remove();
        }
      } catch (e) {
        console.error('删除备份数据失败', e);
      }

      // 删除用户记录
      await usersCollection.doc(userId).remove();

      return {
        success: true,
        message: '账户删除成功'
      };

    } else if (action === 'getUserInfo') {
      // 获取用户信息
      if (!userId) {
        return {
          success: false,
          errMsg: '参数错误'
        };
      }

      // 获取用户信息
      const user = await usersCollection.doc(userId).get();
      if (!user.data) {
        return {
          success: false,
          errMsg: '用户不存在'
        };
      }

      return {
        success: true,
        data: {
          userId: user.data._id,
          account: user.data.account,
          nickname: user.data.nickname,
          avatarType: user.data.avatarType || 'emoji',
          avatarEmoji: user.data.avatarEmoji || '😊',
          avatarText: user.data.avatarText || ''
        }
      };

    }

    return {
      success: false,
      errMsg: '无效的操作'
    };

  } catch (e) {
    console.error('用户操作失败', e);
    return {
      success: false,
      errMsg: e.message
    };
  }
};
