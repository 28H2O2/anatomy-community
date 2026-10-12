import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import * as SH from "./shapes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../../../../.skill/kit");
const THEME = process.argv.includes("--light") ? "light" : "dark";
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const T = M.TEETH;

const W = 640;
const AZ = 225;
const EL = 50;

// ---------------------------------------------------------------- world layout (1 unit ≈ 0.128 mm)
const MOV = 100; // movement radius: 25.6 mm
const PLATE_Z = [-8, 0];
const polar = (deg, r, c = [0, 0]) => [c[0] + r * Math.cos(deg * RAD), c[1] + r * Math.sin(deg * RAD)];
const add2 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len2 = (a) => Math.hypot(a[0], a[1]);
const dir2 = (a, b) => {
  const d = sub2(b, a);
  const l = len2(d);
  return [d[0] / l, d[1] / l];
};
const meet = (a, ra, b, rb, pick) => {
  const d = len2(sub2(b, a));
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const u = dir2(a, b);
  const p = add2(a, u, x);
  const s = [add2(p, [-u[1], u[0]], h), add2(p, [u[1], -u[0]], h)];
  return pick(s[0], s[1]) ? s[0] : s[1];
};
// Pitch radius of a wheel from its tooth count and module.
const pitch = (teeth, module) => (teeth * module) / 2;

// Going train. Modules chosen per mesh; centre distances are the sums of pitch radii.
const R_BARREL = 40;
const M1 = (2 * R_BARREL) / T.barrel;
const R_CP = pitch(T.centrePinion, M1);
const R_CENTRE = 30;
const M2 = (2 * R_CENTRE) / T.centre;
const R_3P = pitch(T.thirdPinion, M2);
const R_THIRD = 24;
const M3 = (2 * R_THIRD) / T.third;
const R_4P = pitch(T.fourthPinion, M3);
const R_FOURTH = 22;
const M4 = (2 * R_FOURTH) / T.fourth;
const R_EP = pitch(T.escapePinion, M4);
const R_ESC = 13;

const C = [0, 0];
const BAR = polar(-100, R_BARREL + R_CP);
const BAL = polar(100, 64);
const LEVER_DIR = -60;
const ESC = polar(LEVER_DIR, 34, BAL);
const PAL = polar(LEVER_DIR, 18.5, BAL);
const FOU = polar(180, R_FOURTH + R_EP, ESC);
const THI = meet(C, R_CENTRE + R_3P, FOU, R_THIRD + R_4P, (a, b) => a[0] < b[0]);
const R_BAL = 26;
const COCK_FOOT = polar(80, 90);
SH.HAIR.stud = Math.atan2(COCK_FOOT[1] - BAL[1], COCK_FOOT[0] - BAL[0]);

// Winding works: ratchet on the barrel arbor, crown wheel between it and the stem.
const MW = 1.2;
const R_RATCHET = pitch(T.ratchet, MW);
const R_CW = pitch(T.crownWheel, MW);
const STEM_DIR = -60;
const STEM_U = polar(STEM_DIR, 1);
const STEM_Z = -3;
const CW = (() => {
  const n = [-STEM_U[1], STEM_U[0]];
  const off = BAR[0] * n[0] + BAR[1] * n[1];
  const along = BAR[0] * STEM_U[0] + BAR[1] * STEM_U[1];
  const shift = -6 - off;
  const t = Math.sqrt((R_RATCHET + R_CW) ** 2 - shift * shift);
  return add2(add2([0, 0], STEM_U, along + t), n, -6);
})();

// Automatic works: rotor pinion → reversers A, B → reduction 1 → reduction 2 → ratchet.
const MA = 0.8;
const MB = 0.7;
const R_RP = pitch(T.rotorPinion, MA);
const R_REV = pitch(T.reverser, MA);
const R_REVP = pitch(T.reverserPinion, MB);
const R_RED1 = pitch(T.red1, MB);
const R_RED1P = pitch(T.red1Pinion, MB);
const R_RED2 = pitch(T.red2, MB);
const R_RED2P = pitch(T.red2Pinion, MW);
const REV_A = polar(-20, R_RP + R_REV);
const REV_B = polar(-95, 2 * R_REV, REV_A);
const RED1 = meet(REV_A, R_REVP + R_RED1, REV_B, R_REVP + R_RED1, (a, b) => len2(a) < len2(b));
const RED2 = meet(RED1, R_RED1P + R_RED2, BAR, R_RED2P + R_RATCHET, (a, b) => a[0] < b[0]);

// Heights (z, units). Mainplate top is 0; the rotor is the top layer.
const Z = {
  drum: [1, 12], cover: [12, 12.6], barrelTeeth: [9.4, 12],
  centrePinion: [9.4, 12], centre: [13.5, 14.9],
  thirdPinion: [13.5, 14.9], third: [16, 17.2],
  fourthPinion: [16, 17.2], fourth: [6, 7.2],
  escapePinion: [6, 7.2], escape: [9.5, 10.5],
  fork: [9.5, 10.5], roller: [10.7, 11.5], palletBridge: [11.2, 12.2],
  balance: [12.6, 14.4], hair: [15.2, 15.7], cock: [18, 22],
  trainBridge: [18.5, 22.5], barrelBridge: [13.5, 17.5], ratchet: [17.5, 19.3], crownWheel: [17.5, 19.3],
  red1: [23.2, 24.2], red2: [25, 26], red2Pinion: [17.6, 19.2], red1Pinion: [25, 26], revPinion: [23.2, 24.2],
  autoBridge: [26.8, 28.8], rev: [28.85, 29.85], revClutch: [29.85, 30.25], rotorPinion: [28.85, 29.85],
  hub: [29.85, 35.6], rotorPlate: [33.3, 34.8],
};

// ---------------------------------------------------------------- camera
const HOLD_R = 124;
const HOLD_Z = [-26, -16];
const FOOT_H = 6;
// Fit the camera to the real extremes: the holder's foot ring and top, the jaw knobs, the rotor and the crown.
const FIT_POINTS = [
  ...[[HOLD_R + 1, HOLD_Z[0] - FOOT_H], [HOLD_R + 1, HOLD_Z[1]], [MOV + 30, -5], [SH.RIM.outer, SH.RIM.z1 + 1.5]].flatMap(([r, z]) => Array.from({ length: 120 }, (_, i) => [...polar(i * 3, r), z])),
  ...[-12, 12].flatMap((dz) => [104, 118].map((s0) => [...polar(STEM_DIR, s0), STEM_Z + dz])),
];
const PAD = 26;
const H = (() => {
  const unit = { origin: [0, 0], scale: 1, azimuth: AZ, elevation: EL };
  const flat = FIT_POINTS.map((p) => k.iso(p, unit));
  const dx = Math.max(...flat.map((q) => q[0])) - Math.min(...flat.map((q) => q[0]));
  const dy = Math.max(...flat.map((q) => q[1])) - Math.min(...flat.map((q) => q[1]));
  return Math.round((W - 2 * PAD) * (dy / dx) + 2 * PAD);
})();
const P = k.fitProjection(FIT_POINTS, W, H, { pad: PAD, azimuth: AZ, elevation: EL });
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const f4 = (v) => (Math.round(v * 10000) / 10000).toString();
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

function planeMatrix(cx, cy, z) {
  const o = at([cx, cy, z]);
  const ex = sub2(at([cx + 1, cy, z]), o);
  const ey = sub2(at([cx, cy + 1, z]), o);
  return `matrix(${f4(ex[0])} ${f4(ex[1])} ${f4(ey[0])} ${f4(ey[1])} ${f2(o[0])} ${f2(o[1])})`;
}

// ---------------------------------------------------------------- recorder
const R = A.recorder(P);
const depth = (p) => G.dot3(p, V);
function put(name, ref, zBottom, svg, shapes = [], extra = {}) {
  const centre = ref.length === 3 ? ref : [ref[0], ref[1], zBottom];
  return R.put({ name: R.nameFor(name), at: centre, key: zBottom * 1000 + depth(centre) * 0.01 + (extra.bias ?? 0), svg, shapes: shapes.map((s) => R.solid(s)), piece: "watch", ...extra });
}

// ---------------------------------------------------------------- plane shapes (local plan coordinates)
const polyD = SH.polyD;
const ringsD = (rings) => rings.map((r) => polyD(r, true)).join("");
const circlePts = (r, n = 48, c = [0, 0], a0 = 0) => Array.from({ length: n }, (_, i) => polar(a0 + (i / n) * 360, r, c));

function toothRing(n, r, { add = 0.92, ded = 1.2, phase = 0, tip = 0.12 } = {}) {
  const m = (2 * r) / n;
  const ra = r + add * m;
  const rr = r - ded * m;
  const p = TAU / n;
  const pts = [];
  const pt = (rad, a) => pts.push([rad * Math.cos(a), rad * Math.sin(a)]);
  for (let i = 0; i < n; i++) {
    const c = phase + i * p;
    pt(rr, c - 0.5 * p);
    pt(rr, c - 0.27 * p);
    pt(r, c - 0.2 * p);
    pt(ra - 0.32 * m, c - tip * p);
    pt(ra, c);
    pt(ra - 0.32 * m, c + tip * p);
    pt(r, c + 0.2 * p);
    pt(rr, c + 0.27 * p);
  }
  return pts;
}
const tipOf = (n, r, add = 0.92) => r + add * ((2 * r) / n);

function windows(count, spoke, rHub, rIn, phase = 0) {
  const holes = [];
  const half = (rad) => Math.asin(Math.min(0.9, spoke / 2 / rad));
  for (let i = 0; i < count; i++) {
    const a0 = phase + (i * TAU) / count;
    const a1 = a0 + TAU / count;
    const hole = [];
    const n = Math.max(8, Math.round(rIn * 0.9));
    for (let j = 0; j <= n; j++) {
      const a = a0 + half(rIn) + ((a1 - a0 - 2 * half(rIn)) * j) / n;
      hole.push([rIn * Math.cos(a), rIn * Math.sin(a)]);
    }
    const m = 6;
    for (let j = m; j >= 0; j--) {
      const a = a0 + half(rHub) + ((a1 - a0 - 2 * half(rHub)) * j) / m;
      hole.push([rHub * Math.cos(a), rHub * Math.sin(a)]);
    }
    holes.push(hole);
  }
  return holes;
}

// Signed distance fields → outlines (marching squares), for bridges, the fork, the click and the rotor.
const sdCircle = (c, r) => (p) => Math.hypot(p[0] - c[0], p[1] - c[1]) - r;
const sdCapsule = (a, b, ra, rb = ra) => (p) => {
  const pa = sub2(p, a);
  const ba = sub2(b, a);
  const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1]) / (ba[0] * ba[0] + ba[1] * ba[1])));
  return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h) - (ra + (rb - ra) * h);
};
const sdBox = (x0, y0, x1, y1) => (p) => {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const dx = Math.abs(p[0] - cx) - (x1 - x0) / 2;
  const dy = Math.abs(p[1] - cy) - (y1 - y0) / 2;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
};
const smin = (k2, ...fs) => (p) => fs.map((f) => f(p)).reduce((a, b) => {
  const h = Math.max(k2 - Math.abs(a - b), 0) / k2;
  return Math.min(a, b) - (h * h * k2) / 4;
});
const cut = (f, ...gs) => (p) => Math.max(f(p), ...gs.map((g) => -g(p)));
const both = (f, g) => (p) => Math.max(f(p), g(p));

function contour(sdf, [x0, y0, x1, y1], step = 0.35) {
  const nx = Math.ceil((x1 - x0) / step) + 2;
  const ny = Math.ceil((y1 - y0) / step) + 2;
  const val = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[j * nx + i] = sdf([x0 + (i - 0.5) * step, y0 + (j - 0.5) * step]);
  const v = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? 1 : val[j * nx + i]);
  const pos = (i, j) => [x0 + (i - 0.5) * step, y0 + (j - 0.5) * step];
  const edgePoint = (id) => {
    const [kind, i, j] = id;
    const a = pos(i, j);
    const b = kind === "h" ? pos(i + 1, j) : pos(i, j + 1);
    const va = v(i, j);
    const vb = kind === "h" ? v(i + 1, j) : v(i, j + 1);
    const t = va / (va - vb);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const segs = [];
  for (let j = -1; j < ny; j++) {
    for (let i = -1; i < nx; i++) {
      const a = v(i, j) < 0, b = v(i + 1, j) < 0, c = v(i + 1, j + 1) < 0, d = v(i, j + 1) < 0;
      const code = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const e = [["h", i, j], ["v", i + 1, j], ["h", i, j + 1], ["v", i, j]];
      const centre = (v(i, j) + v(i + 1, j) + v(i + 1, j + 1) + v(i, j + 1)) / 4 < 0;
      const table = {
        1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
        5: centre ? [[3, 2], [1, 0]] : [[3, 0], [1, 2]],
        10: centre ? [[0, 3], [2, 1]] : [[0, 1], [2, 3]],
      };
      for (const [p0, p1] of table[code]) segs.push([e[p0].join(","), e[p1].join(","), e[p0], e[p1]]);
    }
  }
  const byEdge = new Map();
  segs.forEach((s, index) => {
    for (const key of [s[0], s[1]]) {
      if (!byEdge.has(key)) byEdge.set(key, []);
      byEdge.get(key).push(index);
    }
  });
  const used = new Uint8Array(segs.length);
  const rings = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const ring = [edgePoint(segs[s0][2])];
    let key = segs[s0][1];
    let ids = segs[s0][3];
    let guard = 0;
    while (guard++ < 100000) {
      ring.push(edgePoint(ids));
      const next = (byEdge.get(key) ?? []).find((n) => !used[n]);
      if (next === undefined) break;
      used[next] = 1;
      const s = segs[next];
      if (s[0] === key) {
        key = s[1];
        ids = s[3];
      } else {
        key = s[0];
        ids = s[2];
      }
    }
    if (ring.length > 6) rings.push(simplifyRing(ring, 0.04));
  }
  return rings;
}
function simplifyRing(ring, tol) {
  const pts = Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < 1e-6 ? ring.slice(0, -1) : ring;
  let far = 0;
  let m = 0;
  pts.forEach((p, i) => {
    const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
    if (d > far) {
      far = d;
      m = i;
    }
  });
  const a = simplify(pts.slice(0, m + 1), tol);
  const b = simplify([...pts.slice(m), pts[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function simplify(points, tol) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let far = tol;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / L;
      if (d > far) {
        far = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
const areaOf = (ring) => ring.reduce((s, [x, y], i) => {
  const [x2, y2] = ring[(i + 1) % ring.length];
  return s + x * y2 - x2 * y;
}, 0) / 2;
const outerOf = (rings) => rings.reduce((best, r) => (Math.abs(areaOf(r)) > Math.abs(areaOf(best)) ? r : best));
const boundsOfSdf = (pts, pad) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
};

// A flat part drawn in its own plane: a side copy at its bottom and the face at its top, both turned
// by `rotate()` in plan coordinates, so the page turns it by writing one transform per copy.
function planePart({ c, z, rings, tone = "hi", details = "", angle = 0, part, cls = "", side = true, sideTone = 1, faceCls = "" }) {
  const d = ringsD(rings);
  const top = planeMatrix(c[0], c[1], z[1]);
  const bot = planeMatrix(c[0], c[1], z[0]);
  const rot = ` rotate(${f2(angle / RAD)})`;
  return (
    `<g class="wp${cls ? " " + cls : ""}"${part ? ` data-part="${part}"` : ""}>` +
    (side && z[1] - z[0] > 0.15 ? `<g data-m="${bot}" transform="${bot}${rot}"><path class="wp-side" data-shade="${sideTone}" d="${d}"/></g>` : "") +
    `<g data-m="${top}" transform="${top}${rot}"><path class="wp-face${faceCls ? " " + faceCls : ""}" data-tone="${tone}" d="${d}"/>${details}</g></g>`
  );
}
const lineLocal = (d, tone = "lo", extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
const circleD = (r, c = [0, 0]) => `M${f2(c[0] + r)} ${f2(c[1])}A${f2(r)} ${f2(r)} 0 1 0 ${f2(c[0] - r)} ${f2(c[1])}A${f2(r)} ${f2(r)} 0 1 0 ${f2(c[0] + r)} ${f2(c[1])}Z`;

// ---------------------------------------------------------------- parts
const PARTS = [];
const turning = (part, centre, info) => PARTS.push({ part, centre, ...info });

function screw(p, z, r = 2.4, slot = 30, tone = "mid") {
  const out = [];
  out.push(Ln(k.ring(p[0], p[1], r + 0.7, z, P, 28), { tone: "faint" }));
  out.push(S(k.cylinder(p[0], p[1], r, z, 0.8, P, 24, 0.3), { tone, crease: "lo" }));
  const a = slot * RAD;
  out.push(Ln(k.lineOnTop([p[0] - Math.cos(a) * r, p[1] - Math.sin(a) * r], [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r], z + 0.8, P), { tone: "mid" }));
  return out.join("");
}
function jewel(p, z, r = 2.2) {
  return (
    S(k.cylinder(p[0], p[1], r, z, 0.35, P, 24), { tone: "mid", crease: "faint" }) +
    `<path class="wt-jewel" d="${k.ring(p[0], p[1], r * 0.58, z + 0.35, P, 24)}"/>` +
    Dots([at([p[0], p[1], z + 0.35])], { size: 0.32, tone: "hi" })
  );
}

// Holder: a turned base on three feet with a degree ring, a seat ring the movement rests on, and three
// sliding jaws with knurled screws.
const SEAT_R = 103;
const SEAT_Z = [-16, -8];
const BASE_SVG = (() => {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: -HOLD_R, y: -HOLD_R, w: 2 * HOLD_R, d: 2 * HOLD_R, r: HOLD_R }, HOLD_Z[0] - FOOT_H, 10, P)}"/>`];
  const feet = [30, 150, 270].map((deg) => polar(deg, HOLD_R - 22)).sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 11, HOLD_Z[0] - FOOT_H, 1.8, P, 40), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 8.6, HOLD_Z[0] - FOOT_H + 1.8, FOOT_H - 1.8, P, 40), { tone: "mid" }));
  }
  return out.join("");
})();
for (const deg of [30, 150, 270]) R.solid(A.cylinder(...polar(deg, HOLD_R - 22), 11, HOLD_Z[0] - FOOT_H, FOOT_H, { name: "stand.foot", ground: true }));
{
  const top = HOLD_Z[1];
  const ticks = k.radialTicks(0, 0, HOLD_R - 1.2, 120, 10, top, [2.6, 5], P);
  const svg =
    S(k.cylinder(0, 0, HOLD_R, HOLD_Z[0], HOLD_Z[1] - HOLD_Z[0], P, 180, 1.2), { tone: "mid", inner: Ln(k.sideArc(0, 0, HOLD_R, HOLD_Z[0] + 3, P, 140), { tone: "faint" }) }) +
    Ln(k.ring(0, 0, HOLD_R - 1.2, top, P, 180), { tone: "lo" }) +
    Ln(k.ring(0, 0, HOLD_R - 6.2, top, P, 170), { tone: "faint" }) +
    Ln(ticks.minor, { tone: "lo" }) + Ln(ticks.major, { tone: "mid" }) +
    [68, 188, 308, 100, 220, 340].map((deg) => screw(polar(deg, 111.5), top, 2.6, deg + 40)).join("");
  put("holder.base", [0, 0, HOLD_Z[0]], HOLD_Z[0], svg, [A.cylinder(0, 0, HOLD_R, HOLD_Z[0], HOLD_Z[1] - HOLD_Z[0], { name: "stand.holder", ground: true })]);
}
put("holder.seat", [0, 0, SEAT_Z[0]], SEAT_Z[0], S(k.cylinder(0, 0, SEAT_R, SEAT_Z[0], SEAT_Z[1] - SEAT_Z[0], P, 160, 0.8), { tone: "mid", inner: Ln(k.sideArc(0, 0, SEAT_R, SEAT_Z[0] + 4, P, 140), { tone: "faint" }) }), [A.cylinder(0, 0, SEAT_R, SEAT_Z[0], SEAT_Z[1] - SEAT_Z[0], { name: "holder.seat" })]);
const JAWS = [8, 128, 232];
for (const deg of JAWS) {
  const u = polar(deg, 1);
  const n = [-u[1], u[0]];
  const quad = (r0, r1) => [add2(add2([0, 0], u, r0), n, -7), add2(add2([0, 0], u, r1), n, -7), add2(add2([0, 0], u, r1), n, 7), add2(add2([0, 0], u, r0), n, 7)];
  const lower = quad(SEAT_R, MOV + 17);
  const upper = quad(MOV, MOV + 17);
  const mid = polar(deg, MOV + 8.5);
  put("holder.jaw", [mid[0], mid[1], SEAT_Z[0]], SEAT_Z[0], S(k.extrude(lower, SEAT_Z[0], SEAT_Z[1] - SEAT_Z[0], P, { bevel: 0 }), { tone: "mid" }), [A.extruded(lower, SEAT_Z[0], SEAT_Z[1] - SEAT_Z[0], { name: "holder.jaw" })]);
  const jawZ = [SEAT_Z[1], -2.5];
  const jawTop = Ln(k.lineOnTop(add2(add2([0, 0], u, MOV + 3), n, -7), add2(add2([0, 0], u, MOV + 3), n, 7), jawZ[1], P), { tone: "faint" });
  const svg = S(k.extrude(upper, jawZ[0], jawZ[1] - jawZ[0], P, { bevel: 0.6 }), { tone: "mid" }) + jawTop + Dots([at([...add2(add2([0, 0], u, MOV + 11), n, -4), jawZ[1]]), at([...add2(add2([0, 0], u, MOV + 11), n, 4), jawZ[1]])], { size: 0.45 });
  put("holder.lip", [mid[0], mid[1], jawZ[0]], jawZ[0], svg, [A.extruded(upper, jawZ[0], jawZ[1] - jawZ[0], { name: "holder.lip" })]);
  const F = G.frameAlong([mid[0] + u[0] * 8.5, mid[1] + u[1] * 8.5, -9.5], [u[0], u[1], 0]);
  const knob = G.solidOf([[0, 2.2], [2.5, 2.2], [2.5, 4.6], [9.5, 4.6]], F, P, { bevel: 0.3 });
  const ribs = G.ribsOf(F, 2.5, 9.5, 4.6, 26, P, { fade: [0.1, 0.55] });
  put("holder.knob", [...polar(deg, MOV + 22), -9.5], HOLD_Z[1] + 0.5, S(knob, { tone: "mid" }) + k.fadedSvg(ribs, { tone: "lo" }), [A.solid(F, [[0, 2.2], [2.5, 2.2], [2.5, 4.6], [9.5, 4.6]], { name: "holder.knob" })]);
}

// Mainplate: a turned disc with a bevelled edge, perlage on its top, and the stem coming out of its side.
const perlage = (() => {
  const d = [];
  const step = 5.4;
  for (let y = -MOV; y <= MOV; y += step * 0.85) {
    const row = Math.round((y + MOV) / (step * 0.85));
    for (let x = -MOV + (row % 2) * step * 0.5; x <= MOV; x += step) {
      if (Math.hypot(x, y) < MOV - 5.5) d.push(circleD(2.9, [x, y]));
    }
  }
  return d.join("");
})();
{
  const plateTop = planeMatrix(0, 0, PLATE_Z[1]);
  const svg =
    S(k.cylinder(0, 0, MOV, PLATE_Z[0], PLATE_Z[1] - PLATE_Z[0], P, 180, 1.4), { tone: "mid", inner: Ln(k.sideArc(0, 0, MOV, PLATE_Z[0] + 2.4, P, 160), { tone: "faint" }) }) +
    `<g transform="${plateTop}"><path class="iso-line wt-perlage" data-tone="faint" d="${perlage}"/></g>` +
    Ln(k.ring(0, 0, MOV - 4, 0, P, 160), { tone: "lo" });
  const casing = [140, 268].map((deg) => {
    const p = polar(deg, MOV - 7.5);
    const t = polar(deg, 1);
    const n = [-t[1], t[0]];
    const clamp = [add2(add2(p, t, -3.4), n, -4.2), add2(add2(p, t, 5.6), n, -4.2), add2(add2(p, t, 5.6), n, 4.2), add2(add2(p, t, -3.4), n, 4.2)];
    return S(k.extrude(clamp, 0, 0.7, P, { bevel: 0.25 }), { tone: "mid" }) + screw(p, 0.7, 2.1, deg + 90);
  }).join("");
  put("plate", [0, 0, PLATE_Z[0]], PLATE_Z[0] + 0.5, svg + casing, [A.cylinder(0, 0, MOV, PLATE_Z[0], PLATE_Z[1] - PLATE_Z[0], { name: "plate" })]);
}

// Stem and crown, turned along the stem axis.
const STEM_F = G.frameAlong([0, 0, STEM_Z], [STEM_U[0], STEM_U[1], 0]);
const CROWN_PROFILE = [[106, 0], [106, 6.4], [107.2, 9.8, 1], [108.2, 11.4, 1], [109.2, 11.8], [116, 11.8], [116.8, 11.2, 1], [117.4, 9.6, 1], [117.7, 7], [117.7, 0]];
{
  const stem = G.disc(100.05, 106.2, 2.2, STEM_F, P);
  put("stem", [...polar(STEM_DIR, 103), STEM_Z], -4.5, S(stem, { tone: "mid" }) + Ln(G.arcOf(STEM_F, 102.5, 2.2, P), { tone: "faint" }), [A.disc(STEM_F, 100.05, 106.2, 2.2, { name: "stem" })]);
  const crown = G.lathe(CROWN_PROFILE, STEM_F, P, { steps: 64 });
  const ribs = G.ribsOf(STEM_F, 109.2, 116, 11.8, 36, P, { fade: [0.1, 0.55], seams: true });
  const face = G.circleOf(STEM_F, 117.7, 5.2, P);
  const svg = `<g data-part="crown">${S(crown, { tone: "hi" })}<g data-part="crown-ribs">${k.fadedSvg(ribs, { tone: "lo" })}</g>${Ln(face, { tone: "lo" })}</g>`;
  put("crown", [...polar(STEM_DIR, 112), STEM_Z], -14, svg, [A.lathe(STEM_F, CROWN_PROFILE, { name: "crown" })]);
}

// ---------------------------------------------------------------- the going train
const pinionRing = (n, r, phase = 0) => toothRing(n, r, { add: 0.78, ded: 1.45, phase, tip: 0.14 });
function wheel(name, centre, z, teeth, r, { spokes = 4, spoke = 1.6, hubR = 3.4, rim = 2.6, tone = "hi", phase = 0, details = "", part, owner = name.split(".")[0] } = {}) {
  const m = (2 * r) / teeth;
  const rIn = r - 1.2 * m - rim;
  const rings = [toothRing(teeth, r, { phase }), ...(spokes ? windows(spokes, spoke, hubR, rIn, phase) : [])];
  const svg = planePart({ c: centre, z, rings, tone, part, details: lineLocal(circleD(hubR * 0.62), "lo") + details });
  return put(name, [centre[0], centre[1], z[0]], z[0], svg, [A.cylinder(centre[0], centre[1], r, z[0], z[1] - z[0], { name, owner })]);
}
function pinion(name, centre, z, leaves, r, part, phase = 0) {
  const svg = planePart({ c: centre, z, rings: [pinionRing(leaves, r, phase)], tone: "hi", part, details: lineLocal(circleD(Math.max(0.6, r * 0.32)), "lo") });
  return put(name, [centre[0], centre[1], z[0]], z[0], svg, [A.cylinder(centre[0], centre[1], r, z[0], z[1] - z[0], { name, owner: name.split(".")[0] })]);
}
function arbor(name, centre, from, to, r = 0.9) {
  if (to - from < 0.2) return;
  put(name, [centre[0], centre[1], from], from, S(k.cylinder(centre[0], centre[1], r, from, to - from, P, 16), { tone: "mid", crease: "none" }), [A.cylinder(centre[0], centre[1], r, from, to - from, { name, owner: name.split(".")[0] })]);
}

// Barrel: drum, toothed lip, openwork cover with the mainspring showing through.
{
  const drumR = 37.2;
  put("barrel.drum", [BAR[0], BAR[1], Z.drum[0]], Z.drum[0], S(k.cylinder(BAR[0], BAR[1], drumR, Z.drum[0], Z.barrelTeeth[0] - Z.drum[0], P, 140), { tone: "mid", inner: Ln(k.sideArc(BAR[0], BAR[1], drumR, 4.5, P, 120), { tone: "faint" }) }), [A.cylinder(BAR[0], BAR[1], drumR, Z.drum[0], Z.barrelTeeth[0] - Z.drum[0], { name: "barrel.drum", owner: "barrel" })]);
  const teeth = toothRing(T.barrel, R_BARREL);
  const floor = circlePts(SH.SPRING.wall + 0.6, 120);
  const springRest = SH.mainspringPoints(createRest().wind, 0);
  const inside =
    `<path class="wt-floor" d="${polyD(floor, true)}"/>` +
    `<path class="iso-line wt-spring" data-tone="lit" data-part="mainspring" d="${polyD(springRest.points)}"/>` +
    `<path class="iso-line wt-bridle" data-tone="lit" data-part="bridle" d="${polyD(SH.bridlePoints(springRest.end))}"/>` +
    `<circle class="wt-arbor" r="${SH.SPRING.arbor - 0.4}"/>`;
  const svg = planePart({ c: BAR, z: Z.barrelTeeth, rings: [teeth, floor.slice().reverse()], tone: "hi", part: "barrel", details: inside });
  put("barrel.teeth", [BAR[0], BAR[1], Z.barrelTeeth[0]], Z.barrelTeeth[0], svg, [A.cylinder(BAR[0], BAR[1], R_BARREL, Z.barrelTeeth[0], Z.barrelTeeth[1] - Z.barrelTeeth[0], { name: "barrel.teeth", owner: "barrel" })]);
  // Cover: a rim and three arms, drum-fixed.
  const coverR = SH.SPRING.wall + 1.6;
  const rings = [circlePts(coverR, 120), ...windows(3, 5.2, 10.5, SH.SPRING.wall - 1.2, 0.4)];
  const coverSvg = planePart({ c: BAR, z: Z.cover, rings, tone: "mid", part: "barrel-cover", details: lineLocal(circleD(coverR - 1.1), "faint") + `<g class="iso-dots" data-tone="mid">${[0, 1, 2].map((i) => `<circle cx="${f2(Math.cos(0.4 + 1.047 + i * 2.094) * (coverR - 0.6))}" cy="${f2(Math.sin(0.4 + 1.047 + i * 2.094) * (coverR - 0.6))}" r="0.5"/>`).join("")}</g>` });
  put("barrel.cover", [BAR[0], BAR[1], Z.cover[0]], Z.cover[0], coverSvg, [A.cylinder(BAR[0], BAR[1], coverR, Z.cover[0], Z.cover[1] - Z.cover[0], { name: "barrel.cover", owner: "barrel" })]);
  turning("barrel", BAR, { drive: "drum" });
  turning("barrel-cover", BAR, { drive: "drum", phase: 0.4 });
}
function createRest() {
  return M.createState(9);
}

wheel("centre.wheel", C, Z.centre, T.centre, R_CENTRE, { spokes: 4, part: "centre", hubR: 4.2 });
pinion("centre.pinion", C, Z.centrePinion, T.centrePinion, R_CP, "centre-p");
turning("centre", C, { drive: "centre" });
turning("centre-p", C, { drive: "centre" });
wheel("third.wheel", THI, Z.third, T.third, R_THIRD, { spokes: 4, part: "third" });
pinion("third.pinion", THI, Z.thirdPinion, T.thirdPinion, R_3P, "third-p");
arbor("third.arbor", THI, Z.thirdPinion[1], Z.third[0]);
arbor("third.arbor", THI, Z.third[1], Z.trainBridge[0]);
turning("third", THI, { drive: "third" });
turning("third-p", THI, { drive: "third" });
wheel("fourth.wheel", FOU, Z.fourth, T.fourth, R_FOURTH, { spokes: 4, part: "fourth", spoke: 1.4 });
pinion("fourth.pinion", FOU, Z.fourthPinion, T.fourthPinion, R_4P, "fourth-p");
arbor("fourth.arbor", FOU, Z.fourth[1], Z.fourthPinion[0], 0.85);
arbor("fourth.arbor", FOU, Z.fourthPinion[1], Z.trainBridge[0], 0.85);
turning("fourth", FOU, { drive: "fourth" });
turning("fourth-p", FOU, { drive: "fourth" });
arbor("centre.arbor", C, Z.centre[1], Z.trainBridge[0], 1.2);
arbor("centre.arbor", C, Z.centrePinion[1], Z.centre[0], 1.2);

// Escape wheel: fifteen club teeth.
function escapeRing() {
  const n = T.escape;
  const p = TAU / n;
  const rr = 9.6;
  const ra = R_ESC;
  const pts = [];
  const pt = (rad, a) => pts.push([rad * Math.cos(a), rad * Math.sin(a)]);
  for (let i = 0; i < n; i++) {
    const c = i * p;
    pt(rr, c);
    pt(rr + 0.9, c + 0.1 * p);
    pt(ra - 0.2, c + 0.3 * p);
    pt(ra, c + 0.36 * p);
    pt(ra - 0.75, c + 0.52 * p);
    pt(ra - 1.6, c + 0.5 * p);
    pt(rr + 1.2, c + 0.38 * p);
    pt(rr, c + 0.5 * p);
  }
  return pts;
}
{
  const rings = [escapeRing(), ...windows(4, 1.1, 2.4, 8.2, 0.3)];
  const svg = planePart({ c: ESC, z: Z.escape, rings, tone: "hi", part: "escape", details: lineLocal(circleD(1.3), "lo") });
  put("escape.wheel", [ESC[0], ESC[1], Z.escape[0]], Z.escape[0], svg, [A.cylinder(ESC[0], ESC[1], R_ESC, Z.escape[0], Z.escape[1] - Z.escape[0], { name: "escape.wheel", owner: "escape" })]);
  pinion("escape.pinion", ESC, Z.escapePinion, T.escapePinion, R_EP, "escape-p");
  arbor("escape.arbor", ESC, Z.escapePinion[1], Z.escape[0], 0.7);
  arbor("escape.arbor", ESC, Z.escape[1], Z.trainBridge[0], 0.7);
  turning("escape", ESC, { drive: "escape" });
  turning("escape-p", ESC, { drive: "escape" });
}

// Pallet fork (lever): local x points from its pivot to the balance staff, the escape wheel is at −15.5.
const FORK_BASE = Math.atan2(BAL[1] - PAL[1], BAL[0] - PAL[0]);
const FORK_SWING = 7 * RAD;
{
  const toEsc = dir2([-5.4, 8.4], [-15.5, 0]);
  const toEsc2 = dir2([-5.8, -8.0], [-15.5, 0]);
  const body = cut(
    smin(1.2, sdCircle([0, 0], 2.3), sdCapsule([0, 0], [14.6, 0], 1.05, 0.75), sdBox(13.6, -2.1, 17.0, 2.1), sdCapsule([0, 0], [-5.4, 8.4], 1.3, 1.05), sdCapsule([0, 0], [-5.8, -8.0], 1.3, 1.05)),
    sdBox(14.4, -0.72, 18, 0.72),
  );
  const rings = contour(body, [-9, -11, 18.5, 11], 0.18);
  const stone = (a, d) => {
    const n = [-d[1], d[0]];
    const b = add2(a, d, 2.2);
    const s = 0.62;
    return [add2(add2(a, d, -0.6), n, -s), add2(b, n, -s), add2(b, n, s), add2(add2(a, d, -0.6), n, s)];
  };
  const stones = [stone([-5.4, 8.4], toEsc), stone([-5.8, -8.0], toEsc2)];
  const details = stones.map((s) => `<path class="wt-stone" d="${polyD(s, true)}"/>`).join("") + lineLocal(circleD(0.9), "lo") + lineLocal(polyD([[15.0, -0.72], [15.0, 0.72]]), "faint");
  const svg = planePart({ c: PAL, z: Z.fork, rings, tone: "hi", part: "fork", angle: FORK_BASE, details });
  put("fork", [PAL[0], PAL[1], Z.fork[0]], Z.fork[0], svg, [A.extruded(rings[0].map((p) => add2(PAL, rot2(p, FORK_BASE))), Z.fork[0], Z.fork[1] - Z.fork[0], { name: "fork" })]);
  turning("fork", PAL, { drive: "fork", base: FORK_BASE });
  arbor("fork.arbor", PAL, Z.fork[1], Z.palletBridge[0], 0.6);
}
function rot2([x, y], a) {
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

// Pallet bridge: a small cock over the lever pivot, under the balance.
{
  const foot = add2(PAL, rot2([1.5, -10.5], FORK_BASE));
  const shape = smin(1.5, sdCircle(PAL, 2.9), sdCapsule(PAL, foot, 1.7, 2.4), sdCircle(foot, 3.1));
  const ring = outerOf(contour(shape, boundsOfSdf([PAL, foot], 6), 0.3));
  put("pallet.post", [foot[0], foot[1], 0], 0, S(k.cylinder(foot[0], foot[1], 2.2, 0, Z.palletBridge[0], P, 20), { tone: "mid", crease: "none" }), [A.cylinder(foot[0], foot[1], 2.2, 0, Z.palletBridge[0], { name: "pallet.post" })]);
  put("pallet.bridge", [PAL[0], PAL[1], Z.palletBridge[0]], Z.palletBridge[0], S(k.extrude(ring, Z.palletBridge[0], Z.palletBridge[1] - Z.palletBridge[0], P, { convex: false, bevel: 0.4 }), { tone: "mid" }) + jewel(PAL, Z.palletBridge[1], 1.5) + screw(foot, Z.palletBridge[1], 1.6, 70), [A.extruded(ring, Z.palletBridge[0], Z.palletBridge[1] - Z.palletBridge[0], { name: "pallet.bridge" })]);
}

// Balance: three-armed wheel, roller with impulse jewel, hairspring under the cock.
{
  const rings = [circlePts(R_BAL, 120), ...windows(3, 1.5, 3.2, R_BAL - 2.5, 0.2)];
  const details = lineLocal(circleD(R_BAL - 1.2), "faint") + lineLocal(circleD(1.9), "lo") + `<g class="iso-dots" data-tone="mid">${[0, 1, 2].map((i) => `<circle cx="${f2(Math.cos(0.2 + 1.047 + i * 2.094) * (R_BAL - 1.25))}" cy="${f2(Math.sin(0.2 + 1.047 + i * 2.094) * (R_BAL - 1.25))}" r="0.55"/>`).join("")}</g>`;
  put("balance.wheel", [BAL[0], BAL[1], Z.balance[0]], Z.balance[0], planePart({ c: BAL, z: Z.balance, rings, tone: "hi", part: "balance", details }), [A.cylinder(BAL[0], BAL[1], R_BAL, Z.balance[0], Z.balance[1] - Z.balance[0], { name: "balance.wheel", owner: "balance" })]);
  turning("balance", BAL, { drive: "balance" });
  const roller = cut(sdCircle([0, 0], 3.7), sdCircle([3.9, 0], 1.0));
  const rr = contour(roller, [-4.5, -4.5, 4.5, 4.5], 0.15);
  const pin = `<path class="wt-stone" d="${circleD(0.55, [2.65, 0])}"/>`;
  put("balance.roller", [BAL[0], BAL[1], Z.roller[0]], Z.roller[0], planePart({ c: BAL, z: Z.roller, rings: rr, tone: "hi", part: "roller", details: pin + lineLocal(circleD(1.2), "lo"), angle: FORK_BASE + Math.PI }), [A.cylinder(BAL[0], BAL[1], 3.7, Z.roller[0], Z.roller[1] - Z.roller[0], { name: "balance.roller", owner: "balance" })]);
  turning("roller", BAL, { drive: "balance", base: FORK_BASE + Math.PI });
  arbor("balance.staff", BAL, Z.roller[1], Z.balance[0], 0.8);
  arbor("balance.staff", BAL, Z.balance[1], Z.hair[0], 0.8);
  arbor("balance.staff", BAL, Z.hair[1], Z.cock[0], 0.8);
  const hair = SH.hairspringPoints(0);
  const studAt = polar(SH.HAIR.stud / RAD, SH.HAIR.outer);
  const hm = planeMatrix(BAL[0], BAL[1], Z.hair[1]);
  const svg = `<g transform="${hm}"><path class="iso-line wt-hair" data-tone="hi" data-part="hairspring" d="${polyD(hair)}"/>${lineLocal(circleD(SH.HAIR.inner - 0.3), "mid")}</g>`;
  put("balance.hair", [BAL[0], BAL[1], Z.hair[0]], Z.hair[0], svg, [A.ring({ o: [BAL[0], BAL[1], 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, Z.hair[0], Z.hair[1], 0.8, SH.HAIR.outer - 1.4, { name: "balance.hair", owner: "balance" })]);
  // Stud: a small block hanging under the cock where the spring's outer end is pinned.
  const stud = add2(BAL, studAt);
  put("balance.stud", [stud[0], stud[1], Z.hair[0]], Z.hair[0] + 0.01, S(k.cylinder(stud[0], stud[1], 1.3, Z.hair[0], Z.cock[0] - Z.hair[0], P, 16), { tone: "mid" }), [A.cylinder(stud[0], stud[1], 1.3, Z.hair[0], Z.cock[0] - Z.hair[0], { name: "balance.stud", owner: "balance" })]);
}

// ---------------------------------------------------------------- bridges
function bridge(name, sdf, pts, z, { jewels = [], screws = [], pillars = [], stripes = true, tone = "mid" } = {}) {
  const ring = outerOf(contour(sdf, boundsOfSdf(pts, 14), 0.35));
  const paths = k.extrude(ring, z[0], z[1] - z[0], P, { convex: false, bevel: 0.8 });
  let inner = "";
  if (stripes) inner = Ln(stripesOn(ring, z[1]), { tone: "faint", className: "wt-cotes" });
  let svg = S(paths, { tone, inner: "" }) + inner;
  svg += jewels.map((j) => jewel(j, z[1])).join("");
  svg += screws.map(([p, a]) => screw(p, z[1], 2.3, a)).join("");
  for (const p of pillars) put(`${name}.pillar`, [p[0], p[1], 0], 0, S(k.cylinder(p[0], p[1], 3.2, 0, z[0], P, 24), { tone: "mid", inner: Ln(k.sideArc(p[0], p[1], 3.2, z[0] * 0.5, P, 18), { tone: "faint" }) }), [A.cylinder(p[0], p[1], 3.2, 0, z[0], { name: `${name}.pillar` })]);
  put(name, [...centroid(ring), z[0]], z[0], svg, [A.extruded(ring, z[0], z[1] - z[0], { name })]);
  return ring;
}
const centroid = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
// Côtes de Genève: parallel stripes cut exactly at the bridge outline.
function stripesOn(ring, z, angle = 32 * RAD, gap = 5.2, holes = []) {
  const u = [Math.cos(angle), Math.sin(angle)];
  const n = [-u[1], u[0]];
  const proj = ring.map((p) => p[0] * n[0] + p[1] * n[1]);
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  const out = [];
  for (let s = Math.ceil(lo / gap) * gap + gap * 0.5; s < hi; s += gap) {
    const hits = [];
    for (const poly of [ring, ...holes]) for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const pa = a[0] * n[0] + a[1] * n[1] - s;
      const pb = b[0] * n[0] + b[1] * n[1] - s;
      if ((pa < 0) !== (pb < 0)) {
        const t = pa / (pa - pb);
        const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        hits.push(p[0] * u[0] + p[1] * u[1]);
      }
    }
    hits.sort((x, y) => x - y);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      if (hits[i + 1] - hits[i] < 1.5) continue;
      const a = add2([n[0] * s, n[1] * s], u, hits[i]);
      const b = add2([n[0] * s, n[1] * s], u, hits[i + 1]);
      out.push(k.lineOnTop(a, b, z, P));
    }
  }
  return out.join("");
}

const clipMov = (f, r = MOV - 1.2) => both(f, sdCircle(C, r));
// Train bridge: bosses over the third, fourth, escape and centre pivots, two feet at the edge.
const TB_FEET = [polar(168, 88), polar(198, 87)];
bridge(
  "bridge.train",
  clipMov(smin(2.4, sdCircle(THI, 6.5), sdCircle(FOU, 5.6), sdCircle(C, 6.6), sdCapsule(THI, FOU, 4.2), sdCapsule(THI, C, 4.4), sdCapsule(THI, TB_FEET[0], 4.6, 7), sdCircle(TB_FEET[0], 8), sdCapsule(THI, TB_FEET[1], 4.4, 6.5), sdCircle(TB_FEET[1], 7.5))),
  [THI, FOU, C, ...TB_FEET],
  Z.trainBridge,
  { jewels: [THI, FOU, C], screws: [[TB_FEET[0], 40], [TB_FEET[1], 160]], pillars: TB_FEET },
);
// Escape-wheel cock: a slender arm from the escape pivot back to the rim.
const ESC_FOOT = polar(58, 89);
bridge("cock.escape", clipMov(smin(2.5, sdCircle(ESC, 3.8), sdCapsule(ESC, ESC_FOOT, 2.6, 5.4), sdCircle(ESC_FOOT, 6.4))), [ESC, ESC_FOOT], Z.trainBridge, { jewels: [ESC], screws: [[ESC_FOOT, 130]], pillars: [ESC_FOOT], stripes: false });
// Balance cock: one foot behind the balance, a boss with the shock spring and the regulator.
bridge(
  "cock",
  clipMov(smin(4, sdCircle(BAL, 7.6), sdCapsule(BAL, COCK_FOOT, 5, 8.5), sdCircle(COCK_FOOT, 9))),
  [BAL, COCK_FOOT],
  Z.cock,
  { screws: [[COCK_FOOT, 20]], pillars: [COCK_FOOT], stripes: false },
);
{
  // Shock setting (lyre spring round the cap jewel), regulator index and its + − scale.
  const z = Z.cock[1];
  const m = planeMatrix(BAL[0], BAL[1], z);
  const lyre = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const a = s * (0.25 + 2.4 * t);
      const rr = 3.6 + 0.7 * Math.sin(Math.PI * t);
      pts.push([rr * Math.cos(a + Math.PI), rr * Math.sin(a + Math.PI)]);
    }
    lyre.push(polyD(pts));
  }
  const index = polyD([[-3, 1.2], [-21, 0.5], [-21.5, 0], [-21, -0.5], [-3, -1.2]], true);
  const scale = [];
  for (let i = -4; i <= 4; i++) {
    const a = Math.PI + i * 0.06;
    scale.push(polyD([[6.6 * Math.cos(a), 6.6 * Math.sin(a)], [(i % 4 === 0 ? 5.3 : 5.9) * Math.cos(a), (i % 4 === 0 ? 5.3 : 5.9) * Math.sin(a)]]));
  }
  const towardFoot = Math.atan2(COCK_FOOT[1] - BAL[1], COCK_FOOT[0] - BAL[0]);
  const svg =
    `<g transform="${m} rotate(${f2(towardFoot / RAD + 180)})">` +
    lineLocal(circleD(6.6), "faint") +
    lineLocal(scale.join(""), "lo") +
    `<path class="wp-face" data-tone="mid" d="${index}"/>` +
    lineLocal(circleD(2.7), "mid") +
    lineLocal(lyre.join(""), "hi") +
    `<path class="wt-jewel" d="${circleD(1.6)}"/>` +
    `<circle class="wt-dot" r="0.35"/>` +
    `</g>`;
  const indexRing = [[-3, 1.2], [-21, 0.5], [-21.5, 0], [-21, -0.5], [-3, -1.2]].map((p) => add2(BAL, rot2(p, towardFoot + Math.PI)));
  put("cock.top", [BAL[0], BAL[1], z], z, svg, [A.cylinder(BAL[0], BAL[1], 6.8, z, 0.3, { name: "cock.top" }), A.extruded(indexRing, z, 0.3, { name: "cock.top" })]);
}
// Barrel bridge: arbor boss, crown-wheel boss, two feet.
const BB_FEET = [polar(-124, 89), polar(-46, 90)];
bridge(
  "bridge.barrel",
  clipMov(smin(3.5, sdCircle(BAR, 10.5), sdCircle(CW, 8.5), sdCapsule(BAR, CW, 5.8), sdCapsule(BAR, BB_FEET[0], 5.8, 7.5), sdCircle(BB_FEET[0], 8), sdCapsule(CW, BB_FEET[1], 5, 7), sdCircle(BB_FEET[1], 7.5))),
  [BAR, CW, ...BB_FEET],
  Z.barrelBridge,
  { screws: [[BB_FEET[0], 150], [BB_FEET[1], 60]], pillars: BB_FEET },
);

// Ratchet wheel (openwork, on the barrel arbor), its screw, the click and click spring, the crown wheel.
function ratchetRing() {
  const n = T.ratchet;
  const p = TAU / n;
  const ra = R_RATCHET + 0.9;
  const rr = R_RATCHET - 0.9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const c = i * p;
    pts.push([rr * Math.cos(c), rr * Math.sin(c)]);
    pts.push([(rr + 0.5) * Math.cos(c + 0.25 * p), (rr + 0.5) * Math.sin(c + 0.25 * p)]);
    pts.push([ra * Math.cos(c + 0.86 * p), ra * Math.sin(c + 0.86 * p)]);
  }
  return pts;
}
{
  const rings = [ratchetRing(), ...windows(5, 2.3, 7.4, R_RATCHET - 3.6)];
  const head = lineLocal(circleD(6.2), "lo") + lineLocal(circleD(4.8), "mid") + lineLocal(polyD([[-4.8, 0], [4.8, 0]]), "mid");
  put("ratchet", [BAR[0], BAR[1], Z.ratchet[0]], Z.ratchet[0], planePart({ c: BAR, z: Z.ratchet, rings, tone: "hi", part: "ratchet", details: head }), [A.cylinder(BAR[0], BAR[1], R_RATCHET, Z.ratchet[0], Z.ratchet[1] - Z.ratchet[0], { name: "ratchet" })]);
  turning("ratchet", BAR, { drive: "arbor" });
  const cwRings = [toothRing(T.crownWheel, R_CW), ...windows(3, 2.4, 4.4, R_CW - 3.6)];
  const cwHead = lineLocal(circleD(3.8), "mid") + lineLocal(polyD([[-3.8, 0], [3.8, 0]]) + polyD([[0, -3.8], [0, 3.8]]), "mid");
  put("crownwheel", [CW[0], CW[1], Z.crownWheel[0]], Z.crownWheel[0], planePart({ c: CW, z: Z.crownWheel, rings: cwRings, tone: "hi", part: "crownwheel", details: cwHead }), [A.cylinder(CW[0], CW[1], R_CW, Z.crownWheel[0], Z.crownWheel[1] - Z.crownWheel[0], { name: "crownwheel" })]);
  turning("crownwheel", CW, { drive: "crownwheel" });
}
// Click: pivots on the barrel bridge's left arm, its nose in the ratchet teeth.
const CLICK = add2(BAR, dir2(BAR, BB_FEET[0]), 36);
const CLICK_BASE = (() => {
  const toBar = dir2(CLICK, BAR);
  return Math.atan2(toBar[1], toBar[0]) + 0.62;
})();
{
  const nose = [14.4, 0];
  const body = smin(1.6, sdCircle([0, 0], 3.4), sdCapsule([0, 0], nose, 2.6, 0.8), sdCapsule([0, 0], [-5.2, -2], 2.2));
  const rings = contour(body, [-9, -6, 16.5, 6], 0.15);
  const svg = planePart({ c: CLICK, z: [Z.barrelBridge[1], Z.barrelBridge[1] + 1.2], rings, tone: "hi", part: "click", angle: CLICK_BASE, details: lineLocal(circleD(1.8), "mid") + lineLocal(polyD([[-1.8, 0], [1.8, 0]]), "mid") });
  put("click", [CLICK[0], CLICK[1], Z.barrelBridge[1]], Z.barrelBridge[1], svg, [A.extruded(rings[0].map((p) => add2(CLICK, rot2(p, CLICK_BASE))), Z.barrelBridge[1], 1.2, { name: "click" })]);
  turning("click", CLICK, { drive: "click", base: CLICK_BASE });
  // Click spring: a curved blade from its screw that presses on the click's tail.
  const springScrew = add2(CLICK, dir2(BAR, CLICK), -0.5 + 0);
  const tail = add2(CLICK, rot2([-6.8, -2.6], CLICK_BASE));
  const anchor = add2(CLICK, rot2([-15, 6], CLICK_BASE));
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = [anchor[0] + (tail[0] - anchor[0]) * t, anchor[1] + (tail[1] - anchor[1]) * t];
    const bow = Math.sin(Math.PI * t) * 3.2;
    const nn = dir2(anchor, tail);
    pts.push([p[0] - nn[1] * bow, p[1] + nn[0] * bow]);
  }
  void springScrew;
  put("click.spring", [anchor[0], anchor[1], Z.barrelBridge[1]], Z.barrelBridge[1] + 0.1, Ln(k.onTop(pts, Z.barrelBridge[1] + 0.6, P), { tone: "hi", className: "wt-blade" }) + screw(anchor, Z.barrelBridge[1], 1.8, 10), [A.cylinder(anchor[0], anchor[1], 2.2, Z.barrelBridge[1], 0.8, { name: "click.spring" }), A.tube(pts.map(([x, y]) => [x, y, Z.barrelBridge[1] + 0.6]), 0.45, { name: "click.spring" })]);
}

// ---------------------------------------------------------------- automatic works
// Reduction wheels under the automatic bridge, the bridge, reversers and rotor pinion on top.
wheel("red1", RED1, Z.red1, T.red1, R_RED1, { spokes: 4, spoke: 1.4, hubR: 2.8, part: "red1" });
pinion("red1.pinion", RED1, Z.red1Pinion, T.red1Pinion, R_RED1P, "red1-p");
turning("red1", RED1, { drive: "red1" });
turning("red1-p", RED1, { drive: "red1" });
wheel("red2", RED2, Z.red2, T.red2, R_RED2, { spokes: 5, spoke: 1.3, hubR: 2.8, part: "red2" });
pinion("red2.pinion", RED2, Z.red2Pinion, T.red2Pinion, R_RED2P, "red2-p");
arbor("red2.arbor", RED2, Z.red2Pinion[1], Z.red2[0], 0.9);
turning("red2", RED2, { drive: "red2" });
turning("red2-p", RED2, { drive: "red2" });
for (const [name, at2] of [["revA", REV_A], ["revB", REV_B]]) {
  pinion(`${name}.pinion`, at2, Z.revPinion, T.reverserPinion, R_REVP, `${name}-p`);
  arbor(`${name}.arbor`, at2, Z.revPinion[1], Z.autoBridge[0], 0.8);
  turning(`${name}-p`, at2, { drive: "revPinion" });
}
const AB_FEET = [add2(BB_FEET[1], dir2(BB_FEET[1], CW), 14), add2(THI, dir2(THI, C), 15)];
const AB_RIM = [polar(-12, 88), polar(46, 88)];
const sdSector = (a0, a1, r0, r1, round) => (p) => {
  const r = Math.hypot(p[0], p[1]);
  const a = Math.atan2(p[1], p[0]);
  const mid = (a0 + a1) / 2;
  const half = (a1 - a0) / 2;
  let da = Math.atan2(Math.sin(a - mid), Math.cos(a - mid));
  const side = (Math.abs(da) - half) * r;
  return Math.max(r - r1, r0 - r, side) + 0 * round;
};
const AB_PLATE = smin(4, sdSector(-14 * RAD, 50 * RAD, 10, MOV - 4, 6), ...AB_RIM.map((f) => sdCircle(f, 6.5)));
const AB_WINDOWS = [sdCapsule(polar(4, 40), polar(32, 42), 6.5), sdCapsule(polar(0, 66), polar(36, 68), 5)];
{
  const shape = clipMov(cut(smin(3.5, AB_PLATE, sdCircle(C, 12.5), sdCircle(REV_A, 6.2), sdCircle(REV_B, 6.2), sdCircle(RED1, 5), sdCircle(RED2, 5.4), sdCapsule(C, REV_A, 5), sdCapsule(REV_A, REV_B, 4.4), sdCapsule(REV_B, RED1, 3.4), sdCapsule(C, RED2, 4.2), ...AB_FEET.map((f) => sdCapsule(C, f, 3.6, 4.2)), ...AB_FEET.map((f) => sdCircle(f, 4.6))), ...AB_WINDOWS));
  const rings = contour(shape, [-MOV, -MOV, MOV, MOV], 0.35);
  const ring = outerOf(rings);
  const holes = rings.filter((r) => r !== ring);
  const z = Z.autoBridge;
  const holeD = holes.map((hole) => k.pathOf(hole.map(([x, y]) => at([x, y, z[1]])), true)).join("");
  const mask = `<defs><mask id="ab-holes" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${holeD}" fill="#000"/></mask></defs>`;
  let svg = mask + `<g mask="url(#ab-holes)">${S(k.extrude(ring, z[0], z[1] - z[0], P, { convex: false, bevel: 0.7 }), { tone: "mid" })}</g>` + Ln(stripesOn(ring, z[1], -40 * RAD, 4.4, holes), { tone: "faint" });
  // Windows through the plate: their far walls, then the outline of the cut.
  for (const hole of holes) {
    const top = hole.map(([x, y]) => at([x, y, z[1]]));
    const bottom = hole.map(([x, y]) => at([x, y, z[0]]));
    svg += `<path class="iso-shade" data-shade="0" d="${hole.map((_, i) => { const j = (i + 1) % hole.length; const n = [hole[j][1] - hole[i][1], hole[i][0] - hole[j][0]]; return n[0] * Math.cos(AZ * RAD) + n[1] * Math.sin(AZ * RAD) < 0 ? k.pathOf([top[i], top[j], bottom[j], bottom[i]], true) : ""; }).join("")}"/>`;
    svg += Ln(k.pathOf(top, true), { tone: "mid" });
  }
  const label = polar(17, 74);
  svg += k.faceTextSvg(`${planeMatrix(label[0], label[1], z[1])} rotate(107)`, "AUTOMATIC · 25 JEWELS", { size: 4, tone: "lo", anchor: "middle" });
  svg += [RED1, RED2].map((p) => jewel(p, z[1], 1.9)).join("");
  svg += AB_FEET.map((p, i) => screw(p, z[1], 2.1, 30 + i * 50)).join("");
  svg += AB_RIM.map((p, i) => screw(p, z[1], 2.3, 80 + i * 40)).join("");
  for (const f of AB_RIM) put("auto.post", [f[0], f[1], 0], 0, S(k.cylinder(f[0], f[1], 3.4, 0, z[0], P, 24), { tone: "mid", inner: Ln(k.sideArc(f[0], f[1], 3.4, 9, P, 18), { tone: "faint" }) }), [A.cylinder(f[0], f[1], 3.4, 0, z[0], { name: "auto.post" })]);
  for (const f of AB_FEET) {
    const base = f === AB_FEET[0] ? Z.barrelBridge[1] : Z.trainBridge[1];
    put("auto.pillar", [f[0], f[1], base], base, S(k.cylinder(f[0], f[1], 2.6, base, z[0] - base, P, 20), { tone: "mid", crease: "none" }), [A.cylinder(f[0], f[1], 2.6, base, z[0] - base, { name: "auto.pillar" })]);
  }
  put("auto.bridge", [0, 0, z[0]], z[0], svg, [A.extruded(ring, z[0], z[1] - z[0], { name: "auto.bridge" })]);
}
// Reversers: each wheel carries a one-way clutch. Its inner star turns with the pinion beneath;
// the two pawls catch the star in one direction and slip over it in the other.
function clutchStar() {
  const pts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    pts.push(polar(a / RAD, 3.2), polar(a / RAD + 30, 4.4), polar(a / RAD + 34, 3.2));
  }
  return pts;
}
for (const [name, at2, sign] of [["revA", REV_A, 1], ["revB", REV_B, -1]]) {
  const rIn = R_REV - 1.2 * MA - 1.8;
  const rings = [toothRing(T.reverser, R_REV), circlePts(5.6, 40).reverse(), ...windows(3, 1.3, 6.2, rIn, 0.5).map((h) => h)];
  const pawls = [0, 1].map((i) => {
    const a = i * 180;
    return polyD([polar(a, 5.6), polar(a + sign * 13, 4.55), polar(a + sign * 27, 5.6)]);
  }).join("");
  put(`${name}.wheel`, [at2[0], at2[1], Z.rev[0]], Z.rev[0], planePart({ c: at2, z: Z.rev, rings, tone: "hi", part: `${name}`, details: `<path class="iso-line wt-pawl" data-tone="lo" d="${pawls}"/>` }), [A.ring({ o: [at2[0], at2[1], 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, Z.rev[0], Z.rev[1], 5.6, tipOf(T.reverser, R_REV), { name: `${name}.wheel`, owner: name })]);
  turning(name, at2, { drive: name });
  const star = planePart({ c: at2, z: [Z.rev[0], Z.revClutch[1]], rings: [clutchStar()], tone: "hi", part: `${name}-star`, details: lineLocal(circleD(1.3), "mid") + `<circle class="wt-dot" r="0.4"/>` });
  put(`${name}.star`, [at2[0], at2[1], Z.rev[0]], Z.rev[0] + 0.01, star, [A.cylinder(at2[0], at2[1], 4.4, Z.rev[0], Z.revClutch[1] - Z.rev[0], { name: `${name}.star`, owner: name })]);
  turning(`${name}-star`, at2, { drive: "revPinion" });
}
pinion("rotor.pinion", C, Z.rotorPinion, T.rotorPinion, R_RP, "rotor-p");
turning("rotor-p", C, { drive: "rotor" });

// Rotor: ball-bearing hub, openwork plate, heavy half rim (rebuilt every frame by the page).
const ROTOR_REST = -0.08;
{
  const hz = Z.hub;
  const hubSvg =
    S(k.cylinder(0, 0, 9.4, hz[0], hz[1] - hz[0], P, 64, 0.5), { tone: "hi", inner: Ln(k.sideArc(0, 0, 9.4, hz[0] + 1.6, P, 48), { tone: "faint" }) }) +
    Ln(k.ring(0, 0, 7.4, hz[1], P, 56), { tone: "lo" }) +
    Ln(k.ring(0, 0, 4.6, hz[1], P, 40), { tone: "lo" }) +
    `<g data-part="balls" data-m="${planeMatrix(0, 0, hz[1])}" transform="${planeMatrix(0, 0, hz[1])}"><g class="iso-dots" data-tone="hi">${Array.from({ length: 11 }, (_, i) => `<circle cx="${f2(6 * Math.cos((i * TAU) / 11))}" cy="${f2(6 * Math.sin((i * TAU) / 11))}" r="0.85"/>`).join("")}</g></g>` +
    S(k.cylinder(0, 0, 3.6, hz[1], 0.9, P, 32, 0.3), { tone: "mid" }) +
    Ln(k.lineOnTop([-3.6, 0], [3.6, 0], hz[1] + 0.9, P), { tone: "mid" });
  turning("balls", C, { drive: "balls" });
  const band = both(both(sdCircle([0, 0], SH.RIM.inner + 0.5), (p) => SH.RIM.inner - 9 - Math.hypot(p[0], p[1])), (p) => -p[0]);
  const spokes = [-58, 0, 58].map((deg) => sdCapsule([0, 0], polar(deg, SH.RIM.inner - 4), 3.4, 2.6));
  const plate = smin(3, band, sdCircle([0, 0], 12), ...spokes);
  const rings = contour(plate, [-16, -84, 84, 84], 0.3);
  const guide = lineLocal(polyD(Array.from({ length: 61 }, (_, i) => polar(-90 + i * 3, SH.RIM.inner - 2.6))), "faint");
  const screws = `<g class="iso-dots" data-tone="mid">${[-58, 0, 58].map((deg) => polar(deg, SH.RIM.inner - 4.6)).map(([x, y]) => `<circle cx="${f2(x)}" cy="${f2(y)}" r="0.6"/>`).join("")}</g>`;
  const svg = planePart({ c: C, z: Z.rotorPlate, rings, tone: "hi", part: "rotor-plate", angle: ROTOR_REST, details: guide + screws });
  put("rotor.plate", [0, 0, Z.rotorPlate[0]], Z.rotorPlate[0], svg, [A.cylinder(0, 0, SH.RIM.inner, Z.rotorPlate[0], Z.rotorPlate[1] - Z.rotorPlate[0], { name: "rotor.plate", owner: "rotor" })]);
  turning("rotor-plate", C, { drive: "rotor" });
  put("rotor.hub", [0, 0, hz[0]], Z.rotorPlate[1] + 0.05, hubSvg, [A.cylinder(0, 0, 9.4, hz[0], hz[1] - hz[0] + 0.9, { name: "rotor.hub", owner: "rotor" })]);
  const rim = SH.rimRing(0, 0, ROTOR_REST);
  const rimPaths = k.extrude(rim.ring, SH.RIM.z0, SH.RIM.z1 - SH.RIM.z0, P, { convex: false });
  const rimSvg = `<g class="iso-solid" data-part="rim"><path class="iso-fill" d="${rimPaths.fill}"/>${[0, 1, 2, 3].map((i) => `<path class="iso-shade" data-shade="${i}" d="${rimPaths.shades[i]}"/>`).join("")}<path class="iso-top" d="${rimPaths.top}"/><path class="iso-line iso-crease" data-tone="lo" d="${rimPaths.crease}"/><path class="iso-line iso-edge" data-tone="hi" d="${rimPaths.outline}"/></g>`;
  put("rotor.rim", [0, 0, SH.RIM.z0], Z.rotorPlate[1] + 0.02, rimSvg, [A.ring({ o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, SH.RIM.z0, SH.RIM.z1, SH.RIM.inner, SH.RIM.outer, { name: "rotor.rim", owner: "rotor" })]);
}

// ---------------------------------------------------------------- order and page
A.settle(R, P, { states: [0] });
R.items.sort((a, b) => a.key - b.key);
const STEP_PARTS = {
  rotor: ["rotor.plate", "rotor.hub", "rotor.rim", "rotor.pinion"],
  reversers: ["revA", "revB", "rotor.pinion"],
  reduction: ["red1", "red2", "ratchet", "click", "click.spring"],
  spring: ["barrel", "ratchet"],
  bridle: ["barrel"],
  train: ["barrel.teeth", "barrel.drum", "centre", "third", "fourth", "escape.pinion", "escape.arbor"],
  escapement: ["escape", "fork", "balance", "pallet"],
  crown: ["crown", "stem", "crownwheel", "ratchet", "click", "click.spring"],
};
const stepsOf = (name) => {
  const base = name.split("#")[0];
  return Object.entries(STEP_PARTS).filter(([, list]) => list.some((p) => base === p || base.startsWith(p + "."))).map(([step]) => step).join(" ");
};
const groups = R.items.map((item) => `<g class="it" data-name="${item.name}"${stepsOf(item.name) ? ` data-steps="${stepsOf(item.name)}"` : ""}>${item.svg}</g>`).join("");

const LABEL =
  "An automatic watch movement, 25.6 mm across, clamped in a movement holder and seen from the back. On top an openwork rotor with a heavy rim turns on a ball bearing; its pinion drives two reverser wheels with one-way clutches, then two reduction wheels, then the ratchet wheel on the barrel arbor, held by a click. Through the barrel cover the mainspring is visible, wound round the arbor. Below, the going train runs from the barrel through the centre, third and fourth wheels to the escape wheel, the pallet fork and the balance wheel with its hairspring under the balance cock. A crown on the stem winds the same ratchet by hand.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="wt-base">${BASE_SVG}</g>`, `<g class="wt-movement">${groups}</g>`] });

const DATA = {
  P, V,
  parts: PARTS.map((p) => ({ part: p.part, drive: p.drive, base: p.base ?? 0, phase: p.phase ?? 0 })),
  rim: SH.RIM,
  stem: { F: STEM_F, ribs: [109.2, 116, 11.8, 36] },
  hairStud: SH.HAIR.stud,
  rotorRest: ROTOR_REST,
  forkBase: FORK_BASE, forkSwing: FORK_SWING, clickBase: CLICK_BASE,
  bal: BAL, bar: BAR, z: { hair: Z.hair[1] },
  matrices: { hair: planeMatrix(BAL[0], BAL[1], Z.hair[1]) },
};

const strip = (file) => readFileSync(file, "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const latheSource = strip(join(KIT, "lathe.mjs"));
const latheScript = `const G = (() => {${latheSource}\nreturn { ribsOf, frameAlong };})();\n`;
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const CSS = readFileSync(join(HERE, "watch.css"), "utf8");

const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 1",
    title: "Automatic movement",
    hint: "Drag rotor · W winds · space slows",
    readout: `running · reserve ${M.hm(9)}`,
    body: `<div class="iso-stage wt-stage" tabindex="0" role="group" aria-label="Automatic watch movement. Drag across the movement, or press the left and right arrows, to swing the rotor; hold W or click the crown to wind by hand; space toggles slow motion; R lets the mainspring down.">${svg}<span class="wt-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const STEPS = [
  ["rotor", "The rotor catches your movement", "The half-moon weight on top spins freely on a ball bearing. When you move your arm, gravity swings its heavy edge round, like a pendulum. Lying flat on a bench it only moves if you push it, so drag it."],
  ["reversers", "Swinging either way winds the spring", "The rotor turns two small reverser wheels. Each has a one-way clutch, like a bicycle freewheel: one grips while the other slips. So a swing to the left and a swing to the right both turn the next wheels the same way. The gripping wheel's pawls turn bold."],
  ["reduction", "Gears trade speed for force", "Two reduction wheels slow the motion right down: 140 turns of the rotor turn the big ratchet wheel on the barrel just once. Each rotor turn adds about 3 minutes of running time. The click, the small pawl beside the ratchet, stops the spring unwinding backwards."],
  ["spring", "The mainspring stores the energy", "Inside the barrel a long steel spring coils tighter as it is wound. Look through the barrel cover: when wound, the coils hug the centre; when run down, they lie against the outer wall. Fully wound it holds about 42 hours. <span class=\"wt-now\">Right now: <b data-live=\"reserve\">9 h 00</b>.</span>"],
  ["bridle", "It can't be overwound", "The spring's outer end isn't fixed. It presses against the barrel wall and slips round once the spring is full, so extra winding does no harm. Wind it to full and the readout says <i>bridle slipping</i>."],
  ["train", "The gear train lets the energy out slowly", "The spring turns the barrel, the barrel turns the centre wheel once an hour (it carries the minute hand), and further wheels step the speed up: the fourth wheel turns once a minute (the seconds) and drives the small escape wheel."],
  ["escapement", "The escapement and balance keep time", "Left alone the gears would spin out in seconds. The pallet fork locks the escape wheel and lets it move half a tooth at a time, eight times a second. Each release gives the balance wheel a tiny push, and the balance swings back and forth on its hairspring 4 times a second. That steady swing is the clock. Press space to watch it slowly."],
  ["crown", "Or wind it by hand", "Turning the crown drives the same ratchet through the crown wheel; the rotor isn't moved, because the reverser clutches let it slip. About 33 turns of the crown wind it from empty to full. Hold W, or press and hold the crown."],
];
const EXPLAIN = `<section class="wt-explain" aria-labelledby="wt-how">
  <h2 id="wt-how">How an automatic watch winds itself</h2>
  <p class="wt-lede">A mechanical watch runs on a coiled spring. An automatic watch keeps that spring wound with a swinging weight, so ordinary wrist movement is enough. Follow the energy from your wrist to the ticking balance. Point at a step to light up its parts in the drawing, or click it to see it work.</p>
  <ol class="wt-steps">${STEPS.map(([key, title, text], i) => `<li class="wt-step" data-step="${key}" tabindex="0" role="button" aria-pressed="false"><span class="wt-num">${i + 1}</span><h3>${title}</h3><p>${text}</p></li>`).join("")}</ol>
  <div class="wt-cols">
    <div><h3>Reading the readout</h3><p><b>reserve <span data-live="reserve">9 h 00</span></b> is how long the watch would keep running if you put it down now. <b><span data-live="amp">261</span>°</b> is how far the balance swings each way from rest. The swing shrinks as the spring runs down and the watch stops when it gets too small, but the beat stays at 4 swings a second, which is why the watch keeps good time all day.</p></div>
    <div><h3>Try it</h3><ul class="wt-keys"><li><kbd>drag</kbd> swing the rotor</li><li><kbd>←</kbd> <kbd>→</kbd> flick it</li><li><kbd>W</kbd> or hold the crown: wind by hand</li><li><kbd>space</kbd> slow motion</li><li><kbd>R</kbd> let the spring run down</li><li><kbd>Esc</kbd> stop</li></ul></div>
  </div>
  <p class="wt-small">Numbers are those of a typical 4 Hz automatic of the ETA 2824 type: 28,800 beats an hour, about 42 hours of reserve, 25.6 mm across. The 140:1 winding ratio is a typical textbook value.</p>
</section>`;

const LAYOUT = `<style>.wt-fig{--wt-ar:${(W / H).toFixed(4)}}</style><div class="wt-layout"><div class="wt-fig">${body}</div>${EXPLAIN}</div>`;
const page = k.pageHtml({ title: "Automatic movement", theme: THEME, body: LAYOUT, script: kitScript() + latheScript + strip(join(HERE, "model.mjs")) + strip(join(HERE, "shapes.mjs")) + LIVE, width: 1040 });
const name = THEME === "light" ? "automatic-watch-light.html" : "automatic-watch.html";
writeFileSync(join(HERE, name), page);
if (process.argv.includes("--where")) for (const [n, p] of Object.entries({ BAL, ESC, PAL, BAR, CW, C, CLICK, REV_A, REV_B, RED1, RED2, THI, FOU })) { const q = at([p[0], p[1], 12]); console.log(n, Math.round(24 + q[0] * 652 / W), Math.round(52 + q[1] * 652 / W)); }
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `scale ${KS.toFixed(3)}`);
A.auditOrExit(R, P, { allow: [["rotor.*", "rotor.*"]] });
