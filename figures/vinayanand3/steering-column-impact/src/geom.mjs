// Every drawn part of the column test bench, as a pure function of the pose.
//
// The build runs it in Node to draw the page and record each part's true
// shape for the audit; the page runs the same code to redraw the parts that
// tilt, slide or crush. No imports: the kit (k), the lathe module (G), the
// tube module (T), the projection, the model data and, in Node, the audit
// (A) are passed in.
//
// World: x forward, y toward the viewer's side, z up, in units of U per mm.
// The column lies in the plane y = 0, its axis d running from the wheel hub
// forward and down at the spec's 38 degrees; s is distance along d from the
// hub, u is square to d and upward, v is y.

function benchParts(k, G, T, P, D, pose, A) {
  const { U, COLUMN } = D;
  const DEG = Math.PI / 180;
  const a = COLUMN.angleDeg * DEG;
  const d = [Math.cos(a), 0, -Math.sin(a)];
  const up = [Math.sin(a), 0, Math.cos(a)];
  const Y = [0, 1, 0];
  const HUB = [-60, 0, 150];
  const add = (...vs) => vs.reduce((p, q) => G.add3(p, q));
  const st = (s, u = 0, v = 0) => add(HUB, G.mul3(d, s), G.mul3(up, u), G.mul3(Y, v));
  const mm = (x) => x * U;
  const ST = Object.fromEntries(Object.entries(COLUMN.stations).map(([key, value]) => [key, mm(value)]));
  const UJ = mm(COLUMN.hubToUj1Mm);
  const RIM_R = mm(COLUMN.wheelDiameterMm / 2 - COLUMN.rimSectionMm);
  const RIM_T = mm(COLUMN.rimSectionMm);
  const SHAFT = 4;
  const FADE = [0.04, 0.42];

  const slide = mm(pose.slideMm);                    // head and upper jacket, along d

  const out = [];
  const routes = [];
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (dd, style) => k.lineSvg(dd, style);
  const Dots = (list, style) => k.dotsSvg(list, style);
  const rec = (shape) => (A ? [shape] : []);
  // group: what an item slides with along the column, for the painter's order
  let group = "";
  const put = (name, at, svg, shapes = [], extra = {}) => out.push({ name, at, svg, shapes, group, ...extra });
  const last = () => out[out.length - 1];
  const frame = (o, ax, u, v) => G.frameOf(o, ax, u, v);
  const COL = frame(HUB, d, up, Y);
  const along = (shift) => frame(G.add3(HUB, G.mul3(d, shift)), d, up, Y);
  const SLID = along(slide);
  // a prism drawn in the x-z plane and extruded across y, for the wedges and
  // gussets whose faces follow the column's slope
  const FY = frame([0, 0, 0], Y, [1, 0, 0], [0, 0, 1]);
  const xz = (p) => [p[0], p[2]];
  const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const pts = (list) => list.map((p) => k.iso(p, P));
  const bolts = (list, size = 0.45) => Dots(pts(list), { size });
  const ringDots = (F, s, r, n, phase = Math.PI / 4) => Dots(G.dotsOf(F, s, r, n, P, { phase, fade: FADE }), { size: 0.45 });

  // recorded drawing helpers: each draws a part and records the same shape
  const box = (name, plan, z, h, style = {}, extra = "", bevel = 0.5) =>
    put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, 3, bevel), { tone: "mid", ...style }) + extra,
      rec(A?.slab(plan, z, h, { name })));
  const prism = (name, F, poly, s0, s1, style = {}, extra = "", meta = {}) => {
    const c = poly.reduce((p, q) => [p[0] + q[0] / poly.length, p[1] + q[1] / poly.length], [0, 0]);
    put(name, add(F.o, G.mul3(F.a, (s0 + s1) / 2), G.mul3(F.u, c[0]), G.mul3(F.v, c[1])),
      S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style }) + extra, rec(A?.prism(F, poly, s0, s1, { name, ...meta })), meta.dyn ? { dyn: true } : {});
  };
  const turned = (name, F, profile, style = {}, extra = "", meta = {}) =>
    put(name, G.add3(F.o, G.mul3(F.a, (profile[0][0] + profile[profile.length - 1][0]) / 2)), S(G.solidOf(profile, F, P), { tone: "hi", ...style }) + extra,
      rec(A?.solid(F, profile, { name, ...meta })), meta.dyn ? { dyn: true } : {});
  const disc = (name, F, s0, s1, r, style = {}, extra = "", meta = {}) =>
    put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P), { tone: "mid", ...style }) + extra,
      rec(A?.disc(F, s0, s1, r, { name, ...meta })), meta.dyn ? { dyn: true } : {});
  const ring = (name, F, s0, s1, rIn, rOut, style = {}, extra = "", meta = {}) =>
    put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone: "mid", ...style }) + extra,
      rec(A?.ring(F, s0, s1, rIn, rOut, { name, ...meta })), meta.dyn ? { dyn: true } : {});
  const ball = (name, at, r, style = {}, meta = {}) =>
    put(name, at, S(G.sphereOf(at, r, P), { tone: "hi", ...style }), rec(A?.ball(at, r, { name, ...meta })), meta.dyn ? { dyn: true } : {});
  const foot = (name, plan) =>
    box(name, plan, 0, 2, { tone: "lo" }, bolts(k.corners(plan, 2.4).map(([x, y]) => [x, y, 2])), 0.4);
  // a pipe or cable: drawn in depth-sortable chunks, recorded as one route
  const tube = (name, points, r, { tone = "hi", closed = false, owner = name, maxLength = 18, dyn = false } = {}) => {
    routes.push({ name, points, r, closed, owner });
    T.tubePieces(points, r, P, { closed, maxLength }).forEach((part, index) =>
      put(`${name}:${index}`, part.mid, T.tubeSvg(part, { tone }), rec(A?.tube(part.points, part.radii, { name, owner })), { route: name, chunk: index, dyn }));
  };

  // ---- the bench: plate, feet, T-slots, screws, label plate --------------
  const T1 = trackOf(G, D);
  const PLATE = { x: T1.plateX, y: -82, w: 104 - T1.plateX, d: 164, r: 8 };
  const PLATE_H = 12, FOOT_H = 5;
  {
    const parts = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    const byDepth = (list) => [...list].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
    for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
      parts.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
      parts.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
    }
    parts.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
    parts.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
    const screws = k.corners(PLATE, 10);
    parts.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
    parts.push(Dots(pts(screws.map(([x, y]) => [x, y, 0])), { size: 0.5 }));
    // T-slots the stands bolt into
    for (const y of [-34, 34]) parts.push(Ln(k.planOutline({ x: -184, y: y - 2, w: 276, d: 4, r: 2 }, 0, P, 4), { tone: "faint" }));
    // label plate with three rule lines and two rivets
    const LABEL = { x: 22, y: 40, w: 60, d: 12, r: 1.5 };
    parts.push(S(k.slabOf(LABEL, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
    parts.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P), { tone: "faint" }));
    parts.push(Ln([[27, 43.4, 34], [27, 46, 24], [27, 48.6, 30]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
    parts.push(Dots(pts([[LABEL.x + 2.6, LABEL.y + 6, 0.8], [LABEL.x + LABEL.w - 2.6, LABEL.y + 6, 0.8]]), { size: 0.45 }));
    // a steel rule let into the plate's top, millimetres every 4 units
    const RULE = { x: -66, y: 45, w: 82, d: 5, r: 0.6 };
    parts.push(S(k.slabOf(RULE, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(RULE.x + 1, RULE.x + RULE.w - 1, 4, 5, RULE.y + RULE.d, 0.6, [-1.6, -2.8], P);
    parts.push(Ln(ticks.minor, { tone: "lo" }) + Ln(ticks.major, { tone: "mid" }));
    put("stand.plate", [PLATE.x + PLATE.w / 2, 0, -PLATE_H / 2], parts.join(""),
      rec(A?.slab(PLATE, -PLATE_H - FOOT_H, PLATE_H + FOOT_H, { name: "stand.plate" })), { key: -1e6 });
  }

  // ---- the column, as the spec builds it: an upper jacket that telescopes
  // inside a body-fixed lower jacket; the IP bracket clamps the lower one.
  // Telescope slides the upper jacket and head out toward the driver, the
  // crash stroke pushes them in. Radii from the 58 mm jacket, its 51 mm bore
  // and the 50 mm upper jacket.
  const LOWER = 9.3, BORE = 8.2, UPPER = 8.0;
  const PIV_S = ST.tilt_pivot;
  const LJ = [ST.lower_jacket_top, mm(COLUMN.stations.lower_jacket_bottom) - 3.6];
  const CLAMP_S = [ST.ip_bracket - 5.4, ST.ip_bracket + 5.4];  // a 34 mm band
  const CAP_S = [ST.ip_bracket - 4, ST.ip_bracket + 4];
  const BR_S = [CAP_S[0] - 8, CAP_S[1] + 8];
  const PLATE_U = [11, 13.6];
  const CAP_U = [PLATE_U[1], PLATE_U[1] + 4];
  const EAR_S = [PIV_S - 8, PIV_S + 8];
  const SADDLE_S = [PIV_S - 4, PIV_S];
  const POINTER_S = EAR_S[1] - 0.8;
  const SCALE_S = [POINTER_S - mm(COLUMN.telescopeMm) - 2, POINTER_S + mm(COLUMN.strokeMm) + 2];
  const SCALE_U = [12, CAP_U[1] + 1.4];

  // ---- the IP crossbeam: post, beam, the wedge the capsules bolt to -----
  // the wedge starts clear of the rim at full stroke; the scale overhangs it
  const WEDGE_S = [ST.tilt_pivot, CAP_S[1] + 10];
  const W0 = st(WEDGE_S[0], CAP_U[1]), W1 = st(WEDGE_S[1], CAP_U[1]);
  const BEAM_Z = Math.max(W0[2], W1[2]) + 5;
  const BEAM = { x: W0[0] - 0.5, y: -50, w: W1[0] - W0[0] + 4.5, d: 68, r: 2 };
  const POST = { x: BEAM.x + BEAM.w / 2 - 7, y: -50, w: 14, d: 14, r: 1.5 };
  foot("stand.ip-post.foot", k.insetPlan(POST, -4));
  box("stand.ip-post", POST, 2, BEAM_Z - 2, {}, "", 0.5);
  {
    const top = BEAM_Z + 10;
    const xs = [BEAM.x + 5, BEAM.x + BEAM.w - 5];
    const rule = Ln(k.planOutline(k.insetPlan(BEAM, 3), top, P, 3), { tone: "faint" });
    box("stand.ip-beam", BEAM, BEAM_Z, 10, {}, rule + bolts([...xs.map((x) => [x, BEAM.y + 7, top]), ...xs.map((x) => [x, -4, top]), ...xs.map((x) => [x, 4, top])]), 0.8);
  }
  prism("stand.ip-wedge", FY, [xz(W0), xz(W1), [W1[0], BEAM_Z], [W0[0], BEAM_Z]], -16, 16, { tone: "mid" });
  // two shear capsules riveted to the wedge hold the bracket's slotted plate
  for (const v of [-10, 10]) {
    const rivets = [CAP_S[0] + 2, CAP_S[1] - 2].map((s) => st(s, CAP_U[1], v));
    prism(`stand.capsule${v < 0 ? "R" : "L"}`, COL, rect(CAP_U[0], CAP_U[1], v - 3.5, v + 3.5), CAP_S[0], CAP_S[1], { tone: "hi" });
    last().svg += bolts(rivets, 0.5);
  }
  // the IP bracket: a band clamped round the lower jacket and a plate up to the capsules
  ring("stand.ip-clamp", COL, CLAMP_S[0], CLAMP_S[1], LOWER, PLATE_U[0], { tone: "mid" });
  {
    const slot = (v) => {
      const list = [];
      const s0 = CAP_S[0] - 0.6, s1 = CAP_S[1] + 4;
      for (let i = 0; i <= 12; i++) { const t = Math.PI / 2 + (Math.PI * i) / 12; list.push(st(s0 + 3.5 + Math.cos(t) * 3.5, PLATE_U[1], v + Math.sin(t) * 3.5)); }
      for (let i = 0; i <= 12; i++) { const t = -Math.PI / 2 + (Math.PI * i) / 12; list.push(st(s1 - 3.5 + Math.cos(t) * 3.5, PLATE_U[1], v + Math.sin(t) * 3.5)); }
      list.push(list[0]);
      return "M" + pts(list).map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L");
    };
    prism("stand.ip-plate", COL, rect(PLATE_U[0], PLATE_U[1], -15, 15), BR_S[0], BR_S[1], { tone: "mid" }, Ln(slot(-10) + slot(10), { tone: "faint" }));
  }
  // the travel scale on the wedge's near face: telescope out to the left of
  // zero, crash stroke to the right, both in 10 mm
  {
    const face = 16.8;
    const ticks = [];
    for (let m = -Math.floor(COLUMN.telescopeMm / 10) * 10; m <= COLUMN.strokeMm; m += 10) {
      if (!m) continue;
      const s = POINTER_S + mm(m);
      ticks.push(k.segment(st(s, SCALE_U[0] + 1, face), st(s, SCALE_U[0] + (m % 20 === 0 ? 4 : 2.8), face), P));
    }
    // an engraved baseline the ticks stand on, edge to edge
    ticks.push(k.segment(st(SCALE_S[0], SCALE_U[0] + 1, face), st(SCALE_S[1], SCALE_U[0] + 1, face), P));
    const zero = k.segment(st(POINTER_S, SCALE_U[0] + 1, face), st(POINTER_S, SCALE_U[0] + 5.4, face), P);
    prism("stand.travel-scale", COL, rect(SCALE_U[0], SCALE_U[1], 16, face), SCALE_S[0], SCALE_S[1], { tone: "lo" },
      Ln(ticks.join(""), { tone: "mid" }) + Ln(zero, { tone: "hi" }) + bolts([st(SCALE_S[0] + 1.2, SCALE_U[1] - 1.2, face), st(SCALE_S[1] - 1.2, SCALE_U[1] - 1.2, face)], 0.4));
  }

  // the lower jacket, open at the top where the upper one enters, in two
  // lengths either side of the clamp band
  ring("col.lower-jacket-top", COL, LJ[0], CLAMP_S[0], BORE, LOWER, { tone: "mid" }, "", { owner: "column" });
  ring("col.lower-jacket", COL, CLAMP_S[1], LJ[1], BORE, LOWER, { tone: "mid" }, Ln(G.arcOf(COL, (CLAMP_S[1] + LJ[1]) / 2, LOWER, P), { tone: "faint" }), { owner: "column" });

  // ---- the lower column: flange, bulkhead stand, shaft, U-joint, stub ---
  const FL_S = mm(COLUMN.stations.lower_jacket_bottom) - 1.6;
  disc("col.lower-flange", COL, FL_S - 2, FL_S, 12.5, { tone: "mid" }, ringDots(COL, FL_S - 2, 10.4, 4), { owner: "column" });
  const b1 = COLUMN.beta1Deg * DEG;
  const dStub = [Math.cos(a + b1), 0, -Math.sin(a + b1)];
  const upStub = [Math.sin(a + b1), 0, Math.cos(a + b1)];
  const UJP = st(UJ);
  const STUB = frame(UJP, dStub, upStub, Y);
  const STUB_LEN = 40;
  const g1 = st(FL_S, -9), g2 = st(FL_S, -12.5);
  const f0 = G.add3(UJP, G.mul3(dStub, STUB_LEN + 4));
  const p1 = G.add3(f0, G.mul3(upStub, 9)), p2 = G.add3(f0, G.mul3(upStub, -9));
  // the stand under the lower column sits on one sub-plate
  const SUB = { x: g2[0] - 4, y: -14, w: p1[0] - g2[0] + 8, d: 28, r: 1.5 };
  box("stand.sub-plate", SUB, 0, 2.4, { tone: "lo" }, bolts(k.corners(SUB, 2.2).map(([x, y]) => [x, y, 2.4])), 0.4);
  // gusset: its slanted edge lies flat on the flange's back face
  prism("stand.gusset", FY, [xz(g1), xz(g2), [g2[0], 2.4], [g1[0] + 22, 2.4]], -9, 9, { tone: "mid" });
  turned("col.lower-shaft", COL, [[FL_S, SHAFT], [UJ - 9, SHAFT]], { tone: "mid" }, "", { owner: "column" });
  // the first U-joint: two forks, a cross, four bearing caps, then the stub
  // of the intermediate shaft, beta1 further down
  disc("col.uj-hub-in", COL, UJ - 9, UJ - 5, 5.4, { tone: "mid" }, "", { owner: "column" });
  for (const side of [-1, 1]) prism(`col.uj-fork-in${side < 0 ? "B" : "T"}`, COL, rect(side < 0 ? -5.4 : 3.6, side < 0 ? -3.6 : 5.4, -2.6, 2.6), UJ - 5, UJ + 1.6, { tone: "mid" }, "", { owner: "column" });
  disc("col.uj-hub-out", STUB, 5, 9, 5.4, { tone: "mid" }, "", { owner: "column" });
  for (const side of [-1, 1]) prism(`col.uj-fork-out${side < 0 ? "R" : "L"}`, STUB, rect(-2.6, 2.6, side < 0 ? -5.4 : 3.6, side < 0 ? -3.6 : 5.4), -1.6, 5, { tone: "mid" }, "", { owner: "column" });
  ball("col.uj-cross", UJP, 3.1, { tone: "hi" }, { owner: "column" });
  for (const [axis, toward, tag] of [[up, d, "T"], [G.mul3(up, -1), d, "B"], [Y, dStub, "L"], [G.mul3(Y, -1), dStub, "R"]]) {
    const CF = frame(UJP, axis, toward, G.cross3(axis, toward));
    disc(`col.uj-trunnion${tag}`, CF, 3.1, 3.6, 1.1, { tone: "mid" }, "", { owner: "column" });
    disc(`col.uj-cap${tag}`, CF, 5.4, 6.4, 1.8, { tone: "hi" }, "", { owner: "column" });
  }
  turned("col.stub", STUB, [[9, SHAFT], [STUB_LEN, SHAFT]], { tone: "mid" }, "", { owner: "column" });
  disc("col.stub-bearing", STUB, STUB_LEN, STUB_LEN + 4, 8, { tone: "mid" }, ringDots(STUB, STUB_LEN, 6.4, 4), { owner: "column" });
  prism("stand.bearing-block", FY, [xz(p2), [p2[0], 2.4], [p1[0], 2.4], xz(p1)], -9, 9, { tone: "mid" });

  // ---- the moving column: upper jacket, tilt bracket, EA bellows -------
  group = "column";
  // the upper jacket runs from the tilt bracket down inside the lower jacket;
  // only its top shows, between the saddles
  {
    const shown = [[SADDLE_S[0], UPPER], [SADDLE_S[1], UPPER]];
    put("col.upper-jacket", st(SADDLE_S[0] + slide + 2), S(G.solidOf(shown, SLID, P), { tone: "hi" }), rec(A?.solid(SLID, shown, { name: "col.upper-jacket", owner: "column" })), { dyn: true });
  }
  // the tilt bracket: two saddles on the jacket's top and the ears they carry,
  // standing outside the lower jacket so they straddle it at full stroke
  for (const v of [-1, 1]) {
    prism(`col.saddle${v < 0 ? "R" : "L"}`, SLID, rect(-3, 3, v < 0 ? -9.6 : UPPER, v < 0 ? -UPPER : 9.6), SADDLE_S[0], SADDLE_S[1], { tone: "mid" }, "", { owner: "column", dyn: true });
  }
  prism("col.earL", SLID, rect(-6, 6, 9.6, 11.6), EAR_S[0], EAR_S[1], { tone: "mid" }, "", { owner: "column", dyn: true });
  {
    // the far ear passes behind the lower jacket's mouth near full stroke, so
    // it is cut there: the part past the mouth is drawn behind the jacket
    const mouth = Math.max(EAR_S[0], Math.min(EAR_S[1], LJ[0] - slide));
    const far = rect(-6, 6, -11.6, -9.6);
    prism("col.earR", SLID, far, EAR_S[0], mouth, { tone: "mid" }, "", { owner: "column", dyn: true });
    if (EAR_S[1] - mouth > 0.05) prism("col.earR-in", SLID, far, mouth, EAR_S[1], { tone: "mid" }, "", { owner: "column", dyn: true });
  }
  // the pointer: an arm off the near ear and a needle over the travel scale
  prism("col.pointer-arm", SLID, rect(4.4, 6, 11.6, 17.8), POINTER_S - 0.8, POINTER_S + 0.8, { tone: "mid" }, "", { owner: "column", dyn: true });
  prism("col.pointer", SLID, rect(6, SCALE_U[0] + 1.6, 17, 17.8), POINTER_S - 0.4, POINTER_S + 0.4, { tone: "hi" }, "", { owner: "column", dyn: true });
  group = "";
  // the EA bellows: a convoluted sleeve from the saddles to the lower jacket's
  // mouth. Telescoping stretches it, the crash stroke folds it flat. The part
  // to watch.
  {
    const s0 = SADDLE_S[1] + slide, s1 = LJ[0];
    if (s1 - s0 >= 0.4) {
      const n = Math.max(1, Math.round((s1 - s0) / 3.2));
      const outer = [];
      for (let i = 0; i <= n * 2; i++) outer.push([s0 + ((s1 - s0) * i) / (n * 2), i % 2 ? 9.4 : 8.6]);
      const meridian = [[s0, 8.3], ...outer, [s1, 8.3]];
      put("col.bellows", st((s0 + s1) / 2), S(G.lathe(meridian, COL, P), { tone: "hi", lit: true }), rec(A?.lathe(COL, meridian, { name: "col.bellows", owner: "column" })), { dyn: true, group: "bellows" });
    }
  }

  // ---- the tilt head and the wheel: tilt about the pivot, then slide ----
  group = "column";
  const pivot = st(PIV_S + slide);
  const tilt = pose.tilt * DEG;
  // tilting up lifts the wheel: turn the column frame about +y at the pivot
  const rot = (vec) => [vec[0] * Math.cos(tilt) + vec[2] * Math.sin(tilt), vec[1], -vec[0] * Math.sin(tilt) + vec[2] * Math.cos(tilt)];
  const hd = rot(d), hu = rot(up);
  const HEAD = frame(G.sub3(pivot, G.mul3(hd, PIV_S)), hd, hu, Y);
  const hs = (s, u = 0, v = 0) => add(HEAD.o, G.mul3(hd, s), G.mul3(hu, u), G.mul3(Y, v));
  const HEAD_V = 9.6;                                  // the head bears on both ears
  {
    // the detent sector and the pivot bolt on the near ear
    const PV = frame(pivot, Y, d, up);
    const R0 = 7.4;
    const sector = [[0, 0]];
    for (let i = 0; i <= 10; i++) { const t = Math.PI * 0.62 + (Math.PI * 0.5 * i) / 10; sector.push([Math.cos(t) * R0, Math.sin(t) * R0]); }
    const notches = [];
    for (let i = 0; i < COLUMN.tiltDetents; i++) {
      const t = Math.PI * 0.72 + (Math.PI * 0.3 * i) / (COLUMN.tiltDetents - 1);
      notches.push(k.segment(add(pivot, G.mul3(Y, 12.6), G.mul3(d, Math.cos(t) * R0), G.mul3(up, Math.sin(t) * R0)),
        add(pivot, G.mul3(Y, 12.6), G.mul3(d, Math.cos(t) * (R0 - 2)), G.mul3(up, Math.sin(t) * (R0 - 2))), P));
    }
    prism("col.detent-sector", PV, sector, 11.6, 12.6, { tone: "mid" }, Ln(notches.join(""), { tone: "lo" }), { owner: "column", dyn: true });
    disc("col.pivot-bolt", PV, 12.6, 14, 2.4, { tone: "hi" }, "", { owner: "column", dyn: true });
  }
  // the head casting, the release lever, the two stalks
  prism("col.head", HEAD, [[-9, -HEAD_V + 1.2], [-7.8, -HEAD_V], [7.8, -HEAD_V], [9, -HEAD_V + 1.2], [9, HEAD_V - 1.2], [7.8, HEAD_V], [-7.8, HEAD_V], [-9, HEAD_V - 1.2]],
    ST.head_top - 1.5, SADDLE_S[0] - 1.2, { tone: "mid" }, "", { owner: "column", dyn: true });
  {
    const lever0 = hs(30, -5.5, HEAD_V);
    const ldir = G.unit3(G.add3(G.mul3(hu, -0.7), G.mul3(hd, -0.71)));
    const LV = frame(lever0, ldir, G.cross3(Y, ldir), Y);
    prism("col.lever", LV, rect(-1.2, 1.2, 0, 1.8), 0, 18, { tone: "mid" }, "", { owner: "column", dyn: true });
    ball("col.lever-knob", add(lever0, G.mul3(ldir, 20.4), G.mul3(Y, 0.9)), 2.6, { tone: "hi" }, { owner: "column", dyn: true });
    for (const [side, tag] of [[1, "L"], [-1, "R"]]) {
      const o = hs(20, 3, side * HEAD_V);
      const sd = G.unit3(add(G.mul3(Y, side), G.mul3(hd, -0.32), G.mul3(hu, 0.12)));
      const SF = frame(o, sd, hu, G.cross3(sd, hu));
      turned(`col.stalk${tag}`, SF, [[0, 1.5], [3, 1.5], [3.8, 1], [15, 1], [16, 1.7, 1], [20, 1.7, 1], [21.4, 0.4]], { tone: "hi" }, "", { owner: "column", dyn: true });
    }
  }
  // the load cell between the column and the wheel (J944 5.5), with its
  // connector; then the airbag cover, spokes and rim
  // (a 3-axis cell 4.5 in across, as TP-203-02 describes), behind the hub
  const LC = 4.5 * 25.4 / 2 * U;
  disc("col.hub", HEAD, 0, 2, 7.5, { tone: "mid" }, "", { owner: "column", dyn: true });
  disc("col.load-cell", HEAD, 2, ST.head_top - 1.5, LC, { tone: "hi" },
    Dots(G.dotsOf(HEAD, 2.2, LC - 2.2, 8, P, { fade: FADE }), { size: 0.45 }) + Ln(G.arcOf(HEAD, (ST.head_top + 0.5) / 2, LC, P), { tone: "faint" }), { owner: "column", dyn: true });
  disc("col.load-cell-plug", frame(hs(6.6, 0, LC - 0.2), Y, hd, hu), 0, 2.6, 1.8, { tone: "mid" }, "", { owner: "column", dyn: true });
  turned("col.airbag", HEAD, AIRBAG.map(([sa, ra], i) => (i && i < AIRBAG.length - 3 ? [sa, ra, 1] : [sa, ra])), { tone: "hi" },
    Ln(G.circleOf(frame(hs(-12), G.mul3(hd, -1), hu, G.mul3(Y, -1)), 0, 6.2, P, 40), { tone: "faint" }), { owner: "column", dyn: true });
  for (const [tag, ang] of [["L", Math.PI / 2], ["R", -Math.PI / 2], ["B", Math.PI]]) {
    const rad = G.add3(G.mul3(hu, Math.cos(ang)), G.mul3(Y, Math.sin(ang)));
    const SP = frame(hs(0), rad, hd, G.cross3(rad, hd));
    prism(`col.spoke${tag}`, SP, rect(-2, 2, -3.4, 3.4), 16.4, RIM_R - RIM_T - 0.2, { tone: "mid" }, "", { owner: "column", dyn: true });
  }
  {
    const loop = [];
    for (let i = 0; i < 48; i++) {
      const t = ((i + 0.5) / 48) * Math.PI * 2 + Math.PI / 4;
      loop.push(add(hs(0), G.mul3(hu, Math.cos(t) * RIM_R), G.mul3(Y, Math.sin(t) * RIM_R)));
    }
    tube("col.rim", loop, RIM_T, { tone: "hi", closed: true, owner: "column", maxLength: 16, dyn: true });
  }

  // ---- the impactor, to SAE J944: a torso-shaped body block launched
  // along a track and released into level free flight at the wheel ---------
  const T0 = trackOf(G, D);                            // where the block starts, flies and meets the wheel
  const bx = T0.rest + (pose.block ?? 0);              // the block's back face, x
  const cx = T0.rest + (pose.carriage ?? 0);           // the same point on the carriage
  const BU = (X) => X * U;                             // block millimetres to world units
  const bz = (Z) => T0.refZ + (Z - REF_MM) * U;        // block height (mm above its base) to world z
  const XZ = (X, Z) => [bx + BU(X), bz(Z)];
  group = "block";
  {
    // the plywood backboard, cut to J944 Fig. 3's outline, standing on the
    // base's back edge: a frame whose u is y and v is z, extruded forward
    const BF = frame([bx, 0, bz(0)], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const outline = [...OUTLINE.map(([Z, hw]) => [BU(hw), BU(Z)]), ...OUTLINE.slice().reverse().map(([Z, hw]) => [-BU(hw), BU(Z)])];
    prism("block.backboard", BF, outline, 0, BU(PLY), { tone: "mid" },
      bolts([[bx, BU(120), bz(300)], [bx, -BU(120), bz(300)], [bx, 0, bz(820)]].map(([x, y, z]) => [x + BU(PLY), y, z]), 0.45), { owner: "block", dyn: true });
    // the 2x6 base in front of it, its front corners rounded (Fig. 3)
    box("block.base", { x: bx + BU(PLY), y: -BU(152.4), w: BU(99), d: BU(304.8), r: BU(30) }, bz(0), BU(BASE_MM), { tone: "mid" }, "", 0.4);
    last().dyn = true;
    for (const shape of last().shapes) shape.owner = "block";
    // the rubber torso in its leather vest, 12 in wide, and the 4 in head
    // insert with its face, both to Fig. 4's side profile. Filament-tape
    // bands bind them to the backboard, and the reference line is marked 4 in
    // above the base, 33.0 in below the top of the head
    // the kit fills a prism by its convex hull, so each concave profile is
    // drawn as a stack of convex runs that meet flush
    const bandLines = (half, list) => list.map(([Z]) => k.segment([bx + BU(PLY), half, bz(Z)], [bx + BU(frontAt(Z)), half, bz(Z)], P)).join("");
    const TW = BU(152.4), HW = BU(50.8);
    const stack = (name, z0, z1, half) => {
      const runs = convexRuns(z0, z1);
      runs.forEach((run, i) => {
        const [r0, r1] = [run[0][0], run[run.length - 1][0]];
        const poly = [XZ(PLY, r0), ...run.map(([Z, X]) => XZ(X, Z)), XZ(PLY, r1)];
        // the joins with the runs below and above draw no edge
        const seam = poly.map((_, j) => (i > 0 && (j === 0 || j === 1) ? 1 : i < runs.length - 1 && (j === poly.length - 1 || j === poly.length - 2) ? 2 : 0));
        const inside = (Z) => Z > r0 && Z <= r1;
        const tape = TAPE.filter(([Z]) => inside(Z));
        const c = poly.reduce((acc, q) => [acc[0] + q[0] / poly.length, acc[1] + q[1] / poly.length], [0, 0]);
        put(`${name}${i}`, [c[0], 0, c[1]], S(seamlessPrism(k, G, FY, poly, seam, -half, half, P), { tone: "hi" }) +
          Ln(bandLines(half, tape), { tone: "lo" }) + (inside(REF_MM) ? Ln(bandLines(half, [[REF_MM]]), { tone: "mid" }) : ""),
          rec(A?.prism(FY, poly, -half, half, { name: `${name}${i}`, owner: "block" })), { dyn: true });
      });
    };
    stack("block.torso", BASE_MM, NECK_MM, TW);
    stack("block.head", NECK_MM, TOP_MM, HW);
  }
  // the accelerator, as NHTSA's TP-203-02 draws it: a pneumatic cylinder on a
  // frame behind the column, its piston tube holding the block by a hub on
  // the block's back at its centre of gravity until it separates
  const ZC = T0.cg;                                    // the hub's height, world z
  const XF = (x0) => frame([x0, 0, ZC], [1, 0, 0], [0, 0, 1], [0, 1, 0]);
  const AX = XF(0);
  {
    group = "block";
    // the hub, a triaxial accelerometer above it, and the two eye hooks for
    // the catch cable on the top of the backboard (TP-203-02)
    disc("block.hub", AX, bx - 9, bx, 4.4, { tone: "mid" }, ringDots(AX, bx - 9, 3.2, 4), { owner: "block", dyn: true });
    box("block.accelerometer", { x: bx - 4.5, y: -4.5, w: 4.5, d: 9, r: 0.6 }, ZC + 7, 7, { tone: "hi" }, Dots(pts([[bx - 4.5, 0, ZC + 10.5]]), { size: 0.5 }), 0.3);
    last().dyn = true;
    for (const y of [-14, 14]) {
      const HF = frame([bx, y, T0.top - BU(40)], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
      ring(`block.eye${y < 0 ? "R" : "L"}`, HF, 0, 1.2, 1.4, 3, { tone: "mid" }, "", { owner: "block", dyn: true });
    }
    // the 1 in velocity wand off the torso's near side, at the chest
    box("block.wand", { x: bx + BU(60), y: BU(152.4), w: BU(25.4), d: T0.wandOut, r: 0.3 }, T0.wandZ - 1, 2, { tone: "lo" }, "", 0.2);
    last().dyn = true;
    for (const shape of last().shapes) shape.owner = "block";
  }
  group = "";
  const gland = T0.rest - 9 - 6, B1 = gland - 3, B0 = B1 - 70;
  {
    // the frame: two posts on feet and a crossbeam, the accelerator on it
    const FX = (B0 + B1) / 2;
    const BEAMZ = ZC - 10 - 3 - 6;
    for (const y of [-70, 70]) {
      foot(`stand.frame-foot${y < 0 ? "R" : "L"}`, { x: FX - 13, y: y - 9, w: 26, d: 18, r: 1.2 });
      box(`stand.frame-post${y < 0 ? "R" : "L"}`, { x: FX - 6, y: y - 6, w: 12, d: 12, r: 1 }, 2, ZC + 34 - 2, { tone: "mid" },
        bolts([[FX - 3, y, ZC + 34], [FX + 3, y, ZC + 34]], 0.45), 0.6);
    }
    box("stand.frame-beam", { x: FX - 8, y: -64, w: 16, d: 128, r: 1 }, BEAMZ, 6, { tone: "mid" },
      Ln(k.planOutline(k.insetPlan({ x: FX - 8, y: -64, w: 16, d: 128, r: 1 }, 2), BEAMZ + 6, P, 3), { tone: "faint" }), 0.6);
    // the lead-screw nuts that set its height, either side
    for (const y of [-58, 58]) box(`stand.frame-nut${y < 0 ? "R" : "L"}`, { x: FX - 5, y: y - 3, w: 10, d: 6, r: 0.6 }, BEAMZ - 4, 4, { tone: "lo" }, "", 0.3);
    // two saddles carry the cylinder
    for (const [i, x] of [B0 + 14, B1 - 14].entries()) box(`stand.acc-saddle${i}`, { x: x - 3, y: -8, w: 6, d: 16, r: 0.6 }, BEAMZ + 6, ZC - 8 - BEAMZ - 6, { tone: "lo" }, "", 0.3);
    turned("stand.accelerator", AX, [[B0 + 3, 8], [B1 - 3, 8]], { tone: "hi" }, Ln(G.arcOf(AX, (B0 + B1) / 2, 8, P), { tone: "faint" }), { owner: "accelerator" });
    const rods = [45, 135, 225, 315].map((deg) => [Math.cos(deg * DEG) * 8.9, Math.sin(deg * DEG) * 8.9]);
    const LB = frame([B0, 0, ZC], [-1, 0, 0], [0, 0, 1], [0, -1, 0]);
    disc("stand.acc-rear", AX, B0, B0 + 3, 9.8, { tone: "mid" }, Ln(G.circleOf(LB, 0, 5.4, P, 32), { tone: "lo" }) + Dots(pts(rods.map(([u, v]) => [B0, v, ZC + u])), { size: 0.5 }), { owner: "accelerator" });
    disc("stand.acc-front", AX, B1 - 3, B1, 9.8, { tone: "mid" }, "", { owner: "accelerator" });
    for (const [i, [u, v]] of rods.entries()) disc(`stand.acc-rod${i}`, frame([0, v, ZC + u], [1, 0, 0], [0, 0, 1], [0, 1, 0]), B0 + 3, B1 - 3, 0.5, { tone: "mid" }, "", { owner: "accelerator" });
    disc("stand.acc-gland", AX, B1, gland, 4, { tone: "mid" }, "", { owner: "accelerator" });
    // the first speed sensor, at the gland: the tube's speed just before separation
    box("stand.acc-sensor", { x: B1 - 2, y: 9.8, w: 4, d: 3.4, r: 0.4 }, ZC - 2, 4, { tone: "hi" }, Dots(pts([[B1, 13.2, ZC]]), { size: 0.5 }), 0.3);
    // the receiver that charges it, on the floor by the near post, and its hose
    const TF = frame([0, 58, 14], [1, 0, 0], [0, 0, 1], [0, 1, 0]);
    const T1 = B0 - 10, Tz = T1 - 56;
    for (const [i, x] of [Tz + 12, T1 - 12].entries()) box(`stand.receiver-saddle${i}`, { x: x - 3, y: 49, w: 6, d: 18, r: 0.6 }, 0, 4, { tone: "lo" }, "", 0.3);
    const dome = (from, sign) => Array.from({ length: 6 }, (_, i) => { const t = (i / 5) * (Math.PI / 2); return [from + sign * 5 * Math.cos(t), 10 * Math.sin(t) || 1.2, i > 0 && i < 5 ? 1 : 0]; });
    turned("stand.receiver", TF, [...dome(Tz + 5, -1), [T1 - 5, 10], ...dome(T1 - 5, 1).reverse()].sort((p, q) => p[0] - q[0]), { tone: "hi" },
      Ln(G.arcOf(TF, Tz + 16, 10, P) + G.arcOf(TF, T1 - 16, 10, P), { tone: "faint" }), { owner: "receiver" });
    const GX = (Tz + T1) / 2;
    const UPF = (x, y, z) => frame([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    disc("stand.receiver-stem", UPF(GX, 58, 24), -0.2, 2.2, 1, { tone: "mid" });
    {
      const GC = [GX, 58, 31];
      const GF = frame(GC, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      const ticks = [];
      for (let i = 0; i <= 10; i++) {
        const t = Math.PI * 1.25 - (Math.PI * 1.5 * i) / 10;
        const r1 = i % 5 === 0 ? 2.4 : 3;
        ticks.push(k.segment(add(GC, [Math.cos(t) * 4.2, 1.6, Math.sin(t) * 4.2]), add(GC, [Math.cos(t) * r1, 1.6, Math.sin(t) * r1]), P));
      }
      const needle = k.segment(add(GC, [0, 1.6, 0]), add(GC, [Math.cos(Math.PI * 0.4) * 3.4, 1.6, Math.sin(Math.PI * 0.4) * 3.4]), P);
      disc("stand.receiver-gauge", GF, -1.6, 1.6, 4.8, { tone: "hi" },
        Ln(G.circleOf(GF, 1.6, 4.4, P, 40), { tone: "lo" }) + Ln(ticks.join(""), { tone: "mid" }) + Ln(needle, { tone: "hi" }) + Dots(pts([add(GC, [0, 1.6, 0])]), { size: 0.55 }));
    }
    const PX = T1 - 8;
    disc("stand.receiver-port", UPF(PX, 58, 23.6), 0, 2.4, 1.6, { tone: "mid" }, "", { owner: "receiver" });
    // the accelerator is fed through its rear cap, on the axis
    disc("stand.acc-port", LB, -0.2, 2.8, 2, { tone: "mid" }, "", { owner: "accelerator" });
    tube("stand.air-hose", G.fillet([[PX, 58, 26], [PX, 58, 32], [PX, 0, 32], [PX, 0, ZC], [B0 - 2.8, 0, ZC]], 5), 1.1, { tone: "mid", maxLength: 20 });
    // the second speed sensor: a laser fork on a post that the wand passes
    // through within 3 in of the wheel (TP-203-02)
    const GXW = T0.gate, WZ = T0.wandZ, WY = BU(152.4) + T0.wandOut;
    foot("stand.gate-foot", { x: GXW - 5, y: WY + 1, w: 10, d: 10, r: 0.8 });
    box("stand.gate-post", { x: GXW - 1.8, y: WY + 4.2, w: 3.6, d: 3.6, r: 0.4 }, 2, WZ + 6 - 2, { tone: "mid" }, "", 0.3);
    for (const [tag, z0] of [["upper", WZ + 2.4], ["lower", WZ - 5.4]]) box(`stand.gate-${tag}`, { x: GXW - 2.4, y: WY - 6, w: 4.8, d: 10.2, r: 0.5 }, z0, 3, { tone: "hi" }, tag === "upper" ? Dots(pts([[GXW, WY - 3, z0]]), { size: 0.5 }) : "", 0.3);
  }
  group = "carriage";
  // the piston tube runs out with the block, and stops where it lets go
  put("carriage.tube", [(gland + T0.rest - 9 + (pose.carriage ?? 0)) / 2, 0, ZC], S(G.disc(gland, cx - 9, 2.8, AX, P), { tone: "hi" }),
    rec(A?.slide(AX, gland, cx - 9, 2.8, { name: "carriage.tube", owner: "accelerator" })), { dyn: true });
  group = "";

  return { items: out, routes, HUB, d, track: T0 };
}

// The body block, read off SAE J944's figures, in millimetres: Z up from the
// bottom of the base, X forward from the back of the plywood.
//  - 37.0 in tall overall (Fig. 3); its reference line 33.0 in below the top
//    of the head, so 4.0 in above the base (Fig. 4);
//  - a 2x6 base 12.0 in wide, 3.9 in deep and 1.6 in tall, with rounded
//    front corners, in front of a 3/4 in plywood backboard (Fig. 3);
//  - the backboard cut to a body outline 15 in wide at the hips, 11.8 in at
//    the waist, 18.2 in at the shoulders and 6.5 in at the head (Fig. 3);
//  - a rubber torso 12.0 in wide and a head insert 4.0 in wide (Fig. 2), in
//    a leather vest, to the side profile of Fig. 4: about 6.5 in deep at the
//    chest, with a face; bound on with 1 in and 4 in filament tape.
const IN_MM = 25.4;
const TOP_MM = 37.0 * IN_MM, REF_MM = 4.0 * IN_MM, BASE_MM = 1.6 * IN_MM, PLY = 0.75 * IN_MM;
const NECK_MM = 25.1 * IN_MM;                          // where the 4 in head insert starts (Fig. 2: 11.9 in below the top)
// the front of the profile, [Z, X] in inches, from Fig. 4
const SIDE = [
  [1.6, 6.3], [4.0, 6.4], [4.6, 5.9], [5.2, 5.8], [7.3, 5.7], [10.1, 5.8], [13.0, 6.0], [15.8, 6.3], [18.7, 6.5],
  [21.5, 6.3], [23.6, 5.7], [24.9, 5.3], [26.6, 4.4], [28.0, 4.1], [28.7, 4.3], [29.1, 5.3], [29.7, 5.7], [30.3, 5.7],
  [31.0, 5.8], [31.6, 5.6], [32.4, 6.1], [33.2, 5.4], [34.3, 4.7], [35.7, 3.8], [36.6, 2.6], [37.0, 1.2],
].map(([Z, X]) => [Z * IN_MM, X * IN_MM]);
// the backboard's half-width up its height, [Z, half] in inches, from Fig. 3
const OUTLINE = [
  [0, 7.5], [5, 7.3], [10, 6.3], [14, 5.9], [19, 6.4], [21.9, 7.6], [23.2, 8.8], [24.4, 9.1], [25.4, 8.4], [25.9, 6.8],
  [26.6, 4.5], [27.6, 3.0], [29.6, 2.8], [31.0, 3.2], [33.0, 3.25], [35.0, 3.1], [36.3, 2.3], [37.0, 0.6],
].map(([Z, h]) => [Z * IN_MM, h * IN_MM]);
// tape bands across the block (Fig. 4): their edges, mm up from the base
const TAPE = [[6.0], [6.8], [10.0], [11.0], [18.1], [21.6], [27.3], [28.2], [33.9], [34.8]].map(([Z]) => [Z * IN_MM]);
function frontAt(Z) {
  if (Z <= SIDE[0][0]) return 99 + PLY;
  for (let i = 1; i < SIDE.length; i++) if (Z <= SIDE[i][0]) {
    const [z0, x0] = SIDE[i - 1], [z1, x1] = SIDE[i];
    return x0 + ((x1 - x0) * (Z - z0)) / (z1 - z0);
  }
  return SIDE[SIDE.length - 1][1];
}
// A prism like the kit's, for one convex run of a concave body: the edges
// along its joins with the neighbouring runs (seam[] gives each corner's join,
// 0 for none, and an edge lies on a join when both its ends share one)
// are left out of its outline and creases, so the stack reads as one solid.
function seamlessPrism(k, G, F, polygon, seam, s0, s1, P) {
  const V = G.viewOf(P), L = G.lightOf(P);
  const area = polygon.reduce((sum, [x, y], i) => { const [nx, ny] = polygon[(i + 1) % polygon.length]; return sum + x * ny - nx * y; }, 0);
  const ring = area < 0 ? [...polygon].reverse() : polygon;
  const flag = area < 0 ? [...seam].reverse() : seam;
  const n = ring.length;
  const at = (s, [x, y]) => G.add3(G.add3(G.add3(F.o, G.mul3(F.a, s)), G.mul3(F.u, x)), G.mul3(F.v, y));
  const low = ring.map((p) => k.iso(at(s0, p), P)), high = ring.map((p) => k.iso(at(s1, p), P));
  const same = (a, b) => flag[a] && flag[a] === flag[b];
  const internal = (j) => same(j, (j + 1) % n);
  const buckets = [[], [], [], [], []];
  const seen = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[(j + 1) % n];
    const normal = G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))));
    const visible = !internal(j) && G.dot3(normal, V) > 1e-6;
    seen.push(visible);
    if (visible) buckets[G.bandOf(G.dot3(normal, L))].push(k.pathOf([low[j], low[(j + 1) % n], high[(j + 1) % n], high[j]], true));
  }
  const ends = [[low, G.mul3(F.a, -1)], [high, F.a]];
  const capSeen = ends.map(([, normal]) => G.dot3(normal, V) > 1e-6);
  ends.forEach(([points, normal], i) => capSeen[i] && buckets[G.bandOf(G.dot3(normal, L))].push(k.pathOf(points, true)));
  const creases = [];
  for (let j = 0; j < n; j++) {
    const prev = (j - 1 + n) % n;
    const a = [ring[j][0] - ring[prev][0], ring[j][1] - ring[prev][1]];
    const b = [ring[(j + 1) % n][0] - ring[j][0], ring[(j + 1) % n][1] - ring[j][1]];
    const sharp = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1) < Math.cos(0.35);
    if (sharp && seen[j] && seen[prev] && !(internal(j) || internal(prev))) creases.push(k.pathOf([low[j], high[j]]));
    ends.forEach(([points], i) => capSeen[i] && seen[j] && !internal(j) && creases.push(k.pathOf([points[j], points[(j + 1) % n]])));
  }
  // the hull, its edges along a join dropped from the outline
  const tagged = [...low.map((p, j) => ({ p, j })), ...high.map((p, j) => ({ p, j }))];
  const index = new Map(tagged.map(({ p, j }) => [p, j]));
  const hull = G.hullOf(tagged.map(({ p }) => p));
  const parts = [];
  let open = [];
  for (let i = 0; i <= hull.length; i++) {
    const p = hull[i % hull.length], q = hull[(i + 1) % hull.length];
    if (i === hull.length) break;
    const skip = same(index.get(p), index.get(q));
    if (skip) { if (open.length > 1) parts.push(open); open = []; continue; }
    if (!open.length) open.push(p);
    open.push(q);
  }
  if (open.length > 1) parts.push(open);
  return { fill: k.pathOf(hull, true), outline: parts.map((pts) => k.pathOf(pts)).join(""), crease: creases.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

// The front profile between two heights, split into runs along which it
// only ever turns one way, so each run with the backboard is convex.
function convexRuns(z0, z1) {
  const chain = [[z0, frontAt(z0)], ...SIDE.filter(([Z]) => Z > z0 && Z < z1), [z1, frontAt(z1)]];
  const runs = [];
  let run = [chain[0], chain[1]];
  for (let i = 2; i < chain.length; i++) {
    const [a, b, c] = [run[run.length - 2], run[run.length - 1], chain[i]];
    const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (turn > 1e-9) { runs.push(run); run = [b, c]; } else run.push(c);
  }
  runs.push(run);
  return runs;
}
// how wide the block's front is at a height: the base, the torso, the head
const halfAt = (Z) => (Z <= BASE_MM ? 152.4 : Z <= NECK_MM ? 152.4 : 50.8);

// Where the column's moving parts are: the frame of the tilted head.
function headOf(G, D, pose) {
  const { U, COLUMN } = D;
  const a = (COLUMN.angleDeg * Math.PI) / 180;
  const d = [Math.cos(a), 0, -Math.sin(a)], up = [Math.sin(a), 0, Math.cos(a)];
  const HUB = [-60, 0, 150];
  const slide = (pose.slideMm ?? 0) * U;
  const PIV = COLUMN.stations.tilt_pivot * U;
  const pivot = G.add3(HUB, G.mul3(d, PIV + slide));
  const t = ((pose.tilt ?? 0) * Math.PI) / 180;
  const rot = (v) => [v[0] * Math.cos(t) + v[2] * Math.sin(t), v[1], -v[0] * Math.sin(t) + v[2] * Math.cos(t)];
  const hd = rot(d), hu = rot(up);
  return { hd, hu, o: G.sub3(pivot, G.mul3(hd, PIV)) };
}

// How far back the block's back face sits when its front meets the wheel,
// for a pose of the column: the least, over the rim and the airbag cover's
// face, of each point's x less the block's front at that height.
function contactX(G, D, pose, refZ) {
  const { U, COLUMN } = D;
  const { hd, hu, o } = headOf(G, D, pose);
  const R = (COLUMN.wheelDiameterMm / 2 - COLUMN.rimSectionMm) * U, r = COLUMN.rimSectionMm * U;
  const Y = [0, 1, 0];
  let best = Infinity;
  const test = (p) => {
    const Z = (p[2] - refZ) / U + REF_MM;
    if (Z < 0 || Z > TOP_MM || Math.abs(p[1]) > halfAt(Z) * U) return;
    best = Math.min(best, p[0] - frontAt(Z) * U);
  };
  for (let i = 0; i < 144; i++) {
    const th = (i / 144) * Math.PI * 2;
    const radial = G.add3(G.mul3(hu, Math.cos(th)), G.mul3(Y, Math.sin(th)));
    for (let j = 0; j < 24; j++) {
      const ph = (j / 24) * Math.PI * 2;
      test(G.add3(o, G.add3(G.mul3(radial, R + r * Math.cos(ph)), G.mul3(hd, r * Math.sin(ph)))));
    }
    for (const [sa, ra] of AIRBAG) test(G.add3(o, G.add3(G.mul3(radial, ra), G.mul3(hd, sa))));
  }
  return best;
}

// the airbag cover's profile, s along the column from the rim's centre, r
const AIRBAG = [[-12, 10], [-11.2, 13.6], [-10.4, 14.6], [-9.6, 15.4], [-8.5, 15.9], [-7.4, 16.2], [-5, 16.4], [-2.5, 16.4], [0, 16.4]];

// The track, laid out from where the block meets the wheel at the column's
// design position: a free flight before that, a launch stroke before that.
const FLY = 16, LAUNCH = 60;
function trackOf(G, D) {
  const { U, PACKAGE, TEST } = D;
  // the reference line sits as far above the rim's lower edge as a point
  // 0.75 in above the seating reference point does: here, heights in the
  // figure are measured from the rim's ring centre at z = 150
  const refZ = 150 + (PACKAGE.sgrpMm[2] + TEST.refAboveSgrpMm - PACKAGE.ringMm[2]) * U;
  const contact = contactX(G, D, { tilt: 0, slideMm: 0 }, refZ);
  const end = contact - FLY, rest = end - LAUNCH;
  return {
    refZ, contact, end, rest, fly: FLY, launch: LAUNCH,
    top: refZ + (TOP_MM - REF_MM) * U,
    // the hub on the block's back sits at its centre of gravity, 21.7 in
    // below the top of the head (J944 5.1.3)
    cg: refZ + (TOP_MM - 21.7 * IN_MM - REF_MM) * U,
    wandZ: refZ + (10 * IN_MM - REF_MM) * U,
    wandOut: 22,
    // the free-flight speed is read within 3 in of contact (TP-203-02)
    gate: contact + (60 + 12.7) * U - 1.5 * IN_MM * U,
    plateX: rest - 9 - 6 - 3 - 70 - 10 - 62,
    // block travel past contact for each column stroke, mm -> units
    strokeTravel: (strokeMm) => contactX(G, D, { tilt: 0, slideMm: strokeMm }, refZ) - contact,
  };
}

export { benchParts, trackOf, contactX };
