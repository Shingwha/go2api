'use strict';

const crypto = require('node:crypto');
const db = require('./db');
const config = require('./config');
const { MODELS } = require('./prices');

// ---------- 工具 ----------

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function genKey() {
  return 'sk-go2api-' + crypto.randomBytes(24).toString('base64url');
}

// ---------- 路由 ----------

async function handleAdmin(req, res, pathParts) {
  const method = req.method;
  const [a, b] = pathParts; // a = 'subs' | 'usage' | 'stats' | 'models', b = id

  // POST /admin/subs — 创建订阅
  if (method === 'POST' && a === 'subs' && !b) {
    let f;
    try { f = await readJsonBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    if (!f.name) return json(res, 400, { error: 'name is required' });
    const sub = db.createSubscription({
      name: String(f.name),
      key: genKey(),
      status: f.status === 'disabled' ? 'disabled' : 'active',
      models: f.models ? (Array.isArray(f.models) ? JSON.stringify(f.models) : String(f.models)) : '*',
      quotaUsd: f.quotaUsd !== undefined ? (parseFloat(f.quotaUsd) || 0) : config.defaultQuotaUsd,
      quotaRequests: parseInt(f.quotaRequests, 10) || 0,
      rpm: f.rpm !== undefined ? (parseInt(f.rpm, 10) || 0) : config.defaultRpm,
      rpd: parseInt(f.rpd, 10) || 0,
      expiresAt: f.expiresAt || null,
      note: f.note || '',
    });
    return json(res, 201, { ok: true, subscription: sub });
  }

  // GET /admin/subs — 订阅列表
  if (method === 'GET' && a === 'subs' && !b) {
    return json(res, 200, { subscriptions: db.listSubscriptions() });
  }

  // GET /admin/subs/:id — 详情 + 最近用量
  if (method === 'GET' && a === 'subs' && b) {
    const sub = db.getSubscriptionById(Number(b));
    if (!sub) return json(res, 404, { error: 'subscription not found' });
    return json(res, 200, { subscription: sub, usage: db.usageLogs(sub.id, 20) });
  }

  // PATCH /admin/subs/:id — 更新（含换 key）
  if (method === 'PATCH' && a === 'subs' && b) {
    let f;
    try { f = await readJsonBody(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
    const id = Number(b);
    const cur = db.getSubscriptionById(id);
    if (!cur) return json(res, 404, { error: 'subscription not found' });
    const fields = {};
    if (f.name !== undefined) fields.name = String(f.name);
    if (f.status !== undefined) fields.status = f.status === 'disabled' ? 'disabled' : 'active';
    if (f.models !== undefined) fields.models = Array.isArray(f.models) ? JSON.stringify(f.models) : String(f.models);
    if (f.quotaUsd !== undefined) fields.quota_usd = parseFloat(f.quotaUsd) || 0;
    if (f.quotaRequests !== undefined) fields.quota_requests = parseInt(f.quotaRequests, 10) || 0;
    if (f.rpm !== undefined) fields.rpm = parseInt(f.rpm, 10) || 0;
    if (f.rpd !== undefined) fields.rpd = parseInt(f.rpd, 10) || 0;
    if (f.expiresAt !== undefined) fields.expires_at = f.expiresAt || null;
    if (f.note !== undefined) fields.note = String(f.note || '');
    if (f.rotateKey) fields.key = genKey();
    const sub = db.updateSubscription(id, fields);
    return json(res, 200, { ok: true, subscription: sub });
  }

  // POST /admin/subs/:id/reset — 重置用量
  if (method === 'POST' && a === 'subs' && b && pathParts[2] === 'reset') {
    const id = Number(b);
    if (!db.getSubscriptionById(id)) return json(res, 404, { error: 'subscription not found' });
    db.resetUsage(id);
    return json(res, 200, { ok: true, subscription: db.getSubscriptionById(id) });
  }

  // DELETE /admin/subs/:id — 删除
  if (method === 'DELETE' && a === 'subs' && b) {
    db.deleteSubscription(Number(b));
    return json(res, 200, { ok: true });
  }

  // GET /admin/usage — 用量日志
  if (method === 'GET' && a === 'usage') {
    const url = new URL(req.url, 'http://x');
    const subId = url.searchParams.get('sub_id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    return json(res, 200, { usage: db.usageLogs(subId ? Number(subId) : null, Math.min(limit, 500)) });
  }

  // GET /admin/timeseries?days=30 — 消费趋势原始数据（前端按本地时区聚合）
  if (method === 'GET' && a === 'timeseries') {
    const url = new URL(req.url, 'http://x');
    const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10) || 30, 90);
    return json(res, 200, { days, usage: db.usageSince(days) });
  }

  // GET /admin/stats — 总览
  if (method === 'GET' && a === 'stats') {
    return json(res, 200, db.stats());
  }

  // GET /admin/models — 模型目录与价格
  if (method === 'GET' && a === 'models') {
    return json(res, 200, { models: MODELS });
  }

  return json(res, 404, { error: 'not found' });
}

module.exports = { handleAdmin, genKey };
