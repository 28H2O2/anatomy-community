// Scene for the open bevel-gear differential on a bench stand.
// Pure: makeScene(k, G, P, { dynOnly }) -> ordered list of entries { svg } (static) or { dyn: name } plus dyn(name, state).
// Shared by build.mjs (Node, writes the static art) and the page (inlined, redraws the moving parts each frame).
export const C = {
  BASE: -50, // top of the bench plate (axle centre is z = 0)
  PLATE: { x: -72, y: -30, w: 144, d: 120, r: 6 },
  PLATE_H: 8,
  FOOT_H: 5,
  WHEEL_X: 84,
  WHEEL_R: 29.5,
  OUT_PED: 63,
  CAR_PED: 41,
  TACHO: [[-53, 66], [42, 58]],
  PIN_X: -10.5,
  PIN_PED: 60,
  FLANGE: [70, 75.5],
  RING_TEETH: 37,
  PINION_TEETH: 10,
  SIDE_TEETH: 16,
  SPIDER_TEETH: 10,
};

// ---------- textbook palette: each hue gets its own four-tone ramp, outlines in a dark ink of the same hue ----------
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (c, w, t) => "#" + hex(c).map((v, i) => Math.round(v + (hex(w)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const W_ = "#ffffff", K_ = "#1b1d22";
function ramp(name, b, { top = 0.55, s3 = 0.38, s2 = 0.2, s1 = 0.02, s0 = -0.16, ink = 0.62, lit, extra = "" } = {}) {
  const tone = (t) => (t >= 0 ? mix(b, W_, t) : mix(b, K_, -t));
  return `.pc-${name}{--anatomy-paper:${tone(s2)};--anatomy-face:${tone(s2 + 0.08)};--anatomy-top:${tone(top)};--anatomy-lit-top:${tone(top + 0.08)};--anatomy-lit-shade:${tone(s3)};` +
    `--anatomy-shade-3:${tone(s3)};--anatomy-shade-2:${tone(s2)};--anatomy-shade-1:${tone(s1)};--anatomy-shade-0:${tone(s0)};` +
    `--anatomy-hi:${mix(b, K_, ink)};--anatomy-mid:${mix(b, K_, ink - 0.2)};--anatomy-lo:${mix(b, K_, ink - 0.38)};--anatomy-faint:${mix(b, K_, 0.12)};` +
    `--anatomy-lit:${lit || mix(b, K_, ink + 0.08)};--anatomy-dot:${mix(b, K_, 0.7)}${extra}}`;
}
export const PALETTE_CSS = [
  ramp("bench", "#5b7fa6", { top: 0.66, s3: 0.5, s2: 0.34, s1: 0.16, s0: 0.0 }),
  ramp("steel", "#5b7fa6", { top: 0.5, s3: 0.32, s2: 0.14, s1: -0.02, s0: -0.18 }),
  ramp("orange", "#e8823a", { top: 0.5, s3: 0.3, s2: 0.12, s1: -0.04, s0: -0.2 }),
  ramp("gold", "#d9a441", { top: 0.5, s3: 0.3, s2: 0.12, s1: -0.04, s0: -0.2 }),
  ramp("teal", "#2f9e9a", { top: 0.5, s3: 0.3, s2: 0.12, s1: -0.04, s0: -0.2 }),
  ramp("red", "#d6453d", { top: 0.46, s3: 0.28, s2: 0.1, s1: -0.05, s0: -0.22, ink: 0.66 }),
  ramp("tyre", "#3b3f46", { top: 0.22, s3: 0.14, s2: 0.06, s1: -0.04, s0: -0.16, ink: 0.7, lit: "#ffc93a", extra: ";--anatomy-mid:#202226;--anatomy-lo:#26292e;--anatomy-faint:#2c2f35" }),
  ramp("rim", "#b9c1cb", { top: 0.6, s3: 0.4, s2: 0.2, s1: 0.0, s0: -0.14, ink: 0.66 }),
  ramp("cream", "#efe7d4", { top: 0.6, s3: 0.3, s2: 0.1, s1: -0.06, s0: -0.16, ink: 0.72, extra: ";--anatomy-mid:#5d6470;--anatomy-lo:#8a909a;--anatomy-faint:#c9c2b0" }),
  ".pc-needleL{--anatomy-lit:#1f8a86;--anatomy-hi:#14524f}.pc-needleR{--anatomy-lit:#e06d1f;--anatomy-hi:#7a3a10}",
].join("\n");

export function makeScene(k, G, P, { dynOnly = false } = {}) {
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const V = G.viewOf(P);
  const KS = G.scaleOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (pts, style) => k.dotsSvg(pts, style);
  const Faded = (list, style) => k.fadedSvg(list, style);
  const FADE = [0.04, 0.42];
  const { BASE, PLATE, PLATE_H, FOOT_H, WHEEL_X, WHEEL_R } = C;
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const O = [0, 0, 0];
  const FX = (o = O) => G.frameOf(o, X, Y, Z);
  const FY = (o) => G.frameOf(o, Y, Z, X);
  const FXL = G.frameOf(O, [-1, 0, 0], Y, [0, 0, -1]);

  const list = [];
  const dyns = {};
  const paint = (col, svg) => (col && svg ? `<g class="pc-${col}">${svg}</g>` : svg);
  const stat = (fn, col) => list.push({ svg: dynOnly ? "" : paint(col, fn()) });
  const dyn = (name, fn, col) => {
    list.push({ dyn: name, col });
    dyns[name] = fn;
  };
  const turned = (F, profile, style = {}, opts = {}) => S(G.solidOf(profile, F, P, opts), { tone: "mid", ...style });
  const seam = (F, s, r, opts = {}) => G.arcOf(F, s, r, P, opts);

  // ---------- geometry (shared numbers) ----------
  const RC = 19; // cone distance of the side gears / spiders
  const gS = Math.atan(C.SIDE_TEETH / C.SPIDER_TEETH); // side-gear pitch half angle (58 deg)
  const gP = Math.PI / 2 - gS; // spider pitch half angle (32 deg)
  const toe = 13;
  const sideToe = [toe * Math.cos(gS), toe * Math.sin(gS)];
  const sideHeel = [RC * Math.cos(gS), RC * Math.sin(gS)];
  const spToe = [toe * Math.cos(gP), toe * Math.sin(gP)];
  const spHeel = [RC * Math.cos(gP), RC * Math.sin(gP)];
  const SP_BACK = spHeel[0] + 2.4;
  const WASH = [SP_BACK, SP_BACK + 1.4];
  const POST_C = 22.6, POST_H = 2.5;
  const POST_X = [-21, 19];
  const BAR_X = [19, 23];
  const PIN_R = 2.6;
  const RING = { back: -27, face: -21, r: 44, toe: [-17.5, 33] };
  const PIN_X = C.PIN_X;
  const pinionProfile = [
    [30.2, 5.2],
    [33, 7],
    [44, 10.5],
    [46.4, 10.5],
    [46.4, 6.4],
    [49, 6.4],
  ];
  const PIN_SHAFT = [49, 100];
  const SHAFT_R = 3.6;
  const HUB_R = 7;

  // ---------- helpers ----------
  const shaftStripe = (F, s0, s1, r, angle, tone = "mid") => {
    const ribs = G.ribsOf(F, s0, s1, r, 1, P, { phase: angle, fade: [0.1, 0.5] });
    return Faded(ribs, { tone });
  };
  const halo = (plan, z) => `<path class="iso-halo" d="${k.haloOf(plan, z, 0.1, P)}"/>`;

  // pillow block on an axis along x (axis "x") or along y (axis "y"), centred at c (the coordinate along the axis)
  function pillow(axis, c, off, rh, w) {
    const plan = (along0, along1, across) =>
      axis === "x" ? { x: c + along0, y: off - across, w: along1 - along0, d: across * 2, r: 1.4 } : { x: off - across, y: c + along0, w: across * 2, d: along1 - along0, r: 1.4 };
    const foot = plan(-w / 2 - 3.5, w / 2 + 3.5, 15);
    const web = plan(-w / 2, w / 2, 8.5);
    const out = [];
    out.push(S(k.slabOf(foot, BASE, 4, P, 4, 0.5), { tone: "mid" }));
    const bolts = axis === "x" ? [[c, off - 11.8], [c, off + 11.8]] : [[off - 11.8, c], [off + 11.8, c]];
    out.push(Ln(bolts.map(([x, y]) => k.ring(x, y, 1.9, BASE + 4, P, 14)).join(""), { tone: "lo" }));
    out.push(Dots(bolts.map(([x, y]) => at([x, y, BASE + 4])), { size: 0.55, tone: "hi" }));
    const webTop = -rh * 0.55;
    out.push(S(k.slabOf(web, BASE + 4, webTop - BASE - 4, P, 3, 0.4), { tone: "mid" }));
    const F = axis === "x" ? FX([0, off, 0]) : FY([off, 0, 0]);
    const housing = G.lathe(
      [
        [c - w / 2, SHAFT_R + 0.6],
        [c - w / 2, rh - 0.8],
        [c - w / 2 + 0.8, rh],
        [c + w / 2 - 0.8, rh],
        [c + w / 2, rh - 0.8],
        [c + w / 2, SHAFT_R + 0.6],
      ],
      F,
      P,
      {},
    );
    out.push(S(housing, { tone: "mid", inner: Ln(seam(F, c, rh), { tone: "faint" }) }));
    // seal lip on the near face
    const nearS = G.dot3(F.a, V) > 0 ? c + w / 2 : c - w / 2;
    out.push(Ln(G.circleOf(F, nearS, SHAFT_R + 2.2, P), { tone: "lo" }));
    out.push(Dots(G.dotsOf(F, nearS, rh - 2.6, 4, P, { phase: Math.PI / 4, all: true }), { size: 0.5, tone: "mid" }));
    // grease nipple on top
    const top = axis === "x" ? [c, off] : [off, c];
    out.push(S(k.cylinder(top[0], top[1], 1.1, rh - 0.4, 2.6, P, 12), { tone: "mid" }));
    out.push(S(k.cylinder(top[0], top[1], 1.6, rh + 2.2, 1.4, P, 14), { tone: "mid" }));
    return paint("steel", out.join(""));
  }

  // tachometer: a box on the plate with a dial face on top, needle driven by wheel rpm
  const TACHO_TOP = BASE + 17;
  const DIAL_R = 10.5;
  const SWEEP = 270 * DEG, FROM = -135 * DEG, FULL = 150;
  function tacho([x, y]) {
    const box = { x: x - 13, y: y - 12, w: 26, d: 24, r: 2.5 };
    const out = [halo(box, BASE + 0.2)];
    const boxs = [];
    boxs.push(S(k.slabOf(box, BASE, 13, P, 6, 0.8), { tone: "mid" }));
    boxs.push(Ln(k.sideSeam(k.insetPlan(box, 0), BASE + 3.2, P, 6), { tone: "faint" }));
    // front screws on the box
    boxs.push(Dots([at([x - 9, y + 12, BASE + 9.5]), at([x + 9, y + 12, BASE + 9.5]), at([x + 13, y - 8, BASE + 9.5]), at([x + 13, y + 8, BASE + 9.5])], { size: 0.45, tone: "mid" }));
    out.push(paint("steel", boxs.join("")));
    const dial = [];
    out.push(paint("steel", S(k.cylinder(x, y, DIAL_R + 1.4, BASE + 13, 4, P, 56, 0.6), { tone: "mid" }) + Ln(k.knurl(x, y, DIAL_R + 1.4, BASE + 13, BASE + 17, 60, P, 0), { tone: "faint" })));
    // cream dial face inlaid in the bezel
    dial.push(`<path d="${k.cylinder(x, y, DIAL_R, TACHO_TOP, 0.01, P, 64).top}" style="fill:#fbf6ea;stroke:none"/>`);
    dial.push(Ln(k.ring(x, y, DIAL_R, TACHO_TOP, P, 64), { tone: "lo" }));
    const ticks = k.radialTicks(x, y, DIAL_R, 15, 5, TACHO_TOP, [1.1, 2], P, FROM, SWEEP);
    dial.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "hi" }));
    // the 100-rpm cruise band, a short arc inside the ticks
    const arc = [];
    for (let i = 0; i <= 12; i++) {
      const a = FROM + ((80 + (i / 12) * 40) / FULL) * SWEEP;
      arc.push([x + Math.sin(a) * (DIAL_R - 3.6), y - Math.cos(a) * (DIAL_R - 3.6)]);
    }
    dial.push(k.fadeLineSvg(arc.map(([px, py]) => at([px, py, TACHO_TOP])), { tone: "mid", fade: [1.2, 1.2] }));
    out.push(paint("cream", dial.join("")));
    return out.join("");
  }
  function needle([x, y], rpm) {
    const a = FROM + Math.max(0, Math.min(1.03, rpm / FULL)) * SWEEP;
    const sx = Math.sin(a), sy = -Math.cos(a);
    const d = k.lineOnTop([x - sx * 2.6, y - sy * 2.6], [x + sx * (DIAL_R - 1.6), y + sy * (DIAL_R - 1.6)], TACHO_TOP + 0.2, P);
    return `<path class="iso-line" data-tone="lit" data-free="" d="${d}" style="stroke-width:1.15"/>` + Dots([at([x, y, TACHO_TOP + 0.3])], { size: 1.1, tone: "hi" });
  }

  // wheel: tyre + disc turned around x, a hub and turning marks
  // tyre: flat sidewalls (caps at s = +-8) and an analytic crown, monotone in s so it shades smoothly
  const TY = { half: 7, flat: 2.6, rim: 20, side: 25, crown: 29.5, p: 2.4 };
  const tyreR = (s) => {
    const u = Math.max(0, (Math.abs(s) - TY.flat) / (TY.half - TY.flat));
    return TY.side + (TY.crown - TY.side) * (1 - Math.pow(u, TY.p));
  };
  const tyreSlope = (s) => {
    const u = Math.max(0, (Math.abs(s) - TY.flat) / (TY.half - TY.flat));
    return -Math.sign(s) * ((TY.crown - TY.side) * TY.p * Math.pow(u, TY.p - 1)) / (TY.half - TY.flat);
  };
  const tyre = (o) => {
    const F = FX(o);
    const prof = [[-TY.half, TY.rim]];
    for (let i = 0; i <= 32; i++) {
      const s = -TY.half + (i / 32) * 2 * TY.half;
      prof.push([s, tyreR(s), 1]);
    }
    prof.push([TY.half, TY.rim]);
    return { F, prof };
  };
  function wheelStatic(side) {
    const o = [side * WHEEL_X, 0, 0];
    const { F, prof } = tyre(o);
    const out = [];
    out.push(paint("tyre", S(G.lathe(prof, F, P, { smooth: { slope: tyreSlope, radius: tyreR, rows: 5 } }), { tone: "hi", crease: "none" })));
    // rim face: a dished steel disc inside the tyre
    out.push(paint("rim", turned(F, [[5.8, 20.1], [6.3, 18.4], [6.3, 14]], { tone: "hi", crease: "faint" }) + Ln(G.circleOf(F, 6.3, 16.8, P), { tone: "lo" }) + Ln(G.circleOf(F, 6.2, 19.2, P), { tone: "faint" })));
    return out.join("");
  }
  function wheelMarks(side, angle) {
    const o = [side * WHEEL_X, 0, 0];
    const F = FX(o);
    const out = [];
    // tread grooves across the crown
    out.push(Faded(G.ribsOf(F, -TY.flat, TY.flat, TY.crown, 44, P, { phase: angle, fade: [0.06, 0.45], seams: true }), { tone: "lo" }));
    // disc windows: 6 short radial slots on the steel disc
    const rim = [];
    for (let i = 0; i < 6; i++) {
      const t = angle + (i / 6) * TAU + TAU / 12;
      const a0 = G.pointOf(F, 6.3, 10.2, t - 0.17), a1 = G.pointOf(F, 6.3, 14.4, t - 0.12);
      const b0 = G.pointOf(F, 6.3, 10.2, t + 0.17), b1 = G.pointOf(F, 6.3, 14.4, t + 0.12);
      rim.push(`<path class="iso-line" data-tone="mid" d="${k.pathOf([a0, a1, b1, b0].map(at), true)}" style="fill:#2c3036"/>`);
    }
    // painted index mark on the sidewall: the part to watch
    const m0 = G.pointOf(F, TY.half, 21.4, angle), m1 = G.pointOf(F, TY.half, 24.3, angle);
    const facing = G.dot3(F.a, V) > 0;
    if (facing) out.push(`<path class="iso-line" data-tone="lit" d="${k.pathOf([at(m0), at(m1)])}" style="stroke-width:2.2" data-free=""/>`);
    // valve stem
    const v0 = G.pointOf(F, 6.3, 18.6, angle + Math.PI);
    rim.push(Dots([at(v0)], { size: 0.9, tone: "hi" }));
    out.push(paint("rim", rim.join("")));
    return out.join("");
  }
  function hub(side, angle) {
    // hub flange on the +x face of each wheel (the inner face of the left wheel, the outer face of the right one)
    const F = FX([side * WHEEL_X, 0, 0]);
    const out = [];
    out.push(turned(F, [[6.3, 8.6], [8.3, 8.6], [9, 7.9]], { tone: "mid" }));
    out.push(Dots(G.dotsOf(F, 9, 5.6, 5, P, { phase: angle, all: true }), { size: 1.05, tone: "hi" }));
    out.push(Ln(G.circleOf(F, 9, 2.8, P), { tone: "lo" }));
    return paint("teal", out.join(""));
  }
  // half shaft pieces between two x stations (shaft along x at y = 0)
  const shaft = (x0, x1) => S(G.disc(x0, x1, SHAFT_R, FX(), P), { tone: "mid", crease: "none" });

  // ======================= painter's order =======================
  // bench plate and feet
  stat(() => {
    const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, BASE - PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    const feet = k.corners(PLATE, 16).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
    for (const [x, y] of feet) {
      out.push(S(k.cylinder(x, y, 7.5, BASE - PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 5.8, BASE - PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(PLATE, BASE - PLATE_H, PLATE_H, P, 8, 1.6), { tone: "hi" }));
    out.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), BASE, P), { tone: "lo" }));
    const screws = k.corners(PLATE, 10);
    out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, BASE, P, 16)).join(""), { tone: "lo" }));
    out.push(Dots(screws.map(([x, y]) => at([x, y, BASE])), { size: 0.55, tone: "hi" }));
    // ruler strip along the front edge (measures the half shafts)
    const strip = { x: -26, y: PLATE.y + PLATE.d - 15, w: 88, d: 7, r: 1 };
    const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y, BASE + 0.6, [2.4, strip.d], P);
    out.push(paint("cream", S(k.slabOf(strip, BASE, 0.6, P, 3), { tone: "mid", crease: "none" }) + Ln(ticks.minor, { tone: "lo", free: "end" }) + Ln(ticks.major, { tone: "mid" }) +
      Dots([at([strip.x + 2, strip.y + 3.5, BASE + 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, BASE + 0.6])], { size: 0.45 })));
    // label plate near the input flange
    const label = { x: 12, y: -26, w: 26, d: 12, r: 1.2 };
    const lab = [S(k.slabOf(label, BASE, 0.8, P, 3, 0.3), { tone: "mid" })];
    for (const [i, len] of [[0, 20], [1, 14], [2, 17]]) lab.push(Ln(k.lineOnTop([label.x + 4, label.y + 4 + i * 3], [label.x + 4 + len, label.y + 4 + i * 3], BASE + 0.8, P), { tone: "lo", free: true }));
    lab.push(Dots([at([label.x + 2, label.y + 2, BASE + 0.8]), at([label.x + label.w - 2, label.y + label.d - 2, BASE + 0.8])], { size: 0.4 }));
    out.push(paint("cream", lab.join("")));
    // halos under the lifted assembly
    out.push(`<path class="iso-halo" d="${k.haloOf({ x: -60, y: -26, w: 120, d: 52, r: 20 }, BASE + 0.1, 0.1, P)}" style="filter:blur(12px);opacity:.08"/>`);
    return out.join("");
  }, "bench");

  // ---- far (left) wheel ----
  stat(() => wheelStatic(-1));
  dyn("wheelL", (s) => wheelMarks(-1, s.L), "tyre");
  dyn("hubL", (s) => hub(-1, s.L));
  // left half shaft, outer pillow block, inner run
  dyn("shaftL0", (s) => shaft(-WHEEL_X + 9, -C.OUT_PED - 6) + shaftStripe(FX(), -WHEEL_X + 9, -C.OUT_PED - 6, SHAFT_R, s.L, "lo"), "teal");
  stat(() => pillow("x", -C.OUT_PED, 0, 9, 12));
  dyn("shaftL1", (s) => shaft(-C.OUT_PED + 6, -C.CAR_PED - 6) + shaftStripe(FX(), -C.OUT_PED + 6, -C.CAR_PED - 6, SHAFT_R, s.L), "teal");
  // left tacho
  stat(() => tacho(C.TACHO[0]));
  dyn("needleL", (s) => needle(C.TACHO[0], s.rpmL), "needleL");
  // left carrier bearing + hub of the carrier
  stat(() => pillow("x", -C.CAR_PED, 0, 11, 10));
  dyn("hubCL", (s) => {
    const F = FX();
    return S(G.disc(-C.CAR_PED + 5, RING.back, HUB_R, F, P), { tone: "mid", crease: "none" }) + shaftStripe(F, -C.CAR_PED + 5, RING.back, HUB_R, s.C, "lo");
  }, "orange");

  // ---- ring gear bolted to the carrier flange ----
  stat(() => {
    const F = FX();
    const out = [];
    // carrier flange (a disc the posts stand on), then the ring gear annulus bolted round it
    out.push(S(G.disc(RING.back + 0.6, RING.face, 28, F, P), { tone: "mid" }));
    out.push(S(G.lathe([[RING.back, 28], [RING.back, RING.r - 1.2], [RING.back + 1.2, RING.r], [RING.face, RING.r], [RING.toe[0], RING.toe[1]], [RING.toe[0], 28]], F, P, {}), { tone: "hi", crease: "faint" }));
    return out.join("");
  }, "orange");
  dyn("ring", (s) => {
    const F = FX();
    const out = [];
    // teeth on the conical face
    const ribs = G.ribsOf(F, RING.face, RING.toe[0], RING.r, C.RING_TEETH, P, { phase: s.C, r1: RING.toe[1], fade: [0.02, 0.3] });
    out.push(Faded(ribs, { tone: "mid" }));
    // tooth ends on the rim (heel)
    out.push(Faded(G.ribsOf(F, RING.face - 2.6, RING.face, RING.r, C.RING_TEETH, P, { phase: s.C, fade: [0.05, 0.4] }), { tone: "lo" }));
    out.push(Ln(seam(F, RING.face - 2.6, RING.r), { tone: "faint" }));
    // ring bolts on the flat inner face
    out.push(Dots(G.dotsOf(F, RING.toe[0], 30.5, 10, P, { phase: s.C, all: true }), { size: 1.0, tone: "hi" }));
    return out.join("");
  }, "orange");

  // ---- carrier interior (all moves with the carrier) ----
  dyn("carrier", (s) => {
    const c = s.C;
    const d = [0, -Math.sin(c), Math.cos(c)];
    const e = G.cross3(d, X); // completes the carrier frame
    const items = [];
    const put = (key, svg) => items.push({ key, svg });
    const vd = G.dot3(d, V);
    // side gears
    const FR = FX();
    const sideR0 = turned(FR, [[sideToe[0], sideToe[1]], [sideHeel[0], sideHeel[1]], [sideHeel[0] + 2.4, sideHeel[1]], [sideHeel[0] + 2.4, HUB_R], [BAR_X[0], HUB_R]], { tone: "hi", crease: "faint" });
    const sideRmarks0 = Faded(G.ribsOf(FR, sideHeel[0], sideHeel[0] + 2.4, sideHeel[1], C.SIDE_TEETH, P, { phase: s.R, fade: [0.05, 0.4], seams: true }), { tone: "lo" });
    const sideL0 = turned(FXL, [[sideToe[0], sideToe[1]], [sideHeel[0], sideHeel[1]], [sideHeel[0] + 2.4, sideHeel[1]], [sideHeel[0] + 2.4, HUB_R], [-RING.face, HUB_R]], { tone: "hi", crease: "faint" });
    const sideLmarks0 = Faded(G.ribsOf(FXL, sideToe[0], sideHeel[0], sideToe[1] - 0.2, C.SIDE_TEETH, P, { phase: -s.L, r1: sideHeel[1] - 0.2, fade: [0.02, 0.3] }), { tone: "mid" });
    const sideL = paint("teal", sideL0 + sideLmarks0), sideLmarks = "", sideR = paint("teal", sideR0 + sideRmarks0), sideRmarks = "";
    // order: far posts, left side gear, things along the pin sorted by depth, right side gear, near posts, cross bar
    const posts = [1, -1].map((sg) => {
      const F = G.frameOf(O, X, G.mul3(d, sg), G.cross3(X, G.mul3(d, sg)));
      const sq = [[POST_C - POST_H, -POST_H], [POST_C + POST_H, -POST_H], [POST_C + POST_H, POST_H], [POST_C - POST_H, POST_H]];
      const bodies = S(G.prismOf(F, sq, POST_X[0], POST_X[1], P), { tone: "mid" });
      const head = G.frameOf(O, G.mul3(d, sg), X, G.cross3(G.mul3(d, sg), X));
      const pinHead = S(G.disc(POST_C + POST_H, POST_C + POST_H + 1.2, 3.3, head, P), { tone: "mid" }) + Dots(G.dotsOf(head, POST_C + POST_H + 1.2, 0, 1, P, { all: true }), { size: 0.6, tone: "hi" });
      return { sg, near: vd * sg > 0, svg: paint("orange", bodies), pinHead: paint("orange", pinHead) };
    });
    const out = [];
    for (const p of posts) if (!p.near) out.push(p.svg, p.pinHead);
    out.push(sideL, sideLmarks);
    // spiders, washers, pin centre: all stacked along d, so their order is their order along d
    const along = [];
    for (const sg of [1, -1]) {
      const a = G.mul3(d, sg);
      const F = G.frameOf(O, a, X, G.cross3(a, X));
      const sp = s.S; // spin of each spider about its own outward axis
      const teeth = Faded(G.ribsOf(F, spToe[0], spHeel[0], spToe[1] - 0.15, C.SPIDER_TEETH, P, { phase: sp, r1: spHeel[1] - 0.15, fade: [0.02, 0.3] }), { tone: "mid" });
      const heel = Faded(G.ribsOf(F, spHeel[0], SP_BACK, spHeel[1], C.SPIDER_TEETH, P, { phase: sp, fade: [0.05, 0.4], seams: "last" }), { tone: "lo" });
      const backFacing = G.dot3(a, V) > 0;
      const index = backFacing ? G.dotsOf(F, SP_BACK, 7.6, 1, P, { phase: sp, all: true }) : [];
      const spSvg = S(G.solidOf([[spToe[0], spToe[1]], [spHeel[0], spHeel[1]], [SP_BACK, spHeel[1]], [SP_BACK, 6.2]], F, P), { tone: "hi", crease: "faint", lit: true }) + teeth + heel + index.map(([ix, iy]) => `<circle cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" r="1.7" style="fill:#ffd23f;stroke:var(--anatomy-hi);stroke-width:.45"/>`).join("");
      along.push({ s: sg * (spToe[0] + SP_BACK) / 2, svg: paint("red", spSvg) });
      along.push({ s: sg * (WASH[0] + WASH[1]) / 2, svg: paint("rim", S(G.disc(WASH[0], WASH[1], 5.6, F, P), { tone: "hi" })) });

    }
    const PF = G.frameOf(O, d, X, e);
    along.push({ s: 0, svg: paint("rim", S(G.disc(-spToe[0] - 0.2, spToe[0] + 0.2, PIN_R, PF, P), { tone: "hi", crease: "none" })) });
    along.sort((a, b) => a.s * vd - b.s * vd);
    for (const it of along) out.push(it.svg);
    out.push(sideR, sideRmarks);
    for (const p of posts) if (p.near) out.push(p.svg, p.pinHead);
    // cross bar closing the cage on the right, with its boss
    const BF = G.frameOf(O, d, X, e);
    const rect = [[BAR_X[0], -3.4], [BAR_X[1], -3.4], [BAR_X[1], 3.4], [BAR_X[0], 3.4]];
    out.push(paint("orange", S(G.prismOf(BF, rect, -POST_C - POST_H, POST_C + POST_H, P), { tone: "hi" }) + S(G.disc(BAR_X[0], BAR_X[1] + 0.6, 9.4, FX(), P), { tone: "hi" }) +
      Dots([G.mul3(d, POST_C), G.mul3(d, -POST_C)].map((p) => at([BAR_X[1], p[1], p[2]])), { size: 0.75, tone: "hi" })));
    void items; void put;
    return out.join("");
  });

  // ---- input: pinion gear, shaft, two pillow blocks, companion flange ----
  dyn("pinion", (s) => {
    const F = FY([PIN_X, 0, 0]);
    const out = [];
    out.push(turned(F, pinionProfile, { tone: "hi", crease: "faint" }));
    out.push(Faded(G.ribsOf(F, 33, 44, 7, C.PINION_TEETH, P, { phase: s.P, r1: 10.5, fade: [0.04, 0.4], seams: true }), { tone: "mid" }));
    out.push(Faded(G.ribsOf(F, 44, 46.4, 10.5, C.PINION_TEETH, P, { phase: s.P, fade: [0.05, 0.4], seams: "first" }), { tone: "lo" }));
    out.push(S(G.disc(PIN_SHAFT[0] - 0.2, C.PIN_PED - 5, SHAFT_R + 0.6, F, P), { tone: "mid", crease: "none" }));
    out.push(shaftStripe(F, PIN_SHAFT[0], C.PIN_PED - 5, SHAFT_R + 0.6, s.P));
    return out.join("");
  }, "gold");
  stat(() => pillow("y", C.PIN_PED, PIN_X, 10, 10));
  dyn("flange", (s) => {
    const F = FY([PIN_X, 0, 0]);
    const out = [];
    const [f0, f1] = C.FLANGE;
    out.push(S(G.disc(C.PIN_PED + 5, f0 - 1.5, SHAFT_R + 0.6, F, P), { tone: "mid", crease: "none" }));
    out.push(shaftStripe(F, C.PIN_PED + 5, f0 - 1.5, SHAFT_R + 0.6, s.P));
    out.push(turned(F, [[f0 - 1.5, 6.5], [f0, 13], [f1 - 2.5, 13], [f1 - 2.5, 8], [f1, 6]], { tone: "mid", crease: "faint" }));
    out.push(Dots(G.dotsOf(F, f1 - 2.5, 10.3, 4, P, { phase: s.P + Math.PI / 4, all: true }), { size: 1.05, tone: "hi" }));
    out.push(Faded(G.ribsOf(F, f0, f1 - 2.5, 13, 1, P, { phase: s.P, fade: [0.1, 0.5] }), { tone: "lit" }));
    out.push(Ln(G.circleOf(F, f1, 3.2, P), { tone: "lo" }));
    return out.join("");
  }, "gold");

  // ---- right side ----
  stat(() => pillow("x", C.CAR_PED, 0, 11, 10));
  dyn("hubCR", (s) => {
    const F = FX();
    return S(G.disc(BAR_X[1] + 0.6, C.CAR_PED - 5, HUB_R, F, P), { tone: "mid", crease: "none" }) + shaftStripe(F, BAR_X[1] + 0.6, C.CAR_PED - 5, HUB_R, s.C, "lo");
  }, "orange");
  dyn("shaftR0", (s) => S(G.disc(C.CAR_PED + 5, C.CAR_PED + 6.4, 5.2, FX(), P), { tone: "mid" }) + shaft(C.CAR_PED + 6.4, C.OUT_PED - 6) + shaftStripe(FX(), C.CAR_PED + 6.4, C.OUT_PED - 6, SHAFT_R, s.R), "teal");
  stat(() => pillow("x", C.OUT_PED, 0, 9, 12));
  stat(() => tacho(C.TACHO[1]));
  dyn("needleR", (s) => needle(C.TACHO[1], s.rpmR), "needleR");
  dyn("shaftR1", (s) => shaft(C.OUT_PED + 6, WHEEL_X - 6) + shaftStripe(FX(), C.OUT_PED + 6, WHEEL_X - 6, SHAFT_R, s.R), "teal");
  stat(() => wheelStatic(1));
  dyn("wheelR", (s) => paint("tyre", wheelMarks(1, s.R)) + hub(1, s.R));

  return { list, dyn: (name, state) => dyns[name](state), names: Object.keys(dyns) };
}
