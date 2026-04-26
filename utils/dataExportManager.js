'use strict';
const JSZip = require('./jszip.min.js');
const { calculateHash } = require('./encrypt.js');

class DataExportManager {
  constructor() {
    this.exportedFilePath = '';
    this.exportedFileName = '';
    this.exportedTemplateFilePath = '';
    this.exportedTemplateFileName = '';
  }

  // 生成默认文件名
  generateDefaultFileName(username, selectedDataTypes, dataTypes) {
    const currentDate = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/[\/\s:]/g, '-');

    const allDataTypes = dataTypes.map(type => type.id);
    const isAllSelected = selectedDataTypes.length === allDataTypes.length &&
      selectedDataTypes.every(type => allDataTypes.includes(type));

    if (isAllSelected) {
      // 全选时使用"用户名+备份+日期"格式
      return `${username}+备份+${currentDate}`;
    } else {
      // 非全选时使用原格式：用户名+数据类型+当前时间
      const dataTypeNames = dataTypes
        .filter(type => selectedDataTypes.includes(type.id))
        .map(type => type.name)
        .join('+');

      const currentTime = new Date().toLocaleString('zh-CN', {
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

  // 导出选择的数据类型
  exportSelectedData(selectedDataTypes, customFileName, callback) {
    wx.showLoading({
      title: '正在导出...'
    });

    try {
      // 构造导出数据结构
      const data = {};

      // 根据选择的数据类型获取对应的数据
      if (selectedDataTypes.includes('shiftTemplates')) {
        // 获取班次模板数据
        data.shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      }

      if (selectedDataTypes.includes('shifts')) {
        // 获取排班数据
        data.shifts = wx.getStorageSync('shifts') || {};
      }

      // 添加统计数据（如果包含排班数据）
      if (data.shifts) {
        let totalHours = 0;
        let workDays = 0;
        let offDays = 0;
        let totalDays = 0;

        // 计算统计数据
        Object.keys(data.shifts).forEach(date => {
          const shift = data.shifts[date];
          totalHours += parseFloat(shift.workHours) || 0;
          totalDays++;

          // 按班次类型统计工作班次和休息日
          const shiftType = shift.type;
          if (shiftType === '白天班' || shiftType === '跨夜班') {
            workDays++;
          } else if (shiftType === '休息日') {
            offDays++;
          }
        });

        // 添加统计数据到导出数据中
        data.statistics = {
          totalHours: totalHours.toFixed(1),
          totalDays: totalDays,
          workDays: workDays,
          offDays: offDays
        };
      }

      // 检查数据是否为空
      const isDataEmpty = Object.keys(data).length === 0 ||
        (Object.keys(data).length === 1 && data.shiftTemplates && data.shiftTemplates.length === 0) ||
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

      // 使用用户输入的文件名
      const fileName = customFileName;
      const fs = wx.getFileSystemManager();

      // 检查是否选择了图片
      const includeImages = selectedDataTypes.includes('scheduleImages');

      if (includeImages) {
        // 生成ZIP文件
        this.exportAsZip(fileName, data, selectedDataTypes, callback);
      } else {
        // 生成JSON文件
        const jsonData = JSON.stringify(data, null, 2);
        const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.json`;

        // 检查jsonData是否为空
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
            // 保存文件路径和文件名到实例属性中
            this.exportedFilePath = filePath;
            this.exportedFileName = fileName;

            // 显示提示，让用户点击分享按钮
            wx.showModal({
              title: '导出成功',
              content: '数据已导出为JSON文件，请点击下方"分享数据"按钮将文件发送给好友',
              showCancel: false,
              confirmText: '知道了'
            });

            if (callback) callback({ filePath, fileName });
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('写入文件失败', err);
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

  // 导出为ZIP文件
  exportAsZip(fileName, data, selectedDataTypes, callback) {
    try {
      const zip = new JSZip();

      // 添加班次模板文件（如果用户选择了导出班次模板）
      if (selectedDataTypes.includes('shiftTemplates') && data.shiftTemplates) {
        zip.file('班次模板.json', JSON.stringify({ data: data.shiftTemplates }, null, 2));
      }

      // 添加排班数据文件（如果用户选择了导出排班数据）
      if (selectedDataTypes.includes('shifts') && data.shifts) {
        zip.file('排班数据.json', JSON.stringify({ shifts: data.shifts, statistics: data.statistics }, null, 2));
      }

      // 添加图片文件（如果用户选择了导出图片）
      if (selectedDataTypes.includes('scheduleImages')) {
        const fs = wx.getFileSystemManager();
        const imagePromises = [];
        const processedImages = new Set(); // 用于跟踪已处理的图片
        const validWeekImageKeys = []; // 用于跟踪包含有效图片的周

        // 获取所有周的图片
        const storageInfo = wx.getStorageInfoSync();
        const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

        weekImageKeys.forEach(key => {
          const weekImages = wx.getStorageSync(key) || [];
          const validWeekImages = weekImages.filter(image => {
            // 过滤掉名称为"0"的图片和无效图片
            return image && image.name !== '0' && image.path;
          });

          // 只处理有有效图片的周
          if (validWeekImages.length > 0) {
            validWeekImageKeys.push(key);

            validWeekImages.forEach((image, index) => {
              // 生成图片唯一标识（基于图片路径和名称）
              const imageKey = `${key}_${image.name}_${image.path}`;

              // 检查图片是否已经处理过
              if (!processedImages.has(imageKey)) {
                processedImages.add(imageKey);

                const promise = new Promise((resolve) => {
                  try {
                    // 读取图片文件
                    fs.readFile({
                      filePath: image.path,
                      success: (res) => {
                        // 生成图片文件名（使用年月文件夹结构：images/YYYY-MM/）
                        // 从weekKey中提取年月（格式：YYYY-MM）
                        const weekKey = key.replace('week_images_', '');
                        let yearMonth;
                        try {
                          const weekDate = new Date(weekKey);
                          // 检查日期是否有效
                          if (!isNaN(weekDate.getTime())) {
                            const year = weekDate.getFullYear();
                            const month = String(weekDate.getMonth() + 1).padStart(2, '0');
                            yearMonth = `${year}-${month}`;
                          } else {
                            // 如果日期无效，使用当前日期
                            const currentDate = new Date();
                            const year = currentDate.getFullYear();
                            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                            yearMonth = `${year}-${month}`;
                          }
                        } catch (e) {
                          // 如果发生错误，使用当前日期
                          const currentDate = new Date();
                          const year = currentDate.getFullYear();
                          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                          yearMonth = `${year}-${month}`;
                        }

                        // 使用原始图片名称
                        const imageName = image.name || `image_${index}.jpg`;
                        const imageFileName = `images/${yearMonth}/${imageName}`;

                        // 添加图片到ZIP
                        zip.file(imageFileName, res.data);
                        resolve();
                      },
                      fail: (err) => {
                        console.error('读取图片失败', err);
                        resolve(); // 忽略失败的图片
                      }
                    });
                  } catch (e) {
                    console.error('处理图片失败', e);
                    resolve();
                  }
                });
                imagePromises.push(promise);
              }
            });
          }
        });

        // 等待所有图片处理完成
        Promise.all(imagePromises).then(() => {
          // 生成图片周关联表（与云备份结构一致）
          const imageWeekRelation = {};
          validWeekImageKeys.forEach(key => {
            const weekImages = wx.getStorageSync(key) || [];
            const validWeekImages = weekImages.filter(image => {
              // 过滤掉名称为"0"的图片和无效图片
              return image && image.name !== '0' && image.path;
            });

            imageWeekRelation[key] = [];
            validWeekImages.forEach((image, index) => {
              // 从weekKey中提取年月（格式：YYYY-MM）
              const weekKey = key.replace('week_images_', '');
              let yearMonth;
              try {
                const weekDate = new Date(weekKey);
                if (!isNaN(weekDate.getTime())) {
                  const year = weekDate.getFullYear();
                  const month = String(weekDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                } else {
                  const currentDate = new Date();
                  const year = currentDate.getFullYear();
                  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                  yearMonth = `${year}-${month}`;
                }
              } catch (e) {
                const currentDate = new Date();
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                yearMonth = `${year}-${month}`;
              }

              const imageName = image.name || `image_${index}.jpg`;
              const imagePath = `images/${yearMonth}/${imageName}`;

              // 添加哈希值（与云备份计算方式一致）
              let imageHash = image.hash;
              if (!imageHash) {
                try {
                  const fileInfo = fs.getFileInfoSync({ filePath: image.path });
                  imageHash = calculateHash(`${image.addedTime || Date.now()}_${key}_${imageName}_${fileInfo.size}`);
                } catch (e) {
                  console.error('计算哈希值失败', e);
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

          // 添加图片周关联表.json文件
          zip.file('图片周关联表.json', JSON.stringify(imageWeekRelation, null, 2));

          // 生成ZIP文件
          this.generateZipFile(zip, fileName, callback);
        });
      } else {
        // 如果不需要导出图片，直接生成ZIP文件
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

  // 生成ZIP文件并保存
  generateZipFile(zip, fileName, callback) {
    zip.generateAsync({ type: 'arraybuffer' }).then((content) => {
      // 检查content是否为空
      if (!content || content.byteLength === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '没有数据可导出',
          icon: 'none'
        });
        if (callback) callback(null);
        return;
      }

      // 创建临时文件
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.zip`;
      const fs = wx.getFileSystemManager();

      fs.writeFile({
        filePath: filePath,
        data: content,
        success: () => {
          wx.hideLoading();
          // 保存文件路径和文件名到实例属性中
          this.exportedFilePath = filePath;
          this.exportedFileName = fileName;

          // 显示提示，让用户点击分享按钮
          wx.showModal({
            title: '导出成功',
            content: '数据已导出为ZIP文件，请点击下方"分享数据"按钮将文件发送给好友',
            showCancel: false,
            confirmText: '知道了'
          });

          if (callback) callback({ filePath, fileName });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('写入ZIP文件失败', err);
          wx.showToast({
            title: '导出失败',
            icon: 'none'
          });
          if (callback) callback(null);
        }
      });
    }).catch((err) => {
      wx.hideLoading();
      console.error('生成ZIP失败', err);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
      if (callback) callback(null);
    });
  }

  // 分享导出的文件给好友
  shareExportedFile() {
    // 检查是否有导出的文件
    if (this.exportedFilePath && this.exportedFileName) {
      this.shareFile(this.exportedFilePath, this.exportedFileName);
    } else {
      wx.showToast({
        title: '请先导出数据',
        icon: 'none'
      });
    }
  }

  // 分享导出的模板文件给好友
  shareTemplate() {
    // 检查是否有导出的模板文件
    if (this.exportedTemplateFilePath && this.exportedTemplateFileName) {
      this.shareFile(this.exportedTemplateFilePath, this.exportedTemplateFileName);
    } else {
      wx.showToast({
        title: '请先导出模板',
        icon: 'none'
      });
    }
  }

  // 分享文件给好友
  shareFile(filePath, fileName) {
    // 检查是否支持分享文件
    if (wx.shareFileMessage) {
      // 确定文件扩展名
      const extension = filePath.endsWith('.zip') ? '.zip' : '.json';

      wx.shareFileMessage({
        filePath: filePath,
        fileName: `${fileName}${extension}`,
        success: () => {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('分享失败', err);
          wx.showToast({
            title: '分享失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 如果不支持分享文件，则提示用户手动发送
      wx.showModal({
        title: '提示',
        content: '当前微信版本不支持直接分享文件，您可以手动发送文件给好友。文件已保存到本地。',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  }

  // 获取导出文件信息
  getExportedFileInfo() {
    return {
      exportedFilePath: this.exportedFilePath,
      exportedFileName: this.exportedFileName,
      exportedTemplateFilePath: this.exportedTemplateFilePath,
      exportedTemplateFileName: this.exportedTemplateFileName
    };
  }

  // 设置导出文件信息
  setExportedFileInfo(info) {
    if (info.exportedFilePath) this.exportedFilePath = info.exportedFilePath;
    if (info.exportedFileName) this.exportedFileName = info.exportedFileName;
    if (info.exportedTemplateFilePath) this.exportedTemplateFilePath = info.exportedTemplateFilePath;
    if (info.exportedTemplateFileName) this.exportedTemplateFileName = info.exportedTemplateFileName;
  }
}

module.exports = DataExportManager;
