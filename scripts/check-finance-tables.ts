/**
 * Quick check: billing columns + finance tables across all 3 databases
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

function extractUrlsFromMd(filePath: string): string[] {
  const md = readFileSync(filePath, 'utf8');
  return [...md.matchAll(/postgresql:\/\/[^\s`]+/g)].map((m) => m[0]);
}

function pgSslOption(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  try {
    const u = new URL(connectionString.replace(/^postgresql:/i, 'http:'));
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;
  } catch {}
  return { rejectUnauthorized: false };
}

async function main() {
  const mdPath = path.join(process.cwd(), 'WORK_MEMORY', '23-数据库连接记录-开发与生产.md');
  const urls = extractUrlsFromMd(mdPath);
  const [devUrl, prodUrl] = urls;

  const { config } = await import('dotenv');
  config({ path: path.join(process.cwd(), '.env.local') });
  const localUrl = process.env.DATABASE_URL;

  for (const [name, url] of [['LOCAL', localUrl], ['DEV', devUrl], ['PROD', prodUrl]] as const) {
    if (!url) { console.log(`\n=== ${name}: SKIP ===`); continue; }
    console.log(`\n=== ${name} ===`);
    const c = new Client({ connectionString: url, ssl: pgSslOption(url) });
    await c.connect();

    // billing columns
    const bc = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='billing' ORDER BY ordinal_position`
    );
    console.log('billing columns: ' + bc.rows.map((r: { column_name: string }) => r.column_name).join(', '));

    // finance_* tables
    const ft = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'finance_%' ORDER BY table_name`
    );
    const names = ft.rows.map((r: { table_name: string }) => r.table_name);
    console.log('finance_* tables: ' + (names.length ? names.join(', ') : '(none)'));

    // check finance_memories columns if exists
    if (names.includes('finance_memories')) {
      const fm = await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_memories' ORDER BY ordinal_position`
      );
      console.log('  finance_memories cols: ' + fm.rows.map((r: { column_name: string }) => r.column_name).join(', '));
    }

    // check finance_scheduled_tasks columns if exists
    if (names.includes('finance_scheduled_tasks')) {
      const fs = await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_scheduled_tasks' ORDER BY ordinal_position`
      );
      console.log('  finance_scheduled_tasks cols: ' + fs.rows.map((r: { column_name: string }) => r.column_name).join(', '));
    }

    // check finance_conversation_messages columns if exists
    if (names.includes('finance_conversation_messages')) {
      const fcm = await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_conversation_messages' ORDER BY ordinal_position`
      );
      console.log('  finance_conversation_messages cols: ' + fcm.rows.map((r: { column_name: string }) => r.column_name).join(', '));
    }

    await c.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
