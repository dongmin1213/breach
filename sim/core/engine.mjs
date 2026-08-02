// ════════════════════════════════════════════════════════════════
//  BREACH — 룰 엔진 v1.0
//
//  순수 함수. UI·프레임워크 의존 0. Math.random 금지(결정론).
//  모든 튜너블은 CONFIG 한 곳에.
//
//  이월된 설계 제약 (PRD §13):
//   ① 비용 축(TRACE)을 처음부터 내장 — 없으면 카드 종류가 안 늘어난다
//   ② 부스탯 가중을 판정식에 내장 — 없으면 특화형이 수학적으로 항상 이긴다
//   ③ 난이도는 AI 정책 + 표적 스펙 두 축으로
//   ④ 모든 상태 변화를 원값으로 로깅 — 반올림하면 리플레이가 깨진다
// ════════════════════════════════════════════════════════════════

// ⚠️ 수치는 여기 없다. assets/balance.json 이 단일 원본이고 core/balance.mjs 가 읽어 온다.
//    코드에 박아두면 시뮬레이터가 검증한 값과 앱이 쓰는 값이 갈라진다.
//    (설계 근거와 실패 기록은 docs/02-rules.md · docs/06-findings.md 에 있다.)
export { CONFIG } from './balance.mjs';
import { CONFIG } from './balance.mjs';

export const STATS   = ['dec','eva','inf'];
export const TYPES   = ['정공','우회','강습'];
export const SCORING = ['CIPHER','NETWORK','PHYSICAL'];

export const isLayer  = l => l.kind === 'LAYER';
export const layerLog = s => s.log.filter(isLayer);

// ════════════════════════════ 표적 생성 ════════════════════════════
const pick  = (rng,a) => a[Math.floor(rng()*a.length)];
const range = (rng,[lo,hi]) => lo + rng()*(hi-lo);

export function buildTarget(rng, opts = {}) {
  const n = opts.layerCount ?? (CONFIG.LAYERS_MIN +
    Math.floor(rng() * (CONFIG.LAYERS_MAX - CONFIG.LAYERS_MIN + 1)));
  const spec = CONFIG.LAYER, out = [];
  // 계층 유형 분포. 표적 원형이 이걸 바꾸면 **요구 스탯이 바뀌어 덱 구성이 바뀐다.**
  // (저항·손패·대응 같은 레버는 플레이 방식만 바꾸고 덱 선택은 안 바꾼다 —
  //  초판에서 4개 원형이 같은 챔피언 덱을 뽑은 원인이었다.)
  const mix = opts.mix ?? CONFIG.LAYER_MIX;
  const bag = [];
  for (const t of SCORING) for (let i = 0; i < (mix?.[t] ?? 1); i++) bag.push(t);
  const reconAt = new Set();
  for (let i = 1; i <= CONFIG.RECON_COUNT; i++)
    reconAt.add(Math.max(0, Math.floor(i*(n-1)/(CONFIG.RECON_COUNT+1))));

  for (let i = 0; i < n-1; i++) {
    const t = pick(rng, bag), s = spec[t];
    out.push({ type:t, stat:s.stat, req:range(rng,s.req), str:range(rng,s.str), tr:s.tr });
    if (reconAt.has(i)) out.push({ type:'RECON', stat:null, req:0, str:0, tr:0 });
  }
  const c = spec.CORE;
  // 코어 주스탯도 분포를 따른다 (표적 성격이 마지막 관문에도 드러나야 한다)
  const coreStat = { CIPHER:'dec', NETWORK:'eva', PHYSICAL:'inf' }[pick(rng, bag)];
  out.push({ type:'CORE', stat:coreStat, req:range(rng,c.req), str:range(rng,c.str), tr:c.tr });
  return out;
}

// ════════════════════════════ 툴 생성 ════════════════════════════
export const budgetOf = (grade, effect, noise = 0) =>
  CONFIG.GRADE_TOTAL[grade] - (effect ? (CONFIG.EFFECT_COST[effect]||0) : 0)
  + noise * CONFIG.NOISE_BUDGET;

export function makeTool(name, grade, type, shape, noise, opts = {}) {
  const budget = budgetOf(grade, opts.effect, noise);
  const cap = CONFIG.GRADE_CAP[grade] + noise * CONFIG.NOISE_BUDGET * 0.6;
  const sum = shape.reduce((a,b)=>a+b,0);
  let v = shape.map(x => x/sum*budget);
  for (let it=0; it<8; it++) {
    let over=0; const free=[];
    for (let i=0;i<3;i++){ if(v[i]>cap){over+=v[i]-cap;v[i]=cap;} else free.push(i); }
    if (over<1e-9 || !free.length) break;
    for (const i of free) v[i]+=over/free.length;
  }
  const r = v.map(x=>Math.round(x));
  const d = budget - (r[0]+r[1]+r[2]);
  const mi = r.indexOf(Math.min(...r));
  r[mi] = Math.max(1, r[mi]+d);
  return { name, grade, type, noise,
    dec:r[0], eva:r[1], inf:r[2], sum:r[0]+r[1]+r[2],
    priv: opts.priv ?? 0,        // >0 축적 / −1 소비 / 0 무관
    effect: opts.effect };
}

// ════════════════════════════ 상태 ════════════════════════════
export function newRun(toolkit, rng, opts = {}) {
  const layers = opts.layers ?? buildTarget(rng, opts);
  const scoring = layers.filter(l => l.type !== 'RECON').length;
  const handSize = opts.handSize ?? Math.min(toolkit.length, scoring + CONFIG.HAND_EXTRA);
  const shuf = d => { const a=[...d];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a; };
  const t = shuf(toolkit);
  return {
    layers, layerIdx:0,
    access:0,                       // 누적 초과 달성분 (통계용)
    slack:0,                        // 이월 여유 — 뒤 계층의 미달을 흡수한다
    trace: opts.trace ?? 0,         // 이월 흔적
    priv:0,
    hand: t.slice(0,handSize),
    deck: t.slice(handSize),
    gear: [],
    resist:{ 정공:0, 우회:0, 강습:0 },
    alert:0,
    lastType:null,       // 직전에 낸 툴의 유형 (연계 조건)
    pending:null,        // 다음 계층 진입 시 발동할 예고
    active:null,         // 이번 계층에 발동 중인 대응
    sealed:null,
    buff:{},
    status:'running',
    log:[],
  };
}

const alertOf = trace => CONFIG.ALERT_STEPS.filter(t => trace >= t).length;

// ── 결정적 접근점수 (장비 버프 제외). 봇도 이 함수로 평가한다.
export function scoreOf(tool, layer, s) {
  if (!tool || !layer?.stat) return 0;
  const vals = { dec:tool.dec, eva:tool.eva, inf:tool.inf };
  const ef = tool.effect ? CONFIG.EFFECT[tool.effect] : null;
  // 적응: 계층 주스탯 대신 자신의 최고 스탯을 주스탯으로 삼는다
  const main = ef?.morph ? STATS.reduce((a,b)=>vals[a]>=vals[b]?a:b) : layer.stat;
  const others = STATS.filter(x=>x!==main).map(x=>vals[x]);
  const w = CONFIG.SUB_W;
  let v = vals[main]*(1-w) + ((others[0]+others[1])/2)*w;

  if (ef?.scoreMul) v *= ef.scoreMul;
  {
    const r = s.resist[tool.type] ?? 0;
    v *= Math.max(0, 1 - r*(CONFIG.RESIST_PEN[tool.type] ?? 0.1));
  }
  if (tool.priv < 0) v *= 1 + Math.min(CONFIG.PRIV_CAP, s.priv)*CONFIG.PRIV_MUL;

  // ── 조건부: 상태에 따라 강해진다
  if (ef?.alertBonus) v *= 1 + s.alert * ef.alertBonus;
  return v;
}

// ── 소음 (계층 계수·경계 반영)
export function noiseOf(tool, layer, s) {
  if (!tool) return 0;
  const ef = tool.effect ? CONFIG.EFFECT[tool.effect] : null;
  if (ef?.silent || s.buff.silent) return 0;
  return tool.noise * CONFIG.NOISE_SCALE * (ef?.noiseMul ?? 1)
       * (layer?.tr ?? 1) * (1 + s.alert*CONFIG.ALERT_MUL);
}

// ════════════════════════════ 장비 ════════════════════════════
export function useGear(s0, name) {
  const i = s0.gear.indexOf(name);
  if (i < 0) return s0;
  const s = { ...s0, gear:[...s0.gear], buff:{...s0.buff} };
  s.gear.splice(i,1);
  const g = CONFIG.GEAR[name], t0 = s.trace;
  if (g.kind==='access') s.buff.access = (s.buff.access||0)+g.v;
  if (g.kind==='trace')  s.trace = Math.max(0, s.trace-g.v);
  if (g.kind==='silent') s.buff.silent = true;
  if (g.kind==='cancel') { s.pending = null; s.active = null; }   // 예고·발동 양쪽 무효화
  s.alert = alertOf(s.trace);
  s.log = [...s.log, { kind:'GEAR', layerIdx:s.layerIdx, gear:name, dTrace:s.trace-t0, trace:s.trace }];
  return s;
}

// ════════════════════════════ 계층 해결 ════════════════════════════
export function resolveLayer(s0, tool, rng) {
  const s = { ...s0, resist:{...s0.resist}, buff:{...s0.buff},
              gear:[...s0.gear], hand:[...s0.hand], deck:[...s0.deck] };
  const L = s.layers[s.layerIdx];

  if (L.type === 'RECON') {
    const names = Object.keys(CONFIG.GEAR);
    const got = names[Math.floor(rng()*names.length)];
    if (s.gear.length < CONFIG.GEAR_CAP) s.gear.push(got);
    s.log = [...s.log, { kind:'RECON', layerIdx:s.layerIdx, gear:got, trace:s.trace }];
    s.layerIdx++;
    return advance(s);
  }

  // active = 이번 계층에 "실제로 발동 중"인 대응. pending = 다음 계층 진입 시 발동할 예고.
  // ⚠️ 둘을 한 필드로 합치면 advance() 가 예고를 지우면서 요구치 상승이 영구 사문화된다.
  let req = L.req;
  if (s.active === '요구치 상승') req *= 1 + CONFIG.COUNTER_REQ_UP;


  // 손패 소진 등으로 제출할 툴이 없는 경우 = 강제 패스. 접근 0, 미달분 전액 TRACE.
  const base  = scoreOf(tool, L, s);
  const acc   = (base + (s.buff.access||0)) * L.str;
  const noise = noiseOf(tool, L, s);
  const ef = tool?.effect ? CONFIG.EFFECT[tool.effect] : null;
  // 백도어: 요구치 판정을 건너뛴다 (미달 페널티 없음, 초과 이득도 없음)
  const short = ef?.bypass ? 0 : Math.max(0, req - acc);
  const over  = ef?.bypass ? 0 : Math.max(0, acc - req);

  // 초과분은 여유로 적립, 미달분은 먼저 여유로 상쇄한 뒤 남은 만큼만 흔적이 된다
  if (ef?.slackGain) s.slack = Math.min(CONFIG.SLACK_CAP, s.slack + ef.slackGain);
  const absorbed = Math.min(s.slack, short);
  s.slack = Math.min(CONFIG.SLACK_CAP, s.slack - absorbed + over*CONFIG.SLACK_KEEP);
  const netShort = short - absorbed;

  let dTrace = noise + netShort*CONFIG.SHORTFALL - (ef?.traceCut ?? 0) + (ef?.bypassTrace ?? 0);

  s.trace  = Math.max(0, s.trace + dTrace);
  s.access += over;

  if (tool) {
    if (tool.priv > 0) s.priv = Math.min(CONFIG.PRIV_CAP, s.priv + tool.priv);
    else if (tool.priv < 0) s.priv = 0;

    for (const t of TYPES) {
      if (t === tool.type) s.resist[t] = Math.min(CONFIG.RESIST_CAP, s.resist[t]+CONFIG.RESIST_UP);
      else s.resist[t] = Math.max(0, s.resist[t]-CONFIG.RESIST_DOWN);
    }
    s.hand = s.hand.filter(c => c !== tool);
    s.lastType = tool.type;
  }

  s.buff = {};
  s.alert = alertOf(s.trace);
  s.log = [...s.log, { kind:'LAYER', layerIdx:s.layerIdx, type:L.type, stat:L.stat,
    tool: tool ? tool.name : null, toolType: tool ? tool.type : null,
    req, acc, short, over, absorbed, netShort, noise, dTrace,
    trace:s.trace, access:s.access, slack:s.slack, priv:s.priv, alert:s.alert }];

  s.layerIdx++;
  if (s.trace >= CONFIG.TRACE_MAX) { s.status='failed'; return s; }
  if (s.layerIdx >= s.layers.length) { s.status='success'; return s; }
  return advance(s);
}

// ── 계층 진입 시: ① 예고된 대응 발동 → ② 다음 계층 예고
//    예고는 진입 시점에 나가고, 한 계층을 플레이한 뒤 다음 진입에서 발동한다.
//    즉 플레이어에게는 항상 정확히 1계층의 대비 기회가 있다 (PRD 인과 규칙).
function advance(s0) {
  const s = { ...s0 };
  if (s.status !== 'running') return s;

  // 정찰 계층은 툴을 내지 않으므로 예고를 소비하지도, 새로 발행하지도 않는다.
  // 그대로 통과시켜야 예고가 항상 "채점 계층 1개만큼의 대비 기회"를 보장한다.
  if (s.layers[s.layerIdx]?.type === 'RECON') return s;

  const fire = s.pending;
  s.pending = null;
  s.active  = null;

  // 예고했는데 조건이 안 맞아 조용히 사라지면 인과가 끊긴다. 불발도 반드시 로깅한다.
  if (fire && fire !== '툴 봉인' && fire !== '권한 초기화' &&
      fire !== '요구치 상승' && fire !== '추적 가속') fire = null;
  if (fire === '툴 봉인' && s.hand.length <= 1) {
    s.log = [...s.log, { kind:'FIZZLE', layerIdx:s.layerIdx, counter:fire, why:'손패 부족' }];
  } else if (fire === '권한 초기화' && s.priv === 0) {
    s.log = [...s.log, { kind:'FIZZLE', layerIdx:s.layerIdx, counter:fire, why:'권한 없음' }];
  } else if (fire === '툴 봉인') {
    const L = s.layers[s.layerIdx];
    const best = s.hand.reduce((b,c)=> scoreOf(c,L,s) > scoreOf(b,L,s) ? c : b);
    s.sealed = best.name;
    s.hand = s.hand.filter(c=>c!==best);
    s.log = [...s.log, { kind:'COUNTER', layerIdx:s.layerIdx, counter:'툴 봉인', target:best.name }];
  } else if (fire === '권한 초기화') {
    s.priv = 0;
    s.log = [...s.log, { kind:'COUNTER', layerIdx:s.layerIdx, counter:'권한 초기화' }];
  } else if (fire === '추적 가속') {
    s.trace += CONFIG.COUNTER_TRACE;
    s.alert = alertOf(s.trace);
    s.log = [...s.log, { kind:'COUNTER', layerIdx:s.layerIdx, counter:'추적 가속',
                         dTrace:CONFIG.COUNTER_TRACE, trace:s.trace }];
    if (s.trace >= CONFIG.TRACE_MAX) { s.status='failed'; return s; }
  } else if (fire === '요구치 상승') {
    s.active = '요구치 상승';        // 이번 계층 판정에서 소비된다
    s.log = [...s.log, { kind:'COUNTER', layerIdx:s.layerIdx, counter:'요구치 상승' }];
  }

  if (s.alert >= CONFIG.COUNTER_FROM && s.layerIdx < s.layers.length) {
    s.pending = pickCounter(s);
    s.log = [...s.log, { kind:'WARN', layerIdx:s.layerIdx, counter:s.pending }];
  }
  return s;
}

// ── 대응 선택: 순환하되 **지금 무해한 대응은 건너뛴다**.
//    고정 순환만 쓰면 상대에게 아무 효과 없는 대응이 자주 나온다
//    (측정: `권한 초기화` 평균 손해 5점, 나머지 셋은 141~192점).
//    반대로 "가장 아픈 것"을 고르게 하면 손해 추정치의 척도가 대응마다 달라
//    한 종류로 쏠린다 (툴 봉인 93%). 순환 + 유효성 필터가 둘 다 피한다.
//    RNG 를 쓰지 않으므로 결정론과 리플레이는 그대로다.
function pickCounter(s) {
  const nextIdx = s.layers.findIndex((l,i) => i >= s.layerIdx && l.type !== 'RECON');
  const L = s.layers[nextIdx] ?? s.layers[s.layerIdx];
  // ⚠️ 유효성은 **발동 시점** 상태로 판단해야 한다. 예고는 지금, 발동은 한 계층 뒤라
  //    그 사이에 카드를 한 장 낸다. 지금 손패로 판단하면 발동 시 조용히 불발한다.
  const viable = {
    '툴 봉인':      s.hand.length - 1 > 1,
    '권한 초기화':  s.priv > 0 && s.hand.some(c => c.priv < 0),
    // 여유가 두둑하면 요구치 상승은 그대로 흡수돼 무해하다
    '요구치 상승':  s.slack < (L?.req ?? 0) * CONFIG.COUNTER_REQ_UP,
    '추적 가속':    true,
  };
  const menu = ['툴 봉인','권한 초기화','요구치 상승','추적 가속'].filter(k => viable[k]);
  return menu[(s.layerIdx + s.alert) % menu.length];
}


// ════════════════════════════ 점수 ════════════════════════════
export function score(s) {
  if (s.status !== 'success') return 0;
  return Math.round(500 + (CONFIG.TRACE_MAX - s.trace)*5 + s.hand.length*30
                        + s.slack*CONFIG.OVERFLOW_KEEP);
}
export const result = s => s.status;
