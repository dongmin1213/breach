/// 봇 사다리 — `../breach/core/bots.mjs` 의 Dart 포팅.
///
/// 설계 원칙: 봇은 자체 평가식을 갖지 않고 **엔진을 직접 롤아웃**한다.
/// 이전 프로젝트에서 봇의 내부 모델이 엔진과 어긋나 모든 지표가 편향된 사고가 있었다.
library;

import 'dart:math' as math;
import 'engine.dart';
import 'prng.dart';

typedef Policy = Tool? Function(RunState);
typedef GearPolicy = String? Function(RunState);

class Bots {
  final Engine e;
  Bots(this.e);

  // ── 상태 평가. 사다리의 모든 봇이 **같은 목적함수**를 최적화해야 비교가 성립한다.
  double evalState(RunState s) {
    if (s.status == 'failed') return -100000 + s.layerIdx * 100;
    if (s.status == 'running') return -50000 + s.layerIdx * 100;
    return e.score(s).toDouble();
  }

  RunState playOut(RunState s0, Policy policy, Object rng, {GearPolicy? gear}) {
    var s = s0;
    var guard = 0;
    while (s.status == 'running' && guard++ < 64) {
      final L = s.layers[s.layerIdx];
      if (L.type == 'RECON') { s = e.resolveLayer(s, null, rng); continue; }
      if (gear != null) { final g = gear(s); if (g != null) s = e.useGear(s, g); }
      s = e.resolveLayer(s, s.hand.isEmpty ? null : policy(s), rng);
    }
    return s;
  }

  // ── 장비 정책. 아껴 쓰는 정책은 함정이다 — 런이 끝나면 소멸하므로 "안 쓴 장비 = 0점".
  //
  // ⚠️ 포팅 원칙: **번역하되 개선하지 않는다.**
  //    이 식에서 `- s.slack - slackGain` 을 빠뜨렸다가 장비 사용 판단이 갈려
  //    런이 통째로 달라졌다. 반대로 "빠진 것 같아서" 항을 더해도 똑같이 깨진다.
  //    개선하고 싶으면 JS 쪽을 고치고 골든을 다시 뽑을 것.
  double _bestDelta(RunState s) {
    final L = s.layers[s.layerIdx];
    if (L.type == 'RECON' || s.hand.isEmpty) return double.infinity;
    final req = L.req * (s.active == 'req_up' ? 1 + e.r.counterReqUp : 1);
    var best = double.infinity;
    for (final c in s.hand) {
      final ef = c.effect != null ? e.b.effects[c.effect!] : null;
      final acc = (e.scoreOf(c, L, s) + ((s.buff['access'] as num?)?.toDouble() ?? 0)) * L.str;
      // JS 원본과 글자 그대로 동일해야 한다:
      //   noiseOf + (bypass ? 0 : max(0, req-acc-slack-slackGain)*shortfall)
      //   - traceCut + bypassTrace
      final slackGain = (ef?['slackGain'] as num?)?.toDouble() ?? 0;
      final d = e.noiseOf(c, L, s)
        + (ef?['bypass'] == true ? 0.0
           : math.max(0.0, req - acc - s.slack - slackGain) * e.r.shortfall)
        - ((ef?['traceCut'] as num?)?.toDouble() ?? 0)
        + ((ef?['bypassTrace'] as num?)?.toDouble() ?? 0);
      if (d < best) best = d;
    }
    return best;
  }

  String? defaultGear(RunState s) {
    if (s.gear.isEmpty) return null;
    final L = s.layers[s.layerIdx];
    if (L.type == 'RECON') return null;
    final remain = s.layers.sublist(s.layerIdx).where((l) => l.type != 'RECON').length;
    final base = _bestDelta(s);
    String? best;
    var bestGain = 0.0;
    for (final g in s.gear.toSet()) {
      final after = e.useGear(s, g);
      final gain = (s.trace - after.trace) + (base - _bestDelta(after));
      if (gain > bestGain) { bestGain = gain; best = g; }
    }
    if (s.pending != null && s.gear.contains('analyzer') && bestGain < 8) return 'analyzer';
    final dump = remain <= s.gear.length;
    if (best != null && (bestGain >= 4 || dump)) return best;
    return null;
  }

  // ── 정책들
  Policy random(Prng rng) => (s) => s.hand[rng.nextInt(s.hand.length)];

  Policy greedy() => (s) {
    final L = s.layers[s.layerIdx];
    return s.hand.reduce((a, c) => e.scoreOf(c, L, s) > e.scoreOf(a, L, s) ? c : a);
  };

  double _cost(Tool c, Layer L, RunState s, double req) {
    final ef = c.effect != null ? e.b.effects[c.effect!] : null;
    final acc = e.scoreOf(c, L, s) * L.str;
    final slackGain = (ef?['slackGain'] as num?)?.toDouble() ?? 0;
    return e.noiseOf(c, L, s)
      + (ef?['bypass'] == true ? 0
         : math.max(0.0, req - acc - s.slack - slackGain) * e.r.shortfall)
      - ((ef?['traceCut'] as num?)?.toDouble() ?? 0)
      + ((ef?['bypassTrace'] as num?)?.toDouble() ?? 0);
  }

  /// ⚠️ 계획 봇의 **초기 배정** 비용식은 thrifty 와 다르다 (JS 원본 그대로).
  ///    여유·bypass·slackGain 을 안 본다. 둘을 통일하면 결과가 갈린다.
  double _initCost(Tool c, Layer L, RunState s) {
    final ef = c.effect != null ? e.b.effects[c.effect!] : null;
    return e.noiseOf(c, L, s)
      + math.max(0.0, L.req - e.scoreOf(c, L, s) * L.str) * e.r.shortfall
      - ((ef?['traceCut'] as num?)?.toDouble() ?? 0);
  }

  Policy thrifty() => (s) {
    final L = s.layers[s.layerIdx];
    return s.hand.reduce((a, c) => _cost(c, L, s, L.req) < _cost(a, L, s, L.req) ? c : a);
  };

  /// 계획 봇. 계획 비용은 **순차적으로** 계산해야 한다 —
  /// 계층별 비용을 독립 합산하면 저항 누적과 경계 증폭을 놓쳐 근시안 봇보다 나빠진다.
  Policy assign() => (s) {
    final rest = s.layers.sublist(s.layerIdx).where((l) => l.type != 'RECON').toList();
    if (rest.length <= 1) return thrifty()(s);
    final hand = List<Tool>.from(s.hand);

    double total(List<int?> p) {
      var trace = s.trace, alert = s.alert.toDouble(), slack = s.slack;
      final res = Map<String, double>.from(s.resist);

      for (var i = 0; i < rest.length; i++) {
        final L = rest[i];
        final j = p[i];
        if (j == null) { trace += L.req * e.r.shortfall; slack = 0; continue; }
        final c = hand[j];
        final ef = c.effect != null ? e.b.effects[c.effect!] : null;
        final main = (ef?['morph'] == true)
            ? stats.reduce((a, x) => c.stat(a) >= c.stat(x) ? a : x) : L.stat!;
        final o = stats.where((k) => k != main).map(c.stat).toList();
        var v = c.stat(main) * (1 - e.r.subWeight) + ((o[0] + o[1]) / 2) * e.r.subWeight;
        if (ef?['scoreMul'] != null) v *= (ef!['scoreMul'] as num).toDouble();
        v *= math.max(0, 1 - (res[c.type] ?? 0) * (e.r.resistPenalty[c.type] ?? 0.1));
        if (ef?['alertBonus'] != null) v *= 1 + alert * (ef!['alertBonus'] as num).toDouble();
        final acc = v * L.str;
        final noise = ef?['silent'] == true ? 0.0
          : c.noise * e.r.noiseScale * ((ef?['noiseMul'] as num?)?.toDouble() ?? 1)
            * L.tr * (1 + alert * e.r.alertMul);
        if (ef?['slackGain'] != null) {
          slack = math.min(e.r.slackCap, slack + (ef!['slackGain'] as num).toDouble());
        }
        final sh = ef?['bypass'] == true ? 0.0 : math.max(0.0, L.req - acc);
        final ab = math.min(slack, sh);
        slack = math.min(e.r.slackCap, slack - ab
          + (ef?['bypass'] == true ? 0.0 : math.max(0.0, acc - L.req)) * e.r.slackKeep);
        trace = math.max(0.0, trace + noise + (sh - ab) * e.r.shortfall
          - ((ef?['traceCut'] as num?)?.toDouble() ?? 0)
          + ((ef?['bypassTrace'] as num?)?.toDouble() ?? 0));
        alert = e.alertOf(trace).toDouble();
        for (final t in types) {
          res[t] = t == c.type
            ? math.min(e.r.resistCap.toDouble(), (res[t] ?? 0) + e.r.resistUp)
            : math.max(0.0, (res[t] ?? 0) - e.r.resistDown);
        }
        if (trace >= e.r.traceMax) return trace + (rest.length - i) * 50;
      }
      return trace;
    }

    // ⚠️ Dart 의 List.sort 는 **안정 정렬이 아니다** (introsort). JS Array.sort 는
    //    ES2019 부터 안정 보장이라, 동점 키에서 순서가 갈리고 결과가 달라진다.
    //    인덱스를 부동점으로 넣어 안정성을 강제한다.
    final order = List.generate(rest.length, (i) => i)
      ..sort((a, x) {
        final c = (rest[x].req * rest[x].tr).compareTo(rest[a].req * rest[a].tr);
        return c != 0 ? c : a.compareTo(x);
      });
    final pickd = List<int?>.filled(rest.length, null);
    final used = <int>{};
    for (final i in order) {
      final L = rest[i];
      int? best; var bv = double.infinity;
      for (var j = 0; j < hand.length; j++) {
        if (used.contains(j)) continue;
        final v = _initCost(hand[j], L, s);
        if (v < bv) { bv = v; best = j; }
      }
      if (best != null) { pickd[i] = best; used.add(best); }
    }
    var cur = total(pickd);
    for (var pass = 0; pass < 4; pass++) {
      var improved = false;
      for (var a = 0; a < rest.length; a++) {
        for (var x = a + 1; x < rest.length; x++) {
          final p = List<int?>.from(pickd);
          final t = p[a]; p[a] = p[x]; p[x] = t;
          final v = total(p);
          if (v < cur - 1e-9) { pickd[a] = p[a]; pickd[x] = p[x]; cur = v; improved = true; }
        }
        for (var j = 0; j < hand.length; j++) {
          if (used.contains(j)) continue;
          final p = List<int?>.from(pickd);
          final old = p[a]; p[a] = j;
          final v = total(p);
          if (v < cur - 1e-9) {
            pickd[a] = j; if (old != null) used.remove(old); used.add(j);
            cur = v; improved = true;
          }
        }
      }
      if (!improved) break;
    }

    // ⚠️ 손패가 10장이 되면서 정적 계획이 근시안 봇보다 나빠졌다 (52.8% < 53.7%).
    //    자기 평가함수끼리 비교해봐야 같은 편향을 공유한다 →
    //    두 후보를 **실제 엔진으로 1계층 굴려** 현실로 판정한다.
    final myopic = thrifty()(s);
    final planned = pickd[0] != null ? hand[pickd[0]!] : myopic;
    if (myopic == null || planned == null || identical(planned, myopic)) return planned;
    double probe(Tool c) {
      final rr = FixedRng();
      var a = e.resolveLayer(s, c, rr);
      while (a.status == 'running' && a.layers[a.layerIdx].type == 'RECON') {
        a = e.resolveLayer(a, null, rr);
      }
      if (a.status != 'running') return a.status == 'success' ? -1e6 : 1e6;
      return a.trace + (a.layers.length - a.layerIdx) * 8 - a.slack * 0.5;
    }
    return probe(planned) <= probe(myopic) ? planned : myopic;
  };

  List<Tool> _cands(List<Tool> hand) {
    final seen = <String>{}, out = <Tool>[];
    for (final c in hand) { if (seen.add(c.id)) out.add(c); }
    return out;
  }

  double _rollout(RunState s, Tool c, Policy p) {
    final r = FixedRng();
    final after = e.resolveLayer(s, c, r);
    return evalState(after.status == 'running'
        ? playOut(after, p, r, gear: defaultGear) : after);
  }

  Policy deep() => (s) {
    Tool? best; var bv = double.negativeInfinity;
    for (final c in _cands(s.hand)) {
      final v = _rollout(s, c, assign());
      if (v > bv) { bv = v; best = c; }
    }
    return best ?? s.hand.first;
  };

  Policy counter() => (s) {
    final A = assign();
    Tool? best; var bv = double.negativeInfinity;
    for (final c in _cands(s.hand)) {
      final r = FixedRng();
      var mid = e.resolveLayer(s, c, r);
      while (mid.status == 'running' && mid.layers[mid.layerIdx].type == 'RECON') {
        mid = e.resolveLayer(mid, null, r);
      }
      double v;
      if (mid.status != 'running' || mid.hand.isEmpty) {
        v = evalState(mid.status == 'running' ? playOut(mid, A, r, gear: defaultGear) : mid);
      } else {
        v = double.negativeInfinity;
        final g = defaultGear(mid);
        final m2 = g != null ? e.useGear(mid, g) : mid;
        for (final c2 in _cands(m2.hand)) { v = math.max(v, _rollout(m2, c2, A)); }
      }
      if (v > bv) { bv = v; best = c; }
    }
    return best ?? s.hand.first;
  };

  Policy byName(String n, [Prng? rng]) => switch (n) {
    'random'  => random(rng!),
    'greedy'  => greedy(),
    'thrifty' => thrifty(),
    'assign'  => assign(),
    'deep'    => deep(),
    _         => counter(),
  };
}
