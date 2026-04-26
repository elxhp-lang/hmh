/**
 * 财务定时任务脚本
 * 
 * 功能：
 * 1. 每日汇总费用数据
 * 2. 余额告警检测
 * 3. 费用趋势分析
 * 
 * 运行方式：
 * node scripts/finance-cron.js
 * 
 * 或使用 crontab 定时执行：
 * 0 9 * * * node /workspace/projects/scripts/finance-cron.js
 */

const https = require('https');
const http = require('http');

// 环境变量
const ACCESS_KEY_ID = process.env.VOLCENGINE_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
const REGION = process.env.VOLCENGINE_REGION || 'cn-beijing';

// 火山引擎签名（简化版）
function signRequest(params, secretAccessKey) {
  const crypto = require('crypto');
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const signature = crypto.createHmac('sha256', secretAccessKey)
    .update(stringToSign)
    .digest('hex');
  return signature;
}

// 发送 HTTP 请求
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 查询账户余额
async function queryBalance() {
  console.log('[Finance Cron] 查询账户余额...');
  
  const params = {
    Version: '2022-01-01',
    Action: 'QueryBalanceAcct',
    AccountId: '',
    Service: 'billing',
    Region: REGION,
    Timestamp: new Date().toISOString(),
    AccessKeyId: ACCESS_KEY_ID,
  };
  
  try {
    // 由于火山引擎 API 需要签名，这里简化处理
    // 实际使用时需要使用官方 SDK
    console.log('[Finance Cron] 余额查询功能开发中...');
    return null;
  } catch (error) {
    console.error('[Finance Cron] 余额查询失败:', error.message);
    return null;
  }
}

// 查询账单
async function queryBill(period) {
  console.log(`[Finance Cron] 查询 ${period} 账单...`);
  
  try {
    // 由于火山引擎 API 需要签名，这里简化处理
    // 实际使用时需要使用官方 SDK
    console.log('[Finance Cron] 账单查询功能开发中...');
    return null;
  } catch (error) {
    console.error('[Finance Cron] 账单查询失败:', error.message);
    return null;
  }
}

// 发送飞书通知（占位）
async function sendFeishuNotification(message) {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('[Finance Cron] 飞书 Webhook 未配置，跳过通知');
    return;
  }
  
  try {
    await request({
      hostname: new URL(webhookUrl).hostname,
      path: new URL(webhookUrl).pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      msg_type: 'text',
      content: { text: message },
    });
    console.log('[Finance Cron] 飞书通知已发送');
  } catch (error) {
    console.error('[Finance Cron] 飞书通知发送失败:', error.message);
  }
}

// 检查余额是否充足
async function checkBalanceAlert() {
  console.log('[Finance Cron] 检查余额告警...');
  
  const balance = await queryBalance();
  if (!balance) {
    console.log('[Finance Cron] 无法获取余额，跳过告警检查');
    return;
  }
  
  const availableAmount = balance.availableAmount || 0;
  const projectedDaily = 100; // 假设日均消费 100 元
  
  // 如果余额不足 7 天消费，发送告警
  if (availableAmount < projectedDaily * 7) {
    const message = `⚠️ 余额告警\n账户余额 ¥${availableAmount.toFixed(2)} 可能不足以支撑 7 天消费，建议及时充值。`;
    await sendFeishuNotification(message);
  }
}

// 每日汇总任务
async function dailySummary() {
  console.log('[Finance Cron] 执行每日汇总任务...');
  
  const today = new Date().toISOString().slice(0, 10);
  const period = new Date().toISOString().slice(0, 7);
  
  // 查询今日账单
  const billData = await queryBill(period);
  
  console.log(`[Finance Cron] ${today} 汇总完成`);
  console.log('[Finance Cron] 功能开发中，数据暂不存储');
}

// 主函数
async function main() {
  console.log('========================================');
  console.log(`[Finance Cron] 财务定时任务开始 - ${new Date().toISOString()}`);
  console.log('========================================');
  
  // 检查环境变量
  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.error('[Finance Cron] 错误：缺少火山引擎凭证');
    console.error('[Finance Cron] 请设置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  
  try {
    // 执行每日汇总
    await dailySummary();
    
    // 检查余额告警
    await checkBalanceAlert();
    
    console.log('[Finance Cron] 任务执行完成');
  } catch (error) {
    console.error('[Finance Cron] 任务执行失败:', error);
  }
  
  console.log('========================================');
  console.log(`[Finance Cron] 财务定时任务结束 - ${new Date().toISOString()}`);
  console.log('========================================');
}

// 运行
main().catch(console.error);
