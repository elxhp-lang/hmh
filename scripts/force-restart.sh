#!/bin/bash
# 强制守护脚本 - 确保正确的 Next.js 服务运行
# 由健康监控调用

set -Eeuo pipefail

PORT=5000
WORKSPACE="/workspace/projects"
LOG_FILE="/app/work/logs/bypass/dev.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> /app/work/logs/bypass/health-monitor.log
}

# 1. 杀掉所有 serve 进程
pkill -9 -f "serve.*${PORT}" 2>/dev/null || true
pkill -9 -f "npm exec serve" 2>/dev/null || true
sleep 1

# 2. 杀掉端口占用的进程
pid=$(ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
if [[ -n "${pid}" ]]; then
    log "终止端口 ${PORT} 的进程 (PID: ${pid})"
    kill -9 "${pid}" 2>/dev/null || true
    sleep 2
fi

# 3. 启动正确的 Next.js 服务
cd "${WORKSPACE}"
PORT=${PORT} nohup pnpm tsx src/server.ts > "${LOG_FILE}" 2>&1 &
new_pid=$!

log "服务已重启 (PID: ${new_pid})"

# 4. 等待启动
retries=0
while [[ ${retries} -lt 15 ]]; do
    sleep 2
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/health" 2>/dev/null | grep -q "200"; then
        log "服务启动成功"
        exit 0
    fi
    ((retries++))
done

log "警告: 服务启动超时"
exit 1
