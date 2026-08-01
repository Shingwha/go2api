'use strict';

/**
 * Web 管理控制台（单页，无外部依赖，中文界面）。
 * 认证：请求头 Authorization: Bearer <ADMIN_API_KEY>
 */

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Go2API 管理控制台</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; margin: 0; background: #f5f6f8; color: #1c1e21; }
.dark body { background: #14161a; color: #e8eaed; }
header { background: #0b0d10; color: #fff; padding: 14px 24px; display: flex; align-items: center; gap: 16px; }
header h1 { font-size: 18px; margin: 0; flex: 1; }
main { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
.card { background: #fff; border-radius: 10px; padding: 18px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.dark .card { background: #1c1f24; }
h2 { font-size: 16px; margin: 0 0 12px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #e4e6ea; white-space: nowrap; }
.dark th, .dark td { border-color: #2a2e34; }
th { color: #666; font-weight: 600; }
.dark th { color: #9aa0a6; }
input, select, textarea { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; background: #fff; color: inherit; }
.dark input, .dark select, .dark textarea { background: #14161a; border-color: #3a3f46; }
button { padding: 7px 14px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; font-size: 13px; }
button.secondary { background: #6b7280; }
button.danger { background: #dc2626; }
button:disabled { opacity: .5; }
.badge { padding: 2px 8px; border-radius: 99px; font-size: 12px; }
.badge.active { background: #dcfce7; color: #166534; }
.badge.disabled { background: #fee2e2; color: #991b1b; }
.dark .badge.active { background: #14532d; color: #bbf7d0; }
.dark .badge.disabled { background: #7f1d1d; color: #fecaca; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.key { max-width: 220px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: bottom; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.stat { background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; }
.dark .stat { background: #14161a; }
.stat .n { font-size: 20px; font-weight: 700; }
.stat .l { font-size: 12px; color: #666; }
.dark .stat .l { color: #9aa0a6; }
form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: end; }
form label { display: flex; flex-direction: column; font-size: 12px; color: #666; gap: 4px; }
.dark form label { color: #9aa0a6; }
#auth { max-width: 400px; margin: 80px auto; }
#auth input { width: 100%; box-sizing: border-box; margin-bottom: 10px; }
.err { color: #dc2626; font-size: 13px; }
.ok { color: #16a34a; font-size: 13px; }
code { background: #f0f1f3; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.dark code { background: #262a30; }
.hidden { display: none; }
</style>
</head>
<body>
<header>
  <h1>⚡ Go2API 管理控制台</h1>
  <button class="secondary" onclick="logout()">退出</button>
</header>

<div id="auth" class="card">
  <h2>管理员登录</h2>
  <p style="font-size:13px;color:#666">输入 ADMIN_API_KEY（环境变量中配置，或见启动日志）</p>
  <input type="password" id="adminKey" placeholder="ADMIN_API_KEY" autocomplete="off">
  <button onclick="login()" style="width:100%">进入</button>
  <div id="authErr" class="err"></div>
</div>

<main id="main" class="hidden">
  <div class="card"><h2>总览</h2><div class="grid" id="stats"></div></div>

  <div class="card">
    <h2>创建订阅</h2>
    <form id="createForm">
      <label>名称 *<input name="name" placeholder="如：朋友A" required></label>
      <label>允许模型（留空=全部）<input name="models" placeholder="如: deepseek-v4-flash,kimi-k2.6"></label>
      <label>额度（$，0=不限）<input name="quotaUsd" type="number" min="0" step="0.01" value="2"></label>
      <label>请求数上限（0=不限）<input name="quotaRequests" type="number" min="0" value="0"></label>
      <label>每分钟限流（0=不限）<input name="rpm" type="number" min="0" value="0"></label>
      <label>每天限流（0=不限）<input name="rpd" type="number" min="0" value="0"></label>
      <label>过期时间<input name="expiresAt" type="datetime-local"></label>
      <label>备注<input name="note" placeholder="可选"></label>
      <button type="submit">创建</button>
    </form>
  </div>

  <div class="card">
    <h2>订阅列表</h2>
    <div style="overflow-x:auto"><table id="subsTable">
      <thead><tr>
        <th>ID</th><th>名称</th><th>API Key</th><th>状态</th><th>模型</th>
        <th>额度 $</th><th>已用 $</th><th>请求</th><th>限流</th><th>过期</th><th>操作</th>
      </tr></thead>
      <tbody></tbody>
    </table></div>
  </div>

  <div class="card">
    <h2>模型价格表（$ / 1M tokens）</h2>
    <div style="overflow-x:auto"><table id="modelsTable">
      <thead><tr><th>模型</th><th>端点</th><th>输入</th><th>输出</th><th>缓存读取</th><th>缓存写入</th></tr></thead>
      <tbody></tbody>
    </table></div>
  </div>
</main>

<script>
let TOKEN = localStorage.getItem('go2api_admin_key') || '';

function login() {
  TOKEN = document.getElementById('adminKey').value.trim();
  localStorage.setItem('go2api_admin_key', TOKEN);
  checkAuth();
}
function logout() { TOKEN = ''; localStorage.removeItem('go2api_admin_key'); showAuth(); }

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN, ...(opts.headers || {}) },
  });
  if (r.status === 401) { showAuth(); throw new Error('unauthorized'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}

function fmt(n) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function showAuth() { document.getElementById('main').classList.add('hidden'); document.getElementById('auth').classList.remove('hidden'); }
async function checkAuth() {
  try {
    await api('/admin/stats');
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('main').classList.remove('hidden');
    refresh();
  } catch (e) {
    document.getElementById('authErr').textContent = '认证失败：' + e.message;
  }
}

async function refresh() {
  await Promise.all([loadStats(), loadSubs(), loadModels()]);
}

async function loadStats() {
  const s = await api('/admin/stats');
  const el = document.getElementById('stats');
  el.innerHTML = [
    ['累计请求', fmt(s.total.total_requests)],
    ['累计成本 $', fmt(s.total.total_cost)],
    ['今日请求', fmt(s.today.requests)],
    ['今日成本 $', fmt(s.today.cost)],
    ['输入 tokens', fmt(s.total.total_input)],
    ['输出 tokens', fmt(s.total.total_output)],
  ].map(([l, n]) => '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>').join('');
}

async function loadSubs() {
  const { subscriptions } = await api('/admin/subs');
  const tbody = document.querySelector('#subsTable tbody');
  tbody.innerHTML = subscriptions.map((s) => {
    const models = s.modelsList === '*' ? '全部' : esc(s.modelsList.join(', '));
    const expire = s.expires_at ? new Date(s.expires_at).toLocaleString() : '—';
    const quota = s.quota_usd > 0 ? '$' + fmt(s.quota_usd) : '∞';
    const rl = [s.rpm ? s.rpm + '/min' : '', s.rpd ? s.rpd + '/day' : ''].filter(Boolean).join(' ') || '—';
    return '<tr>' +
      '<td>' + s.id + '</td>' +
      '<td>' + esc(s.name) + '</td>' +
      '<td><span class="mono key" title="' + esc(s.key) + '">' + esc(s.key) + '</span> ' +
        '<button class="secondary" style="padding:2px 8px;font-size:11px" onclick="copyKey(\\'' + esc(s.key) + '\\')">复制</button></td>' +
      '<td><span class="badge ' + s.status + '">' + s.status + '</span></td>' +
      '<td title="' + models + '">' + (models.length > 20 ? models.slice(0, 20) + '…' : models) + '</td>' +
      '<td>' + quota + '</td>' +
      '<td>$' + fmt(s.used_usd) + ' <span style="color:#888">/' + fmt(s.used_requests) + ' req</span></td>' +
      '<td>' + rl + '</td>' +
      '<td>' + expire + '</td>' +
      '<td>' +
        '<button class="secondary" style="padding:3px 8px;font-size:11px" onclick="toggleSub(' + s.id + ')">' + (s.status === 'active' ? '禁用' : '启用') + '</button> ' +
        '<button class="secondary" style="padding:3px 8px;font-size:11px" onclick="resetSub(' + s.id + ')">重置</button> ' +
        '<button class="danger" style="padding:3px 8px;font-size:11px" onclick="delSub(' + s.id + ')">删除</button>' +
      '</td></tr>';
  }).join('');
}

async function loadModels() {
  const { models } = await api('/admin/models');
  const tbody = document.querySelector('#modelsTable tbody');
  tbody.innerHTML = Object.entries(models).map(([id, m]) =>
    '<tr><td class="mono">' + id + '</td><td>' + m.endpoint + '</td>' +
    '<td>' + m.in + '</td><td>' + m.out + '</td><td>' + m.cacheRead + '</td><td>' + (m.cacheWrite || '—') + '</td></tr>'
  ).join('');
}

function copyKey(k) { navigator.clipboard.writeText(k).then(() => alert('已复制: ' + k)); }
async function toggleSub(id) {
  const { subscriptions } = await api('/admin/subs');
  const s = subscriptions.find((x) => x.id === id);
  await api('/admin/subs/' + id, { method: 'PATCH', body: JSON.stringify({ status: s.status === 'active' ? 'disabled' : 'active' }) });
  loadSubs();
}
async function resetSub(id) { await api('/admin/subs/' + id + '/reset', { method: 'POST' }); loadSubs(); }
async function delSub(id) { if (confirm('确认删除订阅 #' + id + '？')) { await api('/admin/subs/' + id, { method: 'DELETE' }); loadSubs(); } }

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = { name: fd.get('name') };
  if (fd.get('models')) body.models = fd.get('models').split(',').map((s) => s.trim()).filter(Boolean);
  if (fd.get('quotaUsd')) body.quotaUsd = parseFloat(fd.get('quotaUsd'));
  if (fd.get('quotaRequests')) body.quotaRequests = parseInt(fd.get('quotaRequests'), 10);
  if (fd.get('rpm')) body.rpm = parseInt(fd.get('rpm'), 10);
  if (fd.get('rpd')) body.rpd = parseInt(fd.get('rpd'), 10);
  if (fd.get('expiresAt')) body.expiresAt = new Date(fd.get('expiresAt')).toISOString();
  if (fd.get('note')) body.note = fd.get('note');
  const { subscription } = await api('/admin/subs', { method: 'POST', body: JSON.stringify(body) });
  alert('创建成功！API Key: ' + subscription.key);
  e.target.reset();
  loadSubs();
});

if (TOKEN) checkAuth(); else showAuth();
</script>
</body>
</html>`;

module.exports = { HTML };
