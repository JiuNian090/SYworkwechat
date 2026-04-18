// pages/docs/docs.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    scrollToId: '',
    activeSection: ''
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
        'cloud': 'section-cloud',
        'statistics': 'section-statistics',
        'profile': 'section-profile'
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
      // 延迟执行滚动，确保页面元素已完全渲染
      setTimeout(() => {
        this.scrollToTarget(this.data.scrollToId);
      }, 100);
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
      title: 'SY工时记录 - 使用说明',
      path: '/pages/docs/docs'
    };
  },

  /**
   * 用户点击右上角分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: 'SY工时记录 - 使用说明',
      imageUrl: '' // 可以设置分享图片，为空则使用小程序默认图片
    };
  },

  /**
   * 监听页面滚动
   */
  onPageScroll(e) {
    const scrollTop = e.scrollTop;

    // 更新当前活跃的区块
    this.updateActiveSection(scrollTop);
  },

  /**
   * 获取导航栏位置信息
   */
  getNavPosition() {
    // 导航栏固定在底部，不需要获取位置信息
  },

  /**
   * 开始监听滚动（用于计算当前所在区块）
   */
  startScrollObserver() {
    // 获取所有区块的位置信息
    this.updateSectionRects();
    // 获取导航栏位置信息
    this.getNavPosition();
    
    // 页面加载后立即检查当前位置
    setTimeout(() => {
      wx.createSelectorQuery().selectViewport().scrollOffset().exec((res) => {
        if (res && res[0]) {
          this.updateActiveSection(res[0].scrollTop);
        }
      });
    }, 100);
    
    // 监听图片加载完成事件，重新计算区块位置
    this.observeImageLoad();
  },

  /**
   * 停止监听滚动
   */
  stopScrollObserver() {
    // 清理工作
  },

  /**
   * 监听图片加载完成事件，重新计算区块位置
   */
  observeImageLoad() {
    const query = wx.createSelectorQuery();
    query.selectAll('.step-image').fields({
      size: true
    });
    query.exec((res) => {
      if (res && res[0] && res[0].length > 0) {
        // 当图片加载完成后，重新计算区块位置
        setTimeout(() => {
          this.updateSectionRects();
          // 重新检查当前活跃区块
          wx.createSelectorQuery().selectViewport().scrollOffset().exec((scrollRes) => {
            if (scrollRes && scrollRes[0]) {
              this.updateActiveSection(scrollRes[0].scrollTop);
            }
          });
        }, 500);
      }
    });
  },

  /**
   * 更新区块位置信息
   */
  updateSectionRects() {
    const query = wx.createSelectorQuery();
    const sections = ['section-about', 'section-statistics', 'section-cloud', 'section-data', 'section-profile'];
    
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
        // 计算每个区块的顶部位置（相对于页面顶部）
        this.calcSectionTopPositions();
      }
    });
  },

  /**
   * 计算每个区块的顶部位置（相对于页面顶部）
   */
  calcSectionTopPositions() {
    this.sectionTopPositions = [];
    const sections = ['section-about', 'section-statistics', 'section-cloud', 'section-data', 'section-profile'];
    
    sections.forEach(id => {
      if (this.sectionRects[id]) {
        // 获取当前滚动位置
        wx.createSelectorQuery().selectViewport().scrollOffset().exec((scrollRes) => {
          if (scrollRes && scrollRes[0]) {
            const scrollTop = scrollRes[0].scrollTop;
            const rectTop = this.sectionRects[id].top;
            // 计算区块相对于页面顶部的位置
            const sectionTop = scrollTop + rectTop;
            this.sectionTopPositions[sections.indexOf(id)] = sectionTop;
          }
        });
      }
    });
  },

  /**
   * 更新当前活跃的区块
   */
  updateActiveSection(scrollTop) {
    if (!this.sectionTopPositions || this.sectionTopPositions.length === 0) {
      return;
    }

    const offset = 100; // 调整偏移量，更适合顶部区块检测
    let activeSection = '';
    const sections = ['about', 'statistics', 'cloud', 'data', 'profile'];

    // 遍历区块位置，找到当前滚动到的区块
    for (let i = 0; i < this.sectionTopPositions.length; i++) {
      const sectionTop = this.sectionTopPositions[i];
      // 当滚动距离超过当前区块顶部，且未超过下一个区块顶部时，选中当前导航
      if (
        scrollTop >= sectionTop - offset 
        && (i === this.sectionTopPositions.length - 1 || scrollTop < this.sectionTopPositions[i + 1] - offset)
      ) {
        activeSection = sections[i];
        break;
      }
    }

    // 特殊处理：如果滚动位置在页面顶部附近，选中第一个区块
    if (!activeSection && scrollTop < 100) {
      activeSection = sections[0];
    }

    // 只有当找到明确的活跃区块时才更新，避免滚动过程中的闪烁
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
        // 计算需要滚动的位置，使板块顶部（包括标题）完全显示
        // 留一点顶部空隙
        const scrollTop = scrollOffset.scrollTop + rect.top - 80;
        wx.pageScrollTo({
          scrollTop: scrollTop > 0 ? scrollTop : 0,
          duration: 300,
          success: () => {
            // 滚动完成后，重新计算区块位置
            setTimeout(() => {
              this.updateSectionRects();
            }, 350);
          }
        });
      }
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
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
});
