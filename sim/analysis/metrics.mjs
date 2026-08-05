// M1~M10 일괄 측정 — docs/04-balance.md 의 **파레토 검사** 전용 도구.
//
// ⚠️ 지표 정의의 단일 원본은 docs/04-balance.md 다. 이 파일이 그것과 갈라지면
//    절차를 따르는 사람이 **이미 폐기된 목표에 맞춰 밸런스를 튜닝**하게 된다.
//    실제로 그랬다 — M3·M5·M9 가 옛 정의로 남아, 아무것도 안 건드린 상태에서
//    실패 3건(M3 10.8%, M5 60.0%, M9 36.4%)을 냈다. 그 셋은 전부 04 문서가
//    「지표를 재정의한 이유」 표에서 대체했다고 적어둔 것들이었다.
//
//    지표를 바꾸려면 04 문서를 먼저 고치고 여기를 맞춘다. 반대로 하지 않는다.
//
// 사용법:  변경 전 측정 → 변경 → 재측정 → 개선 ≥1 AND 악화 0 이면 적용
import * as L from '../lib.mjs';
import { TARGET_KEYS, applyTarget, resetTarget } from '../core/targets.mjs';
const { CONFIG, run, std, randKit, score, newRun, resolveLayer, playOut, make,
        defaultGear, layerLog, makeTool, cloneKit, marginal,
        rng, SEED, TOOLKIT, DECK_SIZE, mean, pct, f } = L;

const B = std(8000, 'assign');

// ── M2 결정 레버리지 — 한 수의 최선/최악 결과 점수차
let lev = [];
for (let i=0;i<700;i++) {
  const seed=SEED.TEST+i, r=rng(seed);
  let s = newRun(randKit(seed), r, {});
  while (s.status==='running') {
    const Lx=s.layers[s.layerIdx];
    if (Lx.type==='RECON'){s=resolveLayer(s,null,r);continue;}
    if (!s.hand.length){s=resolveLayer(s,null,r);continue;}
    if (s.hand.length>1) {
      const outs=s.hand.map(c=>{const rr=rng(seed*7+3); const a=resolveLayer(s,c,rr);
        return score(a.status==='running'?playOut(a,make('assign'),rr,defaultGear):a);});
      lev.push(Math.max(...outs)-Math.min(...outs));
    }
    s=resolveLayer(s, make('assign')(s), r);
  }
}

// ── M3′ 원형별 **최대** 사용률의 최저값
//    손패 = 채점계층+4 라 절대 사용률의 이론 상한이 ~60% 다. 그래서 낮은 사용률은
//    사문화가 아니라 "벤치에 앉은 선택"일 수 있다 (04 문서의 재정의 근거).
//    각 카드가 **어느 원형에서든 제 자리를 갖는가**로 본다:
//    원형별 사용률의 최대 → 그 값들의 카드 전체 최소.
const bestUse = {};
for (const k of TARGET_KEYS) {
  const r = std(1200, 'assign', SEED.TEST, applyTarget(k)).ratio;
  for (const [name, v] of Object.entries(r)) bestUse[name] = Math.max(bestUse[name] ?? 0, v);
}
resetTarget();

// ── M5′ 소음 **성능** 폭 — 사용률이 아니라 성능으로, 카드 단독이 아니라 덱 맥락에서.
//    (사용률 차이는 상황 선택이지 불공정이 아니다. 그리고 단독 덱으로 재면
//     저항 포화로 천장/바닥에 붙는다 — 대조덱 7장 + 시험툴 1장으로 잰다.)
//    소음 5단계를 전부 본다 — 양 끝만 보면 중간의 이상치를 놓친다 (regress.mjs 설계).
const noisePerf = [0,1,2,3,4].map(n =>
  marginal(makeTool('W'+n,'정예','우회',[45,45,45],n), 2500).winWithHeld);

// ── M6 효과 성능 폭 / M7 스탯 형태 폭 (같은 조건 대비)
const plain = marginal(makeTool('P','정예','우회',[45,45,45],2), 3000);
const effs = Object.keys(CONFIG.EFFECT).map(e =>
  marginal(makeTool(e,'정예','우회',[45,45,45],2,{effect:e}), 3000).winWithHeld - plain.winWithHeld);
const shapes = [[80,20,20],[20,80,20],[20,20,80],[50,50,20],[45,45,45],[65,35,20]]
  .map((sh,i)=>marginal(makeTool('S'+i,'정예','우회',sh,2), 3000).winWithHeld);

// ── M8′ 상위 8덱의 카드 겹침
//    플레이어가 덱을 고르는 게임에서는 최강 덱의 **상한**이 아니라 상위권의
//    **다양성**이 문제다. 정답이 하나면 덱빌딩이 아니다.
//    ⚠️ 순위는 훈련 시드로 매긴다 — 검증 시드로 뽑아 검증 시드로 재면
//       상위 8덱이 통째로 노이즈 선택일 수 있다 (docs/05 §4).
const cands = [];
for (let k=0;k<120;k++) {
  const d = randKit(500000+k);
  let ok=0; for (let t=0;t<200;t++) if (run(cloneKit(d), SEED.TRAIN+t,'assign').status==='success') ok++;
  cands.push({ d, w: ok/200 });
}
cands.sort((a,b)=>b.w-a.w);
const top8 = cands.slice(0,8).map(x=>x.d);
const jac = (a,b) => { const A=new Set(a.map(t=>t.id)), B2=new Set(b.map(t=>t.id));
  return [...A].filter(x=>B2.has(x)).length / new Set([...A,...B2]).size; };
const pairs=[]; for(let i=0;i<8;i++) for(let j=i+1;j<8;j++) pairs.push(jac(top8[i],top8[j]));

// ── M9′ 실패의 플레이어 귀속 (수 + 덱)
//    실패를 셋으로 가른다: 다른 수로 만회 / 다른 덱이면 성공 / 순수 운.
//    앞의 둘이 플레이어 귀속이다 — **덱 구성도 실력이다** (04 문서의 재정의 근거).
let byMove=0, byDeck=0, pureLuck=0;
for (let i=0;i<600;i++) {
  const seed=SEED.TEST+i, r0=rng(seed);
  const s0=newRun(randKit(seed),r0,{});
  if (playOut(s0,make('assign'),r0,defaultGear).status!=='failed') continue;

  let saved=false, s=s0, r=rng(seed);
  while (s.status==='running' && !saved) {
    const Lx=s.layers[s.layerIdx];
    if (Lx.type==='RECON'){s=resolveLayer(s,null,r);continue;}
    if (!s.hand.length){s=resolveLayer(s,null,r);continue;}
    const chosen=make('assign')(s);
    for (const c of s.hand) { if (c===chosen) continue;
      const rr=rng(seed*31+7); const a=resolveLayer(s,c,rr);
      if ((a.status==='running'?playOut(a,make('assign'),rr,defaultGear):a).status==='success'){saved=true;break;} }
    s=resolveLayer(s,chosen,r);
  }
  if (saved) { byMove++; continue; }

  // 같은 표적을 다른 덱으로는 뚫는가
  let deckOk=false;
  for (let k=0;k<12 && !deckOk;k++)
    if (run(randKit(900000+i*13+k), seed, 'assign', { layers:s0.layers }).status==='success') deckOk=true;
  if (deckOk) byDeck++; else pureLuck++;
}
const fails = byMove+byDeck+pureLuck;

// ── M10 표적별 전용 덱의 홈 어드밴티지
//    ⚠️ 챔피언은 **훈련 시드**로 뽑고 **검증 시드**로 교차 평가한다 (docs/05 §4).
//       같은 시드로 뽑고 평가하면 홈 어드밴티지가 통째로 선택 편향일 수 있다.
//
//    ⚠️ 챔피언을 "무작위 N개 중 최고"로 뽑으면 **풀이 커질수록 무너진다.**
//       12장을 고르는 공간이 C(50,12)/C(30,12) ≈ 10배로 커지는데 후보 수는 그대로라
//       챔피언이 챔피언이 아니게 된다. 실측 (같은 풀 50종):
//         무작위 40개 → 홈 5.4% (1위 2/6) · 무작위 200개 → 12.6% · 탐욕 → 22.9% (6/6)
//       무작위 40개 방식은 이 배치를 "차별화 붕괴"로 오판했다.
//    → 탐욕 구성으로 짓는다. 30종에서 문서 기준값(buildcheck 13.6%p)을 재현하므로
//      결과에 맞춰 고른 방식이 아니다 — 탐욕 13.1% vs 무작위40 15.7%.
//      표적 차별화의 기준 도구는 원래 buildcheck.mjs 다 (docs/03 §7).
const champ = {};
for (const k of TARGET_KEYS) {
  const opts = applyTarget(k);
  const d = [];
  while (d.length < DECK_SIZE) {
    let best=null, bv=-1;
    for (const t of TOOLKIT) {
      if (d.includes(t)) continue;
      let ok=0; for (let i=0;i<120;i++) if (run(cloneKit([...d,t]), SEED.TRAIN+i,'assign',opts).status==='success') ok++;
      if (ok/120 > bv) { bv=ok/120; best=t; }
    }
    d.push(best);
  }
  champ[k]=d.map(t=>({...t}));
}
const MX = {};
for (const d of TARGET_KEYS) { MX[d]={};
  for (const t of TARGET_KEYS) {
    const opts = applyTarget(t);
    let ok=0; for (let i=0;i<300;i++) if (run(cloneKit(champ[d]), SEED.TEST+i,'assign',opts).status==='success') ok++;
    MX[d][t]=ok/300;
  } }
resetTarget();
const gaps = TARGET_KEYS.map(t => MX[t][t] - mean(TARGET_KEYS.filter(d=>d!==t).map(d=>MX[d][t])));
const homeWins = TARGET_KEYS.filter(t =>
  TARGET_KEYS.map(d=>[d,MX[d][t]]).sort((a,b)=>b[1]-a[1])[0][0] === t).length;

const typeShare=Object.values(B.typeUse), ts=typeShare.reduce((a,b)=>a+b,0);
const M = [
  ['M1  성공률',          B.winRate,                               '45~60%', x=>x>=.45&&x<=.60, pct],
  ['M2  결정 레버리지',    mean(lev),                               '>150',   x=>x>150,          x=>f(x,0)],
  ['M3′ 원형별 최대 사용률', Math.min(...Object.values(bestUse)),     '>30%',   x=>x>.30,          pct],
  ['M4  유형 점유 최저',   Math.min(...typeShare)/ts,               '>20%',   x=>x>.20,          pct],
  ['M5′ 소음 성능 폭',     Math.max(...noisePerf)-Math.min(...noisePerf), '<10%p', x=>x<.10,     pct],
  ['M6  효과 성능 폭',     Math.max(...effs.map(Math.abs)),         '<8%p',   x=>x<.08,          pct],
  ['M7  스탯 형태 폭',     Math.max(...shapes)-Math.min(...shapes), '>3%p',   x=>x>.03,          pct],
  ['M8′ 상위 8덱 겹침',    mean(pairs),                             '<60%',   x=>x<.60,          pct],
  ['M9′ 실패의 실력 귀속',  (byMove+byDeck)/fails,                   '>70%',   x=>x>.70,          pct],
  ['M10 홈 어드밴티지',    mean(gaps),                              '>8%p',   x=>x>.08,          pct],
];
console.log('\n지표                  값      목표      판정');
for (const [n,v,g,ok,fmt] of M)
  console.log(`${n.padEnd(20)} ${fmt(v).padStart(6)}  ${g.padEnd(8)} ${ok(v)?'OK':'!!'}`);

console.log(`\n소음비중 ${pct(B.noiseShare)} · 평균흔적 ${f(B.avgTrace,1)} · 기대점수 ${f(B.expScore,0)}`);
console.log(`실패 귀속: 다른 수 ${pct(byMove/fails)} · 다른 덱 ${pct(byDeck/fails)} · 순수 운 ${pct(pureLuck/fails)} (n=${fails})`);
console.log(`전용 덱이 1위인 표적: ${homeWins}/${TARGET_KEYS.length} (탐욕 구성 챔피언)`);
console.log(`상위 8덱 승률: 최고 ${pct(cands[0].w)} 8위 ${pct(cands[7].w)}\n`);

if (M.some(([,v,,ok])=>!ok(v))) process.exitCode = 1;
