// Shared by build.mjs (Node) and the live pages (inlined). Plain script: no imports, no exports.
// makeWK(K, P, C): K = { iso, depthOf, cameraOf }, P = projection, C = constants (see build.mjs).
function makeWK(K, P, C) {
  const RAD = Math.PI / 180;
  const cam = K.cameraOf(P);
  const V = [cam.cosA * cam.cosE, cam.sinA * cam.cosE, cam.sinE];
  const LH = [-cam.sinA, cam.cosA];
  const t1 = (v) => { const s = (Math.round(v * 10) / 10).toString(); return s === "-0" ? "0" : s; };
  const pth = (pts, close) => pts.map((p, i) => (i ? "L" : "M") + t1(p[0]) + " " + t1(p[1])).join("") + (close ? "Z" : "");
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const at = (p) => K.iso(p, P);
  const { R, e, OFF } = C;
  const mod = (x, m) => ((x % m) + m) % m;
  const inNotch = (a) => mod(a - C.NOTCH[0], 360) <= C.NOTCH[1] - C.NOTCH[0];

  // ---- geometry: epitrochoid housing, rotor flank (inner envelope, precomputed in C.flank) -------------
  const H = (a) => [e * Math.cos(3 * a * RAD) + R * Math.cos(a * RAD), e * Math.sin(3 * a * RAD) + R * Math.sin(a * RAD)];
  const Hn = (a) => { // outward unit normal
    const dx = -3 * e * Math.sin(3 * a * RAD) - R * Math.sin(a * RAD), dy = 3 * e * Math.cos(3 * a * RAD) + R * Math.cos(a * RAD);
    const l = Math.hypot(dx, dy); return [dy / l, -dx / l];
  };
  const Hoff = (a, d) => { const p = H(a), n = Hn(a); return [p[0] + n[0] * d, p[1] + n[1] * d]; };
  const arcPts = (a0, a1, f, step = 3) => { const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step)); return Array.from({ length: n + 1 }, (_, i) => f(a0 + ((a1 - a0) * i) / n)); };
  // rotor pose for shaft angle th (deg): centre on a circle of radius e, rotor angle = th/3
  const poseOf = (th) => ({ th, phi: th / 3, c: [e * Math.cos(th * RAD), e * Math.sin(th * RAD)] });
  const rot = (p, ang, c) => { const ca = Math.cos(ang * RAD), sa = Math.sin(ang * RAD); return [c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca]; };
  // flank k of the rotor in world plan (apex k -> apex k+1)
  const flankW = (pose, k) => C.flank.map((p) => rot(p, pose.phi + 120 * k, pose.c));
  const apexW = (pose, k) => rot([R, 0], pose.phi + 120 * k, pose.c);

  // ---- face renderer with the kit's four tones (polyhedra drawn face by face, depth sorted) ---------------
  function newell(pts) {
    const n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return nrm(n);
  }
  function toneOf(n) {
    if (n[2] > 0.7) return "top";
    const h = Math.hypot(n[0], n[1]) || 1;
    const lit = ((n[0] * LH[0] + n[1] * LH[1]) / h + 1) / 2;
    return Math.min(3, Math.max(0, Math.floor(lit * 4)));
  }
  // 45° section hatching clipped to a planar polygon (world points), spacing in world units
  function hatchOf(pts, step) {
    const n = newell(pts);
    let a = cross([0, 0, 1], n); if (Math.hypot(a[0], a[1], a[2]) < 1e-6) a = [1, 0, 0];
    a = nrm(a); const b = cross(n, a);
    const q = pts.map((p) => [dot(p, a), dot(p, b)]);
    const m = [Math.SQRT1_2, -Math.SQRT1_2], d = [Math.SQRT1_2, Math.SQRT1_2];
    const s = q.map((p) => p[0] * m[0] + p[1] * m[1]);
    const lo = Math.min(...s), hi = Math.max(...s);
    const o = pts[0], qo = q[0];
    const back = (u, v) => [o[0] + a[0] * (u - qo[0]) + b[0] * (v - qo[1]), o[1] + a[1] * (u - qo[0]) + b[1] * (v - qo[1]), o[2] + a[2] * (u - qo[0]) + b[2] * (v - qo[1])];
    const segs = [];
    for (let c = Math.ceil(lo / step + 1e-6) * step; c < hi - 1e-6; c += step) {
      const hits = [];
      for (let i = 0; i < q.length; i++) {
        const s1 = s[i] - c, s2 = s[(i + 1) % q.length] - c;
        if ((s1 < 0) !== (s2 < 0)) {
          const t = s1 / (s1 - s2), p1 = q[i], p2 = q[(i + 1) % q.length];
          hits.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]);
        }
      }
      hits.sort((x, y) => (x[0] * d[0] + x[1] * d[1]) - (y[0] * d[0] + y[1] * d[1]));
      for (let i = 0; i + 1 < hits.length; i += 2) {
        if (Math.hypot(hits[i][0] - hits[i + 1][0], hits[i][1] - hits[i + 1][1]) < 0.6) continue;
        segs.push(pth([at(back(...hits[i])), at(back(...hits[i + 1]))]));
      }
    }
    return segs.join("");
  }
  const keyOf = (p) => Math.round(p[0] * 100) + "," + Math.round(p[1] * 100) + "," + Math.round(p[2] * 100);
  // faces: [{ pts, g, out, hole?, hatch?, cls? }]
  function polySvg(faces, { tone = "hi", crease = "faint", cls = "", sort = true } = {}) {
    const edges = new Map();
    const info = faces.map((f, fi) => {
      let n = newell(f.pts);
      if (f.out && dot(n, f.out) < 0) n = [-n[0], -n[1], -n[2]];
      const vis = dot(n, V) > 0.002;
      const c = f.pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map((v) => v / f.pts.length);
      if (vis) for (let i = 0; i < f.pts.length; i++) {
        const a = keyOf(f.pts[i]), b = keyOf(f.pts[(i + 1) % f.pts.length]);
        if (a === b) continue;
        const k = a < b ? a + "|" + b : b + "|" + a;
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push(fi);
      }
      return { n, vis, depth: f.depth ?? K.depthOf(c, P), f };
    });
    const order = info.map((x, i) => i).filter((i) => info[i].vis);
    if (sort) order.sort((a, b) => info[a].depth - info[b].depth);
    const out = [];
    for (const fi of order) {
      const { n, f } = info[fi];
      const scr = f.pts.map(at);
      const t = toneOf(n);
      let d = pth(scr, true);
      if (f.hole) d += pth(f.hole.map(at), true);
      const ev = f.hole ? ' fill-rule="evenodd"' : "";
      if (f.hatch) {
        out.push(`<path class="wk-cut" d="${d}"/>`);
        const hd = hatchOf(f.pts, f.hatch);
        if (hd) out.push(`<path class="iso-line wk-hatch" data-tone="lo" d="${hd}"/>`);
      } else out.push(t === "top" ? `<path class="iso-top"${ev} d="${d}"/>` : `<path class="iso-shade" data-shade="${t}" d="${d}"/>`);
      const ol = [], cr = [];
      for (let i = 0; i < f.pts.length; i++) {
        const a = keyOf(f.pts[i]), b = keyOf(f.pts[(i + 1) % f.pts.length]);
        if (a === b) continue;
        const list = edges.get(a < b ? a + "|" + b : b + "|" + a) || [];
        const others = list.filter((j) => j !== fi);
        const seg = pth([scr[i], scr[(i + 1) % scr.length]]);
        if (!others.length) ol.push(seg);
        else if (others.some((j) => info[j].f.g !== f.g)) cr.push(seg);
      }
      if (f.hole) ol.push(pth(f.hole.map(at), true));
      if (cr.length && crease !== "none") out.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${cr.join("")}"/>`);
      if (ol.length) out.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${ol.join("")}"/>`);
    }
    return `<g class="iso-solid${cls ? " " + cls : ""}" data-seamless="">${out.join("")}</g>`;
  }
  // vertical prism faces from a plan polygon (any orientation), walls facing out (or in for holes)
  function prism(poly, z0, z1, { g = "s", top = true, inward = false, hatchTop = 0, hole = null } = {}) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const ccw = area > 0;
    const faces = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (Math.hypot(dx, dy) < 1e-6) continue;
      let o = ccw ? [dy, -dx, 0] : [-dy, dx, 0];
      if (inward) o = [-o[0], -o[1], 0];
      faces.push({ g, out: o, pts: [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]] });
    }
    if (top) faces.push({ g: "t", out: [0, 0, 1], pts: poly.map((p) => [p[0], p[1], z1]), hatch: hatchTop || undefined, hole: hole ? hole.map((p) => [p[0], p[1], z1]) : undefined, depth: 1e9 });
    return faces;
  }
  // a flat plate (top only) at height z
  const flatSvg = (poly, z, cls, { hole = null, tone = "hi" } = {}) => polySvg([{ g: "t", out: [0, 0, 1], pts: poly.map((p) => [p[0], p[1], z]), hole: hole ? hole.map((p) => [p[0], p[1], z]) : undefined }], { cls, tone });
  const circ = (c, r, n = 40, a0 = 0) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(a0 * RAD + (i / n) * 2 * Math.PI), c[1] + r * Math.sin(a0 * RAD + (i / n) * 2 * Math.PI)]);
  // gears: internal (ring on the rotor) and external (stationary)
  function gearPoly(c, teeth, rIn, rOut, aTip, aRoot, phase, internal) {
    const pts = [], per = 360 / teeth;
    for (let k = 0; k < teeth; k++) {
      const a = phase + k * per;
      const rt = internal ? rIn : rOut, rr = internal ? rOut : rIn;
      for (const [r, da] of [[rr, -aRoot], [rt, -aTip], [rt, aTip], [rr, aRoot]]) pts.push([c[0] + r * Math.cos((a + da) * RAD), c[1] + r * Math.sin((a + da) * RAD)]);
    }
    return pts;
  }

  // ---- the cycle: phase u (deg of rotor travel past the port waist) of face k ------------------------
  const phaseOf = (pose, k) => mod(pose.phi + 60 + 120 * k - C.PORT, 360);
  const GAS = [ // u, r, g, b, a
    [0, 150, 196, 240, 0.16], [40, 120, 180, 240, 0.42], [100, 100, 165, 236, 0.55], [174, 78, 140, 226, 0.7],
    [180, 255, 222, 110, 0.85], [196, 252, 170, 60, 0.75], [240, 226, 128, 80, 0.5], [272, 150, 146, 142, 0.5],
    [320, 160, 160, 162, 0.36], [360, 150, 196, 240, 0.16],
  ];
  function gasOf(u) {
    for (let i = 0; i + 1 < GAS.length; i++) {
      const A = GAS[i], B = GAS[i + 1];
      if (u >= A[0] && u <= B[0]) { const t = (u - A[0]) / (B[0] - A[0]); return A.slice(1).map((v, j) => v + (B[j + 1] - v) * t); }
    }
    return GAS[0].slice(1);
  }
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const glowOf = (u) => (u < 178.5 ? 0 : sm(178.5, 180.5, u) * Math.exp(-Math.max(0, u - 181) / 34) * (1 - sm(250, 285, u)));
  const sparkOf = (u) => sm(177.5, 179.6, u) * (1 - sm(180.2, 183.5, u));

  // ---- dynamic markup for one shaft angle ---------------------------------------------------------------
  const ZF = C.ZF, Z0 = C.Z0, Z1 = C.Z1, ZR = C.ZR; // floor (lower housing top), rotor bottom/top, housing top
  function chamberPoly(pose, k) {
    const fl = flankW(pose, k);
    const a0 = pose.phi + 120 * k, a1 = a0 + 120;
    return [...fl, ...arcPts(a1, a0, H, 3).slice(1, -1)];
  }
  function dynamic(th) {
    const pose = poseOf(th);
    const out = { gasFloor: "", rotor: "", gasTop: "", disk: "" };
    // gas in the three chambers
    const gf = [], gt = [];
    const glows = [], sparks = [];
    for (let k = 0; k < 3; k++) {
      const u = phaseOf(pose, k);
      const [r, g, b, a] = gasOf(u);
      const col = `rgb(${r | 0},${g | 0},${b | 0})`;
      const poly = chamberPoly(pose, k);
      gf.push(`<path class="wk-gas" d="${pth(poly.map((p) => at([p[0], p[1], ZF + 0.3])), true)}" style="fill:${col};fill-opacity:${(a * 0.9).toFixed(3)}"/>`);
      gt.push(`<path class="wk-gas" d="${pth(poly.map((p) => at([p[0], p[1], ZR])), true)}" style="fill:${col};fill-opacity:${(a * 0.75).toFixed(3)}"/>`);
      // front walls of the gas volume (seen only through the cut)
      const a0 = pose.phi + 120 * k;
      const wall = arcPts(a0, a0 + 120, H, 3);
      for (let i = 0; i + 1 < wall.length; i++) {
        const p = wall[i], q = wall[i + 1];
        const n = [q[1] - p[1], -(q[0] - p[0]), 0];
        if (dot(n, V) <= 0) continue;
        const mid = (a0 + (120 * (i + 0.5)) / (wall.length - 1));
        if (!inNotch(mid)) continue;
        gt.push(`<path class="wk-gas" d="${pth([at([p[0], p[1], C.ZN]), at([q[0], q[1], C.ZN]), at([q[0], q[1], ZR]), at([p[0], p[1], ZR])], true)}" style="fill:${col};fill-opacity:${(a * 0.4).toFixed(3)}"/>`);
      }
      const gl = glowOf(u);
      if (gl > 0.004) {
        let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; }
        cx /= poly.length; cy /= poly.length;
        const [sx, sy] = at([cx, cy, (ZF + ZR) / 2 + 12]);
        const rr = 46 + 50 * Math.min(1, Math.max(0, u - 180) / 60);
        glows.push(`<ellipse class="wk-glow" cx="${t1(sx)}" cy="${t1(sy)}" rx="${t1(rr * P.scale * 1.5)}" ry="${t1(rr * P.scale * 1.1)}" opacity="${gl.toFixed(3)}"/>`);
      }
      const sp = sparkOf(u);
      if (sp > 0.01) for (const pa of C.plugs) {
        const w = H(pa), n = Hn(pa);
        const [sx, sy] = at([w[0] - n[0] * 3, w[1] - n[1] * 3, C.ZP]);
        const s = (6 + 6 * sp) * P.scale;
        sparks.push(`<g class="wk-spark" opacity="${sp.toFixed(3)}" transform="translate(${t1(sx)} ${t1(sy)})"><circle r="${t1(s * 1.8)}" class="wk-spark-halo"/><path d="M${t1(-s)} 0L0 ${t1(-s * 0.28)}L${t1(s)} 0L0 ${t1(s * 0.28)}ZM0 ${t1(-s)}L${t1(s * 0.28)} 0L0 ${t1(s)}L${t1(-s * 0.28)} 0Z"/></g>`);
      }
    }
    out.gasFloor = gf.join("");
    out.gasTop = gt.join("");
    out.light = glows.join("") + sparks.join("");

    // rotor
    const outline = [0, 1, 2].flatMap((k) => flankW(pose, k).slice(0, -1));
    const ringHole = gearPoly(pose.c, 30, C.rgTip, C.rgRoot, 1.9, 4.2, pose.phi + 6, true);
    const recess = [];
    recess.push(flatSvg(circ(pose.c, C.rgRoot + 0.5, 48), C.ZRec, "m-rotor", { tone: "hi" }));
    recess.push(flatSvg(circ(pose.c, C.brg, 44), C.ZRec + 0.2, "m-brass"));
    recess.push(flatSvg(circ(pose.c, C.lobe, 44, th), C.ZRec + 0.4, "m-shaft"));
    // lobe: two drilled oil holes on its face, turning with the shaft
    for (const s of [-1, 1]) {
      const hc = [pose.c[0] + Math.cos((th + s * 70) * RAD) * 24, pose.c[1] + Math.sin((th + s * 70) * RAD) * 24];
      recess.push(flatSvg(circ(hc, 2.6, 14), C.ZRec + 0.4, "m-hole", { tone: "mid" }));
    }
    recess.push(polySvg(prism(ringHole, C.ZRec, ZR - 1, { inward: true, top: false, g: "w" }), { cls: "m-brass", crease: "none" }));
    recess.push(C.gearFull);
    // outer flanks (orange) and the followed flank (red)
    const sides = (k) => { const fl = flankW(pose, k); const f = []; for (let i = 0; i + 1 < fl.length; i++) { const a = fl[i], b = fl[i + 1]; f.push({ g: "s", out: [b[1] - a[1], -(b[0] - a[0]), 0], pts: [[a[0], a[1], Z0], [b[0], b[1], Z0], [b[0], b[1], ZR - 1], [a[0], a[1], ZR - 1]] }); } return f; };
    const body = [];
    body.push(polySvg([...sides(1), ...sides(2)], { cls: "m-rotor" }));
    body.push(polySvg(sides(0), { cls: "m-accent" }));
    // combustion recess (the "bathtub") drawn on each visible flank face
    for (let k = 0; k < 3; k++) {
      const mid = flankW(pose, k)[Math.floor(C.flank.length / 2)], nd = [mid[0] - pose.c[0], mid[1] - pose.c[1], 0];
      if (dot(nd, V) <= 0) continue;
      const fl = flankW(pose, k), n = fl.length - 1;
      const i0 = Math.round(n * 0.34), i1 = Math.round(n * 0.66);
      const za = Z0 + 22, zb = ZR - 22;
      const loop = [...fl.slice(i0, i1 + 1).map((p) => [p[0], p[1], za]), ...fl.slice(i0, i1 + 1).reverse().map((p) => [p[0], p[1], zb])];
      body.push(`<path class="iso-line wk-pocket" data-tone="${k === 0 ? "hi" : "mid"}" d="${pth(loop.map(at), true)}"/>`);
    }
    // top face with the ring-gear recess
    body.push(polySvg([{ g: "t", out: [0, 0, 1], pts: outline.map((p) => [p[0], p[1], ZR - 1]), hole: ringHole.map((p) => [p[0], p[1], ZR - 1]) }], { cls: "m-rotor" }));
    // red band along the followed flank's top edge, side-seal grooves, corner seals, apex seals
    const inset = (k, d) => C.flankIn.map((p) => rot(p, pose.phi + 120 * k, pose.c));
    const fl0 = flankW(pose, 0), in0 = inset(0);
    body.push(flatSvg([...fl0, ...in0.slice().reverse()], ZR - 1, "m-accent"));
    for (const k of [1, 2]) body.push(`<path class="iso-line" data-tone="mid" d="${pth(inset(k).map((p) => at([p[0], p[1], ZR - 1])))}"/>`);
    for (let k = 0; k < 3; k++) {
      const cs = rot(C.corner, pose.phi + 120 * k, pose.c);
      body.push(flatSvg(circ(cs, C.cornerR, 18), ZR - 0.9, "m-brass", { tone: "mid" }));
      const a = pose.phi + 120 * k;
      const ca = Math.cos(a * RAD), sa = Math.sin(a * RAD);
      const seal = [[R - 9, -1.4], [R, -1.4], [R, 1.4], [R - 9, 1.4]].map(([x, y]) => [pose.c[0] + x * ca - y * sa, pose.c[1] + x * sa + y * ca]);
      body.push(polySvg(prism(seal, Z0, ZR - 0.6), { cls: "m-brass" }));
    }
    out.rotor = recess.join("") + body.join("");
    // timing disk index mark on the shaft top
    const m0 = [Math.cos(th * RAD), Math.sin(th * RAD)];
    const zt = C.ZDisk;
    out.disk = `<path class="iso-line wk-index" data-tone="hi" d="${pth([at([m0[0] * 15, m0[1] * 15, zt]), at([m0[0] * (C.diskR - 4.5), m0[1] * (C.diskR - 4.5), zt])])}"/>` +
      `<circle class="wk-index-dot" cx="${t1(at([m0[0] * (C.diskR - 4.5), m0[1] * (C.diskR - 4.5), zt])[0])}" cy="${t1(at([m0[0] * (C.diskR - 4.5), m0[1] * (C.diskR - 4.5), zt])[1])}" r="1.1"/>`;
    return out;
  }

  // ---- tour: shaft angle from Hermite keyframes [t, theta(deg), omega(deg/s)] ----------------------------
  function thetaAt(t, keys) {
    if (t <= keys[0][0]) return keys[0][1] + keys[0][2] * (t - keys[0][0]);
    for (let i = 0; i + 1 < keys.length; i++) {
      const [ta, a, va] = keys[i], [tb, b, vb] = keys[i + 1];
      if (t <= tb) {
        const h = tb - ta, s = (t - ta) / h, s2 = s * s, s3 = s2 * s;
        return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * h * va + (-2 * s3 + 3 * s2) * b + (s3 - s2) * h * vb;
      }
    }
    return keys[keys.length - 1][1];
  }

  return { inNotch, mod, H, Hn, Hoff, arcPts, poseOf, flankW, apexW, polySvg, prism, flatSvg, circ, gearPoly, hatchOf, dynamic, thetaAt, phaseOf, pth, at, V };
}

export { makeWK };
