'use strict';

const config = require('./config');
const db = require('./db');
const { getModelCatalog, normalizeModel, isGloballyEnabled } = require('./prices');
const { calcCost, parseUsage, parseUsageFromLine, estimateUsage } = require('./billing');
const { checkRpm } = require('./ratelimit');

// ---------- 错误响应（OpenAI 兼容格式） ----------

function sendError(res, status, code, message) {
  const body = JSON.stringify({
    error: { message, type: 'invalid_request_error', code, param: null },
  });
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------- 认证 ----------

function authenticate(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

function loadSubscription(req) {
  const key = authenticate(req);
  if (!key) return null;
  return db.getSubscriptionByKey(key);
}

// ---------- 预检 ----------

function preflight(sub, model, res) {
  if (!sub) {
    sendError(res, 401, 'invalid_api_key', 'Invalid API key.');
    return false;
  }
  if (sub.status !== 'active') {
    sendError(res, 403, 'subscription_disabled', 'Subscription is disabled.');
    return false;
  }
  if (sub.expired) {
    sendError(res, 403, 'subscription_expired', 'Subscription has expired.');
    return false;
  }
  // 模型权限：订阅白名单
  if (sub.modelsList !== '*') {
    if (!sub.modelsList.includes(model)) {
      sendError(res, 403, 'model_not_allowed',
        `Model '${model}' is not allowed for this subscription.`);
      return false;
    }
  }
  // 美元额度
  if (sub.remainingUsd !== null && sub.remainingUsd <= 0) {
    sendError(res, 403, 'quota_exceeded',
      'Monthly quota exceeded. Please contact the administrator.');
    return false;
  }
  // 请求数额度
  if (sub.remainingRequests !== null && sub.remainingRequests <= 0) {
    sendError(res, 403, 'quota_exceeded',
      'Request quota exceeded. Please contact the administrator.');
    return false;
  }
  // RPM（内存）
  if (!checkRpm(sub.id, sub.rpm)) {
    sendError(res, 429, 'rate_limit_exceeded', 'Too many requests per minute.');
    return false;
  }
  // RPD（按今天已成功请求数）
  if (sub.rpd > 0 && db.countRequestsToday(sub.id) >= sub.rpd) {
    sendError(res, 429, 'rate_limit_exceeded', 'Daily request limit reached.');
    return false;
  }
  return true;
}

// ---------- 请求体 ----------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 50 * 1024 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
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

// ---------- 主入口 ----------

/**
 * endpoint: 'chat/completions' | 'responses' | 'messages'
 */
async function handleProxy(req, res, endpoint) {
  const sub = loadSubscription(req);
  const model = normalizeModel((req.body || {}).model);

  // 读取 body
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendError(res, 400, 'invalid_request_error', 'Invalid JSON body.');
  }
  req.body = body;

  const modelRaw = body.model;
  const normalized = normalizeModel(modelRaw);
  if (!normalized) {
    return sendError(res, 400, 'invalid_request_error', 'Missing required field "model".');
  }
  const catalog = getModelCatalog();
  if (!catalog[normalized]) {
    return sendError(res, 400, 'model_not_found',
      `Model '${modelRaw}' is not available on OpenCode Go.`);
  }
  if (!isGloballyEnabled(normalized)) {
    return sendError(res, 403, 'model_not_allowed',
      `Model '${modelRaw}' is disabled by the gateway administrator.`);
  }
  // 协议端点必须匹配模型的 endpoint（防止绕过）；动态模型 endpoint='any' 不强制
  if (catalog[normalized].endpoint !== 'any' && catalog[normalized].endpoint !== endpoint) {
    return sendError(res, 400, 'invalid_request_error',
      `Model '${modelRaw}' must be called via /v1/${catalog[normalized].endpoint}.`);
  }
  if (!preflight(sub, normalized, res)) return;

  // 转发时使用裸模型 ID
  body.model = normalized;

  // 强制上游返回 usage（OpenAI 兼容流式）
  if (body.stream && endpoint === 'chat/completions') {
    body.stream_options = { ...(body.stream_options || {}), include_usage: true };
  }

  const upstreamUrl = `${config.goBaseUrl}/${endpoint}`;
  const commonHeaders = {
    'content-type': 'application/json',
    'accept': body.stream ? 'text/event-stream' : 'application/json',
    'user-agent': 'go2api/1.0',
  };
  // 认证头：anthropic 兼容端点用 x-api-key，其余用 Bearer
  const upstreamHeaders = endpoint === 'messages'
    ? { ...commonHeaders, 'x-api-key': config.goApiKey, 'anthropic-version': '2023-06-01' }
    : { ...commonHeaders, 'authorization': `Bearer ${config.goApiKey}` };

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });
  } catch (e) {
    db.addUsage(sub.id, {
      model: normalized, endpoint, stream: !!body.stream,
      status: 'error', error: `upstream_unreachable: ${e.message}`,
    });
    return sendError(res, 502, 'upstream_error', 'Upstream gateway unreachable.');
  }

  // 上游错误：透传状态与错误体
  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => '');
    db.addUsage(sub.id, {
      model: normalized, endpoint, stream: !!body.stream,
      status: 'error', error: `upstream_${upstreamRes.status}: ${errText.slice(0, 300)}`,
    });
    res.writeHead(upstreamRes.status, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(errText || JSON.stringify({ error: { message: `Upstream error ${upstreamRes.status}` } }));
  }

  if (body.stream) {
    await forwardStream(upstreamRes, res, sub, normalized, endpoint, body);
  } else {
    await forwardJson(upstreamRes, res, sub, normalized, endpoint, body);
  }
}

// ---------- 非流式转发 ----------

async function forwardJson(upstreamRes, res, sub, model, endpoint, body) {
  const text = await upstreamRes.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch { /* 响应不是 JSON 也原样透传 */ }

  const { usage, cost } = parseUsage(parsed, endpoint);
  const finalUsage = usage || estimateUsage(body, model);
  const costUsd = cost !== null && cost > 0 ? cost : calcCost(model, finalUsage);
  const estimated = !usage;

  db.addUsage(sub.id, {
    model, endpoint, stream: false,
    inputTokens: finalUsage.input, outputTokens: finalUsage.output,
    cachedTokens: finalUsage.cached, cacheWriteTokens: finalUsage.cacheWrite,
    costUsd, estimated,
  });

  const ct = upstreamRes.headers.get('content-type') || 'application/json';
  res.writeHead(upstreamRes.status, { 'content-type': ct });
  res.end(text);
}

// ---------- 流式转发（SSE 透传 + usage 解析） ----------

async function forwardStream(upstreamRes, res, sub, model, endpoint, body) {
  const ct = upstreamRes.headers.get('content-type') || 'text/event-stream';
  res.writeHead(200, {
    'content-type': ct,
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
  });

  let usage = null;
  let upstreamCost = null;
  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  const finish = () => {
    // 记账：优先用上游 usage / cost（inference-cost 事件），缺失则估算
    let inputTokens = 0, outputTokens = 0, cachedTokens = 0, cacheWriteTokens = 0, costUsd = 0, estimated = 0;
    if (usage) {
      inputTokens = usage.input; outputTokens = usage.output;
      cachedTokens = usage.cached; cacheWriteTokens = usage.cacheWrite;
      costUsd = upstreamCost !== null && upstreamCost > 0 ? upstreamCost : calcCost(model, usage);
    } else {
      const est = estimateUsage(body, model);
      inputTokens = est.input; outputTokens = est.output;
      cachedTokens = est.cached; cacheWriteTokens = est.cacheWrite;
      costUsd = calcCost(model, est);
      estimated = 1;
    }
    db.addUsage(sub.id, {
      model, endpoint, stream: true,
      inputTokens, outputTokens, cachedTokens, cacheWriteTokens,
      costUsd, estimated,
    });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const parsed = parseUsageFromLine(line, endpoint);
        if (parsed) {
          if (parsed.usage && !usage) usage = parsed.usage;
          if (parsed.cost !== null) upstreamCost = parsed.cost;
        }
        res.write(line + '\n');
      }
    }
    if (buf.length) {
      const parsed = parseUsageFromLine(buf, endpoint);
      if (parsed) {
        if (parsed.usage && !usage) usage = parsed.usage;
        if (parsed.cost !== null) upstreamCost = parsed.cost;
      }
      res.write(buf);
    }
  } catch (e) {
    // 客户端断开等：仍按已收到的 usage 记账
  } finally {
    finish();
    res.end();
  }
}

// ---------- /v1/models ----------

function handleModels(req, res, withAuth) {
  // OpenAI 兼容列表格式
  const data = Object.keys(getModelCatalog())
    .filter((m) => isGloballyEnabled(m))
    .filter((m) => {
      if (!withAuth || !req.sub) return true;
      return req.sub.modelsList === '*' || req.sub.modelsList.includes(m);
    })
    .map((id) => ({
      id,
      object: 'model',
      created: 0,
      owned_by: 'opencode-go',
    }));
  const body = JSON.stringify({ object: 'list', data });
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

module.exports = { handleProxy, handleModels, loadSubscription, authenticate };
