// pages/docs/docs.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    scrollToId: '',
    activeSection: '',
    showBackToTop: false,
    isNavFixed: false
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

    // 控制导航栏固定/不固定
    this.updateNavFixedState(scrollTop);

    // 更新当前活跃的区块
    this.updateActiveSection(scrollTop);
  },

  /**
   * 更新导航栏固定状态
   */
  updateNavFixedState(scrollTop) {
    if (!this.navTop) {
      // 首次获取导航栏位置
      this.getNavPosition();
      return;
    }

    // 当滚动距离超过导航栏顶部位置时，固定导航栏
    const shouldFix = scrollTop > this.navTop;
    if (this.data.isNavFixed !== shouldFix) {
      this.setData({ isNavFixed: shouldFix });
    }
  },

  /**
   * 获取导航栏位置信息
   */
  getNavPosition() {
    const query = wx.createSelectorQuery();
    query.select('.weui-navbar').boundingClientRect();
    query.exec((res) => {
      if (res && res[0]) {
        this.navTop = res[0].top;
      }
    });
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
    const sections = ['section-about', 'section-statistics', 'section-cloud', 'section-data'];
    
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
    const sections = ['section-about', 'section-statistics', 'section-cloud', 'section-data'];
    
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
    const sections = ['about', 'statistics', 'cloud', 'data'];

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
    query.select('.weui-navbar').boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      if (res[0] && res[1] && res[2]) {
        const rect = res[0];
        const navRect = res[1];
        const scrollOffset = res[2];
        // 计算需要滚动的位置，使板块顶部（包括标题）完全显示在导航栏下方
        // 在板块上边界与导航栏下边界之间留一点空隙
        const scrollTop = scrollOffset.scrollTop + rect.top - (navRect.top + navRect.height + 40);
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
   * 返回顶部
   */
  backToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300,
      success: () => {
        // 滚动完成后，更新活跃区块为第一个
        setTimeout(() => {
          this.setData({ activeSection: 'about' });
          // 重新计算区块位置
          this.updateSectionRects();
        }, 350);
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
