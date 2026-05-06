-- 015: 用户自定义模型表
CREATE TABLE IF NOT EXISTS user_models (
    id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias varchar(100) NOT NULL,
    model_type varchar(20) NOT NULL DEFAULT 'chat',
    api_url text NOT NULL,
    api_key_encrypted text NOT NULL,
    model_name varchar(200) NOT NULL,
    is_default boolean DEFAULT false,
    auto_fallback boolean DEFAULT false,
    status varchar(20) DEFAULT 'untested',
    last_tested_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_models_user_id_idx ON user_models(user_id);
