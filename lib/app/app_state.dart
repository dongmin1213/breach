/// 앱 전역 상태 — 저장 데이터 · 언어 · 오디오 · 밸런스.
/// 슬라이스들은 이걸 읽고 쓰지만, 슬라이스끼리는 서로를 모른다 (VSA).
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../shared/audio/audio_service.dart';
import '../shared/balance/balance.dart';
import '../shared/engine/engine.dart';
import '../shared/l10n/strings.dart';
import '../shared/storage/save_data.dart';
import '../shared/storage/save_store.dart';

class AppState extends ChangeNotifier {
  final SaveStore store;
  final AudioService audio;
  final Balance balance;
  final List<Tool> pool;
  SaveData save;
  Strings s;

  AppState({required this.store, required this.audio, required this.balance,
            required this.pool, required this.save, required this.s});

  static Future<AppState> boot({AudioService? audio}) async {
    final store = await SaveStore.open();
    final save = store.read();
    final balance = Balance.parse(await rootBundle.loadString('assets/balance.json'));
    final strings = await Strings.load(save.lang);
    final a = audio ?? NoopAudio();
    await a.setBgmVolume(save.bgmVolume);
    await a.setSfxVolume(save.sfxVolume);
    final st = AppState(store: store, audio: a, balance: balance,
      pool: Engine(balance).buildPool(), save: save, s: strings);
    // 덱이 비었거나 풀에 없는 카드가 섞였으면 기본 덱으로 (데이터 손상 방어)
    if (!st.deckIsValid) st.save = save.copyWith(deck: st.defaultDeck());
    return st;
  }

  bool get deckIsValid =>
      save.deck.length == balance.rules.deckSize &&
      save.deck.every((id) => pool.any((t) => t.id == id));

  /// 스탯 3종을 고르게 덮는 무난한 시작 덱
  List<String> defaultDeck() {
    const preferred = ['preattack','packet_mask','badge_clone','port_scan','log_wipe',
      'mitm','dictionary','lockpick','side_channel','privesc','fake_id','tailgate'];
    final ids = pool.map((t) => t.id).toSet();
    final deck = preferred.where(ids.contains).toList();
    for (final t in pool) {
      if (deck.length >= balance.rules.deckSize) break;
      if (!deck.contains(t.id)) deck.add(t.id);
    }
    return deck.take(balance.rules.deckSize).toList();
  }

  Future<void> _persist() async { await store.write(save); notifyListeners(); }

  Future<void> setLang(Lang l) async {
    s = await Strings.load(l);
    save = save.copyWith(lang: l);
    await _persist();
  }
  Future<void> setBgm(double v) async {
    await audio.setBgmVolume(v); save = save.copyWith(bgmVolume: v); await _persist();
  }
  Future<void> setSfx(double v) async {
    await audio.setSfxVolume(v); save = save.copyWith(sfxVolume: v); await _persist();
  }
  Future<void> setDeck(List<String> d) async { save = save.copyWith(deck: d); await _persist(); }
  Future<void> setTarget(String id) async { save = save.copyWith(targetId: id); await _persist(); }
  Future<void> markOnboarded() async { save = save.copyWith(onboarded: true); await _persist(); }

  Future<void> recordRun({required bool won, required int score}) async {
    save = save.copyWith(runs: save.runs + 1, wins: save.wins + (won ? 1 : 0),
      bestScore: score > save.bestScore ? score : save.bestScore);
    await _persist();
  }

  /// 설정의 "저장 데이터 초기화". 되돌릴 수 없다.
  Future<void> resetAll() async {
    await store.reset();
    save = SaveData(deck: defaultDeck());
    s = await Strings.load(save.lang);
    await audio.setBgmVolume(save.bgmVolume);
    await audio.setSfxVolume(save.sfxVolume);
    await _persist();
  }
}
