// Geneva drive (Maltese cross) driving a 16-tooth film sprocket on a bench stand: a projector's intermittent movement.
// Pure module, no imports: makeScene(k, G, P, { dynOnly }) -> { list, dyn(name, s) }. Shared by build.mjs and the page.
// World units: z up, bench top at z = 0. Film scale: 1 mm of 35 mm film = C.F world units.
export const C = (() => {
  const a = 100;                         // centre distance drive -> Geneva wheel
  const n = 4;                           // slots
  const R = a * Math.sin(Math.PI / n);   // crank radius: the pin enters the slot tangentially (slot radial at entry)
  const F = 30 / (16 * 4.75 / (2 * Math.PI)); // 16-tooth sprocket, 4.75 mm perf pitch: pitch radius 12.1 mm -> 30 world units
  const filmH = 35 * F, pitch = 19 * F;  // 35 mm film, 4 perfs = 19 mm per frame = a quarter turn of the sprocket
  const zb = 84;
  const D = [a * Math.cos(140 * Math.PI / 180), a * Math.sin(140 * Math.PI / 180)];
  return {
    a, n, R, F, filmH, pitch, D,
    pinR: 6.6, h: 7.4, uc: a - R - 0.6, Ro: 76, Rl: 60, Rc: 61.6, Rr: 77.6,
    ZA: [22, 28], ZL: [30, 40], ZP: 45,
    drumR: 30, zb, zt: zb + filmH, filmY: -30.4,
    gateX: -80, rollX: 128, rollR: 24,
    PLATE: { x: -172, y: -100, w: 344, d: 232, r: 10 }, PLATE_H: 10, FOOT_H: 5,
  };
})();

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (c, w, t) => "#" + hex(c).map((v, i) => Math.round(v + (hex(w)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const W_ = "#ffffff", K_ = "#1b1d22";
function ramp(name, b, { top = 0.5, s3 = 0.3, s2 = 0.12, s1 = -0.04, s0 = -0.2, ink = 0.62, extra = "" } = {}) {
  const tone = (t) => (t >= 0 ? mix(b, W_, t) : mix(b, K_, -t));
  return `.pc-${name}{--anatomy-paper:${tone(s2)};--anatomy-face:${tone(s2 + 0.08)};--anatomy-top:${tone(top)};--anatomy-lit-top:${tone(top + 0.08)};--anatomy-lit-shade:${tone(s3)};` +
    `--anatomy-shade-3:${tone(s3)};--anatomy-shade-2:${tone(s2)};--anatomy-shade-1:${tone(s1)};--anatomy-shade-0:${tone(s0)};` +
    `--anatomy-hi:${mix(b, K_, ink)};--anatomy-mid:${mix(b, K_, ink - 0.2)};--anatomy-lo:${mix(b, K_, ink - 0.38)};--anatomy-faint:${mix(b, K_, 0.12)};` +
    `--anatomy-lit:${mix(b, K_, ink + 0.08)};--anatomy-dot:${mix(b, K_, 0.7)}${extra}}`;
}
export const PALETTE_CSS = [
  ramp("bench", "#5b7fa6", { top: 0.66, s3: 0.5, s2: 0.34, s1: 0.16, s0: 0.0 }),
  ramp("steel", "#5b7fa6", { top: 0.5, s3: 0.32, s2: 0.14, s1: -0.02, s0: -0.18 }),
  ramp("orange", "#e8823a"),
  ramp("gold", "#d9a441"),
  ramp("teal", "#2f9e9a"),
  ramp("red", "#d6453d", { top: 0.46, s3: 0.28, s2: 0.1, s1: -0.05, s0: -0.22, ink: 0.66 }),
  ramp("grey", "#8d939b", { top: 0.6, s3: 0.4, s2: 0.2, s1: 0.02, s0: -0.14, ink: 0.66 }),
  ramp("film", "#4a4038", { top: 0.22, s3: 0.16, s2: 0.06, s1: -0.04, s0: -0.14, ink: 0.62, extra: ";--anatomy-mid:#2a241f;--anatomy-lo:#5d5248;--anatomy-faint:#6a5e53" }),
  ramp("cream", "#efe7d4", { top: 0.6, s3: 0.3, s2: 0.1, s1: -0.06, s0: -0.16, ink: 0.72, extra: ";--anatomy-mid:#5d6470;--anatomy-lo:#8a909a;--anatomy-faint:#c9c2b0" }),
  `.gw{stroke-width:.5px;stroke-linejoin:round}.gw[data-shade="0"]{fill:var(--anatomy-shade-0);stroke:var(--anatomy-shade-0)}.gw[data-shade="1"]{fill:var(--anatomy-shade-1);stroke:var(--anatomy-shade-1)}`,
  `.gw[data-shade="2"]{fill:var(--anatomy-shade-2);stroke:var(--anatomy-shade-2)}.gw[data-shade="3"]{fill:var(--anatomy-shade-3);stroke:var(--anatomy-shade-3)}`,
  `.gtop{fill:var(--anatomy-top);stroke:var(--anatomy-top);stroke-width:.4px}`,
  `.fm-base{fill:#3f3730;stroke:none}.fm-img{fill:#f3ead6;stroke:#2a241f;stroke-width:.5px}.fm-perf{fill:#efe7d4;stroke:#2a241f;stroke-width:.4px}`,
  `.fm-ball{fill:#2f9e9a;stroke:#14524f;stroke-width:.5px}.fm-sky{fill:#cfe0e6;stroke:none}`,
  `.fm-glow{fill:#ffd97a;mix-blend-mode:multiply}.fm-glow2{fill:#fff6cf}`,
].join("\n");

// ---------------- kinematics (pure, also used by the page) ----------------
export function kinematics() {
  const { a, R, D } = C;
  const angGD = Math.atan2(D[1], D[0]);                 // direction G -> D
  const angDG = angGD + Math.PI;                        // direction D -> G
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const Lof = (beta, sd) => {
    const pa = angDG + sd * beta;
    const p = [D[0] + R * Math.cos(pa), D[1] + R * Math.sin(pa)];
    return wrap(Math.atan2(p[1], p[0]) - angGD);
  };
  const Q = Math.PI / 4;
  // pick the drive sense that turns the wheel counter-clockwise (film runs left to right behind the sprocket)
  const sd = Lof(Q, 1) - Lof(-Q, 1) > 0 ? 1 : -1;
  const L0 = Lof(-Q, sd), L1 = Lof(Q, sd);
  const step = L1 - L0; // +pi/2
  // psi: crank angle (rad), 0 = pin pointing at the wheel centre (mid-engagement)
  function pose(psi) {
    const c = Math.round(psi / (2 * Math.PI));
    const beta = psi - c * 2 * Math.PI;
    const bc = Math.max(-Q, Math.min(Q, beta));
    const rot = c * step + Lof(bc, sd) - L0 - step / 2; // locked between steps at k*90 deg + 45 (L1 = -L0)
    void L1;
    const pinA = angDG + sd * psi;
    return { c, beta, engaged: Math.abs(beta) < Q, rot, pinA, crank: sd * psi };
  }
  return { pose, angGD, angDG, sd };
}

export function makeScene(k, G, P, { dynOnly = false } = {}) {
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (pts, style) => k.dotsSvg(pts, style);
  const paint = (col, svg) => (col && svg ? `<g class="pc-${col}">${svg}</g>` : svg);
  const KIN = kinematics();
  const [VX, VY] = k.towardViewer(P);
  const { sinA, cosA } = k.cameraOf(P);
  const list = [], dyns = {};
  const stat = (fn, col) => list.push({ svg: dynOnly ? "" : paint(col, fn()) });
  const dyn = (name, fn) => { list.push({ dyn: name }); dyns[name] = fn; };
  const D = C.D;
  const halo = (plan, z, blur = 6, op = 0.3) => `<path class="iso-halo" d="${k.haloOf(plan, z, 0.1, P)}" style="filter:blur(${blur}px);opacity:${op}"/>`;
  const circ = (cx, cy, r, n = 48, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(a0 + (i / n) * TAU), cy + r * Math.sin(a0 + (i / n) * TAU)]);
  const arcPts = (cx, cy, r, from, to, n) => Array.from({ length: n + 1 }, (_, i) => { const t = from + (to - from) * (i / n); return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
  const P2 = (p) => k.pathOf(p.map(at));

  // ---------- custom prism walls (concave plan shapes, depth sorted across solids) ----------
  function walls(ring, z0, z1, col, out) {
    let area = 0;
    for (let i = 0; i < ring.length; i++) { const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length]; area += ax * by - bx * ay; }
    const ccw = area > 0, n = ring.length;
    const nrm = ring.map(([ax, ay], i) => { const [bx, by] = ring[(i + 1) % n]; const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1; return ccw ? [dy / l, -dx / l] : [-dy / l, dx / l]; });
    const facing = nrm.map(([nx, ny]) => nx * VX + ny * VY > 1e-9);
    for (let i = 0; i < n; i++) {
      if (!facing[i]) continue;
      const a = ring[i], b = ring[(i + 1) % n];
      const q = [[a[0], a[1], z1], [b[0], b[1], z1], [b[0], b[1], z0], [a[0], a[1], z0]].map(at);
      const lit = (nrm[i][0] * -sinA + nrm[i][1] * cosA + 1) / 2;
      const shade = Math.min(3, Math.max(0, Math.floor(lit * 4)));
      let edge = k.pathOf([q[3], q[2]]);
      const prev = (i + n - 1) % n, next = (i + 1) % n;
      const turn = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
      if (!facing[prev] || turn(nrm[prev], nrm[i]) > 0.5) edge += k.pathOf([q[0], q[3]]);
      if (!facing[next] || turn(nrm[i], nrm[next]) > 0.5) edge += k.pathOf([q[1], q[2]]);
      const depth = k.depthOf([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z0 + z1) / 2], P);
      out.push({ depth, svg: `<g class="pc-${col}"><path class="gw" data-shade="${shade}" d="${k.pathOf(q, true)}"/><path class="iso-line iso-edge" data-tone="hi" d="${edge}"/></g>` });
    }
  }
  const topOf = (ring, z, col, extra = "") => `<g class="pc-${col}"><path class="gtop" d="${k.pathOf(ring.map(([x, y]) => at([x, y, z])), true)}"/>${extra}<path class="iso-line iso-edge" data-tone="hi" d="${k.pathOf(ring.map(([x, y]) => at([x, y, z])), true)}"/></g>`;

  // ---------- Geneva wheel plan in its own frame (slot 0 along local +x) ----------
  const genevaLocal = (() => {
    const { a, h, uc, Ro, Rc } = C;
    const pts = [];
    const alpha = Math.acos((Ro * Ro + a * a - Rc * Rc) / (2 * Ro * a));
    const sx = Math.asin(h / Ro);
    const uo = Math.sqrt(Ro * Ro - h * h);
    for (let kk = 0; kk < 4; kk++) {
      const s = kk * TAU / 4;
      const eu = [Math.cos(s), Math.sin(s)], ev = [-Math.sin(s), Math.cos(s)];
      const L = (u, v) => [eu[0] * u + ev[0] * v, eu[1] * u + ev[1] * v];
      // slot: in along -v wall, round end, out along +v wall
      for (let i = 0; i <= 6; i++) { const u = uo + (uc - uo) * (i / 6); pts.push(L(u, -h)); }
      for (let i = 1; i < 12; i++) { const tau = -Math.PI / 2 - Math.PI * (i / 12); pts.push(L(uc + h * Math.cos(tau), h * Math.sin(tau))); }
      for (let i = 0; i <= 6; i++) { const u = uc + (uo - uc) * (i / 6); pts.push(L(u, h)); }
      // outer rim to the concave arc
      const c = s + TAU / 8, cc = [a * Math.cos(c), a * Math.sin(c)];
      pts.push(...arcPts(0, 0, Ro, s + sx, c - alpha, 3).slice(1));
      const p1 = [Ro * Math.cos(c - alpha), Ro * Math.sin(c - alpha)], p2 = [Ro * Math.cos(c + alpha), Ro * Math.sin(c + alpha)];
      let t1 = Math.atan2(p1[1] - cc[1], p1[0] - cc[0]), t2 = Math.atan2(p2[1] - cc[1], p2[0] - cc[0]);
      while (t2 > t1) t2 -= TAU; // clockwise around the arc centre, through the side facing the wheel
      pts.push(...arcPts(cc[0], cc[1], Rc, t1, t2, 22).slice(1, -1));
      pts.push(...arcPts(0, 0, Ro, c + alpha, s + TAU / 4 - sx, 3));
    }
    return pts;
  })();
  const genevaRing = (rot) => { const ca = Math.cos(rot), sa = Math.sin(rot); return genevaLocal.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]); };

  // locking disc on the drive: circle Rl minus the relief that faces the pin
  const lockRing = (pinA) => {
    const { a, Rl, Rr } = C;
    const ang = Math.acos((Rl * Rl + a * a - Rr * Rr) / (2 * Rl * a));
    const pts = arcPts(D[0], D[1], Rl, pinA + ang, pinA + TAU - ang, 44);
    const rc = [D[0] + a * Math.cos(pinA), D[1] + a * Math.sin(pinA)];
    const e1 = pts[pts.length - 1], e0 = pts[0];
    let t1 = Math.atan2(e1[1] - rc[1], e1[0] - rc[0]), t2 = Math.atan2(e0[1] - rc[1], e0[0] - rc[0]);
    while (t2 > t1) t2 -= TAU;
    pts.push(...arcPts(rc[0], rc[1], Rr, t1, t2, 16).slice(1, -1));
    return pts;
  };
  const hull = (pts) => {
    const s = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return [...lo.slice(0, -1), ...up.slice(0, -1)];
  };

  // ======================= painter's order =======================
  const { PLATE, PLATE_H, FOOT_H, zb, zt, filmY, gateX, rollX, rollR } = C;
  // bench
  stat(() => {
    const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    const feet = k.corners(PLATE, 18).sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
    for (const [x, y] of feet) {
      out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "mid" }));
      out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "hi", inner: Ln(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "lo" }) }));
    out.push(Ln(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
    const screws = k.corners(PLATE, 11);
    out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "hi" }));
    return out.join("");
  }, "bench");
  // bench props: ruler strip, label plate, film can, switch box
  stat(() => {
    const out = [];
    const strip = { x: -150, y: PLATE.y + PLATE.d - 17, w: 150, d: 8, r: 1 };
    const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4.7, 4, strip.y, 0.7, [2.4, strip.d], P);
    out.push(paint("cream", S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "mid", crease: "none" }) + Ln(ticks.minor, { tone: "lo" }) + Ln(ticks.major, { tone: "mid" }) +
      Dots([at([strip.x + 2, strip.y + 4, 0.7]), at([strip.x + strip.w - 2, strip.y + 4, 0.7])], { size: 0.45 })));
    const label = { x: 92, y: 98, w: 52, d: 20, r: 2 };
    const lab = [S(k.slabOf(label, 0, 1.2, P, 3, 0.4), { tone: "mid" })];
    for (const [i, len] of [[0, 38], [1, 26], [2, 32]]) lab.push(Ln(k.lineOnTop([label.x + 6, label.y + 6 + i * 4.6], [label.x + 6 + len, label.y + 6 + i * 4.6], 1.2, P), { tone: "lo", free: true }));
    lab.push(Dots([at([label.x + 2.6, label.y + 2.6, 1.2]), at([label.x + label.w - 2.6, label.y + label.d - 2.6, 1.2])], { size: 0.45, tone: "hi" }));
    out.push(paint("cream", lab.join("")));
    // film can lying on the bench, lid on
    const [cx, cy] = [108, 46];
    const can = [halo({ x: cx - 34, y: cy - 34, w: 68, d: 68, r: 34 }, 0.1, 5, 0.25)];
    can.push(S(k.cylinder(cx, cy, 32, 0, 7, P, 72, 0.6), { tone: "hi" }));
    can.push(S(k.cylinder(cx, cy, 33, 7, 4, P, 72, 0.6), { tone: "hi" }));
    can.push(Ln(k.ring(cx, cy, 27, 11, P, 64) + k.ring(cx, cy, 20, 11, P, 56), { tone: "lo" }));
    can.push(Dots([at([cx, cy, 11])], { size: 0.9, tone: "hi" }));
    out.push(paint("grey", can.join("")));
    // tape label on the lid
    out.push(paint("cream", S(k.slabOf({ x: cx - 10, y: cy - 4, w: 20, d: 8, r: 1 }, 11, 0.4, P, 2), { tone: "mid", crease: "none" })));
    return out.join("");
  });

  // ---------- back: roll spindles, rolls, lamp house ----------
  const rollAt = (sx) => [sx * rollX, filmY - rollR];
  const rollStatic = (sx) => {
    const [x, y] = rollAt(sx);
    const out = [];
    out.push(paint("steel", S(k.cylinder(x, y, 16, 0, 4, P, 40, 0.6), { tone: "hi" }) + Dots(circ(x, y, 12, 4, 0.4).map(([px, py]) => at([px, py, 4])), { size: 0.5, tone: "hi" }) +
      S(k.cylinder(x, y, 4.5, 4, zb - 8, P, 24), { tone: "hi", inner: Ln(k.sideArc(x, y, 4.5, 30, P, 16), { tone: "lo" }) }) +
      S(k.cylinder(x, y, 30, zb - 4, 3, P, 72, 0.6), { tone: "hi" })));
    out.push(paint("film", S(k.cylinder(x, y, rollR, zb - 1, zt - zb + 2, P, 64), { tone: "hi", crease: "mid", inner: Ln(k.ring(x, y, rollR - 5, zt + 1, P, 48) + k.ring(x, y, rollR - 11, zt + 1, P, 48), { tone: "lo" }) })));
    return out.join("");
  };
  const rollTop = (sx, ang) => {
    const [x, y] = rollAt(sx);
    const z = zt + 1;
    const out = [];
    out.push(paint("grey", S(k.cylinder(x, y, 8, z, 2, P, 32), { tone: "hi" })));
    // tape tab on the outer turn: the roll's turning mark
    const a0 = ang, p0 = [x + 8 * Math.cos(a0), y + 8 * Math.sin(a0), z], p1 = [x + rollR * Math.cos(a0), y + rollR * Math.sin(a0), z];
    out.push(`<path class="iso-line" data-tone="lit" d="${k.pathOf([p0, p1].map(at))}" style="stroke:#f3ead6;stroke-width:1.6"/>`);
    out.push(paint("grey", Dots([at([x, y, z + 2])], { size: 1.1, tone: "hi" })));
    return out.join("");
  };
  stat(() => rollStatic(-1));
  dyn("rollL", (s) => rollTop(-1, s.rollA));
  // lamp house behind the gate
  const LAMP = { x: gateX - 20, y: filmY - 50, w: 40, d: 40, r: 3 };
  stat(() => {
    const out = [];
    const [cx, cy] = [gateX, LAMP.y + LAMP.d / 2];
    out.push(S(k.cylinder(cx, cy, 16, 0, 4, P, 40, 0.6), { tone: "hi" }));
    out.push(S(k.cylinder(cx, cy, 6, 4, 92, P, 24), { tone: "hi", inner: Ln(k.sideArc(cx, cy, 6, 40, P, 16), { tone: "lo" }) }));
    out.push(S(k.slabOf(LAMP, 96, 70, P, 4, 1), { tone: "hi", inner: Ln(k.sideSeam(LAMP, 104, P, 4), { tone: "lo" }) }));
    // vent slots on the roof and a chimney cap
    const vents = [];
    for (let i = 0; i < 5; i++) vents.push(k.pathOf([at([LAMP.x + 8, LAMP.y + 7 + i * 5, 166]), at([LAMP.x + 28, LAMP.y + 7 + i * 5, 166]), at([LAMP.x + 28, LAMP.y + 9 + i * 5, 166]), at([LAMP.x + 8, LAMP.y + 9 + i * 5, 166])], true));
    out.push(`<path class="iso-line" data-tone="hi" d="${vents.join("")}" style="fill:var(--anatomy-shade-0)"/>`);
    out.push(S(k.cylinder(LAMP.x + 34, LAMP.y + 30, 3, 166, 5, P, 18), { tone: "hi" }));
    out.push(Dots([at([LAMP.x + 3, LAMP.y + LAMP.d, 160]), at([LAMP.x + LAMP.w - 3, LAMP.y + LAMP.d, 160]), at([LAMP.x + LAMP.w, LAMP.y + LAMP.d - 3, 160]), at([LAMP.x + LAMP.w, LAMP.y + 3, 160])], { size: 0.5, tone: "hi" }));
    return out.join("");
  }, "steel");
  stat(() => rollStatic(1));
  dyn("rollR", (s) => rollTop(1, s.rollA));

  // ---------- film: static base ribbon, moving frames (clipped), lamp glow, outline ----------
  const fp = (x, z) => at([x, filmY, z]);
  const filmRib = [fp(-rollX, zb), fp(rollX, zb), fp(rollX, zt), fp(-rollX, zt)];
  const filmFrames = (() => {
    const F = C.F, pitch = C.pitch;
    const out = [];
    const imgW = 16 * F, imgH = 22 * F, zc = (zb + zt) / 2;
    const perfW = 2.8 * F * 0.72, perfH = 1.98 * F, perfZ = [zb + 2.0 * F + perfH / 2, zt - 2.0 * F - perfH / 2];
    for (let i = -10; i <= 8; i++) {
      const xc = gateX + i * pitch;
      const ph = ((i % 8) + 8) % 8;
      // image: sky, ground, a ball bouncing across eight frames
      const x0 = xc - imgW / 2, x1 = xc + imgW / 2, z0 = zc - imgH / 2, z1 = zc + imgH / 2;
      out.push(`<path class="fm-img" d="${k.pathOf([fp(x0, z0), fp(x1, z0), fp(x1, z1), fp(x0, z1)], true)}"/>`);
      const zg = z0 + 9;
      out.push(`<path class="fm-sky" d="${k.pathOf([fp(x0 + 0.6, zg), fp(x1 - 0.6, zg), fp(x1 - 0.6, z1 - 0.6), fp(x0 + 0.6, z1 - 0.6)], true)}"/>`);
      out.push(`<path class="iso-line" data-tone="mid" d="${k.pathOf([fp(x0, zg), fp(x1, zg)])}" style="stroke:#2a241f"/>`);
      const hgt = Math.abs(Math.cos((ph / 8) * Math.PI)); // ball height: bounces once per 8 frames
      const sq = ph === 4 ? 0.8 : 1;
      const br = 6.2, bz = zg + br * sq + hgt * (imgH - 9 - 2 * br - 2), bx = xc + (ph - 3.5) * 1.5;
      const ball = Array.from({ length: 24 }, (_, j) => { const t = (j / 24) * TAU; return fp(bx + br / sq * Math.cos(t) * 0.95, bz + br * sq * Math.sin(t)); });
      out.push(`<path class="fm-ball" d="${k.pathOf(ball, true)}"/>`);
      // perforations: four per frame on each edge
      for (const pz of perfZ) for (let j = 0; j < 4; j++) {
        const px = xc - pitch / 2 + (j + 0.5) * (pitch / 4);
        out.push(`<path class="fm-perf" d="${k.pathOf([fp(px - perfW / 2, pz - perfH / 2), fp(px + perfW / 2, pz - perfH / 2), fp(px + perfW / 2, pz + perfH / 2), fp(px - perfW / 2, pz + perfH / 2)], true)}"/>`);
      }
    }
    return out.join("");
  })();
  stat(() => `<defs><clipPath id="gv-film" clipPathUnits="userSpaceOnUse"><path d="${k.pathOf(filmRib, true)}"/></clipPath></defs><path class="fm-base" d="${k.pathOf(filmRib, true)}"/>`);
  dyn("film", (s) => `<g clip-path="url(#gv-film)"><g transform="${k.translateAlong(P, [s.filmOff, 0, 0])}">${filmFrames}</g></g>`);
  // the shutter-gated lamp light on the frame in the gate
  const aper = { x0: gateX - 8 * C.F - 0.5, x1: gateX + 8 * C.F + 0.5, z0: (zb + zt) / 2 - 11 * C.F - 0.5, z1: (zb + zt) / 2 + 11 * C.F + 0.5 };
  dyn("glow", (s) => `<path class="fm-glow" d="${k.pathOf([fp(aper.x0, aper.z0), fp(aper.x1, aper.z0), fp(aper.x1, aper.z1), fp(aper.x0, aper.z1)], true)}" style="opacity:${(0.62 * s.glow).toFixed(3)}"/>`);
  stat(() => `<path class="iso-line iso-edge" data-tone="hi" d="${k.pathOf(filmRib, true)}" style="stroke:#211c18"/>`);

  // ---------- film gate in front of the film ----------
  stat(() => {
    const out = [];
    const y0 = filmY + 0.6, y1 = filmY + 4;
    const zg0 = zb - 7, zg1 = zt + 7;
    const bar = (x0, x1, z0, z1) => S(k.extrude([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1 - z0, P), { tone: "hi" });
    // support rod and foot under the gate
    out.push(S(k.cylinder(gateX, filmY + 2.3, 9, 0, 3, P, 32, 0.5), { tone: "hi" }));
    out.push(S(k.cylinder(gateX, filmY + 2.3, 2.6, 3, zg0 - 3, P, 18), { tone: "hi" }));
    out.push(bar(gateX - 27, aper.x0, zg0, zg1));
    out.push(bar(aper.x0, aper.x1, zg0, aper.z0));
    out.push(bar(aper.x0, aper.x1, aper.z1, zg1));
    out.push(bar(aper.x1, gateX + 27, zg0, zg1));
    // pressure-plate screws
    out.push(Dots([[gateX - 23, zg0 + 5], [gateX + 23, zg0 + 5], [gateX - 23, zg1 - 5], [gateX + 23, zg1 - 5]].map(([x, z]) => at([x, y1, z])), { size: 0.7, tone: "hi" }));
    return out.join("");
  }, "steel");

  // ---------- Geneva wheel pedestal and drive gearbox + motor ----------
  stat(() => {
    const out = [halo({ x: -20, y: -20, w: 40, d: 40, r: 20 }, 0.1, 5, 0.3)];
    out.push(S(k.cylinder(0, 0, 18, 0, 4, P, 48, 0.6), { tone: "hi" }));
    out.push(Dots(circ(0, 0, 14.5, 4, Math.PI / 4).map(([x, y]) => at([x, y, 4])), { size: 0.5, tone: "hi" }));
    out.push(S(k.cylinder(0, 0, 12, 4, 14, P, 40), { tone: "hi", inner: Ln(k.sideArc(0, 0, 12, 10, P, 24), { tone: "lo" }) }));
    out.push(S(k.cylinder(0, 0, 13.5, 18, 3, P, 40, 0.5), { tone: "hi" }));
    return out.join("");
  }, "steel");
  stat(() => {
    const out = [];
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    const gx0 = D[0] - 21;
    // motor on the far side of the gearbox, axis along -x
    const F = G.frameOf([gx0, D[1], 12], [-1, 0, 0], Y, Z);
    out.push(halo({ x: gx0 - 44, y: D[1] - 12, w: 44, d: 24, r: 8 }, 0.1, 4, 0.3));
    out.push(S(k.slabOf({ x: gx0 - 36, y: D[1] - 10, w: 8, d: 20, r: 1 }, 0, 4, P, 2), { tone: "hi" }));
    out.push(S(k.slabOf({ x: gx0 - 12, y: D[1] - 10, w: 8, d: 20, r: 1 }, 0, 4, P, 2), { tone: "hi" }));
    out.push(S(G.solidOf([[0, 7], [2, 7], [2, 10.5], [36, 10.5], [38, 9], [40, 9]], F, P), { tone: "hi", inner: Ln([8, 14, 20, 26, 32].map((s) => G.arcOf(F, s, 10.5, P)).join(""), { tone: "lo" }) }));
    out.push(Dots(G.dotsOf(F, 40, 5.5, 6, P, { all: true }), { size: 0.7, tone: "hi" }));
    out.push(Ln(G.circleOf(F, 40, 7.5, P), { tone: "lo" }));
    // terminal box on top of the motor
    out.push(S(k.slabOf({ x: gx0 - 24, y: D[1] - 5, w: 12, d: 10, r: 1 }, 21.5, 4, P, 2, 0.4), { tone: "hi" }));
    out.push(Dots([at([gx0 - 21, D[1] - 2, 25.5]), at([gx0 - 15, D[1] + 2, 25.5])], { size: 0.45, tone: "hi" }));
    // gearbox
    const box = { x: D[0] - 21, y: D[1] - 21, w: 42, d: 42, r: 4 };
    out.push(halo(box, 0.1, 5, 0.3));
    out.push(S(k.slabOf(box, 0, 18, P, 4, 1.2), { tone: "hi", inner: Ln(k.sideSeam(box, 9, P, 4), { tone: "lo" }) }));
    const sc = k.corners(box, 4.5);
    out.push(Ln(sc.map(([x, y]) => k.ring(x, y, 1.8, 18, P, 12)).join(""), { tone: "lo" }));
    out.push(Dots(sc.map(([x, y]) => at([x, y, 18])), { size: 0.55, tone: "hi" }));
    out.push(S(k.cylinder(D[0], D[1], 12, 18, 3, P, 40, 0.5), { tone: "hi" }));
    void X;
    return out.join("");
  }, "steel");

  // ---------- crank arm (orange) with the pin boss ----------
  dyn("arm", (s) => {
    const pin = [D[0] + C.R * Math.cos(s.pinA), D[1] + C.R * Math.sin(s.pinA)];
    const cw = [D[0] - 22 * Math.cos(s.pinA), D[1] - 22 * Math.sin(s.pinA)];
    const ring = hull([...circ(D[0], D[1], 15, 40), ...circ(pin[0], pin[1], 9, 28), ...circ(cw[0], cw[1], 12, 28)]);
    const [z0, z1] = C.ZA;
    let out = S(k.extrude(ring, z0, z1 - z0, P), { tone: "hi" });
    out += S(k.cylinder(D[0], D[1], 15, 21, 1, P, 40), { tone: "hi" });
    return paint("orange", out);
  });

  // ---------- the level: Geneva wheel + locking disc + pin, walls depth-sorted, then tops ----------
  dyn("level", (s) => {
    const [z0, z1] = C.ZL;
    const items = [];
    const gr = genevaRing(s.wheelA);
    const lr = lockRing(s.pinA);
    const pin = [D[0] + C.R * Math.cos(s.pinA), D[1] + C.R * Math.sin(s.pinA)];
    walls(gr, z0, z1, "gold", items);
    walls(lr, z0, z1, "orange", items);
    walls(circ(pin[0], pin[1], C.pinR, 24), C.ZA[1], z1, "red", items);
    items.sort((p, q) => p.depth - q.depth);
    const out = items.map((it) => it.svg);
    // Geneva top: four rivets on the lands between the slots, an engraved ring round the hub
    const rivets = [0, 1, 2, 3].map((i) => { const t = s.wheelA + (i + 0.5) * TAU / 4; return [33 * Math.cos(t), 33 * Math.sin(t)]; });
    const gTopExtra = Ln(rivets.map(([x, y]) => k.ring(x, y, 2.4, z1, P, 14)).join("") + k.ring(0, 0, 19.5, z1, P, 48), { tone: "lo" }) + Dots(rivets.map(([x, y]) => at([x, y, z1])), { size: 0.75, tone: "hi" });
    out.push(topOf(gr, z1, "gold", gTopExtra));
    const lockExtra = Dots([0.9, -0.9].map((d) => at([D[0] + 30 * Math.cos(s.pinA + Math.PI + d), D[1] + 30 * Math.sin(s.pinA + Math.PI + d), z1])), { size: 0.75, tone: "hi" });
    out.push(topOf(lr, z1, "orange", lockExtra));
    out.push(topOf(circ(pin[0], pin[1], C.pinR, 24), z1, "red"));
    return out.join("");
  });
  // pin head above the wheel, drive hub nut, Geneva hub boss
  dyn("hubs", (s) => {
    const pin = [D[0] + C.R * Math.cos(s.pinA), D[1] + C.R * Math.sin(s.pinA)];
    const z1 = C.ZL[1];
    const out = [];
    out.push(paint("red", S(k.cylinder(pin[0], pin[1], C.pinR, z1, 3, P, 24), { tone: "hi", lit: true }) + S(k.cylinder(pin[0], pin[1], C.pinR - 1.2, z1 + 3, 1.6, P, 24), { tone: "hi", lit: true }) + Dots([at([pin[0], pin[1], z1 + 4.6])], { size: 0.9, tone: "hi" })));
    // drive hub nut (hex) with a turning flat
    const hexr = circ(D[0], D[1], 9, 6, s.pinA);
    out.push(paint("orange", S(k.extrude(hexr, z1, 4, P), { tone: "hi" }) + Ln(k.ring(D[0], D[1], 4.5, z1 + 4, P, 24), { tone: "lo" }) + Dots([at([D[0], D[1], z1 + 4])], { size: 0.9, tone: "hi" })));
    // Geneva hub boss with set screw
    const hub = S(k.cylinder(0, 0, 14, z1, 7, P, 48, 0.6), { tone: "hi", inner: Ln(k.sideArc(0, 0, 14, z1 + 3.5, P, 32), { tone: "lo" }) });
    const ssa = s.wheelA + Math.PI / 4;
    const facing = Math.cos(ssa) * VX + Math.sin(ssa) * VY > 0.25;
    const ss = facing ? Dots([at([14 * Math.cos(ssa), 14 * Math.sin(ssa), z1 + 3.5])], { size: 1.1, tone: "hi" }) : "";
    out.push(paint("gold", hub + ss));
    return out.join("");
  });

  // ---------- the sprocket shaft and drum (teal) ----------
  const ZR1 = [zb - 6, zb + 12], ZR2 = [zt - 12, zt + 6];
  stat(() => {
    const out = [];
    const z1 = C.ZL[1] + 7;
    out.push(paint("grey", S(k.cylinder(0, 0, 5, z1, ZR1[0] - z1 - 3, P, 24), { tone: "hi", inner: Ln(k.sideArc(0, 0, 5, z1 + 6, P, 16), { tone: "lo" }) })));
    out.push(paint("teal", S(k.cylinder(0, 0, 10, ZR1[0] - 3, 3, P, 32, 0.4), { tone: "hi" }) +
      S(k.cylinder(0, 0, C.drumR, ZR1[0], ZR1[1] - ZR1[0], P, 72, 0.8), { tone: "hi", inner: Ln(k.sideArc(0, 0, C.drumR, ZR1[0] + 3, P, 48), { tone: "lo" }) }) +
      S(k.cylinder(0, 0, 25, ZR1[1], ZR2[0] - ZR1[1], P, 64), { tone: "hi", inner: Ln(k.sideArc(0, 0, 25, (ZR1[1] + ZR2[0]) / 2, P, 48), { tone: "faint" }) }) +
      S(k.cylinder(0, 0, C.drumR, ZR2[0], ZR2[1] - ZR2[0], P, 72, 0.8), { tone: "hi", inner: Ln(k.sideArc(0, 0, C.drumR, ZR2[1] - 3, P, 48), { tone: "lo" }) })));
    return out.join("");
  });
  dyn("drum", (s) => {
    const out = [];
    const zT = ZR2[1];
    // index groove across the drum top (turns with the wheel), then the cap over it
    const t = s.wheelA;
    out.push(`<path class="iso-line" data-tone="hi" d="${k.pathOf([[13 * Math.cos(t), 13 * Math.sin(t), zT], [C.drumR * Math.cos(t), C.drumR * Math.sin(t), zT]].map(at))}" style="stroke-width:1.4"/>`);
    out.push(S(k.cylinder(0, 0, 13, zT, 3, P, 40, 0.5), { tone: "hi" }));
    out.push(Dots(circ(0, 0, 9, 3, t).map(([x, y]) => at([x, y, zT + 3])), { size: 0.7, tone: "hi" }));
    out.push(Dots([at([0, 0, zT + 3])], { size: 1.1, tone: "hi" }));
    // 16 teeth per ring on the visible side, one per perforation
    const F = C.F, perfH = 1.98 * F;
    const rows = [zb + 2.0 * F + perfH / 2, zt - 2.0 * F - perfH / 2];
    const teeth = [];
    for (const zr of rows) for (let j = 0; j < 16; j++) {
      const a = t + (j + 0.5) * TAU / 16;
      const ca = Math.cos(a), sa = Math.sin(a);
      if (ca * VX + sa * VY < 0.12) continue;
      const tw = 2.1, r0 = C.drumR - 0.2, r1 = C.drumR + 3.2;
      const ring = [[r0, -tw], [r1, -tw * 0.6], [r1, tw * 0.6], [r0, tw]].map(([r, w]) => [r * ca - w * sa, r * sa + w * ca]);
      teeth.push({ d: k.depthOf([ca * r1, sa * r1, zr], P), svg: S(k.extrude(ring, zr - 2.2, 4.4, P), { tone: "hi", crease: "none" }) });
    }
    teeth.sort((p, q) => p.d - q.d);
    out.push(...teeth.map((x) => x.svg));
    return paint("teal", out.join(""));
  });

  return { list, dyn: (name, st) => dyns[name](st), names: Object.keys(dyns), genevaLocal };
}
