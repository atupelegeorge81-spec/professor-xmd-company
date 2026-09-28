import 'dotenv/config';
import { Template, defaultBuildLogger } from 'e2b';
import { template } from './template';

async function main() {
  console.log('🚀 Building template (dakika 5-8)...');
  await Template.build(template, 'professor-xmd-browser-v3', {
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log('\n✅ Template imeundwa: professor-xmd-browser-v3');
}
main().catch((e) => {
  console.error('❌ Build failed:', e);
  process.exit(1);
});
