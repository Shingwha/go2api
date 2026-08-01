'use strict';

/**
 * OpenCode Go 模型目录
 * 本地价格表: 人工维护（来源 https://opencode.ai/docs/zh-cn/go/，每 1M tokens，美元）
 * 动态同步: 启动时用 GO_API_KEY 请求 {GO_BASE_URL}/models，上游新增的模型自动合入
 *           （价格按同族继承或默认值估算，记账优先用上游 inference-cost 事件真实成本）
 * endpoint: chat  -> /v1/chat/completions (OpenAI 兼容)
 *           responses -> /v1/responses (OpenAI Responses API)
 *           messages -> /v1/messages (Anthropic 兼容)
 *           any    -> 动态模型，不强制端点
 * highThreshold: 上下文超过该 token 数时使用高价档（high* 字段）
 */
const MODELS = {
  'grok-4.5':          { endpoint: 'chat/completions',      in: 2.00, out: 6.00, cacheRead: 0.30,  cacheWrite: 0 },
  'gpt-5.6-luna':      { endpoint: 'responses', in: 0.20, out: 1.20, cacheRead: 0.02,  cacheWrite: 0.25,
                         highThreshold: 272000, inHigh: 0.40, outHigh: 1.80, cacheReadHigh: 0.04, cacheWriteHigh: 0.50 },
  'glm-5.2':           { endpoint: 'chat/completions',      in: 1.40, out: 4.40, cacheRead: 0.26,  cacheWrite: 0 },
  'glm-5.1':           { endpoint: 'chat/completions',      in: 1.40, out: 4.40, cacheRead: 0.26,  cacheWrite: 0 },
  'kimi-k3':           { endpoint: 'chat/completions',      in: 3.00, out: 15.00, cacheRead: 0.30, cacheWrite: 0 },
  'kimi-k2.7-code':    { endpoint: 'chat/completions',      in: 0.95, out: 4.00, cacheRead: 0.19,  cacheWrite: 0 },
  'kimi-k2.6':         { endpoint: 'chat/completions',      in: 0.95, out: 4.00, cacheRead: 0.16,  cacheWrite: 0 },
  'mimo-v2.5':         { endpoint: 'chat/completions',      in: 0.14, out: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
  'mimo-v2.5-pro':     { endpoint: 'chat/completions',      in: 0.435, out: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
  'minimax-m3':        { endpoint: 'messages',  in: 0.30, out: 1.20, cacheRead: 0.06,  cacheWrite: 0 },
  'minimax-m2.7':      { endpoint: 'messages',  in: 0.30, out: 1.20, cacheRead: 0.06,  cacheWrite: 0.375 },
  'minimax-m2.5':      { endpoint: 'messages',  in: 0.30, out: 1.20, cacheRead: 0.06,  cacheWrite: 0.375 },
  'qwen3.7-max':       { endpoint: 'messages',  in: 2.50, out: 7.50, cacheRead: 0.50,  cacheWrite: 3.125 },
  'qwen3.7-plus':      { endpoint: 'messages',  in: 0.40, out: 1.60, cacheRead: 0.04,  cacheWrite: 0.50,
                         highThreshold: 256000, inHigh: 1.20, outHigh: 4.80, cacheReadHigh: 0.12, cacheWriteHigh: 1.50 },
  'qwen3.6-plus':      { endpoint: 'messages',  in: 0.50, out: 3.00, cacheRead: 0.05,  cacheWrite: 0.625,
                         highThreshold: 256000, inHigh: 2.00, outHigh: 6.00, cacheReadHigh: 0.20, cacheWriteHigh: 2.50 },
  'deepseek-v4-pro':   { endpoint: 'chat/completions',      in: 0.435, out: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
  'deepseek-v4-flash': { endpoint: 'chat/completions',      in: 0.14, out: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
  'hy3':               { endpoint: 'chat/completions',      in: 0.14, out: 0.58, cacheRead: 0.035, cacheWrite: 0 },
  // 上游实际提供、文档未列出的新模型（价格暂参照同类模型，记账优先用上游 inference-cost 事件）
  'kimi-k2.5':         { endpoint: 'chat/completions', in: 0.95, out: 4.00, cacheRead: 0.16, cacheWrite: 0 },
  'glm-5':             { endpoint: 'chat/completions', in: 1.40, out: 4.40, cacheRead: 0.26, cacheWrite: 0 },
  'qwen3.5-plus':      { endpoint: 'messages', in: 0.50, out: 3.00, cacheRead: 0.05, cacheWrite: 0.625 },
  'mimo-v2-pro':       { endpoint: 'chat/completions', in: 0.435, out: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
  'mimo-v2-omni':      { endpoint: 'chat/completions', in: 0.14, out: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
  'hy3-preview':       { endpoint: 'chat/completions', in: 0.14, out: 0.58, cacheRead: 0.035, cacheWrite: 0 },
};

// 客户端可能携带的模型名前缀（OpenCode 配置中为 opencode-go/<id>）
const PREFIXES = ['opencode-go/', 'opencode-go-'];

/**
 * 归一化模型 ID：去掉 opencode-go/ 前缀，返回裸 ID
 */
function normalizeModel(raw) {
  if (typeof raw !== 'string') return '';
  let m = raw.trim();
  for (const p of PREFIXES) {
    if (m.startsWith(p)) { m = m.slice(p.length); break; }
  }
  return m;
}

/**
 * 判断模型是否全局启用（ENABLED_MODELS 白名单，空 = 全开）
 */
function isGloballyEnabled(model) {
  const cfg = require('./config');
  return cfg.enabledModels.length === 0 || cfg.enabledModels.includes(model);
}

// ---------- 上游动态同步 ----------

// 上游有、本地价格表没有的模型（价格估算，端点不强制）
const remoteModels = new Map();

const REMOTE_DEFAULT_PRICE = { in: 0.5, out: 1.5, cacheRead: 0.1, cacheWrite: 0, estimated: true };

/**
 * 合并后的完整模型目录：本地价格表 + 上游动态模型。
 * 每条额外带 source: 'local' | 'remote'，remote 模型带 estimated: true
 */
function getModelCatalog() {
  const out = { ...MODELS };
  for (const [id, m] of remoteModels) out[id] = m;
  return out;
}

// 按模型 ID 前缀找同族本地模型（如 'kimi-x' → 'kimi-k2.6'），用于价格估算
function familyPriceOf(id) {
  const dash = id.indexOf('-');
  const family = dash > 0 ? id.slice(0, dash) : id;
  const cands = Object.keys(MODELS).filter((m) => m.startsWith(family + '-'));
  if (!cands.length) return null;
  // 取价格最低的同族模型作为保守估算
  return cands.map((m) => MODELS[m]).sort((a, b) => (a.in + a.out) - (b.in + b.out))[0];
}

/**
 * 用 GO_API_KEY 请求 {GO_BASE_URL}/models，把上游新增模型合入目录。
 * 失败时静默降级（保留本地表），不影响启动。
 */
async function syncModelsFromUpstream() {
  const config = require('./config');
  if (!config.goApiKey) return { ok: false, reason: 'no GO_API_KEY' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${config.goBaseUrl}/models`, {
      headers: { authorization: `Bearer ${config.goApiKey}` },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const j = await res.json();
    const ids = (j.data || []).map((m) => m.id).filter(Boolean);
    let added = 0;
    for (const id of ids) {
      if (MODELS[id] || remoteModels.has(id)) continue; // 本地已有 → 用本地价格
      const fam = familyPriceOf(id);
      remoteModels.set(id, fam
        ? { endpoint: 'any', in: fam.in, out: fam.out, cacheRead: fam.cacheRead, cacheWrite: fam.cacheWrite, estimated: true }
        : { endpoint: 'any', ...REMOTE_DEFAULT_PRICE });
      added++;
    }
    return { ok: true, total: ids.length, added };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = { MODELS, getModelCatalog, normalizeModel, isGloballyEnabled, syncModelsFromUpstream };
