// 덱빌딩이 이 규칙 위에서 성립하는가 — 세 가지를 잰다.
//   ① 희석 비용 : 풀에 나쁜 카드를 넣으면 실제로 손해인가
//   ② 제거 가치 : 풀을 얇게 만드는 것이 이득인가
//   ③ 시너지   : 따로면 약한데 같이 넣으면 강해지는 조합이 있는가
// 셋 다 없으면 "카드를 모으기만 하는" 게임이지 덱빌딩이 아니다.
import * as L from '../lib.mjs';
const { CONFIG, run, score, newRun, playOut, make, defaultGear, buildTarget,
        rng, SEED, TOOLKIT, byName, makeTool, cloneKit, mean, sd, pct, f } = L;

// 풀 크기를 손패보다 크게 해서 "뽑기"가 생기게 한다
const trial = (pool, n = 6000, tag = '') => {
  let ok = 0, tot = 0;
  for (let i = 0; i < n; i++) {
    const seed = SEED.TEST + i, r = rng(seed);
    const s = playOut(newRun(cloneKit(pool), r, {}), make('assign', r), r, defaultGear);
    if (s.status === 'success') ok++;
    tot += score(s);
  }
  return { tag, win: ok/n, exp: tot/n, size: pool.length };
};

const P = n => byName(n);
const GOOD8 = ['브루트포스','테일게이팅','사전공격','중간자','권한상승','포트스캔','로그와이프','사이드채널'].map(P);

console.log('\n══ ① 희석 비용 — 풀에 카드를 더 넣으면? ══');
console.log('   (손패는 계층+1 로 고정. 풀이 커질수록 원하는 카드를 못 뽑는다)');
{
  const base = trial(GOOD8, 6000, '풀 8 (전부 드로우)');
  console.log(`   ${base.tag.padEnd(22)} 성공 ${pct(base.win)}  기대점수 ${f(base.exp,0)}`);

  // 약한 카드를 채워 넣는다 (스탯 낮고 효과 없음)
  const junk = i => makeTool('잡툴'+i, '기본', ['정공','우회','강습'][i%3], [40,35,35], 1);
  for (const add of [2, 4, 8]) {
    const pool = [...GOOD8, ...Array.from({length:add}, (_,i)=>junk(i))];
    const t = trial(pool, 6000);
    console.log(`   풀 ${String(8+add).padEnd(2)} (+잡툴 ${add})`.padEnd(25) +
      ` 성공 ${pct(t.win)}  기대점수 ${f(t.exp,0)}  Δ${f((t.win-base.win)*100,1)}pp`);
  }
  // 대조: 좋은 카드를 채워 넣으면?
  const goodAdd = ['제로데이','지속백도어','패킷위장','배지복제'].map(P);
  const t2 = trial([...GOOD8, ...goodAdd], 6000);
  console.log(`   풀 12 (+정상툴 4)`.padEnd(25) +
    ` 성공 ${pct(t2.win)}  기대점수 ${f(t2.exp,0)}  Δ${f((t2.win-base.win)*100,1)}pp`);
}

console.log('\n══ ② 제거 가치 — 풀을 얇게 만들면? ══');
{
  const junk = i => makeTool('잡툴'+i, '기본', ['정공','우회','강습'][i%3], [40,35,35], 1);
  const fat  = [...GOOD8, ...Array.from({length:6}, (_,i)=>junk(i))];   // 14장
  const thin = [...GOOD8, ...Array.from({length:2}, (_,i)=>junk(i))];   // 10장
  const a = trial(fat, 6000), b = trial(thin, 6000);
  console.log(`   뚱뚱한 풀 14장   성공 ${pct(a.win)}  기대점수 ${f(a.exp,0)}`);
  console.log(`   압축한 풀 10장   성공 ${pct(b.win)}  기대점수 ${f(b.exp,0)}`);
  console.log(`   → 잡툴 4장 제거의 가치: ${f((b.win-a.win)*100,1)}pp`);
}

console.log('\n══ ③ 시너지 — 따로 vs 같이 ══');
{
  // 중립 채움 카드로 풀 크기를 항상 12 로 고정해야 희석 효과와 섞이지 않는다
  const filler = i => makeTool('중립'+i, '정예', ['정공','우회','강습'][i%3], [45,45,45], 2);
  const mkPool = extra => {
    const p = [...extra];
    for (let i = 0; p.length < 12; i++) p.push(filler(i));
    return p;
  };
  const pairs = [
    ['권한 축적 + 소비', [P('포트스캔'), P('중간자'), P('권한상승')],
                        [P('포트스캔'), P('중간자')], [P('권한상승')]],
    ['은폐 + 고소음',    [P('사이드채널'), P('브루트포스')],
                        [P('사이드채널')], [P('브루트포스')]],
    ['소거 + 고소음',    [P('로그와이프'), P('브루트포스'), P('테일게이팅')],
                        [P('로그와이프')], [P('브루트포스'), P('테일게이팅')]],
    ['유형 3분산',       [P('사전공격'), P('패킷위장'), P('테일게이팅')],
                        [P('사전공격'), P('패킷위장')], [P('테일게이팅')]],
  ];
  const nul = trial(mkPool([]), 5000).win;
  console.log(`   기준 (중립 12장)  성공 ${pct(nul)}\n`);
  for (const [name, both, onlyA, onlyB] of pairs) {
    const wBoth = trial(mkPool(both), 5000).win;
    const wA = trial(mkPool(onlyA), 5000).win;
    const wB = trial(mkPool(onlyB), 5000).win;
    // 시너지 = 같이 넣었을 때 이득 − 따로 넣었을 때 이득의 합
    const syn = (wBoth-nul) - ((wA-nul) + (wB-nul));
    console.log(`   ${name.padEnd(16)} 같이 ${pct(wBoth)} / A만 ${pct(wA)} / B만 ${pct(wB)}` +
                `  → 시너지 ${f(syn*100,1)}pp`);
  }
}

console.log('\n══ ④ 조합이 결과를 좌우하는가 (덱빌딩의 전제) ══');
{
  const rates = [];
  for (let k=0;k<200;k++) {
    const r = rng(700000+k), p=[...TOOLKIT];
    for (let i=p.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]];}
    const kk = p.slice(0,8).map(t=>({...t}));
    let ok=0; for (let t=0;t<300;t++) if (run(cloneKit(kk), SEED.TEST+t,'assign').status==='success') ok++;
    rates.push(ok/300);
  }
  rates.sort((a,b)=>a-b);
  console.log(`   무작위 8종 조합 200개: 최저 ${pct(rates[0])} 중앙 ${pct(rates[100])} 최고 ${pct(rates[199])} (σ ${pct(sd(rates))})`);
  console.log(`   → 조합만 바꿔도 성공률이 ${pct(rates[199]-rates[0])} 벌어진다`);
}
console.log('');
