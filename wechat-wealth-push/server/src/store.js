'use strict';
/**
 * 订阅用户存储（JSON 文件版）。生产环境请替换为数据库（Redis/MySQL 等）。
 * 仅保存已登录用户的 openid 与订阅状态，用于定时推送时逐一发送订阅消息。
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = config.subscribersFile;

function ensureDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch (e) {
    console.warn('[store] 读取订阅文件失败，重置:', e.message);
    return {};
  }
}

function save(map) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(map, null, 2), 'utf-8');
}

/** 写入/更新一个订阅用户 */
function upsertSubscriber(openid, patch = {}) {
  const map = load();
  const prev = map[openid] || {};
  map[openid] = {
    openid,
    subscribed: prev.subscribed || false,
    createdAt: prev.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  save(map);
  return map[openid];
}

/** 设置订阅状态（用户在端内点过“允许”后调用） */
function setSubscribed(openid, subscribed) {
  return upsertSubscriber(openid, { subscribed: !!subscribed });
}

/** 列出已订阅用户（subscribed=true） */
function listSubscribers() {
  const map = load();
  return Object.values(map).filter((u) => u.subscribed);
}

module.exports = { upsertSubscriber, setSubscribed, listSubscribers, load };
