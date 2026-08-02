/// 표적 원형 — 정의는 assets/balance.json 의 targets 배열에 있다.
///
/// ⚠️ 원형은 **레버로** 구분해야 한다. 이름만 바꾸면 겹친다.
///    초판에서 6종 중 4종이 글자 그대로 같은 최적 덱을 뽑았다.
///    덱 구성을 바꾸는 레버는 **계층 유형 분포(layerMix)** 하나뿐 —
///    저항·손패·능동대응은 플레이 방식만 바꾸고 덱 선택은 안 바꾼다.
library;

import '../balance/balance.dart';
import 'engine.dart';

/// 표적 원형을 적용한 엔진을 만든다. 전역 상태를 안 건드리므로 동시 실행이 안전하다
/// (JS 원본은 CONFIG 를 직접 변형했다 — 그건 이식하지 않는다).
Engine engineFor(Balance b, String? targetId) {
  if (targetId == null) return Engine(b);
  final t = b.targets.where((x) => x.id == targetId).firstOrNull;
  if (t == null) return Engine(b);

  var rules = b.rules;
  final ov = t.overrides;
  if (ov != null) {
    rules = rules.copyWith(
      resistUp: (ov['resistUp'] as num?)?.toDouble(),
      resistDown: (ov['resistDown'] as num?)?.toDouble(),
      handExtra: ov['handExtra'] as int?,
      counterFrom: ov['counterFrom'] as int?,
      alertSteps: ov['alertSteps'] == null ? null : List<int>.from(ov['alertSteps']),
      counterReqUp: (ov['counterReqUp'] as num?)?.toDouble(),
      slackKeep: (ov['slackKeep'] as num?)?.toDouble(),
    );
  }

  final layers = b.layers.map((k, v) => MapEntry(k, LayerSpec(
    v.stat,
    t.reqScale == null ? v.req : v.req.map((x) => x * t.reqScale!).toList(),
    v.strength,
    t.traceScale == null ? v.traceMul : v.traceMul * t.traceScale!)));

  return Engine(b, rules: rules, layers: layers,
    mix: t.layerMix ?? const {'cipher': 1, 'network': 1, 'physical': 1});
}

int? layerCountFor(Balance b, String? targetId) =>
    b.targets.where((x) => x.id == targetId).firstOrNull?.layerCount;
