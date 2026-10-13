// Inside a solenoid: the one model that drives every number, motion and plot in the figure.
// Pure functions, no imports, so the build can inline it into the page (with `export ` stripped).
//
// Exact principles used:            Faraday  V = R i + dλ/dt,   Newton  m ẍ = ΣF,   energy balance.
// Idealized analytical approximations: a lumped magnetic circuit (one working gap plus a fixed parasitic gap),
//                                      uniform gap flux over the pole area, no leakage or fringing.
// Illustrative constants:             parasitic gap, iron path, B-H curve, friction, damping, restitution.
// It is an educational model, not a validated electromagnetic FEA.

export const MU0 = 4e-7 * Math.PI;

// Illustrative constants of the drawn design (Ø34 × 40 mm can, Ø16 mm plunger). Not a datasheet.
export const CONST = {
  gStop: 0.25e-3, // nonmagnetic stop washer on the pole face: the closed gap can't go below this (m)
  gAir: 0.3e-3, // parasitic air gap of the return path: sleeve wall, radial clearance, plate joints (m)
  lIron: 0.09, // mean iron path length: pole, plunger, front plate, can, back plate (m)
  muR: 2500, // relative permeability of the soft iron below saturation
  Bs: 1.6, // saturation flux density of the soft iron (T)
  Vd: 0.8, // flyback diode forward drop (V)
  Vz: 33, // clamp (zener or TVS) voltage in series with the diode (V)
  Vbr: 60, // MOSFET drain-source avalanche voltage, reached only when the flyback path has failed (V)
  alphaCu: 0.00393, // copper resistance temperature coefficient (1/K)
  damp: 2.0, // viscous damping of the plunger: air pumping and eddy drag (N·s/m)
  fs: 0.4, // static friction in the guide sleeve (N)
  fk: 0.3, // kinetic friction in the guide sleeve (N)
  e: 0.2, // coefficient of restitution at the stops
  Rth: 8, // coil-to-ambient thermal resistance (K/W)
  Cth: 25, // coil heat capacity (J/K): copper plus bobbin; with Rth a thermal time constant of 200 s
};

// Pole face shapes. A cone of half-angle α (surface to axis) turns an axial gap g into a
// perpendicular gap g·sin α over an area A/sin α, so its reluctance acts like a flat gap of g·sin²α,
// and the axial force is sin²α times the flat-face force at that equivalent gap (Roters' approximation,
// valid while the cones still overlap). The truncated cone runs from r = 3 mm to the full 8 mm radius.
export const FACES = { flat: 90, cone60: 60, cone45: 45 };
export const coneDepth = (face) => (FACES[face] === 90 ? 0 : (8 - 3) / Math.tan((FACES[face] * Math.PI) / 180));

// Selectable effective pole areas (round pole faces). The drawing keeps the Ø16 mm geometry.
export const POLES = { 10: 10, 12: 12, 14: 14, 16: 16 };

// Clearly illustrative defaults, chosen so the ideal (unsaturated) model stays near its range of validity.
export const DEFAULTS = {
  V: 12, // supply voltage (V)
  N: 600, // coil turns
  R: 12, // coil resistance at 20 °C (Ω)
  g0: 2.5, // initial air gap, plunger face to pole face, set by the stop screw (mm)
  k: 1.0, // return spring rate (N/mm)
  Fpre: 2.0, // spring preload at rest (N)
  m: 40, // plunger mass (g)
  Fload: 1.5, // constant external load opposing pull-in (N)
  pole: 16, // pole diameter (mm)
  duty: 100, // PWM duty of the low-side MOSFET (%)
  peakHold: true, // full voltage until seated, then the duty above (peak and hold)
  sat: false, // include iron saturation (advanced)
  flyback: "diode", // "diode" | "clamp" | "none"
  T: 20, // coil temperature, or the ambient it starts from when self-heating is on (°C)
  face: "flat", // pole face shape
};

export const RANGES = {
  V: [6, 24, 0.5], N: [200, 1200, 10], R: [2, 30, 0.5], g0: [1, 10, 0.1], k: [0.2, 10, 0.1],
  Fpre: [0, 20, 0.5], m: [10, 150, 1], Fload: [0, 20, 0.5], duty: [10, 100, 1], T: [-20, 180, 1],
};

// Each fault edits the resolved parameters the same way the physical cause would.
export const FAULTS = {
  none: (p) => p,
  open: (p) => ({ ...p, open: true }),
  shorted: (p) => ({ ...p, N: p.N * 0.7, R: p.R * 0.5 }),
  lowV: (p) => ({ ...p, V: p.V * 0.55 }),
  hot: (p) => ({ ...p, T: Math.max(p.T, 150) }),
  sticky: (p) => ({ ...p, fs: 7, fk: 4 }),
  gap: (p) => ({ ...p, g0: Math.max(p.g0, 8) }),
  preload: (p) => ({ ...p, Fpre: Math.max(p.Fpre, 14) }),
  obstruct: (p) => ({ ...p, block: 0.4 }),
  flyback: (p) => ({ ...p, flyback: "none" }),
};

// Raw slider values (engineering units) -> SI parameters the simulation uses.
export function resolve(raw, fault = "none") {
  const p = FAULTS[fault] ? FAULTS[fault]({ fs: CONST.fs, fk: CONST.fk, open: false, block: null, ...raw }) : { ...raw };
  const d = (POLES[p.pole] || 16) * 1e-3;
  const g0 = p.g0 * 1e-3;
  const stroke = Math.max(0, g0 - CONST.gStop);
  return {
    V: p.V, N: p.N, R20: p.R, T: p.T, R: p.R * (1 + CONST.alphaCu * (p.T - 20)),
    g0, k: p.k * 1000, Fpre: p.Fpre, m: p.m / 1000, Fload: p.Fload, A: (Math.PI * d * d) / 4, d,
    duty: p.duty / 100, peakHold: !!p.peakHold, sat: !!p.sat, flyback: p.flyback,
    fs: p.fs ?? CONST.fs, fk: p.fk ?? CONST.fk, open: !!p.open,
    stroke, xMax: p.block ? stroke * p.block : stroke, blocked: !!p.block,
    face: FACES[p.face] ? p.face : "flat", s2: Math.sin(((FACES[p.face] || 90) * Math.PI) / 180) ** 2,
  };
}

// ---------- magnetic circuit ----------
// MMF balance around the loop: N i = B (g + gAir)/μ0 + lIron H_iron(B)  (Ampère's law, lumped).
// Linear iron: H = B/(μ0 μr), so B = μ0 N i / g_eff with g_eff = g + gAir + lIron/μr.
// Saturating iron: B = Bs tanh(μ0 μr H / Bs), so H = Bs/(μ0 μr) atanh(B/Bs), which caps B below Bs.
const BMAX = 0.9995;
export const gParasitic = () => CONST.gAir + CONST.lIron / CONST.muR;
export const gEff = (g) => g + gParasitic();
function hIron(B, sat) {
  if (!sat) return B / (MU0 * CONST.muR);
  const u = Math.min(BMAX, Math.abs(B) / CONST.Bs);
  return (Math.sign(B) * CONST.Bs * Math.atanh(u)) / (MU0 * CONST.muR);
}
function dhIron(B, sat) {
  if (!sat) return 1 / (MU0 * CONST.muR);
  const u = Math.min(BMAX, Math.abs(B) / CONST.Bs);
  return 1 / (MU0 * CONST.muR) / (1 - u * u);
}
export const mmfOf = (B, g, sat) => (B * (g + CONST.gAir)) / MU0 + CONST.lIron * hIron(B, sat);
export const clampB = (B, sat) => (sat ? Math.min(B, BMAX * CONST.Bs) : B);
// current needed to hold flux linkage λ at gap g
export function currentOf(lam, g, q) {
  const B = clampB(lam / (q.N * q.A), q.sat);
  return mmfOf(B, g, q.sat) / q.N;
}
function dCurrent(lam, g, q) {
  const B = clampB(lam / (q.N * q.A), q.sat);
  return ((g + CONST.gAir) / MU0 + CONST.lIron * dhIron(B, q.sat)) / (q.N * q.N * q.A);
}
// gap flux density for a current i at gap g
export function bOf(i, g, q) {
  if (i <= 0) return 0;
  g = g * (q.s2 ?? 1);
  const M = q.N * i;
  if (!q.sat) return (MU0 * M) / gEff(g);
  let lo = 0, hi = BMAX * CONST.Bs;
  if (mmfOf(hi, g, true) <= M) return hi;
  for (let n = 0; n < 50; n++) {
    const mid = (lo + hi) / 2;
    if (mmfOf(mid, g, true) < M) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// Maxwell stress on the working gap: F = B² A / (2 μ0). In the linear case this is exactly
// F = μ0 N² i² A / (2 g_eff²), the constant-current relation; it also follows from -∂W/∂g at constant λ.
export const forceOfB = (B, A) => (B * B * A) / (2 * MU0);
export const forceAt = (i, g, q) => forceOfB(bOf(i, g, q), q.A) * (q.s2 ?? 1);
export const inductanceAt = (g, q) => (MU0 * q.N * q.N * q.A) / gEff(g * (q.s2 ?? 1)); // small-signal, linear part only

// ---------- drive circuit ----------
// coil terminal voltage while the switch is off and current still flows through the flyback path
export function flybackVolts(q) {
  if (q.flyback === "clamp") return CONST.Vd + CONST.Vz;
  if (q.flyback === "none") return Math.max(0, CONST.Vbr - q.V); // drain avalanches at Vbr
  return CONST.Vd;
}
// average coil voltage while switched on, PWM averaged (PWM period much shorter than L/R)
export function onVolts(q, seated, i) {
  const d = q.peakHold && !seated ? 1 : q.duty;
  return d * q.V - (1 - d) * (i > 0 ? CONST.Vd : 0);
}
export const steadyCurrent = (q, seated = false) => (q.open ? 0 : Math.max(0, onVolts(q, seated, 1) / q.R));

// ---------- simulation ----------
export function newState() {
  return {
    t: 0, lam: 0, x: 0, v: 0, i: 0, B: 0, F: 0, on: false, seated: false, stuck: false, xLimit: Infinity,
    Vc: 0, Vds: 0, fric: 0, hit: 0,
    E: { supply: 0, copper: 0, flyback: 0, mag: 0, mech: 0, spring: 0, load: 0, friction: 0, impact: 0, damping: 0 },
  };
}

// one step of dt seconds. `extra` lets Fig 2 add pin friction and a moving stop.
export function step(s, q, dt, extra = null) {
  const g = Math.max(CONST.gStop, q.g0 - s.x) * (q.s2 ?? 1); // the gap the flux sees
  // electrical: implicit Euler on flux linkage (stable for every slider combination)
  if (q.open) {
    s.lam = 0; s.i = 0; s.Vc = s.on ? q.V : 0; s.Vds = s.on ? 0 : q.V;
  } else {
    let Vc;
    if (s.on) Vc = onVolts(q, s.seated, s.i);
    else Vc = s.i > 1e-9 ? -flybackVolts(q) : 0;
    let lam = s.lam;
    for (let n = 0; n < 4; n++) {
      const f = lam - s.lam - dt * (Vc - q.R * currentOf(lam, g, q));
      lam -= f / (1 + dt * q.R * dCurrent(lam, g, q));
    }
    if (lam < 0) lam = 0;
    const dLam = lam - s.lam;
    s.lam = lam;
    s.i = currentOf(lam, g, q);
    if (!s.on && s.i < 1e-6) { s.i = 0; s.lam = 0; }
    s.Vc = s.on ? Vc : s.i > 0 ? -flybackVolts(q) : 0;
    s.Vds = s.on ? 0 : s.i > 0 ? q.V + flybackVolts(q) : q.V;
    if (q.flyback === "none" && !s.on && s.i > 0) s.Vds = CONST.Vbr;
    // energy ledger
    if (s.on) s.E.supply += (q.peakHold && !s.seated ? 1 : q.duty) * q.V * s.i * dt;
    s.E.copper += s.i * s.i * q.R * dt;
    if (!s.on) s.E.flyback += flybackVolts(q) * s.i * dt;
    s.E.mag += s.i * dLam; // i dλ goes into the field; the mechanical part is taken out below
  }
  s.B = clampB(s.lam / (q.N * q.A), q.sat);
  s.F = q.open ? 0 : forceOfB(s.B, q.A) * (q.s2 ?? 1);

  // mechanical: +x is pull-in (toward the pole), so the gap is g0 - x
  const Fspring = q.Fpre + q.k * s.x;
  const drive = s.F - Fspring - q.Fload;
  const xTop = Math.min(q.xMax, extra ? extra.limit : Infinity);
  const fs = q.fs + (extra ? extra.fric : 0), fk = q.fk + (extra ? extra.fric : 0);
  s.fric = 0;
  let a = 0;
  const atRest = Math.abs(s.v) < 1e-7;
  if (atRest) {
    s.v = 0;
    if ((s.x <= 0 && drive <= 0) || (s.x >= xTop - 1e-9 && drive >= 0)) { a = 0; s.stuck = false; }
    else if (Math.abs(drive) <= fs) { a = 0; s.stuck = true; s.fric = -drive; }
    else { a = (drive - Math.sign(drive) * fk) / q.m; s.stuck = false; s.fric = -Math.sign(drive) * fk; }
  } else {
    s.fric = -Math.sign(s.v) * fk;
    a = (drive + s.fric - CONST.damp * s.v) / q.m;
    s.stuck = false;
  }
  const v0 = s.v;
  let v = v0 + a * dt;
  if (!atRest && Math.sign(v) !== Math.sign(v0) && Math.abs(drive) <= fs) v = 0; // friction stops it, it doesn't reverse it
  let x = s.x + v * dt;
  s.hit = 0;
  if (x <= 0) {
    x = 0;
    if (v < 0) { s.E.impact += 0.5 * q.m * v * v * (1 - CONST.e ** 2); s.hit = -v; v = -CONST.e * v; if (v < 0.004) v = 0; }
  }
  if (x >= xTop) {
    x = xTop;
    if (v > 0) { s.E.impact += 0.5 * q.m * v * v * (1 - CONST.e ** 2); s.hit = v; v = -CONST.e * v; if (v > -0.004) v = 0; }
  }
  const dx = x - s.x;
  s.E.mech += s.F * dx;
  s.E.mag -= s.F * dx;
  s.E.load += q.Fload * dx;
  s.E.friction += Math.abs(s.fric * dx);
  s.E.damping += CONST.damp * v * v * dt;
  s.x = x; s.v = v;
  s.E.spring = q.Fpre * s.x + 0.5 * q.k * s.x * s.x;
  s.seated = s.x >= q.xMax - 1e-7;
  s.t += dt;
  return s;
}

// coil self-heating: C·dT/dt = P − (T − T_amb)/R_th (one lumped node, illustrative constants)
export const heatStep = (T, P, Tamb, dt) => T + ((P - (T - Tamb) / CONST.Rth) / CONST.Cth) * dt;

// can the solenoid start to move the plunger from rest at all, with the full pull-in current?
export function actuation(q) {
  const i = steadyCurrent(q, false);
  const F0 = forceAt(i, q.g0, q);
  const need = q.Fpre + q.Fload + q.fs;
  return { i, F0, need, ok: !q.open && F0 > need, margin: F0 - need };
}

// static curves for the plots
export function curves(q, iNow, gNow) {
  const iPull = steadyCurrent(q, false);
  const gaps = [], fGap = [], fGapIdeal = [], fGapFlat = [], xs = [], spring = [], net = [], currents = [], fI = [];
  const gMax = q.g0;
  for (let n = 0; n <= 80; n++) {
    const g = CONST.gStop + ((gMax - CONST.gStop) * n) / 80;
    gaps.push(g * 1e3);
    fGap.push(forceAt(iPull, g, q));
    fGapIdeal.push(q.open ? 0 : forceAt(iPull, g, { ...q, sat: false }));
    fGapFlat.push(q.open ? 0 : forceAt(iPull, g, { ...q, s2: 1 }));
  }
  for (let n = 0; n <= 80; n++) {
    const x = (q.stroke * n) / 80;
    xs.push(x * 1e3);
    spring.push(q.Fpre + q.k * x);
    net.push(forceAt(iPull, q.g0 - x, q) - q.Fpre - q.k * x - q.Fload - q.fk);
  }
  const iTop = Math.max(iPull * 1.25, iNow * 1.1, 0.1);
  for (let n = 0; n <= 80; n++) {
    const i = (iTop * n) / 80;
    currents.push(i);
    fI.push(forceAt(i, gNow, q));
  }
  return { iPull, gaps, fGap, fGapIdeal, fGapFlat, xs, spring, net, currents, fI };
}

// ---------- Fig 2: a pin (or a dog clutch) that has to find its slot ----------
// A lock ring turns with the wheel-speed difference; the push-type solenoid drives a pin at its face,
// or slides a dog collar whose teeth must drop between the ring's teeth. Either enters only when a gap
// is within the chamfer's capture window. Once in, the ring's drive torque loads it in shear; the axial
// friction μ·F_shear can then trap it engaged.
export const LOCK = {
  holes: 8, rbc: 0.035, holeR: 4.4e-3, pinR: 3.0e-3, chamfer: 0.8e-3, c0: 1.2e-3, depth: 4.0e-3,
};
// geometry in one shape for both mechanisms: count of slots, radius, free clearance each side, capture window
export const GEO = {
  pin: { count: LOCK.holes, r: LOCK.rbc, clear: LOCK.holeR - LOCK.pinR, capture: LOCK.holeR - LOCK.pinR + LOCK.chamfer, c0: LOCK.c0, depth: LOCK.depth },
  dog: { count: 12, r: 0.034, clear: 1.8e-3, capture: 2.8e-3, c0: 1.2e-3, depth: 4.0e-3, tooth: 0.4 },
};
export function newLock() {
  return { theta: 0, omega: 0, torque: 0, mu: 0.12, inHole: false, locked: false, shear: 0, blocked: false, err: 0 };
}
const TAU = Math.PI * 2;
export function holeError(theta, geo = GEO.pin) {
  const pitch = TAU / geo.count;
  let d = ((theta % pitch) + pitch) % pitch;
  if (d > pitch / 2) d -= pitch;
  return -d * geo.r; // arc offset of the nearest slot from the engaging part (m)
}
export function stepLock(L, s, q, dt, geo = GEO.pin) {
  const pen = s.x - geo.c0; // how far the pin (or the collar teeth) is past the ring face (or tooth tips)
  L.err = holeError(L.theta, geo);
  L.inHole = pen > 0;
  if (!L.inHole) {
    L.locked = false; L.shear = 0;
    L.theta += L.omega * dt;
    L.err = holeError(L.theta, geo);
    L.blocked = s.x >= geo.c0 - 1e-7 && Math.abs(L.err) > geo.capture;
    return { limit: Math.abs(L.err) > geo.capture ? geo.c0 : Infinity, fric: 0 };
  }
  // engaged: the chamfer has centred it to within the clearance; the ring turns until a flank meets it
  L.blocked = false;
  if (Math.abs(L.err) > geo.clear) L.theta += (Math.sign(L.err) * (Math.abs(L.err) - geo.clear)) / geo.r;
  const next = L.theta + L.omega * dt;
  if (Math.abs(holeError(next, geo)) <= geo.clear) { L.theta = next; L.locked = false; }
  else L.locked = Math.abs(L.omega) > 0 || L.torque > 0;
  L.err = holeError(L.theta, geo);
  // a dog clutch shares the load over all its teeth, but the axial friction is the same μ·T/r
  L.shear = L.locked ? L.torque / geo.r : 0;
  return { limit: Infinity, fric: L.mu * L.shear };
}
