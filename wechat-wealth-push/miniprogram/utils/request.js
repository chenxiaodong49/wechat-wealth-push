// utils/request.js —— 后端请求封装
const app = getApp();

function request(path, method, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: (app.globalData.apiBase || 'http://localhost:3000') + path,
      method: method || 'GET',
      data: data || {},
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error('HTTP ' + res.statusCode + ' ' + JSON.stringify(res.data)));
      },
      fail: (err) => reject(err),
    });
  });
}

module.exports = {
  get: (path) => request(path, 'GET'),
  post: (path, data) => request(path, 'POST', data),
};
