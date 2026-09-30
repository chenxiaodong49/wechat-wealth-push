#!/usr/bin/env bash
# 本地一键启动（Linux / macOS）。Windows 请用 start.bat 或直接在终端跑 npm start。
set -e
cd "$(dirname "$0")"

# 缺失 .env 时自动从示例复制
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已根据 .env.example 生成 .env，请按需修改 WX_APPID / WX_APPSECRET 等。"
fi

# 安装依赖并启动
npm install --omit=dev
echo "==== 启动后端，访问 http://localhost:3000/api/health 健康检查 ===="
node src/server.js
