// Chapter tour of the watch: tour time t (s) -> watch time, winding, camera, loupe, highlight looks, events.
// Plain script: makeTour(M, CAM) where CAM = { name: [cx, cy, s] } camera framings from build.mjs, and loupe focus points.
function makeTour(M, CAM) {
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const sm5 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
  const LEN0 = 60;                                       // authored tour length (old seconds)
  const SLOW = 1 / 14, NEAR = 1 / 9;

  // ---------- chapter marks (tour s) ----------
  const CH = [
    { name: "hook", t: 0 }, { name: "wind", t: 3.0 }, { name: "barrel", t: 11.8 }, { name: "train", t: 19.2 },
    { name: "escapement", t: 29.4 }, { name: "balance", t: 41.4 }, { name: "whole", t: 52.2 },
  ];

  // ---------- time scale (watch s per tour s), log-eased between keys ----------
  const TS = [[0, 1], [12.8, 1], [14.6, 1800], [19.2, 1800], [20.4, 540], [22.2, 540], [23.2, 67.5], [25.0, 67.5], [26.0, 9], [27.6, 9], [28.6, 1],
    [29.8, 1], [31.2, SLOW], [41.2, SLOW], [42.2, 1 / 10], [47.4, 1 / 10], [49.6, 1], [LEN0 + 2, 1]];
  const NEARW = [[0, 0], [30.4, 0], [31.4, 1], [40.8, 1], [41.8, 0], [LEN0 + 2, 0]];
  const keyLog = (K, t) => {
    if (t <= K[0][0]) return K[0][1];
    for (let i = 0; i < K.length - 1; i++) if (t < K[i + 1][0]) { const [t0, a] = K[i], [t1, b] = K[i + 1]; return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * sm((t - t0) / (t1 - t0))); }
    return K[K.length - 1][1];
  };
  const keyLin = (K, t) => {
    if (t <= K[0][0]) return K[0][1];
    for (let i = 0; i < K.length - 1; i++) if (t < K[i + 1][0]) { const [t0, a] = K[i], [t1, b] = K[i + 1]; return a + (b - a) * sm((t - t0) / (t1 - t0)); }
    return K[K.length - 1][1];
  };
  const tsOld = (t) => keyLog(TS, t);
  // ---------- slow-down: new tour time t -> authored time W(t). Each chapter plays k times longer, but the watch keeps
  // its own speed per new second (the time scale is read at W(t) and integrated over new t), so slow chapters just last
  // longer and show more, and full-speed moments stay true. k eases between chapters.
  const STR = [[0, 1.6], [2.7, 1.6], [3.3, 1.9], [11.5, 1.9], [12.1, 1.5], [18.9, 1.5], [19.5, 2.0], [29.1, 2.0], [29.7, 1.7],
    [41.1, 1.7], [41.7, 1.9], [51.9, 1.9], [52.5, 2.3], [LEN0 + 2, 2.3]];
  const WDT = 1 / 600, WT = [0];
  { let o = 0; while (o < LEN0) { o += WDT / keyLog(STR, o); WT.push(o); } }
  const LEN = +((WT.length - 1) * WDT).toFixed(2);
  const W = (t) => { if (t <= 0) return t; const x = t / WDT; if (x >= WT.length - 1) return LEN0 + (t - LEN) / 2.3; const i = Math.floor(x), f = x - i; return WT[i] + (WT[i + 1] - WT[i]) * f; };
  const Winv = (o) => { let lo = 0, hi = WT.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (WT[m] < o) lo = m; else hi = m; } return lo * WDT; };
  const tsOf = (t) => tsOld(W(t));
  const nearOf = (phi, w) => { const x = sm((Math.abs(phi) - 30 * D2R) / (75 * D2R)); return 1 + (NEAR - 1) * (1 - x) * w; };
  // integrate dr/dt = ts(t) * near(phi(r))
  const DT = 1 / 1200, NS = Math.round((LEN + 3) / DT) + 1;
  const RT = new Float64Array(NS);
  { let r = 0; for (let i = 0; i < NS; i++) { const t = i * DT; RT[i] = r; r += tsOf(t) * nearOf(M.phiOf(r), keyLin(NEARW, W(t))) * DT; } }
  function realOf(t) {
    if (t <= 0) return t;
    const x = Math.min(t, (NS - 2) * DT) / DT, i = Math.floor(x), f = x - i;
    return RT[i] + (RT[i + 1] - RT[i]) * f;
  }

  // ---------- winding: the arbor (ratchet) turns 2.2 turns = 66 ratchet teeth; the crown turns twice as fast ----------
  const RAT_P = TAU / 30;
  const WIND = { t0: 4.8, t1: 11.2, turns: 2.2 };
  const ARB0 = 0.05 * RAT_P;
  const arborOf = (t) => ARB0 + WIND.turns * TAU * sm5((t - WIND.t0) / (WIND.t1 - WIND.t0));
  const N0 = 9.8;
  const S0 = M.state(0);
  const BAR0 = S0.esc * M.ratio.barrel;
  function stateAt(t) {
    const r = realOf(t);
    const S = M.state(r);
    S.barrel = S.esc * M.ratio.barrel;
    S.arbor = arborOf(W(t));
    S.crown = -2 * S.arbor;
    const fr = ((S.arbor / RAT_P) % 1 + 1) % 1;
    S.click = 6 * D2R * fr;                              // the click rides up each ratchet tooth and drops off it
    S.N = N0 + (S.arbor - ARB0) / TAU - (S.barrel - BAR0) / TAU;
    S.t = t; S.ts = tsOf(t);
    return S;
  }

  // ---------- camera: sequential eased moves of (cx, cy, log s, screen Y) ----------
  const YL = 318, YF = 430;                              // screen anchor with / without the loupe
  const CAMK = [
    { t: 3.0, d: 1.6, k: "C1", Y: YL }, { t: 11.8, d: 1.4, k: "C2", Y: YL }, { t: 19.2, d: 1.2, k: "C3a", Y: YF }, { t: 22.2, d: 1.0, k: "C3b", Y: YF },
    { t: 25.0, d: 1.0, k: "C3c", Y: YF }, { t: 29.4, d: 1.4, k: "C4", Y: YL }, { t: 41.4, d: 1.4, k: "C5", Y: YL }, { t: 52.4, d: 2.2, k: "FULL", Y: YL },
  ];
  function camAt(t) {
    t = W(t);
    let c = { cx: CAM.FULL[0], cy: CAM.FULL[1], ls: Math.log(CAM.FULL[2]), Y: YL };
    for (const e of CAMK) {
      if (t <= e.t) break;
      const g = sm5((t - e.t) / e.d), K = CAM[e.k];
      c = { cx: c.cx + (K[0] - c.cx) * g, cy: c.cy + (K[1] - c.cy) * g, ls: c.ls + (Math.log(K[2]) - c.ls) * g, Y: c.Y + (e.Y - c.Y) * g };
    }
    return { cx: c.cx, cy: c.cy, s: Math.exp(c.ls), Y: c.Y };
  }

  // ---------- loupe: opacity + what it shows (x-ray barrel or the live scene) + focus ----------
  const LOUK = [
    { t: 3.3, d: 1.2, src: "x", f: "LX" }, { t: 19.0, d: 0.6, o: 0 }, { t: 29.8, d: 0.8, o: 1, src: "s", f: "L4" }, { t: 41.4, d: 1.4, src: "u", f: "L5" },
    { t: 52.3, d: 1.6, src: "s", f: "L0" },
  ];
  // w = weights of the loupe's sources: x = x-ray barrel, s = live scene, u = under the balance (fork + roller)
  function loupeAt(t) {
    t = W(t);
    const F0 = CAM.L0;
    let L = { o: 1, w: { x: 0, s: 1, u: 0 }, fx: F0[0], fy: F0[1], lz: Math.log(F0[2]) };
    for (const e of LOUK) {
      if (t <= e.t) break;
      const g = sm((t - e.t) / e.d);
      const closed = L.o < 0.01;
      if (e.src) {
        const F = CAM[e.f];
        const gw = closed ? 1 : g, gf = closed ? 1 : sm5((t - e.t) / e.d);
        for (const kk of ["x", "s", "u"]) L.w[kk] += ((kk === e.src ? 1 : 0) - L.w[kk]) * gw;
        L.fx += (F[0] - L.fx) * gf; L.fy += (F[1] - L.fy) * gf; L.lz += (Math.log(F[2]) - L.lz) * gf;
      }
      if (e.o !== undefined) L.o = L.o + (e.o - L.o) * g;
    }
    return { o: L.o, w: L.w, fx: L.fx, fy: L.fy, z: Math.exp(L.lz) };
  }

  // ---------- looks: which part is red (hi), which stay in full colour (ctx), which bridges are ghosted ----------
  const PARTS = ["holder", "plate", "crown", "wpinion", "crownwheel", "ratchet", "click", "bbridge", "barrel", "spring", "centre", "third", "fourth", "seconds",
    "escape", "banking", "fork", "roller", "balance", "hairspring", "balbridge", "tbridge"];
  const BR = ["bbridge", "crownwheel", "ratchet", "click", "tbridge", "balbridge"];
  const WINDCTX = ["crown", "wpinion", "crownwheel", "ratchet", "click", "bbridge", "barrel", "spring"];
  const LOOKS = [
    { t: 3.3, d: 0.8, hi: ["crown"], ctx: WINDCTX },
    { t: 5.6, d: 0.6, hi: ["wpinion", "crownwheel"], ctx: WINDCTX },
    { t: 7.2, d: 0.6, hi: ["ratchet"], ctx: WINDCTX },
    { t: 8.8, d: 0.6, hi: ["spring"], ctx: WINDCTX },
    { t: 12.0, d: 0.9, hi: ["barrel", "spring"], ctx: ["centre"], ghost: BR },
    { t: 19.6, d: 0.6, hi: ["centre"], ctx: ["barrel", "third"], ghost: BR },
    { t: 22.4, d: 0.6, hi: ["third"], ctx: ["centre", "fourth", "seconds"], ghost: BR },
    { t: 25.2, d: 0.6, hi: ["fourth", "seconds"], ctx: ["third", "escape"], ghost: BR },
    { t: 27.8, d: 0.6, hi: ["escape"], ctx: ["fourth", "seconds", "fork", "banking"], ghost: BR },
    { t: 31.0, d: 0.7, hi: ["fork"], ctx: ["escape", "banking", "roller"], ghost: BR },
    { t: 41.8, d: 0.7, hi: ["balance", "hairspring", "roller"], ctx: ["fork", "banking", "escape"], ghost: BR },
    { t: 52.6, d: 1.2, hi: [], rec: 0, ghost: BR },
    { t: 54.6, d: 0.45, hi: ["barrel", "spring"], rec: 0, ghost: BR },
    { t: 55.2, d: 0.45, hi: ["centre"], rec: 0, ghost: BR },
    { t: 55.8, d: 0.45, hi: ["third"], rec: 0, ghost: BR },
    { t: 56.4, d: 0.45, hi: ["fourth", "seconds"], rec: 0, ghost: BR },
    { t: 57.0, d: 0.45, hi: ["escape"], rec: 0, ghost: BR },
    { t: 57.6, d: 0.45, hi: ["fork"], rec: 0, ghost: BR },
    { t: 58.2, d: 0.45, hi: ["balance", "hairspring", "roller"], rec: 0, ghost: BR },
    { t: 58.8, d: 0.8, hi: [], rec: 0 },
  ];
  const REC = 0.5, GH = 0.13;
  function lookAt(t) {
    t = W(t);
    const st = {};
    for (const p of PARTS) st[p] = [0, 0, 1];
    for (const e of LOOKS) {
      if (t <= e.t) break;
      const g = sm((t - e.t) / e.d), rec = e.rec === undefined ? REC : e.rec;
      for (const p of PARTS) {
        const hi = e.hi.includes(p), keep = hi || (e.ctx && e.ctx.includes(p));
        const tg = [hi ? 1 : 0, keep ? 0 : rec, e.ghost && e.ghost.includes(p) ? GH : 1];
        const s = st[p];
        for (let j = 0; j < 3; j++) s[j] += (tg[j] - s[j]) * g;
      }
    }
    return st;
  }

  // ---------- events (tour seconds) ----------
  function eventsOf() {
    const ev = [];
    const step = 1 / 600;
    let prev = stateAt(0), lastTick = -9, lastClick = -9;
    const ch = (t) => { t = W(t); let c = CH[0].name; for (const x of CH) if (t >= x.t) c = x.name; return c; };
    for (let t = step; t <= LEN + 1e-9; t += step) {
      const s = stateAt(t);
      const ts = s.ts;
      if (s.n === prev.n && s.phase !== prev.phase) {
        if (s.phase === 3 && prev.phase !== 3) {
          if (ts <= 0.2) ev.push({ t, type: ch(t) === "escapement" ? "thunk" : "tick", i: ch(t) === "escapement" ? 1 : 0.8 });
          else if (ts <= 1.6 && t - lastTick >= 0.25 && ch(t) !== "wind") { ev.push({ t, type: "tick", i: 0.5 }); lastTick = t; }
        } else if (s.phase === 1 && prev.phase === 0 && ts <= 0.2 && ch(t) === "escapement") ev.push({ t, type: "click", i: 0.45 });
      }
      const teeth = Math.floor((s.arbor - ARB0) / RAT_P + 1e-6), pt = Math.floor((prev.arbor - ARB0) / RAT_P + 1e-6);
      if (teeth > pt && t - lastClick >= 0.25) { ev.push({ t, type: "click", i: 0.4 }); lastClick = t; }
      prev = s;
    }
    for (const e of CAMK) ev.push({ t: Winv(e.t + 0.15), type: "slide", i: 0.3 });
    ev.push({ t: Winv(WIND.t0 + 0.05), type: "turn", i: 0.5 });
    for (const t of [19.6, 22.4, 25.2, 27.8]) ev.push({ t: Winv(t), type: "turn", i: 0.5 });
    ev.sort((a, b) => a.t - b.t);
    const pri = { thunk: 5, tick: 3, click: 3, turn: 2, slide: 1 };
    const kept = [];
    for (const e of ev) {
      e.t = +e.t.toFixed(3);
      const last = kept[kept.length - 1];
      if (last && e.t - last.t < 0.15) { if ((pri[e.type] || 0) > (pri[last.type] || 0)) kept[kept.length - 1] = e; continue; }
      kept.push(e);
    }
    return kept;
  }

  return { LEN, LEN0, W, Winv, CH, tsOf, realOf, stateAt, camAt, loupeAt, lookAt, eventsOf, PARTS, WIND, SLOW, NEAR, sm };
}
