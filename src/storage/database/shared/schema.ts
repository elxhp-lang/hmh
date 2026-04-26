import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, boolean, integer, numeric, text, jsonb, index } from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// ========== 系统表（禁止删除）==========
export const healthCheck = pgTable("health_check", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ========== 用户表 ==========
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 50 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default('member'), // super_admin, finance, material_leader, material_member
    status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, active, disabled
    storage_path: varchar("storage_path", { length: 255 }), // TOS 存储路径
    storage_quota: integer("storage_quota").default(10737418240), // 存储配额（字节），默认 10GB
    storage_used: integer("storage_used").default(0), // 已使用存储（字节）
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_username_idx").on(table.username),
    index("users_email_idx").on(table.email),
    index("users_status_idx").on(table.status),
    index("users_storage_path_idx").on(table.storage_path),
  ]
);

// ========== 视频任务表 ==========
export const videos = pgTable(
  "videos",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`), // video_id（我们系统生成的 UUID）
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(), // 视频生成提示词
    video_name: varchar("video_name", { length: 200 }), // 创意小海写的视频名称（用于多任务对应）
    script: text("script"), // 视频脚本
    copywriting: text("copywriting"), // 视频配文
    tags: jsonb("tags").$type<string[]>(), // 视频标签数组
    category: varchar("category", { length: 50 }), // 视频分类（开箱/测评/参数科普/热点解读）
    task_type: varchar("task_type", { length: 20 }).notNull().default('generate'), // generate, edit, extend
    model: varchar("model", { length: 50 }).notNull().default('doubao-seedance-2-0-260128'),
    reference_images: jsonb("reference_images").$type<string[]>(),
    reference_videos: jsonb("reference_videos").$type<string[]>(),
    reference_audios: jsonb("reference_audios").$type<string[]>(),
    first_frame: varchar("first_frame", { length: 500 }),
    last_frame: varchar("last_frame", { length: 500 }),
    ratio: varchar("ratio", { length: 10 }).notNull().default('16:9'), // 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, adaptive
    duration: integer("duration").notNull().default(5), // 秒 (4-15)
    generate_audio: boolean("generate_audio").default(true),
    watermark: boolean("watermark").default(false),
    web_search: boolean("web_search").default(false),
    source_video_id: varchar("source_video_id", { length: 36 }),
    source_task_id: varchar("source_task_id", { length: 100 }),
    is_remix: boolean("is_remix").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed
    seedance_task_id: varchar("seedance_task_id", { length: 100 }), // Seedance 任务 ID（仅用于查询进度）
    result_url: varchar("result_url", { length: 500 }), // 生成视频临时 URL（火山引擎返回）
    tos_key: varchar("tos_key", { length: 500 }), // TOS 存储的 key（持久化）
    public_video_url: varchar("public_video_url", { length: 500 }), // 公开永久 URL（播放、学习、下载都用它）
    audio_url: varchar("audio_url", { length: 500 }), // 生成音频 URL
    audio_tos_key: varchar("audio_tos_key", { length: 500 }), // 音频 TOS 存储的 key
    cover_url: varchar("cover_url", { length: 500 }), // 视频封面 URL
    cover_tos_key: varchar("cover_tos_key", { length: 500 }), // 封面 TOS 存储的 key
    last_frame_url: varchar("last_frame_url", { length: 500 }), // 尾帧图片 URL
    last_frame_tos_key: varchar("last_frame_tos_key", { length: 500 }), // 尾帧 TOS 存储的 key
    cost: numeric("cost", { precision: 10, scale: 2 }), // 费用 USDC
    error_reason: text("error_reason"), // 生成失败原因（原 error_message 字段）
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("videos_user_id_idx").on(table.user_id),
    index("videos_status_idx").on(table.status),
    index("videos_created_at_idx").on(table.created_at),
    index("videos_tos_key_idx").on(table.tos_key),
    index("videos_seedance_task_id_idx").on(table.seedance_task_id),
    index("videos_category_idx").on(table.category),
    index("videos_source_video_id_idx").on(table.source_video_id),
    index("videos_is_remix_idx").on(table.is_remix),
  ]
);

// ========== 账单表 ==========
export const billing = pgTable(
  "billing",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    video_id: varchar("video_id", { length: 36 }).references(() => videos.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    task_type: varchar("task_type", { length: 50 }).notNull(), // video_generation, etc.
    description: text("description"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("billing_user_id_idx").on(table.user_id),
    index("billing_video_id_idx").on(table.video_id),
    index("billing_created_at_idx").on(table.created_at),
  ]
);

// ========== 发票表 ==========
export const invoices = pgTable(
  "invoices",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    tax_number: varchar("tax_number", { length: 50 }).notNull(),
    address: varchar("address", { length: 200 }),
    bank_info: varchar("bank_info", { length: 200 }),
    email: varchar("email", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, approved, rejected
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("invoices_user_id_idx").on(table.user_id),
    index("invoices_status_idx").on(table.status),
    index("invoices_created_at_idx").on(table.created_at),
  ]
);

// ========== 操作日志表 ==========
export const operationLogs = pgTable(
  "operation_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    ip_address: varchar("ip_address", { length: 50 }),
    details: jsonb("details"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("operation_logs_user_id_idx").on(table.user_id),
    index("operation_logs_created_at_idx").on(table.created_at),
  ]
);

// ========== 智能体对话表 ==========
export const agentConversations = pgTable(
  "agent_conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    agent_type: varchar("agent_type", { length: 50 }).notNull(), // permission, finance, material
    session_id: varchar("session_id", { length: 36 }), // 关联会话
    message: text("message").notNull(),
    response: text("response"),
    status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, processing, completed
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_conversations_user_id_idx").on(table.user_id),
    index("agent_conversations_agent_type_idx").on(table.agent_type),
    index("agent_conversations_created_at_idx").on(table.created_at),
    index("agent_conversations_session_id_idx").on(table.session_id),
  ]
);

// ========== 智能体会话表 ==========
export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    agent_type: varchar("agent_type", { length: 50 }).notNull(), // permission, finance, material
    title: varchar("title", { length: 255 }),
    summary: text("summary"),
    status: varchar("status", { length: 20 }).notNull().default('active'), // active, archived
    message_count: integer("message_count").default(0),
    last_message_at: timestamp("last_message_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("agent_sessions_user_id_idx").on(table.user_id),
    index("agent_sessions_agent_type_idx").on(table.agent_type),
    index("agent_sessions_status_idx").on(table.status),
    index("agent_sessions_last_message_at_idx").on(table.last_message_at),
  ]
);

// ========== 智能体记忆表 ==========
export const agentMemories = pgTable(
  "agent_memories",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    agent_type: varchar("agent_type", { length: 50 }).notNull(),
    user_id: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
    memory_type: varchar("memory_type", { length: 50 }).notNull(), // preference, fact, skill, experience
    key: varchar("key", { length: 255 }).notNull(),
    value: jsonb("value").notNull(),
    importance: integer("importance").default(50),
    access_count: integer("access_count").default(0),
    last_accessed_at: timestamp("last_accessed_at", { withTimezone: true }),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("agent_memories_agent_type_idx").on(table.agent_type),
    index("agent_memories_user_id_idx").on(table.user_id),
    index("agent_memories_memory_type_idx").on(table.memory_type),
    index("agent_memories_key_idx").on(table.key),
    index("agent_memories_importance_idx").on(table.importance),
  ]
);

// ========== 智能体任务表 ==========
export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    agent_type: varchar("agent_type", { length: 50 }).notNull(),
    task_type: varchar("task_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed, cancelled
    priority: integer("priority").default(50),
    progress: integer("progress").default(0),
    input_data: jsonb("input_data"),
    output_data: jsonb("output_data"),
    error_message: text("error_message"),
    parent_task_id: varchar("parent_task_id", { length: 36 }).references(() => videos.id, { onDelete: "set null" }),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("agent_tasks_user_id_idx").on(table.user_id),
    index("agent_tasks_agent_type_idx").on(table.agent_type),
    index("agent_tasks_status_idx").on(table.status),
    index("agent_tasks_priority_idx").on(table.priority),
    index("agent_tasks_parent_task_id_idx").on(table.parent_task_id),
    index("agent_tasks_created_at_idx").on(table.created_at),
  ]
);

// ========== 财务快照表 ==========
export const financeSnapshots = pgTable(
  "finance_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    snapshot_type: varchar("snapshot_type", { length: 50 }).notNull(), // balance, daily_cost, monthly_cost
    data: jsonb("data").notNull(),
    recorded_at: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_snapshots_snapshot_type_idx").on(table.snapshot_type),
    index("finance_snapshots_recorded_at_idx").on(table.recorded_at),
  ]
);

// ========== 文件上传表 ==========
export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    file_name: varchar("file_name", { length: 255 }).notNull(),
    file_type: varchar("file_type", { length: 50 }).notNull(), // image, video, audio
    file_size: integer("file_size").notNull(),
    file_url: varchar("file_url", { length: 500 }).notNull(),
    source: varchar("source", { length: 50 }).notNull().default('upload'), // upload, douyin
    source_url: varchar("source_url", { length: 500 }), // 抖音原链接
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("uploaded_files_user_id_idx").on(table.user_id),
    index("uploaded_files_file_type_idx").on(table.file_type),
    index("uploaded_files_created_at_idx").on(table.created_at),
  ]
);

// ========== 每日消费统计表 ==========
export const dailyStats = pgTable(
  "daily_stats",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    stat_date: varchar("stat_date", { length: 10 }).notNull(), // YYYY-MM-DD
    category: varchar("category", { length: 50 }).notNull(),
    total_amount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    total_tasks: integer("total_tasks").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("daily_stats_stat_date_idx").on(table.stat_date),
    index("daily_stats_category_idx").on(table.category),
  ]
);

// ========== 创意小海工作流表（Phase 1 简化版）==========
export const xiaohaiWorkflows = pgTable(
  "xiaohai_workflows",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),

    // 工作流状态
    status: varchar("status", { length: 20 }).notNull().default('active'), // active, paused, completed, failed
    current_step: integer("current_step").notNull().default(1), // 1-8

    // 用户输入
    product_name: varchar("product_name", { length: 255 }),
    reference_videos: jsonb("reference_videos").$type<string[]>(), // 参考视频URL列表
    reference_images: jsonb("reference_images").$type<string[]>(), // 参考图片URL列表

    // 生成内容
    selected_script: jsonb("selected_script"), // 用户选择的脚本
    generated_scripts: jsonb("generated_scripts").$type<any[]>(), // 生成的所有脚本
    generated_videos: jsonb("generated_videos").$type<any[]>(), // 生成的所有视频

    // 用户偏好（Phase 3 使用）
    preferred_style: varchar("preferred_style", { length: 50 }), // 偏好风格
    preferred_platform: varchar("preferred_platform", { length: 50 }), // 偏好平台
    preferred_duration: integer("preferred_duration"), // 偏好时长

    // 元数据
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("xiaohai_workflows_user_id_idx").on(table.user_id),
    index("xiaohai_workflows_status_idx").on(table.status),
    index("xiaohai_workflows_current_step_idx").on(table.current_step),
    index("xiaohai_workflows_created_at_idx").on(table.created_at),
  ]
);

// ========== 真人演员素材库（全平台共享）==========
export const realAssets = pgTable(
  "real_assets",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    asset_id: text("asset_id").notNull(),
    asset_url: text("asset_url"),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    status: varchar("status", { length: 20 }).notNull().default('active'),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_real_assets_asset_id").on(table.asset_id),
    index("idx_real_assets_name").on(table.name),
    index("idx_real_assets_category").on(table.category),
    index("idx_real_assets_status").on(table.status),
  ]
);

// ========== Zod Schemas ==========
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({ coerce: { date: true } });

export const insertUserSchema = createCoercedInsertSchema(users).pick({ 
  username: true, 
  email: true, 
  password_hash: true 
});

export const insertVideoSchema = createCoercedInsertSchema(videos).pick({
  user_id: true,
  prompt: true,
  reference_images: true,
  reference_videos: true,
  reference_audios: true,
  first_frame: true,
  ratio: true,
  duration: true,
  generate_audio: true,
  watermark: true,
});

// ========== Types ==========
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Billing = typeof billing.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type OperationLog = typeof operationLogs.$inferSelect;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type AgentSession = typeof agentSessions.$inferSelect;
export type AgentMemory = typeof agentMemories.$inferSelect;
export type AgentTask = typeof agentTasks.$inferSelect;
export type FinanceSnapshot = typeof financeSnapshots.$inferSelect;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type DailyStat = typeof dailyStats.$inferSelect;
export type XiaohaiWorkflow = typeof xiaohaiWorkflows.$inferSelect;
export type RealAsset = typeof realAssets.$inferSelect;

// ========== 双笔记本系统 ==========
// ========== 对话历史表（笔记本1号：24小时清理）==========
export const agentConversationMessages = pgTable(
  "agent_conversation_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // user/assistant
    content: text("content").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_conv_messages_user").on(table.user_id),
    index("idx_conv_messages_created").on(table.created_at),
  ]
);

// ========== 用户偏好表（笔记本2号：永久保存，带分类标签）==========
export const creativeUserPreferences = pgTable(
  "creative_user_preferences",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    preference_type: varchar("preference_type", { length: 50 }).notNull(), // aspect_ratio/duration/style/industry/product_tags/custom
    content: text("content").notNull(),
    tags: jsonb("tags"), // 分类标签（可选）
    last_updated_at: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_preferences_user").on(table.user_id),
    index("idx_preferences_type").on(table.preference_type),
  ]
);

// ========== Types 补充 ==========
export type AgentConversationMessage = typeof agentConversationMessages.$inferSelect;
export type CreativeUserPreference = typeof creativeUserPreferences.$inferSelect;

// ========== 用户消息通知表（方案二：消息中心）==========
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    notification_type: varchar("notification_type", { length: 50 }).notNull(), // video_completed, video_failed, system_notice
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    // 关联资源（可选）
    related_video_id: varchar("related_video_id", { length: 36 }).references(() => videos.id, { onDelete: "set null" }),
    related_video_name: varchar("related_video_name", { length: 200 }),
    related_video_url: varchar("related_video_url", { length: 500 }),
    // 状态
    is_read: boolean("is_read").notNull().default(false),
    read_at: timestamp("read_at", { withTimezone: true }),
    // 跳转链接（可选）
    action_url: varchar("action_url", { length: 500 }),
    // 元数据
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notifications_user").on(table.user_id),
    index("idx_notifications_type").on(table.notification_type),
    index("idx_notifications_read").on(table.is_read),
    index("idx_notifications_created").on(table.created_at),
  ]
);

// ========== Types 补充 ==========
export type UserNotification = typeof userNotifications.$inferSelect;
