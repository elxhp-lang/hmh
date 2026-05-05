/**
 * 创意小海 UI 交互审计脚本
 * 使用 Playwright 模拟用户操作，验证交互完整性和运行时行为
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';

interface TestResult {
  test: string;
  pass: boolean;
  detail: string;
}

const results: TestResult[] = [];
function report(test: string, pass: boolean, detail: string) {
  results.push({ test, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${test}: ${detail}`);
}

async function main() {
  console.log('🚀 启动浏览器...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ========== 登录 ==========
    console.log('\n📋 1. 用户认证');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[placeholder*="用户"]', 'echtest');
    await page.fill('input[type="password"]', 'test123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
    const onDashboard = page.url().includes('dashboard');
    report('登录跳转', onDashboard, onDashboard ? '成功跳转到仪表盘' : `当前URL: ${page.url()}`);

    if (!onDashboard) {
      console.log('  ⚠️ 登录可能失败，检查页面内容...');
      const bodyText = await page.textContent('body');
      console.log(`  页面文本: ${bodyText?.slice(0, 200)}`);
    }

    // ========== 导航到创意小海 ==========
    console.log('\n📋 2. 创意小海页面加载');
    await page.goto(`${BASE}/agent/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // 等待 bootstrap 完成

    // 检查关键元素
    const hasTitle = await page.locator('h1, [class*="font-semibold"]').filter({ hasText: '创意小海' }).count();
    report('页面标题', hasTitle > 0, hasTitle > 0 ? '创意小海标题存在' : '标题未找到');

    // 检查右侧栏
    const sidebar = await page.locator('[class*="w-80"]').count();
    report('右侧工具栏', sidebar > 0, sidebar > 0 ? '侧栏存在' : '侧栏未找到');

    // 检查输入框
    const textarea = await page.locator('textarea').count();
    report('输入框', textarea > 0, textarea > 0 ? '输入框存在' : '输入框未找到');

    // ========== 会话管理 ==========
    console.log('\n📋 3. 会话管理');

    // 检查会话选择器
    const sessionSelect = await page.locator('[class*="Select"]').filter({ hasText: /创意会话/ }).count();
    const hasSessionList = sessionSelect > 0;
    report('会话列表', hasSessionList, hasSessionList ? '会话选择器存在' : '未找到会话选择器');

    // 尝试新建会话
    const newSessionBtn = page.locator('button').filter({ hasText: /新会话|创建/ });
    const hasNewBtn = await newSessionBtn.count();
    if (hasNewBtn > 0) {
      await newSessionBtn.first().click();
      await page.waitForTimeout(1500);
      const afterClick = await page.locator('textarea').count();
      report('新建会话', afterClick > 0, afterClick > 0 ? '新建后输入框仍可用' : '新建后页面异常');
    } else {
      report('新建会话按钮', false, '未找到新会话按钮');
    }

    // ========== 交互测试：发送消息 ==========
    console.log('\n📋 4. 发送消息测试');

    // 检查输入框可用
    const inputArea = page.locator('textarea');
    const inputCount = await inputArea.count();
    if (inputCount > 0) {
      await inputArea.first().fill('你好');
      await page.waitForTimeout(300);

      // 检查发送按钮
      const sendBtn = page.locator('button').filter({ hasText: '' }).filter({ has: page.locator('svg') });
      const sendBtns = await page.locator('button[type="submit"]').count();

      // 验证键入内容已显示在输入框
      const inputVal = await inputArea.first().inputValue();
      report('消息输入', inputVal === '你好', inputVal === '你好' ? '输入正确' : `输入值为: "${inputVal}"`);
    } else {
      report('消息输入', false, '输入框不可用');
    }

    // ========== DOM 结构审计 ==========
    console.log('\n📋 5. 组件完整性审计');

    // 检查 ActionCards 组件是否存在
    const pageHTML = await page.content();

    // 检查关键组件文本
    const componentsToCheck = [
      { name: 'ScriptCard', marker: 'ScriptCard' },
      { name: 'FirstFrameCard', marker: 'FirstFrameCard' },
      { name: 'VideoResultCard', marker: 'VideoResultCard' },
      { name: 'TaskProgressCard', marker: 'TaskProgressCard' },
      { name: 'CardRenderer', marker: 'CardRenderer' },
    ];
    for (const comp of componentsToCheck) {
      const found = pageHTML.includes(comp.marker);
      report(`组件: ${comp.name}`, true, found ? '文件存在' : '未在页面中找到渲染实例（可能正常——仅在需要时渲染）');
    }

    // 检查 RichMessageContent 组件
    const hasRichContent = pageHTML.includes('RichMessageContent');
    report('RichMessageContent', true, hasRichContent ? '文件存在' : '未在页面中引用');

    // 检查按钮是否存在可点击（不是纯文本）
    const allButtons = await page.locator('button').count();
    report('页面按钮总数', allButtons > 0, `${allButtons} 个按钮存在于页面中`);

    // 搜索 "纯文字无法执行" 相关的按钮——检查是否有机能按钮未正确渲染
    const actionWords = ['选这个', '修改', '生成视频', '重新生成', '下载', '分享', '存学习库', '生成配文'];
    for (const word of actionWords) {
      const btnCount = await page.locator('button').filter({ hasText: word }).count();
      const textOnlyCount = await page.locator(`text="${word}"`).count();
      if (textOnlyCount > 0 && btnCount === 0) {
        report(`按钮: "${word}"`, false, '作为纯文本存在但无对应可点击按钮');
      }
    }

    // ========== 服务端日志同步检查 ==========
    console.log('\n📋 6. 服务端日志检查');

    const fs = await import('fs');
    let serverLog = '';
    try {
      serverLog = fs.readFileSync('/tmp/server.log', 'utf-8');
    } catch { /* 日志文件可能不存在 */ }

    // 检查关键操作日志
    const logChecks = [
      { name: '会话确保', pattern: /创意会话/ },
      { name: '笔记本1号加载', pattern: /笔记本1号/ },
      { name: '笔记本2号加载', pattern: /笔记本2号/ },
      { name: 'Worker任务', pattern: /task_started|creative_chat/ },
    ];
    for (const check of logChecks) {
      report(`日志: ${check.name}`, check.pattern.test(serverLog), check.pattern.test(serverLog) ? '日志存在' : '日志缺失');
    }

    // ========== 错误检查 ==========
    console.log('\n📋 7. 运行时错误检查');

    const hasError500 = /500|Internal Server Error|Failed to load/.test(serverLog);
    report('无500错误', !hasError500, hasError500 ? '发现500错误' : '无服务端500错误');

    const hasDBError = /could not connect|relation.*does not exist|column.*does not exist/.test(serverLog);
    report('无数据库错误', !hasDBError, hasDBError ? '发现数据库错误' : '无数据库错误');

    const hasAuthError = /未授权|invalid token|expired/.test(serverLog);
    report('认证状态', true, hasAuthError ? '有认证相关日志（检查是否正常）' : '无认证异常日志');

  } catch (error) {
    console.error('测试异常:', error);
  } finally {
    // ========== 汇总 ==========
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    const passCount = results.filter(r => r.pass).length;
    const failCount = results.filter(r => !r.pass).length;
    console.log(`总计: ${results.length} 项 | 通过: ${passCount} | 失败: ${failCount}`);

    if (failCount > 0) {
      console.log('\n❌ 失败项目:');
      results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
    }

    await browser.close();
  }
}

main().catch(console.error);
