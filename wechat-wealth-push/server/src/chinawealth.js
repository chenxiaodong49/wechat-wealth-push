'use strict';
/**
 * 中国理财网（官方银行理财登记托管平台）抓取与归一化模块。
 *
 * 真实接口（已逆向）：
 *   POST https://www.chinawealth.com.cn/lcw-fe-service/prod/search
 *   请求体为一组固定筛选字段（见 buildSearchBody）。
 *   返回 { code, msg, data: { records:[...], total } }。
 *
 * 注意：该站有反爬/限流（直连常返 500/429）。本模块在抓取失败时由上层回退到样例数据，
 *       以保证服务可用；生产环境如需稳定抓取，建议改用无头浏览器（Playwright）或申请官方数据合作。
 */
const config = require('./config');
const mock = require('./mock');

const BANK_MAP = new Map(config.banks.map((b) => [b.code, b]));

/** 构造中国理财网的搜索请求体（与官网前端默认筛选一致） */
function buildSearchBody(pageNum = 1, pageSize = 50) {
  return {
    prodRegCode: '',
    prodName: '',
    orgName: '',
    prodStatus: '02', // 在售
    orgTypeListAll: 'bx',
    orgTypeList: [],
    prodCollectMeth: '01,NA',
    prodSpclAttrList: [],
    prodSpclAttrListAll: 'bx',
    prodOperateModeListAll: 'bx',
    prodOperateModeList: [],
    prodInvestNatureListAll: 'bx',
    prodInvestNatureList: [],
    prodRiskLevelListAll: 'bx',
    prodRiskLevelList: [],
    prodTermCodeListAll: 'bx',
    prodTermCodeList: [],
    collCCYListAll: 'bx',
    collCCYList: [],
    performanceCompareBaseCap: '',
    performanceCompareBaseFloor: '',
    prodSaleZone: '',
    searchType: '',
    quickQueryWords: '',
    pageNum,
    pageSize,
  };
}

/** 风险等级归一化：'一级（低）'/'R1' -> 'R1' ... */
function normalizeRiskLevel(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/R([1-5])/i);
  if (m) return 'R' + m[1];
  const cn = ['零', '一', '二', '三', '四', '五'];
  for (let i = 1; i <= 5; i++) {
    if (s.includes(cn[i]) || s.startsWith(String(i))) return 'R' + i;
  }
  return null;
}

/** 解析期限文本为天数：'90天'->90, '6个月'->180, '1年'->360, '无固定期限'->null */
function parseTermDays(text) {
  if (!text) return null;
  const s = String(text);
  if (/无固定|—|-/.test(s)) return null;
  const month = s.match(/(\d+(?:\.\d+)?)\s*个?月/);
  if (month) return Math.round(parseFloat(month[1]) * 30);
  const year = s.match(/(\d+(?:\.\d+)?)\s*年/);
  if (year) return Math.round(parseFloat(year[1]) * 360);
  const day = s.match(/(\d+(?:\.\d+)?)\s*天/);
  if (day) return Math.round(parseFloat(day[1]));
  return null;
}

/** 根据运作模式与期限推导可赎回信息 */
function deriveRedeem(operateMode, termDays) {
  const mode = String(operateMode || '');
  if (mode.includes('现金管理')) {
    return { redeemType: '可赎回', minRedeemDays: 0 };
  }
  if (mode.includes('开放式')) {
    // 定期开放式 / 开放式净值型：以“最短持有期”为最早可赎回天数
    return { redeemType: '可赎回', minRedeemDays: termDays == null ? 0 : termDays };
  }
  // 封闭式：到期才可取，最早可取 = 产品期限
  return { redeemType: '不可赎回', minRedeemDays: termDays == null ? 9999 : termDays };
}

/**
 * 按「购买渠道（销售机构）」匹配目标银行。
 * 优先用销售机构 seller 匹配；若接口未给出销售机构，则用发行机构 issuer 兜底（匹配三家理财子公司）。
 */
function matchBank(seller, issuer) {
  for (const b of config.banks) {
    if (b.sellerKeywords.some((k) => seller && seller.includes(k))) return b.code;
  }
  for (const b of config.banks) {
    if (b.issuerKeywords.some((k) => issuer && issuer.includes(k))) return b.code;
  }
  return '';
}

/** 将一条原始记录归一化为统一 Product 结构 */
function normalizeRecord(rec) {
  if (!rec) return null;
  const riskLevelRaw = rec.prodRiskLevelName || rec.prodRiskLevel || '';
  const riskLevel = normalizeRiskLevel(riskLevelRaw);
  const operateMode = rec.prodOperateModeName || rec.prodOperateMode || '';
  const termRaw = rec.prodTermName || rec.prodTerm || '';
  const termDays = parseTermDays(termRaw);
  const { redeemType, minRedeemDays } = deriveRedeem(operateMode, termDays);

  // 发行机构（谁发的）与销售机构（在哪买）
  const issuer =
    rec.orgName || rec.issueInstitution || rec.issuer || '';
  const seller =
    rec.prodSaleOrgName ||
    rec.saleOrgName ||
    rec.prodSaleOrg ||
    rec.prodSaleInstitution ||
    rec.saleInstitution ||
    rec.sellerName ||
    rec.saleOrg ||
    '';
  const bankCode = matchBank(seller, issuer);
  const bankName = (config.banks.find((b) => b.code === bankCode) || {}).name || seller || issuer;

  return {
    productCode: rec.prodRegCode || rec.prodCode || '',
    name: rec.prodName || '',
    bank: bankName, // 购买渠道（展示用）
    bankCode, // 购买渠道代码（筛选用）
    issuer, // 发行机构（展示用）
    seller, // 销售机构（购买渠道原始名）
    riskLevel,
    riskLevelRaw,
    issueDate: rec.collSDate || rec.raiseStartDate || rec.collSDate || '',
    raiseEndDate: rec.collEDate || rec.raiseEndDate || '',
    term: termRaw,
    termDays,
    operateMode,
    redeemType,
    minRedeemDays,
    expectedRate: rec.performanceCompareBase || rec.expectedRate || rec.yieldRate || '',
    minAmount: rec.prodStartAmount != null ? rec.prodStartAmount : rec.minAmount,
    currency: rec.collCCYName || rec.currency || '人民币',
    detailUrl: rec.detailUrl || '',
  };
}

/** 真实抓取：返回原始记录数组（失败抛异常） */
async function fetchRawRecords() {
  const url = config.chinaWealth.baseUrl + config.chinaWealth.searchPath;
  const body = buildSearchBody();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Referer: 'https://www.chinawealth.com.cn/lcweb/management/proScreen',
        Origin: 'https://www.chinawealth.com.cn',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json || !json.data || !Array.isArray(json.data.records)) {
      throw new Error('返回结构异常: code=' + json.code + ' msg=' + json.msg);
    }
    return json.data.records;
  } finally {
    clearTimeout(timer);
  }
}

// 详情销售机构缓存（进程内，避免对同一条产品重复打接口）
const _detailCache = new Map();

/**
 * 从详情对象中提取销售机构名称数组（尽力而为）。
 * 中国理财网详情接口返回的销售机构字段名不固定，这里扫描所有“销售/代销/代理”相关字段，
 * 兼容字符串、对象、对象数组等多种形态。
 */
function extractSellers(obj) {
  const out = new Set();
  if (!obj || typeof obj !== 'object') return [];
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (/saleOrg|SaleOrg|sellerOrg|proxyOrg|distrib|代销|销售机构/i.test(k)) {
        if (typeof v === 'string' && v.trim()) out.add(v.trim());
        else if (Array.isArray(v)) {
          v.forEach((x) => {
            if (typeof x === 'string' && x.trim()) out.add(x.trim());
            else if (x && typeof x === 'object') {
              const name = x.orgName || x.name || x.saleOrgName || x.prodSaleOrgName;
              if (name && typeof name === 'string' && name.trim()) out.add(name.trim());
            }
          });
        } else if (v && typeof v === 'object') {
          const name = v.orgName || v.name;
          if (name && typeof name === 'string' && name.trim()) out.add(name.trim());
        }
      }
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(obj, 0);
  return [...out];
}

/**
 * 拉取单只产品的详情，补全销售机构（购买渠道）。
 * 接口：POST {baseUrl}/prodInfo/getProductDetail，参数 { prodRegCode }。
 * 失败（反爬/网络）时返回 null，不抛异常，由上层回退到发行机构兜底匹配。
 */
async function fetchProductDetail(prodRegCode) {
  if (!prodRegCode) return null;
  if (_detailCache.has(prodRegCode)) return _detailCache.get(prodRegCode);
  const url = config.chinaWealth.baseUrl + config.chinaWealth.detailPath;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Referer: 'https://www.chinawealth.com.cn/lcweb/management/proScreen',
        Origin: 'https://www.chinawealth.com.cn',
      },
      body: JSON.stringify({ prodRegCode }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const detail = json && json.data ? json.data : json;
    const sellers = extractSellers(detail);
    const result = { sellers, raw: detail };
    _detailCache.set(prodRegCode, result);
    return result;
  } catch (e) {
    _detailCache.set(prodRegCode, null); // 失败也缓存，避免反复打接口被封
    console.warn('[chinawealth] 详情接口失败(' + prodRegCode + '):', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 补全销售机构：对 seller 为空的产品逐个拉详情，写入 seller 并重新计算 bankCode/bank。
 * 仅在真实数据源下启用（mock 数据已自带 seller，无需调用）。
 * 采用并发限制，避免一次性打爆接口。
 */
async function enrichProducts(products, { enabled = true, concurrency = 4 } = {}) {
  if (!enabled) return products;
  const need = products.filter((p) => !p.seller && p.productCode);
  if (need.length === 0) return products;
  let idx = 0;
  const worker = async () => {
    while (idx < need.length) {
      const p = need[idx++];
      const d = await fetchProductDetail(p.productCode);
      if (d && d.sellers && d.sellers.length) {
        p.seller = d.sellers.join('、');
        const code = matchBank(p.seller, p.issuer);
        if (code) {
          p.bankCode = code;
          p.bank = (config.banks.find((b) => b.code === code) || {}).name || p.seller;
        }
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, need.length) }, () => worker());
  await Promise.all(workers);
  return products;
}

/**
 * 对外统一入口：按 config.dataSource 策略返回归一化后的产品数组 + 数据源标记。
 * 返回 { products, source }。source ∈ 'chinawealth' | 'mock' | 'mock(fallback)'
 * auto: 优先真实抓取，失败回退样例；chinawealth: 仅真实；mock: 仅样例。
 */
async function getProducts() {
  if (config.dataSource === 'mock') return { products: mock.getMockProducts(), source: 'mock' };
  if (config.dataSource === 'chinawealth') {
    const recs = await fetchRawRecords();
    return { products: recs.map(normalizeRecord).filter(Boolean), source: 'chinawealth' };
  }
  // auto
  try {
    const recs = await fetchRawRecords();
    const products = recs.map(normalizeRecord).filter(Boolean);
    if (products.length === 0) throw new Error('真实抓取返回空');
    return { products, source: 'chinawealth' };
  } catch (e) {
    console.warn('[chinawealth] 真实抓取失败，回退样例数据:', e.message);
    return { products: mock.getMockProducts(), source: 'mock(fallback)' };
  }
}

module.exports = {
  getProducts,
  enrichProducts,
  fetchProductDetail,
  // 导出供测试/复用
  _internal: { normalizeRiskLevel, parseTermDays, deriveRedeem, normalizeRecord, buildSearchBody, matchBank, extractSellers },
};
