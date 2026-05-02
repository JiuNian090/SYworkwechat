// @ts-nocheck
'use strict';
const JSZip = require('./jszip.min.js') as any;

type ImportCallback = (success: boolean) => void;

interface ImageData {
  id?: string;
  name: string;
  path: string;
  addedTime?: string;
  hash?: string;
}

interface WeekImageRelation {
  [weekKey: string]: Array<{
    name: string;
    path: string;
    hash?: string;
    addedTime?: string;
  }>;
}

interface ImportData {
  shiftTemplates: unknown[];
  shifts: Record<string, unknown>;
  customWeeklyHours: number;
}

class DataImportManager {
  constructor() {
  }

  importData(callback?: ImportCallback): void {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'zip'],
      success: (res: WechatMiniprogram.ChooseMessageFileSuccessCallbackResult) => {
        const fileName: string = res.tempFiles[0].name;
        const filePath: string = res.tempFiles[0].path;

        wx.showLoading({
          title: '正在导入...'
        });

        if (fileName.toLowerCase().endsWith('.zip')) {
          this.importFromZip(filePath, callback);
        } else if (fileName.toLowerCase().endsWith('.json')) {
          this.importFromJson(filePath, callback);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '请选择JSON或ZIP格式文件',
            icon: 'none'
          });
          if (callback) callback(false);
        }
      },
      fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '选择文件失败',
            icon: 'none'
          });
          if (callback) callback(false);
        }
      }
    });
  }

  importFromJson(filePath: string, callback?: ImportCallback): void {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'utf-8',
      success: (readRes: WechatMiniprogram.ReadFileSuccessCallbackResult) => {
        try {
          const data: Record<string, unknown> = JSON.parse(readRes.data as string);

          const fileName: string = filePath.split('/').pop() || '';
          let importSuccess: boolean = false;

          if (fileName === '班次模板.json') {
            const shiftTemplatesData: unknown = (data as Record<string, unknown>).data || (data as Record<string, unknown>).shiftTemplates;
            if (Array.isArray(shiftTemplatesData)) {
              wx.setStorageSync('shiftTemplates', shiftTemplatesData);
              importSuccess = true;
            } else {
              throw new Error('班次模板数据格式不正确');
            }
          }
          else if (fileName === '排班数据.json') {
            const shiftsData: unknown = (data as Record<string, unknown>).shifts;
            if (shiftsData && typeof shiftsData === 'object') {
              wx.setStorageSync('shifts', shiftsData);
              if ((data as Record<string, unknown>).customWeeklyHours !== undefined) {
                wx.setStorageSync('customWeeklyHours', (data as Record<string, unknown>).customWeeklyHours);
              }
              importSuccess = true;
            } else {
              throw new Error('排班数据格式不正确');
            }
          }
          else {
            if (!data.hasOwnProperty('shiftTemplates') || !data.hasOwnProperty('shifts')) {
              throw new Error('数据格式不正确');
            }

            if (data.shiftTemplates) {
              wx.setStorageSync('shiftTemplates', data.shiftTemplates);
            }
            if (data.shifts) {
              wx.setStorageSync('shifts', data.shifts);
            }
            if (data.customWeeklyHours !== undefined) {
              wx.setStorageSync('customWeeklyHours', data.customWeeklyHours);
            }
            importSuccess = true;
          }

          if (importSuccess) {
            this.finishImport(callback);
          }
        } catch (e) {
          wx.hideLoading();
          console.error('解析数据失败', e);
          wx.showToast({
            title: '数据格式错误',
            icon: 'none'
          });
          if (callback) callback(false);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
        if (callback) callback(false);
      }
    });
  }

  importFromZip(filePath: string, callback?: ImportCallback): void {
    const fs: WechatMiniprogram.FileSystemManager = wx.getFileSystemManager();

    fs.readFile({
      filePath: filePath,
      success: (readRes: WechatMiniprogram.ReadFileSuccessCallbackResult) => {
        try {
          const zip = new JSZip();

          zip.loadAsync(readRes.data).then((zip: {
            file: (name: string) => { async: (type: string) => Promise<string> } | null;
            folder: (name: string) => {
              forEach: (callback: (relativePath: string, file: {
                dir: boolean;
                async: (type: string) => Promise<ArrayBuffer>;
              }) => void) => void;
              folder: (relativePath: string) => {
                forEach: (callback: (relativePath: string, file: {
                  dir: boolean;
                  async: (type: string) => Promise<ArrayBuffer>;
                }) => void) => void;
                folder: (name: string) => unknown;
              } | null;
            } | null;
          }) => {
            const shiftTemplatesFile = zip.file('班次模板.json');
            const shiftsFile = zip.file('排班数据.json');
            const dataJsonFile = zip.file('data.json');

            const importData: ImportData = {
              shiftTemplates: [],
              shifts: {},
              customWeeklyHours: 35
            };

            const processShiftTemplates = (): Promise<void> => {
              return new Promise((resolve) => {
                if (shiftTemplatesFile) {
                  shiftTemplatesFile.async('string').then((jsonStr: string) => {
                    try {
                      const data: { data?: unknown[] } = JSON.parse(jsonStr);
                      if (data.data) {
                        importData.shiftTemplates = data.data;
                      }
                    } catch (e) {
                      console.error('解析班次模板.json失败', e);
                    }
                    resolve();
                  }).catch(() => {
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };

            const processShifts = (): Promise<void> => {
              return new Promise((resolve) => {
                if (shiftsFile) {
                  shiftsFile.async('string').then((jsonStr: string) => {
                    try {
                      const data: { shifts?: Record<string, unknown>; customWeeklyHours?: number } = JSON.parse(jsonStr);
                      if (data.shifts) {
                        importData.shifts = data.shifts;
                      }
                      if (data.customWeeklyHours !== undefined) {
                        importData.customWeeklyHours = data.customWeeklyHours;
                      }
                    } catch (e) {
                      console.error('解析排班数据.json失败', e);
                    }
                    resolve();
                  }).catch(() => {
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };

            const processDataJson = (): Promise<void> => {
              return new Promise((resolve) => {
                if (dataJsonFile && (!shiftTemplatesFile || !shiftsFile)) {
                  dataJsonFile.async('string').then((jsonStr: string) => {
                    try {
                      const data: { shiftTemplates?: unknown[]; shifts?: Record<string, unknown>; customWeeklyHours?: number } = JSON.parse(jsonStr);
                      if (data.shiftTemplates) {
                        importData.shiftTemplates = data.shiftTemplates;
                      }
                      if (data.shifts) {
                        importData.shifts = data.shifts;
                      }
                      if (data.customWeeklyHours !== undefined) {
                        importData.customWeeklyHours = data.customWeeklyHours;
                      }
                    } catch (e) {
                      console.error('解析data.json失败', e);
                    }
                    resolve();
                  }).catch(() => {
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };

            const imageRelationFile = zip.file('图片周关联表.json');

            let imageWeekRelation: WeekImageRelation = {};

            const processImageRelation = (): Promise<void> => {
              return new Promise((resolve) => {
                if (imageRelationFile) {
                  imageRelationFile.async('string').then((jsonStr: string) => {
                    try {
                      imageWeekRelation = JSON.parse(jsonStr);
                    } catch (e) {
                      console.error('解析图片周关联表.json失败', e);
                    }
                    resolve();
                  }).catch(() => {
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };

            Promise.all([
              processShiftTemplates(),
              processShifts(),
              processDataJson(),
              processImageRelation()
            ]).then(() => {
              if (importData.shiftTemplates.length > 0) {
                wx.setStorageSync('shiftTemplates', importData.shiftTemplates);
              }
              if (Object.keys(importData.shifts).length > 0) {
                wx.setStorageSync('shifts', importData.shifts);
              }
              if (importData.customWeeklyHours !== undefined) {
                wx.setStorageSync('customWeeklyHours', importData.customWeeklyHours);
              }

              const imageDir = zip.folder('images') || zip.folder('image');
              if (imageDir) {
                const imagePromises: Array<Promise<void>> = [];
                const processedImagePaths: Set<string> = new Set();

                const processImageFolder = (folder: {
                  forEach: (callback: (relativePath: string, file: {
                    dir: boolean;
                    async: (type: string) => Promise<ArrayBuffer>;
                  }) => void) => void;
                  folder: (relativePath: string) => {
                    forEach: (callback: (relativePath: string, file: {
                      dir: boolean;
                      async: (type: string) => Promise<ArrayBuffer>;
                    }) => void) => void;
                    folder: (name: string) => unknown;
                  } | null;
                }, basePath: string = ''): void => {
                  folder.forEach((relativePath: string, file: {
                    dir: boolean;
                    async: (type: string) => Promise<ArrayBuffer>;
                  }) => {
                    if (file.dir) {
                      const subFolder = folder.folder(relativePath);
                      if (subFolder) {
                        processImageFolder(subFolder as unknown as {
                          forEach: (callback: (relativePath: string, file: {
                            dir: boolean;
                            async: (type: string) => Promise<ArrayBuffer>;
                          }) => void) => void;
                          folder: (relativePath: string) => unknown;
                        }, `${basePath}${relativePath}/`);
                      }
                    } else {
                      const fullRelativePath: string = basePath ? `${basePath}${relativePath}` : relativePath;

                      const promise: Promise<void> = file.async('arraybuffer').then((content: ArrayBuffer) => {
                        const fileName: string = relativePath.split('/').pop() || '';
                        const tempPath: string = `${wx.env.USER_DATA_PATH}/${Date.now()}_${fileName}`;
                        fs.writeFile({
                          filePath: tempPath,
                          data: content,
                          success: () => {
                            processedImagePaths.add(fullRelativePath);

                            if (Object.keys(imageWeekRelation).length > 0) {
                              let normalizedPath: string = fullRelativePath;
                              if (!normalizedPath.startsWith('images/')) {
                                normalizedPath = `images/${normalizedPath}`;
                              } else if (normalizedPath.startsWith('image/')) {
                                normalizedPath = normalizedPath.replace('image/', 'images/');
                              }

                              for (const weekKey in imageWeekRelation) {
                                if (imageWeekRelation.hasOwnProperty(weekKey)) {
                                  const weekImages: Array<{ name: string; path: string; hash?: string; addedTime?: string }> = imageWeekRelation[weekKey];
                                  const matchingImageIndex: number = weekImages.findIndex(img => img.path === normalizedPath);
                                  if (matchingImageIndex !== -1) {
                                    const existingImages: ImageData[] = wx.getStorageSync(weekKey) || [];

                                    const existingImage: ImageData | undefined = existingImages.find(img => img.name === weekImages[matchingImageIndex].name);

                                    let newImageHash: string | undefined = weekImages[matchingImageIndex].hash;
                                    if (!newImageHash) {
                                      try {
                                        const fileInfo: WechatMiniprogram.GetFileInfoSuccessCallbackResult = fs.getFileInfoSync({ filePath: tempPath });
                                        const addedTime: string | number = weekImages[matchingImageIndex].addedTime || Date.now();
                                        const imageName: string = weekImages[matchingImageIndex].name;

                                        newImageHash = (() => {
                                          let hash = 0;
                                          const data: string = `${addedTime}_${weekKey}_${imageName}_${fileInfo.size}`;
                                          for (let i = 0; i < data.length; i++) {
                                            const char: number = data.charCodeAt(i);
                                            hash = ((hash << 5) - hash) + char;
                                            hash = hash & hash;
                                          }
                                          return hash.toString(16);
                                        })();
                                      } catch (e) {
                                        console.error('获取文件信息失败', e);
                                        newImageHash = (() => {
                                          let hash = 0;
                                          const data: string = `${Date.now()}_${weekKey}_${weekImages[matchingImageIndex].name}`;
                                          for (let i = 0; i < data.length; i++) {
                                            const char: number = data.charCodeAt(i);
                                            hash = ((hash << 5) - hash) + char;
                                            hash = hash & hash;
                                          }
                                          return hash.toString(16);
                                        })();
                                      }
                                    }

                                    if (!existingImage || existingImage.hash !== newImageHash) {
                                      const newImage: ImageData = {
                                        id: Date.now().toString(),
                                        name: weekImages[matchingImageIndex].name,
                                        path: tempPath,
                                        addedTime: weekImages[matchingImageIndex].addedTime || new Date().toISOString(),
                                        hash: newImageHash
                                      };

                                      if (existingImage) {
                                        const index: number = existingImages.findIndex(img => img.name === existingImage.name);
                                        existingImages[index] = newImage;
                                      } else {
                                        existingImages.push(newImage);
                                      }

                                      wx.setStorageSync(weekKey, existingImages);
                                    }

                                    imageWeekRelation[weekKey][matchingImageIndex].path = tempPath;
                                    imageWeekRelation[weekKey][matchingImageIndex].hash = newImageHash;
                                    break;
                                  }
                                }
                              }
                            } else {
                              const fileNameParts: string[] = fileName.split('_');
                              if (fileNameParts.length > 2 && fileNameParts[0] === 'week' && fileNameParts[1] === 'images') {
                                const weekKey: string = fileNameParts.slice(2, -2).join('_');
                                const weekImageKey: string = `week_images_${weekKey}`;

                                const existingImages: ImageData[] = wx.getStorageSync(weekImageKey) || [];

                                let imageHash: string = '0';
                                try {
                                  const fileInfo: WechatMiniprogram.GetFileInfoSuccessCallbackResult = fs.getFileInfoSync({ filePath: tempPath });
                                  imageHash = (() => {
                                    let hash = 0;
                                    const data: string = `${Date.now()}_${weekImageKey}_${fileNameParts.slice(-1)[0].replace('.jpg', '')}_${fileInfo.size}`;
                                    for (let i = 0; i < data.length; i++) {
                                      const char: number = data.charCodeAt(i);
                                      hash = ((hash << 5) - hash) + char;
                                      hash = hash & hash;
                                    }
                                    return hash.toString(16);
                                  })();
                                } catch (e) {
                                  console.error('获取文件信息失败', e);
                                }

                                existingImages.push({
                                  id: Date.now().toString(),
                                  name: fileNameParts.slice(-1)[0].replace('.jpg', ''),
                                  path: tempPath,
                                  addedTime: new Date().toISOString(),
                                  hash: imageHash
                                });

                                wx.setStorageSync(weekImageKey, existingImages);
                              }
                            }
                          },
                          fail: () => {
                            console.error('保存图片失败');
                          }
                        });
                      });
                      imagePromises.push(promise);
                    }
                  });
                };

                processImageFolder(imageDir);

                Promise.all(imagePromises).then(() => {
                  if (Object.keys(imageWeekRelation).length > 0) {
                    const imageRelation = require('./imageRelation') as { rebuildRelationFromLocal: () => void };
                    imageRelation.rebuildRelationFromLocal();
                  }

                  this.finishImport(callback);
                });
              } else {
                  if (Object.keys(imageWeekRelation).length > 0) {
                    const imageRelation = require('./imageRelation') as { rebuildRelationFromLocal: () => void };
                    imageRelation.rebuildRelationFromLocal();
                  }
                  this.finishImport(callback);
                }
            }).catch(() => {
              wx.hideLoading();
              wx.showToast({
                title: '数据格式错误',
                icon: 'none'
              });
              if (callback) callback(false);
            });
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({
              title: '压缩包格式错误',
              icon: 'none'
            });
            if (callback) callback(false);
          });
        } catch (e) {
          wx.hideLoading();
          console.error('导入失败', e);
          wx.showToast({
            title: '导入失败',
            icon: 'none'
          });
          if (callback) callback(false);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
        if (callback) callback(false);
      }
    });
  }

  finishImport(callback?: ImportCallback): void {
    wx.showToast({
      title: '导入成功',
      icon: 'success'
    });

    setTimeout(() => {
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.route === 'pages/plan/plan') {
          if (page.loadShiftTemplates) {
            page.loadShiftTemplates();
          }
        } else if (page.route === 'pages/schedule/schedule') {
          if (page.loadShifts) {
            page.loadShifts();
          }
          if (page.loadShiftTemplates) {
            page.loadShiftTemplates();
          }
          if (page.generateWeekDates) {
            page.generateWeekDates();
          }
          if (page.generateMonthDates) {
            page.generateMonthDates();
          }
          if (page.loadWeekImages) {
            page.loadWeekImages();
          }
        } else if (page.route === 'pages/statistics/statistics') {
          if (page.calculateStatistics) {
            page.calculateStatistics();
          }
        }
      }

      const currentPage = getCurrentPages()[getCurrentPages().length - 1];
      if (currentPage.loadUserData && typeof currentPage.loadUserData === 'function') {
        currentPage.loadUserData();
      }

      wx.hideLoading();

      if (callback) callback(true);
    }, 500);
  }
}

module.exports = DataImportManager;

export {};
