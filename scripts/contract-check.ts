import { getSupabaseClient } from '../src/storage/database/supabase-client';

type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
};

async function run(): Promise<void> {
  const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.PGDATABASE_URL);
  if (!hasDbUrl) {
    console.log('=== Contract Check Results ===');
    console.log('[SKIP] database-env: DATABASE_URL/PGDATABASE_URL is not set in current shell');
    return;
  }

  const supabase = getSupabaseClient();
  const results: CheckResult[] = [];

  // 1) Verify select count/head semantics
  try {
    const { data, error, count } = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const passed = !error && Array.isArray(data) && data.length === 0 && typeof count === 'number';
    results.push({
      name: 'count-head-semantics',
      passed,
      detail: passed
        ? `ok (count=${count})`
        : `unexpected response: error=${error?.message || 'none'}, dataLen=${Array.isArray(data) ? data.length : -1}, count=${String(count)}`,
    });
  } catch (error) {
    results.push({
      name: 'count-head-semantics',
      passed: false,
      detail: error instanceof Error ? error.message : 'unknown error',
    });
  }

  // 2) Verify OR semantics with status filters
  try {
    const [processingRes, completedRes, orRes] = await Promise.all([
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.processing,status.eq.completed'),
    ]);

    const processingCount = processingRes.count || 0;
    const completedCount = completedRes.count || 0;
    const orCount = orRes.count || 0;
    const expected = processingCount + completedCount;
    const passed = !processingRes.error && !completedRes.error && !orRes.error && orCount === expected;

    results.push({
      name: 'or-filter-semantics',
      passed,
      detail: passed
        ? `ok (processing=${processingCount}, completed=${completedCount}, or=${orCount})`
        : `mismatch: processing=${processingCount}, completed=${completedCount}, or=${orCount}, err=${orRes.error?.message || 'none'}`,
    });
  } catch (error) {
    results.push({
      name: 'or-filter-semantics',
      passed: false,
      detail: error instanceof Error ? error.message : 'unknown error',
    });
  }

  // 3) Verify learning-library key namespace consistency
  try {
    const { data, error } = await supabase
      .from('learning_library')
      .select('id,video_key')
      .not('video_key', 'is', null)
      .limit(200);

    if (error) {
      results.push({
        name: 'learning-key-namespace',
        passed: false,
        detail: error.message,
      });
    } else {
      const rows = Array.isArray(data) ? (data as Array<{ id?: string; video_key?: string }>) : [];
      const invalid = rows.filter(
        (row) =>
          typeof row.video_key === 'string' &&
          !row.video_key.startsWith('users/') &&
          !row.video_key.startsWith('learning-library/') // legacy compatibility
      );
      const passed = invalid.length === 0;
      results.push({
        name: 'learning-key-namespace',
        passed,
        detail: passed ? `ok (checked=${rows.length})` : `invalidKeys=${invalid.length}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'learning-key-namespace',
      passed: false,
      detail: error instanceof Error ? error.message : 'unknown error',
    });
  }

  const failed = results.filter((r) => !r.passed);
  console.log('=== Contract Check Results ===');
  for (const result of results) {
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${result.name}: ${result.detail}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('contract-check fatal:', error);
  process.exit(1);
});
