/// 저장 데이터 — 설정 · 덱 · 진행도.
///
/// 스키마에 version 을 둔다. 나중에 필드가 바뀌어도 마이그레이션할 수 있고,
/// 알 수 없는 버전이면 초기화한다 (깨진 데이터로 크래시하는 것보다 낫다).
library;

import 'dart:convert';

import '../l10n/lang.dart';

const schemaVersion = 1;

class SaveData {
  final int version;
  final Lang lang;
  final double bgmVolume, sfxVolume;
  final List<String> deck;        // 카드 id
  final String targetId;
  final Set<String> unlockedTargets;
  final int runs, wins, bestScore;
  final bool onboarded;

  const SaveData({
    this.version = schemaVersion,
    this.lang = Lang.ko,
    this.bgmVolume = 0.6,
    this.sfxVolume = 0.8,
    this.deck = const [],
    this.targetId = 'telecom',
    this.unlockedTargets = const {'telecom'},
    this.runs = 0, this.wins = 0, this.bestScore = 0,
    this.onboarded = false,
  });

  SaveData copyWith({Lang? lang, double? bgmVolume, double? sfxVolume,
      List<String>? deck, String? targetId, Set<String>? unlockedTargets,
      int? runs, int? wins, int? bestScore, bool? onboarded}) => SaveData(
    lang: lang ?? this.lang,
    bgmVolume: bgmVolume ?? this.bgmVolume, sfxVolume: sfxVolume ?? this.sfxVolume,
    deck: deck ?? this.deck, targetId: targetId ?? this.targetId,
    unlockedTargets: unlockedTargets ?? this.unlockedTargets,
    runs: runs ?? this.runs, wins: wins ?? this.wins, bestScore: bestScore ?? this.bestScore,
    onboarded: onboarded ?? this.onboarded);

  Map<String, dynamic> toJson() => {
    'version': version, 'lang': lang.code,
    'bgm': bgmVolume, 'sfx': sfxVolume,
    'deck': deck, 'target': targetId, 'unlocked': unlockedTargets.toList(),
    'runs': runs, 'wins': wins, 'best': bestScore, 'onboarded': onboarded,
  };

  static SaveData fromJson(Map<String, dynamic> j) => SaveData(
    version: j['version'] ?? schemaVersion,
    lang: LangCode.parse(j['lang'] as String?),
    bgmVolume: (j['bgm'] as num?)?.toDouble() ?? 0.6,
    sfxVolume: (j['sfx'] as num?)?.toDouble() ?? 0.8,
    deck: List<String>.from(j['deck'] ?? const []),
    targetId: j['target'] ?? 'telecom',
    unlockedTargets: Set<String>.from(j['unlocked'] ?? const ['telecom']),
    runs: j['runs'] ?? 0, wins: j['wins'] ?? 0, bestScore: j['best'] ?? 0,
    onboarded: j['onboarded'] ?? false,
  );
}

/// 저장 문자열 → 모델. 알 수 없는(미래) 버전이거나 깨진 JSON 이면 초기화한다 —
/// 잘못된 데이터로 크래시하는 것보다 낫다. 저장소 구현과 무관하므로 여기 둔다.
SaveData decodeSave(String? raw) {
  if (raw == null) return const SaveData();
  try {
    final j = jsonDecode(raw) as Map<String, dynamic>;
    if ((j['version'] ?? 0) > schemaVersion) return const SaveData();
    return SaveData.fromJson(j);
  } catch (_) {
    return const SaveData();
  }
}

String encodeSave(SaveData d) => jsonEncode(d.toJson());
