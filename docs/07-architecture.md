# 07 · 코드 구조

```
breach/
  pubspec.yaml            Flutter 프로젝트 루트
  assets/                 ★ 수치·텍스트 단일 원본 (앱과 시뮬레이터가 같이 읽음)
    balance.json            수치 (영문 id + 숫자만. 한글 0개 — 감사가 검사)
    l10n/{ko,en}.json       콘텐츠 문자열 (카드·표적·효과 이름)
    l10n/ui_{ko,en}.json    UI 문구
  lib/
    main.dart
    app/                  앱 셸 — 전역 상태 · 화면 전환
    shared/               횡단 관심사
      engine/               룰 엔진 (prng · engine · bots · targets)
      balance/              JSON 로더
      l10n/                 문자열 조회
      storage/              저장 (순수 모델 + SharedPreferences 어댑터)
      audio/                AudioService 인터페이스 + NoopAudio
      ui/                   디자인 토큰 · 공용 위젯
    features/             세로 슬라이스
      onboarding · target_select · deck_builder · breach_run · result · settings
  test/
    golden.json             Dart 포팅 정답지 (sim/golden.mjs 가 생성)
    golden_test · prng_test · prng_web_test · determinism_test · l10n_test · app_test
  sim/                    JS 밸런스 검증 하니스
    core/                   JS 엔진 — **검증의 기준 구현**
    audits/                 감사 A~J (221개 검사)
    analysis/               스윕 · 시너지 · 표적 교차 검증 도구
    lib.mjs runAll.mjs golden.mjs
  tools/verify.sh         전 구간 검증
  docs/                   이 문서들
```

---

## 왜 JS 엔진과 Dart 엔진이 둘 다 있는가

**JS 엔진(`sim/core/`)이 검증의 기준이다.** 감사 221개가 그 위에서 돈다.
Dart 엔진은 그것을 재현하는 구현이고, `test/golden_test.dart` 가 일치를 강제한다.

JS 를 버리면 감사 하니스를 통째로 잃는다. Dart 만으로 감사를 다시 쓰는 것은
수천 줄을 옮기는 일이고, 그 과정에서 검증된 측정 도구가 다시 편향될 위험이 크다.

**밸런스를 고칠 때는 항상 JS 쪽에서 검증하고 골든을 다시 뽑는다.**

## 왜 에셋이 한 벌인가

(이력) 초기에는 `breach/assets`(원본)와 `breach_app/assets`(복사본)로 나뉘어 있었고
동기화 스크립트가 필요했다. Flutter 를 저장소 루트로 올려서 **복사를 없앴다.**

- Flutter 는 `assets/` 를 네이티브로 읽는다
- JS 시뮬레이터는 `../../assets/balance.json` 을 읽는다

한 파일만 고치면 시뮬레이터가 그 값을 검증하고 앱이 그 값으로 돈다. 갈라질 수 없다.

---

## VSA 현황 — 절반만 맞다

측정한 의존 그래프:

```
슬라이스 → 슬라이스 직접 의존   6개 중 1개 (result → breach_run)
슬라이스 → shared/app          나머지 전부
app/shell.dart 만 모든 슬라이스를 안다
```

### 잘 된 것
슬라이스끼리 대체로 서로를 모른다. 화면 전환은 `app/shell.dart` 한 곳에 모여 있다.

### 문제 1 — `result` → `breach_run` 직접 의존
```dart
import '../breach_run/run_controller.dart';   // result_page.dart
```
결과 화면이 플레이 슬라이스의 내부 타입을 본다. `RunController` 를 고치면 `result` 가 깨진다.
**고칠 것:** 순수 결과 값(`RunOutcome`)만 넘긴다.

### 문제 2 — `AppState` 가 신 객체
```
deck_builder 10회 · breach_run 10회 · settings 8회 · target_select 4회 · result 2회
```
6개 슬라이스가 하나의 가변 객체를 공유한다. 저장·언어·오디오·밸런스·카드풀·통계를
다 들고 `setDeck`/`setTarget`/`recordRun`/`resetAll` 까지 한다.

VSA 의 핵심은 "한 기능을 고치면 한 폴더만 만진다"인데, 덱 저장 방식을 바꾸려면
`app/app_state.dart` 를 열어야 하고 그러면 다른 5개 슬라이스가 같은 파일을 공유한다.

**고칠 것:** `settings_store` / `loadout_store` / `progress_store` 로 쪼갠다.

### 문제 3 — 세로 깊이가 없음
슬라이스 대부분이 **UI 한 장씩**이다 (`breach_run` 만 controller 가 있다).
세로로 자른 게 아니라 **가로로 자르고 UI만 폴더로 나눈 것**에 가깝다.

**지금은 고치지 않는다.** 슬라이스가 화면 한 장인데 상태·리포지토리·모델을 만들면 과설계다.
기능이 커질 때(덱 프리셋·필터·정렬 등) 그 슬라이스에만 깊이를 준다.

---

## 결정론 — 건드리면 안 되는 것

`lib/shared/engine/prng.dart` 가 이 프로젝트에서 가장 위험한 코드다.

```dart
int imul32(int a, int b)   // JS Math.imul 의 16비트 분할 구현
```

Dart 네이티브 int 는 64비트, **웹은 double** 이라 그냥 `a * b` 를 쓰면
웹 빌드에서만 조용히 다른 난수가 나온다. 한 비트만 어긋나면
데일리·서버 검증·감사 221개가 전부 무의미해진다.

수정했다면 반드시:
```
dart test test/determinism_test.dart      # 엔진에 시계·난수가 없는지 (파일·줄 번호까지 지목)
dart test -p chrome test/prng_web_test.dart   # 웹 정수 의미론
```

결정론 경계는 테스트로 강제된다:
- `lib/shared/engine/**` — 시계·난수 **금지**
- 그 밖 — 새 런의 시드 생성만 예외 (`test/determinism_test.dart` 의 `_seedWhitelist` 에 사유와 함께 등록)

---

## 라이브러리 선택

| 선택 | 이유 |
|---|---|
| gen_l10n **미사용** | 카드 이름이 `card.$id.name` 같은 **동적 키**라 컴파일 타임 코드 생성과 안 맞는다. 대신 `test/l10n_test.dart` 가 키 집합·빈 문자열·자리표시자 일치를 검사 |
| 상태관리 패키지 **없음** | `ChangeNotifier` + `AnimatedBuilder` 로 충분한 규모 |
| `shared_preferences` | 저장 데이터가 작다 |
| 오디오 라이브러리 **미도입** | `AudioService` 인터페이스 + `NoopAudio`. 음원 넣을 때 구현만 교체하면 `settings` 슬라이스는 안 바뀐다 |
