// 손패 +4 · 덱 12/28 로 바꾼 뒤 악화된 3지표가 진짜 손상인지 지표 노후인지 가른다.
//
// ⚠️ 순서가 중요하다. "무엇을 재면 옳은가"를 **결과를 보기 전에** 정한다.
//    안 그러면 나쁜 수치를 볼 때마다 지표를 고쳐 통과시키는 자기기만이 된다.
//
//  M3 (툴 사용률 46.9%→9.0%)
//    가설: 손패에 벤치가 생기면 약한 카드는 당연히 안 낸다. 이건 "사문화"가 아니라 "선택".
//    반증 조건: 어떤 표적 원형에서도 쓰이지 않는 툴이 있으면 → 진짜 사문화.
//    → 재는 것: 툴별 **최대 사용률**(전 원형 중 가장 잘 쓰이는 곳). 이게 낮으면 진짜 죽은 카드.
//
//  M5 (소음 사용률 폭 15.2%→30.4%)
//    가설: 사용률은 벤치가 생기면 갈리는 게 정상. 공정성은 **성능**으로 재야 한다.
//    반증 조건: 소음 수준별 성능(보유 시 성공률) 스프레드가 크면 → 진짜 가격 오류.
//
//  M9 (만회 가능 38.0%→33.0%)
//    가설: 실패 원인이 "수를 잘못 뒀다"에서 "덱을 잘못 짰다"로 이동했다.
//    반증 조건: 수로도 못 살리고 **덱을 바꿔도** 못 살리면 → 그냥 운. 진짜 문제.
//    → 재는 것: 실패 중 다른 덱이었으면 성공했을 비율.
import * as L from '../lib.mjs';
const { CONFIG, run, std, randKit, score, newRun, resolveLayer, playOut, make,
        defaultGear, buildTarget, layerLog, makeTool, cloneKit, marginal,
        rng, SEED, TOOLKIT, DECK_SIZE, mean, sd, pct, f } = L;

// ── 원형 (targets.mjs 와 동일)
const BK = { layer: JSON.parse(JSON.stringify(CONFIG.LAYER)), ru:CONFIG.RESIST_UP,
             rd:CONFIG.RESIST_DOWN, he:CONFIG.HAND_EXTRA, cf:CONFIG.COUNTER_FROM,
             al:[...CONFIG.ALERT_STEPS], ru2:CONFIG.COUNTER_REQ_UP };
const restore=()=>{ for(const k of Object.keys(BK.layer)){CONFIG.LAYER[k].req=[...BK.layer[k].req];
  CONFIG.LAYER[k].tr=BK.layer[k].tr;} CONFIG.RESIST_UP=BK.ru; CONFIG.RESIST_DOWN=BK.rd;
  CONFIG.HAND_EXTRA=BK.he; CONFIG.COUNTER_FROM=BK.cf; CONFIG.ALERT_STEPS=[...BK.al];
  CONFIG.COUNTER_REQ_UP=BK.ru2; };
const sReq=m=>{for(const k of Object.keys(BK.layer)) CONFIG.LAYER[k].req=BK.layer[k].req.map(x=>x*m);};
const sTr =m=>{for(const k of Object.keys(BK.layer)) CONFIG.LAYER[k].tr=BK.layer[k].tr*m;};
const ARCH = {
  표준:   { apply(){} },
  요새:   { apply(){ sReq(1.14); sTr(0.80); } },
  감시망: { apply(){ sReq(0.86); sTr(1.45); } },
  학습형: { apply(){ CONFIG.RESIST_UP=2.5; CONFIG.RESIST_DOWN=0.2; } },
  폐쇄망: { apply(){ CONFIG.HAND_EXTRA=1; }, layers:7 },
  미끼:   { apply(){ CONFIG.COUNTER_FROM=1; CONFIG.ALERT_STEPS=[18,38,60];
                     CONFIG.COUNTER_REQ_UP=0.45; } },
};

// ══ M3′ 툴별 최대 사용률 ══════════════════════════════════════
console.log('\n══ M3′ — 어떤 원형에서도 안 쓰이는 툴이 있는가 ══');
{
  const best = {}; for (const t of TOOLKIT) best[t.name] = 0;
  for (const [an, A] of Object.entries(ARCH)) {
    restore(); A.apply();
    const opts = A.layers ? { layerCount: A.layers } : {};
    const held = {}, played = {};
    for (let i=0;i<3000;i++) {
      const seed=SEED.TEST+i, r=rng(seed);
      const s0 = newRun(randKit(seed), r, opts);
      for (const c of new Set(s0.hand.map(x=>x.name))) held[c]=(held[c]||0)+1;
      const s = playOut(s0, make('assign',r), r, defaultGear);
      for (const n of new Set(layerLog(s).map(l=>l.tool).filter(Boolean)))
        played[n]=(played[n]||0)+1;
    }
    for (const t of TOOLKIT) {
      const u = held[t.name] ? (played[t.name]||0)/held[t.name] : 0;
      if (u > best[t.name]) best[t.name] = u;
    }
  }
  restore();
  const rows = Object.entries(best).sort((a,b)=>a[1]-b[1]);
  console.log('  최저 5종: ' + rows.slice(0,5).map(([n,v])=>`${n} ${pct(v)}`).join(' · '));
  console.log('  최고 3종: ' + rows.slice(-3).map(([n,v])=>`${n} ${pct(v)}`).join(' · '));
  const dead = rows.filter(r=>r[1] < 0.30);
  console.log(`  → 어느 원형에서도 30% 미만인 툴: ${dead.length}종` +
              (dead.length?` (${dead.map(d=>d[0]).join(', ')})`:''));
  console.log(`  판정: ${dead.length===0 ? 'OK — 사문화된 툴 없음. M3 하락은 벤치 선택의 결과'
                                          : '!! 진짜 사문화'}`);
}

// ══ M5′ 소음 수준별 성능 ═══════════════════════════════════════
console.log('\n══ M5′ — 소음 가격의 공정성을 사용률이 아닌 성능으로 ══');
{
  const rs = [0,1,2,3,4].map(n => marginal(makeTool('N'+n,'정예','우회',[45,45,45],n), 4000));
  console.log('  소음별 보유시 성공률: ' + rs.map((r,i)=>`n${i} ${pct(r.winWithHeld)}`).join(' · '));
  console.log('  소음별 사용률:        ' + rs.map((r,i)=>`n${i} ${pct(r.useRate)}`).join(' · '));
  const w = rs.map(r=>r.winWithHeld), spread = Math.max(...w)-Math.min(...w);
  console.log(`  → 성능 스프레드 ${pct(spread)}`);
  console.log(`  판정: ${spread < 0.10 ? 'OK — 가격은 공정. 사용률 차이는 상황 선택'
                                       : '!! 소음 가격이 실제로 불공정'}`);
}

// ══ M9′ 실패의 귀속: 수 vs 덱 ══════════════════════════════════
console.log('\n══ M9′ — 실패가 무엇 탓인가 (수 / 덱 / 운) ══');
{
  let tot=0, byPlay=0, byDeck=0, neither=0;
  for (let i=0;i<700;i++) {
    const seed=SEED.TEST+i;
    const r0=rng(seed), s0=newRun(randKit(seed), r0, {});
    if (playOut(s0, make('assign'), r0, defaultGear).status!=='failed') continue;
    tot++;

    // (a) 같은 덱, 다른 수로 살릴 수 있었나
    let saved=false, s=s0, r=rng(seed);
    while (s.status==='running' && !saved) {
      const Lx=s.layers[s.layerIdx];
      if (Lx.type==='RECON'){s=resolveLayer(s,null,r);continue;}
      if (!s.hand.length){s=resolveLayer(s,null,r);continue;}
      const chosen=make('assign')(s);
      for (const c of s.hand) { if (c===chosen) continue;
        const rr=rng(seed*31+7), a=resolveLayer(s,c,rr);
        if ((a.status==='running'?playOut(a,make('assign'),rr,defaultGear):a).status==='success')
          { saved=true; break; } }
      s=resolveLayer(s,chosen,r);
    }
    if (saved) { byPlay++; continue; }

    // (b) 같은 표적, 다른 덱이면 살았나 (덱 10개 시도)
    const layers = s0.layers;
    let deckSaved=false;
    for (let k=0;k<10 && !deckSaved;k++) {
      const rr=rng(seed*17+k);
      if (playOut(newRun(randKit(600000+i*10+k), rr, {layers}), make('assign'), rr, defaultGear)
          .status==='success') deckSaved=true;
    }
    if (deckSaved) byDeck++; else neither++;
  }
  console.log(`  실패 ${tot}판 중`);
  console.log(`    다른 수로 만회 가능      ${pct(byPlay/tot)}   ← 플레이 실력`);
  console.log(`    다른 덱이면 성공         ${pct(byDeck/tot)}   ← 덱 구성 실력`);
  console.log(`    어느 쪽으로도 불가       ${pct(neither/tot)}   ← 순수 운`);
  const agency = (byPlay+byDeck)/tot;
  console.log(`  → 플레이어 책임 총합 ${pct(agency)}`);
  console.log(`  판정: ${agency > 0.70 ? 'OK — 실패의 대부분이 플레이어에게 귀속됨'
                                       : '!! 운이 지배함'}`);
}
console.log('');
