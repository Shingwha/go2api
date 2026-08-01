'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

const env = process.env;

const config = {
  port: parseInt(env.PORT || '3000', 10),
  // 上游 OpenCode Go 网关（v1 已在 base url 中）
  goBaseUrl: (env.GO_BASE_URL || 'https://opencode.ai/zen/go/v1').replace(/\/+$/, ''),
  goApiKey: env.GO_API_KEY || '',
  // 管理密钥：未设置则启动时自动生成
  adminApiKey: env.ADMIN_API_KEY || '',
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'go2api.db'),
  // 全局模型白名单（空数组 = 全部）
  enabledModels: (env.ENABLED_MODELS || '')
    .split(',').map((s) => s.trim()).filter(Boolean),
  defaultQuotaUsd: parseFloat(env.DEFAULT_QUOTA_USD || '0') || 0,
  defaultRpm: parseInt(env.DEFAULT_RPM || '0', 10) || 0,
};

// 自动生成管理密钥（仅当未配置时）
if (!config.adminApiKey) {
  config.adminApiKey = 'go2api-admin-' + crypto.randomBytes(18).toString('base64url');
}

module.exports = config;
