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

  Widget _gauge(BuildContext c, dynamic r) {
    final alert = run.state.alert;
    final col = TraceGauge.colorFor(run.state.trace / r.traceMax);
    return Column(children: [
      Row(children: [
        Text(s['run.traceGauge'].toUpperCase(), style: T.label.copyWith(color: col)),
        const Spacer(),
        // 경계 단계는 "지금 얼마나 비싸졌는가"라 눈에 띄어야 한다
        if (alert > 0) Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: T.warn.withValues(alpha: 0.15),
            border: Border.all(color: T.warn.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(3)),
          child: Text(s.f('run.alertStage', {'n': alert}),
            style: const TextStyle(color: T.warn, fontSize: 11, fontWeight: FontWeight.w700)))
        else Text(s['run.noAlert'], style: Theme.of(c).textTheme.labelSmall),
      ]),
      const SizedBox(height: 5),
      TraceGauge(trace: run.state.trace,
        max: r.traceMax.toDouble(), steps: List<int>.from(r.alertSteps)),
      const SizedBox(height: 7),
      Row(children: [
        _meter(s['run.slack'], run.state.slack.toStringAsFixed(1), T.acc),
        const SizedBox(width: 6),
        _meter(s['run.toolsLeft'], '${run.state.hand.length}', T.txt),
        if (run.state.priv > 0) ...[
          const SizedBox(width: 6),
          _meter(s['run.priv'], '${run.state.priv}', T.priv),
        ],
      ]),
    ]);
  }

  /// 상태 수치 — 라벨은 작게 위, 값은 mono 로 크게. 칩보다 계기판처럼 읽힌다.
  Widget _meter(String label, String value, Color col) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 8),
    decoration: BoxDecoration(color: T.well, border: Border.all(color: T.line),
      borderRadius: BorderRadius.circular(3)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(), style: T.label.copyWith(fontSize: 9)),
      const SizedBox(height: 1),
      Text(value, style: T.num_(14, color: col)),
    ])));

  /// 이번 계층 — 요구치가 이 화면의 기준선이므로 제일 크게 두고,
  /// 나머지는 그 아래 한 줄로 붙인다. (예전에는 네 줄이 같은 무게로 흩어져 있었다.)
  Widget _layerPanel(BuildContext c) {
    final L = run.layer;
    final key = L.type.toLowerCase();
    final want = L.stat;
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
      decoration: BoxDecoration(
        color: T.panel,
        border: Border.all(color: T.line2),
        borderRadius: BorderRadius.circular(3),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5),
          blurRadius: 12, offset: const Offset(0, 3))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(s.layer(key).toUpperCase(), style: T.label),
          const Spacer(),
          if (want != null) Text(s.stat(want), style: const TextStyle(
            color: T.acc, fontSize: 11.5, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 6),
        // 요구치 — 이 판의 기준선
        Row(crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic, children: [
          Text(run.requirement.toStringAsFixed(1), style: T.num_(34, color: T.acc)),
          const SizedBox(width: 7),
          Expanded(child: Text(
            want != null
              ? s.f('run.statNeeded', {'stat': s.stat(want)})
              : s['run.finalGate'],
            style: Theme.of(c).textTheme.bodySmall?.copyWith(height: 1.35))),
        ]),
        const SizedBox(height: 7),
        Container(height: 1, color: T.line),
        const SizedBox(height: 7),
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
        Row(children: [
          VerdictBadge(verdict, side),
          const Spacer(),
          Text('${s['run.traceAdd']} ', style: const TextStyle(fontSize: 10.5, color: T.dim)),
          // 소거 카드는 증가분이 0 이하가 될 수 있다. `+` 를 무조건 붙이면 `+-0.0` 이 된다.
          Text(_signed(p.dTrace),
            style: T.num_(17, color: p.dTrace <= 0 ? T.acc : traceCol)),
        ]),
        const SizedBox(height: 7),
        // ② 무엇을 내는가 — 유형은 척추 색과 같은 색 점으로 묶어 둔다
        Row(children: [
          Container(width: 6, height: 6, margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(shape: BoxShape.circle, color: T.typeColor(t.type))),
          Text(s.card(t.id), style: const TextStyle(
            fontSize: 13.5, fontWeight: FontWeight.w700, color: T.txt)),
          const SizedBox(width: 6),
          Text(s.type(t.type), style: TextStyle(fontSize: 10.5, color: T.typeColor(t.type))),
          const Spacer(),
          if (t.effect != null) Tag(s.effect(t.effect!), color: T.acc),
          if (t.priv > 0) Tag('${s['run.priv']}+${t.priv}', color: T.priv),
          if (t.priv < 0) Tag(s['run.priv'], color: T.priv),
          const SizedBox(width: 3),
          NoiseDots(t.noise),
        ]),
        const SizedBox(height: 6),
        // ③ 근거 수치 — 전부 mono 로 세로 비교가 되게
        Wrap(spacing: 12, runSpacing: 3, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text.rich(TextSpan(children: [
            TextSpan(text: '${s['run.accessOf']} ', style: const TextStyle(fontSize: 10.5, color: T.dim)),
            TextSpan(text: p.acc.toStringAsFixed(1), style: T.num_(13, color: side)),
            TextSpan(text: ' / ${p.req.toStringAsFixed(1)}',
              style: T.num_(12, color: T.dim, w: FontWeight.w400)),
          ])),
          for (final k in ordered) Text.rich(TextSpan(children: [
            TextSpan(text: '${s.stat(k)} ', style: TextStyle(
              fontSize: 10.5, color: k == want ? T.acc : T.dim)),
            TextSpan(text: '${t.stat(k)}', style: T.num_(12,
              color: k == want ? T.acc : T.dim,
              w: k == want ? FontWeight.w700 : FontWeight.w400)),
          ])),
          if (p.gain > 0.5) Text('${s['run.slackAdd']} +${p.gain.toStringAsFixed(1)}',
            style: T.num_(12, color: T.acc, w: FontWeight.w400)),
          if (p.absorbed > 0.5) Text('${s['run.slackAdd']} −${p.absorbed.toStringAsFixed(1)}',
            style: T.num_(12, color: T.acc, w: FontWeight.w400)),
        ]),
      ]));
  }
}
