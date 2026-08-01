'use strict';

/**
 * Web 管理控制台（单页，无外部依赖，中文界面）。
 * 认证：请求头 Authorization: Bearer <ADMIN_API_KEY>
 *
 * 设计：无圆角 / 简洁淡雅 / 深浅色 / 侧边栏导航 / 卡片网格 / 移动端抽屉。
 */

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
<title>Go2API 管理控制台</title>
<style>
/* ============ 主题变量 ============ */
:root {
  color-scheme: light dark;
  --bg: #fafafa;
  --surface: #ffffff;
  --surface-2: #f5f5f5;
  --border: #e5e5e5;
  --border-strong: #d4d4d4;
  --text: #1a1a1a;
  --text-2: #525252;
  --text-3: #737373;
  --accent: #1a1a1a;
  --accent-text: #ffffff;
  --accent-hover: #333333;
  --green: #16a34a;
  --green-bg: #f0fdf4;
  --red: #dc2626;
  --red-bg: #fef2f2;
  --amber: #b45309;
  --amber-bg: #fffbeb;
  --shadow: 0 1px 2px rgba(0,0,0,.04);
}
.dark {
  --bg: #0a0a0a;
  --surface: #141414;
  --surface-2: #1c1c1c;
  --border: #262626;
  --border-strong: #404040;
  --text: #ededed;
  --text-2: #a3a3a3;
  --text-3: #737373;
  --accent: #ededed;
  --accent-text: #0a0a0a;
  --accent-hover: #d4d4d4;
  --green: #4ade80;
  --green-bg: #052e16;
  --red: #f87171;
  --red-bg: #450a0a;
  --amber: #fbbf24;
  --amber-bg: #422006;
  --shadow: 0 1px 2px rgba(0,0,0,.3);
}

/* ============ 基础 ============ */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea {
  font-family: inherit;
  font-size: 14px;
  /* 防 iOS 聚焦放大 */
}
input, select, textarea { font-size: 16px; }
@media (min-width: 769px) { input, select, textarea { font-size: 14px; } }
.mono { font-family: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace; }
.logo-mark {
  display: inline-block;
  width: 14px; height: 14px;
  background: var(--accent);
  margin-right: 2px;
  vertical-align: middle;
  transform: translateY(-1px);
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--border-strong); }
::-webkit-scrollbar-track { background: transparent; }

/* ============ 布局 ============ */
.app { display: flex; min-height: 100vh; }

/* 侧边栏 */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; bottom: 0; left: 0;
  z-index: 50;
}
.sidebar-brand {
  padding: 18px 20px;
  font-size: 16px;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.sidebar-nav { flex: 1; padding: 8px; overflow-y: auto; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  margin-bottom: 2px;
  color: var(--text-2);
  cursor: pointer;
  border: 1px solid transparent;
  min-height: 40px;
  transition: background .12s, color .12s;
}
.nav-item:hover { background: var(--surface-2); color: var(--text); }
.nav-item.active { background: var(--surface-2); color: var(--text); border-color: var(--border); font-weight: 600; }
.nav-item svg { width: 16px; height: 16px; flex-shrink: 0; }
.sidebar-foot {
  padding: 12px;
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 4px;
}
.theme-toggle {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  color: var(--text-2);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  min-height: 40px;
}
.theme-toggle:hover { background: var(--surface-2); color: var(--text); }
.theme-toggle svg { width: 16px; height: 16px; }

/* 主内容 */
.main { flex: 1; margin-left: 220px; min-width: 0; display: flex; flex-direction: column; }
.content { padding: 28px 32px 48px; max-width: 1200px; width: 100%; }
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { font-size: 13px; color: var(--text-3); margin-top: 4px; }
.hidden { display: none !important; }

/* 移动端顶栏 */
.mobilebar {
  display: none;
  position: sticky; top: 0; z-index: 40;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  height: 52px;
  align-items: center;
  gap: 12px;
}
.icon-btn {
  background: transparent; border: 1px solid transparent;
  width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text);
}
.icon-btn:hover { background: var(--surface-2); }
.icon-btn svg { width: 20px; height: 20px; }
.mobilebar-title { font-size: 16px; font-weight: 700; flex: 1; }

/* 遮罩（移动端抽屉） */
.overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,.4);
  z-index: 45;
}

/* ============ 组件 ============ */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 20px;
  margin-bottom: 16px;
}
.card-title { font-size: 13px; font-weight: 600; color: var(--text-3); margin: 0 0 14px; text-transform: uppercase; letter-spacing: .03em; }

/* 统计卡片网格 */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 16px;
}
.stat .n { font-size: 24px; font-weight: 700; letter-spacing: -.01em; }
.stat .n .unit { font-size: 14px; font-weight: 500; color: var(--text-3); margin-left: 2px; }
.stat .l { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.stat .sub { font-size: 11px; color: var(--text-3); margin-top: 6px; }

/* 按钮 */
.btn {
  padding: 8px 14px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  min-height: 36px;
  font-size: 13px;
  transition: background .12s, border-color .12s;
}
.btn:hover { background: var(--surface-2); }
.btn-primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-danger { color: var(--red); border-color: var(--border-strong); }
.btn-danger:hover { background: var(--red-bg); border-color: var(--red); }
.btn-sm { padding: 5px 10px; min-height: 30px; font-size: 12px; }
.btn-icon {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 10px; min-height: 32px;
  background: transparent; border: 1px solid transparent; cursor: pointer; color: var(--text-2);
  font-size: 12px;
}
.btn-icon:hover { background: var(--surface-2); color: var(--text); border-color: var(--border); }
.btn-icon svg { width: 13px; height: 13px; }
.btn:disabled, .btn-icon:disabled { opacity: .45; cursor: not-allowed; }

/* 输入 */
input, select, textarea {
  padding: 8px 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  border-radius: 0;
  width: 100%;
  outline: none;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); }
textarea { resize: vertical; min-height: 60px; }

/* 表单网格 */
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 5px; }
.form-field label { font-size: 12px; color: var(--text-3); font-weight: 500; }
.form-field .hint { font-size: 11px; color: var(--text-3); }
.form-section { margin-bottom: 18px; }
.form-section-title { font-size: 12px; color: var(--text-3); margin: 0 0 10px; text-transform: uppercase; letter-spacing: .03em; font-weight: 600; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }

/* 徽点 / 状态 */
.dot { display: inline-block; width: 7px; height: 7px; flex-shrink: 0; }
.dot.ok { background: var(--green); }
.dot.off { background: var(--text-3); }
.dot.exp { background: var(--red); }
.status-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); }

/* chip 标签 */
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 11px; padding: 2px 6px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); }

/* 进度条 */
.bar { height: 8px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent); transition: width .3s; }
.bar-fill.warn { background: var(--amber); }
.bar-fill.over { background: var(--red); }

/* key 文本 */
.key-box { display: flex; align-items: center; gap: 6px; background: var(--surface-2); border: 1px solid var(--border); padding: 5px 8px; }
.key-box .k { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; cursor: pointer; }
.key-box .k:hover { color: var(--text); }
.key-box .btn-icon { padding: 3px 8px; min-height: 26px; flex-shrink: 0; }
.btn-icon.copied { color: var(--green); border-color: var(--green); }

/* ============ 消费趋势 ============ */
.trend-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
.seg { display: inline-flex; border: 1px solid var(--border-strong); background: var(--surface); }
.seg button { background: transparent; color: var(--text-2); border: none; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button:hover { color: var(--text); }
.seg button.active { background: var(--accent); color: var(--accent-text); }
#trendChart { display: flex; align-items: flex-end; gap: 3px; height: 190px; padding: 24px 2px 0; overflow-x: auto; }
#trendChart.few { justify-content: center; gap: 8px; }
.trend-col { flex: 1 1 0; min-width: 14px; height: 100%; display: flex; flex-direction: column; cursor: pointer; position: relative; }
#trendChart.few .trend-col { flex: 0 0 44px; }
.trend-stack { display: flex; flex-direction: column; justify-content: flex-end; width: 100%; height: 100%; min-height: 2px; background: var(--surface-2); border-radius: 2px 2px 0 0; overflow: hidden; }
.trend-seg { width: 100%; min-height: 1px; }
.trend-val { display: none; position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--text-2); background: var(--surface); border: 1px solid var(--border); padding: 0 4px; white-space: nowrap; z-index: 3; }
#trendChart.few .trend-val { display: block; background: transparent; border: none; }
.trend-col:hover .trend-val { display: block; }
.trend-col:hover .trend-stack { outline: 1px solid var(--accent); outline-offset: 1px; }
.trend-col.sel .trend-stack { outline: 2px solid var(--accent); outline-offset: 1px; }
.trend-x { font-size: 10px; color: var(--text-3); text-align: center; margin-top: 5px; white-space: nowrap; overflow: hidden; }
.trend-legend { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 12px; font-size: 12px; color: var(--text-2); }
.trend-legend .lg { display: inline-flex; align-items: center; gap: 5px; }
.trend-legend .sw { width: 9px; height: 9px; flex-shrink: 0; }
#trendDetail { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }

/* 模型表分组 */
.model-group td { background: var(--surface-2); font-weight: 700; font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; padding: 6px 10px; }
.ep-badge { font-size: 10px; padding: 1px 6px; border: 1px solid var(--border-strong); color: var(--text-2); background: var(--surface); white-space: nowrap; }

/* 订阅筛选栏 */
.sub-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sub-toolbar .form-field { margin: 0; }
.sub-toolbar select, .sub-toolbar input { width: auto; }

/* 表格 */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { color: var(--text-3); font-weight: 600; font-size: 12px; background: var(--surface-2); position: sticky; top: 0; }
tbody tr:hover { background: var(--surface-2); }
td .mono { font-size: 12px; }

/* 订阅卡片网格 */
.sub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.sub-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.sub-card:hover { border-color: var(--border-strong); }
.sub-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sub-name { font-weight: 600; font-size: 15px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub-name:hover { text-decoration: underline; }
.sub-body { display: flex; flex-direction: column; gap: 10px; }
.usage-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; }
.usage-row .big { font-size: 15px; font-weight: 700; }
.usage-row .dim { color: var(--text-3); }
.meta-line { font-size: 12px; color: var(--text-3); display: flex; flex-wrap: wrap; gap: 4px 10px; }
.sub-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border); }
.sub-actions { display: flex; gap: 2px; flex-wrap: wrap; }

/* 空状态 */
.empty { text-align: center; padding: 48px 20px; color: var(--text-3); }
.empty svg { width: 40px; height: 40px; opacity: .4; margin-bottom: 12px; }

/* ============ 抽屉 ============ */
.drawer-mask {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  z-index: 90;
}
.drawer-mask.open { display: block; }
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 460px; max-width: 100vw;
  background: var(--surface);
  border-left: 1px solid var(--border);
  z-index: 100;
  display: flex; flex-direction: column;
  transform: translateX(100%);
  transition: transform .2s ease;
}
.drawer.open { transform: translateX(0); }
.drawer-head { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.drawer-title { font-size: 16px; font-weight: 700; }
.drawer-body { flex: 1; overflow-y: auto; padding: 20px; }
.drawer-foot { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }

/* 模态 */
.modal-mask {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  z-index: 110;
  align-items: center; justify-content: center;
  padding: 20px;
}
.modal-mask.open { display: flex; }
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  width: 100%; max-width: 400px;
}
.modal-head { padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 600; }
.modal-body { padding: 20px; font-size: 14px; color: var(--text-2); }
.modal-foot { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }

/* ============ Toast ============ */
#toasts {
  position: fixed; z-index: 200;
  bottom: 20px; right: 20px;
  display: flex; flex-direction: column; gap: 8px;
  max-width: calc(100vw - 40px);
}
.toast {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  padding: 10px 14px;
  font-size: 13px;
  box-shadow: var(--shadow);
  min-width: 200px;
  animation: toastIn .18s ease;
}
.toast.ok { border-left: 3px solid var(--green); }
.toast.err { border-left: 3px solid var(--red); }
@keyframes toastIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ============ 登录 ============ */
.auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
.auth-card { width: 100%; max-width: 380px; }
.auth-card h1 { font-size: 22px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
.auth-card p.sub { color: var(--text-3); font-size: 13px; margin: 0 0 20px; }
.err-text { color: var(--red); font-size: 13px; margin-top: 10px; min-height: 18px; }
.key-result { margin-top: 14px; padding: 12px; background: var(--green-bg); border: 1px solid var(--green); font-size: 13px; }
.key-result .k { font-family: ui-monospace, monospace; word-break: break-all; }

/* ============ 模型分布柱状 ============ */
.dist-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; }
.dist-name { width: 130px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
.dist-bar { flex: 1; height: 18px; background: var(--surface-2); border: 1px solid var(--border); position: relative; min-width: 60px; }
.dist-bar-fill { height: 100%; background: var(--accent); opacity: .85; }
.dist-val { width: 70px; flex-shrink: 0; text-align: right; color: var(--text-3); font-family: ui-monospace, monospace; }

/* ============ 响应式 ============ */
@media (max-width: 1024px) {
  .sidebar { transform: translateX(-100%); transition: transform .2s ease; box-shadow: 0 0 40px rgba(0,0,0,.3); }
  .sidebar.open { transform: translateX(0); }
  .main { margin-left: 0; }
  .mobilebar { display: flex; }
  .overlay.open { display: block; }
  .content { padding: 20px 16px 40px; }
}
@media (max-width: 768px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .sub-grid { grid-template-columns: 1fr; }
  .drawer { width: 100vw; }
  #toasts { left: 12px; right: 12px; bottom: 12px; }
  .toast { min-width: 0; }
  .content { padding: 16px 12px 32px; }
  .page-title { font-size: 18px; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>

<!-- ===== 登录页 ===== -->
<div id="authView" class="auth-wrap hidden">
  <div class="auth-card card">
    <h1><span class="logo-mark"></span>Go2API</h1>
    <p class="sub">管理控制台 · 请输入管理员密钥</p>
    <div class="form-field">
      <input type="password" id="adminKey" placeholder="ADMIN_API_KEY" autocomplete="off" autocapitalize="off">
    </div>
    <button class="btn btn-primary" id="loginBtn" style="width:100%;margin-top:12px;min-height:40px">进入控制台</button>
    <div id="authErr" class="err-text"></div>
    <p class="sub" style="margin-top:16px">密钥为环境变量 <span class="mono" style="font-size:12px">ADMIN_API_KEY</span>，未设置时见启动日志。</p>
  </div>
</div>

<!-- ===== 主应用 ===== -->
<div id="appView" class="hidden">
<div class="app">
  <!-- 侧边栏 -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand"><span class="logo-mark"></span>Go2API</div>
    <nav class="sidebar-nav" id="navList">
      <div class="nav-item" data-route="overview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        总览
      </div>
      <div class="nav-item" data-route="subs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8H3M21 16H3M7 4H3v16h4V4zm14 0h-4v16h4V4z"/></svg>
        订阅
      </div>
      <div class="nav-item" data-route="usage">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/></svg>
        用量
      </div>
      <div class="nav-item" data-route="models">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        模型
      </div>
    </nav>
    <div class="sidebar-foot">
      <button class="theme-toggle" id="themeToggle">
        <span style="display:flex;align-items:center;gap:10px">
          <svg id="iconSun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          <svg id="iconMoon" class="hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <span id="themeLabel">主题</span>
        </span>
        <span style="font-size:11px;color:var(--text-3)" id="themeMode">自动</span>
      </button>
    </div>
  </aside>
  <div class="overlay" id="overlay"></div>

  <!-- 主区 -->
  <div class="main">
    <!-- 移动端顶栏 -->
    <div class="mobilebar">
      <button class="icon-btn" id="menuBtn" aria-label="菜单">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      <div class="mobilebar-title" id="mobilebarTitle">总览</div>
      <button class="icon-btn" id="mobileTheme" aria-label="主题">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
    </div>

    <div class="content">
      <!-- 总览 -->
      <section id="page-overview" class="hidden">
        <div class="page-head">
          <div>
            <h1 class="page-title">总览</h1>
            <div class="page-sub">订阅服务的整体用量与成本</div>
          </div>
          <button class="btn btn-primary" id="refreshOverviewBtn">刷新</button>
        </div>
        <div class="stat-grid" id="statsGrid"></div>
        <div id="tokenInfo"></div>
        <div class="card" style="margin-top:16px">
          <div class="card-title">消费趋势</div>
          <div class="trend-toolbar">
            <div class="seg" id="trendDim">
              <button data-dim="model" class="active">按模型</button>
              <button data-dim="sub">按用户</button>
            </div>
            <div class="seg" id="trendGran">
              <button data-gran="day" class="active">按天</button>
              <button data-gran="hour">按小时</button>
            </div>
            <div class="seg" id="trendDays">
              <button data-days="7">7 天</button>
              <button data-days="30" class="active">30 天</button>
            </div>
            <span style="font-size:12px;color:var(--text-3)">点击柱子查看明细</span>
          </div>
          <div id="trendChart"><div class="empty" style="padding:40px">加载中…</div></div>
          <div id="trendLegend" class="trend-legend"></div>
          <div id="trendDetail"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px" id="overviewPanels">
          <div class="card">
            <div class="card-title">按模型成本分布</div>
            <div id="distChart"></div>
          </div>
          <div class="card">
            <div class="card-title">订阅概要</div>
            <div id="subSummary"></div>
          </div>
        </div>
      </section>

      <!-- 订阅 -->
      <section id="page-subs" class="hidden">
        <div class="page-head">
          <div>
            <h1 class="page-title">订阅</h1>
            <div class="page-sub">管理 API 订阅密钥、额度与限流</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <div class="sub-toolbar">
              <div class="form-field">
                <input type="text" id="subSearch" placeholder="搜索名称/备注…" style="min-width:150px">
              </div>
              <div class="form-field">
                <select id="subFilter">
                  <option value="">全部状态</option>
                  <option value="active">正常</option>
                  <option value="disabled">已停用</option>
                  <option value="expired">已过期</option>
                </select>
              </div>
              <div class="form-field">
                <select id="subSort">
                  <option value="id">最新创建</option>
                  <option value="lastUsed">最后活跃</option>
                  <option value="remaining">剩余额度</option>
                </select>
              </div>
            </div>
            <button class="btn btn-primary" id="newSubBtn">+ 新建订阅</button>
          </div>
        </div>
        <div id="subsList"></div>
      </section>

      <!-- 用量 -->
      <section id="page-usage" class="hidden">
        <div class="page-head">
          <div>
            <h1 class="page-title">用量日志</h1>
            <div class="page-sub">每条请求的记账记录</div>
          </div>
          <button class="btn btn-primary" id="refreshUsageBtn">刷新</button>
        </div>
        <div class="card" style="padding:14px 16px">
          <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
            <div class="form-field">
              <label>订阅</label>
              <select id="fSub"><option value="">全部</option></select>
            </div>
            <div class="form-field">
              <label>状态</label>
              <select id="fStatus">
                <option value="">全部</option>
                <option value="ok">成功</option>
                <option value="error">错误</option>
                <option value="rejected">拒绝</option>
              </select>
            </div>
            <div class="form-field">
              <label>条数</label>
              <select id="fLimit">
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>
            <div class="form-field" style="justify-content:flex-end">
              <label>&nbsp;</label>
              <button class="btn" id="applyUsageFilter">筛选</button>
            </div>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap" id="usageTable"></div>
        </div>
      </section>

      <!-- 模型 -->
      <section id="page-models" class="hidden">
        <div class="page-head">
          <div>
            <h1 class="page-title">模型与价格</h1>
            <div class="page-sub">每 1M tokens 计价（美元）</div>
          </div>
          <div class="form-field" style="margin:0">
            <input type="text" id="modelSearch" placeholder="搜索模型…" style="min-width:160px">
          </div>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap" id="modelsTable"></div>
        </div>
      </section>
    </div>
  </div>
</div>
</div>

<!-- ===== 抽屉（创建/编辑订阅） ===== -->
<div class="drawer-mask" id="drawerMask"></div>
<div class="drawer" id="drawer">
  <div class="drawer-head">
    <div class="drawer-title" id="drawerTitle">新建订阅</div>
    <button class="icon-btn" id="drawerClose" aria-label="关闭">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="drawer-body">
    <input type="hidden" id="fId">
    <div class="form-section">
      <div class="form-section-title">基本信息</div>
      <div class="form-grid">
        <div class="form-field" style="grid-column:1/-1">
          <label>名称 *</label>
          <input id="fName" placeholder="如：朋友A">
        </div>
        <div class="form-field" style="grid-column:1/-1">
          <label>账户状态</label>
          <select id="fStatus">
            <option value="active">正常</option>
            <option value="disabled">已停用（暂时禁用，请求将被拒绝）</option>
          </select>
        </div>
        <div class="form-field" style="grid-column:1/-1">
          <label>允许模型</label>
          <input id="fModels" placeholder="逗号分隔，留空 = 全部">
          <span class="hint">如 deepseek-v4-flash, kimi-k2.6</span>
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">额度与限流</div>
      <div class="form-grid">
        <div class="form-field">
          <label>美元额度</label>
          <input id="fQuotaUsd" type="number" min="0" step="0.01" placeholder="0 = 不限">
        </div>
        <div class="form-field">
          <label>请求数上限</label>
          <input id="fQuotaReq" type="number" min="0" placeholder="0 = 不限">
        </div>
        <div class="form-field">
          <label>每分钟限流 RPM</label>
          <input id="fRpm" type="number" min="0" placeholder="0 = 不限">
        </div>
        <div class="form-field">
          <label>每天限流 RPD</label>
          <input id="fRpd" type="number" min="0" placeholder="0 = 不限">
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">时间与备注</div>
      <div class="form-grid">
        <div class="form-field">
          <label>过期时间</label>
          <input id="fExpires" type="datetime-local">
        </div>
        <div class="form-field" style="grid-column:1/-1">
          <label>备注</label>
          <textarea id="fNote" placeholder="可选"></textarea>
        </div>
      </div>
    </div>
  </div>
  <div class="drawer-foot">
    <button class="btn" id="drawerCancel">取消</button>
    <button class="btn btn-primary" id="drawerSave">保存</button>
  </div>
</div>

<!-- ===== 详情抽屉（订阅用量历史） ===== -->
<div class="drawer-mask" id="detailMask"></div>
<div class="drawer" id="detailDrawer" style="width:480px">
  <div class="drawer-head">
    <div class="drawer-title" id="detailTitle">订阅详情</div>
    <button class="icon-btn" id="detailClose" aria-label="关闭">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="drawer-body" id="detailBody"></div>
</div>

<!-- ===== 模态确认 ===== -->
<div class="modal-mask" id="modalMask">
  <div class="modal">
    <div class="modal-head" id="modalTitle">确认</div>
    <div class="modal-body" id="modalBody"></div>
    <div class="modal-foot">
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn btn-danger" id="modalOk">确认</button>
    </div>
  </div>
</div>

<!-- ===== Toast ===== -->
<div id="toasts"></div>

<script>
'use strict';

// ============ 全局状态 ============
const state = {
  token: localStorage.getItem('go2api_admin_key') || '',
  route: 'overview',
  stats: null,
  subs: [],
  models: {},
  usage: [],
  detailSub: null,
  detailUsage: [],
  theme: localStorage.getItem('go2api_theme') || 'auto', // auto | light | dark
  expandModels: {}, // 卡片上已展开全部模型 chips 的订阅 id
};

// ============ 工具 ============
function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmt(n, d = 4) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d }); }
function money(n) { return '$' + fmt(n, 4); }
function shortTime(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}
// 相对时间："5 分钟前"
function relTime(s) {
  if (!s) return '—';
  const d = Date.now() - new Date(s).getTime();
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
  if (d < 604800000) return Math.floor(d / 86400000) + ' 天前';
  return shortTime(s);
}
// 剪贴板兜底（非安全上下文）
function copyText(text, done) {
  const ok = () => { if (done) done(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
  } else fallbackCopy(text, ok);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
  ta.remove();
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + state.token, ...(opts.headers || {}) },
  });
  if (r.status === 401) { showAuth(); throw new Error('unauthorized'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

// ============ Toast ============
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 200); }, 2800);
}

// ============ 确认弹窗 ============
function confirm2(title, body) {
  return new Promise((resolve) => {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalMask').classList.add('open');
    const ok = () => { cleanup(); resolve(true); };
    const cancel = () => { cleanup(); resolve(false); };
    function cleanup() {
      $('#modalMask').classList.remove('open');
      $('#modalOk').removeEventListener('click', ok);
      $('#modalCancel').removeEventListener('click', cancel);
    }
    $('#modalOk').addEventListener('click', ok);
    $('#modalCancel').addEventListener('click', cancel);
  });
}

// ============ 主题 ============
function applyTheme() {
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = state.theme === 'dark' || (state.theme === 'auto' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  $('#iconSun').classList.toggle('hidden', isDark);
  $('#iconMoon').classList.toggle('hidden', !isDark);
  let label = '自动';
  if (state.theme === 'light') label = '浅色';
  else if (state.theme === 'dark') label = '深色';
  $('#themeMode').textContent = label;
  $('#themeLabel').textContent = label;
}
function cycleTheme() {
  state.theme = state.theme === 'auto' ? 'light' : state.theme === 'light' ? 'dark' : 'auto';
  localStorage.setItem('go2api_theme', state.theme);
  applyTheme();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });

// ============ 认证 ============
function showAuth() {
  $('#appView').classList.add('hidden');
  $('#authView').classList.remove('hidden');
  $('#adminKey').focus();
}
function showApp() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
}
async function doLogin() {
  const key = $('#adminKey').value.trim();
  if (!key) { $('#authErr').textContent = '请输入密钥'; return; }
  state.token = key;
  $('#loginBtn').disabled = true;
  $('#authErr').textContent = '';
  try {
    await api('/admin/stats');
    localStorage.setItem('go2api_admin_key', key);
    showApp();
    router();
    refresh();
  } catch (e) {
    $('#authErr').textContent = '认证失败：' + e.message;
    state.token = '';
  } finally {
    $('#loginBtn').disabled = false;
  }
}
function logout() {
  state.token = '';
  localStorage.removeItem('go2api_admin_key');
  showAuth();
}

// ============ 路由 ============
function go(route) {
  state.route = route;
  location.hash = '#/' + route;
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.route === route));
  ['overview', 'subs', 'usage', 'models'].forEach((r) => {
    $('#page-' + r).classList.toggle('hidden', r !== route);
  });
  const titles = { overview: '总览', subs: '订阅', usage: '用量', models: '模型' };
  $('#mobilebarTitle').textContent = titles[route];
  closeSidebarMobile();
  if (route === 'models') renderModels();
  if (route === 'usage') loadUsage();
}
function router() {
  const h = location.hash.replace('#/', '');
  if (['overview', 'subs', 'usage', 'models'].includes(h)) go(h);
  else go('overview');
}
window.addEventListener('hashchange', router);

// ============ 移动端侧边栏 ============
function openSidebarMobile() { $('#sidebar').classList.add('open'); $('#overlay').classList.add('open'); }
function closeSidebarMobile() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('open'); }

// ============ 数据加载 ============
async function refresh(showToast = false) {
  try {
    const [stats, subs, models] = await Promise.all([api('/admin/stats'), api('/admin/subs'), api('/admin/models')]);
    state.stats = stats; state.subs = subs.subscriptions; state.models = models.models;
    renderStats();
    renderSubs();
    loadTrend();
    if (state.route === 'models') renderModels();
    if (showToast) toast('已刷新', 'ok');
  } catch (e) {
    toast('加载失败：' + e.message, 'err');
  }
}

// ============ 渲染：统计 ============
function renderStats() {
  const s = state.stats;
  if (!s) return;
  const cards = [
    { n: fmt(s.total.total_requests, 0), l: '累计请求', sub: '历史总量' },
    { n: money(s.total.total_cost), l: '累计成本', sub: '美元' },
    { n: fmt(s.today.requests, 0), l: '今日请求', sub: '当天累计' },
    { n: money(s.today.cost), l: '今日成本', sub: '美元' },
  ];
  $('#statsGrid').innerHTML = cards.map((c) =>
    '<div class="stat"><div class="n">' + c.n + '</div><div class="l">' + c.l + '</div><div class="sub">' + c.sub + '</div></div>'
  ).join('');
  // token 副信息
  const tok = '<div class="card" style="padding:14px 20px"><div style="display:flex;flex-wrap:wrap;gap:12px 32px;font-size:13px;color:var(--text-2)">' +
    '<span>输入 tokens <b class="mono" style="color:var(--text)">' + fmt(s.total.total_input, 0) + '</b></span>' +
    '<span>输出 tokens <b class="mono" style="color:var(--text)">' + fmt(s.total.total_output, 0) + '</b></span>' +
    '<span>缓存 tokens <b class="mono" style="color:var(--text)">' + fmt(s.total.total_cached, 0) + '</b></span>' +
    '</div></div>';
  $('#tokenInfo').innerHTML = tok;
  // 模型分布
  const byModel = (s.byModel || []).slice(0, 8);
  const maxCost = byModel.length ? Math.max(...byModel.map((m) => m.cost)) : 0;
  const dist = byModel.length
    ? byModel.map((m) =>
      '<div class="dist-row"><div class="dist-name" title="' + esc(m.model) + '">' + esc(m.model) + '</div>' +
      '<div class="dist-bar"><div class="dist-bar-fill" style="width:' + (maxCost ? (m.cost / maxCost * 100) : 0).toFixed(1) + '%"></div></div>' +
      '<div class="dist-val">$' + fmt(m.cost, 2) + '</div></div>'
    ).join('')
    : '<div class="empty">暂无数据</div>';
  $('#distChart').innerHTML = dist;
  // 订阅概要
  const activeN = state.subs.filter((x) => x.status === 'active' && !x.expired).length;
  const disabledN = state.subs.filter((x) => x.status === 'disabled').length;
  const expiredN = state.subs.filter((x) => x.expired).length;
  $('#subSummary').innerHTML =
    '<div style="display:flex;flex-direction:column;gap:10px">' +
    summaryRow('订阅总数', state.subs.length) +
    summaryRow('正常', activeN, 'var(--green)') +
    summaryRow('已停用', disabledN) +
    summaryRow('已过期', expiredN, 'var(--red)') +
    '</div>';
}
function summaryRow(l, v, color) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-2);font-size:13px">' + l + '</span><b style="color:' + (color || 'var(--text)') + '">' + v + '</b></div>';
}

// ============ 消费趋势（堆叠柱状图） ============
const trendState = { dim: 'model', gran: 'day', days: 30, raw: [], buckets: new Map(), sel: null };
const PALETTE = ['#4f8cff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#8b5cf6', '#64748b'];
function trendColor(key, map) {
  if (!map.has(key)) map.set(key, PALETTE[map.size % PALETTE.length]);
  return map.get(key);
}
function subName(id) {
  const s = state.subs.find((x) => x.id === id);
  return s ? s.name : '#' + id;
}
function trendBucketKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  return trendState.gran === 'hour' ? ymd + ' ' + pad(d.getHours()) + ':00' : ymd;
}
async function loadTrend() {
  try {
    const j = await api('/admin/timeseries?days=' + trendState.days);
    trendState.raw = j.usage || [];
    renderTrend();
  } catch (e) {
    $('#trendChart').innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
    $('#trendLegend').innerHTML = '';
  }
}
function renderTrend() {
  const colorMap = new Map();
  const buckets = new Map();
  for (const r of trendState.raw) {
    const k = trendBucketKey(r.created_at);
    if (!buckets.has(k)) buckets.set(k, { key: k, cost: 0, req: 0, items: new Map() });
    const b = buckets.get(k);
    b.cost += r.cost_usd || 0;
    b.req += 1;
    const dimKey = trendState.dim === 'sub' ? 's' + r.sub_id : 'm' + r.model;
    const label = trendState.dim === 'sub' ? subName(r.sub_id) : r.model;
    if (!b.items.has(dimKey)) b.items.set(dimKey, { key: dimKey, label, cost: 0 });
    b.items.get(dimKey).cost += r.cost_usd || 0;
  }
  trendState.buckets = buckets;
  const list = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  const maxCost = list.length ? Math.max(...list.map((b) => b.cost), 0.000001) : 0;
  // 图例：按总成本取 Top 8
  const allItems = new Map();
  for (const b of list) for (const it of b.items.values()) {
    if (!allItems.has(it.key)) allItems.set(it.key, { key: it.key, label: it.label, cost: 0 });
    allItems.get(it.key).cost += it.cost;
  }
  const legend = [...allItems.values()].sort((a, b) => b.cost - a.cost).slice(0, 8);
  $('#trendLegend').innerHTML = legend.map((it) =>
    '<span class="lg"><span class="sw" style="background:' + trendColor(it.key, colorMap) + '"></span>' + esc(it.label) + ' <b>$' + fmt(it.cost, 2) + '</b></span>'
  ).join('') + (legend.length < allItems.size ? '<span class="lg">…共 ' + allItems.size + ' 项</span>' : '');
  // 柱子
  const chart = $('#trendChart');
  if (!list.length) {
    chart.innerHTML = '<div class="empty" style="padding:40px">该时段暂无消费记录</div>';
    chart.classList.remove('few');
    $('#trendDetail').innerHTML = '';
    return;
  }
  chart.classList.toggle('few', list.length <= 14);
  // 柱子多时 x 轴标签隔几根显示一个，避免重叠
  const labelEvery = list.length > 48 ? Math.ceil(list.length / 24) : 1;
  chart.innerHTML = list.map((b, i) => {
    const segs = [...b.items.values()].sort((a, c) => c.cost - a.cost);
    const hPct = Math.max(2, (b.cost / maxCost) * 100);
    const segHtml = segs.map((it) =>
      '<div class="trend-seg" style="height:' + (it.cost / b.cost * 100).toFixed(2) + '%;background:' + trendColor(it.key, colorMap) +
      '" title="' + esc(it.label) + '：$' + fmt(it.cost, 4) + '"></div>'
    ).join('');
    const x = trendState.gran === 'hour' ? b.key.slice(5, 16) : b.key.slice(5);
    return '<div class="trend-col' + (trendState.sel === b.key ? ' sel' : '') + '" data-bucket="' + esc(b.key) + '" title="' + esc(b.key) + '｜$' + fmt(b.cost, 4) + '｜' + b.req + ' 次请求（点击查看明细）">' +
      '<div class="trend-val">$' + fmt(b.cost, 2) + '</div>' +
      '<div class="trend-stack">' + segHtml + '</div>' +
      (i % labelEvery === 0 ? '<div class="trend-x">' + esc(x) + '</div>' : '<div class="trend-x">&nbsp;</div>') +
      '</div>';
  }).join('');
  // 选中柱子的明细
  const selB = trendState.sel && buckets.get(trendState.sel);
  $('#trendDetail').innerHTML = selB ? trendDetailHtml(selB) : '';
}
function trendDetailHtml(b) {
  const rows = [...b.items.values()].sort((a, c) => c.cost - a.cost);
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
    '<b style="font-size:13px">' + esc(b.key) + ' 消费明细（' + (trendState.dim === 'sub' ? '按用户' : '按模型') + '）</b>' +
    '<button class="btn-icon" id="trendClose">✕ 关闭</button></div>' +
    '<table><thead><tr><th>' + (trendState.dim === 'sub' ? '用户' : '模型') + '</th><th>成本</th><th>占比</th></tr></thead><tbody>' +
    rows.map((it) => '<tr><td class="mono">' + esc(it.label) + '</td><td class="mono">$' + fmt(it.cost, 4) + '</td><td class="mono">' + (b.cost ? (it.cost / b.cost * 100).toFixed(1) : '0') + '%</td></tr>').join('') +
    '</tbody></table>';
}

// ============ 渲染：订阅卡片 ============
function renderSubs() {
  const el = $('#subsList');
  const q = ($('#subSearch').value || '').trim().toLowerCase();
  const f = $('#subFilter').value;
  const sort = $('#subSort').value;
  let list = state.subs.filter((s) => {
    if (q && !(s.name || '').toLowerCase().includes(q) && !(s.note || '').toLowerCase().includes(q)) return false;
    if (f === 'active' && (s.status !== 'active' || s.expired)) return false;
    if (f === 'disabled' && s.status !== 'disabled') return false;
    if (f === 'expired' && !s.expired) return false;
    return true;
  });
  if (sort === 'lastUsed') list = [...list].sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || ''));
  else if (sort === 'remaining') list = [...list].sort((a, b) => ((b.remainingUsd ?? -1) - (a.remainingUsd ?? -1)) || (b.id - a.id));
  else list = [...list].sort((a, b) => b.id - a.id);
  if (!list.length) {
    const empty = state.subs.length
      ? '<div class="card empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><div>没有匹配的订阅，试试调整搜索或筛选条件</div></div>'
      : '<div class="card empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12"/><path d="M3 10h18"/></svg><div>暂无订阅，点击「新建订阅」开始</div></div>';
    el.innerHTML = empty;
    return;
  }
  el.innerHTML = '<div class="sub-grid">' + list.map(renderSubCard).join('') + '</div>';
}
function renderSubCard(s) {
  const statusTag = s.expired
    ? '<span class="status-tag"><span class="dot exp"></span>已过期</span>'
    : s.status === 'active'
    ? '<span class="status-tag"><span class="dot ok"></span>正常</span>'
    : '<span class="status-tag"><span class="dot off"></span>已停用</span>';

  // 用量进度条 + 剩余额度为主
  let barHtml = '', pct = 0, usedLine = '';
  if (s.quota_usd > 0) {
    pct = Math.min(100, (s.used_usd / s.quota_usd) * 100);
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
    barHtml = '<div class="bar" style="margin-top:6px"><div class="bar-fill ' + cls + '" style="width:' + pct.toFixed(1) + '%"></div></div>';
    usedLine = '<span class="dim">已用 $' + fmt(s.used_usd, 4) + ' / $' + fmt(s.quota_usd) + '（' + pct.toFixed(0) + '%）</span>';
  } else if (s.quota_requests > 0) {
    pct = Math.min(100, (s.used_requests / s.quota_requests) * 100);
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
    barHtml = '<div class="bar" style="margin-top:6px"><div class="bar-fill ' + cls + '" style="width:' + pct.toFixed(1) + '%"></div></div>';
    usedLine = '<span class="dim">已用 ' + fmt(s.used_requests, 0) + ' / ' + fmt(s.quota_requests, 0) + ' 次</span>';
  }
  const usageBig = s.quota_usd > 0
    ? '<span class="big">$' + fmt(s.remainingUsd, 4) + '</span> <span class="dim">剩余</span>'
    : s.quota_requests > 0
    ? '<span class="big">' + fmt(s.remainingRequests, 0) + '</span> <span class="dim">次剩余</span>'
    : '<span class="big">$' + fmt(s.used_usd, 4) + '</span> <span class="dim">已用（不限额度）</span>';

  // 限额信息行
  const metas = [];
  if (s.rpm) metas.push(s.rpm + ' RPM');
  if (s.rpd) metas.push(s.rpd + '/天');
  if (s.expires_at) metas.push('到期 ' + shortTime(s.expires_at));
  metas.push('活跃 ' + relTime(s.lastUsedAt));

  // 模型 chips（可展开）
  let chips;
  if (s.modelsList === '*') {
    chips = '<span class="chip">全部模型</span>';
  } else {
    const showAll = !!state.expandModels[s.id];
    const shown = showAll ? s.modelsList : s.modelsList.slice(0, 4);
    chips = '<div class="chips">' + shown.map((m) => '<span class="chip">' + esc(m) + '</span>').join('') +
      (s.modelsList.length > 4
        ? (showAll
          ? '<span class="chip more" data-act="collapse" data-id="' + s.id + '" title="收起">收起</span>'
          : '<span class="chip more" data-act="expand" data-id="' + s.id + '" title="展开全部模型">+' + (s.modelsList.length - 4) + '</span>')
        : '') + '</div>';
  }

  // key：直接展示完整密钥，点击可复制
  return '<div class="sub-card">' +
    '<div class="sub-head">' +
      '<div class="sub-name" data-act="detail" data-id="' + s.id + '" title="点击查看详情">' + esc(s.name) + '</div>' +
      statusTag +
    '</div>' +
    '<div class="sub-body">' +
      '<div><div class="usage-row"><span>' + usageBig + '</span>' + usedLine + '</div>' + barHtml + '</div>' +
      '<div class="meta-line">' + (metas.length ? metas.map((m) => '<span>' + esc(m) + '</span>').join('') : '<span>无限制</span>') + '</div>' +
      chips +
    '</div>' +
    '<div class="sub-foot">' +
      '<div class="key-box" style="flex:1;min-width:0" title="点击密钥可复制完整 Key">' +
        '<span class="k" data-act="copy" data-key="' + esc(s.key) + '">' + esc(s.key) + '</span>' +
        '<button class="btn-icon" data-act="copy" data-key="' + esc(s.key) + '" title="复制完整 Key">复制</button>' +
      '</div>' +
      '<div class="sub-actions">' +
        '<button class="btn-icon" data-act="toggle" data-id="' + s.id + '" style="color:' + (s.status === 'active' ? 'var(--amber)' : 'var(--green)') + '" title="' + (s.status === 'active' ? '暂时禁用该账户' : '恢复该账户') + '">' + (s.status === 'active' ? '禁用' : '启用') + '</button>' +
        '<button class="btn-icon" data-act="edit" data-id="' + s.id + '">编辑</button>' +
        '<button class="btn-icon" data-act="rotate" data-id="' + s.id + '" title="生成新 key，旧 key 失效">换Key</button>' +
        '<button class="btn-icon" data-act="reset" data-id="' + s.id + '">重置</button>' +
        '<button class="btn-icon" data-act="del" data-id="' + s.id + '" style="color:var(--red)">删除</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ============ 渲染：模型表 ============
let modelCache = null;
function groupOf(id) {
  const i = id.indexOf('-');
  return i > 0 ? id.slice(0, i) : id;
}
function renderModels() {
  if (!modelCache) modelCache = Object.entries(state.models).sort((a, b) => a[0].localeCompare(b[0]));
  const q = ($('#modelSearch').value || '').trim().toLowerCase();
  const rows = modelCache.filter(([id]) => !q || id.toLowerCase().includes(q));
  const epLabel = (e) => e === 'chat/completions' ? 'chat' : e === 'responses' ? 'responses' : e === 'messages' ? 'messages' : e;
  // 用量统计（来自 /admin/stats.byModel）
  const byModelStats = new Map((state.stats?.byModel || []).map((m) => [m.model, m]));
  // 每个模型被多少订阅授权
  const authCount = new Map();
  for (const s of state.subs) {
    if (s.modelsList === '*') continue;
    for (const m of s.modelsList) authCount.set(m, (authCount.get(m) || 0) + 1);
  }
  // 按厂商分组
  const groups = new Map();
  for (const [id, m] of rows) {
    const g = groupOf(id);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push([id, m]);
  }
  const rowsHtml = [];
  for (const [g, items] of groups) {
    rowsHtml.push('<tr class="model-group"><td colspan="9">' + esc(g) + '</td></tr>');
    for (const [id, m] of items) {
      const st = byModelStats.get(id);
      const n = authCount.get(id);
      rowsHtml.push('<tr>' +
        '<td class="mono">' + esc(id) + '</td>' +
        '<td><span class="ep-badge">' + esc(epLabel(m.endpoint)) + '</span></td>' +
        '<td class="mono">' + m.in + '</td><td class="mono">' + m.out + '</td>' +
        '<td class="mono">' + m.cacheRead + '</td><td class="mono">' + (m.cacheWrite || '—') + '</td>' +
        '<td class="mono">' + (st ? fmt(st.requests, 0) : '—') + '</td>' +
        '<td class="mono">' + (st ? '$' + fmt(st.cost, 2) : '—') + '</td>' +
        '<td>' + (n ? n + ' 个订阅' : '<span style="color:var(--text-3)">未授权</span>') + '</td>' +
        '</tr>');
    }
  }
  $('#modelsTable').innerHTML = '<table><thead><tr>' +
    '<th>模型</th><th>端点</th><th>输入</th><th>输出</th><th>缓存读</th><th>缓存写</th><th>请求</th><th>成本</th><th>授权</th>' +
    '</tr></thead><tbody>' +
    (rowsHtml.length ? rowsHtml.join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-3);padding:32px">无匹配模型</td></tr>') +
    '</tbody></table>';
}

// ============ 渲染：用量日志 ============
async function loadUsage() {
  try {
    const sub = $('#fSub').value;
    const limit = $('#fLimit').value;
    const u = await api('/admin/usage?limit=' + limit + (sub ? '&sub_id=' + sub : ''));
    state.usage = u.usage;
    // 填充订阅下拉
    if (!$('#fSub').dataset.filled) {
      $('#fSub').innerHTML = '<option value="">全部</option>' + state.subs.map((s) => '<option value="' + s.id + '">' + esc(s.name) + ' #' + s.id + '</option>').join('');
      $('#fSub').dataset.filled = '1';
    }
    renderUsage();
  } catch (e) {
    toast('加载用量失败：' + e.message, 'err');
  }
}
function renderUsage() {
  let rows = state.usage;
  const st = $('#fStatus').value;
  if (st) rows = rows.filter((r) => r.status === st);
  $('#usageTable').innerHTML = '<table><thead><tr>' +
    '<th>时间</th><th>订阅</th><th>模型</th><th>端点</th><th>输入</th><th>输出</th><th>缓存</th><th>成本</th><th>状态</th>' +
    '</tr></thead><tbody>' +
    (rows.length ? rows.map((r) => {
      const sub = state.subs.find((x) => x.id === r.sub_id);
      const stColor = r.status === 'ok' ? 'var(--green)' : 'var(--red)';
      return '<tr>' +
        '<td>' + shortTime(r.created_at) + '</td>' +
        '<td>' + (sub ? esc(sub.name) : '#' + r.sub_id) + '</td>' +
        '<td class="mono">' + esc(r.model) + '</td>' +
        '<td>' + esc(r.endpoint) + '</td>' +
        '<td class="mono">' + fmt(r.input_tokens, 0) + '</td>' +
        '<td class="mono">' + fmt(r.output_tokens, 0) + '</td>' +
        '<td class="mono">' + fmt(r.cached_tokens, 0) + '</td>' +
        '<td class="mono">$' + fmt(r.cost_usd, 6) + (r.estimated ? '*' : '') + '</td>' +
        '<td style="color:' + stColor + '">' + esc(r.status) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-3);padding:32px">暂无记录</td></tr>') +
    '</tbody></table>';
}

// ============ 抽屉：新建/编辑 ============
function openDrawer(sub) {
  $('#drawerTitle').textContent = sub ? '编辑订阅' : '新建订阅';
  $('#fId').value = sub ? sub.id : '';
  $('#fName').value = sub ? sub.name : '';
  $('#fStatus').value = sub ? (sub.status === 'disabled' ? 'disabled' : 'active') : 'active';
  $('#fModels').value = (sub && sub.modelsList !== '*') ? sub.modelsList.join(', ') : '';
  $('#fQuotaUsd').value = sub ? (sub.quota_usd || '') : '';
  $('#fQuotaReq').value = sub ? (sub.quota_requests || '') : '';
  $('#fRpm').value = sub ? (sub.rpm || '') : '';
  $('#fRpd').value = sub ? (sub.rpd || '') : '';
  if (sub && sub.expires_at) {
    const d = new Date(sub.expires_at);
    const pad = (n) => String(n).padStart(2, '0');
    $('#fExpires').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  } else {
    $('#fExpires').value = '';
  }
  $('#fNote').value = sub ? (sub.note || '') : '';
  $('#drawerMask').classList.add('open');
  $('#drawer').classList.add('open');
}
function closeDrawer() {
  $('#drawerMask').classList.remove('open');
  $('#drawer').classList.remove('open');
}
async function saveDrawer() {
  const id = $('#fId').value;
  const body = {
    name: $('#fName').value.trim(),
    status: $('#fStatus').value,
    models: $('#fModels').value.split(',').map((s) => s.trim()).filter(Boolean),
    quotaUsd: parseFloat($('#fQuotaUsd').value) || 0,
    quotaRequests: parseInt($('#fQuotaReq').value, 10) || 0,
    rpm: parseInt($('#fRpm').value, 10) || 0,
    rpd: parseInt($('#fRpd').value, 10) || 0,
    expiresAt: $('#fExpires').value ? new Date($('#fExpires').value).toISOString() : null,
    note: $('#fNote').value,
  };
  if (!body.name) { toast('请填写名称', 'err'); return; }
  if (body.models.length === 0) delete body.models; // 留空 = 全部
  $('#drawerSave').disabled = true;
  try {
    if (id) {
      await api('/admin/subs/' + id, { method: 'PATCH', body: JSON.stringify(body) });
      toast('已保存', 'ok');
    } else {
      const { subscription } = await api('/admin/subs', { method: 'POST', body: JSON.stringify(body) });
      toast('已创建，密钥已生成', 'ok');
      // 展示新 key
      setTimeout(() => showNewKey(subscription.key), 200);
    }
    closeDrawer();
    refresh();
  } catch (e) {
    toast('保存失败：' + e.message, 'err');
  } finally {
    $('#drawerSave').disabled = false;
  }
}
function showNewKey(key) {
  $('#modalTitle').textContent = '订阅密钥';
  $('#modalBody').innerHTML = '<div>新订阅的 API Key（请妥善保存，仅完整显示一次）：</div>' +
    '<div class="key-result" style="margin-top:10px"><div class="k">' + esc(key) + '</div></div>' +
    '<div style="margin-top:10px;font-size:12px;color:var(--text-3)">在订阅卡片上可随时复制。</div>';
  $('#modalOk').textContent = '复制';
  $('#modalMask').classList.add('open');
  const ok = () => { cleanup(); navigator.clipboard.writeText(key).then(() => toast('已复制', 'ok')); };
  const cancel = () => { cleanup(); };
  function cleanup() {
    $('#modalMask').classList.remove('open');
    $('#modalOk').textContent = '确认';
    $('#modalOk').removeEventListener('click', ok);
    $('#modalCancel').removeEventListener('click', cancel);
  }
  $('#modalOk').addEventListener('click', ok);
  $('#modalCancel').addEventListener('click', cancel);
}

// ============ 详情抽屉 ============
async function openDetail(id) {
  try {
    const { subscription, usage } = await api('/admin/subs/' + id);
    state.detailSub = subscription; state.detailUsage = usage;
    $('#detailTitle').textContent = subscription.name;
    $('#detailBody').innerHTML = renderDetail(subscription, usage);
    $('#detailMask').classList.add('open');
    $('#detailDrawer').classList.add('open');
  } catch (e) {
    toast('加载详情失败：' + e.message, 'err');
  }
}
function closeDetail() {
  $('#detailMask').classList.remove('open');
  $('#detailDrawer').classList.remove('open');
}
function renderDetail(s, usage) {
  const statusTag = s.expired ? '<span class="dot exp"></span>已过期' : s.status === 'active' ? '<span class="dot ok"></span>正常' : '<span class="dot off"></span>已停用';
  const models = s.modelsList === '*' ? '全部模型' : s.modelsList.join(', ');
  let html = '';
  html += kv('状态', '<span class="status-tag">' + statusTag + '</span>');
  html += kv('API Key', '<span class="mono" style="font-size:11px;word-break:break-all">' + esc(s.key) + '</span> <button class="btn-icon" data-act="copy" data-key="' + esc(s.key) + '">复制</button>');
  html += kv('模型', esc(models));
  html += kv('美元额度', s.quota_usd > 0 ? '$' + fmt(s.quota_usd) : '不限');
  html += kv('已用美元', '$' + fmt(s.used_usd, 6));
  html += kv('请求数', fmt(s.used_requests, 0) + (s.quota_requests > 0 ? ' / ' + fmt(s.quota_requests, 0) : ''));
  html += kv('RPM / RPD', (s.rpm || '—') + ' / ' + (s.rpd || '—'));
  html += kv('过期', s.expires_at ? shortTime(s.expires_at) : '—');
  html += kv('备注', s.note ? esc(s.note) : '—');
  html += kv('创建', shortTime(s.created_at));
  html += '<div class="card-title" style="margin:20px 0 12px">最近 20 条用量</div>';
  if (usage.length) {
    html += '<div style="font-size:12px"><table><thead><tr><th>时间</th><th>模型</th><th>成本</th><th>状态</th></tr></thead><tbody>' +
      usage.map((r) => '<tr><td>' + shortTime(r.created_at) + '</td><td class="mono">' + esc(r.model) + '</td><td class="mono">$' + fmt(r.cost_usd, 6) + '</td><td>' + esc(r.status) + '</td></tr>').join('') +
      '</tbody></table></div>';
  } else {
    html += '<div class="empty" style="padding:24px">暂无用量记录</div>';
  }
  return html;
}
function kv(k, v) {
  return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start"><span style="color:var(--text-3);font-size:12px;flex-shrink:0;min-width:70px">' + k + '</span><span style="text-align:right;font-size:13px">' + v + '</span></div>';
}

// ============ 事件委托：订阅操作 ============
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const id = t.dataset.id ? Number(t.dataset.id) : null;
  const sub = id ? state.subs.find((x) => x.id === id) : null;

  if (act === 'copy') {
    const btn = t.classList.contains('k') ? null : t;
    const markDone = () => {
      if (btn) {
        const old = btn.textContent;
        btn.textContent = '已复制 ✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1500);
      }
    };
    copyText(t.dataset.key, markDone);
    toast('已复制到剪贴板', 'ok');
  } else if (act === 'toggle') {
    const disabling = sub.status === 'active';
    const ok = await confirm2(disabling ? '禁用账户' : '启用账户',
      disabling
        ? '将<strong>暂时禁用</strong> <b>' + esc(sub.name) + '</b>，期间所有请求会被拒绝。可随时重新启用。确定？'
        : '将恢复 <b>' + esc(sub.name) + '</b> 的正常使用。确定？');
    if (!ok) return;
    try {
      await api('/admin/subs/' + id, { method: 'PATCH', body: JSON.stringify({ status: disabling ? 'disabled' : 'active' }) });
      toast(disabling ? '已禁用' : '已启用', 'ok');
      refresh();
    } catch (e) { toast('操作失败：' + e.message, 'err'); }
  } else if (act === 'expand') {
    state.expandModels[id] = true;
    renderSubs();
  } else if (act === 'collapse') {
    state.expandModels[id] = false;
    renderSubs();
  } else if (act === 'detail') {
    openDetail(id);
  } else if (act === 'edit') {
    if (sub) openDrawer(sub);
  } else if (act === 'rotate') {
    const ok = await confirm2('换 API Key', '将为 <b>' + esc(sub.name) + '</b> 生成新密钥，<b style="color:var(--red)">旧密钥立即失效</b>。确定继续？');
    if (!ok) return;
    try {
      const { subscription } = await api('/admin/subs/' + id, { method: 'PATCH', body: JSON.stringify({ rotateKey: true }) });
      toast('已换发新 Key', 'ok');
      showNewKey(subscription.key);
      refresh();
    } catch (e) { toast('换 Key 失败：' + e.message, 'err'); }
  } else if (act === 'reset') {
    const ok = await confirm2('重置用量', '将清零 <b>' + esc(sub.name) + '</b> 的已用美元与请求数。确定？');
    if (!ok) return;
    try { await api('/admin/subs/' + id + '/reset', { method: 'POST' }); toast('已重置', 'ok'); refresh(); }
    catch (e) { toast('重置失败：' + e.message, 'err'); }
  } else if (act === 'del') {
    const ok = await confirm2('删除订阅', '将永久删除 <b>' + esc(sub.name) + '</b> 及其用量记录，不可恢复。确定？');
    if (!ok) return;
    try { await api('/admin/subs/' + id, { method: 'DELETE' }); toast('已删除', 'ok'); refresh(); }
    catch (e) { toast('删除失败：' + e.message, 'err'); }
  }
});

// ============ 绑定 ============
$('#loginBtn').addEventListener('click', doLogin);
$('#adminKey').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#navList').addEventListener('click', (e) => { const n = e.target.closest('.nav-item'); if (n) go(n.dataset.route); });
$('#menuBtn').addEventListener('click', openSidebarMobile);
$('#overlay').addEventListener('click', closeSidebarMobile);
$('#themeToggle').addEventListener('click', cycleTheme);
$('#mobileTheme').addEventListener('click', cycleTheme);
$('#newSubBtn').addEventListener('click', () => openDrawer(null));
$('#drawerClose').addEventListener('click', closeDrawer);
$('#drawerCancel').addEventListener('click', closeDrawer);
$('#drawerMask').addEventListener('click', closeDrawer);
$('#drawerSave').addEventListener('click', saveDrawer);
$('#detailClose').addEventListener('click', closeDetail);
$('#detailMask').addEventListener('click', closeDetail);
$('#modalMask').addEventListener('click', (e) => { if (e.target === $('#modalMask')) $('#modalMask').classList.remove('open'); });
$('#modelSearch').addEventListener('input', renderModels);
$('#subSearch').addEventListener('input', renderSubs);
$('#subFilter').addEventListener('change', renderSubs);
$('#subSort').addEventListener('change', renderSubs);
$('#trendDim').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  trendState.dim = b.dataset.dim;
  trendState.sel = null;
  $$('#trendDim button').forEach((x) => x.classList.toggle('active', x === b));
  renderTrend();
});
$('#trendGran').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  trendState.gran = b.dataset.gran;
  trendState.sel = null;
  $$('#trendGran button').forEach((x) => x.classList.toggle('active', x === b));
  renderTrend();
});
$('#trendDays').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  trendState.days = Number(b.dataset.days);
  trendState.sel = null;
  $$('#trendDays button').forEach((x) => x.classList.toggle('active', x === b));
  loadTrend();
});
$('#trendChart').addEventListener('click', (e) => {
  const c = e.target.closest('.trend-col');
  if (!c) return;
  trendState.sel = trendState.sel === c.dataset.bucket ? null : c.dataset.bucket;
  renderTrend();
});
$('#trendDetail').addEventListener('click', (e) => {
  if (e.target.closest('#trendClose')) { trendState.sel = null; renderTrend(); }
});
$('#refreshUsageBtn').addEventListener('click', loadUsage);
$('#refreshOverviewBtn').addEventListener('click', () => refresh(true));
$('#applyUsageFilter').addEventListener('click', loadUsage);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeDetail(); $('#modalMask').classList.remove('open'); } });

// ============ 启动 ============
applyTheme();
if (state.token) {
  // 校验 token
  api('/admin/stats').then(() => { showApp(); router(); refresh(); }).catch(() => showAuth());
} else {
  showAuth();
}
</script>
</body>
</html>`;

module.exports = { HTML };
