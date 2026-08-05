/// 결과 슬라이스 — 성패 · 점수 · 다음 행동.
///
/// "완전히 같은 판 다시"는 결정론 덕에 가능하다. 같은 시드면 표적·손패·전개가 전부 같다.
/// 배울 게 있는 패배를 만들려면 그 재도전이 있어야 한다.
library;

import 'package:flutter/material.dart';
import '../../app/app_state.dart';
import '../../shared/model/run_outcome.dart';
import '../../shared/ui/tokens.dart';
import '../../shared/ui/widgets.dart';

class ResultPage extends StatelessWidget {
  final AppState app;
  final RunOutcome outcome;
  final VoidCallback onAgain, onRetry, onToDeck;
  const ResultPage({super.key, required this.app, required this.outcome,
    required this.onAgain, required this.onRetry, required this.onToDeck});

  @override
  Widget build(BuildContext context) {
    final s = app.s;
    final won = outcome.won;
    final col = won ? T.acc : T.bad;
    final r = app.balance.rules;
    return Scaffold(body: SafeArea(child: Frame(child: Center(child: ListView(
      shrinkWrap: true, children: [
        Text(won ? s['result.success'] : s['result.failed'],
          style: Theme.of(context).textTheme.displaySmall?.copyWith(color: col)),
        const SizedBox(height: 2),
        Text(won ? s['result.successMsg']
                 : s.f('result.failedMsg', {'n': outcome.layersReached}),
          style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: T.s4),
        _row(context, s['result.finalTrace'],
          '${outcome.trace.toStringAsFixed(1)} / ${r.traceMax}'),
        _row(context, s['result.toolsLeft'], '${outcome.toolsLeft}'),
        _row(context, s['result.slackLeft'], outcome.slack.toStringAsFixed(1)),
        _row(context, s['result.score'], '${outcome.score}', color: col, big: true),
        const SizedBox(height: T.s2),
        Text(s['result.scoreHint'], style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: T.s4),
        FilledButton(onPressed: onAgain, child: Text(s['result.again'])),
        const SizedBox(height: T.s2),
        OutlinedButton(onPressed: onRetry, child: Text(s['result.retry'])),
        const SizedBox(height: T.s2),
        OutlinedButton(onPressed: onToDeck, child: Text(s['result.toDeck'])),
      ])))));
  }

  Widget _row(BuildContext c, String k, String v, {Color? color, bool big = false}) =>
    Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: T.line))),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(k, style: Theme.of(c).textTheme.bodyMedium),
        Text(v, style: TextStyle(color: color ?? T.txt,
          fontSize: big ? 19 : 14, fontWeight: FontWeight.w700)),
      ]));
}
