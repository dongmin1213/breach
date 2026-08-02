/// 언어 열거 — Flutter 의존 없음 (순수 Dart 테스트에서 쓰기 위해).
library;

enum Lang { ko, en }

extension LangCode on Lang {
  String get code => name;
  String get label => this == Lang.ko ? '한국어' : 'English';
  static Lang parse(String? c) =>
      Lang.values.firstWhere((l) => l.code == c, orElse: () => Lang.ko);
}
