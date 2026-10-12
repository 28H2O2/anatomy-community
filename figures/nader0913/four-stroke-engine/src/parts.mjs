// Moving parts of the engine, drawn for a crank angle. Shared by build.mjs (rest pose)
// and the live page (every frame). Each part returns { back, front }:
//   back  = the whole part, painted before the section face (the face hides what is behind it)
//   front = the same markup clipped to the screen hull of the part's y >= 0 half,
//           painted after the section face (that half stands in front of the cut).
export function makeMoving(k, G, P, M, F) {
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const f1 = (v) => Math.round(v * 10) / 10;
  const pathOf = (pts, closed) => k.pathOf(pts, closed);
  const V = G.viewOf(P);
  const D2R = Math.PI / 180;
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const Fx = (o) => G.frameOf(o, X, Y, Z); // polygons in (y, z), s along x
  const Fz = (o) => G.frameOf(o, Z, X, Y); // turned parts about a vertical axis
  let uid = 0;
  const ids = { n: 0 };
  const clipId = (name) => `cl-${name}`;

  // Sutherland-Hodgman: keep the y >= 0 side of a (y, z) polygon
  function frontHalf(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ina = a[0] >= 0, inb = b[0] >= 0;
      if (ina) out.push(a);
      if (ina !== inb) { const t = a[0] / (a[0] - b[0]); out.push([0, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  const circle = (cy, cz, r, n = 40, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n }, (_, i) => { const t = a0 + ((a1 - a0) * i) / (a1 - a0 === Math.PI * 2 ? n : n - 1); return [cy + r * Math.sin(t), cz + r * Math.cos(t)]; });
  const rot = ([y, z], a) => [y * Math.cos(a) + z * Math.sin(a), -y * Math.sin(a) + z * Math.cos(a)];

  // hull (screen) of the y >= 0 half of a prism along x
  function prismFrontHull(o, poly, s0, s1) {
    const half = frontHalf(poly);
    if (half.length < 3) return null;
    const pts = [];
    for (const [y, z] of half) for (const s of [s0, s1]) pts.push(at([o[0] + s, o[1] + y, o[2] + z]));
    return G.hullOf(pts);
  }
  // hull of the y >= 0 half of a turned part about z (profile [s, r]); one convex piece per segment
  function latheFrontHulls(o, profile) {
    const hulls = [];
    for (let i = 0; i + 1 < profile.length; i++) {
      const [s0, r0] = profile[i], [s1, r1] = profile[i + 1];
      const pts = [];
      for (let j = 0; j <= 16; j++) {
        const a = (Math.PI * j) / 16; // angle from +x toward +y: y >= 0
        for (const [s, r] of [[s0, r0], [s1, r1]]) pts.push(at([o[0] + r * Math.cos(a), o[1] + r * Math.sin(a), o[2] + s]));
      }
      hulls.push(G.hullOf(pts));
    }
    return hulls;
  }
  const clipped = (name, hulls, markup) => {
    const list = hulls.filter(Boolean);
    if (!list.length) return "";
    return `<clipPath id="${clipId(name)}"><path d="${list.map((h) => pathOf(h, true)).join("")}"/></clipPath><g clip-path="url(#${clipId(name)})">${markup}</g>`;
  };

  // ---------------- crankshaft ----------------
  const CR = { pin: 17, webIn: 11, webOut: 25, journal: 20, hub: 26, cw: 62, cwSpan: 64, boss: 24 };
  function webPolygon(theta) {
    const a = theta * D2R;
    const pts = [...circle(M.R * Math.sin(a), M.R * Math.cos(a), CR.boss, 36), ...circle(0, 0, CR.hub, 36)];
    const c = a + Math.PI;
    for (let i = 0; i <= 28; i++) { const t = c - CR.cwSpan * D2R + (2 * CR.cwSpan * D2R * i) / 28; pts.push([CR.cw * Math.sin(t), CR.cw * Math.cos(t)]); }
    // hull in (y, z)
    return G.hullOf(pts);
  }
  const O = [0, 0, M.ZC];
  function web(theta, s0, s1, name) {
    const poly = webPolygon(theta);
    const F0 = Fx(O);
    const body = S(G.prismOf(F0, poly, s0, s1, P), { tone: "mid", crease: "lo" });
    let marks = "";
    if (s1 > 0) {
      // outer face (normal +x, visible): pressed pin end, two balance drillings, a forging seam
      const a = theta * D2R;
      const face = s1;
      const pin = circle(M.R * Math.sin(a), M.R * Math.cos(a), CR.pin, 32).map(([y, z]) => at([face, y, M.ZC + z]));
      marks += Ln(pathOf(pin, true), { tone: "lo" });
      for (const off of [-24, 24]) {
        const t = a + Math.PI + off * D2R;
        const hole = circle(48 * Math.sin(t), 48 * Math.cos(t), 4.2, 20).map(([y, z]) => at([face, y, M.ZC + z]));
        marks += `<path class="en-drill" d="${pathOf(hole, true)}"/>`;
      }
      const hub = circle(0, 0, 9, 24).map(([y, z]) => at([face, y, M.ZC + z]));
      marks += Ln(pathOf(hub, true), { tone: "faint" });
    }
    const markup = `<g class="m-move">${body + marks}</g>`;
    return { back: markup, front: clipped(name, [prismFrontHull(O, poly, s0, s1)], markup) };
  }
  function crankPinPart(theta) {
    const a = theta * D2R;
    const poly = circle(M.R * Math.sin(a), M.R * Math.cos(a), CR.pin, 36);
    const markup = `<g class="m-move">${S(G.prismOf(Fx(O), poly, -CR.webIn, CR.webIn, P), { tone: "hi" })}</g>`;
    return { back: markup, front: clipped("pin", [prismFrontHull(O, poly, -CR.webIn, CR.webIn)], markup) };
  }

  // ---------------- connecting rod ----------------
  function rod(theta) {
    const a = theta * D2R;
    const big = [M.R * Math.sin(a), M.R * Math.cos(a)];
    const small = [0, F.pinZ(theta)];
    const dir = [small[0] - big[0], small[1] - big[1]];
    const len = Math.hypot(dir[0], dir[1]);
    const u = [dir[0] / len, dir[1] / len];
    const n = [u[1], -u[0]];
    const P2 = (base, along, side) => [base[0] + u[0] * along + n[0] * side, base[1] + u[1] * along + n[1] * side];
    const beam = [P2(big, 10, -9), P2(big, 10, 9), P2(small, -8, 6.5), P2(small, -8, -6.5)];
    const bigEnd = circle(big[0], big[1], 25, 40);
    const smallEnd = circle(small[0], small[1], 14, 32);
    const capBolt = (side) => [P2(big, -14, side - 3.6), P2(big, -14, side + 3.6), P2(big, -27, side + 3.6), P2(big, -27, side - 3.6)];
    const pieces = [
      { poly: beam, s: [-7, 7], tone: "hi" },
      { poly: bigEnd, s: [-10, 10], tone: "hi" },
      { poly: smallEnd, s: [-10, 10], tone: "hi" },
      { poly: capBolt(-18.5), s: [-5, 5], tone: "mid" },
      { poly: capBolt(18.5), s: [-5, 5], tone: "mid" },
    ];
    let markup = "";
    const hulls = [];
    for (const piece of pieces) {
      markup += S(G.prismOf(Fx(O), piece.poly, piece.s[0], piece.s[1], P), { tone: piece.tone, crease: "lo" });
      hulls.push(prismFrontHull(O, piece.poly, piece.s[0], piece.s[1]));
    }
    // cap split line across the big end (on the +x face), the bearing shell, the small-end bush and its oil hole
    const fx = 10;
    const split = [P2(big, -2, -25), P2(big, -2, 25)].map(([y, z]) => at([fx, y, M.ZC + z]));
    markup += Ln(pathOf(split), { tone: "mid" });
    markup += Ln(pathOf(circle(big[0], big[1], 19.4, 40).map(([y, z]) => at([fx, y, M.ZC + z])), true), { tone: "lo" });
    markup += `<path class="en-bore" d="${pathOf(circle(big[0], big[1], CR.pin, 36).map(([y, z]) => at([fx, y, M.ZC + z])), true)}"/>`;
    markup += Ln(pathOf(circle(small[0], small[1], 10, 28).map(([y, z]) => at([fx, y, M.ZC + z])), true), { tone: "mid" });
    markup += Ln(pathOf(circle(small[0], small[1], 11.6, 28).map(([y, z]) => at([fx, y, M.ZC + z])), true), { tone: "faint" });
    // web of the I-beam: a recessed panel on the face
    const panel = [P2(big, 30, -4.6), P2(big, 30, 4.6), P2(small, -20, 3.4), P2(small, -20, -3.4)].map(([y, z]) => at([7, y, M.ZC + z]));
    markup += Ln(pathOf(panel, true), { tone: "lo" });
    markup = `<g class="m-move-dk">${markup}</g>`;
    return { back: markup, front: clipped("rod", hulls, markup) };
  }

  // ---------------- piston ----------------
  const PR = 39.6;
  const pistonProfile = [[0, 0], [0, PR - 0.3], [M.SKIRT + M.CH - 1.2, PR], [M.SKIRT + M.CH, PR - 1.2], [M.SKIRT + M.CH, 0]];
  function piston() {
    // built with the pin at z = 0 (skirt bottom at -SKIRT); the page translates it to the live pin height
    const o = [0, 0, -M.SKIRT];
    const Fp = Fz(o);
    const H = M.SKIRT + M.CH;
    const body = G.lathe(pistonProfile, Fp, P, { steps: 96 });
    const grooves = [H - 5, H - 9.5, H - 14, H - 16.4].map((s, i) => G.arcOf(Fp, s, PR, P, {})).join("");
    const top = [];
    // valve reliefs and the crown's chamfer ring
    top.push(Ln(G.circleOf(G.frameOf([0, 0, H - M.SKIRT], Z, X, Y), 0, PR - 1.2, P), { tone: "faint" }));
    for (const xv of [M.VALVES.in, M.VALVES.ex]) {
      const rr = xv < 0 ? 17 : 15;
      top.push(Ln(pathOf(Array.from({ length: 40 }, (_, i) => { const t = (i / 40) * Math.PI * 2; return at([xv + rr * Math.cos(t), rr * Math.sin(t), H - M.SKIRT]); }), true), { tone: "lo" }));
    }
    // gudgeon pin boss and circlip on the +x side of the skirt (visible)
    const boss = (rho) => Array.from({ length: 33 }, (_, i) => { const t = (i / 32) * Math.PI * 2; const y = rho * Math.cos(t); return at([Math.sqrt(PR * PR - y * y), y, rho * Math.sin(t)]); });
    const pin = Ln(pathOf(boss(10), true), { tone: "mid" }) + Ln(pathOf(boss(7.2), true), { tone: "lo" });
    const markup = `<g class="m-piston">${S(body, { tone: "hi", lit: true, inner: Ln(grooves, { tone: "mid" }) }) + top.join("") + pin}</g>`;
    return { back: markup, front: clipped("piston", latheFrontHulls(o, pistonProfile), markup) };
  }

  // ---------------- valve train (built at rest, the page translates by the lift) ----------------
  const SEAT = M.ZC + 222.5;
  const TIP = M.CAMZ - M.RB - 4; // under the bucket crown
  const valveProfile = (rh) => [[0, 0], [0, rh], [1.4, rh], [2.6, rh - 1.6], [5.5, 8, 1], [9, 5, 1], [13, 3.5], [TIP - SEAT, 3.5], [TIP - SEAT, 0]];
  function valve(which) {
    const xv = M.VALVES[which];
    const rh = which === "in" ? 16 : 14;
    const o = [xv, 0, SEAT];
    const prof = valveProfile(rh);
    const Fv = Fz(o);
    const body = G.solidOf(prof.slice(1, -1), Fv, P, { steps: 64 });
    const groove = G.arcOf(Fv, TIP - SEAT - 6, 3.5, P, {}) + G.arcOf(Fv, TIP - SEAT - 8.5, 3.5, P, {});
    const markup = `<g class="${which === "in" ? "m-teal" : "m-teal-dk"}">${S(body, { tone: "hi", inner: Ln(groove, { tone: "lo" }) })}</g>`;
    return { back: markup, front: clipped("valve-" + which, latheFrontHulls(o, prof), markup) };
  }
  const RET_Z = M.ZC + 282;
  const retainerProfile = [[0, 3.6], [0, 6], [1.2, 10], [3, 10], [3, 3.6]];
  const bucketZ = M.CAMZ - M.RB - 26; // bucket from here to CAMZ - RB
  const bucketProfile = [[0, 0], [0, 12.6], [24.4, 13], [26, 12], [26, 0]];
  function follower(which) {
    const xv = M.VALVES[which];
    const oR = [xv, 0, RET_Z];
    const ret = S(G.solidOf(retainerProfile, Fz(oR), P, { steps: 48 }), { tone: "mid" });
    const oB = [xv, 0, bucketZ];
    const Fb = Fz(oB);
    const bucket = S(G.lathe(bucketProfile, Fb, P, { steps: 64 }), { tone: "hi", inner: Ln(G.arcOf(Fb, 6, 12.7, P, {}), { tone: "faint" }) });
    const shim = Ln(G.circleOf(Fb, 26, 9.5, P), { tone: "lo" });
    const markup = `<g class="m-teal">${ret + bucket + shim}</g>`;
    return { back: markup, front: clipped("bucket-" + which, [...latheFrontHulls(oR, retainerProfile), ...latheFrontHulls(oB, bucketProfile)], markup) };
  }
  // valve spring between the head's seat and the retainer; compressed by the lift
  const SPRING_SEAT = M.ZC + 250;
  function spring(which, liftNow) {
    const xv = M.VALVES[which];
    const top = RET_Z - liftNow;
    const turns = 6.5, r = 8.6, n = 260;
    const back = [], front = [];
    let run = null, runSide = null;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // dead coils closed at each end, active coils between
      const zt = t < 0.08 ? t * 0.35 : t > 0.92 ? 1 - (1 - t) * 0.35 : 0.028 + ((t - 0.08) / 0.84) * 0.944;
      const a = t * turns * Math.PI * 2;
      pts.push([xv + r * Math.cos(a), r * Math.sin(a), SPRING_SEAT + 1 + (top - SPRING_SEAT - 2) * zt, Math.cos(a) * V[0] + Math.sin(a) * V[1]]);
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1];
      const side = (p[1] + q[1]) / 2 >= 0 ? "front" : "back";
      const facing = (p[3] + q[3]) / 2 > 0;
      const key = side + (facing ? "+" : "-");
      if (key !== runSide) { if (run) (runSide.startsWith("front") ? front : back).push({ facing: runSide.endsWith("+"), pts: run }); run = [p]; runSide = key; }
      run.push(q);
    }
    (runSide.startsWith("front") ? front : back).push({ facing: runSide.endsWith("+"), pts: run });
    const draw = (list) => list.sort((a, b) => a.facing - b.facing).map(({ facing, pts }) => {
      const d = pathOf(pts.map((p) => at([p[0], p[1], p[2]])));
      return `<path class="en-wire${facing ? "" : " en-wire-back"}" d="${d}"/>`;
    }).join("");
    return { back: draw(back), front: draw(front) };
  }

  // ---------------- camshaft (one shaft, two lobes, three journals) ----------------
  const CAM_O = [0, 0, M.CAMZ];
  const LOBES = { in: [M.VALVES.in - 6.5, M.VALVES.in + 6.5], ex: [M.VALVES.ex - 6.5, M.VALVES.ex + 6.5] };
  const JOURNALS = [[-52, -40], [-6, 6], [40, 52]];
  function cam(theta) {
    const items = [];
    const core = circle(0, 0, 9, 32);
    const journal = circle(0, 0, 12.5, 40);
    const segs = [[-56, -52], ...JOURNALS, [-40, LOBES.in[0]], [LOBES.in[1], -6], [6, LOBES.ex[0]], [LOBES.ex[1], 40], [52, 64]];
    for (const [s0, s1] of segs) {
      const isJ = JOURNALS.some(([a, b]) => a === s0 && b === s1);
      items.push({ s0, s1, poly: isJ ? journal : core, tone: isJ ? "hi" : "mid", key: s0 });
    }
    for (const which of ["in", "ex"]) {
      const poly = G.hullOf(F.camPolygon(F.camAngle(theta, which), 40));
      items.push({ s0: LOBES[which][0], s1: LOBES[which][1], poly, tone: "hi", key: LOBES[which][0], lobe: which });
    }
    items.sort((a, b) => a.key - b.key);
    let markup = "";
    const hulls = [];
    for (const it of items) {
      markup += (it.lobe ? `<g class="m-brass">` : "") + S(G.prismOf(Fx(CAM_O), it.poly, it.s0, it.s1, P), { tone: it.tone, crease: "lo" });
      hulls.push(prismFrontHull(CAM_O, it.poly, it.s0, it.s1));
      if (it.lobe) {
        // the nose's oil-hardened flat: a short line on the lobe face across the nose
        const a = F.camAngle(theta, it.lobe) * D2R;
        const tip = [M.CD * Math.sin(a), M.CD * Math.cos(a)];
        const face = it.s1;
        markup += Ln(pathOf(circle(tip[0], tip[1], 3, 16).map(([y, z]) => at([face, y, M.CAMZ + z])), true), { tone: "faint" }) + `</g>`;
      }
    }
    markup = `<g class="m-teal">${markup}</g>`;
    return { back: markup, front: clipped("cam", hulls, markup) };
  }

  // ---------------- timing drive: crank pulley, cam pulley, idler, toothed belt ----------------
  const BX = [74, 84]; // pulley faces
  const PUL = { crank: { c: [0, M.ZC], r: 18 }, cam: { c: [0, M.CAMZ], r: 36 }, idler: { c: [-40, M.ZC + 168], r: 13 } };
  const beltPts = (() => {
    const pts = [];
    for (const p of Object.values(PUL)) for (let i = 0; i < 90; i++) { const t = (i / 90) * Math.PI * 2; pts.push([p.c[0] + (p.r + 0.1) * Math.sin(t), p.c[1] + (p.r + 0.1) * Math.cos(t)]); }
    const hull = G.hullOf(pts);
    // resample to even arc length
    const total = hull.reduce((sum, p, i) => sum + Math.hypot(hull[(i + 1) % hull.length][0] - p[0], hull[(i + 1) % hull.length][1] - p[1]), 0);
    return { hull, total };
  })();
  function pointOnLoop(s) {
    const { hull, total } = beltPts;
    s = ((s % total) + total) % total;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (s <= l) { const t = s / l; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] }; }
      s -= l;
    }
    return { p: hull[0], d: [1, 0] };
  }
  function pulley(name, theta, spin) {
    const { c, r } = PUL[name];
    const o = [BX[0], c[0], c[1]];
    const Fp = G.frameOf(o, X, Y, Z);
    let m = S(G.disc(0, BX[1] - BX[0], r, Fp, P, { steps: 72 }), { tone: "hi" });
    const face = BX[1];
    const ring = (rr, tone, n = 48) => Ln(pathOf(circle(c[0], c[1], rr, n).map(([y, z]) => at([face, y, z])), true), { tone });
    const a = spin * D2R;
    if (name === "cam") {
      m += ring(r - 4, "faint", 72) + ring(14, "lo");
      for (let i = 0; i < 4; i++) {
        const t = a + (i * Math.PI) / 2 + Math.PI / 4;
        m += `<path class="en-bore" d="${pathOf(circle(c[0] + 23.5 * Math.sin(t), c[1] + 23.5 * Math.cos(t), 6.4, 24).map(([y, z]) => at([face, y, z])), true)}"/>`;
      }
      // timing mark: a notch on the rim, lit
      const tm = [[c[0] + (r - 4) * Math.sin(a), c[1] + (r - 4) * Math.cos(a)], [c[0] + (r - 0.6) * Math.sin(a), c[1] + (r - 0.6) * Math.cos(a)]];
      m += Ln(pathOf(tm.map(([y, z]) => at([face, y, z]))), { tone: "lit" });
    } else if (name === "crank") {
      m += ring(r - 3, "faint", 48);
      const tm = [[c[0] + (r - 3) * Math.sin(a), c[1] + (r - 3) * Math.cos(a)], [c[0] + (r - 0.6) * Math.sin(a), c[1] + (r - 0.6) * Math.cos(a)]];
      m += Ln(pathOf(tm.map(([y, z]) => at([face, y, z]))), { tone: "lit" });
    } else {
      m += ring(7.5, "lo", 32);
      for (let i = 0; i < 3; i++) { const t = a + (i * 2 * Math.PI) / 3; m += `<path class="en-bore" d="${pathOf(circle(c[0] + 10 * Math.sin(t), c[1] + 10 * Math.cos(t), 1.2, 10).map(([y, z]) => at([face, y, z])), true)}"/>`; }
    }
    // centre bolt: a hex head that turns with the shaft
    const hr = name === "idler" ? 4.6 : name === "cam" ? 7.6 : 7;
    const hex = Array.from({ length: 6 }, (_, i) => { const t = a + (i * Math.PI) / 3; return [c[0] + hr * Math.sin(t), c[1] + hr * Math.cos(t)]; });
    m += S(G.prismOf(G.frameOf([face, 0, 0], X, Y, Z), hex, 0, 4, P), { tone: "mid" });
    m += `<path class="en-washer" d="${pathOf(circle(c[0], c[1], hr * 0.5, 16).map(([y, z]) => at([face + 4, y, z])), true)}"/>`;
    return `<g class="${name === "cam" ? "m-teal" : "m-teal-dk"}">${m}</g>`;
  }
  function belt(theta) {
    const { hull, total } = beltPts;
    const T = 3.4;
    const n = hull.length;
    // outward normal of the hull (counter-clockwise in (y, z)? decide by centroid)
    const cy = hull.reduce((s, p) => s + p[0], 0) / n, cz = hull.reduce((s, p) => s + p[1], 0) / n;
    const outer = hull.map((p, i) => {
      const a = hull[(i - 1 + n) % n], b = hull[(i + 1) % n];
      let nrm = [b[1] - a[1], -(b[0] - a[0])];
      const l = Math.hypot(nrm[0], nrm[1]) || 1;
      nrm = [nrm[0] / l, nrm[1] / l];
      if (nrm[0] * (p[0] - cy) + nrm[1] * (p[1] - cz) < 0) nrm = [-nrm[0], -nrm[1]];
      return { p, q: [p[0] + nrm[0] * T, p[1] + nrm[1] * T], nrm };
    });
    const at3 = (x, [y, z]) => at([x, y, z]);
    let backInner = "", outerFaces = "";
    const L = G.lightOf(P);
    for (let i = 0; i < n; i++) {
      const A = outer[i], B = outer[(i + 1) % n];
      const nrm = [0, (A.nrm[0] + B.nrm[0]) / 2, (A.nrm[1] + B.nrm[1]) / 2];
      const facing = G.dot3(nrm, V);
      if (facing > 0) {
        const tone = G.bandOf(G.dot3(G.unit3(nrm), L));
        outerFaces += `<path class="iso-shade" data-shade="${Math.min(3, tone)}" d="${pathOf([at3(BX[0], A.q), at3(BX[0], B.q), at3(BX[1], B.q), at3(BX[1], A.q)], true)}"/>`;
      } else {
        // inner (toothed) face of the far run, seen through the loop
        const inward = [0, -nrm[1], -nrm[2]];
        const tone = G.bandOf(G.dot3(G.unit3(inward), L));
        backInner += `<path class="iso-shade en-belt-in" data-shade="${Math.max(0, Math.min(3, tone) - 1)}" d="${pathOf([at3(BX[0], A.p), at3(BX[0], B.p), at3(BX[1], B.p), at3(BX[1], A.p)], true)}"/>`;
      }
    }
    // side face (x = BX[1]) as a ring, outlines
    const ringOut = pathOf(outer.map((o) => at3(BX[1], o.q)), true);
    const ringIn = pathOf(outer.map((o) => at3(BX[1], o.p)), true);
    // outline of the band's outer surface: hull of outer curve at both faces
    const sil = G.hullOf([...outer.map((o) => at3(BX[0], o.q)), ...outer.map((o) => at3(BX[1], o.q))]);
    // teeth: ribs across the outer surface, moving with the belt (pitch 9.5 mm)
    const speed = theta * D2R * PUL.crank.r;
    const pitch = 9.5;
    const count = Math.floor(total / pitch);
    const step = total / count;
    let ribs = "";
    for (let i = 0; i < count; i++) {
      const s = i * step + (speed % step);
      const { p, d } = pointOnLoop(s);
      let nrm = [d[1], -d[0]];
      if (nrm[0] * (p[0] - cy) + nrm[1] * (p[1] - cz) < 0) nrm = [-nrm[0], -nrm[1]];
      const facing = G.dot3([0, nrm[0], nrm[1]], V);
      if (facing <= 0.04) continue;
      const q = [p[0] + nrm[0] * T, p[1] + nrm[1] * T];
      const alpha = Math.min(1, (facing - 0.04) / 0.25);
      ribs += `<path class="iso-line" data-tone="lo" opacity="${alpha.toFixed(2)}" d="${pathOf([at3(BX[0] + 0.3, q), at3(BX[1] - 0.3, q)])}"/>`;
    }
    return {
      under: `<g class="en-belt m-belt">${backInner}</g>`,
      over: `<g class="en-belt m-belt"><path class="iso-fill" d="${pathOf(sil, true)}M${ringIn.slice(1)}" fill-rule="evenodd"/>${outerFaces}<path class="iso-top en-belt-side" d="${ringOut}${ringIn}" fill-rule="evenodd"/>${ribs}<path class="iso-line" data-tone="mid" d="${ringIn}"/><path class="iso-line iso-edge" data-tone="hi" d="${ringOut}"/><path class="iso-line iso-edge" data-tone="hi" d="${pathOf(sil, true)}"/></g>`,
    };
  }
  function drive(theta) {
    const b = belt(theta);
    return b.under + pulley("crank", theta, theta) + pulley("idler", theta, (theta * PUL.crank.r) / PUL.idler.r) + pulley("cam", theta, theta / 2) + b.over;
  }

  // ---------------- flywheel (behind everything, x < -66) ----------------
  const FW = { s0: -86, s1: -74, r: 78 };
  function flywheel(theta) {
    const o = [FW.s0, 0, M.ZC];
    const Ff = G.frameOf(o, X, Y, Z);
    const len = FW.s1 - FW.s0;
    let m = S(G.disc(0, len, FW.r, Ff, P, { steps: 120 }), { tone: "mid" });
    const a = theta * D2R;
    const face = FW.s1;
    // ring gear teeth on the rim, turning with the crank, fading toward the limbs
    const ribs = G.ribsOf(Ff, 0.6, len - 0.6, FW.r, 104, P, { phase: -a, fade: [0.04, 0.4] });
    m += k.fadedSvg(ribs, { tone: "lo" });
    const ring = (rr, tone, n = 72) => Ln(pathOf(circle(0, M.ZC, rr, n).map(([y, z]) => at([face, y, z])), true), { tone });
    m += ring(FW.r - 7, "lo", 120) + ring(30, "faint");
    for (let i = 0; i < 6; i++) {
      const t = a + (i * Math.PI) / 3;
      m += `<path class="en-bore" d="${pathOf(circle(50 * Math.sin(t), M.ZC + 50 * Math.cos(t), 9.5, 28).map(([y, z]) => at([face, y, z])), true)}"/>`;
    }
    const dots = Array.from({ length: 6 }, (_, i) => { const t = a + (i * Math.PI) / 3 + Math.PI / 6; return at([face, 22 * Math.sin(t), M.ZC + 22 * Math.cos(t)]); });
    m += k.dotsSvg(dots, { size: 1.1, tone: "hi" });
    // TDC mark on the rim face
    const tm = [[(FW.r - 7) * Math.sin(a), M.ZC + (FW.r - 7) * Math.cos(a)], [(FW.r - 0.2) * Math.sin(a), M.ZC + (FW.r - 0.2) * Math.cos(a)]];
    m += Ln(pathOf(tm.map(([y, z]) => at([face, y, z]))), { tone: "lit" });
    return `<g class="m-move-dk">${m}</g>`;
  }

  return { prismFrontHull, latheFrontHulls, clipped, circle, frontHalf, web, crankPinPart, rod, piston, valve, follower, spring, cam, drive, flywheel, PUL, BX, FW, CR, SEAT, TIP, RET_Z, bucketZ, SPRING_SEAT, JOURNALS, LOBES, beltPts };
}
