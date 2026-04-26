/**
 * 大模型协调器测试脚本
 * 在本地直接测试，无需HTTP请求
 */

import { LLMWorkflowOrchestrator, WorkflowState } from './src/lib/llm-workflow-orchestrator.ts';

// 测试用例
const testCases = [
  {
    name: '测试1：用户提供产品信息',
    message: '帮我为智能水杯生成一个8秒的视频',
    workflowState: {
      id: 'test-001',
      userId: 'test-user',
      currentStage: 'collecting_info',
      productName: '智能水杯',
      attachments: [],
      context: {
        history: [],
        userPreferences: {}
      }
    } as WorkflowState
  },
  {
    name: '测试2：用户反馈脚本太长',
    message: '太长了',
    workflowState: {
      id: 'test-002',
      userId: 'test-user',
      currentStage: 'scripts_generated',
      productName: '智能水杯',
      attachments: [],
      scripts: [
        { id: '1', content: '很长的脚本...', title: '风格1', duration: 10, style: '现代' }
      ],
      context: {
        history: [
          { role: 'assistant', content: '我为您生成了3个脚本，请选择...' }
        ],
        userPreferences: {}
      }
    } as WorkflowState
  },
  {
    name: '测试3：用户确认脚本',
    message: '第一个不错，就用这个',
    workflowState: {
      id: 'test-003',
      userId: 'test-user',
      currentStage: 'scripts_generated',
      productName: '智能水杯',
      attachments: [],
      scripts: [
        { id: '1', content: '脚本1...', title: '现代风格', duration: 8, style: '现代' },
        { id: '2', content: '脚本2...', title: '简约风格', duration: 8, style: '简约' },
        { id: '3', content: '脚本3...', title: '活力风格', duration: 8, style: '活力' }
      ],
      context: {
        history: [
          { role: 'assistant', content: '我为您生成了3个脚本，请选择...' }
        ],
        userPreferences: {}
      }
    } as WorkflowState
  },
  {
    name: '测试4：用户说完成',
    message: '完成了，谢谢你',
    workflowState: {
      id: 'test-004',
      userId: 'test-user',
      currentStage: 'video_generating',
      productName: '智能水杯',
      attachments: [],
      context: {
        history: [],
        userPreferences: {}
      }
    } as WorkflowState
  }
];

async function runTests() {
  console.log('开始测试大模型协调器...\n');

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试：${testCase.name}`);
    console.log('='.repeat(60));
    console.log(`用户消息：${testCase.message}`);
    console.log(`当前阶段：${testCase.workflowState.currentStage}`);
    console.log('');

    try {
      const orchestrator = new LLMWorkflowOrchestrator(new Headers());
      const decision = await orchestrator.processMessage(testCase.message, testCase.workflowState);

      console.log('✅ 大模型决策：');
      console.log(`  Action: ${decision.action}`);
      console.log(`  Message: ${decision.message}`);
      console.log(`  Next Stage: ${decision.next_stage || '无'}`);
      console.log(`  Reasoning: ${decision.reasoning || '无'}`);
      console.log(`  Parameters: ${JSON.stringify(decision.parameters || {})}`);
    } catch (error) {
      console.log('❌ 测试失败：', error);
    }
  }

  console.log('\n\n测试完成！');
}

runTests();
