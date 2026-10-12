// Click pen: a retractable ballpoint on a display jig beside a 12:1 cutaway model of its cam mechanism.
// node build.mjs [--light]   -> clickpen.html / clickpen-light.html, and always short.html (light, 9:16, no chrome)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const MECH_SRC = readFileSync(join(HERE, "mech.js"), "utf8");
import { makeMech } from "./mech.gen.mjs";

// ---------------------------------------------------------------- truth (mm unless noted)
// pen ~139 mm, barrel Ø10; 4-lug cam, 8 rib positions (4 notches + 4 channels) -> 45° per click,
// refill travel 3.5 mm; tooth slope s mm per degree of turn.
const s = 0.055, zA = 12, zRT = 18.6;
const czOut = zA + s * 23;          // lug latched in a notch
const czIn = czOut + 3.5;           // lug up its channel: refill 3.5 mm higher
const AZ = 58;
const B = AZ + 180;                 // world angle of the back channel
const C = {
  s, zA, zRT, czOut, czIn, B, CH: B + 15, winTop: 18.6,
  M: 12, mOff: 6.6, MX: 50, MY: -4, MZ: 54,     // 12:1 model on its pedestal
  PS: 2.2, PX: -86, PY: 8, PZ: 26,  // the real pen, 2.2 world units per mm
  tipOut: -2, penTop: 133,
};
const WIDTH = 400, HEIGHT = 560;
const PLATE = { x: -134, y: -76, w: 262, d: 152, r: 10 };
const PLATE_H = 12, FOOT_H = 5;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [C.MX - 60, C.MY, C.MZ + 26.5 * C.M], [C.MX + 60, C.MY, C.MZ + 26.5 * C.M], [C.PX, C.PY, C.PZ + 140 * C.PS]],
  WIDTH, HEIGHT, { pad: 14, azimuth: AZ, elevation: 34 },
);
const K = { iso: k.iso, depthOf: k.depthOf, cameraOf: k.cameraOf, cylinder: k.cylinder, solidSvg: k.solidSvg, lineSvg: k.lineSvg, sideArc: k.sideArc, ring: k.ring, extrude: k.extrude };
const M = makeMech(K, P, C);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const pz = (mm) => C.PZ + mm * C.PS;
const mz = (mm) => C.MZ + mm * C.M;
const VERT = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// ---------------------------------------------------------------- base plate
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.2, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // ruler strip along the front edge
  const strip = { x: -124, y: PLATE.y + PLATE.d - 17, w: 108, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4.4, 5, strip.y + 0.8, 0.7, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.6, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 1.6, strip.y + 3.5, 0.7])], { size: 0.45 }));
  // label plate: the model's scale
  const label = { x: -66, y: 30, w: 44, d: 20, r: 2 };
  out.push(S(k.slabOf(label, 0, 1.4, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2.2), 1.4, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 7, label.y + 6 + i * 3.6], [label.x + 37 - i * 6, label.y + 6 + i * 3.6], 1.4, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 3.4, label.y + 3.4, 1.4]), at([label.x + label.w - 3.4, label.y + label.d - 3.4, 1.4])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- pen side of the jig
function penPad() {
  const out = [];
  const pad = { x: C.PX - 20, y: C.PY - 20, w: 40, d: 40, r: 4 };
  out.push(`<path class="iso-halo" d="${k.haloOf(pad, 0, 4, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(pad, 0, 9, P, 6, 0.8), { tone: "mid" }));
  const felt = k.insetPlan(pad, 3);
  out.push(S(k.slabOf(felt, 9, 3, P, 6, 0), { tone: "lo", crease: "none", className: "m-felt" }));
  out.push(L(k.planOutline(k.insetPlan(felt, 3), 12, P, 6), { tone: "faint" }));
  out.push(L(k.ring(C.PX, C.PY, 5, 12, P, 32), { tone: "faint" }));
  out.push(D([at([C.PX, C.PY, 12])], { size: 0.7, tone: "lo" }));
  return out.join("");
}
function penRuler() {
  // a small upright scale beside the tip: 1 mm ticks against which the tip travels
  const out = [];
  const x0 = C.PX - 16, y0 = C.PY - 1, w = 3, d = 5;
  const plan = { x: x0, y: y0, w, d, r: 0.6 };
  const z0 = 12, z1 = pz(6);
  out.push(S(k.slabOf(plan, z0, z1 - z0, P, 2, 0.3), { tone: "mid" }));
  const face = y0 + d;
  const minor = [], major = [];
  for (let mm = -5; mm <= 5; mm++) {
    const z = pz(mm);
    if (z < z0 + 1.5 || z > z1 - 1.5) continue;
    const len = mm % 5 === 0 ? 2.3 : 1.3;
    (mm % 5 === 0 ? major : minor).push(k.segment([x0, face, z], [x0 + len, face, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  return out.join("");
}
function penPost() {
  const out = [];
  const px = C.PX, py = C.PY - 34;
  const top = pz(84);
  out.push(S(k.cylinder(px, py, 10, 0, 5, P, 40, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(px, py, 5, 5, top - 5, P, 32), { tone: "mid", className: "m-steel", crease: "none", inner: L([80, 140, 200].map((z) => k.sideArc(px, py, 5, z, P, 20)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(px, py, 5.8, top, 2.4, P, 32, 0.4), { tone: "mid", className: "m-steel" }));
  // clamp block on the post and the arm to the collar
  const bz = pz(72);
  const block = { x: px - 8, y: py - 8, w: 16, d: 16, r: 2.5 };
  out.push(S(k.slabOf(block, bz, 10 * C.PS, P, 4, 0.6), { tone: "mid" }));
  const arm = { x: px - 4, y: py + 8, w: 8, d: 34 - 8 - 13, r: 1 };
  out.push(S(k.slabOf(arm, bz + 6, 9, P, 3, 0.4), { tone: "mid", className: "m-steel" }));
  out.push(D([at([px, py + 12, bz + 15]), at([px, py + 18, bz + 15])], { size: 0.45 }));
  // thumb screw on the clamp block (on its -x side, toward the left edge)
  out.push(S(k.slabOf({ x: px - 11, y: py - 1.6, w: 3, d: 3.2, r: 0.8 }, bz + 8, 5, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(px - 13.4, py, 3.2, bz + 7, 7, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(px - 13.4, py, 3.2, bz + 7, bz + 14, 18, P), { tone: "lo" }));
  return out.join("");
}

// the real pen, bottom to top
const penTipRest = (() => {
  const F = VERT(C.PX, C.PY, pz(0));
  const u = C.PS;
  const tipCone = G.solidOf([[0, 0], [0.12 * u, 0.32 * u, 1], [0.42 * u, 0.48 * u, 1], [0.7 * u, 0.55 * u], [4.6 * u, 1.15 * u], [4.6 * u, 1.5 * u], [13 * u, 1.5 * u]], F, P);
  return S(tipCone, { tone: "hi", className: "m-brass" }) + D([at([C.PX, C.PY, pz(0)])], { size: 0.5, tone: "hi" });
})();
function penLower() {
  const out = [];
  const u = C.PS;
  const F = VERT(C.PX, C.PY, pz(0));
  // chrome tip ring and the cone
  out.push(S(G.solidOf([[0, 1.75 * u], [2.4 * u, 2.25 * u]], F, P), { tone: "hi", className: "m-steel" }));
  out.push(S(G.solidOf([[2.4 * u, 2.4 * u], [14 * u, 5.4 * u]], F, P), { tone: "hi", className: "m-navy", inner: L(G.arcOf(F, 9.5 * u, (2.4 + (5.4 - 2.4) * (7.1 / 11.6)) * u, P, { slope: 3 / 11.6 }), { tone: "faint" }) }));
  // seat for the spring around the refill bore on the cone's top face
  out.push(L(k.ring(C.PX, C.PY, 1.75 * u, pz(14), P, 28), { tone: "mid" }));
  out.push(L(k.ring(C.PX, C.PY, 3.0 * u, pz(14), P, 32), { tone: "faint" }));
  // grip sleeve, cut open at the front: back half only
  out.push(M.polySvg(M.sector(M.PO, { r0: 4.3, r1: 5.4, a0: B - 85, a1: B + 85, n: 30, zb: 14, zt: 50, cut: 2.6 }), { tone: "hi", cls: "m-rubber" }));
  return out.join("");
}
function penUpper() {
  const out = [];
  const u = C.PS;
  const r = 5 * u;
  out.push(S(k.cylinder(C.PX, C.PY, r, pz(50), 22 * u, P, 48), { tone: "hi", className: "m-navy", inner: L(k.sideArc(C.PX, C.PY, r, pz(52.5), P, 32), { tone: "faint" }) }));
  return out.join("");
}
function penCollar() {
  const out = [];
  const u = C.PS;
  const z0 = pz(72), h = 10 * u;
  out.push(S(k.cylinder(C.PX, C.PY, 6.6 * u, z0, h, P, 56, 0.6), { tone: "mid", className: "m-steel", inner: L(k.sideArc(C.PX, C.PY, 6.6 * u, z0 + h / 2, P, 40), { tone: "faint" }) }));
  // pinch screw boss facing the viewer
  const tv = Math.atan2(k.towardViewer(P)[1], k.towardViewer(P)[0]) + 0.5;
  const bx = C.PX + Math.cos(tv) * 6.9 * u, by = C.PY + Math.sin(tv) * 6.9 * u;
  out.push(S(k.cylinder(bx, by, 2.6, z0 + 3, h - 6, P, 20), { tone: "mid" }));
  out.push(D([at([bx, by, z0 + h - 3])], { size: 0.55, tone: "hi" }));
  return out.join("");
}
function penTop() {
  const out = [];
  const u = C.PS;
  out.push(S(k.cylinder(C.PX, C.PY, 5 * u, pz(82), 42 * u, P, 48), { tone: "hi", className: "m-navy", inner: L(k.sideArc(C.PX, C.PY, 5 * u, pz(118), P, 32), { tone: "faint" }) }));
  // clip band, clip and its nub
  out.push(S(k.cylinder(C.PX, C.PY, 5.3 * u, pz(124), 5 * u, P, 48, 0.4), { tone: "hi", className: "m-steel" }));
  const a = (AZ - 62) * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), ta = [-sa, ca];
  const pt = (rr, t) => [C.PX + (ca * rr + ta[0] * t) * u, C.PY + (sa * rr + ta[1] * t) * u];
  const clipRing = [pt(5.1, -1.25), pt(6.5, -1.25), pt(6.5, 1.25), pt(5.1, 1.25)];
  out.push(S(k.extrude(clipRing, pz(99), 30 * u, P), { tone: "hi", className: "m-steel" }));
  const nub = pt(6.6, 0);
  out.push(S(k.cylinder(nub[0], nub[1], 1.3 * u, pz(98), 2.4 * u, P, 20, 0.3), { tone: "hi", className: "m-steel" }));
  // chrome top ring with two grooves
  out.push(S(k.cylinder(C.PX, C.PY, 5.15 * u, pz(129), 4 * u, P, 48, 0.4), { tone: "hi", className: "m-steel", inner: L([130.4, 131.6].map((z) => k.sideArc(C.PX, C.PY, 5.15 * u, pz(z), P, 32)).join(""), { tone: "lo" }) }));
  out.push(L(k.ring(C.PX, C.PY, 3.4 * u, pz(133), P, 32), { tone: "faint" }));
  return out.join("");
}

// ---------------------------------------------------------------- model pedestal
function pedestal() {
  const out = [];
  const x = C.MX, y = C.MY;
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 70, y: y - 70, w: 140, d: 140, r: 70 }, 0, 4, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.cylinder(x, y, 74, 0, 7, P, 112, 1), { tone: "mid" }));
  const bolts = Array.from({ length: 8 }, (_, i) => [x + Math.cos((i + 0.5) * Math.PI / 4) * 66, y + Math.sin((i + 0.5) * Math.PI / 4) * 66]);
  out.push(L(bolts.map(([bx, by]) => k.ring(bx, by, 2.4, 7, P, 14)).join(""), { tone: "lo" }));
  out.push(D(bolts.map(([bx, by]) => at([bx, by, 7])), { size: 0.5 }));
  out.push(S(k.cylinder(x, y, 40, 7, 37, P, 88), { tone: "mid", inner: L([13, 36].map((z) => k.sideArc(x, y, 40, z, P, 48)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 45, 22, 8, P, 88, 0.6), { tone: "mid" }));
  const tv = Math.atan2(k.towardViewer(P)[1], k.towardViewer(P)[0]) - 0.35;
  out.push(S(k.cylinder(x + Math.cos(tv) * 46.5, y + Math.sin(tv) * 46.5, 2.6, 23.5, 5, P, 18), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 68, 44, C.MZ - 44, P, 112, 1), { tone: "mid" }));
  out.push(L(k.ring(x, y, 63.5, C.MZ, P, 80), { tone: "faint" }));
  out.push(L(k.ring(x, y, 21, C.MZ, P, 40), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const START = { S: "in", psi: B + 15 };
const pose0 = M.poseAt(0, [], START);
const dyn0 = M.dynamic(pose0);
const plRest = 0; // plunger markup is built with its origin at model z = 0 (mm)
const tPl = (plZ) => k.translateAlong(P, [0, 0, (plZ - plRest) * C.M]);
const tTip = (camZ) => k.translateAlong(P, [0, 0, M.penTipZ(camZ) * C.PS]);

const MS = M.modelStatic();
const body = [
  `<g class="cp-jig">${plate()}${penPad()}${penPost()}</g>`,
  `<g data-part="pen-tip" transform="${tTip(pose0.camZ)}">${penTipRest}</g>`,
  penLower(),
  `<g data-part="pen-window">${dyn0.penWindow}</g>`,
  penUpper(),
  penCollar(),
  penTop(),
  `<g data-part="pen-button">${dyn0.penButton}</g>`,
  `<g class="cp-jig">${penRuler()}${pedestal()}</g>`,
  MS.back,
  `<g data-part="refill">${dyn0.refill}</g>`,
  `<g data-part="lugs-back">${dyn0.lugsBack}</g>`,
  `<g data-part="cam">${dyn0.cam}</g>`,
  `<g data-part="plunger" transform="${tPl(pose0.plZ)}">${M.plungerSvg()}</g>`,
  `<g data-part="lugs-front">${dyn0.lugsFront}</g>`,
  MS.front,
  `<g data-part="model-button">${dyn0.modelButton}</g>`,
];

const LABEL = "A retractable ballpoint pen hangs tip-down in a jig beside a 12:1 cutaway model of its click mechanism. In the model the barrel is cut open: two ribs on the inner wall carry a ramp and a notch; the plunger's saw-toothed crown sits on a cam with four lugs, one dark. Each press pushes the cam below the ribs and the crown turns it half a step; on release the rib ramps turn it the other half, 45° in all, so the lug latches in a notch (tip out) or rises up a channel (tip in, 3.5 mm).";


const MATS = {
  // series palette: steel-blue body, orange moving plunger, gold-brass cam, teal fixed ribs, red followed lug
  steel: ["#8e98a3", "#a9b2bc", "#c3cad2", "#d9dee4", "#eef1f4", "#3b4148", "#7d8791"],
  brass: ["#b5841f", "#c99430", "#d9a441", "#e6b95e", "#f7e0a0", "#4f3700", "#9c7419"],
  navy: ["#46688f", "#52749c", "#5f81a9", "#6d8eb5", "#a3bbd6", "#1f3550", "#89a5c6"],
  rubber: ["#2f3d52", "#38475e", "#42526b", "#4c5d77", "#6a7c96", "#141b27", "#71839c"],
  smoke: ["#86a3c8", "#9db8d9", "#b4cae4", "#c9daee", "#e2ecf8", "#1f3550", "#7d9cc2"],
  rib: ["#1f7774", "#278985", "#2f9e9a", "#47b2ad", "#8fd6d1", "#0a3533", "#196563"],
  ink: ["#2a44a0", "#3350b0", "#3d5dc2", "#4a6bd0", "#859ce6", "#111d50", "#6b82d4"],
  plunger: ["#c95f1a", "#dc7026", "#e8823a", "#f39a55", "#ffd0a3", "#5a2405", "#b0561a"],
  accent: ["#a82a24", "#bf352e", "#d6453d", "#e45f57", "#f6a39c", "#470c08", "#8c241f"],
  felt: ["#36506f", "#3e5a7b", "#476587", "#517092", "#7290b3", "#18273a", "#86a0c0"],
};const MAT_CSS = Object.entries(MATS).map(([n, c]) => [0, 1, 2, 3].map((i) => `.iso-solid.m-${n}>.iso-shade[data-shade="${i}"]{fill:${c[i]};stroke:${c[i]}}`).join("") +
  `.iso-solid.m-${n}>.iso-top{fill:${c[4]};stroke:${c[4]}}.iso-solid.m-${n}>.iso-fill{fill:${c[2]}}.iso-solid.m-${n}>.iso-edge{stroke:${c[5]}}.iso-solid.m-${n}>.iso-line:not(.iso-edge){stroke:${c[6]}}`).join("\n");
const CREAM = `
.iso[data-theme="light"]{--anatomy-page:#f5f1e8;--anatomy-card:#fbf8f2;--anatomy-paper:#fbf8f2;--anatomy-face:#fffdf9;--anatomy-top:#fffdf8;
 --anatomy-shade-0:#e2dccf;--anatomy-shade-1:#eae5da;--anatomy-shade-2:#f1ede4;--anatomy-shade-3:#f7f4ed;
 --anatomy-hi:#2a2723;--anatomy-mid:#8b8579;--anatomy-lo:#b8b1a4;--anatomy-faint:#d8d2c5;--anatomy-halo:#8a7f6a;--anatomy-dot:#3a3631}
.iso-solid[class*=" m-"]:not([data-seamless])>.iso-shade,.iso-solid[class*=" m-"]:not([data-seamless])>.iso-top{stroke:none}
.cp-jig{--anatomy-top:#e6eef8;--anatomy-face:#edf3fa;--anatomy-paper:#e6eef8;--anatomy-shade-3:#cfdeef;--anatomy-shade-2:#b9cde6;--anatomy-shade-1:#a3bddc;--anatomy-shade-0:#89a8cf;--anatomy-hi:#1f3550;--anatomy-mid:#4f6f96;--anatomy-lo:#7f9cc2;--anatomy-faint:#a9c0dc;--anatomy-dot:#1f3550}
.iso-solid>path.cp-cut{fill:var(--cp-cut,#eef4fb);stroke:var(--cp-cut,#eef4fb);stroke-width:.4px}
.iso-solid>.iso-line.cp-hatch{stroke:var(--cp-hatch,#8eaad0)!important;stroke-width:.55px}
.iso-solid.m-rubber{--cp-cut:#c3cfdf;--cp-hatch:#6d819f}
.cp-wire{fill:none;stroke:#4a525b;stroke-linecap:round;stroke-linejoin:round}
.cp-wire-hi{fill:none;stroke:var(--anatomy-top);stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.iso-solid.cp-lit>.iso-shade[data-shade="0"]{fill:#2c2a27}.iso-solid.cp-lit>.iso-shade[data-shade="1"]{fill:#36332f}
.iso-solid.cp-lit>.iso-shade[data-shade="2"]{fill:#403c37}.iso-solid.cp-lit>.iso-shade[data-shade="3"]{fill:#4a4640}
.iso-solid.cp-lit>.iso-top{fill:#5e5850}
.iso-solid.cp-lit>.iso-shade[data-shade="0"]{stroke:#2c2a27}.iso-solid.cp-lit>.iso-shade[data-shade="1"]{stroke:#36332f}
.iso-solid.cp-lit>.iso-shade[data-shade="2"]{stroke:#403c37}.iso-solid.cp-lit>.iso-shade[data-shade="3"]{stroke:#4a4640}
.iso-solid.cp-lit>.iso-top{stroke:#5e5850}
.iso-solid.cp-lit>.iso-edge{stroke:#111;stroke-width:.8px}
.iso-solid.cp-lit>.iso-crease{stroke:#7a7368}
` + MAT_CSS;

// ---------------------------------------------------------------- live code (shared by both pages)
const LIVE_CORE = `
${MECH_SRC}
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const K = { iso, depthOf, cameraOf, cylinder, solidSvg, lineSvg, sideArc, ring, extrude };
const M = makeMech(K, P, C);
const START = ${JSON.stringify(START)};
const svg = document.querySelector("svg.iso-svg");
const part = (n) => svg.querySelector('[data-part="' + n + '"]');
const G_ = { tip: part("pen-tip"), win: part("pen-window"), btn: part("pen-button"), refill: part("refill"), lb: part("lugs-back"), cam: part("cam"), pl: part("plunger"), lf: part("lugs-front"), mb: part("model-button") };
let lastKey = "";
function render(pose) {
  const key = pose.psi.toFixed(3) + "|" + pose.camZ.toFixed(4) + "|" + pose.plZ.toFixed(4);
  if (key === lastKey) return;
  lastKey = key;
  const d = M.dynamic(pose);
  G_.win.innerHTML = d.penWindow; G_.btn.innerHTML = d.penButton; G_.refill.innerHTML = d.refill;
  G_.mb.innerHTML = d.modelButton; G_.lb.innerHTML = d.lugsBack; G_.cam.innerHTML = d.cam; G_.lf.innerHTML = d.lugsFront;
  G_.pl.setAttribute("transform", translateAlong(P, [0, 0, pose.plZ * C.M]));
  G_.tip.setAttribute("transform", translateAlong(P, [0, 0, M.penTipZ(pose.camZ) * C.PS]));
}
`;

const SHORT_CLICKS = [
  { t0: 1.2, sp: "slow" }, { t0: 5.7, sp: "slow" }, { t0: 10.2, sp: "slow" },
  { t0: 15.0, sp: "quick" }, { t0: 15.85, sp: "quick" }, { t0: 16.7, sp: "quick" }, { t0: 17.55, sp: "quick" }, { t0: 18.4, sp: "quick" }, { t0: 19.25, sp: "quick" },
];
const LIVE_SHORT = LIVE_CORE + `
// Tour time T = page time - LEAD, so that recorder frame i (captured at page time 0.2 + (i+1)/30 s) shows T = i/30.
const LEAD = 0.2 + 1 / 30;
const CLICKS = ${JSON.stringify(SHORT_CLICKS)};
window.__events = M.eventsOf(CLICKS, START);
// Playwright's fake clock also flows with wall time after install (the recorder never pauses it), so a slow
// capture would leak seconds into the tour. Pause it from the page whenever it is free-running; runFor still advances it.
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const t0 = performance.now();
function frame(now) {
  holdClock();
  const T = Math.max(0, (now - t0) / 1000 - LEAD);
  window.__T = T;
  render(M.poseAt(T, CLICKS, START));
  requestAnimationFrame(frame);
}
render(M.poseAt(0, CLICKS, START));
requestAnimationFrame(frame);
`;

const LIVE_FIG = LIVE_CORE + `
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let clicks = [], clock = 0, last = 0, raf = 0, visible = false, idleUntil = 1.2;
const DUR = (sp) => M.durOf(sp);
function lastEnd() { const c = clicks[clicks.length - 1]; return c ? c.t0 + DUR(c.sp) : 0; }
function queue(sp, at) { clicks.push({ t0: Math.max(at, lastEnd() + 0.05), sp }); }
function say(pose) {
  const turned = (((pose.psi - START.psi) % 360) + 360) % 360;
  const drop = Math.max(0, C.czIn - pose.camZ);
  const text = (pose.busy ? "clicking" : pose.S === "out" ? "tip out" : "tip in") + " · cam " + turned.toFixed(0) + "° · refill down " + drop.toFixed(1) + " mm";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now; clock += dt;
  if (!still.matches && clock > idleUntil && clock > lastEnd() + 1.6) queue("slow", clock);
  const pose = M.poseAt(clock, clicks, START);
  render(pose); say(pose);
  raf = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } };
function press() { idleUntil = clock + 6; queue(still.matches ? "quick" : "quick", clock); run(); }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", press);
stage.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(); } });
render(M.poseAt(0, [], START)); say(M.poseAt(0, [], START));
`;

const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body });
// short only: a round magnifier (3x) over the real pen's tip, spring seat and 1 mm scale, so the 3.5 mm travel reads on a phone
const LOUPE = (() => {
  const cx = 74, cy = 548, r = 62, Z = 3.6;
  const [fx, fy] = at([C.PX - 5, C.PY, pz(-0.5)]);
  return `<defs><clipPath id="cp-loupe-clip" clipPathUnits="userSpaceOnUse"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>` +
    `<g class="cp-loupe"><circle class="cp-loupe-glass" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<g clip-path="url(#cp-loupe-clip)"><g transform="translate(${cx} ${cy}) scale(${Z}) translate(${(-fx).toFixed(2)} ${(-fy).toFixed(2)})"><use href="#cp-all"/></g></g>` +
    `<circle class="cp-loupe-rim" cx="${cx}" cy="${cy}" r="${r + 3}"/><circle class="cp-loupe-edge" cx="${cx}" cy="${cy}" r="${r + 6}"/><circle class="cp-loupe-edge" cx="${cx}" cy="${cy}" r="${r}"/></g>`;
})();
const svgShort = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: [`<g id="cp-all">`, ...body, `</g>`, LOUPE] });

// figure page
const fig = k.plateHtml({
  fig: "Fig 1",
  title: "Click pen",
  hint: "Click or press space to click the pen",
  readout: "tip in · cam 0° · refill down 0.0 mm",
  keys: [
    { mark: "lit", label: "One cam lug: watch it turn 45° per click" },
    { mark: "raised", label: "Barrel ribs: a ramp, a notch, a channel" },
  ],
  caption: "A ballpoint (139 mm) in a jig beside a 12:1 cutaway of its mechanism. Pressing drives the cam below the ribs and the plunger's saw teeth turn it 22.5°; on release the rib ramps turn it another 22.5°. A lug that lands in a notch holds the refill down, tip out; the next click lands it in a channel and the return spring lifts the refill 3.5 mm, tip in.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Click pen: click or press space to click">${svg}</div>`,
});
const figName = theme === "light" ? "clickpen-light.html" : "clickpen.html";
writeFileSync(join(HERE, figName), k.pageHtml({ title: "Click pen", theme, body: fig, script: kitScript() + LIVE_FIG, width: 560 }).replace("</style>", CREAM + "</style>"));
console.log("wrote", figName);

// short page: 9:16, cream paper, figure only
const SHORT_CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:var(--anatomy-paper)}
.short{position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 60%,#fdfbf6 0%,var(--anatomy-paper) 55%,#f3eee3 100%)}
.short .iso-svg{position:absolute;left:3vw;width:94vw;top:17vh;height:auto;overflow:visible}
.cp-loupe-glass{fill:#fbf8f2}
.cp-loupe-rim{fill:none;stroke:#7f9fc8;stroke-width:6px}
.cp-loupe-edge{fill:none;stroke:#1f3550;stroke-width:.9px}
`;
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Click pen short</title><style>${k.ISO_CSS}${CREAM}${SHORT_CSS}</style></head><body class="iso" data-theme="light"><div class="short">${svgShort}</div><script type="module">${(kitScript() + LIVE_SHORT).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.preview.json"), JSON.stringify(M.eventsOf(SHORT_CLICKS, START), null, 1));
console.log("wrote short.html; tour ends", (SHORT_CLICKS.at(-1).t0 + M.durOf("quick")).toFixed(2), "s");

// ================================================================ explainer (~62 s, captions in post): explain.html  [review round 2]
// 9:16 page (viewBox 400 x 711.1): captions band 0..150 | zoomed 3-D cutaway 150..420 (clipped) + tip loupe at left |
// UNROLLED diagram 430..700: the barrel wall cut open and laid flat, 150 deg window around the red lug.
{
  const VW = 400, VH = 711.1, D2R = Math.PI / 180;
  const mpts = [];
  for (const zz of [7.0, 20.0]) for (let a = 0; a < 360; a += 15) mpts.push(at(M.W(5.0, a, zz))); // mech model frame (z0 = MZ - mOff*M)
  const mb = [Math.min(...mpts.map((p) => p[0])), Math.min(...mpts.map((p) => p[1])), Math.max(...mpts.map((p) => p[0])), Math.max(...mpts.map((p) => p[1]))];
  const WIDE = { s: 0.98, x: 4, y: 150 };
  const BOX = { x0: 128, x1: 392, y0: 168, y1: 422 };
  const zs = Math.min((BOX.x1 - BOX.x0) / (mb[2] - mb[0]), (BOX.y1 - BOX.y0) / (mb[3] - mb[1]));
  const ZOOM = { s: +zs.toFixed(4), x: +((BOX.x0 + BOX.x1) / 2 - zs * (mb[0] + mb[2]) / 2).toFixed(2), y: +((BOX.y0 + BOX.y1) / 2 - zs * (mb[1] + mb[3]) / 2).toFixed(2) };
  // diagram: 150 deg x (8.0 .. 19.0 mm), slopes not to scale in z (readability)
  const ST = { x0: 12, x1: 388, y0: 432, y1: 700, zMin: 8.2, zMax: 19.0, span: 150 };
  ST.kx = (ST.x1 - ST.x0) / ST.span; ST.kz = (ST.y1 - ST.y0) / (ST.zMax - ST.zMin);
  const XCLICKS = [
    { t0: 2.2, sp: "quick" }, { t0: 3.7, sp: "quick" },
    { t0: 19.5, sp: "xslow" }, { t0: 33.5, sp: "xslow" },
    { t0: 49.6, sp: "quick" }, { t0: 50.9, sp: "quick" }, { t0: 52.2, sp: "quick" }, { t0: 53.5, sp: "quick" }, { t0: 54.8, sp: "quick" }, { t0: 56.1, sp: "quick" },
    { t0: 57.9, sp: "slow" }, { t0: 61.7, sp: "slow" },
  ];
  const LEN = 66;
  const XT = {
    cam: [[0, 0], [5.4, 0], [7.4, 1], [99, 1]],
    strip: [[0, 0], [7.0, 0], [7.9, 1], [99, 1]],
    spring: [[0, 0], [16.0, 0], [16.6, 1], [99, 1]],
    halo: [[0, 0], [28.6, 0], [29.0, 1], [30.8, 1], [31.3, 0], [60.0, 0], [60.4, 1], [61.2, 1], [61.6, 0], [99, 0]],
    // [ribs, plunger, cam+lugs, red lug] dim factors (diagram and 3-D)
    hi: [[0, [1, 1, 1, 1]], [9.0, [1, 1, 1, 1]], [9.6, [1, 0.18, 0.18, 0.18]], [12.0, [1, 0.18, 0.18, 0.18]], [12.6, [0.18, 1, 0.18, 0.18]],
      [15.6, [0.18, 1, 0.18, 0.18]], [16.2, [0.18, 0.18, 1, 1]], [19.0, [0.18, 0.18, 1, 1]], [19.6, [1, 1, 1, 1]], [99, [1, 1, 1, 1]]],
    pocket: [[0, 0], [9.7, 0], [10.1, 1], [10.8, 1], [11.2, 0], [99, 0]],
    gap: [[0, 0], [11.0, 0], [11.4, 1], [11.9, 1], [12.3, 0], [99, 0]],
    gapLug: [[0, 0], [41.4, 0], [41.8, 1], [43.6, 1], [44.2, 0], [63.6, 0], [64.0, 1], [65.0, 1], [65.5, 0], [99, 0]],
    tooth: [[0, 0], [21.4, 0], [22.2, 1], [25.0, 1], [25.6, 0], [35.4, 0], [36.2, 1], [39.0, 1], [39.6, 0], [99, 0]],
    ramp: [[0, 0], [25.3, 0], [26.0, 1], [28.4, 1], [28.9, 0], [39.3, 0], [40.0, 1], [41.0, 1], [41.5, 0], [99, 0]],
    track: [[0, 0], [47.6, 0], [49.4, 1], [99, 1]],
  };
  const XCAPS = [
    [0.2, 6.6, "", "The click pen", "Click: tip out. Click: tip in. How does it remember?"],
    [6.6, 9.2, "LOOK INSIDE", "A 12× model", "Below it: the same parts, unrolled flat."],
    [9.2, 12.3, "PART 1", "The ribs (teal)", "Fixed in the barrel. Their slopes end in a pocket or a gap, taking turns."],
    [12.3, 15.9, "PART 2", "The button (orange)", "Its bottom edge is a ring of slanted saw teeth."],
    [15.9, 19.5, "PART 3", "The cam (gold)", "Carries the ink refill. The spring pushes it up. Follow the red lug."],
    [19.5, 22.1, "STEP 1", "Press", "The button pushes the cam down, below the ribs."],
    [22.1, 25.3, "STEP 2", "Turn", "The slanted teeth push the lug half a step sideways."],
    [25.3, 28.4, "STEP 3", "Release", "The spring pushes the cam up. The rib slope slides it the other half step."],
    [28.4, 33.5, "STEP 4", "Lock: tip out", "The lug stops in the pocket and stays down. Tip out."],
    [33.5, 36.1, "STEP 1", "Press again", "Down below the ribs again."],
    [36.1, 39.3, "STEP 2", "Turn", "The teeth: half a step again."],
    [39.3, 41.4, "STEP 3", "Release", "The slope: the other half. Now the lug is under a gap..."],
    [41.4, 47.6, "STEP 4", "Up the gap: tip in", "...so the spring pushes it all the way up. Tip in."],
    [47.6, 57.9, "FULL SPEED", "Pocket, gap, pocket, gap", "Every click turns the cam 1/8 of a turn."],
    [57.9, 61.7, "RECAP", "Pocket = tip out", "Press + release: the lug stops in a pocket."],
    [61.7, 66.0, "RECAP", "Gap = tip in", "Next click it rises up a gap. That's the whole trick."],
  ];
  // tip loupe: own magnifier (round window on the real pen's tip), placed by the page per frame
  const LZ = 4.6, LR = 70;
  const [tfx, tfy] = at([C.PX - 3, C.PY, pz(-1.5)]);
  const LOUPE2 = `<defs><clipPath id="xs-lclip" clipPathUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${LR}"/></clipPath></defs>` +
    `<g id="xs-loupe"><circle class="cp-loupe-glass" cx="0" cy="0" r="${LR}"/><g clip-path="url(#xs-lclip)"><g transform="scale(${LZ}) translate(${(-tfx).toFixed(2)} ${(-tfy).toFixed(2)})"><use href="#cp-all"/></g></g>` +
    `<circle class="cp-loupe-rim" cx="0" cy="0" r="${LR + 3}"/><circle class="cp-loupe-edge" cx="0" cy="0" r="${LR + 6}"/><circle class="cp-loupe-edge" cx="0" cy="0" r="${LR}"/></g>`;
  const LPOS = { wide: { x: 4 + 0.98 * 74, y: 150 + 0.98 * 548, s: 62 / LR * 0.98 }, zoom: { x: 58, y: 300, s: 0.66 } };
  const STRIP_JS = `
const ST = ${JSON.stringify(ST)}, XT = ${JSON.stringify(XT)}, XCLICKS = ${JSON.stringify(XCLICKS)};
const WIDE = ${JSON.stringify(WIDE)}, ZOOM = ${JSON.stringify(ZOOM)}, LEN = ${LEN}, LPOS = ${JSON.stringify(LPOS)}, BOX = ${JSON.stringify(BOX)};
const smx = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const key = (K, t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 0; i + 1 < K.length; i++) if (t < K[i + 1][0]) { const [t0, a] = K[i], [t1, b] = K[i + 1], g = smx((t - t0) / (t1 - t0)); return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * g) : a + (b - a) * g; } return K[K.length - 1][1]; };
const f2 = (v) => Math.round(v * 100) / 100;
let A0 = 0;
const X_ = (a) => ST.x0 + (a - A0) * ST.kx, Y_ = (z) => ST.y1 - (z - ST.zMin) * ST.kz;
const polyD = (pts) => "M" + pts.map((p) => f2(X_(p[0])) + " " + f2(Y_(p[1]))).join("L") + "Z";
const lineD = (pts) => "M" + pts.map((p) => f2(X_(p[0])) + " " + f2(Y_(p[1]))).join("L");
const wrapNear = (a) => { while (a < A0 - 60) a += 360; while (a > A0 + ST.span + 60) a -= 360; return a; };
const RED = 1, W0 = C.CH + 32.5;
// ribs: per channel centre c a long ramp [c+12, c+55] (its high end + the wall at c+55 make the POCKET) and a short ramp [c+55, c+78]
function ribList() { const out = []; for (let i = 0; i < 4; i++) { const c = C.CH + 90 * i; out.push({ c, segs: [[c + 12, c + 55, c + 12], [c + 55, c + 78, c + 55]] }); } return out; }
const RIBS = ribList();
const ribPoly = (f, t, base) => { const pts = [[f, ST.zMax + 1], [t, ST.zMax + 1]]; for (let k = 0; k <= 6; k++) { const a = t - (t - f) * k / 6; pts.push([a, C.zA + C.s * (a - base)]); } return pts; };
const redAng = (T) => M.poseAt(T, XCLICKS, START).psi + 90 * RED;
const avgRed = (T) => { let s = 0; for (let k = 0; k < 13; k++) s += redAng(T - 0.15 + 0.3 * k / 12); return s / 13; };
const C1 = ${JSON.stringify(null)};
let CEN0 = null, AVG0 = null;
function stripSvg(pose, T, hi) {
  if (CEN0 === null) { const a = M.poseAt(19.0, XCLICKS, START).psi + 90 * RED; CEN0 = a + 45; AVG0 = avgRed(47.6); }
  const tw = key(XT.track, T); A0 = CEN0 + (tw > 0 ? (avgRed(T) + 8 - CEN0) * tw : 0) - ST.span / 2;
  let s = '<rect class="xs-wall" x="' + ST.x0 + '" y="' + ST.y0 + '" width="' + (ST.x1 - ST.x0) + '" height="' + (ST.y1 - ST.y0) + '"/>';
  // channels (gaps) between ribs: pale strips to the top
  const gapA = key(XT.gap, T), gapL = key(XT.gapLug, T), raL = pose.psi + 90 * RED;
  for (const r of RIBS) { const c = wrapNear(r.c + 90); s += '<path class="xs-gap" d="' + polyD([[c - 12, ST.zMin - 1], [c + 12, ST.zMin - 1], [c + 12, ST.zMax + 1], [c - 12, ST.zMax + 1]]) + '"/>';
    const own = Math.abs(((raL - c) % 360 + 540) % 360 - 180) < 30, ga = Math.max(gapA, own ? gapL : 0);
    if (ga > 0.01) s += '<path class="xs-flash" opacity="' + f2(ga) + '" d="' + polyD([[c - 12, C.zA - 0.2], [c + 12, C.zA - 0.2], [c + 12, ST.zMax + 0.6], [c - 12, ST.zMax + 0.6]]) + '"/>'; }
  // button: solid light band above the teeth (behind the ribs), teeth edge on top later
  const tooth = []; for (let k = -6; k <= 6; k++) { const a0 = W0 + 45 * (Math.round((A0 - W0) / 45) + k); tooth.push([a0, pose.plZ], [a0 + 45, pose.plZ + C.s * 45]); }
  const band = [[tooth[tooth.length - 1][0], pose.plZ + C.s * 45 + 0.7], [tooth[0][0], pose.plZ + C.s * 45 + 0.7], ...tooth];
  s += '<g opacity="' + f2(hi[1]) + '"><path class="xs-plb" d="' + polyD(band) + '"/></g>';
  // ribs + pockets
  const pk = key(XT.pocket, T);
  let ribsS = "";
  for (const r of RIBS) { const c = wrapNear(r.c), sh = c - r.c;
    for (const [f, t, b] of r.segs) ribsS += '<path class="xs-rib" d="' + polyD(ribPoly(f + sh, t + sh, b + sh)) + '"/>';
    // pocket: the lug-sized corner under the high end of the long ramp, closed by the wall
    const p = [[c + 35, C.zA + C.s * 23], [c + 55, C.zA + C.s * 43], [c + 55, C.zA - 0.15], [c + 35, C.zA - 0.15]];
    ribsS += '<path class="xs-pocket" d="' + polyD(p) + '"/>';
    if (pk > 0.01) ribsS += '<path class="xs-flash" opacity="' + f2(pk) + '" d="' + polyD(p) + '"/>';
    ribsS += '<path class="xs-wallline" d="' + lineD([[c + 55, C.zA - 0.15], [c + 55, C.zA + C.s * 43]]) + '"/>'; }
  s += '<g opacity="' + f2(hi[0]) + '">' + ribsS + '</g>';
  // teeth edge + contact tooth
  s += '<g opacity="' + f2(hi[1]) + '"><path class="xs-ple" d="' + lineD(tooth) + '"/>';
  const ra = pose.psi + 90 * RED, tw2 = key(XT.tooth, T);
  if (tw2 > 0.01) { const k0 = Math.floor((ra - W0) / 45), a0 = W0 + 45 * k0; s += '<path class="xs-hit" opacity="' + f2(tw2) + '" d="' + lineD([[a0, pose.plZ], [a0 + 45, pose.plZ + C.s * 45]]) + '"/>'; }
  s += '</g>';
  const rw = key(XT.ramp, T);
  if (rw > 0.01) for (const r of RIBS) { const c = wrapNear(r.c), sh = c - r.c; for (const [f, t, b] of r.segs) if (ra >= f + sh - 2 && ra <= t + sh + 2) s += '<path class="xs-hit" opacity="' + f2(rw) + '" d="' + lineD([[f + sh, C.zA + C.s * (f - b)], [t + sh, C.zA + C.s * (t - b)]]) + '"/>'; }
  // red lug trail (slow clicks)
  for (const c of XCLICKS) { if (c.sp !== "xslow") continue; const e = T - c.t0, D = M.durOf("xslow"); if (e <= 0 || e > D + 4) continue;
    const fade = e > D + 2.5 ? Math.max(0, 1 - (e - D - 2.5) / 1.5) : 1, pts = [];
    for (let k = 0; k <= 90; k++) { const t = c.t0 + Math.min(e, D) * k / 90, q = M.poseAt(t, XCLICKS, START); pts.push([q.psi + 90 * RED, q.camZ - 0.65]); }
    s += '<path class="xs-trail" opacity="' + f2(fade) + '" d="' + lineD(pts) + '"/>'; }
  // spring (schematic, grey zigzag) under the red lug, compressed when the cam is down
  const spo = key(XT.spring, T);
  if (spo > 0.01) { const a = wrapNear(pose.psi + 90 * RED), zb = ST.zMin - 0.3, zt = pose.camZ - 2.4, n = 9, pts = [[a, zb]];
    for (let k = 1; k < 2 * n; k++) pts.push([a + (k % 2 ? -6 : 6), zb + (zt - zb) * k / (2 * n)]); pts.push([a, zt]);
    s += '<path class="xs-spring" opacity="' + f2(spo * hi[2]) + '" d="' + lineD(pts) + '"/>'; }
  // lugs on top
  for (let i = 0; i < 4; i++) { const a = wrapNear(pose.psi + 90 * i), red = i === RED; const p = [[a - 10, pose.camZ - 2.4], [a + 10, pose.camZ - 2.4], [a + 10, pose.camZ + C.s * 20], [a - 10, pose.camZ]];
    s += '<g opacity="' + f2(red ? hi[3] : hi[2]) + '"><path class="' + (red ? "xs-red" : "xs-lug") + '" d="' + polyD(p) + '"/></g>';
    const ha = key(XT.halo, T);
    if (red && ha > 0.01) { const q = [[a - 13, pose.camZ - 2.85], [a + 13, pose.camZ - 2.85], [a + 13, pose.camZ + C.s * 20 + 0.3], [a - 13, pose.camZ - 0.1]];
      s += '<path class="xs-halo" opacity="' + f2(ha) + '" d="' + polyD(q) + '"/>'; } }
  return s;
}
`;
  const XCSS = `
html,body{margin:0;height:100%;overflow:hidden;background:#fbf8f2}
.xshort{position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 60%,#fdfbf6 0%,#fbf8f2 55%,#f3eee3 100%)}
.xshort>svg{position:absolute;left:0;top:0;width:100%;height:100%}
.xs-wall{fill:#e3ebf4}
.xs-gap{fill:#f7fafd}
.xs-frame{fill:none;stroke:#1f3550;stroke-width:1.1px}
.xs-rib{fill:#2f9e9a;stroke:#0a3533;stroke-width:.9px;stroke-linejoin:round}
.xs-pocket{fill:#0f4f4c;stroke:#062624;stroke-width:1px}
.xs-wallline{stroke:#062624;stroke-width:5.5px;stroke-linecap:round}
.xs-flash{fill:#d6453d;fill-opacity:.14;stroke:#d6453d;stroke-width:3.2px;stroke-linejoin:round}
.xs-halo{fill:none;stroke:#d6453d;stroke-width:3.4px;stroke-linejoin:round;stroke-dasharray:5 3}
.xs-spring{fill:none;stroke:#6c7684;stroke-width:2.2px;stroke-linejoin:round}
.xs-plb{fill:#f6c9a2;fill-opacity:.75;stroke:none}
.xs-ple{fill:none;stroke:#c95f1a;stroke-width:2.8px;stroke-linejoin:round}
.xs-hit{fill:none;stroke:#d6453d;stroke-width:5px;stroke-linecap:round}
.xs-lug{fill:#d9a441;stroke:#4f3700;stroke-width:1px;stroke-linejoin:round}
.xs-red{fill:#d6453d;stroke:#470c08;stroke-width:1.1px;stroke-linejoin:round}
.xs-trail{fill:none;stroke:#d6453d;stroke-width:1.6px;stroke-dasharray:2.4 2.6;stroke-linecap:round}
.cp-loupe-glass{fill:#fbf8f2}.cp-loupe-rim{fill:none;stroke:#7f9fc8;stroke-width:6px}.cp-loupe-edge{fill:none;stroke:#1f3550;stroke-width:.9px}
.iso-solid.m-rib{opacity:var(--o-rib,1)}.iso-solid.m-plunger{opacity:var(--o-pl,1)}.iso-solid.m-brass,.iso-solid.m-ink{opacity:var(--o-cam,1)}.iso-solid.m-accent{opacity:var(--o-red,1)}
#xs-loupe .iso-solid{opacity:1}
`;
  const figX = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: [`<g id="cp-all">`, ...body, `</g>`] }).replace("<svg", `<svg x="0" y="0" width="${WIDTH}" height="${HEIGHT}" overflow="visible"`);
  const outer = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" class="xs-outer" id="xs-root"><defs><clipPath id="xs-clip"><rect x="${ST.x0}" y="${ST.y0}" width="${ST.x1 - ST.x0}" height="${ST.y1 - ST.y0}"/></clipPath>` +
    `<clipPath id="xs-cclip"><rect id="xs-crect" x="0" y="0" width="${VW}" height="${VH}"/></clipPath></defs>` +
    `<g clip-path="url(#xs-cclip)"><g id="xs-cam" transform="translate(${WIDE.x} ${WIDE.y}) scale(${WIDE.s})">${figX}</g></g>` +
    `<g id="xs-lpos">${LOUPE2}</g>` +
    `<g id="xs-strip" opacity="0"><g clip-path="url(#xs-clip)" id="xs-strip-in"></g><rect class="xs-frame" x="${ST.x0}" y="${ST.y0}" width="${ST.x1 - ST.x0}" height="${ST.y1 - ST.y0}" rx="3"/></g></svg>`;
  const LIVE_X = LIVE_CORE + STRIP_JS + `
window.__events = M.eventsOf(XCLICKS, START);
window.__tour = { len: LEN };
const root = document.getElementById("xs-root"), camG = document.getElementById("xs-cam"), lpos = document.getElementById("xs-lpos"), stripG = document.getElementById("xs-strip"), stripIn = document.getElementById("xs-strip-in"), crect = document.getElementById("xs-crect");
let lastXT = null;
function renderX(T) {
  if (T === lastXT) return; lastXT = T;
  const pose = M.poseAt(T, XCLICKS, START);
  render(pose);
  const g = key(XT.cam, T), sc = WIDE.s * Math.exp(Math.log(ZOOM.s / WIDE.s) * g), sl = (sc - WIDE.s) / (ZOOM.s - WIDE.s);
  camG.setAttribute("transform", "translate(" + f2(WIDE.x + (ZOOM.x - WIDE.x) * sl) + " " + f2(WIDE.y + (ZOOM.y - WIDE.y) * sl) + ") scale(" + sc.toFixed(4) + ")");
  // 3-D window clip: whole page when wide, the box between captions and diagram when zoomed
  const cy0 = BOX.y0 * g, cy1 = 711.1 + (BOX.y1 + 6 - 711.1) * g, cx0 = 0 + (BOX.x0 - 14) * g;
  crect.setAttribute("x", f2(cx0)); crect.setAttribute("y", f2(cy0)); crect.setAttribute("width", f2(400 - cx0)); crect.setAttribute("height", f2(cy1 - cy0));
  const L0 = LPOS.wide, L1 = LPOS.zoom;
  lpos.setAttribute("transform", "translate(" + f2(L0.x + (L1.x - L0.x) * g) + " " + f2(L0.y + (L1.y - L0.y) * g) + ") scale(" + (L0.s + (L1.s - L0.s) * g).toFixed(4) + ")");
  const so = key(XT.strip, T); stripG.setAttribute("opacity", f2(so));
  const hi = key(XT.hi, T);
  root.style.setProperty("--o-rib", f2(hi[0])); root.style.setProperty("--o-pl", f2(hi[1])); root.style.setProperty("--o-cam", f2(hi[2])); root.style.setProperty("--o-red", f2(hi[3]));
  if (so > 0.002) stripIn.innerHTML = stripSvg(pose, T, hi);
  window.__T = T;
}
window.__render = renderX;
const KX = 0.5; window.__K = KX;
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const pin = /T=([0-9.]+)/.exec(location.hash); if (pin) window.__manual = true;
function frame() { holdClock(); if (!window.__manual) renderX(Math.min(LEN, Math.max(0, performance.now() / 1000 - KX))); requestAnimationFrame(frame); }
renderX(pin ? +pin[1] : 0);
requestAnimationFrame(frame);
`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Click pen explained</title><style>${k.ISO_CSS}${CREAM}${XCSS}</style></head><body class="iso" data-theme="light"><div class="xshort">${outer}</div><script type="module">${(kitScript() + LIVE_X).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
  if (process.argv.includes("--short")) writeFileSync(join(HERE, "explain.html"), html);
  if (process.argv.includes("--short")) writeFileSync(join(HERE, "explain_events.json"), JSON.stringify(M.eventsOf(XCLICKS, START), null, 1));
  if (process.argv.includes("--short")) writeFileSync(join(HERE, "explain_captions.json"), JSON.stringify(XCAPS, null, 1));
  console.log("wrote explain.html", { ZOOM, end: +(XCLICKS.at(-1).t0 + M.durOf("quick")).toFixed(2) });
}

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['clickpen-light.html', 'clickpen.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
