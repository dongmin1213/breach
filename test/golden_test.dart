/// Dart 엔진이 JS 원본과 **완전히 같은 결과**를 내는지 판정한다.
///
/// 이 테스트가 통과해야만 ../breach 의 감사 225개가 이 앱을 설명한다.
/// 실패하면 밸런스 수치도, 데일리 모드도, 서버 검증도 전부 의미를 잃는다.

library;
import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import 'package:breach_app/shared/balance/balance.dart';
import 'package:breach_app/shared/engine/engine.dart';
import 'package:breach_app/shared/engine/bots.dart';
import 'package:breach_app/shared/engine/prng.dart';
import 'package:breach_app/shared/engine/targets.dart';

double r6(num x) => double.parse(x.toStringAsFixed(6));

/// JS 의 randKit(seed) 와 동일한 덱 추첨
List<Tool> randKit(List<Tool> pool, int seed, int size) {
  final r = Prng(seed);
  final p = List<Tool>.from(pool);
  for (var i = p.length - 1; i > 0; i--) {
    final j = r.nextInt(i + 1);
    final t = p[i]; p[i] = p[j]; p[j] = t;
  }
  return p.sublist(0, size);
}

void main() {
  final g = jsonDecode(File('test/golden.json').readAsStringSync());
  final b = Balance.parse(File('assets/balance.json').readAsStringSync());
  final base = Engine(b);
  final pool = base.buildPool();

  test('카드 파생이 일치 (예산 규칙)', () {
    expect(pool.length, equals(g['toolCount']));
    for (var i = 0; i < pool.length; i++) {
      final t = pool[i], e = g['cards'][i];
      expect([t.id, t.grade, t.type, t.noise, t.dec, t.eva, t.inf, t.sum, t.priv, t.effect],
             equals([e['id'], e['grade'], e['type'], e['noise'],
                     e['dec'], e['eva'], e['inf'], e['sum'], e['priv'], e['effect']]),
             reason: t.id);
    }
  });

  test('표적 생성이 일치', () {
    for (final c in g['targets']) {
      final e = engineFor(b, c['target']);
      final layers = e.buildTarget(Prng(c['seed']),
          layerCount: layerCountFor(b, c['target']));
      final exp = c['layers'] as List;
      expect(layers.length, equals(exp.length),
             reason: '${c['target']} seed ${c['seed']} 계층 수');
      for (var i = 0; i < layers.length; i++) {
        expect([layers[i].type, layers[i].stat, r6(layers[i].req),
                r6(layers[i].str), r6(layers[i].tr)],
               equals([exp[i]['type'], exp[i]['stat'],
                       (exp[i]['req'] as num).toDouble(),
                       (exp[i]['str'] as num).toDouble(),
                       (exp[i]['tr'] as num).toDouble()]),
               reason: '${c['target']} seed ${c['seed']} 계층 $i');
      }
    }
  });

  test('덱 추첨이 일치', () {
    for (final c in g['decks']) {
      final k = randKit(pool, c['seed'], g['deckSize']);
      expect(k.map((t) => t.id).toList(), equals(List<String>.from(c['cards'])),
             reason: 'seed ${c['seed']}');
    }
  });

  test('전체 플레이 로그가 일치 (400런)', () {
    var checked = 0;
    for (final run in g['runs']) {
      final e = engineFor(b, run['target']);
      final bots = Bots(e);
      final seed = run['seed'] as int;
      final r = Prng(seed);
      final s0 = e.newRun(randKit(pool, seed, g['deckSize']), r,
          layerCount: layerCountFor(b, run['target']));

      expect(s0.hand.map((t) => t.id).toList(), equals(List<String>.from(run['hand0'])),
             reason: '초기 손패 seed $seed');

      final s = bots.playOut(s0, bots.assign(), r, gear: bots.defaultGear);
      final why = '${run['target']} seed $seed';
      expect(s.status, equals(run['status']), reason: '$why 결과');
      expect(r6(s.trace), equals((run['trace'] as num).toDouble()), reason: '$why 흔적');
      expect(r6(s.slack), equals((run['slack'] as num).toDouble()), reason: '$why 여유');
      expect(e.score(s), equals(run['score']), reason: '$why 점수');
      expect(s.layerIdx, equals(run['layerIdx']), reason: '$why 진행도');

      final exp = run['log'] as List;
      expect(s.log.length, equals(exp.length), reason: '$why 로그 길이');
      for (var i = 0; i < s.log.length; i++) {
        final a = s.log[i], x = exp[i];
        expect(a.kind, equals(x['k']), reason: '$why 로그 $i 종류');
        expect(a.layerIdx, equals(x['i']), reason: '$why 로그 $i 계층');
        if (a.kind == 'LAYER') {
          expect([a.data['tool'], r6(a.data['req']), r6(a.data['acc']),
                  r6(a.data['short']), r6(a.data['over']), r6(a.data['absorbed']),
                  r6(a.data['noise']), r6(a.data['dTrace']), r6(a.data['trace']),
                  r6(a.data['slack']), a.data['priv'], a.data['alert']],
                 equals([x['tool'], (x['req'] as num).toDouble(), (x['acc'] as num).toDouble(),
                         (x['short'] as num).toDouble(), (x['over'] as num).toDouble(),
                         (x['abs'] as num).toDouble(), (x['noise'] as num).toDouble(),
                         (x['d'] as num).toDouble(), (x['tr'] as num).toDouble(),
                         (x['sl'] as num).toDouble(), x['p'], x['a']]),
                 reason: '$why 로그 $i');
        }
        if (a.kind == 'RECON') expect(a.data['gear'], equals(x['g']), reason: '$why 로그 $i 장비');
        if (a.kind == 'GEAR')  expect(a.data['gear'], equals(x['g']), reason: '$why 로그 $i 장비');
        if (a.kind == 'WARN' || a.kind == 'COUNTER' || a.kind == 'FIZZLE') {
          expect(a.data['counter'], equals(x['c']), reason: '$why 로그 $i 대응');
        }
      }
      checked++;
    }
    expect(checked, equals(400));
  });
}
