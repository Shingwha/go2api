'use strict';

/**
 * 本地端到端测试：
 * 1. 启动一个 mock 上游（模拟 OpenCode Go 网关，三种协议 + 流式）
 * 2. 启动 go2api 服务指向 mock
 * 3. 依次验证：健康检查 / 创建订阅 / 模型列表 / 非流式转发记账 / 流式转发记账 /
 *    模型白名单拒绝 / 额度耗尽拒绝 / 无效 key / 速率限制 / 管理 API / 用量日志
 */

const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const MOCK_PORT = 18991;
const GW_PORT = 18992;
const ADMIN_KEY = 'test-admin-key-123';
const DB = path.join(ROOT, 'data', 'test.db');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.log(`  ❌ ${name} ${extra}`); }
}

// ---------- mock 上游 ----------
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const b = JSON.parse(body || '{}');
    const ep = req.url;

    if (ep === '/chat/completions' && b.stream) {
      // 流式：模拟 OpenAI SSE + usage chunk
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"}}]}\n\n');
      res.write('data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"lo"}}]}\n\n');
      res.write('data: {"id":"c1","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":2,"total_tokens":102,"prompt_tokens_details":{"cached_tokens":60}}}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    if (ep === '/chat/completions') {
      const body2 = JSON.stringify({
        id: 'c1', object: 'chat.completion', created: 0, model: b.model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, prompt_tokens_details: { cached_tokens: 60 } },
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body2);
      return;
    }
    if (ep === '/messages') {
      const body2 = JSON.stringify({
        id: 'm1', type: 'message', role: 'assistant', model: b.model,
        content: [{ type: 'text', text: 'hi' }],
        usage: { input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 },
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body2);
      return;
    }
    if (ep === '/responses') {
      const body2 = JSON.stringify({
        id: 'r1', object: 'response', model: b.model,
        output: [], usage: { input_tokens: 80, output_tokens: 7, input_tokens_details: { cached_tokens: 30 }, output_tokens_details: {} },
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body2);
      return;
    }
    res.writeHead(404); res.end('nope');
  });
});

// ---------- 测试工具 ----------
function req(port, method, p, { auth, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port, method, path: p,
      headers: {
        ...(auth ? { authorization: 'Bearer ' + auth } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // 清掉旧测试库
  try { fs.unlinkSync(DB); } catch {}
  try { fs.unlinkSync(DB + '-wal'); } catch {}
  try { fs.unlinkSync(DB + '-shm'); } catch {}

  await new Promise((r) => mock.listen(MOCK_PORT, r));

  const gw = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(GW_PORT),
      GO_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      GO_API_KEY: 'sk-upstream-test',
      ADMIN_API_KEY: ADMIN_KEY,
      DB_PATH: DB,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  gw.stdout.on('data', (d) => process.stdout.write('  [gw] ' + d));
  gw.stderr.on('data', (d) => process.stdout.write('  [gw!] ' + d));
  await new Promise((r) => setTimeout(r, 800));

  console.log('\n[1] 基础');
  let r = await req(GW_PORT, 'GET', '/healthz');
  check('healthz', r.status === 200);

  r = await req(GW_PORT, 'GET', '/v1/models', { auth: 'sk-bad' });
  check('模型列表无认证返回全部', r.status === 200 && JSON.parse(r.body).data.length > 10);

  console.log('\n[2] 订阅管理');
  r = await req(GW_PORT, 'POST', '/admin/subs', { auth: ADMIN_KEY, body: { name: '测试A', quotaUsd: 1, models: ['deepseek-v4-flash', 'kimi-k2.6'], rpm: 2 } });
  check('创建订阅', r.status === 201, r.body);
  const subA = JSON.parse(r.body).subscription;
  check('key 前缀 sk-go2api-', subA.key.startsWith('sk-go2api-'));
  check('models 白名单解析', JSON.stringify(subA.modelsList) === JSON.stringify(['deepseek-v4-flash', 'kimi-k2.6']));
  check('剩余额度', subA.remainingUsd === 1);

  r = await req(GW_PORT, 'POST', '/admin/subs', { auth: 'wrong-key', body: { name: 'x' } });
  check('管理认证拦截', r.status === 401);

  r = await req(GW_PORT, 'POST', '/admin/subs', { auth: ADMIN_KEY, body: { name: '测试B', quotaUsd: 0 } });
  const subB = JSON.parse(r.body).subscription;
  check('创建订阅B（无限额）', r.status === 201);

  console.log('\n[3] 模型控制');
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subA.key, body: { model: 'grok-4.5', messages: [{ role: 'user', content: 'x' }] } });
  check('白名单外模型被拒', r.status === 403 && JSON.parse(r.body).error.code === 'model_not_allowed');

  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subA.key, body: { model: 'opencode-go/deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] } });
  check('前缀模型名 + 非流式转发', r.status === 200 && JSON.parse(r.body).choices[0].message.content === 'hi', r.body);

  r = await req(GW_PORT, 'POST', '/v1/messages', { auth: subA.key, body: { model: 'deepseek-v4-flash', messages: [] } });
  check('协议端点不匹配被拒', r.status === 400, r.body);

  r = await req(GW_PORT, 'POST', '/v1/messages', { auth: subB.key, body: { model: 'minimax-m3', messages: [{ role: 'user', content: 'hi' }] } });
  check('anthropic 端点转发', r.status === 200 && JSON.parse(r.body).usage.input_tokens === 50, r.body);

  r = await req(GW_PORT, 'POST', '/v1/responses', { auth: subB.key, body: { model: 'gpt-5.6-luna', input: 'hi' } });
  check('responses 端点转发', r.status === 200, r.body);

  console.log('\n[4] 用量记账');
  // [3] 中的"前缀模型名 + 非流式转发"请求已记账，直接查
  r = await req(GW_PORT, 'GET', '/admin/subs/' + subA.id, { auth: ADMIN_KEY });
  const a = JSON.parse(r.body).subscription;
  const expected = ((100 - 60) * 0.14 + 60 * 0.0028 + 20 * 0.28) / 1e6;
  check('deepseek-v4-flash 成本计算', Math.abs(a.used_usd - expected) < 1e-9, `got ${a.used_usd}, want ${expected}`);
  check('请求计数', a.used_requests === 1);

  console.log('\n[5] 流式转发');
  r = await req(GW_PORT, 'GET', '/admin/subs/' + subB.id, { auth: ADMIN_KEY });
  const bBefore = JSON.parse(r.body).subscription.used_usd;
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subB.key, body: { model: 'deepseek-v4-flash', stream: true, messages: [{ role: 'user', content: 'hi' }] } });
  const sse = r.body;
  check('流式返回 200 + SSE', r.status === 200 && r.headers['content-type'].includes('text/event-stream'));
  check('SSE 内容透传', sse.includes('"content":"Hel"') && sse.includes('[DONE]'));
  check('SSE 含 usage chunk', sse.includes('"usage"') && sse.includes('"cached_tokens":60'));
  r = await req(GW_PORT, 'GET', '/admin/subs/' + subB.id, { auth: ADMIN_KEY });
  const b = JSON.parse(r.body).subscription;
  const expStream = ((100 - 60) * 0.14 + 60 * 0.0028 + 2 * 0.28) / 1e6;
  check('流式 usage 记账', Math.abs(b.used_usd - bBefore - expStream) < 1e-9, `got ${b.used_usd - bBefore}, want ${expStream}`);

  console.log('\n[6] 限流与额度');
  // subA rpm=2：已用 1 次（非流式成功），再来 1 次成功，第 3 次应 429
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subA.key, body: { model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] } });
  check('RPM 第2次放行', r.status === 200, r.body);
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subA.key, body: { model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] } });
  check('RPM 超限 429', r.status === 429, r.body);

  // 额度耗尽：subA 的 rpm=2 已用尽，改用 subB（无限流）把额度调小再测
  await req(GW_PORT, 'PATCH', '/admin/subs/' + subB.id, { auth: ADMIN_KEY, body: { quotaUsd: 0.000001 } });
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subB.key, body: { model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] } });
  check('额度耗尽被拒', r.status === 403 && JSON.parse(r.body).error.code === 'quota_exceeded', r.body);
  await req(GW_PORT, 'PATCH', '/admin/subs/' + subB.id, { auth: ADMIN_KEY, body: { quotaUsd: 0 } });

  console.log('\n[7] 管理 API');
  r = await req(GW_PORT, 'GET', '/admin/stats', { auth: ADMIN_KEY });
  const st = JSON.parse(r.body);
  check('stats 总请求数', st.total.total_requests >= 5, JSON.stringify(st.total));
  check('stats 按模型分布', Array.isArray(st.byModel) && st.byModel.length > 0);

  r = await req(GW_PORT, 'GET', '/admin/usage?limit=10', { auth: ADMIN_KEY });
  check('用量日志', JSON.parse(r.body).usage.length >= 4);

  r = await req(GW_PORT, 'POST', '/admin/subs/' + subB.id + '/reset', { auth: ADMIN_KEY });
  check('重置用量', JSON.parse(r.body).subscription.used_usd === 0);

  r = await req(GW_PORT, 'PATCH', '/admin/subs/' + subA.id, { auth: ADMIN_KEY, body: { rotateKey: true } });
  const rotated = JSON.parse(r.body).subscription;
  check('轮换 key', rotated.key !== subA.key);

  r = await req(GW_PORT, 'GET', '/v1/models', { auth: subB.key });
  const models = JSON.parse(r.body).data.map((m) => m.id);
  check('订阅模型列表 = 全部', models.includes('grok-4.5') && models.includes('minimax-m3'));
  r = await req(GW_PORT, 'GET', '/v1/models', { auth: rotated.key });
  const modelsA = JSON.parse(r.body).data.map((m) => m.id);
  check('订阅A模型列表被白名单过滤', modelsA.length === 2 && modelsA.includes('deepseek-v4-flash') && !modelsA.includes('grok-4.5'));

  r = await req(GW_PORT, 'GET', '/', {});
  check('控制台页面', r.status === 200 && r.body.includes('Go2API'));

  console.log('\n[8] 无效认证');
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: 'sk-nope', body: { model: 'deepseek-v4-flash', messages: [] } });
  check('无效订阅 key 401', r.status === 401);
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { body: { model: 'deepseek-v4-flash', messages: [] } });
  check('无认证 401', r.status === 401);
  r = await req(GW_PORT, 'POST', '/v1/chat/completions', { auth: subA.key, body: { model: 'no-such-model', messages: [] } });
  check('未知模型 400', r.status === 400 && JSON.parse(r.body).error.code === 'model_not_found');

  gw.kill();
  mock.close();
  console.log(failures === 0 ? '\n🎉 全部测试通过！' : `\n💥 ${failures} 个测试失败`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
