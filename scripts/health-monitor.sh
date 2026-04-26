#!/bin/bash
# 健康检查和自动修复脚本
# 每30秒检查一次，连续失败3次自动重启
# 会自动清理错误的 serve 进程

set -Eeuo pipefail

PORT=5000
CHECK_INTERVAL=30
MAX_RETRIES=3
LOG_FILE="/app/work/logs/bypass/health-monitor.log"
WORKSPACE="/workspace/projects"
PID_FILE="/tmp/nextjs-server.pid"

log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] $1" >> "${LOG_FILE}"
}

# 检查是否有错误的 serve 进程占用端口
check_and_kill_serve() {
    local serve_pids
    serve_pids=$(ps aux | grep -E "serve.*${PORT}" | grep -v grep | awk '{print $2}')
    
    if [[ -n "${serve_pids}" ]]; then
        log "检测到错误的 serve 进程占用端口 ${PORT}，正在清理..."
        for pid in ${serve_pids}; do
            log "终止 serve 进程 (PID: ${pid})"
            kill -9 "${pid}" 2>/dev/null || true
        done
        sleep 2
        log "serve 进程已清理"
        return 0
    fi
    return 1
}

# 检查健康端点
check_health() {
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/health" 2>/dev/null || echo "000")
    [[ "${status}" == "200" ]]
}

# 检查是否是真正的 Next.js 服务（而不是 serve）
check_is_nextjs() {
    local body
    body=$(curl -s "http://localhost:${PORT}/login" 2>/dev/null | head -c 500)
    # 检查是否包含 Next.js 特征
    if [[ "${body}" == *"__NEXT_DATA__"* ]] || [[ "${body}" == *"_next"* ]]; then
        return 0
    fi
    return 1
}

# 检查主要页面
check_pages() {
    local pages=("/login" "/video")
    for page in "${pages[@]}"; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${page}" 2>/dev/null || echo "000")
        if [[ "${status}" != "200" ]]; then
            return 1
        fi
    done
    return 0
}

# 重启服务
restart_service() {
    log "正在重启服务..."
    
    # 首先检查并清理 serve 进程
    check_and_kill_serve
    
    # 只杀掉监听端口的进程
    local pid
    pid=$(ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
    
    if [[ -n "${pid}" ]]; then
        log "终止端口 ${PORT} 的进程 (PID: ${pid})"
        kill -9 "${pid}" 2>/dev/null || true
        sleep 2
    fi
    
    # 重新启动 Next.js 服务
    cd "${WORKSPACE}"
    PORT=${PORT} nohup pnpm tsx src/server.ts > /app/work/logs/bypass/dev.log 2>&1 &
    local new_pid=$!
    echo "${new_pid}" > "${PID_FILE}"
    
    log "服务重启命令已发送 (新PID: ${new_pid})"
    
    # 等待启动
    local retries=0
    while [[ ${retries} -lt 15 ]]; do
        sleep 2
        if check_health && check_is_nextjs; then
            log "服务启动成功"
            return 0
        fi
        ((retries++))
    done
    
    log "警告: 服务启动超时"
    return 1
}

# 主循环
main() {
    log "健康监控启动 (检查间隔: ${CHECK_INTERVAL}秒)"
    
    local failures=0
    
    while true; do
        # 首先检查是否有错误的 serve 进程
        if check_and_kill_serve; then
            log "检测到并清理了错误的 serve 进程，准备重启正确的服务..."
            restart_service
            failures=0
            sleep "${CHECK_INTERVAL}"
            continue
        fi
        
        if check_health && check_pages && check_is_nextjs; then
            failures=0
            log "健康检查通过"
        else
            ((failures++))
            log "健康检查失败 (${failures}/${MAX_RETRIES})"
            
            if [[ ${failures} -ge ${MAX_RETRIES} ]]; then
                restart_service
                failures=0
            fi
        fi
        
        sleep "${CHECK_INTERVAL}"
    done
}

main "$@"
