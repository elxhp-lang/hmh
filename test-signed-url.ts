import TosClient from '@volcengine/tos-sdk';

const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
const accessKeySecret = process.env.VOLCENGINE_SECRET_ACCESS_KEY;

if (!accessKeyId || !accessKeySecret) {
  throw new Error('Missing VOLCENGINE_ACCESS_KEY_ID or VOLCENGINE_SECRET_ACCESS_KEY');
}

const tosClient = new TosClient({
  accessKeyId,
  accessKeySecret,
  region: 'cn-beijing',
  endpoint: 'tos-cn-beijing.volces.com',
});

async function test() {
  // 生成实际存在的视频的签名 URL
  const realKey = 'users/d4fd9027-7071-4c39-9e9f-1f6f8e424e3b/videos/video_1775324492829.mp4';
  
  console.log('=== 为实际视频生成签名 URL ===');
  console.log('Key:', realKey);
  
  const signedUrl = tosClient.getPreSignedUrl({
    bucket: 'hmhv',
    key: realKey,
    method: 'GET',
    expires: 3600,
  });
  
  console.log('\n签名 URL:');
  console.log(signedUrl);
  
  // 测试访问
  console.log('\n=== 测试访问签名 URL ===');
  try {
    const response = await fetch(signedUrl, { method: 'HEAD' });
    console.log('状态码:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('Content-Length:', response.headers.get('content-length'));
    
    if (response.ok) {
      console.log('\n✅ 签名 URL 访问成功！');
    } else {
      console.log('\n❌ 签名 URL 访问失败');
    }
  } catch (e: any) {
    console.error('请求失败:', e.message);
  }
}

test();
