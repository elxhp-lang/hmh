/**
 * Deep comparison: column name + data_type across LOCAL / DEV / PROD vs Drizzle schema.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

// Expected types from Drizzle schema.ts (PostgreSQL types)
const EXPECTED_TYPES: Record<string, Record<string, string>> = {
  videos: {
    id: 'character varying',
    user_id: 'character varying',
    session_id: 'uuid',
    prompt: 'text',
    video_name: 'character varying',
    script: 'text',
    copywriting: 'text',
    tags: 'ARRAY',        // text[] → reported as ARRAY by information_schema
    tag_source: 'text',
    auto_tag_status: 'text',
    category: 'text',
    task_type: 'character varying',
    model: 'character varying',
    reference_images: 'jsonb',
    reference_videos: 'jsonb',
    reference_audios: 'jsonb',
    first_frame: 'character varying',
    last_frame: 'character varying',
    ratio: 'character varying',
    duration: 'integer',
    generate_audio: 'boolean',
    watermark: 'boolean',
    web_search: 'boolean',
    source_video_id: 'text',
    source_task_id: 'text',
    is_remix: 'boolean',
    status: 'character varying',
    task_id: 'character varying',
    result_url: 'character varying',
    tos_key: 'character varying',
    public_video_url: 'text',
    audio_url: 'character varying',
    cover_url: 'character varying',
    last_frame_url: 'text',
    last_frame_tos_key: 'character varying',
    cost: 'numeric',
    error_message: 'text',
    error_reason: 'text',
    total_tokens: 'integer',
    input_tokens: 'integer',
    output_tokens: 'integer',
    cost_numeric: 'numeric',
    cost_real: 'numeric',
    created_at: 'timestamp with time zone',
    updated_at: 'timestamp with time zone',
  },
};

function extractUrlsFromMd(filePath: string): string[] {
  const md = readFileSync(filePath, 'utf8');
  return [...md.matchAll(/postgresql:\/\/[^\s`]+/g)].map((m) => m[0]);
}

function pgSslOption(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  try {
    const u = new URL(connectionString.replace(/^postgresql:/i, 'http:'));
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;
  } catch { /* ignore */ }
  return { rejectUnauthorized: false };
}

async function fetchColumns(connectionString: string, table: string): Promise<Map<string, string>> {
  const client = new Client({ connectionString, ssl: pgSslOption(connectionString) });
  await client.connect();
  const { rows } = await client.query<{ column_name: string; data_type: string; udt_name: string }>(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  await client.end();
  const m = new Map<string, string>();
  for (const r of rows) {
    // For array types, udt_name starts with '_' (e.g. _text)
    const actualType = r.udt_name.startsWith('_') ? 'ARRAY' : r.data_type;
    m.set(r.column_name, actualType);
  }
  return m;
}

function normalizeType(t: string): string {
  // Normalize known aliases
  if (t === 'timestamp without time zone') return 'timestamp without time zone';
  if (t === 'timestamp with time zone') return 'timestamp with time zone';
  if (t === 'character') return 'character';
  return t;
}

async function main() {
  const mdPath = path.join(process.cwd(), 'WORK_MEMORY', '23-数据库连接记录-开发与生产.md');
  const urls = extractUrlsFromMd(mdPath);
  if (urls.length < 2) {
    console.error('Expected 2 postgresql URLs, got', urls.length);
    process.exit(1);
  }
  const [devUrl, prodUrl] = urls;

  // Load LOCAL from .env.local
  const { config } = await import('dotenv');
  config({ path: path.join(process.cwd(), '.env.local') });
  const localUrl = process.env.DATABASE_URL || process.env.PGDATABASE_URL;

  const expected = EXPECTED_TYPES.videos;

  for (const [label, url] of [['DEV', devUrl], ['PROD', prodUrl], ['LOCAL', localUrl]] as const) {
    if (!url) { console.log(`\n=== ${label}: SKIP (no URL) ===`); continue; }
    console.log(`\n=== ${label} vs Drizzle schema.ts (videos column types) ===`);
    try {
      const actual = await fetchColumns(url, 'videos');
      const issues: string[] = [];
      for (const [col, expType] of Object.entries(expected)) {
        const actType = actual.get(col);
        if (!actType) {
          issues.push(`  MISSING: ${col} — expected ${expType}, not found in DB`);
        } else if (normalizeType(actType) !== normalizeType(expType)) {
          issues.push(`  TYPE MISMATCH: ${col} — DB=${actType}  schema.ts=${expType}`);
        }
      }
      for (const col of actual.keys()) {
        if (!(col in expected)) {
          issues.push(`  EXTRA in DB: ${col} (not in Drizzle schema)`);
        }
      }
      if (issues.length === 0) {
        console.log('  All column names and types match schema.ts.');
      } else {
        for (const issue of issues) console.log(issue);
      }
    } catch (e) {
      console.error(`  ERROR:`, e instanceof Error ? e.message : e);
    }
  }

  // Cross-DB type comparison
  console.log('\n=== Cross-DB type comparison (videos) ===');
  try {
    const all: Record<string, Map<string, string>> = {};
    if (devUrl) all['DEV'] = await fetchColumns(devUrl, 'videos');
    if (prodUrl) all['PROD'] = await fetchColumns(prodUrl, 'videos');
    if (localUrl) all['LOCAL'] = await fetchColumns(localUrl, 'videos');

    const allCols = new Set<string>();
    for (const m of Object.values(all)) for (const k of m.keys()) allCols.add(k);

    let diffs = 0;
    for (const col of [...allCols].sort()) {
      const types = Object.entries(all).map(([name, m]) => ({ name, type: m.get(col) || '(missing)' }));
      const unique = new Set(types.map((t) => t.type));
      if (unique.size > 1) {
        diffs++;
        console.log(`  ${col}: ${types.map((t) => `${t.name}=${t.type}`).join('  ')}`);
      }
    }
    if (diffs === 0) console.log('  All columns have identical types across all databases.');
  } catch (e) {
    console.error('Cross-DB compare failed:', e instanceof Error ? e.message : e);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
