#!/bin/bash
# 快速健康检查和修复脚本
# 手动执行以检查服务状态并在需要时修复

set -Eeuo pipefail

PORT=5000

echo "============================================"
echo "  海盟会服务健康检查"
echo "============================================"

# 检查端口
echo ""
echo "1. 检查端口 ${PORT} 状态..."
PID=$(ss -lptn 'sport = :'"${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)

if [[ -z "${PID}" ]]; then
    echo "   ❌ 端口 ${PORT} 没有进程监听"
    echo ""
    echo "正在启动服务..."
    cd /workspace/projects
    coze dev > /app/work/logs/bypass/dev.log 2>&1 &
    echo "服务启动中，请等待..."
    sleep 8
    exec "$0" "$@"
fi

echo "   ✓ 端口 ${PORT} 有进程监听 (PID: ${PID})"

# 检查健康端点
echo ""
echo "2. 检查健康端点..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/health" 2>/dev/null || echo "000")

if [[ "${HEALTH_STATUS}" == "200" ]]; then
    echo "   ✓ 健康检查通过 (HTTP ${HEALTH_STATUS})"
else
    echo "   ❌ 健康检查失败 (HTTP ${HEALTH_STATUS})"
fi

# 检查主要页面
echo ""
echo "3. 检查主要页面..."
PAGES=("/login" "/dashboard" "/video" "/video/analyze" "/agent" "/billing")
ALL_OK=true

for page in "${PAGES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${page}" 2>/dev/null || echo "000")
    if [[ "${STATUS}" == "200" ]]; then
        echo "   ✓ ${page} - 200"
    else
        echo "   ❌ ${page} - ${STATUS}"
        ALL_OK=false
    fi
done

# 总结和建议
echo ""
echo "============================================"
if [[ "${ALL_OK}" == "true" && "${HEALTH_STATUS}" == "200" ]]; then
    echo "  状态: ✓ 一切正常"
    echo "============================================"
else
    echo "  状态: ❌ 检测到问题"
    echo "============================================"
    echo ""
    echo "建议操作:"
    echo ""
    echo "1. 自动修复（重启服务）:"
    echo "   pkill -f 'pnpm tsx' ; pkill -f 'node.*server' ; sleep 2 ; coze dev &"
    echo ""
    echo "2. 查看日志:"
    echo "   tail -50 /app/work/logs/bypass/dev.log"
    echo ""
    echo "3. 检查进程:"
    echo "   ps aux | grep -E 'node|next' | grep -v grep"
fi

echo ""
