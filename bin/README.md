# Local Media Binaries

This directory is used for environments without root/system package install permission.

Place executable binaries here (Linux target):

- `ffmpeg`
- `ffprobe`
- `yt-dlp`

Then deploy with environment variables (recommended):

- `FFMPEG_PATH=/workspace/projects/bin/ffmpeg`
- `FFPROBE_PATH=/workspace/projects/bin/ffprobe`
- `YTDLP_PATH=/workspace/projects/bin/yt-dlp`

Runtime notes:

- `scripts/start.sh` auto-adds `bin/` to `PATH`
- `scripts/start.sh` auto-runs `chmod +x` for these files
- `src/lib/media-binaries.ts` prioritizes env vars and local `bin/` paths
