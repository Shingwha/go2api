'use strict';

/**
 * 内存速率限制（RPM）。
 * 单实例部署即可用；多实例部署请改用 Redis（见 README）。
 */
const buckets = new Map(); // key -> { windowStart, count }
const CLEANUP_INTERVAL = 60_000;

function checkRpm(subId, rpm) {
  if (!rpm || rpm <= 0) return true;
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / 60_000) * 60_000;
  const cur = buckets.get(subId);
  if (!cur || cur.windowStart !== windowStart) {
    buckets.set(subId, { windowStart, count: 1 });
    return true;
  }
  if (cur.count >= rpm) return false;
  cur.count += 1;
  return true;
}

// 定期清理过期桶，防止内存泄漏
setInterval(() => {
  const nowMs = Date.now();
  for (const [k, v] of buckets) {
    if (nowMs - v.windowStart > 120_000) buckets.delete(k);
  }
}, CLEANUP_INTERVAL).unref();

module.exports = { checkRpm };
