#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
export PATH="${HOME:-/root}/.local/bin:${PATH}"
export PATH="${COZE_WORKSPACE_PATH}/bin:${PATH}"

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

log() {
    echo "[start] $1"
}

run_with_timeout() {
    local seconds="$1"
    shift
    if command -v timeout >/dev/null 2>&1; then
        timeout "${seconds}" "$@"
    else
        "$@"
    fi
}

ensure_runtime_media_tools() {
    if [[ -f "${COZE_WORKSPACE_PATH}/bin/ffmpeg" && -z "${FFMPEG_PATH:-}" ]]; then
        export FFMPEG_PATH="${COZE_WORKSPACE_PATH}/bin/ffmpeg"
    fi
    if [[ -f "${COZE_WORKSPACE_PATH}/bin/ffprobe" && -z "${FFPROBE_PATH:-}" ]]; then
        export FFPROBE_PATH="${COZE_WORKSPACE_PATH}/bin/ffprobe"
    fi
    if [[ -f "${COZE_WORKSPACE_PATH}/bin/yt-dlp" && -z "${YTDLP_PATH:-}" ]]; then
        export YTDLP_PATH="${COZE_WORKSPACE_PATH}/bin/yt-dlp"
    fi

    if [[ -d "${COZE_WORKSPACE_PATH}/bin" ]]; then
        chmod +x "${COZE_WORKSPACE_PATH}/bin/ffmpeg" 2>/dev/null || true
        chmod +x "${COZE_WORKSPACE_PATH}/bin/ffprobe" 2>/dev/null || true
        chmod +x "${COZE_WORKSPACE_PATH}/bin/yt-dlp" 2>/dev/null || true
    fi

    local ffmpeg_ok=0
    local ffprobe_ok=0
    local ytdlp_ok=0

    if command -v ffmpeg >/dev/null 2>&1; then ffmpeg_ok=1; fi
    if command -v ffprobe >/dev/null 2>&1; then ffprobe_ok=1; fi
    if command -v yt-dlp >/dev/null 2>&1; then ytdlp_ok=1; fi

    if [[ "$ffmpeg_ok" -eq 1 && "$ffprobe_ok" -eq 1 && "$ytdlp_ok" -eq 1 ]]; then
        log "Media tools already available"
        return 0
    fi

    log "Runtime media tools missing, trying best-effort install"

    if command -v apt-get >/dev/null 2>&1; then
        run_with_timeout 120 apt-get update || true
        # ffmpeg package normally includes ffprobe on Debian/Ubuntu.
        run_with_timeout 180 apt-get install -y ffmpeg || true
    elif command -v apk >/dev/null 2>&1; then
        run_with_timeout 120 apk add --no-cache ffmpeg || true
    fi

    if ! command -v yt-dlp >/dev/null 2>&1; then
        if command -v python3 >/dev/null 2>&1; then
            run_with_timeout 120 python3 -m pip install --user -U yt-dlp || true
        elif command -v python >/dev/null 2>&1; then
            run_with_timeout 120 python -m pip install --user -U yt-dlp || true
        fi
    fi

    if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 && command -v yt-dlp >/dev/null 2>&1; then
        log "Runtime media tools ready"
    else
        log "Runtime media tools still partial; service will run with degraded capabilities"
    fi
}

start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    ensure_runtime_media_tools
    log "Starting HTTP service on port ${DEPLOY_RUN_PORT}"
    PORT=${DEPLOY_RUN_PORT} node dist/server.js
}

log "Preparing startup on port ${DEPLOY_RUN_PORT}"
start_service
