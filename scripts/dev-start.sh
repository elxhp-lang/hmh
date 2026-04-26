#!/bin/bash
# 简单的启动脚本
# 会先清理错误的 serve 进程，然后启动正确的 Next.js 服务

set -Eeuo pipefail

PORT=5000
LOG_FILE="/app/work/logs/bypass/dev.log"

cd "${COZE_WORKSPACE_PATH:-/workspace/projects}"

# 确保日志目录存在
mkdir -p /app/work/logs/bypass

# 清理所有 serve 进程（这是导致404问题的根源）
echo "检查并清理错误的 serve 进程..."
pkill -9 -f "serve.*${PORT}" 2>/dev/null || true
pkill -9 -f "npm exec serve" 2>/dev/null || true
sleep 1

# 检查端口是否被占用
if ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -q LISTEN; then
    echo "端口 ${PORT} 已被占用，检查进程类型..."
    pid=$(ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
    process_name=$(ps -p "${pid}" -o comm= 2>/dev/null || echo "unknown")
    
    if [[ "${process_name}" == *"serve"* ]] || [[ "${process_name}" == *"node"* ]]; then
        echo "终止进程 ${pid} (${process_name})"
        kill -9 "${pid}" 2>/dev/null || true
        sleep 2
    fi
fi

# 启动健康监控（如果不存在）
if ! pgrep -f "health-monitor.sh" > /dev/null 2>&1; then
    nohup bash ./scripts/health-monitor.sh > /app/work/logs/bypass/health-monitor.log 2>&1 &
fi

# 启动 Next.js 服务
echo "Starting Next.js server on port ${PORT}..."
PORT=${PORT} pnpm tsx watch src/server.ts 2>&1 | tee -a "${LOG_FILE}"
