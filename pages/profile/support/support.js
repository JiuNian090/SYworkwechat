// pages/profile/support/support.js
Page({
  data: {

  },

  onLoad: function (options) {

  },

  onShareAppMessage: function () {
    return {
      title: 'SYwork排班管理系统',
      path: '/pages/profile/profile'
    };
  },

  onShareTimeline: function () {
    return {
      title: 'SYwork排班管理系统'
    };
  },

  // 回到首页
  goHome: function() {
    wx.switchTab({
      url: '/pages/plan/plan'
    });
  },

  // 图片长按事件处理
  onImageLongPress: function() {
    wx.showActionSheet({
      itemList: ['保存图片', '识别图中的二维码', '取消'],
      success: function(res) {
        if (res.tapIndex === 0) {
          // 保存图片到相册
          wx.saveImageToPhotosAlbum({
            filePath: '/image/reward.png',
            success: function() {
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              });
            },
            fail: function(err) {
              // 如果保存失败，可能是因为没有授权
              if (err.errMsg && err.errMsg.includes('fail auth deny')) {
                wx.showModal({
                  title: '保存失败',
                  content: '请允许保存图片到相册权限',
                  showCancel: true,
                  confirmText: '去设置',
                  success: function(modalRes) {
                    if (modalRes.confirm) {
                      wx.openSetting({
                        success: function(data) {
                          if (data.authSetting['scope.writePhotosAlbum']) {
                            // 授权成功后重新保存
                            wx.saveImageToPhotosAlbum({
                              filePath: '/image/reward.png',
                              success: function() {
                                wx.showToast({
                                  title: '保存成功',
                                  icon: 'success'
                                });
                              }
                            });
                          }
                        }
                      });
                    }
                  }
                });
              } else {
                wx.showToast({
                  title: '保存失败',
                  icon: 'none'
                });
              }
            }
          });
        } else if (res.tapIndex === 1) {
          // 识别二维码功能提示
          wx.showModal({
            title: '如何识别二维码',
            content: '1. 保存图片到手机相册\n2. 打开微信首页，下拉搜索框\n3. 点击"扫一扫"\n4. 点击右下角"相册"图标\n5. 选择刚刚保存的二维码图片\n6. 即可识别并跳转到赞赏页面',
            showCancel: false,
            confirmText: '知道了'
          });
        }
      }
    });
  }
});