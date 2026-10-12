// Flush toilet: a gravity-flush siphon toilet cut in half down its centre line, standing on a tiled floor over its drain.
// node build.mjs  -> toilet-light.html (figure page) and short.html (9:16, no chrome)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_SRC = readFileSync(join(HERE, "geo.js"), "utf8");
import { makeToilet } from "./geo.gen.mjs";

// ---------------------------------------------------------------- truth (mm)
// 12" (305 mm) rough-in: drain centre 305 mm from the wall; rim 400 mm; 2" trapway; 3" outlet; 6 L (1.6 gal) tank,
// fill line 25 mm under the overflow; flapper seat 438; the bowl's standing water sits at the trap weir.
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
function catmull(pts, per = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// tube polygon around a centre line in the (x, z) plane; left = left of the direction of travel
function tube(line, rOf, { caps = false } = {}) {
  const L = [], R = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const n = [-dz / l, dx / l], r = rOf(line[i]);
    L.push([line[i][0] + n[0] * r, line[i][1] + n[1] * r]);
    R.push([line[i][0] - n[0] * r, line[i][1] - n[1] * r]);
  }
  const capOf = (c, from, to, steps = 8) => { // semicircle from `from` to `to` around c
    const r = Math.hypot(from[0] - c[0], from[1] - c[1]);
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
    const out = [];
    // go the way that passes away from the line
    const nxt = line[1], dir = Math.atan2(nxt[1] - c[1], nxt[0] - c[0]);
    let da = a1 - a0; while (da <= -Math.PI) da += 2 * Math.PI; while (da > Math.PI) da -= 2 * Math.PI;
    const mid = a0 + da / 2;
    if (Math.cos(mid - dir) > 0) da = da > 0 ? da - 2 * Math.PI : da + 2 * Math.PI;
    for (let s = 1; s < steps; s++) { const a = a0 + (da * s) / steps; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    return out;
  };
  const poly = [...L];
  if (caps) {
    const e = line.length - 1, c = line[e];
    const r = Math.hypot(L[e][0] - c[0], L[e][1] - c[1]);
    const d = [c[0] - line[e - 1][0], c[1] - line[e - 1][1]], dl = Math.hypot(...d);
    const a0 = Math.atan2(L[e][1] - c[1], L[e][0] - c[0]);
    const sgn = Math.sign((L[e][0] - c[0]) * d[1] - (L[e][1] - c[1]) * d[0]) || 1;
    for (let s = 1; s < 8; s++) { const a = a0 - sgn * Math.PI * s / 8; poly.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  }
  poly.push(...[...R].reverse());
  if (caps) {
    const c = line[0];
    const r = Math.hypot(R[0][0] - c[0], R[0][1] - c[1]);
    const d = [line[1][0] - c[0], line[1][1] - c[1]];
    const a0 = Math.atan2(R[0][1] - c[1], R[0][0] - c[0]);
    const sgn = Math.sign((R[0][0] - c[0]) * d[1] - (R[0][1] - c[1]) * d[0]) || 1;
    for (let s = 1; s < 8; s++) { const a = a0 + sgn * Math.PI * s / 8; poly.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  }
  return { poly, L, R };
}

// bowl: inner profile in the cut plane
const F_DOWN = [[690, 400], [687, 390], [675, 362], [650, 322], [608, 276], [556, 232], [506, 196], [476, 174], [462, 166]];
const B_UP = [[462, 214], [450, 246], [436, 282], [416, 318], [386, 350], [346, 376], [310, 394], [300, 400]];
const bowlPoly = [[690, 412], ...F_DOWN, ...B_UP, [300, 412]];
// trapway (S-trap): sump -> up behind the bowl -> over the weir -> down to the 3" outlet horn
const TRAP_CTRL = [[466, 190], [445, 190], [410, 186], [384, 198], [370, 222], [366, 262], [360, 294], [344, 316], [322, 326], [300, 316], [287, 294], [283, 256], [283, 200], [285, 140], [290, 90], [298, 50], [305, 18], [305, -8]];
const trapLine = catmull(TRAP_CTRL, 6);
const rTrap = ([, z]) => 24 + 12 * clampN((70 - z) / 70, 0, 1);
const trapT = tube(trapLine, rTrap);
let apexI = 0; trapLine.forEach((p, i) => { if (p[1] > trapLine[apexI][1]) apexI = i; });
const riseLine = trapLine.slice(0, apexI + 2), downLine = trapLine.slice(apexI);
const pRise = tube(riseLine, rTrap).poly, pDown = tube(downLine, rTrap).poly;
const crestBot = Math.max(...trapT.L.slice(apexI - 8, apexI + 8).map((p) => p[1]));
const crestTop = Math.max(...trapT.R.map((p) => p[1]));
// siphon jet: from the front rim channel down inside the front wall to the jet hole aimed at the trap
const JET_CTRL = [[706, 385], [700, 352], [680, 318], [645, 282], [600, 244], [552, 206], [512, 178], [486, 166], [468, 171]];
const jetLine = catmull(JET_CTRL, 5);
const jetPoly = tube(jetLine, ([, z]) => (z > 370 ? 10 : 9), { caps: true }).poly;
// inlet chamber under the flush valve -> back rim channel
const INLET_CTRL = [[150, 385], [210, 386], [260, 385], [290, 382], [306, 376]];
const inletLine = catmull(INLET_CTRL, 5);
const inletPoly = tube(inletLine, () => 8, { caps: true }).poly;

// body outer loft: horizontal ellipse sections [z, cx, a, b]
const LOFT = [[0, 410, 175, 125], [12, 410, 172, 122], [40, 410, 163, 108], [100, 412, 162, 104], [160, 418, 170, 108], [220, 432, 190, 124], [270, 448, 214, 148], [320, 465, 238, 172], [355, 472, 248, 182], [380, 475, 250, 185], [400, 475, 250, 185]];
const silhouette = [
  ...LOFT.map(([z, cx, a]) => [cx - a, z]).filter(([, z]) => z <= 300).concat([[232, 300], [20, 300], [20, 400]]),
  ...[...LOFT].reverse().map(([z, cx, a]) => [cx + a, z]),
];
const recesses = [[[245, -6], [259, -6], [259, 14], [245, 14]], [[351, -6], [365, -6], [365, 14], [351, 14]]];

const AZ = 64, EL = 30;
const T_ = { x0: 20, x1: 220, y0: -226, z0: 400, z1: 780, wall: 11, floor: 14 };
const tankIn = { x0: T_.x0 + T_.wall, x1: T_.x1 - T_.wall, y0: T_.y0 + T_.wall, z0: T_.z0 + T_.floor };
const LID = { x0: 14, x1: 226, y0: -232, z0: 780, z1: 798 };
const FLOOR = { x0: 196, x1: 724, y0: -214, z0: -40 };
const C = {
  hFull: 640, hSeat: 438, hClose: 470,
  bowlRest: Math.round(crestBot - 3), bowlHi: Math.round(crestBot + 30), bowlLow: 204,
  crestBot, downTop: crestTop, downBot: -10, throatTop: 214,
  bowlFrontUp: [...F_DOWN].reverse(), bowlBackUp: B_UP, bowlB: 140,
  bowlPoly, jetPoly, inletPoly, pRise, pDown, trapLine, riseIdx: apexI,
  jetStreak: [[474, 178], [455, 186], [432, 190], [410, 192]], jetLine: jetLine.slice(0, -1), inletLine,
  rimHolesT: Array.from({ length: 13 }, (_, i) => 0.25 + i * 0.22), rimHoleZ: 376,
  tankIn, fv: [118, -52], fill: [62, -168],
  fv2: { baseTop: 436, shaftR: 10, cupR: 26, cupH: 42, capZ: 670 },
  cupLow: 470, cupHigh: 608,
  hinge: [84, 446], flapper: { cx: 118, cy: -52, r: 41, z0: 438 },
  lever: { x0: 202, y0: -100, z0: 705, tip: [158, -54] },
  handle: { x0: 226, len: 74 },
  chainLen: 262, refillEnd: [64, -56, 677],
};

// ---------------------------------------------------------------- camera
const loftPts = LOFT.flatMap(([z, cx, a, b]) => Array.from({ length: 19 }, (_, i) => { const t = (i / 18) * Math.PI; return [cx + a * Math.cos(t), -b * Math.sin(t), z]; }));
const fitPts = [...k.boxCorners({ x: FLOOR.x0, y: FLOOR.y0, w: FLOOR.x1 - FLOOR.x0, d: -FLOOR.y0 }, FLOOR.z0, 0), ...k.boxCorners({ x: LID.x0, y: LID.y0, w: LID.x1 - LID.x0, d: -LID.y0 }, LID.z0, LID.z1), [236, -180, 705], [306, -100, 705], ...loftPts];
const unit = { origin: [0, 0], scale: 1, azimuth: AZ, elevation: EL };
const fl = fitPts.map((p) => k.iso(p, unit));
const spanX = Math.max(...fl.map((p) => p[0])) - Math.min(...fl.map((p) => p[0]));
const spanY = Math.max(...fl.map((p) => p[1])) - Math.min(...fl.map((p) => p[1]));
const WIDTH = 400, PAD = 8;
const HEIGHT = Math.round((WIDTH - 2 * PAD) * spanY / spanX + 2 * PAD);
const P = k.fitProjection(fitPts, WIDTH, HEIGHT, { pad: PAD, azimuth: AZ, elevation: EL });
const K = { iso: k.iso, depthOf: k.depthOf, cameraOf: k.cameraOf, cylinder: k.cylinder, solidSvg: k.solidSvg, lineSvg: k.lineSvg, sideArc: k.sideArc, ring: k.ring, dotsSvg: k.dotsSvg };
const M = makeToilet(K, P, C);
const I = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const quad = (pts, g, out) => ({ g, out, pts });

// ---------------------------------------------------------------- cut faces (y = 0) with masks and 45° hatching
let maskN = 0;
const t1 = (v) => (Math.round(v * 10) / 10).toString();
const polyD = (poly) => M.P3(M.XZ(poly), true);
function hatchD(polys, step = 11) {
  const xs = polys.flat().map((p) => p[0]), zs = polys.flat().map((p) => p[1]);
  const c0 = Math.min(...xs) + Math.min(...zs), c1 = Math.max(...xs) + Math.max(...zs);
  const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2;
  const d = [];
  for (let c = Math.ceil(c0 / step) * step; c <= c1; c += step) {
    const a = [clampN(x0, c - Math.max(...zs) - 2, 1e9), 0], b = [clampN(x1, -1e9, c - Math.min(...zs) + 2), 0];
    const xa = Math.max(x0, c - Math.max(...zs) - 2), xb = Math.min(x1, c - Math.min(...zs) + 2);
    if (xb <= xa) continue;
    d.push(M.P3([[xa, 0, c - xa], [xb, 0, c - xb]]));
  }
  return d.join("");
}
function cutSvg(sils, cavs, cls) {
  const id = "tc" + maskN++;
  const silD = sils.map(polyD).join(""), cavD = cavs.map(polyD).join("");
  const box = `x="-50" y="-50" width="${WIDTH + 100}" height="${HEIGHT + 100}"`;
  const defs = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" ${box}><path fill="#fff" d="${silD}"/>${cavD ? `<path fill="#000" d="${cavD}"/>` : ""}</mask></defs>`;
  const body = `<g mask="url(#${id})"><path class="tc-fill" d="${silD}"/><path class="tc-hatch" d="${hatchD(sils)}"/><path class="tc-edge" d="${silD}${cavD}"/></g>`;
  return `<g class="tc ${cls}">${defs}${body}</g>`;
}

// ---------------------------------------------------------------- floor
function floor() {
  const out = [];
  const f = FLOOR;
  const faces = M.boxFaces(M.VERT(0, 0, 0), [f.x0, f.x1], [f.y0, 0], [f.z0, 0], "f").filter((q) => q.g !== "fv1");
  out.push(M.polySvg(faces, { tone: "mid", cls: "m-tile" }));
  // tile joints, 300 mm tiles, edge to edge
  const j = [];
  for (let x = 250; x < f.x1; x += 150) j.push(M.P3([[x, 0, 0], [x, f.y0, 0]]));
  for (let y = -150; y > f.y0; y -= 150) j.push(M.P3([[f.x0, y, 0], [f.x1, y, 0]]));
  out.push(L(j.join(""), { tone: "lo" }));
  // soft shadow under the foot
  const sh = Array.from({ length: 33 }, (_, i) => { const t = (i / 32) * Math.PI; return [410 + 195 * Math.cos(t), -140 * Math.sin(t), 0]; });
  out.push(`<path class="iso-halo" style="filter:blur(3px)" d="${M.P3(sh, true)}"/>`);
  // drain bore seen through the cut
  out.push(`<path class="tc-bore" d="${polyD([[267, -50], [343, -50], [343, 0], [267, 0]])}"/>`);
  return out.join("");
}

// ---------------------------------------------------------------- body (back half, outside)
function body() {
  const out = [];
  // tank deck top
  out.push(M.polySvg([quad([[20, 0, 400], [340, 0, 400], [340, -150, 400], [20, -150, 400]], "dk", [0, 0, 1])], { cls: "m-cer" }));
  const faces = [];
  const N = 36;
  const ringP = ([z, cx, a, b], t) => [cx + a * Math.cos(t), -b * Math.sin(t), z];
  for (let r = 0; r < LOFT.length - 1; r++) {
    for (let i = 0; i < N; i++) {
      const ta = (i / N) * Math.PI, tb = ((i + 1) / N) * Math.PI, tm = (ta + tb) / 2;
      const lo = LOFT[r], hi = LOFT[r + 1];
      faces.push({ g: "l", out: [Math.cos(tm) / lo[2], -Math.sin(tm) / lo[3], 0], pts: [ringP(lo, ta), ringP(lo, tb), ringP(hi, tb), ringP(hi, ta)] });
    }
  }
  // rim top between the outer rim and the bowl opening
  const top = LOFT[LOFT.length - 1], inner = M.bowlRing(400);
  for (let i = 0; i < N; i++) {
    const ta = (i / N) * Math.PI, tb = ((i + 1) / N) * Math.PI;
    faces.push({ g: "t", out: [0, 0, 1], pts: [ringP(top, ta), ringP(top, tb), M.ringPt(inner, tb, 400), M.ringPt(inner, ta, 400)] });
  }
  out.push(M.polySvg(faces, { cls: "m-cer" }));
  return out.join("");
}
function bowlInside() {
  const out = [];
  const rim = M.halfArc(400, 48);
  const region = [...rim, ...[...B_UP].reverse().map(([x, z]) => [x, 0, z]), ...[...F_DOWN].reverse().map(([x, z]) => [x, 0, z])];
  out.push(`<path class="tb-in" d="${M.P3(region, true)}"/>`);
  // the far wall turning away from the light
  const shade = [...M.halfArc(372, 40).slice(20), ...[...B_UP].filter(([, z]) => z < 372).reverse().map(([x, z]) => [x, 0, z]), [462, 0, 214]];
  out.push(`<path class="tb-shade" d="${M.P3([...M.halfArc(372, 40).slice(22), ...B_UP.filter(([, z]) => z < 372).reverse().map(([x, z]) => [x, 0, z])], true)}"/>`);
  const arcs = [356, 330, 302, 274, 246].map((z) => M.P3(M.halfArc(z, 40)));
  out.push(L(arcs.join(""), { tone: "faint" }));
  // rim holes under the rim lip
  const holes = C.rimHolesT.map((t) => I(M.ringPt(M.bowlRing(C.rimHoleZ), t, C.rimHoleZ)));
  out.push(L(M.P3(M.halfArc(C.rimHoleZ + 6, 44)), { tone: "lo" }));
  out.push(D(holes, { size: 0.9, tone: "hi" }));
  // interiors of the trapway, the jet and the inlet channel seen through the cut
  out.push(`<path class="tb-pipe" d="${polyD(trapT.poly)}${polyD(jetPoly)}${polyD(inletPoly)}"/>`);
  return out.join("");
}

// ---------------------------------------------------------------- tank inside, fittings
function tankInside() {
  const t = tankIn, z1 = T_.z1;
  return M.polySvg([
    quad([[t.x0, t.y0, t.z0], [t.x1, t.y0, t.z0], [t.x1, t.y0, z1], [t.x0, t.y0, z1]], "side", [0, 1, 0]),
    quad([[t.x0, 0, t.z0], [t.x0, 0, z1], [t.x0, t.y0, z1], [t.x0, t.y0, t.z0]], "back", [1, 0, 0]),
    quad([[t.x0, 0, t.z0], [t.x0, t.y0, t.z0], [t.x1, t.y0, t.z0], [t.x1, 0, t.z0]], "floor", [0, 0, 1]),
  ], { cls: "m-cer", sort: false });
}
function fillValveBase() {
  const [x, y] = C.fill;
  return S(k.cylinder(x, y, 28, 414, 4, P, 36, 0.4), { tone: "hi", className: "m-brass" }) +
    S(k.cylinder(x, y, 21, 418, 18, P, 36, 0.8), { tone: "hi", className: "m-teal", inner: L(k.sideArc(x, y, 21, 427, P, 28), { tone: "lo" }) });
}
function fillValveCap() {
  const [x, y] = C.fill, z = C.fv2.capZ;
  const out = [];
  out.push(S(k.cylinder(x, y, 25, z, 30, P, 40, 1), { tone: "hi", className: "m-teal", inner: L(k.sideArc(x, y, 25, z + 9, P, 30), { tone: "lo" }) }));
  out.push(S(k.cylinder(x, y, 12, z + 30, 6, P, 28, 0.6), { tone: "hi", className: "m-teal" }));
  out.push(L(k.ring(x, y, 18, z + 30, P, 30), { tone: "lo" }));
  // refill nipple toward the overflow
  out.push(M.polySvg(M.cylFaces({ o: [x, y + 24, z + 18], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] }, 4, 0, 10, 14, "n"), { cls: "m-teal" }));
  return out.join("");
}
function flushValve() {
  const [x, y] = C.fv, out = [];
  // overflow tube (behind the seat), web, seat, hinge ears, pin
  const ox = 64;
  out.push(S(k.cylinder(ox, y, 13, 419, 665 - 419, P, 32), { tone: "hi", className: "m-brass", inner: L(k.sideArc(ox, y, 13, C.hFull, P, 24), { tone: "hi" }) }));
  out.push(S(k.cylinder(ox, y, 15.5, 659, 8, P, 32, 0.5), { tone: "hi", className: "m-brass" }));
  out.push(`<path class="tb-hole" d="${k.ring(ox, y, 10.5, 667, P, 28)}"/>`);
  out.push(M.polySvg(M.boxFaces(M.VERT(0, 0, 0), [ox, 86], [y - 5, y + 5], [419, 436], "w"), { cls: "m-brass" }));
  out.push(S(k.cylinder(x, y, 46, 414, 5, P, 44, 0.5), { tone: "hi", className: "m-brass" }));
  out.push(S(k.cylinder(x, y, 37, 419, C.hSeat - 419, P, 44, 0.6), { tone: "hi", className: "m-brass", inner: L(k.sideArc(x, y, 37, 428, P, 36), { tone: "lo" }) }));
  out.push(`<path class="tb-hole" d="${k.ring(x, y, 31, C.hSeat, P, 36)}"/>`);
  for (const dy of [-27, 27]) out.push(M.polySvg(M.boxFaces(M.VERT(0, 0, 0), [76, 90], [y + dy - 3, y + dy + 3], [432, 454], "e"), { cls: "m-brass" }));
  out.push(M.polySvg(M.cylFaces({ o: [C.hinge[0], y - 31, C.hinge[1]], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] }, 2.4, 0, 62, 12, "p"), { cls: "m-steel" }));
  return out.join("");
}
function leverNut() {
  const Lv = C.lever;
  return M.polySvg(M.cylFaces({ o: [197, Lv.y0, Lv.z0], u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] }, 11, 0, 12, 6, "h"), { cls: "m-brass" }) +
    M.polySvg(M.cylFaces({ o: [188, Lv.y0, Lv.z0], u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] }, 4, 0, 9, 14, "s"), { cls: "m-steel" });
}
function refillTube() {
  const [x, y] = C.fill;
  const pts = [[x, y + 34, 688], [x + 1, y + 54, 700], [x + 2, -96, 705], [64, -72, 699], [64, -60, 690], C.refillEnd];
  const d = M.P3(catmull(pts.map((p) => [p[1], p[2]]), 6).map(([yy, zz], i, arr) => [x + (64 - x) * (i / (arr.length - 1)), yy, zz]));
  const clip = M.polySvg(M.boxFaces(M.VERT(0, 0, 0), [56, 72], [-69, -63], [657, 683], "c"), { cls: "m-teal" });
  return clip + `<path class="tw-tube-o" d="${d}"/><path class="tw-tube-i" d="${d}"/><path class="tw-tube-h" d="${d}"/>`;
}
function tankFrontFace() {
  const out = [];
  out.push(M.polySvg([quad([[T_.x1, 0, T_.z0], [T_.x1, T_.y0, T_.z0], [T_.x1, T_.y0, T_.z1], [T_.x1, 0, T_.z1]], "ff", [1, 0, 0])], { cls: "m-cer" }));
  // lid: top and front edge
  const l = LID;
  out.push(M.polySvg(M.boxFaces(M.VERT(0, 0, 0), [l.x0, l.x1], [l.y0, 0], [l.z0, l.z1], "lid").filter((q) => q.g !== "lidv1"), { cls: "m-cer" }));
  out.push(L(M.P3([[l.x0 + 14, 0, l.z1], [l.x0 + 14, l.y0 + 14, l.z1], [l.x1 - 14, l.y0 + 14, l.z1], [l.x1 - 14, 0, l.z1]]), { tone: "faint" }));
  // escutcheon nut for the handle
  const Lv = C.lever;
  out.push(M.polySvg(M.cylFaces({ o: [T_.x1, Lv.y0, Lv.z0], u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] }, 16, 0, 5, 30, "e"), { cls: "m-brass" }));
  return out.join("");
}
function hub() {
  const Lv = C.lever;
  return M.polySvg(M.cylFaces({ o: [T_.x1 + 5, Lv.y0, Lv.z0], u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] }, 9, 0, 13, 28, "h"), { cls: "m-steel" }) +
    D([I([T_.x1 + 18, Lv.y0, Lv.z0])], { size: 0.6, tone: "hi" });
}
function cuts() {
  const out = [];
  // floor slab with the closet flange recess and the drain
  out.push(cutSvg([[[FLOOR.x0, FLOOR.z0], [FLOOR.x1, FLOOR.z0], [FLOOR.x1, 0], [FLOOR.x0, 0]]], [[[259, -60], [351, -60], [351, -8], [375, -8], [375, 1], [235, 1], [235, -8], [259, -8]]], "tc-floor"));
  // drain pipe walls and the flange
  out.push(cutSvg([[[259, -50], [267, -50], [267, -8], [259, -8]], [[343, -50], [351, -50], [351, -8], [343, -8]], [[235, -8], [269, -8], [269, 0], [235, 0]], [[341, -8], [375, -8], [375, 0], [341, 0]]], [], "tc-pipe"));
  // wax ring
  out.push(cutSvg([[[245, 0], [259, 0], [259, 13], [252, 14], [245, 11]], [[351, 0], [365, 0], [365, 11], [358, 14], [351, 13]]], [], "tc-wax"));
  // ceramic body: silhouette minus bowl, trapway, jet, inlet, recesses
  out.push(cutSvg([silhouette], [bowlPoly, trapT.poly, jetPoly, inletPoly, ...recesses], "tc-cer"));
  // tank walls, floor and lid
  const t = T_, w = t.wall;
  out.push(cutSvg([[[t.x0, t.z0], [t.x1, t.z0], [t.x1, t.z1], [t.x1 - w, t.z1], [t.x1 - w, t.z0 + t.floor], [t.x0 + w, t.z0 + t.floor], [t.x0 + w, t.z1], [t.x0, t.z1]],
    [[LID.x0, LID.z0], [LID.x1, LID.z0], [LID.x1, LID.z1], [LID.x0, LID.z1]]], [], "tc-cer"));
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const s0 = M.cycle(99);
const body_ = [
  floor(), body(), bowlInside(),
  `<g data-part="bowlBack">${M.bowlBack(s0, 0)}</g>`,
  tankInside(),
  `<g data-part="tankBack">${M.tankBack(s0, 0)}</g>`,
  fillValveBase(),
  `<g data-part="fillv">${M.fillv(s0)}</g>`,
  fillValveCap(), flushValve(),
  `<g data-part="mech">${M.mech(s0)}</g>`,
  leverNut(), refillTube(),
  `<g data-part="drip">${M.refillDrip(s0, 0)}</g>`,
  `<g data-part="tankFront">${M.tankFront(s0)}</g>`,
  tankFrontFace(),
  `<g data-part="handle">${M.handle(s0)}</g>`,
  hub(),
  `<g data-part="cutWater">${M.cutWater(s0, 0)}</g>`,
  cuts(),
];
const GRAD = `<defs><linearGradient id="tb-grad" gradientUnits="userSpaceOnUse" x1="0" y1="${t1(I([480, -140, 400])[1])}" x2="0" y2="${t1(I([440, 0, 170])[1])}"><stop offset="0" stop-color="#cfdeef"/><stop offset="0.55" stop-color="#b3c8e2"/><stop offset="1" stop-color="#93afd2"/></linearGradient></defs>`;
const LABEL = "A gravity-flush toilet cut in half down its centre line. Pressing the handle lifts the lever, the chain lifts the flapper and the tank water drops through the flush valve into the rim and the siphon jet. The bowl rises until water spills over the trap weir and fills the S-shaped trapway; the full trapway siphons the bowl empty until air gets in and the siphon breaks with a gurgle. The flapper falls back on its seat as the tank empties, the float drops, the fill valve opens, the refill tube tops the bowl back up through the overflow tube and the tank refills until the float shuts the valve.";

const MATS = {
  steel: ["#8e98a3", "#a9b2bc", "#c3cad2", "#d9dee4", "#eef1f4", "#3b4148", "#7d8791"],
  brass: ["#b5841f", "#c99430", "#d9a441", "#e6b95e", "#f7e0a0", "#4f3700", "#9c7419"],
  cer: ["#7f9fc4", "#8eabcd", "#9fbad9", "#b2c8e2", "#dbe7f3", "#1f3550", "#6d8db4"],
  teal: ["#1f7774", "#278985", "#2f9e9a", "#47b2ad", "#8fd6d1", "#0a3533", "#196563"],
  float: ["#278985", "#329c97", "#47b2ad", "#66c3be", "#a8e2de", "#0a3533", "#1f7774"],
  tealwet: ["#1d6f86", "#237f96", "#2b91a8", "#3fa3ba", "#86cde3", "#0a3533", "#185f78"],
  floatwet: ["#257f96", "#2f8fa8", "#42a3bb", "#5db4cb", "#9fd6e8", "#0a3533", "#1d6f86"],
  flap: ["#c95f1a", "#dc7026", "#e8823a", "#f39a55", "#ffd0a3", "#5a2405", "#b0561a"],
  lever: ["#c95f1a", "#dc7026", "#e8823a", "#f39a55", "#ffd0a3", "#5a2405", "#b0561a"],
  tile: ["#d6cfc1", "#e0d9cc", "#e9e3d7", "#f0ebe1", "#f6f2ea", "#6b6355", "#c2b8a5"],
};
const MAT_CSS = Object.entries(MATS).map(([n, c]) => [0, 1, 2, 3].map((i) => `.iso-solid.m-${n}>.iso-shade[data-shade="${i}"]{fill:${c[i]};stroke:${c[i]}}`).join("") +
  `.iso-solid.m-${n}>.iso-top{fill:${c[4]};stroke:${c[4]}}.iso-solid.m-${n}>.iso-fill{fill:${c[2]}}.iso-solid.m-${n}>.iso-edge{stroke:${c[5]}}.iso-solid.m-${n}>.iso-line:not(.iso-edge){stroke:${c[6]}}`).join("\n");
const CREAM = `
.iso[data-theme="light"]{--anatomy-page:#f5f1e8;--anatomy-card:#fbf8f2;--anatomy-paper:#fbf8f2;--anatomy-face:#fffdf9;--anatomy-top:#fffdf8;
 --anatomy-shade-0:#e2dccf;--anatomy-shade-1:#eae5da;--anatomy-shade-2:#f1ede4;--anatomy-shade-3:#f7f4ed;
 --anatomy-hi:#2a2723;--anatomy-mid:#8b8579;--anatomy-lo:#b8b1a4;--anatomy-faint:#d8d2c5;--anatomy-halo:#8a7f6a;--anatomy-dot:#3a3631}
.iso-solid[class*=" m-"]>.iso-shade,.iso-solid[class*=" m-"]>.iso-top{stroke-width:.4px}
.iso-solid.m-tile>.iso-edge{stroke:#6b6355}
.tc-fill{fill:#eef4fb}.tc-hatch{fill:none;stroke:#8eaad0;stroke-width:.5px}.tc-edge{fill:none;stroke:#1f3550;stroke-width:1.6px;stroke-linejoin:round}
.tc-floor .tc-fill{fill:#f3eee4}.tc-floor .tc-hatch{stroke:#c3b89f}.tc-floor .tc-edge{stroke:#6b6355}
.tc-pipe .tc-fill{fill:#e4e7eb}.tc-pipe .tc-hatch{stroke:#9aa3ad}.tc-pipe .tc-edge{stroke:#3b4148}
.tc-wax .tc-fill{fill:#f7e0a0}.tc-wax .tc-hatch{stroke:#c99430}.tc-wax .tc-edge{stroke:#4f3700}
.tc-bore{fill:#5d6670}
.tb-in{fill:url(#tb-grad);stroke:none}.tb-shade{fill:#7f9fc4;opacity:.28}
.tb-pipe{fill:#6f8fb6}.tb-hole{fill:#4f3700;opacity:.75}
.tw-fill{fill:#5fb3e3;stroke:none}
.tw-red{fill:#e0574f;stroke:none}
.tw-surf{fill:#a9dbf4;fill-opacity:.9;stroke:none}
.tw-line{fill:none;stroke:#1d6f99;stroke-width:.6px;stroke-linecap:round}
.tw-tint{fill:#5fb3e3;fill-opacity:.3}
.tw-front{fill:#4aa8dc;fill-opacity:.3;stroke:none}
.tw-foam{fill:none;stroke:#ffffff;stroke-width:.75px;stroke-linecap:round}
.tw-jet{fill:none;stroke:#3d9fd6;stroke-width:1.5px;stroke-linecap:round;stroke-dasharray:7 3}
.tw-streak{fill:none;stroke:#ffffff;stroke-width:.9px;stroke-linecap:round;stroke-dasharray:6 8}
.tw-streak-red{stroke:#ffe1dc}
.tw-bubble circle{fill:#eef8fe;stroke:#1d6f99;stroke-width:.45px}
.tw-chain-o{fill:none;stroke:#3b4148;stroke-width:1.7px;stroke-linecap:round}
.tw-chain-i{fill:none;stroke:#d9dee4;stroke-width:.7px;stroke-linecap:round}
.tw-drip{fill:none;stroke:#3d9fd6;stroke-width:1.2px;stroke-dasharray:3 2}
.tw-tube-o{fill:none;stroke:#0a3533;stroke-width:4.2px;stroke-linecap:round;stroke-linejoin:round}
.tw-tube-i{fill:none;stroke:#2f9e9a;stroke-width:2.8px;stroke-linecap:round;stroke-linejoin:round}
.tw-tube-h{fill:none;stroke:#8fd6d1;stroke-width:.8px;stroke-linecap:round;transform:translate(-.5px,-.6px)}
` + MAT_CSS;

// ---------------------------------------------------------------- live code
const LIVE_CORE = `
${GEO_SRC}
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const K = { iso, depthOf, cameraOf, cylinder, solidSvg, lineSvg, sideArc, ring, dotsSvg };
const M = makeToilet(K, P, C);
const svg = document.querySelector("svg.iso-svg");
const part = (n) => svg.querySelector('[data-part="' + n + '"]');
const G_ = {}; for (const n of ["bowlBack", "tankBack", "fillv", "mech", "drip", "tankFront", "handle", "cutWater"]) G_[n] = part(n);
const last = {};
const put = (n, html) => { if (last[n] !== html) { G_[n].innerHTML = html; last[n] = html; } };
function render(s, T) {
  put("bowlBack", M.bowlBack(s, T)); put("tankBack", M.tankBack(s, T)); put("fillv", M.fillv(s)); put("mech", M.mech(s));
  put("drip", M.refillDrip(s, T)); put("tankFront", M.tankFront(s)); put("handle", M.handle(s)); put("cutWater", M.cutWater(s, T));
}
`;
const CYCLES = [{ t0: 0, sp: 1 }];
const LIVE_SHORT = LIVE_CORE + `
const CYCLES = ${JSON.stringify(CYCLES)};
window.__events = M.eventsOf(CYCLES);
const LEAD = 0.2 + 1 / 60;
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const t0 = performance.now();
function frame(now) {
  holdClock();
  const T = Math.max(0, (now - t0) / 1000 - LEAD);
  window.__T = T;
  render(M.stateAt(T, CYCLES), T);
  requestAnimationFrame(frame);
}
window.__T = 0;
render(M.stateAt(0, CYCLES), 0);
requestAnimationFrame(frame);
`;
const LIVE_FIG = LIVE_CORE + `
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let cycles = [], clock = 0, lastT = 0, raf = 0, visible = false;
const END = M.CYCLE_END;
function flush() { const c = cycles[cycles.length - 1]; if (c && clock - c.t0 < END) return; cycles = [{ t0: clock, sp: still.matches ? 4 : 1 }]; run(); }
function say(s) {
  const tank = Math.max(0, (s.hT - C.hClose) * 0.0765).toFixed(1);
  const phase = s.brk > 0 && s.brk < 1 ? "gurgle" : s.red > 0.5 ? "siphoning" : s.phi > 1 ? "flapper open" : s.valve > 0.05 ? "refilling" : "ready";
  const text = phase + " · tank " + tank + " L";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = lastT ? Math.min((now - lastT) / 1000, 1 / 20) : 1 / 60;
  lastT = now; clock += dt;
  const c = cycles[cycles.length - 1];
  if (!still.matches && (!c || clock - c.t0 > END + 1)) cycles = [{ t0: clock, sp: 1 }];
  const s = M.stateAt(clock, cycles);
  render(s, clock); say(s);
  raf = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!raf && visible) { lastT = 0; raf = requestAnimationFrame(tick); } };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", flush);
stage.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flush(); } });
render(M.cycle(99), 0); say(M.cycle(99));
`;

const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: [GRAD, ...body_] });
const fig = k.plateHtml({
  fig: "Fig 1", title: "Flush toilet", hint: "Click or press space to flush",
  readout: "ready",
  keys: [{ mark: "lit", label: "Trapway: runs full and siphons the bowl" }, { mark: "raised", label: "Flapper, chain and lever (orange); fill valve and float (teal)" }],
  caption: "A classic 13 L (3.5 gal) gravity-flush toilet on a 305 mm (12\") rough-in, cut down its centre line. The handle lifts the flapper; the tank drains through the rim and the siphon jet, the bowl rises over the trap weir, the 2\" trapway runs full and siphons the bowl until air breaks it with a gurgle. The float drops, the fill valve opens, the refill tube tops up the bowl's water seal and the tank refills to the line 25 mm under the overflow.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Flush toilet: click or press space to flush">${svg}</div>`,
});
writeFileSync(join(HERE, "toilet-light.html"), k.pageHtml({ title: "Flush toilet", theme: "light", body: fig, script: kitScript() + LIVE_FIG, width: 600 }).replace("</style>", CREAM + "</style>"));
// 9:16 page: figure 92vw wide; centre it in the band under the title (top 22% kept empty), a little below centre
const FIG_H_VH = (92 * HEIGHT / WIDTH) * (9 / 16);
const FIG_TOP = +Math.max(23, Math.min(100 - FIG_H_VH - 4, 58 - FIG_H_VH / 2)).toFixed(2);
const SHORT_CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:var(--anatomy-paper)}
.short{position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 60%,#fdfbf6 0%,var(--anatomy-paper) 55%,#f3eee3 100%)}
.short .iso-svg{position:absolute;left:4vw;width:92vw;top:${FIG_TOP}vh;height:auto;overflow:visible}
`;
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flush toilet short</title><style>${k.ISO_CSS}${CREAM}${SHORT_CSS}</style></head><body class="iso" data-theme="light"><div class="short">${svg}</div><script type="module">${(kitScript() + LIVE_SHORT).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.preview.json"), JSON.stringify(M.eventsOf(CYCLES), null, 1));
console.log("FIG_TOP", FIG_TOP, "FIG_H_VH", FIG_H_VH.toFixed(1), "events", JSON.stringify(M.eventsOf(CYCLES).map((e) => e.t)));
console.log("wrote toilet-light.html, short.html", WIDTH, "x", HEIGHT, "crestBot", crestBot.toFixed(1), "crestTop", crestTop.toFixed(1), "apexI", apexI);

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['toilet-light.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
