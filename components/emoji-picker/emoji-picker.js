'use strict';
const emojiManager = require('../../utils/emojiManager.js');

Component({
  properties: {
    emojiCategories: {
      type: Array,
      value: []
    },
    currentCategory: {
      type: String,
      value: 'face'
    },
    selectedEmoji: {
      type: String,
      value: ''
    }
  },

  data: {
    innerCategory: 'face',
    innerEmoji: '',
    currentCategoryEmojis: []
  },

  attached() {
    const category = this.properties.currentCategory || 'face';
    this.setData({
      innerCategory: category,
      innerEmoji: this.properties.selectedEmoji || '',
      currentCategoryEmojis: emojiManager.getCategoryEmojis(category)
    });
  },

  methods: {
    switchEmojiCategory(e) {
      const categoryId = e.currentTarget.dataset.category;
      this.setData({
        innerCategory: categoryId,
        currentCategoryEmojis: emojiManager.getCategoryEmojis(categoryId)
      });
      this.triggerEvent('categorychange', { category: categoryId });
    },

    selectEmoji(e) {
      const emoji = e.currentTarget.dataset.emoji;
      this.setData({ innerEmoji: emoji });
      this.triggerEvent('select', { emoji });
    },

    getEmojiText(emoji) {
      return emojiManager.getEmojiText(emoji) || '';
    },

    confirmEmoji() {
      this.triggerEvent('confirm', {
        emoji: this.data.innerEmoji
      });
    }
  }
});
