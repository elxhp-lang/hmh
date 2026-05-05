import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();

  // Login
  await page.goto('http://localhost:5000/login', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="用户"]', 'echtest');
  await page.fill('input[type="password"]', 'test123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:5000/agent/create', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Type message
  const textarea = page.locator('textarea').first();
  await textarea.click();
  await textarea.fill('ping');
  await page.waitForTimeout(300);

  // Press Enter to send
  console.log('Pressing Enter...');
  await textarea.press('Enter');
  await page.waitForTimeout(500);

  // Check input value - should be cleared after send
  const val = await textarea.inputValue();
  console.log(`Input after Enter: "${val}"`);

  // Wait for response
  await page.waitForTimeout(12000);

  // Check body for response
  const body = await page.textContent('body');
  console.log(`Body length: ${body?.length || 0}`);
  if (body) {
    // Search for key text markers
    const hasPing = body.includes('ping');
    const hasReply = body.includes('创意小海') || body.includes('PONG') || body.includes('pong') || body.includes('你好');
    console.log(`Contains 'ping': ${hasPing}`);
    console.log(`Has reply text: ${hasReply}`);
    // Show last non-RSC part of body
    const textOnly = body.replace(/\["\$/g, '\n["$').split('\n').filter(l => !l.startsWith('["$')).join('\n');
    console.log(`Text portion (last 500): ${textOnly.slice(-500)}`);
  }

  await browser.close();
}

main().catch(console.error);
