// 400개 관점 전체 실행. 그룹 하나가 실패해도 나머지를 계속 돈다.
import { spawnSync } from 'node:child_process';
const groups = ['A','B','C','D','E','FG','HIJ'];
let pass = 0, fail = 0;
for (const g of groups) {
  const r = spawnSync(process.execPath, [new URL(`./audits/audit${g}.mjs`, import.meta.url).pathname],
                      { encoding: 'utf8' });
  const line = (r.stdout || '').split('\n').find(x => x.startsWith('── ')) ?? `── ${g}: 실행 실패`;
  console.log(line);
  const m = line.match(/(\d+)\/(\d+) 통과/);
  if (m) { pass += +m[1]; fail += +m[2] - +m[1]; }
}
console.log(`\n════ 전체: ${pass}/${pass+fail} 통과, ${fail}건 미해결 ════`);
process.exit(fail ? 1 : 0);
