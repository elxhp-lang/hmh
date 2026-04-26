// 加载环境变量（在开发环境中）
import * as dotenv from 'dotenv';
import * as path from 'path';
if (process.env.COZE_PROJECT_ENV !== 'PROD') {
  // 尝试加载 .env.local 文件
  const envPath = path.resolve(process.cwd(), '.env.local');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn('Failed to load .env.local:', result.error.message);
  } else {
    console.log('Loaded .env.local successfully');
  }
}

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// 导入并启动轮询服务
import { VideoGenerationPoller } from './lib/video-generation-poller';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// Create Next.js app with increased body size limit
const app = next({ 
  dev, 
  hostname, 
  port,
  // Note: For large file uploads, we need to handle them via streaming
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // 启动视频生成轮询服务
  console.log('[Server] 启动视频生成轮询服务...');
  const poller = new VideoGenerationPoller();
  poller.start();
  
  const server = createServer(async (req, res) => {
    // Set higher limits for large file uploads
    // Note: This doesn't directly affect Next.js body parser
    // but helps with the raw request handling
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  
  // Increase server timeouts for large file uploads
  server.timeout = 600000; // 10 minutes
  server.keepAliveTimeout = 65000;
  
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
});
