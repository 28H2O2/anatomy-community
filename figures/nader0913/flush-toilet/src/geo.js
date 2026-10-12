// Shared by build.mjs (Node) and the live page (inlined). Plain script: no imports, no exports.
// makeToilet(K, P, C): K = kit functions, P = projection, C = constants/geometry from build.mjs.
// World: x = front-back (wall side low, bowl front high), y = side (cut plane y = 0, kept half y < 0), z = up, mm.
function makeToilet(K, P, C) {
  const RAD = Math.PI / 180;
  const cam = K.cameraOf(P);
  const V = [cam.cosA * cam.cosE, cam.sinA * cam.cosE, cam.sinE];
  const LH = [-cam.sinA, cam.cosA];
  const t1 = (v) => (Math.round(v * 10) / 10).toString();
  const I = (p) => K.iso(p, P);
  const pth = (pts, close) => pts.map((p, i) => (i ? "L" : "M") + t1(p[0]) + " " + t1(p[1])).join("") + (close ? "Z" : "");
  const P3 = (pts, close) => pth(pts.map(I), close);
  const XZ = (poly, y = 0) => poly.map(([x, z]) => [x, y, z]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (u, a, b) => clamp((u - a) / (b - a));
  const ease = (s) => s * s * (3 - 2 * s);
  const lerp = (a, b, s) => a + (b - a) * s;

  // ---- face renderer with the kit's four tones -----------------------------------------------------
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
  const keyOf = (p) => Math.round(p[0] * 50) + "," + Math.round(p[1] * 50) + "," + Math.round(p[2] * 50);
  function polySvg(faces, { tone = "hi", crease = "faint", cls = "", sort = true } = {}) {
    const edges = new Map();
    const info = faces.map((f, fi) => {
      let n = newell(f.pts);
      if (f.out && dot(n, f.out) < 0) n = [-n[0], -n[1], -n[2]];
      const vis = f.both || dot(n, V) > 0.002;
      const c = f.pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / f.pts.length);
      for (let i = 0; i < f.pts.length; i++) {
        const a = keyOf(f.pts[i]), b = keyOf(f.pts[(i + 1) % f.pts.length]);
        if (a === b) continue;
        const k = a < b ? a + "|" + b : b + "|" + a;
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push(fi);
      }
      return { n, vis, depth: f.depth != null ? f.depth : K.depthOf(c, P), f };
    });
    let order = info.map((x, i) => i).filter((i) => info[i].vis);
    if (sort) order.sort((a, b) => info[a].depth - info[b].depth);
    const out = [];
    for (const fi of order) {
      const { n, f } = info[fi];
      const scr = f.pts.map(I);
      const t = f.tone != null ? f.tone : toneOf(n);
      out.push(t === "top" ? `<path class="iso-top" d="${pth(scr, true)}"/>` : `<path class="iso-shade" data-shade="${t}" d="${pth(scr, true)}"/>`);
      const ol = [], cr = [];
      for (let i = 0; i < f.pts.length; i++) {
        const a = keyOf(f.pts[i]), b = keyOf(f.pts[(i + 1) % f.pts.length]);
        if (a === b) continue;
        const list = edges.get(a < b ? a + "|" + b : b + "|" + a) || [];
        const others = list.filter((j) => j !== fi);
        const sg = pth([scr[i], scr[(i + 1) % scr.length]]);
        if (!others.length || others.every((j) => !info[j].vis)) ol.push(sg);
        else if (others.some((j) => info[j].vis && info[j].f.g !== f.g)) cr.push(sg);
      }
      if (cr.length && crease !== "none") out.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${cr.join("")}"/>`);
      if (ol.length) out.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${ol.join("")}"/>`);
    }
    return `<g class="iso-solid${cls ? " " + cls : ""}" data-seamless="">${out.join("")}</g>`;
  }

  // ---- primitives in a frame { o, u, v, w } ---------------------------------------------------------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const at = (F, a, b, c) => add(add(add(F.o, mul(F.u, a)), mul(F.v, b)), mul(F.w, c));
  function cylFaces(F, r, h0, h1, n = 28, g = "c") {
    const faces = [];
    const p = (i, h) => at(F, r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI), h);
    for (let i = 0; i < n; i++) {
      const m = ((i + 0.5) / n) * 2 * Math.PI;
      faces.push({ g: g + "s", out: add(mul(F.u, Math.cos(m)), mul(F.v, Math.sin(m))), pts: [p(i, h0), p(i + 1, h0), p(i + 1, h1), p(i, h1)] });
    }
    faces.push({ g: g + "1", out: F.w, pts: Array.from({ length: n }, (_, i) => p(i, h1)) });
    faces.push({ g: g + "0", out: mul(F.w, -1), pts: Array.from({ length: n }, (_, i) => p(i, h0)) });
    return faces;
  }
  function boxFaces(F, [a0, a1], [b0, b1], [c0, c1], g = "b") {
    const q = (a, b, c) => at(F, a, b, c);
    return [
      { g: g + "u0", out: mul(F.u, -1), pts: [q(a0, b0, c0), q(a0, b1, c0), q(a0, b1, c1), q(a0, b0, c1)] },
      { g: g + "u1", out: F.u, pts: [q(a1, b0, c0), q(a1, b0, c1), q(a1, b1, c1), q(a1, b1, c0)] },
      { g: g + "v0", out: mul(F.v, -1), pts: [q(a0, b0, c0), q(a0, b0, c1), q(a1, b0, c1), q(a1, b0, c0)] },
      { g: g + "v1", out: F.v, pts: [q(a0, b1, c0), q(a1, b1, c0), q(a1, b1, c1), q(a0, b1, c1)] },
      { g: g + "w0", out: mul(F.w, -1), pts: [q(a0, b0, c0), q(a1, b0, c0), q(a1, b1, c0), q(a0, b1, c0)] },
      { g: g + "w1", out: F.w, pts: [q(a0, b0, c1), q(a0, b1, c1), q(a1, b1, c1), q(a1, b0, c1)] },
    ];
  }
  const VERT = (x, y, z) => ({ o: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] });
  const ALONGX = (x, y, z) => ({ o: [x, y, z], u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] });
  const ALONGY = (x, y, z) => ({ o: [x, y, z], u: [1, 0, 0], v: [0, 0, 1], w: [0, -1, 0] });
  // rotations of point lists
  const rotY = (x0, z0, deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return (p) => [x0 + (p[0] - x0) * c - (p[2] - z0) * s, p[1], z0 + (p[0] - x0) * s + (p[2] - z0) * c]; };
  const rotX = (y0, z0, deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return (p) => [p[0], y0 + (p[1] - y0) * c - (p[2] - z0) * s, z0 + (p[1] - y0) * s + (p[2] - z0) * c]; };
  const xform = (faces, fn, rot) => faces.map((f) => ({ ...f, pts: f.pts.map(fn), out: f.out ? rot(f.out) : f.out }));
  const dirY = (deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return (d) => [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c]; };
  const dirX = (deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return (d) => [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]; };
  const depthC = (faces) => { let s = 0, n = 0; for (const f of faces) for (const p of f.pts) { s += K.depthOf(p, P); n++; } return s / n; };

  // ---- polygon helpers ------------------------------------------------------------------------------
  function clipZ(poly, h, below = true) {
    const out = [];
    const inside = (p) => (below ? p[1] <= h : p[1] >= h);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (h - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, h]); }
    }
    return out;
  }
  const wpath = (poly, y = 0) => (poly.length > 2 ? P3(XZ(poly, y), true) : "");
  function interpX(line, z) { // line sorted by z ascending: [[x,z]...]
    if (z <= line[0][1]) return line[0][0];
    for (let i = 1; i < line.length; i++) if (z <= line[i][1]) { const a = line[i - 1], b = line[i]; return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]); }
    return line[line.length - 1][0];
  }
  // the bowl's inner surface: horizontal sections are ellipses through the cut profile
  function bowlRing(z) {
    const xf = interpX(C.bowlFrontUp, z), xb = interpX(C.bowlBackUp, z);
    const a = (xf - xb) / 2;
    return { cx: (xf + xb) / 2, a, b: Math.min(C.bowlB, a * 0.74) };
  }
  const ringPt = (R, t, z) => [R.cx + R.a * Math.cos(t), -R.b * Math.sin(t), z];
  function halfArc(z, n = 40) { const R = bowlRing(z); return Array.from({ length: n + 1 }, (_, i) => ringPt(R, (i / n) * Math.PI, z)); }

  // ---- the model: one flush cycle in local seconds u ------------------------------------------------
  // One slow, continuous cycle with short holds on each key moment. Every quantity is a continuous function of u
  // (eased segments, no branches that switch shape), so consecutive frames can only differ by a small step.
  const H_FULL = C.hFull, H_SEAT = C.hSeat, H_CLOSE = C.hClose;
  const BOWL_REST = C.bowlRest, BOWL_HI = C.bowlHi, BOWL_LOW = C.bowlLow;
  const easeIn = (s) => s * s;
  const TL = {
    press: [0.8, 1.2], release: [2.5, 2.95],          // handle down, held, back up
    lift: [0.95, 1.45],                                // chain lifts the flapper (lever leads it)
    drain: [1.5, 6.6],                                 // tank empties through the flush valve
    rise: [1.75, 3.6],                                 // bowl rises to the weir
    spillUp: [2.25, 2.85], spillDown: [2.75, 3.95],    // water climbs over the weir and runs down the outlet leg
    siphon: [3.9, 4.3], suck: [4.15, 6.75],            // trapway full: red siphon kicks in, bowl is pulled down
    brk: [6.55, 7.6], gurgle: [6.35, 7.85],            // air gets in: the siphon breaks with a gurgle
    drop: [7.95, 8.35],                                // flapper falls on its seat
    refill: [8.35, 23.0], bowlRefill: [8.6, 15.0],     // float rises with the tank, refill tube tops the bowl up
  };
  const CYCLE_END = 24;
  const sq0 = Math.sqrt(H_FULL - H_SEAT), sq1 = Math.sqrt(H_CLOSE - H_SEAT);
  const hTankAt = (u) => {
    if (u < TL.refill[0]) { const q = sq0 - (sq0 - sq1) * ease(seg(u, ...TL.drain)); return H_SEAT + q * q; }
    const f = seg(u, ...TL.refill);
    return H_CLOSE + (H_FULL - H_CLOSE) * (1 - Math.pow(1 - f, 1.8));
  };
  function cycle(u) {
    const s = { u };
    s.theta = 28 * (ease(seg(u, ...TL.press)) - ease(seg(u, ...TL.release)));
    const hT = hTankAt(u);
    s.hT = hT;
    // drain intensity: proportional to the outflow, faded in/out
    const q = Math.sqrt(Math.max(0, hT - H_SEAT));
    s.drain = (q / sq0) * ease(seg(u, TL.drain[0], TL.drain[0] + 0.4)) * (1 - ease(seg(u, TL.drain[1] - 0.5, TL.drain[1] + 0.2)));
    s.phi = 72 * (ease(seg(u, ...TL.lift)) - easeIn(seg(u, ...TL.drop)));
    s.cup = clamp(hT - 32, C.cupLow, C.cupHigh);
    s.valve = clamp((H_FULL - 1.5 - hT) / 8);
    s.R = Math.max(s.drain * ease(seg(u, 1.6, 2.0)), 0.3 * ease(seg(u, TL.bowlRefill[0], TL.bowlRefill[0] + 0.6)) * (1 - ease(seg(u, TL.bowlRefill[1] - 1, TL.bowlRefill[1]))));
    // bowl level: rest -> up to the weir -> held while it spills -> pulled down by the siphon -> refilled
    const up = ease(seg(u, ...TL.rise)), down = ease(seg(u, ...TL.suck)), back = ease(seg(u, ...TL.bowlRefill));
    s.hB = BOWL_REST + (BOWL_HI - BOWL_REST) * up - (BOWL_HI - BOWL_LOW) * down + (BOWL_REST - BOWL_LOW) * back;
    // trapway: level in the rising leg, front of the water in the outlet leg (both continuous)
    s.spillUp = ease(seg(u, ...TL.spillUp));
    s.spillDown = ease(seg(u, ...TL.spillDown));
    s.brk = ease(seg(u, ...TL.brk));
    s.red = ease(seg(u, ...TL.siphon)) * (1 - ease(seg(u, TL.brk[0] + 0.5, TL.brk[1] + 0.25)));
    s.flow = ease(seg(u, TL.siphon[0] - 0.1, TL.siphon[1])) * (1 - ease(seg(u, TL.brk[0], TL.brk[0] + 0.6)));
    s.gurgle = ease(seg(u, TL.gurgle[0], TL.gurgle[0] + 0.3)) * (1 - ease(seg(u, TL.gurgle[1] - 0.4, TL.gurgle[1])));
    s.refill = s.valve * ease(seg(u, TL.drain[0], TL.drain[0] + 0.5));
    return s;
  }
  // tour time where the valve shuts (valve reaches 0)
  let shutU = TL.refill[0]; while (shutU < TL.refill[1] && cycle(shutU).valve > 0) shutU += 0.01;
  const CYCLE_EVENTS = [
    [0.85, "click", 0.55], [1.2, "slide", 0.45], [1.6, "water", 1.0], [2.6, "tick", 0.5],
    [3.95, "water", 0.9], [6.6, "whoosh", 0.85], [8.35, "thunk", 0.95], [8.7, "water", 0.35], [+shutU.toFixed(2), "click", 0.6],
  ];
  function stateAt(T, cycles) {
    let s = null;
    for (const c of cycles) if (T >= c.t0) s = cycle(Math.min((T - c.t0) * c.sp, CYCLE_END));
    if (!s) s = cycle(0);
    return s;
  }
  function eventsOf(cycles) {
    const ev = [];
    for (const c of cycles) for (const [u, type, i] of CYCLE_EVENTS) ev.push({ t: +(c.t0 + u / c.sp).toFixed(3), type, i });
    return ev.sort((a, b) => a.t - b.t);
  }
  // fade envelope for anything that loops with a phase f in [0, 1): zero at both ends, so the wrap never pops
  const loopEnv = (f) => Math.sin(Math.PI * f) ** 2;

  // ---- dynamic markup --------------------------------------------------------------------------------
  const W_FILL = "tw-fill", W_SURF = "tw-surf", W_LINE = "tw-line";
  const tankIn = C.tankIn; // { x0, x1, y0, z0 }
  function tankBack(s, T) {
    const { x0, x1, y0, z0 } = tankIn, h = s.hT;
    const out = [];
    out.push(`<path class="tw-tint" d="${P3([[x0, y0, z0], [x1, y0, z0], [x1, y0, h], [x0, y0, h]], true)}"/>`);
    out.push(`<path class="tw-tint" d="${P3([[x0, 0, z0], [x0, y0, z0], [x0, y0, h], [x0, 0, h]], true)}"/>`);
    out.push(`<path class="${W_SURF}" d="${P3([[x0, 0, h], [x1, 0, h], [x1, y0, h], [x0, y0, h]], true)}"/>`);
    // waterline on the far walls
    out.push(`<path class="${W_LINE}" d="${P3([[x0, 0, h], [x0, y0, h], [x1, y0, h]])}"/>`);
    // whirl over the flush valve while draining
    const whirl = s.drain * ease(clamp((s.phi - 20) / 30));
    if (whirl > 0.005) {
      const [cx, cy] = C.fv, a = whirl;
      const arcs = [];
      for (let k = 0; k < 3; k++) {
        const r = 22 + k * 15, ph = T * (2.6 - k * 0.5) + k * 2.1;
        const pts = Array.from({ length: 13 }, (_, i) => { const t = ph + (i / 12) * 2.2; return [cx + r * Math.cos(t), Math.max(y0 + 2, cy + r * Math.sin(t)), h + 0.5]; });
        arcs.push(P3(pts));
      }
      out.push(`<path class="tw-foam" style="opacity:${(0.9 * Math.min(1, a * 1.5)).toFixed(2)}" d="${arcs.join("")}"/>`);
    }
    // inflow from the fill valve skirt
    if (s.refill > 0.02) {
      const [fx, fy] = C.fill;
      const op = s.refill;
      const rip = [];
      for (let k = 0; k < 3; k++) {
        const f = (T * 30 / 42 + k / 3) % 1, r = 30 + 42 * f;
        const pts = Array.from({ length: 11 }, (_, i) => { const t = -0.3 + (i / 10) * 2.4; return [fx + r * Math.cos(t), Math.max(y0 + 2, fy + r * 0.9 * Math.sin(t)), h + 0.5]; });
        rip.push([P3(pts), loopEnv(f)]);
      }
      for (const [d, f] of rip) out.push(`<path class="tw-foam" style="opacity:${(op * f * 0.8).toFixed(2)}" d="${d}"/>`);
    }
    return out.join("");
  }
  function tankFront(s) {
    const { x0, x1, z0 } = tankIn, h = s.hT;
    return `<path class="tw-front" d="${P3([[x0, 0, z0], [x1, 0, z0], [x1, 0, h], [x0, 0, h]], true)}"/>` +
      `<path class="${W_LINE}" d="${P3([[x0, 0, h], [x1, 0, h]])}"/>`;
  }
  function bowlBack(s, T) {
    const out = [];
    const h = s.hB;
    const surfA = clamp((h - C.throatTop) / 12);
    if (surfA > 0.005) {
      const pts = halfArc(h, 44);
      const op = surfA < 1 ? ` style="opacity:${surfA.toFixed(2)}"` : "";
      out.push(`<path class="${W_SURF}"${op} d="${P3(pts, true)}"/>`);
      out.push(`<path class="${W_LINE}"${op} d="${P3(pts)}"/>`);
      // ripples
      const rip = Math.max(s.R, s.flow * 0.8);
      if (rip > 0.03) {
        const R = bowlRing(h), d = [];
        for (let k = 0; k < 3; k++) {
          const f = ((T * 0.9 + k / 3) % 1), sc = 0.25 + 0.7 * f;
          const q = Array.from({ length: 21 }, (_, i) => { const t = 0.15 + (i / 20) * (Math.PI - 0.3); return [R.cx - 10 + R.a * sc * Math.cos(t), -R.b * sc * Math.sin(t), h + 0.3]; });
          out.push(`<path class="tw-foam" style="opacity:${(rip * surfA * loopEnv(f) * 0.9).toFixed(2)}" d="${P3(q)}"/>`);
        }
      }
    }
    // rim jets running down the back of the bowl
    if (s.R > 0.02) {
      const d = [];
      for (const t of C.rimHolesT) {
        const pts = [];
        for (let z = C.rimHoleZ; z >= h + 1; z -= 6) {
          const R = bowlRing(z), sw = t + (C.rimHoleZ - z) * 0.0016;
          pts.push(ringPt(R, sw, z));
        }
        if (pts.length > 1) d.push(P3(pts));
      }
      out.push(`<path class="tw-jet" style="opacity:${Math.min(1, s.R * 1.6).toFixed(2)};stroke-dashoffset:${(-T * 90).toFixed(1)}" d="${d.join("")}"/>`);
    }
    return out.join("");
  }
  // trapway water in the cut plane. One formula for every phase (no branches), so the shape only ever moves a little:
  // rising leg filled to `lvl` (bowl level -> over the crest -> back to bowl level as the siphon breaks),
  // outlet leg filled between the falling front (spill) and the falling top (break).
  const TRAP_TOP = C.downTop + 6;
  function passageWater(s) {
    const hB = s.hB;
    const lvl = lerp(lerp(hB, TRAP_TOP, s.spillUp), hB, s.brk);
    const rise = clipZ(C.pRise, lvl);
    const front = TRAP_TOP - (TRAP_TOP - C.downBot) * s.spillDown;
    const top = TRAP_TOP - (TRAP_TOP - C.downBot + 30) * s.brk;
    const down = top > front + 0.5 ? clipZ(clipZ(C.pDown, front, false), top, true) : [];
    return [rise, down].map((p) => wpath(p)).join("");
  }
  function cutWater(s, T) {
    const out = [];
    // bowl + jet channel (communicating) water
    const jetLvl = lerp(s.hB, 402, ease(clamp(s.R * 4)));
    const bowl = wpath(clipZ(C.bowlPoly, s.hB)) + wpath(clipZ(C.jetPoly, jetLvl));
    const inlet = s.R > 0.02 ? wpath(C.inletPoly) : "";
    const trap = passageWater(s);
    out.push(`<path class="${W_FILL}" d="${bowl}"/>`);
    if (inlet) out.push(`<path class="${W_FILL}" style="opacity:${Math.min(1, s.R * 2.2).toFixed(2)}" d="${inlet}"/>`);
    out.push(`<path class="${W_FILL}" d="${trap}"/>`);
    if (s.red > 0.01) out.push(`<path class="tw-red" style="opacity:${s.red.toFixed(2)}" d="${trap}"/>`);
    // waterline across the bowl cut
    const xf = interpX(C.bowlFrontUp, s.hB), xb = interpX(C.bowlBackUp, s.hB);
    const surfA = clamp((s.hB - C.throatTop) / 12);
    if (surfA > 0.005) out.push(`<path class="${W_LINE}"${surfA < 1 ? ` style="opacity:${surfA.toFixed(2)}"` : ""} d="${P3([[xb, 0, s.hB], [xf, 0, s.hB]])}"/>`);
    // jet streak from the jet hole toward the throat
    if (s.R > 0.05 && s.hB > C.throatTop) out.push(`<path class="tw-streak" style="opacity:${Math.min(1, s.R * 1.5).toFixed(2)};stroke-dashoffset:${(-T * 120).toFixed(1)}" d="${P3(XZ(C.jetStreak))}"/>`);
    // flow streaks through the full trapway
    if (s.flow > 0.02) out.push(`<path class="tw-streak tw-streak-red" style="opacity:${s.flow.toFixed(2)};stroke-dashoffset:${(-T * 160).toFixed(1)}" d="${P3(XZ(C.trapLine))}"/>`);
    if (s.R > 0.05) out.push(`<path class="tw-streak" style="opacity:${Math.min(1, s.R * 1.5).toFixed(2)};stroke-dashoffset:${(-T * 120).toFixed(1)}" d="${P3(XZ(C.jetLine))}${P3(XZ(C.inletLine))}"/>`);
    // gurgle: air bubbles climbing back through the trapway
    if (s.gurgle > 0.01) {
      const L = C.trapLine, n = L.length, bub = [];
      for (let k = 0; k < 6; k++) {
        const f = ((T * 0.9 + k * 0.17) % 1);
        // continuous position along the rising leg (interpolated, not snapped to a vertex)
        const fi = C.riseIdx * (0.15 + 0.85 * f), i0 = Math.min(n - 2, Math.floor(fi)), w = fi - i0;
        const p = [lerp(L[i0][0], L[i0 + 1][0], w), lerp(L[i0][1], L[i0 + 1][1], w)];
        const [sx, sy] = I([p[0] + Math.sin(k * 7.1 + T * 5) * 6, 0, p[1]]);
        const op = s.gurgle * loopEnv(f);
        if (op > 0.01) bub.push(`<circle style="opacity:${op.toFixed(2)}" cx="${t1(sx)}" cy="${t1(sy)}" r="${(1.2 + (k % 3) * 0.6).toFixed(1)}"/>`);
      }
      out.push(`<g class="tw-bubble">${bub.join("")}</g>`);
    }
    return out.join("");
  }
  // flapper, chain and lever
  function mech(s) {
    const H = C.hinge; // [x, z]
    const fl = C.flapper;
    const rF = rotY(H[0], H[1], s.phi), dF = dirY(s.phi);
    const parts = [];
    // flapper body: disc, bulb under it, two straps to the hinge, chain ear
    const disc = xform(cylFaces(VERT(fl.cx, fl.cy, 0), fl.r, fl.z0, fl.z0 + 7, 30, "d"), rF, dF);
    const bulb = xform(cylFaces(VERT(fl.cx, fl.cy, 0), fl.r - 9, fl.z0 - 9, fl.z0 + 0.5, 26, "q"), rF, dF);
    const straps = [-1, 1].map((sg) => xform(boxFaces(VERT(0, 0, 0), [H[0] - 3, fl.cx - fl.r + 8], [fl.cy + sg * 20 - 3, fl.cy + sg * 20 + 3], [fl.z0 + 1, fl.z0 + 7.5], "s"), rF, dF));
    const ear = xform(boxFaces(VERT(0, 0, 0), [fl.cx + fl.r - 10, fl.cx + fl.r - 4], [fl.cy - 3, fl.cy + 3], [fl.z0 + 7, fl.z0 + 17], "e"), rF, dF);
    const earHole = rF([fl.cx + fl.r - 7, fl.cy + 3, fl.z0 + 13]);
    // fixed painter's order chosen by which side of the disc faces the viewer (no centroid sort that can flip
    // back and forth): underside visible -> disc first, then bulb; top visible -> bulb, disc, straps, ear.
    const upN = dF([0, 0, 1]), topSeen = dot(upN, V) > 0;
    const fp = topSeen ? [bulb, disc, ...straps, ear] : [ear, ...straps, disc, bulb];
    // with the flapper closed the bulb is inside the seat: skip it until it has lifted clear
    parts.push(fp.filter((f) => s.phi > 8 || f !== bulb).map((f) => polySvg(f, { cls: "m-flap" })).join(""));
    parts.push(K.dotsSvg([I(earHole)], { size: 0.55, tone: "hi" }));
    // lever on the handle shaft (rotates about the x axis)
    const Lv = C.lever; // pivot [x, y, z], tip [x, y]
    const rL = rotX(Lv.y0, Lv.z0, s.theta), dL = dirX(s.theta);
    const dx = Lv.tip[0] - Lv.x0, dy = Lv.tip[1] - Lv.y0, len = Math.hypot(dx, dy);
    const LF = { o: [Lv.x0, Lv.y0, Lv.z0], u: [dx / len, dy / len, 0], v: [-dy / len, dx / len, 0], w: [0, 0, 1] };
    const bar = xform(boxFaces(LF, [-4, len + 6], [-1.6, 1.6], [-5, 5], "l"), rL, dL);
    const tipHole = rL(at(LF, len, -1.7, 0));
    const holes = [len - 14, len - 28].map((a) => rL(at(LF, a, -1.7, 0)));
    // chain: lever tip hole to the flapper ear, slack hangs toward the tank front
    const A = tipHole, B = earHole;
    const dist = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
    const slack = Math.max(0, C.chainLen - dist);
    const sag = Math.min(26, Math.sqrt(Math.max(0, slack * dist * 0.4)));
    const N = Math.max(8, Math.round(C.chainLen / 7));
    const cpts = Array.from({ length: N + 1 }, (_, i) => { const q = i / N; return [lerp(A[0], B[0], q) + sag * Math.sin(Math.PI * q), lerp(A[1], B[1], q), lerp(A[2], B[2], q)]; });
    const cs = cpts.map(I);
    const links = [];
    for (let i = 0; i < N; i++) links.push(pth([cs[i], cs[i + 1]]));
    const chain = `<g class="tw-chain"><path class="tw-chain-o" d="${links.join("")}"/><path class="tw-chain-i" d="${links.filter((_, i) => i % 2 === 0).join("")}"/></g>` + K.dotsSvg(cs.filter((_, i) => i > 0 && i < N && i % 2 === 1), { size: 0.38, tone: "hi" });
    parts.push(chain);
    parts.push(polySvg(bar, { cls: "m-lever" }));
    parts.push(K.dotsSvg([I(tipHole), ...holes.map(I)], { size: 0.5, tone: "hi" }));
    return parts.join("");
  }
  function handle(s) {
    const Lv = C.lever, h = C.handle;
    const rL = rotX(Lv.y0, Lv.z0, s.theta), dL = dirX(s.theta);
    const F = { o: [h.x0, Lv.y0, Lv.z0], u: [0, -1, 0], v: [1, 0, 0], w: [0, 0, 1] };
    const arm = xform(boxFaces(F, [4, h.len - 18], [0, 8], [-5, 5], "a"), rL, dL);
    const paddle = xform(boxFaces(F, [h.len - 20, h.len], [-1.5, 9.5], [-8, 8], "p"), rL, dL);
    const list = [arm, paddle].map((f) => ({ f, d: depthC(f) })).sort((a, b) => a.d - b.d);
    return list.map((x) => polySvg(x.f, { cls: "m-lever" })).join("");
  }
  // fill valve: shaft below the cup, the float cup, shaft above it (the cup rides the shaft)
  function fillv(s) {
    const [x, y] = C.fill, f = C.fv2;
    const c0 = s.cup, c1 = s.cup + f.cupH;
    const out = [];
    const h = s.hT;
    // a vertical round part split at the waterline: the wet part below is tinted by the water
    const cyl = (r, z0, z1, n, cls, ribs) => {
      const parts = [];
      const lo = Math.min(z1, h), hi = Math.max(z0, h);
      if (lo > z0 + 0.3) parts.push(K.solidSvg(K.cylinder(x, y, r, z0, lo - z0, P, n), { tone: "hi", className: cls + "wet", inner: ribs ? K.lineSvg(ribs.filter((z) => z < lo).map((z) => K.sideArc(x, y, r, z, P, 28)).join(""), { tone: "lo" }) : "" }));
      if (z1 > hi + 0.3) parts.push(K.solidSvg(K.cylinder(x, y, r, hi, z1 - hi, P, n), { tone: "hi", className: cls, inner: ribs ? K.lineSvg(ribs.filter((z) => z > hi).map((z) => K.sideArc(x, y, r, z, P, 28)).join(""), { tone: "lo" }) : "" }));
      return parts.join("");
    };
    if (c0 > f.baseTop + 1) out.push(cyl(f.shaftR, f.baseTop, c0, 24, "m-teal"));
    out.push(cyl(f.cupR, c0, c1, 40, "m-float", [c0 + 8, c1 - 9]));
    out.push(K.lineSvg(K.ring(x, y, f.shaftR + 3, c1, P, 24), { tone: "lo" }));
    out.push(cyl(f.shaftR, c1, f.capZ, 24, "m-teal"));
    return out.join("");
  }
  function refillDrip(s, T) {
    if (s.refill < 0.02) return "";
    const [x, y, z] = C.refillEnd;
    const d = P3([[x, y, z], [x, y, z - 10]]);
    return `<path class="tw-drip" style="opacity:${s.refill.toFixed(2)};stroke-dashoffset:${(-T * 60).toFixed(1)}" d="${d}"/>`;
  }
  return { polySvg, cylFaces, boxFaces, xform, rotX, rotY, dirX, dirY, depthC, VERT, ALONGX, ALONGY, at, P3, pth, XZ, I, clipZ, wpath, bowlRing, halfArc, ringPt,
    cycle, stateAt, eventsOf, CYCLE_END, tankBack, tankFront, bowlBack, cutWater, mech, handle, fillv, refillDrip };
}
