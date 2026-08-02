'use strict';

const { getModelCatalog } = require('./prices');

/**
 * 根据 usage 计算美元成本。
 * usage 已归一化为 { input, output, cached, cacheWrite }，其中 input 为
 * 「不含缓存的净输入」（extractUsage/parseUsage 归一化时已扣除 cached 与 cacheWrite，
 * 避免缓存 token 被重复计费）。
 */
function calcCost(model, u) {
  const p = getModelCatalog()[model];
  if (!p || !u) return 0;

  const input = u.input || 0;
  const output = u.output || 0;
  const cached = u.cached || 0;
  const cacheWrite = u.cacheWrite || 0;

  // 长上下文档位（如 GPT 5.6 Luna > 272K tokens），总 token 含缓存
  let price = p;
  if (p.highThreshold && (input + cached + cacheWrite + output) > p.highThreshold) {
    price = {
      in: p.inHigh, out: p.outHigh,
      cacheRead: p.cacheReadHigh, cacheWrite: p.cacheWriteHigh,
    };
  }

  const cost =
    input * price.in +
    cached * price.cacheRead +
    cacheWrite * price.cacheWrite +
    output * price.out;

  return cost / 1e6; // 每 1M tokens
}

/**
 * 从三种协议的响应对象中提取 usage，归一化为 { input, output, cached, cacheWrite }。
 * input 为净输入（已扣除 cached 与 cacheWrite），避免 calcCost 重复计费。
 * 各协议原始语义：
 *  - chat/completions: prompt_tokens 含 cached_tokens（及 cache_creation_input_tokens）
 *  - messages (Anthropic): input_tokens 含 cache_creation、不含 cache_read
 *  - responses: input_tokens 含 cached_tokens
 * 提取不到返回 null。
 */
function extractUsage(obj, endpoint) {
  if (!obj || typeof obj !== 'object') return null;
  const u = obj.usage;
  if (!u) return null;

  if (endpoint === 'chat/completions') {
    if (u.prompt_tokens == null && u.completion_tokens == null) return null;
    const det = u.prompt_tokens_details || {};
    // 各家缓存字段格式不一：OpenAI/xAI 用 details.cached_tokens，
    // Moonshot 顶层 cached_tokens，DeepSeek 用 prompt_cache_hit_tokens
    const cached = u.cached_tokens ?? det.cached_tokens ?? u.prompt_cache_hit_tokens ?? 0;
    const cacheWrite = det.cache_creation_input_tokens ?? 0;
    return {
      input: Math.max(0, (u.prompt_tokens || 0) - cached - cacheWrite),
      output: u.completion_tokens || 0,
      cached,
      cacheWrite,
    };
  }

  if (endpoint === 'messages') {
    if (u.input_tokens == null && u.output_tokens == null) return null;
    const cacheWrite = u.cache_creation_input_tokens || 0;
    return {
      // input_tokens 已含 cache_creation，需扣除；cache_read 本就不在 input_tokens 里
      input: Math.max(0, (u.input_tokens || 0) - cacheWrite),
      output: u.output_tokens || 0,
      cached: u.cache_read_input_tokens || 0,
      cacheWrite,
    };
  }

  // responses
  if (u.input_tokens == null && u.output_tokens == null) return null;
  const cached = u.input_tokens_details?.cached_tokens || 0;
  return {
    input: Math.max(0, (u.input_tokens || 0) - cached),
    output: u.output_tokens || 0,
    cached,
    cacheWrite: 0,
  };
}

/**
 * 从响应对象提取上游返回的美元成本（顶层 cost 字段，可能是字符串或数字）。
 */
function extractCost(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.cost === undefined || obj.cost === null) return null;
  const c = parseFloat(obj.cost);
  return Number.isFinite(c) ? c : null;
}

/**
 * 解析响应对象：返回 { usage, cost }。
 * usage 为归一化 token 数（可能为 null），cost 为上游成本（可能为 null）。
 */
function parseUsage(obj, endpoint) {
  if (!obj || typeof obj !== 'object') return { usage: null, cost: null };
  // 流式 inference-cost 事件（x-opencode-type）——当前上游实测不发送该事件，保留分支以防御。
  // 若收到：normalizedUsage 的 inputTokens 已是不含缓存的净输入（上游归一化时
  // 已扣除 cacheRead/cacheWrite），与 extractUsage 的语义一致，calcCost 直接相加即可。
  if (obj['x-opencode-type'] === 'inference-cost') {
    const n = obj.normalizedUsage || {};
    return {
      usage: {
        input: n.inputTokens || 0,
        output: n.outputTokens || 0,
        cached: n.cacheReadTokens || 0,
        cacheWrite: (n.cacheWrite5mTokens || 0) + (n.cacheWrite1hTokens || 0),
      },
      cost: extractCost(obj),
    };
  }
  return { usage: extractUsage(obj, endpoint), cost: extractCost(obj) };
}

/**
 * 从 SSE 行中尝试解析 usage/cost（三种协议的流式事件）。
 */
function parseUsageFromLine(line, endpoint) {
  const s = line.trim();
  if (!s.startsWith('data:')) return null;
  const payload = s.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return parseUsage(JSON.parse(payload), endpoint);
  } catch {
    return null;
  }
}

/**
 * 上游未返回 usage 时的兜底估算：
 * 输入 token ≈ 消息字符数 / 4，输出 token ≈ max_tokens（默认 1024）
 */
function estimateUsage(body, model) {
  let chars = 0;
  const messages = body.messages || body.input || [];
  const dump = (v) => {
    if (typeof v === 'string') chars += v.length;
    else if (v && typeof v === 'object') chars += JSON.stringify(v).length;
  };
  if (Array.isArray(messages)) {
    for (const m of messages) {
      const c = m.content;
      if (Array.isArray(c)) c.forEach(dump);
      else dump(c);
    }
  } else {
    dump(messages);
  }
  const input = Math.max(1, Math.round(chars / 4));
  const output = body.max_tokens || body.max_output_tokens || 1024;
  return { input, output, cached: 0, cacheWrite: 0 };
}

module.exports = { calcCost, extractUsage, parseUsage, parseUsageFromLine, estimateUsage };
