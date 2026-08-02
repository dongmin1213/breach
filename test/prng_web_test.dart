/// 웹(dart2js/wasm) 전용 PRNG 검증.
///
/// ⚠️ VM 테스트만으로는 부족하다. Dart 네이티브 int 는 64비트지만
///    **웹에서는 double** 이라 2^53 을 넘는 중간값이 조용히 뭉개진다.
///    imul32 의 16비트 분할 곱셈이 정말 안전한지는 브라우저에서만 확인된다.
///
///    실행: dart test -p chrome test/prng_web_test.dart
///
/// 기대값은 test/golden.json 에서 뽑아 박아 넣었다 (브라우저에서 파일을 못 읽으므로).
library;

import 'package:test/test.dart';
import 'package:breach_app/shared/engine/prng.dart';

const cases = <(int, List<double>)>[
    (1, [0.627074, 0.002736, 0.527447, 0.981051, 0.968378, 0.281104, 0.612839, 0.720743, 0.425797, 0.994823, 0.455271, 0.488788]),
    (7, [0.011705, 0.061958, 0.976908, 0.699029, 0.521445, 0.405522, 0.466233, 0.239925, 0.553326, 0.729822, 0.257816, 0.155948]),
    (42, [0.601104, 0.448291, 0.852466, 0.669734, 0.174814, 0.526593, 0.273228, 0.624745, 0.865475, 0.472317, 0.249924, 0.882059]),
    (1000, [0.795195, 0.827688, 0.691516, 0.880575, 0.017807, 0.425103, 0.300603, 0.110681, 0.757467, 0.700471, 0.641587, 0.184118]),
    (65535, [0.374583, 0.373426, 0.849175, 0.63194, 0.409465, 0.300999, 0.627941, 0.966658, 0.253932, 0.080769, 0.646119, 0.460456]),
    (123456789, [0.257791, 0.970772, 0.785328, 0.206165, 0.303072, 0.747066, 0.778734, 0.28451, 0.016537, 0.161465, 0.365901, 0.430858]),
    (4294967295, [0.896423, 0.189478, 0.715653, 0.94406, 0.845236, 0.53914, 0.680498, 0.475572, 0.135858, 0.988445, 0.871467, 0.189348]),
];

void main() {
  test('mulberry32 가 웹에서도 JS 출력과 일치', () {
    for (final (seed, expected) in cases) {
      final g = Prng(seed);
      final got = List.generate(expected.length,
          (_) => double.parse(g.next().toStringAsFixed(6)));
      expect(got, equals(expected), reason: 'seed $seed');
    }
  });

  test('2000회 누적합이 웹에서도 일치 (드리프트 검출)', () {
    final g = Prng(20260802);
    var acc = 0.0;
    for (var i = 0; i < 2000; i++) { acc += g.next(); }
    expect(double.parse(acc.toStringAsFixed(6)), equals(984.016138));
  });

  test('imul32 가 32비트 경계에서 정확', () {
    // JS Math.imul 의 알려진 값들
    expect(imul32(3, 4), equals(12));
    expect(imul32(-5, 12), equals(-60));
    expect(imul32(0xffffffff, 5), equals(-5));
    expect(imul32(0xfffffffe, 5), equals(-10));
    expect(imul32(0x7fffffff, 2), equals(-2));
    expect(imul32(0x12345678, 0x9abcdef0), equals(606937216));
  });
}
