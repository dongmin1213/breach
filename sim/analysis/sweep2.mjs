// NOISE_BUDGET 스윕 — 소음 가격이 맞으면 모든 툴의 "손에 들어왔을 때 실제로 내는 비율"이
// 비슷해진다. 특정 툴의 사용률이 0 에 가까우면 그 콘텐츠는 사문화된 것이다.
import * as L from '../lib.mjs';
import { rebuild } from '../core/tools.mjs';
const { CONFIG, TOOLKIT, rng, run, layerLog, score, SEED, newRun, playOut, make,
        defaultGear, buildTarget, pct, f, sd, mean } = L;

const baseReq = JSON.parse(JSON.stringify(CONFIG.LAYER));
const setReq = m => { for (const k of Object.keys(baseReq))
  CONFIG.LAYER[k].req = baseReq[k].req.map(x => x*m); };

function randKit(seed) {
  // 덱 크기는 balance.json 이 원본 (예전에는 8 로 박혀 있었다)
  return L.randKit(seed);
}

function probe(n = 3000) {
  const held = {}, played = {};
  let ok=0, noise=0, short=0, tot=0;
  for (const t of TOOLKIT) { held[t.name]=0; played[t.name]=0; }
  for (let i=0;i<n;i++) {
    const seed = SEED.TRAIN+i;
    const r = rng(seed);
    const s0 = newRun(randKit(seed), r, {});
    for (const c of s0.hand) held[c.name]++;
    const s = playOut(s0, make('assign', r), r, defaultGear);
    if (s.status==='success') ok++;
    tot += score(s);
    const seen = new Set();
    for (const l of layerLog(s)) { noise+=l.noise; short+=l.short*CONFIG.SHORTFALL;
      if (l.tool && !seen.has(l.tool)) { played[l.tool]++; seen.add(l.tool); } }
  }
  const ratio = {};
  for (const t of TOOLKIT) ratio[t.name] = held[t.name] ? played[t.name]/held[t.name] : 0;
  const rs = Object.values(ratio);
  return { win: ok/n, exp: tot/n, noiseShare: noise/(noise+short||1),
           ratio, minR: Math.min(...rs), spread: Math.max(...rs)-Math.min(...rs) };
}

const rows = [];
for (const nb of [6, 9, 12, 15, 18])
  for (const sf of [0.95, 1.15, 1.35])
    for (const rm of [1.00, 1.08, 1.16]) {
      CONFIG.NOISE_BUDGET = nb; CONFIG.SHORTFALL = sf; setReq(rm);
      rebuild();   // 툴 스탯이 NOISE_BUDGET 에 의존 → 재생성 필수
      const p = probe();
      rows.push({ nb, sf, rm, ...p, d: Math.abs(p.win-0.55)/0.10 + p.spread/0.30 });
    }
rows.sort((a,b)=>a.d-b.d);
console.log(' NB   SF  REQ | 성공률  소음비중  최저사용률  사용률폭');
for (const r of rows.slice(0,12))
  console.log(`  ${String(r.nb).padStart(2)}  ${f(r.sf,2)} ${f(r.rm,2)} | ${pct(r.win).padStart(6)}  ${pct(r.noiseShare).padStart(7)}  ${pct(r.minR).padStart(9)}  ${pct(r.spread).padStart(7)}`);
console.log('\n최상위 조합의 툴별 사용률:');
const best = rows[0];
CONFIG.NOISE_BUDGET = best.nb; CONFIG.SHORTFALL = best.sf; setReq(best.rm);
for (const [k,v] of Object.entries(best.ratio).sort((a,b)=>a[1]-b[1]))
  console.log('  ', k.padEnd(8), pct(v));
