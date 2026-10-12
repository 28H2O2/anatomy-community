// Pure model of a single-cylinder four-stroke: true slider-crank, a flat-follower cam
// (hull of a base circle and a nose circle) whose lift is its support function, valve
// events that follow from that cam, and the time-based tour used by the short.
// Shared verbatim by build.mjs (Node) and the pages (inlined, `export` stripped).
export const M = {
  BORE: 80, STROKE: 80, ROD: 140,
  R: 40, // crank radius = stroke / 2
  ZC: 118, // crank axis height above the bench plate
  CH: 32, // piston compression height (pin to crown)
  SKIRT: 28, // pin to skirt bottom
  DECK: 118 + 213, // block deck (crown at TDC is 1 mm below it)
  // cam: base circle RB, nose circle RN at distance CD -> lift = CD + RN - RB = 8 mm
  RB: 16, RN: 6.7, CD: 17.3,
  CAMZ: 118 + 320,
  VALVES: { in: -19, ex: 19 },
  // cam lobe phase (deg, about +x) so that max lift is at crank 105 (intake) and 615 (exhaust)
  LOBE: { in: 127.5, ex: -127.5 },
  SPARK: 350, // crank degrees in the 720 cycle: 10 deg before firing TDC
};
M.LIFT = M.CD + M.RN - M.RB;

const D2R = Math.PI / 180;
export const mod = (a, n) => ((a % n) + n) % n;

// piston pin height above the crank axis, theta in degrees (0 = TDC)
export function pinZ(theta) {
  const t = theta * D2R;
  const s = M.R * Math.sin(t);
  return M.R * Math.cos(t) + Math.sqrt(M.ROD * M.ROD - s * s);
}
export const crankPin = (theta) => [M.R * Math.sin(theta * D2R), M.R * Math.cos(theta * D2R)]; // (y, z) about the axis
export const crownZ = (theta) => M.ZC + pinZ(theta) + M.CH;

// cam angle (deg) of a lobe's nose, measured in the (y, z) plane like the crank pin
export const camAngle = (theta, which) => theta / 2 + M.LOBE[which];
// flat follower straight below the cam: lift = support function of the hull in -z, minus RB
export function lift(theta, which) {
  const a = camAngle(theta, which) * D2R;
  const along = -Math.cos(a); // nose component pointing down
  return Math.max(0, M.CD * along + M.RN - M.RB);
}
// the cam polygon (y, z) at angle `deg`, centred on the cam axis
export function camPolygon(deg, steps = 48) {
  const a = deg * D2R;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push([M.RB * Math.sin(t), M.RB * Math.cos(t)]);
    pts.push([M.CD * Math.sin(a) + M.RN * Math.sin(t), M.CD * Math.cos(a) + M.RN * Math.cos(t)]);
  }
  return pts;
}

// ---- tour: crank speed in rev/s against time (s) ----
export const TOUR = { slow: 0.25, idle: 6, rampUp: [8, 12], rampDown: [17.2, 22], length: 24 };
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function revsPerSecond(t) {
  const { slow, idle, rampUp, rampDown } = TOUR;
  const up = smoothstep(rampUp[0], rampUp[1], t);
  const down = smoothstep(rampDown[0], rampDown[1], t);
  return slow + (idle - slow) * (up - down);
}
// crank angle in degrees at time t (closed form of the integral of the smoothsteps)
const smoothInt = (a, b, x) => {
  if (x <= a) return 0;
  const w = b - a;
  if (x >= b) return w / 2 + (x - b);
  const u = (x - a) / w;
  return w * (u * u * u - u * u * u * u / 2);
};
export const THETA0 = -40; // start just before intake TDC so the first thing seen is the intake valve opening
export function crankAt(t) {
  const { slow, idle, rampUp, rampDown } = TOUR;
  const revs = slow * t + (idle - slow) * (smoothInt(rampUp[0], rampUp[1], t) - smoothInt(rampDown[0], rampDown[1], t));
  return THETA0 + revs * 360;
}

// which stroke the cycle angle is in
export function strokeOf(theta) {
  const c = mod(theta, 720);
  return c < 180 ? "intake" : c < 360 ? "compression" : c < 540 ? "power" : "exhaust";
}

// every spark and valve event in [0, T] (crank angle is monotonic, so solve by bisection)
export function eventsOf(T = TOUR.length) {
  const out = [];
  const marks = [
    { at: M.SPARK, type: "spark", i: 1 },
    { at: 710, type: "intake", i: 0.55 }, // intake valve opens (10 BTDC)
    { at: 220, type: "valve", i: 0.4, what: "intake closes" },
    { at: 500, type: "exhaust", i: 0.7 }, // exhaust valve opens (40 BBDC)
    { at: 10, type: "valve", i: 0.35, what: "exhaust closes" },
  ];
  const th0 = crankAt(0), th1 = crankAt(T);
  for (const m of marks) {
    for (let k = Math.floor((th0 - m.at) / 720) - 1; m.at + 720 * k <= th1; k++) {
      const target = m.at + 720 * k;
      if (target < th0) continue;
      let lo = 0, hi = T;
      for (let n = 0; n < 50; n++) { const mid = (lo + hi) / 2; if (crankAt(mid) < target) lo = mid; else hi = mid; }
      const t = (lo + hi) / 2;
      const speed = revsPerSecond(t);
      const e = { t: Math.round(t * 1000) / 1000, type: m.type, i: Math.round(m.i * (0.75 + 0.25 * Math.min(1, speed / 2)) * 100) / 100, rps: Math.round(speed * 100) / 100 };
      if (m.what) e.what = m.what;
      out.push(e);
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
