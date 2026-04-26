'use strict';
const config = require('../config.js');

async function callCloudFunction(name, data, options = {}) {
  const { timeout = 10000, maxRetries = 0, retryDelay = 1000, showLoading = false } = options;

  if (showLoading) {
    wx.showLoading({ title: '请稍候...' });
  }

  let lastError;
  const attempts = maxRetries + 1;

  for (let i = 0; i < attempts; i++) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`云函数 ${name} 调用超时`)), timeout);
      });

      const result = await Promise.race([
        wx.cloud.callFunction({
          name,
          data
        }),
        timeoutPromise
      ]);

      if (showLoading) {
        wx.hideLoading();
      }

      return result.result;
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) {
        console.warn(`云函数 ${name} 调用失败，第 ${i + 1} 次重试...`, e);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  if (showLoading) {
    wx.hideLoading();
  }

  console.error(`云函数 ${name} 调用失败:`, lastError);
  wx.showToast({
    title: '网络请求失败，请稍后重试',
    icon: 'none'
  });
  throw lastError;
}

async function request(endpoint, options = {}) {
  const url = `${config.baseURL || ''}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  try {
    const response = await wx.request({
      url,
      ...mergedOptions
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.data;
    } else {
      throw new Error(`HTTP ${response.statusCode}: ${(response.data && response.data.message) || '请求失败'}`);
    }
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
}

async function get(endpoint, params = {}) {
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const urlWithParams = queryString ? `${endpoint}?${queryString}` : endpoint;

  return request(urlWithParams, {
    method: 'GET'
  });
}

async function post(endpoint, data = {}) {
  return request(endpoint, {
    method: 'POST',
    data
  });
}

async function put(endpoint, data = {}) {
  return request(endpoint, {
    method: 'PUT',
    data
  });
}

async function del(endpoint) {
  return request(endpoint, {
    method: 'DELETE'
  });
}

module.exports = {
  callCloudFunction,
  request,
  get,
  post,
  put,
  del
};
