/// 카드 아트 슬롯.
///
/// `assets/cards/<id>.png` 가 있으면 그걸 쓰고, 없으면 id 에서 **결정적으로 생성한**
/// 회로 패턴을 그린다. 그래서 아트를 나중에 뽑아도 **파일만 떨구면 되고 코드는 안 건드린다.**
/// 일부만 채워도 섞여서 동작하므로 40장을 한꺼번에 준비할 필요가 없다.
///
/// 계약은 `assets/cards/README.md` 에 있다.
///
/// ⚠️ 절차 생성은 **id 만으로 결정된다.** 난수·시각을 쓰면 프레임마다 그림이 바뀌고,
///    이 프로젝트의 결정론 규약(CLAUDE.md §1.1)과도 어긋난다.
library;

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'tokens.dart';

class CardArt extends StatelessWidget {
  final String id;
  final String type;

  /// 파일이 없을 때 절차 패턴을 그릴지. false 면 빈 자리로 둔다.
  final bool fallback;

  const CardArt({super.key, required this.id, required this.type, this.fallback = true});

  @override
  Widget build(BuildContext c) => Image.asset(
    'assets/cards/$id.png',
    fit: BoxFit.cover,
    filterQuality: FilterQuality.medium,
    errorBuilder: (_, _, _) => fallback
        ? CustomPaint(painter: _CircuitPainter(id, T.typeColor(type)), size: Size.infinite)
        : const SizedBox.expand(),
  );
}

/// id 를 씨앗으로 회로 조각을 그린다. 같은 id 면 언제나 같은 그림.
class _CircuitPainter extends CustomPainter {
  final String id;
  final Color accent;
  _CircuitPainter(this.id, this.accent);

  /// FNV-1a — 짧고 결정적이면 충분하다
  static int _hash(String s) {
    var h = 0x811c9dc5;
    for (final code in s.codeUnits) {
      h ^= code;
      h = (h * 0x01000193) & 0xffffffff;
    }
    return h;
  }

  @override
  void paint(Canvas canvas, Size size) {
    // ⚠️ `math.Random` 을 쓰지 않는다. 씨앗을 줘도 결정론 검사(§1.1)에 걸리고,
    //    무엇보다 그 금지를 예외로 갉아먹기 시작하면 규칙이 무의미해진다.
    //    id 해시에서 굴리는 작은 LCG 로 충분하다 — 같은 id 면 언제나 같은 그림.
    final rnd = _Seq(_hash(id));
    final w = size.width, h = size.height;
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF090D12));

    const cells = 8;
    final cw = w / cells, ch = h / cells;
    Offset node(int x, int y) => Offset((x + 0.5) * cw, (y + 0.5) * ch);

    final trace = Paint()
      ..color = T.line2.withValues(alpha: 1.0)
      ..strokeWidth = math.max(1.2, w * 0.014)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;

    // ── 직교 트레이스 몇 줄. 회로 기판 조각처럼 보이게 꺾어 그린다.
    final ends = <Offset>[];
    final lines = 7 + rnd.nextInt(4);
    for (var i = 0; i < lines; i++) {
      var x = rnd.nextInt(cells), y = rnd.nextInt(cells);
      final path = Path()..moveTo(node(x, y).dx, node(x, y).dy);
      final segs = 2 + rnd.nextInt(3);
      for (var s = 0; s < segs; s++) {
        if (rnd.nextBool()) {
          x = (x + (rnd.nextBool() ? 1 : -1) * (1 + rnd.nextInt(2))).clamp(0, cells - 1);
        } else {
          y = (y + (rnd.nextBool() ? 1 : -1) * (1 + rnd.nextInt(2))).clamp(0, cells - 1);
        }
        path.lineTo(node(x, y).dx, node(x, y).dy);
      }
      canvas.drawPath(path, trace);
      ends.add(node(x, y));
    }

    // ── 접점
    final dot = Paint()..color = T.line2;
    for (final e in ends) {
      canvas.drawCircle(e, math.max(1.6, w * 0.016), dot);
    }

    // ── 강조 노드 — 유형색으로 한두 점만. 여기가 카드의 눈이 된다.
    final hot = ends.take(1 + rnd.nextInt(2));
    for (final e in hot) {
      canvas.drawCircle(e, w * 0.055, Paint()
        ..color = accent.withValues(alpha: 0.16)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, w * 0.05));
      canvas.drawCircle(e, math.max(2.4, w * 0.026), Paint()..color = accent);
    }

    // ── 주사선 — 터미널 표면 질감. 아주 옅게만.
    final scan = Paint()..color = Colors.black.withValues(alpha: 0.18);
    for (var y = 0.0; y < h; y += 3) {
      canvas.drawRect(Rect.fromLTWH(0, y, w, 1), scan);
    }
  }

  @override
  bool shouldRepaint(_CircuitPainter old) => old.id != id || old.accent != accent;
}

/// 결정적 정수열 — 화면용이라 통계 품질은 필요 없고 재현성만 있으면 된다.
/// (엔진의 난수는 `lib/shared/engine/prng.dart` 의 mulberry32 다. 이건 그림 전용.)
class _Seq {
  int _x;
  _Seq(int seed) : _x = seed & 0x7fffffff;
  int nextInt(int max) {
    _x = (_x * 1103515245 + 12345) & 0x7fffffff;
    return (_x >> 16) % max;
  }
  bool nextBool() => nextInt(2) == 0;
}
