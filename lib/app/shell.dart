/// 앱 셸 — 화면 전환만 담당한다. 슬라이스끼리는 서로를 모른다 (VSA).
library;

import 'package:flutter/material.dart';
import '../features/breach_run/breach_run_page.dart';
import '../features/breach_run/run_controller.dart';
import '../features/deck_builder/deck_builder_page.dart';
import '../features/onboarding/onboarding_sheet.dart';
import '../features/result/result_page.dart';
import '../features/settings/settings_page.dart';
import '../features/target_select/target_select_page.dart';
import 'app_state.dart';

enum Screen { targets, deck, run, result, settings }

class Shell extends StatefulWidget {
  final AppState app;
  const Shell({super.key, required this.app});
  @override State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  AppState get app => widget.app;
  Screen screen = Screen.targets;
  RunController? run;
  bool _recorded = false;

  @override
  void initState() {
    super.initState();
    if (!app.save.onboarded) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await showOnboarding(context, app.s);
        await app.markOnboarded();
      });
    }
  }

  void _go(Screen s) => setState(() => screen = s);

  void _startRun() {
    _recorded = false;
    run = RunController(app);
    _go(Screen.run);
  }

  Future<void> _finish() async {
    if (_recorded || run == null) return;
    _recorded = true;
    final o = run!.outcome;
    await app.recordRun(won: o.won, score: o.score);
    if (mounted) _go(Screen.result);
  }

  @override
  Widget build(BuildContext context) => switch (screen) {
    Screen.settings => SettingsPage(app: app,
        onShowRules: () => showOnboarding(context, app.s),
        onBack: () => _go(Screen.targets)),
    Screen.targets => TargetSelectPage(app: app,
        onPick: (id) async { await app.setTarget(id); _go(Screen.deck); },
        onSettings: () => _go(Screen.settings)),
    Screen.deck => DeckBuilderPage(app: app,
        onStart: _startRun, onBack: () => _go(Screen.targets)),
    Screen.run => BreachRunPage(app: app, run: run!,
        onFinished: _finish, onQuit: () => _go(Screen.targets)),
    Screen.result => ResultPage(app: app, outcome: run!.outcome,
        onAgain: _startRun,
        onRetry: () { _recorded = false; run!.start(withSeed: run!.seed); _go(Screen.run); },
        onToDeck: () => _go(Screen.deck)),
  };
}
