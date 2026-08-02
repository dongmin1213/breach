/// 설정 슬라이스 — 언어 · 음량 · 저장 데이터 초기화.
///
/// BGM 음원은 아직 없지만 슬라이더는 지금 완전히 동작한다.
/// AudioService 구현만 갈아끼우면 이 파일은 안 바뀐다.
library;

import 'package:flutter/material.dart';
import '../../app/app_state.dart';
import '../../shared/l10n/strings.dart';
import '../../shared/ui/tokens.dart';

class SettingsPage extends StatefulWidget {
  final AppState app;
  final VoidCallback? onShowRules, onBack;
  const SettingsPage({super.key, required this.app, this.onShowRules, this.onBack});
  @override State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  AppState get app => widget.app;
  Strings get s => app.s;

  Future<void> _confirmReset() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: T.panel,
        title: Text(s['settings.resetConfirmTitle'], style: const TextStyle(color: T.bad)),
        content: Text(s['settings.resetConfirmBody']),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false),
            child: Text(s['settings.resetCancel'], style: const TextStyle(color: T.dim))),
          TextButton(onPressed: () => Navigator.pop(c, true),
            child: Text(s['settings.resetDo'], style: const TextStyle(color: T.bad))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await app.resetAll();
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(s['settings.resetDone']), backgroundColor: T.line2));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(s['settings.title']), backgroundColor: T.bg,
      leading: widget.onBack == null ? null
        : IconButton(icon: const Icon(Icons.arrow_back), onPressed: widget.onBack)),
    body: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: T.maxWidth),
      child: ListView(padding: const EdgeInsets.all(T.s4), children: [
        _label(s['settings.language']),
        Wrap(spacing: T.s2, children: Lang.values.map((l) => ChoiceChip(
          label: Text(l.label),
          selected: app.save.lang == l,
          onSelected: (_) async { await app.setLang(l); if (mounted) setState(() {}); },
        )).toList()),
        const SizedBox(height: T.s5),

        _slider(s['settings.bgm'], app.save.bgmVolume, app.setBgm),
        _slider(s['settings.sfx'], app.save.sfxVolume, app.setSfx),
        const SizedBox(height: T.s5),

        if (widget.onShowRules != null)
          OutlinedButton(onPressed: widget.onShowRules, child: Text(s['settings.rules'])),
        const SizedBox(height: T.s5),

        _label(s['settings.dataTitle']),
        const SizedBox(height: T.s2),
        OutlinedButton(
          onPressed: _confirmReset,
          style: OutlinedButton.styleFrom(
            foregroundColor: T.bad, side: const BorderSide(color: T.bad)),
          child: Text(s['settings.reset']),
        ),
      ]),
    )),
  );

  Widget _label(String t) => Padding(
    padding: const EdgeInsets.only(bottom: T.s2),
    child: Text(t, style: Theme.of(context).textTheme.titleMedium));

  Widget _slider(String label, double v, Future<void> Function(double) set) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: Theme.of(context).textTheme.titleMedium),
        Text('${(v * 100).round()}', style: Theme.of(context).textTheme.bodySmall),
      ]),
      Slider(value: v, onChanged: (x) async { await set(x); if (mounted) setState(() {}); }),
    ]);
}
