// @ts-nocheck
'use strict';
const JSZip = require('./jszip.min.js') as any;
const { calculateHash } = require('./encrypt.js') as { calculateHash: (data: string) => string };

interface DataTypeInfo {
  id: string;
  name: string;
}

interface ExportResult {
  filePath: string;
  fileName: string;
}

interface ShiftExportEntry {
  workHours?: string | number;
  type?: string;
  [key: string]: unknown;
}

interface ShiftsExportData {
  [date: string]: ShiftExportEntry;
}

interface ExportData {
  shiftTemplates?: unknown[];
  shifts?: ShiftsExportData;
  statistics?: {
    totalHours: string;
    totalDays: number;
    workDays: number;
    offDays: number;
  };
}

interface ImageData {
  id?: string;
  name: string;
  path: string;
  addedTime?: string;
  hash?: string;
}

interface ImageRelationEntry {
  name: string;
  path: string;
  hash?: string;
  addedTime?: string;
}

interface ImageWeekRelation {
  [weekKey: string]: ImageRelationEntry[];
}

interface ExportedFileInfo {
  exportedFilePath: string;
  exportedFileName: string;
  exportedTemplateFilePath: string;
  exportedTemplateFileName: string;
}

class DataExportManager {
  exportedFilePath: string;
  exportedFileName: string;
  exportedTemplateFilePath: string;
  exportedTemplateFileName: string;

  constructor() {
    this.exportedFilePath = '';
    this.exportedFileName = '';
    this.exportedTemplateFilePath = '';
    this.exportedTemplateFileName = '';
  }

  generateDefaultFileName(username: string, selectedDataTypes: string[], dataTypes: DataTypeInfo[]): string {
    const currentDate: string = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/[\/\s:]/g, '-');

    const allDataTypes: string[] = dataTypes.map(type => type.id);
    const isAllSelected: boolean = selectedDataTypes.length === allDataTypes.length &&
      selectedDataTypes.every(type => allDataTypes.includes(type));

    if (isAllSelected) {
      return `${username}+备份+${currentDate}`;
    } else {
      const dataTypeNames: string = dataTypes
        .filter(type => selectedDataTypes.includes(type.id))
        .map(type => type.name)
        .join('+');

      const currentTime: string = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/[\/\s:]/g, '-');

      return `${username}+${dataTypeNames}+${currentTime}`;
    }
  }

  exportSelectedData(selectedDataTypes: string[], customFileName: string, callback?: (result: ExportResult | null) => void): void {
    wx.showLoading({
      title: '正在导出...'
    });

    try {
      const data: ExportData = {};

      if (selectedDataTypes.includes('shiftTemplates')) {
        data.shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      }

      if (selectedDataTypes.includes('shifts')) {
        data.shifts = wx.getStorageSync('shifts') || {};
      }

      if (data.shifts) {
        let totalHours: number = 0;
        let workDays: number = 0;
        let offDays: number = 0;
        let totalDays: number = 0;

        Object.keys(data.shifts).forEach(date => {
          const shift: ShiftExportEntry = (data.shifts as ShiftsExportData)[date];
          totalHours += parseFloat(String(shift.workHours)) || 0;
          totalDays++;

          const shiftType: string | undefined = shift.type;
          if (shiftType === '白天班' || shiftType === '跨夜班') {
            workDays++;
          } else if (shiftType === '休息日') {
            offDays++;
          }
        });

        data.statistics = {
          totalHours: totalHours.toFixed(1),
          totalDays: totalDays,
          workDays: workDays,
          offDays: offDays
        };
      }

      const isDataEmpty: boolean = Object.keys(data).length === 0 ||
        (Object.keys(data).length === 1 && data.shiftTemplates && (data.shiftTemplates as unknown[]).length === 0) ||
        (Object.keys(data).length === 1 && data.shifts && Object.keys(data.shifts).length === 0);

      if (isDataEmpty) {
        wx.hideLoading();
        wx.showToast({
          title: '没有数据可导出',
          icon: 'none'
        });
        if (callback) callback(null);
        return;
      }

      const fileName: string = customFileName;
      const fs: WechatMiniprogram.FileSystemManager = wx.getFileSystemManager();

      const includeImages: boolean = selectedDataTypes.includes('scheduleImages');

      if (includeImages) {
        this.exportAsZip(fileName, data, selectedDataTypes, callback);
      } else {
        const jsonData: string = JSON.stringify(data, null, 2);
        const filePath: string = `${wx.env.USER_DATA_PATH}/${fileName}.json`;

        if (!jsonData || jsonData === '{}') {
          wx.hideLoading();
          wx.showToast({
            title: '没有数据可导出',
            icon: 'none'
          });
          if (callback) callback(null);
          return;
        }

        fs.writeFile({
          filePath: filePath,
          data: jsonData,
          encoding: 'utf8',
          success: () => {
            wx.hideLoading();
            this.exportedFilePath = filePath;
            this.exportedFileName = fileName;

            wx.showModal({
              title: '导出成功',
              content: '数据已导出为JSON文件，请点击下方"分享数据"按钮将文件发送给好友',
              showCancel: false,
              confirmText: '知道了'
            });

            if (callback) callback({ filePath, fileName });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({
              title: '导出失败',
              icon: 'none'
            });
            if (callback) callback(null);
          }
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('导出数据失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
      if (callback) callback(null);
    }
  }

  exportAsZip(fileName: string, data: ExportData, selectedDataTypes: string[], callback?: (result: ExportResult | null) => void): void {
    try {
      const zip = new JSZip();

      if (selectedDataTypes.includes('shiftTemplates') && data.shiftTemplates) {
        zip.file('班次模板.json', JSON.stringify({ data: data.shiftTemplates }, null, 2));
      }

      if (selectedDataTypes.includes('shifts') && data.shifts) {
        zip.file('排班数据.json', JSON.stringify({ shifts: data.shifts, statistics: data.statistics }, null, 2));
      }

      if (selectedDataTypes.includes('scheduleImages')) {
        const fs: WechatMiniprogram.FileSystemManager = wx.getFileSystemManager();
        const imagePromises: Array<Promise<void>> = [];
        const processedImages: Set<string> = new Set();
        const validWeekImageKeys: string[] = [];

        const storageInfo = wx.getStorageInfoSync();
        const weekImageKeys: string[] = storageInfo.keys.filter(key => key.startsWith('week_images_'));

        weekImageKeys.forEach(key => {
          const weekImages: ImageData[] = wx.getStorageSync(key) || [];
          const validWeekImages: ImageData[] = weekImages.filter(image => {
            return image && image.name !== '0' && image.path;
          });

          if (validWeekImages.length > 0) {
            validWeekImageKeys.push(key);

            validWeekImages.forEach((image, index) => {
              const imageKey: string = `${key}_${image.name}_${image.path}`;

              if (!processedImages.has(imageKey)) {
                processedImages.add(imageKey);

                const promise: Promise<void> = new Promise((resolve) => {
                  try {
                    fs.readFile({
                      filePath: image.path,
                      success: (res: WechatMiniprogram.ReadFileSuccessCallbackResult) => {
                        const weekKey: string = key.replace('week_images_', '');
                        let yearMonth: string;
                        try {
                          const weekDate: Date = new Date(weekKey);
                          if (!isNaN(weekDate.getTime())) {
                            const year: number = weekDate.getFullYear();
                            const month: string = String(weekDate.getMonth() + 1).padStart(2, '0');
                            yearMonth = `${year}-${month}`;
                          } else {
                            const currentDate: Date = new Date();
                            const year: number = currentDate.getFullYear();
                            const month: string = String(currentDate.getMonth() + 1).padStart(2, '0');
                            yearMonth = `${year}-${month}`;
                          }
                        } catch (e) {
                          const currentDate: Date = new Date();
                          const year: number = currentDate.getFullYear();
                          const month: string = String(currentDate.getMonth() + 1).padStart(2, '0');
                          yearMonth = `${year}-${month}`;
                        }

                        const imageName: string = image.name || `image_${index}.jpg`;
                        const imageFileName: string = `images/${yearMonth}/${imageName}`;

                        zip.file(imageFileName, res.data);
                        resolve();
                      },
                      fail: () => {
                        resolve();
                      }
                    });
                  } catch (e) {
                    resolve();
                  }
                });
                imagePromises.push(promise);
              }
            });
          }
        });

        Promise.all(imagePromises).then(() => {
          const imageWeekRelation: ImageWeekRelation = {};
          validWeekImageKeys.forEach(key => {
            const weekImages: ImageData[] = wx.getStorageSync(key) || [];
            const validWeekImages: ImageData[] = weekImages.filter(image => {
              return image && image.name !== '0' && image.path;
            });

            imageWeekRelation[key] = [];
            validWeekImages.forEach((image, index) => {
              const weekKey: string = key.replace('week_images_', '');
              let yearMonth: string;
              try {
                const weekDate: Date = new Date(weekKey);
                if (!isNaN(weekDate.getTime())) {
                  const year: number = weekDate.getFullYear();
                  const month: string = String(weekDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                } else {
                  const currentDate: Date = new Date();
                  const year: number = currentDate.getFullYear();
                  const month: string = String(currentDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                }
              } catch (e) {
                const currentDate: Date = new Date();
                const year: number = currentDate.getFullYear();
                const month: string = String(currentDate.getMonth() + 1).padStart(2, '0');
                yearMonth = `${year}-${month}`;
              }

              const imageName: string = image.name || `image_${index}.jpg`;
              const imagePath: string = `images/${yearMonth}/${imageName}`;

              let imageHash: string | undefined = image.hash;
              if (!imageHash) {
                try {
                  const fileInfo = fs.getFileInfoSync({ filePath: image.path });
                  imageHash = calculateHash(`${image.addedTime || Date.now()}_${key}_${imageName}_${fileInfo.size}`);
                } catch (e) {
                  imageHash = calculateHash(`${Date.now()}_${key}_${imageName}`);
                }
              }

              imageWeekRelation[key].push({
                name: imageName,
                path: imagePath,
                hash: imageHash,
                addedTime: image.addedTime || new Date().toISOString()
              });
            });
          });

          zip.file('图片周关联表.json', JSON.stringify(imageWeekRelation, null, 2));

          this.generateZipFile(zip, fileName, callback);
        });
      } else {
        this.generateZipFile(zip, fileName, callback);
      }
    } catch (e) {
      wx.hideLoading();
      console.error('导出ZIP失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
      if (callback) callback(null);
    }
  }

  generateZipFile(zip: { generateAsync: (opts: { type: string }) => Promise<{ byteLength: number } | ArrayBuffer> }, fileName: string, callback?: (result: ExportResult | null) => void): void {
    zip.generateAsync({ type: 'arraybuffer' }).then((content) => {
      if (!content || (content as { byteLength: number }).byteLength === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '没有数据可导出',
          icon: 'none'
        });
        if (callback) callback(null);
        return;
      }

      const filePath: string = `${wx.env.USER_DATA_PATH}/${fileName}.zip`;
      const fs: WechatMiniprogram.FileSystemManager = wx.getFileSystemManager();

      fs.writeFile({
        filePath: filePath,
        data: content as ArrayBuffer,
        success: () => {
          wx.hideLoading();
          this.exportedFilePath = filePath;
          this.exportedFileName = fileName;

          wx.showModal({
            title: '导出成功',
            content: '数据已导出为ZIP文件，请点击下方"分享数据"按钮将文件发送给好友',
            showCancel: false,
            confirmText: '知道了'
          });

          if (callback) callback({ filePath, fileName });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({
            title: '导出失败',
            icon: 'none'
          });
          if (callback) callback(null);
        }
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
      if (callback) callback(null);
    });
  }

  shareExportedFile(): void {
    if (this.exportedFilePath && this.exportedFileName) {
      this.shareFile(this.exportedFilePath, this.exportedFileName);
    } else {
      wx.showToast({
        title: '请先导出数据',
        icon: 'none'
      });
    }
  }

  shareTemplate(): void {
    if (this.exportedTemplateFilePath && this.exportedTemplateFileName) {
      this.shareFile(this.exportedTemplateFilePath, this.exportedTemplateFileName);
    } else {
      wx.showToast({
        title: '请先导出模板',
        icon: 'none'
      });
    }
  }

  shareFile(filePath: string, fileName: string): void {
    if (wx.shareFileMessage) {
      const extension: string = filePath.endsWith('.zip') ? '.zip' : '.json';

      wx.shareFileMessage({
        filePath: filePath,
        fileName: `${fileName}${extension}`,
        success: () => {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: () => {
          wx.showToast({
            title: '分享失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showModal({
        title: '提示',
        content: '当前微信版本不支持直接分享文件，您可以手动发送文件给好友。文件已保存到本地。',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  }

  getExportedFileInfo(): ExportedFileInfo {
    return {
      exportedFilePath: this.exportedFilePath,
      exportedFileName: this.exportedFileName,
      exportedTemplateFilePath: this.exportedTemplateFilePath,
      exportedTemplateFileName: this.exportedTemplateFileName
    };
  }

  setExportedFileInfo(info: Partial<ExportedFileInfo>): void {
    if (info.exportedFilePath) this.exportedFilePath = info.exportedFilePath;
    if (info.exportedFileName) this.exportedFileName = info.exportedFileName;
    if (info.exportedTemplateFilePath) this.exportedTemplateFilePath = info.exportedTemplateFilePath;
    if (info.exportedTemplateFileName) this.exportedTemplateFileName = info.exportedTemplateFileName;
  }
}

module.exports = DataExportManager;

export {};
