/// 수치 단일 원본 로더 — assets/balance.json.
///
/// ⚠️ 수치를 Dart 상수로 옮겨 적으면 안 된다. 시뮬레이터(../breach/sim)가 검증한 값과
///    앱이 쓰는 값이 갈라지고, 그 순간 감사 221개는 출시될 게임을 설명하지 않게 된다.
///    assets/balance.json 하나만 고치면 시뮬레이터와 앱이 같은 값을 본다 (복사 없음).
///    텍스트는 여기 없다 — assets/l10n/*.json 에 있다.
library;

import 'dart:convert';

class LayerSpec {
  final String? stat;
  final List<double> req, strength;
  final double traceMul;
  const LayerSpec(this.stat, this.req, this.strength, this.traceMul);
}

class CardSpec {
  final String id, grade, type;
  final List<int> shape;
  final int noise, priv;
  final String? effect;
  const CardSpec({required this.id, required this.grade, required this.type,
    required this.shape, required this.noise, this.priv = 0, this.effect});
}

class TargetSpec {
  final String id;
  final int? layerCount;
  final double? reqScale, traceScale;
  final Map<String, int>? layerMix;
  final Map<String, dynamic>? overrides;
  const TargetSpec({required this.id, this.layerCount, this.reqScale,
    this.traceScale, this.layerMix, this.overrides});
}

/// 규칙 수치. 표적 원형이 일부를 덮어쓰므로 불변이 아니다 (copyWith 로 파생).
class Rules {
  final double subWeight, shortfall, noiseScale, slackKeep, overflowKeep;
  final double slackCap, privMul, resistUp, resistDown, alertMul, counterReqUp;
  final int handExtra, layersMin, layersMax, deckSize, traceMax, privCap;
  final int resistCap, counterFrom, counterTrace, reconCount, noiseBudget, gearCap;
  final List<int> alertSteps;
  final Map<String, double> resistPenalty;
  final Map<String, int> gradeTotal, gradeCap, effectCost;

  const Rules({
    required this.subWeight, required this.shortfall, required this.noiseScale,
    required this.slackKeep, required this.slackCap, required this.overflowKeep,
    required this.handExtra, required this.layersMin, required this.layersMax,
    required this.deckSize, required this.traceMax,
    required this.privMul, required this.privCap,
    required this.resistUp, required this.resistDown, required this.resistCap,
    required this.resistPenalty, required this.alertSteps, required this.alertMul,
    required this.counterFrom, required this.counterReqUp, required this.counterTrace,
    required this.reconCount, required this.noiseBudget, required this.gearCap,
    required this.gradeTotal, required this.gradeCap, required this.effectCost,
  });

  Rules copyWith({double? resistUp, double? resistDown, int? handExtra,
      int? counterFrom, List<int>? alertSteps, double? counterReqUp, double? slackKeep}) =>
    Rules(
      subWeight: subWeight, shortfall: shortfall, noiseScale: noiseScale,
      slackKeep: slackKeep ?? this.slackKeep, slackCap: slackCap, overflowKeep: overflowKeep,
      handExtra: handExtra ?? this.handExtra, layersMin: layersMin, layersMax: layersMax,
      deckSize: deckSize, traceMax: traceMax, privMul: privMul, privCap: privCap,
      resistUp: resistUp ?? this.resistUp, resistDown: resistDown ?? this.resistDown,
      resistCap: resistCap, resistPenalty: resistPenalty,
      alertSteps: alertSteps ?? this.alertSteps, alertMul: alertMul,
      counterFrom: counterFrom ?? this.counterFrom,
      counterReqUp: counterReqUp ?? this.counterReqUp, counterTrace: counterTrace,
      reconCount: reconCount, noiseBudget: noiseBudget, gearCap: gearCap,
      gradeTotal: gradeTotal, gradeCap: gradeCap, effectCost: effectCost,
    );

  static Rules fromJson(Map<String, dynamic> r) => Rules(
    subWeight: (r['subWeight'] as num).toDouble(),
    shortfall: (r['shortfall'] as num).toDouble(),
    noiseScale: (r['noiseScale'] as num).toDouble(),
    slackKeep: (r['slackKeep'] as num).toDouble(),
    slackCap: (r['slackCap'] as num).toDouble(),
    overflowKeep: (r['overflowKeep'] as num).toDouble(),
    handExtra: r['handExtra'], layersMin: r['layersMin'], layersMax: r['layersMax'],
    deckSize: r['deckSize'], traceMax: r['traceMax'],
    privMul: (r['privMul'] as num).toDouble(), privCap: r['privCap'],
    resistUp: (r['resistUp'] as num).toDouble(),
    resistDown: (r['resistDown'] as num).toDouble(),
    resistCap: r['resistCap'],
    resistPenalty: (r['resistPenalty'] as Map).map((k,v)=>MapEntry(k as String,(v as num).toDouble())),
    alertSteps: List<int>.from(r['alertSteps']),
    alertMul: (r['alertMul'] as num).toDouble(),
    counterFrom: r['counterFrom'],
    counterReqUp: (r['counterReqUp'] as num).toDouble(),
    counterTrace: r['counterTrace'], reconCount: r['reconCount'],
    noiseBudget: r['noiseBudget'], gearCap: r['gearCap'] ?? 2,
    gradeTotal: Map<String,int>.from(r['gradeTotal']),
    gradeCap: Map<String,int>.from(r['gradeCap']),
    effectCost: Map<String,int>.from(r['effectCost']),
  );
}

class Balance {
  final Rules rules;
  final Map<String, LayerSpec> layers;
  final Map<String, Map<String, dynamic>> effects;
  final Map<String, Map<String, dynamic>> gear;
  final List<String> counters;
  final List<CardSpec> cards;
  final List<TargetSpec> targets;

  const Balance({required this.rules, required this.layers, required this.effects,
    required this.gear, required this.counters, required this.cards, required this.targets});

  static Balance parse(String jsonStr) {
    final d = jsonDecode(jsonStr) as Map<String, dynamic>;
    return Balance(
      rules: Rules.fromJson(d['rules']),
      layers: (d['layers'] as Map).map((k, v) => MapEntry(k as String, LayerSpec(
        v['stat'] as String?,
        List<double>.from((v['req'] as List).map((x)=>(x as num).toDouble())),
        List<double>.from((v['strength'] as List).map((x)=>(x as num).toDouble())),
        (v['traceMul'] as num).toDouble()))),
      effects: (d['effects'] as Map).map((k,v)=>MapEntry(k as String, Map<String,dynamic>.from(v))),
      gear: (d['gear'] as Map).map((k,v)=>MapEntry(k as String, Map<String,dynamic>.from(v))),
      counters: List<String>.from(d['counters']),
      cards: (d['cards'] as List).map((c) => CardSpec(
        id: c['id'], grade: c['grade'], type: c['type'],
        shape: List<int>.from(c['shape']), noise: c['noise'],
        priv: c['priv'] ?? 0, effect: c['effect'])).toList(),
      targets: (d['targets'] as List).map((t) => TargetSpec(
        id: t['id'], layerCount: t['layerCount'],
        reqScale: (t['reqScale'] as num?)?.toDouble(),
        traceScale: (t['traceScale'] as num?)?.toDouble(),
        layerMix: t['layerMix'] == null ? null : Map<String,int>.from(t['layerMix']),
        overrides: t['overrides'] == null ? null : Map<String,dynamic>.from(t['overrides']),
      )).toList(),
    );
  }
}
