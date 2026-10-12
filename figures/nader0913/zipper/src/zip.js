// Shared by build.mjs (Node) and the live pages (inlined). Plain script: no imports, no exports.
// makeZip(K, P, C): K = kit functions, P = projection, C = constants (world units = mm).
function makeZip(K, P, C) {
  const t1 = (v) => (Math.round(v * 10) / 10).toString();
  const pth = (pts, close) => pts.map((p, i) => (i ? "L" : "M") + t1(p[0]) + " " + t1(p[1])).join("") + (close ? "Z" : "");
  const at = (p) => K.iso(p, P);
  const { Y0, D, a, Ls, lam } = C;
  const hp = C.hp || 2, dL = C.dL || 4.6;
  const m0 = (hp * D) / (Ls - a);

  // ---- the Y channel: bead-centre half gap g(xi) as a function of the distance xi from the slider's rear face
  function g(xi) {
    if (xi <= a) return Y0;
    if (xi <= Ls) { const u = (xi - a) / (Ls - a); return Y0 + D * Math.pow(u, hp); }
    return Y0 + D + m0 * lam * (1 - Math.exp(-(xi - Ls) / lam));
  }
  function gp(xi) {
    if (xi <= a) return 0;
    if (xi <= Ls) { const u = (xi - a) / (Ls - a); return (hp * D * Math.pow(u, hp - 1)) / (Ls - a); }
    return m0 * Math.exp(-(xi - Ls) / lam);
  }
  // arc length of the bead from xi = a (tapes do not stretch: teeth keep their spacing along it)
  const SD = 0.05, SN = 3200;
  const Sarr = new Float64Array(SN + 1);
  for (let i = 1; i <= SN; i++) {
    const x0 = a + (i - 1) * SD, x1 = a + i * SD, xm = (x0 + x1) / 2;
    Sarr[i] = Sarr[i - 1] + Math.hypot(SD, gp(xm) * SD);
  }
  function xiOfS(S) { // inverse of the arc length table
    if (S <= 0) return a + S;
    let lo = 0, hi = SN;
    if (S >= Sarr[SN]) return a + SN * SD + (S - Sarr[SN]);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Sarr[m] < S) lo = m; else hi = m; }
    const f = (S - Sarr[lo]) / (Sarr[hi] - Sarr[lo]);
    return a + (lo + f) * SD;
  }
  function sOfXi(xi) {
    if (xi <= a) return xi - a;
    const f = (xi - a) / SD, i = Math.min(SN - 1, Math.floor(f));
    return Sarr[i] + (Sarr[i + 1] - Sarr[i]) * (f - i);
  }
  // bead frame at arc length s (from the bottom stop, x = 0) with the slider's rear face at X; side sg = -1 | +1
  function frameAt(s, X, sg) {
    const xi = xiOfS(s - X - a);
    const gg = g(xi), d = gp(xi), n = Math.hypot(1, d);
    return { B: [X + xi, sg * gg], T: [1 / n, (sg * d) / n], N: [d / n, -sg / n], xi };
  }
  const onFrame = (F, u, v) => [F.B[0] + u * F.T[0] + v * F.N[0], F.B[1] + u * F.T[1] + v * F.N[1]];
  // offset of the bead curve (in slider coordinates), d > 0 outward
  function offsetPt(xi, sg, d) {
    const gg = g(xi), dd = gp(xi), n = Math.hypot(1, dd);
    return [xi - (dd * d) / n, sg * (gg + d / n)];
  }

  // ---- 45 deg section hatching over a plan polygon at height z (lines x - y = c)
  function hatchPlan(poly, z, step) {
    const cs = poly.map(([x, y]) => x - y);
    const lo = Math.min(...cs), hi = Math.max(...cs);
    const segs = [];
    for (let c = Math.ceil(lo / step) * step; c <= hi; c += step) {
      const hits = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const fp = p[0] - p[1] - c, fq = q[0] - q[1] - c;
        if ((fp < 0) === (fq < 0) || fp === fq) continue;
        const t = fp / (fp - fq);
        const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
        hits.push([x + y, x, y]);
      }
      hits.sort((m, n) => m[0] - n[0]);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        if (Math.hypot(hits[i + 1][1] - hits[i][1], hits[i + 1][2] - hits[i][2]) < 0.15) continue;
        segs.push(pth([at([hits[i][1], hits[i][2], z]), at([hits[i + 1][1], hits[i + 1][2], z])]));
      }
    }
    return segs.join("");
  }
  // a solid whose top is a section cut: lighter tint + fine 45 deg hatching
  function cutSolid(ring, z, h, cls, step = 0.55) {
    const s = K.solidSvg(K.extrude(ring, z, h, P, { convex: false }), { tone: "hi", className: cls, inner: `<path class="iso-line cp-hatch" data-tone="lo" d="${hatchPlan(ring, z + h, step)}"/>` });
    return s.replace('<path class="iso-top"', '<path class="cp-cut"');
  }

  // ---- one tooth (plan in its bead frame: u along the tape, v toward the other tape), mm
  const NOSE = [];
  for (let i = 0; i <= 8; i++) { const q = (i / 8) * Math.PI; NOSE.push([0.81 * Math.cos(q), 3.4 + 0.81 * Math.sin(q)]); }
  const TOOTH = [[-0.85, -0.95], [0.85, -0.95], [1.0, -0.8], [1.0, 0.35], [0.64, 0.72], [0.64, 2.5], [0.81, 2.72], [0.81, 3.4], ...NOSE.slice(1, 8), [-0.81, 3.4], [-0.81, 2.72], [-0.64, 2.5], [-0.64, 0.72], [-1.0, 0.35], [-1.0, -0.8]];
  const NIB = Array.from({ length: 14 }, (_, i) => { const q = (i / 14) * Math.PI * 2; return [0.42 * Math.cos(q), 3.25 + 0.55 * Math.sin(q)]; });
  const TZ = C.TZ; // tooth half thickness
  function toothSvg(F, cls) {
    const ring = TOOTH.map(([u, v]) => onFrame(F, u, v));
    const nib = NIB.map(([u, v]) => onFrame(F, u, v));
    const crimp = pth([at([...onFrame(F, -1.0, -0.3), TZ]), at([...onFrame(F, 1.0, -0.3), TZ])]);
    const neck = pth([at([...onFrame(F, -0.64, 1.6), TZ]), at([...onFrame(F, 0.64, 1.6), TZ])]);
    return K.solidSvg(K.extrude(ring, -TZ, 2 * TZ, P, { convex: false }), { tone: "hi", className: cls, inner: K.lineSvg(crimp + neck, { tone: "lo" }) }) +
      K.solidSvg(K.extrude(nib, TZ, 0.22, P), { tone: "hi", className: cls, crease: "none" });
  }
  function stopSvg(F) { // top stop: a small brass clamp crimped on the bead just past the last tooth
    const ring = [[-1.1, -1.0], [1.1, -1.0], [1.1, 1.0], [-1.1, 1.0]].map(([u, v]) => onFrame(F, u, v));
    return K.solidSvg(K.extrude(ring, -1.0, 2.0, P), { tone: "hi", className: "m-brass", inner: K.lineSvg(pth([at([...onFrame(F, 0, -1.0), 1.0]), at([...onFrame(F, 0, 1.0), 1.0])]), { tone: "lo" }) });
  }

  // ---- teeth list: left (sg -1) at s = 1.5 + 3k, right (sg +1) at s = 3 + 3k
  const TEETH = [];
  for (let k = 0; k < C.N; k++) {
    TEETH.push({ sg: -1, s: C.s0 + C.pitch * k, red: k === C.red });
    TEETH.push({ sg: 1, s: C.s0 + C.pitch / 2 + C.pitch * k, red: k === C.red });
  }
  TEETH.sort((p, q) => p.s - q.s);

  // ---- tapes (teal), bead and woven lines for slider position X
  function tapeSvg(X, sg) {
    const sEnd = C.sEnd;
    const xiA = C.tapeStart - X, xiB = xiOfS(sEnd - X - a);
    const pts = [];
    const n = 90;
    // sample densely inside the curved part, sparsely on the straight part
    const xiCurve0 = Math.max(xiA, a);
    pts.push(xiA);
    if (xiCurve0 > xiA) pts.push(xiCurve0);
    for (let i = 1; i <= n; i++) pts.push(xiCurve0 + ((xiB - xiCurve0) * i) / n);
    const inner = pts.map((xi) => offsetPt(xi, sg, 0.0)).map(([x, y]) => [x + X, y]);
    const outer = pts.map((xi) => offsetPt(xi, sg, C.tapeW)).map(([x, y]) => [x + X, y]);
    const ring = [...inner, ...outer.reverse()];
    const z0 = -C.tapeT / 2, z1 = C.tapeT / 2;
    const lines = [];
    for (let d = 1.6; d < C.tapeW - 0.5; d += 1.45) {
      lines.push(pth(pts.map((xi) => { const [x, y] = offsetPt(xi, sg, d); return at([x + X, y, z1]); })));
    }
    // bead cord along the inner edge
    const bIn = pts.map((xi) => offsetPt(xi, sg, -0.55)).map(([x, y]) => [x + X, y]);
    const bOut = pts.map((xi) => offsetPt(xi, sg, 0.55)).map(([x, y]) => [x + X, y]);
    return K.solidSvg(K.extrude(ring, z0, C.tapeT, P, { convex: false }), { tone: "hi", className: "m-rib", crease: "none", inner: K.lineSvg(lines.join(""), { tone: "lo" }) }) +
      K.solidSvg(K.extrude([...bIn, ...bOut.reverse()], -0.55, 1.1, P, { convex: false }), { tone: "hi", className: "m-cord", crease: "none" });
  }

  // ---- the slider (built once at X = 0, moved with translate)
  const LIP_IN = 1.1, LIP_OUT = 2.6;
  const sampleXi = (n) => Array.from({ length: n + 1 }, (_, i) => (Ls * i) / n);
  function bandRing(sg, d0, d1, xi0 = 0, xi1 = Ls) {
    const xs = sampleXi(28).filter((x) => x >= xi0 - 1e-9 && x <= xi1 + 1e-9);
    const A = xs.map((xi) => offsetPt(xi, sg, d0)), B = xs.map((xi) => offsetPt(xi, sg, d1));
    return [...A, ...B.reverse()];
  }
  const plateRing = () => {
    const xs = sampleXi(28);
    const R = xs.map((xi) => offsetPt(xi, 1, LIP_OUT));
    const L = xs.map((xi) => offsetPt(xi, -1, LIP_OUT)).reverse();
    return [...R, ...L];
  };
  const mouthX = offsetPt(Ls, 1, LIP_OUT)[0];
  function diamondRing() {
    const x1 = Ls - 0.15, x0 = Ls - dL, w = C.dW;
    const ring = [[x0, 0]];
    for (let i = 1; i <= 6; i++) { const f = i / 6; ring.push([x0 + (x1 - 0.8 - x0) * f, -w * Math.sqrt(f)]); }
    for (let i = 1; i <= 5; i++) { const q = -Math.PI / 2 + (i / 6) * Math.PI; ring.push([x1 - 0.8 + 0.8 * Math.cos(q), w * Math.sin(q)]); }
    for (let i = 6; i >= 1; i--) { const f = i / 6; ring.push([x0 + (x1 - 0.8 - x0) * f, w * Math.sqrt(f)]); }
    return ring;
  }
  const PZ = C.PZ; // plate z levels
  // an upper lip cut into short depth-sortable pieces that share one surface (no seams between pieces)
  const cam = { sA: Math.sin(P.azimuth * Math.PI / 180), cA: Math.cos(P.azimuth * Math.PI / 180) };
  const VIEW = [cam.cA, cam.sA], LIGHT = [-cam.sA, cam.cA];
  function wall(p, q, z0, z1, out) {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    let n = [dy / l, -dx / l];
    if (n[0] * out[0] + n[1] * out[1] < 0) n = [-n[0], -n[1]];
    if (n[0] * VIEW[0] + n[1] * VIEW[1] <= 1e-6) return null;
    const lit = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + 1) / 2;
    const sh = Math.min(3, Math.max(0, Math.floor(lit * 4)));
    return { d: pth([at([p[0], p[1], z0]), at([q[0], q[1], z0]), at([q[0], q[1], z1]), at([p[0], p[1], z1])], true), sh, bottom: pth([at([p[0], p[1], z0]), at([q[0], q[1], z0])]) };
  }
  function lipSegments(sg, z0, z1) {
    const xs = sampleXi(32);
    const I = xs.map((xi) => offsetPt(xi, sg, LIP_IN)), O = xs.map((xi) => offsetPt(xi, sg, LIP_OUT));
    const segs = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const parts = [], edges = [];
      const mid = [(I[i][0] + O[i + 1][0]) / 2, (I[i][1] + O[i + 1][1]) / 2];
      const walls = [wall(I[i], I[i + 1], z0, z1, [mid[0] - (I[i][0] + I[i + 1][0]) / 2, mid[1] - (I[i][1] + I[i + 1][1]) / 2].map((v) => -v)), wall(O[i], O[i + 1], z0, z1, [(O[i][0] + O[i + 1][0]) / 2 - mid[0], (O[i][1] + O[i + 1][1]) / 2 - mid[1]])];
      if (i === 0) walls.push(wall(I[0], O[0], z0, z1, [-1, 0]));
      if (i === xs.length - 2) walls.push(wall(I[i + 1], O[i + 1], z0, z1, [1, 0]));
      for (const w of walls) if (w) { parts.push(`<path class="iso-shade" data-shade="${w.sh}" d="${w.d}"/>`); edges.push(w.bottom); }
      const top = [I[i], I[i + 1], O[i + 1], O[i]];
      parts.push(`<path class="cp-cut" d="${pth(top.map(([x, y]) => at([x, y, z1])), true)}"/>`);
      const hd = hatchPlan(top, z1, 0.55);
      if (hd) parts.push(`<path class="iso-line cp-hatch" data-tone="lo" d="${hd}"/>`);
      edges.push(pth([at([...I[i], z1]), at([...I[i + 1], z1])]), pth([at([...O[i], z1]), at([...O[i + 1], z1])]));
      // vertical edges where a visible wall meets an invisible one, and the lip's end edges
      const corner = (p) => pth([at([p[0], p[1], z0]), at([p[0], p[1], z1])]);
      if (i === 0) edges.push(pth([at([...I[0], z1]), at([...O[0], z1])]), corner(I[0]), corner(O[0]));
      if (i === xs.length - 2) edges.push(pth([at([...I[i + 1], z1]), at([...O[i + 1], z1])]), corner(I[i + 1]), corner(O[i + 1]));
      parts.push(`<path class="iso-line iso-edge" data-tone="hi" d="${edges.join("")}"/>`);
      segs.push({ c: [(I[i][0] + I[i + 1][0] + O[i][0] + O[i + 1][0]) / 4, (I[i][1] + I[i + 1][1] + O[i][1] + O[i + 1][1]) / 4], svg: `<g class="iso-solid m-orange" data-seamless="">${parts.join("")}</g>` });
    }
    return segs;
  }
  function sliderParts() {
    const bottom = [];
    const pr = plateRing();
    bottom.push(K.solidSvg(K.extrude(pr, PZ.b0, PZ.b1 - PZ.b0, P, { convex: false }), { tone: "hi", className: "m-orange" }));
    for (const sg of [-1, 1]) bottom.push(K.solidSvg(K.extrude(bandRing(sg, LIP_IN, LIP_OUT), PZ.b1, PZ.lipB - PZ.b1, P, { convex: false }), { tone: "hi", className: "m-orange" }));
    // upper lips, cut by the section plane at the plate's underside
    const lip = (sg) => lipSegments(sg, PZ.lipT, PZ.cut);
    const diamond = cutSolid(diamondRing(), PZ.b1, PZ.cut - PZ.b1, "m-orange", 0.5);
    // rear part of the top plate (not cut), the pull's lug and the pull tab lying back over the chain
    const top = [];
    const rear = [[0, offsetPt(0, 1, LIP_OUT)[1]], [C.cutX, offsetPt(C.cutX, 1, LIP_OUT)[1]], [C.cutX, -offsetPt(C.cutX, 1, LIP_OUT)[1]], [0, -offsetPt(0, 1, LIP_OUT)[1]]];
    const rearR = [[0.6, rear[0][1]], [C.cutX, rear[1][1]], [C.cutX, rear[2][1]], [0.6, rear[3][1]], [0, rear[3][1] + 0.6], [0, rear[0][1] - 0.6]];
    top.push(K.solidSvg(K.extrude(rearR, PZ.t0, PZ.t1 - PZ.t0, P, { convex: true }), { tone: "hi", className: "m-orange" }));
    const post = (y) => K.solidSvg(K.extrude([[1.0, y - 0.55], [3.4, y - 0.55], [3.4, y + 0.55], [1.0, y + 0.55]], PZ.t1, 1.15, P), { tone: "hi", className: "m-orange" });
    const tab = [];
    for (let i = 0; i <= 10; i++) { const q = Math.PI / 2 + (i / 10) * Math.PI; tab.push([-13.2 + 3.2 * Math.cos(q), 3.2 * Math.sin(q)]); }
    const tz0 = PZ.t1 + 0.12, tz1 = tz0 + 0.42;
    const ridges = [-4.5, -5.6, -6.7, -7.8].map((x) => pth([at([x, -3.2, tz1]), at([x, 3.2, tz1])])).join("");
    const slot = (() => { const r = []; for (let i = 0; i < 20; i++) { const q = (i / 20) * Math.PI * 2; r.push(at([-12.4 + 1.3 * Math.cos(q), 1.6 * Math.sin(q), tz1])); } return pth(r, true); })();
    const hole = pth([[1.2, -2.2], [3.2, -2.2], [3.2, 2.2], [1.2, 2.2]].map(([x, y]) => at([x, y, tz1])), true);
    const tabSvg = K.solidSvg(K.extrude([[4.0, -3.2], [4.0, 3.2], ...tab], tz0, tz1 - tz0, P, { convex: true }), { tone: "hi", className: "m-orange", inner: K.lineSvg(ridges + slot + hole, { tone: "lo" }) });
    const bar = K.solidSvg(K.extrude([[1.5, -3.9], [2.9, -3.9], [2.9, 3.9], [1.5, 3.9]], PZ.t1 + 0.62, 0.53, P), { tone: "hi", className: "m-orange" });
    const near = [top.join(""), post(-3.75), tabSvg, post(3.75), bar].join("");
    // screws in the plate: two rivets on the rear plate
    const rivets = `<g class="iso-dots" data-tone="hi">${[[0.9, -3.6], [0.9, 3.6]].map(([x, y]) => { const [sx, sy] = at([x, y, PZ.t1]); return `<circle cx="${t1(sx)}" cy="${t1(sy)}" r="0.45"/>`; }).join("")}</g>`;
    return { bottom: bottom.join(""), far: "", lips: [...lip(-1), ...lip(1)], diamond, near: near + rivets, mouthX };
  }

  // ---- one frame: tapes + teeth (sorted with the diamond) for slider rear at X
  function frame(X, SL) {
    const tr = K.translateAlong(P, [X, 0, 0]);
    const tapes = tapeSvg(X, -1) + tapeSvg(X, 1);
    const beyond = [], inside = [];
    for (const t of TEETH) {
      const F = frameAt(t.s, X, t.sg);
      const c = onFrame(F, 0, 1.6);
      const item = { d: K.depthOf([c[0], c[1], 0], P), svg: toothSvg(F, t.red ? "m-accent" : "m-brass") };
      (F.xi > Ls + 0.3 ? beyond : inside).push(item);
    }
    for (const sg of [-1, 1]) {
      const F = frameAt(C.sStop, X, sg);
      const c = F.B;
      const item = { d: K.depthOf([c[0], c[1], 0], P), svg: stopSvg(F) };
      (F.xi > Ls + 0.3 ? beyond : inside).push(item);
    }
    inside.push({ d: K.depthOf([X + Ls - 1.6, 0, 0], P), svg: `<g transform="${tr}">${SL.diamond}</g>` });
    for (const l of SL.lips) inside.push({ d: K.depthOf([X + l.c[0], l.c[1], 0], P) + 0.01, svg: `<g transform="${tr}">${l.svg}</g>` });
    const by = (p, q) => p.d - q.d;
    beyond.sort(by); inside.sort(by);
    return {
      tr,
      tapes,
      beyond: beyond.map((x) => x.svg).join(""),
      inside: inside.map((x) => x.svg).join(""),
    };
  }

  // ---- tour: slider rear position X(t) from a segment list
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const ease3 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBack = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const EASES = { s: ease, c: ease3, b: easeOutBack };
  function Xat(t, SEG) {
    let X = SEG[0].x0;
    for (const sgm of SEG) {
      if (t < sgm.t0) return X;
      if (t <= sgm.t1) return sgm.x0 + (sgm.x1 - sgm.x0) * EASES[sgm.e || "s"]((t - sgm.t0) / (sgm.t1 - sgm.t0));
      X = sgm.x1;
    }
    return X;
  }
  return { diamondRing, TOOTH, onFrame, g, gp, frameAt, frame, sliderParts, Xat, TEETH, sOfXi, xiOfS, offsetPt, hatchPlan, mouthX };
}
