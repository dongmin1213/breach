// M1~M9 일괄 측정 — §1.2 파레토 검사용. 변경 전후로 이걸 돌려 비교한다.
import * as L from '../lib.mjs';
const { CONFIG, run, std, randKit, score, newRun, resolveLayer, playOut, make,
        defaultGear, buildTarget, layerLog, makeTool, cloneKit, marginal,
        rng, SEED, TOOLKIT, mean, sd, pct, f } = L;

const B = std(8000, 'assign');

// M2 결정 레버리지
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

// M5 소음 공정성 / M6 효과 폭 / M7 스탯 형태
const noises = [0,1,2,3,4].map(n=>marginal(makeTool('N'+n,'정예','우회',[45,45,45],n),3000).useRate);
const plain = marginal(makeTool('P','정예','우회',[45,45,45],2),3000);
const effs = Object.keys(CONFIG.EFFECT).map(e=>
  marginal(makeTool(e,'정예','우회',[45,45,45],2,{effect:e}),3000).winWithHeld - plain.winWithHeld);
const shapes = [[80,20,20],[20,80,20],[20,20,80],[50,50,20],[45,45,45],[65,35,20]]
  .map((sh,i)=>marginal(makeTool('S'+i,'정예','우회',sh,2),3000).winWithHeld);

// M8 최강 덱
const rates=[];
for (let k=0;k<150;k++){ const kk=randKit(500000+k);
  let ok=0; for(let t=0;t<300;t++) if(run(cloneKit(kk),SEED.TEST+t,'assign').status==='success') ok++;
  rates.push(ok/300); }
rates.sort((a,b)=>a-b);

// M9 만회 가능성
let fixable=0, tot=0;
for (let i=0;i<900;i++) {
  const seed=SEED.TEST+i, r0=rng(seed);
  const s0=newRun(randKit(seed),r0,{});
  if (playOut(s0,make('assign'),r0,defaultGear).status!=='failed') continue;
  tot++;
  let s=s0, r=rng(seed), saved=false;
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
  if (saved) fixable++;
}

const typeShare=Object.values(B.typeUse), ts=typeShare.reduce((a,b)=>a+b,0);
const M = [
  ['M1 성공률',        B.winRate,                                  '45~60%',  x=>x>=.45&&x<=.60, pct],
  ['M2 결정 레버리지',  mean(lev),                                  '>150',    x=>x>150,          x=>f(x,0)],
  ['M3 툴 사용률 최저', Math.min(...Object.values(B.ratio)),         '>30%',    x=>x>.30,          pct],
  ['M4 유형 점유 최저', Math.min(...typeShare)/ts,                   '>20%',    x=>x>.20,          pct],
  ['M5 소음 사용률 폭', Math.max(...noises)-Math.min(...noises),     '<20%p',   x=>x<.20,          pct],
  ['M6 효과 성능 폭',   Math.max(...effs.map(Math.abs)),             '<8%p',    x=>x<.08,          pct],
  ['M7 스탯 형태 폭',   Math.max(...shapes)-Math.min(...shapes),     '>3%p',    x=>x>.03,          pct],
  ['M8 최강 덱',        rates[rates.length-1],                       '<80%',    x=>x<.80,          pct],
  ['M9 만회 가능',      fixable/tot,                                 '>55%',    x=>x>.55,          pct],
];
console.log('\n지표             값        목표      판정');
for (const [n,v,g,ok,fmt] of M)
  console.log(`${n.padEnd(16)} ${fmt(v).padStart(7)}  ${g.padEnd(8)} ${ok(v)?'OK':'!!'}`);
console.log(`\n소음비중 ${pct(B.noiseShare)} · 평균흔적 ${f(B.avgTrace,1)} · 기대점수 ${f(B.expScore,0)}`);
console.log(`덱 분포: 최저 ${pct(rates[0])} 중앙 ${pct(rates[75])} 최고 ${pct(rates[149])}\n`);
