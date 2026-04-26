/**
 * 工具类型定义 - 纯 Agent 架构
 * 
 * 工具分为两类：
 * 1. action_tools - 操作类（执行后返回结果给 Seed 2.0）
 * 2. render_tools - 渲染类（告诉前端怎么展示，用户选择后触发 callback）
 */

export type ToolCategory = 'action' | 'render';

// 工具定义
export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  params: ToolParam[];
  // 操作类工具的执行函数
  execute?: (params: Record<string, unknown>, userId: string | null) => Promise<ToolResult>;
  // 渲染类工具的组件类型
  component?: string;
}

// 工具参数
export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
}

// 工具执行结果
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// 渲染指令 - 前端根据这个渲染组件
export interface RenderInstruction {
  type: 'render';
  component: string;  // 组件名称
  props: Record<string, unknown>;  // 组件 props
  id: string;  // 唯一 ID，用于区分不同渲染
}

// Seed 2.0 返回的工具调用格式
export interface ToolCall {
  type: 'tool_call';
  tool: string;
  params: Record<string, unknown>;
}

// 渲染工具列表
export const RENDER_COMPONENTS = [
  'MessageBubble',      // 文本消息气泡
  'VideoAnalysisCard',  // 视频分析卡片
  'ScriptSelectCards',  // 脚本选择卡片（带用户交互）
  'VideoPlayer',       // 视频播放器
  'CopywritingCards',   // 配文选项卡片
  'ProgressIndicator',   // 进度指示器
  'FormDialog',         // 表单对话框（收集用户输入）
  'MaterialList',      // 素材列表
  'ImageGallery',       // 图片画廊
] as const;

export type RenderComponentType = typeof RENDER_COMPONENTS[number];
