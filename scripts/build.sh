#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

ensure_media_tools() {
  if command -v ffmpeg >/dev/null 2>&1 && command -v yt-dlp >/dev/null 2>&1; then
    echo "Media tools already available: ffmpeg + yt-dlp"
    return 0
  fi

  echo "Media tools not found, trying auto-install..."

  if command -v apt-get >/dev/null 2>&1; then
    if apt-get update && apt-get install -y ffmpeg yt-dlp; then
      echo "Installed media tools via apt-get"
      return 0
    fi
    echo "Warning: apt-get install failed, continue build without media tools"
    return 0
  fi

  if command -v apk >/dev/null 2>&1; then
    if apk add --no-cache ffmpeg yt-dlp; then
      echo "Installed media tools via apk"
      return 0
    fi
    echo "Warning: apk install failed, continue build without media tools"
    return 0
  fi

  echo "Warning: unsupported package manager, continue build without media tools"
}

ensure_media_tools

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building the Next.js project..."
pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
