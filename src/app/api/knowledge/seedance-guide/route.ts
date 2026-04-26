/**
 * 知识库 API - Seedance 2.0 指南
 * 提供结构化的 Seedance 2.0 最佳实践
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const guideUrl = `${process.env.COZE_PROJECT_DOMAIN_DEFAULT || ''}/knowledge/seedance-2.0-guide.pdf`;
  
  // 结构化的最佳实践知识
  const knowledge = {
    name: 'Seedance 2.0 视频生成指南',
    version: '2.0',
    url: guideUrl,
    lastUpdated: '2025-04-10',
    
    // 核心提示词结构
    promptStructure: {
      summary: '视频提示词应包含以下元素',
      elements: [
        { name: '主体描述', description: '谁/什么正在进行动作' },
        { name: '动作规划', description: '具体的动作序列和变化' },
        { name: '环境设置', description: '空间背景、光影细节' },
        { name: '风格定位', description: '整体视觉风格和调性' }
      ]
    },
    
    // 视频时长与动作规划
    durationGuide: {
      summary: '根据视频时长规划动作数量',
      recommendations: [
        { duration: '5秒', actions: '1-2个主要动作', example: '人物走进来、转身离开' },
        { duration: '10秒', actions: '2-3个连贯动作', example: '起床→穿衣→出门' },
        { duration: '15秒', actions: '3-4个完整场景', example: '完整的做饭流程' }
      ]
    },
    
    // 首帧图的价值
    firstFrameGuide: {
      summary: '首帧图是提升视频效果的关键',
      benefits: [
        '锁定画面理想标准态',
        '保持主体特征一致性',
        '提升画面确定性和还原度',
        '明确画面构图和风格'
      ],
      usage: '生成视频前，先用 generate_first_frame 工具生成首帧图，可以显著提升视频效果',
      recommendation: '建议询问用户：是否需要先生成首帧图来提升效果？'
    },
    
    // 图片参考技巧
    imageReferenceGuide: {
      summary: '多图参考可以实现复杂创作',
      types: [
        { type: '主体多视角', usage: '保持角色/商品外观一致', prompt: '提取图片1的图片2的主体特征' },
        { type: '场景图参考', usage: '设定环境背景', prompt: '场景设定在图片1的咖啡店' },
        { type: '分镜图参考', usage: '控制画面构图和节奏', prompt: '参考图片1的分镜构图' },
        { type: 'Logo参考', usage: '品牌元素植入', prompt: '画面右下角显示图片1的Logo' }
      ]
    },
    
    // 视频参考技巧
    videoReferenceGuide: {
      summary: '视频参考可以复现动作、运镜、特效',
      types: [
        { type: '动作参考', usage: '复现人物/动物的动作', prompt: '参考视频1的人物动作' },
        { type: '运镜参考', usage: '复现镜头运动', prompt: '参考视频1的运镜方式' },
        { type: '特效参考', usage: '添加粒子、光效等', prompt: '参考视频1的金色粒子特效' }
      ]
    },
    
    // 文字生成技巧
    textGenerationGuide: {
      summary: 'Seedance 2.0 支持在视频中生成文字',
      types: [
        { type: '广告语/Slogan', prompt: '画面中部显示文字"..."' },
        { type: '字幕', prompt: '画面底部出现字幕，字幕内容为"..."' },
        { type: '气泡台词', prompt: '角色周边出现气泡，气泡里写着台词' }
      ],
      tips: '优先使用常用字，避免生僻字与特殊符号'
    },
    
    // 视频编辑技巧
    videoEditingGuide: {
      summary: '支持元素增删改和视频延长',
      operations: [
        { type: '增加元素', prompt: '在视频1的台面上添加炸鸡' },
        { type: '删除元素', prompt: '清除视频1桌面上的其他零件' },
        { type: '修改元素', prompt: '将视频1中的香水替换成面霜' },
        { type: '向后延长', prompt: '生成视频1之后的内容' },
        { type: '向前延长', prompt: '向前延长视频1的内容' }
      ]
    },
    
    // 主动优化建议
    proactiveSuggestions: {
      summary: '根据用户需求主动建议优化',
      scenarios: [
        {
          scenario: '用户想生成视频',
          suggestion: '建议先生成首帧图来提升效果',
          action: '询问用户是否需要生成首帧图'
        },
        {
          scenario: '用户要写视频脚本',
          suggestion: '根据时长规划合理的动作数量',
          action: '提醒用户每个动作的时长分配'
        },
        {
          scenario: '用户需要保持角色一致',
          suggestion: '建议上传角色多视角图片',
          action: '引导用户提供参考图片'
        },
        {
          scenario: '用户说效果不好',
          suggestion: '检查提示词是否具体',
          action: '建议加入更多细节描述'
        }
      ]
    },
    
    // 工作原则
    workPrinciples: {
      summary: '工作流程原则',
      principles: [
        '先理解用户需求，再给出建议',
        '主动识别可优化的点，说明原因',
        '获得用户同意后，用工具自主完成',
        '无法完成时才求助用户协助'
      ],
      example: '根据指南，加入动作规划会让视频更生动，我可以帮你优化提示词，你同意吗？'
    }
  };
  
  return NextResponse.json(knowledge);
}
