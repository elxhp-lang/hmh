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
    echo "Warning: apt-get install failed, trying python user install for yt-dlp"
  fi

  if command -v apk >/dev/null 2>&1; then
    if apk add --no-cache ffmpeg yt-dlp; then
      echo "Installed media tools via apk"
      return 0
    fi
    echo "Warning: apk install failed, trying python user install for yt-dlp"
  fi

  if command -v python3 >/dev/null 2>&1; then
    if python3 -m pip install --user -U yt-dlp; then
      echo "Installed yt-dlp via python user site"
      return 0
    fi
  fi

  if command -v python >/dev/null 2>&1; then
    if python -m pip install --user -U yt-dlp; then
      echo "Installed yt-dlp via python user site"
      return 0
    fi
  fi

  echo "Warning: failed to install media tools automatically, continue build without media tools"
}

ensure_media_tools

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building the Next.js project..."
pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
