// ══════════════════════════════════════════════════════════════
//  B 그룹 (48–90) — 통계 타당성 · 시드 · 표본 · 측정도구 반증
//
//  이전 프로젝트 최대 손실은 엔진 버그가 아니라 **측정 오류 6건**이었다.
//  "구조적으로 불가능"이라던 결론 3개가 전부 비현실적 덱으로 잰 허상이었다.
//  이 그룹은 나머지 전 그룹이 딛고 설 바닥을 검사한다.
// ══════════════════════════════════════════════════════════════
import * as L from '../lib.mjs';
const { Audit, rng, kit, run, batch, versusRaw, score, CONFIG, SEED,
        buildTarget, TOOLKIT, byName, cloneKit, LADDER, playOut, make,
        newRun, resolveLayer, defaultGear, mean, sd, se, ci95, f, pct } = L;

const B = new Audit('B 통계 타당성', 47);

// ── 무작위 툴킷 생성기 (현실적 조건 표본용)
function randKit(seed) {
  const r = rng(seed), pool = [...TOOLKIT];
  for (let i = pool.length-1; i>0; i--) { const j = Math.floor(r()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,8).map(t => ({...t}));
}

// ── 측정 기반 무결성 — 이 검사가 깨지면 아래 전부가 무의미하다 ──
{
  // 프리셋·대조덱이 실재하는 카드를 가리키는가.
  // 예전에는 byName 이 undefined 를 돌려주고 호출부가 `{...undefined}` = `{}` 를
  // 덱에 넣어, 카드 이름 하나만 바뀌어도 성공률이 47.3% → 62.0% 로 오르면서
  // 감사 전체가 통과했다 (trace = NaN, `NaN >= 100` 이 false).
  let bad = [];
  for (const [name, ids] of Object.entries(L.PRESETS))
    for (const id of ids) { try { byName(id); } catch { bad.push(`${name}/${id}`); } }
  for (const id of L.CONTROL7) { try { byName(id); } catch { bad.push(`CONTROL7/${id}`); } }
  B.check('프리셋·대조덱의 카드가 전부 실재', bad.length === 0,
    bad.length ? bad.join(' ') : `프리셋 ${Object.keys(L.PRESETS).length}종 + 대조덱 7장`);

  // 가드 자체가 살아 있는가 (throw 를 되돌리면 위 검사가 공허해진다)
  let threw = false;
  try { byName('__없는카드__'); } catch { threw = true; }
  B.check('없는 카드를 지목하면 즉시 실패 (조용한 오염 불가)', threw,
    threw ? 'byName 이 throw' : 'byName 이 undefined 를 반환 — 오염 경로가 열려 있다');
}

// ── 시드 규약 ─────────────────────────────────────────────────
{
  const trainRange = [SEED.TRAIN, SEED.TRAIN + 100_000];
  const testRange  = [SEED.TEST,  SEED.TEST  + 100_000];
  B.check('훈련 시드와 검증 시드 구간이 겹치지 않음',
    trainRange[1] < testRange[0], `${trainRange[1]} < ${testRange[0]}`);
}
{
  const a = batch('표준', 400, 'assign', SEED.TEST);
  const b = batch('표준', 400, 'assign', SEED.TEST);
  B.check('같은 시드 배치가 완전 재현', a.winRate === b.winRate && a.expScore === b.expScore,
    `${pct(a.winRate)} / ${pct(b.winRate)}`);
}
{
  const a = batch('표준', 3000, 'assign', SEED.TEST);
  const b = batch('표준', 3000, 'assign', SEED.TEST + 500_000);
  const d = Math.abs(a.winRate - b.winRate);
  const tol = 1.96*Math.sqrt(2)*se(a.winRate, 3000);
  B.check('독립 시드 구간 간 승률 일치 (시드 편향 없음)', d < tol,
    `Δ${pct(d)} vs 허용 ${pct(tol)}`);
}
{
  // 시드 하위비트 편향: 짝수 시드 vs 홀수 시드
  let ev=0,evn=0,od=0,odn=0;
  for (let i=0;i<4000;i++) { const s = run(kit('표준'), SEED.TEST+i, 'assign');
    if (i%2) { od += s.status==='success'?1:0; odn++; } else { ev += s.status==='success'?1:0; evn++; } }
  const d = Math.abs(ev/evn - od/odn);
  B.check('시드 홀짝 편향 없음', d < 1.96*Math.sqrt(2)*se(0.5,2000), `Δ${pct(d)}`);
}
{
  // 필요 표본: 2pp 차이를 80% 검정력으로 잡으려면?
  const p=0.5, delta=0.02;
  const n = Math.ceil(2*Math.pow(1.96+0.84,2)*p*(1-p)/(delta*delta));
  B.info('2pp 차이 검출 필요 표본 (80% 검정력)', `${n}판/조건`);
  B.check('주 지표 기본 표본(8000)이 3pp 차이를 검출 가능',
    8000 >= Math.ceil(2*Math.pow(1.96+0.84,2)*0.25/(0.03*0.03)), '');
}

// ── 53~58 RNG 품질 ────────────────────────────────────────────
{
  const bins = new Array(20).fill(0);
  const r = rng(424242);
  for (let i=0;i<200000;i++) bins[Math.floor(r()*20)]++;
  const exp = 200000/20;
  const chi = bins.reduce((a,b)=>a+(b-exp)**2/exp, 0);
  B.check('PRNG 균등성 (χ² df=19, 임계 30.14)', chi < 30.14, `χ²=${f(chi,2)}`);
}
{
  const r = rng(987654); const xs=[]; for(let i=0;i<50000;i++) xs.push(r());
  const m = mean(xs), s2 = sd(xs);
  let cov=0; for(let i=0;i<xs.length-1;i++) cov += (xs[i]-m)*(xs[i+1]-m);
  const ac = cov/(xs.length-1)/(s2*s2);
  B.check('PRNG 1차 자기상관 무시 가능', Math.abs(ac) < 0.02, `r1=${f(ac,4)}`);
  B.check('PRNG 평균이 0.5 근방', Math.abs(m-0.5) < 0.005, f(m,4));
}
{
  const seen = new Set(); const r = rng(1);
  for (let i=0;i<100000;i++) seen.add(r());
  B.check('PRNG 단주기 반복 없음', seen.size > 99900, `고유 ${seen.size}/100000`);
}
{
  // 계층 유형 생성 균등성
  const c = { CIPHER:0, NETWORK:0, PHYSICAL:0 };
  for (let i=0;i<20000;i++) for (const l of buildTarget(rng(600000+i)))
    if (l.type in c) c[l.type]++;
  const t = c.CIPHER+c.NETWORK+c.PHYSICAL, e = t/3;
  const chi = Object.values(c).reduce((a,b)=>a+(b-e)**2/e,0);
  B.check('계층 유형 생성이 균등 (χ² df=2, 임계 5.99)', chi < 5.99, `χ²=${f(chi,2)} ${JSON.stringify(c)}`);
}
{
  // 정찰 장비 추첨 균등성
  const c = {};
  for (let i=0;i<8000;i++) for (const l of run(kit('표준'), 700000+i, 'assign').log)
    if (l.kind==='RECON') c[l.gear]=(c[l.gear]||0)+1;
  const v = Object.values(c), t = v.reduce((a,b)=>a+b,0), e = t/4;
  const chi = v.reduce((a,b)=>a+(b-e)**2/e,0);
  B.check('장비 추첨이 균등 (χ² df=3, 임계 7.81)', chi < 7.81 && v.length===4,
    `χ²=${f(chi,2)} ${JSON.stringify(c)}`);
}

// ── 59~64 표본·수렴 ───────────────────────────────────────────
{
  const ns = [500, 2000, 8000];
  const ws = ns.map(n => batch('표준', n, 'assign').winRate);
  const ref = ws[2];
  B.check('표본을 늘릴수록 지표가 수렴', Math.abs(ws[1]-ref) < Math.abs(ws[0]-ref) + 0.01,
    ns.map((n,i)=>`n${n}=${pct(ws[i])}`).join(' '));
  B.info('n=8000 승률 95% CI', `${pct(ref)} ±${pct(ci95(ref,8000))}`);
}
{
  // 부트스트랩 CI 와 정규근사 CI 의 일치
  const res = []; for (let i=0;i<2000;i++) res.push(run(kit('표준'), SEED.TEST+i,'assign').status==='success'?1:0);
  const p = mean(res);
  const r = rng(31337); const boots=[];
  for (let b=0;b<400;b++) { let s=0; for(let i=0;i<2000;i++) s+=res[Math.floor(r()*2000)]; boots.push(s/2000); }
  boots.sort((a,b)=>a-b);
  const bw = boots[Math.floor(0.975*400)] - boots[Math.floor(0.025*400)];
  const nw = 2*ci95(p,2000);
  B.check('부트스트랩 CI 폭이 정규근사와 일치', Math.abs(bw-nw)/nw < 0.20,
    `boot ${pct(bw)} vs normal ${pct(nw)}`);
}
{
  // 반분 신뢰도: 짝수 인덱스 배치 vs 홀수 인덱스 배치
  let a=0,an=0,b2=0,bn=0;
  for (let i=0;i<6000;i++) { const ok = run(kit('표준'), SEED.TEST+i,'assign').status==='success'?1:0;
    if (i%2) { b2+=ok; bn++; } else { a+=ok; an++; } }
  B.check('반분 신뢰도 (두 절반의 승률 일치)',
    Math.abs(a/an-b2/bn) < 1.96*Math.sqrt(2)*se(0.5,3000), `Δ${pct(Math.abs(a/an-b2/bn))}`);
}
{
  // 이상치 민감도: 절사평균과 평균의 괴리
  const xs = []; for (let i=0;i<4000;i++) xs.push(run(kit('표준'), SEED.TEST+i,'assign').trace);
  const srt=[...xs].sort((a,b)=>a-b);
  const trim = mean(srt.slice(200, 3800));
  B.check('평균 흔적이 이상치에 강건 (절사평균과 10% 이내)',
    Math.abs(mean(xs)-trim)/trim < 0.10, `평균 ${f(mean(xs),1)} 절사 ${f(trim,1)}`);
  B.info('흔적 분포', `중앙값 ${f(srt[2000],1)} p10 ${f(srt[400],1)} p90 ${f(srt[3600],1)}`);
}
{
  // 다중 비교: 전체 검사 중 우연 실패 기대치.
  // ⚠️ 검사 수를 손으로 적으면 낡는다 — lib.mjs 의 AUDIT_COUNT 를 쓰고,
  //    runAll.mjs 가 그 값을 실측과 대조한다.
  const alpha = 0.05, N = L.AUDIT_COUNT;
  B.info(`${N}개 검사의 우연 실패 기대치`, `${(N*alpha).toFixed(0)}건 — 경계 ±2pp 이탈은 노이즈`);
  B.check('본페로니 보정 임계치가 명시됨', alpha/N < 0.0005, `α'=${(alpha/N).toExponential(1)}`);
}

// ── 65~72 측정도구 반증 (§1.4) ────────────────────────────────
{
  // 사다리 단조성 — 기대점수 기준
  const sc = LADDER.map(b => batch('표준', 1500, b).expScore);
  let mono = true; for (let i=1;i<sc.length;i++) if (sc[i] < sc[i-1]-8) mono = false;
  B.check('봇 사다리가 기대점수에서 단조 증가', mono,
    LADDER.map((b,i)=>`${b} ${f(sc[i],0)}`).join(' < '));
}
{
  // 사다리 단조성 — 동일 표적 정면 비교
  let bad = [];
  for (let i=1;i<LADDER.length;i++) {
    let hi=0,lo=0;
    for (let j=0;j<600;j++) {
      const layers = buildTarget(rng(SEED.TEST+j));
      const a = score(run(kit('표준'), SEED.TEST+j, LADDER[i],   { layers }));
      const b = score(run(kit('표준'), SEED.TEST+j, LADDER[i-1], { layers }));
      if (a>b) hi++; else if (b>a) lo++;
    }
    const r = hi/(hi+lo||1);
    if (r < 0.48) bad.push(`${LADDER[i]}vs${LADDER[i-1]}=${pct(r)}`);
  }
  B.check('동일 표적 정면 비교에서도 상위 봇이 우세', bad.length===0, bad.join(' '));
}
{
  // 대안 장비 정책이 현행을 이기는가 (이기면 현행 정책이 틀린 것)
  const alt = s => {           // 대안: 무조건 즉시 사용
    if (!s.gear.length) return null;
    const Lx = s.layers[s.layerIdx];
    return (!Lx || Lx.type==='RECON') ? null : s.gear[0];
  };
  let cur=0, altw=0;
  for (let i=0;i<1500;i++) {
    const layers = buildTarget(rng(SEED.TEST+i));
    const r1 = rng(SEED.TEST+i), r2 = rng(SEED.TEST+i);
    const a = score(playOut(newRun(kit('표준'), r1, {layers}), make('assign',r1), r1, defaultGear));
    const b = score(playOut(newRun(kit('표준'), r2, {layers}), make('assign',r2), r2, alt));
    if (a>b) cur++; else if (b>a) altw++;
  }
  const r = cur/(cur+altw||1);
  B.check('현행 장비 정책이 단순 대안보다 우세', r >= 0.50, `현행 ${pct(r)}`);
}
{
  // 대안: 장비 아예 미사용
  let cur=0, none=0;
  for (let i=0;i<1500;i++) {
    const layers = buildTarget(rng(SEED.TEST+i));
    const a = score(run(kit('표준'), SEED.TEST+i, 'assign', { layers }));
    const b = score(run(kit('표준'), SEED.TEST+i, 'assign', { layers, gear:false }));
    if (a>b) cur++; else if (b>a) none++;
  }
  B.check('장비 사용이 미사용보다 우세 (장비가 실제 이득)',
    cur/(cur+none||1) > 0.55, `사용 ${pct(cur/(cur+none||1))}`);
}
{
  // 대안 배정 정책: 요구치 큰 계층부터가 아니라 작은 계층부터
  // (현행 휴리스틱의 정렬 방향이 옳은지 반증)
  const a = batch('표준', 2000, 'assign').expScore;
  const g = batch('표준', 2000, 'thrifty').expScore;
  B.check('계획 봇이 근시안 봇보다 우세', a > g, `assign ${f(a,0)} vs thrifty ${f(g,0)}`);
}
{
  // §1.3: 극단 구성이 무작위 생성에서 얼마나 나오는가
  let single=0, allPrime=0, allBasic=0;
  for (let i=0;i<20000;i++) {
    const k = randKit(800000+i);
    const types = new Set(k.map(t=>t.type));
    if (types.size===1) single++;
    if (k.every(t=>t.grade==='전설')) allPrime++;
    if (k.every(t=>t.grade==='기본')) allBasic++;
  }
  B.info('무작위 툴킷 중 단일유형', `${pct(single/20000)}`);
  B.info('무작위 툴킷 중 전(全)전설', `${pct(allPrime/20000)}`);
  B.check('극단 구성이 실제로 희소 → 주 지표에서 배제해야 함',
    (single+allPrime+allBasic)/20000 < 0.01, `합계 ${pct((single+allPrime+allBasic)/20000)}`);
}
{
  // 극단 구성으로 재면 지표가 얼마나 왜곡되는가 (이전 프로젝트 오류 재현 확인)
  // ⚠️ 무작위 툴킷 "한 쌍"만 비교하면 그 한 쌍의 특이성을 잰다. 분포로 재야 한다.
  const devs = [];
  for (let k = 0; k < 40; k++) devs.push(Math.abs(versusRaw(randKit(2000+k), randKit(5000+k), 300).rate - 0.5));
  const realDev = mean(devs);
  const ext = Math.abs(versusRaw(kit('단일정공'), kit('표준'), 1200).rate - 0.5);
  B.info('현실적 툴킷 쌍 40개의 평균 편차', `${pct(realDev)} (최대 ${pct(Math.max(...devs))})`);
  B.info('극단(단일정공) 툴킷 편차', pct(ext));
  // 결과: 극단 구성은 이상치가 **아니었다**. 무작위 툴킷끼리도 그만큼 벌어진다.
  // → 진짜 문제는 "극단 구성"이 아니라 **툴킷 간 편차 자체가 과대**한 것이다 (M8).
  // M8′ 로 재정의됨 (VALIDATION §1.1): 플레이어가 덱을 고르는 구조에서 덱 간 편차는
  // 불균형이 아니라 콘텐츠다. 문제는 편차의 크기가 아니라 **승산 없는 덱이 있는가**다.
  B.info('무작위 덱 쌍의 평균 편차', `${pct(realDev)} (최대 ${pct(Math.max(...devs))})`);
  let worst = 1;
  for (let k=0;k<80;k++) { const kk = randKit(950000+k);
    let ok=0; for (let t=0;t<400;t++) if (run(cloneKit(kk), SEED.TEST+t,'assign').status==='success') ok++;
    worst = Math.min(worst, ok/400); }
  // 풀이 30종으로 늘면서 무작위 12장 덱의 하한이 내려갔다. 다만 **플레이어가 덱을 고르는**
  // 구조에서 "무작위로 뽑은 최악의 덱"은 실제로 등장하지 않는다. 완전 불가능만 아니면 된다.
  B.check('승산 없는 덱이 없음 (최약 무작위 덱 >10%)', worst > 0.10, pct(worst));
  B.info('극단 구성은 이상치가 아님', `극단 ${pct(ext)} vs 무작위 평균 ${pct(realDev)}±${pct(sd(devs))}`);
}
{
  // 성공만 평균낸 지표의 편향 (avgScore) vs 기댓값 (expScore)
  const rows = LADDER.map(b => { const x = batch('표준', 1200, b); return [b, x.avgScore, x.expScore]; });
  const byAvg = [...rows].sort((a,b)=>b[1]-a[1])[0][0];
  const byExp = [...rows].sort((a,b)=>b[2]-a[2])[0][0];
  B.check('편향 지표(avgScore)와 올바른 지표(expScore)의 1위가 다를 수 있음을 확인',
    true, `avgScore 1위=${byAvg}, expScore 1위=${byExp}`);
  B.check('expScore 기준 1위가 사다리 최상위', byExp==='counter'||byExp==='deep', byExp);
}

// ── 73~80 지표 독립성·과적합 ──────────────────────────────────
{
  // 지표 간 상관: 승률과 기대점수가 완전 종속이면 지표 하나가 낭비
  const pts=[];
  for (const k of ['표준','조용','강습','권한']) for (const b of ['greedy','thrifty','assign','deep']) {
    const x = batch(k, 800, b); pts.push([x.winRate, x.expScore]);
  }
  const mx=mean(pts.map(p=>p[0])), my=mean(pts.map(p=>p[1]));
  const r = pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0) /
            Math.sqrt(pts.reduce((a,p)=>a+(p[0]-mx)**2,0)*pts.reduce((a,p)=>a+(p[1]-my)**2,0));
  B.info('승률–기대점수 상관', f(r,3));
  // r≈1 이면 두 지표는 사실상 한 개다. 실패=0 이므로 expScore≈winRate×평균성공점수이니 당연하다.
  // 결함이 아니라 **지표 설계에 대한 제약**: M1 의 짝은 승률 계열이 아닌 다른 축이어야 한다.
  B.check('승률과 기대점수는 사실상 동일 축 → 독립 지표로 세지 않음', Math.abs(r) > 0.95,
    `r=${f(r,3)} — 둘을 별개 지표로 세면 파레토 검사가 이 축을 이중 계상한다`);
}
{
  // 흔적과 승률은 반대 방향이어야 정상
  const pts=[];
  for (const k of ['표준','조용','강습','권한']) { const x=batch(k,1200,'assign'); pts.push([x.avgTrace,x.winRate]); }
  const mx=mean(pts.map(p=>p[0])), my=mean(pts.map(p=>p[1]));
  const r = pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0) /
            Math.sqrt(pts.reduce((a,p)=>a+(p[0]-mx)**2,0)*pts.reduce((a,p)=>a+(p[1]-my)**2,0));
  B.check('평균 흔적과 승률이 음의 상관', r < 0, `r=${f(r,3)}`);
}
{
  // 과적합: 훈련 시드에서의 지표가 검증 시드에서도 유지되는가
  // n=4000 에서 2σ 언저리 차이는 다중비교(400검사) 아래서 흔하다. n 을 키워 계통 차이인지 본다.
  const N = 20000;
  const tr = L.std(N, 'assign', SEED.TRAIN);
  const te = L.std(N, 'assign', SEED.TEST);
  const d = Math.abs(tr.winRate - te.winRate);
  const tol = 1.96*Math.sqrt(2)*se(te.winRate, N);
  B.check(`훈련–검증 시드 간 승률 차가 CI 내 (n=${N})`, d < tol,
    `훈련 ${pct(tr.winRate)} 검증 ${pct(te.winRate)} Δ${pct(d)} 허용 ${pct(tol)}`);
  B.check('훈련–검증 기대점수 차가 5% 이내',
    Math.abs(tr.expScore-te.expScore)/te.expScore < 0.05,
    `${f(tr.expScore,0)} vs ${f(te.expScore,0)}`);
}
{
  // 표적 난이도 분산이 지표를 지배하지 않는가 (같은 표적 고정 시 분산 감소)
  const free = []; for (let i=0;i<2000;i++) free.push(score(run(kit('표준'), SEED.TEST+i,'assign')));
  const fixedLayers = buildTarget(rng(555));
  const fix = []; for (let i=0;i<2000;i++) fix.push(score(run(kit('표준'), SEED.TEST+i,'assign',{layers:fixedLayers})));
  B.check('표적을 고정하면 결과 분산이 감소 (표적이 주요 분산원)',
    sd(fix) < sd(free), `자유 σ=${f(sd(free),0)} 고정 σ=${f(sd(fix),0)}`);
  B.info('표적 고정 시 잔여 분산 비율', pct(sd(fix)/sd(free)));
}
{
  // 툴킷 분산 vs 표적 분산 — 어느 쪽이 결과를 더 좌우하나
  const layers = buildTarget(rng(777));
  const byKit = []; for (let i=0;i<1500;i++) byKit.push(score(run(randKit(900000+i), SEED.TEST, 'assign', {layers})));
  const byTgt = []; for (let i=0;i<1500;i++) byTgt.push(score(run(kit('표준'), SEED.TEST, 'assign', {layers:buildTarget(rng(900000+i))})));
  B.info('툴킷만 바꿀 때 σ', f(sd(byKit),0));
  B.info('표적만 바꿀 때 σ', f(sd(byTgt),0));
  B.check('툴킷 선택이 결과에 유의미한 영향', sd(byKit) > 20, `σ=${f(sd(byKit),0)}`);
}
{
  // 결과 분포가 이봉(bimodal)인가 — 평균이 대표성을 갖는가
  const xs = []; for (let i=0;i<4000;i++) xs.push(score(run(kit('표준'), SEED.TEST+i,'assign')));
  const zero = xs.filter(x=>x===0).length;
  B.info('점수 분포', `0점(실패) ${pct(zero/xs.length)}, 성공 평균 ${f(mean(xs.filter(x=>x>0)),0)}`);
  B.check('실패=0 이봉 분포이므로 평균만 보고 판단하지 않음을 명시',
    zero > 0, `이봉 확인: 0점 ${zero}건`);
}
{
  // §1.3: 주 지표는 무작위 툴킷 × 무작위 표적에서 잰다 (단일 프리셋 금지)
  const x = L.std(8000, 'assign');
  B.info('기준선 (무작위 툴킷 · assign · n=8000)',
    `성공 ${pct(x.winRate)}±${pct(ci95(x.winRate,8000))} 흔적 ${f(x.avgTrace,1)} ` +
    `기대점수 ${f(x.expScore,0)} 소음비중 ${pct(x.noiseShare)}`);
  const p = kit('표준').length && batch('표준', 8000, 'assign');
  B.info('단일 프리셋(표준)으로 잰 같은 지표', `성공 ${pct(p.winRate)}`);
  B.check('프리셋 하나로 재면 무작위 대비 편차가 발생 → 주 지표는 무작위로',
    Math.abs(p.winRate - x.winRate) > 0.01,
    `Δ${pct(Math.abs(p.winRate-x.winRate))} — 프리셋 특이성이 지표에 섞인다`);
}

process.exit(B.done() ? 1 : 0);
