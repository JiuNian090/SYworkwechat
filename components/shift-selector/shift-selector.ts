'use strict';

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  hours?: number;
}

interface ShiftConfirmEvent {
  index: number;
  template: ShiftTemplate | null;
}

Component({
  properties: {
    shiftTemplates: {
      type: Array,
      value: [] as ShiftTemplate[]
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
      observer: 'onSelectedIndexChange' as unknown as string
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
    onSelectedIndexChange(newVal: number): void {
      this.setData({
        innerSelectedIndex: newVal
      });
    },

    onShiftSelect(e: WechatMiniprogram.TouchEvent): void {
      const index = (e.currentTarget.dataset as { index: number }).index;
      const { innerSelectedIndex } = this.data as { innerSelectedIndex: number };

      if (innerSelectedIndex === index) {
        this.setData({ innerSelectedIndex: -1 });
      } else {
        this.setData({ innerSelectedIndex: index });
      }
    },

    onConfirm(): void {
      const data = this.data as { innerSelectedIndex: number };
      const shiftTemplates = this.properties.shiftTemplates as ShiftTemplate[];
      this.triggerEvent('confirm', {
        index: data.innerSelectedIndex,
        template: data.innerSelectedIndex >= 0 ? shiftTemplates[data.innerSelectedIndex] : null
      } as ShiftConfirmEvent);
    },

    onCancel(): void {
      this.triggerEvent('cancel');
    },

    onTagTap(): void {
      this.triggerEvent('tagtap');
    }
  }
});

export {};
