// 감사 전체 실행. 그룹 하나가 실패해도 나머지를 계속 돈다.
// 실행이 끝나면 **문서·코드가 주장하는 감사 개수**가 실측과 맞는지 함께 검사한다.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';

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
const total = pass + fail;
console.log(`\n════ 전체: ${pass}/${total} 통과, ${fail}건 미해결 ════`);

// ════════════════════════════════════════════════════════════════
//  감사 개수 동기화 — 정정만 하면 또 낡으므로 검사로 잠근다 (§1.5)
//
//  실제로 이 숫자는 **세 가지**로 갈라져 있었다:
//    · 221 — 문서·테스트 16곳 (한 세대 전 값)
//    · 400 — 코드 주석 5곳 (전작의 값을 그대로 들고 있었음)
//    · 실측 — 그 어느 쪽도 아님
//  auditB 는 그 400 으로 다중비교 우연실패 기대치를 **실제로 계산**하고 있었다.
//  숫자가 코드에 물려 있으면 낡은 문서는 낡은 통계가 된다.
// ════════════════════════════════════════════════════════════════
// ① 코드가 실제로 쓰는 상수 (auditB 의 다중비교 보정이 이걸 곱한다)
const { AUDIT_COUNT } = await import('./lib.mjs');
const constOk = AUDIT_COUNT === total;
if (!constOk)
  console.log(`\n!! sim/lib.mjs 의 AUDIT_COUNT = ${AUDIT_COUNT} 인데 실측은 ${total} 이다 ` +
              `— 다중비교 보정이 틀린 수로 계산된다`);

// ② 문서·주석이 말로 주장하는 개수
const ROOT = new URL('..', import.meta.url).pathname;
const walk = (dir, ext, out = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = `${dir}/${e}`;
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.some(x => e.endsWith(x))) out.push(p);
  }
  return out;
};
const FILES = [
  `${ROOT}README.md`, `${ROOT}CLAUDE.md`,
  ...walk(`${ROOT}docs`, ['.md']),
  ...walk(`${ROOT}sim`, ['.mjs']),
  ...walk(`${ROOT}lib`, ['.dart']),
  ...walk(`${ROOT}test`, ['.dart']),
];

// 「감사 N개」류 주장. 앞에 숫자·쉼표가 붙은 것은 제외한다 (2,210개 → 210 오검출 방지).
const CLAIMS = [
  /감사\s*(?<![\d,])(\d+)\s*개/g,
  /(?<![\d,])(\d+)\s*개\s*감사/g,
  /(?<![\d,])(\d+)\s*개\s*(?:검사|관점)/g,
  /감사\s+(?<![\d,])(\d+)\s*\/\s*(\d+)/g,
  /관점을\s*(?<![\d,])(\d+)\s*개에서/g,
];
// 전작(카트 레이싱) 이야기의 400 은 대상이 아니다.
// ⚠️ 한 줄만 보면 놓친다 — "폐기된 전작이 있다"와 "400개 관점 감사를 통과하고도"가
//    다른 줄에 있는 경우가 실제로 있었다. 직전 줄까지 함께 본다.
const isPrev = l => /전작|이전 프로젝트|카트 레이싱|폐기/.test(l);

const wrong = [];
let hits = 0;
for (const file of FILES) {
  const rel = file.slice(ROOT.length);
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (isPrev(line) || (li > 0 && isPrev(lines[li-1]))) continue;
    for (const re of CLAIMS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        for (const g of m.slice(1).filter(Boolean)) {
          hits++;
          if (+g !== total) wrong.push(`${rel}: "${m[0].trim()}" (실측 ${total})`);
        }
      }
    }
  }
}

// 패턴이 문구와 안 맞아 0건 매칭되면 공허하게 통과한다 — 그것도 실패로 알린다.
let sync = true;
if (hits === 0) {
  console.log(`\n!! 감사 개수 주장을 한 건도 못 찾음 — 패턴이 낡았거나 서술이 사라졌다`);
  sync = false;
} else if (wrong.length) {
  console.log(`\n!! 감사 개수가 실측(${total})과 다른 곳 ${wrong.length}건:`);
  for (const w of wrong) console.log(`   - ${w}`);
  sync = false;
} else {
  console.log(`\n   감사 개수 ${total} — 문서·코드 ${hits}곳 전부 일치`);
}

process.exit(fail || !sync || !constOk ? 1 : 0);
