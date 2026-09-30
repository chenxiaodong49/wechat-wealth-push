'use strict';
/**
 * 定时任务：每天按计划抓取产品 -> 筛选 -> 给已订阅用户发送订阅消息。
 * 同时维护一份“当前合格产品”缓存，供小程序 /api/products 直接读取。
 */
const cron = require('node-cron');
const config = require('./config');
const pipeline = require('./pipeline');
const wechat = require('./wechat');
const store = require('./store');

let cache = { updatedAt: null, products: [], summary: null, source: null };

/** 刷新产品缓存：抓取 +（补全销售机构）+ 全条件筛选 */
async function refreshProducts() {
  const data = await pipeline.getEligibleProducts();
  cache = {
    updatedAt: new Date().toISOString(),
    products: data.products,
    summary: data.summary,
    source: data.source,
    totalFetched: data.totalFetched,
  };
  return cache;
}

function getCachedProducts() {
  return cache;
}

/** 执行一次推送（供定时任务与手动触发共用） */
async function runPushNow() {
  if (!cache.products.length) await refreshProducts();
  const summary = cache.summary || filter.buildSummary(cache.products);
  const subscribers = store.listSubscribers();

  const result = { total: subscribers.length, sent: 0, failed: 0, skipped: 0, details: [] };

  // 没有符合条件的产品时不打扰用户
  if (cache.products.length === 0) {
    result.skipped = subscribers.length;
    return result;
  }

  for (const user of subscribers) {
    try {
      await wechat.sendSubscribeMessage(user.openid, summary);
      result.sent++;
      result.details.push({ openid: user.openid, ok: true });
    } catch (e) {
      result.failed++;
      result.details.push({ openid: user.openid, ok: false, err: e.errcode || e.message });
    }
  }
  return result;
}

let task = null;
function startScheduler() {
  if (task) return task;
  // 启动时先刷新一次缓存
  refreshProducts().catch((e) => console.error('[scheduler] 初始刷新失败:', e.message));
  task = cron.schedule(config.pushCron, () => {
    console.log('[scheduler] 触发每日推送', new Date().toISOString());
    runPushNow()
      .then((r) => console.log('[scheduler] 推送完成:', JSON.stringify(r)))
      .catch((e) => console.error('[scheduler] 推送异常:', e.message));
  });
  console.log('[scheduler] 已按 cron 启动:', config.pushCron);
  return task;
}

module.exports = { startScheduler, runPushNow, refreshProducts, getCachedProducts };
