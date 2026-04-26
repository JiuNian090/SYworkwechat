'use strict';
Component({
  properties: {
    presetColors: {
      type: Array,
      value: ['#07c160', '#faad14', '#1890ff', '#ff4d4f', '#722ed1', '#13c2c2']
    },
    colorNames: {
      type: Object,
      value: {}
    },
    value: {
      type: String,
      value: '#07c160',
      observer: 'onValueChange'
    }
  },

  data: {
    selectedColorType: 'preset',
    showPicker: false,
    pickerHue: 120,
    pickerSaturation: 100,
    pickerBrightness: 50,
    pickerColor: '#34d399',
    pickerHueColor: '#34d399',
    customColor: ''
  },

  methods: {
    onValueChange(newVal) {
      const isPreset = this.properties.presetColors.indexOf(newVal) >= 0;
      const hsv = this.hexToHsv(newVal);
      const hueColor = this.hsvToHex(hsv.h, 100, 100);
      this.setData({
        selectedColorType: isPreset ? 'preset' : 'custom',
        pickerHue: hsv.h,
        pickerSaturation: hsv.s,
        pickerBrightness: hsv.v,
        pickerColor: newVal,
        pickerHueColor: hueColor,
        customColor: isPreset ? '' : newVal
      });
    },

    selectPresetColor(e) {
      const color = e.currentTarget.dataset.color;
      this.setData({
        selectedColorType: 'preset'
      });
      this.triggerEvent('change', { color, type: 'preset' });
    },

    openPicker() {
      const currentColor = this.properties.value;
      const hsv = this.hexToHsv(currentColor);
      const hueColor = this.hsvToHex(hsv.h, 100, 100);
      this.setData({
        showPicker: true,
        selectedColorType: 'custom',
        pickerHue: hsv.h,
        pickerSaturation: hsv.s,
        pickerBrightness: hsv.v,
        pickerColor: currentColor,
        pickerHueColor: hueColor
      });
      this.cachePickerRects();
    },

    cancelPicker() {
      this.setData({ showPicker: false });
    },

    confirmPicker() {
      const color = this.data.pickerColor;
      this.setData({
        showPicker: false,
        customColor: color
      });
      this.triggerEvent('change', { color, type: 'custom' });
    },

    cachePickerRects() {
      setTimeout(() => {
        try {
          const query = this.createSelectorQuery();
          query.select('.palette-area').boundingClientRect();
          query.select('.hue-slider').boundingClientRect();
          query.exec((res) => {
            if (res[0]) this._paletteRect = res[0];
            if (res[1]) this._hueSliderRect = res[1];
          });
        } catch (e) {}
      }, 300);
    },

    onPaletteTouchStart(e) {
      this.updatePaletteColor(e);
    },

    onPaletteTouchMove(e) {
      if (this._paletteMoveTimer) return;
      this._paletteMoveTimer = setTimeout(() => {
        this._paletteMoveTimer = null;
        this.updatePaletteColor(e);
      }, 10);
    },

    onPaletteTouchEnd() {},

    updatePaletteColor(e) {
      if (!this._paletteRect || !this._paletteRect.width) {
        this.cachePickerRects();
        return;
      }
      const touch = e.touches[0];
      const rect = this._paletteRect;
      const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, touch.clientY - rect.top));
      const saturation = Math.round((x / rect.width) * 100);
      const brightness = Math.round((1 - y / rect.height) * 100);
      const color = this.hsvToHex(this.data.pickerHue, saturation, brightness);
      this.setData({
        pickerSaturation: saturation,
        pickerBrightness: brightness,
        pickerColor: color
      });
    },

    onHueSliderTouchStart(e) {
      this.updateHueFromTouch(e);
    },

    onHueSliderTouchMove(e) {
      if (this._hueMoveTimer) return;
      this._hueMoveTimer = setTimeout(() => {
        this._hueMoveTimer = null;
        this.updateHueFromTouch(e);
      }, 10);
    },

    onHueSliderTouchEnd() {},

    updateHueFromTouch(e) {
      if (!this._hueSliderRect || !this._hueSliderRect.width) return;
      const touch = e.touches[0];
      const rect = this._hueSliderRect;
      const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
      const hue = Math.round((x / rect.width) * 360);
      const hueColor = this.hsvToHex(hue, 100, 100);
      const color = this.hsvToHex(hue, this.data.pickerSaturation, this.data.pickerBrightness);
      this.setData({
        pickerHue: hue,
        pickerHueColor: hueColor,
        pickerColor: color
      });
    },

    hsvToHex(h, s, v) {
      h = h / 360;
      s = s / 100;
      v = v / 100;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      let r, g, b;
      switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
      }
      const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    hexToHsv(hex) {
      if (!hex || hex.length < 7) return { h: 0, s: 0, v: 0 };
      const rgb = hex.replace('#', '');
      const r = parseInt(rgb.substr(0, 2), 16) / 255;
      const g = parseInt(rgb.substr(2, 2), 16) / 255;
      const b = parseInt(rgb.substr(4, 2), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      const s = max === 0 ? 0 : d / max;
      const v = max;
      if (max !== min) {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h = (h / 6) * 360;
      }
      return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
    },

    isLightColor(hexColor) {
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 128;
    },

    preventBubble() {}
  }
});
