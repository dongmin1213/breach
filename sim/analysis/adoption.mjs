// ════════════════════════════════════════════════════════════════
//  구성 시점 카드 채용도 — 카드 건강을 **이 게임이 실제로 판정받는 축**에서 잰다.
//
//  왜 필요한가: M3′(원형별 최대 사용률)는 **무작위 덱**에서의 플레이 시점 행동을 잰다.
//  그런데 이 게임은 자기 데이터로 덱 선택이 플레이 실력보다 2.7배 중요하다고 증명했다
//  (홈 어드밴티지 18.9%p vs 플레이 실력 폭 6.9%p). 플레이어가 절대 안 쓸 덱에서의
//  행동을 재고 있었던 것이다. 무작위 덱에서 안 쓰이는 카드는 죽은 카드가 아니라
//  **빌드어라운드 카드**일 수 있다.
//
//  M3′ 의 두 결함:
//   ① 하한만 있고 상한이 없다 → 자동 채용 카드를 선호한다.
//      실측: 순수 스탯 카드(콜드부트) 98.7% 통과 · 조건부 카드(스택스매시) 26.3% 탈락.
//      지표를 따르면 재미있는 카드를 지우고 심심한 카드를 남기게 된다.
//   ② `min over cards` 라서 풀이 커지면 **순위통계로** 내려간다.
//      실측: 30→40종에서 최저 −3.6%p 인데 중앙값은 −1.2%p, p25 는 +0.2%p —
//      분포는 안 움직이고 꼬리만 길어졌다.
//
//  ⚠️⚠️ 그런데 이 도구는 **게이트로 쓰면 안 된다.** 정답이 붙은 사례로 검증했더니
//  틀렸다. 스택스매시는 소음 3에서 실제로 죽어 있었고(M3′ 26.3%) 소음 2에서 살아났는데
//  (44.0%), 이 순위 지표는 **반대로** 말했다 — 소음3 최고순위 7/40, 소음2 15/40.
//
//  이유는 이 저장소가 이미 적어둔 함정이다 (docs/03 §2):
//  "가격은 반드시 덱 단위로 검증한다. 카드 하나를 대조 덱에 넣어 재면 대조 덱이
//   흔적을 흡수해 과소평가된다." 챔피언 덱은 최적화돼 있어 조용하다. 그 덱에 시끄러운
//  카드 한 장을 끼우면 나머지 11장이 소음 여유를 흡수해 **소음 비용이 안 보인다.**
//  즉 소음이 원인인 실패를 소음이 안 보이는 자로 재는 셈이다.
//
//  → **사문화 판정은 M3′(무작위 덱 사용률)가 맞다.** 무작위 12장 덱은 시끄러워서
//    소음 비용이 그대로 드러난다. 정답 사례에서 M3′ 는 정확히 맞혔다.
//
//  그래도 이 파일이 남아 있는 이유: `spread`(원형 간 순위 폭)는 **다른 질문**에 답한다 —
//  "이 카드가 빌드를 가르는가". 그건 툴킷 선택 게임이 원하는 신호이고 이 자로 잴 수 있다.
//  실측: cred_harvest 는 exchange 1위 / telecom 39위 (폭 38).
//
//  **쓸 수 있는 것:** 빌드 차별화 진단 (spread · ranks · inChampion)
//  **쓰면 안 되는 것:** 사문화 판정, 소음·비용이 걸린 모든 질문
// ════════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
import { TARGET_KEYS, applyTarget, resetTarget } from '../core/targets.mjs';
const { run, cloneKit, TOOLKIT, DECK_SIZE, SEED } = L;

const winOf = (deck, opts, n, base) => {
  let ok = 0;
  for (let i = 0; i < n; i++)
    if (run(cloneKit(deck), base + i, 'assign', opts).status === 'success') ok++;
  return ok / n;
};

// ── 원형별 챔피언 덱. 탐욕으로 12장을 채운다.
//    ⚠️ 챔피언은 **훈련 시드**로 뽑는다. 검증 시드로 뽑아 검증 시드로 재면
//       그 덱의 우위가 통째로 선택 편향일 수 있다 (docs/05 §4).
function champion(key, samples) {
  const opts = applyTarget(key);
  const deck = [];
  while (deck.length < DECK_SIZE) {
    let best = null, bv = -1;
    for (const t of TOOLKIT) {
      if (deck.includes(t)) continue;
      const v = winOf([...deck, t], opts, samples, SEED.TRAIN);
      if (v > bv) { bv = v; best = t; }
    }
    deck.push(best);
  }
  return deck;
}

/// 카드별 채용도를 잰다.
///
/// 각 원형의 챔피언 덱에서 **한 슬롯만 비우고** 모든 카드를 거기 넣어 승률로 줄 세운다.
/// 같은 문맥에서 같은 시드로 재므로 카드끼리 공정하게 비교된다.
///
/// 돌려주는 것 (카드별):
///   ranks     원형별 순위 (1 = 그 원형이 가장 원하는 카드)
///   bestRank  최고 순위 — **어느 빌드도 원하지 않으면 죽은 카드다**
///   worstRank 최저 순위
///   spread    원형 간 순위 폭 — 클수록 빌드를 가르는 카드
export function adoption({ buildSamples = 120, rankSamples = 400 } = {}) {
  const N = TOOLKIT.length;
  const ranks = {};                       // id → { archetype: rank }
  for (const t of TOOLKIT) ranks[t.id] = {};
  const decks = {};

  for (const key of TARGET_KEYS) {
    const deck = champion(key, buildSamples);
    decks[key] = deck.map(t => t.id);

    // 챔피언의 마지막 슬롯을 비우고 전 카드를 시험한다.
    // (마지막 슬롯 = 탐욕이 가장 늦게 고른 자리 = 경쟁이 가장 빡빡하지 않은 곳)
    const opts = applyTarget(key);
    const base = deck.slice(0, DECK_SIZE - 1);
    const scored = TOOLKIT.map(t => [t.id, winOf([...base, t], opts, rankSamples, SEED.TEST)]);
    scored.sort((a, b) => b[1] - a[1]);
    scored.forEach(([id], i) => { ranks[id][key] = i + 1; });
  }
  resetTarget();

  const perCard = {};
  for (const t of TOOLKIT) {
    const rs = Object.values(ranks[t.id]);
    const inChamp = TARGET_KEYS.filter(k => decks[k].includes(t.id)).length;
    perCard[t.id] = {
      ranks: ranks[t.id],
      bestRank: Math.min(...rs),
      worstRank: Math.max(...rs),
      spread: Math.max(...rs) - Math.min(...rs),
      inChampion: inChamp,
    };
  }
  return { poolSize: N, perCard, decks };
}

// ⚠️ 게이트 판정 함수는 **의도적으로 두지 않는다.**
//    처음엔 verdict() 로 "죽은 카드 / 자동 채용"을 판정하게 만들었다가, 정답 사례
//    검증에서 반대 답이 나와 폐기했다 (파일 머리말 참조). 여기서 나온 순위로
//    사문화를 판정하려는 코드를 다시 만들지 말 것 — 그 실수를 두 번 하게 된다.
//    사문화 판정은 metrics.mjs 의 M3′ 가 한다.
