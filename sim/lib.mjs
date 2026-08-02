// 감사 공용 유틸
import { newRun, resolveLayer, score, CONFIG, layerLog, buildTarget, useGear,
         scoreOf, noiseOf, makeTool, STATS, TYPES, SCORING } from './core/engine.mjs';
import { playOut, make, defaultGear, noGear, evalState, LADDER } from './core/bots.mjs';
import { kit, TOOLKIT, byName, PRESETS, cloneKit, rebuild } from './core/tools.mjs';
import { budgetOf } from './core/engine.mjs';

// ── 시드 고정 PRNG (mulberry32). Math.random 은 프로젝트 전역 금지.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export const SEED = { TRAIN: 1_000_000, TEST: 7_000_000 };

// ── 한 판
export function run(toolkit, seed, botName = 'assign', opts = {}) {
  const r = rng(seed);
  const s0 = newRun(toolkit, r, opts);
  return playOut(s0, make(botName, r), r, opts.gear === false ? noGear : defaultGear);
}

// ── N 판 배치
export function batch(kitName, n, botName = 'assign', base = SEED.TEST, opts = {}) {
  let ok = 0, tr = 0, sc = 0, layers = 0, shortHits = 0, scoringLayers = 0, traceFail = 0;
  const toolUse = {}, typeUse = {};
  for (let i = 0; i < n; i++) {
    const s = run(kit(kitName), base + i, botName, opts);
    if (s.status === 'success') { ok++; sc += score(s); }
    else if (s.trace >= CONFIG.TRACE_MAX) traceFail++;
    tr += s.trace; layers += s.layerIdx;
    for (const l of layerLog(s)) {
      scoringLayers++;
      if (l.tool) { toolUse[l.tool]=(toolUse[l.tool]||0)+1; typeUse[l.toolType]=(typeUse[l.toolType]||0)+1; }
      if (l.short > 0.001) shortHits++;
    }
  }
  // ⚠️ avgScore(성공 판만 평균)는 편향 통계다. 드물게 성공하고 크게 먹는 봇이 좋아 보인다.
  //    목적함수는 expScore(실패=0 포함 기댓값). 지표 비교는 반드시 이쪽으로 한다.
  return { n, winRate: ok/n, avgTrace: tr/n, expScore: sc/n, avgScore: ok ? sc/ok : 0,
           traceFail: traceFail/n, avgLayers: layers/n,
           shortRate: shortHits/scoringLayers, toolUse, typeUse, scoringLayers };
}

// ── 두 툴킷 비교: 같은 표적에 각각 도전 → 점수 높은 쪽 승
export function versus(kitA, kitB, n, botName = 'assign', base = SEED.TEST) {
  let a=0,b=0,tie=0;
  for (let i=0;i<n;i++) {
    const seed = base+i;
    const layers = buildTarget(rng(seed ^ 0x5bf03635));
    const sa = run(kit(kitA), seed, botName, { layers });
    const sb = run(kit(kitB), seed, botName, { layers });
    const x = score(sa), y = score(sb);
    if (x>y) a++; else if (y>x) b++; else tie++;
  }
  return { a:a/n, b:b/n, tie:tie/n, rate:(a+tie/2)/n };
}

// ── 임의 툴 배열끼리 비교 (프리셋이 아닌 경우)
export function versusRaw(A, B, n, botName='assign', base=SEED.TEST) {
  let a=0,b=0,tie=0;
  for (let i=0;i<n;i++) {
    const seed = base+i;
    const layers = buildTarget(rng(seed ^ 0x5bf03635));
    const x = score(run(cloneKit(A), seed, botName, { layers }));
    const y = score(run(cloneKit(B), seed, botName, { layers }));
    if (x>y) a++; else if (y>x) b++; else tie++;
  }
  return { a:a/n, b:b/n, tie:tie/n, rate:(a+tie/2)/n };
}

// ── 통계
export const pct = x => (x*100).toFixed(1)+'%';
export const f = (x,d=2) => Number(x).toFixed(d);
export const se = (p,n) => Math.sqrt(p*(1-p)/n);
export const ci95 = (p,n) => 1.96*se(p,n);
export const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
export const sd = a => { const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)**2))); };

// ── 결과 출력
export class Audit {
  constructor(title, offset = 0) { this.title=title; this.pass=0; this.fail=0; this.notes=[]; this.i=offset; }
  check(name, ok, detail='') {
    this.i++;
    console.log(`${ok?'  OK ':'  !! '}#${String(this.i).padStart(3)} ${name}${detail?' — '+detail:''}`);
    if (ok) this.pass++; else { this.fail++; this.notes.push(`#${this.i} ${name} — ${detail}`); }
    return ok;
  }
  info(name, detail) { this.i++; console.log(`  .. #${String(this.i).padStart(3)} ${name} — ${detail}`); }
  done() {
    console.log(`\n── ${this.title}: ${this.pass}/${this.pass+this.fail} 통과`+(this.fail?`, ${this.fail}건 실패`:''));
    if (this.notes.length) { console.log('   실패:'); this.notes.forEach(x=>console.log('   - '+x)); }
    return this.fail;
  }
}

export { newRun, resolveLayer, score, CONFIG, layerLog, buildTarget, useGear, scoreOf, noiseOf,
         makeTool, STATS, TYPES, SCORING, playOut, make, defaultGear, noGear, evalState, LADDER,
         kit, TOOLKIT, byName, PRESETS, cloneKit, rebuild, budgetOf };

// ── 무작위 툴킷 (§1.3 현실적 측정 조건의 기본값).
//    단일 프리셋으로 재면 그 프리셋의 특이성이 지표에 섞인다.
// 덱 크기 — assets/balance.json 이 원본.
export { DECK_SIZE } from './core/balance.mjs';
import { DECK_SIZE } from './core/balance.mjs';
export function randKit(seed, size = DECK_SIZE) {
  const r = rng(seed), p = [...TOOLKIT];
  for (let i=p.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]];}
  return p.slice(0, size).map(t=>({...t}));
}

// ── 표준 측정: 무작위 툴킷 × 무작위 표적. 주 지표는 전부 이걸로 잰다.
export function std(n = 8000, botName = 'assign', base = SEED.TEST, opts = {}) {
  let ok=0, tr=0, sc=0, noise=0, short=0, cells=0, traceFail=0;
  const toolUse={}, typeUse={}, held={}, played={};
  for (let i=0;i<n;i++) {
    const seed = base+i, r = rng(seed);
    const s0 = newRun(randKit(seed), r, opts);
    for (const c of s0.hand) held[c.name]=(held[c.name]||0)+1;
    const s = playOut(s0, make(botName, r), r, opts.gear===false ? noGear : defaultGear);
    if (s.status==='success') { ok++; sc += score(s); }
    else if (s.trace >= CONFIG.TRACE_MAX) traceFail++;
    tr += s.trace;
    const seen = new Set();
    for (const l of layerLog(s)) {
      cells++; noise += l.noise; short += l.short*CONFIG.SHORTFALL;
      if (l.tool) { toolUse[l.tool]=(toolUse[l.tool]||0)+1; typeUse[l.toolType]=(typeUse[l.toolType]||0)+1;
        if (!seen.has(l.tool)) { played[l.tool]=(played[l.tool]||0)+1; seen.add(l.tool); } }
    }
  }
  const ratio={}; for (const t of TOOLKIT) ratio[t.name] = held[t.name] ? (played[t.name]||0)/held[t.name] : 0;
  return { n, winRate:ok/n, avgTrace:tr/n, expScore:sc/n, traceFail:traceFail/n,
           noiseShare: noise/(noise+short||1), toolUse, typeUse, ratio, cells };
}

// ── 한계 기여 측정 (§1.3).
//    콘텐츠 하나의 가치를 "그것만 8장인 덱"으로 재면 저항 포화·스탯 편중 때문에
//    난이도에 따라 천장이나 바닥에 붙어 버린다. 이전 프로젝트에서 세 번 반복한 오류다.
//    대신 현실적 대조 툴킷 7장 + 시험 툴 1장으로, 그 툴의 실사용률과 성공률 기여를 잰다.
export const CONTROL7 = ['사전공격','패킷위장','배지복제','포트스캔','사이드채널','중간자','권한상승'];

export function marginal(testTool, n = 3000, botName = 'assign', base = SEED.TEST) {
  const ctrl = CONTROL7.map(x => byName(x));
  let held=0, played=0, ok=0, okHeld=0;
  for (let t=0;t<n;t++) {
    const seed = base+t, r = rng(seed);
    const k = [...ctrl.map(c=>({...c})), {...testTool, name:'시험툴'}];
    const s0 = newRun(k, r, {});
    const has = s0.hand.some(c=>c.name==='시험툴');
    const s = playOut(s0, make(botName, r), r, defaultGear);
    if (has) { held++; if (layerLog(s).some(l=>l.tool==='시험툴')) played++;
               okHeld++; if (s.status==='success') ok++; }
  }
  return { useRate: held?played/held:0, winWithHeld: okHeld?ok/okHeld:0, held };
}

// 대조 툴킷만의 기준 성공률 (시험 툴이 손에 안 들어온 판)
export function controlBaseline(n = 3000, botName='assign', base = SEED.TEST) {
  const ctrl = CONTROL7.map(x=>byName(x));
  let ok=0;
  for (let t=0;t<n;t++) {
    const seed = base+t, r = rng(seed);
    const k = [...ctrl.map(c=>({...c})), {...byName('패킷위장')}];
    if (playOut(newRun(k,r,{}), make(botName,r), r, defaultGear).status==='success') ok++;
  }
  return ok/n;
}
