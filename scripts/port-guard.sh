#!/bin/bash
# 端口守护脚本 - 监控并自动修复 serve 进程问题
# 每 5 秒检查一次，如果发现 serve 进程占用 5000 端口，自动杀掉并重启 Next.js

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-/workspace/projects}"
LOG_FILE="/app/work/logs/bypass/port-guard.log"
CHECK_INTERVAL=5

mkdir -p /app/work/logs/bypass

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}"
}

log "端口守护脚本启动，监控端口 ${PORT}"

while true; do
    # 检查端口是否被占用
    PID=$(ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
    
    if [[ -n "${PID}" ]]; then
        # 获取进程名称
        PROC_NAME=$(ps -p "${PID}" -o comm= 2>/dev/null)
        
        # 检查是否是 serve 进程或 MainThread（serve 的主线程）
        if [[ "${PROC_NAME}" == "serve" ]] || [[ "${PROC_NAME}" == "MainThread" ]] || [[ "${PROC_NAME}" == "node" ]]; then
            # 验证是否返回目录列表（serve 的特征）
            RESPONSE=$(curl -s "http://localhost:${PORT}" 2>/dev/null | head -1)
            if echo "${RESPONSE}" | grep -q "Files within"; then
                log "检测到 serve 进程 (PID: ${PID})，正在修复..."
                
                # 杀掉 serve 进程
                kill -9 "${PID}" 2>/dev/null
                sleep 1
                
                # 确保端口已释放
                pkill -9 -f "serve.*${PORT}" 2>/dev/null || true
                
                log "serve 进程已清理，重启 Next.js..."
                
                # 重启 Next.js 服务
                cd "${COZE_WORKSPACE_PATH}"
                PORT=${PORT} pnpm exec next dev --port ${PORT} --hostname 0.0.0.0 >> /app/work/logs/bypass/dev.log 2>&1 &
                
                log "Next.js 服务已重启"
            fi
        fi
    else
        # 端口未被占用，检查是否有 Next.js 进程在运行
        if ! pgrep -f "next dev" > /dev/null 2>&1; then
            log "检测到服务未运行，正在启动..."
            cd "${COZE_WORKSPACE_PATH}"
            PORT=${PORT} pnpm exec next dev --port ${PORT} --hostname 0.0.0.0 >> /app/work/logs/bypass/dev.log 2>&1 &
            log "Next.js 服务已启动"
        fi
    fi
    
    sleep ${CHECK_INTERVAL}
done
