'use strict';
/**
 * 离线自测：验证筛选逻辑（无需网络/微信）。
 * 运行：node src/_selftest.js
 */
const mock = require('./mock');
const filter = require('./filter');

const products = mock.getMockProducts();
const eligible = filter.filterEligible(products);
const summary = filter.buildSummary(eligible);

console.log('样例总数:', products.length);
console.log('合格数量(预期7):', eligible.length);
console.log('概览:', JSON.stringify(summary));
console.log('合格产品:');
for (const p of eligible) {
  console.log(
    `  [${p.bankCode}] ${p.name} | ${p.riskLevel} | ${p.redeemType}(${p.minRedeemDays}天) | 起售${p.issueDate}`
  );
}

// 断言
const expect = 7;
if (eligible.length !== expect) {
  console.error(`\n❌ 断言失败：预期 ${expect} 只，实际 ${eligible.length} 只`);
  process.exit(1);
}

// 代销断言：发行机构不是该渠道银行自家理财子公司，才算代销
//   CMB->招银理财, BOC->中银理财, ICBC->工银理财
const ownSub = { CMB: '招银理财', BOC: '中银理财', ICBC: '工银理财' };
const consigned = eligible.filter((p) => !(p.issuer || '').includes(ownSub[p.bankCode]));
console.log('其中代销产品(发行机构非本渠道子公司):', consigned.length, '只');
if (consigned.length < 3) {
  console.error('❌ 断言失败：代销产品不足 3 只，购买渠道维度可能未生效');
  process.exit(1);
}

// 渠道排除断言：不应出现“仅建行APP售卖”的产品
const leaked = eligible.filter((p) => p.seller === '中国建设银行');
if (leaked.length > 0) {
  console.error('❌ 断言失败：出现了非目标渠道(建行)产品');
  process.exit(1);
}

// ===== 详情补全销售机构 逻辑单测（无需网络）=====
// 模拟中国理财网详情接口返回（销售机构藏在 saleOrgList 数组里）
const cw = require('./chinawealth');
const simDetail = {
  data: { prodRegCode: 'X1', saleOrgList: [{ orgName: '招商银行' }, { orgName: '中国银行' }] },
};
const sellers = cw._internal.extractSellers(simDetail);
console.log('详情销售机构解析:', JSON.stringify(sellers));
if (!sellers.includes('招商银行')) {
  console.error('❌ extractSellers 未解析出销售机构');
  process.exit(1);
}
// 发行机构是建信理财，但销售机构含招商银行 -> 应按购买渠道命中招行（而非被发行机构误导）
const code = cw._internal.matchBank(sellers.join('、'), '建信理财有限责任公司');
console.log('matchBank(销售:招商银行、中国银行 / 发行:建信理财):', code);
if (code !== 'CMB') {
  console.error('❌ matchBank 未按销售机构命中招行');
  process.exit(1);
}

console.log('\n✅ 筛选逻辑自测通过（按购买渠道匹配，含代销 + 详情补全）');
