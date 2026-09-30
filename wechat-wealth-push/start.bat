@echo off
cd /d "%~dp0"
if not exist ".env" (
  copy .env.example .env
  echo 已根据 .env.example 生成 .env，请按需修改 WX_APPID / WX_APPSECRET 等。
)
call npm install --omit=dev
echo 启动后端，访问 http://localhost:3000/api/health 健康检查
node src/server.js
pause
