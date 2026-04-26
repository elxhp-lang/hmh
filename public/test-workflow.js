/**
 * 测试创意小海工作流
 * 验证8步骤工作流是否正常工作
 */

async function testWorkflow() {
  console.log('🧪 开始测试创意小海工作流...\n');

  try {
    // 1. 测试欢迎消息
    console.log('步骤1: 测试欢迎消息');
    const welcomeResponse = await fetch('/api/xiaohai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + btoa(JSON.stringify({ userId: 'test_user', username: 'test' })),
      },
      body: JSON.stringify({ action: 'welcome' }),
    });

    if (!welcomeResponse.ok) {
      console.error('❌ 欢迎消息测试失败');
      return;
    }

    const welcomeText = await welcomeResponse.text();
    console.log('✅ 欢迎消息响应:', welcomeText.substring(0, 100), '...\n');

    // 2. 测试任务识别（文本输入）
    console.log('步骤2: 测试任务识别（文本）');
    const recognizeResponse = await fetch('/api/xiaohai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + btoa(JSON.stringify({ userId: 'test_user', username: 'test' })),
      },
      body: JSON.stringify({ 
        action: 'recognize',
        message: '帮我制作保温杯的产品视频'
      }),
    });

    if (!recognizeResponse.ok) {
      console.error('❌ 任务识别测试失败');
      return;
    }

    const recognizeText = await recognizeResponse.text();
    console.log('✅ 任务识别响应:', recognizeText.substring(0, 200), '...\n');

    // 3. 测试视频链接输入
    console.log('步骤3: 测试视频链接输入');
    const videoResponse = await fetch('/api/xiaohai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + btoa(JSON.stringify({ userId: 'test_user', username: 'test' })),
      },
      body: JSON.stringify({ 
        action: 'recognize',
        message: '分析这个视频',
        attachments: [
          {
            type: 'video_link',
            url: 'https://example.com/video.mp4',
          }
        ]
      }),
    });

    if (!videoResponse.ok) {
      console.error('❌ 视频链接测试失败');
      return;
    }

    const videoText = await videoResponse.text();
    console.log('✅ 视频链接响应:', videoText.substring(0, 200), '...\n');

    console.log('✅ 工作流测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 在浏览器控制台运行测试
console.log('请在浏览器控制台运行: testWorkflow()');
window.testWorkflow = testWorkflow;
