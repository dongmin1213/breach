/// 시드 고정 PRNG — mulberry32.
///
/// ⚠️ 이 파일이 이 프로젝트에서 가장 위험한 코드다.
///
/// 400개 감사가 전부 "같은 시드 → 같은 결과" 위에 서 있다.
/// 데일리 모드도, 서버 검증도, 밸런스 수치의 의미도 그 속성에 의존한다.
/// 한 비트라도 JS 엔진과 어긋나면 **감사가 검증한 게임과 출시되는 게임이 달라진다.**
///
/// 원본(JS):
///   let t = Math.imul(a ^ a >>> 15, 1 | a);
///   t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
///   return ((t ^ t >>> 14) >>> 0) / 4294967296;
///
/// Dart 로 옮길 때의 함정:
///   · Dart 네이티브 int 는 64비트 → `a * b` 가 32비트로 안 잘린다
///   · Dart 웹(dart2js) int 는 double → 2^53 을 넘으면 **정밀도가 조용히 날아간다**
///   그래서 `Math.imul` 을 16비트 분할 곱셈으로 직접 구현한다.
///   중간값이 2^33 을 안 넘으므로 웹에서도 안전하다.
///
/// 검증: test/golden_test.dart 가 JS 가 뽑은 실제 출력과 대조한다.
library;

/// JS `Math.imul` — 32비트 곱셈의 하위 32비트를 부호 있는 값으로.
int imul32(int a, int b) {
  final aHi = (a >> 16) & 0xffff;
  final aLo = a & 0xffff;
  final bHi = (b >> 16) & 0xffff;
  final bLo = b & 0xffff;
  // aLo*bLo < 2^32, (aHi*bLo + aLo*bHi) < 2^33 — 둘 다 double 안전 범위
  final lo = aLo * bLo;
  final mid = ((aHi * bLo + aLo * bHi) & 0xffff) << 16;
  return _toSigned32(lo + mid);
}

/// JS `x | 0` — 부호 있는 32비트로 절단
int _toSigned32(int x) {
  final v = x & 0xffffffff;
  return v >= 0x80000000 ? v - 0x100000000 : v;
}

/// JS `x >>> 0` — 부호 없는 32비트로 절단
int toUnsigned32(int x) => x & 0xffffffff;

/// JS `x >>> n` — 부호 없는 우측 시프트
int _ushr(int x, int n) => (x & 0xffffffff) >> n;

/// mulberry32. `sim/lib.mjs` 의 `rng()` 와 출력이 완전히 일치해야 한다.
class Prng {
  int _a;
  Prng(int seed) : _a = toUnsigned32(seed);

  double next() {
    _a = _toSigned32(_a + 0x6D2B79F5);
    var t = imul32(_a ^ _ushr(_a, 15), 1 | _a);
    t = _toSigned32(t + imul32(t ^ _ushr(t, 7), 61 | t)) ^ t;
    return toUnsigned32(t ^ _ushr(t, 14)) / 4294967296.0;
  }

  /// 0 이상 max 미만의 정수 — JS `Math.floor(rng() * max)` 와 동일
  int nextInt(int max) => (next() * max).floor();
}

/// 롤아웃 전용 결정론 rng (정찰 장비 추첨). 실측 rng 와 분리한다.
/// 원본: `let x = 0x9e3779b9; x = (x*1664525+1013904223)>>>0; return x/4294967296`
class FixedRng {
  int _x = 0x9e3779b9;
  double next() {
    // 1664525 * 2^32 는 2^53 을 넘으므로 곱셈도 32비트로 잘라야 한다
    _x = toUnsigned32(imul32(_x, 1664525) + 1013904223);
    return _x / 4294967296.0;
  }
  int nextInt(int max) => (next() * max).floor();
}
