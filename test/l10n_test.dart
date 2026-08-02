/// 번역 누락을 잡는다. 키가 화면에 그대로 노출되기 전에 여기서 걸린다.

library;
import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';

Map<String, String> load(String p) =>
    Map<String, String>.from(jsonDecode(File(p).readAsStringSync()));

void main() {
  final ko = {...load('assets/l10n/ko.json'), ...load('assets/l10n/ui_ko.json')};
  final en = {...load('assets/l10n/en.json'), ...load('assets/l10n/ui_en.json')};
  final balance = jsonDecode(File('assets/balance.json').readAsStringSync());

  test('두 언어의 키 집합이 동일', () {
    expect(en.keys.toSet().difference(ko.keys.toSet()), isEmpty, reason: 'ko 에 없는 키');
    expect(ko.keys.toSet().difference(en.keys.toSet()), isEmpty, reason: 'en 에 없는 키');
  });

  test('빈 문자열이 없음', () {
    for (final m in [ko, en]) {
      for (final e in m.entries) {
        expect(e.value.trim(), isNotEmpty, reason: e.key);
      }
    }
  });

  test('balance.json 의 모든 id 에 이름이 있음', () {
    for (final c in balance['cards']) {
      expect(ko.containsKey('card.${c['id']}.name'), isTrue, reason: 'card.${c['id']}');
    }
    for (final t in balance['targets']) {
      for (final f in ['name', 'line', 'desc']) {
        expect(ko.containsKey('target.${t['id']}.$f'), isTrue, reason: 'target.${t['id']}.$f');
      }
    }
    for (final k in (balance['effects'] as Map).keys) {
      expect(ko.containsKey('effect.$k.name'), isTrue, reason: 'effect.$k');
    }
    for (final k in (balance['gear'] as Map).keys) {
      expect(ko.containsKey('gear.$k.name'), isTrue, reason: 'gear.$k');
    }
    for (final k in balance['counters']) {
      expect(ko.containsKey('counter.$k.name'), isTrue, reason: 'counter.$k');
    }
  });

  test('자리표시자가 두 언어에서 일치', () {
    final re = RegExp(r'\{(\w+)\}');
    for (final k in ko.keys) {
      final a = re.allMatches(ko[k]!).map((m) => m[1]).toSet();
      final b = re.allMatches(en[k]!).map((m) => m[1]).toSet();
      expect(b, equals(a), reason: k);
    }
  });
}
