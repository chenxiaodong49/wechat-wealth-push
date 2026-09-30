'use strict';
/**
 * 完整筛选流水线：抓取 -> 渠道无关预筛 -> 补全销售机构 -> 渠道+全条件筛选。
 *
 * 设计要点：中国理财网搜索列表主返回“发行机构”，而“可在招行/中行/工行 APP 购买”
 * （=销售机构/购买渠道）才是真实需求。因此对命中 R1/R2 + 半年内可赎回 + 未来3天新发
 * 的候选产品，逐个调用产品详情接口补全销售机构，再按购买渠道最终筛选（含代销）。
 */
const config = require('./config');
const chinawealth = require('./chinawealth');
const filter = require('./filter');

/**
 * @param {Date} [now] 测试用“今天”
 * @returns {Promise<{products:Array, summary:Object, source:string, totalFetched:number}>}
 */
async function getEligibleProducts(now) {
  const { products, source } = await chinawealth.getProducts();
  const basic = filter.filterBasic(products, now);
  const enriched = await chinawealth.enrichProducts(basic, { enabled: source === 'chinawealth' });
  const eligible = filter.filterEligible(enriched, now);
  return {
    products: eligible,
    summary: filter.buildSummary(eligible),
    source,
    totalFetched: products.length,
  };
}

module.exports = { getEligibleProducts };
