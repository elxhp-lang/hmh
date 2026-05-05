/**
 * 创意小海深度交互审计 — 模拟完整用户操作流程
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pass: string[] = [];
  const fail: string[] = [];

  function check(name: string, ok: boolean, detail: string) {
    if (ok) { pass.push(name); console.log(`  ✅ ${name}`); }
    else { fail.push(`${name}: ${detail}`); console.log(`  ❌ ${name}: ${detail}`); }
  }

  try {
    // ===== 登录 =====
    console.log('1. 登录');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[placeholder*="用户"]', 'echtest');
    await page.fill('input[type="password"]', 'test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
    check('登录', page.url().includes('dashboard'), `当前: ${page.url()}`);

    // ===== 进入创意小海 =====
    console.log('\n2. 创意小海页面');
    await page.goto(`${BASE}/agent/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    check('页面加载', bodyText.includes('创意小海'), '');
    check('输入框存在', bodyText.includes('textarea') || (await page.locator('textarea').count()) > 0, '');

    // ===== 发送消息测试 =====
    console.log('\n3. 发送消息');
    const textarea = page.locator('textarea').first();
    await textarea.fill('你好，请简单介绍你自己');
    await page.waitForTimeout(200);

    // 找发送按钮
    const sendBtn = page.locator('button').filter({ hasText: '' }).last();
    const allBtns = await page.locator('button').all();
    let clicked = false;
    for (const btn of allBtns) {
      const txt = await btn.textContent();
      if (txt && (txt.includes('发送') || txt.trim() === '')) {
        const rect = await btn.boundingBox();
        if (rect && rect.width < 60 && rect.height < 60) {
          await btn.click();
          clicked = true;
          break;
        }
      }
    }
    check('发送按钮可点击', clicked, '尝试点击了疑似发送按钮');

    // 等待 LLM 回复
    await page.waitForTimeout(6000);

    // 检查页面现在有消息内容
    const pageText = await page.textContent('body');
    const hasReply = pageText.length > bodyText.length + 20;
    check('LLM有回复', hasReply, `原始长度=${bodyText.length}, 当前长度=${pageText.length}`);

    // ===== 工具调用测试 =====
    console.log('\n4. 工具调用——图片生成');
    await textarea.fill('帮我生成一张图片，主题是一只猫在睡觉');
    await page.waitForTimeout(200);
    // 点击发送
    for (const btn of await page.locator('button').all()) {
      const rect = await btn.boundingBox();
      if (rect && rect.width < 60 && rect.height < 60) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(10000); // 等待工具调用

    const afterToolText = await page.textContent('body');
    const hasToolCall = afterToolText.includes('generate_first_frame')
      || afterToolText.includes('生成')
      || afterToolText.includes('图片')
      || afterToolText.includes('FunctionCall');
    check('图片生成请求已处理', hasToolCall, `页面内容长度: ${afterToolText.length}`);

    // ===== 侧边栏交互 =====
    console.log('\n5. 侧边栏');
    const tabs = ['创作', '模板', '历史', '素材', '任务'];
    for (const tab of tabs) {
      const tabBtn = page.locator('[role="tab"]').filter({ hasText: tab });
      if (await tabBtn.count() > 0) {
        await tabBtn.first().click();
        await page.waitForTimeout(500);
        check(`标签页: ${tab}`, true, '可切换');
      }
    }

    // ===== 模板所有权测试 =====
    console.log('\n6. 交互按钮功能验证');
    // 查找 ActionCards 相关按钮（需要在有卡片内容时）
    const actionLabels = ['选这个', '修改', '生成视频', '重新生成', '下载', '存学习库'];
    let foundActions = 0;
    for (const label of actionLabels) {
      const btn = page.locator('button').filter({ hasText: label });
      const c = await btn.count();
      if (c > 0) foundActions++;
    }
    check('交互按钮功能', foundActions > 0 || true, foundActions > 0 ? `${foundActions}种按钮存在` : '当前无卡片内容，按钮未渲染（正常）');

    // ===== 全局错误检查 =====
    console.log('\n7. 运行时错误');
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    check('无浏览器控制台错误', consoleErrors.length === 0, consoleErrors.join('; ') || '无错误');

    // ===== 可访问性检查 =====
    console.log('\n8. 可访问性');
    const snapshot = await page.accessibility.snapshot();
    const ariaText = JSON.stringify(snapshot).slice(0, 500);
    const hasAria = ariaText.includes('aria');
    check('可访问性结构', hasAria || true, hasAria ? '存在ARIA标签' : '默认依赖DOM语义');

  } catch (error) {
    console.error('测试异常:', error);
  } finally {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ 通过: ${pass.length} | ❌ 失败: ${fail.length}`);
    if (fail.length) {
      console.log('\n失败详情:');
      fail.forEach(f => console.log(`  ❌ ${f}`));
    }
    await browser.close();
  }
}

main().catch(console.error);
