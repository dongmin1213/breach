/// 결정론 경계 검사 — 규칙 1.1 을 문장이 아니라 기계로 강제한다.
///
/// 전투에 난수가 없다는 것이 이 프로젝트의 척추다.
/// 그 위에 데일리 모드·서버 검증·감사 225개가 전부 서 있다.
/// 규칙을 CLAUDE.md 에 적어두는 것만으로는 안 지켜지므로 여기서 잡는다.
///
/// 경계:
///   lib/shared/engine/**  시계·난수 **금지**. 시드만 받아서 순수하게 동작해야 한다.
///   그 밖의 lib/**        새 런의 시드를 만들 때만 시계 허용 (아래 화이트리스트).
library;

import 'dart:io';
import 'package:test/test.dart';

/// 비결정 요소. `math.Random` 은 `dart:math` 를 as 별칭으로 쓰는 경우도 잡는다.
final _forbidden = <String, RegExp>{
  'DateTime.now()': RegExp(r'DateTime\s*\.\s*now\s*\('),
  'Random()': RegExp(r'(?<![A-Za-z_])(?:math\s*\.\s*)?Random\s*\('),
  'Stopwatch': RegExp(r'(?<![A-Za-z_])Stopwatch\s*\('),
  'epoch 시각': RegExp(r'(?:micro|milli)secondsSinceEpoch'),
};

/// 시드 생성은 시계가 필요하다. 여기 적힌 곳만 예외이며,
/// 새 예외를 추가하려면 **왜 결정론을 안 깨는지** 한 줄 적을 것.
const _seedWhitelist = <String, String>{
  'lib/features/breach_run/run_controller.dart':
      '새 런의 시드 생성. 시드가 정해진 뒤로는 엔진이 순수하다.',
};

Iterable<File> _dartFiles(String dir) => Directory(dir)
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'));

void main() {
  test('엔진에 시계·난수가 없다 (lib/shared/engine)', () {
    final hits = <String>[];
    for (final f in _dartFiles('lib/shared/engine')) {
      final src = f.readAsStringSync();
      for (final e in _forbidden.entries) {
        for (final m in e.value.allMatches(src)) {
          final line = '\n'.allMatches(src.substring(0, m.start)).length + 1;
          hits.add('${f.path}:$line — ${e.key}');
        }
      }
    }
    expect(hits, isEmpty,
        reason: '엔진은 시드만 받아 순수하게 동작해야 한다.\n${hits.join('\n')}');
  });

  test('엔진 밖의 비결정 요소는 화이트리스트에만 있다', () {
    final unexpected = <String>[];
    for (final f in _dartFiles('lib')) {
      final rel = f.path.replaceFirst(RegExp(r'^\./'), '');
      if (rel.startsWith('lib/shared/engine')) continue;
      if (_seedWhitelist.containsKey(rel)) continue;
      final src = f.readAsStringSync();
      for (final e in _forbidden.entries) {
        if (e.value.hasMatch(src)) unexpected.add('$rel — ${e.key}');
      }
    }
    expect(unexpected, isEmpty,
        reason: '새 비결정 요소가 생겼다. 정당하면 _seedWhitelist 에 사유와 함께 등록할 것.\n'
                '${unexpected.join('\n')}');
  });

  test('화이트리스트 항목이 실제로 존재한다 (죽은 예외 방지)', () {
    for (final p in _seedWhitelist.keys) {
      expect(File(p).existsSync(), isTrue, reason: '$p 가 없다 — 화이트리스트에서 지울 것');
    }
  });
}
