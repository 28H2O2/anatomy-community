// DC solenoid, electrical view (from "Inside a Solenoid"). Run `node build.mjs` to write electrical.html.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import * as PT from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 760, H = 500;
const D = PT.DIMS;
const ZA = D.ZA;

// ---------- world layout, in mm (x along the solenoid axis, y toward the viewer's left, z up) ----------
const BENCH = { x: -76, y: -50, w: 198, d: 88, r: 6 };
const SUPPLY = { x: -72, y: -46, w: 40, d: 26, r: 2.4 }, SUPPLY_H = 30;
const BOARD = { x: -68, y: 6, w: 44, d: 28, r: 1.6 }, BOARD_Z = 5, PCB_T = 1.6;
const BRACKET = { x: -6, y: -13, w: 5, d: 26, r: 1.2 }, BRACKET_TOP = ZA + 15;
const FOOT = { x: -24, y: -13, w: 23, d: 26, r: 1.6 };
const POST = { x: D.post[0], y: -5, w: D.post[1] - D.post[0], d: 10, r: 1 }, POST_TOP = 29.6;
const GROMMET = { x: 9, angle: (40 * Math.PI) / 180 };

// ---------- camera ----------
const P = k.fitProjection(
  [...k.boxCorners(BENCH, -14, 0), [-6, 0, BRACKET_TOP + 6], [60, 0, ZA + 22], [D.drum[0], D.drum[1], 40], [SUPPLY.x, SUPPLY.y, SUPPLY_H]],
  W, H, { pad: 22, azimuth: 58, elevation: 28 },
);
const at = (p) => k.iso(p, P);
const KS = k.cameraOf(P).k; // screen px per mm
const S = (paths, cls, extra = {}) => k.solidSvg(paths, { tone: "hi", className: cls, ...extra });
const L = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const AX = (x = 0, z = ZA) => PT.axisFrame(G, x, z);
const alongY = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const alongZ = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const part = (name, body, extra = "") => `<g data-part="${name}"${extra}>${body}</g>`;

// ---------- bench ----------
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -14, 14, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BENCH, 14))) {
    out.push(S(k.cylinder(x, y, 7, -14, 1.6, P, 28), "m-rubber"));
    out.push(S(k.cylinder(x, y, 5.4, -12.4, 4.4, P, 28), "m-rubber"));
  }
  out.push(S(k.slabOf(BENCH, -8, 8, P, 8, 1.2), "m-stand", { inner: L(k.sideSeam(BENCH, -3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 4), 0, P), { tone: "faint" }));
  const screws = k.corners(BENCH, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the near edge: mm ticks, 10 mm majors, zero under the pole face
  const strip = { x: -8, y: BENCH.y + BENCH.d - 10, w: 124, d: 6, r: 0.8 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 3), "m-brass", { crease: "none" }));
  const t = k.topTicks(D.pole - 25, D.pole + 95, 1, 10, strip.y + 0.05, 0.5, [1.3, 2.3], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([D.pole, strip.y + 0.05], [D.pole, strip.y + 2.8], 0.5, P), { tone: "hi" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4.4, 0.5]), at([strip.x + strip.w - 2, strip.y + 4.4, 0.5])], { size: 0.4 }));
  // label plate
  const plate = { x: 88, y: 12, w: 26, d: 13, r: 1.2 };
  out.push(S(k.slabOf(plate, 0, 0.7, P, 3), "m-brass", { crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), 0.7, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 13, plate.y + 5.4], 0.7, P, "x"), "PULL · DC", { size: 2.6, tone: "mid", anchor: "middle" }));
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 8.4], [plate.x + 21, plate.y + 8.4], 0.7, P) + k.lineOnTop([plate.x + 5, plate.y + 10.4], [plate.x + 15, plate.y + 10.4], 0.7, P), { tone: "lo", free: true }));
  out.push(Dots([at([plate.x + 2.2, plate.y + 6.5, 0.7]), at([plate.x + plate.w - 2.2, plate.y + 6.5, 0.7])], { size: 0.4 }));
  return out.join("");
}

// ---------- bench supply: a small box with a display, a knob and two binding posts on its near face ----------
function supply() {
  const out = [];
  for (const [x, y] of byDepth(k.corners(SUPPLY, 4))) out.push(S(k.cylinder(x, y, 2.2, 0, 1.4, P, 16), "m-rubber"));
  out.push(S(k.slabOf(SUPPLY, 1.4, SUPPLY_H - 1.4, P, 6, 0.8), "m-case", { inner: L(k.sideSeam(SUPPLY, 6, P, 6), { tone: "faint" }) }));
  // vents on the top
  for (let i = 0; i < 6; i++) out.push(L(k.planOutline({ x: SUPPLY.x + 6 + i * 4.6, y: SUPPLY.y + 5, w: 2, d: 12, r: 1 }, SUPPLY_H, P, 3), { tone: "lo" }));
  // carry handle
  for (const x of [SUPPLY.x + 6, SUPPLY.x + SUPPLY.w - 8]) out.push(S(k.slabOf({ x, y: SUPPLY.y + 9, w: 2, d: 8, r: 0.6 }, SUPPLY_H, 3, P, 2), "m-dark"));
  out.push(S(k.slabOf({ x: SUPPLY.x + 6, y: SUPPLY.y + 11, w: SUPPLY.w - 12, d: 4, r: 1.6 }, SUPPLY_H + 3, 1.6, P, 4, 0.3), "m-dark"));
  // display window on the near face (y = SUPPLY.y + SUPPLY.d), drawn in that face's plane
  const fy = SUPPLY.y + SUPPLY.d;
  const face = (x, z) => at([x, fy, z]);
  const win = [face(SUPPLY.x + 4, 25), face(SUPPLY.x + 27, 25), face(SUPPLY.x + 27, 15.5), face(SUPPLY.x + 4, 15.5)];
  out.push(`<path class="lcd" d="${k.pathOf(win, true)}"/><path class="iso-line" data-tone="hi" d="${k.pathOf(win, true)}"/>`);
  const m = k.sideMatrix([SUPPLY.x + 25.6, fy], 21, P, "left");
  out.push(`<g transform="${m}"><text class="lcd-text" data-part="lcd-v" x="0" y="0" text-anchor="end" font-size="5">12.0V</text></g>`);
  const m2 = k.sideMatrix([SUPPLY.x + 25.6, fy], 17.2, P, "left");
  out.push(`<g transform="${m2}"><text class="lcd-text lcd-small" data-part="lcd-a" x="0" y="0" text-anchor="end" font-size="3.2">0.00A</text></g>`);
  // voltage knob and the two binding posts
  const knob = alongY(SUPPLY.x + 33.5, fy, 21);
  out.push(S(G.disc(0, 1.2, 4.2, knob, P), "m-dark") + S(G.disc(1.2, 4.2, 3.4, knob, P), "m-dark", { inner: L(G.ribsOf(knob, 1.5, 3.9, 3.4, 24, P), { tone: "mid" }) }));
  out.push(L(k.pathOf([at([SUPPLY.x + 33.5, fy + 4.25, 22.2]), at([SUPPLY.x + 33.5, fy + 4.25, 23.8])]), { tone: "hi", free: true }));
  for (const [x, cls] of [[SUPPLY.x + 12, "m-red"], [SUPPLY.x + 22, "m-dark"]]) {
    const F = alongY(x, fy, 8);
    out.push(S(G.disc(0, 1, 3.2, F, P), "m-dark") + S(G.disc(1, 4.4, 2.4, F, P), cls, { inner: L(G.ribsOf(F, 1.2, 4.2, 2.4, 14, P), { tone: "lo" }) }));
  }
  out.push(Dots([face(SUPPLY.x + 2.4, 2.8), face(SUPPLY.x + SUPPLY.w - 2.4, 2.8), face(SUPPLY.x + 2.4, SUPPLY_H - 2.6), face(SUPPLY.x + SUPPLY.w - 2.4, SUPPLY_H - 2.6)], { size: 0.45 }));
  return out.join("");
}

// ---------- wires: tubes from the kit, coloured per insulation ----------
function wire(points, r, cls, { radius = 4 } = {}) {
  const route = G.fillet(points, radius, 7, { P, tube: r });
  const pieces = tubePieces(route, r, P, { maxLength: 14 }).map((piece) => ({ mid: piece.mid, svg: `<g class="${cls}">${tubeSvg(piece, { tone: "hi" })}</g>`, piece }));
  pieces.route = G.resample(route, 1.2).map((p) => p.map((v) => +v.toFixed(2)));
  return pieces;
}
const SUPPLY_FY = SUPPLY.y + SUPPLY.d;
const IN_TERM = { x: BOARD.x + 4, y: BOARD.y + 1, w: 10, d: 6, r: 0.6 };
const OUT_TERM = { x: BOARD.x + BOARD.w - 14, y: BOARD.y + 1, w: 10, d: 6, r: 0.6 };
const TERM_Z = BOARD_Z + PCB_T, TERM_H = 6;
const termEntry = (t, n) => [t.x + 2.5 + n * 5, t.y, TERM_Z + 3];
const SUPPLY_LEADS = [
  wire([[SUPPLY.x + 12, SUPPLY_FY + 4.4, 8], [SUPPLY.x + 12, SUPPLY_FY + 9, 8], [SUPPLY.x + 12, SUPPLY_FY + 9, 1.2], [IN_TERM.x + 2.5, SUPPLY_FY + 12, 1.2], [IN_TERM.x + 2.5, IN_TERM.y - 4, 1.2], termEntry(IN_TERM, 0).map((v, i) => (i === 1 ? v - 2.2 : v)), termEntry(IN_TERM, 0)], 0.8, "w-red", { radius: 3 }),
  wire([[SUPPLY.x + 22, SUPPLY_FY + 4.4, 8], [SUPPLY.x + 22, SUPPLY_FY + 7, 8], [SUPPLY.x + 22, SUPPLY_FY + 7, 1.2], [IN_TERM.x + 7.5, SUPPLY_FY + 12, 1.2], [IN_TERM.x + 7.5, IN_TERM.y - 4, 1.2], termEntry(IN_TERM, 1).map((v, i) => (i === 1 ? v - 2.2 : v)), termEntry(IN_TERM, 1)], 0.8, "w-black", { radius: 3 }),
];
// coil leads: out of the grommet on the can, back over the bracket's far side, down and round to the board
const gN = [0, -Math.sin(GROMMET.angle), Math.cos(GROMMET.angle)];
const gAt = (s) => [GROMMET.x, gN[1] * (17 + s), ZA + gN[2] * (17 + s)];
function coilLead(off, cls, term) {
  const o = off;
  return wire([
    G.add3(gAt(3.4), [o, 0, 0]), G.add3(gAt(7), [o, 0, 0]), [GROMMET.x + o - 4, -18.5, ZA + 21], [-12 + o, -18, ZA + 21], [-12 + o, -18, 6], [-28 + o, -18, 6], [-28 + o, 0, 6],
    [term[0], term[1] - 4, term[2]], term,
  ], 0.75, cls, { radius: 4 });
}
const COIL_LEADS = [coilLead(-1.2, "w-red", termEntry(OUT_TERM, 0)), coilLead(1.2, "w-black", termEntry(OUT_TERM, 1))];

// ---------- the driver board ----------
function board() {
  const out = [];
  for (const [x, y] of byDepth(k.corners(BOARD, 2.6))) out.push(S(k.cylinder(x, y, 1.4, 0, BOARD_Z, P, 14), "m-brass"));
  out.push(S(k.slabOf(BOARD, BOARD_Z, PCB_T, P, 3, 0.3), "m-pcb"));
  const top = BOARD_Z + PCB_T;
  out.push(L(k.planOutline(k.insetPlan(BOARD, 1.4), top, P, 3), { tone: "faint" }));
  out.push(Dots(k.corners(BOARD, 2.6).map(([x, y]) => at([x, y, top])), { size: 0.55, tone: "hi" }));
  // copper traces between pads (each ends on a pad dot)
  const tr = (pts) => k.onTop(pts, top, P);
  const traces = [
    [[IN_TERM.x + 2.5, IN_TERM.y + 6.4], [IN_TERM.x + 2.5, BOARD.y + 12], [BOARD.x + 20, BOARD.y + 12]],
    [[OUT_TERM.x + 2.5, OUT_TERM.y + 6.4], [OUT_TERM.x + 2.5, BOARD.y + 12], [BOARD.x + 26, BOARD.y + 12]],
    [[IN_TERM.x + 7.5, IN_TERM.y + 6.4], [IN_TERM.x + 7.5, BOARD.y + 26], [BOARD.x + 24, BOARD.y + 26]],
    [[OUT_TERM.x + 7.5, OUT_TERM.y + 6.4], [OUT_TERM.x + 7.5, BOARD.y + 20], [BOARD.x + 31, BOARD.y + 20]],
  ];
  out.push(`<g data-part="traces">` + L(traces.map((t) => tr(t)).join(""), { tone: "lo", className: "trace" }) + `</g>`);
  out.push(Dots(traces.flatMap((t) => [t[0], t[t.length - 1]]).map(([x, y]) => at([x, y, top])), { size: 0.6, tone: "hi" }));
  // screw terminal blocks
  for (const t of [IN_TERM, OUT_TERM]) {
    out.push(S(k.slabOf(t, top, TERM_H, P, 2, 0.3), "m-term"));
    for (const n of [0, 1]) {
      out.push(L(k.ring(t.x + 2.5 + n * 5, t.y + 3.2, 1.5, top + TERM_H, P, 16), { tone: "hi" }));
      out.push(L(k.lineOnTop([t.x + 1.5 + n * 5, t.y + 3.2], [t.x + 3.5 + n * 5, t.y + 3.2], top + TERM_H, P), { tone: "hi" }));
    }
  }
  // MOSFET in TO-220, standing, with its tab
  const MOS = { x: BOARD.x + 20, y: BOARD.y + 17, w: 10, d: 4.5, r: 0.3 };
  for (let n = 0; n < 3; n++) out.push(S(k.slabOf({ x: MOS.x + 2.2 + n * 2.6, y: MOS.y + 1.9, w: 0.8, d: 0.5, r: 0.1 }, top, 3, P, 1), "m-zinc"));
  out.push(S(k.slabOf(MOS, top + 3, 9, P, 2, 0.3), "m-dark"));
  out.push(S(k.slabOf({ x: MOS.x, y: MOS.y, w: 10, d: 1.3, r: 0.2 }, top + 12, 5.5, P, 2), "m-zinc"));
  out.push(L(k.sideRing([MOS.x + 5, MOS.y + 1.3, top + 14.6], 1.6, "y", P), { tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([MOS.x + 5, MOS.y + MOS.d], top + 8.2, P, "left"), "N-FET", { size: 1.9, tone: "lo", anchor: "middle" }));
  // flyback diode and clamp (axial parts lying across the board) and the gate resistor
  const axial = (x, y, len, r, cls, band) => {
    const F = G.frameOf([x, y, top + r + 0.4], [1, 0, 0], [0, 0, 1], [0, 1, 0]);
    let s = S(G.disc(-len / 2 - 2, -len / 2, 0.35, F, P), "m-zinc") + S(G.disc(-len / 2, len / 2, r, F, P), cls);
    if (band) s += S(G.disc(len / 2 - 1.6, len / 2 - 0.8, r + 0.05, F, P), "m-zinc");
    return s + S(G.disc(len / 2, len / 2 + 2, 0.35, F, P), "m-zinc");
  };
  out.push(`<g data-part="diode">${axial(BOARD.x + 30, BOARD.y + 12, 6, 1.4, "m-dark", true)}</g>`);
  out.push(`<g data-part="clamp">${axial(BOARD.x + 31, BOARD.y + 25, 5, 1.6, "m-tvs", true)}</g>`);
  out.push(axial(BOARD.x + 14, BOARD.y + 29, 5, 1.0, "m-resistor", false));
  // bulk capacitor and the ON lamp
  out.push(S(k.cylinder(BOARD.x + 9, BOARD.y + 18, 3.8, top, 9, P, 32, 0.4), "m-cap", { inner: L(k.sideArc(BOARD.x + 9, BOARD.y + 18, 3.8, top + 7.6, P, 24), { tone: "faint" }) }));
  out.push(L(k.lineOnTop([BOARD.x + 5.25, BOARD.y + 18], [BOARD.x + 12.75, BOARD.y + 18], top + 9, P) + k.lineOnTop([BOARD.x + 9, BOARD.y + 14.25], [BOARD.x + 9, BOARD.y + 21.75], top + 9, P), { tone: "lo" }));
  out.push(S(k.cylinder(BOARD.x + 38, BOARD.y + 28, 1.6, top, 2.2, P, 16), "m-led") + `<g data-part="led"><path class="led-glow" d="${k.pathOf(k.circleRing(BOARD.x + 38, BOARD.y + 28, 2.6, 20).map(([x, y]) => at([x, y, top + 2.2])), true)}"/>${S(G.sphereOf([BOARD.x + 38, BOARD.y + 28, top + 2.6], 1.6, P), "m-led")}</g>`);
  return out.join("");
}

// ---------- mounting bracket ----------
function bracket() {
  const out = [];
  out.push(S(k.slabOf(FOOT, 0, 3, P, 3, 0.4), "m-bracket"));
  for (const y of [-8, 8]) {
    out.push(L(k.ring(-15, y, 2.2, 3, P, 16), { tone: "lo" }));
    out.push(S(k.cylinder(-15, y, 1.9, 3, 1.2, P, 6), "m-zinc"));
    out.push(L(k.lineOnTop([-16.2, y], [-13.8, y], 4.2, P), { tone: "lo" }));
  }
  // gussets: triangles in the x-z plane, extruded across y
  const gusset = (y) => S(G.prismOf(G.frameOf([0, y, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), [[-20, 3], [-6, 3], [-6, 22]], 0, 2, P), "m-bracket");
  out.push(gusset(-12.5), gusset(10.5));
  out.push(S(k.slabOf(BRACKET, 3, BRACKET_TOP - 3, P, 3, 0.5), "m-bracket"));
  // the stud's nut behind the bracket is hidden; on the near face, the lock washer the can bears on
  out.push(S(G.disc(-1, 0, 7, AX(), P), "m-zinc"));
  return out.join("");
}

// ---------- the solenoid, whole or cut on the plane y = 0 ----------
// stationary turned parts: [name, class, steps [s0, s1, rOut, rIn]]
const STATIC = [
  ["stud", "m-zinc", "c-zinc", [[-14, -1, 4, 0]]],
  ["back-plate", "m-iron-dk", "c-iron", [[0, 3, 15, 8.15]]],
  ["pole", "m-iron-dk", "c-iron", [[0, 18, 8.1, 0]]],
  ["washer", "m-brass", "c-brass", [[18, 18 + D.washer, 6.5, 0]]],
  ["bobbin", "m-nylon", "c-nylon", [[3.2, 4.4, 14.6, 8.6], [4.4, 35.6, 9.3, 8.6], [35.6, 36.8, 14.6, 8.6]]],
  ["winding", "m-copper", "c-copper", [[4.4, 35.6, 14.3, 9.3]]],
  ["sleeve", "m-brass", "c-brass", [[3, 40, 8.6, 8.15], [40, 41.2, 12, 8.15]]],
  ["front-plate", "m-iron-dk", "c-iron", [[37, 40, 15, 8.6]]],
  ["can", "m-iron", "c-iron", [[0, 40, 17, 15]]],
];
function cutLayer(z = ZA, x0 = 0, names = null) {
  const out = [];
  const keep = (n) => !names || names.includes(n);
  // the air inside the can and the bore, behind everything that is cut
  if (!names) out.push(`<path class="cavity" d="${PT.cutFace(k, P, 3, 37, 8.15, 15, z, x0)}"/>`);
  for (const [name, , cut, steps] of STATIC) {
    if (!keep(name) || name === "stud") continue;
    let d = "";
    for (const [s0, s1, rOut, rIn] of steps) d += PT.cutFace(k, P, s0, s1, rIn, rOut, z, x0);
    out.push(`<g data-part="${name}" data-cut><path class="cut ${cut}" d="${d}"/>${name === "winding" ? windingEnds(z, x0) : ""}<path class="cut-edge" d="${d}"/></g>`);
  }
  return out.join("");
}
// wire ends in the cut winding: drawn Ø0.8 mm (larger than a real 600-turn coil's wire), in staggered layers
function windingEnds(z, x0) {
  const pts = [];
  for (let layer = 0; layer < 6; layer++) {
    const r = 9.75 + layer * 0.8;
    for (let s = 4.85 + (layer % 2) * 0.4; s < 35.3; s += 0.8) {
      pts.push(at([x0 + s, 0, z + r]), at([x0 + s, 0, z - r]));
    }
  }
  return `<g class="wire-ends">${Dots(pts, { size: +(0.34 * KS).toFixed(2), tone: "mid" })}</g>`;
}
function wholeSolenoid() {
  const out = [];
  out.push(part("can", S(G.disc(0, 40, 17, AX(), P), "m-iron", { inner: L(G.arcOf(AX(), 1.2, 17, P) + G.arcOf(AX(), 38.8, 17, P), { tone: "faint" }) })));
  // front plate face ring and the sleeve flange that the spring sits on
  out.push(L(G.circleOf(AX(), 40, 15, P), { tone: "lo" }));
  out.push(Dots(G.dotsOf(AX(), 40, 12.4, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.5, tone: "mid" }));
  out.push(part("sleeve", S(G.disc(40, 41.2, 12, AX(), P), "m-brass")));
  return out.join("");
}
function halfSolenoid() {
  const out = [];
  out.push(part("can", S(PT.stepSolid(G, P, true, 0, 40, 17, ZA), "m-iron")));
  out.push(part("front-plate", S(PT.stepSolid(G, P, true, 37, 40, 15, ZA), "m-iron-dk")));
  out.push(part("sleeve", S(PT.stepSolid(G, P, true, 40, 41.2, 12, ZA), "m-brass")));
  return out.join("");
}
// the near half of the can, the part the section removes, put back as tinted see-through steel
function ghostCan() {
  const front = [];
  for (let i = 0; i <= 44; i++) { const t = (Math.PI * i) / 44; front.push([17 * Math.cos(t), 17 * Math.sin(t)]); }
  const shell = G.prismOf(AX(), front, 0, 40, P);
  const seams = G.arcOf(AX(), 1.2, 17, P) + G.arcOf(AX(), 38.8, 17, P);
  return `<g class="ghost">${S(shell, "m-iron", { inner: L(seams, { tone: "lo" }) })}</g>`;
}
function grommet() {
  const F = G.frameOf(gAt(0), gN, [1, 0, 0], G.cross3(gN, [1, 0, 0]));
  return part("grommet", S(G.disc(-0.6, 1.6, 3.2, F, P), "m-rubber") + S(G.disc(1.6, 3.4, 2.4, F, P), "m-rubber"));
}

// ---------- stop post and the constant-force load ----------
function stopPost() {
  const out = [];
  out.push(S(k.slabOf({ x: POST.x - 4, y: POST.y - 3, w: POST.w + 8, d: POST.d + 6, r: 1 }, 0, 2.4, P, 3, 0.3), "m-bracket"));
  out.push(Dots([at([POST.x - 2, POST.y - 1, 2.4]), at([POST.x + POST.w + 2, POST.y + POST.d + 1, 2.4])], { size: 0.5 }));
  out.push(S(k.slabOf(POST, 2.4, POST_TOP - 2.4, P, 3, 0.4), "m-bracket"));
  return out.join("");
}
function drumLower() {
  const [cx, cy] = D.drum;
  const out = [];
  out.push(S(k.cylinder(cx, cy, 8, 0, 2.4, P, 40, 0.3), "m-bracket"));
  out.push(Dots(k.circleRing(cx, cy, 6, 4).map(([x, y]) => at([x, y, 2.4])), { size: 0.5 }));
  out.push(S(k.cylinder(cx, cy, 3, 2.4, ZA - 6.4, P, 24), "m-bracket", { inner: L(k.sideArc(cx, cy, 3, 12, P, 16), { tone: "faint" }) }));
  out.push(S(k.cylinder(cx, cy, 10.6, ZA - 4, 0.8, P, 56, 0.2), "m-zinc"));
  out.push(`<g data-part="drum-coil">${S(k.cylinder(cx, cy, 9, ZA - 3.2, 6.4, P, 56), "m-ribbon", { inner: L([1.6, 3.2, 4.8].map((h) => k.sideArc(cx, cy, 9, ZA - 3.2 + h, P, 40)).join(""), { tone: "faint" }) })}<g class="m-ribbon" data-part="coil-marks">${PT.coilMarks(k, P, D, 0, ZA - 3.2, ZA + 3.2)}</g></g>`);
  return out.join("");
}
function drumUpper() {
  const [cx, cy] = D.drum;
  return S(k.cylinder(cx, cy, 10.6, ZA + 3.2, 0.8, P, 56, 0.2), "m-zinc") + `<g data-part="drum-marks">${L(PT.drumMarks(k, P, D, 0, ZA + 4.0), { tone: "lo" })}</g>` + S(k.cylinder(cx, cy, 3.2, ZA + 4, 1.4, P, 6), "m-zinc");
}

// ---------- exploded view: the same parts, sectioned, laid out along the axis above the bench ----------
const ZE = ZA + 46;
const EX_GAP = 6;
function explodedScene() {
  const items = [];
  let cursor = -70;
  const place = (name, span, draw) => { const dx = cursor - span[0]; items.push({ name, dx, svg: draw(dx) }); cursor += span[1] - span[0] + EX_GAP; };
  const turned = (names) => (dx) => {
    let bodySvg = "", faces = "";
    for (const n of names) {
      const [, cls, cut, steps] = STATIC.find((p) => p[0] === n);
      for (const [s0, s1, rOut, rIn] of steps) {
        bodySvg += S(PT.stepSolid(G, P, true, s0, s1, rOut, ZE, dx), cls);
        if (rIn > 0) faces += `<path class="bore ${cls}" d="${PT.cutFace(k, P, s0, s1, 0, rIn, ZE, dx)}"/>`;
        faces += `<path class="cut ${cut}" d="${PT.cutFace(k, P, s0, s1, rIn, rOut, ZE, dx)}"/>`;
      }
    }
    let edges = "";
    for (const n of names) for (const [s0, s1, rOut, rIn] of STATIC.find((p) => p[0] === n)[3]) edges += PT.cutFace(k, P, s0, s1, rIn, rOut, ZE, dx);
    const ends = names.includes("winding") ? windingEnds(ZE, dx) : "";
    return bodySvg + faces + ends + `<path class="cut-edge" d="${edges}"/>`;
  };
  place("pole", [-14, 18.25], turned(["stud", "back-plate", "pole", "washer"]));
  place("can", [0, 40], turned(["can"]));
  place("winding", [3.2, 36.8], turned(["bobbin", "winding"]));
  place("sleeve", [3, 41.2], turned(["sleeve"]));
  place("front-plate", [37, 40], turned(["front-plate"]));
  place("spring", [0, 15], (dx) => {
    const c = PT.springSvg(k, P, D, dx, dx + 15, ZE);
    return L(c.back, { tone: "lo", className: "spring spring-back" }) + L(c.front, { tone: "hi", className: "spring" });
  });
  place("plunger", [0, D.plungerLen], (dx) => { const pl = PT.plungerSvg(k, G, P, D, dx, { cut: true, z: ZE, from: dx - 1 }); return pl.body + pl.faces; });
  place("clevis", [D.clevis[0], D.clevis[1]], (dx) => { const c = PT.clevisSvg(k, G, P, D, dx, ZE); return c.back + c.front; });
  return { items, end: cursor };
}
const EXPLODED = explodedScene();

// ---------- overlays ----------
// flux: four nested closed loops per half, in the cut plane. Pole and plunger at radius ρ, out through the
// front plate, back along the can, in through the back plate. Paths are schematic; their opacity follows B.
const LOOPS = [0, 1, 2, 3].map((i) => ({ rho: 1.6 + i * 1.6, xf: 39.4 - i * 0.6, xb: 0.6 + i * 0.6, rc: 16.7 - i * 0.45 }));
function loopPath(L0, sign) {
  const pts = [[L0.xb, L0.rho], [L0.xf, L0.rho], [L0.xf, L0.rc], [L0.xb, L0.rc]].map(([x, r]) => [x, 0, ZA + sign * r]);
  const route = G.fillet([...pts, pts[0], pts[1]], 1.1, 6).slice(0, -1);
  return route;
}
function fluxSvg() {
  let out = "";
  LOOPS.forEach((L0, i) => {
    for (const sign of [1, -1]) {
      const route = loopPath(L0, sign);
      out += `<path class="flux" data-i="${i}" d="${k.pathOf(route.map(at), true)}"/>`;
      // arrowheads in the plunger (+x) and in the can (-x); data-dir flips with the winding sense
      for (const [x, r, dir] of [[(D.pole + 34) / 2 + 2, L0.rho, 1], [20, L0.rc, -1], [6, L0.rho, 1]]) {
        const z = ZA + sign * r;
        const tipF = at([x + 1.4 * dir, 0, z]), b1 = at([x - 1.4 * dir, 0, z + 0.9]), b2 = at([x - 1.4 * dir, 0, z - 0.9]);
        const tipR = at([x - 1.4 * dir, 0, z]), c1 = at([x + 1.4 * dir, 0, z + 0.9]), c2 = at([x + 1.4 * dir, 0, z - 0.9]);
        out += `<path class="flux-arrow" data-i="${i}" data-dir="1" d="${k.pathOf([tipF, b1, b2], true)}"/><path class="flux-arrow" data-i="${i}" data-dir="-1" d="${k.pathOf([tipR, c1, c2], true)}"/>`;
      }
    }
  });
  return out;
}
// current through the winding: into the page on the top half, out of it on the bottom (for the default sense)
function ampMarks() {
  const mark = (x, z, into) => {
    const c = at([x, 0, z]);
    const rr = 2.2 * KS;
    const ring = `<circle class="amp-ring" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${rr.toFixed(1)}"/>`;
    const cross = `<path class="amp-mark" d="M${(c[0] - rr * 0.6).toFixed(1)} ${(c[1] - rr * 0.6).toFixed(1)}L${(c[0] + rr * 0.6).toFixed(1)} ${(c[1] + rr * 0.6).toFixed(1)}M${(c[0] + rr * 0.6).toFixed(1)} ${(c[1] - rr * 0.6).toFixed(1)}L${(c[0] - rr * 0.6).toFixed(1)} ${(c[1] + rr * 0.6).toFixed(1)}"/>`;
    const dot = `<circle class="amp" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(rr * 0.3).toFixed(1)}"/>`;
    return `<g data-into="${into ? 1 : 0}">${ring}<g data-sym="x">${cross}</g><g data-sym="o">${dot}</g></g>`;
  };
  let out = "";
  for (const x of [11, 20, 29]) out += mark(x, ZA + 11.8, true) + mark(x, ZA - 11.8, false);
  return out;
}

// ---------- camera presets: world boxes the view eases between ----------
function viewOf(points, pad = 18) {
  const f = points.map(at);
  const x0 = Math.min(...f.map((p) => p[0])) - pad, x1 = Math.max(...f.map((p) => p[0])) + pad;
  const y0 = Math.min(...f.map((p) => p[1])) - pad, y1 = Math.max(...f.map((p) => p[1])) + pad;
  // keep the card's aspect
  let w = x1 - x0, h = y1 - y0;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h > W / H) h = (w * H) / W; else w = (h * W) / H;
  return [+(cx - w / 2).toFixed(1), +(cy - h / 2).toFixed(1), +w.toFixed(1), +h.toFixed(1)];
}
const box = (x0, x1, y0, y1, z0, z1) => k.boxCorners({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0 }, z0, z1);
const VIEWS = {
  full: [0, 0, W, H],
  sol: viewOf(box(-8, 92, -18, 14, 4, ZA + 19), 14),
  tight: viewOf(box(-2, 70, -10, 8, ZA - 17, ZA + 18), 10),
  circuit: viewOf([...box(-72, 66, -48, 36, -6, 2), ...box(-6, 60, -18, 14, ZA - 17, ZA + 24), ...box(D.drum[0] - 11, D.drum[0] + 11, D.drum[1] - 11, D.drum[1] + 11, 0, ZA + 6)], 10),
  explode: viewOf([...k.boxCorners(BENCH, -14, 0), ...box(-70, EXPLODED.end, -18, 18, ZE - 18, ZE + 18)], 14),
};

// ---------- assemble the SVG ----------
const g0 = M.DEFAULTS.g0;
const lead = (list, test) => list.flatMap((w) => w).filter(test).sort((a, b) => G.dot3(a.mid, G.viewOf(P)) - G.dot3(b.mid, G.viewOf(P))).map((p) => p.svg).join("");
const behindBracket = (p) => p.mid[0] < 0;
const body = [
  `<g data-layer="bench">${bench()}</g>`,
  `<g data-layer="supply">${supply()}${lead(SUPPLY_LEADS, () => true)}<g data-cur="supply"></g></g>`,
  `<g data-layer="drum-lower">${drumLower()}</g>`,
  `<g data-layer="coil-leads-back" data-hide="explode">${lead(COIL_LEADS, behindBracket)}<g data-cur="back"></g></g>`,
  `<g data-layer="board">${board()}</g>`,
  `<g data-layer="bracket">${bracket()}</g>`,
  `<g data-layer="sol-whole" data-show="whole" data-hide="explode">${wholeSolenoid()}</g>`,
  `<g data-layer="sol-half" data-show="cut" data-hide="explode">${halfSolenoid()}</g>`,
  `<g data-layer="grommet" data-hide="explode">${grommet()}${lead(COIL_LEADS, (p) => !behindBracket(p))}<g data-cur="front"></g></g>`,
  `<g data-dyn="a" data-hide="explode"></g>`,
  `<g data-layer="cut" data-show="cut" data-hide="explode">${cutLayer()}</g>`,
  `<g data-dyn="b" data-hide="explode"></g>`,
  `<g data-layer="flux" data-hide="explode">${fluxSvg()}<g data-dyn="fringe"></g></g>`,
  `<g data-layer="amps" data-hide="explode">${ampMarks()}</g>`,
  `<g data-layer="ghost" data-hide="explode">${ghostCan()}</g>`,
  `<g data-dyn="c" data-hide="explode"></g>`,
  `<g data-layer="post">${stopPost()}</g>`,
  `<g data-dyn="d"></g>`,
  `<g data-dyn="ribbon" data-hide="explode"></g>`,
  `<g data-layer="drum-upper">${drumUpper()}</g>`,
  `<g data-layer="exploded" data-only="explode">${EXPLODED.items.map((it) => `<g data-ex="${it.name}" data-part="${it.name}">${it.svg}</g>`).join("")}</g>`,
  `<g data-dyn="over"></g>`,
].join("");

const svg = k.figureSvg({ width: W, height: H, label: "A DC pull solenoid on a test bench, cut in half along its axis: copper winding on a nylon bobbin, iron can, plates and pole, a teal plunger in a brass guide sleeve, a return spring, a stop screw and a constant-force ribbon load, wired to a MOSFET driver board and a bench supply.", body, className: "sol-svg" });

// ---------- page ----------
const CSS = readFileSync(join(HERE, "style.css"), "utf8");
const latheSource = readFileSync(fileURLToPath(new URL("../../../../.skill/kit/lathe.mjs", import.meta.url)), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheSource}\nreturn { viewOf, lightOf, scaleOf, frameAlong, frameOf, pointOf, disc, sphereOf, prismOf, circleOf, arcOf, ribsOf, dotsOf, lathe, solidOf, hullOf, toneOf, bandOf, dot3, add3, sub3, mul3, unit3, cross3, len3 };})();\n`;
const strip = (f) => readFileSync(join(HERE, f), "utf8").replace(/^export /gm, "");
const WIRES = { supplyPos: SUPPLY_LEADS[0].route, supplyNeg: SUPPLY_LEADS[1].route, coilPos: COIL_LEADS[0].route, coilNeg: COIL_LEADS[1].route };
const DATA = { P, W, H, D, KS, VIEWS, WIRES, EX: EXPLODED.items.map((it) => ({ name: it.name, dx: it.dx })), ZE, LOOPS };
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const ONLY_GALLERY = true; // the gallery figure is the electrical view only
if (!ONLY_GALLERY) {
const FIG2 = buildFig2();
const LIVE2 = readFileSync(join(HERE, "live2.js"), "utf8").replace("__DATA2__", JSON.stringify(FIG2.DATA2));
const script = kitScript() + latheScript + strip("model.mjs") + strip("parts.mjs") + LIVE + LIVE2;
const PAGE = readFileSync(join(HERE, "page.html"), "utf8");
const fig1 = k.plateHtml({
  fig: "Fig 1",
  title: "DC pull solenoid on a test bench",
  hint: "Space energizes · drag pans · wheel zooms",
  readout: "OFF · 0.00 A · gap 2.50 mm",
  body: `<div class="iso-stage" data-fig="1" tabindex="0" role="img" aria-label="Solenoid on a test bench. Press Space or the Energize button to switch the coil.">${svg}<div class="sol-phase" aria-live="polite"></div><ul class="flegend" hidden></ul><p class="iso-note" hidden></p><div class="tip" role="tooltip" hidden></div></div>`,
});
const card2 = k.plateHtml({
  fig: "Fig 2",
  title: "Locking pin and lock ring",
  hint: "Pick a scenario below",
  readout: "OFF · pin 0.00 mm",
  body: `<div class="iso-stage" data-fig="2" tabindex="0" role="img" aria-label="Push-type solenoid driving a locking pin toward a turning lock ring with eight holes.">${FIG2.svg}<div class="sol-phase" aria-live="polite"></div></div>`,
});
const html = PAGE.replace("__FIG1__", fig1).replace("__FIG2__", readFileSync(join(HERE, "fig2.html"), "utf8").replace("__CARD2__", card2));
const page = k.pageHtml({ title: "Inside a Solenoid: From Electricity to Mechanical Motion", theme: "light", body: `<style>${CSS}</style>` + html, script, width: 1240 });
writeFileSync(join(HERE, "solenoid.html"), page);
// the same page as an Artifact body: no document skeleton of its own, one light look set explicitly
if (process.argv.includes("--artifact")) {
  const head = page.match(/<head>([\s\S]*?)<\/head>/)[1].replace("html{color-scheme:dark}", "html{color-scheme:light}").replace(/<meta[^>]*>/g, "").replace(/<title>[^<]*<\/title>/, "");
  const inner = page.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  writeFileSync(join(HERE, "artifact.html"), `<title>Inside a Solenoid</title>${head}<div class="iso iso-root" data-theme="light">${inner}</div>`);
  console.log("wrote artifact.html");
}
console.log("wrote solenoid.html", (page.length / 1024).toFixed(0) + " KB");
}

// ---------- the gallery figure: only the electrical view ----------
{
  const liveG = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify({ ...DATA, GALLERY: true }));
  const scriptG = kitScript() + latheScript + strip("model.mjs") + strip("parts.mjs") + liveG;
  const figG = k.plateHtml({
    fig: "Fig 1",
    title: "DC solenoid, electrical view",
    hint: "Space energizes · drag pans · wheel zooms",
    readout: "OFF · 0.00 A · gap 2.50 mm",
    keys: [
      { mark: "lit", label: "Plunger, pulled toward the pole when current flows" },
      { mark: "raised", label: "Return yoke can, near half shown see-through over the section" },
      { mark: "dotted", label: "Conventional current on the leads; it keeps circulating through the flyback diode after switch-off" },
    ],
    caption: "A 12 V, 12 Ω, 600-turn pull solenoid switched by a low-side MOSFET. The current rises with time constant L/R, dips as the moving plunger raises the inductance, and after switch-off decays through the flyback path while the spring waits for the force to fall. Lumped magnetic-circuit model; illustrative values, not a datasheet.",
    body: `<div class="iso-stage" data-fig="1" tabindex="0" role="img" aria-label="Solenoid on a test bench, electrical view. Press Space or the Energize button to switch the coil.">${svg}<div class="sol-phase" aria-live="polite"></div><ul class="flegend" hidden></ul><p class="iso-note" hidden></p><div class="tip" role="tooltip" hidden></div></div>`,
  });
  const htmlG = readFileSync(join(HERE, "page-electrical.html"), "utf8").replace("__FIG1__", figG);
  const pageG = k.pageHtml({ title: "Solenoid, electrical view", theme: "light", body: `<style>${CSS}</style>` + htmlG, script: scriptG, width: 900 });
  writeFileSync(join(HERE, "electrical.html"), pageG);
  console.log("wrote electrical.html", (pageG.length / 1024).toFixed(0) + " KB");
}
