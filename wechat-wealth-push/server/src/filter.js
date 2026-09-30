'use strict';
/**
 * 筛选逻辑：按需求过滤“未来3天内新发 + R1/R2 + 半年内可赎回”的理财产品。
 */
const config = require('./config');

/** 解析 YYYY-MM-DD 为本地日期（置零时分秒） */
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 风险等级是否在白名单（R1/R2） */
function isRiskEligible(riskLevel) {
  return config.riskLevels.includes(riskLevel);
}

/**
 * 可赎回时间是否不超过半年：
 *  - 开放式/现金管理类：最短持有期 <= 180 天
 *  - 封闭式：产品期限 <= 180 天（到期即回款，视为半年内可取）
 */
function isRedeemEligible(p) {
  if (p.redeemType === '可赎回') {
    return p.minRedeemDays != null && p.minRedeemDays <= config.maxRedeemDays;
  }
  if (p.redeemType === '不可赎回') {
    return p.termDays != null && p.termDays <= config.maxRedeemDays;
  }
  return false;
}

/** 起售日是否落在 [今天, 今天+lookaheadDays]（未来3天新发） */
function isWithinLookahead(issueDate, today, lookaheadDays) {
  const d = parseDate(issueDate);
  if (!d) return false;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + lookaheadDays);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return t >= start && t <= end;
}

/**
 * 渠道无关的预筛选：仅按 R1/R2 + 半年内可赎回 + 未来3天新发过滤。
 * 用于在“补全销售机构”之前先缩小需补全的产品集合，减少详情接口调用量。
 * @param {Array} products 归一化产品
 * @param {Object} [now] 测试用“今天”
 */
function filterBasic(products, now) {
  const today = now || new Date();
  return products
    .filter((p) => isRiskEligible(p.riskLevel)) // R1/R2
    .filter((p) => isRedeemEligible(p)) // 半年内可赎回
    .filter((p) => isWithinLookahead(p.issueDate, today, config.lookaheadDays)); // 未来3天新发
}

/**
 * 主筛选。返回符合条件的产品（按起售日升序）。
 * 在“补全销售机构”之后调用，channel 维度此时已就绪。
 * @param {Array} products 归一化产品
 * @param {Object} [now] 测试用“今天”
 */
function filterEligible(products, now) {
  const today = now || new Date();
  return products
    .filter((p) => p.bankCode && config.banks.some((b) => b.code === p.bankCode)) // 仅目标购买渠道（招行/中行/工行 APP，含代销）
    .filter((p) => isRiskEligible(p.riskLevel)) // R1/R2
    .filter((p) => isRedeemEligible(p)) // 半年内可赎回
    .filter((p) => isWithinLookahead(p.issueDate, today, config.lookaheadDays)) // 未来3天新发
    .sort((a, b) => (a.issueDate || '').localeCompare(b.issueDate || ''));
}

/** 生成按银行分组的概览，用于推送摘要 */
function buildSummary(products) {
  const byBank = {};
  for (const p of products) {
    byBank[p.bank] = (byBank[p.bank] || 0) + 1;
  }
  const banks = Object.keys(byBank).map((b) => `${b}${byBank[b]}只`);
  return {
    count: products.length,
    bankText: banks.join('、') || '暂无',
    dateRange: `${fmtDate(new Date())} 起未来${config.lookaheadDays}天`,
  };
}

module.exports = {
  filterEligible,
  filterBasic,
  buildSummary,
  isRiskEligible,
  isRedeemEligible,
  isWithinLookahead,
  parseDate,
  fmtDate,
};
