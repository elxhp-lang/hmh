import { existsSync } from 'node:fs';

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function getFfmpegBinary(): string {
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;
  return (
    firstExisting(['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) ||
    'ffmpeg'
  );
}

export function getFfprobeBinary(): string {
  const envPath = process.env.FFPROBE_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;
  return (
    firstExisting(['/usr/bin/ffprobe', '/usr/local/bin/ffprobe']) ||
    'ffprobe'
  );
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
