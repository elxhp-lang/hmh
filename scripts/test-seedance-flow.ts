/**
 * Seedance API 端到端测试：创建→查询→轮询
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { SeedanceClient } from '../src/lib/seedance-client';

async function main() {
  const client = new SeedanceClient();

  // ===== 1. 创建任务 =====
  console.log('===== 1. 创建任务 =====');
  const createResult = await client.createTask({
    model: 'doubao-seedance-2-0-260128',
    content: [
      { type: 'text', text: '一只猫在窗台上睡觉，阳光洒在它身上，毛发清晰可见，温馨治愈风格，4K高清' },
    ],
    duration: 5,
    ratio: '16:9',
    generate_audio: false,
    watermark: false,
  });

  console.log('返回类型:', typeof createResult);
  console.log('完整返回:', JSON.stringify(createResult, null, 2));
  console.log('id 字段:', createResult.id);
  console.log('id 类型:', typeof createResult.id);
  console.log('status:', createResult.status);

  const taskId = createResult.id;
  if (!taskId) {
    console.error('❌ createTask 返回的 id 为空！');
    return;
  }

  // ===== 2. 查询任务 =====
  console.log('\n===== 2. 查询任务状态 =====');

  for (let i = 0; i < 6; i++) {
    console.log(`第 ${i + 1} 次查询...`);
    const getResult = await client.getTask(taskId);
    console.log('  返回类型:', typeof getResult);
    console.log('  id:', getResult.id);
    console.log('  status:', getResult.status);

    if (typeof getResult === 'object') {
      console.log('  content:', getResult.content ? JSON.stringify(getResult.content).substring(0, 200) : '无');
      console.log('  usage:', getResult.usage ? JSON.stringify(getResult.usage) : '无');
      console.log('  error:', getResult.error || '无');
    }

    if (getResult.status === 'succeeded') {
      console.log('✅ 任务完成！');
      if (getResult.content?.video_url) {
        console.log('video_url:', getResult.content.video_url.substring(0, 100));
      }
      break;
    }
    if (getResult.status === 'failed') {
      console.log('❌ 任务失败');
      console.log('error:', JSON.stringify(getResult.error));
      break;
    }

    await new Promise(r => setTimeout(r, 10000));
  }

  // ===== 3. 用错误格式测试 =====
  console.log('\n===== 3. 用错误格式ID查询（模拟LLM传值） =====');
  try {
    // 模拟 LLM 可能传递的格式
    const wrongIds = [
      taskId,                           // 原始ID
      JSON.stringify({ id: taskId }),   // JSON包裹
      `${taskId}_extra`,                // 带后缀
    ];
    for (const wid of wrongIds) {
      try {
        const r = await client.getTask(wid);
        console.log(`  "${wid.slice(0,30)}..." → ${r.status} ✅`);
      } catch (e: any) {
        console.log(`  "${wid.slice(0,30)}..." → ❌ ${e.message?.slice(0,60)}`);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

main().catch(console.error);
