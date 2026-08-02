/// 앱 계층 검증 — 저장 스키마 · 기본 덱 · 초기화.
library;
import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import 'package:breach_app/shared/balance/balance.dart';
import 'package:breach_app/shared/engine/engine.dart';
import 'package:breach_app/shared/storage/save_data.dart';
import 'package:breach_app/shared/audio/audio_service.dart';
import 'package:breach_app/shared/l10n/lang.dart';

void main() {
  final b = Balance.parse(File('assets/balance.json').readAsStringSync());
  final pool = Engine(b).buildPool();

  test('저장 데이터가 왕복해도 동일', () {
    const d = SaveData(lang: Lang.en, bgmVolume: 0.3, sfxVolume: 0.9,
      deck: ['preattack', 'mitm'], targetId: 'vault',
      unlockedTargets: {'telecom', 'vault'}, runs: 7, wins: 3, bestScore: 912,
      onboarded: true);
    final back = SaveData.fromJson(jsonDecode(jsonEncode(d.toJson())));
    expect([back.lang, back.bgmVolume, back.sfxVolume, back.deck, back.targetId,
            back.unlockedTargets, back.runs, back.wins, back.bestScore, back.onboarded],
           equals([d.lang, d.bgmVolume, d.sfxVolume, d.deck, d.targetId,
                   d.unlockedTargets, d.runs, d.wins, d.bestScore, d.onboarded]));
  });

  test('미래 버전 저장본은 초기화된다', () {
    final future = jsonEncode({'version': schemaVersion + 1, 'deck': ['x']});
    expect(decodeSave(future).deck, isEmpty);
  });

  test('깨진 JSON 도 크래시하지 않고 초기화된다', () {
    expect(decodeSave('{not json').runs, equals(0));
    expect(decodeSave(null).lang, equals(Lang.ko));
  });

  test('기본 덱이 풀 안에 있고 크기가 맞음', () {
    const preferred = ['preattack','packet_mask','badge_clone','port_scan','log_wipe',
      'mitm','dictionary','lockpick','side_channel','privesc','fake_id','tailgate'];
    final ids = pool.map((t) => t.id).toSet();
    final deck = preferred.where(ids.contains).toList();
    expect(deck.length, equals(b.rules.deckSize),
        reason: '기본 덱 카드가 풀에 다 있어야 한다');
  });

  test('무음 오디오가 볼륨을 기억한다 (설정이 실제로 반영되는지 확인 가능)', () async {
    final a = NoopAudio();
    await a.setBgmVolume(0.42);
    await a.playBgm('main');
    expect(a.bgm, equals(0.42));
    expect(a.current, equals('main'));
    await a.stopBgm();
    expect(a.current, isNull);
  });
}
