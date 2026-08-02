/// BREACH 룰 엔진 — `../breach/core/engine.mjs` 의 Dart 포팅.
///
/// 순수 함수. UI·프레임워크 의존 0. 수치는 전부 Balance 에서 온다.
/// JS 원본과 **완전히 같은 결과**를 내야 하며 test/golden_test.dart 가 그것을 판정한다.
///
/// 이월된 설계 제약 (PRD §12):
///  ① 비용 축(TRACE)을 처음부터 내장 — 없으면 카드 종류가 안 늘어난다
///  ② 부스탯 가중을 판정식에 내장 — 없으면 특화형이 수학적으로 항상 이긴다
///  ③ 난이도는 AI 정책 + 표적 스펙 두 축으로
///  ④ 모든 상태 변화를 원값으로 로깅 — 반올림하면 리플레이가 깨진다
library;

import 'dart:math' as math;
import '../balance/balance.dart';
import 'prng.dart';

const stats = ['dec', 'eva', 'inf'];
const types = ['direct', 'bypass_t', 'assault'];
const scoringLayers = ['cipher', 'network', 'physical'];
const counterMenu = ['seal', 'priv_reset', 'req_up', 'trace_boost'];

/// 파생된 카드 한 장. 스탯은 예산 규칙에서 계산되며 손으로 적지 않는다.
class Tool {
  final String id, grade, type;
  final int noise, dec, eva, inf, sum, priv;
  final String? effect;
  const Tool({required this.id, required this.grade, required this.type,
    required this.noise, required this.dec, required this.eva, required this.inf,
    required this.sum, required this.priv, this.effect});
  int stat(String s) => s == 'dec' ? dec : (s == 'eva' ? eva : inf);
}

class Layer {
  final String type;
  final String? stat;
  final double req, str, tr;
  const Layer(this.type, this.stat, this.req, this.str, this.tr);
}

class LogEvent {
  final String kind;
  final int layerIdx;
  final Map<String, dynamic> data;
  const LogEvent(this.kind, this.layerIdx, [this.data = const {}]);
}

/// 런 상태. 모든 변이는 새 객체를 반환한다 (JS 원본과 동일).
class RunState {
  final List<Layer> layers;
  final int layerIdx;
  final double access, trace, slack;
  final int priv, alert;
  final List<Tool> hand, deck;
  final List<String> gear;
  final Map<String, double> resist;
  final String? pending, active, sealed, lastType;
  final Map<String, dynamic> buff;
  final String status;
  final List<LogEvent> log;

  const RunState({required this.layers, required this.layerIdx, required this.access,
    required this.trace, required this.slack, required this.priv, required this.alert,
    required this.hand, required this.deck, required this.gear, required this.resist,
    this.pending, this.active, this.sealed, this.lastType,
    required this.buff, required this.status, required this.log});

  RunState copy({List<Layer>? layers, int? layerIdx, double? access, double? trace,
      double? slack, int? priv, int? alert, List<Tool>? hand, List<Tool>? deck,
      List<String>? gear, Map<String, double>? resist,
      Object? pending = _keep, Object? active = _keep, Object? sealed = _keep,
      Object? lastType = _keep,
      Map<String, dynamic>? buff, String? status, List<LogEvent>? log}) => RunState(
    layers: layers ?? this.layers, layerIdx: layerIdx ?? this.layerIdx,
    access: access ?? this.access, trace: trace ?? this.trace, slack: slack ?? this.slack,
    priv: priv ?? this.priv, alert: alert ?? this.alert,
    hand: hand ?? this.hand, deck: deck ?? this.deck, gear: gear ?? this.gear,
    resist: resist ?? this.resist,
    pending: pending == _keep ? this.pending : pending as String?,
    active: active == _keep ? this.active : active as String?,
    sealed: sealed == _keep ? this.sealed : sealed as String?,
    lastType: lastType == _keep ? this.lastType : lastType as String?,
    buff: buff ?? this.buff, status: status ?? this.status, log: log ?? this.log);

  static const _keep = Object();
}

/// 엔진 인스턴스 — 표적 원형이 규칙을 덮어쓰므로 규칙을 들고 다닌다.
class Engine {
  final Balance b;
  final Rules r;
  final Map<String, LayerSpec> layerSpec;
  final Map<String, int> layerMix;

  Engine(this.b, {Rules? rules, Map<String, LayerSpec>? layers, Map<String, int>? mix})
    : r = rules ?? b.rules,
      layerSpec = layers ?? b.layers,
      layerMix = mix ?? const {'cipher': 1, 'network': 1, 'physical': 1};

  // ══ 툴 생성 — 예산에서 스탯을 파생 ══════════════════════════
  int budgetOf(String grade, String? effect, int noise) =>
      r.gradeTotal[grade]! - (effect != null ? (r.effectCost[effect] ?? 0) : 0)
      + noise * r.noiseBudget;

  Tool makeTool(CardSpec c) {
    final budget = budgetOf(c.grade, c.effect, c.noise);
    final cap = r.gradeCap[c.grade]! + c.noise * r.noiseBudget * 0.6;
    final shapeSum = c.shape.reduce((a, x) => a + x);
    var v = c.shape.map((x) => x / shapeSum * budget).toList();
    for (var it = 0; it < 8; it++) {
      var over = 0.0;
      final free = <int>[];
      for (var i = 0; i < 3; i++) {
        if (v[i] > cap) { over += v[i] - cap; v[i] = cap; } else { free.add(i); }
      }
      if (over < 1e-9 || free.isEmpty) break;
      for (final i in free) { v[i] += over / free.length; }
    }
    final rr = v.map(_jsRound).toList();
    final diff = budget - (rr[0] + rr[1] + rr[2]);
    final mi = rr.indexOf(rr.reduce(math.min));
    rr[mi] = math.max(1, rr[mi] + diff);
    return Tool(id: c.id, grade: c.grade, type: c.type, noise: c.noise,
      dec: rr[0], eva: rr[1], inf: rr[2], sum: rr[0] + rr[1] + rr[2],
      priv: c.priv, effect: c.effect);
  }

  /// JS `Math.round` — 절반은 **위로** (Dart 의 round 는 절반을 0에서 먼 쪽으로 가므로 음수에서 다르다)
  static int _jsRound(double x) => (x + 0.5).floor();

  List<Tool> buildPool() => b.cards.map(makeTool).toList();

  // ══ 표적 생성 ═══════════════════════════════════════════════
  List<Layer> buildTarget(Prng rng, {int? layerCount}) {
    final n = layerCount ?? (r.layersMin + rng.nextInt(r.layersMax - r.layersMin + 1));
    final out = <Layer>[];
    final reconAt = <int>{};
    for (var i = 1; i <= r.reconCount; i++) {
      reconAt.add(math.max(0, (i * (n - 1) / (r.reconCount + 1)).floor()));
    }
    // 계층 유형 분포 — 표적 원형이 이걸 기울여 요구 스탯을 바꾼다
    final bag = <String>[];
    for (final t in scoringLayers) {
      for (var i = 0; i < (layerMix[t] ?? 1); i++) { bag.add(t); }
    }
    for (var i = 0; i < n - 1; i++) {
      final t = bag[rng.nextInt(bag.length)];
      final s = layerSpec[t]!;
      out.add(Layer(t.toUpperCase(), s.stat,
        s.req[0] + rng.next() * (s.req[1] - s.req[0]),
        s.strength[0] + rng.next() * (s.strength[1] - s.strength[0]), s.traceMul));
      if (reconAt.contains(i)) out.add(const Layer('RECON', null, 0, 0, 0));
    }
    final c = layerSpec['core']!;
    final coreStat = {'cipher': 'dec', 'network': 'eva', 'physical': 'inf'}[bag[rng.nextInt(bag.length)]];
    out.add(Layer('CORE', coreStat,
      c.req[0] + rng.next() * (c.req[1] - c.req[0]),
      c.strength[0] + rng.next() * (c.strength[1] - c.strength[0]), c.traceMul));
    return out;
  }

  // ══ 상태 ════════════════════════════════════════════════════
  RunState newRun(List<Tool> deck, Prng rng, {List<Layer>? layers, int? layerCount,
      int? handSize, double trace = 0}) {
    final ls = layers ?? buildTarget(rng, layerCount: layerCount);
    final scoring = ls.where((l) => l.type != 'RECON').length;
    final hs = handSize ?? math.min(deck.length, scoring + r.handExtra);
    final a = List<Tool>.from(deck);
    for (var i = a.length - 1; i > 0; i--) {
      final j = rng.nextInt(i + 1);
      final t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return RunState(layers: ls, layerIdx: 0, access: 0, trace: trace, slack: 0,
      priv: 0, alert: 0,
      hand: a.sublist(0, hs), deck: a.sublist(hs), gear: const [],
      resist: {for (final t in types) t: 0.0},
      buff: const {}, status: 'running', log: const []);
  }

  int alertOf(double trace) => r.alertSteps.where((t) => trace >= t).length;

  // ══ 판정 ════════════════════════════════════════════════════
  double scoreOf(Tool? tool, Layer? layer, RunState s) {
    if (tool == null || layer?.stat == null) return 0;
    final ef = tool.effect != null ? b.effects[tool.effect!] : null;
    // 적응(morph): 계층 주스탯 대신 자신의 최고 스탯을 주스탯으로
    final main = (ef?['morph'] == true)
        ? stats.reduce((a, c) => tool.stat(a) >= tool.stat(c) ? a : c)
        : layer!.stat!;
    final others = stats.where((x) => x != main).map(tool.stat).toList();
    final w = r.subWeight;
    var v = tool.stat(main) * (1 - w) + ((others[0] + others[1]) / 2) * w;

    if (ef?['scoreMul'] != null) v *= (ef!['scoreMul'] as num).toDouble();
    final rr = s.resist[tool.type] ?? 0;
    v *= math.max(0, 1 - rr * (r.resistPenalty[tool.type] ?? 0.1));
    if (tool.priv < 0) v *= 1 + math.min(r.privCap, s.priv) * r.privMul;

    if (ef?['alertBonus'] != null) v *= 1 + s.alert * (ef!['alertBonus'] as num).toDouble();
    return v;
  }

  double noiseOf(Tool? tool, Layer? layer, RunState s) {
    if (tool == null) return 0;
    final ef = tool.effect != null ? b.effects[tool.effect!] : null;
    if (ef?['silent'] == true || s.buff['silent'] == true) return 0;
    return tool.noise * r.noiseScale * ((ef?['noiseMul'] as num?)?.toDouble() ?? 1)
        * (layer?.tr ?? 1) * (1 + s.alert * r.alertMul);
  }

  // ══ 장비 ════════════════════════════════════════════════════
  RunState useGear(RunState s0, String name) {
    final i = s0.gear.indexOf(name);
    if (i < 0) return s0;
    final gear = List<String>.from(s0.gear)..removeAt(i);
    final buff = Map<String, dynamic>.from(s0.buff);
    final g = b.gear[name]!;
    var trace = s0.trace;
    String? pending = s0.pending, active = s0.active;
    switch (g['kind']) {
      case 'access': buff['access'] = (buff['access'] ?? 0) + (g['v'] as num).toDouble(); break;
      case 'trace':  trace = math.max(0, trace - (g['v'] as num).toDouble()); break;
      case 'silent': buff['silent'] = true; break;
      case 'cancel': pending = null; active = null; break;
    }
    return s0.copy(gear: gear, buff: buff, trace: trace, alert: alertOf(trace),
      pending: pending, active: active,
      log: [...s0.log, LogEvent('GEAR', s0.layerIdx,
        {'gear': name, 'dTrace': trace - s0.trace, 'trace': trace})]);
  }

  // ══ 계층 해결 ═══════════════════════════════════════════════
  RunState resolveLayer(RunState s0, Tool? tool, Object rng) {
    final L = s0.layers[s0.layerIdx];

    if (L.type == 'RECON') {
      final names = b.gear.keys.toList();
      final idx = rng is Prng ? rng.nextInt(names.length) : (rng as FixedRng).nextInt(names.length);
      final got = names[idx];
      final gear = List<String>.from(s0.gear);
      if (gear.length < r.gearCap) gear.add(got);
      return _advance(s0.copy(gear: gear, layerIdx: s0.layerIdx + 1,
        log: [...s0.log, LogEvent('RECON', s0.layerIdx, {'gear': got, 'trace': s0.trace})]));
    }

    var req = L.req;
    if (s0.active == 'req_up') req *= 1 + r.counterReqUp;

    final ef = tool?.effect != null ? b.effects[tool!.effect!] : null;
    final base = scoreOf(tool, L, s0);
    final acc = (base + ((s0.buff['access'] as num?)?.toDouble() ?? 0)) * L.str;
    final noise = noiseOf(tool, L, s0);

    // 백도어(bypass): 요구치 판정을 건너뛴다 — 미달 페널티도 초과 이득도 없다
    final isBypass = ef?['bypass'] == true;
    final short = isBypass ? 0.0 : math.max(0.0, req - acc);
    final over  = isBypass ? 0.0 : math.max(0.0, acc - req);

    var slack = s0.slack;
    if (ef?['slackGain'] != null) {
      slack = math.min(r.slackCap, slack + (ef!['slackGain'] as num).toDouble());
    }
    final absorbed = math.min(slack, short);
    slack = math.min(r.slackCap, slack - absorbed + over * r.slackKeep);
    final netShort = short - absorbed;

    var dTrace = noise + netShort * r.shortfall
        - ((ef?['traceCut'] as num?)?.toDouble() ?? 0)
        + ((ef?['bypassTrace'] as num?)?.toDouble() ?? 0);

    final trace = math.max(0.0, s0.trace + dTrace);
    final access = s0.access + over;

    var priv = s0.priv;
    final hand = List<Tool>.from(s0.hand);
    final resist = Map<String, double>.from(s0.resist);
    String? lastType = s0.lastType;
    if (tool != null) {
      if (tool.priv > 0) {
        priv = math.min(r.privCap, priv + tool.priv);
      } else if (tool.priv < 0) { priv = 0; }
      for (final t in types) {
        resist[t] = t == tool.type
          ? math.min(r.resistCap.toDouble(), resist[t]! + r.resistUp)
          : math.max(0.0, resist[t]! - r.resistDown);
      }
      hand.remove(tool);
      lastType = tool.type;
    }

    final alert = alertOf(trace);
    final s = s0.copy(
      trace: trace, slack: slack, access: access, priv: priv, hand: hand,
      resist: resist, lastType: lastType, buff: const {}, alert: alert,
      layerIdx: s0.layerIdx + 1,
      log: [...s0.log, LogEvent('LAYER', s0.layerIdx, {
        'type': L.type, 'stat': L.stat, 'tool': tool?.id, 'toolType': tool?.type,
        'req': req, 'acc': acc, 'short': short, 'over': over, 'absorbed': absorbed,
        'netShort': netShort, 'noise': noise, 'dTrace': dTrace,
        'trace': trace, 'access': access, 'slack': slack, 'priv': priv, 'alert': alert,
      })]);

    if (trace >= r.traceMax) return s.copy(status: 'failed');
    if (s.layerIdx >= s.layers.length) return s.copy(status: 'success');
    return _advance(s);
  }

  /// 계층 진입 시: ① 예고된 대응 발동 → ② 다음 계층 예고
  /// 예고는 진입 시점에 나가고 한 계층을 플레이한 뒤 발동한다.
  /// 즉 플레이어에게는 항상 정확히 1계층의 대비 기회가 있다 (PRD 인과 규칙).
  RunState _advance(RunState s0) {
    if (s0.status != 'running') return s0;
    // 정찰 계층은 툴을 안 내므로 예고를 소비하지도, 발행하지도 않는다
    if (s0.layers[s0.layerIdx].type == 'RECON') return s0;

    final fire = s0.pending;
    var s = s0.copy(pending: null, active: null);
    final log = List<LogEvent>.from(s.log);

    // 예고했는데 조건이 안 맞아 조용히 사라지면 인과가 끊긴다. 불발도 로깅한다.
    if (fire == 'seal' && s.hand.length <= 1) {
      log.add(LogEvent('FIZZLE', s.layerIdx, {'counter': fire, 'why': '손패 부족'}));
      s = s.copy(log: log);
    } else if (fire == 'priv_reset' && s.priv == 0) {
      log.add(LogEvent('FIZZLE', s.layerIdx, {'counter': fire, 'why': '권한 없음'}));
      s = s.copy(log: log);
    } else if (fire == 'seal') {
      final L = s.layers[s.layerIdx];
      final best = s.hand.reduce((a, c) => scoreOf(c, L, s) > scoreOf(a, L, s) ? c : a);
      log.add(LogEvent('COUNTER', s.layerIdx, {'counter': fire, 'target': best.id}));
      s = s.copy(hand: List<Tool>.from(s.hand)..remove(best), sealed: best.id, log: log);
    } else if (fire == 'priv_reset') {
      log.add(LogEvent('COUNTER', s.layerIdx, {'counter': fire}));
      s = s.copy(priv: 0, log: log);
    } else if (fire == 'trace_boost') {
      final trace = s.trace + r.counterTrace;
      log.add(LogEvent('COUNTER', s.layerIdx,
        {'counter': fire, 'dTrace': r.counterTrace.toDouble(), 'trace': trace}));
      s = s.copy(trace: trace, alert: alertOf(trace), log: log);
      if (trace >= r.traceMax) return s.copy(status: 'failed');
    } else if (fire == 'req_up') {
      log.add(LogEvent('COUNTER', s.layerIdx, {'counter': fire}));
      s = s.copy(active: 'req_up', log: log);
    }

    if (s.alert >= r.counterFrom && s.layerIdx < s.layers.length) {
      final p = _pickCounter(s);
      final l2 = List<LogEvent>.from(s.log)..add(LogEvent('WARN', s.layerIdx, {'counter': p}));
      s = s.copy(pending: p, log: l2);
    }
    return s;
  }

  /// 대응 선택: 순환하되 **지금 무해한 대응은 건너뛴다**.
  /// 고정 순환만 쓰면 효과 없는 대응이 자주 나오고(권한 초기화 평균 손해 5점),
  /// "가장 아픈 것"을 고르게 하면 척도가 달라 한 종류로 쏠린다(툴 봉인 93%).
  /// ⚠️ 유효성은 **발동 시점** 기준이다 — 그 사이에 카드를 한 장 낸다.
  String _pickCounter(RunState s) {
    final nextIdx = s.layers.indexWhere((l) => l.type != 'RECON', s.layerIdx);
    final L = nextIdx >= 0 ? s.layers[nextIdx] : s.layers[s.layerIdx];
    final viable = <String, bool>{
      'seal': s.hand.length - 1 > 1,
      'priv_reset': s.priv > 0 && s.hand.any((c) => c.priv < 0),
      'req_up': s.slack < L.req * r.counterReqUp,
      'trace_boost': true,
    };
    final menu = counterMenu.where((k) => viable[k]!).toList();
    return menu[(s.layerIdx + s.alert) % menu.length];
  }

  // ══ 점수 ════════════════════════════════════════════════════
  int score(RunState s) {
    if (s.status != 'success') return 0;
    return _jsRound(500 + (r.traceMax - s.trace) * 5 + s.hand.length * 30
        + s.slack * r.overflowKeep);
  }
}
