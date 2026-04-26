-- 创意小海工作流数据表

-- 1. 工作流表
CREATE TABLE IF NOT EXISTS xiaohai_workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_step INTEGER NOT NULL DEFAULT 1,
  
  -- 任务信息
  task_type TEXT NOT NULL,
  product TEXT,
  reference_videos TEXT[] DEFAULT '{}',
  
  -- 脚本
  reference_script JSONB,
  generated_scripts JSONB[] DEFAULT '{}',
  selected_script_index INTEGER,
  
  -- 视频生成
  generated_videos TEXT[] DEFAULT '{}',
  
  -- 进度
  progress JSONB NOT NULL,
  
  -- 用户偏好
  preferences JSONB DEFAULT '{}',
  
  -- 批量生成
  batch_count INTEGER,
  batch_current_index INTEGER,
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 用户人格表（偏好蒸馏结果）
CREATE TABLE IF NOT EXISTS user_personalities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL UNIQUE,
  
  -- 创作偏好
  style TEXT[] DEFAULT '{}',
  duration INTEGER DEFAULT 15,
  platform TEXT DEFAULT '抖音',
  camera_work TEXT[] DEFAULT '{}',
  lighting TEXT DEFAULT '自然光',
  color_tone TEXT DEFAULT '暖色调',
  music_style TEXT[] DEFAULT '{}',
  subtitle_style JSONB DEFAULT '{}',
  
  -- 统计信息
  total_workflows INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 用户偏好记录表（每次工作流的偏好记录）
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  
  -- 本次偏好
  style TEXT,
  duration INTEGER,
  platform TEXT,
  camera_work TEXT[],
  lighting TEXT,
  color_tone TEXT,
  music_style TEXT,
  subtitle_style JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY (workflow_id) REFERENCES xiaohai_workflows(id) ON DELETE CASCADE
);

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON xiaohai_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON xiaohai_workflows(status);
CREATE INDEX IF NOT EXISTS idx_personalities_user_id ON user_personalities(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON user_preferences(user_id);

-- 5. RLS 策略
ALTER TABLE xiaohai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 工作流策略
CREATE POLICY "用户只能查看自己的工作流" ON xiaohai_workflows
  FOR SELECT USING (user_id = auth.uid()::TEXT);

CREATE POLICY "用户只能插入自己的工作流" ON xiaohai_workflows
  FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);

CREATE POLICY "用户只能更新自己的工作流" ON xiaohai_workflows
  FOR UPDATE USING (user_id = auth.uid()::TEXT);

-- 人格策略
CREATE POLICY "用户只能查看自己的人格" ON user_personalities
  FOR SELECT USING (user_id = auth.uid()::TEXT);

CREATE POLICY "用户只能插入自己的人格" ON user_personalities
  FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);

CREATE POLICY "用户只能更新自己的人格" ON user_personalities
  FOR UPDATE USING (user_id = auth.uid()::TEXT);

-- 偏好策略
CREATE POLICY "用户只能查看自己的偏好" ON user_preferences
  FOR SELECT USING (user_id = auth.uid()::TEXT);

CREATE POLICY "用户只能插入自己的偏好" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);
