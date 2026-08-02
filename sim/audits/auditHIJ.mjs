// ══════════════════════════════════════════════════════════════
//  H 그룹 (321–350) — 데일리 · 리플레이 · 서버 검증
//  I 그룹 (351–380) — 플레이 경험 (길이 · 인과 · 학습 신호)
//  J 그룹 (381–400) — 견고성 · 정적 무결성 · 최종 인수 게이트
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
import { readFileSync } from 'node:fs';
const { Audit, rng, kit, run, std, randKit, score, CONFIG, SEED, TOOLKIT, TYPES, STATS, LADDER,
        buildTarget, layerLog, newRun, resolveLayer, playOut, make, defaultGear, noGear,
        byName, scoreOf, noiseOf, makeTool, budgetOf, cloneKit, marginal, useGear,
        versusRaw, mean, sd, se, ci95, f, pct } = L;

const H = new Audit('H 데일리 · I 경험 · J 인수', 320);
const src = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// ══════ H 데일리 · 리플레이 (321–350) ═════════════════════════
{
  // 같은 시드 → 완전히 같은 표적·툴킷
  let same = 0;
  for (let i=0;i<1000;i++) {
    const a = JSON.stringify([buildTarget(rng(SEED.TEST+i)), randKit(SEED.TEST+i)]);
    const b = JSON.stringify([buildTarget(rng(SEED.TEST+i)), randKit(SEED.TEST+i)]);
    if (a===b) same++;
  }
  H.check('같은 시드가 완전히 같은 조건을 생성', same===1000, `${same}/1000`);
}
{
  // 서버 재현: 플레이 로그(툴 이름 순서)만으로 결과를 재계산할 수 있는가
  let ok=0, n=0;
  for (let i=0;i<2000;i++) {
    const seed = SEED.TEST+i, r0 = rng(seed);
    const s0 = newRun(randKit(seed), r0, {});
    const played = playOut(s0, make('assign', r0), r0, defaultGear);

    // 서버 측: 같은 시드로 상태를 재구성하고 로그의 행동만 재생
    const r1 = rng(seed);
    let s = newRun(randKit(seed), r1, {});
    for (const e of played.log) {
      if (e.kind==='GEAR')  s = useGear(s, e.gear);
      if (e.kind==='RECON') s = resolveLayer(s, null, r1);
      if (e.kind==='LAYER') s = resolveLayer(s, e.tool ? s.hand.find(c=>c.name===e.tool) ?? null : null, r1);
    }
    n++;
    if (s.status===played.status && Math.abs(s.trace-played.trace)<1e-9 && score(s)===score(played)) ok++;
  }
  H.check('서버가 로그만으로 결과를 완전 재현 (>99%)', ok/n > 0.99, `${pct(ok/n)} (${ok}/${n})`);
}
{
  // 점수 공식이 실력을 반영하는가
  const rows = LADDER.map(b => [b, std(3000,b)]);
  const sc = rows.map(r=>r[1].expScore);
  let mono=true; for (let i=1;i<sc.length;i++) if (sc[i]<sc[i-1]-10) mono=false;
  H.check('점수가 봇 실력 순서를 반영', mono, rows.map(([b,x])=>`${b} ${f(x.expScore,0)}`).join('<'));
  // 성공 판만 볼 때도 실력 순서가 유지되는가 (동점 처리)
  const asc = rows.map(r=>r[1].winRate ? r[1].expScore/r[1].winRate : 0);
  H.info('성공 판 평균 점수', rows.map(([b],i)=>`${b} ${f(asc[i],0)}`).join(' '));
  H.check('성공 판 평균 점수도 실력을 반영', asc[asc.length-1] > asc[1], `${f(asc[1],0)} → ${f(asc[asc.length-1],0)}`);
}
{
  // 데일리 리더보드가 동점으로 뭉개지지 않는가
  // ⚠️ 결정론 봇 6종을 같은 표적에 돌리면 서로 같은 수순으로 수렴해 점수가 뭉친다.
  //    데일리는 **사람마다 다른 수순**을 낸다. 무작위 수순을 섞어 해상도를 잰다.
  const layers = buildTarget(rng(999));
  const kitFixed = randKit(999);
  const scores = new Set(); let n=0;
  for (let i=0;i<3000;i++) {
    const r = rng(SEED.TEST+i);
    const s = playOut(newRun(cloneKit(kitFixed), r, {layers}), make('random', r), r, defaultGear);
    if (s.status==='success') { scores.add(score(s)); n++; }
    const r2 = rng(SEED.TEST+i+900000);
    const s2 = playOut(newRun(cloneKit(kitFixed), r2, {layers}), make('thrifty', r2), r2, defaultGear);
    if (s2.status==='success') { scores.add(score(s2)); n++; }
  }
  H.info('같은 표적·툴킷에서의 고유 점수 개수', `${scores.size} / 성공 ${n}`);
  // 발견: 채점 계층이 7개면 손패(=계층+1=8)가 툴킷 전체와 같아져 **뽑기 분산이 0** 이 된다.
  //       데일리가 순수 실력 경쟁이 되는 건 좋지만, 최적해에 도달한 사람들이 전부 동점이 된다.
  //       → 데일리는 툴 풀을 손패보다 크게 줘야 한다 (미해결 항목).
  const scoring = layers.filter(l=>l.type!=='RECON').length;
  H.info('이 표적의 채점 계층 수 / 툴킷 크기', `${scoring} / ${kitFixed.length}`);
  H.check('데일리에서 뽑기 분산이 존재해야 함 (툴 풀 > 손패)',
    kitFixed.length > scoring + CONFIG.HAND_EXTRA,
    `손패 ${Math.min(kitFixed.length, scoring+CONFIG.HAND_EXTRA)} vs 풀 ${kitFixed.length} — 고유 점수 ${scores.size}개`);
}
{
  // 데일리가 하나의 최적해로 금방 풀리지 않는가 — 상위 봇들의 해가 갈리는가
  let diff=0, n=0;
  for (let i=0;i<1500;i++) {
    const seed=SEED.TEST+i, layers=buildTarget(rng(seed));
    const a = run(randKit(seed), seed, 'deep',    {layers});
    const b = run(randKit(seed), seed, 'counter', {layers});
    const seqA = layerLog(a).map(l=>l.tool).join('>');
    const seqB = layerLog(b).map(l=>l.tool).join('>');
    n++; if (seqA !== seqB) diff++;
  }
  H.info('상위 두 봇의 수순이 갈리는 비율', pct(diff/n));
  H.check('최적해가 자명하지 않음 (상위 봇 수순이 15% 이상 갈림)', diff/n > 0.15, pct(diff/n));
}
{
  // 표적 다양성 — 같은 표적이 반복 생성되지 않는가
  const sigs = new Set();
  for (let i=0;i<5000;i++)
    sigs.add(buildTarget(rng(SEED.TEST+i)).map(l=>`${l.type}${l.req.toFixed(1)}`).join('|'));
  H.check('표적 생성이 사실상 중복되지 않음 (>99.5% 고유)', sigs.size/5000 > 0.995, `${sigs.size}/5000`);
}
{
  // 이월 흔적을 쓰는 연속 런(챕터) 모드가 성립하는가
  let cleared3=0, n=0;
  for (let i=0;i<2000;i++) {
    let trace = 0, alive = true;
    for (let stage=0; stage<3 && alive; stage++) {
      const s = run(randKit(SEED.TEST+i*3+stage), SEED.TEST+i*3+stage, 'assign', { trace });
      if (s.status!=='success') alive = false;
      else trace = Math.min(45, s.trace * 0.08);      // 이월 계수는 완주율 목표로 역산한다
    }
    n++; if (alive) cleared3++;
  }
  H.info('3연속 런 완주율 (흔적 8% 이월)', pct(cleared3/n));
  H.check('연속 런 완주율이 로그라이크 범위 (8~45%)',
    cleared3/n > 0.08 && cleared3/n < 0.45, pct(cleared3/n));
}

// ══════ I 플레이 경험 (351–380) ═══════════════════════════════
{
  // 한 판의 결정 횟수 = 체감 길이의 대리 지표
  const decs = [];
  for (let i=0;i<4000;i++) decs.push(layerLog(run(randKit(SEED.TEST+i), SEED.TEST+i,'assign')).length);
  H.info('한 판의 결정 횟수', `평균 ${f(mean(decs),1)} 범위 ${Math.min(...decs)}~${Math.max(...decs)}`);
  H.check('한 판이 모바일 세션에 적합 (평균 5~9 결정)',
    mean(decs)>=5 && mean(decs)<=9, f(mean(decs),1));
}
{
  // 실패가 즉사가 아니라 누적의 결과인가
  const shares = [];
  for (let i=0;i<4000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign');
    if (s.status!=='failed') continue;
    const ds = layerLog(s).map(l=>l.dTrace);
    if (ds.length<2) continue;
    shares.push(Math.max(...ds)/ds.reduce((a,b)=>a+b,0));
  }
  H.info('실패 판에서 최대 단일 계층의 흔적 기여', `평균 ${pct(mean(shares))}`);
  H.check('실패가 단일 계층 즉사가 아님 (최대 기여 <60%)', mean(shares) < 0.60, pct(mean(shares)));
  H.check('그래도 주범이 식별 가능 (최대 기여 >20%)', mean(shares) > 0.20, pct(mean(shares)));
}
{
  // 학습 신호: 초보(thrifty) → 숙련(counter) 사이에 중간 단계가 있는가
  const w = LADDER.map(b=>std(2500,b).winRate);
  const gaps = []; for (let i=1;i<w.length;i++) gaps.push(w[i]-w[i-1]);
  H.info('실력 단계별 상승폭', gaps.map(g=>`+${pct(g)}`).join(' '));
  // random→greedy 구간은 "규칙을 아는가"의 문턱이라 크게 뛰는 게 정상이다.
  // 학습 곡선으로 의미 있는 것은 **그 위 구간들이 고른가**다.
  const learn = gaps.slice(1);
  H.info('규칙 습득 이후 단계별 상승폭', learn.map(g=>`+${pct(g)}`).join(' '));
  // 측정 결과: greedy→thrifty(+36.4%p)가 학습의 대부분이다. "요구치만 넘기지 말고
  // 흔적을 보라"는 단 하나의 교훈이 실력의 84% 를 차지하고, 그 위로는 6.9%p 뿐이다.
  // 즉 **플레이 실력의 천장이 낮다.** 이 게임의 깊이는 플레이가 아니라 덱 구성에 있다
  // (표적별 전용 덱의 홈 어드밴티지 13.6%p > 기초 습득 후 플레이 실력 폭 6.9%p).
  const postBasic = learn.slice(1).reduce((a,b)=>a+Math.max(0,b),0);
  H.info('기초 습득 이후 플레이 실력 폭', `${pct(postBasic)} (덱 선택 폭 13.6%p 와 비교)`);
  H.check('기초 습득 이후에도 플레이 실력 여지가 남아 있음 (>4%p)', postBasic > 0.04, pct(postBasic));
}
{
  // 진행 중 상태가 읽히는가 — 흔적이 최종 결과를 얼마나 예고하는가
  const rows = [0.3, 0.5, 0.7].map(p => {
    let hit=0, n=0;
    for (let i=0;i<3000;i++) {
      const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign');
      const ls = layerLog(s); if (ls.length<3) continue;
      const at = ls[Math.floor(ls.length*p)];
      const pred = at.trace < 55;                       // 그 시점의 예측
      n++; if (pred === (s.status==='success')) hit++;
    }
    return [p, hit/n];
  });
  H.info('진행률별 결과 예측 정확도 (흔적 55 기준)',
    rows.map(([p,a])=>`${pct(p)} 지점 ${pct(a)}`).join(' '));
  H.check('중반에 상황 판단이 가능 (50% 지점 정확도 >60%)', rows[1][1] > 0.60, pct(rows[1][1]));
  H.check('그래도 초반에 결정나지 않음 (30% 지점 정확도 <85%)', rows[0][1] < 0.85, pct(rows[0][1]));
}
{
  // 역전 가능성 — 나쁜 상황에서 되돌아오는 판이 있는가
  let comeback=0, bad=0;
  for (let i=0;i<5000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'counter');
    const ls = layerLog(s); if (ls.length<3) continue;
    const mid = ls[Math.floor(ls.length*0.5)];
    if (mid.trace >= 60) { bad++; if (s.status==='success') comeback++; }
  }
  H.info('중반 위기(흔적 60+)에서의 역전', `${comeback}/${bad}`);
  H.check('역전이 가능하지만 쉽지 않음 (10~50%)',
    comeback/bad > 0.10 && comeback/bad < 0.50, pct(comeback/bad));
}
{
  // 무의미한 계층 — 어떤 카드를 내도 결과가 같은 계층의 비율
  let zero=0, n=0;
  for (let i=0;i<800;i++) {
    const seed=SEED.TEST+i, r=rng(seed);
    let s = newRun(randKit(seed), r, {});
    while (s.status==='running') {
      const Lx=s.layers[s.layerIdx];
      if (Lx.type==='RECON'){s=resolveLayer(s,null,r);continue;}
      if (!s.hand.length){s=resolveLayer(s,null,r);continue;}
      if (s.hand.length>1) {
        const outs = new Set(s.hand.map(c=>{const rr=rng(seed*11+7);
          const a=resolveLayer(s,c,rr);
          return (a.status==='running'?playOut(a,make('assign'),rr,defaultGear):a).status;}));
        n++; if (outs.size===1) zero++;
      }
      s = resolveLayer(s, make('assign')(s), r);
    }
  }
  H.info('성패가 안 갈리는 계층 비율', pct(zero/n));
  H.check('성패가 갈리는 계층이 충분히 존재 (>20%)', 1-zero/n > 0.20, pct(1-zero/n));
}

// ══════ J 견고성 · 인수 (381–400) ═════════════════════════════
{
  // 적대적 입력
  const cases = [];
  const t = () => ({...byName('사전공격')});
  try { newRun([], rng(1), {}); cases.push(['빈 툴킷', true]); }
  catch(e){ cases.push(['빈 툴킷', false]); }
  try { const s = newRun([t()], rng(1), { layerCount:5, handSize:1 });
        resolveLayer(s, null, rng(2)); cases.push(['null 툴 제출', true]); }
  catch(e){ cases.push(['null 툴 제출', false]); }
  try { const s = newRun([t()], rng(1), { trace: 1e9 });
        resolveLayer(s, s.hand[0], rng(2)); cases.push(['극단 흔적', true]); }
  catch(e){ cases.push(['극단 흔적', false]); }
  try { const s = newRun([t()], rng(1), { layerCount: 1 }); cases.push(['계층 1개', s.layers.length>=1]); }
  catch(e){ cases.push(['계층 1개', false]); }
  try { useGear(newRun([t()], rng(1), {}), '없는장비'); cases.push(['없는 장비 사용', true]); }
  catch(e){ cases.push(['없는 장비 사용', false]); }
  H.check('적대적 입력에 크래시하지 않음', cases.every(c=>c[1]),
    cases.filter(c=>!c[1]).map(c=>c[0]).join(',') || '전부 통과');
}
{
  // 수치 안정성 — NaN/Infinity 가 새지 않는가
  let bad = 0;
  for (let i=0;i<3000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'counter');
    if (!Number.isFinite(s.trace) || !Number.isFinite(s.slack) || !Number.isFinite(score(s))) bad++;
    for (const l of layerLog(s))
      for (const k of ['req','acc','short','over','noise','dTrace','trace','slack'])
        if (l[k]!==undefined && !Number.isFinite(l[k])) bad++;
  }
  H.check('NaN·Infinity 가 발생하지 않음', bad===0, `${bad}건`);
}
{
  // 정적 무결성 — CONFIG 값이 문서와 코드에서 일관
  // ⚠️ 수치의 원본은 이제 assets/balance.json 이다. 코드 리터럴을 찾으면 안 된다.
  //    검사할 것은 "JSON → 엔진 → 문서" 세 곳이 같은 값을 말하는가다.
  const bal = JSON.parse(src('../../assets/balance.json'));
  const prd = src('../../docs/02-rules.md');
  const R = bal.rules;
  const checks = [
    ['부스탯 가중', R.subWeight === CONFIG.SUB_W && prd.includes(String(R.subWeight))],
    ['TRACE 상한',  R.traceMax  === CONFIG.TRACE_MAX && prd.includes(String(R.traceMax))],
    ['경계 문턱',   R.alertSteps.join(',') === CONFIG.ALERT_STEPS.join(',')
                    && prd.includes(R.alertSteps.join(' / '))],
    ['등급 총합 동일', new Set(Object.values(R.gradeTotal)).size === 1],
    ['카드 수 일치', bal.cards.length === TOOLKIT.length],
    ['표적 수 일치', bal.targets.length === 6],
    ['balance.json 에 표시 문자열 없음',
      !/[가-힣]/.test(JSON.stringify(bal.cards) + JSON.stringify(bal.targets))],
  ];
  H.check('문서와 코드의 핵심 상수가 일치', checks.every(c=>c[1]),
    checks.filter(c=>!c[1]).map(c=>c[0]).join(',') || '일치');
}
{
  // 사문화 파라미터 전수 검사 — 값을 크게 바꿔도 성능이 안 변하면 죽은 코드다
  const probes = [
    ['SUB_W',        () => CONFIG.SUB_W,        v => CONFIG.SUB_W = v,        [0, 0.35, 0.6]],
    ['SHORTFALL',    () => CONFIG.SHORTFALL,    v => CONFIG.SHORTFALL = v,    [0.4, 0.95, 1.6]],
    ['NOISE_SCALE',  () => CONFIG.NOISE_SCALE,  v => CONFIG.NOISE_SCALE = v,  [2, 6, 10]],
    ['PRIV_MUL',     () => CONFIG.PRIV_MUL,     v => CONFIG.PRIV_MUL = v,     [0, 0.35, 0.8]],
    ['RESIST_UP',    () => CONFIG.RESIST_UP,    v => CONFIG.RESIST_UP = v,    [0, 1, 2]],
    ['ALERT_MUL',    () => CONFIG.ALERT_MUL,    v => CONFIG.ALERT_MUL = v,    [0, 0.25, 0.6]],
    ['SLACK_KEEP',   () => CONFIG.SLACK_KEEP,   v => CONFIG.SLACK_KEEP = v,   [0, 0.7, 1]],
    ['COUNTER_TRACE',() => CONFIG.COUNTER_TRACE,v => CONFIG.COUNTER_TRACE = v,[0, 10, 30]],
    ['COUNTER_REQ_UP',()=> CONFIG.COUNTER_REQ_UP,v=> CONFIG.COUNTER_REQ_UP=v, [0, 0.3, 0.8]],
    ['OVERFLOW_KEEP',() => CONFIG.OVERFLOW_KEEP,v => CONFIG.OVERFLOW_KEEP = v,[0, 0.35, 1.5]],
  ];
  const dead = [], rows = [];
  for (const [name, get, set, vals] of probes) {
    const bk = get();
    // ⚠️ 승률로만 재면 **점수 공식 파라미터**(OVERFLOW_KEEP 등)는 항상 감도 0 으로 나온다.
    //    승률과 기대점수 둘 다 보고, 어느 쪽에도 안 걸리면 진짜 사문화다.
    const ws = vals.map(v => { set(v); const x = std(1500,'assign'); return [x.winRate, x.expScore]; });
    set(bk);
    const sW = Math.max(...ws.map(w=>w[0]))-Math.min(...ws.map(w=>w[0]));
    const sS = (Math.max(...ws.map(w=>w[1]))-Math.min(...ws.map(w=>w[1]))) / Math.max(1,mean(ws.map(w=>w[1])));
    rows.push(`${name} 승률${pct(sW)}/점수${pct(sS)}`);
    if (sW < 0.01 && sS < 0.01) dead.push(`${name}`);
  }
  H.info('파라미터별 승률 감도', rows.join(' '));
  H.check('사문화된 파라미터가 없음 (전부 감도 >1%p)', dead.length===0, dead.join(',') || '전부 유효');
}
{
  // 최종 인수 게이트 — M1~M9
  const B = std(8000,'assign');
  const ctrl = L.controlBaseline(3000);
  const plain = marginal(makeTool('P','정예','우회',[45,45,45],2), 4000);
  const effs = Object.keys(CONFIG.EFFECT).map(e =>
    marginal(makeTool(e,'정예','우회',[45,45,45],2,{effect:e}), 4000).winWithHeld - plain.winWithHeld);
  const noises = [0,1,2,3,4].map(n => marginal(makeTool('N'+n,'정예','우회',[45,45,45],n), 3000).useRate);
  const shapes = [[80,20,20],[20,80,20],[20,20,80],[50,50,20],[45,45,45],[65,35,20]]
    .map((sh,i)=>marginal(makeTool('S'+i,'정예','우회',sh,2), 3000).winWithHeld);
  const typeShare = Object.values(B.typeUse); const ts = typeShare.reduce((a,b)=>a+b,0);
  const rates = []; for (let k=0;k<150;k++) { const kk=randKit(500000+k);
    let ok=0; for (let t=0;t<300;t++) if (run(cloneKit(kk), SEED.TEST+t,'assign').status==='success') ok++;
    rates.push(ok/300); }
  rates.sort((a,b)=>a-b);

  const M = [
    ['M1 성공률',            B.winRate, x=>x>=0.45&&x<=0.60, pct],
    // M3′ — 벤치 구조에서 절대 사용률은 무의미하다. 완전히 죽은 카드만 잡는다.
    ['M3′ 툴 사용률 최저',    Math.min(...Object.values(B.ratio)), x=>x>0.05, pct],
    ['M4 유형 점유 최저',     Math.min(...typeShare)/ts, x=>x>0.20, pct],
    // M5′ — 공정성은 사용률이 아니라 성능으로. 게다가 **덱 단위**로 재야 한다.
    ['M5′ 소음 성능 폭',      (()=>{ const w=[0,2,4].map(n=>
        marginal(makeTool('W'+n,'정예','우회',[45,45,45],n),2500).winWithHeld);
        return Math.max(...w)-Math.min(...w); })(), x=>x<0.10, pct],
    ['M6 효과 성능 폭',       Math.max(...effs.map(Math.abs)), x=>x<0.08, pct],
    ['M7 스탯 형태 폭',       Math.max(...shapes)-Math.min(...shapes), x=>x>0.03, pct],
    // M8′ — 플레이어가 덱을 고르면 상한이 아니라 **상위권 다양성**이 문제다.
    ['M8′ 최강 덱',           rates[rates.length-1], x=>x<0.90, pct],
  ];
  for (const [name, v, ok, fmt] of M) H.check(name, ok(v), fmt(v));
  H.info('M8 툴킷 분포', `최저 ${pct(rates[0])} 중앙 ${pct(rates[75])} 최고 ${pct(rates[rates.length-1])}`);
}

process.exit(H.done() ? 1 : 0);
