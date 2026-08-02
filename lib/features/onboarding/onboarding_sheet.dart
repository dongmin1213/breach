/// 온보딩 — "이게 무슨 게임이고 어떻게 하는가".
///
/// 프로토타입 초판은 설명 없이 숫자만 던져서 "무슨 게임인지 모르겠다"는 피드백을 받았다.
/// 규칙을 두 줄로 먼저 말하고, 화면 읽는 법을 예시로 보여준 뒤 시작한다.
library;

import 'package:flutter/material.dart';
import '../../shared/l10n/strings.dart';
import '../../shared/ui/tokens.dart';
import '../../shared/ui/widgets.dart';

Future<void> showOnboarding(BuildContext context, Strings s) => showModalBottomSheet(
  context: context, isScrollControlled: true, backgroundColor: T.panel,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(12))),
  builder: (c) => DraggableScrollableSheet(
    expand: false, initialChildSize: 0.9, maxChildSize: 0.95,
    builder: (c, ctrl) => _Body(s: s, ctrl: ctrl),
  ),
);

class _Body extends StatelessWidget {
  final Strings s;
  final ScrollController ctrl;
  const _Body({required this.s, required this.ctrl});

  @override
  Widget build(BuildContext c) => Frame(
    padding: const EdgeInsets.fromLTRB(T.s4, T.s5, T.s4, T.s4),
    child: ListView(controller: ctrl, children: [
      Text(s['app.title'], style: Theme.of(c).textTheme.displaySmall?.copyWith(color: T.acc)),
      Text(s['app.tagline'], style: Theme.of(c).textTheme.bodySmall),
      const SizedBox(height: T.s4),
      richBody(s['onboard.role']),
      _h(c, s['onboard.rulesTitle']),
      richBody('① ${s['onboard.rule1']}'),
      const SizedBox(height: 4),
      richBody('② ${s['onboard.rule2']}'),
      _h(c, s['onboard.hardTitle']),
      richBody(s['onboard.hard']),
      const SizedBox(height: T.s3),
      _example(c),
      _h(c, s['onboard.moreTitle']),
      richBody(s['onboard.slack']),
      const SizedBox(height: 4),
      richBody(s['onboard.resist']),
      const SizedBox(height: 4),
      richBody(s['onboard.warn']),
      const SizedBox(height: T.s3),
      richBody(s['onboard.hand'], base: Theme.of(c).textTheme.bodySmall),
      const SizedBox(height: T.s4),
      FilledButton(onPressed: () => Navigator.pop(c), child: Text(s['onboard.start'])),
      const SizedBox(height: T.s2),
    ]),
  );

  Widget _h(BuildContext c, String t) => Padding(
    padding: const EdgeInsets.only(top: T.s4, bottom: T.s1),
    child: Text(t, style: const TextStyle(
      color: T.acc, fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: .5)));

  /// 화면 읽는 법 — 실제 카드 한 장을 그대로 보여주고 해설한다.
  Widget _example(BuildContext c) => Panel(child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(s.card('brute_force'),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        Text(s.f('run.short', {'n': '20.1'}),
          style: const TextStyle(color: T.warn, fontWeight: FontWeight.w700, fontSize: 12.5)),
      ]),
      const SizedBox(height: 4),
      const Text('침투 61.6 / 81.7    탐지 +35.9',
        style: TextStyle(fontFamily: T.mono, fontSize: 12, color: T.dim)),
      const SizedBox(height: T.s2),
      Text(
        '이 도구를 내면 침투도 61.6이 나오는데 81.7이 필요하니 20.1 모자랍니다. '
        '모자란 만큼 + 도구 소음까지 합쳐 탐지도가 35.9 오릅니다. 나쁜 선택이죠.',
        style: Theme.of(c).textTheme.bodySmall),
    ]));
}
