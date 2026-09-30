'use strict';
const path = require('path');
// 显式加载 server/.env，保证无论从哪个目录启动（npm start / docker / start.sh）都能读到配置
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * 全局配置。所有敏感/环境相关的值都从环境变量读取，便于本地占位、上线替换。
 */
const config = {
  port: Number(process.env.PORT) || 3000,

  wechat: {
    appId: process.env.WX_APPID || 'wxYOUR_APPID',
    appSecret: process.env.WX_APPSECRET || 'YOUR_APPSECRET',
    // 订阅消息模板 ID（在微信公众平台申请）。字段映射见 wechat.js -> buildSubscribeData
    subscribeTemplateId: process.env.WX_SUBSCRIBE_TEMPLATE_ID || 'YOUR_SUBSCRIBE_TEMPLATE_ID',
    // 小程序内跳转型订阅消息点击后进入的页面（产品列表页）
    subscribePage: 'pages/index/index',
  },

  // 数据源策略：auto | chinawealth | mock
  dataSource: process.env.DATA_SOURCE || 'auto',

  chinaWealth: {
    baseUrl: 'https://www.chinawealth.com.cn/lcw-fe-service',
    searchPath: '/prod/search',
    // 详情接口（本服务未直接使用，预留）
    detailPath: '/prodInfo/getProductDetail',
  },

  // 目标「购买渠道」：用户在招行/中行/工行 APP 里能买到的产品（含这三家代销的其他机构产品）。
  // 匹配维度 = 销售机构（购买渠道），而非发行机构。
  //   sellerKeywords：匹配「销售机构」名称（如“招商银行”）。代销产品的发行机构是别家，但销售机构是这三家之一，照样命中。
  //   issuerKeywords：当接口未返回销售机构时的兜底，按「发行机构」名称匹配三家理财子公司（招银理财/中银理财/工银理财）。
  banks: [
    { code: 'CMB', name: '招商银行', sellerKeywords: ['招商银行', '招行'], issuerKeywords: ['招银理财'] },
    { code: 'BOC', name: '中国银行', sellerKeywords: ['中国银行', '中行'], issuerKeywords: ['中银理财'] },
    { code: 'ICBC', name: '工商银行', sellerKeywords: ['工商银行', '工行'], issuerKeywords: ['工银理财'] },
  ],

  // 风险等级白名单
  riskLevels: ['R1', 'R2'],

  // “可赎回时间不超过半年” -> 180 天
  maxRedeemDays: 180,

  // “未来 3 天内新开” -> 起售日落在 [今天, 今天+3] 区间
  lookaheadDays: 3,

  // 每日推送 cron（默认每天 09:00）
  pushCron: process.env.PUSH_CRON || '0 9 * * *',

  // 产品列表缓存时长
  cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 6 * 60 * 60 * 1000,

  // 手动触发推送的安全密钥
  pushSecret: process.env.PUSH_SECRET || 'change_me',

  // 订阅用户存储文件（生产环境请替换为数据库）
  subscribersFile: require('path').join(__dirname, '..', 'data', 'subscribers.json'),
};

module.exports = config;
