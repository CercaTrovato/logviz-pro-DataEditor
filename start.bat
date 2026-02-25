@echo off
REM 切换到当前批处理文件所在目录
cd /d %~dp0

echo Starting Vite server...
start "" http://localhost:3000

REM 运行 Vite（默认端口3000）
npx vite

pause
