/// 덱 구성 슬라이스.
///
/// 덱 12장 < 손패(계층+4 ≈ 10) < 풀. 이 세 겹이 덱빌딩을 만든다.
///   · 좋은 카드를 넣으면 이득, 잡카드는 손해 (희석 비용이 작동 — docs/04)
///   · 표적별 전용 덱의 홈 어드밴티지가 플레이 실력 폭보다 두 배 이상 크다
/// 그래서 이 화면은 **표적이 요구하는 스탯 대비 내 덱의 비중**을 항상 보여주고,
/// 카드마다 그 스탯을 맨 앞으로 빼서 강조한다.
library;

import 'package:flutter/material.dart';
import '../../app/app_state.dart';
import '../../shared/engine/engine.dart';
import '../../shared/ui/tokens.dart';
import '../../shared/ui/widgets.dart';

class DeckBuilderPage extends StatefulWidget {
  final AppState app;
  final VoidCallback onStart, onBack;
  const DeckBuilderPage({super.key, required this.app,
    required this.onStart, required this.onBack});
  @override State<DeckBuilderPage> createState() => _DeckBuilderPageState();
}

class _DeckBuilderPageState extends State<DeckBuilderPage> {
  AppState get app => widget.app;
  late List<String> deck = List<String>.from(app.save.deck);

  int get size => app.balance.rules.deckSize;
  bool get full => deck.length == size;

  Tool _tool(String id) => app.pool.firstWhere((t) => t.id == id);

  /// 표적이 가장 많이 요구하는 스탯 — 그 막대를 강조해서 "맞춰 가라"를 보여준다
  String? get _wantedStat {
    final t = app.balance.targets.where((x) => x.id == app.save.targetId).firstOrNull;
    final mix = t?.layerMix;
    if (mix == null) return null;
    final top = mix.entries.reduce((a, b) => a.value >= b.value ? a : b);
    return {'cipher': 'dec', 'network': 'eva', 'physical': 'inf'}[top.key];
  }

  Future<void> _toggle(String id) async {
    setState(() {
      if (deck.contains(id)) {
        deck.remove(id);
      } else if (deck.length < size) {
        deck.add(id);
      }
    });
    await app.setDeck(List<String>.from(deck));
  }

  @override
  Widget build(BuildContext context) {
    final s = app.s;
    final tid = app.save.targetId;
    final totals = {'dec': 0, 'eva': 0, 'inf': 0};
    var noise = 0;
    for (final id in deck) {
      final t = _tool(id);
      totals['dec'] = totals['dec']! + t.dec;
      totals['eva'] = totals['eva']! + t.eva;
      totals['inf'] = totals['inf']! + t.inf;
      noise += t.noise;
    }
    final sum = totals.values.fold(0, (a, b) => a + b);
    final want = _wantedStat;

    return Scaffold(
      appBar: AppBar(
        title: Text(s.targetName(tid)), backgroundColor: T.bg,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: widget.onBack)),
      body: Frame(child: Column(children: [
        Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.targetLine(tid), style: const TextStyle(color: T.acc, fontSize: 12.5)),
          const SizedBox(height: 4),
          Text(s.targetDesc(tid), style: Theme.of(context).textTheme.bodySmall),
        ])),
        const SizedBox(height: T.s3),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('${s['deck.myDeck']} — ${deck.length} / $size',
            style: Theme.of(context).textTheme.titleMedium),
          if (!full) Text('${size - deck.length}',
            style: const TextStyle(color: T.warn, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: T.s2),
        for (final k in ['dec', 'eva', 'inf'])
          _bar(s.stat(k), sum == 0 ? 0 : totals[k]! / sum, k == want),
        const SizedBox(height: 4),
        Align(alignment: Alignment.centerLeft, child: Text(
          s.f('deck.avgNoise', {'n': deck.isEmpty ? '0.00'
            : (noise / deck.length).toStringAsFixed(2)}),
          style: Theme.of(context).textTheme.labelSmall)),
        const SizedBox(height: T.s3),
        // 풀이 40종을 넘어가면서 "내 12장이 어디 있나"를 찾는 게 일이 됐다.
        // 덱과 나머지를 갈라 놓으면 스크롤 없이 현재 구성을 볼 수 있다.
        Expanded(child: Builder(builder: (_) {
          final mine = app.pool.where((t) => deck.contains(t.id)).toList();
          final rest = app.pool.where((t) => !deck.contains(t.id)).toList();
          return ListView(children: [
            _sectionHeader(context, s['deck.myDeck'], mine.length),
            for (final t in mine) _cardTile(t, want),
            const SizedBox(height: T.s3),
            _sectionHeader(context, s['deck.pool'], rest.length),
            for (final t in rest) _cardTile(t, want),
            const SizedBox(height: T.s2),
          ]);
        })),
        SafeArea(top: false, child: Padding(
          padding: const EdgeInsets.symmetric(vertical: T.s2),
          child: SizedBox(width: double.infinity, child: FilledButton(
            onPressed: full ? widget.onStart : null,
            child: Text(s['deck.start']))))),
      ])),
    );
  }

  Widget _bar(String label, double v, bool hot) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [
      SizedBox(width: 40, child: Text(label,
        style: TextStyle(fontSize: 11.5, color: hot ? T.acc : T.dim,
          fontWeight: hot ? FontWeight.w700 : FontWeight.w400))),
      Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(value: v, minHeight: 7,
          backgroundColor: const Color(0xFF0A0E13),
          valueColor: AlwaysStoppedAnimation(hot ? T.acc : T.line2)))),
      SizedBox(width: 42, child: Text('${(v * 100).round()}%',
        textAlign: TextAlign.right,
        style: const TextStyle(fontFamily: T.mono, fontSize: 11.5, color: T.dim))),
    ]));

  Widget _sectionHeader(BuildContext c, String label, int n) => Padding(
    padding: const EdgeInsets.only(bottom: T.s2, top: 2),
    child: Row(children: [
      Text(label, style: Theme.of(c).textTheme.labelSmall
        ?.copyWith(color: T.txt, fontWeight: FontWeight.w700)),
      const SizedBox(width: 6),
      Text('$n', style: const TextStyle(color: T.dim, fontSize: 11)),
      const SizedBox(width: T.s2),
      const Expanded(child: Divider(color: T.line, height: 1)),
    ]));

  /// 표적이 요구하는 스탯을 **앞으로 빼서 강조**한다.
  /// "덱을 맞춰 가세요"라고 안내하면서 어느 수치를 봐야 하는지 안 알려주면 소용이 없다.
  Widget _cardTile(Tool t, String? want) {
    final s = app.s;
    final inDeck = deck.contains(t.id);
    final canAdd = inDeck || deck.length < size;
    final stats = ['dec', 'eva', 'inf'];
    final ordered = want == null ? stats : [want, ...stats.where((x) => x != want)];

    return CardShell(
      accent: inDeck ? T.acc : T.line2,
      selected: inDeck,
      disabled: !canAdd,
      onTap: canAdd ? () => _toggle(t.id) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 6, height: 6, margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(shape: BoxShape.circle,
              color: canAdd ? T.typeColor(t.type) : T.line2)),
          Text(s.card(t.id), style: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w700,
            color: canAdd ? T.txt : T.dim)),
          const SizedBox(width: 6),
          Text(s.type(t.type), style: TextStyle(fontSize: 10.5,
            color: canAdd ? T.typeColor(t.type) : T.dim)),
          const Spacer(),
          if (t.effect != null) Tag(s.effect(t.effect!), color: T.acc),
          if (t.priv > 0) Tag('${s['run.priv']}+${t.priv}', color: T.priv),
          if (t.priv < 0) Tag(s['run.priv'], color: T.priv),
          const SizedBox(width: 3),
          NoiseDots(t.noise),
        ]),
        const SizedBox(height: 5),
        Row(children: [
          for (final k in ordered) Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Text.rich(TextSpan(children: [
              TextSpan(text: '${s.stat(k)} ', style: TextStyle(
                fontSize: 11, color: k == want ? T.acc : T.dim)),
              TextSpan(text: '${t.stat(k)}', style: T.num_(12.5,
                color: k == want ? T.acc : (canAdd ? T.txt : T.dim),
                w: k == want ? FontWeight.w700 : FontWeight.w400)),
            ])),
          ),
        ]),
      ]));
  }
}
