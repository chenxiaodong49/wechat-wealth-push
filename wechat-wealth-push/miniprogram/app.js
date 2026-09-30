// app.js
App({
  globalData: {
    // 后端 API 地址。
    // 本地联调（微信开发者工具勾选“不校验合法域名”）：http://localhost:3000
    // 上线：改为 https 域名，并在小程序后台「开发->开发设置->服务器域名->request合法域名」中加入该域名
    apiBase: 'http://localhost:3000',
    openid: '',
    // 当前产品列表缓存（详情页按 productCode 取用）
    productMap: {},
  },

  onLaunch() {
    // 小程序启动时用 wx.login 的 code 向后端换取 openid
    wx.login({
      success: (res) => {
        if (!res.code) return;
        wx.request({
          url: this.globalData.apiBase + '/api/login',
          method: 'POST',
          data: { code: res.code },
          success: (r) => {
            if (r.data && r.data.openid) {
              this.globalData.openid = r.data.openid;
            }
          },
        });
      },
    });
  },
});
