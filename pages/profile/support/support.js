// support.js - 支持页面逻辑
Page({
  data: {
    title: '技术支持',
    contactInfo: {
      email: 'support@example.com',
      phone: '400-123-4567',
      wechat: 'SYworkSupport'
    }
  },

  onLoad: function(options) {
    console.log('support页面加载');
  },

  onShow: function() {
    console.log('support页面显示');
  },

  // 联系客服
  contactCustomerService: function() {
    wx.makePhoneCall({
      phoneNumber: this.data.contactInfo.phone
    });
  },

  // 复制邮箱
  copyEmail: function() {
    wx.setClipboardData({
      data: this.data.contactInfo.email,
      success: function() {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success'
        });
      }
    });
  },

  // 复制微信号
  copyWechat: function() {
    wx.setClipboardData({
      data: this.data.contactInfo.wechat,
      success: function() {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        });
      }
    });
  }
});