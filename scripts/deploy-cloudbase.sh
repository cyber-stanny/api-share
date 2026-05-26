#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAGE_DIR="$(mktemp -d /tmp/api-share-src-deploy.XXXXXX)"
DEPLOY_CONFIG="$(mktemp /tmp/api-share-cloudbaserc.XXXXXX.json)"

cleanup() {
  rm -rf "$STAGE_DIR" "$DEPLOY_CONFIG"
}
trap cleanup EXIT

# Build frontend first
npm run build:frontend

if [ ! -f "$ROOT_DIR/src/public/index.html" ] || [ ! -f "$ROOT_DIR/src/public/admin.html" ]; then
  echo "Frontend build did not produce src/public/index.html and src/public/admin.html" >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/src/public/assets" ] || ! find "$ROOT_DIR/src/public/assets" -type f | grep -q .; then
  echo "Frontend build did not produce src/public/assets" >&2
  exit 1
fi

cp -R "$ROOT_DIR/src/." "$STAGE_DIR/"
cp "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json" "$STAGE_DIR/"

node - "$ROOT_DIR" "$DEPLOY_CONFIG" <<'NODE'
const fs = require('fs');
const path = require('path');

const rootDir = process.argv[2];
const out = process.argv[3];
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
}

const cfg = JSON.parse(fs.readFileSync(path.join(rootDir, 'cloudbaserc.json'), 'utf8'));
const required = ['CLOUDBASE_ENV_ID', 'JWT_SECRET', 'ADMIN_INIT_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

const value = (key, fallback = '') => process.env[key] || fallback;

cfg.envId = value('CLOUDBASE_ENV_ID');
for (const fn of cfg.functions || []) {
  fn.envVariables = {
    ...fn.envVariables,
    CLOUDBASE_ENV_ID: value('CLOUDBASE_ENV_ID'),
    JWT_SECRET: value('JWT_SECRET'),
    ADMIN_INIT_PASSWORD: value('ADMIN_INIT_PASSWORD'),
    CORS_ORIGINS: value('CORS_ORIGINS', '*'),
    PROXY_ENABLED: value('PROXY_ENABLED', 'true'),
    MIMO_API_KEY: value('MIMO_API_KEY'),
    ALIYUN_API_KEY: value('ALIYUN_API_KEY'),
  };
}

fs.writeFileSync(out, JSON.stringify(cfg, null, 2));
NODE

tcb --config-file "$DEPLOY_CONFIG" fn deploy api-share --dir "$STAGE_DIR" --force
