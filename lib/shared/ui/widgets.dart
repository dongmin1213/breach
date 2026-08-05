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

/// 카드 타일 껍데기 — 왼쪽 강조 띠 + 균일 테두리.
///
/// ⚠️ **띠를 테두리로 그리지 마라.** `Border(left: BorderSide(color: 강조색))` 처럼
///    한 면만 색이 다른 테두리에 `borderRadius` 를 같이 주면 Flutter 가
///    `A borderRadius can only be given on borders with uniform colors` 로
///    **페인트를 통째로 건너뛴다.** 위젯 트리에는 있는데 화면엔 빈 상자만 남는다.
///    실제로 덱 빌더의 「덱에 있음」 카드와 **플레이 화면의 카드 전부**가
///    그렇게 안 그려지고 있었다 (게임이 플레이 불가능한 상태였다).
///    띠는 테두리가 아니라 자식 위젯으로 그린다.
class CardShell extends StatelessWidget {
  final Color accent;
  final Widget child;
  final VoidCallback? onTap;

  /// 선택됨 — 배경에 강조색을 옅게 깔아 스캔이 쉬워진다
  final bool selected;

  /// 지금 고를 수 없음 — 투명도로 죽이지 않고 테두리·글자만 낮춘다
  /// (0.35 투명도는 "비활성"이 아니라 "고장난 것"처럼 읽힌다)
  final bool disabled;

  const CardShell({super.key, required this.accent, required this.child,
    this.onTap, this.selected = false, this.disabled = false});

  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Material(
      color: selected ? Color.alphaBlend(accent.withValues(alpha: 0.06), T.panel) : T.panel,
      borderRadius: BorderRadius.circular(T.radius),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: selected ? accent.withValues(alpha: 0.55) : T.line),
            borderRadius: BorderRadius.circular(T.radius)),
          child: IntrinsicHeight(child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: disabled ? T.line2 : accent),
              Expanded(child: Padding(
                padding: const EdgeInsets.fromLTRB(11, 9, 11, 9), child: child)),
            ])))),
    ));
}

/// 소음(비용)을 점으로. 이 게임의 비용 축이라 유형·효과와 같은 태그로 묻히면 안 된다.
class NoiseDots extends StatelessWidget {
  final int noise, max;
  const NoiseDots(this.noise, {super.key, this.max = 4});
  @override
  Widget build(BuildContext c) {
    final col = noise >= 3 ? T.bad : noise >= 2 ? T.warn : T.acc;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < max; i++) Padding(
        padding: const EdgeInsets.only(right: 2.5),
        child: Container(width: 6, height: 6, decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: i < noise ? col : Colors.transparent,
          border: Border.all(color: i < noise ? col : T.line2, width: 1))),
      ),
    ]);
  }
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
