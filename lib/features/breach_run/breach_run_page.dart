/// 침투 플레이 화면.
///
/// 핵심 UX 원칙: **판정을 말로 먼저 보여준다.**
/// 초판은 숫자만 던져서 "무슨 게임인지 모르겠다"는 피드백을 받았다.
/// "통과 / 20.1 부족 / 여기서 잡힌다"가 먼저 읽히고 숫자는 근거로 아래 붙는다.
library;

import 'package:flutter/material.dart';
import '../../app/app_state.dart';
import '../../shared/engine/engine.dart';
import '../../shared/l10n/strings.dart';
import '../../shared/ui/tokens.dart';
import '../../shared/ui/widgets.dart';
import 'run_controller.dart';

class BreachRunPage extends StatelessWidget {
  final AppState app;
  final RunController run;
  final void Function() onFinished;
  final VoidCallback onQuit;
  const BreachRunPage({super.key, required this.app, required this.run,
    required this.onFinished, required this.onQuit});

  Strings get s => app.s;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: run,
    builder: (context, _) {
      // ⚠️ 런이 끝나면 layerIdx 가 계층 수와 같아진다. 결과 화면 전환은 **다음 프레임**이라
      //    그대로 아래를 그리면 run.layer 가 범위를 벗어나 RangeError 를 던진다.
      //    (실제로 매 판 끝마다 예외가 하나씩 났다.)
      if (!run.running) {
        WidgetsBinding.instance.addPostFrameCallback((_) => onFinished());
        return const Scaffold(backgroundColor: T.bg, body: SizedBox.shrink());
      }
      final r = app.balance.rules;
      return Scaffold(
        appBar: AppBar(
          backgroundColor: T.bg,
          leading: IconButton(icon: const Icon(Icons.close, size: 20), onPressed: onQuit),
          title: Text(s.targetName(app.save.targetId),
            style: const TextStyle(fontSize: 14, fontFamily: T.mono)),
          actions: [Padding(padding: const EdgeInsets.only(right: T.s3),
            child: Center(child: Text(
              s.f('run.layerProgress',
                {'cur': run.scoringDone + 1, 'total': run.scoringTotal}),
              style: Theme.of(context).textTheme.labelSmall)))],
        ),
        body: Frame(child: Column(children: [
          _gauge(context, r),
          const SizedBox(height: T.s3),
          Expanded(child: ListView(children: [
            if (run.state.active != null) NoticeBanner(danger: true,
              title: s.f('run.activeNow', {'c': s.counter(run.state.active!)}),
              body: s['counterHint.${run.state.active}']),
            if (run.state.pending != null) NoticeBanner(
              title: s.f('run.warnNext', {'c': s.counter(run.state.pending!)}),
              body: s['counterHint.${run.state.pending}']),
            _layerPanel(context),
            if (run.state.gear.isNotEmpty) ...[
              const SizedBox(height: T.s3), _gear(context),
            ],
            const SizedBox(height: T.s3),
            Text(s['run.pickTool'], style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: T.s2),
            if (run.state.hand.isEmpty)
              NoticeBanner(danger: true, title: s['run.noTools'], body: s['run.forcePush'])
            else
              for (final t in run.state.hand) _cardTile(context, t),
            if (run.state.hand.isEmpty)
              OutlinedButton(onPressed: () => run.play(null),
                child: Text(s['run.forcePush'])),
            const SizedBox(height: T.s4),
          ])),
        ])),
      );
    });

  Widget _gauge(BuildContext c, dynamic r) => Column(children: [
    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(s['run.traceGauge'], style: const TextStyle(
        color: T.bad, fontSize: 12, fontWeight: FontWeight.w700)),
      Text(run.state.alert == 0 ? s['run.noAlert']
        : s.f('run.alertStage', {'n': run.state.alert}),
        style: Theme.of(c).textTheme.labelSmall),
    ]),
    const SizedBox(height: 3),
    TraceGauge(trace: run.state.trace,
      max: r.traceMax.toDouble(), steps: List<int>.from(r.alertSteps)),
    const SizedBox(height: 6),
    Wrap(spacing: 6, runSpacing: 4, children: [
      StatChip(s['run.slack'], run.state.slack.toStringAsFixed(1)),
      StatChip(s['run.toolsLeft'], '${run.state.hand.length}'),
      if (run.state.priv > 0) StatChip(s['run.priv'], '${run.state.priv}', color: T.priv),
    ]),
  ]);

  Widget _layerPanel(BuildContext c) {
    final L = run.layer;
    final key = L.type.toLowerCase();
    return Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(s.layer(key), style: Theme.of(c).textTheme.labelSmall),
      const SizedBox(height: 1),
      Text(L.stat != null
          ? s.f('run.statNeeded', {'stat': s.stat(L.stat!)})
          : s['run.finalGate'],
        style: Theme.of(c).textTheme.titleLarge),
      const SizedBox(height: 6),
      Text.rich(TextSpan(children: [
        TextSpan(text: '${s['run.needPrefix']} ',
          style: Theme.of(c).textTheme.bodyMedium),
        TextSpan(text: run.requirement.toStringAsFixed(1),
          style: const TextStyle(color: T.acc, fontSize: 24, fontWeight: FontWeight.w700)),
        TextSpan(text: ' ${s['run.needSuffix']}',
          style: Theme.of(c).textTheme.bodyMedium),
      ])),
      const SizedBox(height: 5),
      Text(s['layerDesc.$key'], style: Theme.of(c).textTheme.bodySmall),
    ]));
  }

  Widget _gear(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(s['run.gearHint'], style: Theme.of(c).textTheme.labelSmall),
      const SizedBox(height: 5),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final g in run.state.gear) OutlinedButton(
          onPressed: () => run.useGear(g),
          style: OutlinedButton.styleFrom(
            visualDensity: VisualDensity.compact, foregroundColor: T.txt),
          child: Text('${s.gear(g)}  ${_gearHint(g)}',
            style: const TextStyle(fontSize: 12))),
      ]),
    ]);

  String _gearHint(String g) {
    final spec = app.balance.gear[g]!;
    final v = (spec['v'] as num?)?.toInt() ?? 0;
    return s.f('gearHint.$g', {'n': v});
  }

  /// 부호를 붙여 표시한다. 0 은 부호 없이 — `+0.0`·`+-0.0` 둘 다 읽기 나쁘다.
  static String _signed(double v) => v > 0.05 ? '+${v.toStringAsFixed(1)}'
      : v < -0.05 ? '−${(-v).toStringAsFixed(1)}' : '0.0';

  /// 한 장을 내는 결정은 두 가지로 갈린다 — **넘기는가**, **얼마를 내는가**.
  /// 그래서 판정과 탐지 증가분을 제일 크게 놓고, 스탯·수치는 근거로 아래에 깐다.
  /// (예전에는 카드 이름·판정·스탯·수치가 전부 같은 무게라 눈이 갈 곳이 없었다.)
  Widget _cardTile(BuildContext c, Tool t) {
    final p = run.preview(t);
    final side = p.fatal ? T.bad : (p.clears ? T.acc : T.warn);
    final verdict = p.fatal ? s['run.caught']
        : p.clears ? s['run.pass']
        : s.f('run.short', {'n': p.shortAfter.toStringAsFixed(1)});
    final traceCol = p.fatal ? T.bad : (p.dTrace > 18 ? T.bad : (p.dTrace > 8 ? T.warn : T.dim));
    final want = run.layer.stat;
    final stats = ['dec', 'eva', 'inf'];
    final ordered = want == null ? stats : [want, ...stats.where((x) => x != want)];

    return CardShell(
      accent: side,
      onTap: () => run.play(t),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // ① 판정 + 비용 — 결정에 필요한 두 값
        Row(crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic, children: [
          Expanded(child: Text(verdict, style: TextStyle(
            color: side, fontSize: 17, fontWeight: FontWeight.w700))),
          Text('${s['run.traceAdd']} ', style: const TextStyle(fontSize: 11, color: T.dim)),
          // 소거 카드는 증가분이 0 이하가 될 수 있다. `+` 를 무조건 붙이면 `+-0.0` 이 된다.
          Text(_signed(p.dTrace), style: TextStyle(
            fontFamily: T.mono, fontSize: 16, fontWeight: FontWeight.w700,
            color: p.dTrace <= 0 ? T.acc : traceCol)),
        ]),
        const SizedBox(height: 4),
        // ② 무엇을 내는가
        Row(children: [
          Expanded(child: Text(s.card(t.id), style: const TextStyle(
            fontSize: 13.5, fontWeight: FontWeight.w700, color: T.txt))),
          if (t.effect != null) Tag(s.effect(t.effect!), color: T.acc),
          if (t.priv > 0) Tag('${s['run.priv']}+${t.priv}', color: T.priv),
          if (t.priv < 0) Tag(s['run.priv'], color: T.priv),
          Text(s.type(t.type), style: const TextStyle(fontSize: 11, color: T.dim)),
          const SizedBox(width: 7),
          NoiseDots(t.noise),
        ]),
        const SizedBox(height: 5),
        // ③ 근거 수치
        Wrap(spacing: 12, runSpacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text.rich(TextSpan(children: [
            TextSpan(text: '${s['run.accessOf']} ', style: const TextStyle(fontSize: 11, color: T.dim)),
            TextSpan(text: p.acc.toStringAsFixed(1), style: TextStyle(
              fontFamily: T.mono, fontSize: 12.5, fontWeight: FontWeight.w700, color: side)),
            TextSpan(text: ' / ${p.req.toStringAsFixed(1)}',
              style: const TextStyle(fontFamily: T.mono, fontSize: 12.5, color: T.dim)),
          ])),
          for (final k in ordered) Text.rich(TextSpan(children: [
            TextSpan(text: '${s.stat(k)} ', style: TextStyle(
              fontSize: 11, color: k == want ? T.acc : T.dim)),
            TextSpan(text: '${t.stat(k)}', style: TextStyle(
              fontFamily: T.mono, fontSize: 12,
              fontWeight: k == want ? FontWeight.w700 : FontWeight.w400,
              color: k == want ? T.acc : T.dim)),
          ])),
          if (p.gain > 0.5) Text('${s['run.slackAdd']} +${p.gain.toStringAsFixed(1)}',
            style: const TextStyle(fontFamily: T.mono, fontSize: 12, color: T.acc)),
          if (p.absorbed > 0.5) Text('${s['run.slackAdd']} −${p.absorbed.toStringAsFixed(1)}',
            style: const TextStyle(fontFamily: T.mono, fontSize: 12, color: T.acc)),
        ]),
      ]));
  }
}
