/// 표적 선택 슬라이스.
///
/// 표적마다 **요구하는 스탯이 다르다** — 그게 이 게임의 덱빌딩을 성립시키는 축이다
/// (측정: 전용 덱의 홈 어드밴티지 13.6%p, 통신사 덱은 홈 84.0% / 국방부 42.4%).
/// 그래서 카드마다 "어느 계층이 많이 나오는가"를 먼저 보여준다.
library;

import 'package:flutter/material.dart';
import '../../app/app_state.dart';
import '../../shared/balance/balance.dart';
import '../../shared/ui/tokens.dart';
import '../../shared/ui/widgets.dart';

class TargetSelectPage extends StatelessWidget {
  final AppState app;
  final void Function(String targetId) onPick;
  final VoidCallback onSettings;
  const TargetSelectPage({super.key, required this.app,
    required this.onPick, required this.onSettings});

  @override
  Widget build(BuildContext c) {
    final s = app.s;
    return Scaffold(
      appBar: AppBar(
        title: Text(s['deck.targetTitle']), backgroundColor: T.bg,
        actions: [IconButton(icon: const Icon(Icons.settings, size: 20), onPressed: onSettings)],
      ),
      body: Frame(child: ListView(children: [
        Padding(padding: const EdgeInsets.only(bottom: T.s3),
          child: Text(s['deck.targetSub'], style: Theme.of(c).textTheme.bodySmall)),
        for (final t in app.balance.targets) _card(c, t),
        const SizedBox(height: T.s4),
      ])),
    );
  }

  Widget _card(BuildContext c, TargetSpec t) {
    final s = app.s;
    final selected = app.save.targetId == t.id;
    final mix = t.layerMix ?? const {'cipher': 1, 'network': 1, 'physical': 1};
    final total = mix.values.fold(0, (a, b) => a + b);
    return Padding(padding: const EdgeInsets.only(bottom: T.s2), child: InkWell(
      onTap: () => onPick(t.id),
      borderRadius: BorderRadius.circular(T.radius),
      child: Container(
        padding: const EdgeInsets.all(T.s3),
        decoration: BoxDecoration(
          color: T.panel,
          border: Border.all(color: selected ? T.acc : T.line2),
          borderRadius: BorderRadius.circular(T.radius)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.targetName(t.id), style: Theme.of(c).textTheme.titleMedium
            ?.copyWith(color: selected ? T.acc : T.txt)),
          const SizedBox(height: 2),
          Text(s.targetLine(t.id), style: Theme.of(c).textTheme.bodySmall),
          const SizedBox(height: T.s2),
          // 계층 분포 — 어느 스탯을 요구하는 표적인지가 덱 선택의 전부다
          Row(children: [
            for (final e in mix.entries) Expanded(flex: e.value, child: Container(
              height: 5, margin: const EdgeInsets.only(right: 2),
              decoration: BoxDecoration(
                color: _statColor(e.key), borderRadius: BorderRadius.circular(99)))),
          ]),
          const SizedBox(height: 4),
          Text(mix.entries.map((e) =>
              '${s.stat(_statOf(e.key))} ${(e.value / total * 100).round()}%').join('  '),
            style: Theme.of(c).textTheme.labelSmall),
          if (selected) ...[
            const SizedBox(height: T.s2),
            Text(s.targetDesc(t.id), style: Theme.of(c).textTheme.bodySmall),
          ],
        ]))));
  }

  static String _statOf(String layer) =>
      {'cipher': 'dec', 'network': 'eva', 'physical': 'inf'}[layer]!;
  static Color _statColor(String layer) =>
      {'cipher': T.acc, 'network': T.priv, 'physical': T.warn}[layer]!;
}
