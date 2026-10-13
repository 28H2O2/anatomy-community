import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "../../../../.skill/kit/tube.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const META = { fig: "Fig 1" };
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- world plan
// x runs along the shafts (engine side at −x), y toward the viewer, z up. 1 unit ≈ 1.6 mm.
const W = 920;
const H = 640;
const ZS = 92; // shaft centre height
const C = 40; // centre distance, input ↔ each output shaft
const Y = { A: -C, I: 0, B: C };
const R_CORE = 4.5;
const R_HOLLOW = 7.5;
const R_OUT = 6;
const GW = 7; // gear face width
const NPH = 6; // tooth phases per pitch

// Stations along x: driving gear on the input, driven gear on its output shaft.
const ST = { R: 8, 4: 32, 6: 44, 2: 68, 3: 94, 5: 106, 1: 130 };
const SLV = { B1: 20, A1: 56, B2: 82, A2: 118 };
const TRAVEL = 4;
const HOLLOW_END = 74;
const PED_L = -10;
const PED_R = 142;
const DRUM_Z = 158;
const DRUM_R = 6.5;
const DRUM_Y = { odd: -20, even: 20 };
const DRUM_X = [-22, 138];
const BEAM_Z = 182;
const BEAM_H = 8;
const BEAM_L = { x: -38, w: 10 };
const BEAM_R = { x: 146, w: 8 };
const POST_Y = 64;
const BASE = { x: -100, y: -84, w: 324, d: 160, r: 9 };
const BASE_H = 12;
const FOOT_H = 6;

// Gear sizes from the ratios: driving + driven = C, driven / driving = ratio.
const RADII = {};
for (const g of ["1", "2", "3", "4", "5", "6"]) {
  const rin = C / (1 + M.RATIO[g]);
  RADII[g] = { in: rin, out: C - rin };
}
const R_IN_R = 8.4;
const R_IDLER = 10;
RADII.R = { in: R_IN_R, out: R_IN_R * M.RATIO.R };
// Reverse idler: meshes the input's reverse gear and the reverse gear on output B.
const IDLER = (() => {
  const a = R_IN_R + R_IDLER;
  const b = RADII.R.out + R_IDLER;
  const y = (a * a - b * b + C * C) / (2 * C);
  return [y, ZS + Math.sqrt(a * a - y * y)];
})();
const teethOf = (r) => Math.max(9, Math.round(r * 1.15));

// Final drive: one ring gear meshing a pinion on each output shaft.
const RING_R = 40;
const PIN = { A: RING_R / M.FD.A, B: RING_R / M.FD.B };
const RING = (() => {
  const dA = RING_R + PIN.A;
  const dB = RING_R + PIN.B;
  const y = (dA * dA - dB * dB) / (4 * C);
  return [y, ZS - Math.sqrt(dA * dA - (y + C) ** 2)];
})();
const FDX = [160, 168];

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [BASE.x, 0, BEAM_Z + BEAM_H + 16], [BASE.x + BASE.w, 0, BEAM_Z + BEAM_H + 16], [BEAM_L.x, -POST_Y, BEAM_Z + 26], [BEAM_R.x, POST_Y, BEAM_Z + 26]],
  W,
  H,
  { pad: 30, azimuth: 52, elevation: 40 },
);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const FADE = [0.04, 0.42];
const RIBFADE = [0.1, 0.55];
const FX = (y, z) => G.frameOf([0, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const FYZ = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

const R = A.recorder(P);
const { nameFor } = R;
const record = R.solid;
function put(name, ref, svg, { bias = 0, shapes = [], mv, pw, pivot } = {}) {
  return R.put({ at: ref, bias, svg, shapes, name, piece: "", mv, pw, pivot });
}

// ---------------------------------------------------------------- helpers
function boxItem(name, plan, z, h, style = {}, { extra = "", inner = "", bias = 0, steps = 3, bevel = 0.5, mv, pw, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.slab(plan, z, h, { name: id, owner }, steps));
  put(id, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner: (style.inner ?? "") + inner }) + extra, { bias, shapes: [shape], mv, pw });
  return shape;
}
// A short cylinder on an x-axis line at (y, z).
function discX(name, y, z, x0, x1, r, style = {}, { extra = "", inner = "", bias = 0, mv, pw, owner, rIn = 0 } = {}) {
  const id = nameFor(name);
  const F = FX(y, z);
  const paths = rIn ? G.ringBand(x0, x1, rIn, r, F, P) : G.disc(x0, x1, r, F, P);
  const shape = record(rIn ? A.ring(F, x0, x1, rIn, r, { name: id, owner }) : A.disc(F, x0, x1, r, { name: id, owner }));
  put(id, [(x0 + x1) / 2, y, z], S(paths, { tone: "hi", ...style, inner: (style.inner ?? "") + inner }) + extra, { bias, shapes: [shape], mv, pw });
  return shape;
}
// A prism in the y–z plane, x from x0 to x1.
function prismYZ(name, poly, x0, x1, style = {}, { extra = "", bias = 0, mv, pw, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.prism(FYZ, poly, x0, x1, { name: id, owner }));
  const cy = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  put(id, [(x0 + x1) / 2, cy, cz], S(G.prismOf(FYZ, poly, x0, x1, P), { tone: "mid", ...style }) + extra, { bias, shapes: [shape], mv, pw });
  return shape;
}
// Teeth: fading ribs on the rim, drawn at NPH phases across one pitch so the live page can turn them.
function teeth(id, F, x0, x1, r, count, { tone = "lo", seams = true } = {}) {
  const groups = [];
  for (let ph = 0; ph < NPH; ph++) {
    const ribs = G.ribsOf(F, x0, x1, r, count, P, { phase: (ph / NPH) * (TAU / count), fade: RIBFADE });
    groups.push(`<g data-sp="${id}" data-ph="${ph}"${ph ? ' style="display:none"' : ""}>${Faded(ribs, { tone })}</g>`);
  }
  const edge = seams ? Ln(G.arcOf(F, x0, r, P) + G.arcOf(F, x1, r, P), { tone: "faint" }) : "";
  return groups.join("") + edge;
}
const SPIN = []; // { id, teeth, source, sign }
function gear(name, y, z, xc, r, rb, { width = GW, source, sign = 1, tone = "hi", pw, owner, count = teethOf(r), extraFace = "" } = {}) {
  const F = FX(y, z);
  const x0 = xc - width / 2;
  const x1 = xc + width / 2;
  const id = nameFor(name);
  SPIN.push({ id, teeth: count, source, sign });
  const face = Ln(G.circleOf(F, x1, r - 2.2, P) + (r - rb > 9 ? G.circleOf(F, x1, rb + 2.8, P) + G.circleOf(F, x1, (r + rb) / 2 + 1, P) : ""), { tone: "faint" }) + (r - rb > 6 ? Ln(G.circleOf(F, x1, rb + 1.2, P), { tone: "lo" }) : "");
  const shape = record(A.ring(F, x0, x1, rb, r, { name: id, owner }));
  put(id, [xc, y, z], S(G.ringBand(x0, x1, rb, r, F, P), { tone, inner: teeth(id, F, x0, x1, r, count) + face + extraFace }), { shapes: [shape], pw });
  return { x0, x1 };
}
// A shaft drawn in pieces between the collars that wrap it, so each piece sorts on its own.
function shaft(name, y, z, r, x0, x1, collars, { tone = "hi", pw, owner, rIn = 0 } = {}) {
  const cuts = collars.filter(([a, b]) => b > x0 && a < x1).sort((p, q) => p[0] - q[0]);
  let from = x0;
  const spans = [];
  for (const [a, b] of cuts) {
    if (a > from + 0.05) spans.push([from, a]);
    from = Math.max(from, b);
  }
  if (x1 > from + 0.05) spans.push([from, x1]);
  for (const [a, b] of spans) discX(name, y, z, a, b, r, { tone, crease: "none" }, { pw, owner, rIn });
}
// Pillow block on a column: foot, column, bearing housing with cap ring and bolts.
function pedestal(name, x, y, z, rh, { width = 8, rIn = 0 } = {}) {
  const foot = { x: x - 5, y: y - 12, w: 10, d: 24, r: 2 };
  boxItem(`stand.${name}.foot`, foot, 0, 2.6, {}, { extra: Dots(k.corners(foot, 3).map(([px, py]) => at([px, py, 2.6])), { size: 0.45 }), bevel: 0.4 });
  const col = { x: x - width / 2, y: y - 8, w: width, d: 16, r: 1.5 };
  const top = z - rh + 0.3;
  boxItem(`stand.${name}.column`, col, 2.6, top - 2.6, {}, { inner: Ln(k.sideSeam(col, 12, P, 3), { tone: "faint" }), bevel: 0.4 });
  const F = FX(y, z);
  const x1 = x + width / 2;
  const face = Ln(G.circleOf(F, x1, rh - 2, P), { tone: "lo" }) + Dots(G.dotsOf(F, x1, rh - 3.6, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.45 });
  discX(`stand.${name}.housing`, y, z, x - width / 2, x1, rh, { tone: "mid" }, { extra: face, rIn });
}

// ---------------------------------------------------------------- base
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`);
for (const [x, y] of k.corners(BASE, 24).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) {
  back.push(S(k.cylinder(x, y, 8, -BASE_H - FOOT_H, 1.8, P, 32), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 6.2, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 32), { tone: "mid" }));
}
back.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 9, 1.6), { tone: "mid", inner: Ln(k.sideSeam(BASE, -BASE_H + 4, P, 9), { tone: "faint" }) }));
record(A.slab(BASE, -BASE_H, BASE_H, { name: "stand.base" }, 9));
back.push(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
const baseScrews = k.corners(BASE, 11);
back.push(Ln(baseScrews.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 18)).join(""), { tone: "lo" }), Dots(baseScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
// T-slots along the bench, closed outlines.
for (const y of [-56, 56]) back.push(Ln(k.planOutline({ x: BASE.x + 22, y: y - 1.6, w: BASE.w - 44, d: 3.2, r: 1.6 }, 0, P, 4), { tone: "faint" }));
// Ruler strip along the front edge: 1 tick per 5 units (8 mm).
const strip = { x: -84, y: BASE.y + BASE.d - 14, w: 292, d: 7, r: 1 };
back.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
back.push(Dots([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
// Label plate, front left.
const label = { x: -92, y: 18, w: 34, d: 44, r: 1.6 };
back.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
back.push(Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
back.push(Ln(k.lineOnTop([-78, label.y + 8], [-78, label.y + 36], 0.8, P) + k.lineOnTop([-72, label.y + 8], [-72, label.y + 30], 0.8, P) + k.lineOnTop([-66, label.y + 8], [-66, label.y + 33], 0.8, P), { tone: "lo", free: true }));
back.push(k.faceTextSvg(k.topMatrix([-85, label.y + 22], 0.8, P, "y"), "DPS6", { size: 4.2, tone: "mid", anchor: "middle" }));
back.push(Dots([at([label.x + 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.42 }));

// ---------------------------------------------------------------- pedestals
for (const [key, y] of Object.entries(Y)) {
  pedestal(`left.${key}`, PED_L, y, ZS, key === "I" ? 13 : 12);
  pedestal(`right.${key}`, PED_R, y, ZS, key === "I" ? 10 : 12);
}
pedestal("crank", -86, 0, ZS, 12);
pedestal("diff.left", 152, RING[0], RING[1], 13);
pedestal("diff.right", 196, RING[0], RING[1], 13, { rIn: 5 });

// Portal frames carry the clutch levers (left) and the TCM with the shift drums (right).
function portal(name, beam) {
  for (const y of [-POST_Y]) {
    const foot = { x: beam.x - 4, y: y - 9, w: beam.w + 8, d: 18, r: 2 };
    boxItem(`stand.${name}.foot`, foot, 0, 2.6, {}, { extra: Dots(k.corners(foot, 3).map(([px, py]) => at([px, py, 2.6])), { size: 0.45 }) });
    const post = { x: beam.x, y: y - 6, w: beam.w, d: 12, r: 1.4 };
    boxItem(`stand.${name}.post`, post, 2.6, BEAM_Z - 2.6, {}, { inner: Ln(k.sideSeam(post, 20, P, 3) + k.sideSeam(post, BEAM_Z - 14, P, 3), { tone: "faint" }), bevel: 0.4 });
  }
  const plan = { x: beam.x, y: -POST_Y - 7, w: beam.w, d: POST_Y + 7 + 40, r: 1.6 };
  const bolts = [-POST_Y].flatMap((y) => [at([beam.x + 2.5, y - 2.5, BEAM_Z + BEAM_H]), at([beam.x + beam.w - 2.5, y + 2.5, BEAM_Z + BEAM_H])]);
  boxItem(`stand.${name}.beam`, plan, BEAM_Z, BEAM_H, {}, { extra: Ln(k.lineOnTop([beam.x + beam.w / 2, plan.y], [beam.x + beam.w / 2, plan.y + plan.d], BEAM_Z + BEAM_H, P), { tone: "faint" }) + Dots(bolts, { size: 0.45 }), bevel: 0.6 });
}
portal("left", BEAM_L);
// Knee braces under the cantilevered beams.
for (const beam of [BEAM_L, BEAM_R]) prismYZ("stand.knee", [[-POST_Y + 6, BEAM_Z], [-POST_Y + 28, BEAM_Z], [-POST_Y + 6, BEAM_Z - 22]], beam.x + 2, beam.x + beam.w - 2, { tone: "mid" });
portal("right", BEAM_R);

// ---------------------------------------------------------------- clutch pack (twin dry clutch)
const CL = { fly: [-70, -64], drive: [-64, -62], pp1: [-62, -57], disc1: [-57, -54], centre: [-54, -48], disc2: [-48, -45], pp2: [-45, -40], cover: [-40, -37], spring: [-37, -35.5] };
// Crank stub from the engine-side pedestal.
discX("engine.crank", 0, ZS, -82, -70, 7, { tone: "mid", crease: "none" });
const flyF = FX(0, ZS);
SPIN.push({ id: "flywheel", teeth: 96, source: "engine", sign: 1 });
discX("engine.flywheel", 0, ZS, CL.fly[0], CL.fly[1], 56, { tone: "mid", inner: teeth("flywheel", flyF, CL.fly[0], CL.fly[1], 56, 96) });
discX("clutch.drive", 0, ZS, CL.drive[0], CL.drive[1], 50, { tone: "mid" }, { extra: Dots(G.dotsOf(flyF, CL.drive[1], 46, 12, P, { fade: FADE }), { size: 0.42 }) });
discX("clutch.pp1", 0, ZS, CL.pp1[0], CL.pp1[1], 48, { tone: "mid" }, { mv: "pp1" });
SPIN.push({ id: "disc1", teeth: 30, source: "core", sign: 1 });
discX("clutch.disc1", 0, ZS, CL.disc1[0], CL.disc1[1], 45, { tone: "hi", inner: teeth("disc1", flyF, CL.disc1[0], CL.disc1[1], 45, 30, { tone: "faint", seams: false }) }, { pw: "c1" });
discX("clutch.centre", 0, ZS, CL.centre[0], CL.centre[1], 50, { tone: "mid" }, { extra: Ln(G.arcOf(flyF, (CL.centre[0] + CL.centre[1]) / 2, 50, P), { tone: "faint" }) });
SPIN.push({ id: "disc2", teeth: 30, source: "hollow", sign: 1 });
discX("clutch.disc2", 0, ZS, CL.disc2[0], CL.disc2[1], 45, { tone: "hi", inner: teeth("disc2", flyF, CL.disc2[0], CL.disc2[1], 45, 30, { tone: "faint", seams: false }) }, { pw: "c2" });
discX("clutch.pp2", 0, ZS, CL.pp2[0], CL.pp2[1], 48, { tone: "mid" }, { mv: "pp2" });
discX("clutch.cover", 0, ZS, CL.cover[0], CL.cover[1], 50, { tone: "mid" }, { extra: Dots(G.dotsOf(flyF, CL.cover[1], 46.5, 12, P, { all: true, phase: 0.13 }), { size: 0.45 }) + Ln(G.circleOf(flyF, CL.cover[1], 42, P), { tone: "faint" }) });
// Lever springs: outer fingers close clutch 2, inner fingers close clutch 1.
discX("clutch.spring2", 0, ZS, CL.spring[0], CL.spring[1], 40, { tone: "mid" }, { rIn: 16.4, extra: Ln(G.spokesOf(flyF, CL.spring[1], 23, 40, 18, P), { tone: "lo" }) + Ln(G.circleOf(flyF, CL.spring[1], 23, P), { tone: "lo" }) });
discX("clutch.spring1", 0, ZS, CL.spring[0], CL.spring[1], 15.6, { tone: "mid" }, { rIn: 8.4, bias: 0.6, extra: Ln(G.spokesOf(flyF, CL.spring[1], 9.4, 15.2, 12, P), { tone: "lo" }) });
// Release bearings, concentric: outer for clutch 2, inner (longer) for clutch 1.
const BRG2 = [-35.5, -31];
const BRG1 = [-35.5, -28.6];
discX("clutch.bearing2", 0, ZS, BRG2[0], BRG2[1], 22, { tone: "mid" }, { rIn: 16.6, mv: "brg2", extra: Ln(G.circleOf(flyF, BRG2[1], 19.3, P), { tone: "faint" }) });
discX("clutch.bearing1", 0, ZS, BRG1[0], BRG1[1], 15, { tone: "mid" }, { rIn: 9.2, bias: 0.6, mv: "brg1", extra: Ln(G.circleOf(flyF, BRG1[1], 12.1, P), { tone: "faint" }) });

// Levers hang from the left beam; the clutch motors sit on top of it.
const LEVER = { 2: { x: -33.2, y: 10, r: 22, w: 3.2 }, 1: { x: -29.8, y: -6, r: 15, w: 2.4 } };
for (const [n, L] of Object.entries(LEVER)) {
  const tipZ = ZS + Math.sqrt(L.r * L.r - (Math.abs(L.y) - 3) ** 2);
  const pad = { x: L.x - L.w / 2, y: L.y - 3, w: L.w, d: 6, r: 0.8 };
  boxItem(`clutch.lever${n}.pad`, pad, tipZ, 3, { tone: "hi" }, { mv: `lever${n}`, bevel: 0.3, steps: 2 });
  boxItem(`clutch.lever${n}.arm`, { x: L.x - 1.2, y: L.y - 1.6, w: 2.4, d: 3.2, r: 0.8 }, tipZ + 3, BEAM_Z - 6 - tipZ - 3, { tone: "mid" }, { mv: `lever${n}`, bevel: 0.3, steps: 2, inner: Ln(k.sideSeam({ x: L.x - 1.2, y: L.y - 1.6, w: 2.4, d: 3.2, r: 0.8 }, tipZ + 14, P, 2), { tone: "faint" }) });
  boxItem(`clutch.lever${n}.clevis`, { x: L.x - 3, y: L.y - 3.2, w: 6, d: 6.4, r: 1 }, BEAM_Z - 6, 6, { tone: "mid" }, { steps: 2, bevel: 0.4, extra: Dots([at([L.x + 3, L.y, BEAM_Z - 3])], { size: 0.55, tone: "hi" }) });
  // Clutch motor: a brushless can lying along x on top of the beam.
  const MY = n === "2" ? -48 : -34;
  const mF = FX(MY, BEAM_Z + BEAM_H + 7.4);
  discX(`clutch.motor${n}`, MY, BEAM_Z + BEAM_H + 7.4, -44, -24, 6.2, { tone: "mid", inner: Faded(G.ribsOf(mF, -40, -30, 6.2, 22, P, { fade: RIBFADE, seams: true }), { tone: "lo" }) }, { extra: Ln(G.circleOf(mF, -24, 3.2, P), { tone: "lo" }) });
  boxItem(`clutch.motor${n}.saddle`, { x: -40, y: MY - 5, w: 12, d: 10, r: 1 }, BEAM_Z + BEAM_H, 1.2, { tone: "lo" }, { steps: 2, bevel: 0 });
}

// ---------------------------------------------------------------- input shafts
const core = [];
const hollow = [];
const driving = {};
for (const g of ["R", "4", "6", "2"]) {
  const r = RADII[g].in;
  const span = gear(`input.g${g}`, 0, ZS, ST[g], r, R_HOLLOW, { source: "hollow", sign: 1, pw: `g${g}`, owner: "hollow" });
  hollow.push([span.x0, span.x1]);
  driving[g] = span;
}
for (const g of ["3", "5", "1"]) {
  const r = RADII[g].in;
  const span = gear(`input.g${g}`, 0, ZS, ST[g], r, R_CORE, { source: "core", sign: 1, pw: `g${g}`, owner: "core" });
  core.push([span.x0, span.x1]);
}
// Hollow shaft: clutch-2 hub to x = 74; the core shaft runs inside it from clutch 1 to the right pedestal.
shaft("input.hollow", 0, ZS, R_HOLLOW, BRG1[1], HOLLOW_END - 2, [...hollow, [PED_L - 4, PED_L + 4]], { pw: "hollow", owner: "hollow", rIn: R_CORE });
discX("input.hollow.collar", 0, ZS, HOLLOW_END - 2, HOLLOW_END, 9.4, { tone: "mid" }, { pw: "hollow", rIn: R_CORE, owner: "hollow" });
shaft("input.core", 0, ZS, R_CORE, HOLLOW_END, PED_R + 4, [...core, [PED_R - 4, PED_R + 4]], { pw: "core", owner: "core" });

// ---------------------------------------------------------------- output shafts, driven gears, sleeves
const outCollars = { A: [], B: [] };
const DOG = 2;
const dogs = []; // driven gear dog rings, which face their sleeve
for (const g of ["R", "1", "2", "3", "4", "5", "6"]) {
  const sh = M.SHAFT[g];
  const y = Y[sh];
  const r = RADII[g].out;
  const span = gear(`output${sh}.g${g}`, y, ZS, ST[g], r, R_OUT, { source: `d${g}`, sign: g === "R" ? 1 : -1, pw: `d${g}`, owner: `out${sh}` });
  outCollars[sh].push([span.x0, span.x1]);
  const sleeve = Object.entries(M.SLEEVES).find(([, s]) => s.lo === g || s.hi === g);
  const toward = SLV[sleeve[0]] > ST[g] ? 1 : -1;
  const d0 = toward > 0 ? span.x1 : span.x0 - DOG;
  const F = FX(y, ZS);
  outCollars[sh].push([d0, d0 + DOG]);
  const dogId = `dog${g}`;
  SPIN.push({ id: dogId, teeth: 22, source: `d${g}`, sign: g === "R" ? 1 : -1 });
  discX(`output${sh}.dog${g}`, y, ZS, d0, d0 + DOG, 10.4, { tone: "mid", inner: teeth(dogId, F, d0, d0 + DOG, 10.4, 22, { seams: false }) }, { owner: `out${sh}`, pw: `d${g}` });
}
const HUB_W = 12;
for (const [id, s] of Object.entries(M.SLEEVES)) {
  const y = Y[s.shaft];
  const x = SLV[id];
  outCollars[s.shaft].push([x - 4, x + 4]);
  discX(`output${s.shaft}.hub${id}.back`, y, ZS, x - 4, x - 1.5, 9.2, { tone: "lo" }, { owner: `sleeve${id}`, rIn: R_OUT });
  discX(`output${s.shaft}.hub${id}.mid`, y, ZS, x - 1.5, x + 1.5, 9.2, { tone: "lo" }, { owner: `sleeve${id}`, rIn: R_OUT });
  discX(`output${s.shaft}.hub${id}`, y, ZS, x + 1.5, x + 4, 9.2, { tone: "lo", inner: Faded(G.ribsOf(FX(y, ZS), x - 4, x + 4, 9.2, 20, P, { fade: RIBFADE }), { tone: "faint" }) }, { owner: `sleeve${id}`, rIn: R_OUT });
  // Sleeve: two flanges round a groove for the fork.
  const F = FX(y, ZS);
  // Back half (far flange and groove) and front flange, so the fork's yoke sorts between them.
  const halves = [
    ["back", [[x - 4, 12.2], [x - 3.2, 13], [x - 1.5, 13]], [x - 3.2, x - 1.5]],
    ["groove", [[x - 1.5, 10.8], [x + 1.5, 10.8]], []],
    ["front", [[x + 1.5, 13], [x + 3.2, 13], [x + 4, 12.2]], [x + 1.5, x + 3.2]],
  ];
  for (const [half, prof, [r0, r1] = []] of halves) {
    const sid = nameFor(`sleeve.${id}.${half}`);
    const shape = record(A.solid(F, prof, { name: sid, owner: `sleeve${id}` }));
    const ribs = r0 === undefined ? "" : Faded(G.ribsOf(F, r0, r1, 13, 28, P, { fade: RIBFADE }), { tone: "faint" });
    put(sid, [half === "back" ? x - 2.5 : half === "groove" ? x : x + 2.8, y, ZS], S(G.solidOf(prof, F, P), { tone: "hi", inner: ribs }), { shapes: [shape], mv: id, pw: `s${id}` });
  }
}
// Final-drive pinions.
for (const sh of ["A", "B"]) {
  const span = gear(`output${sh}.pinion`, Y[sh], ZS, (FDX[0] + FDX[1]) / 2, PIN[sh], R_OUT, { width: FDX[1] - FDX[0], source: sh, sign: -1, tone: "mid", owner: `out${sh}` });
  outCollars[sh].push([span.x0, span.x1], [PED_L - 4, PED_L + 4], [PED_R - 4, PED_R + 4]);
  shaft(`output${sh}.shaft`, Y[sh], ZS, R_OUT, PED_L, FDX[1] + 2, outCollars[sh], { tone: "mid", owner: `out${sh}` });
  discX(`output${sh}.nut`, Y[sh], ZS, FDX[1] + 2, FDX[1] + 4.5, 8, { tone: "mid" }, { extra: Ln(G.circleOf(FX(Y[sh], ZS), FDX[1] + 4.5, 3, P), { tone: "lo" }) });
}

// Reverse idler on a stub from the input's left pedestal.
{
  const [iy, iz] = IDLER;
  const F = FX(iy, iz);
  boxItem("stand.idler.bracket", { x: PED_L - 4, y: iy - 3.5, w: 8, d: 7, r: 1 }, ZS + 12.6, iz - ZS - 12.6 - 5.1, { tone: "mid" }, { steps: 2 });
  discX("stand.idler.boss", iy, iz, PED_L - 4, PED_L + 4, 5.4, { tone: "mid" });
  discX("idler.stub", iy, iz, PED_L + 4, ST.R - GW / 2, 3, { tone: "mid", crease: "none" });
  gear("idler.gear", iy, iz, ST.R, R_IDLER, 3, { source: "idler", sign: -1, pw: "idler" });
  discX("idler.cap", iy, iz, ST.R + GW / 2, ST.R + GW / 2 + 1.6, 4.4, { tone: "mid" }, { extra: Dots([at(G.pointOf(F, ST.R + GW / 2 + 1.6, 0, 0))], { size: 0.5 }) });
}

// ---------------------------------------------------------------- final drive and differential
{
  const [ry, rz] = RING;
  const F = FX(ry, rz);
  SPIN.push({ id: "ring", teeth: 44, source: "diff", sign: 1 });
  const id = nameFor("diff.ring");
  const shape = record(A.ring(F, FDX[0], FDX[1], 16, RING_R, { name: id }));
  put(id, [(FDX[0] + FDX[1]) / 2, ry, rz], S(G.ringBand(FDX[0], FDX[1], 16, RING_R, F, P), { tone: "hi", inner: teeth("ring", F, FDX[0], FDX[1], RING_R, 44) + Ln(G.circleOf(F, FDX[1], RING_R - 2.2, P) + G.circleOf(F, FDX[1], 22, P), { tone: "faint" }) }), { shapes: [shape], pw: "ring" });
  // Case: a turned body either side of the ring.
  const rL = (x) => 16 - 8 * ((160 - x) / 4) ** 2;
  const sL = (x) => 160 - x;
  const rR = (x) => 17.6 - 9.6 * ((x - 168) / 20) ** 2;
  const sR = (x) => (-9.6 * 2 * (x - 168)) / 400;
  const knots = (x0, x1, r, n) => Array.from({ length: n + 1 }, (_, j) => { const x = x0 + ((x1 - x0) * j) / n; return [x, r(x), j > 0 && j < n ? 1 : 0]; });
  for (const [nm, prof, slope] of [["diff.case.l", knots(156, FDX[0], rL, 8), sL], ["diff.case.r", knots(FDX[1], 188, rR, 20), sR]]) {
    const pid = nameFor(nm);
    const s = record(A.solid(F, prof, { name: pid }));
    const paths = G.solidOf(prof, F, P, { smooth: { slope } });
    const inner = nm.endsWith(".r") ? Ln(G.arcOf(F, 178, rR(178), P, { slope: sR(178) }), { tone: "faint" }) : "";
    put(pid, [(prof[0][0] + prof[prof.length - 1][0]) / 2, ry, rz], S(paths, { tone: "mid", inner }), { shapes: [s] });
  }
  shaft("diff.stub", ry, rz, 5, 188, 205, [[192, 200]], { tone: "mid" });
  discX("diff.flange", ry, rz, 205, 209, 11, { tone: "mid" }, { extra: Dots(G.dotsOf(F, 209, 8, 6, P, { all: true }), { size: 0.5 }) + Ln(G.circleOf(F, 209, 4.2, P), { tone: "lo" }) });
}

// ---------------------------------------------------------------- shift drums, forks, TCM
const DRUM = {};
for (const [name, y] of Object.entries(DRUM_Y)) {
  const F = FX(y, DRUM_Z);
  // Left bearing hangs from the left beam; the right end runs into the TCM.
  boxItem(`stand.drum.${name}.hanger`, { x: BEAM_L.x + BEAM_L.w, y: y - 4, w: 6, d: 8, r: 1 }, DRUM_Z + 9.7, BEAM_Z - DRUM_Z - 9.7, { tone: "mid" }, { steps: 2 });
  discX(`stand.drum.${name}.housing.l`, y, DRUM_Z, BEAM_L.x + BEAM_L.w, BEAM_L.x + BEAM_L.w + 6, 10, { tone: "mid" }, { extra: Ln(G.circleOf(F, BEAM_L.x + BEAM_L.w + 6, 7.6, P), { tone: "lo" }) });
  const grooves = [0, 1, 2, 3].map((j) => `<path class="iso-line" data-tone="lo" data-groove="${name}" data-j="${j}" d=""/>`).join("");
  discX(`drum.${name}`, y, DRUM_Z, DRUM_X[0], DRUM_X[1] - 8, DRUM_R, { tone: "hi", inner: grooves }, { pw: `drum${name}` });
  // Clock gear at the right end, driven by the motor pinion above it.
  gear(`drum.${name}.clock`, y, DRUM_Z, DRUM_X[1] - 6, 14, DRUM_R, { width: 3.2, source: `drum${name}`, count: 40, tone: "mid" });
  discX(`drum.${name}.neck`, y, DRUM_Z, DRUM_X[1] - 4.4, DRUM_X[1], 5, { tone: "mid", crease: "none" });
  DRUM[name] = { y, F };
}
// TCM: hangs under the right beam, holds both shift motors and the drums' right bearings.
const TCM = { x: BEAM_R.x - 8, y: -34, w: 22, d: 68, r: 2.4 };
const TCM_Z = [DRUM_Z + 8, BEAM_Z];
boxItem("stand.tcm.body", TCM, TCM_Z[0], TCM_Z[1] - TCM_Z[0], { tone: "mid" }, {
  bevel: 0.8,
  steps: 4,
  inner: Ln(k.sideSeam(TCM, TCM_Z[0] + 3.5, P, 4), { tone: "lo" }) + Ln([7.5, 9.5, 11.5].map((dz) => k.sideSeam(TCM, TCM_Z[0] + dz, P, 4)).join(""), { tone: "faint" }),
  extra: Dots(k.corners(TCM, 2.6).map(([x, y]) => at([x, y, TCM_Z[1]])), { size: 0.45 }),
});
// Connector on the TCM's front face.
boxItem("stand.tcm.connector", { x: TCM.x + 5, y: TCM.y + TCM.d, w: 11, d: 4, r: 1 }, TCM_Z[0] + 4, 8, { tone: "hi" }, { steps: 2, extra: Ln([0, 1, 2].map((j) => k.segment([TCM.x + 7.5 + j * 3, TCM.y + TCM.d + 4, TCM_Z[0] + 6], [TCM.x + 7.5 + j * 3, TCM.y + TCM.d + 4, TCM_Z[0] + 10], P)).join(""), { tone: "lo" }) });
for (const [name, { y, F }] of Object.entries(DRUM)) {
  discX(`stand.tcm.bearing.${name}`, y, DRUM_Z, DRUM_X[1], DRUM_X[1] + 7, 8, { tone: "mid" }, { extra: Ln(G.circleOf(F, DRUM_X[1] + 7, 5, P), { tone: "lo" }) });
  // Motor pinion above the clock gear on a shaft out of the TCM.
  const pz = DRUM_Z + 14 + 3.8;
  discX(`tcm.shaft.${name}`, y, pz, DRUM_X[1] - 4.4, TCM.x, 1.4, { tone: "mid", crease: "none" });
  gear(`tcm.pinion.${name}`, y, pz, DRUM_X[1] - 6, 3.8, 1.4, { width: 3.2, source: `motor${name}`, count: 10, sign: -1, tone: "mid" });
}

// Forks: shoe under the drum (its pin rides the groove), an arm, and a yoke in the sleeve's groove.
const FORK = {};
for (const [id, s] of Object.entries(M.SLEEVES)) {
  const x = SLV[id];
  const ys = Y[s.shaft];
  const yd = DRUM_Y[s.drum];
  const x0 = x - 1.3;
  const x1 = x + 1.3;
  const shoeTop = DRUM_Z - DRUM_R;
  boxItem(`fork.${id}.shoe`, { x: x - 4.5, y: yd - 4.5, w: 9, d: 9, r: 1.2 }, shoeTop - 6, 6, { tone: "hi" }, { mv: id, steps: 2, bevel: 0.4, extra: Dots([at([x, yd + 4.5, shoeTop - 3])], { size: 0.5 }) });
  const yokeIn = 10.9;
  const yokeOut = 15;
  const yokeTop = ZS + yokeOut * Math.cos(Math.asin(2.4 / yokeOut));
  const armTop = shoeTop - 6;
  const near = Math.abs(ys - yd) < 25;
  if (near) {
    const dir = Math.sign(ys - yd);
    prismYZ(`fork.${id}.arm`, [[yd - 2.4 * dir, armTop], [yd + 2.4 * dir, armTop], [ys + 2.4 * dir, yokeTop], [ys - 2.4 * dir, yokeTop]], x0, x1, { tone: "hi" }, { mv: id });
  } else {
    const barZ = 138;
    prismYZ(`fork.${id}.drop`, [[yd - 2.4, armTop], [yd + 2.4, armTop], [yd + 2.4, barZ], [yd - 2.4, barZ]], x0, x1, { tone: "hi" }, { mv: id });
    prismYZ(`fork.${id}.bar`, [[Math.min(yd, ys) - 2.4, barZ], [Math.max(yd, ys) + 2.4, barZ], [Math.max(yd, ys) + 2.4, barZ - 5], [Math.min(yd, ys) - 2.4, barZ - 5]], x0, x1, { tone: "hi" }, { mv: id });
    prismYZ(`fork.${id}.leg`, [[ys - 2.4, barZ - 5], [ys + 2.4, barZ - 5], [ys + 2.4, yokeTop], [ys - 2.4, yokeTop]], x0, x1, { tone: "hi" }, { mv: id });
  }
  // Yoke: the upper half-ring, in six convex segments.
  const flat = Math.asin(2.4 / yokeOut);
  const cuts = [0.38, 0.8, Math.PI / 3, Math.PI / 2 - flat, Math.PI / 2 + flat, (2 * Math.PI) / 3, Math.PI - 0.8, Math.PI - 0.38];
  for (let j = 0; j < cuts.length - 1; j++) {
    const a0 = cuts[j];
    const a1 = cuts[j + 1];
    const p = (a, r) => [ys + r * Math.cos(a), ZS + r * Math.sin(a)];
    prismYZ(`fork.${id}.yoke`, [p(a0, yokeIn), p(a0, yokeOut), p(a1, yokeOut), p(a1, yokeIn)], x0, x1, { tone: "hi" }, { mv: id });
  }
  FORK[id] = { x, ys, yd };
}

// ---------------------------------------------------------------- tie rail and harness
// A tie rail across the back of both beams, and the TCM's harness to the two clutch motors.
const RAIL = { x: BEAM_L.x, y: -POST_Y - 6, w: BEAM_R.x + BEAM_R.w - BEAM_L.x, d: 10, r: 1.4 };
const RAIL_TOP = BEAM_Z + BEAM_H + 5;
boxItem("stand.rail", RAIL, BEAM_Z + BEAM_H, 5, { tone: "mid" }, { bevel: 0.5, extra: Dots([BEAM_L, BEAM_R].flatMap((b) => [at([b.x + b.w / 2, RAIL.y + 2.4, RAIL_TOP]), at([b.x + b.w / 2, RAIL.y + RAIL.d - 2.4, RAIL_TOP])]), { size: 0.45 }) });
const CONN = { x: TCM.x + 1.5, y: -27, w: 6, d: 8, r: 1 };
boxItem("stand.tcm.plug", CONN, TCM_Z[1], 4, { tone: "hi" }, { steps: 2, bevel: 0.3 });
const CABLE_R = 0.7;
const CLAMP_R = 1.6;
const CLAMP_HALF = 0.9;
const CABLES = [];
const clampsAt = [];
function clampAt(centre, axis, bundle) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor("harness.clamp");
  put(id, centre, S(G.disc(-CLAMP_HALF, CLAMP_HALF, CLAMP_R, F, P), { tone: "mid" }), { bias: 0.3, shapes: [record(A.disc(F, -CLAMP_HALF, CLAMP_HALF, CLAMP_R, { name: id, anchor: false, bundle, fitting: true }))] });
  clampsAt.push({ centre, axis, radius: CLAMP_R });
}
function cable(name, points) {
  const route = G.fillet(points, 2.6, 10, { P, tube: CABLE_R });
  const total = G.pathLength(route);
  const gaps = clampsAt.flatMap(({ centre, axis, radius }) => crossingsOf(route, centre, axis, radius).map((s) => [s - CLAMP_HALF - 0.05, s + CLAMP_HALF + 0.05]));
  const id = nameFor(name);
  R.route(id, route, CABLE_R, { limp: true, bundle: "harness", touch: ["harness.clamp*"], gaps });
  // Chunks end mid-leg, never at a bend, so neighbouring chunks overlap only on straights.
  const breaks = [];
  let run = 0;
  for (let j = 1; j < points.length; j++) {
    const leg = G.len3(G.sub3(points[j], points[j - 1]));
    breaks.push(run + leg / 2 - (j === 1 ? 0 : 1.2));
    run += leg - 1.2;
  }
  tubePieces(route, CABLE_R, P, { maxLength: 400, spacing: 1, gaps, breaks: breaks.filter((b) => b > 1 && b < total - 1) }).forEach((part, index) =>
    put(`${id}:${index}`, part.mid, tubeSvg(part, { tone: "mid" }), { bias: 0.2, shapes: [A.tube(part.points, part.radii)] }),
  );
  for (const end of [route[0], route[route.length - 1]]) put(`${id}.end`, end, Dots([at(end)], { size: 0.55, tone: "hi" }), { bias: 0.35, shapes: [A.ball(end, 0.55 / G.scaleOf(P))] });
  CABLES.push(id);
}
const LANE_Z = RAIL_TOP + CLAMP_R;
const FACE_X = BEAM_L.x + BEAM_L.w + CLAMP_R;
const MOTOR_Z = BEAM_Z + BEAM_H + 7.4;
const HARN = {
  // [connector x, lane y on the rail, x where it leaves the rail, motor y]; the cable that leaves first goes furthest.
  2: [CONN.x + 4.6, RAIL.y + 3.2, -17, -48],
  1: [CONN.x + 1.6, RAIL.y + 6.2, -13.6, -34],
};
for (const x of [104, 44]) for (const n of [2, 1]) clampAt([x, HARN[n][1], LANE_Z], [1, 0, 0], "harness");
for (const n of [2, 1]) {
  const [cx, ly, lx, my] = HARN[n];
  cable(`harness.motor${n}`, [
    [cx, CONN.y + 4, TCM_Z[1] + 4],
    [cx, CONN.y + 4, LANE_Z],
    [cx, ly, LANE_Z],
    [lx, ly, LANE_Z],
    [lx, my, MOTOR_Z],
    [-24, my, MOTOR_Z],
  ]);
}

// ---------------------------------------------------------------- settle and emit
A.settle(R, P, { skip: () => false });
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => `<g class="it"${item.mv ? ` data-mv="${item.mv}"` : ""}${item.pw ? ` data-pw="${item.pw}"` : ""}>${item.svg}</g>`);

const LABEL =
  "A sectioned Ford PowerShift DPS6 twin-dry-clutch gearbox on a bench: the twin clutch on the left, a hollow input shaft carrying gears 2, 4, 6 and reverse around a core shaft carrying 1, 3 and 5, two output shafts with synchro sleeves and dog rings, a final-drive ring gear and differential on the right, and two shift drums overhead whose grooves push four forks.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [...back, `<g class="dp-items">${groups.join("")}</g>`].join("") });

// Screen basis for the live page (projection is linear in world units).
const o = at([0, 0, 0]);
const ax = at([1, 0, 0]);
const ay = at([0, 1, 0]);
const az = at([0, 0, 1]);
const DATA = {
  P,
  V,
  EX: [ax[0] - o[0], ax[1] - o[1]],
  EY: [ay[0] - o[0], ay[1] - o[1]],
  EZ: [az[0] - o[0], az[1] - o[1]],
  O: o,
  NPH,
  TRAVEL,
  SPIN,
  RADII,
  SLV,
  ST,
  FORK,
  LEVER: Object.fromEntries(Object.entries(LEVER).map(([n, L]) => [n, { ...L, pivotZ: BEAM_Z - 3, tipZ: ZS + Math.sqrt(L.r * L.r - (Math.abs(L.y) - 3) ** 2) }])),
  DRUM: { y: DRUM_Y, z: DRUM_Z, r: DRUM_R, x: DRUM_X },
  model: { RATIO: M.RATIO, FD: M.FD, SHAFT: M.SHAFT, CLUTCH: M.CLUTCH, DRUM_OF: M.DRUM_OF, DETENT: M.DETENT, SLEEVES: M.SLEEVES, TYRE_R: M.TYRE_R, IDLE: M.IDLE, LAUNCH_RPM: M.LAUNCH_RPM, UP_RPM: M.UP_RPM, DOWN_RPM: M.DOWN_RPM, MOTOR_TO_DRUM: M.MOTOR_TO_DRUM },
  idlerTeeth: [R_IN_R, R_IDLER],
};

const GEAR_BUTTONS = ["R", "1", "2", "3", "4", "5", "6"].map((g) => `<button type="button" class="dp-gear" data-gear="${g}">${g}</button>`).join("");
const controls = `<div class="dp-controls"><span class="dp-gears" role="group" aria-label="Choose a gear">${GEAR_BUTTONS}</span><button type="button" class="dp-tour" data-tour>Drive cycle</button><span class="dp-live" aria-live="polite" data-live></span></div>`;
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">${META.fig}</span><span class="iso-plate-corner" data-corner="title">Ford DPS6 · twin dry clutch</span><span class="iso-plate-corner" data-corner="hint">Press R, 1–6 · or let it drive</span><span class="iso-plate-corner" data-corner="readout" data-readout>1st · 0 km/h · 800 rpm</span></div>`;
const stage = `<div class="iso-stage dp-stage" tabindex="0" role="group" aria-label="Ford DPS6 gearbox. Press R or 1 to 6 to drive to that gear; the gearbox pre-selects the next gear on the idle shaft and hands over between its two clutches. Space starts or stops the drive cycle.">${svg}</div>`;
const KEYS = [
  { mark: "lit", label: "Power path: the closed clutch, its input shaft, the engaged gear pair and sleeve" },
  { mark: "raised", label: "Clutch 1 · core shaft · gears 1, 3, 5" },
  { mark: "raised", label: "Clutch 2 · hollow shaft · gears 2, 4, 6, R" },
  { mark: "flat", label: "Two shift drums turn 61.44:1 from their motors; each groove sets one fork" },
];
const keysHtml = `<span class="iso-keys">${KEYS.map(({ mark, label }) => `<span class="iso-key"><svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10"><path d="M1 8 L8 2 L15 8"/></svg>${label}</span>`).join("")}</span>`;
const CAPTION =
  "The DPS6 (Getrag 6DCT250) is two manual gearboxes sharing one output: clutch 1 turns the core shaft with gears 1, 3 and 5, clutch 2 turns the hollow shaft around it with 2, 4, 6 and reverse. While one clutch drives, a shift drum has already slid the next gear's sleeve home on the idle shaft, so a shift is only the two clutches crossing over, with no gap in drive. Ratios 3.917 · 2.429 · 1.436 · 1.021 · 0.867 · 0.702 · R 3.507; the 1-2-5-6 shaft drives the ring gear at 3.85 and the 3-4-R shaft at 4.28 (2014 Focus), on 215/50 R17 tyres. Speeds and revs are true; shafts are drawn 400× slower and shifts about four times slower than real. Both clutches are dry and open by default, which is why a shudder on take-off is the DPS6's best-known fault.";
const body = `<figure class="iso-figure dp"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${keysHtml}<span class="iso-caption">${CAPTION}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "dps6.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__MODEL__", readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "").replace(/^export \{[^}]*\};?$/m, ""));
const page = k.pageHtml({ title: "Ford PowerShift DPS6 twin dry clutch", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + LIVE, width: 980 });
const file = join(HERE, THEME === "light" ? "dps6-light.html" : "dps6.html");
writeFileSync(file, page);
console.log("wrote", file, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} shapes`);
A.auditOrExit(R, P, { allow: [["clutch.spring2", "clutch.spring1"], ["clutch.bearing2", "clutch.bearing1"]] });
