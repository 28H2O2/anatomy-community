// Pure model of a 28,800 bph lever-escapement watch movement (mm, degrees in the API, radians inside).
// Plain script (no imports): build.mjs evaluates it with new Function, the page inlines it as source.
function makeWatch() {
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const pol = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const len = (p) => Math.hypot(p[0], p[1]);
  const ang = (p) => Math.atan2(p[1], p[0]);
  const rot = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * co - y * s, c[1] + x * s + y * co]; };

  // ---------------- truth ----------------
  const BPH = 28800, F = BPH / 3600 / 2;      // 8 beats/s -> balance 4 Hz
  const T = {
    barrel: { N: 72, m: 0.14 }, centre: { N: 80, n: 12, m: 0.125 }, third: { N: 75, n: 10, m: 0.11 },
    fourth: { N: 112, n: 10, m: 0.064 }, escape: { N: 15, n: 7 },
  };
  const rB = T.barrel.N * T.barrel.m / 2;          // 5.04
  const rCp = T.centre.n * T.barrel.m / 2;          // centre pinion 0.84
  const rC = T.centre.N * T.centre.m / 2;           // 5.0
  const rTp = T.third.n * T.centre.m / 2;           // 0.625
  const rT = T.third.N * T.third.m / 2;             // 4.125
  const rFp = T.fourth.n * T.third.m / 2;           // 0.55
  const rF = T.fourth.N * T.fourth.m / 2;           // 3.584
  const rEp = T.escape.n * T.fourth.m / 2;          // 0.224
  const RE = 2.3;                                    // escape tooth tips
  // ratios: centre 1 rev/h, third 8/h, fourth 60/h = 1 rpm, escape 16 rpm (15 teeth x 2 beats x 16 = 480 beats/min)
  const ratio = { escape: 1, fourth: -T.escape.n / T.fourth.N, third: (T.escape.n / T.fourth.N) * (T.fourth.n / T.third.N),
    centre: -(T.escape.n / T.fourth.N) * (T.fourth.n / T.third.N) * (T.third.n / T.centre.N) };
  ratio.barrel = -ratio.centre * T.centre.n / T.barrel.N;

  // ---------------- layout (plan) ----------------
  const PLATE_R = 12.7;
  const C = [0, 0];
  const B = pol(rB + rCp, 200 * D2R);
  const TH = pol(rC + rTp, -38 * D2R);
  const FO = add(TH, pol(rT + rFp, 46 * D2R));
  const E = add(FO, pol(rF + rEp, 128 * D2R));
  const LINE = 133 * D2R;                       // escape -> pallet arbor -> balance staff (straight line)
  const DA = RE / Math.cos(30 * D2R);           // pallet arbor at the crossing of the tangents at +-30 deg
  const A = add(E, pol(DA, LINE));
  const LEVER = 4.6;                            // pallet arbor -> balance staff
  const BAL = add(A, pol(LEVER, LINE));
  const BAL_R = 4.3;                            // balance rim (outer)
  const RP = 0.9;                               // impulse pin radius on the roller
  const PSI0 = 7 * D2R;                         // banking: lever swings +-7 deg
  const AMP = 280 * D2R;                        // balance amplitude
  const PH = 0.125;                             // half period (one beat), s
  const W = TAU * F / 2 * 2;                    // rad/s of the sine (period 0.25 s)
  const OMEGA = TAU * 4;

  // ---------------- lever / fork ----------------
  // fork angle while the impulse pin is in the notch (pin on its circle round the balance staff)
  const psiRaw = (phi) => -Math.atan2(RP * Math.sin(phi), LEVER - RP * Math.cos(phi));
  let PHI_L = 0; { let lo = 0, hi = 1.2; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (-psiRaw(m) < PSI0) lo = m; else hi = m; } PHI_L = (lo + hi) / 2; }
  const psiOf = (phi) => (Math.abs(phi) >= PHI_L ? -Math.sign(phi) * PSI0 : psiRaw(phi));

  // ---------------- pallet stones ----------------
  // stone frame: Q on the tip circle at escape angle a, n inward, t along the tooth motion (wheel turns +, CCW)
  const SW = 0.40, SL = 1.05;                   // stone width (tangential), length
  const RHO = RE * Math.tan(30 * D2R);          // radial travel of a stone per radian of fork
  const LOCK = RHO * 2.4 * D2R, IMP = RHO * 10.4 * D2R;
  function stoneAt(a, inner0, psi) {
    // corners at psi = 0, then turned with the fork about A. inner0 = depth of the locking corner at psi=0
    const q = add(E, pol(RE, a)), n = pol(1, a + Math.PI), t = pol(1, a + Math.PI / 2);
    const P = (tt, d) => add(q, [t[0] * tt + n[0] * d, t[1] * tt + n[1] * d]);
    const lc = P(-SW / 2, inner0), lo = P(SW / 2, inner0 + IMP), ob = P(SW / 2, inner0 - SL), oa = P(-SW / 2, inner0 - SL);
    return [lc, lo, ob, oa].map((p) => rot(p, A, psi));
  }
  const depth = (p) => RE - len(sub(p, E));
  // choose each stone's depth so it locks LOCK deep at its own banking; signs from the geometry
  function makeStone(a) {
    const s = Math.sign(depth(stoneAt(a, 0, 0.01)[0]) - depth(stoneAt(a, 0, -0.01)[0])); // +1: fork + drives it deeper
    const bank = s * PSI0;                       // banking angle at which this stone locks
    let lo = -1, hi = 1;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (depth(stoneAt(a, m, bank)[0]) < LOCK) lo = m; else hi = m; }
    return { a, inner0: (lo + hi) / 2, bank };
  }
  // circle(E, RE) x line(p0,p1): the intersection nearest p0 side -> tip angle (rad, absolute)
  function tipOnLine(p0, p1, near) {
    const d = sub(p1, p0), f = sub(p0, E);
    const a = d[0] * d[0] + d[1] * d[1], b = 2 * (f[0] * d[0] + f[1] * d[1]), c = f[0] * f[0] + f[1] * f[1] - RE * RE;
    const disc = Math.max(0, b * b - 4 * a * c), sq = Math.sqrt(disc);
    const cands = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].map((u) => add(p0, [d[0] * u, d[1] * u]));
    cands.sort((x, y) => len(sub(x, near)) - len(sub(y, near)));
    return ang(sub(cands[0], E));
  }
  const lockTip = (st, psi) => { const [lc, , , oa] = stoneAt(st.a, st.inner0, psi); return tipOnLine(lc, oa, lc); };
  const impTip = (st, psi) => { const [lc, lo] = stoneAt(st.a, st.inner0, psi); return tipOnLine(lc, lo, lc); };
  const lcDepth = (st, psi) => depth(stoneAt(st.a, st.inner0, psi)[0]);
  const loDepth = (st, psi) => depth(stoneAt(st.a, st.inner0, psi)[1]);
  const PITCH = TAU / 15, HALF = PITCH / 2;
  const IN_A = LINE - 30 * D2R;        // escape-angle of the entry stone (teeth arrive from below)
  const entry = makeStone(IN_A);
  // exit angle tuned so the exit lock lands exactly half a tooth after the entry lock (one beat = 12 deg)
  let exit;
  {
    const wrap = (x) => { x = ((x % PITCH) + PITCH) % PITCH; return x; };
    const f = (da) => { const st = makeStone(LINE + 30 * D2R + da); return wrap(lockTip(st, st.bank) - lockTip(entry, entry.bank) - HALF + PITCH / 2) - PITCH / 2; };
    let lo = -0.12, hi = 0.12, flo = f(lo);
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m; }
    exit = makeStone(LINE + 30 * D2R + (lo + hi) / 2);
  }
  // fork angles where each stone unlocks (locking corner leaves the tip circle) and lets off (impulse ends)
  const solvePsi = (fn, st) => { let lo = st.bank, hi = -st.bank; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (fn(st, m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; };
  for (const st of [entry, exit]) { st.unlock = solvePsi(lcDepth, st); st.letoff = solvePsi(loDepth, st); }

  // ---------------- motion in real (watch) time r ----------------
  const phiOf = (r) => AMP * Math.sin(OMEGA * r);
  // beat n: phi crosses zero at r = n*PH. Direction alternates; which stone is active follows the banking sign.
  const DROP = 0.0011;                         // s, free run of the wheel from let-off to lock
  const BASE = lockTip(entry, entry.bank);     // escape angle of tooth 0 tip at the first entry lock
  function stoneOfBeat(n) {
    const dir = n % 2 === 0 ? 1 : -1;          // phi increasing for even n
    return Math.sign(dir * PSI0) === Math.sign(entry.bank) ? entry : exit;
  }
  // time (relative to the zero crossing) at which the fork reaches psi during beat n
  function timeAtPsi(n, psiT) {
    const dir = n % 2 === 0 ? 1 : -1;
    // phi = dir*AMP*sin(OMEGA*tau) near the crossing; psi monotone in phi there
    let lo = -PHI_L / AMP, hi = PHI_L / AMP;   // in sin units
    const f = (s) => psiOf(dir * AMP * s) - psiT;
    const flo = f(lo);
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (Math.sign(f(m)) === Math.sign(flo)) lo = m; else hi = m; }
    return Math.asin(Math.max(-1, Math.min(1, (lo + hi) / 2))) / OMEGA;
  }
  const TIP0 = lockTip(stoneOfBeat(0), stoneOfBeat(0).bank);
  const letoffTau = [0, 1].map((p) => { const st = stoneOfBeat(p); return timeAtPsi(p, st.letoff); });
  const unlockTau = [0, 1].map((p) => { const st = stoneOfBeat(p); return timeAtPsi(p, st.unlock); });
  // escape wheel angle (absolute, rad) of tooth-0 frame: nearest to the beat's nominal value
  const nearest = (x, ref) => x + PITCH * Math.round((ref - x) / PITCH);
  function state(r) {
    const phi = phiOf(r), psi = psiOf(phi);
    // nearest zero crossing -> current beat
    const n = Math.round(r / PH), tau = r - n * PH;
    const st = stoneOfBeat(n), other = st === entry ? exit : entry;
    const lockRef = BASE + n * HALF;                      // wheel angle of the lock that starts beat n
    const tipRef = (s) => s.a;                            // tip angles sit near the stone
    let theta, phase;
    const lt = letoffTau[((n % 2) + 2) % 2];
    const dirSign = Math.sign(st.letoff - st.bank);       // psi moves from bank toward -bank
    const passed = (psiT) => (psi - psiT) * dirSign >= 0;
    if (!passed(st.unlock) && tau < lt) { theta = nearest(lockTip(st, psi), st.a) - nearest(lockTip(st, st.bank), st.a); phase = 0; }
    else if (tau < lt) { theta = nearest(impTip(st, psi), st.a) - nearest(lockTip(st, st.bank), st.a); phase = 1; }
    else {
      const leave = nearest(impTip(st, st.letoff), st.a) - nearest(lockTip(st, st.bank), st.a);
      const land = HALF + (nearest(lockTip(other, psi), other.a) - nearest(lockTip(other, other.bank), other.a));
      const u = Math.min(1, Math.max(0, (tau - lt) / DROP));
      theta = leave + (land - leave) * u * u; phase = u < 1 ? 2 : 3;
    }
    // theta is relative to the beat's starting lock; tau < -half beat can't happen (n = round)
    const esc = lockRef + theta - BASE;                   // total escape rotation since start (rad)
    return { r, phi, psi, n, tau, phase, esc, active: st === entry ? 0 : 1 };
  }

  // ---------------- tour: tour time t -> real time r ----------------
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const SLOW = 1 / 20, NEAR = 1 / 9;          // slow motion 1/20, and 9x slower again while the pin is in the fork
  const lerpLog = (a, b, u) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * smooth(u));
  const TOUR = { len: 24, slowIn: [2.6, 4.0], slowOut: [16.6, 17.8], stopAt: 22.0 };
  function baseSpeed(t) {
    if (t < TOUR.slowIn[0]) return 1;
    if (t < TOUR.slowIn[1]) return lerpLog(1, SLOW, (t - TOUR.slowIn[0]) / (TOUR.slowIn[1] - TOUR.slowIn[0]));
    if (t < TOUR.slowOut[0]) return SLOW;
    if (t < TOUR.slowOut[1]) return lerpLog(SLOW, 1, (t - TOUR.slowOut[0]) / (TOUR.slowOut[1] - TOUR.slowOut[0]));
    return 1;
  }
  const nearOf = (phi, slowness) => { const x = smooth((Math.abs(phi) - 30 * D2R) / (75 * D2R)); return 1 + (NEAR - 1) * (1 - x) * slowness; };
  // integrate dr/dt = base(t) * near(phi(r)); the ending decelerates to a stop between beats
  const DT = 1 / 1200, NS = Math.round(TOUR.len / DT) + 1;
  const RT = new Float64Array(NS);
  {
    let r = 0;
    let stopFrom = -1, stopR = 0;
    for (let i = 0; i < NS; i++) {
      const t = i * DT;
      RT[i] = r;
      let v = baseSpeed(t);
      const slowness = Math.max(0, Math.min(1, Math.log(v) / Math.log(SLOW)));
      v *= nearOf(phiOf(r), slowness);
      if (t >= TOUR.stopAt) {
        if (stopFrom < 0) {
          // decelerate from real speed to rest at the next extreme of the swing (balance momentarily still, wheel locked)
          stopFrom = t;
          const r1 = (Math.ceil((r + 0.28) / PH - 0.5) + 0.5) * PH;
          RT.stop = { t0: t, r0: r, r1, dur: 2 * (r1 - r) };
        }
        const s = RT.stop, u = Math.min(1, (t - s.t0) / s.dur);
        // ease-out: real time slows to zero exactly at r1
        RT[i] = s.r0 + (s.r1 - s.r0) * (1 - (1 - u) * (1 - u));
        continue;
      }
      r += v * DT;
    }
  }
  function realOf(t) {
    if (t <= 0) return t;              // pre-roll before the tour: real speed
    const x = Math.min(t, TOUR.len) / DT, i = Math.min(NS - 2, Math.floor(x)), f = x - i;
    return RT[i] + (RT[i + 1] - RT[i]) * f;
  }
  // events in tour seconds, from the same model
  function eventsOf(step = 1 / 600) {
    const ev = [];
    let prev = state(realOf(0));
    let lastTick = -9;
    for (let t = step; t <= TOUR.len + 1e-9; t += step) {
      const s = state(realOf(t));
      const v = baseSpeed(t) < 0.5 ? 1 : 0;   // slow passage?
      if (s.n !== prev.n || s.phase !== prev.phase) {
        // phase changes within beat s.n
        if (s.phase === 3 && prev.phase !== 3 && s.n === prev.n) {
          if (v || t - lastTick >= 0.24) { ev.push({ t: +t.toFixed(3), type: "tick", i: v ? 1 : 0.55 }); lastTick = t; }
        } else if (v && s.phase === 1 && prev.phase === 0) ev.push({ t: +t.toFixed(3), type: "click", i: 0.45 });
      }
      prev = s;
    }
    ev.push({ t: TOUR.slowIn[0] + 0.15, type: "whoosh", i: 0.6 }, { t: TOUR.slowOut[0] + 0.3, type: "whoosh", i: 0.7 });
    return ev.sort((a, b) => a.t - b.t);
  }

  return {
    D2R, TAU, pol, add, sub, len, ang, rot, T, ratio, rB, rCp, rC, rTp, rT, rFp, rF, rEp, RE, PLATE_R, C, B, TH, FO, E, A, BAL, LINE, DA,
    LEVER, BAL_R, RP, PSI0, AMP, PHI_L, psiOf, entry, exit, stoneAt, SW, SL, IMP, LOCK, state, realOf, eventsOf, TOUR, baseSpeed, phiOf, PITCH, BASE, TIP0, PH, OMEGA, SLOW,
  };
}
