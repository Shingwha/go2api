'use strict';

const http = require('node:http');
const config = require('./config');
const { handleAdmin } = require('./admin');
const { handleProxy, handleModels, loadSubscription } = require('./proxy');
const { HTML } = require('./web');
const { syncModelsFromUpstream } = require('./prices');

// 启动时同步一次上游模型目录（失败静默降级本地表），之后每 6 小时刷新
(async () => {
  const r = await syncModelsFromUpstream();
  if (r.ok && r.added) console.log(`  [模型同步] 上游新增 ${r.added} 个模型，共 ${r.total} 个可用`);
  else if (r.ok) console.log(`  [模型同步] 上游 ${r.total} 个模型，与本地表一致`);
  else if (!r.ok && config.goApiKey) console.log(`  [模型同步] 跳过（${r.reason}），使用本地模型表`);
})();
setInterval(() => { syncModelsFromUpstream().catch(() => {}); }, 6 * 3600000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);

  // 健康检查（Railway 用）
  if (path === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  // Web 管理控制台
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }

  // 管理 API：/admin/*
  if (parts[0] === 'admin') {
    const key = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '')?.[1]?.trim() || '';
    if (key !== config.adminApiKey) {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid admin key' }));
    }
    return handleAdmin(req, res, parts.slice(1));
  }

  // 代理 API：/v1/*
  if (parts[0] === 'v1') {
    const sub = loadSubscription(req);
    req.sub = sub;

    // GET /v1/models — 模型列表（OpenAI 兼容）
    if (req.method === 'GET' && parts[1] === 'models') {
      return handleModels(req, res, !!sub);
    }

    // POST 代理端点
    if (req.method === 'POST') {
      const ep = parts.slice(1).join('/');
      if (ep === 'chat/completions' || ep === 'responses' || ep === 'messages') {
        return handleProxy(req, res, ep);
      }
    }
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found', type: 'invalid_request_error', code: 'not_found' } }));
});

server.listen(config.port, () => {
  console.log('==================================================');
  console.log('  Go2API  —  OpenCode Go 转发订阅网关');
  console.log('==================================================');
  console.log(`  代理端点      : http://localhost:${config.port}/v1/chat/completions`);
  console.log(`                  http://localhost:${config.port}/v1/responses`);
  console.log(`                  http://localhost:${config.port}/v1/messages`);
  console.log(`  模型列表      : http://localhost:${config.port}/v1/models`);
  console.log(`  管理控制台    : http://localhost:${config.port}/`);
  console.log(`  ADMIN_API_KEY : ${config.adminApiKey}`);
  console.log(`  上游网关      : ${config.goBaseUrl}`);
  if (!config.goApiKey) {
    console.warn('  [警告] 未设置 GO_API_KEY，代理请求将被上游拒绝！');
  }
  console.log('==================================================');
});
