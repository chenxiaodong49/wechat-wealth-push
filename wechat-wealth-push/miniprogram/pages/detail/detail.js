// pages/detail/detail.js
const app = getApp();

Page({
  data: {
    p: null,
    fields: [],
  },

  onLoad(query) {
    const code = decodeURIComponent(query.code || '');
    const p = app.globalData.productMap[code];
    if (!p) {
      wx.showToast({ title: '产品不存在', icon: 'none' });
      return;
    }
    const fields = [
      { label: '购买渠道', value: p.bankName },
      { label: '发行机构', value: p.issuerName || p.issuer || '—' },
      { label: '风险等级', value: p.riskLevel + '（' + (p.riskLevelRaw || '') + '）' },
      { label: '运作模式', value: p.operateMode || '—' },
      { label: '产品期限', value: p.term || '—' },
      { label: '赎回方式', value: p.redeemText },
      { label: '业绩比较基准', value: p.rateText },
      { label: '起购金额', value: p.amountText },
      { label: '募集币种', value: p.currency || '人民币' },
      { label: '募集起始日', value: p.issueDate || '—' },
      { label: '募集结束日', value: p.raiseEndDate || '—' },
      { label: '产品登记编码', value: p.productCode },
    ];
    this.setData({ p, fields });
  },
});
