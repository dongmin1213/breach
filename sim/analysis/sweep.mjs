// (NOISE_SCALE, SHORTFALL, req 배율) 조대 보정 스윕
// 목표: 성공률 ~55%, 소음 비중 ~45~55% (비용 축이 실질적으로 작동)
import * as L from '../lib.mjs';
const { CONFIG, kit, run, layerLog, buildTarget, rng, score, SEED, pct, f } = L;

const baseReq = JSON.parse(JSON.stringify(CONFIG.LAYER));
const setReq = m => { for (const k of Object.keys(baseReq))
  CONFIG.LAYER[k].req = baseReq[k].req.map(x => x*m); };

function probe(n = 4000, bot = 'assign') {
  let ok=0, noise=0, short=0, cnt=0, tot=0;
  for (let i=0;i<n;i++) {
    const s = run(kit('표준'), SEED.TRAIN+i, bot);
    if (s.status==='success') ok++;
    tot += score(s);
    for (const l of layerLog(s)) { noise += l.noise; short += l.short*CONFIG.SHORTFALL; cnt++; }
  }
  return { win: ok/n, noiseShare: noise/(noise+short||1), exp: tot/n,
           noise: noise/cnt, short: short/cnt };
}

const rows = [];
for (const ns of [5.5, 6.0, 6.5, 7.0])
  for (const sf of [0.85, 0.95, 1.05])
    for (const rm of [1.00, 1.03, 1.06, 1.09]) {
      CONFIG.NOISE_SCALE = ns; CONFIG.SHORTFALL = sf; setReq(rm);
      const p = probe();
      rows.push({ ns, sf, rm, ...p,
        // 목표와의 거리: 승률 55%, 소음비중 50%
        d: Math.abs(p.win-0.55)/0.10 + Math.abs(p.noiseShare-0.50)/0.15 });
    }
rows.sort((a,b)=>a.d-b.d);
console.log('  NS   SF   REQ | 성공률  소음비중  기대점수  (소음/미달 계층당)');
for (const r of rows.slice(0,14))
  console.log(`  ${f(r.ns,1)}  ${f(r.sf,2)}  ${f(r.rm,2)} | ${pct(r.win).padStart(6)}  ${pct(r.noiseShare).padStart(7)}  ${f(r.exp,0).padStart(7)}   ${f(r.noise,1)}/${f(r.short,1)}`);
