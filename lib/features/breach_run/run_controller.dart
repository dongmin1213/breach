/// 침투 진행 상태 — 엔진을 감싸고 UI 가 필요한 것만 노출한다.
/// 룰은 전부 shared/engine 에 있고 여기엔 없다 (검증된 엔진을 우회하지 않기 위해).
library;

import 'package:flutter/foundation.dart';
import '../../app/app_state.dart';
import '../../shared/engine/bots.dart';
import '../../shared/engine/engine.dart';
import '../../shared/engine/prng.dart';
import '../../shared/engine/targets.dart';

/// 카드 한 장을 지금 내면 무슨 일이 일어나는가.
/// 전투가 결정론적이므로 숨길 이유가 없다 — 도박이 아니라 퍼즐이 되게 한다.
class Preview {
  final double acc, req, shortAfter, gain, absorbed, dTrace;
  final bool fatal, clears;
  const Preview({required this.acc, required this.req, required this.shortAfter,
    required this.gain, required this.absorbed, required this.dTrace,
    required this.fatal, required this.clears});
}

class RunController extends ChangeNotifier {
  final AppState app;
  late Engine engine;
  late Bots bots;
  late Prng rng;
  late RunState state;
  int seed = 0;

  RunController(this.app) { start(); }

  void start({int? withSeed}) {
    seed = withSeed ?? DateTime.now().microsecondsSinceEpoch & 0x7fffffff;
    engine = engineFor(app.balance, app.save.targetId);
    bots = Bots(engine);
    rng = Prng(seed);
    final deck = app.save.deck.map((id) => app.pool.firstWhere((t) => t.id == id)).toList();
    state = engine.newRun(deck, rng,
        layerCount: layerCountFor(app.balance, app.save.targetId));
    _autoRecon();
    notifyListeners();
  }

  /// 정찰 계층은 툴을 내지 않으므로 자동 진행한다 (장비만 얻는다)
  void _autoRecon() {
    while (state.status == 'running' && state.layers[state.layerIdx].type == 'RECON') {
      state = engine.resolveLayer(state, null, rng);
    }
  }

  Layer get layer => state.layers[state.layerIdx];
  bool get running => state.status == 'running';
  int get scoringTotal => state.layers.where((l) => l.type != 'RECON').length;
  int get scoringDone =>
      state.layers.take(state.layerIdx).where((l) => l.type != 'RECON').length;

  double get requirement =>
      layer.req * (state.active == 'req_up' ? 1 + engine.r.counterReqUp : 1);

  Preview preview(Tool c) {
    final r = engine.r;
    final ef = c.effect != null ? engine.b.effects[c.effect!] : null;
    final req = requirement;
    final acc = (engine.scoreOf(c, layer, state)
        + ((state.buff['access'] as num?)?.toDouble() ?? 0)) * layer.str;
    final bypass = ef?['bypass'] == true;
    final short = bypass ? 0.0 : (req - acc).clamp(0.0, double.infinity);
    final over = bypass ? 0.0 : (acc - req).clamp(0.0, double.infinity);
    var slack = state.slack;
    if (ef?['slackGain'] != null) {
      slack = (slack + (ef!['slackGain'] as num).toDouble()).clamp(0.0, r.slackCap);
    }
    final absorbed = slack < short ? slack : short;
    final dTrace = engine.noiseOf(c, layer, state) + (short - absorbed) * r.shortfall
        - ((ef?['traceCut'] as num?)?.toDouble() ?? 0)
        + ((ef?['bypassTrace'] as num?)?.toDouble() ?? 0);
    return Preview(acc: acc, req: req, shortAfter: short - absorbed,
      gain: over * r.slackKeep, absorbed: absorbed,
      dTrace: dTrace < -state.trace ? -state.trace : dTrace,
      fatal: state.trace + dTrace >= r.traceMax, clears: short - absorbed < 0.05);
  }

  void play(Tool? c) {
    state = engine.resolveLayer(state, c, rng);
    _autoRecon();
    notifyListeners();
  }

  void useGear(String id) { state = engine.useGear(state, id); notifyListeners(); }

  int get score => engine.score(state);
}
