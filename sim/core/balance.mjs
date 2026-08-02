// ════════════════════════════════════════════════════════════════
//  수치 단일 원본 로더
//
//  ⚠️ 밸런스 수치를 코드에 박아두면 시뮬레이터가 검증한 값과 앱이 쓰는 값이 갈라진다.
//     assets/balance.json 하나만 고치면 sim 이 그 값을 검증하고 앱이 그 값으로 돈다.
//     텍스트는 여기 없다 — assets/l10n/*.json 에 있다.
//
//  이 파일은 JSON(영문 id)을 엔진 내부 표현(한글 키)으로 옮기는 어댑터다.
//  Dart 포팅 시에는 이 매핑 없이 영문 id 를 그대로 쓰면 된다.
// ════════════════════════════════════════════════════════════════
import DATA from '../../assets/balance.json' with { type: 'json' };

export const TYPE_KO  = { direct:'정공', bypass_t:'우회', assault:'강습' };
export const GRADE_KO = { basic:'기본', elite:'정예', prime:'전설' };
export const EFFECT_KO= { cloak:'은폐', wipe:'소거', morph:'적응', overload:'과부하',
                          bypass:'백도어', scout:'정찰', frenzy:'폭주' };
export const GEAR_KO  = { amp:'증폭기', scrub:'소거기', veil:'위장막', analyzer:'분석기' };
export const LAYER_UP = { cipher:'CIPHER', network:'NETWORK', physical:'PHYSICAL', core:'CORE' };

const inv = o => Object.fromEntries(Object.entries(o).map(([k,v]) => [v,k]));
export const TYPE_ID = inv(TYPE_KO), GRADE_ID = inv(GRADE_KO), EFFECT_ID = inv(EFFECT_KO);

const R = DATA.rules;
const key = (o, map) => Object.fromEntries(Object.entries(o).map(([k,v]) => [map[k] ?? k, v]));

// 엔진이 기대하는 CONFIG 형태로 변환
export const CONFIG = {
  SUB_W: R.subWeight, SHORTFALL: R.shortfall, NOISE_SCALE: R.noiseScale,
  SLACK_KEEP: R.slackKeep, SLACK_CAP: R.slackCap, OVERFLOW_KEEP: R.overflowKeep,
  HAND_EXTRA: R.handExtra, LAYERS_MIN: R.layersMin, LAYERS_MAX: R.layersMax,
  TRACE_MAX: R.traceMax,
  PRIV_MUL: R.privMul, PRIV_CAP: R.privCap,
  RESIST_UP: R.resistUp, RESIST_DOWN: R.resistDown, RESIST_CAP: R.resistCap,
  RESIST_PEN: key(R.resistPenalty, TYPE_KO),
  ALERT_STEPS: [...R.alertSteps], ALERT_MUL: R.alertMul, COUNTER_FROM: R.counterFrom,
  COUNTER_REQ_UP: R.counterReqUp, COUNTER_TRACE: R.counterTrace,
  RECON_COUNT: R.reconCount,
  NOISE_BUDGET: R.noiseBudget,
  GRADE_TOTAL: key(R.gradeTotal, GRADE_KO),
  GRADE_CAP:   key(R.gradeCap,   GRADE_KO),
  EFFECT_COST: key(R.effectCost, EFFECT_KO),
  LAYER: Object.fromEntries(Object.entries(DATA.layers).map(([k,v]) =>
    [LAYER_UP[k], { stat:v.stat, req:[...v.req], str:[...v.strength], tr:v.traceMul }])),
  LAYER_MIX: { CIPHER:1, NETWORK:1, PHYSICAL:1 },
  EFFECT: key(DATA.effects, EFFECT_KO),
  GEAR:   key(DATA.gear,    GEAR_KO),
  GEAR_CAP: R.gearCap ?? 2,
};

// 카드 정의 — 스탯은 엔진의 makeTool 이 예산에서 파생시킨다 (수치를 손으로 안 적는다)
export const CARDS = DATA.cards.map(c => ({
  id: c.id,
  grade: GRADE_KO[c.grade], type: TYPE_KO[c.type],
  shape: c.shape, noise: c.noise,
  priv: c.priv ?? 0, effect: c.effect ? EFFECT_KO[c.effect] : undefined,
}));

export const TARGETS_DATA = DATA.targets;
export const DECK_SIZE = R.deckSize;
export const RAW = DATA;
