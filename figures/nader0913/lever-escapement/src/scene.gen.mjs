// Scene of the watch movement in its holder. Plain script: makeScene(k, M, P) -> { list, dyn(name, S) }.
// list: ordered paint slots, { svg } static or { dyn } redrawn per frame. All units mm, z up from the plate's top.
function makeScene(k, M, P, opts) {
  opts = opts || {};
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const { pol, add, sub, len, ang } = M;
  const cam = k.cameraOf(P);
  const VIEW = [cam.cosA, cam.sinA], LIGHT = [-cam.sinA, cam.cosA];
  const at = (x, y, z) => k.iso([x, y, z], P);
  const fmt = (v) => Math.round(v * 100) / 100;
  const pth = (pts, closed) => { if (!pts.length) return ""; let s = "M" + fmt(pts[0][0]) + " " + fmt(pts[0][1]); for (let i = 1; i < pts.length; i++) s += "L" + fmt(pts[i][0]) + " " + fmt(pts[i][1]); return closed ? s + "Z" : s; };
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const orient = (pts, sign) => (Math.sign(area(pts)) === sign ? pts : pts.slice().reverse());
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const Dots = (pts, style) => k.dotsSvg(pts, style);
  const paint = (col, svg) => `<g class="pc-${col}">${svg}</g>`;
  const circ = (c, r, n, a0) => Array.from({ length: n }, (_, i) => add(c, pol(r, (a0 || 0) + (i / n) * TAU)));
  const stepsFor = (r) => Math.max(24, Math.min(140, Math.round(r * 22)));

  // ---------- a flat part of any outline, with holes, z..z+h, kit-style four-tone sides ----------
  function flat(outer, holes, z, h) {
    holes = holes || [];
    const ccw = (pts) => (area(pts) > 0 ? pts : pts.slice().reverse());
    outer = ccw(outer); holes = holes.map(ccw);
    const T = (p) => at(p[0], p[1], z + h), Bt = (p) => at(p[0], p[1], z);
    const scr = outer.map(T);
    const sgn = Math.sign(area(scr)) || 1;           // screen orientation of a CCW plan ring
    const fill = [], top = [], shades = [[], [], [], []], outline = [], crease = [];
    const walls = (ring, inward) => {
      const n = ring.length, tops = ring.map(T), bots = ring.map(Bt);
      const face = [];
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        let nx = dy / l, ny = -dx / l; if (inward) { nx = -nx; ny = -ny; }
        const f = nx * VIEW[0] + ny * VIEW[1] > 1e-9;
        face.push(f);
        if (f && h > 0) {
          const quad = orient([tops[i], tops[(i + 1) % n], bots[(i + 1) % n], bots[i]], sgn);
          fill.push(pth(quad, true));
          const lit = (nx * LIGHT[0] + ny * LIGHT[1] + 1) / 2;
          shades[Math.min(3, Math.max(0, Math.floor(lit * 4)))].push(pth(quad, true));
        }
      }
      // runs: outline top edges where not facing (outer) / everywhere (holes); bottom edges + verticals where facing
      let i0 = face.indexOf(!face[0]);
      if (i0 < 0) i0 = 0;
      const runs = [];
      for (let s = 0; s < n; s++) {
        const i = (i0 + s) % n;
        if (!runs.length || runs[runs.length - 1].f !== face[i]) runs.push({ f: face[i], idx: [] });
        runs[runs.length - 1].idx.push(i);
      }
      for (const run of runs) {
        const ids = run.idx.concat([(run.idx[run.idx.length - 1] + 1) % n]);
        const tp = pth(ids.map((i) => tops[i]));
        if (run.f && h > 0) { (inward ? outline : crease).push(tp); outline.push(pth(ids.map((i) => bots[i]))); outline.push(pth([tops[ids[0]], bots[ids[0]]]), pth([tops[ids[ids.length - 1]], bots[ids[ids.length - 1]]])); }
        else outline.push(tp);
      }
      return { tops, bots };
    };
    const o = walls(outer, false);
    fill.unshift(pth(orient(o.tops, sgn), true), pth(orient(o.bots, sgn), true));
    top.push(pth(orient(o.tops, sgn), true));
    for (const hole of holes) {
      const w = walls(hole, true);
      fill.splice(2, 0, pth(orient(w.tops, -sgn), true), pth(orient(w.bots, -sgn), true));
      top.push(pth(orient(w.tops, -sgn), true));
    }
    return { fill: fill.join(""), top: top.join(""), shades: shades.map((x) => x.join("")), outline: outline.join(""), crease: crease.join("") };
  }
  const flatSvg = (outer, holes, z, h, col, style) => paint(col, S(flat(outer, holes, z, h), Object.assign({ tone: "hi", crease: "faint" }, style || {})));
  const cyl = (c, r, z, h, col, style, steps) => paint(col, S(k.cylinder(c[0], c[1], r, z, h, P, steps || stepsFor(r)), Object.assign({ tone: "hi" }, style || {})));
  const ringLine = (c, r, z, steps) => k.ring(c[0], c[1], r, z, P, steps || stepsFor(r));

  // ---------- gear outlines ----------
  function gearRing(c, N, r, m, phase, kind) {
    const pa = TAU / N;
    const tip = kind === "pinion" ? r + 0.55 * m : r + 0.95 * m, root = kind === "pinion" ? r - 1.45 * m : r - 1.25 * m;
    const prof = kind === "pinion"
      ? [[-0.5, root], [-0.3, root], [-0.24, r], [-0.17, tip * 0.985], [-0.06, tip], [0.06, tip], [0.17, tip * 0.985], [0.24, r], [0.3, root]]
      : [[-0.5, root], [-0.3, root], [-0.26, r - 0.2 * m], [-0.19, r + 0.55 * m], [-0.1, tip], [0.1, tip], [0.19, r + 0.55 * m], [0.26, r - 0.2 * m], [0.3, root]];
    const pts = [];
    for (let i = 0; i < N; i++) for (const [f, rr] of prof) pts.push(add(c, pol(rr, phase + (i + f) * pa)));
    return pts;
  }
  function spokeHoles(c, n, rHub, rRim, w, phase) {
    const holes = [];
    for (let i = 0; i < n; i++) {
      const a0 = phase + (i / n) * TAU, a1 = phase + ((i + 1) / n) * TAU;
      const dO = Math.asin(Math.min(0.9, w / 2 / rRim)), dI = Math.asin(Math.min(0.9, w / 2 / rHub));
      const pts = [];
      const nO = Math.max(6, Math.round((a1 - a0) * rRim * 6)), nI = Math.max(3, Math.round((a1 - a0) * rHub * 6));
      for (let j = 0; j <= nO; j++) pts.push(add(c, pol(rRim, a0 + dO + (a1 - a0 - 2 * dO) * (j / nO))));
      for (let j = nI; j >= 0; j--) pts.push(add(c, pol(rHub, a0 + dI + (a1 - a0 - 2 * dI) * (j / nI))));
      holes.push(pts);
    }
    return holes;
  }
  function escapeRing(c, rot) {
    const R = M.RE, rr = 1.78, pts = [];
    for (let i = 0; i < 15; i++) {
      const a = M.TIP0 + i * M.PITCH + rot;          // leading tip of tooth i
      const back = a - M.PITCH;
      pts.push(add(c, pol(rr, back + 0.02)));
      pts.push(add(c, pol(rr + 0.12, back + 0.13)));
      for (let j = 1; j <= 5; j++) { const u = j / 6; pts.push(add(c, pol(rr + 0.12 + (R - 0.05 - rr - 0.12) * Math.pow(u, 0.8), back + 0.13 + (M.PITCH - 0.13 - 0.07) * u))); }
      pts.push(add(c, pol(R, a - 0.05)));
      pts.push(add(c, pol(R, a)));
      pts.push(add(c, pol(rr + 0.05, a - 0.09)));
    }
    return pts;
  }

  // ---------- union of capsules -> one outline (marching squares on the distance field) ----------
  function blobOutline(caps, discs, step) {
    step = step || 0.06;
    const sd = (p) => {
      let d = 1e9;
      for (const [a, b, w] of caps) { const ab = sub(b, a), ap = sub(p, a); const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1]))); d = Math.min(d, len(sub(p, add(a, [ab[0] * t, ab[1] * t]))) - w); }
      for (const [c, r] of discs) d = Math.min(d, len(sub(p, c)) - r);
      return d;
    };
    // smooth union so joints are filleted like a real bridge
    const xs = [], ys = [];
    for (const [a, b, w] of caps) { xs.push(a[0] - w, b[0] - w, a[0] + w, b[0] + w); ys.push(a[1] - w, b[1] - w, a[1] + w, b[1] + w); }
    for (const [c, r] of discs) { xs.push(c[0] - r, c[0] + r); ys.push(c[1] - r, c[1] + r); }
    const x0 = Math.min(...xs) - 0.3, y0 = Math.min(...ys) - 0.3, nx = Math.ceil((Math.max(...xs) + 0.3 - x0) / step), ny = Math.ceil((Math.max(...ys) + 0.3 - y0) / step);
    const V = new Float64Array((nx + 1) * (ny + 1));
    const FIL = 0.35;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const p = [x0 + i * step, y0 + j * step];
      // smooth-min of the parts (fillets)
      let acc = 0;
      for (const [a, b, w] of caps) { const ab = sub(b, a), ap = sub(p, a); const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1]))); acc += Math.exp(-(len(sub(p, add(a, [ab[0] * t, ab[1] * t]))) - w) / FIL * 3); }
      for (const [c, r] of discs) acc += Math.exp(-(len(sub(p, c)) - r) / FIL * 3);
      V[j * (nx + 1) + i] = -Math.log(acc) * FIL / 3;
    }
    const val = (i, j) => V[j * (nx + 1) + i];
    const P_ = (i, j) => [x0 + i * step, y0 + j * step];
    const lerp = (p, q, a, b) => { const t = a / (a - b); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    const segs = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = val(i, j), b = val(i + 1, j), c = val(i + 1, j + 1), d = val(i, j + 1);
      const pa = P_(i, j), pb = P_(i + 1, j), pc = P_(i + 1, j + 1), pd = P_(i, j + 1);
      const e = [];
      const key = (p) => p[0].toFixed(5) + "," + p[1].toFixed(5);
      if ((a < 0) !== (b < 0)) e.push(lerp(pa, pb, a, b));
      if ((b < 0) !== (c < 0)) e.push(lerp(pb, pc, b, c));
      if ((c < 0) !== (d < 0)) e.push(lerp(pc, pd, c, d));
      if ((d < 0) !== (a < 0)) e.push(lerp(pd, pa, d, a));
      if (e.length === 2) segs.push([e[0], e[1]]);
      else if (e.length === 4) { segs.push([e[0], e[1]]); segs.push([e[2], e[3]]); }
    }
    // chain segments into loops
    const key = (p) => Math.round(p[0] * 1e4) + "," + Math.round(p[1] * 1e4);
    const adj = new Map();
    segs.forEach((s, i) => { for (const p of s) { const kk = key(p); if (!adj.has(kk)) adj.set(kk, []); adj.get(kk).push(i); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      const loop = [segs[s0][0], segs[s0][1]];
      for (;;) {
        const last = loop[loop.length - 1];
        const nxt = (adj.get(key(last)) || []).find((i) => !used[i]);
        if (nxt === undefined) break;
        used[nxt] = 1;
        const s = segs[nxt];
        loop.push(key(s[0]) === key(last) ? s[1] : s[0]);
      }
      loops.push(loop);
    }
    loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
    // thin the polyline (every 2nd point) for size
    return loops[0].filter((_, i) => i % 2 === 0);
  }

  // ---------- layout heights ----------
  const Z = {
    plate: [-1.2, 0], barrel: [0.15, 1.35], bTeeth: [1.05, 1.35], third: [0.6, 0.12], fourth: [0.97, 0.1], centre: [1.45, 0.13], esc: [1.9, 0.1],
    fork: [2.06, 0.15], stone: [1.86, 2.24], roller: [2.28, 0.12], pin: [2.0, 2.4], rim: [2.95, 0.34], spring: 3.52, bridge: [2.42, 0.5], bbar: [1.78, 0.4], balBridge: [3.86, 0.42],
  };
  const { C, B, TH, FO, E, A, BAL } = M;
  const u = pol(1, M.LINE), v = pol(1, M.LINE + Math.PI / 2);
  const UV = (a, b) => add(A, [u[0] * a + v[0] * b, u[1] * a + v[1] * b]);

  const list = [];
  const dyns = {};
  const stat = (svg) => list.push({ svg: opts.dynOnly ? "" : svg });
  const dyn = (name, fn) => { list.push({ dyn: name }); dyns[name] = fn; };

  // ================= holder, plate =================
  const HOLD_R = M.PLATE_R + 1.75, HOLD_IN = M.PLATE_R + 0.12;
  stat(`<path class="iso-halo" d="${k.cylinder(0, 0, HOLD_R + 0.6, -3.4, 0.2, P, 90).fill}"/>`);
  // three feet
  const feetA = [100, 220, 340].map((d) => d * D2R + 0.3);
  const feet = feetA.map((a) => pol(HOLD_R - 1.6, a)).sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  stat(feet.map((p) => cyl(p, 1.3, -3.4, 1.6, "steel", { tone: "hi" })).join(""));
  // lower ring of the holder (below the plate's top)
  stat(flatSvg(circ([0, 0], HOLD_R, 150), [circ([0, 0], HOLD_IN, 140)], -1.8, 1.8, "bench", {
    inner: L(k.sideArc(0, 0, HOLD_R, -0.9, P, 120), { tone: "faint" }),
  }));
  // main plate with perlage, sinks, plate screws
  {
    const plate = flatSvg(circ([0, 0], M.PLATE_R, 150), [], Z.plate[0], 1.2, "bench", { inner: L(k.sideArc(0, 0, M.PLATE_R, -0.55, P, 120), { tone: "faint" }) });
    const rings = [];
    // perlage (circular graining) on the plate: overlapping small circles in a grid where the plate shows
    for (let x = -12; x <= 12; x += 0.95) for (let y = -12; y <= 12; y += 0.82) {
      const c = [x + ((Math.round(y / 0.82) & 1) ? 0.47 : 0), y];
      if (len(c) > M.PLATE_R - 1.0) continue;
      rings.push(ringLine(c, 0.5, 0, 12));
    }
    const sinks = [B, C, TH, FO, E, A, BAL].map((c) => ringLine(c, 1.15, 0, 30)).join("");
    stat(plate + paint("bench", L(rings.join(""), { tone: "faint", className: "wt-perlage" }) + L(sinks, { tone: "lo" })));
  }
  // holder lip (above the plate's top) with three jaws and their screws
  stat(flatSvg(circ([0, 0], HOLD_R, 150), [circ([0, 0], HOLD_IN, 140)], 0, 0.35, "bench"));
  {
    const jaws = [40, 160, 280].map((d) => d * D2R);
    const out = [];
    for (const a of jaws.sort((p, q) => k.depthOf([Math.cos(p), Math.sin(p), 0], P) - k.depthOf([Math.cos(q), Math.sin(q), 0], P))) {
      const w = 0.17;
      const ring = [];
      for (let j = 0; j <= 10; j++) ring.push(pol(HOLD_R - 0.4, a - w + 2 * w * (j / 10)));
      for (let j = 10; j >= 0; j--) ring.push(pol(M.PLATE_R - 0.9, a - w * 0.8 + 1.6 * w * (j / 10)));
      out.push(flatSvg(ring, [], 0.35, 0.45, "steel"));
      const sc = pol(HOLD_R - 1.15, a);
      out.push(cyl(sc, 0.62, 0.8, 0.28, "grey"));
      out.push(paint("grey", L(k.lineOnTop(add(sc, pol(0.61, a + 1.0)), add(sc, pol(0.61, a + 1.0 + Math.PI)), 1.08, P), { tone: "hi" })));
    }
    stat(out.join(""));
  }

  // ================= barrel (static: one turn in 6 h) =================
  {
    const out = [];
    const rot = 0;
    const phase = ang(sub(C, B));
    // drum
    out.push(flatSvg(circ(B, M.rB - 0.18, 140), [], Z.barrel[0], Z.bTeeth[0] - Z.barrel[0], "gold", { inner: L(k.sideArc(B[0], B[1], M.rB - 0.18, 0.6, P, 90), { tone: "faint" }) }));
    // toothed rim at the top, lid cut away over a quarter to show the mainspring
    const CUT = [48 * D2R, 140 * D2R];
    const teeth = gearRing(B, M.T.barrel.N, M.rB, M.T.barrel.m, phase + rot, "wheel");
    // lid: annulus wedge-cut. The top ring of teeth is full; the lid (inside the drum wall) misses the cut sector.
    const wall = circ(B, M.rB - 0.55, 120);
    out.push(flatSvg(teeth, [wall], Z.bTeeth[0], Z.bTeeth[1] - Z.bTeeth[0], "gold"));
    // inside the cut: barrel floor, mainspring coils, arbor
    const inner = [];
    const sector = [B];
    for (let j = 0; j <= 30; j++) sector.push(add(B, pol(M.rB - 0.55, CUT[0] + (CUT[1] - CUT[0]) * (j / 30))));
    const clipD = pth(sector.map((p) => at(p[0], p[1], Z.bTeeth[1])), true);
    inner.push(`<clipPath id="wt-cut"><path d="${clipD}"/></clipPath>`);
    const coils = [];
    const turns = 13, r0 = 1.25, r1 = M.rB - 0.6;
    for (let zz of [0.55, 1.15]) {
      const pts = [];
      for (let j = 0; j <= turns * 48; j++) { const t = j / (turns * 48); pts.push(at(...add(B, pol(r0 + (r1 - r0) * t, 0.9 + t * turns * TAU)), zz)); }
      coils.push(pth(pts));
    }
    inner.push(`<g clip-path="url(#wt-cut)"><path class="wt-floor" d="${clipD}"/>` + paint("grey", L(coils[1], { tone: "hi", className: "wt-spring" })) + `</g>`);
    out.push(inner.join(""));
    // lid over the rest
    const lid = [B];
    for (let j = 0; j <= 100; j++) lid.push(add(B, pol(M.rB - 0.5, CUT[1] + (TAU - (CUT[1] - CUT[0])) * (j / 100))));
    out.push(flatSvg(lid, [], Z.bTeeth[1] - 0.22, 0.22, "gold", { inner: L(ringLine(B, 3.2, Z.bTeeth[1], 60), { tone: "faint" }) }));
    // cut faces of the lid and wall: light tint + 45 degree hatch
    const cutFace = (a) => {
      const p0 = add(B, pol(1.0, a)), p1 = add(B, pol(M.rB - 0.18, a));
      const q = [at(p0[0], p0[1], Z.bTeeth[1]), at(p1[0], p1[1], Z.bTeeth[1]), at(p1[0], p1[1], Z.bTeeth[1] - 0.22), at(p0[0], p0[1], Z.bTeeth[1] - 0.22)];
      return `<path class="wt-cutface" d="${pth(q, true)}"/>`;
    };
    out.push(paint("gold", cutFace(CUT[0]) + cutFace(CUT[1])));
    // arbor with its hook, rising through the bridge
    out.push(cyl(B, 1.0, Z.barrel[0], Z.bTeeth[1] + 0.12 - Z.barrel[0], "grey"));
    stat(out.join(""));
    // centre pinion meshing the barrel teeth (static too: centre turns 1/h)
  }

  // ================= train (dynamic) =================
  const wheelSvg = (c, N, r, m, phase, z, h, col, spokes, hub) => {
    const ring = gearRing(c, N, r, m, phase, "wheel");
    const holes = spokes ? spokeHoles(c, spokes, hub, r - 1.25 * m - Math.max(0.45, r * 0.12), Math.max(0.3, r * 0.075), phase * 0 + phase) : [];
    return flatSvg(ring, holes, z, h, col);
  };
  const pinionSvg = (c, n, r, m, phase, z, h) => flatSvg(gearRing(c, n, r, m, phase, "pinion"), [], z, h, "grey");
  const arbor = (c, r, z, h, col) => cyl(c, r, z, h, col || "grey", { tone: "hi" }, 24);
  const ph = {
    cP: ang(sub(B, C)) + Math.PI / M.T.centre.n, cW: ang(sub(TH, C)),
    tP: ang(sub(C, TH)) + Math.PI / M.T.third.n, tW: ang(sub(FO, TH)),
    fP: ang(sub(TH, FO)) + Math.PI / M.T.fourth.n, fW: ang(sub(E, FO)),
    eP: ang(sub(FO, E)) + Math.PI / M.T.escape.n,
  };
  const rotOf = (S) => ({ e: S.esc, f: S.esc * M.ratio.fourth, t: S.esc * M.ratio.third, c: S.esc * M.ratio.centre });
  // fourth pinion lower part, third wheel, fourth pinion upper, fourth wheel
  dyn("fourthPinionLo", (S) => { const R = rotOf(S); return pinionSvg(FO, M.T.fourth.n, M.rFp, M.T.third.m, ph.fP + R.f, 0.25, Z.third[0] - 0.25); });
  dyn("third", (S) => { const R = rotOf(S); return wheelSvg(TH, M.T.third.N, M.rT, M.T.third.m, ph.tW + R.t, Z.third[0], Z.third[1], "gold", 4, 0.75) + arbor(TH, 0.62, Z.third[0] + Z.third[1], 0.08, "gold"); });
  dyn("fourthPinionHi", (S) => { const R = rotOf(S); return pinionSvg(FO, M.T.fourth.n, M.rFp, M.T.third.m, ph.fP + R.f, Z.third[0] + Z.third[1], Z.fourth[0] - Z.third[0] - Z.third[1]); });
  dyn("escPinionLo", (S) => pinionSvg(E, M.T.escape.n, M.rEp, M.T.fourth.m, ph.eP + S.esc, 0.7, Z.fourth[0] - 0.7));
  dyn("fourth", (S) => { const R = rotOf(S); return wheelSvg(FO, M.T.fourth.N, M.rF, M.T.fourth.m, ph.fW + R.f, Z.fourth[0], Z.fourth[1], "gold", 4, 0.62) + arbor(FO, 0.5, Z.fourth[0] + Z.fourth[1], 0.08, "gold"); });
  dyn("escPinionHi", (S) => pinionSvg(E, M.T.escape.n, M.rEp, M.T.fourth.m, ph.eP + S.esc, Z.fourth[0] + Z.fourth[1], 0.25) + arbor(E, 0.13, Z.fourth[0] + Z.fourth[1] + 0.25, Z.esc[0] - Z.fourth[0] - Z.fourth[1] - 0.25));
  dyn("thirdPinionLo", (S) => { const R = rotOf(S); return pinionSvg(TH, M.T.third.n, M.rTp, M.T.centre.m, ph.tP + R.t, Z.third[0] + Z.third[1], Z.centre[0] - Z.third[0] - Z.third[1]); });
  dyn("centrePinion", (S) => { const R = rotOf(S); return pinionSvg(C, M.T.centre.n, M.rCp, M.T.barrel.m, ph.cP + R.c, 0.9, Z.centre[0] - 0.9); });
  dyn("centre", (S) => { const R = rotOf(S); return wheelSvg(C, M.T.centre.N, M.rC, M.T.centre.m, ph.cW + R.c, Z.centre[0], Z.centre[1], "gold", 4, 1.0) + arbor(C, 0.85, Z.centre[0] + Z.centre[1], 0.1, "gold") + arbor(C, 0.35, Z.centre[0] + Z.centre[1] + 0.1, Z.bbar[0] - Z.centre[0] - Z.centre[1] - 0.1); });
  dyn("thirdPinionHi", (S) => { const R = rotOf(S); return pinionSvg(TH, M.T.third.n, M.rTp, M.T.centre.m, ph.tP + R.t, Z.centre[0] + Z.centre[1], 0.18) + arbor(TH, 0.14, Z.centre[0] + Z.centre[1] + 0.18, Z.bridge[0] - Z.centre[0] - Z.centre[1] - 0.18); });
  dyn("fourthArbor", () => arbor(FO, 0.14, Z.fourth[0] + Z.fourth[1], Z.bridge[0] - Z.fourth[0] - Z.fourth[1]));

  // ================= barrel bar bridge with ratchet and click =================
  {
    const foot = add(B, pol(5.9, ang(sub(B, C)) - 0.18));
    const ring = blobOutline([[foot, B, 1.35], [B, C, 0.9]], [[B, 2.1], [C, 1.2], [foot, 1.55]]);
    const out = [];
    out.push(cyl(foot, 1.1, 0, Z.bbar[0], "bench"));
    out.push(flatSvg(ring, [], Z.bbar[0], Z.bbar[1], "steel"));
    const top = Z.bbar[0] + Z.bbar[1];
    // jewel at the centre pivot
    out.push(jewel(C, top));
    // screws
    out.push(screw(add(foot, pol(0.2, 1)), top, 0.55, 0.4));
    out.push(screw(add(B, pol(1.75, ang(sub(C, B)) + 1.6)), top, 0.45, -0.3));
    // ratchet wheel (steel) on the barrel arbor, square, screw
    const ratchet = [];
    for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; ratchet.push(add(B, pol(2.75, a)), add(B, pol(3.05, a + 0.7 * TAU / 30)), add(B, pol(2.75, a + 0.72 * TAU / 30))); }
    out.push(flatSvg(ratchet, [], top, 0.24, "grey", { inner: L(ringLine(B, 2.1, top + 0.24, 60) + ringLine(B, 1.5, top + 0.24, 50), { tone: "faint" }) }));
    out.push(screw(B, top + 0.24, 0.95, 0.9));
    // click (pawl) with its spring arm
    const ca = ang(sub(C, B)) - 0.75;
    const pivot = add(B, pol(3.9, ca));
    const tipP = add(B, pol(2.95, ca + 0.42));
    const click = blobOutline([[pivot, tipP, 0.32]], [[pivot, 0.5]]);
    out.push(flatSvg(click, [], top, 0.2, "grey"));
    out.push(screw(pivot, top + 0.2, 0.36, 0.2));
    stat(out.join(""));
  }
  function jewel(c, z) {
    return cyl(c, 0.55, z, 0.05, "gold", { tone: "hi" }, 30) + cyl(c, 0.32, z + 0.05, 0.03, "ruby", { tone: "hi" }, 24) + Dots([at(c[0], c[1], z + 0.08)], { size: 0.55, tone: "hi" });
  }
  function screw(c, z, r, a) {
    return cyl(c, r, z, 0.12, "grey", { tone: "hi" }, 28) + paint("grey", L(k.lineOnTop(add(c, pol(r * 0.99, a)), add(c, pol(r * 0.99, a + Math.PI)), z + 0.12, P), { tone: "hi" }));
  }

  // ================= escape wheel, banking pins, pallet fork =================
  dyn("escape", (S) => {
    const ring = escapeRing(E, S.esc);
    const holes = spokeHoles(E, 5, 0.42, 1.48, 0.2, S.esc + M.TIP0 + 0.3);
    return flatSvg(ring, holes, Z.esc[0], Z.esc[1], "orange") + arbor(E, 0.3, Z.esc[0] + Z.esc[1], 0.06, "orange") + arbor(E, 0.13, Z.esc[0] + Z.esc[1] + 0.06, 0.3);
  });
  // banking pins: steel, either side of the lever
  const BANK_U = 2.25, LW = (uu) => 0.3 - 0.06 * (uu / M.LEVER);
  const bankOff = BANK_U * Math.tan(M.PSI0) + LW(BANK_U) + 0.16;
  const pins = [UV(BANK_U, bankOff), UV(BANK_U, -bankOff)].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  stat(pins.map((p) => cyl(p, 0.16, 0, Z.fork[0] + Z.fork[1] + 0.05, "grey", { tone: "hi" }, 20)).join(""));
  // fork outline (in u,v at psi = 0)
  const forkPlan = (() => {
    const side = (st, sg) => {
      const q = add(E, pol(M.RE, st.a)), d = pol(1, st.a), t = [-d[1] * sg, d[0] * sg];
      const P_ = (a, b) => add(q, [d[0] * a + t[0] * b, d[1] * a + t[1] * b]);
      return { endIn: P_(0.42, -0.31), endOut: P_(0.42, 0.31), backOut: P_(1.3, 0.31), backIn: P_(1.3, -0.31) };
    };
    // which stone is on +v
    const vOf = (st) => { const q = sub(add(E, pol(M.RE, st.a)), A); return q[0] * v[0] + q[1] * v[1]; };
    const sp = vOf(M.entry) > 0 ? M.entry : M.exit, sn = sp === M.entry ? M.exit : M.entry;
    const a = side(sp, 1), b = side(sn, -1);
    const pts = [];
    // notch and horns at the far end (+u)
    const nU = M.LEVER - M.RP;
    pts.push(UV(nU - 0.22, 0.17), UV(nU + 0.3, 0.17), UV(nU + 0.36, 0.24), UV(nU + 0.34, 0.4), UV(nU + 0.18, 0.5), UV(nU - 0.25, 0.46), UV(nU - 0.75, LW(nU - 0.75)));
    pts.push(UV(1.25, LW(1.25)), UV(0.85, 0.42));
    pts.push(a.backIn, a.backOut, a.endOut, a.endIn, UV(-0.12, 0.42), UV(-0.24, 0));
    pts.push(UV(-0.12, -0.42), b.endIn, b.endOut, b.backOut, b.backIn);
    pts.push(UV(0.85, -0.42), UV(1.25, -LW(1.25)));
    pts.push(UV(nU - 0.75, -LW(nU - 0.75)), UV(nU - 0.25, -0.46), UV(nU + 0.18, -0.5), UV(nU + 0.34, -0.4), UV(nU + 0.36, -0.24), UV(nU + 0.3, -0.17), UV(nU - 0.22, -0.17));
    // round the notch bottom
    return pts;
  })();
  dyn("stonesLo", (S) => {
    // the stones' lower ends, under the fork (they reach into the escape wheel's plane)
    return [M.entry, M.exit].map((st) => flatSvg(M.stoneAt(st.a, st.inner0, S.psi), [], Z.stone[0], Z.fork[0] - Z.stone[0], "ruby")).join("");
  });
  dyn("fork", (S) => {
    const ring = forkPlan.map((p) => M.rot(p, A, S.psi));
    const out = [flatSvg(ring, [], Z.fork[0], Z.fork[1], "red")];
    const top = Z.fork[0] + Z.fork[1];
    // stones seen on top of the arms (set in their slots)
    for (const st of [M.entry, M.exit]) out.push(flatSvg(M.stoneAt(st.a, st.inner0, S.psi), [], top - 0.01, 0.03, "ruby"));
    out.push(arbor(A, 0.36, top, 0.06, "red"), arbor(A, 0.12, top + 0.06, 0.25));
    return out.join("");
  });

  // ================= roller, impulse pin, balance staff =================
  const ROLL_A0 = M.LINE + Math.PI;            // impulse pin points at the fork when phi = 0
  dyn("roller", (S) => {
    const a = ROLL_A0 + S.phi;
    const out = [];
    // safety roller: disc with a passing crescent, the impulse pin hangs from it
    const disc = [];
    for (let j = 0; j < 60; j++) { const t = a + (j / 60) * TAU; disc.push(add(BAL, pol(1.1, t))); }
    const pinC = add(BAL, pol(M.RP, a));
    out.push(cyl(pinC, 0.15, Z.pin[0], Z.roller[0] - Z.pin[0], "cream", { tone: "hi" }, 18));
    out.push(flatSvg(disc, [], Z.roller[0], Z.roller[1], "grey"));
    out.push(arbor(BAL, 0.45, Z.roller[0] + Z.roller[1], 0.18));
    out.push(arbor(BAL, 0.14, Z.roller[0] + Z.roller[1] + 0.18, Z.rim[0] - Z.roller[0] - Z.roller[1] - 0.18));
    return out.join("");
  });
  // ================= balance wheel =================
  dyn("balance", (S) => {
    const a = ROLL_A0 + S.phi;
    const rimO = M.BAL_R, rimI = M.BAL_R - 0.5;
    const outer = circ(BAL, rimO, 120, a);
    const holes = spokeHoles(BAL, 3, 0.55, rimI, 0.42, a + 0.3);
    const out = [flatSvg(outer, holes, Z.rim[0], Z.rim[1], "teal")];
    // timing screws on the rim (gold heads), drawn back to front
    const scr = [];
    for (let i = 0; i < 12; i++) scr.push(add(BAL, pol(rimO - 0.25, a + 0.12 + (i / 12) * TAU)));
    scr.sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
    const top = Z.rim[0] + Z.rim[1];
    out.push(scr.map((p) => cyl(p, 0.19, top, 0.08, "gold", { tone: "hi" }, 14)).join(""));
    out.push(arbor(BAL, 0.62, top, 0.06, "teal"), arbor(BAL, 0.14, top + 0.06, Z.spring - top - 0.06));
    return out.join("");
  });
  // ================= hairspring (winds and unwinds with the balance) =================
  const HS = { r0: 0.48, r1: 2.75, turns: 11.5, a0: M.LINE + 1.1 };
  const studA = HS.a0 + HS.turns * TAU;
  dyn("hairspring", (S) => {
    const pts = [];
    const n = Math.round(HS.turns * 56);
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const a = HS.a0 + t * HS.turns * TAU + S.phi * (1 - t);
      const r = HS.r0 + (HS.r1 - HS.r0) * t * (1 + 0.006 * S.phi * (1 - t) * 0);
      pts.push(at(...add(BAL, pol(r * (1 - 0.012 * (S.phi / M.AMP) * (1 - t)), a)), Z.spring));
    }
    const collet = cyl(BAL, 0.42, Z.spring - 0.05, 0.14, "grey", { tone: "hi" }, 24);
    return collet + paint("grey", L(pth(pts), { tone: "hi", className: "wt-hair" })) ;
  });
  // ================= balance bridge with regulator and shock jewel =================
  {
    const t = pol(1, M.LINE + Math.PI / 2 - 0.25);
    const f1 = add(BAL, [t[0] * 6.0, t[1] * 6.0]), f2 = add(BAL, [-t[0] * 6.0, -t[1] * 6.0]);
    const studP = add(BAL, pol(HS.r1, studA));
    const ring = blobOutline([[f1, f2, 0.75]], [[BAL, 1.45], [f1, 1.25], [f2, 1.25]]);
    const out = [];
    out.push([f1, f2].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P)).map((f) => cyl(f, 0.95, 0, Z.balBridge[0], "bench")).join(""));
    // hairspring stud on its carrier, hanging from the bridge
    out.push(cyl(studP, 0.22, Z.spring - 0.1, Z.balBridge[0] - Z.spring + 0.1, "grey", { tone: "hi" }, 16));
    out.push(flatSvg(ring, [], Z.balBridge[0], Z.balBridge[1], "steel"));
    const top = Z.balBridge[0] + Z.balBridge[1];
    // regulator index: a thin arm from the jewel toward f1 with a +/- scale on the bridge
    const ia = ang(sub(f1, BAL)) + 0.28;
    const idx = blobOutline([[BAL, add(BAL, pol(4.1, ia)), 0.17]], [[BAL, 0.95]]);
    out.push(flatSvg(idx, [], top, 0.08, "grey"));
    // shock-absorber jewel: gold setting, ruby cap, lyre spring
    out.push(cyl(BAL, 0.62, top + 0.08, 0.08, "gold", { tone: "hi" }, 30), cyl(BAL, 0.34, top + 0.16, 0.04, "ruby", { tone: "hi" }, 24));
    const lyre = [];
    for (let j = 0; j <= 24; j++) { const a = ia + Math.PI - 1.1 + 2.2 * (j / 24); lyre.push(at(...add(BAL, pol(0.52, a)), top + 0.2)); }
    out.push(paint("grey", L(pth(lyre), { tone: "hi" })));
    out.push(Dots([at(BAL[0], BAL[1], top + 0.2)], { size: 0.5, tone: "hi" }));
    // regulator scale: ticks rooted on a ruled arc
    const sc = [];
    const arcPts = [];
    for (let j = 0; j <= 20; j++) arcPts.push(at(...add(BAL, pol(3.35, ia - 0.3 + 0.6 * (j / 20))), top));
    for (let j = 0; j <= 8; j++) { const a = ia - 0.27 + 0.54 * (j / 8); sc.push(pth([at(...add(BAL, pol(3.35, a)), top), at(...add(BAL, pol(j % 4 === 0 ? 3.85 : 3.65, a)), top)])); }
    out.push(paint("steel", L(pth(arcPts), { tone: "mid" }) + L(sc.join(""), { tone: "mid" })));
    out.push(screw(f1, top, 0.55, 0.6), screw(f2, top, 0.55, 2.2));
    stat(out.join(""));
  }

  // ================= train bridge (third, fourth, escape, pallet pivots) =================
  // painted before the balance? It sits under the balance rim height but beside it: order by height
  const trainBridge = (() => {
    const fa = add(TH, pol(4.35, -88 * D2R)), fb = add(FO, pol(4.3, -4 * D2R));
    const dE = pol(1, ang(sub(E, FO))), CUT = 1.75;
    const far = add(FO, [dE[0] * 3.2, dE[1] * 3.2]);
    let ring = blobOutline([[fa, TH, 0.95], [TH, FO, 0.85], [FO, fb, 0.95], [FO, far, 0.62]], [[TH, 1.05], [FO, 1.05], [fa, 1.3], [fb, 1.3]]);
    // the arm toward the escapement is cut away (section) so the escape wheel and pallets show
    const dist = (p) => (p[0] - FO[0]) * dE[0] + (p[1] - FO[1]) * dE[1] - CUT;
    const clipped = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], dp = dist(p), dq = dist(q);
      if (dp <= 0) clipped.push(p);
      if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); clipped.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    ring = clipped;
    const out = [];
    out.push([fa, fb].map((f) => cyl(f, 1.0, 0, Z.bridge[0], "bench")).join(""));
    const z0 = Z.bridge[0], top = Z.bridge[0] + Z.bridge[1];
    out.push(flatSvg(ring, [], z0, Z.bridge[1], "steel"));
    // cut face: light tint and 45 degree hatching
    const on = ring.filter((p) => Math.abs(dist(p)) < 1e-6);
    if (on.length >= 2) {
      const tv = [-dE[1], dE[0]];
      on.sort((a, b) => (a[0] * tv[0] + a[1] * tv[1]) - (b[0] * tv[0] + b[1] * tv[1]));
      const p0 = on[0], p1 = on[on.length - 1];
      const quad = [at(p0[0], p0[1], top), at(p1[0], p1[1], top), at(p1[0], p1[1], z0), at(p0[0], p0[1], z0)];
      const hatch = [];
      const wl = len(sub(p1, p0));
      for (let s2 = -0.6; s2 < wl + 0.6; s2 += 0.16) {
        // a 45 degree line in the cut plane: along the face by +h as it drops by h
        const a0 = Math.max(0, s2), a1 = Math.min(wl, s2 + Z.bridge[1]);
        if (a1 <= a0) continue;
        const zA = top - (a0 - s2), zB = top - (a1 - s2);
        const P0 = add(p0, [tv[0] * a0, tv[1] * a0]), P1 = add(p0, [tv[0] * a1, tv[1] * a1]);
        hatch.push(pth([at(P0[0], P0[1], zA), at(P1[0], P1[1], zB)]));
      }
      out.push(`<g class="pc-steel"><path class="wt-cut" d="${pth(quad, true)}"/>` + L(hatch.join(""), { tone: "mid", className: "wt-hatchline" }) + `<path class="iso-line" data-tone="hi" d="${pth(quad, true)}"/></g>`);
    }
    out.push(jewel(TH, top), jewel(FO, top));
    out.push(screw(fa, top, 0.6, 0.4), screw(fb, top, 0.6, 1.9));
    return { svg: out.join(""), top };
  })();
  // order: bridges after all wheels and the fork (they are higher), balance after the train bridge
  const idxFork = list.findIndex((x) => x.dyn === "fork");
  // move the balance bridge + its slots: rebuild order explicitly
  const order = ["fourthPinionLo", "third", "fourthPinionHi", "escPinionLo", "fourth", "escPinionHi", "thirdPinionLo", "centrePinion", "centre", "thirdPinionHi", "fourthArbor"];
  const named = {};
  const statics = [];
  // statics in declaration order: halo, feet, holder ring, plate, lip, jaws, barrel, barbridge, pins, balance bridge
  for (const it of list) if (!it.dyn) statics.push(it);
  const out = [];
  out.push(statics[0], statics[1], statics[2], statics[3], statics[4], statics[5], statics[6]);
  for (const n of order) out.push({ dyn: n });
  out.push(statics[7]);                         // barrel bar bridge (z 1.78..2.18)
  out.push({ dyn: "escape" }, statics[8], { dyn: "stonesLo" }, { dyn: "fork" }, { dyn: "roller" });
  out.push({ svg: opts.dynOnly ? "" : trainBridge.svg });
  out.push({ dyn: "seconds" });
  out.push({ dyn: "balance" }, { dyn: "hairspring" }, statics[9]);
  dyns.seconds = (S) => {
    const R = rotOf(S);
    const z = trainBridge.top;
    const a = R.f - 40 * D2R;               // points away from the escapement
    const out2 = [arbor(FO, 0.42, z, 0.35, "grey")];
    const hand = blobOutline([[add(FO, pol(-1.3, a)), add(FO, pol(4.4, a)), 0.08]], [[FO, 0.38], [add(FO, pol(-1.3, a)), 0.26]], 0.035);
    out2.push(flatSvg(hand, [], z + 0.35, 0.06, "blued"));
    out2.push(Dots([at(FO[0], FO[1], z + 0.41)], { size: 0.55, tone: "hi" }));
    return out2.join("");
  };
  return { list: out, dyn: (name, S) => dyns[name](S), Z };
}

export { makeScene };
