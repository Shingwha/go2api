'use strict';
const http = require('node:http');
const { spawn } = require('node:child_process');
const KEY = process.env.GOKEY;
const GW_PORT = 18996;
let failures = 0;
const check = (n, c, x='') => { console.log((c?'  ✅ ':'  ❌ ')+n+' '+x); if(!c) failures++; };

function req(method, p, { auth, body, headers={} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host:'127.0.0.1', port:GW_PORT, method, path:p, headers:{
      ...(auth?{authorization:'Bearer '+auth}:{}), ...(data?{'content-type':'application/json'}:{}), ...headers } },
      (res)=>{ let c=''; res.on('data',d=>c+=d); res.on('end',()=>resolve({status:res.statusCode, body:c})); });
    r.on('error', reject); if(data) r.write(data); r.end();
  });
}

async function main() {
  const gw = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, PORT:String(GW_PORT), GO_API_KEY:KEY, ADMIN_API_KEY:'live-admin', DB_PATH:'./data/live.db' },
    stdio: ['ignore','pipe','pipe'] });
  gw.stderr.on('data', d=>process.stdout.write('[gw!] '+d));
  await new Promise(r=>setTimeout(r, 800));

  // 创建订阅
  let r = await req('POST','/admin/subs',{auth:'live-admin',body:{name:'live', quotaUsd:0, models:'*'}});
  const sub = JSON.parse(r.body).subscription;
  console.log('[1] 创建订阅', sub.id, sub.key.slice(0,12)+'…');

  // deepseek-v4-flash 非流式
  r = await req('POST','/v1/chat/completions',{auth:sub.key,body:{model:'deepseek-v4-flash',messages:[{role:'user',content:'Say hi in 3 words'}],max_tokens:30}});
  const j = JSON.parse(r.body);
  check('deepseek-v4-flash 真实转发', r.status===200 && j.object==='chat.completion' && j.choices?.[0], r.status+' '+r.body.slice(0,120));

  // deepseek-v4-flash 流式
  r = await req('POST','/v1/chat/completions',{auth:sub.key,body:{model:'deepseek-v4-flash',stream:true,messages:[{role:'user',content:'Count 1 2 3'}],max_tokens:30}});
  check('流式真实转发', r.status===200 && r.body.includes('[DONE]'), r.status);
  check('流式含 usage chunk', r.body.includes('"usage"'));
  check('流式含 inference-cost 事件', r.body.includes('inference-cost'));

  // anthropic 端点（x-api-key 认证）
  r = await req('POST','/v1/messages',{auth:sub.key,body:{model:'minimax-m3',max_tokens:30,messages:[{role:'user',content:'Say OK'}]}});
  const m = JSON.parse(r.body);
  check('minimax-m3 (messages) 真实转发', r.status===200 && m.content?.[0]?.text, r.status+' '+r.body.slice(0,150));

  // 用量日志
  r = await req('GET','/admin/subs/'+sub.id,{auth:'live-admin'});
  const s = JSON.parse(r.body).subscription;
  console.log('[2] 记账结果: used_usd=$'+s.used_usd.toFixed(8), 'requests='+s.used_requests);
  check('3 次请求全部记账', s.used_requests===3, s.used_requests);
  const logs = JSON.parse((await req('GET','/admin/usage?limit=10',{auth:'live-admin'})).body).usage;
  for (const l of logs) console.log('   ', l.model.padEnd(18), 'in:'+l.input_tokens, 'out:'+l.output_tokens, 'cached:'+l.cached_tokens, 'cwrite:'+l.cache_write_tokens, 'est:'+l.estimated, 'cost:$'+l.cost_usd.toFixed(8));

  gw.kill();
  console.log(failures===0 ? '\n🎉 真实上游联调全部通过！' : `\n💥 ${failures} 个失败`);
  process.exit(failures===0?0:1);
}
main().catch(e=>{console.error(e);process.exit(1);});
