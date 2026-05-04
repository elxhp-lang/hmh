/**
 * One-off: compare information_schema columns vs expected Drizzle columns.
 * Reads DEV/PROD URLs from WORK_MEMORY/23-数据库连接记录-开发与生产.md (two postgresql:// blocks).
 * Also loads LOCAL from projects/.env.local (DATABASE_URL) when present — does not print connection strings.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const TABLES = ['videos', 'users', 'daily_stats', 'operation_logs'] as const;

const EXPECTED: Record<string, string[]> = {
  videos: [
    'id',
    'user_id',
    'session_id',
    'prompt',
    'video_name',
    'script',
    'copywriting',
    'tags',
    'tag_source',
    'auto_tag_status',
    'category',
    'task_type',
    'model',
    'reference_images',
    'reference_videos',
    'reference_audios',
    'first_frame',
    'last_frame',
    'ratio',
    'duration',
    'generate_audio',
    'watermark',
    'web_search',
    'source_video_id',
    'source_task_id',
    'is_remix',
    'status',
    'task_id',
    'result_url',
    'tos_key',
    'public_video_url',
    'audio_url',
    'cover_url',
    'last_frame_url',
    'last_frame_tos_key',
    'cost',
    'error_message',
    'error_reason',
    'total_tokens',
    'input_tokens',
    'output_tokens',
    'cost_numeric',
    'cost_real',
    'created_at',
    'updated_at',
  ],
  users: [
    'id',
    'username',
    'email',
    'password_hash',
    'role',
    'status',
    'storage_path',
    'display_name',
    'avatar_url',
    'storage_quota',
    'storage_used',
    'created_at',
    'updated_at',
  ],
  daily_stats: ['id', 'stat_date', 'category', 'total_amount', 'total_tasks', 'created_at'],
  operation_logs: ['id', 'user_id', 'action', 'ip_address', 'details', 'created_at'],
};

function extractUrlsFromMd(filePath: string): string[] {
  const md = readFileSync(filePath, 'utf8');
  const matches = [...md.matchAll(/postgresql:\/\/[^\s`]+/g)].map((m) => m[0]);
  return matches;
}

function pgSslOption(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  try {
    const u = new URL(connectionString.replace(/^postgresql:/i, 'http:'));
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;
  } catch {
    /* ignore */
  }
  return { rejectUnauthorized: false };
}

async function fetchColumns(connectionString: string, table: string): Promise<Map<string, string>> {
  const client = new Client({
    connectionString,
    ssl: pgSslOption(connectionString),
  });
  await client.connect();
  const { rows } = await client.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  await client.end();
  const m = new Map<string, string>();
  for (const r of rows) {
    m.set(r.column_name, r.data_type);
  }
  return m;
}

function diffSets(
  label: string,
  expected: string[],
  actual: Map<string, string>
): { onlyInDb: string[]; onlyInCode: string[]; matched: string[] } {
  const exp = new Set(expected);
  const act = new Set(actual.keys());
  const onlyInDb = [...act].filter((c) => !exp.has(c)).sort();
  const onlyInCode = [...exp].filter((c) => !act.has(c)).sort();
  const matched = [...exp].filter((c) => act.has(c)).sort();
  void label;
  return { onlyInDb, onlyInCode, matched };
}

async function main() {
  const mdPath = path.join(process.cwd(), 'WORK_MEMORY', '23-数据库连接记录-开发与生产.md');
  let urls: string[];
  try {
    urls = extractUrlsFromMd(mdPath);
  } catch {
    console.error('Could not read WORK_MEMORY markdown with DB URLs. Skip live DB compare.');
    process.exit(0);
  }
  if (urls.length < 2) {
    console.error('Expected 2 postgresql URLs in WORK_MEMORY file, got', urls.length);
    process.exit(1);
  }
  const [devUrl, prodUrl] = urls;

  for (const envName of ['DEV', 'PROD'] as const) {
    const url = envName === 'DEV' ? devUrl : prodUrl;
    console.log(`\n=== ${envName} database (live columns) ===`);
    for (const table of TABLES) {
      try {
        const cols = await fetchColumns(url, table);
        console.log(`\n[${table}] ${cols.size} columns`);
        const d = diffSets(table, EXPECTED[table], cols);
        if (d.onlyInCode.length) {
          console.log(`  MISSING in DB (in code only): ${d.onlyInCode.join(', ') || '(none)'}`);
        }
        if (d.onlyInDb.length) {
          console.log(`  EXTRA in DB (not in Drizzle list): ${d.onlyInDb.join(', ') || '(none)'}`);
        }
        if (!d.onlyInCode.length && !d.onlyInDb.length) {
          console.log('  Matches Drizzle column name list.');
        }
      } catch (e) {
        console.error(`  [${table}] ERROR:`, e instanceof Error ? e.message : e);
      }
    }
  }

  console.log('\n=== DEV vs PROD column name diff (videos only) ===');
  try {
    const devV = await fetchColumns(devUrl, 'videos');
    const prodV = await fetchColumns(prodUrl, 'videos');
    const devKeys = new Set(devV.keys());
    const prodKeys = new Set(prodV.keys());
    const onlyDev = [...devKeys].filter((k) => !prodKeys.has(k)).sort();
    const onlyProd = [...prodKeys].filter((k) => !devKeys.has(k)).sort();
    console.log('Only in DEV:', onlyDev.length ? onlyDev.join(', ') : '(none)');
    console.log('Only in PROD:', onlyProd.length ? onlyProd.join(', ') : '(none)');
    if (!onlyDev.length && !onlyProd.length) {
      console.log('videos: DEV and PROD column names match.');
    }
  } catch (e) {
    console.error('DEV vs PROD compare failed:', e instanceof Error ? e.message : e);
  }

  console.log('\n=== LOCAL database (.env.local DATABASE_URL) ===');
  try {
    const { config } = await import('dotenv');
    config({ path: path.join(process.cwd(), '.env.local') });
    const localUrl = process.env.DATABASE_URL || process.env.PGDATABASE_URL;
    if (!localUrl) {
      console.log('Skip: no DATABASE_URL / PGDATABASE_URL in .env.local');
    } else {
      for (const table of TABLES) {
        try {
          const cols = await fetchColumns(localUrl, table);
          console.log(`\n[${table}] ${cols.size} columns`);
          const d = diffSets(table, EXPECTED[table], cols);
          if (d.onlyInCode.length) {
            console.log(`  MISSING in DB (in code only): ${d.onlyInCode.join(', ') || '(none)'}`);
          }
          if (d.onlyInDb.length) {
            console.log(`  EXTRA in DB (not in Drizzle list): ${d.onlyInDb.join(', ') || '(none)'}`);
          }
          if (!d.onlyInCode.length && !d.onlyInDb.length) {
            console.log('  Matches Drizzle column name list.');
          }
        } catch (e) {
          console.error(`  [${table}] ERROR:`, e instanceof Error ? e.message : e);
        }
      }
      console.log('\n=== LOCAL vs DEV column name diff (videos only) ===');
      try {
        const localV = await fetchColumns(localUrl, 'videos');
        const devV = await fetchColumns(devUrl, 'videos');
        const localKeys = new Set(localV.keys());
        const devKeys = new Set(devV.keys());
        const onlyLocal = [...localKeys].filter((k) => !devKeys.has(k)).sort();
        const onlyDev = [...devKeys].filter((k) => !localKeys.has(k)).sort();
        console.log('Only in LOCAL:', onlyLocal.length ? onlyLocal.join(', ') : '(none)');
        console.log('Only in DEV (online):', onlyDev.length ? onlyDev.join(', ') : '(none)');
        if (!onlyLocal.length && !onlyDev.length) {
          console.log('videos: LOCAL and online DEV column names match.');
        }
      } catch (e) {
        console.error('LOCAL vs DEV compare failed:', e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error('LOCAL section failed:', e instanceof Error ? e.message : e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
