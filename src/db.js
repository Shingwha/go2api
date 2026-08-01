'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  key           TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active',        -- active / disabled
  models        TEXT NOT NULL DEFAULT '*',             -- '*' 或 JSON 数组
  quota_usd     REAL NOT NULL DEFAULT 0,               -- 0 = 不限
  used_usd      REAL NOT NULL DEFAULT 0,
  quota_requests INTEGER NOT NULL DEFAULT 0,           -- 0 = 不限
  used_requests INTEGER NOT NULL DEFAULT 0,
  rpm           INTEGER NOT NULL DEFAULT 0,            -- 0 = 不限
  rpd           INTEGER NOT NULL DEFAULT 0,            -- 0 = 不限
  expires_at    TEXT,                                  -- ISO 时间或 NULL
  note          TEXT DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_id       INTEGER NOT NULL,
  model        TEXT NOT NULL,
  endpoint     TEXT NOT NULL,
  stream       INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd     REAL NOT NULL DEFAULT 0,
  estimated    INTEGER NOT NULL DEFAULT 0,             -- 1 = usage 缺失，按估算计费
  status       TEXT NOT NULL DEFAULT 'ok',             -- ok / error / rejected
  error        TEXT DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_sub ON usage_logs (sub_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_logs (created_at);
`);

const now = () => new Date().toISOString();

// ---------- 订阅 ----------

function createSubscription(fields) {
  const stmt = db.prepare(`
    INSERT INTO subscriptions
      (name, key, status, models, quota_usd, quota_requests, rpm, rpd, expires_at, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const t = now();
  stmt.run(
    fields.name,
    fields.key,
    fields.status || 'active',
    fields.models || '*',
    fields.quotaUsd || 0,
    fields.quotaRequests || 0,
    fields.rpm || 0,
    fields.rpd || 0,
    fields.expiresAt || null,
    fields.note || '',
    t, t
  );
  return getSubscriptionByKey(fields.key);
}

function getSubscriptionByKey(key) {
  const row = db.prepare('SELECT * FROM subscriptions WHERE key = ?').get(key);
  return row ? decorate(row) : null;
}

function getSubscriptionById(id) {
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
  return row ? decorate(row) : null;
}

function listSubscriptions() {
  return db.prepare('SELECT * FROM subscriptions ORDER BY id DESC').all().map(decorate);
}

function updateSubscription(id, fields) {
  const allowed = ['name', 'status', 'models', 'quota_usd', 'quota_requests', 'rpm', 'rpd', 'expires_at', 'note', 'key'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = k; // 调用方传列名
    if (!allowed.includes(col)) continue;
    sets.push(`${col} = ?`);
    vals.push(v === '' ? null : v);
  }
  if (!sets.length) return getSubscriptionById(id);
  sets.push('updated_at = ?');
  vals.push(now(), id);
  db.prepare(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getSubscriptionById(id);
}

function deleteSubscription(id) {
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
}

function resetUsage(id) {
  db.prepare('UPDATE subscriptions SET used_usd = 0, used_requests = 0, updated_at = ? WHERE id = ?').run(now(), id);
}

// 事务：记录用量 + 累加订阅计数
function addUsage(subId, entry) {
  db.exec('BEGIN');
  try {
    const stmt = db.prepare(`
      INSERT INTO usage_logs
        (sub_id, model, endpoint, stream, input_tokens, output_tokens,
         cached_tokens, cache_write_tokens, cost_usd, estimated, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      subId, entry.model || '', entry.endpoint || '', entry.stream ? 1 : 0,
      entry.inputTokens || 0, entry.outputTokens || 0,
      entry.cachedTokens || 0, entry.cacheWriteTokens || 0,
      entry.costUsd || 0, entry.estimated ? 1 : 0,
      entry.status || 'ok', entry.error || '', now()
    );
    if ((entry.status || 'ok') === 'ok' && entry.costUsd) {
      db.prepare('UPDATE subscriptions SET used_usd = used_usd + ?, used_requests = used_requests + 1, updated_at = ? WHERE id = ?')
        .run(entry.costUsd, now(), subId);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// 今天的成功请求数（用于 RPD 限流）
function countRequestsToday(subId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM usage_logs WHERE sub_id = ? AND status = 'ok' AND created_at >= ?`
  ).get(subId, start.toISOString());
  return row.n;
}

function usageLogs(subId, limit = 50) {
  const rows = subId
    ? db.prepare('SELECT * FROM usage_logs WHERE sub_id = ? ORDER BY id DESC LIMIT ?').all(subId, limit)
    : db.prepare('SELECT * FROM usage_logs ORDER BY id DESC LIMIT ?').all(limit);
  return rows;
}

function stats() {
  const s = db.prepare(`
    SELECT
      COUNT(*) AS total_requests,
      COALESCE(SUM(cost_usd), 0) AS total_cost,
      COALESCE(SUM(input_tokens), 0) AS total_input,
      COALESCE(SUM(output_tokens), 0) AS total_output,
      COALESCE(SUM(cached_tokens), 0) AS total_cached
    FROM usage_logs WHERE status = 'ok'
  `).get();
  const byModel = db.prepare(`
    SELECT model, COUNT(*) AS requests, COALESCE(SUM(cost_usd),0) AS cost
    FROM usage_logs WHERE status = 'ok' GROUP BY model ORDER BY cost DESC
  `).all();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sToday = db.prepare(`
    SELECT COUNT(*) AS requests, COALESCE(SUM(cost_usd),0) AS cost
    FROM usage_logs WHERE status = 'ok' AND created_at >= ?
  `).get(today.toISOString());
  return { total: s, today: sToday, byModel };
}

// ---------- 工具 ----------

// 解析订阅的 models 字段为数组（'*' 表示全部）
function parseModelsField(models) {
  if (models === '*' || models == null) return '*';
  try {
    const arr = JSON.parse(models);
    return Array.isArray(arr) ? arr : '*';
  } catch {
    return '*';
  }
}

function decorate(row) {
  const sub = { ...row };
  sub.modelsList = parseModelsField(row.models);
  sub.remainingUsd = row.quota_usd > 0 ? Math.max(0, +(row.quota_usd - row.used_usd).toFixed(6)) : null;
  sub.remainingRequests = row.quota_requests > 0 ? Math.max(0, row.quota_requests - row.used_requests) : null;
  sub.expired = !!row.expires_at && Date.parse(row.expires_at) < Date.now();
  return sub;
}

module.exports = {
  db,
  createSubscription, getSubscriptionByKey, getSubscriptionById,
  listSubscriptions, updateSubscription, deleteSubscription, resetUsage,
  addUsage, countRequestsToday, usageLogs, stats,
  parseModelsField,
};
