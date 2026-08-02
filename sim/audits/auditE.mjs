// ══════════════════════════════════════════════════════════════
//  E 그룹 (201–245) — 툴 밸런스. 소음·권한·효과·등급·툴킷 편차.
//  전 항목을 한계 기여(대조 툴킷 7장 + 시험 툴 1장)로 잰다. §1.3
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
const { Audit, rng, kit, run, std, randKit, score, CONFIG, SEED, TOOLKIT, TYPES, STATS,
        buildTarget, layerLog, newRun, resolveLayer, playOut, make, defaultGear, byName,
        scoreOf, noiseOf, makeTool, budgetOf, cloneKit, marginal, controlBaseline,
        versusRaw, mean, sd, se, ci95, f, pct } = L;

// ⚠️ 손패가 계층+4 가 되면서 사용률의 이론적 상한이 바뀌었다.
//    채점 계층 6 / 손패 10 → 아무리 좋은 카드도 60% 이상 나올 수 없다.
//    절대 임계값(>50%)은 이 구조에서 의미가 없다. **무효과 대조 카드 대비**로 잰다.
// 효과마다 "작동할 수 있는 조건"이 다르다 (auditC.mjs 와 동일 규약).
const EFF_SPEC = {
  적응:   { shape:[80,20,20], noise:2 },
  은폐:   { shape:[45,45,45], noise:3 },
  과부하: { shape:[45,45,45], noise:3 },
};
const specFor = e => EFF_SPEC[e] ?? { shape:[45,45,45], noise:2 };
const shapeFor = e => specFor(e).shape;
const E = new Audit('E 툴 밸런스', 200);
const BASE = std(8000, 'assign');
const CTRL = controlBaseline(4000);
E.info('대조 툴킷 기준 성공률', pct(CTRL));

// ── 201~212 소음 가격 ─────────────────────────────────────────
{
  const rs = [0,1,2,3,4].map(n => marginal(makeTool('N'+n,'정예','우회',[45,45,45],n), 5000));
  const use = rs.map(r=>r.useRate), win = rs.map(r=>r.winWithHeld);
  E.info('소음별 사용률', use.map((x,i)=>`n${i} ${pct(x)}`).join(' '));
  E.info('소음별 보유시 성공률', win.map((x,i)=>`n${i} ${pct(x)}`).join(' '));
  // 벤치 도입 후 사용률은 상황 선택의 결과다. 공정성 판정은 성능으로만 한다.
  E.info('소음별 사용률(참고)', use.map((x,i)=>`n${i} ${pct(x)}`).join(' '));
  E.check('소음 성능 스프레드 <15%p', Math.max(...win)-Math.min(...win) < 0.15,
    pct(Math.max(...win)-Math.min(...win)));
  const refN = marginal(makeTool('REF','정예','우회',[45,45,45],2), 3000).useRate;
  E.check('모든 소음 수준이 대조 대비 60% 이상 사용',
    Math.min(...use) > refN*0.6, `${pct(Math.min(...use))} vs 기준 ${pct(refN*0.6)}`);
}
{
  // 소음 가격(NOISE_BUDGET)이 사문화 파라미터가 아닌가
  const bk = CONFIG.NOISE_BUDGET;
  const rows = [0, 12, 24, 36].map(v => {
    CONFIG.NOISE_BUDGET = v; L.rebuild();
    const rs = [0,4].map(n => marginal(makeTool('N'+n,'정예','우회',[45,45,45],n), 2000).winWithHeld);
    return [v, rs[0], rs[1]];
  });
  CONFIG.NOISE_BUDGET = bk; L.rebuild();
  E.info('NOISE_BUDGET 민감도 (무소음 vs 소음4)',
    rows.map(([v,a,b])=>`${v}: ${pct(a)}/${pct(b)}`).join('  '));
  E.check('NOISE_BUDGET 이 고소음 툴의 가치를 실제로 좌우',
    rows[3][2] > rows[0][2] + 0.10, `0일때 ${pct(rows[0][2])} → 36일때 ${pct(rows[3][2])}`);
  E.check('현재 값이 균형점 근처 (무소음/소음4 격차 <12%p)',
    Math.abs(rows[2][1]-rows[2][2]) < 0.12, pct(Math.abs(rows[2][1]-rows[2][2])));
}
{
  // 계층 TRACE 계수가 소음 배치 문제를 실제로 만드는가
  const loud = makeTool('LOUD','정예','우회',[45,45,45],4);
  let onQuiet=0, onLoud=0, n=0;
  for (let i=0;i<4000;i++) {
    const seed=SEED.TEST+i, r=rng(seed);
    const k = [...L.CONTROL7.map(x=>({...byName(x)})), {...loud, name:'시험툴'}];
    const s = playOut(newRun(k, r, {}), make('assign',r), r, defaultGear);
    for (const l of layerLog(s)) if (l.tool==='시험툴') {
      n++; if (l.type==='PHYSICAL') onQuiet++; if (l.type==='NETWORK') onLoud++;
    }
  }
  E.info('고소음 툴이 놓인 계층', `조용한 PHYSICAL ${pct(onQuiet/n)} vs 시끄러운 NETWORK ${pct(onLoud/n)}`);
  E.check('고소음 툴이 TRACE 계수 낮은 계층으로 배치됨 (배치 판단이 존재)',
    onQuiet/n > onLoud/n, `${pct(onQuiet/n)} > ${pct(onLoud/n)}`);
}
{
  // 은폐가 고소음 툴에서 실제로 값을 하는가
  const a = marginal(makeTool('A','정예','우회',[45,45,45],3), 3000);
  const b = marginal(makeTool('B','정예','우회',[45,45,45],3,{effect:'은폐'}), 3000);
  E.info('소음3 툴의 은폐 유무', `무 ${pct(a.winWithHeld)} vs 은폐 ${pct(b.winWithHeld)}`);
  E.check('은폐가 고소음 툴에서 유의미한 이득', b.winWithHeld > a.winWithHeld,
    `+${f((b.winWithHeld-a.winWithHeld)*100,1)}pp`);
}

// ── 213~224 권한 라인 ─────────────────────────────────────────
{
  const acc = marginal(makeTool('ACC','정예','우회',[45,45,45],1,{priv:2}), 4000);
  const plain = marginal(makeTool('P','정예','우회',[45,45,45],1), 4000);
  const spend = marginal(makeTool('SP','정예','우회',[45,45,45],1,{priv:-1}), 4000);
  E.info('권한 툴 한계 기여',
    `축적 ${pct(acc.winWithHeld)} / 무관 ${pct(plain.winWithHeld)} / 소비 ${pct(spend.winWithHeld)}`);
  E.check('권한 축적 툴이 무관 툴만큼 사용됨', acc.useRate > plain.useRate*0.8,
    `${pct(acc.useRate)} vs 기준 ${pct(plain.useRate*0.8)}`);
  E.check('권한 소비 툴이 무관 툴만큼 사용됨', spend.useRate > plain.useRate*0.8,
    `${pct(spend.useRate)} vs 기준 ${pct(plain.useRate*0.8)}`);
  E.check('권한 툴이 무관 툴 대비 ±8%p 이내',
    Math.abs(acc.winWithHeld-plain.winWithHeld) < 0.08 &&
    Math.abs(spend.winWithHeld-plain.winWithHeld) < 0.08,
    `축적 ${f((acc.winWithHeld-plain.winWithHeld)*100,1)}pp 소비 ${f((spend.winWithHeld-plain.winWithHeld)*100,1)}pp`);
}
{
  // 권한이 실제로 쌓이고 쓰이는가
  const dist = [0,0,0,0,0,0,0];
  let spent=0, runs=0;
  for (let i=0;i<6000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i, 'assign');
    runs++;
    const ls = layerLog(s);
    dist[Math.min(6, Math.max(0, ...ls.map(l=>l.priv)))]++;
    for (let j=1;j<ls.length;j++) if (ls[j].priv===0 && ls[j-1].priv>0) { spent++; break; }
  }
  E.info('런 최고 권한 분포', dist.map((v,i)=>`${i} ${pct(v/runs)}`).join(' '));
  E.check('권한이 실제로 쌓이는 판이 존재 (>25%)',
    dist.slice(1).reduce((a,b)=>a+b,0)/runs > 0.25, pct(dist.slice(1).reduce((a,b)=>a+b,0)/runs));
  E.check('쌓인 권한이 소비되는 판이 존재 (>10%)', spent/runs > 0.10, pct(spent/runs));
}
{
  // PRIV_MUL 민감도
  const bk = CONFIG.PRIV_MUL;
  const rows = [0, 0.20, 0.35, 0.55].map(v => {
    CONFIG.PRIV_MUL = v;
    return [v, marginal(makeTool('SP','정예','우회',[45,45,45],1,{priv:-1}), 2000).winWithHeld];
  });
  CONFIG.PRIV_MUL = bk;
  E.info('PRIV_MUL 민감도', rows.map(([v,w])=>`${v}=${pct(w)}`).join(' '));
  let mono = true; for (let i=1;i<rows.length;i++) if (rows[i][1] < rows[i-1][1]-0.02) mono=false;
  E.check('PRIV_MUL 이 소비 툴 가치에 단조 영향 (사문화 아님)', mono,
    rows.map(([,w])=>pct(w)).join('<'));
}

// ── 225~234 효과 6종 ──────────────────────────────────────────
{
  const plain = marginal(makeTool('P','정예','우회',[45,45,45],2), 5000);
  const rows = Object.keys(CONFIG.EFFECT).map(e =>
    [e, marginal(makeTool(e,'정예','우회',specFor(e).shape,specFor(e).noise,{effect:e}), 5000)]);
  E.info('무효과 기준 (소음2)', `사용률 ${pct(plain.useRate)} 성공 ${pct(plain.winWithHeld)}`);
  E.info('효과별 Δ성공률', rows.map(([e,r])=>`${e} ${f((r.winWithHeld-plain.winWithHeld)*100,1)}pp`).join(' '));
  E.info('효과별 사용률', rows.map(([e,r])=>`${e} ${pct(r.useRate)}`).join(' '));
  const d = rows.map(([,r])=>r.winWithHeld-plain.winWithHeld);
  E.check('쓸모없는 효과 없음 (−8%p 이내)', Math.min(...d) > -0.08,
    `${rows[d.indexOf(Math.min(...d))][0]} ${f(Math.min(...d)*100,1)}pp`);
  E.check('압도적 효과 없음 (+8%p 이내)', Math.max(...d) < 0.08,
    `${rows[d.indexOf(Math.max(...d))][0]} ${f(Math.max(...d)*100,1)}pp`);
  const REF = {}; for (const e of Object.keys(CONFIG.EFFECT))
    REF[e] = marginal(makeTool('R_'+e,'정예','우회',specFor(e).shape,specFor(e).noise), 3000);
  const d2 = rows.map(([e,r]) => [e, r.winWithHeld - REF[e].winWithHeld]);
  E.info('효과별 Δ성공률 (같은 조건 대비)', d2.map(([e,v])=>`${e} ${f(v*100,1)}pp`).join(' '));
  const relUse = rows.map(([e,r]) => [e, r.useRate / Math.max(0.01, REF[e].useRate)]);
  E.info('효과별 상대 사용률 (같은 형태 무효과 카드 = 1.0)',
    relUse.map(([e,v])=>`${e} ${f(v,2)}`).join(' '));
  E.check('모든 효과가 같은 형태 무효과 카드의 50% 이상 사용',
    Math.min(...relUse.map(r=>r[1])) > 0.5,
    `${relUse.reduce((a,b)=>a[1]<b[1]?a:b)[0]} ${f(Math.min(...relUse.map(r=>r[1])),2)}`);
}
{
  // 효과 비용(EFFECT_COST)이 사문화 파라미터가 아닌가 — 과부하로 검사
  const bk = CONFIG.EFFECT_COST.과부하;
  const rows = [0, 20, 40].map(v => {
    CONFIG.EFFECT_COST.과부하 = v;
    return [v, marginal(makeTool('O','정예','우회',[45,45,45],2,{effect:'과부하'}), 2000).winWithHeld];
  });
  CONFIG.EFFECT_COST.과부하 = bk;
  E.info('EFFECT_COST 민감도 (과부하)', rows.map(([v,w])=>`${v}=${pct(w)}`).join(' '));
  E.check('효과 비용이 성능에 단조 영향', rows[0][1] > rows[2][1],
    `${pct(rows[0][1])} > ${pct(rows[2][1])}`);
}
{
  // 백도어 = 요구치 판정 우회. 실제로 미달 페널티를 0 으로 만드는지 확인한다.
  let byp = 0, plays = 0;
  for (let i=0;i<4000;i++) {
    const seed=SEED.TEST+i, r=rng(seed);
    const k = [...L.CONTROL7.map(x=>({...byName(x)})), {...byName('루트킷'), name:'시험툴'}];
    const s = playOut(newRun(k, r, {}), make('assign',r), r, defaultGear);
    for (const l of layerLog(s)) if (l.tool==='시험툴') { plays++; if (l.short === 0) byp++; }
  }
  E.info('백도어 우회', `${byp}/${plays} 회에서 미달 페널티 0`);
  E.check('백도어가 항상 요구치 판정을 우회', plays===0 || byp===plays, `${byp}/${plays}`);
}

// ── 235~240 등급 ──────────────────────────────────────────────
{
  const rows = ['기본','정예','전설'].map(g =>
    [g, marginal(makeTool(g,g,'우회',[45,45,45],2), 4000)]);
  E.info('등급별 균형형 성능', rows.map(([g,r])=>`${g} ${pct(r.winWithHeld)}`).join(' '));
  const w = rows.map(([,r])=>r.winWithHeld);
  E.check('등급 간 성능 격차가 8%p 이내 (등급 = 파워가 아님)',
    Math.max(...w)-Math.min(...w) < 0.08, pct(Math.max(...w)-Math.min(...w)));
  // 등급의 진짜 차이는 개별 상한 = 극단 모양을 만들 수 있는가
  const ext = ['기본','정예','전설'].map(g => {
    const t = makeTool('X',g,'우회',[100,1,1],2);
    return [g, Math.max(t.dec,t.eva,t.inf)];
  });
  E.info('등급별 극단 모양의 최고 스탯', ext.map(([g,v])=>`${g} ${v}`).join(' '));
  E.check('등급이 높을수록 더 극단적인 모양 가능 (설계 자유도)',
    ext[0][1] < ext[1][1] && ext[1][1] < ext[2][1], ext.map(e=>e[1]).join('<'));
}
{
  // 전 전설 툴킷이 전 기본 툴킷을 압도하지 않는가
  // ⚠️ 실제 툴에서 3종씩 골라 비교하면 등급이 아니라 **그 3종의 스탯 형태**를 재게 된다.
  //    (전설 3종은 전부 균형형, 기본 3종은 전부 특화형이라 특화형이 이긴다.)
  //    등급만 다르고 형태·소음·유형이 동일한 덱을 합성해서 비교한다.
  const shapes = [[80,20,20],[20,80,20],[20,20,80]];
  const mk = g => { const k=[];
    for (let i=0;i<8;i++) k.push(makeTool(g+i, g, TYPES[i%3], shapes[i%3], 2));
    return k; };
  const v = versusRaw(mk('전설'), mk('기본'), 4000);
  E.info('전설덱 vs 기본덱 (형태·소음·유형 동일 통제)', pct(v.rate));
  // DESIGN §6: 등급은 파워가 아니라 설계 자유도 → 기대값은 압승이 아니라 호각
  E.check('등급이 파워가 아님 — 전설덱이 기본덱과 호각 (45~60%)',
    v.rate>0.45 && v.rate<0.60, pct(v.rate));
}

// ── 241~245 툴킷 편차 (M8) ────────────────────────────────────
{
  const rates = [];
  for (let k=0;k<300;k++) {
    const kk = randKit(400000+k);
    let ok=0; for (let t=0;t<400;t++) if (run(cloneKit(kk), SEED.TEST+t,'assign').status==='success') ok++;
    rates.push(ok/400);
  }
  rates.sort((a,b)=>a-b);
  E.info('무작위 툴킷 300개 성공률',
    `최저 ${pct(rates[0])} p10 ${pct(rates[30])} 중앙 ${pct(rates[150])} p90 ${pct(rates[270])} 최고 ${pct(rates[299])}`);
  E.check('승산 없는 툴킷이 없음 (최저 >20%)', rates[0] > 0.20, pct(rates[0]));
  E.check('자동 승리 덱이 없음 (최고 <90%)', rates[299] < 0.90, pct(rates[299]));
  // §1.5: 400개 검사에서 경계 ±2pp 이탈은 노이즈로 취급한다.
  E.check('중앙 80% 구간 폭 <37%p', rates[270]-rates[30] < 0.37, pct(rates[270]-rates[30]));
  E.info('툴킷 성공률 σ', pct(sd(rates)));
  // 툴킷 강도의 예측 가능성 — 특정 툴 보유가 성공률을 얼마나 설명하는가
  const held = {}; const perf = {};
  for (let k=0;k<300;k++) { const kk = randKit(400000+k);
    for (const t of new Set(kk.map(x=>x.name))) { (held[t] ??= []).push(rates[k]); } }
  const lift = Object.entries(held).map(([n,v])=>[n, mean(v)-mean(rates)]).sort((a,b)=>b[1]-a[1]);
  E.info('툴 보유의 성공률 리프트 (상위3/하위3)',
    lift.slice(0,3).map(([n,v])=>`${n} +${f(v*100,1)}`).join(' ') + ' | ' +
    lift.slice(-3).map(([n,v])=>`${n} ${f(v*100,1)}`).join(' '));
  E.check('단일 툴이 툴킷 강도를 지배하지 않음 (리프트 <10%p)',
    Math.max(...lift.map(x=>Math.abs(x[1]))) < 0.10,
    `${lift[0][0]} +${f(lift[0][1]*100,1)}pp`);
}

process.exit(E.done() ? 1 : 0);
