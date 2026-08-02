// ══════════════════════════════════════════════════════════════
//  A 그룹 (1–40) — 코드 정합성 · 결정론 · 보존 · 경계값
//  여기가 깨지면 나머지 360개 관점의 수치가 전부 무의미하다.
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
import { readFileSync } from 'node:fs';
const { Audit, rng, kit, run, score, CONFIG, newRun, resolveLayer, useGear,
        buildTarget, makeTool, layerLog, byName, TOOLKIT, playOut, make, f, pct } = L;

const A = new Audit('A 코드 정합성', 0);
const R = s => rng(s);
const K = () => kit('표준');
const src = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// ── 1~6 순수성 ────────────────────────────────────────────────
{
  const tk = K(), snap = JSON.stringify(tk);
  run(tk, 12345, 'deep');
  A.check('newRun/playOut 이 입력 툴킷을 변형하지 않음', JSON.stringify(tk) === snap);
}
{
  const s0 = newRun(K(), R(1));
  const before = JSON.stringify(s0);
  resolveLayer(s0, s0.hand[0], R(2));
  A.check('resolveLayer 가 입력 상태를 변형하지 않음', JSON.stringify(s0) === before);
}
{
  const s0 = newRun(K(), R(1));
  const s1 = resolveLayer(s0, s0.hand[0], R(2));
  A.check('resolveLayer 가 새 객체를 반환', s1 !== s0);
  A.check('resist 객체가 공유되지 않음', s1.resist !== s0.resist);
  A.check('hand 배열이 공유되지 않음', s1.hand !== s0.hand);
  A.check('log 배열이 공유되지 않음', s1.log !== s0.log);
}

// ── 7~10 결정론 ───────────────────────────────────────────────
{
  let same = 0;
  for (let i = 0; i < 200; i++) {
    const a = run(K(), 5000+i, 'deep'), b = run(K(), 5000+i, 'deep');
    if (JSON.stringify(a.log) === JSON.stringify(b.log) && a.trace === b.trace) same++;
  }
  A.check('같은 시드 → 완전 동일 결과', same === 200, `${same}/200`);
}
{
  const set = new Set();
  for (let i = 0; i < 500; i++) set.add(JSON.stringify(run(K(), 9000+i, 'assign').log));
  A.check('다른 시드 → 결과 다양성', set.size > 450, `고유 ${set.size}/500`);
}
{
  // 주석에 "Math.random 금지"라고 써 있으면 오탐한다 → 코드 라인만 검사
  const code = p => src(p).split('\n')
    .map(x => x.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const files = ['../core/engine.mjs','../core/bots.mjs','../core/tools.mjs','../core/balance.mjs','../lib.mjs'];
  const bad = files.filter(p => /Math\.random\s*\(/.test(code(p)));
  A.check('Math.random 미사용 (코드 라인)', bad.length === 0, bad.join(','));
  const bad2 = files.filter(p => /Date\.now\s*\(|new Date\s*\(/.test(code(p)));
  A.check('시각 의존 미사용', bad2.length === 0, bad2.join(','));
}

// ── 11~18 상태 보존 ───────────────────────────────────────────
{
  let neg = 0, jump = 0, drop = 0;
  for (let i = 0; i < 400; i++) {
    const s = run(K(), 3000+i, 'assign');
    if (s.trace < -1e-9) neg++;
    let prev = -1;
    for (const l of s.log) {
      if (l.kind !== 'LAYER' && l.kind !== 'RECON') continue;
      if (prev >= 0 && l.layerIdx !== prev + 1) jump++;
      prev = l.layerIdx;
    }
    if (s.layerIdx > s.layers.length) drop++;
  }
  A.check('TRACE 가 음수가 되지 않음', neg === 0, `${neg}건`);
  A.check('계층 인덱스가 1씩 단조 증가', jump === 0, `${jump}건`);
  A.check('layerIdx 가 계층 수를 넘지 않음', drop === 0, `${drop}건`);
}
{
  // 소거·장비가 없으면 TRACE 는 단조 증가여야 한다
  let viol = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const s = run(kit('강습'), 4000+i, 'assign', { gear: false });
    let prev = 0;
    for (const l of layerLog(s)) {
      if (l.tool === '로그와이프') { prev = l.trace; continue; }
      n++; if (l.trace < prev - 1e-9) viol++;
      prev = l.trace;
    }
  }
  A.check('소거·장비 없으면 TRACE 단조 증가', viol === 0, `${viol}/${n}`);
}
{
  let ok = true, tested = 0;
  for (let i = 0; i < 400 && tested < 30; i++) {
    const s = run(kit('조용'), 6000+i, 'assign');
    for (const l of layerLog(s)) if (l.tool === '사이드채널') { tested++; if (l.noise !== 0) ok = false; }
  }
  A.check('은폐 툴의 소음이 정확히 0', ok && tested > 0, `표본 ${tested}`);
}
{
  const s0 = newRun([{...byName('로그와이프')}], R(7), { layerCount: 5 });
  const wipe = s0.hand[0];
  const L0 = s0.layers[0];
  const s1 = resolveLayer(s0, wipe, R(8));
  const lg = s1.log.find(x=>x.kind==='LAYER');
  const expect = lg.noise + lg.short*CONFIG.SHORTFALL - CONFIG.EFFECT.소거.traceCut;
  A.check('소거 효과가 dTrace 에 정확히 반영', Math.abs(lg.dTrace - expect) < 1e-9, f(lg.dTrace,3));
}
{
  const plain = {...byName('사전공격')};
  const over  = {...byName('제로데이')};
  const s0 = newRun([plain, over], R(11), { layerCount: 5, handSize: 2 });
  const Lx = s0.layers[0];
  const nA = L.noiseOf(plain, Lx, s0) / plain.noise;
  const nB = L.noiseOf(over,  Lx, s0) / over.noise;
  A.check('과부하 소음 배수가 정확히 2배', Math.abs(nB/nA - 2) < 1e-9, f(nB/nA,3));
  // ⚠️ 주스탯을 dec 로 고정하면 표적 생성이 바뀔 때 조용히 오답이 된다. 계층의 실제 주스탯을 쓴다.
  const want = CONFIG.EFFECT.과부하.scoreMul;
  const v = { dec:over.dec, eva:over.eva, inf:over.inf };
  const oth = L.STATS.filter(x=>x!==Lx.stat).map(x=>v[x]);
  const plainScore = v[Lx.stat]*(1-CONFIG.SUB_W) + ((oth[0]+oth[1])/2)*CONFIG.SUB_W;
  A.check(`과부하 접근점수 배수가 설정값(${want})과 일치`,
    Math.abs(L.scoreOf(over,Lx,s0)/plainScore - want) < 1e-9, f(L.scoreOf(over,Lx,s0)/plainScore,3));
}
{
  // 적응은 morph — 계층 주스탯이 아니라 자신의 최고 스탯을 주스탯으로 쓴다
  const adapt = makeTool('적응테스트','정예','정공',[80,20,20],2,{effect:'적응'});
  const plainT = makeTool('평범테스트','정예','정공',[80,20,20],2);
  const s0 = newRun([adapt], R(13), { layerCount: 5 });
  const bad = { ...s0.layers[0], stat: 'inf' };   // 이 카드가 약한 계층
  const gain = L.scoreOf(adapt, bad, s0) / L.scoreOf(plainT, bad, s0);
  A.check('적응이 불리한 계층에서 최고 스탯을 주스탯으로 전환',
    gain > 1.3, `배수 ${f(gain,2)}`);
  const good = { ...s0.layers[0], stat: 'dec' };  // 이 카드가 강한 계층
  A.check('적응이 유리한 계층에서는 배수 손해만 남음',
    L.scoreOf(adapt, good, s0) < L.scoreOf(plainT, good, s0), '');
}
{
  // 백도어는 "요구치 판정 자체를 건너뛰고 흔적을 대신 낸다" 로 재설계됐다.
  const bd = makeTool('백도어테스트','정예','우회',[10,10,10],2,{effect:'백도어'});
  const s0 = newRun([{...bd}], R(77), { layerCount: 5, handSize: 1 });
  const s1 = resolveLayer(s0, s0.hand[0], R(2));
  const lg = s1.log.find(x=>x.kind==='LAYER');
  A.check('백도어는 스탯이 형편없어도 미달 페널티가 0',
    lg.short === 0 && lg.acc < lg.req, `접근 ${f(lg.acc,1)} < 요구 ${f(lg.req,1)}, 미달 ${lg.short}`);
  A.check('백도어의 대가가 흔적으로 부과됨',
    Math.abs(lg.dTrace - (lg.noise + CONFIG.EFFECT.백도어.bypassTrace)) < 1e-9,
    `dTrace ${f(lg.dTrace,1)} = 소음 ${f(lg.noise,1)} + 우회비용 ${CONFIG.EFFECT.백도어.bypassTrace}`);
  A.check('백도어는 초과 달성으로 여유를 쌓지 못함', s1.slack === 0, `여유 ${f(s1.slack,1)}`);
}

// ── 19~26 방어 상태 ───────────────────────────────────────────
{
  let bad = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    let s = newRun(K(), R(8100+i));
    const r = R(8100+i);
    while (s.status === 'running') {
      for (const t of L.TYPES) { n++; if (s.resist[t] < -1e-9 || s.resist[t] > CONFIG.RESIST_CAP+1e-9) bad++; }
      const Lx = s.layers[s.layerIdx];
      s = resolveLayer(s, Lx.type==='RECON' ? null : s.hand[0], r);
    }
  }
  A.check('저항이 [0, RESIST_CAP] 범위 유지', bad === 0, `${bad}/${n}`);
}
{
  let bad = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const s = run(K(), 8500+i, 'assign');
    for (const l of layerLog(s)) {
      n++;
      const want = CONFIG.ALERT_STEPS.filter(t => l.trace >= t).length;
      if (l.alert !== want) bad++;
    }
  }
  A.check('경계 단계 = TRACE 문턱 초과 개수', bad === 0, `${bad}/${n}`);
}
{
  // 인과: 능동 대응은 반드시 그 전에 WARN 로그가 있어야 한다 (docs/02-rules.md §6 예고 규칙)
  let unwarned = 0, total = 0;
  for (let i = 0; i < 500; i++) {
    const s = run(kit('강습'), 8900+i, 'assign');
    let warned = false;
    for (const l of s.log) {
      if (l.kind === 'WARN') { warned = true; continue; }
      if (l.kind === 'COUNTER') { total++; if (!warned) unwarned++; warned = false; }
      if (l.kind === 'LAYER') warned = warned;   // WARN 은 계층 진입 시 발행되고 다음 진입에 소비
    }
  }
  A.check('모든 능동 대응이 사전 예고를 동반', unwarned === 0, `무예고 ${unwarned}/${total}`);
}
{
  // 예고→발동 사이에 최소 1계층의 플레이 기회가 있어야 한다 (대비 가능성).
  // 로그를 순회하며 각 COUNTER 직전의 WARN 을 찾고, 그 사이 LAYER 개수를 센다.
  let ok = 0, bad = 0, sample = [];
  for (let i = 0; i < 1500; i++) {
    const s = run(kit('강습'), 9300+i, 'assign');
    const seq = s.log;
    for (let j = 0; j < seq.length; j++) {
      if (seq[j].kind !== 'COUNTER') continue;
      let layersBetween = 0, wi = -1;
      for (let k = j-1; k >= 0; k--) {
        if (seq[k].kind === 'LAYER') layersBetween++;
        if (seq[k].kind === 'WARN' && seq[k].counter === seq[j].counter) { wi = k; break; }
      }
      if (wi >= 0 && layersBetween >= 1) ok++;
      else { bad++; if (sample.length < 3) sample.push(`${seq[j].counter}/간격${layersBetween}`); }
    }
  }
  A.check('예고와 발동 사이에 최소 1계층의 대비 기회', bad === 0,
          `정상 ${ok}, 위반 ${bad}${sample.length?' ['+sample.join(' ')+']':''}`);
}
{
  // 요구치 상승이 실제로 판정에 영향을 주는가 (사문화 파라미터 검사)
  const s0 = newRun(K(), R(9999), { layerCount: 5 });
  const withC = { ...s0, active: '요구치 상승' };
  const a = resolveLayer(s0,    s0.hand[0], R(1)).log.find(x=>x.kind==='LAYER');
  const b = resolveLayer(withC, withC.hand[0], R(1)).log.find(x=>x.kind==='LAYER');
  A.check('요구치 상승이 실제 요구치를 올림',
    Math.abs(b.req/a.req - (1+CONFIG.COUNTER_REQ_UP)) < 1e-9, `${f(a.req,1)} → ${f(b.req,1)}`);
  A.check('요구치 상승이 TRACE 를 실제로 증가시킴', b.dTrace > a.dTrace,
    `${f(a.dTrace,2)} → ${f(b.dTrace,2)}`);
}
{
  let s = newRun(K(), R(21));
  s = { ...s, pending: '추적 가속', gear: ['분석기'] };
  const s2 = useGear(s, '분석기');
  A.check('분석기가 예고된 능동 대응을 취소', s2.pending === null);
}
{
  const s0 = newRun(K(), R(23), { trace: 99 });
  const s1 = resolveLayer(s0, s0.hand[0], R(24));
  A.check('TRACE 100 도달 시 즉시 실패', s1.trace >= CONFIG.TRACE_MAX ? s1.status==='failed' : true,
          `trace=${f(s1.trace,1)} status=${s1.status}`);
}
{
  // 마지막 계층에서 흔적이 터져 실패하는 것은 정상(코어 도달 직전 발각).
  // 흔적이 멀쩡한데 실패했거나, 흔적이 넘쳤는데 성공한 경우만 결함이다.
  let bad = 0, lastLayerFail = 0;
  for (let i = 0; i < 1000; i++) {
    const s = run(kit('강습'), 9800+i, 'greedy');
    if (s.status === 'failed' && s.trace < CONFIG.TRACE_MAX) bad++;
    if (s.status === 'success' && s.layerIdx !== s.layers.length) bad++;
    if (s.status === 'success' && s.trace >= CONFIG.TRACE_MAX) bad++;
    if (s.status === 'failed' && s.layerIdx >= s.layers.length) lastLayerFail++;
  }
  A.check('종료 상태와 진행도가 정합', bad === 0, `${bad}건`);
  A.info('최종 계층에서 발각된 판', `${lastLayerFail}/1000`);
}

// ── 27~32 점수 ────────────────────────────────────────────────
{
  let bad = 0, n = 0;
  for (let i = 0; i < 600; i++) { const s = run(K(), 11000+i, 'assign');
    if (s.status !== 'success') { n++; if (score(s) !== 0) bad++; } }
  A.check('실패 시 점수 0', bad === 0, `실패 ${n}건 중 ${bad}`);
}
{
  const base = newRun(K(), R(31), { layerCount: 5 });
  const a = score({ ...base, status:'success', trace:20, hand:[], access:0 });
  const b = score({ ...base, status:'success', trace:60, hand:[], access:0 });
  A.check('흔적이 적을수록 점수가 높음', a > b, `${a} vs ${b}`);
  const c = score({ ...base, status:'success', trace:20, hand:[1,2], access:0 });
  A.check('남은 툴이 많을수록 점수가 높음', c > a, `${c} vs ${a}`);
  const d = score({ ...base, status:'success', trace:20, hand:[], slack:50 });
  A.check('남은 여유가 점수에 반영', d > a, `${d} vs ${a}`);
}
{
  let bad = [];
  for (const t of TOOLKIT) {
    // 예산 = 등급 총합 − 효과 비용 + 소음×소음가격  (소음은 스탯으로 환산돼 지급된다)
    if (t.sum !== L.budgetOf(t.grade, t.effect, t.noise)) bad.push(t.name);
    if (Math.max(t.dec,t.eva,t.inf) > CONFIG.GRADE_CAP[t.grade] + t.noise*CONFIG.NOISE_BUDGET*0.6 + 1) bad.push(t.name+'(상한)');
    if (Math.min(t.dec,t.eva,t.inf) < 1) bad.push(t.name+'(하한)');
  }
  A.check('모든 툴이 등급 예산·상한을 준수', bad.length === 0, bad.join(','));
}
{
  const t = makeTool('극단','기본','정공',[100,1,1],2);
  const cap = CONFIG.GRADE_CAP.기본 + 2*CONFIG.NOISE_BUDGET*0.6;
  A.check('극단 형태도 개별 상한을 넘지 않음', Math.max(t.dec,t.eva,t.inf) <= cap+1,
          `${t.dec}/${t.eva}/${t.inf} vs 상한 ${f(cap,1)}`);
  A.check('상한 초과분이 다른 스탯으로 재분배', t.sum === L.budgetOf('기본', undefined, 2), `합 ${t.sum}`);
}

// ── 33~40 표적 · 경계값 ───────────────────────────────────────
{
  let bad = 0;
  for (let i = 0; i < 500; i++) {
    const t = buildTarget(R(12000+i));
    if (t[t.length-1].type !== 'CORE') bad++;
    if (t.filter(x=>x.type==='RECON').length !== CONFIG.RECON_COUNT) bad++;
    if (t.filter(x=>x.type==='CORE').length !== 1) bad++;
  }
  A.check('표적 구조 (마지막 CORE · RECON 개수 · CORE 유일)', bad === 0, `${bad}건`);
}
{
  const counts = new Set();
  let reqBad = 0;
  for (let i = 0; i < 800; i++) {
    const t = buildTarget(R(13000+i));
    counts.add(t.filter(x=>x.type!=='RECON').length);
    for (const l of t) if (l.type!=='RECON') {
      const [lo,hi] = CONFIG.LAYER[l.type].req;
      if (l.req < lo-1e-9 || l.req > hi+1e-9) reqBad++;
    }
  }
  A.check('채점 계층 수가 설정 범위 내', [...counts].every(c=>c>=CONFIG.LAYERS_MIN&&c<=CONFIG.LAYERS_MAX),
          [...counts].sort().join(','));
  A.check('요구치가 계층 스펙 범위 내', reqBad === 0, `${reqBad}건`);
}
{
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const s = newRun(K(), R(14000+i));
    const scoring = s.layers.filter(l=>l.type!=='RECON').length;
    if (s.hand.length !== Math.min(8, scoring + CONFIG.HAND_EXTRA)) bad++;
  }
  A.check('손패 크기 = 채점 계층 + HAND_EXTRA', bad === 0, `${bad}건`);
}
{
  // 같은 이름 툴 2장 → 한 번 사용 시 하나만 소비되어야 한다 (객체 동일성 함정)
  const two = [{...byName('사전공격')}, {...byName('사전공격')}, {...byName('패킷위장')}];
  const s0 = newRun(two, R(15001), { layerCount: 5, handSize: 3 });
  const target = s0.hand.find(c=>c.name==='사전공격');
  const s1 = resolveLayer(s0, target, R(2));
  A.check('동명 툴 2장 중 하나만 소비됨',
    s1.hand.filter(c=>c.name==='사전공격').length === 1,
    `남은 ${s1.hand.filter(c=>c.name==='사전공격').length}장`);
}
{
  // 빈 손패 강제 패스
  const s0 = newRun([{...byName('사전공격')}], R(16000), { layerCount: 5, handSize: 1 });
  let s = s0, r = R(2), err = null;
  try { while (s.status==='running') s = resolveLayer(s, s.hand[0] ?? null, r); }
  catch (e) { err = e.message; }
  A.check('손패 소진 후 강제 패스가 크래시하지 않음', err === null, err ?? '');
  A.check('강제 패스가 실패로 이어짐(요구치 전액 미달)', s.status === 'failed', `${s.status} trace=${f(s.trace,1)}`);
}
{
  // 툴 없이 만든 상태에서도 정찰 계층은 통과
  const s0 = newRun(K(), R(17000));
  const reconIdx = s0.layers.findIndex(l=>l.type==='RECON');
  A.check('표적에 정찰 계층이 존재', reconIdx >= 0, `idx ${reconIdx}`);
}
{
  let gearOver = 0;
  for (let i = 0; i < 400; i++) {
    const s = run(K(), 18000+i, 'assign');
    if (s.gear.length > CONFIG.GEAR_CAP) gearOver++;
  }
  A.check('장비 보유 수가 상한을 넘지 않음', gearOver === 0, `${gearOver}건`);
}
{
  // 로그만으로 TRACE 타임라인을 정확히 복원할 수 있는가 (이전 프로젝트 버그 #1)
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const s = run(K(), 19000+i, 'assign');
    let t = 0;
    for (const l of s.log) {
      if (l.kind === 'LAYER') t += l.dTrace;
      else if (l.kind === 'GEAR' || l.kind === 'COUNTER') t += (l.dTrace ?? 0);
      t = Math.max(0, t);
    }
    worst = Math.max(worst, Math.abs(t - s.trace));
  }
  A.check('로그만으로 TRACE 타임라인 완전 복원', worst < 1e-6, `최대 오차 ${worst.toExponential(2)}`);
}

process.exit(A.done() ? 1 : 0);
