// PRNG 만 먼저 잠근다. 여기가 어긋나면 나머지 포팅은 전부 무의미하다.

library;
import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import 'package:breach_app/shared/engine/prng.dart';

void main() {
  final golden = jsonDecode(File('test/golden.json').readAsStringSync());

  test('mulberry32 가 JS 출력과 일치', () {
    for (final c in golden['prng']) {
      if (c['out'] == null) continue;
      final g = Prng(c['seed']);
      final got = List.generate(c['out'].length, (_) => double.parse(g.next().toStringAsFixed(6)));
      expect(got, equals(List<double>.from(c['out'].map((x) => (x as num).toDouble()))),
          reason: 'seed ${c['seed']}');
    }
  });

  test('2000회 누적합이 일치 (드리프트 검출)', () {
    final c = golden['prng'].firstWhere((e) => e['sumOf'] != null);
    final g = Prng(c['seed']);
    var acc = 0.0;
    for (var i = 0; i < c['sumOf']; i++) { acc += g.next(); }
    expect(double.parse(acc.toStringAsFixed(6)), equals((c['sum'] as num).toDouble()));
  });
}
