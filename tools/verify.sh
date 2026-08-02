#!/bin/sh
# 전 구간 검증. 밸런스나 엔진을 건드렸으면 반드시 통과시킬 것.
set -e
cd "$(dirname "$0")/.."

echo "── 1. 밸런스 감사 (JS 기준 구현)"
node sim/runAll.mjs | tail -2

echo
echo "── 2. 골든 픽스처 재생성"
node sim/golden.mjs

echo
echo "── 3. 정적 분석"
dart analyze lib test | tail -1

echo
echo "── 4. Dart 엔진 (골든 400런 · l10n · 저장)"
dart test | tail -1

echo
echo "── 5. 웹 정수 의미론 (dart2js)"
dart test -p chrome test/prng_web_test.dart | tail -1
