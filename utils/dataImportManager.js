const JSZip = require('./jszip.min.js');

class DataImportManager {
  constructor() {
  }

  // 选择文件进行导入
  importData(callback) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'zip'],
      // 提示用户选择JSON或ZIP文件，提高用户体验
      success: (res) => {
        const fileName = res.tempFiles[0].name;
        const filePath = res.tempFiles[0].path;
        
        wx.showLoading({
          title: '正在导入...'
        });
        
        if (fileName.toLowerCase().endsWith('.zip')) {
          // 处理ZIP文件
          this.importFromZip(filePath, callback);
        } else if (fileName.toLowerCase().endsWith('.json')) {
          // 处理JSON文件
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
      fail: (err) => {
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
  
  // 从JSON文件导入
  importFromJson(filePath, callback) {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'utf-8',
      success: (readRes) => {
        try {
          const data = JSON.parse(readRes.data);
          
          // 获取文件名，判断文件类型
          const fileName = filePath.split('/').pop();
          let importSuccess = false;
          
          // 处理班次模板.json文件
          if (fileName === '班次模板.json') {
            // 验证数据格式
            const shiftTemplatesData = data.data || data.shiftTemplates;
            if (Array.isArray(shiftTemplatesData)) {
              wx.setStorageSync('shiftTemplates', shiftTemplatesData);
              importSuccess = true;
            } else {
              throw new Error('班次模板数据格式不正确');
            }
          }
          // 处理排班数据.json文件
          else if (fileName === '排班数据.json') {
            // 验证数据格式
            const shiftsData = data.shifts;
            if (shiftsData && typeof shiftsData === 'object') {
              wx.setStorageSync('shifts', shiftsData);
              if (data.customWeeklyHours !== undefined) {
                wx.setStorageSync('customWeeklyHours', data.customWeeklyHours);
              }
              importSuccess = true;
            } else {
              throw new Error('排班数据格式不正确');
            }
          }
          // 处理完整备份文件（包含两种数据）
          else {
            // 验证数据格式 - 检查必需的数据结构
            if (!data.hasOwnProperty('shiftTemplates') || !data.hasOwnProperty('shifts')) {
              throw new Error('数据格式不正确');
            }
            
            // 保存数据到本地存储
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
      fail: (err) => {
        wx.hideLoading();
        console.error('读取文件失败', err);
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
        if (callback) callback(false);
      }
    });
  }
  
  // 从ZIP文件导入
  importFromZip(filePath, callback) {
    const fs = wx.getFileSystemManager();
    
    fs.readFile({
      filePath: filePath,
      success: (readRes) => {
        try {
          const zip = new JSZip();
          
          zip.loadAsync(readRes.data).then((zip) => {
            // 检查是否存在班次模板.json文件
            const shiftTemplatesFile = zip.file('班次模板.json');
            // 检查是否存在排班数据.json文件
            const shiftsFile = zip.file('排班数据.json');
            // 检查是否存在旧格式的data.json文件
            const dataJsonFile = zip.file('data.json');
            
            // 用于存储导入的数据
            const importData = {
              shiftTemplates: [],
              shifts: {},
              customWeeklyHours: 35
            };
            
            // 处理班次模板文件
            const processShiftTemplates = () => {
              return new Promise((resolve) => {
                if (shiftTemplatesFile) {
                  shiftTemplatesFile.async('string').then((jsonStr) => {
                    try {
                      const data = JSON.parse(jsonStr);
                      if (data.data) {
                        importData.shiftTemplates = data.data;
                      }
                    } catch (e) {
                      console.error('解析班次模板.json失败', e);
                    }
                    resolve();
                  }).catch((err) => {
                    console.error('读取班次模板.json失败', err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };
            
            // 处理排班数据文件
            const processShifts = () => {
              return new Promise((resolve) => {
                if (shiftsFile) {
                  shiftsFile.async('string').then((jsonStr) => {
                    try {
                      const data = JSON.parse(jsonStr);
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
                  }).catch((err) => {
                    console.error('读取排班数据.json失败', err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };
            
            // 处理旧格式的data.json文件
            const processDataJson = () => {
              return new Promise((resolve) => {
                if (dataJsonFile && (!shiftTemplatesFile || !shiftsFile)) {
                  dataJsonFile.async('string').then((jsonStr) => {
                    try {
                      const data = JSON.parse(jsonStr);
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
                  }).catch((err) => {
                    console.error('读取data.json失败', err);
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            };
            
            // 按顺序处理所有文件
            Promise.all([
              processShiftTemplates(),
              processShifts(),
              processDataJson()
            ]).then(() => {
              // 保存数据到本地存储
              if (importData.shiftTemplates.length > 0) {
                wx.setStorageSync('shiftTemplates', importData.shiftTemplates);
              }
              if (Object.keys(importData.shifts).length > 0) {
                wx.setStorageSync('shifts', importData.shifts);
              }
              if (importData.customWeeklyHours !== undefined) {
                wx.setStorageSync('customWeeklyHours', importData.customWeeklyHours);
              }
              
              // 处理图片文件（兼容新旧路径格式：image/YYYY-MM/ 或 images/）
              const imageDir = zip.folder('image') || zip.folder('images');
              if (imageDir) {
                const imagePromises = [];
                
                // 递归处理图片文件夹中的所有文件
                const processImageFolder = (folder, basePath = '') => {
                  folder.forEach((relativePath, file) => {
                    if (file.dir) {
                      // 如果是子文件夹（如 YYYY-MM），递归处理
                      const subFolder = folder.folder(relativePath);
                      if (subFolder) {
                        processImageFolder(subFolder, `${basePath}${relativePath}/`);
                      }
                    } else {
                      // 处理图片文件
                      const promise = file.async('arraybuffer').then((content) => {
                        // 生成临时图片路径
                        const fileName = relativePath.split('/').pop();
                        const tempPath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${fileName}`;
                        // 写入图片文件
                        fs.writeFile({
                          filePath: tempPath,
                          data: content,
                          success: () => {
                            // 解析图片信息，恢复到对应的周存储
                            // 文件名格式：week_images_{weekKey}_index_name.jpg
                            const fileNameParts = fileName.split('_');
                            if (fileNameParts.length > 2 && fileNameParts[0] === 'week' && fileNameParts[1] === 'images') {
                              const weekKey = fileNameParts.slice(2, -2).join('_');
                              const weekImageKey = `week_images_${weekKey}`;
                              
                              // 获取现有图片数据
                              const existingImages = wx.getStorageSync(weekImageKey) || [];
                              
                              // 添加新图片
                              existingImages.push({
                                id: Date.now().toString(),
                                name: fileNameParts.slice(-1)[0].replace('.jpg', ''),
                                path: tempPath,
                                addedTime: new Date().toISOString()
                              });
                              
                              // 保存图片数据
                              wx.setStorageSync(weekImageKey, existingImages);
                            }
                          },
                          fail: (err) => {
                            console.error('保存图片失败', err);
                          }
                        });
                      });
                      imagePromises.push(promise);
                    }
                  });
                };
                
                processImageFolder(imageDir);
                
                // 等待所有图片处理完成
                Promise.all(imagePromises).then(() => {
                  this.finishImport(callback);
                });
              } else {
                this.finishImport(callback);
              }
            }).catch((err) => {
              wx.hideLoading();
              console.error('解析JSON失败', err);
              wx.showToast({
                title: '数据格式错误',
                icon: 'none'
              });
              if (callback) callback(false);
            });
          }).catch((err) => {
            wx.hideLoading();
            console.error('解压ZIP失败', err);
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
      fail: (err) => {
        wx.hideLoading();
        console.error('读取文件失败', err);
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
        if (callback) callback(false);
      }
    });
  }
  
  // 完成导入，刷新页面数据
  finishImport(callback) {
    wx.showToast({
      title: '导入成功',
      icon: 'success'
    });
    
    // 延迟一段时间确保数据保存完成后再刷新页面
    setTimeout(() => {
      // 刷新所有相关页面数据
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.route === 'pages/plan/plan') {
          // 重新加载班次模板数据
          if (page.loadShiftTemplates) {
            page.loadShiftTemplates();
          }
        } else if (page.route === 'pages/schedule/schedule') {
          // 重新加载排班数据和班次模板
          if (page.loadShifts) {
            page.loadShifts();
          }
          if (page.loadShiftTemplates) {
            page.loadShiftTemplates();
          }
          // 重新生成日期数据
          if (page.generateWeekDates) {
            page.generateWeekDates();
          }
          if (page.generateMonthDates) {
            page.generateMonthDates();
          }
          // 重新加载图片数据
          if (page.loadWeekImages) {
            page.loadWeekImages();
          }
        } else if (page.route === 'pages/statistics/statistics') {
          // 重新计算统计数据
          if (page.calculateStatistics) {
            page.calculateStatistics();
          }
        }
      }
      
      // 如果当前在tab页面，也需要刷新当前页面数据
      const currentPage = getCurrentPages()[getCurrentPages().length - 1];
      if (currentPage.loadUserData && typeof currentPage.loadUserData === 'function') {
        currentPage.loadUserData();
      }
      
      // 隐藏loading
      wx.hideLoading();
      
      if (callback) callback(true);
    }, 500);
  }
}

module.exports = DataImportManager;