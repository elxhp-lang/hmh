#!/bin/bash
# 开发环境启动脚本
# 确保只有一个服务实例运行

# 不使用严格模式，避免 pkill 返回非零导致脚本退出
# set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-/workspace/projects}"
LOG_FILE="/app/work/logs/bypass/dev.log"

cd "${COZE_WORKSPACE_PATH}"

echo "============================================"
echo "  海盟会服务启动"
echo "============================================"

# 1. 彻底清理所有旧进程
cleanup_old_processes() {
    echo ""
    echo "1. 清理旧进程..."
    
    # 杀掉所有 serve 进程（这是导致404问题的根源）
    pkill -9 -f "serve" 2>/dev/null || true
    pkill -9 -f "npm exec serve" 2>/dev/null || true
    pkill -9 -f "pnpm serve" 2>/dev/null || true
    # 杀掉所有 tsx watch 进程
    pkill -9 -f "tsx" 2>/dev/null || true
    # 杀掉所有 coze dev 进程
    pkill -9 -f "coze" 2>/dev/null || true
    # 杀掉所有 next 进程
    pkill -9 -f "next" 2>/dev/null || true
    # 杀掉所有 node server.ts 进程
    pkill -9 -f "node.*server" 2>/dev/null || true
    # 杀掉健康监控
    pkill -9 -f "health-monitor" 2>/dev/null || true
    
    sleep 2
    
    # 再次检查端口
    local pid
    pid=$(ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
    if [[ -n "${pid}" ]]; then
        echo "   强制终止端口 ${PORT} 的进程 (PID: ${pid})"
        kill -9 "${pid}" 2>/dev/null || true
        sleep 1
    fi
    
    echo "   ✓ 旧进程已清理"
}

# 2. 确保日志目录存在
ensure_log_dir() {
    mkdir -p /app/work/logs/bypass
    touch "${LOG_FILE}"
}

# 3. 启动健康监控
start_health_monitor() {
    local monitor_script="${COZE_WORKSPACE_PATH}/scripts/health-monitor.sh"
    if [[ -f "${monitor_script}" ]]; then
        chmod +x "${monitor_script}"
        # 确保只有一个监控实例
        if ! pgrep -f "health-monitor.sh" > /dev/null 2>&1; then
            echo "   启动健康监控..."
            nohup bash "${monitor_script}" > /app/work/logs/bypass/health-monitor.log 2>&1 &
        fi
    fi
}

# 4. 启动服务
start_service() {
    echo ""
    echo "2. 启动服务..."
    
    # 清空旧日志
    > "${LOG_FILE}"
    
    # 启动 Next.js 服务
    PORT=${PORT} pnpm tsx watch src/server.ts >> "${LOG_FILE}" 2>&1 &
    
    echo "   等待服务启动..."
    
    # 等待服务就绪
    local retries=0
    local max_retries=30
    
    while [[ ${retries} -lt ${max_retries} ]]; do
        sleep 1
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/health" 2>/dev/null | grep -q "200"; then
            echo "   ✓ 服务启动成功"
            return 0
        fi
        ((retries++))
        printf "."
    done
    
    echo ""
    echo "   ⚠ 服务启动超时，请检查日志: ${LOG_FILE}"
    return 1
}

# 5. 显示状态
show_status() {
    echo ""
    echo "============================================"
    echo "  服务已启动"
    echo "============================================"
    echo ""
    echo "  访问地址: ${COZE_PROJECT_DOMAIN_DEFAULT}"
    echo "  本地地址: http://localhost:${PORT}"
    echo ""
    echo "  日志文件: ${LOG_FILE}"
    echo "  健康检查: /workspace/projects/scripts/check-health.sh"
    echo ""
}

# 主流程
main() {
    cleanup_old_processes
    ensure_log_dir
    start_health_monitor
    start_service
    show_status
}

main "$@"
