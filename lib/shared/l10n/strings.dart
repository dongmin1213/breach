/// 텍스트 단일 원본 로더.
///
/// ⚠️ 왜 gen_l10n(ARB) 이 아닌가:
///    카드 30종(→60종 예정)·표적·효과의 이름은 **동적 키**(`card.$id.name`)로 조회된다.
///    gen_l10n 은 컴파일 타임에 확정된 키만 타입 안전하게 만들어주므로,
///    데이터 주도 콘텐츠에는 맞지 않는다. 대신 키 존재 여부를 테스트로 잠근다
///    (test/l10n_test.dart — 두 언어의 키 집합이 같은지, 코드가 쓰는 키가 다 있는지).
///
/// 파일 두 벌로 나뉜 이유는 **소유권**이다:
///    assets/l10n/{ko,en}.json      콘텐츠 — ../breach 가 원본, sync_assets.sh 로 가져옴
///    assets/l10n/ui_{ko,en}.json   UI 문구 — 이 앱이 원본
library;

import 'dart:convert';
import 'package:flutter/services.dart';

import 'lang.dart';
export 'lang.dart';

class Strings {
  final Lang lang;
  final Map<String, String> _m;
  const Strings(this.lang, this._m);

  static Strings? _cached;
  static Lang? _cachedLang;

  static Future<Strings> load(Lang lang) async {
    if (_cached != null && _cachedLang == lang) return _cached!;
    final content = await rootBundle.loadString('assets/l10n/${lang.code}.json');
    final ui = await rootBundle.loadString('assets/l10n/ui_${lang.code}.json');
    final m = <String, String>{
      ...Map<String, String>.from(jsonDecode(content)),
      ...Map<String, String>.from(jsonDecode(ui)),
    };
    _cached = Strings(lang, m);
    _cachedLang = lang;
    return _cached!;
  }

  /// 키가 없으면 키 자체를 돌려준다 — 화면에 키가 보이면 번역 누락이 눈에 띈다.
  String operator [](String key) => _m[key] ?? key;

  /// `{n}` 같은 자리표시자를 치환한다.
  String f(String key, Map<String, Object?> args) {
    var s = this[key];
    args.forEach((k, v) => s = s.replaceAll('{$k}', '$v'));
    return s;
  }

  bool has(String key) => _m.containsKey(key);
  Iterable<String> get keys => _m.keys;

  // ── 콘텐츠 조회 헬퍼 (동적 키를 한 곳에 모아 오타를 줄인다)
  String card(String id)    => this['card.$id.name'];
  String effect(String id)  => this['effect.$id.name'];
  String type(String id)    => this['type.$id.name'];
  String grade(String id)   => this['grade.$id.name'];
  String gear(String id)    => this['gear.$id.name'];
  String counter(String id) => this['counter.$id.name'];
  String stat(String id)    => this['stat.$id.name'];
  String layer(String id)   => this['layer.${id.toLowerCase()}.name'];
  String targetName(String id) => this['target.$id.name'];
  String targetLine(String id) => this['target.$id.line'];
  String targetDesc(String id) => this['target.$id.desc'];
}
