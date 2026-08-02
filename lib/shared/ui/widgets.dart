/// 슬라이스들이 공유하는 위젯. 색·간격은 tokens.dart 에서만 온다.
library;

import 'package:flutter/material.dart';
import 'tokens.dart';

/// 세로 모바일 폭으로 가운데 정렬
class Frame extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const Frame({super.key, required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: T.s3)});
  @override
  Widget build(BuildContext c) => Center(child: ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: T.maxWidth),
    child: Padding(padding: padding, child: child)));
}

/// 탐지도 게이지 — 경계 문턱을 눈금으로 표시한다.
/// "지금 얼마나 위험한가"를 한눈에 보여주는 게 이 화면의 핵심이다.
class TraceGauge extends StatelessWidget {
  final double trace, max;
  final List<int> steps;
  const TraceGauge({super.key, required this.trace, required this.max, required this.steps});

  @override
  Widget build(BuildContext c) {
    final p = (trace / max).clamp(0.0, 1.0);
    final grad = p >= 0.8
        ? const [Color(0xFF8A1F12), T.bad]
        : p >= 0.55 ? const [Color(0xFF7A5A08), T.warn] : const [Color(0xFF12463A), T.acc];
    return LayoutBuilder(builder: (c, box) => SizedBox(height: 20, child: Stack(children: [
      Container(decoration: BoxDecoration(
        color: const Color(0xFF0A0E13),
        border: Border.all(color: T.line2), borderRadius: BorderRadius.circular(3))),
      AnimatedContainer(
        duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic,
        width: box.maxWidth * p,
        decoration: BoxDecoration(gradient: LinearGradient(colors: grad),
          borderRadius: BorderRadius.circular(3))),
      for (final s in steps)
        Positioned(left: box.maxWidth * (s / max), top: 0, bottom: 0,
          child: Container(width: 1, color: const Color(0xFF3B4A5A))),
      Positioned(right: 6, top: 2, child: Text(
        '${trace.toStringAsFixed(1)} / ${max.toStringAsFixed(0)}',
        style: const TextStyle(fontFamily: T.mono, fontSize: 12,
          fontWeight: FontWeight.w700, color: T.txt,
          shadows: [Shadow(color: Colors.black, blurRadius: 6)]))),
    ])));
  }
}

/// 예고 · 발동 배너. 무슨 일이 일어나는지에 더해 **뭘 해야 하는지**까지 적는다.
class NoticeBanner extends StatelessWidget {
  final String title, body;
  final bool danger;
  const NoticeBanner({super.key, required this.title, required this.body, this.danger = false});
  @override
  Widget build(BuildContext c) {
    final col = danger ? T.bad : T.warn;
    return Container(
      margin: const EdgeInsets.only(bottom: T.s3),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      decoration: BoxDecoration(border: Border.all(color: col),
        color: danger ? const Color(0xFF2A0F0B) : const Color(0xFF241C05),
        borderRadius: BorderRadius.circular(T.radius - 1)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(color: col, fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(body, style: TextStyle(color: col.withValues(alpha: 0.85), fontSize: 12.5, height: 1.5)),
      ]));
  }
}

class StatChip extends StatelessWidget {
  final String label, value;
  final Color? color;
  const StatChip(this.label, this.value, {super.key, this.color});
  @override
  Widget build(BuildContext c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
    decoration: BoxDecoration(border: Border.all(color: T.line),
      borderRadius: BorderRadius.circular(99)),
    child: Text.rich(TextSpan(children: [
      TextSpan(text: '$label ', style: const TextStyle(color: T.dim, fontSize: 11.5)),
      TextSpan(text: value, style: TextStyle(
        color: color ?? T.txt, fontSize: 11.5, fontWeight: FontWeight.w700)),
    ])));
}

class Tag extends StatelessWidget {
  final String text;
  final Color? color;
  const Tag(this.text, {super.key, this.color});
  @override
  Widget build(BuildContext c) => Container(
    margin: const EdgeInsets.only(right: 4),
    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
    decoration: BoxDecoration(
      border: Border.all(color: color ?? T.line2), borderRadius: BorderRadius.circular(2)),
    child: Text(text, style: TextStyle(fontSize: 10.5, color: color ?? T.dim)));
}

class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  const Panel({super.key, required this.child, this.padding});
  @override
  Widget build(BuildContext c) => Container(
    padding: padding ?? const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
    decoration: BoxDecoration(color: T.panel, border: Border.all(color: T.line2),
      borderRadius: BorderRadius.circular(T.radius - 1)),
    child: child);
}

/// 굵게(`<b>`)만 지원하는 초경량 인라인 마크업.
/// 온보딩 문구에서 강조가 필요한데 전체 HTML 렌더러를 붙일 이유는 없다.
Widget richBody(String src, {TextStyle? base}) {
  final style = base ?? const TextStyle(color: T.txt, fontSize: 13.5, height: 1.65);
  final spans = <TextSpan>[];
  final re = RegExp(r'<b>(.*?)</b>', dotAll: true);
  var i = 0;
  for (final m in re.allMatches(src)) {
    if (m.start > i) spans.add(TextSpan(text: src.substring(i, m.start)));
    spans.add(TextSpan(text: m[1], style: const TextStyle(fontWeight: FontWeight.w700)));
    i = m.end;
  }
  if (i < src.length) spans.add(TextSpan(text: src.substring(i)));
  return Text.rich(TextSpan(children: spans, style: style));
}
