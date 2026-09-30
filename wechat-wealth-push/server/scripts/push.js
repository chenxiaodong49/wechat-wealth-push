'use strict';
/**
 * 免服务器推送脚本（由 GitHub Actions 每天定时执行）。
 *
 * 它一次性完成三件事：
 *   1) 抓取 + 筛选「未来3天新发 · R1/R2 · 半年内可赎回 · 可在招行/中行/工行购买」的理财产品
 *   2) 把筛选结果写成 docs/products.json，供小程序通过 GitHub Pages 免费读取（无需后端服务器）
 *   3) 给 SUBSCRIBERS 里的每个 openid 发送微信订阅消息
 *
 * 所有配置均来自环境变量（在 GitHub 仓库 Settings → Secrets 里配置）：
 *   WX_APPID                小程序 AppID
 *   WX_APPSECRET            小程序 AppSecret
 *   WX_SUBSCRIBE_TEMPLATE_ID 订阅消息模板 ID
 *   SUBSCRIBERS             接收人 openid，多个用半角逗号分隔
 *   DATA_SOURCE            auto（默认，抓取失败回退样例）| chinawealth（仅真实，失败则推送“暂无”）| mock（仅样例）
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const pipeline = require('../src/pipeline');
const wechat = require('../src/wechat');

async function main() {
  // 1) 用环境变量覆盖配置（环境变量优先于 .env 占位）
  if (process.env.WX_APPID) config.wechat.appId = process.env.WX_APPID;
  if (process.env.WX_APPSECRET) config.wechat.appSecret = process.env.WX_APPSECRET;
  if (process.env.WX_SUBSCRIBE_TEMPLATE_ID) {
    config.wechat.subscribeTemplateId = process.env.WX_SUBSCRIBE_TEMPLATE_ID;
  }
  if (process.env.DATA_SOURCE) config.dataSource = process.env.DATA_SOURCE;

  const subscribers = (process.env.SUBSCRIBERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 2) 抓取 + 筛选
  let products = [];
  let summary = { count: 0, bankText: '暂无', dateRange: '' };
  let source = 'error';
  try {
    const r = await pipeline.getEligibleProducts();
    products = r.products;
    summary = r.summary;
    source = r.source;
  } catch (e) {
    console.error('[push] 抓取/筛选失败，按“暂无”处理:', e.message);
  }

  // 3) 写 docs/products.json（GitHub Pages 读取）
  const docsDir = path.join(__dirname, '..', '..', 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    source,
    count: products.length,
    summary,
    products,
  };
  fs.writeFileSync(path.join(docsDir, 'products.json'), JSON.stringify(payload, null, 2));
  console.log(`[push] 已生成 docs/products.json：合格 ${products.length} 只（source=${source}）`);

  // 4) 发送订阅消息
  if (subscribers.length === 0) {
    console.log('[push] 未配置 SUBSCRIBERS（接收人），仅更新了产品列表，未推送。');
    return;
  }
  let ok = 0;
  let fail = 0;
  for (const openid of subscribers) {
    try {
      await wechat.sendSubscribeMessage(openid, summary);
      ok++;
      console.log(`[push] 推送成功 -> ${openid}`);
    } catch (e) {
      fail++;
      console.error(`[push] 推送失败 -> ${openid}:`, e.message);
    }
  }
  console.log(`[push] 推送完成：成功 ${ok}，失败 ${fail}，共 ${subscribers.length} 人`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[push] 致命错误:', e);
    process.exit(1);
  });
