// Tour scene of the watch movement (chapter short). Plain script: makeScene2(k, M, P, opts) -> { list, xlist, dyn(name, S), blur(name), Z, geo }.
// Every painted group carries data-p="<part>" so the page can tint it (highlight red / recede toward paper).
// S = { esc, phi, psi, barrel, arbor, crown, click, N } (see tour.js stateAt).
function makeScene2(k, M, P, opts) {
  opts = opts || {};
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const { pol, add, sub, len, ang } = M;
  const cam = k.cameraOf(P);
  const VIEW = [cam.cosA, cam.sinA], LIGHT = [-cam.sinA, cam.cosA];
  const V3 = [cam.cosA * cam.cosE, cam.sinA * cam.cosE, cam.sinE];
  const at = (x, y, z) => k.iso([x, y, z], P);
  const fmt = (v) => Math.round(v * 100) / 100;
  const pth = (pts, closed) => { if (!pts.length) return ""; let s = "M" + fmt(pts[0][0]) + " " + fmt(pts[0][1]); for (let i = 1; i < pts.length; i++) s += "L" + fmt(pts[i][0]) + " " + fmt(pts[i][1]); return closed ? s + "Z" : s; };
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const orient = (pts, sign) => (Math.sign(area(pts)) === sign ? pts : pts.slice().reverse());
  const S_ = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const Dots = (pts, style) => k.dotsSvg(pts, style);
  let PART = "plate";
  const paint = (col, svg) => `<g class="pc-${col}" data-p="${PART}">${svg}</g>`;
  const circ = (c, r, n, a0) => Array.from({ length: n }, (_, i) => add(c, pol(r, (a0 || 0) + (i / n) * TAU)));
  const stepsFor = (r) => Math.max(24, Math.min(140, Math.round(r * 22)));
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  // ---------- a flat part of any outline, with holes, z..z+h, kit-style four-tone sides ----------
  function flat(outer, holes, z, h) {
    holes = holes || [];
    const ccw = (pts) => (area(pts) > 0 ? pts : pts.slice().reverse());
    outer = ccw(outer); holes = holes.map(ccw);
    const T = (p) => at(p[0], p[1], z + h), Bt = (p) => at(p[0], p[1], z);
    const scr = outer.map(T);
    const sgn = Math.sign(area(scr)) || 1;
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
  const flatSvg = (outer, holes, z, h, col, style) => paint(col, S_(flat(outer, holes, z, h), Object.assign({ tone: "hi", crease: "faint" }, style || {})));
  const cyl = (c, r, z, h, col, style, steps) => paint(col, S_(k.cylinder(c[0], c[1], r, z, h, P, steps || stepsFor(r)), Object.assign({ tone: "hi" }, style || {})));
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
      const a = M.TIP0 + i * M.PITCH + rot;
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

  // ---------- union of capsules -> one outline (marching squares on a smooth-min distance field) ----------
  function blobOutline(caps, discs, step) {
    step = step || 0.06;
    const xs = [], ys = [];
    for (const [a, b, w] of caps) { xs.push(a[0] - w, b[0] - w, a[0] + w, b[0] + w); ys.push(a[1] - w, b[1] - w, a[1] + w, b[1] + w); }
    for (const [c, r] of discs) { xs.push(c[0] - r, c[0] + r); ys.push(c[1] - r, c[1] + r); }
    const x0 = Math.min(...xs) - 0.3, y0 = Math.min(...ys) - 0.3, nx = Math.ceil((Math.max(...xs) + 0.3 - x0) / step), ny = Math.ceil((Math.max(...ys) + 0.3 - y0) / step);
    const V = new Float64Array((nx + 1) * (ny + 1));
    const FIL = 0.35;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const p = [x0 + i * step, y0 + j * step];
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
      if ((a < 0) !== (b < 0)) e.push(lerp(pa, pb, a, b));
      if ((b < 0) !== (c < 0)) e.push(lerp(pb, pc, b, c));
      if ((c < 0) !== (d < 0)) e.push(lerp(pc, pd, c, d));
      if ((d < 0) !== (a < 0)) e.push(lerp(pd, pa, d, a));
      if (e.length === 2) segs.push([e[0], e[1]]);
      else if (e.length === 4) { segs.push([e[0], e[1]]); segs.push([e[2], e[3]]); }
    }
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
  const BBTOP = Z.bbar[0] + Z.bbar[1];

  // ---------- keyless works (crown wheel on the barrel bridge, winding pinion + stem + crown) ----------
  const RAT_R = 2.95, RAT_N = 30;                     // ratchet: 30 teeth on the barrel arbor
  const CW_R = 1.5, CW_N = 15;                        // crown wheel: 15 teeth
  const CW = add(B, pol(RAT_R + CW_R + 0.12, 235 * D2R));
  const SDIR = pol(1, ang(CW));                       // stem runs radially through the crown wheel
  const WP_R = 0.5, STEM_Z = BBTOP - WP_R - 0.02;     // winding pinion under the crown wheel's rim
  const sCW = len(CW);
  const WPs = [sCW + 1.05, sCW + 1.95];
  const ST1 = sCW + 5.2;                              // stem end (crown starts) radius
  const CR0 = ST1, CR1 = ST1 + 2.3, CR_R = 2.1;

  const out = [];
  const dyns = {};
  const blurs = {};                                   // time-independent "spinning too fast to see" pictures
  const stat = (svg, g) => out.push({ svg: opts.dynOnly ? "" : (g ? `<g data-g="${g}">${svg}</g>` : svg) });
  const slot = (name, g) => out.push(g ? { dyn: name, g } : { dyn: name });
  const def = (name, fn) => { dyns[name] = (S) => { const keep = PART; const r = fn(S); PART = keep; return r; }; };
  const defBlur = (name, fn) => { blurs[name] = () => { const keep = PART; const r = fn(); PART = keep; return r; }; };

  // ================= holder, plate =================
  PART = "holder";
  const HOLD_R = M.PLATE_R + 1.75, HOLD_IN = M.PLATE_R + 0.12;
  stat(`<path class="iso-halo" d="${k.cylinder(0, 0, HOLD_R + 0.6, -3.4, 0.2, P, 90).fill}"/>`);
  const feetA = [100, 220, 340].map((d) => d * D2R + 0.3);
  const feet = feetA.map((a) => pol(HOLD_R - 1.6, a)).sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  stat(feet.map((p) => cyl(p, 1.3, -3.4, 1.6, "steel", { tone: "hi" })).join(""));
  stat(flatSvg(circ([0, 0], HOLD_R, 150), [circ([0, 0], HOLD_IN, 140)], -1.8, 1.8, "bench", {
    inner: L(k.sideArc(0, 0, HOLD_R, -0.9, P, 120), { tone: "faint" }),
  }));
  PART = "plate";
  {
    const plate = flatSvg(circ([0, 0], M.PLATE_R, 150), [], Z.plate[0], 1.2, "bench", { inner: L(k.sideArc(0, 0, M.PLATE_R, -0.55, P, 120), { tone: "faint" }) });
    const rings = [];
    for (let x = -12; x <= 12; x += 0.95) for (let y = -12; y <= 12; y += 0.82) {
      const c = [x + ((Math.round(y / 0.82) & 1) ? 0.47 : 0), y];
      if (len(c) > M.PLATE_R - 1.0) continue;
      rings.push(ringLine(c, 0.5, 0, 12));
    }
    const sinks = [B, C, TH, FO, E, A, BAL].map((c) => ringLine(c, 1.15, 0, 30)).join("");
    stat(plate + paint("bench", L(rings.join(""), { tone: "faint", className: "wt-perlage" }) + L(sinks, { tone: "lo" })));
  }
  PART = "holder";
  stat(flatSvg(circ([0, 0], HOLD_R, 150), [circ([0, 0], HOLD_IN, 140)], 0, 0.35, "bench"));
  {
    const jaws = [40, 160, 280].map((d) => d * D2R);
    const o = [];
    for (const a of jaws.sort((p, q) => k.depthOf([Math.cos(p), Math.sin(p), 0], P) - k.depthOf([Math.cos(q), Math.sin(q), 0], P))) {
      const w = 0.17;
      const ring = [];
      for (let j = 0; j <= 10; j++) ring.push(pol(HOLD_R - 0.4, a - w + 2 * w * (j / 10)));
      for (let j = 10; j >= 0; j--) ring.push(pol(M.PLATE_R - 0.9, a - w * 0.8 + 1.6 * w * (j / 10)));
      o.push(flatSvg(ring, [], 0.35, 0.45, "steel"));
      const sc = pol(HOLD_R - 1.15, a);
      o.push(cyl(sc, 0.62, 0.8, 0.28, "grey"));
      o.push(paint("grey", L(k.lineOnTop(add(sc, pol(0.61, a + 1.0)), add(sc, pol(0.61, a + 1.0 + Math.PI)), 1.08, P), { tone: "hi" })));
    }
    stat(o.join(""));
  }

  // ================= mainspring (one function for the main cut and the x-ray loupe) =================
  // N = turns from the wall hook to the arbor hook; fixed length, so more turns pack the coils toward the arbor.
  const SPR = { rA: 1.12, rD: 4.38, L: Math.PI * 9.8 * (1.12 + 4.2) };
  function springPts(S, z) {
    const N = S.N;
    let ro = SPR.L / (Math.PI * N) - SPR.rA, ri = SPR.rA;
    if (ro > SPR.rD - 0.05) { ro = SPR.rD - 0.05; ri = SPR.L / (Math.PI * N) - ro; }
    const th0 = S.barrel + 0.9;                       // wall hook turns with the barrel
    const n = Math.round(N * 64), pts = [];
    const u1 = 0.45 / N, u2 = 0.3 / N;
    for (let j = 0; j <= n; j++) {
      const uu = j / n;
      let r = uu < u1 ? SPR.rD + (ro - SPR.rD) * smooth(uu / u1) : ro + (ri - ro) * ((uu - u1) / (1 - u1));
      if (uu > 1 - u2) r += (SPR.rA - ri) * smooth((uu - (1 - u2)) / u2);
      pts.push(at(...add(B, pol(r, th0 + uu * N * TAU)), z));
    }
    return pts;
  }
  const springSvg = (S, z) => { PART = "spring"; const d = pth(springPts(S, z)); return paint("grey", `<path class="wt-sp-o" d="${d}"/><path class="wt-sp-i" d="${d}"/>`); };

  // ================= barrel =================
  PART = "barrel";
  stat(flatSvg(circ(B, M.rB - 0.18, 140), [], Z.barrel[0], Z.bTeeth[0] - Z.barrel[0], "gold", { inner: L(k.sideArc(B[0], B[1], M.rB - 0.18, 0.6, P, 90), { tone: "faint" }) }));
  const CUT = [48 * D2R, 140 * D2R];
  const cutSector = (() => { const s = [B]; for (let j = 0; j <= 30; j++) s.push(add(B, pol(M.rB - 0.55, CUT[0] + (CUT[1] - CUT[0]) * (j / 30)))); return s; })();
  const cutClipD = pth(cutSector.map((p) => at(p[0], p[1], Z.bTeeth[1])), true);
  stat(`<defs><clipPath id="wt-cut"><path d="${cutClipD}"/></clipPath></defs>`);
  def("barrel", (S) => {
    PART = "barrel";
    const o = [];
    const teeth = gearRing(B, M.T.barrel.N, M.rB, M.T.barrel.m, ang(sub(C, B)) + S.barrel, "wheel");
    o.push(flatSvg(teeth, [circ(B, M.rB - 0.55, 120)], Z.bTeeth[0], Z.bTeeth[1] - Z.bTeeth[0], "gold"));
    o.push(`<g clip-path="url(#wt-cut)">` + paint("gold", `<path class="wt-floor" d="${cutClipD}"/>`) + springSvg(S, 1.15) + `</g>`);
    PART = "barrel";
    const lid = [B];
    for (let j = 0; j <= 100; j++) lid.push(add(B, pol(M.rB - 0.5, CUT[1] + (TAU - (CUT[1] - CUT[0])) * (j / 100))));
    o.push(flatSvg(lid, [], Z.bTeeth[1] - 0.22, 0.22, "gold", { inner: L(ringLine(B, 3.2, Z.bTeeth[1], 60), { tone: "faint" }) }));
    const cutFace = (a) => {
      const p0 = add(B, pol(1.0, a)), p1 = add(B, pol(M.rB - 0.18, a));
      const q = [at(p0[0], p0[1], Z.bTeeth[1]), at(p1[0], p1[1], Z.bTeeth[1]), at(p1[0], p1[1], Z.bTeeth[1] - 0.22), at(p0[0], p0[1], Z.bTeeth[1] - 0.22)];
      return `<path class="wt-cutface" d="${pth(q, true)}"/>`;
    };
    o.push(paint("gold", cutFace(CUT[0]) + cutFace(CUT[1])));
    PART = "ratchet";
    o.push(cyl(B, 1.0, Z.barrel[0], Z.bTeeth[1] + 0.12 - Z.barrel[0], "grey"));
    return o.join("");
  });
  slot("barrel");

  // ================= train =================
  const wheelSvg = (c, N, r, m, phase, z, h, col, spokes, hub) => {
    const ring = gearRing(c, N, r, m, phase, "wheel");
    const holes = spokes ? spokeHoles(c, spokes, hub, r - 1.25 * m - Math.max(0.45, r * 0.12), Math.max(0.3, r * 0.075), phase) : [];
    return flatSvg(ring, holes, z, h, col);
  };
  // the same wheel spinning too fast to see: a translucent disc to the pitch circle
  const wheelBlur = (c, r, m, z, h, col) => `<g opacity=".5">` + flatSvg(circ(c, r + 0.35 * m, 120), [], z, h, col) + `</g>`;
  const pinionSvg = (c, n, r, m, phase, z, h) => flatSvg(gearRing(c, n, r, m, phase, "pinion"), [], z, h, "grey");
  const pinionBlur = (c, r, m, z, h) => flatSvg(circ(c, r + 0.2 * m, 40), [], z, h, "grey");
  const arbor = (c, r, z, h, col) => cyl(c, r, z, h, col || "grey", { tone: "hi" }, 24);
  const ph = {
    cP: ang(sub(B, C)) + Math.PI / M.T.centre.n, cW: ang(sub(TH, C)),
    tP: ang(sub(C, TH)) + Math.PI / M.T.third.n, tW: ang(sub(FO, TH)),
    fP: ang(sub(TH, FO)) + Math.PI / M.T.fourth.n, fW: ang(sub(E, FO)),
    eP: ang(sub(FO, E)) + Math.PI / M.T.escape.n,
  };
  const rotOf = (S) => ({ e: S.esc, f: S.esc * M.ratio.fourth, t: S.esc * M.ratio.third, c: S.esc * M.ratio.centre });
  const Zf = Z.fourth, Zt = Z.third, Zc = Z.centre;
  def("fourthPinionLo", (S) => { PART = "fourth"; return pinionSvg(FO, M.T.fourth.n, M.rFp, M.T.third.m, ph.fP + rotOf(S).f, 0.25, Zt[0] - 0.25); });
  defBlur("fourthPinionLo", () => { PART = "fourth"; return pinionBlur(FO, M.rFp, M.T.third.m, 0.25, Zt[0] - 0.25); });
  def("third", (S) => { PART = "third"; return wheelSvg(TH, M.T.third.N, M.rT, M.T.third.m, ph.tW + rotOf(S).t, Zt[0], Zt[1], "gold", 4, 0.75) + arbor(TH, 0.62, Zt[0] + Zt[1], 0.08, "gold"); });
  defBlur("third", () => { PART = "third"; return wheelBlur(TH, M.rT, M.T.third.m, Zt[0], Zt[1], "gold") + arbor(TH, 0.62, Zt[0] + Zt[1], 0.08, "gold"); });
  def("fourthPinionHi", (S) => { PART = "fourth"; return pinionSvg(FO, M.T.fourth.n, M.rFp, M.T.third.m, ph.fP + rotOf(S).f, Zt[0] + Zt[1], Zf[0] - Zt[0] - Zt[1]); });
  defBlur("fourthPinionHi", () => { PART = "fourth"; return pinionBlur(FO, M.rFp, M.T.third.m, Zt[0] + Zt[1], Zf[0] - Zt[0] - Zt[1]); });
  def("escPinionLo", (S) => { PART = "escape"; return pinionSvg(E, M.T.escape.n, M.rEp, M.T.fourth.m, ph.eP + S.esc, 0.7, Zf[0] - 0.7); });
  defBlur("escPinionLo", () => { PART = "escape"; return pinionBlur(E, M.rEp, M.T.fourth.m, 0.7, Zf[0] - 0.7); });
  def("fourth", (S) => { PART = "fourth"; return wheelSvg(FO, M.T.fourth.N, M.rF, M.T.fourth.m, ph.fW + rotOf(S).f, Zf[0], Zf[1], "gold", 4, 0.62) + arbor(FO, 0.5, Zf[0] + Zf[1], 0.08, "gold"); });
  defBlur("fourth", () => { PART = "fourth"; return wheelBlur(FO, M.rF, M.T.fourth.m, Zf[0], Zf[1], "gold") + arbor(FO, 0.5, Zf[0] + Zf[1], 0.08, "gold"); });
  const escHi = () => arbor(E, 0.13, Zf[0] + Zf[1] + 0.25, Z.esc[0] - Zf[0] - Zf[1] - 0.25);
  def("escPinionHi", (S) => { PART = "escape"; return pinionSvg(E, M.T.escape.n, M.rEp, M.T.fourth.m, ph.eP + S.esc, Zf[0] + Zf[1], 0.25) + escHi(); });
  defBlur("escPinionHi", () => { PART = "escape"; return pinionBlur(E, M.rEp, M.T.fourth.m, Zf[0] + Zf[1], 0.25) + escHi(); });
  def("thirdPinionLo", (S) => { PART = "third"; return pinionSvg(TH, M.T.third.n, M.rTp, M.T.centre.m, ph.tP + rotOf(S).t, Zt[0] + Zt[1], Zc[0] - Zt[0] - Zt[1]); });
  defBlur("thirdPinionLo", () => { PART = "third"; return pinionBlur(TH, M.rTp, M.T.centre.m, Zt[0] + Zt[1], Zc[0] - Zt[0] - Zt[1]); });
  def("centrePinion", (S) => { PART = "centre"; return pinionSvg(C, M.T.centre.n, M.rCp, M.T.barrel.m, ph.cP + rotOf(S).c, 0.9, Zc[0] - 0.9); });
  def("centre", (S) => { PART = "centre"; return wheelSvg(C, M.T.centre.N, M.rC, M.T.centre.m, ph.cW + rotOf(S).c, Zc[0], Zc[1], "gold", 4, 1.0) + arbor(C, 0.85, Zc[0] + Zc[1], 0.1, "gold") + arbor(C, 0.35, Zc[0] + Zc[1] + 0.1, Z.bbar[0] - Zc[0] - Zc[1] - 0.1); });
  const thHi = () => arbor(TH, 0.14, Zc[0] + Zc[1] + 0.18, Z.bridge[0] - Zc[0] - Zc[1] - 0.18);
  def("thirdPinionHi", (S) => { PART = "third"; return pinionSvg(TH, M.T.third.n, M.rTp, M.T.centre.m, ph.tP + rotOf(S).t, Zc[0] + Zc[1], 0.18) + thHi(); });
  defBlur("thirdPinionHi", () => { PART = "third"; return pinionBlur(TH, M.rTp, M.T.centre.m, Zc[0] + Zc[1], 0.18) + thHi(); });
  def("fourthArbor", () => { PART = "fourth"; return arbor(FO, 0.14, Zf[0] + Zf[1], Z.bridge[0] - Zf[0] - Zf[1]); });
  for (const n of ["fourthPinionLo", "third", "fourthPinionHi", "escPinionLo", "fourth", "escPinionHi", "thirdPinionLo", "centrePinion", "centre", "thirdPinionHi", "fourthArbor"]) slot(n);

  function jewel(c, z) {
    return cyl(c, 0.55, z, 0.05, "gold", { tone: "hi" }, 30) + cyl(c, 0.32, z + 0.05, 0.03, "ruby", { tone: "hi" }, 24) + Dots([at(c[0], c[1], z + 0.08)], { size: 0.55, tone: "hi" });
  }
  function screw(c, z, r, a) {
    return cyl(c, r, z, 0.12, "grey", { tone: "hi" }, 28) + paint("grey", L(k.lineOnTop(add(c, pol(r * 0.99, a)), add(c, pol(r * 0.99, a + Math.PI)), z + 0.12, P), { tone: "hi" }));
  }

  // ================= stem, winding pinion and crown (bodies prebuilt with the kit's lathe; turning ribs drawn here) =================
  const SF = (() => { const a = [SDIR[0], SDIR[1], 0], w = [0, 0, 1], uu = [a[1] * w[2] - a[2] * w[1], a[2] * w[0] - a[0] * w[2], a[0] * w[1] - a[1] * w[0]]; return { a, u: uu, v: w }; })();
  const axisPt = (s, r, th, z0) => { const c = Math.cos(th), sn = Math.sin(th); return [SF.a[0] * s + r * (c * SF.u[0] + sn * SF.v[0]), SF.a[1] * s + r * (c * SF.u[1] + sn * SF.v[1]), z0 + r * (c * SF.u[2] + sn * SF.v[2])]; };
  function ribs(s0, s1, r, n, phase, z0, cls) {
    const o = [];
    for (let i = 0; i < n; i++) {
      const th = phase + (i / n) * TAU;
      const nrm = [Math.cos(th) * SF.u[0] + Math.sin(th) * SF.v[0], Math.cos(th) * SF.u[1] + Math.sin(th) * SF.v[1], Math.cos(th) * SF.u[2] + Math.sin(th) * SF.v[2]];
      const d = nrm[0] * V3[0] + nrm[1] * V3[1] + nrm[2] * V3[2];
      if (d <= 0.04) continue;
      const op = smooth((d - 0.04) / 0.3);
      const p0 = at(...axisPt(s0, r, th, z0)), p1 = at(...axisPt(s1, r, th, z0));
      o.push(`<path class="iso-line ${cls || ""}" data-tone="hi" stroke-opacity="${op.toFixed(2)}" d="${pth([p0, p1])}"/>`);
    }
    return o.join("");
  }
  PART = "crown";
  if (opts.pre) stat(paint("steel", S_(opts.pre.stem, { tone: "hi" })) + paint("steel", S_(opts.pre.crown, { tone: "hi" })));
  def("crownRibs", (S) => { PART = "crown"; return paint("steel", ribs(CR0 + 0.3, CR1 - 0.22, CR_R, 18, S.crown, STEM_Z, "wt-knurl")); });
  slot("crownRibs");
  PART = "wpinion";
  if (opts.pre) stat(paint("grey", S_(opts.pre.wpinion, { tone: "hi" })));
  def("wpRibs", (S) => { PART = "wpinion"; return paint("grey", ribs(WPs[0], WPs[1], WP_R, 12, S.crown + 0.1, STEM_Z, "wt-knurl")); });
  slot("wpRibs");

  // ================= barrel bridge (static) with crown wheel, ratchet and click (turning) =================
  {
    PART = "bbridge";
    const foot = add(B, pol(5.9, ang(sub(B, C)) - 0.18));
    const ring = blobOutline([[foot, B, 1.35], [B, C, 0.9], [B, CW, 0.7]], [[B, 2.1], [C, 1.2], [foot, 1.55], [CW, 0.8]]);
    const o = [];
    o.push(cyl(foot, 1.1, 0, Z.bbar[0], "bench"));
    o.push(flatSvg(ring, [], Z.bbar[0], Z.bbar[1], "steel"));
    o.push(jewel(C, BBTOP));
    o.push(screw(add(foot, pol(0.2, 1)), BBTOP, 0.55, 0.4));
    o.push(screw(add(B, pol(1.75, ang(sub(C, B)) + 1.6)), BBTOP, 0.45, -0.3));
    stat(o.join(""), "bbridge");
  }
  const clickPivot = add(B, pol(3.9, ang(sub(C, B)) - 0.75));
  const clickTip0 = add(B, pol(2.95, ang(sub(C, B)) - 0.75 + 0.42));
  const RAT_P = TAU / RAT_N;
  def("crownWheel", (S) => {
    PART = "crownwheel";
    const a = -2 * S.arbor + 0.1;
    const teeth = [];
    for (let i = 0; i < CW_N; i++) { const b = a + (i / CW_N) * TAU; teeth.push(add(CW, pol(CW_R - 0.12, b - 0.12)), add(CW, pol(CW_R + 0.2, b - 0.055)), add(CW, pol(CW_R + 0.2, b + 0.055)), add(CW, pol(CW_R - 0.12, b + 0.12)), add(CW, pol(CW_R - 0.2, b + TAU / CW_N / 2))); }
    return flatSvg(teeth, [], BBTOP, 0.22, "grey", { inner: L(ringLine(CW, 0.95, BBTOP + 0.22, 40), { tone: "faint" }) }) + screw(CW, BBTOP + 0.22, 0.52, a + 0.6);
  });
  def("ratchet", (S) => {
    PART = "ratchet";
    const a0 = S.arbor;
    const r = [];
    for (let i = 0; i < RAT_N; i++) { const a = a0 + i * RAT_P; r.push(add(B, pol(2.65, a)), add(B, pol(RAT_R, a + 0.7 * RAT_P)), add(B, pol(2.65, a + 0.72 * RAT_P))); }
    return flatSvg(r, [], BBTOP, 0.24, "grey", { inner: L(ringLine(B, 2.1, BBTOP + 0.24, 60) + ringLine(B, 1.5, BBTOP + 0.24, 50), { tone: "faint" }) }) + screw(B, BBTOP + 0.24, 0.95, 0.9 + a0);
  });
  def("click", (S) => {
    PART = "click";
    const tip = M.rot(clickTip0, clickPivot, -S.click);
    const c = blobOutline([[clickPivot, tip, 0.3]], [[clickPivot, 0.5]], 0.08);
    return flatSvg(c, [], BBTOP, 0.2, "grey") + screw(clickPivot, BBTOP + 0.2, 0.36, 0.2);
  });
  slot("crownWheel", "bbridge"); slot("ratchet", "bbridge"); slot("click", "bbridge");

  // ================= escape wheel, banking pins, pallet fork =================
  def("escape", (S) => {
    PART = "escape";
    const ring = escapeRing(E, S.esc);
    const holes = spokeHoles(E, 5, 0.42, 1.48, 0.2, S.esc + M.TIP0 + 0.3);
    return flatSvg(ring, holes, Z.esc[0], Z.esc[1], "orange") + arbor(E, 0.3, Z.esc[0] + Z.esc[1], 0.06, "orange") + arbor(E, 0.13, Z.esc[0] + Z.esc[1] + 0.06, 0.3);
  });
  defBlur("escape", () => { PART = "escape"; return `<g opacity=".55">` + flatSvg(circ(E, M.RE - 0.2, 90), [], Z.esc[0], Z.esc[1], "orange") + `</g>` + arbor(E, 0.3, Z.esc[0] + Z.esc[1], 0.06, "orange") + arbor(E, 0.13, Z.esc[0] + Z.esc[1] + 0.06, 0.3); });
  slot("escape");
  const BANK_U = 2.25, LW = (uu) => 0.3 - 0.06 * (uu / M.LEVER);
  const bankOff = BANK_U * Math.tan(M.PSI0) + LW(BANK_U) + 0.16;
  const pins = [UV(BANK_U, bankOff), UV(BANK_U, -bankOff)].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  PART = "banking";
  stat(pins.map((p) => cyl(p, 0.16, 0, Z.fork[0] + Z.fork[1] + 0.05, "grey", { tone: "hi" }, 20)).join(""));
  const forkPlan = (() => {
    const side = (st, sg) => {
      const q = add(E, pol(M.RE, st.a)), d = pol(1, st.a), t = [-d[1] * sg, d[0] * sg];
      const P_ = (a, b) => add(q, [d[0] * a + t[0] * b, d[1] * a + t[1] * b]);
      return { endIn: P_(0.42, -0.31), endOut: P_(0.42, 0.31), backOut: P_(1.3, 0.31), backIn: P_(1.3, -0.31) };
    };
    const vOf = (st) => { const q = sub(add(E, pol(M.RE, st.a)), A); return q[0] * v[0] + q[1] * v[1]; };
    const sp = vOf(M.entry) > 0 ? M.entry : M.exit, sn = sp === M.entry ? M.exit : M.entry;
    const a = side(sp, 1), b = side(sn, -1);
    const pts = [];
    const nU = M.LEVER - M.RP;
    pts.push(UV(nU - 0.22, 0.17), UV(nU + 0.3, 0.17), UV(nU + 0.36, 0.24), UV(nU + 0.34, 0.4), UV(nU + 0.18, 0.5), UV(nU - 0.25, 0.46), UV(nU - 0.75, LW(nU - 0.75)));
    pts.push(UV(1.25, LW(1.25)), UV(0.85, 0.42));
    pts.push(a.backIn, a.backOut, a.endOut, a.endIn, UV(-0.12, 0.42), UV(-0.24, 0));
    pts.push(UV(-0.12, -0.42), b.endIn, b.endOut, b.backOut, b.backIn);
    pts.push(UV(0.85, -0.42), UV(1.25, -LW(1.25)));
    pts.push(UV(nU - 0.75, -LW(nU - 0.75)), UV(nU - 0.25, -0.46), UV(nU + 0.18, -0.5), UV(nU + 0.34, -0.4), UV(nU + 0.36, -0.24), UV(nU + 0.3, -0.17), UV(nU - 0.22, -0.17));
    return pts;
  })();
  def("stonesLo", (S) => { PART = "fork"; return [M.entry, M.exit].map((st) => flatSvg(M.stoneAt(st.a, st.inner0, S.psi), [], Z.stone[0], Z.fork[0] - Z.stone[0], "plum")).join(""); });
  def("fork", (S) => {
    PART = "fork";
    const ring = forkPlan.map((p) => M.rot(p, A, S.psi));
    const o = [flatSvg(ring, [], Z.fork[0], Z.fork[1], "teal")];
    const top = Z.fork[0] + Z.fork[1];
    for (const st of [M.entry, M.exit]) o.push(flatSvg(M.stoneAt(st.a, st.inner0, S.psi), [], top - 0.01, 0.03, "plum"));
    o.push(arbor(A, 0.36, top, 0.06, "teal"), arbor(A, 0.12, top + 0.06, 0.25));
    return o.join("");
  });
  const ROLL_A0 = M.LINE + Math.PI;
  def("roller", (S) => {
    PART = "roller";
    const a = ROLL_A0 + S.phi;
    const o = [];
    const disc = [];
    for (let j = 0; j < 60; j++) { const t = a + (j / 60) * TAU; disc.push(add(BAL, pol(0.66, t))); }
    const pinC = add(BAL, pol(M.RP, a));
    o.push(cyl(pinC, 0.15, Z.pin[0], Z.roller[0] - Z.pin[0], "cream", { tone: "hi" }, 18));
    o.push(flatSvg(disc, [], Z.roller[0], Z.roller[1], "grey"));
    o.push(arbor(BAL, 0.45, Z.roller[0] + Z.roller[1], 0.18));
    o.push(arbor(BAL, 0.14, Z.roller[0] + Z.roller[1] + 0.18, Z.rim[0] - Z.roller[0] - Z.roller[1] - 0.18));
    return o.join("");
  });
  slot("stonesLo"); slot("fork"); slot("roller");

  // ================= train bridge (static, ghostable) =================
  const trainBridge = (() => {
    PART = "tbridge";
    const fa = add(TH, pol(4.35, -88 * D2R)), fb = add(FO, pol(4.3, -4 * D2R));
    const dE = pol(1, ang(sub(E, FO))), CUTD = 1.75;
    const far = add(FO, [dE[0] * 3.2, dE[1] * 3.2]);
    let ring = blobOutline([[fa, TH, 0.95], [TH, FO, 0.85], [FO, fb, 0.95], [FO, far, 0.62]], [[TH, 1.05], [FO, 1.05], [fa, 1.3], [fb, 1.3]]);
    const dist = (p) => (p[0] - FO[0]) * dE[0] + (p[1] - FO[1]) * dE[1] - CUTD;
    const clipped = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], dp = dist(p), dq = dist(q);
      if (dp <= 0) clipped.push(p);
      if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); clipped.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    ring = clipped;
    const o = [];
    o.push([fa, fb].map((f) => cyl(f, 1.0, 0, Z.bridge[0], "bench")).join(""));
    const z0 = Z.bridge[0], top = Z.bridge[0] + Z.bridge[1];
    o.push(flatSvg(ring, [], z0, Z.bridge[1], "steel"));
    const on = ring.filter((p) => Math.abs(dist(p)) < 1e-6);
    if (on.length >= 2) {
      const tv = [-dE[1], dE[0]];
      on.sort((a, b) => (a[0] * tv[0] + a[1] * tv[1]) - (b[0] * tv[0] + b[1] * tv[1]));
      const p0 = on[0], p1 = on[on.length - 1];
      const quad = [at(p0[0], p0[1], top), at(p1[0], p1[1], top), at(p1[0], p1[1], z0), at(p0[0], p0[1], z0)];
      const hatch = [];
      const wl = len(sub(p1, p0));
      for (let s2 = -0.6; s2 < wl + 0.6; s2 += 0.16) {
        const a0 = Math.max(0, s2), a1 = Math.min(wl, s2 + Z.bridge[1]);
        if (a1 <= a0) continue;
        const zA = top - (a0 - s2), zB = top - (a1 - s2);
        const P0 = add(p0, [tv[0] * a0, tv[1] * a0]), P1 = add(p0, [tv[0] * a1, tv[1] * a1]);
        hatch.push(pth([at(P0[0], P0[1], zA), at(P1[0], P1[1], zB)]));
      }
      o.push(`<g class="pc-steel" data-p="tbridge"><path class="wt-cut" d="${pth(quad, true)}"/>` + L(hatch.join(""), { tone: "mid", className: "wt-hatchline" }) + `<path class="iso-line" data-tone="hi" d="${pth(quad, true)}"/></g>`);
    }
    o.push(jewel(TH, top), jewel(FO, top));
    o.push(screw(fa, top, 0.6, 0.4), screw(fb, top, 0.6, 1.9));
    return { svg: o.join(""), top };
  })();
  stat(trainBridge.svg, "tbridge");
  def("seconds", (S) => {
    PART = "seconds";
    const a = rotOf(S).f - 40 * D2R, z = trainBridge.top;
    const o = [arbor(FO, 0.42, z, 0.35, "grey")];
    const hand = blobOutline([[add(FO, pol(-1.3, a)), add(FO, pol(4.4, a)), 0.08]], [[FO, 0.38], [add(FO, pol(-1.3, a)), 0.26]], 0.035);
    o.push(flatSvg(hand, [], z + 0.35, 0.06, "blued"));
    o.push(Dots([at(FO[0], FO[1], z + 0.41)], { size: 0.55, tone: "hi" }));
    return o.join("");
  });
  defBlur("seconds", () => { PART = "seconds"; const z = trainBridge.top; return arbor(FO, 0.42, z, 0.35, "grey") + `<g opacity=".22">` + flatSvg(circ(FO, 4.4, 90), [], z + 0.35, 0.02, "blued") + `</g>` + Dots([at(FO[0], FO[1], z + 0.41)], { size: 0.55, tone: "hi" }); });
  slot("seconds");

  // ================= balance wheel, hairspring, balance bridge =================
  def("balance", (S) => {
    PART = "balance";
    const a = ROLL_A0 + S.phi;
    const rimO = M.BAL_R, rimI = M.BAL_R - 0.5;
    const o = [flatSvg(circ(BAL, rimO, 120, a), spokeHoles(BAL, 3, 0.55, rimI, 0.42, a + 0.3), Z.rim[0], Z.rim[1], "teal")];
    const scr = [];
    for (let i = 0; i < 12; i++) scr.push(add(BAL, pol(rimO - 0.25, a + 0.12 + (i / 12) * TAU)));
    scr.sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
    const top = Z.rim[0] + Z.rim[1];
    o.push(scr.map((p) => cyl(p, 0.19, top, 0.08, "gold", { tone: "hi" }, 14)).join(""));
    o.push(arbor(BAL, 0.62, top, 0.06, "teal"), arbor(BAL, 0.14, top + 0.06, Z.spring - top - 0.06));
    return o.join("");
  });
  const HS = { r0: 0.48, r1: 2.75, turns: 11.5, a0: M.LINE + 1.1 };
  const studA = HS.a0 + HS.turns * TAU;
  def("hairspring", (S) => {
    PART = "hairspring";
    const pts = [];
    const n = Math.round(HS.turns * 56);
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const a = HS.a0 + t * HS.turns * TAU + S.phi * (1 - t);
      const r = HS.r0 + (HS.r1 - HS.r0) * t;
      pts.push(at(...add(BAL, pol(r * (1 - 0.03 * (S.phi / M.AMP) * (1 - t)), a)), Z.spring));
    }
    const studP = add(BAL, pol(HS.r1, studA));
    return cyl(BAL, 0.42, Z.spring - 0.05, 0.14, "grey", { tone: "hi" }, 24) + paint("grey", L(pth(pts), { tone: "hi", className: "wt-hair" })) + cyl(studP, 0.22, Z.spring - 0.1, Z.balBridge[0] - Z.spring + 0.1, "grey", { tone: "hi" }, 16);
  });
  slot("balance"); slot("hairspring");
  {
    PART = "balbridge";
    const t = pol(1, M.LINE + Math.PI / 2 - 0.25);
    const f1 = add(BAL, [t[0] * 6.0, t[1] * 6.0]), f2 = add(BAL, [-t[0] * 6.0, -t[1] * 6.0]);
    const studP = add(BAL, pol(HS.r1, studA));
    const ring = blobOutline([[f1, f2, 0.75]], [[BAL, 1.45], [f1, 1.25], [f2, 1.25]]);
    const o = [];
    o.push([f1, f2].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P)).map((f) => cyl(f, 0.95, 0, Z.balBridge[0], "bench")).join(""));
    o.push(flatSvg(ring, [], Z.balBridge[0], Z.balBridge[1], "steel"));
    const top = Z.balBridge[0] + Z.balBridge[1];
    const ia = ang(sub(f1, BAL)) + 0.28;
    const idx = blobOutline([[BAL, add(BAL, pol(4.1, ia)), 0.17]], [[BAL, 0.95]]);
    o.push(flatSvg(idx, [], top, 0.08, "grey"));
    o.push(cyl(BAL, 0.62, top + 0.08, 0.08, "gold", { tone: "hi" }, 30), cyl(BAL, 0.34, top + 0.16, 0.04, "ruby", { tone: "hi" }, 24));
    const lyre = [];
    for (let j = 0; j <= 24; j++) { const a = ia + Math.PI - 1.1 + 2.2 * (j / 24); lyre.push(at(...add(BAL, pol(0.52, a)), top + 0.2)); }
    o.push(paint("grey", L(pth(lyre), { tone: "hi" })));
    o.push(Dots([at(BAL[0], BAL[1], top + 0.2)], { size: 0.5, tone: "hi" }));
    const sc = [], arcPts = [];
    for (let j = 0; j <= 20; j++) arcPts.push(at(...add(BAL, pol(3.35, ia - 0.3 + 0.6 * (j / 20))), top));
    for (let j = 0; j <= 8; j++) { const a = ia - 0.27 + 0.54 * (j / 8); sc.push(pth([at(...add(BAL, pol(3.35, a)), top), at(...add(BAL, pol(j % 4 === 0 ? 3.85 : 3.65, a)), top)])); }
    o.push(paint("steel", L(pth(arcPts), { tone: "mid" }) + L(sc.join(""), { tone: "mid" })));
    o.push(screw(f1, top, 0.55, 0.6), screw(f2, top, 0.55, 2.2));
    stat(o.join(""), "balbridge");
  }

  // ================= x-ray barrel for the loupe: open drum, the whole spring, the arbor =================
  const xlist = [];
  {
    const zT = Z.bTeeth[1], zF = 0.32;
    PART = "barrel";
    const drum = flatSvg(circ(B, M.rB - 0.18, 140), [], Z.barrel[0], Z.bTeeth[0] - Z.barrel[0], "gold", { inner: L(k.sideArc(B[0], B[1], M.rB - 0.18, 0.6, P, 90), { tone: "faint" }) });
    const openD = pth(circ(B, SPR.rD + 0.07, 120).map((p) => at(p[0], p[1], zT)), true);
    const floorD = pth(circ(B, SPR.rD + 0.07, 120).map((p) => at(p[0], p[1], zF)), true);
    xlist.push({ svg: opts.dynOnly ? "" : drum + `<defs><clipPath id="wt-xopen"><path d="${openD}"/></clipPath></defs>` });
    def("xteeth", (S) => { PART = "barrel"; return flatSvg(gearRing(B, M.T.barrel.N, M.rB, M.T.barrel.m, ang(sub(C, B)) + S.barrel, "wheel"), [circ(B, SPR.rD + 0.07, 120)], Z.bTeeth[0], zT - Z.bTeeth[0], "gold"); });
    xlist.push({ dyn: "xteeth" });
    def("xin", (S) => {
      PART = "barrel";
      const o = [`<g clip-path="url(#wt-xopen)">`];
      o.push(paint("gold", `<path class="wt-xwall" d="${openD}"/><path class="wt-xfloor" d="${floorD}"/>` + L(ringLine(B, 2.9, zF, 70), { tone: "faint" })));
      o.push(springSvg(S, 0.95));
      PART = "ratchet";
      const hk = add(B, pol(SPR.rA - 0.04, S.arbor + 0.9));
      o.push(cyl(B, SPR.rA - 0.04, zF, 0.95, "grey") + paint("grey", L(k.lineOnTop(B, hk, zF + 0.95, P), { tone: "hi" })) + Dots([at(B[0], B[1], zF + 0.95)], { size: 0.45, tone: "hi" }));
      o.push(`</g>`);
      return o.join("");
    });
    xlist.push({ dyn: "xin" });
  }

  const x2list = [];
  PART = "plate";
  {
    // the plate under the balance: top face, perlage and the jewel sinks of the fork and the balance
    const top = k.cylinder(0, 0, M.PLATE_R, Z.plate[0], 1.2, P, 150).top;
    const rings = [];
    for (let x = -12; x <= 12; x += 0.95) for (let y = -12; y <= 12; y += 0.82) {
      const c = [x + ((Math.round(y / 0.82) & 1) ? 0.47 : 0), y];
      if (len(c) > M.PLATE_R - 1.0 || len(sub(c, BAL)) > 5.5) continue;
      rings.push(ringLine(c, 0.5, 0, 12));
    }
    x2list.push({ svg: opts.dynOnly ? "" : paint("bench", `<path class="iso-top" d="${top}"/>` + L(rings.join(""), { tone: "faint", className: "wt-perlage" }) + L([A, BAL, E].map((c) => ringLine(c, 1.15, 0, 30)).join(""), { tone: "lo" })) });
  }
  PART = "banking";
  x2list.push({ svg: opts.dynOnly ? "" : pins.map((p) => cyl(p, 0.16, 0, Z.fork[0] + Z.fork[1] + 0.05, "grey", { tone: "hi" }, 20)).join("") });
  x2list.push({ dyn: "escape" }, { dyn: "stonesLo" }, { dyn: "fork" }, { dyn: "roller" });

  const geo = { CW, SDIR, WPs, WP_R, STEM_Z, CR0, CR1, CR_R, ST1, CW_R, RAT_R, HOLD_R, SPR, BBTOP, sCW };
  return { list: out, xlist, x2list, dyn: (name, S) => dyns[name](S), blur: (name) => (blurs[name] ? blurs[name]() : null), hasBlur: (name) => !!blurs[name], Z, geo };
}

export { makeScene2 };
