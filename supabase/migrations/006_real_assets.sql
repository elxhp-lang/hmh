-- 真人演员素材库（全平台共享）
CREATE TABLE IF NOT EXISTS real_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL UNIQUE,
  asset_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_assets_name ON real_assets(name);
CREATE INDEX IF NOT EXISTS idx_real_assets_category ON real_assets(category);
CREATE INDEX IF NOT EXISTS idx_real_assets_status ON real_assets(status);
CREATE INDEX IF NOT EXISTS idx_real_assets_updated_at ON real_assets(updated_at DESC);

