/**
 * 模型依赖映射表
 * 子Agent 用它了解每种工具类型需要什么——硬校验防幻觉
 * 纯数据文件，不依赖运行时
 */

export interface DepStep {
  id: string;
  desc: string;
  required: boolean;
}

export interface ModelDeps {
  label: string;
  requiredOutputs: Record<string, string[]>;
  pipeline: DepStep[];
}

export const MODEL_DEPS: Record<string, ModelDeps> = {
  image: {
    label: '图片生成模型',
    requiredOutputs: {
      createImage: ['image_url'],
    },
    pipeline: [
      { id: 'generate',    desc: '调生成端点 → 返回 image_url', required: true },
      { id: 'download',    desc: 'fetch image_url → 返回二进制图片', required: true },
      { id: 'tos_upload',  desc: '上传 TOS → 返回 public_url', required: true },
      { id: 'inject',      desc: 'public_url 写入 agent_conversation_messages', required: true },
    ],
  },
  video: {
    label: '视频生成模型',
    requiredOutputs: {
      createTask: ['task_id'],
      getTask: ['status', 'video_url'],
    },
    pipeline: [
      { id: 'submit',         desc: '调创建端点 → 返回 task_id', required: true },
      { id: 'poll',           desc: '调查询端点 → 返回 status + video_url', required: true },
      { id: 'download_video', desc: 'fetch video_url → TOS 上传', required: true },
      { id: 'inject',         desc: 'public_url 写入 agent_conversation_messages', required: true },
      { id: 'task_update',    desc: 'worker_tasks 状态流转 running→succeeded', required: true },
    ],
  },
} as const;
