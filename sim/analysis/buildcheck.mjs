// 표적마다 **직접 구성한** 최적 덱이 서로 다른가.
//
// 무작위 덱 150개 중 최강을 고르는 방식은 12장을 28종에서 뽑는 공간(3천만 가지)을
// 거의 못 훑는다. 표적별로 탐욕 + 교체 개선으로 덱을 짓고 교차 검증한다.
//   챔피언 구성: 훈련 시드 / 교차 행렬: 검증 시드 (§1.5)
import * as L from '../lib.mjs';
import { TARGETS, TARGET_KEYS, applyTarget, resetTarget } from '../core/targets.mjs';
const { run, cloneKit, TOOLKIT, DECK_SIZE, SEED, pct, f, mean } = L;

const evalDeck = (deck, opts, n, base) => {
  let ok = 0;
  for (let i=0;i<n;i++) if (run(cloneKit(deck), base+i, 'assign', opts).status==='success') ok++;
  return ok/n;
};

// 탐욕 구성: 빈 덱에서 가장 많이 올려주는 카드를 하나씩 추가 → 교체 개선
function buildDeck(key) {
  const opts = applyTarget(key);
  const deck = [];
  const rest = () => TOOLKIT.filter(t => !deck.includes(t));
  while (deck.length < DECK_SIZE) {
    let best=null, bv=-1;
    for (const t of rest()) {
      const v = evalDeck([...deck, t], opts, 200, SEED.TRAIN);
      if (v > bv) { bv=v; best=t; }
    }
    deck.push(best);
  }
  for (let pass=0; pass<2; pass++) {
    for (let i=0;i<deck.length;i++) {
      let bv = evalDeck(deck, opts, 300, SEED.TRAIN), best=null;
      for (const t of rest()) {
        const alt = [...deck]; alt[i]=t;
        const v = evalDeck(alt, opts, 300, SEED.TRAIN);
        if (v > bv) { bv=v; best=t; }
      }
      if (best) deck[i]=best;
    }
  }
  return deck.map(t=>({...t}));
}

console.log('\n══ 표적별 덱 직접 구성 ══\n');
const decks = {};
for (const k of TARGET_KEYS) {
  decks[k] = buildDeck(k);
  const types = {}; for (const t of decks[k]) types[t.type]=(types[t.type]||0)+1;
  const st = { dec:0, eva:0, inf:0 };
  for (const t of decks[k]) { st.dec+=t.dec; st.eva+=t.eva; st.inf+=t.inf; }
  const tot = st.dec+st.eva+st.inf;
  console.log(`  ${TARGETS[k].name.padEnd(12)} ${TARGETS[k].line}`);
  console.log(`    유형 ${Object.entries(types).map(([a,b])=>a+b).join('/')}` +
    ` · 평균소음 ${f(mean(decks[k].map(t=>t.noise)),2)}` +
    ` · 스탯비중 D${pct(st.dec/tot)} E${pct(st.eva/tot)} I${pct(st.inf/tot)}`);
  console.log(`    ${decks[k].map(t=>t.name).join(', ')}\n`);
}
resetTarget();

console.log('══ 교차 행렬 (검증 시드) ══\n');
const M = {};
for (const d of TARGET_KEYS) { M[d] = {};
  for (const t of TARGET_KEYS) M[d][t] = evalDeck(decks[d], applyTarget(t), 2500, SEED.TEST); }
resetTarget();
console.log('  덱＼표적    ' + TARGET_KEYS.map(n=>n.padStart(9)).join(''));
for (const d of TARGET_KEYS)
  console.log('  ' + d.padEnd(10) +
    TARGET_KEYS.map(t => (d===t?`[${pct(M[d][t])}]`:pct(M[d][t])).padStart(9)).join(''));

let wins=0; const gaps=[];
for (const t of TARGET_KEYS) {
  const top = TARGET_KEYS.map(d=>[d,M[d][t]]).sort((a,b)=>b[1]-a[1])[0][0];
  if (top===t) wins++;
  gaps.push(M[t][t] - mean(TARGET_KEYS.filter(d=>d!==t).map(d=>M[d][t])));
}
const avg = TARGET_KEYS.map(d=>[d, mean(TARGET_KEYS.map(t=>M[d][t]))]).sort((a,b)=>b[1]-a[1]);
console.log(`\n  전용 덱이 1위인 표적: ${wins}/${TARGET_KEYS.length}`);
console.log(`  홈 어드밴티지 평균: ${f(mean(gaps)*100,1)}pp`);
console.log(`  만능 덱 격차: ${pct(avg[0][1]-avg[avg.length-1][1])}` +
            ` (최강 ${avg[0][0]} ${pct(avg[0][1])} / 최약 ${avg[avg.length-1][0]} ${pct(avg[avg.length-1][1])})`);

const J=(a,b)=>{const A=new Set(a.map(x=>x.name)),B=new Set(b.map(x=>x.name));
  return [...A].filter(x=>B.has(x)).length/new Set([...A,...B]).size;};
const ps=[]; for(let i=0;i<TARGET_KEYS.length;i++)for(let j=i+1;j<TARGET_KEYS.length;j++)
  ps.push(J(decks[TARGET_KEYS[i]],decks[TARGET_KEYS[j]]));
console.log(`  덱 간 카드 겹침: 평균 ${pct(mean(ps))} 최대 ${pct(Math.max(...ps))}`);
console.log(`\n  ${wins>=4 && mean(gaps)>0.08 ? '✓ 표적마다 정답 덱이 다르다 → 덱빌딩 성립'
                                              : '✗ 차별화 부족'}\n`);
