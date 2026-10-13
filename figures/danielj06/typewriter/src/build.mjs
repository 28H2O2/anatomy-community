import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { cameraOf, iso, pathOf } from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// World units: 1 unit = 0.5 mm. Front of the machine is +y, z is up.
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 470;

// The truth: pica type, 10 characters per inch, 6 lines per inch.
const PITCH = 5.08; // 2.54 mm
const LS = 8.467; // 4.23 mm
const COLS = 46;
const BELL_AT = COLS - 6;
const STAR_TEETH = 16;
const PAPER_HALF = 148; // A5 sheet, 148 mm wide
const LM = -(COLS * PITCH) / 2; // left edge of column 0, in carriage coordinates
const xOfCol = (c) => -(LM + (c + 0.5) * PITCH);

// Printing point and typebasket.
const ZP = 150; // printing line
const PY = 5; // where the slug face meets the ribbon
const PAPER_Y = 2;
const RIBBON_Y = 4;
const RS = 70; // segment pivot radius
const ZS = 90; // pivot height
const SLUG_UP = 3.5; // lower half of the slug prints lower case
const SHIFT = 7; // segment drops 3.5 mm for capitals
const LB = Math.hypot(RS, ZP + SLUG_UP - ZS);
const PHI_REST = (-10 * Math.PI) / 180;
const PHI_HIT = Math.PI - Math.atan2(ZP + SLUG_UP - ZS, RS);
const BAR_SPAN = 64;

// Platen and carriage.
const PLATEN = { y: -38, z: ZP, r: 38 };
const RIB = { z0: 118, z1: 142, lift: 23 };
const PAPER_TOP0 = ZP + 92;

// Bench plate, bed and frame.
const PLATE = { x: -300, y: -250, w: 600, d: 640, r: 14 };
const PLATE_H = 14;
const FOOT_H = 6;
const BED = { x: -250, y: -210, w: 500, d: 560, r: 20 };
const BED_Z = [8, 24];
const FRAME_Z = [24, 96];
const DECK_Z = [96, 104];

const KEY_ROWS = [
  { chars: "1234567890", y: 198, top: 100, dx: -190 },
  { chars: "qwertyuiop", y: 232, top: 88, dx: -180 },
  { chars: "asdfghjklç", y: 266, top: 76, dx: -170 },
  { chars: "zxcvbnm,.-", y: 300, top: 64, dx: -160 },
];
const KEY_STEP = 38;
const LEVER_Z = [44, 48];
const COMB_Y = 174;
const TRAVEL = 16;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-PAPER_HALF + xOfCol(COLS), PAPER_Y, PAPER_TOP0 + 3 * LS],
    [PAPER_HALF + xOfCol(0), PAPER_Y, PAPER_TOP0 + 3 * LS],
    [xOfCol(0) + 214, PLATEN.y, PLATEN.z + 22],
    [xOfCol(COLS) - 236, 74, 208],
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 62, elevation: 34 },
);

const at = (point) => iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (p) => k.depthOf(p, P);
const byDepth = (points) => [...points].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
const planeY = (y) => k.sideMatrix([0, y], 0, P, "left");
const X_AXIS = [1, 0, 0];

// A prism along any axis: the struck typebar, a pressed key lever, the return lever.
// Shared with the page, so the live parts are shaded by exactly the same rule.
function twHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function twPrism(o, a, u, poly, s0, s1, P) {
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const c = cameraOf(P);
  const V = [c.cosA * c.cosE, c.sinA * c.cosE, c.sinE];
  const ln = Math.hypot(c.sinA, c.cosA, 1.2);
  const Lt = [-c.sinA / ln, c.cosA / ln, 1.2 / ln];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const band = (s) => (s < 0 ? 0 : s < 0.2 ? 1 : s < 0.42 ? 2 : s < 0.62 ? 3 : 4);
  let area = 0;
  poly.forEach(([x, y], i) => {
    const [nx, ny] = poly[(i + 1) % poly.length];
    area += x * ny - nx * y;
  });
  const ring = area < 0 ? [...poly].reverse() : poly;
  const n = ring.length;
  const pt = (s, [x, y]) => [o[0] + a[0] * s + u[0] * x + v[0] * y, o[1] + a[1] * s + u[1] * x + v[1] * y, o[2] + a[2] * s + u[2] * x + v[2] * y];
  const low = ring.map((p) => iso(pt(s0, p), P));
  const high = ring.map((p) => iso(pt(s1, p), P));
  const buckets = [[], [], [], [], []];
  const seen = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[(j + 1) % n];
    const raw = [u[0] * (y1 - y0) - v[0] * (x1 - x0), u[1] * (y1 - y0) - v[1] * (x1 - x0), u[2] * (y1 - y0) - v[2] * (x1 - x0)];
    const len = Math.hypot(raw[0], raw[1], raw[2]) || 1;
    const normal = [raw[0] / len, raw[1] / len, raw[2] / len];
    const visible = dot(normal, V) > 1e-6;
    seen.push(visible);
    if (visible) buckets[band(dot(normal, Lt))].push(pathOf([low[j], low[(j + 1) % n], high[(j + 1) % n], high[j]], true));
  }
  const caps = [[low, [-a[0], -a[1], -a[2]]], [high, a]];
  const capSeen = caps.map(([, normal]) => dot(normal, V) > 1e-6);
  caps.forEach(([points, normal], i) => capSeen[i] && buckets[band(dot(normal, Lt))].push(pathOf(points, true)));
  const creases = [];
  for (let j = 0; j < n; j++) {
    const prev = (j - 1 + n) % n;
    if (seen[j] && seen[prev]) creases.push(pathOf([low[j], high[j]]));
    caps.forEach(([points], i) => capSeen[i] && seen[j] && creases.push(pathOf([points[j], points[(j + 1) % n]])));
  }
  const hull = pathOf(twHull([...low, ...high]), true);
  return { fill: hull, outline: hull, crease: creases.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}
const unit = (p) => {
  const l = Math.hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / l, p[1] / l, p[2] / l];
};
const rect = (hu, hv) => [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]];
// A bar from a to b with a horizontal width w and a height h.
function barBetween(a, b, w, h, side = [0, 0, 1]) {
  const axis = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  let u = [side[1] * axis[2] - side[2] * axis[1], side[2] * axis[0] - side[0] * axis[2], side[0] * axis[1] - side[1] * axis[0]];
  if (Math.hypot(...u) < 1e-6) u = [1, 0, 0];
  u = unit(u);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return twPrism(a, axis, u, rect(w / 2, h / 2), 0, len, P);
}

// Typebars: forty bars on a half-ring, all aimed at one printing point.
const BARS = Array.from({ length: 40 }, (_, i) => {
  const theta = ((-BAR_SPAN + (i * 2 * BAR_SPAN) / 39) * Math.PI) / 180;
  return { i, theta, out: [Math.sin(theta), Math.cos(theta), 0], tan: [Math.cos(theta), -Math.sin(theta), 0], pivot: [RS * Math.sin(theta), PY + RS * Math.cos(theta), ZS] };
});
function typebar(bar, phi, drop, P) {
  const d = [bar.out[0] * Math.cos(phi), bar.out[1] * Math.cos(phi), Math.sin(phi)];
  const o = [bar.pivot[0], bar.pivot[1], bar.pivot[2] - drop];
  const body = twPrism(o, d, bar.tan, [[-1.2, -2.4], [1.2, -2.4], [1.2, 2.4], [-1.2, 2.4]], -9, LB - 8, P);
  const slug = twPrism(o, d, bar.tan, [[-2.8, -4.6], [2.8, -4.6], [2.8, 4.6], [-2.8, 4.6]], LB - 8, LB, P);
  return { body, slug };
}

// Keys, mapped to typebars by their place along the keyboard, the way the levers fan.
const KEYS = [];
KEY_ROWS.forEach((row, r) => {
  [...row.chars].forEach((ch, i) => KEYS.push({ ch, label: ch.toUpperCase(), x: row.dx + i * KEY_STEP, y: row.y, top: row.top, r }));
});
[...KEYS].sort((a, b) => a.x + a.r * 0.1 - (b.x + b.r * 0.1)).forEach((key, i) => (key.bar = i));
KEYS.push({ ch: "Shift", label: "⇧", x: KEY_ROWS[3].dx - 44, y: 300, top: 64, r: 3, bar: -1 });
KEYS.push({ ch: "ShiftRight", label: "⇧", x: KEY_ROWS[3].dx + 10 * KEY_STEP + 6, y: 300, top: 64, r: 3, bar: -1 });
KEYS.push({ ch: "Backspace", label: "←", x: KEY_ROWS[0].dx + 10 * KEY_STEP, y: 198, top: 100, r: 0, bar: -1 });

// ---------- Static drawing ----------

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 9, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a pica ruler along the front: a tick per letter space, a long one every inch
  const strip = { x: -270, y: PLATE.y + PLATE.d - 26, w: 540, d: 10, r: 1.2 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, PITCH, 10, strip.y, 0.8, [2.6, 5.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.5, strip.y + 6, 0.8]), at([strip.x + strip.w - 2.5, strip.y + 6, 0.8])], { size: 0.45 }));
  const label = { x: -280, y: PLATE.y + PLATE.d - 62, w: 84, d: 22, r: 1.6 };
  out.push(S(k.slabOf(label, 0, 1, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2), 1, P, 3), { tone: "faint" }));
  out.push(L([60, 44, 52].map((w, i) => k.lineOnTop([label.x + 6, label.y + 6 + i * 5], [label.x + 6 + w, label.y + 6 + i * 5], 1, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 5, label.y + 5, 1]), at([label.x + label.w - 5, label.y + label.d - 5, 1])], { size: 0.45 }));
  return out.join("");
}

function bed() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, 0, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BED, 28))) out.push(S(k.cylinder(x, y, 12, 0, BED_Z[0], P, 28), { tone: "lo" }));
  const front = k.sideSeam(BED, BED_Z[0] + 5, P, 8);
  out.push(S(k.slabOf(BED, BED_Z[0], BED_Z[1] - BED_Z[0], P, 8, 1.2), { tone: "mid", inner: L(front, { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BED, 6), BED_Z[1], P, 8), { tone: "lo" }));
  const screws = k.corners(BED, 14);
  out.push(D(screws.map(([x, y]) => at([x, y, BED_Z[1]])), { size: 0.5 }));
  // a badge on the front lip
  const badge = `<g transform="${planeY(BED.y + BED.d)}"><path class="tw-badge" d="M-46 -19.5H46V-12.5H-46Z"/><path class="iso-line" data-tone="lo" d="M-46 -19.5H46V-12.5H-46Z"/><path class="iso-line" data-tone="lo" data-free="" d="M-38 -16H10M18 -16H38"/></g>`;
  out.push(badge);
  // sleeves for the basket posts, cast into the bed
  return out.join("");
}

function sideFrame(x) {
  const plan = { x, y: -200, w: 12, d: 350, r: 3 };
  const out = [S(k.slabOf(plan, FRAME_Z[0], FRAME_Z[1] - FRAME_Z[0], P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, FRAME_Z[0] + 10, P, 3), { tone: "faint" }) })];
  if (x > 0) {
    const fx = x + 12;
    const slot = (y0, y1, z0, z1) => {
      const r = (z1 - z0) / 2;
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI / 2 + (i / 10) * Math.PI;
        pts.push([y0 + r + Math.cos(a) * r, (z0 + z1) / 2 + Math.sin(a) * r]);
      }
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI;
        pts.push([y1 - r + Math.cos(a) * r, (z0 + z1) / 2 + Math.sin(a) * r]);
      }
      return pathOf(pts.map(([y, z]) => at([fx, y, z])), true);
    };
    out.push(L(slot(-150, -40, 50, 70) + slot(-10, 110, 50, 70), { tone: "lo" }));
    out.push(D([-180, -100, 0, 130].map((y) => at([fx, y, 84])), { size: 0.5 }));
  }
  return out.join("");
}

function rearDeck() {
  const out = [];
  const deck = { x: -250, y: -206, w: 500, d: 120, r: 4 };
  out.push(S(k.slabOf(deck, DECK_Z[0], DECK_Z[1] - DECK_Z[0], P, 4, 0.6), { tone: "mid" }));
  out.push(D([[-238, -196], [238, -196], [-238, -96], [238, -96]].map(([x, y]) => at([x, y, DECK_Z[1]])), { size: 0.5 }));
  const rail = { x: -250, y: -140, w: 500, d: 16, r: 1.5 };
  out.push(S(k.slabOf(rail, DECK_Z[1], 6, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([rail.x, rail.y + 8], [rail.x + rail.w, rail.y + 8], DECK_Z[1] + 6, P), { tone: "faint" }));
  out.push(D([-220, -110, 0, 110, 220].map((x) => at([x, rail.y + 4, DECK_Z[1] + 6])), { size: 0.42 }));
  // the mainspring drum that pulls the carriage to the left
  const [dx, dy] = DRUM;
  out.push(S(k.slabOf({ x: dx - 30, y: dy - 26, w: 60, d: 52, r: 6 }, DECK_Z[1], 3, P, 4, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(dx, dy, 22, DECK_Z[1] + 3, 18, P, 48, 0.6), { tone: "mid", inner: L(k.sideArc(dx, dy, 22, DECK_Z[1] + 12, P, 32), { tone: "faint" }) }));
  const spiral = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2 * 3.2;
    const r = 5.5 + (i / 120) * 14;
    spiral.push(at([dx + Math.cos(a) * r, dy + Math.sin(a) * r, DECK_Z[1] + 21]));
  }
  out.push(L(pathOf(spiral), { tone: "lo", free: "end" }));
  out.push(S(k.cylinder(dx, dy, 5, DECK_Z[1] + 21, 4, P, 20), { tone: "mid" }));
  out.push(D([at([dx, dy, DECK_Z[1] + 25])], { size: 0.6, tone: "hi" }));
  out.push(D([[dx - 26, dy - 22], [dx + 26, dy - 22], [dx - 26, dy + 22], [dx + 26, dy + 22]].map(([x, y]) => at([x, y, DECK_Z[1] + 3])), { size: 0.45 }));
  return out.join("");
}
const DRUM = [-196, -178];
const BAND_Y = DRUM[1] + 22;
const HOOK_X = 168;
const bandPath = (X) => pathOf([at([DRUM[0], BAND_Y, 112]), at([X + HOOK_X, BAND_Y, 112]), at([X + HOOK_X, BAND_Y, 116]), at([DRUM[0], BAND_Y, 116])], true);

// ---------- Carriage (built at column 0's offset = 0, moved with translateAlong) ----------

const platenFrame = G.frameAlong([0, PLATEN.y, PLATEN.z], X_AXIS);
function lathe(profile, style) {
  return S(G.solidOf(profile, platenFrame, P), style);
}
function knob(s0, s1, sign) {
  const a = Math.min(s0, s1);
  const b = Math.max(s0, s1);
  const out = [lathe([[a, 16], [a + 2, 20], [b - 2, 20], [b, 16]], { tone: "mid" })];
  out.push(k.fadedSvg(G.ribsOf(platenFrame, a + 3, b - 3, 20, 40, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }));
  return out.join("");
}

function carriage() {
  const out = [];
  // hook for the drawband and the rear bar on its rail
  out.push(S(k.slabOf({ x: HOOK_X - 6, y: -160, w: 12, d: 24, r: 2 }, 110, 10, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([HOOK_X, -152, 120])], { size: 0.5 }));
  const rear = { x: -174, y: -136, w: 348, d: 24, r: 2 };
  out.push(S(k.slabOf(rear, 110, 8, P, 3, 0.6), { tone: "mid" }));
  const rack = { x: -164, y: -132, w: 328, d: 8, r: 1 };
  out.push(S(k.slabOf(rack, 118, 3, P, 2), { tone: "lo" }));
  const teeth = [];
  for (let x = rack.x + 2.54; x < rack.x + rack.w; x += PITCH) teeth.push(k.lineOnTop([x, rack.y], [x, rack.y + rack.d], 121, P));
  out.push(L(teeth.join(""), { tone: "faint" }));
  for (const mx of [LM - 8, LM + COLS * PITCH + 2]) {
    out.push(S(k.slabOf({ x: mx - 4, y: -135, w: 8, d: 14, r: 1.4 }, 118, 8, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(S(k.cylinder(mx, -128, 2.6, 126, 3, P, 16), { tone: "mid" }));
  }
  // left: knob, ratchet, collar, end plate
  out.push(knob(-218, -194));
  out.push(lathe([[-194, 22], [-188, 22]], { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(platenFrame, -194, -188, 22, 28, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }));
  out.push(lathe([[-188, 9], [-182, 9]], { tone: "mid" }));
  out.push(endPlate(-182));
  // platen, rubber over a steel core
  out.push(lathe([[-174, 6], [-166, 6]], { tone: "mid" }));
  out.push(lathe([[-166, 33], [-164, 38], [164, 38], [166, 33]], { tone: "mid", inner: L(G.arcOf(platenFrame, -150, 38, P) + G.arcOf(platenFrame, 150, 38, P), { tone: "faint" }) }));
  // front rail: the rack the escapement holds, with a scale of letter spaces on top
  const front = { x: -174, y: -14, w: 348, d: 14, r: 1 };
  out.push(S(k.slabOf(front, 104, 8, P, 2, 0.4), { tone: "mid" }));
  const rackTeeth = [];
  for (let x = -174 + 1.2; x < 174; x += PITCH) rackTeeth.push(pathOf([at([x, 0, 104]), at([x, 0, 112])]));
  out.push(L(rackTeeth.join(""), { tone: "lo" }));
  const minor = [];
  const major = [];
  for (let c = -11; c <= COLS + 10; c++) {
    const x = LM + (c + 0.5) * PITCH;
    if (x < -172 || x > 172) continue;
    (c % 10 === 0 ? major : minor).push(k.lineOnTop([x, 0], [x, c % 10 === 0 ? -7 : c % 5 === 0 ? -5 : -3], 112, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(`<g data-part="paper">${paper()}</g>`);
  // paper bail with two rubber rollers
  const bailF = G.frameAlong([0, 8, 214], X_AXIS);
  out.push(bail(-178));
  out.push(S(G.solidOf([[-178, 2.5], [178, 2.5]], bailF, P), { tone: "mid" }));
  for (const rx of [-64, 64]) out.push(S(G.solidOf([[rx - 10, 4.6], [rx - 9, 5.6], [rx + 9, 5.6], [rx + 10, 4.6]], bailF, P), { tone: "mid" }));
  // right: shaft, end plate, collar, knob
  out.push(lathe([[166, 6], [174, 6]], { tone: "mid" }));
  out.push(endPlate(174));
  out.push(bail(178));
  out.push(lathe([[182, 9], [188, 9]], { tone: "mid" }));
  out.push(knob(188, 212));
  return out.join("");
}

function endPlate(x) {
  const plan = { x, y: -120, w: 8, d: 124, r: 2 };
  const out = [S(k.slabOf(plan, 104, 92, P, 3, 0.5), { tone: "mid" })];
  if (x > 0) {
    const fx = x + 8;
    out.push(D([[-108, 112], [-8, 112], [-108, 188], [-8, 188]].map(([y, z]) => at([fx, y, z])), { size: 0.5 }));
    const F = G.frameAlong([fx, PLATEN.y, PLATEN.z], X_AXIS);
    out.push(L(G.circleOf(F, 0, 12, P) + G.circleOf(F, 0, 7, P), { tone: "lo" }));
  }
  return out.join("");
}

function bail(x) {
  return S(barBetween([x, -2, 194], [x, 8, 216], 6, 4, [1, 0, 0]), { tone: "mid" });
}

function paperRect(top) {
  return `M${-PAPER_HALF} ${-top}H${PAPER_HALF}V${-(ZP - 16)}H${-PAPER_HALF}Z`;
}
function paper() {
  const top = PAPER_TOP0;
  return `<g transform="${planeY(PAPER_Y)}"><clipPath id="tw-paper-clip"><path data-part="paper-clip" d="${paperRect(top)}"/></clipPath><path class="tw-paper" data-part="sheet" d="${paperRect(top)}"/><g clip-path="url(#tw-paper-clip)"><g data-part="text"></g><text class="tw-fresh" data-part="fresh" font-size="${LS}"></text></g><path class="iso-line" data-tone="lo" data-part="sheet-edge" d="${paperRect(top)}"/></g>`;
}

// Return lever: drawn after the spools because it reaches out over them.
function returnLever() {
  const out = [];
  const hubF = G.frameAlong([-182, -10, 188], X_AXIS);
  out.push(S(G.solidOf([[-8, 9], [0, 9]], hubF, P), { tone: "mid" }));
  out.push(L(G.circleOf(hubF, -8, 3, P), { tone: "lo" }));
  out.push(S(barBetween([-187, -10, 188], [-208, 50, 202], 5, 4), { tone: "mid" }));
  out.push(S(barBetween([-206, 48, 202], [-236, 72, 205], 10, 2.4), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// ---------- Fixed front: bridges, ribbon, escapement, bell ----------

const SPOOL_R = [200, 36];
const SPOOL_L = [-200, 36];
const ROLL_R = 22;
const STAR = { x: 150, y: 13 };
const ROCKER = { x: 116, y: 12 };
const BELL = [-150, 50];

function bridges() {
  const out = [];
  for (const plan of [{ x: -246, y: 8, w: 110, d: 58, r: 4 }, { x: 136, y: 8, w: 110, d: 58, r: 4 }]) {
    out.push(S(k.slabOf(plan, DECK_Z[0], DECK_Z[1] - DECK_Z[0], P, 4, 0.6), { tone: "mid" }));
    out.push(D([[plan.x + 6, plan.y + plan.d - 6], [plan.x + plan.w - 6, plan.y + plan.d - 6], [plan.x + plan.w - 6, plan.y + 6]].map(([x, y]) => at([x, y, DECK_Z[1]])), { size: 0.45 }));
  }
  const cross = { x: -140, y: 8, w: 280, d: 6, r: 1 };
  out.push(S(k.slabOf(cross, DECK_Z[0], 6, P, 2, 0.4), { tone: "mid" }));
  // vibrator guides on the cross bar
  for (const sx of [-1, 1]) out.push(S(k.slabOf({ x: sx * 14 - 3, y: 5, w: 6, d: 3, r: 0.6 }, 94, 6, P, 2), { tone: "lo" }));
  // the column pointer
  out.push(S(k.slabOf({ x: -1.5, y: 9, w: 3, d: 3, r: 0.5 }, 102, 12.5, P, 2), { tone: "mid" }));
  out.push(S(k.extrude([[-1.6, 12], [1.6, 12], [1.6, -1], [0, -4.5], [-1.6, -1]], 113, 1.5, P), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function escapementStatic() {
  const out = [];
  // pinion on the rack
  out.push(S(k.cylinder(STAR.x, STAR.y, 13, DECK_Z[1], 6, P, 40), { tone: "mid" }));
  out.push(L(k.knurl(STAR.x, STAR.y, 13, DECK_Z[1], DECK_Z[1] + 6, STAR_TEETH * 2, P, 0.3), { tone: "lo" }));
  // rocker pivot post and the spring that brings the rocker back
  out.push(S(k.cylinder(ROCKER.x, ROCKER.y, 3.2, 102, 6, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(ROCKER.x + 24.5, ROCKER.y + 41, 2.4, DECK_Z[1], 8, P, 16), { tone: "mid" }));
  return out.join("");
}
function starWheel(angle) {
  const ring = [];
  const step = (Math.PI * 2) / STAR_TEETH;
  for (let i = 0; i < STAR_TEETH; i++) {
    const a = angle + i * step;
    ring.push([STAR.x + Math.cos(a) * 16, STAR.y + Math.sin(a) * 16]);
    ring.push([STAR.x + Math.cos(a + step * 0.22) * 12.2, STAR.y + Math.sin(a + step * 0.22) * 12.2]);
  }
  return S(k.extrude(ring, 110, 3, P, { convex: false }), { tone: "hi", crease: "lo" }) + S(k.cylinder(STAR.x, STAR.y, 4, 113, 2.6, P, 16), { tone: "mid" });
}
function rocker(psi) {
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  const rot = ([x, y]) => [ROCKER.x + x * c - y * s, ROCKER.y + x * s + y * c];
  // an arm toward the wheel ending in two dogs, one each side of the wheel's left rim
  const arm = [[-4, -3], [-4, 3], [15, 3], [15, -3]].map(rot);
  const dogs = [[15, -10], [17.5, -10], [17.5, 10], [15, 10], [12.5, 7.5], [12.5, -7.5]].map(rot);
  const tail = [[-3, 1], [3, 1], [22, 38], [18, 39]].map(rot);
  return [
    S(k.extrude(tail, 108, 2.4, P), { tone: "mid" }),
    S(k.extrude(arm, 110.4, 3, P), { tone: "mid" }),
    S(k.extrude(dogs, 110.4, 3, P), { tone: "hi", crease: "lo" }),
    S(k.cylinder(ROCKER.x, ROCKER.y, 2.2, 113.4, 1.4, P, 12), { tone: "mid" }),
  ].join("");
}
function tangentBack(c, r, e) {
  const dx = c[0] - e[0];
  const dy = c[1] - e[1];
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const alpha = Math.asin(r / d);
  const candidates = [base + alpha + Math.PI / 2, base - alpha - Math.PI / 2].map((a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  return candidates.sort((a, b) => a[1] - b[1])[0];
}
const EAR = 14;
const TAN_R = tangentBack(SPOOL_R, ROLL_R, [EAR, RIBBON_Y]);
const TAN_L = tangentBack(SPOOL_L, ROLL_R, [-EAR, RIBBON_Y]);
function ribbon(lift) {
  const mid = (RIB.z0 + RIB.z1) / 2;
  const quad = (a, b, za0, za1, zb0, zb1) => pathOf([at([a[0], a[1], za0]), at([b[0], b[1], zb0]), at([b[0], b[1], zb1]), at([a[0], a[1], za1])], true);
  const half = (a, b, la, lb) => {
    const top = quad(a, b, mid + la, RIB.z1 + la, mid + lb, RIB.z1 + lb);
    const low = quad(a, b, RIB.z0 + la, mid + la, RIB.z0 + lb, mid + lb);
    const seam = pathOf([at([a[0], a[1], mid + la]), at([b[0], b[1], mid + lb])]);
    return `<path class="tw-ink" d="${top}"/><path class="tw-ink2" d="${low}"/><path class="iso-line" data-tone="lo" d="${top}${low}"/><path class="iso-line" data-tone="faint" d="${seam}"/>`;
  };
  return [half(TAN_L, [-EAR, RIBBON_Y], 0, lift), half([-EAR, RIBBON_Y], [EAR, RIBBON_Y], lift, lift), half([EAR, RIBBON_Y], TAN_R, lift, 0)].join("");
}
function vibrator() {
  const out = [];
  for (const sx of [-1, 1]) {
    out.push(S(k.slabOf({ x: sx * EAR - 0.8, y: 6, w: 1.6, d: 2, r: 0.4 }, 92, RIB.z0 - 92, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf({ x: sx * EAR - 2, y: 2.4, w: 4, d: 3.6, r: 0.6 }, RIB.z0 - 3, RIB.z1 - RIB.z0 + 6, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

function spool([x, y]) {
  const out = [];
  out.push(S(k.cylinder(x, y, 4, DECK_Z[1], RIB.z0 - 2 - DECK_Z[1], P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 26, RIB.z0 - 2, 2, P, 56, 0.5), { tone: "mid" }));
  out.push(`<g class="tw-roll">${S(k.cylinder(x, y, ROLL_R, RIB.z0, RIB.z1 - RIB.z0, P, 56), { tone: "lo", inner: L(k.sideArc(x, y, ROLL_R, (RIB.z0 + RIB.z1) / 2, P, 40), { tone: "faint" }) })}</g>`);
  out.push(S(k.cylinder(x, y, 26, RIB.z1, 2, P, 56, 0.5), { tone: "mid" }));
  out.push(L([0, 1, 2, 3].map((i) => k.ring(x + Math.cos(i * 1.571 + 0.4) * 16, y + Math.sin(i * 1.571 + 0.4) * 16, 3.2, RIB.z1 + 2, P, 14)).join(""), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 6, RIB.z1 + 2, 4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 6, RIB.z1 + 2, RIB.z1 + 6, 16, P), { tone: "lo" }));
  out.push(D([at([x, y, RIB.z1 + 6])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

function bellStatic() {
  const [x, y] = BELL;
  const out = [];
  out.push(S(k.cylinder(x, y, 3, DECK_Z[1], 8, P, 16), { tone: "mid" }));
  const F = G.frameAlong([x, y, DECK_Z[1] + 8], [0, 0, 1]);
  const dome = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    dome.push([t * 13, 15 * Math.cos((t * Math.PI) / 2) + 0.01, i > 0 && i < 12 ? 1 : 0]);
  }
  out.push(S(G.lathe([[0, 0], [0, 15], ...dome.slice(1)], F, P), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x, y, 2, DECK_Z[1] + 21, 2.4, P, 12), { tone: "mid" }));
  // hammer post
  out.push(S(k.cylinder(x - 30, y + 2, 2.4, DECK_Z[1], 10, P, 12), { tone: "mid" }));
  return out.join("");
}
function hammer(swing) {
  const [x, y] = BELL;
  const tip = [x - 15.5 + 1.5 * (1 - swing), y + 1, DECK_Z[1] + 12];
  return S(barBetween([x - 30, y + 2, DECK_Z[1] + 12], tip, 2.2, 2), { tone: "mid" }) + S(k.cylinder(tip[0] - 1, tip[1], 2.6, tip[2] - 2.4, 4.8, P, 14), { tone: "hi", crease: "lo" });
}

// ---------- Basket ----------

function arcRing(r0, r1, a0, a1, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([r1 * Math.sin(a), PY + r1 * Math.cos(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([r0 * Math.sin(a), PY + r0 * Math.cos(a)]);
  }
  return pts;
}
const SEG_POSTS = [-70, 70].map((deg) => [RS * Math.sin((deg * Math.PI) / 180), PY + RS * Math.cos((deg * Math.PI) / 180), 82]);
const PAD_POSTS = [-50, 0, 50].map((deg) => [136 * Math.sin((deg * Math.PI) / 180), PY + 136 * Math.cos((deg * Math.PI) / 180), 68]);
const SLEEVE_TOP = 44;
function sleeves() {
  return [...SEG_POSTS, ...PAD_POSTS]
    .sort((a, b) => depth(a) - depth(b))
    .map(([x, y]) => S(k.cylinder(x, y, 6, BED_Z[1], SLEEVE_TOP - BED_Z[1], P, 24, 0.4), { tone: "mid" }))
    .join("");
}
function posts(drop) {
  return [...SEG_POSTS, ...PAD_POSTS]
    .sort((a, b) => depth(a) - depth(b))
    .map(([x, y, z]) => S(k.cylinder(x, y, 3, SLEEVE_TOP, z - drop - SLEEVE_TOP, P, 16), { tone: "mid", crease: "none" }))
    .join("");
}
function basket() {
  const out = [];
  // rest pad: a felt-lined arc the bars lie on
  out.push(S(k.extrude(arcRing(126, 146, -70, 70), 68, 5.5, P, { convex: false }), { tone: "lo" }));
  out.push(L(pathOf(arcRing(130, 142, -70, 70).slice(0, 41).map(([x, y]) => at([x, y, 73.5]))), { tone: "faint" }));
  // universal bar: every typebar's heel pushes it, and it rocks the escapement
  out.push(S(k.extrude(arcRing(48, 54, -60, 60), 72, 4, P, { convex: false }), { tone: "mid" }));
  // segment, with a slot per bar and the fulcrum wire
  out.push(S(k.extrude(arcRing(60, 80, -74, 74), 82, 12, P, { convex: false }), { tone: "mid", crease: "lo" }));
  out.push(L(BARS.map((b) => pathOf([at([60 * b.out[0], PY + 60 * b.out[1], 94]), at([80 * b.out[0], PY + 80 * b.out[1], 94])])).join(""), { tone: "faint" }));
  out.push(D([-74, 74].map((deg) => at([RS * Math.sin((deg * Math.PI) / 180), PY + RS * Math.cos((deg * Math.PI) / 180), 94])), { size: 0.6, tone: "hi" }));
  return out.join("");
}
const restOrder = [...BARS].sort((a, b) => depth(b.pivot.map((v, i) => v + b.out[i] * 60)) * -1 + depth(a.pivot.map((v, i) => v + a.out[i] * 60)));
function restBars() {
  return restOrder
    .map((bar) => {
      const { body, slug } = typebar(bar, PHI_REST, 0, P);
      return `<g data-bar="${bar.i}">${S(body, { tone: "mid", crease: "none" })}${S(slug, { tone: "hi", crease: "lo" })}</g>`;
    })
    .join("");
}

// ---------- Keyboard ----------

function keyLever(key, press) {
  const back = [key.x, COMB_Y, (LEVER_Z[0] + LEVER_Z[1]) / 2];
  const front = [key.x, key.y + 8, (LEVER_Z[0] + LEVER_Z[1]) / 2 - press];
  return S(barBetween(back, front, 3.2, LEVER_Z[1] - LEVER_Z[0]), { tone: "mid", crease: "none" });
}
function keyCap(key) {
  const out = [];
  const stemTop = key.top - 6;
  out.push(S(k.slabOf({ x: key.x - 1.6, y: key.y - 1.6, w: 3.2, d: 3.2, r: 0.6 }, LEVER_Z[1], stemTop - LEVER_Z[1], P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(key.x, key.y, 14, stemTop, 2.5, P, 40, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(key.x, key.y, 12.4, stemTop + 2.5, 3.5, P, 40, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(key.x, key.y, 10.2, key.top, P, 36), { tone: "faint" }));
  const size = key.label.length > 1 ? 7 : 9;
  out.push(k.faceTextSvg(k.topMatrix([key.x, key.y + 3], key.top, P, "x"), key.label, { size, tone: "hi", anchor: "middle" }));
  return out.join("");
}
function keyboard() {
  const out = [];
  // the comb that guides the levers
  const comb = { x: -222, y: COMB_Y - 8, w: 444, d: 8, r: 1.2 };
  out.push(S(k.slabOf(comb, BED_Z[1], 32, P, 2, 0.4), { tone: "mid" }));
  out.push(D([comb.x + 6, comb.x + comb.w - 6].map((x) => at([x, comb.y + 4, BED_Z[1] + 32])), { size: 0.45 }));
  // felt strip the levers return onto
  out.push(S(k.slabOf({ x: -222, y: 312, w: 444, d: 8, r: 1 }, BED_Z[1], 3, P, 2), { tone: "lo" }));
  const levers = KEYS.map((key, index) => ({ key, index })).sort((a, b) => depth([a.key.x, a.key.y, 0]) - depth([b.key.x, b.key.y, 0]));
  for (const { key, index } of levers) out.push(`<g data-lever="${index}">${keyLever(key, 0)}</g>`);
  // spacebar posts and bar
  for (const x of [-100, 110]) out.push(S(k.cylinder(x, 333, 2.6, BED_Z[1], 22, P, 14), { tone: "mid", crease: "none" }));
  out.push(`<g data-part="space">${S(k.slabOf({ x: -124, y: 326, w: 256, d: 14, r: 7 }, 46, 8, P, 6, 0.6), { tone: "hi", crease: "lo" })}</g>`);
  const caps = KEYS.map((key, index) => ({ key, index })).sort((a, b) => depth([a.key.x, a.key.y, 0]) - depth([b.key.x, b.key.y, 0]));
  for (const { key, index } of caps) out.push(`<g class="tw-key" data-key="${index}">${keyCap(key)}</g>`);
  return out.join("");
}

// ---------- Assemble ----------

const X0 = xOfCol(0);
const tr = (by) => k.translateAlong(P, by);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Uma máquina de escrever portátil sobre uma bancada. Ao apertar uma tecla, a alavanca ergue uma das quarenta hastes da cesta, que bate na fita contra o papel enrolado no rolo; quando a tecla sobe, o escape solta o carro, que a mola puxa um espaço de 2,54 mm para a esquerda.",
  body: [
    bench(),
    bed(),
    sideFrame(-246),
    rearDeck(),
    `<path class="tw-band" data-part="band" d="${bandPath(X0)}"/>`,
    sideFrame(234),
    `<g data-part="carriage" transform="${tr([X0, 0, 0])}">${carriage()}</g>`,
    bridges(),
    escapementStatic(),
    `<g data-part="star">${starWheel(0)}</g>`,
    `<g data-part="rocker">${rocker(0)}</g>`,
    `<g data-part="ribbon">${ribbon(0)}</g>`,
    `<g data-part="vibrator">${vibrator()}</g>`,
    spool(SPOOL_L),
    spool(SPOOL_R),
    bellStatic(),
    `<g data-part="hammer">${hammer(0)}</g>`,
    `<g data-part="lever" transform="${tr([X0, 0, 0])}">${returnLever()}</g>`,
    sleeves(),
    `<g data-part="posts">${posts(0)}</g>`,
    `<g data-part="basket">${basket()}${restBars()}<g data-part="flying"></g></g>`,
    keyboard(),
  ],
});

import { readFileSync } from "node:fs";
const LIVE = readFileSync(join(HERE, "live.js"), "utf8");
const PHRASES = ["A tecla ergue a haste,", "o tipo bate na fita", "e o carro anda 2,54 mm."];

const live = `
const P = ${JSON.stringify(P)};
const PITCH = ${PITCH}, LS = ${LS}, COLS = ${COLS}, BELL_AT = ${BELL_AT}, LM = ${LM}, ZP = ${ZP}, PY = ${PY};
const LB = ${LB}, PHI_REST = ${PHI_REST}, PHI_HIT = ${PHI_HIT}, SHIFT = ${SHIFT}, STAR_TEETH = ${STAR_TEETH};
const PAPER_TOP0 = ${PAPER_TOP0}, PAPER_HALF = ${PAPER_HALF}, TRAVEL = ${TRAVEL};
const BARS = ${JSON.stringify(BARS)};
const KEYS = ${JSON.stringify(KEYS)};
const PHRASES = ${JSON.stringify(PHRASES)};
const RIB = ${JSON.stringify(RIB)}, RIBBON_Y = ${RIBBON_Y}, EAR = ${EAR}, TAN_R = ${JSON.stringify(TAN_R)}, TAN_L = ${JSON.stringify(TAN_L)};
const STAR = ${JSON.stringify(STAR)}, ROCKER = ${JSON.stringify(ROCKER)}, BELL = ${JSON.stringify(BELL)};
const DECK_Z = ${JSON.stringify(DECK_Z)}, LEVER_Z = ${JSON.stringify(LEVER_Z)}, COMB_Y = ${COMB_Y}, SLEEVE_TOP = ${SLEEVE_TOP};
const SEG_POSTS = ${JSON.stringify(SEG_POSTS)}, PAD_POSTS = ${JSON.stringify(PAD_POSTS)};
const DRUM = ${JSON.stringify(DRUM)}, BAND_Y = ${BAND_Y}, HOOK_X = ${HOOK_X};
const at = (p) => iso(p, P);
const S = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const depth = (p) => depthOf(p, P);
${twHull.toString()}
${twPrism.toString()}
const unit = ${unit.toString()};
const rect = ${rect.toString()};
${barBetween.toString()}
${typebar.toString()}
${starWheel.toString()}
${rocker.toString()}
${ribbon.toString()}
${hammer.toString()}
${posts.toString()}
${keyLever.toString()}
${paperRect.toString()}
const bandPath = ${bandPath.toString()};
const xOfCol = ${xOfCol.toString()};
` + LIVE;


const css = `<style>
.iso{--tw-paper:#ffffff;--tw-ink:#2b2b30;--tw-ink2:#6d6d73;--tw-type:#1f1f24;--tw-fresh:#000}
.iso[data-theme="dark"]{--tw-paper:#2a2a2a;--tw-ink:#060606;--tw-ink2:#1e1e1e;--tw-type:#cfcfcf;--tw-fresh:#ffffff}
.tw-paper{fill:var(--tw-paper)}
.tw-badge{fill:var(--anatomy-shade-1)}
.tw-ink{fill:var(--tw-ink)}
.tw-ink2{fill:var(--tw-ink2)}
.tw-band{fill:var(--anatomy-shade-2);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.tw-roll .iso-fill,.tw-roll .iso-shade,.tw-roll .iso-top{fill:var(--tw-ink)}
.tw-type{fill:var(--tw-type);font-family:"Courier New",Courier,monospace;font-weight:600}
.tw-fresh{fill:var(--tw-fresh);font-family:"Courier New",Courier,monospace;font-weight:700}
.tw-key{cursor:pointer}
.tw-key[data-down] .iso-edge{stroke:var(--anatomy-lit)}
[data-part="lever"]{cursor:pointer}
.tw-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.iso-stage{touch-action:pan-y}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 1",
    title: "Máquina de escrever",
    hint: "Escreva nela · Enter devolve o carro",
    readout: "col 0 · 0,0 mm · linha 1",
    keys: [
      { mark: "lit", label: "A haste em voo e a letra que acaba de bater no papel" },
      { mark: "raised", label: "Quarenta hastes num meio-anel, todas apontadas ao mesmo ponto" },
      { mark: "edge", label: "O carro: rolo, papel e cremalheira, que só se move um dente de cada vez" },
    ],
    caption:
      "Cada tecla é uma alavanca. Ao descer, puxa uma haste da cesta, que roda no seu entalhe do segmento e atira o tipo contra a fita; a fita sobe nesse instante e a letra fica impressa no papel enrolado no rolo. Todas as hastes apontam ao mesmo ponto de impressão: quem se move é o carro. Quando a tecla sobe, o escape deixa a roda-estrela avançar um dente e a mola do tambor puxa o carro 2,54 mm para a esquerda (dez letras por polegada). Shift baixa o segmento 3,5 mm para que bata a metade de cima do tipo, a maiúscula. Com Enter, a alavanca roda o rolo 4,23 mm (seis linhas por polegada) e empurra o carro de volta à margem; seis espaços antes do fim, o sino toca. A batida está desacelerada para dar para acompanhar.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Máquina de escrever. Escreva para imprimir no papel; Enter devolve o carro, Backspace recua um espaço.">${svg}<span class="tw-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const name = theme === "light" ? "maquina-de-escrever-light.html" : "maquina-de-escrever.html";
const html = k.pageHtml({ title: "Máquina de escrever", theme, body, script: kitScript() + live }).replace('<html lang="en">', '<html lang="pt">');
writeFileSync(join(HERE, name), html);
console.log("wrote", name, (html.length / 1024).toFixed(0) + " KB");
