'use strict';
/**
 * 后端 API 服务（Express）。
 * 提供：小程序登录、产品列表、订阅登记、手动触发推送。
 */
const fs = require('fs');
const path = require('path');

// 新手友好：若没有 .env，自动从 .env.example 复制一份，避免启动即因缺失配置报错。
const envPath = path.join(__dirname, '..', '.env');
const envExample = path.join(__dirname, '..', '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envPath);
  console.log('[server] 已根据 .env.example 自动生成 .env，请按需修改其中的 AppID/AppSecret 等。');
}

const express = require('express');
const config = require('./config');
const wechat = require('./wechat');
const store = require('./store');
const scheduler = require('./scheduler');
const filter = require('./filter');

const app = express();
app.use(express.json());

// 简单静态说明（根路径）
app.get('/', (req, res) => {
  res.json({ name: 'wechat-wealth-push', status: 'ok', docs: '/api/health' });
});

app.get('/api/health', (req, res) => {
  const c = scheduler.getCachedProducts();
  res.json({
    status: 'ok',
    dataSource: config.dataSource,
    cachedProducts: c.products.length,
    cachedAt: c.updatedAt,
    subscribers: store.listSubscribers().length,
  });
});

/**
 * 小程序登录：用 wx.login 的 code 换取 openid。
 * 为方便本地无 AppID 联调，也支持直接传 { openid }（仅开发/演示用）。
 */
app.post('/api/login', async (req, res) => {
  try {
    let openid = req.body && req.body.openid;
    if (!openid && req.body && req.body.code) {
      const sess = await wechat.code2Session(req.body.code);
      openid = sess.openid;
    }
    if (!openid) {
      return res.status(400).json({ error: '缺少 code 或 openid' });
    }
    const user = store.upsertSubscriber(openid, { lastLoginAt: new Date().toISOString() });
    res.json({ openid: user.openid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 订阅登记：用户在端内点击“允许”后调用，标记 subscribed=true */
app.post('/api/subscribe', (req, res) => {
  const openid = req.body && (req.body.openid || (req.body.userInfo && req.body.userInfo.openid));
  if (!openid) return res.status(400).json({ error: '缺少 openid' });
  store.setSubscribed(openid, true);
  res.json({ ok: true, openid });
});

/**
 * 产品列表（已按需求筛选：R1/R2 + 半年内可赎回 + 未来3天新发）。
 * 支持客户端二次筛选：?bank=CMB&risk=R2
 * 若缓存为空或过期则先刷新。
 */
app.get('/api/products', async (req, res) => {
  try {
    let cache = scheduler.getCachedProducts();
    const stale = !cache.updatedAt || Date.now() - new Date(cache.updatedAt).getTime() > config.cacheTtlMs;
    if (cache.products.length === 0 || stale) {
      cache = await scheduler.refreshProducts();
    }
    let products = cache.products;
    const { bank, risk } = req.query;
    if (bank) products = products.filter((p) => p.bankCode === bank);
    if (risk) products = products.filter((p) => p.riskLevel === risk);

    res.json({
      updatedAt: cache.updatedAt,
      source: cache.source,
      totalFetched: cache.totalFetched,
      filters: { riskLevels: config.riskLevels, maxRedeemDays: config.maxRedeemDays, lookaheadDays: config.lookaheadDays },
      count: products.length,
      products,
      summary: filter.buildSummary(products),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 手动触发推送（需安全密钥），用于调试/上线验证 */
app.get('/api/trigger-push', async (req, res) => {
  if (req.query.secret !== config.pushSecret) {
    return res.status(403).json({ error: 'secret 错误' });
  }
  try {
    const result = await scheduler.runPushNow();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * 预览“今日会推送的内容”（不真正发送）。新手无需配置微信即可验证筛选结果。
 * 返回当前合格产品、分组概览、以及将要下发的订阅消息 data。
 */
app.get('/api/preview-push', async (req, res) => {
  try {
    let cache = scheduler.getCachedProducts();
    const stale = !cache.updatedAt || Date.now() - new Date(cache.updatedAt).getTime() > config.cacheTtlMs;
    if (cache.products.length === 0 || stale) {
      cache = await scheduler.refreshProducts();
    }
    const summary = cache.summary || filter.buildSummary(cache.products);
    res.json({
      source: cache.source,
      count: cache.products.length,
      products: cache.products,
      summary,
      subscribeMessage: wechat.buildSubscribeData(summary),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 启动
if (require.main === module) {
  scheduler.startScheduler();
  app.listen(config.port, () => {
    console.log(`[server] 监听 http://localhost:${config.port}`);
    console.log(`[server] 数据源=${config.dataSource} 推送cron=${config.pushCron}`);
  });
}

module.exports = app;
