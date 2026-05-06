-- 016: user_models 补字段（api_example + audit_result + caps）
ALTER TABLE user_models ADD COLUMN IF NOT EXISTS api_example text;
ALTER TABLE user_models ADD COLUMN IF NOT EXISTS audit_result jsonb;
ALTER TABLE user_models ADD COLUMN IF NOT EXISTS caps jsonb;
