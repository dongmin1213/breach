// ════════════════════════════════════════════════════════════════
//  BREACH — 봇 사다리
//
//  설계 원칙: 봇은 자체 평가식을 갖지 않고 **엔진을 직접 롤아웃**한다.
//  이전 프로젝트에서 봇의 내부 모델이 엔진과 어긋나(리필 가정) 모든 지표가
//  편향된 사고가 있었다. 롤아웃 방식은 그 버그 클래스를 원천 차단한다.
// ════════════════════════════════════════════════════════════════
import { CONFIG, resolveLayer, useGear, scoreOf, noiseOf, score, TYPES } from './engine.mjs';

// 롤아웃 전용 결정론 rng (정찰 장비 추첨용). 실측 rng 와 분리.
const fixedRng = () => { let x = 0x9e3779b9; return () => (x = (x*1664525+1013904223)>>>0) / 4294967296; };

// ── 상태 평가.
//    ⚠️ 사다리의 모든 봇은 **같은 목적함수**를 최적화해야 비교가 성립한다.
//       탐색 깊이만 다르게 한다. 목적함수가 다르면 "더 똑똑한 봇"이란 말이 무의미하다.
//       그래서 실제 점수 공식(score)을 그대로 쓴다. 실패는 진행도만큼만 부분점수.
export function evalState(s) {
  if (s.status === 'failed') return -100000 + s.layerIdx * 100;
  if (s.status === 'running') return -50000 + s.layerIdx * 100;   // 롤아웃 미완료 = 버그
  return score(s);
}

// ── 한 판을 정책으로 끝까지 진행
export function playOut(s0, policy, rng, gearPolicy = defaultGear) {
  let s = s0;
  let guard = 0;
  while (s.status === 'running' && guard++ < 64) {
    const L = s.layers[s.layerIdx];
    if (L.type === 'RECON') { s = resolveLayer(s, null, rng); continue; }
    if (gearPolicy) { const g = gearPolicy(s); if (g) s = useGear(s, g); }
    const t = s.hand.length ? policy(s) : null;
    s = resolveLayer(s, t, rng);
  }
  return s;
}

// ════════════════════════════ 장비 정책 ════════════════════════════
// ⚠️ 아껴 쓰는 정책은 함정이다. 장비는 런이 끝나면 소멸하므로 "안 쓴 장비 = 0점".
//    이전 프로젝트에서 보수적 아이템 정책이 단순 정책에 62.5% 로 지면서
//    그 정책으로 잰 아이템 지표가 전부 편향됐다. 여기서는 조건 나열이 아니라
//    **이번 계층의 실측 이득**을 직접 계산해서 고른다.

// 이번 계층에서 손패 최선수가 만드는 흔적 증가분
function bestDelta(s) {
  const L = s.layers[s.layerIdx];
  if (!L || L.type === 'RECON' || !s.hand.length) return Infinity;
  const req = L.req * (s.active === '요구치 상승' ? 1+CONFIG.COUNTER_REQ_UP : 1);
  let best = Infinity;
  for (const c of s.hand) {
    const ef = c.effect ? CONFIG.EFFECT[c.effect] : null;
    const acc = (scoreOf(c, L, s) + (s.buff.access||0)) * L.str;
    const d = noiseOf(c, L, s)
      + (ef?.bypass ? 0 : Math.max(0, req-acc-s.slack-(ef?.slackGain??0))*CONFIG.SHORTFALL)
      - (ef?.traceCut ?? 0) + (ef?.bypassTrace ?? 0);
    if (d < best) best = d;
  }
  return best;
}

export function defaultGear(s) {
  if (!s.gear.length) return null;
  const L = s.layers[s.layerIdx];
  if (!L || L.type === 'RECON') return null;

  const remain = s.layers.slice(s.layerIdx).filter(l => l.type !== 'RECON').length;
  const base = bestDelta(s);
  let best = null, bestGain = 0;

  for (const g of new Set(s.gear)) {
    const after = useGear(s, g);
    // 소거기는 즉시 흔적을 깎으므로 그 감소분도 이득에 포함
    const gain = (s.trace - after.trace) + (base - bestDelta(after));
    if (gain > bestGain) { bestGain = gain; best = g; }
  }
  // 예고된 대응은 흔적 계산에 안 잡히지만 실질 손해가 크다
  if (s.pending && s.gear.includes('분석기') && bestGain < 8) return '분석기';

  // 남은 계층이 보유 장비 수 이하면 아껴봐야 소멸 → 이득이 조금이라도 있으면 쓴다
  const dump = remain <= s.gear.length;
  if (best && (bestGain >= 4 || dump)) return best;
  return null;
}
export const noGear = () => null;

// ════════════════════════════ 정책들 ════════════════════════════

// L0 무작위
const random = rng => s => s.hand[Math.floor(rng()*s.hand.length)];

// L1 탐욕 — 이번 계층의 요구치를 넘기는 것만 본다
const greedy = () => s => {
  const L = s.layers[s.layerIdx];
  return s.hand.reduce((b,c) => scoreOf(c,L,s) > scoreOf(b,L,s) ? c : b);
};

// L2 절약 — 이번 계층 즉시 TRACE 증가분을 최소화
const thrifty = () => s => {
  const L = s.layers[s.layerIdx];
  const cost = c => {
    const acc = scoreOf(c,L,s)*L.str;
    const ef = c.effect ? CONFIG.EFFECT[c.effect] : null;
    return noiseOf(c,L,s)
      + (ef?.bypass ? 0 : Math.max(0, L.req-acc-s.slack-(ef?.slackGain??0))*CONFIG.SHORTFALL)
      - (ef?.traceCut ?? 0) + (ef?.bypassTrace ?? 0);
  };
  return s.hand.reduce((b,c) => cost(c) < cost(b) ? c : b);
};

// L3 배정 — 남은 계층 전체에 손패를 배정하고 2-opt 로 개선.
//    ⚠️ 계획 비용은 반드시 **순차적으로** 계산해야 한다. 계층별 비용을 독립 합산하면
//       저항 누적과 경계 증폭(초반 흔적이 후반 소음을 키움)을 놓쳐 근시안 봇보다 나빠진다.
const assign = () => s => {
  const rest = s.layers.slice(s.layerIdx).filter(l => l.type !== 'RECON');
  if (rest.length <= 1) return thrifty()(s);
  const hand = [...s.hand];

  // 계획 전체를 순차 시뮬레이션한 예상 최종 흔적 (엔진 호출 없이 산술만)
  const total = p => {
    let trace = s.trace, alert = s.alert, slack = s.slack, lastT = s.lastType;
    const res = { ...s.resist };
    for (let i = 0; i < rest.length; i++) {
      const L = rest[i], j = p[i];
      if (j === null) { trace += Math.max(0, L.req-slack) * CONFIG.SHORTFALL; slack = 0; continue; }
      const c = hand[j], ef = c.effect ? CONFIG.EFFECT[c.effect] : null;
      // 접근점수: 이 시점의 저항 상태를 반영
      const vals = { dec:c.dec, eva:c.eva, inf:c.inf };
      const mainS = ef?.morph ? Object.keys(vals).reduce((a,b)=>vals[a]>=vals[b]?a:b) : L.stat;
      const o = Object.keys(vals).filter(k=>k!==mainS).map(k=>vals[k]);
      let v = vals[mainS]*(1-CONFIG.SUB_W) + ((o[0]+o[1])/2)*CONFIG.SUB_W;
      if (ef?.scoreMul) v *= ef.scoreMul;
      v *= Math.max(0, 1 - (res[c.type]||0)*(CONFIG.RESIST_PEN[c.type]??0.1));
      if (ef?.alertBonus) v *= 1 + alert * ef.alertBonus;


      const acc = v * L.str;
      const noise = (ef?.silent ? 0
        : c.noise*CONFIG.NOISE_SCALE*(ef?.noiseMul??1)*L.tr*(1+alert*CONFIG.ALERT_MUL));

      if (ef?.slackGain) slack = Math.min(CONFIG.SLACK_CAP, slack + ef.slackGain);
      lastT = c.type;
      const reqL = L.req;
      const sh = ef?.bypass ? 0 : Math.max(0, reqL-acc), ab = Math.min(slack, sh);
      slack = Math.min(CONFIG.SLACK_CAP, slack - ab
        + (ef?.bypass ? 0 : Math.max(0,acc-reqL))*CONFIG.SLACK_KEEP);
      trace = Math.max(0, trace + noise + (sh-ab)*CONFIG.SHORTFALL
        - (ef?.traceCut??0) + (ef?.bypassTrace??0));
      alert = CONFIG.ALERT_STEPS.filter(t => trace >= t).length;
      for (const t of TYPES)
        res[t] = t===c.type ? Math.min(CONFIG.RESIST_CAP,(res[t]||0)+CONFIG.RESIST_UP)
                            : Math.max(0,(res[t]||0)-CONFIG.RESIST_DOWN);
      if (trace >= CONFIG.TRACE_MAX) return trace + (rest.length-i)*50;   // 조기 실패는 크게 감점
      if (ef?.recycle) p = p;   // 회수 카드는 다음 계층에도 남지만 배정 모델에선 단순화
    }
    return trace;
  };

  // 초기 배정: 요구 압력이 큰 계층부터 근시안 최선 카드
  const order = rest.map((L,i)=>i).sort((a,b)=>rest[b].req*rest[b].tr - rest[a].req*rest[a].tr);
  const pickd = new Array(rest.length).fill(null); const used = new Set();
  for (const i of order) {
    const L = rest[i];
    let best=null,bv=Infinity;
    hand.forEach((c,j)=>{ if(used.has(j))return;
      const ef = c.effect ? CONFIG.EFFECT[c.effect] : null;
      const v = noiseOf(c,L,s) + Math.max(0,L.req-scoreOf(c,L,s)*L.str)*CONFIG.SHORTFALL - (ef?.traceCut??0);
      if (v<bv){bv=v;best=j;} });
    if (best!==null){ pickd[i]=best; used.add(best); }
  }
  // 2-opt: 배정 교환 + 미배정 카드와의 교체
  let cur = total(pickd);
  for (let pass=0; pass<4; pass++) {
    let improved=false;
    for (let a=0;a<rest.length;a++) {
      for (let b=a+1;b<rest.length;b++) {
        const p=[...pickd]; [p[a],p[b]]=[p[b],p[a]];
        const v=total(p); if (v<cur-1e-9){ pickd[a]=p[a]; pickd[b]=p[b]; cur=v; improved=true; }
      }
      for (let j=0;j<hand.length;j++) {
        if (used.has(j)) continue;
        const p=[...pickd]; const old=p[a]; p[a]=j;
        const v=total(p); if (v<cur-1e-9){ pickd[a]=j; used.delete(old); used.add(j); cur=v; improved=true; }
      }
    }
    if (!improved) break;
  }
  // ⚠️ 손패가 10장이 되면서 정적 계획이 근시안 봇보다 나빠졌다 (52.8% < 53.7%).
  //    원인: total() 은 능동 대응·장비를 모델에 넣지 않는데, 손패가 커지며 대응 빈도가
  //    올라 계획이 자주 무너진다. 자기 평가함수끼리 비교해봐야 같은 편향을 공유한다.
  //    → 두 후보(계획 첫수 · 근시안 첫수)를 **실제 엔진으로 1계층 굴려** 비교한다.
  //      모델이 아니라 현실로 판정하므로 계획 봇이 근시안 봇에게 질 수 없다.
  const myopic = thrifty()(s);
  const planned = pickd[0]!==null ? hand[pickd[0]] : myopic;
  if (planned === myopic) return planned;
  const probe = c => {
    const r = fixedRng();
    let a = resolveLayer(s, c, r);
    while (a.status==='running' && a.layers[a.layerIdx].type==='RECON') a = resolveLayer(a, null, r);
    if (a.status !== 'running') return a.status==='success' ? -1e6 : 1e6;
    // 남은 계층을 같은 계획 모델로 평가 — 단, 실제로 한 수 둔 뒤의 상태에서
    return a.trace + (a.layers.length - a.layerIdx) * 8 - a.slack * 0.5;
  };
  return probe(planned) <= probe(myopic) ? planned : myopic;
};

// ── 후보 열거: 이름이 같은 툴은 하나만 (동일 효과이므로 탐색 낭비)
const cands = hand => { const seen=new Set(), out=[];
  for (const c of hand) if (!seen.has(c.name)) { seen.add(c.name); out.push(c); }
  return out; };

// ── 1수 두고 정책 P 로 끝까지 롤아웃한 뒤 목적함수 평가
const rollout = (s, c, P) => {
  const r = fixedRng();
  const after = resolveLayer(s, c, r);
  return evalState(after.status === 'running' ? playOut(after, P, r, defaultGear) : after);
};

// L4 심층 — 1수 전탐색 + 배정 정책 롤아웃
const deep = () => s => {
  let best=null, bv=-Infinity;
  for (const c of cands(s.hand)) { const v = rollout(s, c, assign()); if (v>bv){bv=v;best=c;} }
  return best ?? s.hand[0];
};

// L5 대응 — 2수 전탐색. 각 1수 후 다음 계층도 전탐색한 뒤 배정 롤아웃.
//    저항·경계는 두 수에 걸쳐 누적되므로 여기서부터 유형 분산이 자연히 나온다.
const counter = () => s => {
  const A = assign();
  let best=null, bv=-Infinity;
  for (const c of cands(s.hand)) {
    const r = fixedRng();
    let mid = resolveLayer(s, c, r);
    while (mid.status==='running' && mid.layers[mid.layerIdx].type==='RECON')
      mid = resolveLayer(mid, null, r);
    let v;
    if (mid.status !== 'running' || !mid.hand.length) {
      v = evalState(mid.status==='running' ? playOut(mid, A, r, defaultGear) : mid);
    } else {
      v = -Infinity;
      const g = defaultGear(mid); const m2 = g ? useGear(mid, g) : mid;
      for (const c2 of cands(m2.hand)) v = Math.max(v, rollout(m2, c2, A));
    }
    if (v>bv){bv=v;best=c;}
  }
  return best ?? s.hand[0];
};

// 빈 손패 가드 — `툴 봉인`이 발동하면 손패가 0 장이 될 수 있다.
// playOut 은 막지만 정책을 직접 호출하는 감사 코드가 터진다. 정책 자체에서 막는다.
const guard = mk => rngArg => { const p = mk(rngArg);
  return s => (!s.hand || s.hand.length === 0) ? null : p(s); };

export const BOTS = Object.fromEntries(
  Object.entries({ random, greedy, thrifty, assign, deep, counter })
        .map(([k,v]) => [k, guard(v)]));
export const LADDER = ['random','greedy','thrifty','assign','deep','counter'];
export const make = (name, rng) => BOTS[name](rng);
