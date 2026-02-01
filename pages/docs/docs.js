// pages/docs/docs.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    scrollToId: '',
    activeSection: '',
    showBackToTop: false
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
      const sectionId = typeMap[options.type];
      if (sectionId) {
        this.setData({ 
          scrollToId: sectionId,
          activeSection: options.type
        });
      }
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    if (this.data.scrollToId) {
      this.scrollToTarget(this.data.scrollToId);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时开始监听滚动
    this.startScrollObserver();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    this.stopScrollObserver();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.stopScrollObserver();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    wx.stopPullDownRefresh();
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
    return {
      title: '排班助手 - 使用说明',
      path: '/pages/docs/docs'
    };
  },

  /**
   * 监听页面滚动
   */
  onPageScroll(e) {
    const scrollTop = e.scrollTop;
    
    // 控制返回顶部按钮显示/隐藏
    this.setData({
      showBackToTop: scrollTop > 400
    });

    // 更新当前活跃的区块
    this.updateActiveSection(scrollTop);
  },

  /**
   * 开始监听滚动（用于计算当前所在区块）
   */
  startScrollObserver() {
    // 获取所有区块的位置信息
    this.updateSectionRects();
  },

  /**
   * 停止监听滚动
   */
  stopScrollObserver() {
    // 清理工作
  },

  /**
   * 更新区块位置信息
   */
  updateSectionRects() {
    const query = wx.createSelectorQuery();
    const sections = ['section-about', 'section-statistics', 'section-webdav', 'section-data'];
    
    this.sectionRects = {};
    
    sections.forEach(id => {
      query.select('#' + id).boundingClientRect();
    });
    
    query.exec((res) => {
      if (res && res.length > 0) {
        sections.forEach((id, index) => {
          if (res[index]) {
            this.sectionRects[id] = res[index];
          }
        });
      }
    });
  },

  /**
   * 更新当前活跃的区块
   */
  updateActiveSection(scrollTop) {
    if (!this.sectionRects || Object.keys(this.sectionRects).length === 0) {
      return;
    }

    const offset = 200; // 偏移量，用于提前触发
    let activeSection = '';

    // 检查每个区块的位置
    for (const [id, rect] of Object.entries(this.sectionRects)) {
      const sectionTop = rect.top + scrollTop - offset;
      const sectionBottom = sectionTop + rect.height;

      if (scrollTop >= sectionTop && scrollTop < sectionBottom) {
        // 提取 section 类型
        const sectionType = id.replace('section-', '');
        if (activeSection !== sectionType) {
          activeSection = sectionType;
        }
        break;
      }
    }

    // 如果滚动到页面底部，选中最后一个区块
    if (!activeSection && scrollTop > 0) {
      const lastSection = Object.keys(this.sectionRects).pop();
      if (lastSection) {
        activeSection = lastSection.replace('section-', '');
      }
    }

    if (activeSection && this.data.activeSection !== activeSection) {
      this.setData({ activeSection });
    }
  },

  /**
   * 滚动到指定区块
   */
  scrollToSection(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    // 更新活跃状态
    const sectionType = id.replace('section-', '');
    this.setData({ activeSection: sectionType });

    // 执行滚动
    this.scrollToTarget(id);
  },

  /**
   * 滚动到目标位置
   */
  scrollToTarget(targetId) {
    const query = wx.createSelectorQuery();
    query.select('#' + targetId).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      if (res[0] && res[1]) {
        const rect = res[0];
        const scrollOffset = res[1];
        // 计算需要滚动的位置（减去一些偏移量，使内容不会被顶部遮挡）
        const scrollTop = scrollOffset.scrollTop + rect.top - 120;
        wx.pageScrollTo({
          scrollTop: scrollTop > 0 ? scrollTop : 0,
          duration: 300
        });
      }
    });
  },

  /**
   * 返回顶部
   */
  backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
    this.setData({ activeSection: '' });
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
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
});
