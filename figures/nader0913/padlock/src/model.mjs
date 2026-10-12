// Three-wheel combination padlock: geometry (mm) and the 24 s tour. Pure, no imports; inlined in the page.
// 3 wheels x 10 digits = 1000 combinations, 36 deg per detent. The long shackle leg carries one lug per wheel; each
// wheel's brass sleeve has one gate (a slot in its bore). Only when all three gates face the lugs can the shackle rise
// 6 mm (short leg 4 mm deep in the body) and swivel out.
export const PL = {
  AZ: 58, EL: 30,
  AX: 8, AY: 2, SX: -8,               // long-leg / wheel axis, short-leg x
  BX0: -16, BX1: 16, BY0: -7.5, BY1: 7.5, BZ1: 44, BR: 4,   // body (rounded plan)
  FLOOR: 5, SLAB: 37, BACKY: -6.4,    // bottom slab top, top slab bottom, inner face of the back wall
  LEG_R: 2.5, LEG_TOP: 53, ARC_R: 8, INSERT: 4,
  CELL0: 12, PITCH: 8, WH: 7, SZ: 3.5, // wheel cells: wheel z [zb, zb+7], sleeve from zb+3.5
  FLAT: 7.5, CHAMF: 0.9, BORE: 5, SBORE: 2.7, GATE_R: 4.2, GATE_W: 1.9,
  WASH: [7.15, 7.85], WASH_R: [3.3, 6.6],
  LUG: [0.9, 2.3], LUG_R: [2.3, 4.0], LUG_W: 1.4,
  LIFT: 6.4, TUG: 1.2,
  COLLAR: [7.8, 8.8], COLLAR_R: 3.3, PLATE: [11, 12],
  COMBO: [2, 7, 5], START: [9, 3, 3],
  STEP: 36,
};
PL.B1 = PL.AZ - 62; // gate line: the lugs and the aligned gates face this way (deg)
PL.B2 = PL.AZ + 28;  // the cutaway wedge of the wheels spans B1..B2

// wheel runs: [wheel, t0, steps, pitch, dur, kind]  kind 1 = solving run (tick per digit, click on the gate),
// 0 = a slow wrong run (ticks), -1 = a fast scramble (one whoosh, no ticks)
export const PL_RUNS = [
  [0, 2.65, 7, 0.085, 0.16, -1],
  [1, 2.72, 6, 0.09, 0.16, -1],
  [2, 2.79, 8, 0.08, 0.16, -1],
  [0, 5.2, 3, 0.66, 0.52, 1],
  [1, 7.5, 4, 0.55, 0.45, 1],
  [2, 10.75, 2, 0.7, 0.55, 1],
  [0, 14.85, 6, 0.085, 0.16, -1],
  [1, 14.92, 5, 0.09, 0.16, -1],
  [2, 14.99, 7, 0.08, 0.16, -1],
  [0, 16.45, 4, 0.28, 0.22, 1],
  [1, 17.8, 5, 0.28, 0.22, 1],
  [2, 19.45, 3, 0.28, 0.22, 1],
];
// the shackle is tugged (collars hit the solid sleeves): times of the pull
export const PL_TUGS = [3.8, 4.45, 10.0, 15.95];
export const PL_TOUR = { pop: [0.45, 12.4, 20.6], press: [[2.1, 2.42], [14.3, 14.62]], end: 24 };
PL.COMBO = [2, 7, 5]; PL.START = [2, 7, 5];

const plClamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const plIO = (x) => { x = plClamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const plSm = (x) => { x = plClamp(x); return x * x * (3 - 2 * x); };
// one detent step: eased in-out, overshoots ~6 % and settles (smooth, zero speed at both ends)
const plStep = (u, ov) => { const w = plClamp((u - 0.62) / 0.9); const b = Math.sin(Math.PI * w); return plIO(u) + ov * b * b * (1 - w); };

function plDigits(t) {
  const d = [...PL.START];
  for (const [w, t0, n, pitch, dur, kind] of PL_RUNS) {
    for (let k = 0; k < n; k++) d[w] += plStep((t - (t0 + k * pitch)) / dur, kind < 0 ? (k === n - 1 ? 0.1 : 0) : 0.07);
  }
  return d;
}
// how strongly each wheel is the one turning now (0..1, eased, for the red highlight)
export function plHeat(t) {
  const h = [0, 0, 0];
  for (const [w, t0, n, pitch, dur, kind] of PL_RUNS) {
    if (kind < 0) continue;
    const a = t0 - 0.35, b = t0 + (n - 1) * pitch + dur + 0.75;
    h[w] = Math.max(h[w], plSm((t - a) / 0.3) * (1 - plSm((t - b) / 0.45)));
  }
  return h;
}
function plPop(t, t0) {
  // the spring throws the shackle up 6.4 mm in 0.22 s, it hits its stop and rebounds a little
  const u = t - t0;
  if (u <= 0) return 0;
  if (u < 0.22) { const x = u / 0.22; return PL.LIFT * (1 - (1 - x) * (1 - x)); }
  const v = u - 0.22;
  return PL.LIFT - 0.45 * Math.sin(Math.min(1, v / 0.3) * Math.PI) * Math.exp(-v * 4);
}
// a tug: pulled up 1.2 mm in 0.09 s, the collars strike the sleeves (small rebound), held, let go
function plTug(u) {
  if (u <= 0 || u >= 0.75) return 0;
  const T = PL.TUG;
  if (u < 0.09) return T * plSm(u / 0.09) * plSm(u / 0.09);
  if (u < 0.2) return T - 0.14 * Math.sin(((u - 0.09) / 0.11) * Math.PI) * (1 - (u - 0.09) / 0.11 * 0.3);
  if (u < 0.38) return T;
  return T * (1 - plSm((u - 0.38) / 0.37));
}
export function plState(t) {
  const T = PL_TOUR;
  let lift = 0;
  for (const a of PL_TUGS) lift = Math.max(lift, plTug(t - a));
  for (let i = 0; i < T.pop.length; i++) {
    const p = T.pop[i], pr = T.press[i];
    if (t >= p && (!pr || t < pr[0])) lift = plPop(t, p);
    if (pr && t >= pr[0] && t < pr[1]) lift = PL.LIFT * (1 - plSm((t - pr[0]) / (pr[1] - pr[0])) ** 1.4);
  }
  const psi = 0;
  const d = plDigits(t);
  const aligned = d.map((v, i) => { const e = Math.abs(((v - PL.COMBO[i]) % 10 + 15) % 10 - 5); return e < 0.04 ? 1 : 0; });
  return { t, d, lift, psi, aligned, heat: plHeat(t) };
}
export function plEvents() {
  const ev = [];
  const push = (t, type, i) => ev.push({ t: Math.round(t * 1000) / 1000, type, i: Math.round(i * 100) / 100 });
  // the first jam of each locked phase is a heavy thunk, a repeat pull a lighter knock (heroes stay ~4 s apart)
  PL_TUGS.forEach((a, j) => push(a + 0.09, j === 1 ? "click" : "thunk", j === 1 ? 0.95 : 1.0));
  for (const [w, t0, n, pitch, dur, kind] of PL_RUNS) {
    if (kind < 0) { if (w === 0) push(t0, "whoosh", 0.55); continue; }
    for (let k = 0; k < n; k++) {
      const te = t0 + k * pitch + dur * 0.62;
      if (k === n - 1) push(te, "click", 0.9);
      else push(te, "tick", pitch < 0.3 ? 0.65 : 0.7);
    }
  }
  for (const p of PL_TOUR.pop) { push(p, "slide", 0.85); push(p + 0.22, "thunk", 1.0); }
  for (const [, b] of PL_TOUR.press) push(b, "click", 0.9);
  ev.sort((a, b) => a.t - b.t);
  // keep sounds at least 0.15 s apart (the louder one wins)
  const out = [];
  for (const e of ev) {
    const last = out[out.length - 1];
    if (last && e.t - last.t < 0.15) { if (e.i > last.i) out[out.length - 1] = e; continue; }
    out.push(e);
  }
  return out;
}
