// ════════════════════════════════════════════════════════════════
//  골든 픽스처 생성 — Dart 포팅의 정답지
//
//  225개 감사가 전부 "같은 시드 → 같은 결과" 위에 서 있다.
//  데일리 모드도, 서버 검증도, 밸런스 수치의 의미도 전부 그 속성이다.
//  Dart 로 옮기면서 PRNG 가 한 비트라도 어긋나면 그 순간
//  **감사 225개는 출시될 게임을 설명하지 않게 된다.**
//
//  가장 위험한 곳: mulberry32 의 Math.imul / >>>0 / |0.
//    JS  — 32비트 정수 연산
//    Dart 네이티브 — 64비트 int
//    Dart 웹(dart2js) — double (2^53 넘으면 정밀도 소실)
//  그래서 Dart 쪽은 16비트 분할 곱셈으로 imul 을 직접 구현해야 하고,
//  그게 맞았는지는 이 파일이 판정한다.
//
//  실행: node sim/golden.mjs  →  test/golden.json
import { writeFileSync, mkdirSync } from 'node:fs';
import * as L from './lib.mjs';
import { TARGETS, TARGET_KEYS, applyTarget, resetTarget } from './core/targets.mjs';
const { rng, newRun, resolveLayer, useGear, playOut, make, defaultGear,
        score, randKit, CONFIG, TOOLKIT, DECK_SIZE } = L;

const N_PRNG    = 2000;   // PRNG 출력 직접 비교
const N_TOOLS   = TOOLKIT.length;
const N_TARGETS = 300;    // 표적 생성
const N_RUNS    = 400;    // 전체 플레이 로그
const BOT = 'assign';

const r6 = x => typeof x === 'number' ? Number(x.toFixed(6)) : x;
// 로그는 카드 이름(표시 문자열)을 담지만 골든은 **id 기준**이어야 한다.
// 이름은 l10n 으로 옮겨갔고 언어마다 다르므로 비교 기준이 될 수 없다.
const toId = new Map(TOOLKIT.map(t => [t.name, t.id]));
const cid = n => n == null ? null : (toId.get(n) ?? n);
// 등급·유형·효과·장비·대응도 마찬가지 — 한글은 표시 문자열이지 식별자가 아니다.
import { GRADE_ID, TYPE_ID, EFFECT_ID, GEAR_KO } from './core/balance.mjs';
const GEAR_ID = Object.fromEntries(Object.entries(GEAR_KO).map(([k,v])=>[v,k]));
const CTR_ID = { '툴 봉인':'seal', '권한 초기화':'priv_reset',
                 '요구치 상승':'req_up', '추적 가속':'trace_boost' };

// ── 1. PRNG 원시 출력 ────────────────────────────────────────
const prng = [];
for (const seed of [1, 7, 42, 1000, 65535, 123456789, 4294967295]) {
  const g = rng(seed);
  prng.push({ seed, out: Array.from({length: 12}, () => r6(g())) });
}
{
  const g = rng(20260802); let acc = 0;
  for (let i = 0; i < N_PRNG; i++) acc += g();
  prng.push({ seed: 20260802, sumOf: N_PRNG, sum: r6(acc) });
}

// ── 2. 카드 파생 (예산 규칙이 같은 값을 내는가) ──────────────
const cards = TOOLKIT.map(t => ({
  id: t.id, grade: GRADE_ID[t.grade], type: TYPE_ID[t.type], noise: t.noise,
  dec: t.dec, eva: t.eva, inf: t.inf, sum: t.sum,
  priv: t.priv, effect: t.effect ? EFFECT_ID[t.effect] : null,
}));

// ── 3. 표적 생성 ─────────────────────────────────────────────
const targets = [];
for (let i = 0; i < N_TARGETS; i++) {
  const tid = TARGET_KEYS[i % TARGET_KEYS.length];
  const opts = applyTarget(tid);
  const seed = 500000 + i;
  const layers = L.buildTarget(rng(seed), opts);
  targets.push({ target: tid, seed,
    layers: layers.map(l => ({ type:l.type, stat:l.stat ?? null,
      req:r6(l.req), str:r6(l.str), tr:r6(l.tr) })) });
}
resetTarget();

// ── 4. 덱 추첨 ───────────────────────────────────────────────
const decks = [];
for (let i = 0; i < 60; i++) {
  const seed = 700000 + i;
  decks.push({ seed, cards: randKit(seed).map(c => c.id) });
}

// ── 5. 전체 플레이 로그 ──────────────────────────────────────
const runs = [];
for (let i = 0; i < N_RUNS; i++) {
  const tid = TARGET_KEYS[i % TARGET_KEYS.length];
  const opts = applyTarget(tid);
  const seed = 7000000 + i;
  const r = rng(seed);
  const s0 = newRun(randKit(seed), r, opts);
  const s = playOut(s0, make(BOT, r), r, defaultGear);
  runs.push({
    target: tid, seed, bot: BOT,
    hand0: s0.hand.map(c => c.id),
    status: s.status, trace: r6(s.trace), slack: r6(s.slack),
    score: score(s), layerIdx: s.layerIdx,
    log: s.log.map(e => {
      const o = { k: e.kind, i: e.layerIdx };
      if (e.kind === 'LAYER') Object.assign(o, {
        t: e.type, tool: cid(e.tool), req:r6(e.req), acc:r6(e.acc),
        short:r6(e.short), over:r6(e.over), abs:r6(e.absorbed),
        noise:r6(e.noise), d:r6(e.dTrace),
        tr:r6(e.trace), sl:r6(e.slack), p:e.priv, a:e.alert });
      if (e.kind === 'RECON')   o.g = GEAR_ID[e.gear];
      if (e.kind === 'GEAR')    { o.g = GEAR_ID[e.gear]; o.d = r6(e.dTrace); }
      if (e.kind === 'WARN' || e.kind === 'COUNTER' || e.kind === 'FIZZLE') o.c = CTR_ID[e.counter] ?? e.counter;
      if (e.kind === 'COUNTER' && e.target) o.tgt = cid(e.target);
      return o;
    }),
  });
}
resetTarget();

const out = {
  note: 'BREACH 골든 픽스처 — Dart 엔진이 이 값을 한 글자도 안 틀리고 재현해야 한다',
  generatedFrom: 'node sim/golden.mjs',
  balanceVersion: L.CONFIG ? 1 : 1,
  deckSize: DECK_SIZE, toolCount: N_TOOLS,
  prng, cards, targets, decks, runs,
};
mkdirSync(new URL('../test/', import.meta.url), { recursive: true });
const path = new URL('../test/golden.json', import.meta.url);
writeFileSync(path, JSON.stringify(out));
const kb = (JSON.stringify(out).length / 1024).toFixed(0);
console.log(`test/golden.json — PRNG ${prng.length}조 · 카드 ${cards.length} · 표적 ${targets.length}` +
            ` · 덱 ${decks.length} · 런 ${runs.length} (${kb} KB)`);
console.log(`로그 이벤트 총 ${runs.reduce((a,r)=>a+r.log.length,0)}개`);
