/// 저장소 — SharedPreferences 어댑터.
/// 모델(save_data.dart)은 순수 Dart 라 테스트가 빠르고, Flutter 의존은 여기만 진다.
library;

import 'package:shared_preferences/shared_preferences.dart';
import 'save_data.dart';

const _kSave = 'breach.save.v1';

class SaveStore {
  final SharedPreferences _p;
  SaveStore(this._p);

  static Future<SaveStore> open() async => SaveStore(await SharedPreferences.getInstance());

  SaveData read() => decodeSave(_p.getString(_kSave));
  Future<void> write(SaveData d) => _p.setString(_kSave, encodeSave(d));

  /// 설정 화면의 "저장 데이터 초기화". 되돌릴 수 없으므로 UI 에서 확인을 받는다.
  Future<void> reset() => _p.remove(_kSave);
}
