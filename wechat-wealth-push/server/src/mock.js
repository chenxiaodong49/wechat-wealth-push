'use strict';
/**
 * 内置样例数据。当真实抓取失败（反爬/网络/接口变动）或 DATA_SOURCE=mock 时使用，
 * 保证服务本地开箱即跑。结构与 chinawealth.js 归一化后的 Product 一致。
 *
 * 关键：匹配维度是「购买渠道/销售机构(seller)」，而非「发行机构(issuer)」。
 * 因此样例里包含“别家发行、却在这三家 APP 代销”的产品（如建信理财在招行 APP 卖），
 * 也包含一个“仅在建行 APP 卖”的产品用于验证渠道排除。
 */

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function p(o) {
  return o;
}

/**
 * 生成样例产品。issueDate 用相对今天的天数，确保“未来3天新发”筛选项在演示时始终有命中。
 */
function getMockProducts() {
  const d1 = fmtDate(addDays(1)); // 明天起售 -> 命中
  const d2 = fmtDate(addDays(2));
  const d3 = fmtDate(addDays(3));
  const d10 = fmtDate(addDays(10)); // 超 3 天 -> 不命中
  const dNeg = fmtDate(addDays(-2)); // 已开售 -> 不命中

  return [
    // ===== 招商银行 APP（含代销）=====
    p({
      productCode: 'Z7004321000001',
      name: '招银理财招赢聚宝盆现金管理类理财计划',
      issuer: '招银理财有限责任公司', seller: '招商银行', bank: '招商银行', bankCode: 'CMB',
      riskLevel: 'R1', riskLevelRaw: '一级（低）',
      issueDate: d1, raiseEndDate: d1, term: '无固定期限', termDays: null,
      operateMode: '现金管理类', redeemType: '可赎回', minRedeemDays: 0,
      expectedRate: '近1年2.35%', minAmount: 1, currency: '人民币',
    }),
    p({
      // 代销：建信理财发行，但在招商银行 APP 销售 -> 应命中
      productCode: 'Z7004321000099',
      name: '建信理财“龙宝”最短持有30天固收类（招行代销）',
      issuer: '建信理财有限责任公司', seller: '招商银行', bank: '招商银行', bankCode: 'CMB',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d2, raiseEndDate: d2, term: '最短持有30天', termDays: 30,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 30,
      expectedRate: '业绩比较基准2.85%', minAmount: 100, currency: '人民币',
    }),
    p({
      productCode: 'Z7004321000003',
      name: '招银理财丰润一年定开固收类理财计划',
      issuer: '招银理财有限责任公司', seller: '招商银行', bank: '招商银行', bankCode: 'CMB',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d1, raiseEndDate: d1, term: '每12个月开放', termDays: 365,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 365, // >180 不合格
      expectedRate: '业绩比较基准3.20%', minAmount: 1000, currency: '人民币',
    }),
    p({
      productCode: 'Z7004321000004',
      name: '招银理财锐进混合类一年封闭理财',
      issuer: '招银理财有限责任公司', seller: '招商银行', bank: '招商银行', bankCode: 'CMB',
      riskLevel: 'R3', riskLevelRaw: '三级（中）', // 风险超标
      issueDate: d1, raiseEndDate: d1, term: '365天', termDays: 365,
      operateMode: '封闭式', redeemType: '不可赎回', minRedeemDays: 365,
      expectedRate: '业绩比较基准4.50%', minAmount: 10000, currency: '人民币',
    }),

    // ===== 中国银行 APP（含代销）=====
    p({
      productCode: 'C1020321000005',
      name: '中银理财-稳富(双月开)最短持有60天产品',
      issuer: '中银理财有限责任公司', seller: '中国银行', bank: '中国银行', bankCode: 'BOC',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d3, raiseEndDate: d3, term: '最短持有60天', termDays: 60,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 60,
      expectedRate: '业绩比较基准2.90%', minAmount: 1, currency: '人民币',
    }),
    p({
      // 代销：农银理财发行，但在中国银行 APP 销售 -> 应命中
      productCode: 'C1020321000098',
      name: '农银理财“农银安心”现金管理类（中行代销）',
      issuer: '农银理财有限责任公司', seller: '中国银行', bank: '中国银行', bankCode: 'BOC',
      riskLevel: 'R1', riskLevelRaw: '一级（低）',
      issueDate: d1, raiseEndDate: d1, term: '无固定期限', termDays: null,
      operateMode: '现金管理类', redeemType: '可赎回', minRedeemDays: 0,
      expectedRate: '近7日年化2.40%', minAmount: 1, currency: '人民币',
    }),
    p({
      productCode: 'C1020321000007',
      name: '中银理财-债富封闭式180天固收类',
      issuer: '中银理财有限责任公司', seller: '中国银行', bank: '中国银行', bankCode: 'BOC',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d2, raiseEndDate: d2, term: '180天', termDays: 180, // 封闭式但期限=180，视为半年内可取
      operateMode: '封闭式', redeemType: '不可赎回', minRedeemDays: 180,
      expectedRate: '业绩比较基准3.05%', minAmount: 100, currency: '人民币',
    }),
    p({
      productCode: 'C1020321000008',
      name: '中银理财-智富两年封闭混合类',
      issuer: '中银理财有限责任公司', seller: '中国银行', bank: '中国银行', bankCode: 'BOC',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d10, raiseEndDate: d10, // 超过3天 -> 不命中
      term: '730天', termDays: 730,
      operateMode: '封闭式', redeemType: '不可赎回', minRedeemDays: 730,
      expectedRate: '业绩比较基准4.00%', minAmount: 1000, currency: '人民币',
    }),

    // ===== 工商银行 APP（含代销）=====
    p({
      productCode: 'G2000321000009',
      name: '工银理财·鑫添益最短持有7天固收类',
      issuer: '工银理财有限责任公司', seller: '工商银行', bank: '工商银行', bankCode: 'ICBC',
      riskLevel: 'R1', riskLevelRaw: '一级（低）',
      issueDate: d1, raiseEndDate: d1, term: '最短持有7天', termDays: 7,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 7,
      expectedRate: '业绩比较基准2.55%', minAmount: 1, currency: '人民币',
    }),
    p({
      // 代销：兴银理财发行，但在工商银行 APP 销售 -> 应命中
      productCode: 'G2000321000097',
      name: '兴银理财“日日新”最短持有90天（工行代销）',
      issuer: '兴银理财有限责任公司', seller: '工商银行', bank: '工商银行', bankCode: 'ICBC',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d2, raiseEndDate: d2, term: '最短持有90天', termDays: 90,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 90,
      expectedRate: '业绩比较基准3.00%', minAmount: 100, currency: '人民币',
    }),
    p({
      productCode: 'G2000321000011',
      name: '工银理财·全鑫权益类一年定开',
      issuer: '工银理财有限责任公司', seller: '工商银行', bank: '工商银行', bankCode: 'ICBC',
      riskLevel: 'R4', riskLevelRaw: '四级（中高）', // 风险超标
      issueDate: d1, raiseEndDate: d1, term: '每12个月开放', termDays: 365,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 365,
      expectedRate: '业绩比较基准—', minAmount: 1000, currency: '人民币',
    }),
    p({
      productCode: 'G2000321000012',
      name: '工银理财·添利宝现金管理类（已开售）',
      issuer: '工银理财有限责任公司', seller: '工商银行', bank: '工商银行', bankCode: 'ICBC',
      riskLevel: 'R1', riskLevelRaw: '一级（低）',
      issueDate: dNeg, raiseEndDate: dNeg, // 已开售 -> 不命中“未来3天新发”
      term: '无固定期限', termDays: null,
      operateMode: '现金管理类', redeemType: '可赎回', minRedeemDays: 0,
      expectedRate: '近1年2.30%', minAmount: 1, currency: '人民币',
    }),

    // ===== 其他渠道（应排除：仅在建设银行 APP 售卖）=====
    p({
      productCode: 'J2000321000000',
      name: '建信理财“建信宝”最短持有30天（仅建行APP）',
      issuer: '建信理财有限责任公司', seller: '中国建设银行', bank: '中国建设银行', bankCode: '',
      riskLevel: 'R2', riskLevelRaw: '二级（中低）',
      issueDate: d1, raiseEndDate: d1, term: '最短持有30天', termDays: 30,
      operateMode: '定期开放式', redeemType: '可赎回', minRedeemDays: 30,
      expectedRate: '业绩比较基准2.80%', minAmount: 100, currency: '人民币',
    }),
  ];
}

module.exports = { getMockProducts, fmtDate, addDays };
