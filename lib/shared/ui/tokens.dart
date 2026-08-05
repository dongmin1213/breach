/// 디자인 토큰 — 색·간격·타이포를 한 곳에.
/// 화면마다 색을 직접 쓰지 않는다. 테마를 바꿀 때 여기만 고친다.
library;

import 'package:flutter/material.dart';

class T {
  // 색 — 어두운 터미널 톤
  static const bg     = Color(0xFF07090C);
  static const panel  = Color(0xFF0D1117);
  static const line   = Color(0xFF1C2530);
  static const line2  = Color(0xFF2A3644);
  static const txt    = Color(0xFFC9D4E0);
  static const dim    = Color(0xFF6B7C8F);
  static const acc    = Color(0xFF39D3A0);   // 통과 · 좋음
  static const warn   = Color(0xFFF0B429);   // 부족 · 예고
  static const bad    = Color(0xFFF2543D);   // 실패 · 발동
  static const priv   = Color(0xFF7AA2FF);

  /// 리스트가 앉는 바닥 — 카드를 띄워 보이게 하려면 배경이 한 단 더 어두워야 한다
  static const well   = Color(0xFF05070A);

  /// 유형 색 — 텍스트를 읽지 않고 **색만으로** 구분되게 한다
  static const tDirect  = Color(0xFFE0705A);   // 정공
  static const tBypass  = Color(0xFF5AA9E0);   // 우회
  static const tAssault = Color(0xFFE0A93F);   // 강습
  static Color typeColor(String type) => switch (type) {
    'direct'   => tDirect,
    'bypass_t' => tBypass,
    _          => tAssault,
  };

  // 간격
  static const s1 = 4.0, s2 = 8.0, s3 = 12.0, s4 = 16.0, s5 = 24.0;
  static const radius = 6.0;
  static const maxWidth = 430.0;   // 세로 모바일 기준

  static const mono = 'monospace';

  /// 수치는 전부 mono 로. 해커 게임에서 숫자가 본문 폰트로 나오면 데이터로 안 읽힌다.
  /// 자리수가 흔들리지 않아 세로로 비교하기도 쉽다.
  static TextStyle num_(double size, {Color? color, FontWeight w = FontWeight.w700}) =>
      TextStyle(fontFamily: mono, fontSize: size, fontWeight: w, color: color ?? txt,
        letterSpacing: -0.3);

  /// 섹션 라벨 — 대문자 + 자간으로 "시스템이 말하는 톤"
  static const label = TextStyle(fontSize: 10.5, color: dim,
    fontWeight: FontWeight.w700, letterSpacing: 1.4);

  static ThemeData theme() {
    const scheme = ColorScheme.dark(
      surface: bg, primary: acc, secondary: priv, error: bad,
      onSurface: txt, onPrimary: bg,
    );
    return ThemeData(
      useMaterial3: true, colorScheme: scheme, scaffoldBackgroundColor: bg,
      textTheme: const TextTheme(
        displaySmall: TextStyle(color: txt, fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: 2),
        titleLarge:   TextStyle(color: txt, fontSize: 18, fontWeight: FontWeight.w700),
        titleMedium:  TextStyle(color: txt, fontSize: 15, fontWeight: FontWeight.w700),
        bodyMedium:   TextStyle(color: txt, fontSize: 14, height: 1.55),
        bodySmall:    TextStyle(color: dim, fontSize: 12, height: 1.5),
        labelSmall:   TextStyle(color: dim, fontSize: 11),
      ),
      sliderTheme: const SliderThemeData(
        activeTrackColor: acc, inactiveTrackColor: line2, thumbColor: acc),
      dividerColor: line,
    );
  }
}
