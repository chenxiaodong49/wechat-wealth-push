// app.js
App({
  globalData: {
    // ===== 免服务器方案（默认，推荐新手）=====
    // 产品列表由 GitHub Pages 托管，小程序直接读静态 JSON，不需要后端服务器/信用卡。
    USE_STATIC: true,
    // 改成你的 GitHub Pages 地址（仓库名需与下方一致，区分大小写）：
    //   格式：https://<你的GitHub用户名>.github.io/<仓库名>
    //   例：https://zhangsan.github.io/wechat-wealth-push
    PAGES_BASE: 'https://YOUR_GITHUB_USER.github.io/wechat-wealth-push',

    // ===== 如果你之后有自己的后端（如 Render / 自有服务器）=====
    // 把上面 USE_STATIC 改为 false，并填后端 https 域名；
    // 同时在小程序后台「开发设置→服务器域名→request 合法域名」加入该域名。
    apiBase: 'http://localhost:3000',

    openid: '',
    // 当前产品列表缓存（详情页按 productCode 取用）
    productMap: {},
  },

  onLaunch() {
    // 仅在「有后端」模式下，才用 wx.login 的 code 向后端换 openid。
    // 免服务器模式下，接收人 openid 在 GitHub 仓库 Secrets(SUBSCRIBERS) 里配置，这里无需请求。
    if (!this.globalData.USE_STATIC) {
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
    }
  },
});
