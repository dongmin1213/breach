#!/bin/sh
# 전 구간 검증. 밸런스나 엔진을 건드렸으면 반드시 통과시킬 것.
#
# ⚠️ 각 단계를 `| tail` 로 감싸면 `set -e` 가 **앞 명령의 실패를 못 본다.**
#    파이프라인의 종료코드는 마지막 명령(tail)의 것이라 항상 0 이 되기 때문이다.
#    예전에는 5단계 중 4단계가 그렇게 감싸여 있어서, 이 스크립트는 감사가 깨져도
#    ✓ 를 찍고 0 으로 끝났다 — **게이트가 아무것도 막지 못하고 있었다.**
#    그래서 출력은 파일로 받아 tail 은 표시에만 쓰고, 종료코드는 원래 명령에서 가져온다.
set -e
cd "$(dirname "$0")/.."

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

# step <제목> <성공시 표시할 줄 수> <명령...>
step() {
  _title=$1; _lines=$2; shift 2
  echo "── $_title"
  if "$@" >"$LOG" 2>&1; then
    tail -n "$_lines" "$LOG"
    echo
  else
    _code=$?
    tail -n 40 "$LOG"
    echo
    echo "✗ 실패: $_title (종료코드 $_code)"
    exit "$_code"
  fi
}

step "1. 밸런스 감사 (JS 기준 구현)"           11 node sim/runAll.mjs
step "2. 골든 픽스처 재생성"                    2 node sim/golden.mjs
step "3. 정적 분석"                             1 dart analyze lib test
step "4. Dart 엔진 (골든 400런 · l10n · 저장)"  1 dart test
step "5. 웹 정수 의미론 (dart2js)"              1 dart test -p chrome test/prng_web_test.dart

echo "✓ 전 구간 통과"
echo
echo "  밸런스 수치를 바꿨다면 파레토 검사가 따로 필요하다 (변경 전후 비교):"
echo "    node sim/analysis/metrics.mjs"
