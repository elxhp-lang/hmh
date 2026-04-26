/**
 * Seedance 2.0 视频生成最佳实践
 * 
 * 这是创意小海的核心知识库，包含视频生成的最佳实践建议。
 * 这些是建议而非强制，创意小海应根据情况自主判断。
 */

export const SEEDANCE_2_0_GUIDE = {
  version: '2.0',
  name: 'Seedance 2.0 最佳实践指南',
  
  // ========== 提示词结构 ==========
  promptStructure: {
    title: '优质视频提示词结构',
    description: '一个好的视频提示词应该包含以下元素：',
    elements: [
      { name: '主体', desc: '谁/什么正在进行动作', example: '一只橘色短毛猫' },
      { name: '动作', desc: '具体的动作序列', example: '趴在窗台上，眯起眼睛晃尾巴' },
      { name: '环境', desc: '空间背景和光影', example: '午后阳光洒在白色窗台上' },
      { name: '风格', desc: '整体视觉风格', example: '暖调治愈风，4K高清' }
    ],
    template: '[主体] + [动作] + [环境] + [风格]'
  },
  
  // ========== 时长与动作规划 ==========
  durationPlanning: {
    title: '时长与动作规划',
    description: '根据视频时长合理规划动作数量',
    recommendations: [
      { duration: '5秒', actions: '1-2个主要动作', example: '猫咪走进来 → 躺下' },
      { duration: '10秒', actions: '2-3个连贯动作', example: '起床 → 伸懒腰 → 看向窗外' },
      { duration: '15秒', actions: '3-4个场景', example: '完整的做饭流程或对话场景' }
    ]
  },
  
  // ========== 首帧图技巧 ==========
  firstFrameImage: {
    title: '首帧图的价值',
    description: '首帧图是提升视频效果的关键工具',
    benefits: [
      '锁定画面理想标准态',
      '保持主体特征一致性',
      '提升画面确定性和还原度',
      '明确画面构图和风格方向'
    ],
    whenToSuggest: [
      '用户想要生成视频时',
      '用户提到角色/人物时',
      '用户希望保持风格一致时'
    ],
    suggestionTemplate: '我可以先生成一张首帧图来锁定画面效果，这样后续视频会更符合你的预期。你同意吗？',
    toolName: 'generate_first_frame'
  },
  
  // ========== 图片参考技巧 ==========
  imageReference: {
    title: '图片参考使用指南',
    types: [
      { 
        name: '主体多视角',
        usage: '保持角色或商品外观一致',
        promptPattern: '参考图片1、图片2的主体特征',
        example: '生成图片中女孩在咖啡店吃蛋糕的画面'
      },
      {
        name: '场景参考',
        usage: '设定环境背景',
        promptPattern: '场景设定在图片1的咖啡店内',
        example: '温馨的居家场景，暖色调'
      },
      {
        name: '分镜图参考',
        usage: '控制画面构图和节奏',
        promptPattern: '参考图片中的分镜构图',
        example: '先展示全景，然后切换到特写'
      },
      {
        name: 'Logo参考',
        usage: '品牌元素植入',
        promptPattern: '画面右下角显示图片1的Logo',
        example: '整体风格统一，品牌标识明显'
      }
    ]
  },
  
  // ========== 视频参考技巧 ==========
  videoReference: {
    title: '视频参考使用指南',
    types: [
      {
        name: '动作参考',
        usage: '复现人物或动物的动作',
        promptPattern: '参考视频1的人物动作',
        example: '让角色做出视频中人物的奔跑姿态'
      },
      {
        name: '运镜参考',
        usage: '复现镜头运动方式',
        promptPattern: '参考视频1的运镜方式',
        example: '俯冲视角，跟随镜头'
      },
      {
        name: '特效参考',
        usage: '添加粒子、光效等视觉特效',
        promptPattern: '参考视频1的金色粒子特效',
        example: '人物吹笛时身边环绕粒子特效'
      }
    ]
  },
  
  // ========== 文字生成 ==========
  textInVideo: {
    title: '视频中生成文字',
    types: [
      { name: '广告语/Slogan', pattern: '画面中部显示文字"..."' },
      { name: '字幕', pattern: '画面底部出现字幕，字幕内容为"..."' },
      { name: '气泡台词', pattern: '角色周边出现气泡，气泡里写着台词' }
    ],
    tips: '优先使用常用字，避免生僻字与特殊符号'
  },
  
  // ========== 视频编辑 ==========
  videoEditing: {
    title: '视频编辑操作',
    operations: [
      { name: '增加元素', pattern: '在视频1的[位置]增加[元素]' },
      { name: '删除元素', pattern: '删除视频1中的[元素]' },
      { name: '修改元素', pattern: '将视频1中的[A]替换为[B]' },
      { name: '向后延长', pattern: '生成视频1之后的内容' },
      { name: '向前延长', pattern: '向前延长视频1的内容' }
    ]
  },
  
  // ========== 主动优化场景 ==========
  proactiveOptimization: {
    title: '主动优化建议场景',
    scenarios: [
      {
        trigger: '用户想生成视频',
        currentIssue: '用户没有提供参考图',
        suggestion: '建议生成首帧图',
        reason: '首帧图可以锁定画面效果，提升视频质量',
        example: '我可以先生成一张首帧图来提升效果，你同意吗？'
      },
      {
        trigger: '用户要写脚本',
        currentIssue: '提示词可能不够具体',
        suggestion: '提醒加入动作规划',
        reason: '具体的动作描述可以让视频更生动',
        example: '根据最佳实践，加入动作规划会让视频更生动。要我帮你优化吗？'
      },
      {
        trigger: '用户提到时长',
        currentIssue: '动作数量可能不合理',
        suggestion: '提醒时长与动作的关系',
        reason: '合理分配动作数量可以避免画面拥挤或空洞',
        example: '10秒视频建议2-3个连贯动作，这样节奏会比较好。'
      },
      {
        trigger: '用户需要角色一致',
        currentIssue: '没有角色参考图',
        suggestion: '建议上传多视角图片',
        reason: '多视角图可以保持角色外观一致',
        example: '要保持角色外观一致，可以上传2-3张不同角度的图片。'
      },
      {
        trigger: '用户说效果不好',
        currentIssue: '提示词可能不够具体',
        suggestion: '检查并建议优化',
        reason: '更具体的描述可以获得更符合预期的结果',
        example: '根据常见问题，可能是描述不够具体。建议加入更多细节，比如光线、表情、动作等。'
      }
    ]
  },
  
  // ========== 工作原则 ==========
  workPrinciples: {
    title: '工作原则（建议而非强制）',
    principles: [
      '理解用户需求是第一步，不要急于给出方案',
      '识别可优化的点，主动建议并说明原因',
      '获得用户同意后，优先用工具自主完成',
      '无法完成时才求助用户协助',
      '尊重用户的选择，不要强制推销优化建议'
    ],
    communicationStyle: {
      suggest: '建议',
      reason: '根据[原因]，这样效果更好',
      confirm: '你同意吗？',
      example: '根据最佳实践，加入动作规划会让视频更生动。我可以帮你优化提示词，你同意吗？'
    }
  },
  
  // ========== 常见问题 ==========
  commonIssues: {
    title: '常见问题与解决方案',
    issues: [
      {
        problem: '视频效果与预期不符',
        likelyCause: '提示词不够具体',
        solution: '加入更多细节：光线、颜色、表情、动作幅度等'
      },
      {
        problem: '角色外观不一致',
        likelyCause: '没有使用参考图',
        solution: '建议用户提供角色多视角图片作为参考'
      },
      {
        problem: '画面风格不统一',
        likelyCause: '缺少首帧图或风格描述',
        solution: '先生成首帧图锁定风格，或在提示词中明确风格'
      },
      {
        problem: '动作太生硬',
        likelyCause: '动作描述不够连贯',
        solution: '使用"逐渐"、"慢慢"等过渡词，让动作更自然'
      },
      {
        problem: '文字显示效果差',
        likelyCause: '使用了生僻字或特殊符号',
        solution: '使用常用字，避免生僻字'
      }
    ]
  }
};

export default SEEDANCE_2_0_GUIDE;
