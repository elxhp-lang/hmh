-- 014: 用户画像表 & 会话复盘标记
-- 让创意小海越用越懂用户：自动分析用户行为，构建隐式画像

-- 1. agent_sessions 加复盘标记
ALTER TABLE agent_sessions
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS agent_sessions_reviewed_at_idx
ON agent_sessions (reviewed_at)
WHERE reviewed_at IS NULL;

-- 2. 用户画像表
CREATE TABLE IF NOT EXISTS user_profiles (
    id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tools_usage jsonb,           -- { toolName: callCount }
    style_keywords text[],       -- ["现代简约","暖色调"]
    preferred_ratio text,        -- "9:16"
    avg_duration numeric(4,1),   -- 8.5
    tone_keywords text[],        -- ["科技感","治愈"]
    failure_count integer DEFAULT 0,
    total_conversations integer DEFAULT 0,
    behavior_summary text,       -- 纯文本行为描述
    last_reviewed_session_id varchar(36),
    last_reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS user_profiles_last_reviewed_at_idx ON user_profiles (last_reviewed_at);
