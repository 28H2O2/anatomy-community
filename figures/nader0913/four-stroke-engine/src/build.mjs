// Single-cylinder four-stroke engine in half-section on a bench stand.
// node build.mjs            -> engine.html (dark) ; --light -> engine-light.html ; always writes short.html (light)
// node build.mjs --audit    -> geometry audit of the recorded static parts and routes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = fileURLToPath(new URL("../../../../.skill", import.meta.url));
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import * as F from "./model.mjs";
import { makeMoving } from "./parts.mjs";
const { M } = F;

const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 900;
const ZC = M.ZC, DECK = M.DECK, CAMZ = M.CAMZ;
const SEAT = ZC + 222.5;
const HEAD_TOP = CAMZ - 16;
const STACK = { x: 6, y: -80, top: ZC + 384, r: 11 };

const P = k.fitProjection(
  [[-158, 34, CAMZ + 40], [-158, -40, ZC + 230], [100, -110, -16], [-150, 70, -16], [100, 70, -16], [STACK.x, STACK.y, STACK.top + 26], [90, 0, CAMZ + 40], [-100, 70, ZC - 80]],
  W, H, { pad: 16, azimuth: 55, elevation: 30 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const pathOf = (pts, closed) => k.pathOf(pts, closed);
const V = G.viewOf(P);
const L = G.lightOf(P);
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const MV = makeMoving(k, G, P, M, F);
const R = A.recorder(P, {});
const rec = (shape) => R.solid(shape);

// ---------- helpers ----------
const xz = (poly, y = 0) => pathOf(poly.map(([x, z]) => at([x, y, z])), true);
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const roundRect = (x0, x1, z0, z1, r, n = 5) => {
  const out = [];
  const corners = [[x1 - r, z0 + r, -90], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, 90], [x0 + r, z0 + r, 180]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= n; i++) { const a = ((a0 + (90 * i) / n) * Math.PI) / 180; out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
  return out;
};
const disc2 = (cx, cz, r, n = 28) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [cx + r * Math.cos(t), cz + r * Math.sin(t)]; });
const FY = G.frameOf([0, 0, 0], [0, -1, 0], X, Z); // section prisms: polygon in (x, z), s = -y
const FX = (o) => G.frameOf(o, X, Y, Z);
const FZ = (o) => G.frameOf(o, Z, X, Y);
let clipN = 0;

// ---------- the bench stand ----------
const PLATE = { x: -142, y: -96, w: 236, d: 140, r: 9 };
function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -18, 14, P)}"/>`];
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 8, -18, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -16.2, 2.2, P, 28), { tone: "mid" }));
    rec(A.cylinder(x, y, 8, -18, 4, { name: "stand.foot", ground: true }));
  }
  out.push(S(k.slabOf(PLATE, -14, 14, P, 8, 1.6), { tone: "mid" }));
  rec(A.slab(PLATE, -14, 14, { name: "stand.plate", ground: true }));
  out.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  // two T-slots running along x
  for (const y of [-70, 22]) {
    const slot = { x: PLATE.x + 14, y, w: PLATE.w - 28, d: 7, r: 3.5 };
    out.push(`<path class="en-slot" d="${pathOf(k.roundedPlan(slot, 4).map(([px, py]) => at([px, py, 0])), true)}"/>`);
    out.push(Ln(k.planOutline(slot, 0, P, 4), { tone: "mid" }));
  }
  const screws = k.corners(PLATE, 9);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // ruler strip along the front edge, 5 mm minor, 25 mm major
  const strip = { x: -124, y: PLATE.y + PLATE.d - 16, w: 140, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 5, strip.y + 0.8, 0.7, [2.2, 4.2], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.4, strip.y + 4, 0.7]), at([strip.x + strip.w - 2.4, strip.y + 4, 0.7])], { size: 0.45 }));
  // label plate with three rule lines and two screws
  const label = { x: 30, y: PLATE.y + PLATE.d - 26, w: 46, d: 18, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.9, P, 4), { tone: "lo", crease: "none" }));
  out.push(Ln(k.planOutline(k.insetPlan(label, 1.6), 0.9, P), { tone: "faint" }));
  out.push(Ln(k.lineOnTop([label.x + 6, label.y + 5.5], [label.x + 34, label.y + 5.5], 0.9, P), { tone: "lo", free: true }));
  out.push(Ln(k.lineOnTop([label.x + 6, label.y + 9], [label.x + 40, label.y + 9], 0.9, P), { tone: "lo", free: true }));
  out.push(Ln(k.lineOnTop([label.x + 6, label.y + 12.5], [label.x + 26, label.y + 12.5], 0.9, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.8, label.y + 9, 0.9]), at([label.x + label.w - 2.8, label.y + 9, 0.9])], { size: 0.45 }));
  return out.join("");
}
// two rubber engine mounts under the sump (behind the cut, whole)
function mounts() {
  const out = [];
  for (const x of [-40, 40]) {
    const y = -34;
    const foot = { x: x - 16, y: y - 14, w: 32, d: 28, r: 3 };
    out.push(S(k.slabOf(foot, 0, 4, P, 4, 0.6), { tone: "mid" }));
    rec(A.slab(foot, 0, 4, { name: "stand.mount" }));
    out.push(D([at([foot.x + 5, foot.y + 5, 4]), at([foot.x + foot.w - 5, foot.y + foot.d - 5, 4]), at([foot.x + foot.w - 5, foot.y + 5, 4]), at([foot.x + 5, foot.y + foot.d - 5, 4])], { size: 0.5 }));
    out.push(S(k.cylinder(x, y, 9, 4, 6, P, 28), { tone: "mid" }));
    out.push(`<g class="m-rubber">` + S(k.cylinder(x, y, 11.5, 10, 10, P, 36), { tone: "lo", crease: "none" }) + `</g>`);
    out.push(Ln(k.sideArc(x, y, 11.5, 15, P, 24), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 10, 20, 6, P, 28, 0.5), { tone: "mid" }));
    rec(A.cylinder(x, y, 11.5, 4, 22, { name: "stand.isolator" }));
  }
  return out.join("");
}

// ---------- housings in half-section: back halves as prisms along -y ----------
const SUMP_POLY = [[-62, ZC - 92], [62, ZC - 92], [64, ZC - 62], [70, ZC - 59], [70, ZC - 55], [-70, ZC - 55], [-70, ZC - 59], [-64, ZC - 62]];
const CASE_POLY = [[-66, ZC - 55], [66, ZC - 55], [66, ZC + 78], [58, ZC + 100], [-58, ZC + 100], [-66, ZC + 78]];
const CYL_POLY = rect(-58, 58, ZC + 100, DECK);
const GASKET_POLY = rect(-62, 62, DECK, DECK + 1.5);
const HEAD_POLY = [[-64, DECK + 1.5], [64, DECK + 1.5], [64, HEAD_TOP - 3], [61, HEAD_TOP], [-61, HEAD_TOP], [-64, HEAD_TOP - 3]];
const SADDLES = MV.JOURNALS.map(([a, b]) => [a - 1, b + 1]);
const COVER_POLY = roundRect(-58, 60, HEAD_TOP, CAMZ + 38, 12, 6);
const RUNNER = { x0: -100, x1: -64, z: ZC + 268, r: 16.5, port: 12.4 };
const TB = { x0: -116, x1: -100, r: 20, bore: 15.5 };
const PIECES = [
  { name: "sump", poly: SUMP_POLY, d: 70, m: "m-body-dk" },
  { name: "case", poly: CASE_POLY, d: 74 },
  { name: "cyl", poly: CYL_POLY, d: 54 },
  { name: "gasket", poly: GASKET_POLY, d: 56, tone: "lo", m: "m-brass" },
  { name: "head", poly: HEAD_POLY, d: 58 },
  ...SADDLES.map(([a, b], i) => ({ name: "saddle" + i, poly: rect(a, b, HEAD_TOP, CAMZ), d: 18 })),
  ...SADDLES.map(([a, b], i) => ({ name: "cap" + i, poly: roundRect(a, b, CAMZ, CAMZ + 21, 3, 3), d: 18 })),
  { name: "cover", poly: COVER_POLY, d: 40, m: "m-body-dk" },
];
// the timing backing plate (x 66..70) and the runner/throttle-body halves are prisms along x
const half = (r, n = 36) => Array.from({ length: n + 1 }, (_, i) => { const t = Math.PI + (Math.PI * i) / n; return [r * Math.cos(t), r * Math.sin(t)]; }); // y <= 0 half disc in (y, z)

function housings() {
  const back = [], exterior = [];
  for (const piece of PIECES) {
    const paths = G.prismOf(FY, piece.poly, 0, piece.d, P);
    const svg = `<g class="${piece.m ?? "m-body"}">${S(paths, { tone: piece.tone ?? "mid", crease: "lo" })}</g>`;
    back.push(svg);
    rec(A.prism(FY, piece.poly, 0, piece.d, { name: "engine." + piece.name, ...(piece.name === "cover" ? { cut: A.prism(FY, COVER_IN, -1, 36) } : {}) }));
    // the same solid repainted after the moving parts' back pass, minus its front (section) face
    const id = `ex${clipN++}`;
    exterior.push(`<clipPath id="${id}"><path clip-rule="evenodd" d="${paths.fill}${xz(piece.poly)}"/></clipPath><g clip-path="url(#${id})">${svg}</g>`);
  }
  return { back: back.join(""), exterior: exterior.join("") };
}

// runner + throttle body back halves (prisms along x of a half disc), and the air cleaner (whole)
function intakeBack() {
  const out = [`<g class="m-body">`];
  const o = [0, 0, RUNNER.z];
  out.push(S(G.prismOf(FX(o), half(TB.r), TB.x0, TB.x1, P), { tone: "mid", crease: "lo" }));
  out.push(S(G.prismOf(FX(o), half(RUNNER.r), RUNNER.x0, RUNNER.x1 - 6, P), { tone: "mid", crease: "lo" }));
  out.push(S(G.prismOf(FX(o), half(RUNNER.r + 6), RUNNER.x1 - 6, RUNNER.x1, P), { tone: "mid", crease: "lo" }));
  rec(A.prism(FX(o), half(TB.r), TB.x0, TB.x1, { name: "engine.tb" }));
  rec(A.prism(FX(o), half(RUNNER.r), RUNNER.x0, RUNNER.x1, { name: "engine.runner" }));
  out.push(`</g>`);
  return out.join("");
}
function airCleaner() {
  const o = [-156, 0, RUNNER.z];
  const Fa = FX(o);
  const out = [];
  // neck into the throttle body, the canister with its pleat ribs and two clamps
  out.push(S(G.disc(34, 40, 14, Fa, P, { steps: 48 }), { tone: "mid" }));
  const can = G.solidOf([[0, 30], [3, 33, 1], [31, 33, 1], [34, 30]], Fa, P, { steps: 96 });
  const ribs = G.ribsOf(Fa, 6, 28, 33, 44, P, { fade: [0.05, 0.45] });
  out.push(S(can, { tone: "hi", inner: k.fadedSvg(ribs, { tone: "faint" }) + Ln(G.arcOf(Fa, 6, 33, P, {}) + G.arcOf(Fa, 28, 33, P, {}), { tone: "lo" }) }));
  // end lid: wing nut boss on the far (-x) side is hidden; draw the +x face ring and its four clip dots
  out.push(Ln(G.circleOf(Fa, 34, 22, P), { tone: "lo" }));
  out.push(D(G.dotsOf(Fa, 34, 27, 6, P, { all: true }), { size: 0.6, tone: "mid" }));
  rec(A.solid(Fa, [[0, 30], [3, 33, 1], [31, 33, 1], [34, 30]], { name: "engine.cleaner" }));
  rec(A.disc(Fa, 34, 40, 14, { name: "engine.cleaner-neck" }));
  return `<g class="m-body-lt">${out.join("")}</g>`;
}
// hose clamp band around the neck
function backingPlate() {
  const pts = [];
  for (const [c, r] of [[[0, ZC], 30], [[0, CAMZ], 46], [MV.PUL.idler.c, 21]]) for (let i = 0; i < 48; i++) { const t = (i / 48) * Math.PI * 2; pts.push([c[0] + r * Math.sin(t), c[1] + r * Math.cos(t)]); }
  const full = G.hullOf(pts);
  const back = MV.frontHalf(full.map(([y, z]) => [-y, z])).map(([y, z]) => [-y, z]);
  const paths = G.prismOf(FX([0, 0, 0]), back, 66, 70, P);
  const out = [`<g class="m-body-dk">`, S(paths, { tone: "mid", crease: "lo" })];
  rec(A.prism(FX([0, 0, 0]), back, 66, 70, { name: "engine.backplate" }));
  // bolt heads on the plate's face (x = 70), on the back half only
  const bolts = [[-24, ZC + 30], [-26, ZC + 120], [-30, CAMZ - 40], [-14, CAMZ + 40], [-24, ZC - 22]];
  out.push(D(bolts.map(([y, z]) => at([70, y, z])), { size: 1.2, tone: "mid" }));
  out.push(Ln(bolts.map(([y, z]) => pathOf(Array.from({ length: 17 }, (_, i) => { const t = (i / 16) * Math.PI * 2; return at([70, y + 3 * Math.cos(t), z + 3 * Math.sin(t)]); }))).join(""), { tone: "lo" }));
  // its section edge (y = 0): a thin strip
  const secPts = [];
  for (const [y, z] of full) if (Math.abs(y) < 1e-6) secPts.push(z);
  // tensioner arm: pivot boss on the plate and an arm to the idler
  const pivot = [-14, ZC + 210];
  const idl = MV.PUL.idler.c;
  const arm = G.hullOf([...MV.circle(pivot[0], pivot[1], 7, 20), ...MV.circle(idl[0], idl[1], 8, 20)]);
  out.push(`</g>`, `<g class="m-teal-dk">`, S(G.prismOf(FX([0, 0, 0]), arm, 70, 73, P), { tone: "mid", crease: "lo" }));
  out.push(D([at([73, pivot[0], pivot[1]])], { size: 1.3, tone: "hi" }));
  out.push(Ln(pathOf(MV.circle(pivot[0], pivot[1], 3.6, 20).map(([y, z]) => at([73, y, z])), true), { tone: "lo" }));
  rec(A.prism(FX([0, 0, 0]), arm, 70, 73, { name: "engine.tensioner" }));
  out.push(`</g>`);
  return { svg: out.join(""), poly: full, back };
}

// ---------- the cut: section face (one plane, y = 0) ----------
const BLOCK_L = [[-66, ZC + 22.5], [-56, ZC + 22.5], [-56, ZC + 72], [-45, ZC + 92], [-45, DECK], [-58, DECK], [-58, ZC + 100], [-66, ZC + 78]];
const BLOCK_R = BLOCK_L.map(([x, z]) => [-x, z]).reverse();
const LOW_L = rect(-66, -56, ZC - 55, ZC - 22.5), LOW_R = rect(56, 66, ZC - 55, ZC - 22.5);
// intake port centreline (x, z) and half widths
const PORT_IN = [[-19, SEAT + 2, 13], [-21, SEAT + 13, 12], [-28, SEAT + 25, 11.6], [-40, SEAT + 36, 12], [-54, ZC + 266, 12.3], [-64, RUNNER.z, RUNNER.port], [-100, RUNNER.z, RUNNER.port], [-100.01, RUNNER.z, TB.bore], [-118, RUNNER.z, TB.bore]];
function band(line) {
  const left = [], right = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    let t = [b[0] - a[0], b[1] - a[1]];
    const l = Math.hypot(t[0], t[1]) || 1;
    t = [t[0] / l, t[1] / l];
    const n = [-t[1], t[0]];
    const [x, z, w] = line[i];
    left.push([x + n[0] * w, z + n[1] * w]);
    right.push([x - n[0] * w, z - n[1] * w]);
  }
  return [...left, ...right.reverse()];
}
const PORT_IN_POLY = band(PORT_IN);
const BOWL_EX = [[6, SEAT - 1], [32, SEAT - 1], [31, SEAT + 12], [26, SEAT + 21], [12, SEAT + 21], [7, SEAT + 12]];
const CHAMBER = [[-40, DECK - 0.5], [40, DECK - 0.5], [38, DECK + 2], [34, SEAT], [-34, SEAT], [-38, DECK + 2]];
const BORE_HOLE = [[-56, ZC - 60], [56, ZC - 60], [56, ZC + 72], [45, ZC + 92], [45, DECK + 0.4], [-45, DECK + 0.4], [-45, ZC + 92], [-56, ZC + 72]];
const SPRING_SEAT = MV.SPRING_SEAT;
const BUCKET_BOT = ZC + 276;
const valveHoles = (xv) => [
  rect(xv - 6.6, xv + 6.6, SEAT, SPRING_SEAT + 8), // guide boss bore (guide drawn on top)
  rect(xv - 11, xv + 11, SPRING_SEAT, BUCKET_BOT + 1), // spring pocket
  rect(xv - 13.4, xv + 13.4, BUCKET_BOT, HEAD_TOP + 2), // bucket bore, open into the cam cover
];
const COVER_IN = roundRect(-54, 56, HEAD_TOP - 1, CAMZ + 34, 4, 4);
const HOLES = [
  BORE_HOLE,
  rect(50, 74, ZC - 22.5, ZC + 22.5), rect(-74, -50, ZC - 22.5, ZC + 22.5), // main bearing bores
  roundRect(-55, -48.5, ZC + 126, DECK - 4, 3), roundRect(48.5, 55, ZC + 126, DECK - 4, 3), // block water jacket
  disc2(-61, ZC + 46, 3.2), // oil gallery
  CHAMBER, PORT_IN_POLY, BOWL_EX,
  ...valveHoles(M.VALVES.in), ...valveHoles(M.VALVES.ex),
  roundRect(40, 57, SEAT + 2, SEAT + 44, 4), roundRect(-58, -46, DECK + 5, SEAT + 12, 3), // head water jacket
  roundRect(-6, 36, SEAT + 52, SEAT + 64, 4), // head oil drain/jacket between pockets
  COVER_IN,
  ...SADDLES.map(([a, b]) => rect(a - 2, b + 2, CAMZ - 12.6, CAMZ + 12.6)),
  [[-59.5, ZC - 89.5], [59.5, ZC - 89.5], [61.5, ZC - 62], [62, ZC - 50], [-62, ZC - 50], [-61.5, ZC - 62]], // sump inside
];
// material drawn on top of the cut (own tones): liner, seats, guides, bearing shells
const LINERS = [rect(-45, -40, ZC + 92, DECK), rect(40, 45, ZC + 92, DECK)];
const SEATS = [];
for (const [xv, rh] of [[M.VALVES.in, 16], [M.VALVES.ex, 14]]) for (const s of [-1, 1]) SEATS.push([[xv + s * (rh - 1.6), SEAT], [xv + s * (rh + 3), SEAT], [xv + s * (rh + 3), SEAT + 4.5], [xv + s * (rh - 0.2), SEAT + 4.5]]);
const GUIDES = [];
for (const xv of [M.VALVES.in, M.VALVES.ex]) for (const s of [-1, 1]) GUIDES.push(rect(xv + s * 3.7, xv + s * 6.6, SEAT + 19, SPRING_SEAT + 8).map(([x, z]) => [x, z]));
const SHELLS = [rect(56, 66, ZC + 20.1, ZC + 22.5), rect(56, 66, ZC - 22.5, ZC - 20.1), rect(-66, -56, ZC + 20.1, ZC + 22.5), rect(-66, -56, ZC - 22.5, ZC - 20.1)];
const CAM_SHELLS = SADDLES.flatMap(([a, b]) => [rect(a, b, CAMZ + 12.6 - 1.6, CAMZ + 12.6), rect(a, b, CAMZ - 12.6, CAMZ - 11)]);
// the section of the runner + throttle body walls
const RUNNER_SEC = [rect(RUNNER.x0, RUNNER.x1, RUNNER.z - RUNNER.r, RUNNER.z + RUNNER.r), rect(RUNNER.x1 - 6, RUNNER.x1, RUNNER.z - RUNNER.r - 6, RUNNER.z + RUNNER.r + 6), rect(TB.x0, TB.x1, RUNNER.z - TB.r, RUNNER.z + TB.r)];
const OUT_M = [[SUMP_POLY, "cut-iron"], [BLOCK_L, "cut-alu"], [BLOCK_R, "cut-alu"], [LOW_L, "cut-alu"], [LOW_R, "cut-alu"], [GASKET_POLY, "cut-copper"], [HEAD_POLY, "cut-alu"], ...PIECES.filter((p) => /saddle|cap/.test(p.name)).map((p) => [p.poly, "cut-alu"]), [COVER_POLY, "cut-red"], ...RUNNER_SEC.map((p) => [p, "cut-alu"])];
const OUTERS = OUT_M.map(([p]) => p);

function section(plate) {
  const outerD = OUTERS.map((p) => xz(p)).join("");
  const holesD = HOLES.map((p) => xz(p)).join("");
  const plateSec = plate.poly.length ? "" : "";
  const mask = `<mask id="sec-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="${outerD}" fill="#fff" stroke="#fff" stroke-width="0.8"/><path d="${holesD}" fill="#000"/></mask>`;
  const face = `<g mask="url(#sec-mask)">` + OUT_M.map(([p, c]) => `<path class="en-cut ${c}" d="${xz(p)}"/>`).join("") +
    `<path class="en-hatch" d="${outerD}"/><path class="en-cut-edge" d="${holesD}"/>` + OUTERS.map((p) => `<path class="iso-line" data-tone="hi" d="${xz(p)}"/>`).join("") + `</g>`;
  const strip = (polys, cls) => polys.map((p) => `<path class="${cls}" d="${xz(p)}"/>`).join("");
  const material = strip(LINERS, "en-liner") + strip(SEATS, "en-seat") + strip(GUIDES, "en-guide") + strip(SHELLS, "en-shell") + strip(CAM_SHELLS, "en-shell");
  // throttle butterfly (shaft and plate, sectioned) and the head-bolt holes' centre lines are left out on purpose
  const tbx = (TB.x0 + TB.x1) / 2;
  const butterfly = `<path class="iso-line" data-tone="hi" style="stroke-width:1.4" d="${pathOf([at([tbx - 3, 0, RUNNER.z - TB.bore]), at([tbx + 3, 0, RUNNER.z + TB.bore])])}"/>` + D([at([tbx, 0, RUNNER.z])], { size: 1.6, tone: "hi" });
  return { mask, face, material, butterfly };
}

// cavity backgrounds and the interior surfaces seen through the cut
function cavities() {
  const out = [];
  const outerD = OUTERS.map((p) => xz(p)).join("");
  out.push(`<clipPath id="cav-clip"><path d="${outerD}"/></clipPath><g clip-path="url(#cav-clip)">`);
  out.push(`<path class="en-cav" d="${HOLES.map((p) => xz(p)).join("")}"/>`);
  const quad = (pts, normal, cls = "en-in") => `<path class="${cls}" data-shade="${Math.min(3, G.toneOf(normal, P))}" d="${pathOf(pts.map(at), true)}"/>`;
  // crankcase: back wall and left wall
  out.push(quad([[-56, -66, ZC - 60], [56, -66, ZC - 60], [56, -66, ZC + 72], [-56, -66, ZC + 72]], [0, 1, 0]));
  out.push(quad([[-56, 0, ZC - 60], [-56, -66, ZC - 60], [-56, -66, ZC + 72], [-56, 0, ZC + 72]], [1, 0, 0]));
  // crankcase roof slopes (visible from below? no) -> skip; bore: concave half cylinder (liner inside)
  const bore = (cx, r, z0, z1, n = 40) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI + (Math.PI * i) / n, a1 = Math.PI + (Math.PI * (i + 1)) / n;
      const am = (a0 + a1) / 2;
      const normal = [-Math.cos(am), -Math.sin(am), 0];
      if (G.dot3(normal, V) <= 0) continue;
      s += quad([[cx + r * Math.cos(a0), r * Math.sin(a0), z0], [cx + r * Math.cos(a1), r * Math.sin(a1), z0], [cx + r * Math.cos(a1), r * Math.sin(a1), z1], [cx + r * Math.cos(a0), r * Math.sin(a0), z1]], normal);
    }
    return s;
  };
  out.push(bore(0, 40, ZC + 92, DECK));
  // honing cross-hatch on the liner is a texture: skip; a faint ring at the top of ring travel
  for (const xv of [M.VALVES.in, M.VALVES.ex]) { out.push(bore(xv, 13.4, BUCKET_BOT, HEAD_TOP)); out.push(bore(xv, 11, SPRING_SEAT, BUCKET_BOT)); }
  // sump: back wall, oil (top surface going back + its section at y = 0)
  out.push(quad([[-59.5, -67, ZC - 89.5], [59.5, -67, ZC - 89.5], [59.5, -67, ZC - 55], [-59.5, -67, ZC - 55]], [0, 1, 0]));
  const OIL = ZC - 77;
  out.push(`<path class="en-oil-top" d="${pathOf([[-59.5, 0, OIL], [59.5, 0, OIL], [59.5, -67, OIL], [-59.5, -67, OIL]].map(at), true)}"/>`);
  out.push(`<path class="en-oil" d="${xz([[-59.5, ZC - 89.5], [59.5, ZC - 89.5], [59.5, OIL], [-59.5, OIL]])}"/>`);
  out.push(Ln(pathOf([at([-59.5, 0, OIL]), at([59.5, 0, OIL])]), { tone: "mid" }));
  // coolant in the jackets
  const jackets = [roundRect(-55, -48.5, ZC + 126, DECK - 4, 3), roundRect(48.5, 55, ZC + 126, DECK - 4, 3), roundRect(40, 57, SEAT + 2, SEAT + 44, 4), roundRect(-58, -46, DECK + 5, SEAT + 12, 3), roundRect(-6, 36, SEAT + 52, SEAT + 64, 4)];
  out.push(`<path class="en-coolant" d="${jackets.map((p) => xz(p)).join("")}"/>`);
  // the exhaust port receding to the back: a darker throat inside the bowl
  const throat = [[11, SEAT + 6], [27, SEAT + 6], [26, SEAT + 19], [12, SEAT + 19]].map(([x, z]) => [x, -26, z]);
  out.push(`<path class="en-deep" d="${pathOf(throat.map(at), true)}"/>`);
  // the intake port's far wall: a second, darker band along its centreline
  out.push(`<path class="en-deep" d="${xz(band(PORT_IN.slice(1, -2).map(([x, z, w]) => [x, z, w * 0.55])), -10)}"/>`);
  // cam cover inside: back wall
  out.push(quad([[-54, -36, HEAD_TOP], [56, -36, HEAD_TOP], [56, -36, CAMZ + 34], [-54, -36, CAMZ + 34]], [0, 1, 0]));
  out.push(`</g>`);
  return out.join("");
}

// ---------- stack (behind the head), spark plug (in front) ----------
function stack() {
  const out = [];
  const portZ = SEAT + 13;
  const route = G.fillet([[M.VALVES.ex, -58, portZ], [M.VALVES.ex, STACK.y, portZ], [STACK.x, STACK.y, portZ + 40], [STACK.x, STACK.y, STACK.top]], 22, 8, { P, tube: STACK.r });
  const pieces = tubePieces(route, STACK.r, P, { maxLength: 400, gaps: [[0, 6]] });
  for (const piece of pieces) out.push(tubeSvg(piece, { tone: "hi" }));
  R.route("stack.pipe", route, STACK.r, { gaps: [[0, 6]], free: [false, true] });
  // flange on the head's back face
  const Fl = G.frameOf([M.VALVES.ex, -58, portZ], [0, -1, 0], X, Z);
  out.unshift(S(G.disc(0, 6, 19, Fl, P, { steps: 64 }), { tone: "mid" }) + D(G.dotsOf(Fl, 6, 15.5, 4, P, { phase: Math.PI / 4, all: true }), { size: 0.9, tone: "hi" }));
  rec(A.disc(Fl, 0, 6, 19, { name: "stack.flange", owner: "stack.pipe" }));
  // a clamp band near the top and a hinged rain cap (the page lifts it with each exhaust pulse)
  const Fs = G.frameOf([STACK.x, STACK.y, STACK.top - 26], Z, X, Y);
  return `<g class="m-exh">${out.join("")}</g>`;
}
function rainCap() {
  // built closed, hinged at the back edge (y = STACK.y - r); the page rotates it about that hinge
  const o = [STACK.x, STACK.y, STACK.top];
  const Fc = FZ(o);
  rec(A.disc(Fc, 0, 4, STACK.r + 2.4, { name: "stack.cap" }));
  const cap = S(G.solidOf([[0, STACK.r + 2.4], [2, STACK.r + 2.4], [3.4, STACK.r - 2, 1], [4, 0]], Fc, P, { steps: 56 }), { tone: "hi" });
  return `<g class="m-exh">${cap}</g>`;
}
const PLUG = (() => {
  const a = G.unit3([0.34, 0.4, 0.85]);
  // seat the thread on the section plane: its rim just touches y = 0 (the head material it screws into)
  const base = [1.5, 7 * Math.sqrt(1 - a[1] * a[1]) - 0.05, SEAT + 0.4];
  return { base, a, F: G.frameAlong(base, a) };
})();
function sparkPlug() {
  const { F: Fp } = PLUG;
  const out = [];
  // thread, hex, shell, ribbed white insulator, terminal nut
  out.push(`<g class="m-red">`);
  out.push(S(G.disc(0, 13, 6.2, Fp, P, { steps: 40 }), { tone: "mid", inner: Ln(G.ribsOf(Fp, 1, 12, 6.2, 10, P, { twist: 0.9, least: 0.2 }), { tone: "lo" }) }));
  out.push(`</g><g class="m-plug">`);
  const hex = Array.from({ length: 6 }, (_, i) => [9 * Math.cos((i * Math.PI) / 3), 9 * Math.sin((i * Math.PI) / 3)]);
  out.push(S(G.prismOf(Fp, hex, 13, 22, P), { tone: "mid", crease: "lo" }));
  out.push(S(G.disc(22, 26, 7.2, Fp, P, { steps: 40 }), { tone: "mid" }));
  const ins = [[26, 5.6], [29, 5.6], [30, 5.2, 1], [52, 4.8, 1], [54, 4.4], [54, 0]];
  const ribArcs = [32, 36, 40, 44, 48].map((s) => G.arcOf(Fp, s, 5.1, P, {})).join("");
  out.push(`</g><g class="m-ceramic">`, S(G.solidOf(ins.slice(0, -1), Fp, P, { steps: 48 }), { tone: "hi", lit: false, inner: Ln(ribArcs, { tone: "faint" }) }), `</g><g class="m-red">`);
  out.push(S(G.disc(54, 60, 2.6, Fp, P, { steps: 24 }), { tone: "mid" }));
  out.push(S(G.disc(60, 64, 3.8, Fp, P, { steps: 28 }), { tone: "mid" }));
  rec(A.disc(Fp, 0, 64, 7, { name: "engine.plug" }));
  out.push(`</g>`);
  return out.join("");
}

// ---------- crank journals (round, so static in both passes) ----------
function journals() {
  const O = [0, 0, ZC];
  const c20 = MV.circle(0, 0, 20, 48), c15 = MV.circle(0, 0, 15, 40), c28 = MV.circle(0, 0, 28, 56);
  const part = (poly, s0, s1, tone, name) => {
    const markup = `<g class="m-move">${S(G.prismOf(FX(O), poly, s0, s1, P), { tone, crease: "lo" })}</g>`;
    return { back: markup, front: MV.clipped(name, [MV.prismFrontHull(O, poly, s0, s1)], markup) };
  };
  return {
    rear: part(c20, -66, -25, "hi", "jr"),
    front: part(c20, 25, 66, "hi", "jf"),
    snout: `<g class="m-move">` + S(G.prismOf(FX(O), c15, 66, 74, P), { tone: "mid", crease: "lo" }) + S(G.prismOf(FX(O), MV.circle(0, 0, 17, 40), 66, 67.6, P), { tone: "lo", crease: "none" }) + `</g>`,
    tail: `<g class="m-move-dk">` + S(G.prismOf(FX(O), c28, -74, -70, P), { tone: "mid", crease: "lo" }) + S(G.prismOf(FX(O), c20, -70, -66, P), { tone: "hi", crease: "lo" }) + `</g>`,
    camSnout: `<g class="m-teal">` + S(G.prismOf(FX([0, 0, CAMZ]), MV.circle(0, 0, 9, 32), 64, 74, P), { tone: "mid", crease: "lo" }) + `</g>`,
  };
}

// ---------- assemble ----------
const theta0 = F.crankAt(0);
const plate = backingPlate();
const H0 = housings();
const SEC = section(plate);
const J = journals();

function movingPass(theta, pass) {
  const lifts = { in: F.lift(theta, "in"), ex: F.lift(theta, "ex") };
  const parts = [];
  parts.push(J.rear[pass]);
  parts.push(`<g data-m="crank-${pass}">${crankMarkup(theta, pass)}</g>`);
  parts.push(J.front[pass]);
  parts.push(`<g data-m="piston-${pass}" transform="${k.translateAlong(P, [0, 0, ZC + F.pinZ(theta)])}">${MV.piston()[pass].replaceAll('id="cl-', `id="cl${pass}-`).replaceAll("url(#cl-", `url(#cl${pass}-`)}</g>`);
  for (const which of ["in", "ex"]) {
    const sp = MV.spring(which, lifts[which]);
    const v = MV.valve(which)[pass], fo = MV.follower(which)[pass];
    const fix = (s) => s.replaceAll('id="cl-', `id="cl${pass}-`).replaceAll("url(#cl-", `url(#cl${pass}-`);
    const tr = k.translateAlong(P, [0, 0, -lifts[which]]);
    if (pass === "back") parts.push(`<g data-m="spring-${which}-${pass}">${sp.back}</g>`);
    parts.push(`<g data-m="valve-${which}-${pass}" transform="${tr}">${fix(v)}</g>`);
    if (pass === "front") parts.push(`<g data-m="spring-${which}-${pass}">${sp.front}</g>`);
    parts.push(`<g data-m="follower-${which}-${pass}" transform="${tr}">${fix(fo)}</g>`);
  }
  parts.push(`<g data-m="cam-${pass}">${fixIds(MV.cam(theta)[pass], pass)}</g>`);
  return parts.join("");
}
function fixIds(s, pass) { return s.replaceAll('id="cl-', `id="cl${pass}-`).replaceAll("url(#cl-", `url(#cl${pass}-`); }
function crankMarkup(theta, pass) {
  const w1 = MV.web(theta, -MV.CR.webOut, -MV.CR.webIn, "w1"), pin = MV.crankPinPart(theta), rod = MV.rod(theta), w2 = MV.web(theta, MV.CR.webIn, MV.CR.webOut, "w2");
  return fixIds(w1[pass] + pin[pass] + rod[pass] + w2[pass], pass);
}

const GAS_CLIP = [CHAMBER, rect(-40, 40, ZC + 80, DECK)];
const body = [
  `<defs>
    <radialGradient id="g-burn" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--en-burn-core)" stop-opacity="1"/><stop offset="0.28" stop-color="var(--en-burn-mid)" stop-opacity="0.92"/><stop offset="0.62" stop-color="var(--en-burn-rim)" stop-opacity="0.55"/><stop offset="1" stop-color="var(--en-burn-rim)" stop-opacity="0"/></radialGradient>
    <radialGradient id="g-mist" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--en-mist)" stop-opacity="0.85"/><stop offset="1" stop-color="var(--en-mist)" stop-opacity="0"/></radialGradient>
    <radialGradient id="g-smoke" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--en-smoke)" stop-opacity="0.7"/><stop offset="1" stop-color="var(--en-smoke)" stop-opacity="0"/></radialGradient>
    <radialGradient id="g-spark" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff3e8" stop-opacity="1"/><stop offset="0.3" stop-color="var(--en-spark)" stop-opacity="0.95"/><stop offset="1" stop-color="var(--en-spark)" stop-opacity="0"/></radialGradient>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="3.4" height="3.4" patternTransform="rotate(45)"><path class="en-hatch-line" d="M0 0V3.4"/></pattern>
    <clipPath id="gas-clip"><path d="${GAS_CLIP.map((p) => xz(p)).join("")}"/></clipPath>
    <clipPath id="port-in-clip"><path d="${xz(PORT_IN_POLY)}"/></clipPath>
    <clipPath id="bowl-clip"><path d="${xz(BOWL_EX)}"/></clipPath>
    ${SEC.mask}
  </defs>`,
  `<g class="m-stand">${stand()}</g>`,
  mounts(),
  airCleaner(),
  `<g data-part="puffs"></g>`,
  stack(),
  `<g data-part="raincap">${rainCap()}</g>`,
  J.tail,
  `<g data-part="flywheel">${MV.flywheel(theta0)}</g>`,
  intakeBack(),
  H0.back,
  cavities(),
  `<g data-part="back">${movingPass(theta0, "back")}</g>`,
  `<g data-part="gas" clip-path="url(#gas-clip)"></g>`,
  `<g data-part="flow-in" clip-path="url(#port-in-clip)"></g>`,
  `<g data-part="flow-ex" clip-path="url(#bowl-clip)"></g>`,
  H0.exterior,
  SEC.face,
  SEC.material,
  SEC.butterfly,
  plate.svg,
  `<g data-part="front">${movingPass(theta0, "front")}</g>`,
  J.snout,
  J.camSnout,
  `<g data-part="drive">${MV.drive(theta0)}</g>`,
  sparkPlug(),
  `<g data-part="spark"></g>`,
];

const LABEL = "A single-cylinder four-stroke petrol engine on a bench stand, cut in half through the bore: block with a dry liner and water jackets, piston with three rings on a 140 mm connecting rod, a built-up crankshaft with counterweights and a flywheel, an overhead camshaft driven by a toothed belt from a pulley half the size of its own, two poppet valves with springs and bucket tappets, a spark plug, an intake runner with a throttle and an air cleaner, and an exhaust stack with a rain cap.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body, className: "en-svg" });

// ---------- live code ----------
const CSS = `
.iso{--en-cav:#7d96b4;--en-in-0:#6f8aac;--en-in-1:#7b95b5;--en-in-2:#88a1bf;--en-in-3:#96adc9;--en-deep:#5f7a9c;
  --en-liner:#d9e3ee;--en-seat:#e2b456;--en-guide:#e6c272;--en-shell:#e9c879;--en-oil:#c99a3c;--en-oil-top:#ddb662;--en-coolant:#a9d9e6;
  --en-mist:#7fc6ea;--en-burn-core:#fff6cf;--en-burn-mid:#ffbf3f;--en-burn-rim:#f47a1f;--en-smoke:#9b9a96;--en-spark:#d6453d;--en-wire:#c08f2e;--en-wire-back:#8d6620;
  --en-hatch:#4d6f97}
.iso[data-theme="dark"]{--en-cav:#0d0f12;--en-in-0:#0b0d10;--en-in-1:#0e1014;--en-in-2:#121519;--en-in-3:#16191e;--en-deep:#07080a;--en-liner:#2a3038;--en-coolant:#1b2a2e}
.m-body{--anatomy-paper:#9fb5cf;--anatomy-face:#a9bed6;--anatomy-top:#bccde0;--anatomy-shade-0:#5b7fa6;--anatomy-shade-1:#6889b0;--anatomy-shade-2:#7895ba;--anatomy-shade-3:#89a3c4;--anatomy-hi:#1d2e44;--anatomy-mid:#3d5677;--anatomy-lo:#55708f;--anatomy-faint:#7690ae;--anatomy-dot:#1d2e44}
.m-body-lt{--anatomy-paper:#a9bed6;--anatomy-face:#b3c6dc;--anatomy-top:#c6d5e6;--anatomy-shade-0:#6587ae;--anatomy-shade-1:#7491b6;--anatomy-shade-2:#839ec0;--anatomy-shade-3:#93abca;--anatomy-hi:#1d2e44;--anatomy-mid:#3d5677;--anatomy-lo:#5a7594;--anatomy-faint:#7d97b4;--anatomy-dot:#1d2e44}
.m-body-dk{--anatomy-paper:#8aa3c1;--anatomy-face:#94acc8;--anatomy-top:#a9bed6;--anatomy-shade-0:#4c6d93;--anatomy-shade-1:#58799f;--anatomy-shade-2:#6585aa;--anatomy-shade-3:#7493b6;--anatomy-hi:#172539;--anatomy-mid:#334b6a;--anatomy-lo:#4a6584;--anatomy-faint:#67829f;--anatomy-dot:#172539}
.m-move{--anatomy-paper:#f0a066;--anatomy-face:#f3ab78;--anatomy-top:#f8c49b;--anatomy-shade-0:#c9662a;--anatomy-shade-1:#d87531;--anatomy-shade-2:#e8823a;--anatomy-shade-3:#ec9352;--anatomy-hi:#4a220c;--anatomy-mid:#8a4419;--anatomy-lo:#b4602a;--anatomy-faint:#d48650;--anatomy-dot:#4a220c;--anatomy-lit-top:#fbd2b0;--anatomy-lit-shade:#f2a873;--anatomy-lit:#3a1806}
.m-move-dk{--anatomy-paper:#e48b4c;--anatomy-face:#e8975c;--anatomy-top:#f2b07f;--anatomy-shade-0:#b4561f;--anatomy-shade-1:#c46427;--anatomy-shade-2:#d4722f;--anatomy-shade-3:#df8240;--anatomy-hi:#40190a;--anatomy-mid:#7c3a14;--anatomy-lo:#a25423;--anatomy-faint:#c47442;--anatomy-dot:#40190a}
.m-piston{--anatomy-paper:#f5b582;--anatomy-face:#f7bf91;--anatomy-top:#fbd6b6;--anatomy-shade-0:#d4743a;--anatomy-shade-1:#e08446;--anatomy-shade-2:#e99558;--anatomy-shade-3:#efa86f;--anatomy-hi:#4a220c;--anatomy-mid:#8a4419;--anatomy-lo:#b4602a;--anatomy-faint:#d48650;--anatomy-dot:#4a220c;--anatomy-lit-top:#fde0c6;--anatomy-lit-shade:#f3ae79;--anatomy-lit:#3a1806}
.m-teal{--anatomy-paper:#5fb8b4;--anatomy-face:#72c2be;--anatomy-top:#93d3cf;--anatomy-shade-0:#22706d;--anatomy-shade-1:#288784;--anatomy-shade-2:#2f9e9a;--anatomy-shade-3:#45aba7;--anatomy-hi:#0b3331;--anatomy-mid:#185a57;--anatomy-lo:#2a7c78;--anatomy-faint:#4aa29e;--anatomy-dot:#0b3331}
.m-teal-dk{--anatomy-paper:#4aa7a3;--anatomy-face:#5bb1ad;--anatomy-top:#7ec6c2;--anatomy-shade-0:#1c5f5c;--anatomy-shade-1:#227573;--anatomy-shade-2:#298a86;--anatomy-shade-3:#389894;--anatomy-hi:#082a28;--anatomy-mid:#144b48;--anatomy-lo:#236d69;--anatomy-faint:#3f918d;--anatomy-dot:#082a28}
.m-belt{--anatomy-paper:#2f6f6c;--anatomy-face:#367a77;--anatomy-top:#4a8c89;--anatomy-shade-0:#163d3b;--anatomy-shade-1:#1b4a48;--anatomy-shade-2:#215856;--anatomy-shade-3:#286563;--anatomy-hi:#071c1b;--anatomy-mid:#5f9f9b;--anatomy-lo:#4f8e8a;--anatomy-faint:#3d7b78;--anatomy-dot:#071c1b}
.m-brass{--anatomy-paper:#e6bb62;--anatomy-face:#eac57a;--anatomy-top:#f2d696;--anatomy-shade-0:#a5762a;--anatomy-shade-1:#c28d33;--anatomy-shade-2:#d9a441;--anatomy-shade-3:#deb055;--anatomy-hi:#4a3410;--anatomy-mid:#7d5a1c;--anatomy-lo:#a87c2c;--anatomy-faint:#c99a45;--anatomy-dot:#4a3410}
.m-red{--anatomy-paper:#e0645c;--anatomy-face:#e4766f;--anatomy-top:#ee9b95;--anatomy-shade-0:#9e2c26;--anatomy-shade-1:#b8352f;--anatomy-shade-2:#d6453d;--anatomy-shade-3:#dc5850;--anatomy-hi:#3f0e0b;--anatomy-mid:#7e1f1a;--anatomy-lo:#a8302a;--anatomy-faint:#c94c45;--anatomy-dot:#3f0e0b}
.m-plug{--anatomy-paper:#b9c1ca;--anatomy-face:#c4cbd3;--anatomy-top:#d6dce2;--anatomy-shade-0:#76818d;--anatomy-shade-1:#86909b;--anatomy-shade-2:#969fa9;--anatomy-shade-3:#a7afb8;--anatomy-hi:#1f262e;--anatomy-mid:#4b5560;--anatomy-lo:#6b7580;--anatomy-faint:#8d969f;--anatomy-dot:#1f262e}
.m-exh{--anatomy-paper:#b9b9b6;--anatomy-face:#c3c3c0;--anatomy-top:#d4d4d1;--anatomy-shade-0:#7c7c79;--anatomy-shade-1:#8a8a87;--anatomy-shade-2:#999995;--anatomy-shade-3:#a8a8a4;--anatomy-hi:#262624;--anatomy-mid:#555552;--anatomy-lo:#71716e;--anatomy-faint:#8f8f8b;--anatomy-dot:#262624}
.m-rubber{--anatomy-paper:#4a4c51;--anatomy-face:#55585d;--anatomy-top:#66696f;--anatomy-shade-0:#2a2c30;--anatomy-shade-1:#323438;--anatomy-shade-2:#3b3d42;--anatomy-shade-3:#44464b;--anatomy-hi:#111214;--anatomy-mid:#7a7d83;--anatomy-lo:#6e7177;--anatomy-faint:#5c5f65}
.m-ceramic{--anatomy-paper:#f7f6f1;--anatomy-top:#ffffff;--anatomy-shade-0:#d9d6cc;--anatomy-shade-1:#e4e1d8;--anatomy-shade-2:#ecebe4;--anatomy-shade-3:#f3f2ec}
.m-stand{--anatomy-paper:#e6e2d8;--anatomy-face:#ebe7de;--anatomy-top:#f0ece4;--anatomy-shade-0:#c4bfb2;--anatomy-shade-1:#cfcabe;--anatomy-shade-2:#d9d4c9;--anatomy-shade-3:#e1ddd3}
.cut-alu{fill:#cddbea}.cut-iron{fill:#c2d2e4}.cut-red{fill:#c2d2e4}.cut-copper{fill:#f1d89c}
.en-hatch{fill:url(#hatch);stroke:none;opacity:.55}
.en-hatch-line{stroke:var(--en-hatch);stroke-width:.45px;fill:none}
.en-cut{stroke:none}
.en-cut-edge{fill:none;stroke:var(--anatomy-hi);stroke-width:1.2px;stroke-linejoin:round}
.en-cav{fill:var(--en-cav)}
.en-in[data-shade="0"]{fill:var(--en-in-0)}.en-in[data-shade="1"]{fill:var(--en-in-1)}.en-in[data-shade="2"]{fill:var(--en-in-2)}.en-in[data-shade="3"]{fill:var(--en-in-3)}
.en-in{stroke-width:.35px}
.en-in[data-shade="0"]{stroke:var(--en-in-0)}.en-in[data-shade="1"]{stroke:var(--en-in-1)}.en-in[data-shade="2"]{stroke:var(--en-in-2)}.en-in[data-shade="3"]{stroke:var(--en-in-3)}
.en-deep{fill:var(--en-deep)}
.en-liner{fill:var(--en-liner);stroke:var(--anatomy-hi);stroke-width:.6px}
.en-seat{fill:var(--en-seat);stroke:var(--anatomy-hi);stroke-width:.6px}
.en-guide{fill:var(--en-guide);stroke:var(--anatomy-hi);stroke-width:.6px}
.en-shell{fill:var(--en-shell);stroke:var(--anatomy-mid);stroke-width:.5px}
.en-oil{fill:var(--en-oil);opacity:.8}.en-oil-top{fill:var(--en-oil-top);opacity:.85}
.en-coolant{fill:var(--en-coolant)}
.en-slot{fill:var(--anatomy-shade-0)}
.en-bore{fill:var(--anatomy-shade-0);stroke:var(--anatomy-mid);stroke-width:.5px}
.en-drill{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:.5px}
.en-washer{fill:var(--anatomy-top);stroke:var(--anatomy-lo);stroke-width:.5px}
.en-wire{fill:none;stroke:var(--en-wire);stroke-width:2.1px;stroke-linecap:round;stroke-linejoin:round}
.en-wire-back{stroke:var(--en-wire-back);stroke-width:1.6px}
.en-belt-in[data-shade]{opacity:.9}
.en-belt-side{fill:var(--anatomy-shade-3)}
.en-svg path{vector-effect:non-scaling-stroke}
`;
const latheSource = readFileSync(join(SKILL, "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheSource}\nreturn { viewOf, lightOf, scaleOf, frameAlong, frameOf, pointOf, disc, sphereOf, prismOf, circleOf, arcOf, ribsOf, dotsOf, lathe, solidOf, hullOf, toneOf, bandOf, dot3, add3, sub3, mul3, unit3, cross3, len3 };})();\n`;
const modelScript = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const partsScript = readFileSync(join(HERE, "parts.mjs"), "utf8").replace(/^export /gm, "");
const DATA = {
  P, W, H, ZC, SEAT, DECK, STACK, PLUG: { base: PLUG.base, a: PLUG.a },
  chamberC: at([0, 0, SEAT - 4]), plugTip: at(G.add3(PLUG.base, G.mul3(PLUG.a, -1.5))),
  portIn: PORT_IN.slice(0, 7).map(([x, z]) => at([x, 0, z])), bowl: [at([19, 0, SEAT + 4]), at([19, -30, SEAT + 13])],
  stackTop: at([STACK.x, STACK.y, STACK.top + 4]), hinge: [STACK.x, STACK.y - STACK.r - 2, STACK.top],
  K: k.cameraOf(P).k,
};
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const script = kitScript() + latheScript + modelScript + partsScript + LIVE;

// figure page (card, hint, readout, caption)
{
  const bodyHtml = `<style>${CSS}</style>` + k.plateHtml({
    fig: "Fig 1",
    title: "Four-stroke, half-section",
    hint: "Hover: left slow · right fast",
    readout: "intake · 0°",
    keys: [
      { mark: "lit", label: "Piston: 80 mm bore, 80 mm stroke, on a 140 mm rod" },
      { mark: "raised", label: "Cut faces of the block, head, sump and runner" },
      { mark: "edge", label: "Toothed belt: the cam pulley has twice the teeth, so the cam turns once every two revolutions" },
    ],
    caption: "Half-section of a 402 cc single. Intake: the piston falls and the intake valve (left) is open from 10° before top centre to 40° after bottom centre, drawing mist through the throttle. Compression: both valves shut, the charge is squeezed about 10:1. Power: the plug fires 10° before top centre and the burning charge drives the piston down. Exhaust: the exhaust valve opens 40° before bottom centre and the rising piston pushes the gas out of the stack. The cam's lift is the true support function of the drawn lobe under a flat bucket, 8 mm.",
    body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Engine cutaway; the crank turns on its own, hover to change speed">${svg}</div>`,
  });
  const name = THEME === "light" ? "engine-light.html" : "engine.html";
  const page = k.pageHtml({ title: "Four-stroke engine, half-section", theme: THEME, body: bodyHtml, script: `const MODE = "figure";\n` + script, width: 650 });
  writeFileSync(join(HERE, name), page);
  console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
}
// short page: 9:16, light paper, no card chrome
{
  const shortCss = `html,body{margin:0;height:100%;overflow:hidden;background:#f3f1ea}
body.iso{--anatomy-page:#f3f1ea;--anatomy-card:#f3f1ea;--anatomy-paper:#f6f4ee}
.short{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center}
.short .iso-svg{position:absolute;left:50%;transform:translateX(-50%);width:var(--fw);height:auto;top:var(--ft)}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Four-stroke engine</title><style>${k.ISO_CSS}${CSS}${shortCss}</style></head><body class="iso" data-theme="light"><main class="short"><div class="iso-stage">${svg}</div></main><script type="module">const MODE = "short";\n${script.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
  if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), html);
  console.log("wrote short.html", (html.length / 1024).toFixed(0) + " KB");
}
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.json"), JSON.stringify(F.eventsOf(), null, 1));

A.settle(R, P);
A.auditOrExit(R, P, {});

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['engine-light.html', 'engine.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
