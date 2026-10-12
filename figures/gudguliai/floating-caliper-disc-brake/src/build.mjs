// Build script for the floating-caliper disc brake anatomy figure (turntable edition).
// Usage: node build.mjs [--audit] [--quick]   (writes brake-anatomy.html next to itself)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { turning } from "../../../../.skill/kit/turn-build.mjs";
import * as TA from "../../../../.skill/kit/turn-audit.mjs";
import { turnScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "brake-anatomy.html");
const argv = process.argv.slice(2);

const WIDTH = 680;
const HEIGHT = 500;
const AXLE_Z = 100;      // axle height above the base top
const TRAVEL = 3.5;      // pad travel from rest to contact (world units)
const PIVOT = [-14, 0];  // turntable axis (vertical) through assembly center

// ---------------------------------------------------------------------------
// Projection: fit the static base AND the swept live volume (360° about pivot)
// ---------------------------------------------------------------------------
const SWEPT_R = 62; // max radius of any live part from the pivot (x-y)
const P = k.fitProjection(
  [
    ...k.boxCorners({ x: -105, y: -72, w: 210, d: 144 }, -20, 14),
    [PIVOT[0] - SWEPT_R, -SWEPT_R, 0], [PIVOT[0] + SWEPT_R, SWEPT_R, 0],
    [PIVOT[0] - SWEPT_R, -SWEPT_R, 218], [PIVOT[0] + SWEPT_R, SWEPT_R, 218],
  ],
  WIDTH, HEIGHT, { pad: 26, azimuth: 42 },
);
// ORTHO: near-orthographic side-dominant elevation. Azimuth 62 (not 90):
// a pure side elevation puts the rotor edge-on and its spin becomes
// invisible, making the view read as frozen. At 62 the rotor face stays
// readable (spin visible) while pad/piston travel keeps a strong horizontal
// component. Elevation 6 keeps the drag unprojection well-defined.
const P_ORTHO = k.fitProjection(
  [
    [PIVOT[0] - SWEPT_R, -SWEPT_R, 0], [PIVOT[0] + SWEPT_R, SWEPT_R, 0],
    [PIVOT[0] - SWEPT_R, -SWEPT_R, 218], [PIVOT[0] + SWEPT_R, SWEPT_R, 218],
  ],
  WIDTH, HEIGHT, { pad: 52, azimuth: 62, elevation: 6 },
);
// SECTION illustration: true side elevation (elevation 0) fitted to the
// cutaway bounds with room for leader-line labels.
const P_SEC = k.fitProjection(
  [[-78, 0, 40], [66, 0, 216]],
  WIDTH, HEIGHT, { pad: 24, azimuth: 90, elevation: 0 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
// Axle frame: a=+x, u=+y, v=+z, origin at axle height.
const XF = G.frameAlong([0, 0, AXLE_Z], [1, 0, 0]);
const hexPoly = (r, rot = Math.PI / 6) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = rot + (i / 6) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
// Annular sector as a convex trapezoid (u-v plane).
const sectorPoly = (r0, r1, a0, a1) => [
  [r0 * Math.cos(a0), r0 * Math.sin(a0)],
  [r1 * Math.cos(a0), r1 * Math.sin(a0)],
  [r1 * Math.cos(a1), r1 * Math.sin(a1)],
  [r0 * Math.cos(a1), r0 * Math.sin(a1)],
];

// ---------------------------------------------------------------------------
// Groups: one turn group (the whole brake), slide groups for moving assemblies
// ---------------------------------------------------------------------------
const R = A.recorder(P);
const T = turning(P, { recorder: R });
const spin = T.group("spin", { turn: { pivot: PIVOT } });
const sRotor = T.group("sRotor", { parent: spin, slide: { direction: [1, 0, 0], travel: 60 } });
// rotorSpin: the rotor genuinely rotates about the axle; driven per frame
// from S_.rotorAngle (degrees). Replaces the old fake "orbiting dot".
// hubSpin: hub + studs + nuts rotate with the rotor (bolted together).
// Two hinge groups (not one) so the kit's strict same-group interlock
// check doesn't fire on the deliberately interpenetrating hardware.
const rotorSpin = T.group("rotorSpin", { parent: sRotor, hinge: { point: [0, 0, AXLE_Z], axis: [1, 0, 0] } });
const hubSpin = T.group("hubSpin", { parent: sRotor, hinge: { point: [0, 0, AXLE_Z], axis: [1, 0, 0] } });
const sBracket = T.group("sBracket", { parent: spin, slide: { direction: [1, 0, 0], travel: 120 } });
const sInnerPad = T.group("sInnerPad", { parent: spin, slide: { direction: [1, 0, 0], travel: 180 } });
const sPiston = T.group("sPiston", { parent: spin, slide: { direction: [1, 0, 0], travel: 120 } });
const sCaliper = T.group("sCaliper", { parent: spin, slide: { direction: [1, 0, 0], travel: 220 } });
const sPins = T.group("sPins", { parent: spin, slide: { direction: [1, 0, 0], travel: 240 } });
const sHose = T.group("sHose", { parent: spin, slide: { direction: [1, 0, 0], travel: 260 } });
const main = T.layer("main");
T.stack(["back", "main"]);

// Figure values -> group values. ex: master explode 0..1, brake: apply 0..1.
const exVal = (e, delay) => {
  const t = Math.min(1, Math.max(0, (e - delay) / (1 - delay)));
  return t * t * (3 - 2 * t);
};
const follow = (values) => {
  const e = values.ex ?? 0;
  const b = values.brake ?? 0;
  return {
    spin: values.spin ?? 0,
    sRotor: exVal(e, 0.0) * 25,
    sBracket: exVal(e, 0.15) * 70,
    sInnerPad: exVal(e, 0.3) * 130 + b * TRAVEL,
    sPiston: exVal(e, 0.45) * -40 + b * TRAVEL,
    sCaliper: exVal(e, 0.45) * 165 + b * -TRAVEL,
    sPins: exVal(e, 0.6) * 190,
    sHose: exVal(e, 0.75) * 215,
  };
};
const poses = () => {
  const out = [];
  for (let s = 0; s < 360; s += 30)
    for (const e of [0, 0.25, 0.5, 0.75, 1])
      for (const b of [0, 1]) out.push(follow({ spin: s, ex: e, brake: b }));
  return out;
};

// ---------------------------------------------------------------------------
// Static base (display stand): recorded, layer "back" (under the live layer)
// ---------------------------------------------------------------------------
function baseStatic() {
  const plate = { x: -105, y: -72, w: 210, d: 144, r: 8 };
  for (const [x, y] of k.corners(plate, 20)) {
    const svg = S(k.cylinder(x, y, 8, -20, 3, P, 28), { tone: "lo" })
      + S(k.cylinder(x, y, 6.4, -17, 3, P, 28), { tone: "mid" });
    R.put({ name: `base.foot.${x}.${y}`, layer: "back", at: [x, y, -20], svg,
      shapes: [A.cylinder(x, y, 8, -20, 3), A.cylinder(x, y, 6.4, -17, 3)] });
  }
  const screws = k.corners(plate, 13);
  const svg = S(k.slabOf(plate, -14, 14, P, 8, 1.2), { tone: "lo" })
    + L(k.planOutline(k.insetPlan(plate, 5), 0, P), { tone: "faint" })
    + L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" })
    + D(screws.map(([x, y]) => k.iso([x, y, 0], P)), { size: 0.5 });
  R.put({ name: "base.plate", layer: "back", at: [0, 0, -14], svg,
    shapes: [A.slab(plate, -14, 14)] });
}
const HALO_SVG = `<path class="iso-halo" d="${k.haloOf({ x: -105, y: -72, w: 210, d: 144, r: 8 }, -20, 12, P)}"/>`;

// ---------------------------------------------------------------------------
// Knuckle (in spin, no slide): plate sits ON the base (z=14), axle hardware
// ---------------------------------------------------------------------------
function knuckleParts() {
  T.prism({ name: "knuckle.plate", group: spin, layer: main,
    plan: { x: -56, y: -36, w: 8, d: 72, r: 2 }, z: 14, h: 120, tone: "mid" });
  T.round({ name: "knuckle.boss", group: spin, layer: main, F: XF, s0: -48, s1: -36, r: 12, tone: "mid" });
  T.round({ name: "knuckle.stub", group: spin, layer: main, F: XF, s0: -36, s1: -32, r: 6.5, tone: "hi" });
  T.prism({ name: "knuckle.axnut", group: spin, layer: main, F: XF,
    polygon: hexPoly(8), s0: -24, s1: -18, tone: "mid" });
  T.prism({ name: "knuckle.hosepost", group: spin, layer: main,
    plan: { x: -61, y: -18, w: 5, d: 5, r: 1 }, z: 81, h: 53, tone: "mid" });
}

// ---------------------------------------------------------------------------
// Hub (in spin, no slide): flange + 5 studs + 5 lug nuts (88.3-107.9 N.m)
// ---------------------------------------------------------------------------
function hubParts() {
  // hub + studs + nuts rotate WITH the rotor (they're bolted together)
  T.round({ name: "hub.flange", group: hubSpin, layer: main, F: XF, s0: -32, s1: -24, r: 26, tone: "mid" });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const Fi = G.frameAlong([0, 19 * Math.cos(a), AXLE_Z + 19 * Math.sin(a)], [1, 0, 0]);
    T.round({ name: `hub.stud.${i}`, group: hubSpin, layer: main, F: Fi, s0: -24, s1: -16, r: 2.2, tone: "hi" });
    T.prism({ name: `hub.nut.${i}`, group: hubSpin, layer: main, F: Fi,
      polygon: hexPoly(3.6), s0: -16, s1: -11, tone: "mid" });
  }
  // stud-circle witness marking on the flange face
  const flange = T.parts.find((p) => p.name === "hub.flange");
  const ring = Array.from({ length: 64 }, (_, j) =>
    `${j ? "L" : "M"}${(19 * Math.cos((j / 64) * Math.PI * 2)).toFixed(2)} ${(19 * Math.sin((j / 64) * Math.PI * 2)).toFixed(2)}`).join("") + "Z";
  T.plane({ part: flange, o: [-24, 0, AXLE_Z], u: [0, 1, 0], v: [0, 0, 1],
    svg: `<path class="iso-line" data-tone="faint" d="${ring}"/>`, fade: [0.04, 0.3] });
}

// ---------------------------------------------------------------------------
// Rotor (hinge rotorSpin): vented 300 mm. Hat + cheeks as smooth T.round
// discs (no sector seams on the swept faces), 8 vent vanes, 5 lug-hole
// dark rings around the studs, witness rings + pad-transfer deposits.
// 51712-1U000.
// ---------------------------------------------------------------------------
function rotorParts() {
  const TAU = Math.PI * 2;
  T.round({ name: "rotor.hat", group: rotorSpin, layer: main, F: XF, s0: -24, s1: -13, r: 30, tone: "mid" });
  T.round({ name: "rotor.cheekIn", group: rotorSpin, layer: main, F: XF, s0: -13, s1: -6, r: 55, tone: "hi" });
  T.round({ name: "rotor.cheekOut", group: rotorSpin, layer: main, F: XF, s0: 6, s1: 13, r: 55, tone: "hi" });
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * TAU, c = Math.cos(th), s = Math.sin(th), t = 1.3;
    T.prism({ name: `rotor.vane.${i}`, group: rotorSpin, layer: main, F: XF,
      polygon: [
        [14 * c + t * s, 14 * s - t * c],
        [14 * c - t * s, 14 * s + t * c],
        [54 * c - t * s, 54 * s + t * c],
        [54 * c + t * s, 54 * s - t * c],
      ], s0: -6, s1: 6, tone: "mid" });
  }
  // swept-face witness rings on the outboard cheek
  const cheek = T.parts.find((p) => p.name === "rotor.cheekOut");
  const rings = [22, 32, 42, 50].map((r) => {
    const d = Array.from({ length: 72 }, (_, j) =>
      `${j ? "L" : "M"}${(r * Math.cos((j / 72) * TAU)).toFixed(2)} ${(r * Math.sin((j / 72) * TAU)).toFixed(2)}`).join("") + "Z";
    return `<path class="iso-line" data-tone="${r === 42 ? "mid" : "faint"}" d="${d}"/>`;
  }).join("");
  T.plane({ part: cheek, o: [13, 0, AXLE_Z], u: [0, 1, 0], v: [0, 0, 1], svg: rings, fade: [0.04, 0.3] });
  // pad-transfer deposits: subtle asymmetric arcs, like a real used rotor.
  // Broad, clearly visible bands in the swept region so rotation reads.
  const arc = (r0, r1, a0, a1) => {
    const p = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
    return `M${p(r0, a0)}A${r0} ${r0} 0 0 1 ${p(r0, a1)}L${p(r1, a1)}A${r1} ${r1} 0 0 0 ${p(r0, a0)}Z`;
  };
  const deposits = [
    arc(24, 40, 0.15, 1.45), arc(38, 52, 1.75, 2.85),
    arc(26, 42, 3.35, 4.55), arc(40, 53, 4.95, 5.95),
  ].map((d) => `<path class="rotor-deposit" d="${d}"/>`).join("");
  T.plane({ part: cheek, o: [13.15, 0, AXLE_Z], u: [0, 1, 0], v: [0, 0, 1], svg: deposits, fade: [0.04, 0.3] });
}

// ---------------------------------------------------------------------------
// Bracket (slide sBracket): window frames, bridges, bolts (78.5-98.1 N.m),
// abutment clips
// ---------------------------------------------------------------------------
function bracketParts() {
  const frame = (x0, tag) => {
    const w = 10;
    T.prism({ name: `bracket.${tag}.top`, group: sBracket, layer: main,
      plan: { x: x0, y: -38, w, d: 76, r: 2 }, z: 178, h: 12, tone: "mid" });
    T.prism({ name: `bracket.${tag}.bot`, group: sBracket, layer: main,
      plan: { x: x0, y: -38, w, d: 76, r: 2 }, z: 110, h: 12, tone: "mid" });
    T.prism({ name: `bracket.${tag}.sideA`, group: sBracket, layer: main,
      plan: { x: x0, y: -38, w, d: 6, r: 2 }, z: 122, h: 56, tone: "mid" });
    T.prism({ name: `bracket.${tag}.sideB`, group: sBracket, layer: main,
      plan: { x: x0, y: 32, w, d: 6, r: 2 }, z: 122, h: 56, tone: "mid" });
  };
  frame(-28, "in");
  frame(14, "out");
  for (const y of [-38, 30]) {
    T.prism({ name: `bracket.bridge.${y}`, group: sBracket, layer: main,
      plan: { x: -28, y, w: 54, d: 8, r: 2 }, z: 190, h: 10, tone: "mid" });
  }
  for (const y of [-28, 28]) {
    const Fb = G.frameAlong([0, y, 116], [1, 0, 0]);
    T.round({ name: `bracket.boltShaft.${y}`, group: sBracket, layer: main, F: Fb, s0: -48, s1: -28, r: 3.5, tone: "hi" });
    T.prism({ name: `bracket.boltHead.${y}`, group: sBracket, layer: main, F: Fb,
      polygon: hexPoly(5.5), s0: -54, s1: -48, tone: "mid" });
  }
  // abutment clips (y=±30..32, meet ears flush at y=±30, side bars flush at y=±32)
  for (const [x0, tag] of [[-28, "in"], [14, "out"]]) {
    for (const [y0, s] of [[30, "A"], [-32, "B"]]) {
      T.prism({ name: `bracket.clip.${tag}.${s}`, group: sBracket, layer: main,
        plan: { x: x0, y: y0, w: 10, d: 2, r: 0.5 }, z: 132, h: 38, tone: "hi" });
    }
  }
}

// ---------------------------------------------------------------------------
// Guide pins (slide sPins): split at the caliper wall faces (no bore holes),
// hex bolt heads. 21.6-31.4 N.m.
// ---------------------------------------------------------------------------
function pinParts() {
  for (const y of [-33, 33]) {
    const Fp = G.frameAlong([0, y, 168], [1, 0, 0]);
    T.round({ name: `pins.pinIn.${y}`, group: sPins, layer: main, F: Fp, s0: -46, s1: -44, r: 3, tone: "hi" });
    T.round({ name: `pins.pinOut.${y}`, group: sPins, layer: main, F: Fp, s0: -30, s1: 28, r: 3, tone: "hi" });
    T.prism({ name: `pins.bolt.${y}`, group: sPins, layer: main, F: Fp,
      polygon: hexPoly(4.5), s0: 28, s1: 33, tone: "mid" });
  }
}

// ---------------------------------------------------------------------------
// Piston (slide sPiston): cup ends flush at the caliper wall face.
// The bore reads via a dark ring marking on the wall.
// ---------------------------------------------------------------------------
function pistonParts() {
  T.round({ name: "piston.cup", group: sPiston, layer: main, F: XF, s0: -30, s1: -25, r: 15, tone: "hi" });
  const cup = T.parts.find((p) => p.name === "piston.cup");
  const ring = (r) => Array.from({ length: 48 }, (_, j) =>
    `${j ? "L" : "M"}${(r * Math.cos((j / 48) * Math.PI * 2)).toFixed(2)} ${(r * Math.sin((j / 48) * Math.PI * 2)).toFixed(2)}`).join("") + "Z";
  T.plane({ part: cup, o: [-25, 0, AXLE_Z], u: [0, 1, 0], v: [0, 0, 1],
    svg: `<path class="iso-line" data-tone="mid" d="${ring(12)}"/><path class="iso-line" data-tone="faint" d="${ring(6)}"/>`,
    fade: [0.04, 0.3] });
}

// ---------------------------------------------------------------------------
// Inner pad (slide sInnerPad): friction (lit) + backing + shim + ears.
// 58101-1UA11.
// ---------------------------------------------------------------------------
function innerPadParts() {
  T.prism({ name: "pad.friction", group: sInnerPad, layer: main,
    plan: { x: -20, y: -28, w: 3.5, d: 56, r: 6 }, z: 132, h: 38, tone: "hi", lit: true });
  T.prism({ name: "pad.backing", group: sInnerPad, layer: main,
    plan: { x: -24, y: -28, w: 4, d: 56, r: 6 }, z: 132, h: 38, tone: "mid" });
  T.prism({ name: "pad.shim", group: sInnerPad, layer: main,
    plan: { x: -25, y: -28, w: 1, d: 56, r: 0.5 }, z: 132, h: 38, tone: "lo" });
  T.prism({ name: "pad.earA", group: sInnerPad, layer: main,
    plan: { x: -24, y: 28, w: 4, d: 2, r: 1 }, z: 140, h: 12, tone: "mid" });
  T.prism({ name: "pad.earB", group: sInnerPad, layer: main,
    plan: { x: -24, y: -30, w: 4, d: 2, r: 1 }, z: 140, h: 12, tone: "mid" });
}

// ---------------------------------------------------------------------------
// Caliper (slide sCaliper): solid wall (bore as marking), bridge, fingers,
// outer pad, bleeder, banjo.
// ---------------------------------------------------------------------------
function caliperParts() {
  T.prism({ name: "caliper.wall", group: sCaliper, layer: main,
    plan: { x: -44, y: -38, w: 14, d: 76, r: 3 }, z: 126, h: 44, tone: "mid" });
  T.prism({ name: "caliper.bridge", group: sCaliper, layer: main,
    plan: { x: -44, y: -20, w: 74, d: 40, r: 4 }, z: 170, h: 14, tone: "mid" });
  T.prism({ name: "caliper.fingerA", group: sCaliper, layer: main,
    plan: { x: 25, y: -20, w: 8, d: 14, r: 3 }, z: 126, h: 44, tone: "mid" });
  T.prism({ name: "caliper.fingerB", group: sCaliper, layer: main,
    plan: { x: 25, y: 6, w: 8, d: 14, r: 3 }, z: 126, h: 44, tone: "mid" });
  T.prism({ name: "caliper.opFriction", group: sCaliper, layer: main,
    plan: { x: 16.5, y: -28, w: 3.5, d: 56, r: 6 }, z: 132, h: 38, tone: "hi" });
  T.prism({ name: "caliper.opBacking", group: sCaliper, layer: main,
    plan: { x: 20, y: -28, w: 4, d: 56, r: 6 }, z: 132, h: 38, tone: "mid" });
  T.prism({ name: "caliper.opShim", group: sCaliper, layer: main,
    plan: { x: 24, y: -28, w: 1, d: 56, r: 0.5 }, z: 132, h: 38, tone: "lo" });
  // bore mouth + boot read as markings on the wall's outboard face (x=-30)
  const wall = T.parts.find((p) => p.name === "caliper.wall");
  const ring = (r0, r1) => {
    const o = [], TAU = Math.PI * 2;
    for (let j = 0; j <= 48; j++) { const a = (j / 48) * TAU; o.push(`${j ? "L" : "M"}${(r1 * Math.cos(a)).toFixed(2)} ${(r1 * Math.sin(a)).toFixed(2)}`); }
    for (let j = 48; j >= 0; j--) { const a = (j / 48) * TAU; o.push(`L${(r0 * Math.cos(a)).toFixed(2)} ${(r0 * Math.sin(a)).toFixed(2)}`); }
    return o.join("") + "Z";
  };
  T.plane({ part: wall, o: [-30, 0, AXLE_Z], u: [0, 1, 0], v: [0, 0, 1],
    svg: `<path d="${ring(15, 16.5)}" fill="#0a0a0a"/><path class="iso-line" data-tone="faint" d="${ring(15, 17.6)}"/>`,
    fade: [0.04, 0.3] });
  // bleeder screw + cap (vertical: cheap fixed pictures)
  const FB = G.frameAlong([-36, 14, 0], [0, 0, 1]);
  T.round({ name: "caliper.bleeder", group: sCaliper, layer: main, F: FB, s0: 184, s1: 192, r: 2.2, tone: "mid" });
  T.round({ name: "caliper.bleederCap", group: sCaliper, layer: main, F: FB, s0: 192, s1: 196, r: 3, tone: "lo" });
  // banjo: stacked discs (washers read as the wide steps), barb on top
  const FJ = G.frameAlong([-36, -14, 0], [0, 0, 1]);
  T.round({ name: "caliper.washerA", group: sCaliper, layer: main, F: FJ, s0: 184, s1: 185.5, r: 4.5, tone: "hi" });
  T.round({ name: "caliper.banjoBolt", group: sCaliper, layer: main, F: FJ, s0: 185.5, s1: 192, r: 3, tone: "mid" });
  T.round({ name: "caliper.washerB", group: sCaliper, layer: main, F: FJ, s0: 192, s1: 193.5, r: 4.5, tone: "hi" });
  T.round({ name: "caliper.barb", group: sCaliper, layer: main, F: FJ, s0: 193.5, s1: 200, r: 2.5, tone: "mid" });
}

// ---------------------------------------------------------------------------
// Brake hose (slide sHose): tube from the banjo barb upward.
// ---------------------------------------------------------------------------
function hoseParts() {
  T.tube({ name: "hose.tube", group: sHose, layer: main,
    route: [[-36, -14, 200], [-44, -15.5, 206], [-52, -15.5, 210], [-57, -15.5, 211]],
    r: 3.25, chunk: 6, tone: "hi" });
}

// ---------------------------------------------------------------------------
// SECTION illustration: fixed longitudinal cutaway (y=0 plane) in true side
// elevation. Authored as 2D x-z profiles projected with P_SEC. Moving groups
// (piston, pads, caliper) translate horizontally with brake apply at runtime.
// ---------------------------------------------------------------------------
const SEC = (() => {
  const f = (v) => { const t = Math.round(v * 100) / 100; return t === 0 ? "0" : String(t); };
  const pt = (x, z) => k.iso([x, 0, z], P_SEC);
  const rect = (x0, x1, z0, z1) => {
    const [ax, ay] = pt(x0, z0), [bx, by] = pt(x1, z1);
    return `M${f(ax)} ${f(ay)}L${f(bx)} ${f(ay)}L${f(bx)} ${f(by)}L${f(ax)} ${f(by)}Z`;
  };
  // px per world x-unit (for runtime translation of moving groups)
  const kPx = pt(1, 0)[0] - pt(0, 0)[0];
  const cut = (d, extra = "") => `<path d="${d}" class="sec-cut"${extra}/>`;
  const solid = (d, tone = "", extra = "") => `<path d="${d}" class="sec-solid${tone ? " " + tone : ""}"${extra}/>`;
  const void_ = (d) => `<path d="${d}" class="sec-void"/>`;
  let s = "";
  // -- rotor (static)
  s += `<g id="sec-rotor">`;
  for (const [x0, x1, z0, z1] of [[-13,-6,113,155],[-13,-6,45,87],[6,13,113,155],[6,13,45,87],[-24,-13,109,130],[-24,-13,70,91]])
    s += cut(rect(x0, x1, z0, z1));
  for (const [z0, z1] of [[70,76],[97,103],[130,136]])
    s += solid(rect(-6, 6, z0, z1));
  s += `</g>`;
  // -- bracket ears (static, muted background)
  s += `<g id="sec-bracket" opacity="0.35">`;
  s += solid(rect(-30, -24, 125, 175)) + solid(rect(16, 22, 125, 175));
  s += `</g>`;
  // -- inner pad (moves +x)
  s += `<g id="sec-padIn">` + cut(rect(-20, -16.5, 132, 170)) + cut(rect(-24, -20, 132, 170))
    + solid(rect(-25, -24, 132, 170)) + `</g>`;
  // -- piston (moves +x): cup at pad height, face flush with bore mouth at rest
  s += `<g id="sec-piston">` + cut(rect(-40, -38, 139, 161)) + cut(rect(-38, -27, 158, 161)) + cut(rect(-38, -27, 139, 142)) + `</g>`;
  // -- caliper (moves -x): wall with bore cavity (evenodd), seal in bore groove,
  //    fluid passage, bridge, bleeder, banjo+hose
  const wallOuter = rect(-44, -28, 80, 170), bore = rect(-42, -27, 137, 163);
  s += `<g id="sec-caliper">`
    + `<path d="${wallOuter} ${bore}" class="sec-cut" fill-rule="evenodd"/>`
    + solid(rect(-29, -27, 154, 158), "sec-dk") + solid(rect(-29, -27, 142, 146), "sec-dk")
    + void_(rect(-39, -36, 163, 170))
    + cut(rect(-44, 30, 170, 184))
    + solid(rect(25, 33, 126, 170), "", ` opacity="0.5"`)
    + cut(rect(-40, -34, 170, 178))
    + solid(rect(-37.5, -34.5, 178, 190))
    + `<path d="${rect(-37.5, -34.5, 190, 194)}" class="sec-solid"/>`
    + solid(rect(-38, -34, 190, 196));
  const [hax, hay] = pt(-36, 196), [hbx, hby] = pt(-30, 204), [hcx, hcy] = pt(-20, 212);
  const hoseD = `M${f(hax)} ${f(hay)}C${f(hbx)} ${f(hby)} ${f(hbx)} ${f(hby)} ${f(hcx)} ${f(hcy)}`;
  const hoseW = f(6.5 * kPx / 10);
  s += `<path d="${hoseD}" class="sec-hose" stroke-width="${hoseW}"/>`;
  // -- pressurised fluid: hose + passage flow dashes (opacity driven by flow)
  s += `<path id="sec-hoseflow" d="${hoseD}" class="sec-flowdash" stroke-width="${hoseW}" opacity="0"/>`;
  {
    const pxx = pt(-37.5, 166)[0], py1 = pt(-37.5, 169)[1], py2 = pt(-37.5, 164)[1];
    s += `<line id="sec-passflow" x1="${f(pxx)}" y1="${f(py1)}" x2="${f(pxx)}" y2="${f(py2)}" class="sec-flowdash" stroke-width="3" opacity="0"/>`;
  }
  // -- fluid chamber behind the piston: fills + pulses with apply (width set per frame)
  const chX = pt(-42, 150)[0], chY = pt(-42, 161)[1], chH = pt(-42, 139)[1] - pt(-42, 161)[1];
  s += `<rect id="sec-chamber" x="${f(chX)}" y="${f(chY)}" width="0" height="${f(chH)}" fill="url(#secFluid)" filter="url(#secFluidSoft)" opacity="0"/>`;
  s += `</g>`;
  // -- outer pad (moves -x with caliper)
  s += `<g id="sec-padOut">` + cut(rect(16.5, 20, 132, 170)) + cut(rect(20, 24, 132, 170))
    + solid(rect(24, 25, 132, 170)) + `</g>`;
  // -- heat glows at the two pad/rotor interfaces
  const glowAt = (x, z, id) => {
    const [gx, gy] = pt(x, z);
    return `<ellipse id="${id}" cx="${f(gx)}" cy="${f(gy)}" rx="${f(9 * kPx)}" ry="${f(20 * kPx)}" fill="url(#secHeat)" opacity="0"/>`;
  };
  s += `<g id="sec-glow">${glowAt(-14.75, 143, "secGlowIn")}${glowAt(14.75, 143, "secGlowOut")}</g>`;
  // -- leader-line labels (static text; lines/dots updated per frame for moving groups)
  const labels = [
    { t: "Brake hose", tx: -72, ty: 210, anchor: "end", dot: [-28, 206], g: "sec-caliper" },
    { t: "Bleeder screw", tx: -72, ty: 192, anchor: "end", dot: [-36, 189], g: "sec-caliper" },
    { t: "Fluid inlet", tx: -72, ty: 172, anchor: "end", dot: [-37.5, 166], g: "sec-caliper" },
    { t: "Piston", tx: -72, ty: 150, anchor: "end", dot: [-33, 150], g: "sec-piston" },
    { t: "Piston seal", tx: -72, ty: 136, anchor: "end", dot: [-28, 156], g: "sec-caliper" },
    { t: "Caliper body", tx: -72, ty: 118, anchor: "end", dot: [-42, 125], g: "sec-caliper" },
    { t: "Inner pad", tx: 60, ty: 140, anchor: "start", dot: [-20, 151], g: "sec-padIn" },
    { t: "Outer pad", tx: 60, ty: 156, anchor: "start", dot: [20, 151], g: "sec-padOut" },
    { t: "Rotor · Ø300 mm vented", tx: 60, ty: 62, anchor: "start", dot: [9, 60], g: null },
  ];
  let lg = `<g id="sec-labels" font-family="ui-monospace,Menlo,monospace" font-size="11">`;
  const labelData = [];
  labels.forEach((L, i) => {
    const [dx, dy] = pt(L.dot[0], L.dot[1]);
    const [tx, ty] = pt(L.tx, L.ty);
    labelData.push({ i, g: L.g, x: +dx.toFixed(1), y: +dy.toFixed(1) });
    lg += `<line id="sec-ll${i}" class="sec-ll" x1="${f(tx)}" y1="${f(ty)}" x2="${f(dx)}" y2="${f(dy)}"/>`
      + `<circle id="sec-ld${i}" class="sec-ld" cx="${f(dx)}" cy="${f(dy)}" r="2.6"/>`
      + `<text class="sec-t" x="${f(tx)}" y="${f(ty - 4)}" text-anchor="${L.anchor}">${L.t}</text>`;
  });
  lg += `</g>`;
  s += lg;
  const svg = `<svg id="sec-svg" xmlns="http://www.w3.org/2000/svg" class="iso-svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Longitudinal section through the floating-caliper brake"><defs>`
    + `<pattern id="secHatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="7" height="7" class="sec-hatch-bg"/><line x1="0" y1="0" x2="0" y2="7" class="sec-hatch-ln"/></pattern>`
    + `<radialGradient id="secHeat" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffb03a" stop-opacity="0.95"/><stop offset="45%" stop-color="#ff5a00" stop-opacity="0.55"/><stop offset="100%" stop-color="#ff3d00" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="secFluid" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#0090c8"/><stop offset="55%" stop-color="#00e5ff"/><stop offset="100%" stop-color="#aef7ff"/></linearGradient>`
    + `<filter id="secFluidSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>`
    + `</defs>${s}</svg>`;
  return { svg, kPx, labelData, fluid: { x0: chX, kPx } };
})();

// Section illustration styling, theme-baked like the rest (no var() at runtime).
const SEC_CSS = `
.sec-hatch-bg{fill:var(--anatomy-shade-1)}
.sec-hatch-ln{stroke:var(--anatomy-lo);stroke-width:1.2}
.sec-cut{fill:url(#secHatch);stroke:var(--anatomy-mid);stroke-width:1}
.sec-solid{fill:var(--anatomy-top);stroke:var(--anatomy-mid);stroke-width:1}
.sec-solid.sec-dk{fill:var(--anatomy-shade-0)}
.sec-void{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:1}
.sec-hose{fill:none;stroke:var(--anatomy-mid);stroke-linecap:round}
.sec-t{fill:var(--anatomy-muted)}
.sec-ll{stroke:var(--anatomy-lo);stroke-width:1}
.sec-ld{fill:var(--anatomy-hi)}
.sec-flowdash{fill:none;stroke:#00e5ff;stroke-linecap:round;stroke-dasharray:7 13;animation:sec-flow 1100ms linear infinite}
@keyframes sec-flow{to{stroke-dashoffset:-40}}
`;

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
baseStatic();
knuckleParts();
hubParts();
rotorParts();
bracketParts();
pinParts();
pistonParts();
innerPadParts();
caliperParts();
hoseParts();

const verify = argv.includes("--verify");
const out = T.build({ statics: R.items, poses, verify });
A.settle(R, P);
console.log(`build ok · ${out.report.parts} parts · ` +
  out.report.layers.map((l) => `${l.name}: ${l.planar} planar, ${l.dynamic} dynamic`).join(" · ") +
  ` · ${out.report.seconds.toFixed(1)}s`);

if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, {
    sweep: { at: (x) => follow({ spin: x }), from: 0, to: 360, frame: 2 },
    clips: [
      { name: "explode", at: (t) => follow({ spin: 30, ex: t / 5, brake: 0 }), from: 0, to: 5, frame: 1 / 12 },
      { name: "brake", at: (t) => follow({ spin: 120, ex: 0, brake: Math.min(1, t / 2) }), from: 0, to: 3, frame: 1 / 12 },
    ],
    quick: argv.includes("--quick"),
    only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null,
  });
}

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------
const layerOf = (name) => R.items.filter((i) => i.layer === name).sort((a, b) => a.key - b.key).map((i) => i.svg);
const BACK = [HALO_SVG, ...layerOf("back")];
const backSvg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "A single-piston floating-caliper disc brake on a display stand. Drag to spin the assembly 360 degrees.",
  body: BACK,
});
const liveSvg = out.layerSvg("main", { width: WIDTH, height: HEIGHT });
const overlaySvg = `<svg id="fx-overlay" xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-overlay" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true"><defs>
      <radialGradient id="heatGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffb03a" stop-opacity="0.95"/>
        <stop offset="45%" stop-color="#ff5a00" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ff3d00" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="fluidGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#d8fbff" stop-opacity="1"/>
        <stop offset="35%" stop-color="#00e5ff" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
    </defs><ellipse id="glowIn" fill="url(#heatGrad)" filter="url(#soft)" rx="46" ry="30" opacity="0"/><ellipse id="glowOut" fill="url(#heatGrad)" filter="url(#soft)" rx="46" ry="30" opacity="0"/><circle id="banjoPulse" r="6" fill="url(#fluidGrad)" opacity="0"/></svg>`;

const css = readFileSync(join(HERE, "skill.css"), "utf8");
const EXTRA_CSS = `
.iso-stage{position:relative;cursor:grab;touch-action:pan-y}
.iso-stage svg.iso-svg{display:block;width:100%;height:auto}
.iso-stage svg.iso-live,.iso-stage svg.iso-overlay{position:absolute;inset:0;width:100%;height:100%}
.iso-stage svg.iso-overlay{pointer-events:none}
.iso-stage.dragging{cursor:grabbing}
.brake-controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}
.brake-controls button{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--anatomy-face);color:var(--anatomy-text);border:1px solid var(--anatomy-lo);border-radius:6px;padding:6px 11px;cursor:pointer}
.brake-controls button:hover{border-color:var(--anatomy-mid);color:var(--anatomy-strong)}
.brake-controls button.on{background:var(--anatomy-strong);border-color:var(--anatomy-strong);color:var(--anatomy-paper)}
.brake-controls button:focus-visible{outline:2px solid var(--anatomy-blue);outline-offset:2px}
#bTheme{margin-left:auto;display:inline-flex;align-items:center;padding:6px 9px}
#bTheme svg{width:14px;height:14px;display:block}
#stepText{font-size:12px;color:var(--anatomy-muted);margin-left:6px;flex:1 1 100%}
#sec-wrap{margin:0 auto}
#sec-wrap[hidden]{display:none}
.iso-stage>svg{transition:opacity .45s ease}
#live-labels text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;fill:var(--anatomy-mid)}
#live-labels line{stroke:var(--anatomy-lo);stroke-width:1}
#live-labels circle{fill:var(--anatomy-hi)}
.rotor-deposit{fill:var(--anatomy-hi);stroke:none;opacity:.6}
/* the plate is capped at 700px, so the bottom corners always get wrapping room */
.iso-plate-corner[data-corner="readout"],.iso-plate-corner[data-corner="hint"]{white-space:normal;max-width:60%;line-height:1.5}
.iso-plate-corner[data-corner="readout"]{text-align:right}
`;

const dims = (svg) => svg.replace("<svg ", `<svg width="${WIDTH}" height="${HEIGHT}" `);
const backSvgSized = dims(backSvg);
const liveSvgSized = dims(liveSvg);
const overlaySvgSized = overlaySvg.replace('<svg ', `<svg width="${WIDTH}" height="${HEIGHT}" `);
const liveLabelsSvg = `<svg id="live-labels" xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-overlay" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true" style="pointer-events:none"></svg>`;
const body = `<figure class="iso-figure"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Floating-caliper disc brake</span><span class="iso-plate-corner" data-corner="hint">Tap: apply/release · drag: spin</span><span class="iso-plate-corner" data-corner="readout" data-readout>RELEASED · 0 bar · clamp 0.0 kN · rotor 25°C · 60 km/h</span></div><div class="brake-controls">
  <button id="bApply" type="button" aria-pressed="false">Apply brakes</button>
  <button id="bExplode" type="button" aria-pressed="false">Explode</button>
  <button id="bOrtho" type="button" aria-pressed="false">Ortho</button>
  <button id="bSection" type="button" aria-pressed="false">Section</button>
  <button id="bLabels" type="button" aria-pressed="false">Labels</button>
  <button id="bTheme" type="button" aria-pressed="false" aria-label="Switch to light theme"><svg id="icoSun" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><svg id="icoMoon" viewBox="0 0 16 16" aria-hidden="true" style="display:none"><path d="M13.5 9.5A6 6 0 1 1 6.5 2.5a4.8 4.8 0 0 0 7 7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button>
  <span id="stepText" aria-live="polite"></span>
</div><div class="iso-stage" tabindex="0" role="switch" aria-checked="false" aria-label="Brake demonstration. Tap or press Space to apply or release the brakes. Drag to spin the assembly. Press E to explode or assemble the view. Press O for ortho view, S for section view.">${backSvgSized}${liveSvgSized}${overlaySvgSized}${liveLabelsSvg}</div><div id="sec-wrap" hidden>${SEC.svg}</div><p class="components"><strong>Components:</strong> 2013 Kia Sorento front · vented rotor (Ø300 mm) · inner pad · outer pad · floating caliper · hydraulic piston · caliper bracket · guide pins · brake hose · wheel hub.<br><strong>Torques (Kia Sorento XM factory manual):</strong> lug nuts 88.3–107.9 N·m (65.1–79.6 lb-ft) · bracket-to-knuckle bolts 78.5–98.1 N·m (57.9–72.3 lb-ft) · guide-rod bolts 21.6–31.4 N·m (15.9–23.1 lb-ft).<br>OEM: rotor 51712-1U000, pads 58101-1UA11. Not to scale; the hydraulic model assumes a 60 mm piston and μ 0.40.</p></div><figcaption class="iso-legend"><span class="iso-keys"><span class="iso-key"><svg class="iso-swatch" data-mark="lit" viewBox="0 0 16 10" aria-hidden="true"><path d="M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z"/><path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/></svg>Inner pad: the first part to move</span><span class="iso-key"><svg class="iso-swatch" data-mark="blue" viewBox="0 0 16 10" aria-hidden="true"><path d="M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z"/><path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/></svg>Blue pulse: pressurised brake fluid</span><span class="iso-key"><svg class="iso-swatch" data-mark="lit" viewBox="0 0 16 10" aria-hidden="true"><path d="M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z"/><path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/></svg>Rotor turns at road speed — watch the lug nuts orbit</span></span><span class="iso-caption">One hydraulic piston does the work of two. Pedal pressure drives the piston against the inner pad; the reaction slides the whole caliper body along its guide pins, dragging the outer pad onto the far face. The vented rotor is squeezed from both sides and 60 km/h of motion becomes heat in the swept ring.</span></figcaption></figure>`;

// ---------------------------------------------------------------------------
// Live script: turntable + brake physics. TURN runtime is inlined above.
// ---------------------------------------------------------------------------
const liveScript = `
const TRAVEL = ${TRAVEL}, AXLE_Z = ${AXLE_Z}, WIDTH = ${WIDTH}, HEIGHT = ${HEIGHT};
const P_ISO = { azimuth: ${P.azimuth}, elevation: ${P.elevation}, scale: ${P.scale}, origin: [${P.origin}] };
const P_ORTHO = { azimuth: ${P_ORTHO.azimuth}, elevation: ${P_ORTHO.elevation}, scale: ${P_ORTHO.scale}, origin: [${P_ORTHO.origin}] };
const SEC_K = ${SEC.kPx};
const SEC_LABELS = ${JSON.stringify(SEC.labelData)};
const SEC_FX0 = ${SEC.fluid.x0};
// 3D anchor points (group, rest position) for the heat glows.
const HALO_3D = {
  contactIn: ["sRotor", [-13, 0, 154]],
  contactOut: ["sRotor", [13, 0, 154]],
};
const EX = [["sRotor",25,"Rotor onto the hub"],["sBracket",70,"Bracket to the knuckle"],["sInnerPad",130,"Pads into the bracket"],["sPiston",-40,"Piston into the caliper bore"],["sCaliper",165,"Caliper over the pads"],["sPins",190,"Guide pins through the caliper"],["sHose",215,"Brake hose to the banjo"]];
const EX_ASSEMBLE = [["sRotor",0],["sBracket",0.7],["sInnerPad",1.4],["sPiston",2],["sCaliper",2],["sPins",2.8],["sHose",3.4]];
const EX_EXPLODE = [["sHose",0],["sPins",0.3],["sCaliper",0.6],["sPiston",0.6],["sInnerPad",0.9],["sBracket",1.2],["sRotor",1.5]];
// One model drives the motion, the glow and every readout number.
const M = {
  pistonA: Math.PI / 4 * 0.06 * 0.06, // 60 mm piston (illustrative)
  lineMax: 120e5,                     // 120 bar max line pressure
  mu: 0.40, rEff: 0.12,               // pad mu, effective radius of the 300 mm rotor
  rWheel: 0.368, mCorner: 450,        // 235/65R17, quarter-car mass
  rotorM: 7.2, rotorC: 460, v0: 16.667 // 60 km/h in m/s
};
const S_ = { apply: 0, target: 0, flow: 0, flowPhase: 0, speed: M.v0, temp: 25, spin: 0, rotorAngle: 0,
  ex: {}, exploded: 1, clock: 0, pending: [], assembling: false, armed: null, phaseKind: "exploded",
  narrated: "", autoPlayed: false, ortho: 0, orthoT: 0, section: false, labelsManual: null };
for (const [g] of EX) S_.ex[g] = { x: 1, t: 1 };
const stage = document.querySelector(".iso-stage");
const controller = TURN.mount(stage, DATA.turn, {});
const bExplode = document.getElementById("bExplode");
const bApply = document.getElementById("bApply");
const glowIn = document.getElementById("glowIn"), glowOut = document.getElementById("glowOut");
const readout = document.querySelector("[data-readout]");
const stepText = document.getElementById("stepText");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const Fclamp = () => S_.apply * M.lineMax * M.pistonA;               // N, per side
const anchorOf = (key) => { const [g, p] = HALO_3D[key]; return controller.anchor(g, p).screen; };
const backSvgEl = stage.querySelector(":scope > svg.iso-svg:not(.iso-live):not(.iso-overlay)");
let orthoDirty = false, detailFlip = false;
function applyCamera() {
  const t = S_.ortho * S_.ortho * (3 - 2 * S_.ortho);
  const P = DATA.turn.P;
  P.azimuth = P_ISO.azimuth + (P_ORTHO.azimuth - P_ISO.azimuth) * t;
  P.elevation = P_ISO.elevation + (P_ORTHO.elevation - P_ISO.elevation) * t;
  P.scale = P_ISO.scale + (P_ORTHO.scale - P_ISO.scale) * t;
  P.origin[0] = P_ISO.origin[0] + (P_ORTHO.origin[0] - P_ISO.origin[0]) * t;
  P.origin[1] = P_ISO.origin[1] + (P_ORTHO.origin[1] - P_ISO.origin[1]) * t;
  if (backSvgEl) backSvgEl.style.opacity = String(1 - t);
}
function renderFigure() {
  const a = S_.apply;
  const vals = {
    spin: S_.spin,
    rotorSpin: ((S_.rotorAngle * 180) / Math.PI) % 360,
    hubSpin: ((S_.rotorAngle * 180) / Math.PI) % 360,
    sRotor: S_.ex.sRotor.x * 25,
    sBracket: S_.ex.sBracket.x * 70,
    sInnerPad: S_.ex.sInnerPad.x * 130 + a * TRAVEL,
    sPiston: S_.ex.sPiston.x * -40 + a * TRAVEL,
    sCaliper: S_.ex.sCaliper.x * 165 - a * TRAVEL,
    sPins: S_.ex.sPins.x * 190,
    sHose: S_.ex.sHose.x * 215,
  };
  if (orthoDirty) {
    applyCamera(); orthoDirty = false;
    detailFlip = !detailFlip; // force full re-emit: the camera moved but group values may not have
    controller.set(vals, { detail: detailFlip ? 1 : 0.999 });
  } else {
    controller.set(vals);
  }
  const exVis = S_.exploded > 0.02 ? 0 : 1;
  const braking = (S_.apply > 0.05 && S_.speed > 0.5) ? 1 : 0; // friction glow only while actively braking
  const heat = clampN((S_.temp - 30) / 22, 0, 1) * braking;
  const go = (heat * 0.85 * exVis).toFixed(3);
  for (const [el, key] of [[glowIn, "contactIn"], [glowOut, "contactOut"]]) {
    const [x, y] = anchorOf(key);
    el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1));
    el.setAttribute("opacity", go);
  }
}
function exMoving() { for (const [g] of EX) { const s = S_.ex[g]; if (Math.abs(s.t - s.x) > 0.004) return true; } return false; }
function explodePhase() {
  let worst = null, wv = 0, wt = 0;
  for (const [g, , label] of EX) { const s = S_.ex[g]; const d = Math.abs(s.t - s.x); if (d > wv) { wv = d; worst = label; wt = s.t; } }
  if (worst && wv > 0.004) return (wt === 0 ? "Assembling — " : "Exploding — ") + worst;
  return null;
}
// --- Pandora-blue fluid, positioned per frame ---
const fxOverlay = document.getElementById("fx-overlay");
const banjoPulse = document.getElementById("banjoPulse");
const fluidDots = [];
{
  const ns = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 6; i++) {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("r", "3.2");
    c.setAttribute("fill", "url(#fluidGrad)");
    c.setAttribute("opacity", "0");
    fxOverlay.appendChild(c);
    fluidDots.push(c);
  }
}
// Brake-hose route in the sHose group frame; fluid flows top -> banjo.
const HOSE_ROUTE = [[-57, -15.5, 211], [-52, -15.5, 210], [-44, -15.5, 206], [-36, -14, 200]];
const HOSE_SEGS = [];
let HOSE_LEN = 0;
for (let i = 0; i < HOSE_ROUTE.length - 1; i++) {
  const a = HOSE_ROUTE[i], b = HOSE_ROUTE[i + 1];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  HOSE_SEGS.push(l); HOSE_LEN += l;
}
const hosePoint = (t) => {
  let d = t * HOSE_LEN;
  for (let i = 0; i < HOSE_SEGS.length; i++) {
    if (d <= HOSE_SEGS[i] || i === HOSE_SEGS.length - 1) {
      const f = HOSE_SEGS[i] ? d / HOSE_SEGS[i] : 0;
      const a = HOSE_ROUTE[i], b = HOSE_ROUTE[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    d -= HOSE_SEGS[i];
  }
  return HOSE_ROUTE[HOSE_ROUTE.length - 1];
};
// Current camera view direction (toward viewer), honouring the ortho blend.
function camNow() {
  const t = S_.ortho * S_.ortho * (3 - 2 * S_.ortho);
  const az = (P_ISO.azimuth + (P_ORTHO.azimuth - P_ISO.azimuth) * t) * Math.PI / 180;
  const el = (P_ISO.elevation + (P_ORTHO.elevation - P_ISO.elevation) * t) * Math.PI / 180;
  return [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
}
function updateMotion() {
  const exVis = S_.exploded > 0.02 ? 0 : 1;
  // fluid dots stream down the hose into the banjo while pressure builds
  const fo = S_.flow * exVis;
  for (let i = 0; i < fluidDots.length; i++) {
    const t = (i / fluidDots.length + S_.flowPhase) % 1;
    const s = controller.anchor("sHose", hosePoint(t)).screen;
    const el = fluidDots[i];
    el.setAttribute("cx", s[0].toFixed(1));
    el.setAttribute("cy", s[1].toFixed(1));
    el.setAttribute("opacity", fo.toFixed(2));
  }
  const bp = controller.anchor("sCaliper", [-36, -14, 190]).screen;
  banjoPulse.setAttribute("cx", bp[0].toFixed(1));
  banjoPulse.setAttribute("cy", bp[1].toFixed(1));
  banjoPulse.setAttribute("opacity", (fo * (0.55 + 0.45 * Math.sin(S_.clock * 10))).toFixed(2));
}
function draw() {
  renderFigure();
  updateMotion();
  const kN = Fclamp() / 1000, kmh = S_.speed * 3.6, tC = S_.temp;
  const bar = Math.round(S_.apply * 120);
  const ep = explodePhase();
  const explodedRest = !ep && S_.exploded > 0.5;
  const status = S_.target > 0.05 ? (S_.speed > 0.5 ? "BRAKING" : "HELD") : "RELEASED";
  const text = ep || (explodedRest ? "exploded · 7 assemblies"
    : (status + " · " + bar + " bar · clamp " + kN.toFixed(1) + " kN · rotor " + tC.toFixed(0) + "°C · " + kmh.toFixed(0) + " km/h"));
  if (readout.textContent !== text) readout.textContent = text;
  if (S_.target > 0.05 && S_.speed <= 0.05 && S_.narrated !== "held") {
    S_.narrated = "held";
    stepText.textContent = "Clamped — holding 0 km/h · heat soaking into the rotor";
  }
  const pk = ep ? (ep.charAt(0) === "A" ? "assembling" : "exploding") : (S_.exploded > 0.5 ? "exploded" : "ready");
  if (pk !== S_.phaseKind) {
    S_.phaseKind = pk;
    stepText.textContent = ep || (pk === "exploded" ? "Exploded view · 7 assemblies · press E to assemble" : "Assembled · tap Apply brakes to run a stop");
  }
  stage.setAttribute("aria-valuetext", text);
  updateLiveLabels();
  if (S_.section) updateSection();
}
let frame = 0, last = 0, visible = false, clock = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  S_.clock += dt;
  for (const q of S_.pending) if (S_.clock >= q.at) S_.ex[q.part].t = q.t;
  if (S_.pending.length) S_.pending = S_.pending.filter((q) => S_.clock < q.at);
  let exMove = false;
  for (const [g] of EX) {
    const s = S_.ex[g];
    if (s.x !== s.t) {
      s.x += (s.t - s.x) * (1 - Math.exp(-dt / 0.35));
      if (Math.abs(s.t - s.x) < 0.004) s.x = s.t; else exMove = true;
    }
  }
  S_.exploded = 0;
  for (const [g] of EX) S_.exploded = Math.max(S_.exploded, S_.ex[g].x);
  if (S_.assembling && !S_.pending.length && !exMove) {
    S_.assembling = false;
    const f = S_.armed; S_.armed = null;
    const firstAssembly = !S_.autoPlayed;
    S_.autoPlayed = true;
    if (f) f();
    else if (firstAssembly && !still.matches) applyBrakes();
  }
  // brake apply (smoothed), fluid flow (leads the piston), wheel speed, heat
  S_.apply += (S_.target - S_.apply) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(S_.target - S_.apply) < 0.002) S_.apply = S_.target;
  S_.flow += (S_.target - S_.flow) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(S_.target - S_.flow) < 0.004) S_.flow = S_.target;
  S_.flowPhase = (S_.flowPhase + dt * S_.flow * 0.45) % 1;
  if (S_.apply > 0.02 && S_.speed > 0) {
    S_.speed = Math.max(0, S_.speed - 2.8 * S_.apply * dt); // ~6 s stop from 60 km/h
  } else if (S_.apply <= 0.02 && S_.speed < M.v0) {
    S_.speed = Math.min(M.v0, S_.speed + (M.v0 / 2.5) * dt); // spin back up in ~2.5 s
  }
  const Fcontact = 2 * M.mu * Fclamp() * M.rEff / M.rWheel;
  const Fbrake = Math.min(Fcontact, M.mCorner * 9.2);
  if (S_.speed > 0 && S_.apply > 0.02) S_.temp += (Fbrake * S_.speed * dt) / (M.rotorM * M.rotorC);
  S_.temp += (25 - S_.temp) * (0.02 + 0.3 * (S_.speed / M.v0)) * dt; // airflow: spinning rotor sheds heat fast, held rotor stays hot
  S_.rotorAngle += dt * (S_.speed / M.v0) * Math.PI * 2 * 1.5; // 1.5 rev/s at cruise
  if (S_.ortho !== S_.orthoT) {
    S_.ortho += (S_.orthoT - S_.ortho) * (1 - Math.exp(-dt / 0.45));
    if (Math.abs(S_.orthoT - S_.ortho) < 0.004) S_.ortho = S_.orthoT;
    orthoDirty = true;
  }
  draw();
  // the rotor turns at cruise, so the loop runs whenever visible
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  if (!frame) last = 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function poke() { run(); }
function ensureAssembled(then) {
  if (S_.exploded < 0.02 && !S_.pending.length && !S_.assembling) { then(); return; }
  S_.armed = then;
  S_.pending = EX_ASSEMBLE.map(([p, d]) => ({ part: p, at: S_.clock + d, t: 0 }));
  S_.assembling = true;
  bExplode.textContent = "Explode";
  bExplode.setAttribute("aria-pressed", "false");
  poke();
}
function toggleExplode() {
  S_.armed = null;
  S_.target = 0;
  setApplyUI();
  const toExploded = S_.exploded < 0.5;
  const seq = toExploded ? EX_EXPLODE : EX_ASSEMBLE;
  S_.pending = seq.map(([p, d]) => ({ part: p, at: S_.clock + d, t: toExploded ? 1 : 0 }));
  S_.assembling = !toExploded;
  bExplode.textContent = toExploded ? "Assemble" : "Explode";
  bExplode.setAttribute("aria-pressed", toExploded ? "true" : "false");
  poke();
}
// The single end-to-end brake animation: Apply -> fluid surges, piston drives,
// pads clamp, 60 km/h decays to 0, heat builds. Release stops it immediately.
function setApplyUI() {
  const on = S_.target > 0.05;
  bApply.textContent = on ? "Release brakes" : "Apply brakes";
  bApply.setAttribute("aria-pressed", on ? "true" : "false");
  bApply.classList.toggle("on", on);
}
function applyBrakes() {
  const go = () => {
    S_.target = 1;
    S_.narrated = "apply";
    setApplyUI();
    stepText.textContent = "Pressurised fluid surging through the hose — piston driving forward…";
    poke();
  };
  ensureAssembled(go);
  poke();
}
function releaseBrakes() {
  S_.target = 0;
  S_.narrated = "release";
  setApplyUI();
  stepText.textContent = "Released — fluid ebbing back · spinning up to 60 km/h";
  poke();
}
function toggleBrake() { (S_.target > 0.05 ? releaseBrakes : applyBrakes)(); }
const bOrtho = document.getElementById("bOrtho");
const bSection = document.getElementById("bSection");
const bLabels = document.getElementById("bLabels");
const bTheme = document.getElementById("bTheme");
const secWrap = document.getElementById("sec-wrap");
function setTheme(t) {
  document.body.setAttribute("data-theme", t);
  const light = t === "light";
  bTheme.setAttribute("aria-pressed", light ? "true" : "false");
  bTheme.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  document.getElementById("icoSun").style.display = light ? "none" : "";
  document.getElementById("icoMoon").style.display = light ? "" : "none";
  draw(); poke();
}
function setOrtho(on) {
  S_.orthoT = on ? 1 : 0;
  bOrtho.setAttribute("aria-pressed", on ? "true" : "false");
  bOrtho.classList.toggle("on", on);
  if (still.matches) { S_.ortho = S_.orthoT; orthoDirty = true; draw(); }
  else { run(); poke(); }
}
function setSection(on) {
  S_.section = on;
  secWrap.hidden = !on;
  stage.style.display = on ? "none" : "";
  bSection.setAttribute("aria-pressed", on ? "true" : "false");
  bSection.classList.toggle("on", on);
  if (on) ensureAssembled(() => {});
  draw(); run(); poke();
}
function labelsEffective() {
  return S_.labelsManual !== null ? S_.labelsManual : (S_.ortho > 0.5 || S_.section);
}
function setLabelsCycle() {
  S_.labelsManual = !labelsEffective();
  const on = labelsEffective();
  bLabels.setAttribute("aria-pressed", on ? "true" : "false");
  bLabels.classList.toggle("on", !!on);
  stepText.textContent = "Labels " + (on ? "on" : "off");
  draw(); poke();
}
// Section illustration runtime: translate moving groups with apply, heat glow, moving label dots.
const secEls = {};
["sec-piston", "sec-padIn", "sec-caliper", "sec-padOut", "secGlowIn", "secGlowOut",
 "sec-chamber", "sec-hoseflow", "sec-passflow"].forEach((id) => { secEls[id] = document.getElementById(id); });
function updateSection() {
  const dx = S_.apply * TRAVEL * SEC_K;
  secEls["sec-piston"].setAttribute("transform", "translate(" + dx.toFixed(1) + " 0)");
  secEls["sec-padIn"].setAttribute("transform", "translate(" + dx.toFixed(1) + " 0)");
  secEls["sec-caliper"].setAttribute("transform", "translate(" + (-dx).toFixed(1) + " 0)");
  secEls["sec-padOut"].setAttribute("transform", "translate(" + (-dx).toFixed(1) + " 0)");
  const braking = (S_.apply > 0.05 && S_.speed > 0.5) ? 1 : 0; // friction glow only while actively braking
  const heat = clampN((S_.temp - 30) / 22, 0, 1) * braking;
  const go = (heat * 0.85).toFixed(3);
  secEls["secGlowIn"].setAttribute("opacity", go);
  secEls["secGlowOut"].setAttribute("opacity", go);
  // fluid chamber behind the piston: fills with apply, pulses with flow
  const ap = S_.apply, fl = S_.flow;
  secEls["sec-chamber"].setAttribute("width", ((2 + ap * TRAVEL) * SEC_K).toFixed(1));
  secEls["sec-chamber"].setAttribute("opacity",
    (ap <= 0.01 ? 0 : Math.min(1, 0.45 + 0.4 * ap + 0.15 * fl * Math.sin(S_.clock * 9))).toFixed(2));
  secEls["sec-hoseflow"].setAttribute("opacity", fl.toFixed(2));
  secEls["sec-passflow"].setAttribute("opacity", fl.toFixed(2));
  for (const L of SEC_LABELS) {
    if (!L.g) continue;
    const off = (L.g === "sec-piston" || L.g === "sec-padIn") ? dx : -dx;
    document.getElementById("sec-ll" + L.i).setAttribute("x2", (L.x + off).toFixed(1));
    document.getElementById("sec-ld" + L.i).setAttribute("cx", (L.x + off).toFixed(1));
  }
  document.getElementById("sec-labels").style.display = labelsEffective() ? "" : "none";
}
// Live-view leader labels: per-frame anchor tracking, de-collided side columns.
const LIVE_LABEL_DEFS = [
  { t: "Brake hose", g: "sHose", p: [-46, -15.5, 206] },
  { t: "Piston", g: "sPiston", p: [-27, 0, 100] },
  { t: "Inner pad", g: "sInnerPad", p: [-18, 0, 150] },
  { t: "Outer pad", g: "sCaliper", p: [20, 0, 150] },
  { t: "Rotor · Ø300 mm", g: "sRotor", p: [0, 0, 45] },
  { t: "Caliper body", g: "sCaliper", p: [-37, 0, 150] },
  { t: "Guide pins", g: "sPins", p: [0, 33, 168] },
  { t: "Bracket", g: "sBracket", p: [-23, 0, 185] },
];
const liveLabelsSvg = document.getElementById("live-labels");
const liveLabelEls = LIVE_LABEL_DEFS.map((d) => {
  const ns = "http://www.w3.org/2000/svg";
  const line = document.createElementNS(ns, "line");
  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("r", "2.6");
  const text = document.createElementNS(ns, "text");
  text.textContent = d.t;
  liveLabelsSvg.append(line, dot, text);
  return { line, dot, text, def: d, lx: 0, ly: 0 };
});
function updateLiveLabels() {
  const on = labelsEffective() && !S_.section && S_.exploded < 0.5;
  liveLabelsSvg.style.display = on ? "" : "none";
  if (!on) return;
  const items = liveLabelEls.map((el) => {
    const [x, y] = controller.anchor(el.def.g, el.def.p).screen;
    return { el, x, y, ly: y };
  });
  for (const side of [0, 1]) {
    const col = items.filter((it) => (it.x < WIDTH / 2 ? 0 : 1) === side).sort((a, b) => a.y - b.y);
    let y = 30;
    for (const it of col) { it.ly = Math.max(y, it.y); y = it.ly + 24; }
    const over = y - 24 - (HEIGHT - 40);
    if (over > 0) for (const it of col) it.ly -= over;
    for (const it of col) {
      it.lx = side === 0 ? 12 : WIDTH - 12;
      it.anchor = side === 0 ? "start" : "end";
    }
  }
  for (const it of items) {
    it.el.line.setAttribute("x1", it.lx); it.el.line.setAttribute("y1", it.ly.toFixed(1));
    it.el.line.setAttribute("x2", it.x.toFixed(1)); it.el.line.setAttribute("y2", it.y.toFixed(1));
    it.el.dot.setAttribute("cx", it.x.toFixed(1)); it.el.dot.setAttribute("cy", it.y.toFixed(1));
    it.el.text.setAttribute("x", it.lx); it.el.text.setAttribute("y", (it.ly - 4).toFixed(1));
    it.el.text.setAttribute("text-anchor", it.anchor);
  }
}
// Drag-to-spin: horizontal drag rotates; a short tap (<6px, <300ms) toggles brakes.
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, spin0: S_.spin, a0: 0 };
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) > 6) {
    drag.moved = true;
    drag.a0 = controller.angleAt(drag.x0, drag.y0, AXLE_Z, "spin");
    stage.classList.add("dragging");
    run();
  }
  if (drag.moved) {
    if (S_.ortho > 0.5) {
      // side elevation: horizontal drag spins deterministically (angleAt degenerates near 0°)
      S_.spin = drag.spin0 + (e.clientX - drag.x0) * 0.4;
    } else {
      const a = controller.angleAt(e.clientX, e.clientY, AXLE_Z, "spin");
      S_.spin = drag.spin0 + (a - drag.a0);
    }
    if (still.matches) renderFigure(); else run();
  }
});
const endDrag = (e) => {
  if (!drag) return;
  const dt = performance.now() - drag.t0;
  const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
  const wasTap = !drag.moved && dist < 6 && dt < 300;
  drag = null;
  stage.classList.remove("dragging");
  if (wasTap) toggleBrake();
  else poke();
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", () => { drag = null; stage.classList.remove("dragging"); });
document.addEventListener("keydown", (e) => {
  // (on document, not the stage: the stage is display:none in section mode)
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  let handled = true;
  if (e.key === " " || e.key === "b" || e.key === "B" || e.key === "Enter") toggleBrake();
  else if (e.key === "[") { S_.spin -= 15; if (still.matches) renderFigure(); else { run(); poke(); } }
  else if (e.key === "]") { S_.spin += 15; if (still.matches) renderFigure(); else { run(); poke(); } }
  else if (e.key === "e" || e.key === "E") toggleExplode();
  else if (e.key === "o" || e.key === "O") setOrtho(S_.orthoT < 0.5);
  else if (e.key === "s" || e.key === "S") setSection(!S_.section);
  else if (e.key === "l" || e.key === "L") setLabelsCycle();
  else handled = false;
  if (handled) e.preventDefault();
});
bApply.addEventListener("click", toggleBrake);
bExplode.addEventListener("click", toggleExplode);
bOrtho.addEventListener("click", () => setOrtho(S_.orthoT < 0.5));
bSection.addEventListener("click", () => setSection(!S_.section));
bLabels.addEventListener("click", setLabelsCycle);
bTheme.addEventListener("click", () => setTheme(document.body.getAttribute("data-theme") === "dark" ? "light" : "dark"));
const io2 = new IntersectionObserver((es) => { visible = es.some((en) => en.isIntersecting); if (visible) run(); }, { rootMargin: "120px 0px" });
io2.observe(stage); io2.observe(secWrap);
if (still.matches) {
  for (const [g] of EX) { S_.ex[g].x = 0; S_.ex[g].t = 0; }
  S_.exploded = 0; S_.phaseKind = "ready";
  S_.apply = 1; S_.target = 1; S_.speed = 0; S_.temp = 38; S_.flow = 0;
  setApplyUI();
  stepText.textContent = "Assembled · brakes applied (reduced motion)";
  draw();
} else {
  S_.pending = EX_ASSEMBLE.map(([p, d]) => ({ part: p, at: d, t: 0 }));
  S_.assembling = true;
  stepText.textContent = "Exploded view · assembling the brake…";
  draw();
}
`;

// ---------------------------------------------------------------------------
// Write the page
// ---------------------------------------------------------------------------
// Bake var(--anatomy-*) to per-theme literals: the macOS viewer doesn't
// resolve CSS custom properties. Every rule using a variable is duplicated as
// body[data-theme="dark"] / body[data-theme="light"] with values parsed from
// the .iso{} and .iso[data-theme="light"]{} definition blocks (which are then
// removed). The JS-generated [data-theme] [data-mat=...] material rules are
// already attribute-scoped literals and keep working with the toggle.
const THEMED_CSS = (() => {
  let cssText = css + EXTRA_CSS + SEC_CSS + out.css;
  const takeBlock = (re) => {
    const m = cssText.match(re);
    const body = m?.[1] ?? "";
    if (m) cssText = cssText.replace(re, "");
    return Object.fromEntries(
      [...body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
  };
  const darkVals = takeBlock(/\.iso\{([^}]*)\}/);
  const lightVals = takeBlock(/\.iso\[data-theme="light"\]\{([^}]*)\}/);
  const VAR_RE = /var\(--anatomy-([a-z0-9-]+)\)/g;
  const fill = (decls, vals, theme) => decls.replace(VAR_RE, (_, name) => {
    // the light block only overrides what differs; non-color tokens fall back to dark
    const v = vals[`anatomy-${name}`] ?? darkVals[`anatomy-${name}`];
    if (v === undefined) throw new Error(`bakeThemes: no ${theme} value for --anatomy-${name}`);
    return v;
  });
  const scope = (sel, theme) => sel.split(",").map((s) => {
    s = s.trim();
    if (!s) return s;
    if (/^body(\b|$)/.test(s)) return `body[data-theme="${theme}"]${s.slice(4)}`;
    if (/^html(\b|$)/.test(s)) return s;
    return `body[data-theme="${theme}"] ${s}`;
  }).join(",");
  const bakeRules = (text) => {
    let out = "", i = 0;
    const n = text.length;
    while (i < n) {
      const ws = text.slice(i).match(/^\s*(?:\/\*[\s\S]*?\*\/\s*)*/);
      i += ws[0].length;
      if (i >= n) break;
      if (text.startsWith("@", i)) {
        const open = text.indexOf("{", i);
        const header = text.slice(i, open).trim();
        let d = 1, j = open + 1;
        while (d > 0) { if (text[j] === "{") d++; else if (text[j] === "}") d--; j++; }
        out += `${header}{${bakeRules(text.slice(open + 1, j - 1))}}`;
        i = j;
        continue;
      }
      const open = text.indexOf("{", i);
      if (open < 0) { out += text.slice(i); break; }
      const sel = text.slice(i, open).trim();
      let d = 1, j = open + 1;
      while (d > 0) { if (text[j] === "{") d++; else if (text[j] === "}") d--; j++; }
      const decls = text.slice(open + 1, j - 1);
      VAR_RE.lastIndex = 0;
      if (VAR_RE.test(decls)) {
        out += `${scope(sel, "dark")}{${fill(decls, darkVals, "dark")}}`;
        out += `${scope(sel, "light")}{${fill(decls, lightVals, "light")}}`;
      } else {
        out += `${sel}{${decls}}`;
      }
      i = j;
    }
    return out;
  };
  // Fallback fills for viewers without color-mix (the .iso-tn faces degrade to
  // flat theme tones instead of invalid/black). Only applies when color-mix is
  // unsupported; modern browsers use the blended tone ramp from out.css.
  const toneFallback = (vals, theme) => [0, 1, 2, 3].map((b) =>
    `body[data-theme="${theme}"] .iso-tn${b ? `[data-b="${b}"]` : ""}{fill:${vals[`anatomy-shade-${b}`]}}`
  ).join("");
  const FALLBACK_CSS =
    `@supports not (background:color-mix(in srgb,red 50%,blue)){` +
    toneFallback(darkVals, "dark") + toneFallback(lightVals, "light") + `}`;
  return FALLBACK_CSS + bakeRules(cssText);
})();
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Floating-caliper disc brake · 2013 Kia Sorento</title><style>${THEMED_CSS}</style></head><body class="iso" data-theme="dark"><main class="iso-page">${body}</main><script>
(()=>{ "use strict";
${turnScript()}
const DATA = { turn: ${JSON.stringify(out.data)} };
${liveScript}
})();
</scr` + `ipt></body></html>`;

// No var(--anatomy-*) may survive in the applied stylesheet (macOS viewer
// constraint). The check scans THEMED_CSS only: the inlined turn.mjs source
// also contains the strings, but its t3Css() is never called on this page.
const leftoverVars = THEMED_CSS.match(/var\(--anatomy-[a-z0-9-]+\)/g);
if (leftoverVars) throw new Error(`bakeThemes: unbaked usages remain: ${[...new Set(leftoverVars)].join(", ")}`);
writeFileSync(OUT, page);
console.log(`wrote ${OUT} (${(page.length / 1024).toFixed(0)}K)`);
