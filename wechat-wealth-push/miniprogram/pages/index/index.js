// pages/index/index.js
const app = getApp();
const req = require('../../utils/request');
const fmt = require('../../utils/format');

// 订阅消息模板 ID：在微信公众平台「订阅消息」申请，与后端 WX_SUBSCRIBE_TEMPLATE_ID 保持一致
const SUBSCRIBE_TMPL_ID = 'YOUR_SUBSCRIBE_TEMPLATE_ID';

Page({
  data: {
    allProducts: [],
    products: [],
    summary: null,
    updatedAt: '',
    loading: false,
    bankFilter: 'ALL',
    riskFilter: 'ALL',
    subscribed: false,
    banks: [
      { code: 'ALL', name: '全部' },
      { code: 'CMB', name: '招商' },
      { code: 'BOC', name: '中行' },
      { code: 'ICBC', name: '工行' },
    ],
    risks: [
      { code: 'ALL', name: '全部' },
      { code: 'R1', name: 'R1' },
      { code: 'R2', name: 'R2' },
    ],
  },

  onLoad() {
    this.loadProducts();
  },

  onPullDownRefresh() {
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },

  async loadProducts() {
    this.setData({ loading: true });
    try {
      const d = await req.get('/api/products');
      const decorated = fmt.decorateList(d.products);
      const map = {};
      decorated.forEach((p) => (map[p.productCode] = p));
      app.globalData.productMap = map;
      this.setData({
        allProducts: decorated,
        products: decorated,
        summary: d.summary,
        updatedAt: (d.updatedAt || '').replace('T', ' ').slice(0, 16),
        loading: false,
      });
      this.applyFilters();
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  applyFilters() {
    const { allProducts, bankFilter, riskFilter } = this.data;
    const list = allProducts.filter((p) => {
      const okBank = bankFilter === 'ALL' || p.bankCode === bankFilter;
      const okRisk = riskFilter === 'ALL' || p.riskLevel === riskFilter;
      return okBank && okRisk;
    });
    this.setData({ products: list });
  },

  onBankFilter(e) {
    this.setData({ bankFilter: e.currentTarget.dataset.code }, () => this.applyFilters());
  },

  onRiskFilter(e) {
    this.setData({ riskFilter: e.currentTarget.dataset.code }, () => this.applyFilters());
  },

  goDetail(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({ url: '/pages/detail/detail?code=' + encodeURIComponent(code) });
  },

  onSubscribeTap() {
    if (!app.globalData.openid) {
      wx.showToast({ title: '请稍候重试', icon: 'none' });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TMPL_ID],
      success: (res) => {
        if (res[SUBSCRIBE_TMPL_ID] === 'accept') {
          req
            .post('/api/subscribe', { openid: app.globalData.openid })
            .then(() => {
              this.setData({ subscribed: true });
              wx.showToast({ title: '已开启每日推送', icon: 'success' });
            })
            .catch(() => wx.showToast({ title: '订阅登记失败', icon: 'none' }));
        } else {
          wx.showToast({ title: '未授权推送', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '授权失败', icon: 'none' }),
    });
  },
});
