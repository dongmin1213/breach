/// 오디오 — 지금은 인터페이스만 있고 구현은 무음이다.
///
/// BGM 음원은 나중에 넣지만 **설정 화면은 오늘 완성해 둔다.**
/// 슬라이더·저장·복원이 전부 동작하고, 나중에 JustAudioService 로 갈아끼울 때
/// settings 슬라이스는 한 줄도 안 건드린다.
library;

abstract class AudioService {
  Future<void> setBgmVolume(double v);   // 0.0 ~ 1.0
  Future<void> setSfxVolume(double v);
  Future<void> playBgm(String track);
  Future<void> stopBgm();
  Future<void> playSfx(String name);
}

/// 음원이 없는 동안 쓰는 무음 구현. 볼륨은 기억해 둬서 설정이 실제로 반영되는지 확인 가능.
class NoopAudio implements AudioService {
  double bgm = 0, sfx = 0;
  String? current;

  @override Future<void> setBgmVolume(double v) async => bgm = v;
  @override Future<void> setSfxVolume(double v) async => sfx = v;
  @override Future<void> playBgm(String track) async => current = track;
  @override Future<void> stopBgm() async => current = null;
  @override Future<void> playSfx(String name) async {}
}
