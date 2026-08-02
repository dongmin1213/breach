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

export const byName = n => TOOLKIT.find(t => t.name === n || t.id === n);

// 감사용 프리셋 (§1.3 현실적 구성 규약). 극단 구성은 별도 항목 전용.
export const PRESETS = {
  표준:   ['사전공격','패킷위장','배지복제','포트스캔','브루트포스','사이드채널','중간자','지속백도어'],
  조용:   ['패킷위장','배지복제','포트스캔','로그와이프','사이드채널','중간자','지속백도어','권한상승'],
  강습:   ['사전공격','브루트포스','테일게이팅','제로데이','중간자','배지복제','패킷위장','권한상승'],
  권한:   ['포트스캔','중간자','권한상승','패킷위장','배지복제','사이드채널','지속백도어','사전공격'],
  단일정공: ['사전공격','중간자','권한상승','사전공격','중간자','권한상승','사전공격','중간자'],
  전기본: ['사전공격','패킷위장','배지복제','포트스캔','로그와이프','사전공격','패킷위장','배지복제'],
  전전설: ['권한상승','제로데이','지속백도어','권한상승','제로데이','지속백도어','권한상승','제로데이'],
};
export const kit = name => PRESETS[name].map(n => ({ ...byName(n) }));

// ⚠️ 엔진은 손패에서 툴을 객체 동일성(!==)으로 제거한다.
//    같은 툴을 2장 넣을 때 같은 참조를 쓰면 둘 다 사라진다 → 반드시 복제한다.
export const cloneKit = arr => arr.map(t => ({ ...t }));
export { CONFIG };
