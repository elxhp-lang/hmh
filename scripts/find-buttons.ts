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

  // Go to agent page
  await page.goto('http://localhost:5000/agent/create', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Find buttons
  const buttons = await page.locator('button').all();
  console.log(`Total buttons: ${buttons.length}`);
  for (let i = 0; i < Math.min(buttons.length, 15); i++) {
    const txt = await buttons[i].textContent();
    const rect = await buttons[i].boundingBox();
    console.log(`  [${i}] "${(txt || '').slice(0, 40)}" size=${rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : 'hidden'}`);
  }

  // Find textarea
  const textareas = await page.locator('textarea').all();
  console.log(`\nTextareas: ${textareas.length}`);
  for (let i = 0; i < textareas.length; i++) {
    console.log(`  [${i}] placeholder="${await textareas[i].getAttribute('placeholder')}"`);
  }

  // Try typing and sending
  if (textareas.length > 0) {
    const ta = textareas[0];
    await ta.fill('你好');
    await page.waitForTimeout(200);

    // Find all small buttons near the bottom of the page
    const allBtns = await page.locator('button').all();
    for (let i = allBtns.length - 1; i >= 0; i--) {
      const b = allBtns[i];
      const rect = await b.boundingBox();
      const txt = await b.textContent();
      if (rect && rect.height < 50 && rect.width < 60 && !txt?.trim()) {
        console.log(`\nClicking small icon button [${i}]...`);
        await b.click();
        break;
      }
    }

    await page.waitForTimeout(8000);
    const body = await page.textContent('body');
    console.log(`After send: body=${(body || '').length} chars`);
    // Show last 500 chars
    if (body) console.log(`Last text: ${body.slice(-300)}`);
  }

  await browser.close();
}

main().catch(console.error);
