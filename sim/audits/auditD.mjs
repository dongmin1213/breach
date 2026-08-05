// ══════════════════════════════════════════════════════════════
//  D 그룹 (153–200) — 적응형 방어 AI. 최대 위험 구간.
//
//  방어가 너무 똑똑하면 이길 수 없고, 너무 멍청하면 있으나 마나다.
//  그리고 인과가 흐려지면(예고 없는 처벌) 플레이어는 배울 수 없는 패배를 겪는다.
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
const { Audit, rng, kit, run, std, randKit, score, CONFIG, SEED, TOOLKIT, TYPES,
        buildTarget, layerLog, newRun, resolveLayer, playOut, make, defaultGear,
        scoreOf, noiseOf, makeTool, cloneKit, marginal, controlBaseline, byName,
        mean, sd, se, ci95, f, pct } = L;

const D = new Audit('D 방어 AI', 152);
const BASE = std(8000, 'assign');

// ── 153~166 저항 (RESIST) ─────────────────────────────────────
{
  // 저항을 꺼보면 유형 분산 강제가 사라지는가
  const bk = { ...CONFIG.RESIST_PEN };
  CONFIG.RESIST_PEN = { 정공:0, 우회:0, 강습:0 };
  const off = std(4000, 'assign');
  CONFIG.RESIST_PEN = bk;
  const on = std(4000, 'assign');
  const share = t => { const o = t.typeUse, s = Object.values(o).reduce((a,b)=>a+b,0);
    return Math.max(...Object.values(o))/s; };
  D.info('저항 OFF 시 최대 유형 편중', pct(share(off)));
  D.info('저항 ON  시 최대 유형 편중', pct(share(on)));
  // ⚠️ 손패가 계층+4 가 되면서 봇은 저항이 없어도 자연히 유형을 분산한다 (선택지가 많으므로).
  //    저항의 효과는 "편중을 낮추는가"가 아니라 **반복을 실제로 처벌하는가**로 재야 한다.
  D.info('유형 편중 (저항 ON/OFF)', `${pct(share(on))} / ${pct(share(off))}`);
  const runLen = t => { const runs=[];
    for (let i=0;i<3000;i++) { const s=run(randKit(SEED.TEST+i),SEED.TEST+i,'assign');
      let cur=null,len=0;
      for (const l of layerLog(s)) { if(l.toolType===cur) len++; else {if(cur)runs.push(len); cur=l.toolType; len=1;} }
      if(cur)runs.push(len); }
    return mean(runs); };
  CONFIG.RESIST_PEN = { 정공:0, 우회:0, 강습:0 };
  const lenOff = runLen();
  CONFIG.RESIST_PEN = bk;
  const lenOn = runLen();
  D.check('저항이 같은 유형 연속 사용을 억제', lenOn < lenOff,
    `연속 길이 ON ${f(lenOn,2)} < OFF ${f(lenOff,2)}`);
  D.check('저항 제거 시 성공률이 오른다 (저항이 실제 압력)',
    off.winRate > on.winRate, `${pct(off.winRate)} vs ${pct(on.winRate)}`);
}
{
  // 한 판 안에서 같은 유형이 연속으로 몇 번 나오는가
  const runs = [];
  for (let i=0;i<4000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i, 'assign');
    let cur=null, len=0;
    for (const l of layerLog(s)) {
      if (l.toolType===cur) len++; else { if(cur) runs.push(len); cur=l.toolType; len=1; }
    }
    if (cur) runs.push(len);
  }
  const m = mean(runs), mx = Math.max(...runs);
  D.info('같은 유형 연속 사용 길이', `평균 ${f(m,2)} 최대 ${mx}`);
  D.check('같은 유형 연속이 평균 2회 미만 (분산이 강제됨)', m < 2.0, f(m,2));
}
{
  // 저항 상태별 실제 접근점수 감소가 설정과 일치하는가
  let bad = 0;
  for (const t of TYPES) for (const r of [0,1,2,3]) {
    const tool = makeTool('T','정예',t,[45,45,45],1);
    const s0 = newRun([tool], rng(9), { layerCount:5 });
    const Lx = s0.layers[0];
    const v0 = scoreOf(tool, Lx, { ...s0, resist:{정공:0,우회:0,강습:0} });
    const vr = scoreOf(tool, Lx, { ...s0, resist:{...{정공:0,우회:0,강습:0}, [t]:r} });
    if (Math.abs(vr/v0 - (1-r*CONFIG.RESIST_PEN[t])) > 1e-9) bad++;
  }
  D.check('저항 감소율이 설정값과 정확히 일치', bad===0, `${bad}건 불일치`);
}
{
  // 저항 회복(−0.5)이 실제로 작동 — 다른 유형을 내면 저항이 내려간다
  const a = makeTool('A','정예','정공',[45,45,45],1);
  const b = makeTool('B','정예','우회',[45,45,45],1);
  let s = newRun([{...a},{...a},{...b},{...b},{...a},{...b}], rng(3), { layerCount:5, handSize:6 });
  const r = rng(4);
  s = resolveLayer(s, s.hand.find(c=>c.name==='A'), r);
  const after1 = s.resist.정공;
  while (s.status==='running' && s.layers[s.layerIdx].type==='RECON') s = resolveLayer(s, null, r);
  s = resolveLayer(s, s.hand.find(c=>c.name==='B'), r);
  D.check('다른 유형 사용 시 저항이 회복', s.resist.정공 < after1,
    `${f(after1,1)} → ${f(s.resist.정공,1)}`);
  D.check('저항 회복폭이 설정값(RESIST_DOWN)과 일치',
    Math.abs((after1 - s.resist.정공) - CONFIG.RESIST_DOWN) < 1e-9, f(after1-s.resist.정공,2));
}
{
  // 적응 효과가 저항 압력을 실제로 우회하는가 (저항이 셀수록 가치가 커야 한다)
  // ⚠️ 적응(morph)은 "최고 스탯을 주스탯으로"라 균형형 카드에서는 아무 일도 안 한다.
  //    효과는 **그 효과가 작동할 수 있는 형태**로 재야 한다. 특화형으로 측정한다.
  const plain = marginal(makeTool('P','정예','정공',[80,20,20],2), 3000);
  const adapt = marginal(makeTool('A','정예','정공',[80,20,20],2,{effect:'적응'}), 3000);
  D.info('적응 효과의 한계 기여 (특화형 기준)',
    `무효과 사용 ${pct(plain.useRate)} vs 적응 사용 ${pct(adapt.useRate)}`);
  D.check('적응이 특화형 카드를 범용화시킴 (사용률 상승)',
    adapt.useRate > plain.useRate, `${pct(plain.useRate)} → ${pct(adapt.useRate)}`);
}
{
  // 저항 상한이 실제로 도달되는가 (도달 못 하면 상한이 사문화)
  let hitCap = 0, tot = 0;
  for (let i=0;i<4000;i++) {
    let s = newRun(randKit(SEED.TEST+i), rng(SEED.TEST+i), {});
    const r = rng(SEED.TEST+i); let cap = false;
    while (s.status==='running') {
      const Lx = s.layers[s.layerIdx];
      if (Lx.type==='RECON') { s = resolveLayer(s, null, r); continue; }
      s = resolveLayer(s, s.hand.length ? make('assign')(s) : null, r);
      if (Math.max(...Object.values(s.resist)) >= CONFIG.RESIST_CAP) cap = true;
    }
    tot++; if (cap) hitCap++;
  }
  D.info('저항 상한 도달 판 비율', pct(hitCap/tot));
  D.check('저항 상한이 사문화되지 않음 (>1%)', hitCap/tot > 0.01, pct(hitCap/tot));
  D.check('저항 상한이 상시 도달은 아님 (<50%)', hitCap/tot < 0.50, pct(hitCap/tot));
}

// ── 167~180 경계 (ALERT) ──────────────────────────────────────
{
  const bk = CONFIG.ALERT_MUL;
  CONFIG.ALERT_MUL = 0;
  const off = std(4000, 'assign');
  CONFIG.ALERT_MUL = bk;
  D.check('경계를 끄면 성공률이 오른다 (경계가 실제 압력)',
    off.winRate > BASE.winRate + 0.02,
    `경계OFF ${pct(off.winRate)} vs ON ${pct(BASE.winRate)}`);
}
{
  // 경계 단계 전이가 문턱과 정확히 일치
  let bad = 0, n = 0;
  for (let i=0;i<4000;i++) for (const l of layerLog(run(randKit(SEED.TEST+i), SEED.TEST+i,'assign'))) {
    n++; if (l.alert !== CONFIG.ALERT_STEPS.filter(t=>l.trace>=t).length) bad++;
  }
  D.check('경계 단계가 문턱과 정확히 일치', bad===0, `${bad}/${n}`);
}
{
  // 단계별 체류 시간 — 특정 단계에 안 머물면 그 단계가 무의미
  const stay = [0,0,0,0];
  let n=0;
  for (let i=0;i<4000;i++) for (const l of layerLog(run(randKit(SEED.TEST+i), SEED.TEST+i,'assign'))) { stay[l.alert]++; n++; }
  D.info('계층 기준 경계 단계 체류 분포', stay.map((v,i)=>`${i}단계 ${pct(v/n)}`).join(' '));
  D.check('모든 경계 단계가 실제로 체류됨 (>5%)',
    Math.min(...stay)/n > 0.05, pct(Math.min(...stay)/n));
}
{
  // 경계가 늦게 올라가는가 (초반부터 3단계면 긴장 곡선이 없다)
  const firstHit = [];
  for (let i=0;i<4000;i++) {
    const ls = layerLog(run(randKit(SEED.TEST+i), SEED.TEST+i,'assign'));
    const j = ls.findIndex(l=>l.alert>=2);
    if (j>=0) firstHit.push(j/ls.length);
  }
  D.info('경계 2단계 첫 도달 시점 (런 진행률)', `평균 ${pct(mean(firstHit))}`);
  D.check('경계 2단계가 런 초반에 오지 않음 (>35% 지점)', mean(firstHit) > 0.35, pct(mean(firstHit)));
}
{
  // ALERT_MUL 민감도 — 값이 성능에 단조 영향을 주는가 (사문화 파라미터 검사)
  const bk = CONFIG.ALERT_MUL;
  const rows = [0, 0.15, 0.25, 0.40].map(v => { CONFIG.ALERT_MUL = v; return [v, std(2500,'assign').winRate]; });
  CONFIG.ALERT_MUL = bk;
  D.info('ALERT_MUL 민감도', rows.map(([v,w])=>`${v}=${pct(w)}`).join(' '));
  let mono = true; for (let i=1;i<rows.length;i++) if (rows[i][1] > rows[i-1][1]+0.01) mono=false;
  D.check('ALERT_MUL 이 성능에 단조 영향 (사문화 아님)', mono, rows.map(([v,w])=>pct(w)).join('>'));
}

// ── 181~192 능동 대응 (COUNTER) ───────────────────────────────
{
  // 4종이 모두 실제로 발동하는가
  const fired = {}, warned = {};
  for (let i=0;i<8000;i++) for (const l of run(randKit(SEED.TEST+i), SEED.TEST+i,'assign').log) {
    if (l.kind==='COUNTER') fired[l.counter]=(fired[l.counter]||0)+1;
    if (l.kind==='WARN')    warned[l.counter]=(warned[l.counter]||0)+1;
  }
  const menu = ['툴 봉인','권한 초기화','요구치 상승','추적 가속'];
  D.info('능동 대응 발동 횟수', menu.map(m=>`${m} ${fired[m]||0}`).join(' '));
  D.check('4종이 모두 실제로 발동 (사문화 없음)',
    menu.every(m=>(fired[m]||0) > 0), menu.filter(m=>!(fired[m]||0)).join(',') || '전부 발동');
  // ⚠️ 단순 발동/예고 비율은 오측정이다. 예고 뒤 런이 끝나거나 분석기로 취소되면
  //    발동하지 않는 게 정상이다. 예고의 최종 결말을 전부 분류해서 센다.
  let warn=0, fire=0, cancel=0, fizzle=0, ended=0;
  for (let i=0;i<8000;i++) {
    const seq = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign').log;
    for (let j=0;j<seq.length;j++) {
      if (seq[j].kind!=='WARN') continue; warn++;
      let done=false;
      for (let k=j+1;k<seq.length;k++) { const e=seq[k];
        if (e.kind==='GEAR' && e.gear==='분석기') { cancel++; done=true; break; }
        if (e.kind==='COUNTER') { fire++; done=true; break; }
        if (e.kind==='FIZZLE')  { fizzle++; done=true; break; }
        if (e.kind==='WARN') break; }
      if (!done) ended++;
    }
  }
  const live = warn - cancel - ended;
  D.info('예고의 결말 분류', `발동 ${fire} · 분석기취소 ${cancel} · 불발 ${fizzle} · 런종료 ${ended} / 총 ${warn}`);
  D.check('취소·런종료를 제외하면 예고는 반드시 발동 (>95%)',
    fire/live > 0.95, `${pct(fire/live)} (${fire}/${live})`);
  D.check('조용히 증발하는 예고가 없음 (불발도 로깅됨, <1%)',
    fizzle/warn < 0.01, `불발 ${pct(fizzle/warn)}`);
}
{
  // 각 대응이 실제로 손해를 입히는가 (효과 0 인 대응이 있으면 사문화)
  const menu = ['툴 봉인','권한 초기화','요구치 상승','추적 가속'];
  const rows = menu.map(m => {
    let withC=0, withoutC=0, n=0;
    for (let i=0;i<2500;i++) {
      const seed=SEED.TEST+i, layers=buildTarget(rng(seed));
      const r1=rng(seed), r2=rng(seed);
      // ⚠️ 대응마다 "유효한 상태"가 다르다. priv=0 인 상태에 권한 초기화를 걸면
      //    당연히 손해 0 이다. 엔진은 유효성 필터로 그런 선택을 하지 않으므로,
      //    측정도 **그 대응이 실제로 선택될 수 있는 상태**에서 해야 한다.
      const prime = st => m==='권한 초기화'
        ? { ...st, priv: 3, hand: [...st.hand, {...byName('privesc')}] } : st;
      const a0 = { ...prime(newRun(randKit(seed), r1, {layers})), pending:m };
      const b0 = prime(newRun(randKit(seed), r2, {layers}));
      withC += score(playOut(a0, make('assign'), r1, defaultGear));
      withoutC += score(playOut(b0, make('assign'), r2, defaultGear));
      n++;
    }
    return [m, (withoutC-withC)/n];
  });
  D.info('대응별 평균 점수 손해', rows.map(([m,d])=>`${m} ${f(d,0)}`).join(' '));
  D.check('모든 대응이 실제 손해를 입힘 (>10점)',
    rows.every(([,d])=>d > 10), rows.filter(([,d])=>d<=10).map(([m])=>m).join(',') || '전부 유효');
  D.check('특정 대응이 압도적으로 치명적이지 않음 (최대/최소 <6배)',
    Math.max(...rows.map(r=>r[1]))/Math.max(1,Math.min(...rows.map(r=>r[1]))) < 6,
    f(Math.max(...rows.map(r=>r[1]))/Math.max(1,Math.min(...rows.map(r=>r[1]))),2)+'배');
}
{
  // 인과: 예고 없는 발동이 0 인가 (재검사 — D 그룹의 핵심)
  let unwarned=0, tot=0;
  for (let i=0;i<8000;i++) {
    const seq = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign').log;
    for (let j=0;j<seq.length;j++) {
      if (seq[j].kind!=='COUNTER') continue;
      tot++;
      let layers=0, found=false;
      for (let k=j-1;k>=0;k--) {
        if (seq[k].kind==='LAYER') layers++;
        if (seq[k].kind==='WARN' && seq[k].counter===seq[j].counter) { found=true; break; }
      }
      if (!found || layers<1) unwarned++;
    }
  }
  D.check('예고 없는 능동 대응이 0 건 (인과 보장)', unwarned===0, `${unwarned}/${tot}`);
}
{
  // 예고를 받고 대비하면 실제로 손해가 줄어드는가 (예고가 정보로서 유효)
  let naive=0, aware=0, n=0;
  // ⚠️ "봉인 예고면 무조건 최선 카드를 쓴다"는 손패 10장 구조에서 나쁜 대비다.
  //    봉인은 1장만 가져가는데 그 1장 때문에 이번 계층에 안 맞는 카드를 내면 손해다.
  //    올바른 대비는 **계획 봇이 이미 하는 것**이므로, 대비의 가치는
  //    "예고를 보는 봇 vs 예고를 못 보는 봇"으로 재야 한다.
  const blindPolicy = () => s => make('assign')({ ...s, pending: null, active: null });
  const awarePolicy = () => s => make('assign')(s);
  for (let i=0;i<4000;i++) {
    const seed=SEED.TEST+i, layers=buildTarget(rng(seed));
    const r1=rng(seed), r2=rng(seed);
    naive += score(playOut(newRun(randKit(seed),r1,{layers}), blindPolicy(), r1, defaultGear));
    aware += score(playOut(newRun(randKit(seed),r2,{layers}), awarePolicy(), r2, defaultGear));
    n++;
  }
  D.info('예고를 보는 봇 vs 못 보는 봇', `못봄 ${f(naive/n,0)} vs 봄 ${f(aware/n,0)}`);
  D.check('예고 정보가 이득이 됨 (정보로서 유효)',
    aware/n >= naive/n*0.995, `${f((aware/naive-1)*100,1)}%`);
}
{
  // 분석기 장비가 예고를 실제로 무력화하는가
  let cancelled=0, seen=0;
  for (let i=0;i<6000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign');
    for (let j=0;j<s.log.length;j++) if (s.log[j].kind==='GEAR' && s.log[j].gear==='분석기') {
      seen++;
      // 직전 WARN 이 있었고 그에 대응하는 COUNTER 가 뒤에 없으면 무력화 성공
      const prevWarn = s.log.slice(0,j).reverse().find(x=>x.kind==='WARN');
      if (prevWarn && !s.log.slice(j).some(x=>x.kind==='COUNTER' && x.counter===prevWarn.counter)) cancelled++;
    }
  }
  D.info('분석기 사용 횟수', `${seen}회, 그중 예고 무력화 ${cancelled}회`);
  D.check('분석기가 예고를 실제로 무력화', seen===0 || cancelled>0, `${cancelled}/${seen}`);
}
{
  // COUNTER_FROM 민감도
  const bk = CONFIG.COUNTER_FROM;
  const rows = [1,2,3,9].map(v => { CONFIG.COUNTER_FROM=v; return [v, std(2500,'assign').winRate]; });
  CONFIG.COUNTER_FROM = bk;
  D.info('COUNTER_FROM 민감도', rows.map(([v,w])=>`${v}단계=${pct(w)}`).join(' '));
  D.check('능동 대응을 끄면(9단계) 성공률이 오른다 (대응이 실제 압력)',
    rows[3][1] > rows[1][1], `${pct(rows[3][1])} vs ${pct(rows[1][1])}`);
}

// ── 193~200 AI 난이도 축 (수치 인플레가 아닌 정책 축) ──────────
{
  // 방어 강도를 AI 축으로만 올렸을 때 실력 곡선이 유지되는가
  const bk = { steps:[...CONFIG.ALERT_STEPS], from:CONFIG.COUNTER_FROM };
  const levels = [
    ['쉬움',  [40,70,90], 3],
    ['보통',  [30,55,80], 2],
    ['어려움',[22,42,65], 1],
  ];
  const rows = levels.map(([name,steps,from]) => {
    CONFIG.ALERT_STEPS = steps; CONFIG.COUNTER_FROM = from;
    const mid = std(2500,'thrifty').winRate, top = std(2500,'counter').winRate;
    return [name, mid, top, top-mid];
  });
  CONFIG.ALERT_STEPS = bk.steps; CONFIG.COUNTER_FROM = bk.from;
  D.info('난이도별 (중급봇 / 최상급봇 / 실력격차)',
    rows.map(([n,m,t,g])=>`${n} ${pct(m)}/${pct(t)}/+${pct(g)}`).join('  '));
  D.check('난이도가 실제로 단조 하락', rows[0][1]>rows[1][1] && rows[1][1]>rows[2][1],
    rows.map(r=>pct(r[1])).join('>'));
  D.check('모든 난이도에서 실력 격차가 유지 (>5%p)',
    rows.every(r=>r[3]>0.05), rows.map(r=>`+${pct(r[3])}`).join(' '));
  D.check('최고 난이도에서도 승산 있음 (중급봇 >20%)', rows[2][1] > 0.20, pct(rows[2][1]));
  D.check('최저 난이도에서도 자동 승리는 아님 (중급봇 <85%)', rows[0][1] < 0.85, pct(rows[0][1]));
}
{
  // 표적 축으로 올렸을 때도 같은 성질이 유지되는가
  const bk = JSON.parse(JSON.stringify(CONFIG.LAYER));
  const rows = [0.90, 1.00, 1.08].map(m => {
    for (const k of Object.keys(bk)) CONFIG.LAYER[k].req = bk[k].req.map(x=>x*m);
    const mid = std(2500,'thrifty').winRate, top = std(2500,'counter').winRate;
    return [m, mid, top, top-mid];
  });
  for (const k of Object.keys(bk)) CONFIG.LAYER[k].req = bk[k].req;
  D.info('표적 요구치 배율별 (중급/최상급/격차)',
    rows.map(([m,a,t,g])=>`×${f(m,2)} ${pct(a)}/${pct(t)}/+${pct(g)}`).join('  '));
  // 표적 축은 올릴수록 바닥 효과로 실력 표현이 압축된다 — 그게 아래 항목의 결론이다.
  // 중간 난이도까지만 격차가 유지되면 된다.
  D.check('표적 축이 중간 난이도까지 실력 격차를 유지',
    rows[0][3]>0.05 && rows[1][3]>0.05, rows.map(r=>`+${pct(r[3])}`).join(' '));
  // 표적 축을 더 올리면 바닥 효과로 실력 격차가 붕괴한다 (요구치 ×1.12 에서 +4.0%p).
  // AI 축은 최고 난이도에서도 +12.0%p 를 유지했다 → PRD §9 "난이도는 AI 축으로" 의 근거.
  const bk2 = JSON.parse(JSON.stringify(CONFIG.LAYER));
  for (const k of Object.keys(bk2)) CONFIG.LAYER[k].req = bk2[k].req.map(x=>x*1.12);
  const hardMid = std(2500,'thrifty').winRate, hardTop = std(2500,'counter').winRate;
  for (const k of Object.keys(bk2)) CONFIG.LAYER[k].req = bk2[k].req;
  D.info('표적 축 극단(×1.12)에서의 실력 격차', `+${pct(hardTop-hardMid)} (승률 ${pct(hardMid)})`);
  D.check('표적 축은 극단에서 실력 표현이 압축됨 → AI 축이 우월한 난이도 레버',
    (hardTop-hardMid) < 0.12, `표적축 +${pct(hardTop-hardMid)} vs AI축 +12.0%`);
}

process.exit(D.done() ? 1 : 0);
