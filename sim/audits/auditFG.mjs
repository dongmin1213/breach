// ══════════════════════════════════════════════════════════════
//  F 그룹 (246–285) — 봇 품질 · 정책 반증
//  G 그룹 (286–320) — 런 구조 (계층 수 · 손패 · 정찰 · 장비)
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
const { Audit, rng, kit, run, std, randKit, score, CONFIG, SEED, TOOLKIT, TYPES, LADDER,
        buildTarget, layerLog, newRun, resolveLayer, playOut, make, defaultGear, noGear,
        byName, scoreOf, noiseOf, makeTool, cloneKit, marginal, useGear,
        versusRaw, mean, sd, se, ci95, f, pct } = L;

const F = new Audit('F 봇 품질 · G 런 구조', 245);

// ══════ F 그룹 (246–285) ══════════════════════════════════════
{
  const rows = LADDER.map(b => [b, std(4000, b)]);
  F.info('사다리', rows.map(([b,x])=>`${b} ${pct(x.winRate)}/${f(x.expScore,0)}`).join('  '));
  let mono = true;
  for (let i=1;i<rows.length;i++) if (rows[i][1].expScore < rows[i-1][1].expScore - 10) mono = false;
  F.check('사다리가 기대점수에서 단조', mono, rows.map(([,x])=>f(x.expScore,0)).join('<'));
  let monoW = true;
  for (let i=1;i<rows.length;i++) if (rows[i][1].winRate < rows[i-1][1].winRate - 0.02) monoW = false;
  F.check('사다리가 승률에서도 단조', monoW, rows.map(([,x])=>pct(x.winRate)).join('<'));
}
{
  // 인접 단계 정면 비교
  const bad = [];
  for (let i=1;i<LADDER.length;i++) {
    let hi=0, lo=0;
    for (let j=0;j<1200;j++) {
      const seed=SEED.TEST+j, layers=buildTarget(rng(seed));
      const a = score(run(randKit(seed), seed, LADDER[i],   {layers}));
      const b = score(run(randKit(seed), seed, LADDER[i-1], {layers}));
      if (a>b) hi++; else if (b>a) lo++;
    }
    const r = hi/(hi+lo||1);
    if (r < 0.50) bad.push(`${LADDER[i]}vs${LADDER[i-1]} ${pct(r)}`);
  }
  F.check('인접 단계 정면 비교에서 상위가 우세', bad.length===0, bad.join(' ') || '전부 우세');
}
{
  // 후회(regret): 최상위 봇이 놓친 최선수의 크기
  let regret=[], n=0;
  for (let i=0;i<800;i++) {
    const seed=SEED.TEST+i, r=rng(seed);
    let s = newRun(randKit(seed), r, {});
    while (s.status==='running') {
      const Lx = s.layers[s.layerIdx];
      if (Lx.type==='RECON') { s = resolveLayer(s, null, r); continue; }
      if (!s.hand.length) { s = resolveLayer(s, null, r); continue; }
      const chosen = make('counter')(s);
      const outs = s.hand.map(c => { const rr=rng(seed*13+5);
        const a = resolveLayer(s, c, rr);
        return [c, score(a.status==='running' ? playOut(a, make('assign'), rr, defaultGear) : a)]; });
      const best = Math.max(...outs.map(o=>o[1]));
      const got = outs.find(o=>o[0]===chosen)?.[1] ?? 0;
      regret.push(best-got); n++;
      s = resolveLayer(s, chosen, r);
    }
  }
  F.info('최상위 봇의 평균 후회', `${f(mean(regret),1)}점 (완벽수 비율 ${pct(regret.filter(x=>x<1).length/n)})`);
  F.check('최상위 봇의 후회가 작음 (평균 <120점)', mean(regret) < 120, f(mean(regret),1));
  F.check('최상위 봇이 아직 완벽하지 않음 (개선 여지 존재)', mean(regret) > 1, f(mean(regret),1));
}
{
  // 정책 반증 1: 장비 정책
  const alt1 = s => { if(!s.gear.length) return null;
    const x=s.layers[s.layerIdx]; return (!x||x.type==='RECON')?null:s.gear[0]; };
  const alt2 = s => { if(!s.gear.length) return null;
    const x=s.layers[s.layerIdx];
    if (!x||x.type==='RECON') return null;
    const rest = s.layers.slice(s.layerIdx).filter(l=>l.type!=='RECON').length;
    return rest <= 2 ? s.gear[0] : null;          // 끝까지 아꼈다가 마지막에
  };
  const runWith = (pol, n=3000) => { let t=0;
    for (let i=0;i<n;i++){ const seed=SEED.TEST+i, r=rng(seed);
      t += score(playOut(newRun(randKit(seed),r,{}), make('assign',r), r, pol)); }
    return t/n; };
  const cur = runWith(defaultGear), a1 = runWith(alt1), a2 = runWith(alt2), none = runWith(noGear);
  F.info('장비 정책 비교', `현행 ${f(cur,0)} · 즉시사용 ${f(a1,0)} · 후반보관 ${f(a2,0)} · 미사용 ${f(none,0)}`);
  F.check('현행 장비 정책이 모든 대안보다 우세', cur>a1 && cur>a2 && cur>none,
    `${f(cur,0)} vs ${f(Math.max(a1,a2,none),0)}`);
}
{
  // 정책 반증 2: 배정 순서를 뒤집은 대안 계획 봇
  const revAssign = () => s => {
    const rest = s.layers.slice(s.layerIdx).filter(l=>l.type!=='RECON');
    if (!s.hand.length) return null;
    const Lx = rest[0];
    // 요구치가 가장 낮은 계층에 최선 카드를 주는 (틀린) 발상
    return s.hand.reduce((b,c)=> noiseOf(c,Lx,s) < noiseOf(b,Lx,s) ? c : b);
  };
  let cur=0, alt=0;
  for (let i=0;i<3000;i++) {
    const seed=SEED.TEST+i, layers=buildTarget(rng(seed));
    const r1=rng(seed), r2=rng(seed);
    cur += score(playOut(newRun(randKit(seed),r1,{layers}), make('assign',r1), r1, defaultGear));
    alt += score(playOut(newRun(randKit(seed),r2,{layers}), revAssign(), r2, defaultGear));
  }
  F.check('현행 계획 봇이 소음최소 단순봇보다 우세', cur>alt, `${f(cur/3000,0)} vs ${f(alt/3000,0)}`);
}
{
  // 봇 결정론
  let same=0;
  for (let i=0;i<500;i++) {
    const a = run(randKit(SEED.TEST+i), SEED.TEST+i, 'counter');
    const b = run(randKit(SEED.TEST+i), SEED.TEST+i, 'counter');
    if (JSON.stringify(a.log)===JSON.stringify(b.log)) same++;
  }
  F.check('최상위 봇이 완전 결정론적', same===500, `${same}/500`);
}
{
  // 봇 사다리가 난이도 전 구간에서 유지되는가
  const bk = JSON.parse(JSON.stringify(CONFIG.LAYER));
  const bad = [];
  for (const m of [0.85, 1.00, 1.10]) {
    for (const k of Object.keys(bk)) CONFIG.LAYER[k].req = bk[k].req.map(x=>x*m);
    // 극단 난이도에서는 바닥 효과로 순서가 뭉갠다. 허용 오차를 표본 오차 수준으로.
    const w = ['thrifty','assign','deep'].map(b=>std(3000,b).winRate);
    if (!(w[0]<=w[1]+0.025 && w[1]<=w[2]+0.025)) bad.push(`×${f(m,2)} ${w.map(pct).join('<')}`);
  }
  for (const k of Object.keys(bk)) CONFIG.LAYER[k].req = bk[k].req;
  F.check('사다리가 난이도 전 구간에서 유지', bad.length===0, bad.join(' ') || '유지');
}
{
  // 봇이 특정 툴에 과의존하지 않는가 (봇 편향 검사)
  const x = std(6000,'assign'), y = std(6000,'counter');
  const div = (a,b) => { const ks = new Set([...Object.keys(a),...Object.keys(b)]);
    const sa = Object.values(a).reduce((p,q)=>p+q,0), sb = Object.values(b).reduce((p,q)=>p+q,0);
    return Math.max(...[...ks].map(k=>Math.abs((a[k]||0)/sa-(b[k]||0)/sb))); };
  F.info('assign vs counter 툴 선호 최대 괴리', pct(div(x.toolUse,y.toolUse)));
  F.check('두 봇의 툴 선호가 크게 다르지 않음 (<12%p)', div(x.toolUse,y.toolUse) < 0.12,
    pct(div(x.toolUse,y.toolUse)));
}

// ══════ G 그룹 (286–320) ══════════════════════════════════════
{
  // 계층 수 5/6/7 이 각각 다른 게임인가
  const rows = [5,6,7].map(n => {
    let ok=0, tr=0;
    for (let i=0;i<3000;i++) {
      const seed=SEED.TEST+i;
      const s = run(randKit(seed), seed, 'assign', { layerCount:n });
      if (s.status==='success') ok++; tr += s.trace;
    }
    return [n, ok/3000, tr/3000];
  });
  F.info('계층 수별 (성공률/평균흔적)', rows.map(([n,w,t])=>`${n}층 ${pct(w)}/${f(t,1)}`).join('  '));
  F.check('계층 수가 난이도를 실제로 바꿈 (5층 vs 7층 >6%p)',
    Math.abs(rows[0][1]-rows[2][1]) > 0.06, pct(Math.abs(rows[0][1]-rows[2][1])));
  // 계층 수는 의도된 난이도 축이다. 7층이 어려운 것은 설계대로이며,
  // 문제는 "승산이 없는가" 뿐이다.
  F.check('모든 계층 수가 플레이 가능 (전부 15~88%)',
    rows.every(r=>r[1]>0.15 && r[1]<0.88), rows.map(r=>pct(r[1])).join(' '));
}
{
  // 손패 여유(HAND_EXTRA)가 최적값인가
  const bk = CONFIG.HAND_EXTRA;
  const rows = [0,1,2,3].map(v => { CONFIG.HAND_EXTRA=v;
    const x = std(2500,'assign');
    // 결정 레버리지도 같이 본다
    let lev=[], n=0;
    for (let i=0;i<300;i++) {
      const seed=SEED.TEST+i, r=rng(seed);
      let s = newRun(randKit(seed), r, {});
      while (s.status==='running') {
        const Lx=s.layers[s.layerIdx];
        if (Lx.type==='RECON'){s=resolveLayer(s,null,r);continue;}
        if (!s.hand.length){s=resolveLayer(s,null,r);continue;}
        if (s.hand.length>1) {
          const outs = s.hand.map(c=>{const rr=rng(seed*7+3);
            const a=resolveLayer(s,c,rr);
            return score(a.status==='running'?playOut(a,make('assign'),rr,defaultGear):a);});
          lev.push(Math.max(...outs)-Math.min(...outs)); n++;
        }
        s = resolveLayer(s, make('assign')(s), r);
      }
    }
    return [v, x.winRate, mean(lev)];
  });
  CONFIG.HAND_EXTRA = bk;
  F.info('손패 여유별 (성공률/레버리지)', rows.map(([v,w,l])=>`+${v} ${pct(w)}/${f(l,0)}`).join('  '));
  F.check('손패 여유가 성능에 단조 영향', rows[0][1] <= rows[3][1], `+0 ${pct(rows[0][1])} → +3 ${pct(rows[3][1])}`);
  F.check('현재값(+1)이 레버리지를 죽이지 않음', rows[1][2] > rows[0][2]*0.8,
    `+0 ${f(rows[0][2],0)} vs +1 ${f(rows[1][2],0)}`);
}
{
  // 정찰 계층 수가 의미 있는가
  const bk = CONFIG.RECON_COUNT;
  const rows = [0,1,2,3].map(v => { CONFIG.RECON_COUNT=v; return [v, std(2500,'assign').winRate]; });
  CONFIG.RECON_COUNT = bk;
  F.info('정찰 계층 수별 성공률', rows.map(([v,w])=>`${v}개 ${pct(w)}`).join(' '));
  F.check('정찰 계층이 실제 이득 (0개 vs 2개)', rows[2][1] > rows[0][1],
    `${pct(rows[0][1])} → ${pct(rows[2][1])}`);
  // 정찰 계층은 툴을 안 내고 넘어가므로 "계층 하나를 공짜로 통과"하는 효과가 겹친다.
  // 순수 장비 이득만 보려면 계층 수를 고정하고 비교해야 한다.
  let g0=0, g2=0;
  for (let i=0;i<2500;i++) {
    const seed=SEED.TEST+i;
    if (run(randKit(seed), seed,'assign',{ gear:false }).status==='success') g0++;
    if (run(randKit(seed), seed,'assign').status==='success') g2++;
  }
  F.info('장비 사용/미사용 (정찰 계층 수는 동일)', `미사용 ${pct(g0/2500)} vs 사용 ${pct(g2/2500)}`);
  // 정찰 계층 2개 = 장비 2개다. 런 하나에서 장비 2개가 30%p 안팎을 바꾸는 건 설계대로다.
  // 문제는 "장비 없이는 승산이 없는가" 뿐이다.
  F.check('장비 없이도 승산이 있음 (미사용 성공률 >20%)', g0/2500 > 0.20, pct(g0/2500));
  F.check('장비 순이득이 압도적이지 않음 (<40%p)', g2/2500-g0/2500 < 0.40, pct(g2/2500-g0/2500));
}
{
  // 장비 4종이 모두 쓰이는가
  const used = {}, got = {};
  for (let i=0;i<8000;i++) for (const l of run(randKit(SEED.TEST+i), SEED.TEST+i,'assign').log) {
    if (l.kind==='RECON') got[l.gear]=(got[l.gear]||0)+1;
    if (l.kind==='GEAR')  used[l.gear]=(used[l.gear]||0)+1;
  }
  const names = Object.keys(CONFIG.GEAR);
  F.info('장비 사용률 (사용/획득)', names.map(n=>`${n} ${pct((used[n]||0)/Math.max(1,got[n]||0))}`).join(' '));
  F.check('모든 장비가 실제로 사용됨 (>25%)',
    names.every(n=>(used[n]||0)/Math.max(1,got[n]||0) > 0.25),
    names.filter(n=>(used[n]||0)/Math.max(1,got[n]||0)<=0.25).join(',') || '전부 사용');
  F.check('특정 장비가 독점적이지 않음 (최고/최저 <4배)',
    Math.max(...names.map(n=>(used[n]||0)/Math.max(1,got[n]||0))) /
    Math.max(0.01,Math.min(...names.map(n=>(used[n]||0)/Math.max(1,got[n]||0)))) < 4,
    f(Math.max(...names.map(n=>(used[n]||0)/Math.max(1,got[n]||0))) /
      Math.max(0.01,Math.min(...names.map(n=>(used[n]||0)/Math.max(1,got[n]||0)))),2)+'배');
}
{
  // 장비 각각의 실측 가치
  const rows = Object.keys(CONFIG.GEAR).map(g => {
    let with_=0, without=0;
    for (let i=0;i<2000;i++) {
      const seed=SEED.TEST+i, layers=buildTarget(rng(seed));
      const r1=rng(seed), r2=rng(seed);
      const a0 = { ...newRun(randKit(seed), r1, {layers}), gear:[g] };
      with_   += score(playOut(a0, make('assign'), r1, defaultGear));
      without += score(playOut(newRun(randKit(seed), r2, {layers}), make('assign'), r2, noGear));
    }
    return [g, (with_-without)/2000];
  });
  F.info('장비별 순가치', rows.map(([g,v])=>`${g} +${f(v,0)}`).join(' '));
  F.check('모든 장비가 양의 가치', rows.every(r=>r[1]>0), rows.filter(r=>r[1]<=0).map(r=>r[0]).join(',') || '전부 양수');
  F.check('장비 가치 편차가 4배 이내',
    Math.max(...rows.map(r=>r[1]))/Math.max(1,Math.min(...rows.map(r=>r[1]))) < 4,
    f(Math.max(...rows.map(r=>r[1]))/Math.max(1,Math.min(...rows.map(r=>r[1]))),2)+'배');
}
{
  // 여유(SLACK) 파라미터가 사문화가 아닌가
  const bk = { k:CONFIG.SLACK_KEEP, c:CONFIG.SLACK_CAP };
  const rows = [0, 0.35, 0.70, 1.00].map(v => { CONFIG.SLACK_KEEP=v; return [v, std(2500,'assign').winRate]; });
  CONFIG.SLACK_KEEP = bk.k;
  F.info('SLACK_KEEP 민감도', rows.map(([v,w])=>`${v}=${pct(w)}`).join(' '));
  let mono=true; for (let i=1;i<rows.length;i++) if (rows[i][1] < rows[i-1][1]-0.01) mono=false;
  F.check('SLACK_KEEP 이 성능에 단조 영향 (사문화 아님)', mono, rows.map(r=>pct(r[1])).join('<'));
  F.check('여유가 없으면 성공률이 유의하게 낮음', rows[2][1] - rows[0][1] > 0.05,
    `0 ${pct(rows[0][1])} vs 0.70 ${pct(rows[2][1])}`);
}
{
  // 여유가 실제로 쌓이고 쓰이는가
  let built=0, used=0, n=0;
  for (let i=0;i<5000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign');
    const ls = layerLog(s); if (!ls.length) continue; n++;
    if (ls.some(l=>l.slack>1)) built++;
    if (ls.some(l=>l.absorbed>1)) used++;
  }
  F.info('여유 사용 현황', `축적된 판 ${pct(built/n)} · 흡수가 일어난 판 ${pct(used/n)}`);
  F.check('여유가 실제로 축적됨 (>40%)', built/n > 0.40, pct(built/n));
  F.check('여유가 실제로 미달을 흡수함 (>25%)', used/n > 0.25, pct(used/n));
}
{
  // 시작 흔적 이월(연속 런)이 난이도 축으로 작동하는가
  const rows = [0, 15, 30, 45].map(t => {
    let ok=0; for (let i=0;i<2000;i++)
      if (run(randKit(SEED.TEST+i), SEED.TEST+i,'assign',{trace:t}).status==='success') ok++;
    return [t, ok/2000];
  });
  F.info('시작 흔적별 성공률', rows.map(([t,w])=>`${t} ${pct(w)}`).join(' '));
  let mono=true; for (let i=1;i<rows.length;i++) if (rows[i][1] > rows[i-1][1]+0.01) mono=false;
  F.check('시작 흔적 이월이 난이도 축으로 작동', mono, rows.map(r=>pct(r[1])).join('>'));
}

process.exit(F.done() ? 1 : 0);
