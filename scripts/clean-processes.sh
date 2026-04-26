#!/bin/bash
# 自动化清理无用进程脚本
# 功能：只清理完全重复的进程（命令行完全相同），保留唯一的 coze dev 进程
# 策略：
# 1. 获取所有相关进程的完整命令行
# 2. 按命令行分组，统计每个唯一命令的进程数量
# 3. 如果有多个相同命令的进程，只保留第一个，杀死其余的
# 4. 如果是唯一的进程（包括 coze dev），保留不杀

# 日志文件
LOG_FILE="/app/work/logs/bypass/process-cleaner.log"

# 记录日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# 清理函数
clean_duplicates() {
    log "开始检查重复进程..."
    
    # 获取所有相关进程（使用完整命令行）
    # 格式：PID CMDLINE
    ALL_PROCESSES=$(ps -eo pid,args 2>/dev/null | grep -E 'tsx watch|pnpm' | grep -v grep | grep -v 'clean-processes')
    
    # 统计进程数量
    COUNT=$(echo "$ALL_PROCESSES" | wc -l)
    
    if [ $COUNT -eq 0 ]; then
        log "没有发现相关进程"
        return
    fi
    
    if [ $COUNT -eq 1 ]; then
        PID=$(echo "$ALL_PROCESSES" | awk '{print $1}')
        CMDLINE=$(echo "$ALL_PROCESSES" | awk '{for(i=2;i<=NF;i++) printf "%s ", $i}')
        log "发现 1 个进程 $PID: $CMDLINE - 正常，无需清理"
        return
    fi
    
    log "发现 $COUNT 个相关进程"
    
    # 按命令行分组，统计重复
    echo "$ALL_PROCESSES" | awk '{
        # 拼接完整命令行
        cmdline = ""
        for (i = 2; i <= NF; i++) cmdline = cmdline " " $i
        sub(/^ /, "", cmdline)
        
        # 存储到关联数组
        if (!(cmdline in pid_list)) {
            pid_list[cmdline] = $1
            count[cmdline] = 1
        } else {
            pid_list[cmdline] = pid_list[cmdline] " " $1
            count[cmdline]++
        }
    } END {
        for (cmdline in count) {
            # 只输出有重复的命令行
            if (count[cmdline] > 1) {
                print cmdline ":|" pid_list[cmdline]
            }
        }
    }' > /tmp/duplicate_cmds.tmp
    
    # 检查是否有重复
    if [ ! -s /tmp/duplicate_cmds.tmp ]; then
        log "没有发现重复进程，每个命令行都是唯一的"
        return
    fi
    
    # 处理重复进程
    while IFS=: read -r cmdline pids; do
        # 跳过空行
        [ -z "$cmdline" ] && continue
        
        # 提取重复的 PID（跳过第一个）
        FIRST_PID=""
        OTHER_PIDS=""
        
        for pid in $pids; do
            if [ -z "$FIRST_PID" ]; then
                FIRST_PID=$pid
            else
                OTHER_PIDS="$OTHER_PIDS $pid"
            fi
        done
        
        log "命令行重复: $cmdline"
        log "  保留进程: $FIRST_PID"
        
        # 杀死重复进程
        for pid in $OTHER_PIDS; do
            # 再次确认这个进程还在运行
            if ps -p $pid > /dev/null 2>&1; then
                log "  杀死重复进程: $pid"
                kill -9 $pid 2>/dev/null
            fi
        done
        
    done < /tmp/duplicate_cmds.tmp
    
    # 清理临时文件
    rm -f /tmp/duplicate_cmds.tmp
    
    log "检查完成"
}

# 主循环：每60秒执行一次清理
while true; do
    clean_duplicates
    sleep 60
done
