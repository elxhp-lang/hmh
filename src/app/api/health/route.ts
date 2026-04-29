import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getFfmpegBinary, getFfprobeBinary, getYtDlpBinary } from '@/lib/media-binaries';

const execFileAsync = promisify(execFile);

async function checkBinary(command: string, args: string[] = ['--version']): Promise<boolean> {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}

/**
 * 健康检查 API
 * GET /api/health
 * 
 * 返回服务状态信息，用于监控和自动修复
 */
export async function GET() {
  const [ffmpegAvailable, ffprobeAvailable, ytDlpAvailable] = await Promise.all([
    checkBinary(getFfmpegBinary()),
    checkBinary(getFfprobeBinary()),
    checkBinary(getYtDlpBinary()),
  ]);

  const healthInfo = {
    status: 'ok',
    service: 'nextjs',
    timestamp: new Date().toISOString(),
    env: process.env.COZE_PROJECT_ENV || 'DEV',
    port: process.env.PORT || '5000',
    capabilities: {
      ffmpegAvailable,
      ffprobeAvailable,
      ytDlpAvailable,
    },
  };

  return NextResponse.json(healthInfo);
}
