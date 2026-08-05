// 카드 풀 — 정의는 assets/balance.json 에 있다. 여기서는 예산 규칙으로 스탯을 파생시킬 뿐이다.
//   · 카드를 추가하려면 balance.json 의 cards 배열에 한 줄 넣으면 된다 (코드 수정 없음)
//   · 표시 이름은 assets/l10n/*.json 에 있다 (수치와 텍스트를 분리)
import { makeTool, CONFIG } from './engine.mjs';
import { CARDS } from './balance.mjs';
import KO from '../../assets/l10n/ko.json' with { type: 'json' };

// id 는 데이터(balance.json), 표시 이름은 텍스트(l10n/*.json).
// 엔진·감사는 name 으로 카드를 지목하므로 여기서 한 번만 붙여 준다.
const label = id => KO[`card.${id}.name`] ?? id;

const build = c => Object.assign(
  makeTool(label(c.id), c.grade, c.type, c.shape, c.noise,
           { priv: c.priv, effect: c.effect }),
  { id: c.id });

export const TOOLKIT = CARDS.map(build);
export function rebuild() { TOOLKIT.length = 0; for (const c of CARDS) TOOLKIT.push(build(c)); return TOOLKIT; }

// ⚠️ 못 찾으면 **던진다.** 예전에는 undefined 를 돌려줬고, 호출부가 전부
//    `{...byName(x)}` 로 펼치는 탓에 `{}` 가 조용히 덱에 섞였다. 스탯이 undefined 라
//    접근점수가 NaN 이 되고, `NaN >= 100` 이 false 라 런이 "성공"으로 끝난다.
//    실측: l10n 에서 카드 이름 하나만 바꿔도 표준 프리셋 성공률이 47.3% → 62.0% 로
//    올라가면서 감사 전항목이 통과했다. 측정이 조용히 거짓말하는 유일한 경로였다.
export const byName = n => {
  const t = TOOLKIT.find(t => t.id === n || t.name === n);
  if (!t) throw new Error(
    `카드 '${n}' 를 찾을 수 없다 — assets/balance.json 의 cards[].id 로 지목할 것. ` +
    `표시 이름(assets/l10n)은 바뀔 수 있으므로 식별자로 쓰지 않는다.`);
  return t;
};

// 감사용 프리셋 (§1.3 현실적 구성 규약). 극단 구성은 별도 항목 전용.
// ⚠️ **id 로 적는다.** 표시 이름을 쓰면 l10n 수정이 곧 측정 오염이 된다 (§1.3).
export const PRESETS = {
  표준:   ['preattack','packet_mask','badge_clone','port_scan','brute_force','side_channel','mitm','persist_backdoor'],
  조용:   ['packet_mask','badge_clone','port_scan','log_wipe','side_channel','mitm','persist_backdoor','privesc'],
  강습:   ['preattack','brute_force','tailgate','zero_day','mitm','badge_clone','packet_mask','privesc'],
  권한:   ['port_scan','mitm','privesc','packet_mask','badge_clone','side_channel','persist_backdoor','preattack'],
  단일정공: ['preattack','mitm','privesc','preattack','mitm','privesc','preattack','mitm'],
  전기본: ['preattack','packet_mask','badge_clone','port_scan','log_wipe','preattack','packet_mask','badge_clone'],
  전전설: ['privesc','zero_day','persist_backdoor','privesc','zero_day','persist_backdoor','privesc','zero_day'],
};
export const kit = name => {
  const p = PRESETS[name];
  if (!p) throw new Error(`프리셋 '${name}' 없음 — ${Object.keys(PRESETS).join(' · ')} 중 하나여야 한다`);
  return p.map(n => ({ ...byName(n) }));
};

// ⚠️ 엔진은 손패에서 툴을 객체 동일성(!==)으로 제거한다.
//    같은 툴을 2장 넣을 때 같은 참조를 쓰면 둘 다 사라진다 → 반드시 복제한다.
export const cloneKit = arr => arr.map(t => ({ ...t }));
export { CONFIG };
