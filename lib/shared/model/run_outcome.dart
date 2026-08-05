/// 한 판의 결과 — 슬라이스 사이를 건너가는 **순수 값**.
///
/// 왜 필요한가: `result` 슬라이스가 `breach_run/run_controller.dart` 를 직접 import 해서
/// 플레이 슬라이스의 내부 타입(`RunController` · `RunState`)을 들여다보고 있었다.
/// 그러면 컨트롤러를 고칠 때마다 결과 화면이 깨지고, VSA 의 "한 기능을 고치면 한 폴더만
/// 만진다"가 성립하지 않는다 (docs/07 §문제1).
///
/// 값만 건너가므로 `result` 는 엔진도 컨트롤러도 모른다.
library;

class RunOutcome {
  final bool won;

  /// 실패 시 "몇 계층까지 갔는가" — 결과 문구에 쓴다
  final int layersReached;

  final double trace, slack;
  final int toolsLeft, score;

  const RunOutcome({
    required this.won,
    required this.layersReached,
    required this.trace,
    required this.slack,
    required this.toolsLeft,
    required this.score,
  });
}
