// 표적 원형을 늘리면 덱빌딩이 되는가?
//
// 판정 기준: 원형마다 **정답 덱이 달라야** 한다.
//   한 덱이 모든 원형에서 통하면 표적을 100개 만들어도 스킨일 뿐이다.
//   (이전 프로젝트가 죽은 방식 — 겉만 다르고 최적해가 하나)
//
// 방법: 원형마다 무작위 덱 N개 중 최강을 찾고, 그 챔피언들을 전 원형에 교차 투입.
//       행렬이 대각 우세면 성립, 균일하면 실패.
import * as L from '../lib.mjs';
const { CONFIG, run, score, newRun, playOut, make, defaultGear,
        rng, SEED, TOOLKIT, cloneKit, mean, sd, pct, f } = L;

import { TARGETS, TARGET_KEYS, applyTarget, resetTarget } from '../core/targets.mjs';
const ARCHETYPES = Object.fromEntries(TARGET_KEYS.map(k => [k, {
  desc: TARGETS[k].line,
  apply(){ applyTarget(k); },
  layers: TARGETS[k].layerCount,
}]));
const restore = resetTarget;

const randKit = seed => L.randKit(seed);   // 덱 크기는 lib 의 DECK_SIZE 를 따른다

// ⚠️ 훈련/검증 시드 분리 (§1.5). 120개 중 최대값을 고르는 것은 노이즈를 고르는 것이기도 하다.
//    n=300 에서 se≈2.9pp 이므로 최대값은 6~9pp 부풀려진다 — 홈 어드밴티지와 같은 크기다.
//    챔피언은 훈련 시드로 뽑고, 교차 행렬은 검증 시드로 평가해야 결론이 산다.
const evalKit = (kit, opts, n=500, base=SEED.TEST) => {
  let ok=0;
  for (let i=0;i<n;i++) if (run(cloneKit(kit), base+i, 'assign', opts).status==='success') ok++;
  return ok/n;
};

// ── 1. 원형마다 챔피언 덱 찾기
const POOL = Array.from({length:150}, (_,k)=>randKit(900000+k));
const champs = {};
console.log('\n══ 원형별 최적 덱 탐색 (무작위 덱 120개 중 최강) ══\n');
for (const [name, A] of Object.entries(ARCHETYPES)) {
  restore(); A.apply();
  const opts = A.layers ? { layerCount: A.layers } : {};
  let best=null, bv=-1;
  POOL.forEach((k,i)=>{ const w=evalKit(k,opts,600,SEED.TRAIN); if(w>bv){bv=w;best=i;} });
  champs[name] = { idx:best, home:bv };
  const kit = POOL[best];
  const types = {}; for (const t of kit) types[t.type]=(types[t.type]||0)+1;
  const noise = mean(kit.map(t=>t.noise));
  console.log(`  ${name.padEnd(16)} ${A.desc}`);
  console.log(`    챔피언 성공률 ${pct(bv)} · 유형 ${Object.entries(types).map(([k,v])=>k+v).join('/')} · 평균소음 ${f(noise,1)}`);
  console.log(`    ${kit.map(t=>t.name).join(', ')}\n`);
}
restore();

// ── 2. 교차 검증: 각 챔피언을 전 원형에 투입
console.log('══ 교차 행렬 — 세로: 덱, 가로: 표적 ══\n');
const names = Object.keys(ARCHETYPES);
const M = {};
for (const dn of names) {
  M[dn] = {};
  for (const tn of names) {
    restore(); ARCHETYPES[tn].apply();
    const opts = ARCHETYPES[tn].layers ? { layerCount: ARCHETYPES[tn].layers } : {};
    M[dn][tn] = evalKit(POOL[champs[dn].idx], opts, 3000, SEED.TEST);
  }
}
restore();

const short = n => (TARGETS[n]?.name ?? n).slice(0,6);
console.log('  덱＼표적      ' + names.map(n=>short(n).padStart(9)).join(''));
for (const dn of names) {
  const row = names.map(tn => {
    const v = M[dn][tn];
    const isHome = dn===tn;
    return (isHome ? `[${pct(v)}]` : pct(v)).padStart(9);
  }).join('');
  console.log('  ' + short(dn).padEnd(12) + row);
}

// ── 3. 판정
console.log('\n══ 판정 ══\n');
let diagWins = 0, gaps = [];
for (const tn of names) {
  const col = names.map(dn => [dn, M[dn][tn]]).sort((a,b)=>b[1]-a[1]);
  const winner = col[0][0];
  if (winner === tn) diagWins++;
  gaps.push(M[tn][tn] - mean(names.filter(d=>d!==tn).map(d=>M[d][tn])));
  console.log(`  ${short(tn).padEnd(7)} 최강 덱: ${short(winner).padEnd(7)}` +
    `${winner===tn?' ✓ 전용 덱이 1위':'   ✗ 다른 원형 덱이 더 강함'}`);
}
console.log(`\n  전용 덱이 1위인 원형: ${diagWins}/${names.length}`);
console.log(`  홈 어드밴티지 평균: ${f(mean(gaps)*100,1)}pp`);

// 한 덱이 전 원형을 지배하는가
const overall = names.map(dn => [dn, mean(names.map(tn=>M[dn][tn]))]).sort((a,b)=>b[1]-a[1]);
console.log(`\n  전 원형 평균 최강 덱: ${short(overall[0][0])} ${pct(overall[0][1])}`);
console.log(`  전 원형 평균 최약 덱: ${short(overall[overall.length-1][0])} ${pct(overall[overall.length-1][1])}`);
console.log(`  → 만능 덱 격차: ${pct(overall[0][1]-overall[overall.length-1][1])}`);

const verdict = diagWins >= 3 && mean(gaps) > 0.05;
console.log(`\n  ${verdict ? '✓ 표적 원형이 서로 다른 덱을 요구한다 → 덱빌딩 성립'
                          : '✗ 한 덱이 두루 통한다 → 표적을 늘려도 스킨'}`);
console.log('');
