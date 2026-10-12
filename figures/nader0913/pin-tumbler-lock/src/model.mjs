// The lock model, in millimetres: one source for the build, the live page and the sound events.
// A 5-pin cylinder with Schlage-like numbers: plug 12.7 mm (0.500"), pins 2.92 mm (0.115"), first pin 5.87 mm (0.231")
// behind the key shoulder, pins 3.97 mm (0.156") apart, cut depths in 0.381 mm (0.015") steps, 100° cuts with a
// 0.79 mm (0.031") flat, driver pins 4.19 mm (0.165"). The plug stands upright: the key comes down from above,
// pins lie along +x, the housing is cut open on the plane y = 0 and its front half (y > 0) removed.
export const LK = {
  R: 6.35, PIN_R: 1.46, RH: 9, TOWER: 21, TOWER_Y: 4, ZTOP: 28.5, LIP_R: 7.6, FACE: 29.7,
  S0: 5.87, PITCH: 3.97, STEP: 0.381, CUT_FLAT: 0.395, FLANK: 1 / Math.tan((50 * Math.PI) / 180),
  SPINE: -5.5, BLADE: 8.51, KEY_T: 1.05, KEYWAY: [-5.65, 3.5], KEYWAY_Y: 1.15,
  REST: -0.8, DRIVER: 4.19, COVER: 21, CAM_L: 10, OUT: 28.6, TIP: 27.0,
  RIGHT: [2, 5, 3, 7, 4], WRONG: [2, 5, 3, 1, 4],
};
LK.DEPTH0 = LK.SPINE + LK.BLADE;
LK.Z = [0, 1, 2, 3, 4].map((n) => LK.FACE - LK.S0 - LK.PITCH * n);
LK.KEYPIN = LK.RIGHT.map((d) => LK.R - (LK.DEPTH0 - LK.STEP * d));

// Bitting edge of a key (x across the blade) at distance s from its shoulder; -Infinity past the tip.
export function lkProfile(bitting, s) {
  const { S0, PITCH, STEP, CUT_FLAT, FLANK, DEPTH0, TIP } = LK;
  if (s < 0 || s > TIP) return -Infinity;
  let x = DEPTH0;
  bitting.forEach((d, n) => { x = Math.min(x, DEPTH0 - STEP * d + Math.max(0, Math.abs(s - (S0 + PITCH * n)) - CUT_FLAT) * FLANK); });
  const ramp = S0 + PITCH * 4 + 1.9;
  if (s > ramp) x = Math.min(x, DEPTH0 - (s - ramp) * 1.15);
  return x;
}
// The key outline in its own plane: [x across, s along] points, shoulder at s = 0, bow at s < 0.
export function lkOutline(bitting, round = true) {
  const { DEPTH0, SPINE, TIP } = LK;
  const pts = [];
  const NS = Math.round(TIP / 0.05);
  for (let i = 0; i <= NS; i++) { const s = Math.min(TIP, i * 0.05); pts.push([lkProfile(bitting, s), s]); }
  const simple = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = simple[simple.length - 1], b = pts[i], c = pts[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cross) > 1e-4) simple.push(b);
  }
  simple.push(pts[pts.length - 1]);
  const hiX = DEPTH0 + 1.4, loX = SPINE - 0.9;
  const bow = [];
  let hole;
  if (round) {
    const cx = -1, cs = -14.5, r = 10;
    const a0 = Math.atan2(Math.sqrt(r * r - (hiX - cx) ** 2), hiX - cx), a1 = Math.atan2(Math.sqrt(r * r - (loX - cx) ** 2), loX - cx) - 2 * Math.PI;
    for (let i = 0; i <= 40; i++) { const a = a0 + ((a1 - a0) * i) / 40; bow.push([cx + r * Math.cos(a), cs + r * Math.sin(a)]); }
    hole = Array.from({ length: 24 }, (_, i) => [cx + 2.3 * Math.cos((i / 24) * 2 * Math.PI), cs - 5 + 2.3 * Math.sin((i / 24) * 2 * Math.PI)]);
  } else {
    const x0 = -12.4, x1 = 10.6, s0 = -22.5, s1 = -5.2, r = 3.2;
    const corner = (cx, cs, from) => Array.from({ length: 7 }, (_, i) => { const a = from - (Math.PI / 2) * (i / 6); return [cx + r * Math.cos(a), cs + r * Math.sin(a)]; });
    bow.push([hiX, s1], ...corner(x1 - r, s1 - r, Math.PI / 2), ...corner(x1 - r, s0 + r, 0), ...corner(x0 + r, s0 + r, -Math.PI / 2), ...corner(x0 + r, s1 - r, -Math.PI), [loX, s1]);
    hole = Array.from({ length: 24 }, (_, i) => [x0 + 4.4 + 2.0 * Math.cos((i / 24) * 2 * Math.PI), s0 + 4.4 + 2.0 * Math.sin((i / 24) * 2 * Math.PI)]);
  }
  const ring = [[hiX, 0], ...bow, [loX, 0], [SPINE, 0], [SPINE, TIP - 1.2], [SPINE + 1.6, TIP], ...simple.reverse()];
  return { ring, hole, hiX, loX, neck: bow[0][1] };
}
export const lkEase = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sine = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
const span = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const bump = (t, a, len) => { const u = (t - a) / len; return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2; };

// The 24 s tour. Each row: [start, end, label].
export const TOUR = {
  length: 24,
  wrongIn: [0.5, 3.5], bind: [[4.0, 0.62], [4.85, 0.62]], wrongOut: [6.1, 8.4],
  swapA: [8.4, 9.2], rightIn: [9.2, 12.2], turn: [13.0, 14.8], back: [16.6, 18.4], rightOut: [19.0, 21.4], swapB: [22.6, 23.4],
};
export function lkState(time) {
  const T = TOUR, t = ((time % T.length) + T.length) % T.length, { OUT } = LK;
  let key = 0, ins = OUT, alpha = 1, lift = 0, phi = 0, fail = 0;
  const inAt = (w) => OUT * (1 - lkEase(span(t, w[0], w[1])));
  const outAt = (w) => OUT * lkEase(span(t, w[0], w[1]));
  if (t < T.wrongIn[1]) ins = inAt(T.wrongIn);
  else if (t < T.wrongOut[0]) ins = 0;
  else if (t < T.swapA[0]) ins = outAt(T.wrongOut);
  else if (t < T.swapA[1]) {
    const m = (T.swapA[0] + T.swapA[1]) / 2;
    if (t < m) { const u = sine(span(t, T.swapA[0], m)); alpha = 1 - u; lift = 5 * u; }
    else { const u = sine(span(t, m, T.swapA[1])); key = 1; alpha = u; lift = 5 * (1 - u); }
  } else if (t < T.rightOut[0]) { key = 1; ins = t < T.rightIn[1] ? inAt(T.rightIn) : 0; }
  else if (t < T.swapB[0]) { key = 1; ins = outAt(T.rightOut); }
  else if (t < T.swapB[1]) {
    const m = (T.swapB[0] + T.swapB[1]) / 2;
    if (t < m) { const u = sine(span(t, T.swapB[0], m)); key = 1; alpha = 1 - u; lift = 5 * u; }
    else { const u = sine(span(t, m, T.swapB[1])); alpha = u; lift = 5 * (1 - u); }
  }
  // turning
  if (key === 0) {
    phi = T.bind.reduce((sum, [a, len]) => sum + bump(t, a, len), 0) * ((3.2 * Math.PI) / 180);
    fail = Math.min(sine(span(t, 3.9, 4.25)), 1 - sine(span(t, 6.0, 6.5)));
  } else {
    phi = (Math.PI / 2) * (lkEase(span(t, T.turn[0], T.turn[1])) - lkEase(span(t, T.back[0], T.back[1])));
  }
  const bitting = key === 0 ? LK.WRONG : LK.RIGHT;
  // pin stacks: key pin tip rides the bitting (or rests), drivers sit on the key pin or on the turned plug
  const tips = [], tops = [], drivers = [];
  LK.Z.forEach((z, n) => {
    const s = LK.FACE + ins - z;
    const tip = Math.max(LK.REST, alpha > 0 ? lkProfile(bitting, s) : -Infinity);
    tips.push(tip);
    tops.push(tip + LK.KEYPIN[n]);
    drivers.push(phi > 0.004 ? Math.max(LK.R, tip + LK.KEYPIN[n]) : tip + LK.KEYPIN[n]);
  });
  return { t, key, ins, alpha, lift, phi, fail, tips, tops, drivers, bolt: LK.CAM_L * Math.sin(phi) };
}
// Sound events over one loop, sampled from the same state: pin landings, key slides, the seat, binds, turns, the bolt.
export function lkEvents() {
  const T = TOUR, ev = [];
  const push = (t, type, i, extra = {}) => ev.push({ t: Math.round(t * 1000) / 1000, type, i: Math.round(Math.max(0, Math.min(1, i)) * 100) / 100, ...extra });
  push(T.wrongIn[0], "slide", 0.55, { dur: T.wrongIn[1] - T.wrongIn[0], dir: "in" });
  push(T.wrongIn[1], "seat", 0.6);
  T.bind.forEach(([a, len]) => { push(a + 0.08, "turn", 0.25, { dur: len * 0.42 }); push(a + len * 0.5, "bind", 0.85); });
  push(T.wrongOut[0], "slide", 0.5, { dur: T.wrongOut[1] - T.wrongOut[0], dir: "out" });
  push(T.swapA[0], "swap", 0.3, { dur: T.swapA[1] - T.swapA[0] });
  push(T.rightIn[0], "slide", 0.55, { dur: T.rightIn[1] - T.rightIn[0], dir: "in" });
  push(T.rightIn[1], "seat", 0.65);
  push(T.rightIn[1] + 0.45, "align", 0.5);
  push(T.turn[0], "turn", 0.8, { dur: T.turn[1] - T.turn[0] });
  push(T.turn[1] - 0.02, "thunk", 1.0);
  push(T.back[0], "turn", 0.7, { dur: T.back[1] - T.back[0] });
  push(T.back[1] - 0.02, "thunk", 0.8);
  push(T.rightOut[0], "slide", 0.5, { dur: T.rightOut[1] - T.rightOut[0], dir: "out" });
  push(T.swapB[0], "swap", 0.3, { dur: T.swapB[1] - T.swapB[0] });
  // pin landings: a pin that has fallen at least 0.25 mm and stops (local minimum of its tip)
  const dt = 0.002, n = Math.round(T.length / dt);
  let prev = lkState(0).tips, fall = [0, 0, 0, 0, 0], dirs = [0, 0, 0, 0, 0];
  for (let k = 1; k <= n; k++) {
    const t = k * dt, s = lkState(t);
    s.tips.forEach((x, p) => {
      const dx = x - prev[p];
      if (dx < -1e-6) { fall[p] += -dx; dirs[p] = -1; }
      else if (dirs[p] === -1 && dx >= -1e-6) {
        if (fall[p] > 0.25) push(t, "click", 0.25 + fall[p] / 3, { pin: p + 1, drop: Math.round(fall[p] * 100) / 100 });
        fall[p] = 0; dirs[p] = dx > 1e-6 ? 1 : 0;
      }
    });
    prev = s.tips;
  }
  ev.sort((a, b) => a.t - b.t);
  // pins that land together (the key's cuts share the pin pitch) make one click
  const merged = [];
  for (const e of ev) {
    const last = merged[merged.length - 1];
    if (e.type === "click" && last && last.type === "click" && e.t - last.t < 0.02) {
      last.pins.push(e.pin);
      last.i = Math.round(Math.min(1, Math.max(last.i, e.i) + 0.06) * 100) / 100;
    } else merged.push(e.type === "click" ? { t: e.t, type: e.type, i: e.i, pins: [e.pin] } : e);
  }
  return merged;
}
