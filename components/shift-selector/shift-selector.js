'use strict';
Component({
  properties: {
    shiftTemplates: {
      type: Array,
      value: []
    },
    selectedDate: {
      type: String,
      value: ''
    },
    visible: {
      type: Boolean,
      value: false
    },
    selectedIndex: {
      type: Number,
      value: -1,
      observer: 'onSelectedIndexChange'
    },
    currentTag: {
      type: String,
      value: ''
    }
  },

  data: {
    innerSelectedIndex: -1
  },

  methods: {
    onSelectedIndexChange(newVal) {
      this.setData({
        innerSelectedIndex: newVal
      });
    },

    onShiftSelect(e) {
      const index = e.currentTarget.dataset.index;
      const { innerSelectedIndex } = this.data;

      if (innerSelectedIndex === index) {
        this.setData({ innerSelectedIndex: -1 });
      } else {
        this.setData({ innerSelectedIndex: index });
      }
    },

    onConfirm() {
      this.triggerEvent('confirm', {
        index: this.data.innerSelectedIndex,
        template: this.data.innerSelectedIndex >= 0 ? this.properties.shiftTemplates[this.data.innerSelectedIndex] : null
      });
    },

    onCancel() {
      this.triggerEvent('cancel');
    },

    onTagTap() {
      this.triggerEvent('tagtap');
    }
  }
});
