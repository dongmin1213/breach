# 카드 아트 계약

이 폴더에 파일만 떨구면 앱이 자동으로 집어 간다. **코드 수정은 필요 없다.**

```
파일명   assets/cards/<card id>.png      ← id 는 assets/balance.json 의 cards[].id
크기     512 × 512 (정사각)
포맷     PNG · 알파 채널 있음
```

없는 카드는 `lib/shared/ui/card_art.dart` 가 id 에서 결정적으로 생성한
회로 패턴을 대신 그린다. 그러니 **일부만 채워도 섞여서 동작한다.**

## 아트 디렉션

이 게임은 어두운 터미널 톤의 해킹 침투물이다 (`docs/01-overview.md`).

```
배경      투명 또는 아주 어두운 남색 (#07090C 위에 얹힌다)
톤        저채도 · 고대비 · 네온 한 점
금지      흰 배경 · 밝은 파스텔 · 사진 실사 · 문자/로고/워터마크
가독성    폭 120px 로 줄여도 무엇인지 읽혀야 한다 (실제 표시 크기)
구성      중앙 집중 · 단일 오브젝트 · 여백 15%
```

유형별 강조색 (`lib/shared/ui/tokens.dart` 와 맞출 것):

| 유형 | 뜻 | 색 |
|---|---|---|
| `direct` 정공 | 정면 돌파 | `#E0705A` 주홍 |
| `bypass_t` 우회 | 은밀·안정 | `#5AA9E0` 청록 |
| `assault` 강습 | 최고 화력·최고 소음 | `#E0A93F` 호박 |

카드의 강조색은 그 카드 유형색을 쓴다. 나머지는 무채색에 가깝게.

## 카드 목록

| id | 한글 | English | 유형 | 효과 |
|---|---|---|---|---|
| `preattack` | 사전공격 | Preemptive Strike | direct | - |
| `packet_mask` | 패킷위장 | Packet Mask | bypass_t | - |
| `badge_clone` | 배지복제 | Badge Clone | bypass_t | - |
| `port_scan` | 포트스캔 | Port Scan | bypass_t | - |
| `log_wipe` | 로그와이프 | Log Wipe | bypass_t | wipe |
| `brute_force` | 브루트포스 | Brute Force | assault | - |
| `side_channel` | 사이드채널 | Side Channel | bypass_t | cloak |
| `mitm` | 중간자 | Man-in-the-Middle | direct | - |
| `tailgate` | 테일게이팅 | Tailgating | assault | - |
| `privesc` | 권한상승 | Privilege Escalation | direct | - |
| `zero_day` | 제로데이 | Zero Day | assault | overload |
| `persist_backdoor` | 지속백도어 | Persistent Backdoor | bypass_t | bypass |
| `dictionary` | 딕셔너리 | Dictionary Attack | direct | - |
| `lockpick` | 자물쇠따기 | Lockpick | direct | - |
| `proxy_chain` | 프록시체인 | Proxy Chain | bypass_t | - |
| `fake_id` | 위장ID | Forged Badge | bypass_t | - |
| `wardrive` | 워드라이빙 | Wardriving | bypass_t | scout |
| `rainbow` | 레인보우 | Rainbow Table | assault | - |
| `jammer` | 신호재밍 | Signal Jammer | assault | - |
| `social` | 소셜링 | Social Engineering | direct | - |
| `cover_story` | 커버스토리 | Cover Story | bypass_t | cloak |
| `keylogger` | 키로거 | Keylogger | direct | morph |
| `traffic_analysis` | 트래픽분석 | Traffic Analysis | bypass_t | scout |
| `chain_exploit` | 체인익스플로잇 | Exploit Chain | direct | - |
| `emp_pulse` | EMP펄스 | EMP Pulse | assault | - |
| `rootkit` | 루트킷 | Rootkit | bypass_t | bypass |
| `hw_implant` | 하드웨어임플란트 | Hardware Implant | assault | morph |
| `master_key` | 마스터키 | Master Key | direct | - |
| `overclock` | 오버클럭 | Overclock | assault | frenzy |
| `overheat` | 과열회로 | Overheated Circuit | assault | frenzy |
| `burn_notice` | 소각지시 | Burn Notice | direct | wipe |
| `stack_smash` | 스택스매시 | Stack Smash | direct | overload |
| `ghost_route` | 고스트루트 | Ghost Route | assault | cloak |
| `hardline_tap` | 하드라인탭 | Hardline Tap | bypass_t | - |
| `cred_harvest` | 자격증명수집 | Credential Harvest | direct | - |
| `kernel_exploit` | 커널익스플로잇 | Kernel Exploit | assault | - |
| `token_forge` | 토큰위조 | Token Forgery | bypass_t | - |
| `cold_boot` | 콜드부트 | Cold Boot Attack | direct | - |
| `crypto_break` | 암호해독 | Cryptanalysis | assault | - |
| `beacon_spoof` | 비컨스푸핑 | Beacon Spoofing | assault | - |
