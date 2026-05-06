/**
 * 模型配置子Agent
 * 独立于创意小海——不同工具集、不同提示词、不存对话历史
 */
import { MODEL_DEPS, type ModelDeps } from './model-deps';

interface AnalyzeResult {
  fields: Record<string, { input: Record<string, string>; output: Record<string, string> }>;
  caps: Record<string, boolean | number>;
  errors: string[];
}

interface TestResult {
  step: string;
  status: 'ok' | 'failed' | 'skipped';
  detail: string;
  error?: string;
}

const ANALYSIS_PROMPT = `你是模型配置分析助手。根据用户提供的API调用代码，提取模型信息。

返回严格JSON（不要markdown，不要注释）：
{
  "fields": {
    "createTask": { "input": {"prompt": "代码中的prompt字段路径"}, "output": {"task_id": "返回的task_id字段路径"} },
    "getTask": { "output": {"status": "返回的status字段路径"} }
  },
  "caps": { "multi_modal": true/false, "reference_video": true/false, "reference_audio": true/false, "max_duration": 最大秒数 },
  "errors": []
}

规则：
- fields 描述字段在请求/响应JSON中的路径（如 "data.task_id" 表示 response.data.task_id）
- caps 根据代码中的参数判断能力：出现 reference_video → true
- 如果代码中某字段找不到，在 errors 中说明
- 对于 image 类型模型，只需 createImage 方法
- 对于 video 类型模型，需要 createTask 和 getTask 两个方法`;

export class ModelConfigAgent {
  /** 分析用户API代码——提取字段映射和功能清单 */
  async analyze(code: string, modelType: string): Promise<AnalyzeResult> {
    try {
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const client = new LLMClient(new Config());
      const deps = MODEL_DEPS[modelType];
      let text = '';
      const stream = await client.stream([
        { role: 'system' as const, content: ANALYSIS_PROMPT },
        { role: 'user' as const, content: `模型类型: ${modelType}${deps ? `\n依赖要求: ${JSON.stringify(deps.requiredOutputs)}` : ''}\nAPI调用代码:\n${code.slice(0, 3000)}` },
      ], { model: 'doubao-seed-2-0-pro-260215', temperature: 0.1 });
      for await (const c of stream) {
        const ct = (c as { content?: unknown }).content;
        if (typeof ct === 'string') text += ct;
      }
      const json = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      return JSON.parse(json) as AnalyzeResult;
    } catch (e) {
      return { fields: {}, caps: {}, errors: [e instanceof Error ? e.message : '分析失败'] };
    }
  }

  /** 生成适配器代码 */
  async generateAdapter(analyzeResult: AnalyzeResult, modelType: string): Promise<string> {
    try {
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const client = new LLMClient(new Config());
      let text = '';
      const deps = MODEL_DEPS[modelType];
      const stream = await client.stream([
        { role: 'system' as const, content: `生成一个JavaScript模块，导出 ${modelType === 'video' ? '{createTask, getTask}' : '{createImage}'} 两个async函数。
规则：
1. 只能使用 fetch() 发起HTTP调用
2. API Key 通过模块闭包中的 apiKey 变量获取（模块加载时注入）
3. API URL 通过模块闭包中的 apiUrl 变量获取
4. 输入参数通过函数参数接收：createTask({prompt, duration, ratio, ...}) / getTask(taskId)
5. 返回值必须是标准格式：createTask→{task_id:string} / getTask→{status:string, video_url?:string}
6. 不要包含任何文件系统、数据库、环境变量访问
7. 不要使用 require 或 import
8. 输出纯代码，不要markdown包裹` },
        { role: 'user' as const, content: `模型类型: ${modelType}\n依赖要求: ${JSON.stringify(deps?.requiredOutputs || {})}\n字段映射: ${JSON.stringify(analyzeResult.fields)}\n功能清单: ${JSON.stringify(analyzeResult.caps)}` },
      ], { model: 'doubao-seed-2-0-pro-260215', temperature: 0.1 });
      for await (const c of stream) {
        const ct = (c as { content?: unknown }).content;
        if (typeof ct === 'string') text += ct;
      }
      return text.replace(/```javascript\s*/g, '').replace(/```js\s*/g, '').replace(/```/g, '').trim();
    } catch {
      return '';
    }
  }

  /** 解释测试结果——给用户的自然语言建议 */
  async explainResults(results: TestResult[], modelType: string): Promise<string> {
    try {
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const client = new LLMClient(new Config());
      let text = '';
      const failed = results.filter(r => r.status === 'failed');
      const stream = await client.stream([
        { role: 'system' as const, content: '你帮助用户理解模型测试结果。简要说明哪些测试通过、哪些失败，失败的可能原因，以及如何修复。50字以内。' },
        { role: 'user' as const, content: `模型类型: ${modelType}\n测试结果: ${JSON.stringify(results)}\n失败项: ${JSON.stringify(failed)}` },
      ], { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 });
      for await (const c of stream) {
        const ct = (c as { content?: unknown }).content;
        if (typeof ct === 'string') text += ct;
      }
      return text.trim();
    } catch {
      return '测试完成，请查看详细结果';
    }
  }

  /** 运行管道测试——实际HTTP调用验证适配器 */
  async runPipelineTests(apiUrl: string, apiKey: string, modelType: string, adapterCode: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const deps = MODEL_DEPS[modelType];

    // 沙箱加载适配器
    let adapter: Record<string, Function> = {};
    try {
      const fn = new Function('apiUrl', 'apiKey', `${adapterCode}\nreturn typeof module !== 'undefined' ? module.exports : (typeof exports !== 'undefined' ? exports : {});`);
      adapter = fn(apiUrl, apiKey) as Record<string, Function>;
    } catch (e) {
      return [{ step: 'load_adapter', status: 'failed', detail: '适配器加载失败', error: e instanceof Error ? e.message : '' }];
    }

    // 根据类型执行管道测试
    if (modelType === 'image' && adapter.createImage) {
      try {
        const r = await adapter.createImage({ prompt: 'test connection' }) as Record<string, unknown>;
        if (r && typeof r.image_url === 'string') {
          results.push({ step: 'createImage', status: 'ok', detail: `image_url: ${(r.image_url as string).slice(0, 60)}` });
          // 验证图片可下载
          try {
            const dl = await fetch(r.image_url as string);
            if (dl.ok && dl.headers.get('content-type')?.includes('image')) {
              results.push({ step: 'download', status: 'ok', detail: '图片可下载' });
            } else {
              results.push({ step: 'download', status: 'failed', detail: 'URL不可下载或非图片类型' });
            }
          } catch { results.push({ step: 'download', status: 'failed', detail: '下载失败' }); }
        } else {
          results.push({ step: 'createImage', status: 'failed', detail: '返回值缺少 image_url 字段' });
        }
      } catch (e) {
        results.push({ step: 'createImage', status: 'failed', detail: '调用失败', error: e instanceof Error ? e.message : '' });
      }
    }

    if (modelType === 'video' && adapter.createTask) {
      try {
        const r = await adapter.createTask({ prompt: 'test', duration: 5 }) as Record<string, unknown>;
        if (r && typeof r.task_id === 'string') {
          results.push({ step: 'createTask', status: 'ok', detail: `task_id: ${r.task_id}` });
          // 测试查询
          if (adapter.getTask) {
            try {
              const s = await adapter.getTask(r.task_id) as Record<string, unknown>;
              if (s && typeof s.status === 'string') {
                results.push({ step: 'getTask', status: 'ok', detail: `status: ${s.status}` });
              } else {
                results.push({ step: 'getTask', status: 'failed', detail: '返回值缺少 status 字段' });
              }
            } catch (e) {
              results.push({ step: 'getTask', status: 'failed', detail: '查询失败', error: e instanceof Error ? e.message : '' });
            }
          }
        } else {
          results.push({ step: 'createTask', status: 'failed', detail: '返回值缺少 task_id 字段' });
        }
      } catch (e) {
        results.push({ step: 'createTask', status: 'failed', detail: '调用失败', error: e instanceof Error ? e.message : '' });
      }
    }

    return results;
  }
}
