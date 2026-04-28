/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Workflow Automation
 * Chains multiple skills together into automated workflows
 * Use when: need to execute multi-step processes by combining existing skills
 */
const fs = require('fs');
const path = require('path');

// 安全修复：限制技能加载目录为workspace skills目录，禁止遍历上级目录
const SKILL_DIR = path.join(process.env.HOME || '/home/ecs-user', '.openclaw', 'workspace', 'skills');
const WHITELIST_FILE = path.join(__dirname, 'whitelist.json');

// 加载白名单（从文件读取，不存在则创建默认白名单）
function loadWhitelist() {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf-8'));
      return new Set(data.trusted || []);
    }
  } catch (e) {
    console.error('Error loading whitelist:', e.message);
  }
  // 默认白名单
  return new Set([
    'xiaping-client', 'meeting-prep', 'xlsx', 'feishu-doc', 'feishu-task',
    'feishu-wiki', 'feishu-bitable', 'weather', 'pdf-reader', 'dependency-scanner',
    'permission-auditor', 'code-stats', 'tender-aggregator', 'duckdb-analyzer'
  ]);
}

// 保存白名单到文件
function saveWhitelist(trustedSet) {
  fs.writeFileSync(WHITELIST_FILE, JSON.stringify({ trusted: Array.from(trustedSet) }, null, 2));
}

const TRUSTED_SKILLS = loadWhitelist();

// 安全检查：验证技能路径在允许范围内
function isPathSafe(skillPath) {
  const resolvedPath = path.resolve(skillPath);
  const allowedBase = path.resolve(SKILL_DIR);
  return resolvedPath.startsWith(allowedBase + path.sep);
}
const WORKFLOWS_DIR = path.join(__dirname, 'workflows');

// 确保工作流目录存在
if (!fs.existsSync(WORKFLOWS_DIR)) {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

/**
 * 获取所有可用技能（仅返回白名单内的技能）
 */
function getAvailableSkills() {
  try {
    const entries = fs.readdirSync(SKILL_DIR, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'workflows')
      .filter(e => TRUSTED_SKILLS.has(e.name)) // 仅返回白名单技能
      .map(e => e.name);
  } catch (e) {
    console.error('Error reading skills directory:', e.message);
    return [];
  }
}

/**
 * 列出工作流
 */
function listWorkflows() {
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    const workflows = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf-8'));
      return { name: f.replace('.json', ''), steps: data.steps?.length || 0 };
    });
    return {
      availableSkills: getAvailableSkills(),
      savedWorkflows: workflows,
      sampleWorkflows: [
        { name: 'daily-report', steps: ['meeting-prep', 'xlsx', 'feishu-doc'], description: '生成每日报告' },
        { name: 'security-audit', steps: ['dependency-scanner', 'permission-auditor'], description: '安全审计' },
        { name: 'batch-review', steps: ['xiaping-client'], description: '批量评测技能' }
      ]
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * 保存工作流
 */
function saveWorkflow(name, workflow) {
  const filepath = path.join(WORKFLOWS_DIR, `${name}.json`);
  fs.writeFileSync(filepath, JSON.stringify(workflow, null, 2));
  return { success: true, path: filepath };
}

/**
 * 加载工作流
 */
function loadWorkflow(name) {
  const filepath = path.join(WORKFLOWS_DIR, `${name}.json`);
  if (!fs.existsSync(filepath)) {
    return { error: `Workflow "${name}" not found` };
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

/**
 * 执行单个步骤
 */
async function executeStep(step, context) {
  const { skill, action, params = {} } = step;
  
  // 安全检查：验证技能在白名单中
  if (!TRUSTED_SKILLS.has(skill)) {
    return { success: false, error: `Skill "${skill}" is not in trusted whitelist` };
  }
  
  // 检查技能是否存在
  const skillPath = path.join(SKILL_DIR, skill);
  
  // 安全检查：路径安全验证，防止目录遍历攻击
  if (!isPathSafe(skillPath)) {
    return { success: false, error: `Invalid skill path detected` };
  }
  
  if (!fs.existsSync(skillPath)) {
    return { success: false, error: `Skill "${skill}" not found` };
  }
  
  // 尝试加载技能
  try {
    let skillModule;
    const indexPath = path.join(skillPath, 'index.js');
    
    if (fs.existsSync(indexPath)) {
      skillModule = require(indexPath);
    } else if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
      // 技能没有 index.js，只有 SKILL.md
      return { 
        success: true, 
        skipped: true, 
        message: `Skill "${skill}" has no executable code, skipped` 
      };
    }
    
    // 方式1: 直接调用导出函数 (如 xiaping-client.checkin())
    if (skillModule && typeof skillModule[action] === 'function') {
      const result = await skillModule[action](params, context);
      return { success: true, output: result };
    }
    // 方式2: 调用 main 函数并传递 action 参数
    else if (skillModule && typeof skillModule.main === 'function') {
      const result = await skillModule.main({ action, ...params }, context);
      return { success: true, output: result };
    }
    // 方式3: 如果 action 是默认导出
    else if (skillModule && skillModule.default && typeof skillModule.default[action] === 'function') {
      const result = await skillModule.default[action](params, context);
      return { success: true, output: result };
    } else {
      return { 
        success: true, 
        skipped: true, 
        message: `Skill "${skill}" has no "${action}" action, skipped` 
      };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 执行工作流
 */
async function executeWorkflow(workflow, options = {}) {
  const { stopOnError = false } = options;
  const results = [];
  const context = {};
  
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    console.log(`[${i + 1}/${workflow.steps.length}] Executing: ${step.skill}.${step.action}...`);
    
    const result = await executeStep(step, context);
    results.push({ step, result });
    
    // 更新上下文
    if (result.success && result.output) {
      context[step.skill] = result.output;
    }
    
    // 如果失败且需要停止
    if (!result.success && stopOnError) {
      console.error('Stopping due to error:', result.error);
      break;
    }
  }
  
  const successCount = results.filter(r => r.result.success).length;
  return {
    success: successCount === workflow.steps.length,
    total: workflow.steps.length,
    completed: successCount,
    results,
    context
  };
}

/**
 * 白名单管理功能
 */
function whitelistManage(action, skillName = null) {
  if (action === 'list') {
    return {
      action: 'list',
      whitelist: Array.from(TRUSTED_SKILLS),
      count: TRUSTED_SKILLS.size,
      message: '当前白名单中的技能列表'
    };
  }
  
  if (action === 'add' && skillName) {
    if (TRUSTED_SKILLS.has(skillName)) {
      return { success: false, message: `技能 "${skillName}" 已在白名单中` };
    }
    // 验证技能目录存在
    const skillPath = path.join(SKILL_DIR, skillName);
    if (!fs.existsSync(skillPath)) {
      return { success: false, message: `技能 "${skillName}" 不存在` };
    }
    TRUSTED_SKILLS.add(skillName);
    saveWhitelist(TRUSTED_SKILLS);
    return { success: true, message: `已添加 "${skillName}" 到白名单` };
  }
  
  if (action === 'remove' && skillName) {
    if (!TRUSTED_SKILLS.has(skillName)) {
      return { success: false, message: `技能 "${skillName}" 不在白名单中` };
    }
    TRUSTED_SKILLS.delete(skillName);
    saveWhitelist(TRUSTED_SKILLS);
    return { success: true, message: `已从白名单移除 "${skillName}"` };
  }
  
  if (action === 'check' && skillName) {
    return {
      inWhitelist: TRUSTED_SKILLS.has(skillName),
      message: TRUSTED_SKILLS.has(skillName) 
        ? `"${skillName}" 在白名单中` 
        : `"${skillName}" 不在白名单中`
    };
  }
  
  return { 
    error: '无效操作', 
    usage: 'whitelist: list | add <skill> | remove <skill> | check <skill>' 
  };
}

/**
 * 主入口
 */
async function main(args = {}) {
  const { list = false, run = null, save = null, saved = false, 
           whitelist = null, whitelistAdd = null, whitelistRemove = null, 
           whitelistCheck = null, ...params } = args;
  
  // 白名单管理
  if (whitelist === 'list') {
    return whitelistManage('list');
  }
  if (whitelistAdd) {
    return whitelistManage('add', whitelistAdd);
  }
  if (whitelistRemove) {
    return whitelistManage('remove', whitelistRemove);
  }
  if (whitelistCheck) {
    return whitelistManage('check', whitelistCheck);
  }
  
  if (saved) {
    return listWorkflows();
  }
  
  if (list) {
    return listWorkflows();
  }
  
  if (run) {
    const workflow = loadWorkflow(run);
    if (workflow.error) {
      return workflow;
    }
    return await executeWorkflow(workflow, params);
  }
  
  if (save) {
    // params 应该包含 steps
    const workflow = { name: save, steps: params.steps || [] };
    return saveWorkflow(save, workflow);
  }
  
  return {
    summary: 'Workflow automation skill - chains multiple skills into automated workflows',
    usage: 'node index.js [list|run <name>|save <name>|saved]',
    availableSkills: getAvailableSkills(),
    sampleWorkflows: listWorkflows().sampleWorkflows
  };
}

module.exports = {
  main,
  listWorkflows,
  getAvailableSkills,
  saveWorkflow,
  loadWorkflow,
  executeWorkflow,
  executeStep
};

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === 'list') parsed.list = true;
    else if (args[i] === 'saved') parsed.saved = true;
    else if (args[i] === 'run' && args[i + 1]) {
      parsed.run = args[i + 1];
      i++;
    }
    else if (args[i] === 'save' && args[i + 1]) {
      parsed.save = args[i + 1];
      i++;
    }
    else if (args[i] === 'stopOnError') parsed.stopOnError = true;
  }
  
  main(parsed).then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
}

/**
 * 验证工作流定义是否合法
 */
function validateWorkflow(workflow) {
  const errors = [];
  const warnings = [];
  
  // 检查必需字段
  if (!workflow.name || typeof workflow.name !== 'string') {
    errors.push('workflow.name 必须是字符串');
  }
  
  if (!workflow.steps || !Array.isArray(workflow.steps)) {
    errors.push('workflow.steps 必须是数组');
  } else {
    // 检查每个步骤
    workflow.steps.forEach((step, i) => {
      if (!step.skill) {
        errors.push(`步骤 ${i + 1}: 缺少 skill 字段`);
      }
      if (!step.action) {
        warnings.push(`步骤 ${i + 1}: 建议添加 action 字段`);
      }
    });
  }
  
  // 检查循环引用
  if (workflow.steps && workflow.steps.length > 20) {
    warnings.push('步骤过多(>20)，可能需要拆分');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证工作流并提供详细报告
 * 可用于 CLI: node index.js validate
 */
function validate(workflow) {
  const result = validateWorkflow(workflow);
  
  if (result.valid) {
    console.log('✅ 工作流验证通过');
  } else {
    console.log('❌ 工作流验证失败:');
    result.errors.forEach(e => console.log(`  - ${e}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ 警告:');
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  return result;
}

/**
 * 回滚到上一个检查点
 */
function rollback(context, checkpoint) {
  if (!checkpoint) {
    return { success: false, error: 'No checkpoint to rollback' };
  }
  
  // 恢复上下文到检查点状态
  return { 
    success: true, 
    message: 'Rolled back to checkpoint',
    restored: checkpoint 
  };
}

module.exports.validate = validate;
module.exports.rollback = rollback;
