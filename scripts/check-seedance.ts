import { config } from 'dotenv'; config({ path: '.env.local' });
import { SeedanceClient } from '../src/lib/seedance-client';
async function main() {
  const c = new SeedanceClient();
  const r1 = await c.getTask('cgt-20260506002859-b2w2h');
  console.log('视频1:', r1.status, r1.status === 'succeeded' ? 'URL:' + (r1.content?.video_url || '').slice(0, 80) : '');
  const r2 = await c.getTask('cgt-20260506003612-9zz62');
  console.log('视频2:', r2.status, r2.status === 'succeeded' ? 'URL:' + (r2.content?.video_url || '').slice(0, 80) : '');
}
main();
