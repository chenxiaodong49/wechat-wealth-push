'use strict';
/**
 * 微信接口封装：access_token 获取（带缓存）、code2session 登录、订阅消息发送。
 */
const config = require('./config');

let tokenCache = { token: null, expireAt: 0 };

const API = 'https://api.weixin.qq.com';

/** 获取并缓存 access_token（提前 5 分钟过期） */
async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expireAt - 5 * 60 * 1000) {
    return tokenCache.token;
  }
  const url = `${API}/cgi-bin/token?grant_type=client_credential&appid=${config.wechat.appId}&secret=${config.wechat.appSecret}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('获取 access_token 失败: ' + JSON.stringify(json));
  }
  tokenCache = { token: json.access_token, expireAt: now + (json.expires_in || 7200) * 1000 };
  return json.access_token;
}

/** 小程序登录：用 wx.login 拿到的 code 换取 openid */
async function code2Session(code) {
  const url = `${API}/sns/jscode2session?appid=${config.wechat.appId}&secret=${config.wechat.appSecret}&js_code=${encodeURIComponent(
    code
  )}&grant_type=authorization_code`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.openid) {
    throw new Error('code2session 失败: ' + JSON.stringify(json));
  }
  return json; // { openid, session_key, unionid?, errcode? }
}

/**
 * 构造订阅消息 data。字段名需与你在微信公众平台申请的模板关键字顺序一致。
 * 默认模板建议包含 4 个关键字：产品数量 / 适用银行 / 起售日期 / 温馨提示。
 */
function buildSubscribeData(summary) {
  const tip =
    summary.count > 0
      ? `发现${summary.count}只R1/R2低风险·半年内可赎回新品`
      : '未来3天内暂无符合条件的低风险投资';
  return {
    keyword1: { value: summary.count > 0 ? `${summary.count}只` : '0只' },
    keyword2: { value: summary.bankText },
    keyword3: { value: summary.dateRange },
    keyword4: { value: tip },
  };
}

/** 发送订阅消息给单个用户 */
async function sendSubscribeMessage(openid, summary) {
  const token = await getAccessToken();
  const url = `${API}/cgi-bin/message/subscribe/send?access_token=${token}`;
  const payload = {
    touser: openid,
    template_id: config.wechat.subscribeTemplateId,
    page: config.wechat.subscribePage,
    data: buildSubscribeData(summary),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  // errcode 0 为成功；43101=用户未订阅；'ok' 也算成功（部分版本）
  if (json.errcode && json.errcode !== 0) {
    const err = new Error('订阅消息发送失败: ' + JSON.stringify(json));
    err.errcode = json.errcode;
    throw err;
  }
  return json;
}

module.exports = { getAccessToken, code2Session, sendSubscribeMessage, buildSubscribeData };
