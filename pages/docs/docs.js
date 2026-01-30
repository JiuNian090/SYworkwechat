// pages/docs/docs.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    scrollToId: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('使用说明页面加载', options);
    // 根据传入的type参数设置对应的锚点ID
    if (options.type) {
      const typeMap = {
        'data': 'section-data',
        'webdav': 'section-webdav',
        'statistics': 'section-statistics'
      };
      const scrollToId = typeMap[options.type];
      if (scrollToId) {
        this.setData({ scrollToId });
      }
    }
  },

  /**
   * 页面渲染完成后执行滚动
   */
  onReady() {
    if (this.data.scrollToId) {
      this.scrollToSection(this.data.scrollToId);
    }
  },

  /**
   * 滚动到指定板块
   */
  scrollToSection(sectionId) {
    const query = wx.createSelectorQuery();
    query.select('#' + sectionId).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      if (res[0] && res[1]) {
        const rect = res[0];
        const scrollOffset = res[1];
        // 计算需要滚动的位置（减去一些偏移量，使内容不会被顶部遮挡）
        const scrollTop = scrollOffset.scrollTop + rect.top - 20;
        wx.pageScrollTo({
          scrollTop: scrollTop,
          duration: 300
        });
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const current = e.currentTarget.dataset.src;
    const urls = [
      '/pages/profile/first.png',
      '/pages/profile/second.png'
    ];
    wx.previewImage({
      current: current,
      urls: urls
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
  }
})