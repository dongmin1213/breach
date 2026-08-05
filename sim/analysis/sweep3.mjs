// 소음 가격 정합 스윕 — 조건부 측정.
//
// ⚠️ 실험 설계 주의: 성공률이 천장(>90%)에 붙어 있으면 소음 곡선이 눌려서
//    "소음 가격이 공정하다"는 착시가 생긴다. 조합마다 **먼저 요구치를 이분탐색으로
//    55% 에 맞춘 뒤** 곡선을 재야 비교가 성립한다.
import * as L from '../lib.mjs';
import { rebuild } from '../core/tools.mjs';
const { CONFIG, run, std, cloneKit, makeTool, SEED, pct, f } = L;

const baseReq = JSON.parse(JSON.stringify(CONFIG.LAYER));
const setReq = m => { for (const k of Object.keys(baseReq))
  CONFIG.LAYER[k].req = baseReq[k].req.map(x => x*m); };

const winAt = (m, n=1200) => { setReq(m); return std(n,'assign',SEED.TRAIN).winRate; };

// 요구치 배율을 이분탐색해 목표 승률에 맞춘다
function calibrate(target = 0.55) {
  let lo = 0.8, hi = 2.2;
  for (let i=0;i<9;i++) { const mid=(lo+hi)/2; (winAt(mid) > target) ? lo=mid : hi=mid; }
  return (lo+hi)/2;
}

// ⚠️ 동일 툴 8장 덱은 저항이 상한까지 쌓여 어느 소음이든 못 뚫는다 (측정 바닥).
//    현실적 툴킷 7장 + 시험 툴 1장으로 **한계 기여**를 잰다.
//    소음 가격이 공정하면 시험 툴의 "손에 들어왔을 때 실제 사용률"이 소음과 무관해야 한다.
const CONTROL = ['preattack','packet_mask','badge_clone','port_scan','side_channel','mitm','privesc'];
function noiseCurve(n = 2500) {
  return [0,1,2,3,4].map(nz => {
    const test = makeTool('시험툴','정예','우회',[45,45,45],nz);
    const k = [...CONTROL.map(x=>({...L.byName(x)})), test];
    let held=0, played=0;
    for (let t=0;t<n;t++) {
      const seed = SEED.TRAIN+t, r = L.rng(seed);
      const s0 = L.newRun(cloneKit(k), r, {});
      if (!s0.hand.some(c=>c.name==='시험툴')) continue;
      held++;
      const s = L.playOut(s0, L.make('assign',r), r, L.defaultGear);
      if (L.layerLog(s).some(l=>l.tool==='시험툴')) played++;
    }
    return held ? played/held : 0;
  });
}

const rows = [];
for (const nb of [8, 12, 16, 20, 24])
  for (const ns of [3.0, 4.5, 6.0]) {
    CONFIG.NOISE_BUDGET = nb; CONFIG.NOISE_SCALE = ns; rebuild();
    const rm = calibrate();
    const w = std(3000,'assign');
    const cur = noiseCurve();
    rows.push({ nb, ns, rm, win: w.winRate, share: w.noiseShare, cur,
                spread: Math.max(...cur)-Math.min(...cur) });
  }
rows.sort((a,b)=>a.spread-b.spread);
console.log(' NB   NS  요구배율 | 성공률 소음비중  소음곡선(n0..n4)          스프레드');
for (const r of rows)
  console.log(`  ${String(r.nb).padStart(2)}  ${f(r.ns,1)}    ${f(r.rm,3)} | ${pct(r.win).padStart(6)} ${pct(r.share).padStart(7)}  ${r.cur.map(x=>pct(x).padStart(6)).join('')}  ${pct(r.spread)}`);
