// utils/format.js —— 展示用格式化（在 page.js 中预计算后 setData）

const BANK_NAMES = {
  CMB: '招商银行',
  BOC: '中国银行',
  ICBC: '工商银行',
};

// 给产品补充展示字段，便于 WXML 直接渲染
function decorate(p) {
  const out = Object.assign({}, p);
  out.bankName = BANK_NAMES[p.bankCode] || p.bank || '—'; // 购买渠道
  out.issuerName = p.issuer || ''; // 发行机构
  out.riskClass = p.riskLevel === 'R1' ? 'tag-r1' : 'tag-r2';
  out.rateText = p.expectedRate || '以产品说明书为准';
  out.amountText = p.minAmount != null ? `起购 ${p.minAmount}元` : '—';
  // 可赎回天数说明
  if (p.redeemType === '可赎回') {
    out.redeemText =
      p.minRedeemDays === 0 ? '可随时赎回' : `最短持有${p.minRedeemDays}天可赎回`;
  } else {
    out.redeemText = p.termDays != null ? `封闭${p.termDays}天（到期可取）` : '不可赎回';
  }
  return out;
}

function decorateList(list) {
  return (list || []).map(decorate);
}

module.exports = { decorate, decorateList, BANK_NAMES };
