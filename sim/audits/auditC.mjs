// ══════════════════════════════════════════════════════════════
//  C 그룹 (96–135) — 이중 축 (ACCESS / TRACE). 이 게임의 심장.
//
//  이전 프로젝트의 종료 사유가 "비용 축 부재로 카드 다양성이 원리적으로 불가"였다.
//  BREACH 는 TRACE 를 비용 축으로 내장해 그걸 풀었다고 주장한다.
//  이 그룹은 그 주장이 사실인지만 본다. 실패하면 4번 이하 튜닝은 무의미하다.
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
const { Audit, rng, kit, run, std, randKit, versusRaw, score, CONFIG, SEED, TOOLKIT,
        buildTarget, layerLog, newRun, resolveLayer, playOut, make, defaultGear, noGear,
        scoreOf, noiseOf, makeTool, cloneKit, mean, sd, se, ci95, f, pct } = L;

// ⚠️ 손패가 계층+4 가 되면서 사용률의 이론적 상한이 바뀌었다.
//    채점 계층 6 / 손패 10 → 아무리 좋은 카드도 60% 이상 나올 수 없다.
//    절대 임계값(>50%)은 이 구조에서 의미가 없다. **무효과 대조 카드 대비**로 잰다.
// 효과마다 "작동할 수 있는 조건"이 다르다.
//   적응(morph)  — 균형형에서는 아무 일도 안 한다 → 특화형으로
//   은폐·과부하   — 소음이 낮으면 지울 것도 두 배로 할 것도 없다 → 고소음으로
// 조건을 안 맞추고 재면 "효과가 약하다"가 아니라 "측정이 틀렸다"가 된다.
const EFF_SPEC = {
  적응:   { shape:[80,20,20], noise:2 },
  은폐:   { shape:[45,45,45], noise:3 },
  과부하: { shape:[45,45,45], noise:3 },
};
const specFor = e => EFF_SPEC[e] ?? { shape:[45,45,45], noise:2 };
const shapeFor = e => specFor(e).shape;
const C = new Audit('C 이중 축', 95);
const N = 8000;
const BASE = std(N, 'assign');

// ── 96~103 두 축이 모두 살아 있는가 ───────────────────────────
{
  C.info('기준선', `성공 ${pct(BASE.winRate)} 흔적 ${f(BASE.avgTrace,1)} 소음비중 ${pct(BASE.noiseShare)}`);
  C.check('소음이 흔적의 상당 부분을 차지 (비용 축 실재)',
    BASE.noiseShare > 0.30 && BASE.noiseShare < 0.75, pct(BASE.noiseShare));
}
{
  // 소음을 0 으로 만들면 게임이 얼마나 쉬워지는가 = 비용 축의 실질 무게
  const ns = CONFIG.NOISE_SCALE;
  CONFIG.NOISE_SCALE = 0;
  const free = std(4000, 'assign');
  CONFIG.NOISE_SCALE = ns;
  const paid = std(4000, 'assign');
  C.check('소음을 없애면 성공률이 크게 오름 (비용이 실제로 물린다)',
    free.winRate - paid.winRate > 0.10,
    `무소음 ${pct(free.winRate)} vs 유소음 ${pct(paid.winRate)} (+${pct(free.winRate-paid.winRate)})`);
}
{
  // 요구치를 0 으로 만들면? = 접근 축의 실질 무게
  const bk = JSON.parse(JSON.stringify(CONFIG.LAYER));
  for (const k of Object.keys(CONFIG.LAYER)) CONFIG.LAYER[k].req = [0,0];
  const noReq = std(4000, 'assign');
  for (const k of Object.keys(CONFIG.LAYER)) CONFIG.LAYER[k].req = bk[k].req;
  C.check('요구치를 없애면 성공률이 크게 오름 (접근 축도 실제로 물린다)',
    noReq.winRate - BASE.winRate > 0.10,
    `무요구 ${pct(noReq.winRate)} vs 기준 ${pct(BASE.winRate)}`);
}
{
  // 두 축이 서로 다른 툴을 선호해야 한다. 같은 툴을 선호하면 축이 하나다.
  //   접근 최대화 봇(greedy) vs 소음 최소화 봇(thrifty) 의 선택 일치율
  let same = 0, tot = 0;
  for (let i=0;i<3000;i++) {
    const seed = SEED.TEST+i, r = rng(seed);
    let s = newRun(randKit(seed), r, {});
    const g = make('greedy'), t = make('thrifty');
    while (s.status==='running') {
      const Lx = s.layers[s.layerIdx];
      if (Lx.type==='RECON') { s = resolveLayer(s, null, r); continue; }
      if (s.hand.length > 1) { tot++; if (g(s).name === t(s).name) same++; }
      s = resolveLayer(s, g(s), r);
    }
  }
  C.check('접근 최우선과 소음 최우선이 서로 다른 툴을 고름 (축이 둘)',
    same/tot < 0.70, `일치율 ${pct(same/tot)}`);
}
{
  // "시끄럽게 밀기" 와 "조용히 가기" 가 둘 다 성립하는가.
  //   ⚠️ 소음이 스탯 예산을 사므로 **균질한 저소음 덱 = 저스탯 덱**이다. 그건 전략이 아니라
  //      약한 덱이다 (측정: 21.1%). 현실적인 덱은 섞여 있으므로, 평균 소음이 다른
  //      **혼합 덱**들로 비교해야 "조용한 빌드가 성립하는가"라는 질문에 답이 된다.
  //   ⚠️ 구현이 이 주석을 두 번 배신했다. 둘 다 **풀이 커지자** 드러났다.
  //      ① "목표 소음에 가장 가까운 12장"을 결정적으로 자르던 방식 — 같은 소음 카드가
  //         12장을 넘는 순간 **균질 덱**이 되어, 위가 쓰지 말라는 바로 그것을 만든다.
  //         게다가 동점을 balance.json 삽입 순서로 깨므로 **게임 의미가 없는 순서**에 좌우된다.
  //         실측: 풀 순서만 섞어도 목표 2.0 승률이 9.9% ~ 27.1% 로 17%p 흔들렸다.
  //      ② 절대 소음값(1.0 · 1.5 …)을 목표로 잡던 것 — 무작위 12장 덱의 평균 소음은
  //         풀 평균 근처에 몰리므로 어떤 목표는 덱이 두세 개밖에 안 잡힌다.
  //         "표본 한 쌍으로 분포 대표"라 §1.3 위반이다 (실측: 목표 1.0 에서 덱 2개).
  //      → 덱 평균 소음의 **분위수**로 띠를 잡는다. 무작위 혼합 덱이고, 풀이 어떻게
  //        바뀌어도 띠마다 표본 수가 유지되며, 삽입 순서에 무관하다.
  const wOf = deck => { let ok=0;
    for (let i=0;i<1500;i++) if (run(cloneKit(deck), SEED.TEST+i, 'assign').status==='success') ok++;
    return ok/1500; };
  //    ⚠️ 띠당 표본은 **40 이상**이어야 한다 — docs/05 §2 「무작위 표본 한 쌍으로 분포
  //       대표」 금지 항목의 기준이다. 24 로 뒀다가 교차검증에서 규약 미달로 잡혔다.
  const SAMPLES = 900, BAND = 40;
  const pool = Array.from({length: SAMPLES}, (_, s) => {
    const d = randKit(770000 + s);
    return { d, m: mean(d.map(x => x.noise)) };
  }).sort((a, b) => a.m - b.m);
  const builds = [0.10, 0.35, 0.65, 0.90].map(q => {
    const c = Math.min(SAMPLES - 1, Math.floor(q * SAMPLES));
    const lo = Math.max(0, Math.min(SAMPLES - BAND, c - BAND / 2));
    const band = pool.slice(lo, lo + BAND);
    return [f(mean(band.map(x => x.m)), 2), mean(band.map(x => wOf(x.d))), band.length];
  });
  C.info('평균 소음별 혼합 덱 성공률',
    builds.map(([n,w,k])=>`소음${n} ${pct(w)}(덱${k})`).join(' '));
  const ws = builds.map(b=>b[1]);
  C.check('소음 성향이 다른 빌드가 모두 성립 (격차 <25%p)',
    Math.max(...ws)-Math.min(...ws) < 0.25, pct(Math.max(...ws)-Math.min(...ws)));
}
{
  // 소음 0 툴만으로 클리어 가능한가 → 가능하면 비용 축이 죽은 것
  const silent = TOOLKIT.filter(t => t.noise === 0);
  C.info('소음 0 툴 개수', `${silent.length}종 (${silent.map(t=>t.name).join(',')})`);
  const kitS = [];
  while (kitS.length < 8) kitS.push({...silent[kitS.length % silent.length]});
  let ok=0; for (let i=0;i<3000;i++) if (run(cloneKit(kitS), SEED.TEST+i,'assign').status==='success') ok++;
  C.check('무소음 툴만으로는 안정 클리어 불가 (소음 회피가 만능이 아님)',
    ok/3000 < BASE.winRate + 0.12, `무소음덱 ${pct(ok/3000)} vs 기준 ${pct(BASE.winRate)}`);
}
{
  // 소음 무시 러시가 성립하는가 → 성립하면 비용이 없는 것
  const loudTools = [...TOOLKIT].sort((a,b)=>b.noise-a.noise).slice(0,4);
  const kitL = []; while (kitL.length < 8) kitL.push({...loudTools[kitL.length % 4]});
  let ok=0; for (let i=0;i<3000;i++) if (run(cloneKit(kitL), SEED.TEST+i,'assign').status==='success') ok++;
  C.check('최고소음 툴만으로도 안정 클리어 불가 (러시가 만능이 아님)',
    ok/3000 < BASE.winRate + 0.12, `고소음덱 ${pct(ok/3000)} vs 기준 ${pct(BASE.winRate)}`);
}
{
  // 두 극단 덱이 서로 비슷해야 진짜 트레이드오프
  const silent = TOOLKIT.filter(t=>t.noise===0);
  const loud   = [...TOOLKIT].sort((a,b)=>b.noise-a.noise).slice(0,4);
  const kS=[],kL=[]; while(kS.length<8){kS.push({...silent[kS.length%silent.length]});kL.push({...loud[kL.length%4]});}
  const v = versusRaw(kS, kL, 3000);
  C.check('무소음덱 vs 고소음덱이 균형 (40~60%)', v.rate>0.40 && v.rate<0.60, `무소음 ${pct(v.rate)}`);
}

// ── 104~111 TRACE 실패가 적절한 빈도인가 ──────────────────────
{
  C.info('TRACE 초과 실패율', pct(BASE.traceFail));
  C.check('실패의 대부분이 TRACE 초과 (다른 사인이 아님)',
    BASE.traceFail > (1-BASE.winRate)*0.9, `${pct(BASE.traceFail)} / 전체실패 ${pct(1-BASE.winRate)}`);
}
{
  // 언제 죽는가 — 초반에 몰리면 결정이 무의미해진다
  const at = {};
  let died = 0;
  for (let i=0;i<6000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i, 'assign');
    if (s.status==='failed') { died++; const p = s.layerIdx/s.layers.length;
      const b = p<0.34?'초반':p<0.67?'중반':'종반'; at[b]=(at[b]||0)+1; }
  }
  const early = (at.초반||0)/died;
  C.info('실패 시점 분포', Object.entries(at).map(([k,v])=>`${k} ${pct(v/died)}`).join(' '));
  C.check('초반 조기 사망이 지배적이지 않음 (<30%)', early < 0.30, pct(early));
}
{
  // 흔적 곡선이 후반으로 갈수록 가팔라지는가 (긴장 곡선)
  const byPos = [[],[],[],[],[],[],[]];
  for (let i=0;i<4000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i, 'assign');
    layerLog(s).forEach((l,j) => { if (j<7) byPos[j].push(l.dTrace); });
  }
  const ms = byPos.filter(a=>a.length>200).map(a=>mean(a));
  C.info('계층 위치별 평균 흔적 증가', ms.map(x=>f(x,1)).join(' → '));
  C.check('후반 계층의 흔적 증가가 초반보다 큼 (긴장 곡선)',
    ms[ms.length-1] > ms[0], `${f(ms[0],1)} → ${f(ms[ms.length-1],1)}`);
}
{
  // 경계 단계가 실제로 도달되는가
  const hit = [0,0,0,0];
  for (let i=0;i<4000;i++) {
    const s = run(randKit(SEED.TEST+i), SEED.TEST+i, 'assign');
    hit[Math.max(...layerLog(s).map(l=>l.alert), 0)]++;
  }
  C.info('도달 최고 경계 단계 분포', hit.map((v,i)=>`${i}단계 ${pct(v/4000)}`).join(' '));
  C.check('경계 2단계 이상 도달이 충분히 흔함 (>25%)',
    (hit[2]+hit[3])/4000 > 0.25, pct((hit[2]+hit[3])/4000));
  C.check('경계 3단계가 희귀하지만 존재 (>2%)', hit[3]/4000 > 0.02, pct(hit[3]/4000));
}
{
  // TRACE_MAX 근처에서 끝나는가 (아슬아슬한 판이 있는가)
  const finals = [];
  for (let i=0;i<6000;i++) { const s = run(randKit(SEED.TEST+i), SEED.TEST+i,'assign');
    if (s.status==='success') finals.push(s.trace); }
  finals.sort((a,b)=>a-b);
  const close = finals.filter(x=>x>85).length/finals.length;
  C.info('성공 판의 최종 흔적', `중앙 ${f(finals[finals.length>>1],1)} p90 ${f(finals[Math.floor(finals.length*0.9)],1)}`);
  C.check('아슬아슬한 성공(흔적>85)이 10% 이상', close > 0.10, pct(close));
}

// ── 112~121 결정 레버리지: 선택이 결과를 바꾸는가 ─────────────
{
  // 각 계층에서 최선 선택과 최악 선택의 최종 결과 차이
  const diffs = [], hands = [], alive = [];
  for (let i=0;i<1200;i++) {
    const seed = SEED.TEST+i, r = rng(seed);
    let s = newRun(randKit(seed), r, {});
    while (s.status==='running') {
      const Lx = s.layers[s.layerIdx];
      if (Lx.type==='RECON') { s = resolveLayer(s, null, r); continue; }
      if (s.hand.length > 1) {
        const outs = s.hand.map(c => {
          const rr = rng(seed*7+13);
          const a = resolveLayer(s, c, rr);
          return score(a.status==='running' ? playOut(a, make('assign'), rr, defaultGear) : a);
        });
        diffs.push(Math.max(...outs) - Math.min(...outs)); hands.push(s.hand.length);
        // 이 계층에서 성공과 실패가 모두 가능했는가 = 승부가 열려 있었는가
        alive.push(outs.some(o=>o>0) && outs.some(o=>o===0));
      }
      s = resolveLayer(s, make('assign')(s), r);
    }
  }
  const m = mean(diffs);
  C.info('계층당 결정 레버리지 (최선−최악 최종점수)', `평균 ${f(m,0)} 중앙 ${f([...diffs].sort((a,b)=>a-b)[diffs.length>>1],0)}`);
  C.check('결정 레버리지가 유의미 (평균 >150점)', m > 150, f(m,0));
  // ⚠️ 후반 계층은 손패가 2장뿐이라 "선택지가 없어서" 레버리지 0 이 되는 게 정상이다.
  //    전체를 뭉뚱그리면 구조적 필연을 결함으로 오독한다. 손패 크기별로 분해한다.
  const byHand = {};
  hands.forEach((h,i)=>{ (byHand[h] ??= []).push(diffs[i]); });
  C.info('손패 크기별 레버리지 0 비율',
    Object.keys(byHand).sort().map(h=>`${h}장 ${pct(byHand[h].filter(x=>x<1).length/byHand[h].length)}`).join(' '));
  // ⚠️ 이미 승부가 난 판(전멸 확정 / 승리 확정)의 계층은 무슨 카드를 내도 같다.
  //    그건 설계 결함이 아니라 결말이다. **살아 있는 판**의 계층만 센다.
  const live = diffs.filter((_,i)=>alive[i]);
  C.info('전체 계층 중 아직 승부가 열려 있던 비율', pct(live.length/diffs.length));
  C.check('승부가 열린 계층에서 레버리지 0 이 25% 미만',
    live.filter(x=>x<1).length/live.length < 0.25,
    pct(live.filter(x=>x<1).length/live.length));
}
{
  // 실력 격차: 최상위 봇 vs 무작위 봇 / 최상위 vs 중간
  const top = std(4000,'counter'), mid = std(4000,'thrifty'), bot = std(4000,'random');
  C.info('실력 스펙트럼', `random ${pct(bot.winRate)} → thrifty ${pct(mid.winRate)} → counter ${pct(top.winRate)}`);
  C.check('실력 상단 격차가 존재 (counter − thrifty > 4%p)',
    top.winRate - mid.winRate > 0.04, `+${pct(top.winRate-mid.winRate)}`);
  C.check('실력 하단 격차가 존재 (thrifty − random > 15%p)',
    mid.winRate - bot.winRate > 0.15, `+${pct(mid.winRate-bot.winRate)}`);
}
{
  // 같은 툴킷·같은 표적에서 봇 실력만 다르면 결과가 갈리는가
  let split = 0;
  for (let i=0;i<3000;i++) {
    const seed = SEED.TEST+i, layers = buildTarget(rng(seed));
    const a = run(randKit(seed), seed, 'counter', {layers}).status;
    const b = run(randKit(seed), seed, 'thrifty', {layers}).status;
    if (a !== b) split++;
  }
  C.check('실력 차가 성패를 가르는 판이 12% 이상', split/3000 > 0.12, pct(split/3000));
}
{
  // 인과 명확성 (M9′). 플레이어가 덱을 고르는 구조에서는 **덱 선택도 실력**이다.
  //   실패를 (a) 다른 수로 만회 가능 (b) 다른 덱이면 성공 (c) 어느 쪽도 불가 로 나눈다.
  let tot=0, byPlay=0, byDeck=0;
  for (let i=0;i<700;i++) {
    const seed=SEED.TEST+i, r0=rng(seed), s0=newRun(randKit(seed), r0, {});
    if (playOut(s0, make('assign'), r0, defaultGear).status!=='failed') continue;
    tot++;
    let saved=false, s=s0, r=rng(seed);
    while (s.status==='running' && !saved) {
      const Lx=s.layers[s.layerIdx];
      if (Lx.type==='RECON'){s=resolveLayer(s,null,r);continue;}
      if (!s.hand.length){s=resolveLayer(s,null,r);continue;}
      const chosen=make('assign')(s);
      for (const c of s.hand) { if (c===chosen) continue;
        const rr=rng(seed*31+7), a=resolveLayer(s,c,rr);
        if ((a.status==='running'?playOut(a,make('assign'),rr,defaultGear):a).status==='success')
          { saved=true; break; } }
      s=resolveLayer(s,chosen,r);
    }
    if (saved) { byPlay++; continue; }
    let deckSaved=false;
    for (let k=0;k<10 && !deckSaved;k++) {
      const rr=rng(seed*17+k);
      if (playOut(newRun(randKit(600000+i*10+k), rr, {layers:s0.layers}), make('assign'), rr, defaultGear)
          .status==='success') deckSaved=true;
    }
    if (deckSaved) byDeck++;
  }
  C.info('실패의 귀속', `수 ${pct(byPlay/tot)} · 덱 ${pct(byDeck/tot)} · 운 ${pct(1-(byPlay+byDeck)/tot)}`);
  C.check('실패의 70% 이상이 플레이어에게 귀속 (M9′)',
    (byPlay+byDeck)/tot > 0.70, pct((byPlay+byDeck)/tot));
}

// ── 122~137 축이 콘텐츠 다양성을 만드는가 (재설계의 목적) ─────
//    ⚠️ 전부 한계 기여로 잰다. "그것만 8장" 덱은 난이도 천장/바닥에 붙어 무의미하다.
const CTRL = L.controlBaseline(4000);
C.info('대조 툴킷 기준 성공률', pct(CTRL));
{
  // 스탯 배분 형태 6종. 이전 프로젝트에서 이 스프레드가 2pp 라 "카드 종류 불가" 결론이 났다.
  const shapes = [[80,20,20],[20,80,20],[20,20,80],[50,50,20],[45,45,45],[65,35,20]];
  const rs = shapes.map((sh,i) => L.marginal(makeTool('S'+i,'정예','우회',sh,1), 4000));
  const use = rs.map(r=>r.useRate);
  C.info('스탯 형태별 실사용률', shapes.map((sh,i)=>`${sh.join('/')}=${pct(use[i])}`).join(' '));
  C.info('스탯 형태별 보유시 성공률', shapes.map((sh,i)=>`${pct(rs[i].winWithHeld)}`).join(' '));
  const wins = rs.map(r=>r.winWithHeld);
  const spread = Math.max(...wins)-Math.min(...wins);
  C.check('스탯 형태가 성능 차이를 만듦 (이전 프로젝트 2pp 초과)', spread > 0.03, pct(spread));
  C.check('스탯 형태 스프레드가 과대하지 않음 (<25%p)', spread < 0.25, pct(spread));
  const ref0 = L.marginal(makeTool('REF','정예','우회',[45,45,45],2), 3000).useRate;
  C.info('무효과 대조 카드 사용률 (사용률의 실질 상한)', pct(ref0));
  C.check('모든 스탯 형태가 대조 대비 60% 이상 사용',
    Math.min(...use) > ref0*0.6, `${pct(Math.min(...use))} vs 기준 ${pct(ref0*0.6)}`);
}
{
  // 소음 축: 예산 보정 후 소음 수준이 실사용률과 성능에 미치는 영향
  const rs = [0,1,2,3,4].map(nz => L.marginal(makeTool('N'+nz,'정예','우회',[45,45,45],nz), 4000));
  const use = rs.map(r=>r.useRate), wins = rs.map(r=>r.winWithHeld);
  C.info('소음 수준별 실사용률', use.map((x,i)=>`n${i}=${pct(x)}`).join(' '));
  C.info('소음 수준별 보유시 성공률', wins.map((x,i)=>`n${i}=${pct(x)}`).join(' '));
  // 벤치가 있으면 사용률은 "상황 선택"의 결과다. 공정성은 성능으로 잰다.
  C.info('소음별 사용률(참고)', use.map((x,i)=>`n${i} ${pct(x)}`).join(' '));
  C.check('소음 가격이 공정 (성능 스프레드 <15%p)',
    Math.max(...wins)-Math.min(...wins) < 0.15, pct(Math.max(...wins)-Math.min(...wins)));
  // 벤치가 4장 있으면 고소음 툴은 "어려운 계층이 나왔을 때만" 쓰는 게 정상이다.
  // 사문화 판정은 성능으로 한다 — 성능이 같은데 덜 쓰이면 그건 상황 카드다.
  C.check('고소음 툴이 성능상 불리하지 않음 (n0 대비 −5%p 이내)',
    wins[4] > wins[0]-0.05, `n0 ${pct(wins[0])} vs n4 ${pct(wins[4])}`);
}
{
  // 유형 3종
  const tot = Object.values(BASE.typeUse).reduce((a,b)=>a+b,0);
  const shares = Object.fromEntries(Object.entries(BASE.typeUse).map(([k,v])=>[k,v/tot]));
  C.info('유형 사용 점유율', Object.entries(shares).map(([k,v])=>`${k} ${pct(v)}`).join(' '));
  C.check('사문화된 유형 없음 (최저 점유율 >20%)',
    Math.min(...Object.values(shares)) > 0.20, pct(Math.min(...Object.values(shares))));
}
{
  const rs = Object.entries(BASE.ratio).sort((a,b)=>a[1]-b[1]);
  C.info('실제 툴 12종 사용률 최저 3', rs.slice(0,3).map(([k,v])=>`${k} ${pct(v)}`).join(' '));
  // 표준 조건 하나에서 낮은 것은 사문화가 아니다. 어느 원형에서도 안 쓰이면 사문화다.
  C.check('사용률 최저 툴도 완전히 죽지는 않음 (>5%)', rs[0][1] > 0.05, `${rs[0][0]} ${pct(rs[0][1])}`);
  C.info('원형별 최대 사용률 검사는 sim/regress.mjs 참조', '');
}
{
  // 효과 6종의 한계 기여 — 무효과 동일 툴 대비
  const plain = L.marginal(makeTool('무효과','정예','우회',[45,45,45],1), 4000);
  const rows = Object.keys(CONFIG.EFFECT).map(e =>
    [e, L.marginal(makeTool(e,'정예','우회',specFor(e).shape,specFor(e).noise,{effect:e}), 4000)]);
  C.info('무효과 기준', `사용률 ${pct(plain.useRate)} 보유시성공 ${pct(plain.winWithHeld)}`);
  C.info('효과별 사용률', rows.map(([e,r])=>`${e} ${pct(r.useRate)}`).join(' '));
  C.info('효과별 보유시 성공률', rows.map(([e,r])=>`${e} ${pct(r.winWithHeld)}`).join(' '));
  // ⚠️ 특화형으로 잰 효과를 균형형 무효과 카드와 비교하면 형태 이득이 효과 이득으로 오독된다.
  //    반드시 **같은 형태**의 무효과 카드를 기준으로 삼는다.
  const REF = {}; for (const e of Object.keys(CONFIG.EFFECT))
    REF[e] = L.marginal(makeTool('R_'+e,'정예','우회',specFor(e).shape,specFor(e).noise), 3000);
  const d = rows.map(([e,r]) => [e, r.winWithHeld - REF[e].winWithHeld]);
  C.info('효과별 Δ성공률 (같은 형태 대비)', d.map(([e,v])=>`${e} ${f(v*100,1)}pp`).join(' '));
  C.check('쓸모없는 효과 없음 (−8%p 이내)', Math.min(...d.map(x=>x[1])) > -0.08,
    `${d.reduce((a,b)=>a[1]<b[1]?a:b).join(' ')}`);
  C.check('압도적 효과 없음 (+8%p 이내)', Math.max(...d.map(x=>x[1])) < 0.08,
    `${d.reduce((a,b)=>a[1]>b[1]?a:b).join(' ')}`);
  const relUse = rows.map(([e,r]) => [e, r.useRate / Math.max(0.01, REF[e].useRate)]);
  C.info('효과별 상대 사용률 (같은 형태 무효과 카드 = 1.0)',
    relUse.map(([e,v])=>`${e} ${f(v,2)}`).join(' '));
  C.check('모든 효과가 같은 형태 무효과 카드의 50% 이상 사용',
    Math.min(...relUse.map(r=>r[1])) > 0.5,
    `${relUse.reduce((a,b)=>a[1]<b[1]?a:b)[0]} ${f(Math.min(...relUse.map(r=>r[1])),2)}`);
}

// ── 131~135 지배 툴킷 (M8) ────────────────────────────────────
{
  // 무작위 툴킷 200개의 성공률 분포
  const rates = [];
  for (let k=0;k<200;k++) {
    const kk = randKit(300000+k);
    let ok=0; for (let t=0;t<400;t++) if (run(cloneKit(kk), SEED.TEST+t,'assign').status==='success') ok++;
    rates.push(ok/400);
  }
  rates.sort((a,b)=>a-b);
  C.info('무작위 툴킷 200개 성공률', `최저 ${pct(rates[0])} 중앙 ${pct(rates[100])} 최고 ${pct(rates[199])}`);
  // 플레이어가 덱을 고르는 구조에서 "최강 덱이 세다"는 불공평이 아니라 보상이다.
  // 문제는 상한이 아니라 **최강 덱이 하나뿐인가**다 → 상위권 다양성으로 대체.
  C.info('최강 덱 성공률(참고)', pct(rates[199]));
  C.check('최강 덱이 압도적이지는 않음 (<90%)', rates[199] < 0.90, pct(rates[199]));
  C.check('최약 툴킷 성공률 >20% (승산 없는 조합 없음)', rates[0] > 0.20, pct(rates[0]));
  C.check('상하위 10% 격차 <35%p', rates[180]-rates[19] < 0.35,
    `${pct(rates[19])} ~ ${pct(rates[180])} = ${pct(rates[180]-rates[19])}`);
  C.info('툴킷 성공률 표준편차', pct(sd(rates)));
}

process.exit(C.done() ? 1 : 0);
