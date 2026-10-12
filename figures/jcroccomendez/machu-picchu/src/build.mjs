import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as M from "./model.mjs";
import { GEO, makeParts } from "./parts.mjs";
import { rampFigure } from "./ramp.mjs";
import { TEXT, fmt, num } from "./text.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 470; // the model is about as tall as it is wide, so the canvas is too
const HEIGHT = 390;
const { XL, XC, TERRACE, WALL, C1, C2, BLOCK, SEAT, POLE } = GEO;

const PLATE = { x: -68, y: -80, w: 206, d: 162, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const LOWER = 14; // top of the lower terrace's soil
const BATTER = 6 / 56; // the terrace wall leans back 6 units over its height
const yFront = (z) => 26 - (z - 6) * BATTER;
const COURSES = Array.from({ length: 8 }, (_, i) => [6 + i * 7, 13 + i * 7]);
const DRAIN = { x0: 95, x1: 102, z0: 20, z1: 27 };
const LAYERS = [
  { name: "rubble", z: [6, 30] },
  { name: "gravel", z: [30, 44] },
  { name: "sand", z: [44, 52] },
  { name: "soil", z: [52, 62] },
];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [XL, WALL.back, C2[1] + 2], [XC, WALL.back, C1[1]], [POLE.x, 40, 90], [XC, 60, LOWER]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 40 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const poly = (points) => k.pathOf(points.map(at), true);
const onCut = (y, z) => [XC, y, z];
const depth = (p) => k.depthOf(p, P);
let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const parts = makeParts(k, G, P);
let solids = 0;
const count = (svg) => {
  solids += (svg.match(/class="iso-solid/g) || []).length;
  return svg;
};

// A prism along x whose section (y, z) is given: used for the leaning terrace-wall stones.
const alongX = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const prismX = (section, x0, x1) => G.prismOf(alongX, section, x0, x1, P);

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 22).sort((a, b) => depth([...a, 0]) - depth([...b, 0]));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler: 10 cm minor, 1 m major (1 unit = 3 cm).
  const strip = { x: -56, y: PLATE.y + PLATE.d - 14, w: 182, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + 4 + 500 / 3, 10 / 3, 10, strip.y, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // Label plate on the right margin.
  const label = { x: XC + 6, y: 6, w: 9, d: 44, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 22], 0.8, P, "y"), "c.1450", { size: 3.2, tone: "lo", anchor: "middle" }));
  out.push(D([at([label.x + 4.5, label.y + 3.4, 0.8]), at([label.x + 4.5, label.y + label.d - 3.4, 0.8])], { size: 0.4 }));
  return out.join("");
}

// The granite ridge itself.
function bedrock() {
  const out = [S(k.slabOf({ x: XL, y: -72, w: XC - XL, d: 132, r: 0.6 }, 0, 6, P, 2), { tone: "lo" })];
  // Joints in the granite, edge to edge on the cut.
  const cracks = [[-60, -54], [-24, -30], [14, 20], [46, 40]].map(([a, b]) => k.segment(onCut(a, 6), onCut(b, 0), P)).join("");
  out.push(L(cracks, { tone: "faint" }));
  return out.join("");
}

// One fill layer between y0 and y1, and its texture on the cut face.
function layer(name, [z0, z1], y0, y1) {
  const out = [S(k.slabOf({ x: XL, y: y0, w: XC - XL, d: y1 - y0, r: 0.4 }, z0, z1 - z0, P, 2), { tone: "lo", crease: name === "soil" ? "faint" : "none" })];
  if (name === "soil") out.push(`<path class="mp-soil" d="${poly([onCut(y0, z0), onCut(y1, z0), onCut(y1, z1), onCut(y0, z1)])}"/>`);
  const dots = [];
  if (name === "rubble") {
    // Big angular stones, packed: the free-draining base.
    const stones = [];
    let row = 0;
    for (let z = z0 + 0.5; z < z1 - 2.5; row++) {
      const h = Math.min(4.4 + rnd() * 2.6, z1 - 0.5 - z);
      let y = y0 + 0.5 - (row % 2) * 3;
      while (y < y1 - 2.5) {
        const w = 5 + rnd() * 4;
        const ya = Math.max(y0 + 0.5, y), yb = Math.min(y1 - 0.5, y + w);
        if (yb - ya > 2.4) {
          const cy = (ya + yb) / 2, cz = z + h / 2, hw = (yb - ya) / 2, hh = h / 2;
          const n = 5 + Math.floor(rnd() * 2);
          const ring = Array.from({ length: n }, (_, i) => {
            const a = ((i + rnd() * 0.6) / n) * Math.PI * 2;
            const c = Math.cos(a), sn = Math.sin(a);
            const f = 1 / Math.max(Math.abs(c), Math.abs(sn));
            const m = 0.82 + rnd() * 0.18;
            return onCut(cy + c * f * hw * m, cz + sn * f * hh * m);
          });
          stones.push(poly(ring));
        }
        y += w + 0.6;
      }
      z += h + 0.6;
    }
    out.push(`<path class="mp-stone" d="${stones.join("")}"/>`);
  }
  const grain = { gravel: [2.6, 0.42, "lo"], sand: [1.5, 0.24, "lo"], soil: [2.2, 0.3, "faint"] }[name];
  if (grain) {
    const [gap, size, tone] = grain;
    for (let z = z0 + gap / 2; z < z1 - 0.3; z += gap) for (let y = y0 + gap / 2; y < y1 - 0.3; y += gap) dots.push(at(onCut(y + (rnd() - 0.5) * gap * 0.6, z + (rnd() - 0.5) * gap * 0.5)));
    out.push(D(dots, { size, tone }));
  }
  return out.join("");
}

// The alternative a careless builder might use: the same terrace filled with clay to the sand.
function clay() {
  const [z0, z1] = [6, 44];
  const out = [S(k.slabOf({ x: XL, y: -72, w: XC - XL, d: 72, r: 0.4 }, z0, z1 - z0, P, 2), { tone: "lo", crease: "none" })];
  out.push(`<path class="mp-clay" d="${poly([onCut(-72, z0), onCut(0, z0), onCut(0, z1), onCut(-72, z1)])}"/>`);
  const dots = [];
  for (let z = z0 + 1; z < z1 - 0.4; z += 1.6) for (let y = -71.2; y < -0.4; y += 1.6) dots.push(at(onCut(y + (rnd() - 0.5) * 0.9, z + (rnd() - 0.5) * 0.7)));
  out.push(D(dots, { size: 0.22, tone: "lo" }));
  return out.join("");
}

// Foundation of the temple wall: big stones bedded down to the rubble, a plinth proud of the face.
function foundation() {
  const out = [];
  const joints = [XL, -8, 52, XC];
  for (let i = 0; i < joints.length - 1; i++) out.push(S(k.slabOf({ x: joints[i] + 0.2, y: WALL.back - 2, w: joints[i + 1] - joints[i] - 0.4, d: WALL.front + 5 - WALL.back, r: 0.8 }, 44, TERRACE - 44, P, 2, 0.5), { tone: "mid" }));
  return out.join("");
}

// The terrace wall: rough fieldstone in eight courses, leaning back, with a drain through it.
function rowOf(a, b, least, most) {
  const out = [];
  let x = a;
  while (x < b - 0.01) {
    let w = least + rnd() * (most - least);
    if (b - (x + w) < least * 0.7) w = b - x;
    out.push([x, x + w]);
    x += w;
  }
  return out;
}

function terraceWall() {
  const out = [];
  COURSES.forEach(([z0, z1], ci) => {
    out.push(`<g data-course="${(z0 + z1) / 2}">`);
    const yf0 = yFront(z0);
    const stone = (a, b) => {
      const p = (rnd() - 0.5) * 0.9;
      const sec = [[0, z0 + 0.15], [yf0 + p - 0.3, z0 + 0.15], [yf0 + p, z0 + 0.8], [yFront(z1) + p, z1 - 0.7], [yFront(z1) + p - 0.6, z1], [0, z1]];
      return S(prismX(sec, a + 0.15, b >= XC ? XC : b - 0.15), { tone: "mid", crease: "lo" });
    };
    const start = XL + (((ci * 5) % 9) - 4) * 0.8;
    let rows;
    if (z0 === DRAIN.z0) rows = [...rowOf(start, DRAIN.x0, 8, 15), ...rowOf(DRAIN.x1, XC, 8, 15)];
    else if (z0 === DRAIN.z1) rows = [...rowOf(start, DRAIN.x0 - 5, 8, 15), [DRAIN.x0 - 5, DRAIN.x1 + 5], ...rowOf(DRAIN.x1 + 5, XC, 8, 15)];
    else rows = rowOf(start, XC, 8, 15);
    for (const [a, b] of rows) {
      if (z0 === DRAIN.z0 && a === DRAIN.x1) {
        // The duct is dark inside: its far jamb and its floor, seen through the opening.
        const { x0, x1, z0: d0, z1: d1 } = DRAIN;
        out.push(`<path class="mp-void" d="${poly([[x0, 0, d0], [x0, yFront(d0), d0], [x0, yFront(d1), d1], [x0, 0, d1]])}${poly([[x0, 0, d0], [x1, 0, d0], [x1, yFront(d0), d0], [x0, yFront(d0), d0]])}"/>`);
        out.push(L(k.pathOf([[x0, yFront(d1), d1], [x0, yFront(d0), d0], [x1, yFront(d0), d0]].map(at)), { tone: "lo" }));
      }
      out.push(stone(Math.max(XL, a), Math.min(XC, b)));
    }
    out.push("</g>");
  });
  // Runoff that spills over the top once the fill is full: down the leaning face, under the lower soil.
  const spill = [-36, -4, 30, 64].map((x) => k.pathOf([[x, yFront(TERRACE) + 0.3, TERRACE], [x, yFront(LOWER - 2) + 0.3, LOWER - 2]].map(at))).join("");
  out.push(`<g data-part="spill" opacity="0">${L(spill, { tone: "mid", flow: true, className: "mp-water" })}</g>`);
  return out.join("");
}

// Percolation on the cut: rain soaks down through soil, sand and gravel into the rubble and runs out to the wall.
function seepage() {
  const lines = [-21, -13, -5].map((y, i) => {
    const pts = [];
    for (let z = TERRACE; z >= 16 + i * 3; z -= 2) pts.push(onCut(y + Math.sin(z * 0.45 + i) * 0.9, z));
    const zEnd = 16 + i * 3;
    for (let j = 1; j <= 8; j++) {
      const t = j / 8;
      pts.push(onCut(y + (0 - y) * t, zEnd - 4 * Math.sin(t * Math.PI * 0.5) - i * 1.2 * t));
    }
    return k.pathOf(pts.map(at));
  });
  return lines.map((d) => L(d, { tone: "mid", flow: true, className: "mp-water" })).join("");
}

// The lower terrace in front: soil, a stone-lined channel, the drain spout and its water.
function lowerTerrace() {
  const out = [S(k.slabOf({ x: XL, y: 25.2, w: XC - XL, d: 34.8, r: 0.4 }, 6, LOWER - 6, P, 2), { tone: "lo" })];
  const dots = [];
  for (let z = 7; z < LOWER - 0.3; z += 2.2) for (let y = 26.5; y < 59.6; y += 2.2) dots.push(at(onCut(y + (rnd() - 0.5) * 1.3, z + (rnd() - 0.5) * 1)));
  out.push(`<path class="mp-soil" d="${poly([onCut(25.2, 6), onCut(60, 6), onCut(60, LOWER), onCut(25.2, LOWER)])}"/>`);
  out.push(D(dots, { size: 0.3, tone: "faint" }));
  // Furrows on the lower terrace, end to end.
  out.push(L([48, 54].map((y) => k.lineOnTop([XL, y], [XC, y], LOWER, P)).join(""), { tone: "faint" }));
  return out.join("");
}

function channel() {
  const out = [];
  // Water first, then the near curb over it.
  out.push(curbRow(29, 32));
  out.push(`<path class="mp-pool" d="${poly([[XL, 32, LOWER + 0.4], [XC, 32, LOWER + 0.4], [XC, 41, LOWER + 0.4], [XL, 41, LOWER + 0.4]])}"/>`);
  out.push(`<g data-part="outflow">${L([34, 36.5, 39].map((y) => k.lineOnTop([XC, y], [XL, y], LOWER + 0.45, P)).join(""), { tone: "mid", flow: true, className: "mp-water" })}</g>`);
  out.push(curbRow(41, 44));
  return out.join("");
}

function curbRow(y0, y1) {
  const out = [];
  let x = XL;
  while (x < XC - 0.1) {
    let w = 10 + rnd() * 8;
    if (XC - (x + w) < 6) w = XC - x;
    out.push(S(k.slabOf({ x: x + 0.15, y: y0, w: w - 0.3, d: y1 - y0, r: 0.8 }, LOWER, 2.2, P, 2, 0.4), { tone: "mid" }));
    x += w;
  }
  return out.join("");
}

function spout() {
  const out = [];
  const cx = (DRAIN.x0 + DRAIN.x1) / 2;
  const y0 = yFront(DRAIN.z0 + 2) - 0.2;
  const plan = { x: DRAIN.x0 + 0.2, y: y0, w: DRAIN.x1 - DRAIN.x0 - 0.4, d: 36.5 - y0, r: 0.8 };
  out.push(S(k.slabOf(plan, DRAIN.z0 - 1, 3, P, 2, 0.4), { tone: "mid", crease: "lo" }));
  // Water: along the spout's groove, off its lip, down into the channel.
  const path = [[cx, y0, DRAIN.z0 + 2.05], [cx, 36.5, DRAIN.z0 + 2.05], [cx, 36.5, LOWER + 0.45]].map(at);
  out.push(`<g data-part="outflow">${L(k.pathOf(path), { tone: "mid", flow: true, className: "mp-water" })}</g>`);
  return `<g data-course="${DRAIN.z0 + 1.5}">${out.join("")}</g>`;
}

// The temple wall: fine coursed ashlar, laid dry.
const phaseOf = (i, level) => (i * 0.37 + level) % 1;
function course(z0, z1, joints, yf, { niche, level = 1 } = {}) {
  const out = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const plan = { x: joints[i] + 0.12, y: WALL.back, w: joints[i + 1] - joints[i] - 0.24, d: yf - WALL.back, r: 1.1 };
    let inner = "";
    if (niche && joints[i] < niche && niche < joints[i + 1]) {
      // A trapezoidal niche, narrower at the top, the Inca signature.
      const q = (x, z, y = yf) => at([x, y, z]);
      const rim = [q(niche - 6, z0 + 2.5), q(niche + 6, z0 + 2.5), q(niche + 4.4, z1 - 2.5), q(niche - 4.4, z1 - 2.5)];
      const back = [q(niche - 6, z0 + 2.5, yf - 5), q(niche + 6, z0 + 2.5, yf - 5), q(niche + 4.4, z1 - 2.5, yf - 5), q(niche - 4.4, z1 - 2.5, yf - 5)];
      // Everything inside is clipped to the opening, so the recess lines end on its rim.
      inner =
        `<clipPath id="niche"><path d="${k.pathOf(rim, true)}"/></clipPath><g clip-path="url(#niche)">` +
        `<path class="mp-void" d="${k.pathOf(rim, true)}"/>` +
        `<path class="iso-shade" data-shade="1" d="${k.pathOf([rim[0], back[0], back[3], rim[3]], true)}"/>` +
        `<path class="iso-top" d="${k.pathOf([rim[0], rim[1], back[1], back[0]], true)}"/>` +
        L(k.pathOf([rim[0], back[0], back[1]]) + k.pathOf([back[0], back[3]]), { tone: "faint" }) +
        `</g>` +
        L(k.pathOf(rim, true), { tone: "lo" });
    }
    // Each block is its own group so it can slip against its neighbours in an earthquake.
    out.push(`<g data-quake="${level}" data-phase="${phaseOf(i, level)}">${S(k.slabOf(plan, z0 + 0.1, z1 - z0 - 0.2, P, 4, 0.9), { tone: "mid", crease: "lo", inner })}</g>`);
  }
  return out.join("");
}

// Cracks a mortared wall would take in a strong quake: stepping through joints and blocks from
// the top edge of the wall to its foot, drawn on the front faces.
function cracks() {
  const f1 = WALL.front, f2 = WALL.front - 1;
  // Clear of the niche, so no crack runs across an opening.
  const left = [[-12, f2, C2[1]], [-14.5, f2, 91], [-11.8, f2, 86.5], [-15.5, f2, C2[0]], [-15.5, f1, C2[0]], [-18.5, f1, 75], [-16, f1, 69.5], [-20, f1, C1[0] + 0.1]];
  const right = [[63, f1, C1[1]], [60.5, f1, 75.5], [64.5, f1, 70], [61.5, f1, C1[0] + 0.1]];
  const branch = [[-14.5, f2, 91], [-8, f2, 88.5], [-4.5, f2, C2[0]]];
  return L([left, right, branch].map((line) => k.pathOf(line.map(at))).join(""), { tone: "hi", className: "mp-crack" });
}

// Spare stone waiting its turn, with its own bosses for ropes and levers.
function spare() {
  const out = [];
  const plan = GEO.SPARE;
  out.push(S(k.slabOf(plan, TERRACE, plan.h, P, 4, 0.9), { tone: "mid", crease: "lo" }));
  for (const x of [-41, -32]) out.push(S(k.slabOf({ x, y: plan.y + plan.d - 0.3, w: 4, d: 3.2, r: 0.7 }, TERRACE + 5, 3.4, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}

// Hammerstones: river cobbles tougher than the granite, graded from roughing to finishing.
function hammerstones() {
  const stones = [[-14, -14, 4.2], [-5, -8, 3.2], [3, -15, 2.4]].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  return stones.map(([x, y, r]) => `<path class="iso-halo" d="${k.cylinder(x, y, r * 0.9, TERRACE, 0.1, P, 20).fill}" style="filter:blur(2px)"/>` + S(G.sphereOf([x, y, TERRACE + r * 0.92], r, P), { tone: "mid" })).join("");
}

// A crib of logs, the lever's fulcrum. How the Inca lifted blocks is not recorded: this is a reconstruction.
function crib() {
  const out = [];
  const r = 2.775;
  const x = POLE.x;
  const y = POLE.pivot[0];
  const log = (from, to) => {
    const F = G.frameAlong(from, G.sub3(to, from));
    const len = G.len3(G.sub3(to, from));
    return S(G.disc(0, len, r, F, P), { tone: "mid", inner: L(G.arcOf(F, len - 2.5, r, P), { tone: "faint" }) });
  };
  const z = (n) => TERRACE + r * (2 * n + 1);
  const layers = [
    [[[x - 6, y - 8.5, z(0)], [x - 6, y + 8.5, z(0)]], [[x + 6, y - 8.5, z(0)], [x + 6, y + 8.5, z(0)]]],
    [[[x - 9, y - 6, z(1)], [x + 9, y - 6, z(1)]], [[x - 9, y + 6, z(1)], [x + 9, y + 6, z(1)]]],
    [[[x - 6, y - 8.5, z(2)], [x - 6, y + 8.5, z(2)]], [[x + 6, y - 8.5, z(2)], [x + 6, y + 8.5, z(2)]]],
    [[[x - 9, y, z(3)], [x + 9, y, z(3)]]],
  ];
  out.push(`<path class="iso-halo" d="${k.slabOf({ x: x - 9, y: y - 8.5, w: 18, d: 17, r: 3 }, TERRACE, 0.1, P).fill}" style="filter:blur(3px)"/>`);
  for (const pairs of layers) {
    const sorted = [...pairs].sort((a, b) => depth(G.lerp3(a[0], a[1], 0.5)) - depth(G.lerp3(b[0], b[1], 0.5)));
    for (const [a, b] of sorted) out.push(log(a, b));
  }
  return out.join("");
}

const C1_JOINTS = [XL, -18, SEAT.x0, SEAT.x1, 86, XC];
const C2_JOINTS = [XL, -30, BLOCK.x0];
const s0 = M.stateAt(0.45);
const s0z = M.raiseOf(s0.gap, s0.rest, s0.lift);
const C1_LEVEL = 0.55;

// Each part the side panel explains is wrapped in a data-section group; one section can own several groups.
const sec = (id, html) => `<g data-section="${id}">${html}</g>`;

const body = [
  `<g data-part="table">`,
  plate(),
  sec(6, bedrock()),
  sec(6, `<g data-part="drained">${layer("rubble", LAYERS[0].z, -72, 0)}${layer("gravel", LAYERS[1].z, -72, 0)}</g><g data-part="clay" style="display:none">${clay()}</g>`),
  sec(6, LAYERS.slice(2).map((l) => layer(l.name, l.z, -72, WALL.back - 2)).join("")),
  sec("1 8", foundation()),
  sec(6, LAYERS.slice(2).map((l) => layer(l.name, l.z, WALL.front + 3, 0)).join("")),
  sec(6, `<g data-part="seep">${seepage()}</g><path data-part="wet" class="mp-wet" d=""/><path data-part="table-line" class="iso-line mp-table" d=""/>`),
  sec(5, terraceWall()),
  sec(6, `<path data-part="puddle" class="mp-puddle" opacity="0" d="${poly([[XL + 1, WALL.front + 4, TERRACE + 0.05], [XC - 1, WALL.front + 4, TERRACE + 0.05], [XC - 1, yFront(TERRACE) - 1.2, TERRACE + 0.05], [XL + 1, yFront(TERRACE) - 1.2, TERRACE + 0.05]])}"/>`),
  sec(7, lowerTerrace() + channel() + spout()),
  sec("1 8", course(C1[0], C1[1], C1_JOINTS, WALL.front, { niche: -34, level: C1_LEVEL })),
  // The seat cut into the top of the stone below the block; it rides the quake with that stone.
  sec("2 1 8", `<g data-quake="${C1_LEVEL}" data-phase="${phaseOf(C1_JOINTS.indexOf(SEAT.x0), C1_LEVEL)}"><g data-part="seat">${parts.seat(M.visOf(s0.gap))}</g></g>`),
  sec(2, `<g data-part="marks" opacity="0">${parts.marks(s0.contact, M.visOf(s0.gap))}</g><g data-part="hammer" opacity="0">${S(G.sphereOf([0, BLOCK.y1 - 1, C2[0] + 1.9], 1.9, P), { tone: "mid" })}</g><g data-part="dust"></g>`),
  sec("1 8", course(C2[0], C2[1], C2_JOINTS, WALL.front - 1)),
  sec(2, `<g data-quake="1" data-phase="0.8"><g data-part="block" transform="${k.translateAlong(P, [0, 0, s0z])}">${parts.block()}</g></g>`),
  sec(8, `<g data-part="cracks" opacity="0">${cracks()}</g>`),
  // The spare stone slides when its rope is hauled; the rope is redrawn as it is pulled.
  sec("4 3", `<g data-part="spare">${spare()}</g><g data-part="rope">${parts.rope(0, null, M.ROPE_L)}</g>`),
  sec(3, hammerstones()),
  sec(2, crib() + `<g data-part="pole">${parts.pole(s0z)}</g>`),
  // The lifting boss sits in front of the pole tip: its lower edge must stay visible at the contact.
  // It shares the block's fitting and quake transforms, but is painted after the pole.
  sec(2, `<g data-quake="1" data-phase="0.8"><g data-part="nub" transform="${k.translateAlong(P, [0, 0, s0z])}">${parts.nub()}</g></g>`),
  `</g>`,
  `<g data-part="rain" aria-hidden="true"><path class="mp-rain" d=""/><path class="mp-splash" d=""/></g>`,
].map(count);

const EN = TEXT.en;
const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: EN.figure, body });

const NOTE = { tonnes: M.BLOCK_KG / 1000, exag: M.EXAG, dry: M.THRUST_DRY, sat: M.THRUST_SAT, sim: M.SIM_HOURS_PER_S, quake: M.QUAKE.exag, mu: M.MU_DRAG, pull: M.PULL_N / 1000 };
const DATA = { P, LOWER, BATTER, HEIGHT, COURSE_TOP: TERRACE, WALL_BASE: 6, FIRST: 2, NOTE };
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const latheSource = readFileSync(join(HERE, "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const lathe = `const GG = (() => {${latheSource}\nreturn { frameOf, prismOf, frameAlong, arcOf, disc, pointOf, sphereOf, add3, sub3, mul3, len3, lerp3 };})();\n`;
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const css = readFileSync(join(HERE, "machu.css"), "utf8");
const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pad = (n) => String(n).padStart(2, "0");

// The page is written in English; text.mjs holds the Spanish, and the page swaps every
// [data-i18n] element's text (and [data-i18n-label] aria-label) when the reader picks a language.
const noteOf = (lang) => {
  const T = TEXT[lang];
  return `${T.stats.join(" · ")}. ${fmt(T.note, { tonnes: num(lang, NOTE.tonnes, 1), exag: NOTE.exag, dry: num(lang, NOTE.dry, 1), sat: num(lang, NOTE.sat, 1), sim: NOTE.sim })} ${fmt(T.quakeNote, { exag: NOTE.quake })} ${fmt(T.haulNote, { mu: num(lang, NOTE.mu, 1), pull: num(lang, NOTE.pull, 1) })} ${T.sources}`;
};
const firstSub = fmt(EN.pass, { pass: s0.pass + 1, passes: M.PASSES, verb: EN.verbs[s0.phase], gap: num("en", s0.gap, 1), contact: Math.round(s0.contact * 100) });
// The controls and the live readout share a strip at the foot of the drawing, like an instrument's
// deck: knobs on the left, dial on the right.
const segs = Array.from({ length: 4 }, () => `<div class="mp-seg" data-seg><i><b></b></i><span></span></div>`).join("");
const readout =
  `<div class="mp-readout" aria-live="polite"><p class="mp-label" data-i18n="readout">${esc(EN.readout)}</p>` +
  `<p class="mp-big"><span data-big>${num("en", M.GAP0_MM, 1)}</span><span class="mp-unit" data-unit>${esc(EN.gapUnit)}</span></p>` +
  `<p class="mp-sub" data-sub>${esc(firstSub)}</p><div class="mp-bar">${segs}</div></div>`;
const deck =
  `<div class="mp-deck"><p class="mp-hint" data-i18n="hint">${esc(EN.hint)}</p><div class="mp-knobs"><span class="mp-pair"><span class="mp-label" data-i18n="rain">${esc(EN.rain)}</span>` +
  `<div class="mp-group" role="group" aria-label="${esc(EN.rainGroup)}" data-i18n-label="rainGroup">${M.RAINS.map((r, i) => (r.mmh ? `<button type="button" data-rain="${i}" aria-pressed="${i === 1}">${r.mmh} mm/h</button>` : `<button type="button" data-rain="${i}" aria-pressed="false" data-i18n="dry">${esc(EN.dry)}</button>`)).join("")}</div></span>` +
  `<span class="mp-pair"><span class="mp-label" data-i18n="fill">${esc(EN.fill)}</span><div class="mp-group" role="group" aria-label="${esc(EN.fillGroup)}" data-i18n-label="fillGroup"><button type="button" data-fill="drained" aria-pressed="true" data-i18n="inca">${esc(EN.inca)}</button><button type="button" data-fill="clay" aria-pressed="false" data-i18n="clay">${esc(EN.clay)}</button></div></span>` +
  `<span class="mp-pair"><span class="mp-label" data-i18n="quake">${esc(EN.quake)}</span>` +
  `<div class="mp-group" role="group" aria-label="${esc(EN.quakeGroup)}" data-i18n-label="quakeGroup"><button type="button" data-shake="0" aria-pressed="false" data-i18n="moderate">${esc(EN.moderate)}</button><button type="button" data-shake="1" aria-pressed="false" data-i18n="strong">${esc(EN.strong)}</button></div></span>` +
  `<span class="mp-pair"><span class="mp-label" data-i18n="wall">${esc(EN.wall)}</span><div class="mp-group" role="group" aria-label="${esc(EN.wallGroup)}" data-i18n-label="wallGroup"><button type="button" data-wall="dry" aria-pressed="true" data-i18n="dryWall">${esc(EN.dryWall)}</button><button type="button" data-wall="mortar" aria-pressed="false" data-i18n="mortared">${esc(EN.mortared)}</button></div></span>` +
  `</div></div>`;

const plateHtml = k.plateHtml({
  fig: EN.fig,
  title: EN.cutaway,
  hint: EN.hint,
  readout: "",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="${esc(EN.stage)}" data-i18n-label="stage" aria-valuemin="1" aria-valuemax="${M.PASSES}" aria-valuenow="1">${svg}</div>` + `<div class="mp-foot">${deck}${readout}</div><p class="mp-tip" aria-hidden="true" hidden></p>`,
});

// A part's story in short paragraphs, then what to try in the drawing, set apart.
const about = (x, i) =>
  x.text.map((t, j) => `<p data-i18n="sections.${i}.text.${j}">${esc(t)}</p>`).join("") +
  (x.try ? `<p class="mp-try"><span class="mp-label" data-i18n="tryLabel">${esc(EN.tryLabel)}</span><span data-i18n="sections.${i}.try">${esc(x.try)}</span></p>` : "");
const langSwitch = `<div class="mp-lang" role="group" aria-label="${esc(EN.language)}" data-i18n-label="language"><button type="button" data-lang="en" aria-pressed="true" lang="en">EN</button><button type="button" data-lang="es" aria-pressed="false" lang="es">ES</button></div>`;
const themeSwitch = `<button type="button" class="mp-theme-switch" data-theme-toggle role="switch" aria-checked="${theme === "dark"}" aria-label="${esc(EN.darkTheme)}" data-i18n-label="darkTheme" title="${esc(EN.darkTheme)}">` +
  `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="10" cy="10" r="3"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4M3.6 16.4 5 15M15 5l1.4-1.4"/></svg>` +
  `<span class="mp-theme-track" aria-hidden="true"><i></i></span>` +
  `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z"/></svg></button>`;
const panelTools = `<div class="mp-tools">${themeSwitch}${langSwitch}</div>`;
const panel =
  `<aside class="mp-panel" data-show="1" data-card-hidden>` +
  `<div class="mp-top"><p class="mp-eyebrow" data-i18n="eyebrow">${esc(EN.eyebrow)}</p>` +
  `${panelTools}</div>` +
  `<h1 class="mp-title" data-i18n="title">${esc(EN.title)}</h1>` +
  `<p class="mp-lede" data-i18n="lede">${esc(EN.lede)}</p>` +
  `<ol class="mp-list">${EN.sections.map((x, i) => `<li><button type="button" data-pick="${i + 1}" aria-pressed="${i + 1 === DATA.FIRST}"><span class="mp-num">${pad(i + 1)}</span><span data-i18n="sections.${i}.name">${esc(x.name)}</span></button></li>`).join("")}</ol>` +
  `<div class="mp-about">${EN.sections.map((x, i) => `<section data-about="${i + 1}"${i + 1 === DATA.FIRST ? "" : " hidden"}><h2 data-i18n="sections.${i}.name">${esc(x.name)}</h2>${about(x, i)}</section>`).join("")}</div>` +
  `<p class="mp-note" data-note>${esc(noteOf("en"))}</p>` +
  `</aside>`;

// Fig 2: a shared force model drives the animated haul and its live controls and readings. The tabs above the drawing switch figures, panel and all.
const F2 = EN.fig2;
const ramp = rampFigure(k, G, M);
const svg2 = k.figureSvg({ width: ramp.WIDTH, height: ramp.HEIGHT, label: F2.figure, body: ramp.body });
const readout2 =
  `<div class="mp-readout mp-ramp-readout"><p class="mp-label" data-i18n="fig2.readout">${esc(F2.readout)}</p>` +
  `<p class="mp-big"><span class="mp-bignum" data-ramp-distance>0.00</span><span class="mp-unit">m</span></p>` +
  `<p class="mp-sub" data-ramp-travel></p><p class="mp-ramp-status" data-ramp-status role="status" aria-live="polite" aria-atomic="true"></p>` +
  `<div class="mp-ramp-force" role="img" data-ramp-force><div><span data-i18n="fig2.required">${esc(F2.required)}</span><b data-ramp-required></b></div><i><b data-ramp-required-bar></b></i>` +
  `<div><span data-i18n="fig2.available">${esc(F2.available)}</span><b data-ramp-available></b></div><i><b data-ramp-available-bar></b></i></div></div>`;
const rampDeck =
  `<div class="mp-deck mp-ramp-deck"><p class="mp-hint" data-i18n="fig2.hint">${esc(F2.hint)}</p>` +
  `<div class="mp-ramp-knobs"><span class="mp-label" data-i18n="fig2.crewLabel">${esc(F2.crewLabel)}</span><div class="mp-group" data-ramp-teams role="group" data-i18n-label="fig2.crewGroup" aria-label="${esc(F2.crewGroup)}"></div>` +
  `<span class="mp-label" data-i18n="fig2.blockLabel">${esc(F2.blockLabel)}</span><div class="mp-group" role="group" data-i18n-label="fig2.blockGroup" aria-label="${esc(F2.blockGroup)}">${M.RAMP_BLOCKS.map((kg) => `<button type="button" data-ramp-mass="${kg}" aria-pressed="${kg === 10000}">${num("en", kg / 1000, kg === 900 ? 1 : 0)} t</button>`).join("")}</div></div>` +
  `<div class="mp-group mp-ramp-actions"><button type="button" data-ramp-toggle aria-pressed="true">${esc(F2.pause)}</button><button type="button" data-ramp-tug data-i18n="fig2.tug">${esc(F2.tug)}</button><button type="button" data-ramp-reset data-i18n="fig2.reset">${esc(F2.reset)}</button></div>` +
  `<p class="mp-ramp-legend" data-ramp-legend></p><p class="mp-ramp-summary" data-ramp-summary></p><p class="mp-ramp-small" data-ramp-small hidden></p></div>`;
const plate2 = k
  .plateHtml({
    fig: "Fig 2", title: F2.title, readout: "",
    body: `<div class="iso-stage" data-ramp-stage tabindex="0" role="group" aria-label="${esc(F2.stageLabel)}" data-i18n-label="fig2.stageLabel">${svg2}</div><div class="mp-foot mp-ramp-foot">${rampDeck}${readout2}</div>`,
  })
  .replace(`data-corner="title">`, `data-corner="title" data-i18n="fig2.title">`);
const rampSource = strip("ramp.mjs");
const rampScript = readFileSync(join(HERE, "ramp-live.js"), "utf8").replace("__RAMP_DATA__", JSON.stringify({ P: ramp.P }));
const panel2 =
  `<aside class="mp-panel" data-show="2" data-card-hidden hidden>` +
  `<div class="mp-top"><p class="mp-eyebrow" data-i18n="eyebrow">${esc(EN.eyebrow)}</p>${panelTools}</div>` +
  `<h1 class="mp-title" data-i18n="fig2.heading">${esc(F2.heading)}</h1>` +
  `<p class="mp-lede" data-i18n="fig2.lede">${esc(F2.lede)}</p>` +
  `<div class="mp-facts"><h2 data-i18n="fig2.knownTitle">${esc(F2.knownTitle)}</h2><ol class="mp-known">` +
  F2.known.map((x, i) => `<li><p data-i18n="fig2.known.${i}.text">${esc(x.text)}</p><span class="mp-src" data-i18n="fig2.known.${i}.src">${esc(x.src)}</span></li>`).join("") +
  `</ol><h2 data-i18n="fig2.unknownTitle">${esc(F2.unknownTitle)}</h2><ul class="mp-unknown">` +
  F2.unknown.map((x, i) => `<li data-i18n="fig2.unknown.${i}">${esc(x)}</li>`).join("") +
  `</ul></div>` +
  `<p class="mp-note" data-i18n="fig2.note">${esc(F2.note)}</p>` +
  `</aside>`;
const tabs =
  `<div class="mp-tabs" data-card-hidden role="tablist" aria-label="${esc(EN.tabs)}" data-i18n-label="tabs">` +
  `<button type="button" role="tab" data-tab="1" aria-selected="true" data-i18n="tab1">${esc(EN.tab1)}</button>` +
  `<button type="button" role="tab" data-tab="2" aria-selected="false" tabindex="-1" data-i18n="tab2">${esc(EN.tab2)}</button></div>`;

const out = theme === "light" ? "machu-picchu-light.html" : "machu-picchu.html";
const page = k.pageHtml({
    title: EN.title,
    theme,
    width: 1180,
    body: `<style>${css}</style><div class="mp-layout"><div class="mp-figure">${tabs}<div class="mp-fig" data-show="1">${plateHtml}</div><div class="mp-fig" data-show="2" hidden>${plate2}</div></div>${panel}${panel2}</div>`,
    script: strip("kit/iso-kit.mjs") + lathe + strip("model.mjs") + strip("parts.mjs") + strip("text.mjs") + rampSource + rampScript + live,
});
// Restore the saved theme before the page's content paints, preserving the build default otherwise.
const themeInit = `<script>try{const saved=localStorage.getItem('mp-theme');if(saved==='light'||saved==='dark')document.body.dataset.theme=saved}catch{}document.body.classList.add('mp-enter')</script>`;
writeFileSync(join(HERE, out), page.replace(`<body class="iso" data-theme="${theme}">`, `<body class="iso" data-theme="${theme}">${themeInit}`));
console.log("wrote", out, "·", solids, "solids");
