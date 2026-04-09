const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('schedule_users');

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
  const { action, account, password } = event;

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
          nickname: user.nickname
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

      const result = await usersCollection.add({
        data: {
          account: account,
          password: encryptedPassword,
          salt: salt,
          nickname: `用户${account.slice(-4)}`,
          createTime: new Date(),
          updateTime: new Date()
        }
      });

      return {
        success: true,
        data: {
          userId: result._id,
          account: account,
          nickname: `用户${account.slice(-4)}`
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
