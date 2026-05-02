// @ts-nocheck
'use strict';
Page({
  data: {
    scrollToId: '',
    activeSection: ''
  },

  onLoad(options: Record<string, string>): void {
    if (options.type) {
      const typeMap: Record<string, string> = {
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

  onReady(): void {
    if (this.data.scrollToId) {
      setTimeout(() => {
        this.scrollToTarget(this.data.scrollToId);
      }, 100);
    }
  },

  onShow(): void {
    this.startScrollObserver();
  },

  onHide(): void {
    this.stopScrollObserver();
  },

  onUnload(): void {
    this.stopScrollObserver();
  },

  onPullDownRefresh(): void {
    wx.stopPullDownRefresh();
  },

  onReachBottom(): void {},

  onShareAppMessage(): WechatMiniprogram.Page.IShareAppMessageOption {
    return {
      title: 'SY工时记录 - 使用说明',
      path: '/subpkg-common/pages/docs/docs'
    };
  },

  onShareTimeline(): WechatMiniprogram.Page.IShareTimelineOption {
    return {
      title: 'SY工时记录 - 使用说明',
      imageUrl: ''
    };
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption): void {
    const scrollTop = e.scrollTop;
    this.updateActiveSection(scrollTop);
  },

  getNavPosition(): void {},

  startScrollObserver(): void {
    this.updateSectionRects();
    this.getNavPosition();

    setTimeout(() => {
      wx.createSelectorQuery().selectViewport().scrollOffset().exec((res) => {
        if (res && res[0]) {
          this.updateActiveSection((res[0] as WechatMiniprogram.ScrollOffsetCallbackResult).scrollTop);
        }
      });
    }, 100);

    this.observeImageLoad();
  },

  stopScrollObserver(): void {},

  observeImageLoad(): void {
    const query = wx.createSelectorQuery();
    query.selectAll('.step-image').fields({ size: true });
    query.exec((res) => {
      if (res && res[0] && (res[0] as unknown[]).length > 0) {
        setTimeout(() => {
          this.updateSectionRects();
          wx.createSelectorQuery().selectViewport().scrollOffset().exec((scrollRes) => {
            if (scrollRes && scrollRes[0]) {
              this.updateActiveSection((scrollRes[0] as WechatMiniprogram.ScrollOffsetCallbackResult).scrollTop);
            }
          });
        }, 500);
      }
    });
  },

  updateSectionRects(): void {
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
            this.sectionRects[id] = res[index] as WechatMiniprogram.BoundingClientRectResult;
          }
        });
        this.calcSectionTopPositions();
      }
    });
  },

  calcSectionTopPositions(): void {
    this.sectionTopPositions = [];
    const sections = ['section-about', 'section-statistics', 'section-cloud', 'section-data', 'section-profile'];

    sections.forEach((_id, index) => {
      wx.createSelectorQuery().selectViewport().scrollOffset().exec((scrollRes) => {
        if (scrollRes && scrollRes[0]) {
          const scrollTop = (scrollRes[0] as WechatMiniprogram.ScrollOffsetCallbackResult).scrollTop;
          const id = sections[index];
          if (this.sectionRects[id]) {
            const rectTop = this.sectionRects[id].top;
            const sectionTop = scrollTop + rectTop;
            this.sectionTopPositions[index] = sectionTop;
          }
        }
      });
    });
  },

  updateActiveSection(scrollTop: number): void {
    if (!this.sectionTopPositions || this.sectionTopPositions.length === 0) {
      return;
    }

    const offset = 100;
    let activeSection = '';
    const sections = ['about', 'statistics', 'cloud', 'data', 'profile'];

    for (let i = 0; i < this.sectionTopPositions.length; i++) {
      const sectionTop = this.sectionTopPositions[i];
      if (
        scrollTop >= sectionTop - offset
        && (i === this.sectionTopPositions.length - 1 || scrollTop < this.sectionTopPositions[i + 1] - offset)
      ) {
        activeSection = sections[i];
        break;
      }
    }

    if (!activeSection && scrollTop < 100) {
      activeSection = sections[0];
    }

    if (activeSection && this.data.activeSection !== activeSection) {
      this.setData({ activeSection });
    }
  },

  scrollToSection(e: WechatMiniprogram.TouchEvent): void {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;

    const sectionType = id.replace('section-', '');
    this.setData({ activeSection: sectionType });

    this.scrollToTarget(id);
  },

  scrollToTarget(targetId: string): void {
    const query = wx.createSelectorQuery();
    query.select('#' + targetId).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      if (res[0] && res[1]) {
        const rect = res[0] as WechatMiniprogram.BoundingClientRectResult;
        const scrollOffset = (res[1] as WechatMiniprogram.ScrollOffsetCallbackResult).scrollTop;
        const scrollTop = scrollOffset + rect.top - 80;
        wx.pageScrollTo({
          scrollTop: scrollTop > 0 ? scrollTop : 0,
          duration: 300,
          success: () => {
            setTimeout(() => {
              this.updateSectionRects();
            }, 350);
          }
        });
      }
    });
  },

  previewImage(e: WechatMiniprogram.TouchEvent): void {
    const current = (e.currentTarget.dataset as { src: string }).src;
    const urls = [
      '/pages/profile/first.png',
      '/pages/profile/second.png'
    ];
    wx.previewImage({
      current: current,
      urls: urls
    });
  },

  goBack(): void {
    wx.navigateBack({ delta: 1 });
  }
});
