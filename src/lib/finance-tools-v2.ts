/**
 * 财务助手工具定义 V2
 * 
 * 基于 Seed 2.0 Function Calling 的财务助手工具
 */

// ========== 类型定义 ==========

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: string | number | boolean;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
}

// ========== 工具定义（Function Calling 格式）==========

/**
 * 工具1：查询账户余额
 */
export const getBalanceTool: ToolDefinition = {
  name: 'get_balance',
  description: '查询用户账户的余额、可用额度、现金余额、信用额度等信息。用于回答"账户还有多少钱"、"余额够不够"等问题。',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * 工具2：查询账单概览
 */
export const getBillOverviewTool: ToolDefinition = {
  name: 'get_bill_overview',
  description: '按产品类型汇总查询周期内的费用，包括原价、优惠抵扣和实际支付金额。用于回答"这个月各产品花了多少钱"等问题。',
  parameters: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: '账单周期，格式 YYYY-MM，如 "2026-04"。不传则默认当前月份。'
      }
    },
    required: []
  }
};

/**
 * 工具3：查询账单明细
 */
export const getBillDetailsTool: ToolDefinition = {
  name: 'get_bill_details',
  description: '查询详细的账单明细记录，包括每笔费用的产品、计费项、原价、优惠和实付金额。用于回答"具体花了哪些钱"等问题。',
  parameters: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: '账单周期，格式 YYYY-MM，如 "2026-04"。不传则默认当前月份。'
      },
      page_num: {
        type: 'number',
        description: '页码，从1开始。用于分页查询。'
      },
      page_size: {
        type: 'number',
        description: '每页数量，默认50条。'
      }
    },
    required: []
  }
};

/**
 * 工具4：查询代金券
 */
export const getCouponsTool: ToolDefinition = {
  name: 'get_coupons',
  description: '查询用户账户下的代金券列表，包括优惠券名称、面值、剩余金额、有效期和适用产品。用于回答"有哪些优惠券"、"优惠券怎么用"等问题。',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * 工具5：查询资源包
 */
export const getResourcePackagesTool: ToolDefinition = {
  name: 'get_resource_packages',
  description: '查询用户已购买的资源包，包括资源包名称、类型、剩余数量、有效期等信息。用于回答"买了哪些资源包"、"还剩多少"等问题。',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * 工具6：分析费用趋势
 */
export const analyzeCostTrendTool: ToolDefinition = {
  name: 'analyze_cost_trend',
  description: '分析指定日期范围内的每日或每周费用趋势，用于发现异常费用、评估成本变化。用于回答"这个月费用趋势怎么样"、"哪天花得最多"等问题。',
  parameters: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        description: '开始日期，格式 YYYY-MM-DD，如 "2026-03-01"'
      },
      end_date: {
        type: 'string',
        description: '结束日期，格式 YYYY-MM-DD，如 "2026-04-14"'
      },
      granularity: {
        type: 'string',
        description: '统计粒度：daily(按天)、weekly(按周)、monthly(按月)。默认 daily'
      }
    },
    required: ['start_date', 'end_date']
  }
};

/**
 * 工具7：估算视频成本
 */
export const estimateVideoCostTool: ToolDefinition = {
  name: 'estimate_video_cost',
  description: '根据视频生成参数（时长、是否图生视频、数量）估算成本。用于回答"生成一个视频要多少钱"、"10个15秒视频多少钱"等问题。',
  parameters: {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        description: '视频时长（秒），范围 5-15。默认 5 秒'
      },
      has_video_input: {
        type: 'boolean',
        description: '是否有视频参考输入。图生视频为 true，文生视频为 false。影响单价'
      },
      quantity: {
        type: 'number',
        description: '生成数量，默认 1'
      }
    },
    required: []
  }
};

/**
 * 工具8：生成财务报告
 */
export const generateFinanceReportTool: ToolDefinition = {
  name: 'generate_finance_report',
  description: '生成指定周期的完整财务报告，包括账户状态、费用概览、趋势分析、优化建议等。用于回答"给我一份财务报告"等问题。',
  parameters: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: '账单周期，格式 YYYY-MM，如 "2026-04"。不传则默认当前月份。'
      }
    },
    required: []
  }
};

/**
 * 工具9：保存财务记忆
 */
export const saveFinanceMemoryTool: ToolDefinition = {
  name: 'save_finance_memory',
  description: '将重要的财务数据、分析结论、计算规则等保存到记忆库，方便后续快速查询和使用。',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: '记忆键，如 "video_cost_rate"、"budget_alert_100" 等'
      },
      value: {
        type: 'string',
        description: '记忆内容，支持 JSON 格式字符串'
      },
      category: {
        type: 'string',
        description: '记忆分类：cost_analysis(成本分析)、budget(预算)、rules(规则)、custom(自定义)'
      }
    },
    required: ['key', 'value']
  }
};

/**
 * 工具10：读取财务记忆
 */
export const getFinanceMemoryTool: ToolDefinition = {
  name: 'get_finance_memory',
  description: '从记忆库读取之前保存的财务数据、分析结论或计算规则。',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: '记忆键，如需要精确查询'
      },
      category: {
        type: 'string',
        description: '记忆分类：cost_analysis(成本分析)、budget(预算)、rules(规则)、custom(自定义)。不传则查询所有'
      }
    },
    required: []
  }
};

/**
 * 工具11：搜索财务记忆
 */
export const searchFinanceMemoryTool: ToolDefinition = {
  name: 'search_finance_memory',
  description: '根据关键词搜索记忆库中的相关财务数据、分析结论。用于快速找到之前保存的信息。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词'
      }
    },
    required: ['keyword']
  }
};

/**
 * 工具12：创建定时任务
 */
export const createScheduledTaskTool: ToolDefinition = {
  name: 'create_scheduled_task',
  description: '创建定期执行的财务任务，如"每天早上9点查余额"、"每周一生成周报"等。任务到期时自动提醒用户。',
  parameters: {
    type: 'object',
    properties: {
      task_name: {
        type: 'string',
        description: '任务名称，如 "每日余额检查"、"周报生成"'
      },
      task_type: {
        type: 'string',
        description: '任务类型：balance_check(余额检查)、cost_report(费用报告)、budget_alert(预算提醒)、custom(自定义)'
      },
      cron_expression: {
        type: 'string',
        description: 'Cron 表达式，如 "0 9 * * *" 表示每天早上9点执行'
      },
      params: {
        type: 'string',
        description: '任务参数，JSON 格式字符串，如 {"period": "2026-04"}'
      }
    },
    required: ['task_name', 'task_type', 'cron_expression']
  }
};

/**
 * 工具13：查询定时任务
 */
export const getScheduledTasksTool: ToolDefinition = {
  name: 'get_scheduled_tasks',
  description: '查询用户创建的所有定时任务，包括任务名称、类型、下次执行时间等。',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * 工具14：删除定时任务
 */
export const deleteScheduledTaskTool: ToolDefinition = {
  name: 'delete_scheduled_task',
  description: '删除指定的定时任务，停止自动执行。',
  parameters: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: '要删除的任务ID'
      }
    },
    required: ['task_id']
  }
};

/**
 * 工具15：设置预算提醒
 */
export const setBudgetAlertTool: ToolDefinition = {
  name: 'set_budget_alert',
  description: '设置每月或每日的费用预算上限，超出时提醒。用于控制成本。',
  parameters: {
    type: 'object',
    properties: {
      budget_amount: {
        type: 'number',
        description: '预算金额（元）'
      },
      period_type: {
        type: 'string',
        description: '预算周期：monthly(每月)、weekly(每周)、daily(每日)'
      },
      alert_threshold: {
        type: 'number',
        description: '预警阈值，如 0.8 表示当费用达到预算的80%时提醒'
      }
    },
    required: ['budget_amount', 'period_type']
  }
};

/**
 * 工具16：获取预算状态
 */
export const getBudgetStatusTool: ToolDefinition = {
  name: 'get_budget_status',
  description: '查询用户设置的预算规则和当前消费情况，包括已用额度、剩余额度、预计月末费用等。',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * 工具17：联网搜索
 */
export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: '联网搜索最新信息。适用于用户问题涉及最新政策、市场行情、行业动态、知识百科等需要联网查询的场景。联网功能默认关闭，需要用户在界面右上角开启。开启后AI会自主判断是否需要搜索。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词或问题'
      },
      count: {
        type: 'integer',
        description: '返回结果数量，默认5条',
        default: 5
      }
    },
    required: ['query']
  }
};

// ========== 工具列表（导出）==========

export const financeToolsV2: Record<string, ToolDefinition> = {
  // 财务查询工具
  get_balance: getBalanceTool,
  get_bill_overview: getBillOverviewTool,
  get_bill_details: getBillDetailsTool,
  get_coupons: getCouponsTool,
  get_resource_packages: getResourcePackagesTool,
  analyze_cost_trend: analyzeCostTrendTool,
  estimate_video_cost: estimateVideoCostTool,
  generate_finance_report: generateFinanceReportTool,
  
  // 记忆存储工具
  save_finance_memory: saveFinanceMemoryTool,
  get_finance_memory: getFinanceMemoryTool,
  search_finance_memory: searchFinanceMemoryTool,
  
  // 定时任务工具
  create_scheduled_task: createScheduledTaskTool,
  get_scheduled_tasks: getScheduledTasksTool,
  delete_scheduled_task: deleteScheduledTaskTool,
  
  // 预算管理工具
  set_budget_alert: setBudgetAlertTool,
  get_budget_status: getBudgetStatusTool,

  // 联网搜索工具
  web_search: webSearchTool,
};

// ========== 工具列表（数组格式，用于 LLM）==========

export const financeToolsList: ToolDefinition[] = Object.values(financeToolsV2);
