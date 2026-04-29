import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { existsSync } from 'node:fs';

// ffprobe-static has no bundled types in this project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffprobeStatic = require('ffprobe-static') as { path?: string };

export function getFfmpegBinary(): string {
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;
  return ffmpegInstaller.path || 'ffmpeg';
}

export function getFfprobeBinary(): string {
  const envPath = process.env.FFPROBE_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;
  return ffprobeStatic.path || 'ffprobe';
}

export function getYtDlpBinary(): string {
  const envPath = process.env.YTDLP_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const userLocalPath = `${home}/.local/bin/yt-dlp`;
    if (existsSync(userLocalPath)) {
      return userLocalPath;
    }
  }

  return 'yt-dlp';
}
