// ════════════════════════════════════════════════════════════════
//  표적 원형 — 정의는 assets/balance.json 의 targets 배열에 있다.
//
//  ⚠️ 원형은 **레버로** 구분해야 한다. 이름만 바꾸면 겹친다.
//     초판에서 6종 중 4종이 글자 그대로 같은 최적 덱을 뽑았다.
//     덱 구성을 바꾸는 레버는 **계층 유형 분포(layerMix)** 하나뿐이다 —
//     저항·손패·능동대응은 플레이 방식만 바꾸고 덱 선택은 안 바꾼다.
//
//  원형을 추가하면 `node sim/buildcheck.mjs` 로 교차 행렬을 돌려
//  전용 덱이 1위이고 홈 어드밴티지가 8%p 이상인지 확인할 것.
// ════════════════════════════════════════════════════════════════
import { CONFIG } from './engine.mjs';
import { TARGETS_DATA, LAYER_UP } from './balance.mjs';
import KO from '../../assets/l10n/ko.json' with { type: 'json' };

// 원본 스냅샷 — 원형 적용은 항상 원본에서 출발한다
const BASE = {
  layer: JSON.parse(JSON.stringify(CONFIG.LAYER)),
  RESIST_UP: CONFIG.RESIST_UP, RESIST_DOWN: CONFIG.RESIST_DOWN,
  HAND_EXTRA: CONFIG.HAND_EXTRA, COUNTER_FROM: CONFIG.COUNTER_FROM,
  ALERT_STEPS: [...CONFIG.ALERT_STEPS], COUNTER_REQ_UP: CONFIG.COUNTER_REQ_UP,
  SLACK_KEEP: CONFIG.SLACK_KEEP, LAYER_MIX: { ...CONFIG.LAYER_MIX },
};
const FIELD = { resistUp:'RESIST_UP', resistDown:'RESIST_DOWN', handExtra:'HAND_EXTRA',
                counterFrom:'COUNTER_FROM', alertSteps:'ALERT_STEPS',
                counterReqUp:'COUNTER_REQ_UP', slackKeep:'SLACK_KEEP' };

export function resetTarget() {
  for (const k of Object.keys(BASE.layer)) {
    CONFIG.LAYER[k].req = [...BASE.layer[k].req];
    CONFIG.LAYER[k].tr  = BASE.layer[k].tr;
  }
  for (const f of Object.values(FIELD))
    CONFIG[f] = Array.isArray(BASE[f]) ? [...BASE[f]] : BASE[f];
  CONFIG.LAYER_MIX = { ...BASE.LAYER_MIX };
}

export const TARGETS = Object.fromEntries(TARGETS_DATA.map(t => [t.id, {
  id: t.id,
  name: KO[`target.${t.id}.name`] ?? t.id,
  line: KO[`target.${t.id}.line`] ?? '',
  desc: KO[`target.${t.id}.desc`] ?? '',
  layerCount: t.layerCount,
  spec: t,
}]));
export const TARGET_KEYS = Object.keys(TARGETS);

// 표적을 적용하고 newRun 에 넘길 opts 를 돌려준다. resetTarget 과 짝으로 쓴다.
export function applyTarget(id) {
  resetTarget();
  const t = TARGETS[id]; if (!t) return {};
  const s = t.spec;
  if (s.reqScale)   for (const k of Object.keys(BASE.layer))
                      CONFIG.LAYER[k].req = BASE.layer[k].req.map(x => x * s.reqScale);
  if (s.traceScale) for (const k of Object.keys(BASE.layer))
                      CONFIG.LAYER[k].tr = BASE.layer[k].tr * s.traceScale;
  if (s.layerMix)   CONFIG.LAYER_MIX = Object.fromEntries(
                      Object.entries(s.layerMix).map(([k,v]) => [LAYER_UP[k], v]));
  if (s.overrides)  for (const [k,v] of Object.entries(s.overrides))
                      CONFIG[FIELD[k]] = Array.isArray(v) ? [...v] : v;
  return t.layerCount ? { layerCount: t.layerCount } : {};
}
