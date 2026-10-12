// Shared by build.mjs (Node) and the live page (inlined). Plain script: no imports, no exports.
// makeMech(K, P, C): K = kit functions, P = projection, C = constants (see build.mjs).
function makeMech(K, P, C) {
  const RAD = Math.PI / 180;
  const cam = K.cameraOf(P);
  const V = [cam.cosA * cam.cosE, cam.sinA * cam.cosE, cam.sinE];
  const LH = [-cam.sinA, cam.cosA];
  const t1 = (v) => (Math.round(v * 10) / 10).toString();
  const pth = (pts, close) => pts.map((p, i) => (i ? "L" : "M") + t1(p[0]) + " " + t1(p[1])).join("") + (close ? "Z" : "");
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const s = C.s;

  // ---- convex-ish polyhedron renderer with the kit's four tones -------------------------------------
  function newell(pts) {
    const n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  }
  function toneOf(n) {
    if (n[2] > 0.7) return "top";
    const h = Math.hypot(n[0], n[1]) || 1;
    const lit = ((n[0] * LH[0] + n[1] * LH[1]) / h + 1) / 2;
    let sh = Math.min(3, Math.max(0, Math.floor(lit * 4)));
    if (n[2] < -0.25) sh = Math.max(0, sh - 1);
    return sh;
  }
  const keyOf = (p) => Math.round(p[0] * 500) + "," + Math.round(p[1] * 500) + "," + Math.round(p[2] * 500);
  // faces: [{ pts, g, out }]  out = approximate outward direction (orients the normal)
  function polySvg(faces, { tone = "hi", crease = "faint", lit = false, cls = "" } = {}) {
    const edges = new Map();
    const info = faces.map((f, fi) => {
      let n = newell(f.pts);
      if (f.out && dot(n, f.out) < 0) n = [-n[0], -n[1], -n[2]];
      const vis = dot(n, V) > 0.002;
      const c = f.pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / f.pts.length);
      for (let i = 0; i < f.pts.length; i++) {
        const a = keyOf(f.pts[i]), b = keyOf(f.pts[(i + 1) % f.pts.length]);
        if (a === b) continue;
        const k = a < b ? a + "|" + b : b + "|" + a;
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push(fi);
      }
      return { n, vis, depth: K.depthOf(c, P), f };
    });
    const order = info.map((x, i) => i).filter((i) => info[i].vis).sort((a, b) => info[a].depth - info[b].depth);
    const out = [];
    for (const fi of order) {
      const { n, f } = info[fi];
      const scr = f.pts.map((p) => K.iso(p, P));
      const t = toneOf(n);
      if (f.hatch) {
        out.push(`<path class="cp-cut" d="${pth(scr, true)}"/>`);
        const hd = hatchOf(f.hatch);
        if (hd) out.push(`<path class="iso-line cp-hatch" data-tone="lo" d="${hd}"/>`);
      } else out.push(t === "top" ? `<path class="iso-top" d="${pth(scr, true)}"/>` : `<path class="iso-shade" data-shade="${t}" d="${pth(scr, true)}"/>`);
      const ol = [], cr = [];
      for (let i = 0; i < f.pts.length; i++) {
        const a = keyOf(f.pts[i]), b = keyOf(f.pts[(i + 1) % f.pts.length]);
        if (a === b) continue;
        const list = edges.get(a < b ? a + "|" + b : b + "|" + a) || [];
        const others = list.filter((j) => j !== fi);
        const seg = pth([scr[i], scr[(i + 1) % scr.length]]);
        if (!others.length || others.every((j) => !info[j].vis)) ol.push(seg);
        else if (others.some((j) => info[j].vis && info[j].f.g !== f.g)) cr.push(seg);
      }
      if (cr.length && crease !== "none") out.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${cr.join("")}"/>`);
      if (ol.length) out.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${ol.join("")}"/>`);
    }
    return `<g class="iso-solid${cls ? " " + cls : ""}" data-seamless=""${lit ? ' data-lit=""' : ""}>${out.join("")}</g>`;
  }

  // ---- 45° section hatching on a radial cut face (r in [r0,r1], z in [zb,zt], mm; step in world units)
  function hatchOf({ o, r0, r1, a, zb, zt, step }) {
    const st = (step / o.sc) * Math.SQRT2;
    const Wp = (r, z) => K.iso([o.cx + r * o.sc * Math.cos(a * RAD), o.cy + r * o.sc * Math.sin(a * RAD), o.z0 + z * o.sc], P);
    const segs = [];
    const cLo = r0 - zt, cHi = r1 - zb;
    const n0 = Math.ceil((cLo + 1e-6) / st), n1 = Math.floor((cHi - 1e-6) / st);
    for (let n = n0; n <= n1; n++) {
      const c = n * st;
      const u1 = Math.max(r0, zb + c), u2 = Math.min(r1, zt + c);
      if (u2 - u1 < 0.02) continue;
      segs.push(pth([Wp(u1, u1 - c), Wp(u2, u2 - c)]));
    }
    return segs.join("");
  }

  // ---- sector block around a vertical axis (angles in degrees, sizes in mm) --------------------------
  // o: { cx, cy, z0, sc }  world = [cx + r sc cos a, cy + r sc sin a, z0 + z sc]
  function sector(o, { r0, r1, a0, a1, zb, zt, n = 0, cut = 0 }) {
    const W = (r, a, z) => [o.cx + r * o.sc * Math.cos(a * RAD), o.cy + r * o.sc * Math.sin(a * RAD), o.z0 + z * o.sc];
    const fb = typeof zb === "function" ? zb : () => zb;
    const ft = typeof zt === "function" ? zt : () => zt;
    const steps = n || Math.max(2, Math.ceil((a1 - a0) / 6));
    const faces = [];
    for (let i = 0; i < steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps, b = a0 + ((a1 - a0) * (i + 1)) / steps, m = (a + b) / 2;
      const rad = [Math.cos(m * RAD), Math.sin(m * RAD), 0];
      faces.push({ g: "o", out: rad, pts: [W(r1, a, fb(a)), W(r1, b, fb(b)), W(r1, b, ft(b)), W(r1, a, ft(a))] });
      if (r0 > 0) {
        faces.push({ g: "i", out: [-rad[0], -rad[1], 0], pts: [W(r0, a, fb(a)), W(r0, a, ft(a)), W(r0, b, ft(b)), W(r0, b, fb(b))] });
        faces.push({ g: "t", out: [0, 0, 1], pts: [W(r0, a, ft(a)), W(r1, a, ft(a)), W(r1, b, ft(b)), W(r0, b, ft(b))] });
        faces.push({ g: "b", out: [0, 0, -1], pts: [W(r0, a, fb(a)), W(r0, b, fb(b)), W(r1, b, fb(b)), W(r1, a, fb(a))] });
      } else {
        faces.push({ g: "t", out: [0, 0, 1], pts: [W(0, a, ft(m)), W(r1, a, ft(a)), W(r1, b, ft(b))] });
        faces.push({ g: "b", out: [0, 0, -1], pts: [W(0, a, fb(m)), W(r1, b, fb(b)), W(r1, a, fb(a))] });
      }
    }
    const t0 = [-Math.sin(a0 * RAD), Math.cos(a0 * RAD), 0], tN = [-Math.sin(a1 * RAD), Math.cos(a1 * RAD), 0];
    const hz = (a) => (cut ? { o, r0, r1, a, zb: fb(a), zt: ft(a), step: cut } : null);
    faces.push({ g: "e0", out: [-t0[0], -t0[1], 0], hatch: hz(a0), pts: [W(r0, a0, fb(a0)), W(r1, a0, fb(a0)), W(r1, a0, ft(a0)), W(r0, a0, ft(a0))] });
    faces.push({ g: "e1", out: tN, hatch: hz(a1), pts: [W(r0, a1, fb(a1)), W(r0, a1, ft(a1)), W(r1, a1, ft(a1)), W(r1, a1, fb(a1))] });
    return faces;
  }

  // ---- vertical coil spring, split into back and front halves ---------------------------------------
  function helix(cx, cy, r, z0, z1, turns, phase) {
    const tv = Math.atan2(V[1], V[0]);
    const N = Math.max(24, Math.round(turns * 36));
    const back = [], front = [];
    let run = null, runFront = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = phase + u * turns * Math.PI * 2;
      const p = K.iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z0 + (z1 - z0) * u], P);
      const isFront = Math.cos(a - tv) >= 0;
      if (isFront !== runFront) {
        if (run) run.push(p);
        run = [p];
        (isFront ? front : back).push(run);
        runFront = isFront;
      } else run.push(p);
    }
    const d = (list) => list.filter((r) => r.length > 1).map((r) => pth(r)).join("");
    return { back: d(back), front: d(front) };
  }
  const springSvg = (d, w) => d ? `<path class="cp-wire" d="${d}" style="stroke-width:${w}"/><path class="cp-wire-hi" d="${d}" style="stroke-width:${(w * 0.38).toFixed(2)}"/>` : "";

  // ---- the model (10:1 cutaway) ---------------------------------------------------------------------
  const MO = { cx: C.MX, cy: C.MY, z0: C.MZ - C.mOff * C.M, sc: C.M };
  const mz = (mm) => MO.z0 + mm * C.M;
  const B = C.B; // back channel centre (world degrees)
  const W = (r, a, z, o = MO) => [o.cx + r * o.sc * Math.cos(a * RAD), o.cy + r * o.sc * Math.sin(a * RAD), o.z0 + z * o.sc];

  function lug(psi, camZ, lit) {
    const a0 = psi - 10, a1 = psi + 10;
    return polySvg(sector(MO, { r0: 1.4, r1: 3.5, a0, a1, n: 5, zb: camZ - 3.0, zt: (a) => camZ + s * (a - a0) }), { tone: "hi", crease: "faint", cls: lit ? "m-accent" : "m-brass" });
  }
  // world angle of lug i at cam angle psi (psi = lug-0 centre)
  const lugs = (psi) => [0, 1, 2, 3].map((i) => psi + 90 * i);
  const facingDeg = Math.atan2(V[1], V[0]) / RAD;
  const isBack = (a) => Math.cos((a - facingDeg) * RAD) < 0;

  function camBody(camZ) {
    const z = mz;
    return [
      K.solidSvg(K.cylinder(C.MX, C.MY, 1.1 * C.M, z(Math.max(C.mOff, camZ - 6)), (camZ - 3.5 - Math.max(C.mOff, camZ - 6)) * C.M, P, 40), { tone: "hi", className: "m-brass" }),
      K.solidSvg(K.cylinder(C.MX, C.MY, 1.4 * C.M, z(camZ - 3.5), 2.1 * C.M, P, 56, 0.6), { tone: "hi", className: "m-brass", inner: K.lineSvg(K.sideArc(C.MX, C.MY, 1.4 * C.M, z(camZ - 3.0), P, 40), { tone: "faint" }) }),
    ].join("");
  }
  function refillModel(camZ) {
    const z = mz;
    const top = camZ - 6, plugB = top - 1.6, f = C.mOff;
    const out = [];
    if (plugB > f + 0.02) {
      out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 1.5 * C.M, z(f), (plugB - f) * C.M, P, 48), { tone: "hi", className: "m-ink" }));
    }
    // return spring around the refill, from the barrel floor up to the collar (compressed when the cam is down)
    if (plugB > f + 0.3) {
      const sp = helix(C.MX, C.MY, 2.35 * C.M, z(f), z(plugB), 5, 0.3);
      out.unshift(springSvg(sp.back, 2.4));
      out.push(springSvg(sp.front, 2.4));
    }
    if (top > f + 0.02) {
      const b0 = Math.max(plugB, f);
      out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 1.75 * C.M, z(b0), (top - b0) * C.M, P, 48, 0.5), { tone: "hi", className: "m-steel" }));
    }
    return out.join("");
  }
  // plunger at rest position 0 (moved by translate)
  function plungerSvg() {
    const out = [];
    const o = { ...MO };
    const w0 = C.CH + 32.5;
    const slices = [];
    for (let k = 0; k < 8; k++) {
      const a0 = w0 + 45 * k, a1 = a0 + 45;
      slices.push({ a: a0 + 22.5, svg: polySvg(sector(o, { r0: 1.0, r1: 2.0, a0, a1, n: 8, zb: (a) => s * (a - a0), zt: 3.2 }), { tone: "hi", cls: "m-plunger" }) });
    }
    const dA = (x) => K.depthOf(W(1.7, x.a, 1), P);
    slices.sort((p, q) => dA(p) - dA(q));
    const z = mz;
    out.push(...slices.filter((x) => isBack(x.a)).map((x) => x.svg));
    out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 1.0 * C.M, z(0), 3.2 * C.M, P, 40), { tone: "hi", crease: "none", className: "m-plunger" }));
    out.push(...slices.filter((x) => !isBack(x.a)).map((x) => x.svg));
    const keys = [0, 1, 2, 3].map((i) => C.CH + 90 * i).sort((p, q) => K.depthOf(W(3.0, p, 5), P) - K.depthOf(W(3.0, q, 5), P));
    const keySvg = (a) => polySvg(sector(o, { r0: 1.9, r1: 3.7, a0: a - 4.5, a1: a + 4.5, n: 2, zb: 5.2, zt: 7.4 }), { tone: "hi", cls: "m-plunger" });
    out.push(...keys.filter((a) => isBack(a)).map(keySvg));
    out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 2.0 * C.M, z(3.2), 4.8 * C.M, P, 56), { tone: "hi", className: "m-plunger", inner: K.lineSvg(K.sideArc(C.MX, C.MY, 2.0 * C.M, z(3.9), P, 40), { tone: "faint" }) }));
    out.push(...keys.filter((a) => !isBack(a)).map(keySvg));
    out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 2.6 * C.M, z(8), 7.7 * C.M, P, 64, 0.5), { tone: "hi", className: "m-plunger", inner: [11.6, 12.4, 13.2].map((zz) => K.lineSvg(K.sideArc(C.MX, C.MY, 2.6 * C.M, z(zz), P, 48), { tone: "lo" })).join("") }));
    out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 2.3 * C.M, z(15.7), 0.3 * C.M, P, 64, 0.8), { tone: "hi", className: "m-plunger" }));
    out.push(K.lineSvg(K.ring(C.MX, C.MY, 1.0 * C.M, z(16), P, 40), { tone: "faint" }));
    return out.join("");
  }

  function modelStatic() {
    const o = MO;
    const back = [], front = [];
    const WT = C.winTop;
    // barrel: back half full height; front half only above the window (the window shows the ribs and the cam)
    back.push(polySvg(sector(o, { r0: 4.0, r1: 5.0, a0: B - 122, a1: B + 122, n: 48, zb: C.mOff, zt: 26, cut: 4.2 }), { tone: "hi", cls: "m-smoke" }));
    back.push(polySvg(sector(o, { r0: 2.75, r1: 5.15, a0: B - 122, a1: B + 122, n: 48, zb: 26, zt: 27.6 }), { tone: "hi", cls: "m-smoke" }));
    // ribs on the inner wall: for each channel centre c, a long ramp [c+12, c+55] ending in the notch wall,
    // then a short ramp [c+55, c+78] that hands a lug on to the next channel.
    const ribs = [];
    const add = (f, t, base, lo, hi, list) => {
      const a0 = Math.max(f, lo), a1 = Math.min(t, hi);
      if (a1 - a0 < 0.5) return;
      list.push({ a: (a0 + a1) / 2, f: sector(o, { r0: 3.0, r1: 4.0, a0, a1, n: Math.max(2, Math.round((a1 - a0) / 4)), zb: (a) => C.zA + s * (a - base), zt: C.zRT }) });
    };
    const backRibs = [], frontRibs = [];
    for (let i = 0; i < 4; i++) {
      let c = C.CH + 90 * i;
      while (c > B + 180) c -= 360;
      while (c < B - 180) c += 360;
      for (const [f, t, base] of [[c + 12, c + 55, c + 12], [c + 55, c + 78, c + 55]]) {
        for (const sh of [-360, 0, 360]) {
          add(f + sh, t + sh, base + sh, B - 122, B + 122, backRibs);
        }
      }
    }
    const dR = (x) => K.depthOf(W(3.5, x.a, 15), P);
    backRibs.sort((p, q) => dR(p) - dR(q));
    frontRibs.sort((p, q) => dR(p) - dR(q));
    for (const r of backRibs) back.push(polySvg(r.f, { tone: "hi", cls: "m-rib" }));
    for (const r of frontRibs) front.push(polySvg(r.f, { tone: "hi", cls: "m-rib" }));
    front.push(polySvg(sector(o, { r0: 2.75, r1: 5.15, a0: B + 122, a1: B + 238, n: 24, zb: 26, zt: 27.6 }), { tone: "hi", cls: "m-smoke" }));
    return { back: back.join(""), front: front.join("") };
  }
  // the part of the model's button standing above the cap (drawn after the cap's front half)
  function modelButton(plZ) {
    const z = mz, cap = 27.6, top = plZ + 15.7;
    const out = [];
    if (top > cap + 0.02) out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 2.6 * C.M, z(cap), (top - cap) * C.M, P, 64, 0.5), { tone: "hi", className: "m-plunger" }));
    if (top + 0.3 > cap + 0.02) {
      const b0 = Math.max(top, cap);
      out.push(K.solidSvg(K.cylinder(C.MX, C.MY, 2.3 * C.M, z(b0), (top + 0.3 - b0) * C.M, P, 64, 0.8), { tone: "hi", className: "m-plunger", inner: "" }));
      out.push(K.lineSvg(K.ring(C.MX, C.MY, 1.0 * C.M, z(top + 0.3), P, 40), { tone: "faint" }));
    }
    return out.join("");
  }

  // ---- the real pen (1:1 scaled by C.PS) --------------------------------------------------------------
  const PO = { cx: C.PX, cy: C.PY, z0: C.PZ, sc: C.PS };
  const pz = (mm) => C.PZ + mm * C.PS;
  function penTipZ(camZ) { return C.tipOut + (camZ - C.czOut); }
  function penWindow(camZ) {
    // refill tube and its collar, spring between the cone seat (z 14) and the collar
    const tip = penTipZ(camZ);
    const collar = tip + 25.5;
    const sp = helix(C.PX, C.PY, 2.3 * C.PS, pz(14.2), pz(collar), 7.5, 0.6);
    const out = [];
    out.push(springSvg(sp.back, 1.15));
    out.push(K.solidSvg(K.cylinder(C.PX, C.PY, 1.5 * C.PS, pz(14), (50 - 14) * C.PS, P, 32), { tone: "hi", className: "m-ink" }));
    out.push(K.solidSvg(K.cylinder(C.PX, C.PY, 2.75 * C.PS, pz(collar), 1.3 * C.PS, P, 40, 0.4), { tone: "hi", className: "m-brass" }));
    out.push(springSvg(sp.front, 1.15));
    return out.join("");
  }
  function penButton(plZ) {
    const prot = plZ - 9.6; // mm above the top ring
    const z0 = pz(C.penTop);
    return K.solidSvg(K.cylinder(C.PX, C.PY, 3.1 * C.PS, z0, prot * C.PS, P, 40, 0.4), { tone: "hi", className: "m-plunger", inner: K.lineSvg(K.sideArc(C.PX, C.PY, 3.1 * C.PS, z0 + (prot - 0.9) * C.PS, P, 24), { tone: "faint" }) });
  }

  // ---- motion: deterministic click timeline -------------------------------------------------------------
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const easeOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
  const rest = (S) => (S === "in" ? C.czIn : C.czOut);
  // durations by speed
  const DUR = {
    slow: [0.95, 0.75, 0.35, 1.25],
    quick: [0.28, 0.18, 0.15, 0.5],
    xslow: [2.6, 3.2, 1.4, 3.8],       // explainer: press, turn, release, settle
  };
  const durOf = (sp) => DUR[sp].reduce((a, b) => a + b, 0);
  // one click in progress: S = state before, e = elapsed seconds
  function during(S, sp, e, psi0) {
    const [d1, d2, d3, d4] = DUR[sp];
    const zA = C.zA;
    const cam0 = S === "in" ? zA - s * 22 - 0.15 : zA - s * 20 - 0.15;
    const camStart = rest(S);
    let u = 0, cz, plz;
    if (e < d1) {
      cz = camStart + (cam0 - camStart) * ease(e / d1);
      plz = cz - s * 2.5;
    } else if (e < d1 + d2) {
      u = 22.5 * ease((e - d1) / d2);
      cz = cam0 + s * u;
      plz = cam0 - s * 2.5;
    } else if (e < d1 + d2 + d3) {
      const x = ease((e - d1 - d2) / d3);
      u = 22.5;
      cz = cam0 + s * 22.5 + 0.15 * x;
      const peak = cz + s * 20 + 0.25;
      plz = cam0 - s * 2.5 + (peak - (cam0 - s * 2.5)) * easeOut((e - d1 - d2) / d3);
    } else {
      const x = Math.min(1, (e - d1 - d2 - d3) / d4);
      const camL = cam0 + s * 22.5 + 0.15; // = zA + s*0.5 (from in) or zA + s*2.5 (from out)
      const peak = camL + s * 20 + 0.25;
      if (S === "in") {
        // slide up ramp 1 into the notch, small settle
        const v = ease(Math.min(1, x / 0.8));
        u = 22.5 + 22.5 * v;
        cz = camL + s * (u - 22.5);
        const fin = C.czOut - s * 2.5;
        plz = Math.max(cz + s * (42.5 - u), peak + (fin - peak) * easeOut(Math.min(1, x / 0.9)));
      } else {
        const xa = 0.5;
        if (x < xa) {
          u = 22.5 + 21 * ease(x / xa);
          cz = camL + s * (u - 22.5);
        } else {
          const y = (x - xa) / (1 - xa);
          u = 43.5 + 1.5 * ease(Math.min(1, y * 2));
          // spring shoots the cam up the channel: quick rise, tiny overshoot, settle
          const from = camL + s * 21, to = C.czIn;
          const r = ease(y) + 0.05 * Math.sin(Math.PI * y) * y; // smooth rise, slight overshoot, no one-frame jump
          cz = from + (to - from) * (y >= 1 ? 1 : r);
        }
        const fin = cz - s * 2.5;
        plz = Math.max(cz + s * (42.5 - u), peak + (fin - peak) * easeOut(Math.min(1, x / 0.75)));
      }
    }
    return { psi: psi0 + u, camZ: cz, plZ: plz };
  }
  // clicks: [{ t0, sp }] sorted; returns pose and event list helper
  function poseAt(t, clicks, start) {
    let S = start.S, psi = start.psi;
    for (const c of clicks) {
      if (t < c.t0) break;
      const e = t - c.t0;
      if (e < durOf(c.sp)) return { ...during(S, c.sp, e, psi), S, busy: true };
      S = S === "in" ? "out" : "in";
      psi += 45;
    }
    return { psi, camZ: rest(S), plZ: rest(S) - s * 2.5, S, busy: false };
  }
  function eventsOf(clicks, start) {
    const ev = [];
    let S = start.S;
    for (const c of clicks) {
      const [d1, d2, d3, d4] = DUR[c.sp];
      const i = c.sp === "slow" ? 0.7 : 1;
      ev.push({ t: +(c.t0).toFixed(3), type: "press", i: +(i * 0.55).toFixed(2) });
      ev.push({ t: +(c.t0 + d1 + d2).toFixed(3), type: "click", i: +(i * 0.8).toFixed(2) });
      ev.push({ t: +(c.t0 + d1 + d2 + d3 * 0.4).toFixed(3), type: "release", i: +(i * 0.5).toFixed(2) });
      if (S === "in") ev.push({ t: +(c.t0 + d1 + d2 + d3 + d4 * 0.8).toFixed(3), type: "click", i: +i.toFixed(2) });
      else ev.push({ t: +(c.t0 + d1 + d2 + d3 + d4 * 0.5 + 0.06).toFixed(3), type: "retract", i: +i.toFixed(2) });
      S = S === "in" ? "out" : "in";
    }
    return ev;
  }

  // ---- dynamic markup for one pose ------------------------------------------------------------------
  function dynamic(pose) {
    const L = lugs(pose.psi);
    const back = [], front = [];
    L.forEach((a, i) => (isBack(a) ? back : front).push({ a, i }));
    const depthA = (x) => K.depthOf(W(2.85, x.a, pose.camZ), P);
    back.sort((p, q) => depthA(p) - depthA(q));
    front.sort((p, q) => depthA(p) - depthA(q));
    return {
      refill: refillModel(pose.camZ),
      lugsBack: back.map((x) => lug(x.a, pose.camZ, x.i === 1)).join(""),
      cam: camBody(pose.camZ),
      lugsFront: front.map((x) => lug(x.a, pose.camZ, x.i === 1)).join(""),
      penWindow: penWindow(pose.camZ),
      penButton: penButton(pose.plZ),
      modelButton: modelButton(pose.plZ),
    };
  }

  return { modelButton, polySvg, sector, helix, springSvg, modelStatic, plungerSvg, dynamic, poseAt, eventsOf, durOf, penTipZ, W, MO, PO, isBack };
}

export { makeMech };
