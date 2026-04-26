-- 智能体能力系统数据库表

-- 1. 智能体能力档案表
CREATE TABLE IF NOT EXISTS agent_ability_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,  -- 'creative_agent', 'video_analyzer', 'style_expert'
  
  -- 综合评分
  overall_score DECIMAL(5,2) DEFAULT 0,
  level VARCHAR(20) DEFAULT 'novice',  -- novice, apprentice, skilled, expert, master
  
  -- 维度评分
  score_completeness DECIMAL(5,2) DEFAULT 0,
  score_accuracy DECIMAL(5,2) DEFAULT 0,
  score_creativity DECIMAL(5,2) DEFAULT 0,
  score_practicality DECIMAL(5,2) DEFAULT 0,
  score_efficiency DECIMAL(5,2) DEFAULT 0,
  
  -- 学习统计
  total_observations INT DEFAULT 0,  -- 观察大模型次数
  total_executions INT DEFAULT 0,    -- 独立执行次数
  successful_executions INT DEFAULT 0,
  user_selections INT DEFAULT 0,     -- 用户选择智能体次数
  user_rejections INT DEFAULT 0,     -- 用户选择大模型次数
  
  -- 趋势
  score_trend VARCHAR(20) DEFAULT 'stable',  -- improving, stable, declining
  weekly_progress JSONB DEFAULT '[]'::jsonb,  -- 每周进度记录
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, agent_type)
);

-- 2. 学习记录表
CREATE TABLE IF NOT EXISTS agent_learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  task_type VARCHAR(50) NOT NULL,  -- 'script_generation', 'video_analysis', etc.
  
  -- 执行模式
  execution_mode VARCHAR(20) NOT NULL,  -- 'learning', 'compare', 'independent'
  
  -- 输入输出
  task_input JSONB,
  master_output JSONB,  -- 大模型输出
  agent_output JSONB,   -- 智能体输出
  
  -- 评分
  master_score JSONB,   -- 大模型评分
  agent_score JSONB,    -- 智能体评分
  
  -- 用户反馈
  user_choice VARCHAR(20),  -- 'master', 'agent', 'both', 'neither'
  user_feedback TEXT,
  
  -- 学习成果
  patterns_learned JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 学习模式表
CREATE TABLE IF NOT EXISTS agent_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  
  -- 模式内容
  pattern_name VARCHAR(100),
  triggers JSONB,      -- 触发条件
  execution JSONB,     -- 执行模式
  examples JSONB,      -- 示例
  
  -- 学习元数据
  source_count INT DEFAULT 1,
  success_rate DECIMAL(5,2) DEFAULT 0.5,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INT DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ability_profiles_user ON agent_ability_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_ability_profiles_level ON agent_ability_profiles(level);
CREATE INDEX IF NOT EXISTS idx_learning_records_user ON agent_learning_records(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_type ON agent_learning_records(task_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_user ON agent_learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_task ON agent_learning_patterns(task_type);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ability_profiles_updated_at
    BEFORE UPDATE ON agent_ability_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_patterns_updated_at
    BEFORE UPDATE ON agent_learning_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建辅助函数
CREATE OR REPLACE FUNCTION increment_observations(
  p_user_id UUID,
  p_agent_type VARCHAR
)
RETURNS void AS $$
BEGIN
  UPDATE agent_ability_profiles
  SET total_observations = total_observations + 1
  WHERE user_id = p_user_id AND agent_type = p_agent_type;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_user_selections(
  p_user_id UUID,
  p_agent_type VARCHAR
)
RETURNS void AS $$
BEGIN
  UPDATE agent_ability_profiles
  SET 
    user_selections = user_selections + 1,
    total_executions = total_executions + 1,
    successful_executions = successful_executions + 1
  WHERE user_id = p_user_id AND agent_type = p_agent_type;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_user_rejections(
  p_user_id UUID,
  p_agent_type VARCHAR
)
RETURNS void AS $$
BEGIN
  UPDATE agent_ability_profiles
  SET 
    user_rejections = user_rejections + 1,
    total_executions = total_executions + 1
  WHERE user_id = p_user_id AND agent_type = p_agent_type;
END;
$$ LANGUAGE plpgsql;

-- 启用 RLS
ALTER TABLE agent_ability_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning_patterns ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "用户只能查看自己的能力档案" ON agent_ability_profiles
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "用户只能查看自己的学习记录" ON agent_learning_records
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "用户只能查看自己的学习模式" ON agent_learning_patterns
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- 服务端可以访问所有数据（使用 service_role key）
CREATE POLICY "服务端可以访问所有能力档案" ON agent_ability_profiles
  FOR ALL USING (true);

CREATE POLICY "服务端可以访问所有学习记录" ON agent_learning_records
  FOR ALL USING (true);

CREATE POLICY "服务端可以访问所有学习模式" ON agent_learning_patterns
  FOR ALL USING (true);
