// Wankel rotary engine: a cutaway rotor housing on a display stand (top side housing removed).
// node build.mjs [--light]  -> wankel.html / wankel-light.html, and always short.html (light, 9:16, no chrome)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WK_SRC = readFileSync(join(HERE, "wk.js"), "utf8");
import { makeWK } from "./wk.gen.mjs";
const RAD = Math.PI / 180;

// ---------------------------------------------------------------- truth (mm)
// Mazda 13B-like: generating radius R = 105, eccentricity e = 15 (R/e = 7), housing width 80.
// Rotor centre on a circle of radius e around the shaft axis; rotor angle = shaft angle / 3.
// Phasing gears: rotor internal gear 30 teeth (pitch r 45 = 3e), stationary gear 20 teeth (pitch r 30 = 2e), 3:2.
const R = 105, e = 15, OFF = 30;
const H = (a) => [e * Math.cos(3 * a * RAD) + R * Math.cos(a * RAD), e * Math.sin(3 * a * RAD) + R * Math.sin(a * RAD)];

// rotor flank = inner envelope of the housing seen from the rotor, less 0.8 mm running clearance
function flankEnvelope() {
  const NB = 1201, minR = new Array(NB).fill(Infinity);
  for (let th = 0; th < 1080; th += 0.75) {
    const phi = (th / 3) * RAD, cx = e * Math.cos(th * RAD), cy = e * Math.sin(th * RAD);
    const ca = Math.cos(-phi), sa = Math.sin(-phi);
    for (let a = 0; a < 360; a += 0.25) {
      const [hx, hy] = H(a);
      const dx = hx - cx, dy = hy - cy;
      const qx = dx * ca - dy * sa, qy = dx * sa + dy * ca;
      let b = Math.atan2(qy, qx) / RAD; b = ((b % 120) + 120) % 120;
      const i = Math.round((b / 120) * (NB - 1));
      const r = Math.hypot(qx, qy);
      if (r < minR[i]) minR[i] = r;
    }
  }
  const N = 36, pts = [];
  for (let j = 0; j <= N; j++) {
    const b = (120 * j) / N;
    const i = Math.round((b / 120) * (NB - 1));
    let r = Infinity; for (let d = -3; d <= 3; d++) { const v = minR[Math.min(NB - 1, Math.max(0, i + d))]; if (v < r) r = v; }
    if (j === 0 || j === N) r = R; else r -= 0.8;
    pts.push([r * Math.cos(b * RAD), r * Math.sin(b * RAD)]);
  }
  return pts;
}
const flank = flankEnvelope();
// side-seal line: flank moved 7 mm inward, starting/ending on the corner-seal buttons
const corner = [R - 9, 0], cornerR = 3;
const flankInFull = flank.map(([x, y]) => { const r = Math.hypot(x, y), s = (r - 7) / r; return [x * s, y * s]; });
const flankIn = (() => {
  const d = (p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]);
  const c2 = [corner[0] * Math.cos(120 * RAD), corner[0] * Math.sin(120 * RAD)];
  const d2 = (p) => Math.hypot(p[0] - c2[0], p[1] - c2[1]);
  const pts = flankInFull.filter((p) => d(p) > cornerR && d2(p) > cornerR);
  // land the ends exactly on the button rims
  const fix = (p, c) => { const v = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...v); return [c[0] + (v[0] / l) * cornerR, c[1] + (v[1] / l) * cornerR]; };
  const a = flankInFull[flankInFull.indexOf(pts[0]) - 1], b = flankInFull[flankInFull.indexOf(pts[pts.length - 1]) + 1];
  return [fix(a, corner), ...pts, fix(b, c2)];
})();

const AZ = 235, EL = 50;
const C = {
  R, e, OFF, flank, flankIn, corner, cornerR,
  ZF: 30, Z0: 31, ZR: 110, ZN: 72, ZRec: 96,
  rgTip: 42, rgRoot: 48.5, brg: 40, lobe: 36,
  PORT: 90, NOTCH: [226, 314], plugs: [258, 282], ZP: 51,
  ZDisk: 147, diskR: 30, nutR: 10,
};
const WIDTH = 400;
const BASE = { x: -215, y: -190, w: 430, d: 380, r: 20 };
const BZ = -46, BH = 14; // base plate z -46..-32 (feet below)
const H0 = (a, d) => { const p = H(a); const dx = -3 * e * Math.sin(3 * a * RAD) - R * Math.sin(a * RAD), dy = 3 * e * Math.cos(3 * a * RAD) + R * Math.cos(a * RAD), l = Math.hypot(dx, dy); return [p[0] + (dy / l) * d, p[1] - (dx / l) * d]; };
const fitPts = [];
for (let a = 0; a < 360; a += 5) { const p = H0(a, OFF + 40); fitPts.push([...p, BZ - 6], [...p, BZ + 14]); const q = H0(a, OFF); fitPts.push([...q, 110]); }
fitPts.push([0, 0, 152], [...H0(258, OFF + 60), 80], [...H0(282, OFF + 60), 80], [...H0(56, OFF + 48), 84], [...H0(124, OFF + 48), 84]);
const P0 = k.fitProjection(fitPts, WIDTH, 2000, { pad: 8, azimuth: AZ, elevation: EL });
const ys = fitPts.map((p) => k.iso(p, P0)[1]);
const HEIGHT = Math.ceil(Math.max(...ys) - Math.min(...ys) + 16);
const P = k.fitProjection(fitPts, WIDTH, HEIGHT, { pad: 8, azimuth: AZ, elevation: EL });
const W = makeWK({ iso: k.iso, depthOf: k.depthOf, cameraOf: k.cameraOf }, P, C);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (p) => k.depthOf(p, P);
const { polySvg, prism, flatSvg, circ, Hoff, arcPts } = W;

// ---------------------------------------------------------------- stand
function stand() {
  const plan = arcPts(0, 360, (a) => Hoff(a, OFF + 40), 3).slice(0, -1);
  const zt = BZ + BH;
  const out = [`<path class="iso-halo" d="${W.pth(plan.map((p) => at([p[0], p[1], BZ - 6])), true)}"/>`];
  const feet = [45, 135, 225, 315].map((a) => Hoff(a, OFF + 22)).sort((a, b) => depth([...a, 0]) - depth([...b, 0]));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 13, BZ - 6, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 10, BZ - 4, 4, P, 28), { tone: "mid" }));
  }
  out.push(polySvg(prism(plan, BZ, zt), { tone: "mid" }).replace('class="iso-solid"', 'class="iso-solid wk-plinth"'));
  out.push(L(W.pth(arcPts(0, 360, (a) => Hoff(a, OFF + 33), 3).map((p) => at([p[0], p[1], zt])), true), { tone: "lo" }));
  const screws = [20, 160, 200, 340, 90, 270].map((a) => Hoff(a, OFF + 27));
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 3, zt, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, zt])), { size: 0.55 }));
  return out.join("");
}
// standoffs between base and the side housing, the shaft's lower pillow block
function standoffs(which) {
  const zt = BZ + BH;
  const items = [];
  for (const [x, y] of [[-112, -78], [112, -78], [-112, 78], [112, 78]]) items.push({ d: depth([x, y, 0]), s: S(k.cylinder(x, y, 14, zt, 4, P, 32, 0.5), { tone: "mid", className: "m-steel" }) + S(k.cylinder(x, y, 9, zt + 4, -zt - 4, P, 28), { tone: "mid", className: "m-steel", inner: L(k.sideArc(x, y, 9, -9, P, 20), { tone: "faint" }) }) });
  const blk = { x: -26, y: -22, w: 52, d: 44, r: 5 };
  items.push({ d: depth([0, 0, 0]), s: S(k.slabOf(blk, zt, 16, P, 4, 0.8), { tone: "mid", className: "m-side" }) + S(k.cylinder(0, 0, 21, zt + 16, -zt - 16, P, 40), { tone: "mid", className: "m-shaft" }) });
  items.sort((a, b) => a.d - b.d);
  return items.filter((it) => (which === "back" ? it.d < depth([0, 0, 0]) + 1 : it.d >= depth([0, 0, 0]) + 1)).map((it) => it.s).join("");
}

// ---------------------------------------------------------------- housings
const ringOuter = arcPts(0, 360, (a) => Hoff(a, OFF), 2).slice(0, -1);
const sidePlan = arcPts(0, 360, (a) => Hoff(a, OFF + 5), 2).slice(0, -1);
function sideHousing() {
  const out = [];
  out.push(`<path class="iso-halo" d="${W.pth(sidePlan.map((p) => at([p[0], p[1], -2])), true)}" style="filter:blur(3px)"/>`);
  out.push(polySvg(prism(sidePlan, 0, C.ZF), { cls: "m-side" }));
  // groove where the rotor housing sits, and its dowel dots on the exposed lip
  out.push(L(W.pth(arcPts(0, 360, (a) => Hoff(a, OFF + 2.5), 3).map((p) => at([p[0], p[1], C.ZF])), true), { tone: "faint" }));
  return out.join("");
}
// inner walls of the rotor housing (drawn before the rotor)
function ringInner() {
  const faces = [];
  const seg = (a0, a1, z0, z1) => { const pts = arcPts(a0, a1, (a) => W.H(a), 2); for (let i = 0; i + 1 < pts.length; i++) { const p = pts[i], q = pts[i + 1]; faces.push({ g: "w", out: [-(q[1] - p[1]), q[0] - p[0], 0], pts: [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]] }); } };
  seg(C.NOTCH[1], C.NOTCH[0] + 360, C.ZF, C.ZR);
  seg(C.NOTCH[0], C.NOTCH[1], C.ZF, C.ZN);
  const out = [polySvg(faces, { cls: "m-housing", crease: "none" })];
  // chrome-plated running surface: a faint scuff band along the visible walls where the apex seals ride
  return out.join("");
}
// port openings and plug holes seen on the inner wall (behind the rotor)
function wallHoles() {
  const out = [];
  for (const pa of C.plugs) {
    const p = W.H(pa), n = W.Hn(pa);
    // only on walls the viewer sees
    if (n[0] * -W.V[0] + n[1] * -W.V[1] <= 0) continue;
    const t = [-n[1], n[0]];
    const ring = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 2 * Math.PI; return [p[0] + t[0] * Math.cos(a) * 4.5 - n[0] * 0.1, p[1] + t[1] * Math.cos(a) * 4.5 - n[1] * 0.1, C.ZR - 6 + Math.sin(a) * 4.5]; });
    out.push(`<path class="wk-hole" d="${W.pth(ring.map(at), true)}"/>`);
  }
  return out.join("");
}
// outer walls, top and the cut of the rotor housing (drawn after the rotor)
function ringOuterSvg() {
  const faces = [];
  const outer = (a0, a1, z0, z1) => { const pts = arcPts(a0, a1, (a) => Hoff(a, OFF), 2); for (let i = 0; i + 1 < pts.length; i++) { const p = pts[i], q = pts[i + 1]; faces.push({ g: "o", out: [q[1] - p[1], -(q[0] - p[0]), 0], pts: [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]] }); } };
  outer(C.NOTCH[1], C.NOTCH[0] + 360, C.ZF, C.ZR);
  outer(C.NOTCH[0], C.NOTCH[1], C.ZF, C.ZN);
  // cut faces: the lowered top in the notch and the two radial ends
  const inN = arcPts(C.NOTCH[0], C.NOTCH[1], (a) => W.H(a), 2), outN = arcPts(C.NOTCH[0], C.NOTCH[1], (a) => Hoff(a, OFF), 2);
  faces.push({ g: "c", out: [0, 0, 1], hatch: 3.2, pts: [...inN, ...outN.reverse()].map((p) => [p[0], p[1], C.ZN]) });
  for (const [a, s] of [[C.NOTCH[0], -1], [C.NOTCH[1], 1]]) {
    const pi = W.H(a), po = Hoff(a, OFF), n = W.Hn(a), t = [-n[1] * s, n[0] * s];
    faces.push({ g: "e" + s, out: [t[0], t[1], 0], hatch: 3.2, pts: [[pi[0], pi[1], C.ZN], [po[0], po[1], C.ZN], [po[0], po[1], C.ZR], [pi[0], pi[1], C.ZR]] });
  }
  const inT = arcPts(C.NOTCH[1], C.NOTCH[0] + 360, (a) => W.H(a), 2), outT = arcPts(C.NOTCH[1], C.NOTCH[0] + 360, (a) => Hoff(a, OFF), 2);
  faces.push({ g: "t", out: [0, 0, 1], depth: 1e9, pts: [...inT, ...outT.reverse()].map((p) => [p[0], p[1], C.ZR]) });
  const out = [polySvg(faces, { cls: "m-housing" })];
  // top face detail: through-bolts with washers, water-jacket slots between them
  const bolts = [], slots = [];
  for (let a = 8; a < 360; a += 24) {
    const inN_ = W.mod(a - C.NOTCH[0], 360) <= C.NOTCH[1] - C.NOTCH[0] + 4 || W.mod(a - C.NOTCH[0] + 4, 360) < 4;
    const nearBar = Math.min(...[150].map((b) => Math.abs(((a - b + 540) % 360) - 180))) < 13;
    if (inN_ || nearBar) continue;
    bolts.push(Hoff(a, OFF * 0.55));
    const s0 = a + 6, s1 = a + 18;
    if (W.mod(s1 - C.NOTCH[0] + 3, 360) <= C.NOTCH[1] - C.NOTCH[0] + 6) continue;
    if (Math.min(...[150].map((b) => Math.min(Math.abs(((s0 - b + 540) % 360) - 180), Math.abs(((s1 - b + 540) % 360) - 180)))) < 9) continue;
    const ins = arcPts(s0, s1, (x) => Hoff(x, 9), 2), ous = arcPts(s0, s1, (x) => Hoff(x, 15), 2).reverse();
    slots.push(W.pth([...ins, ...ous].map((p) => at([p[0], p[1], C.ZR])), true));
  }
  out.push(`<path class="wk-slot" d="${slots.join("")}"/>`, L(slots.join(""), { tone: "mid" }));
  out.push(L(bolts.map(([x, y]) => k.ring(x, y, 4.2, C.ZR, P, 16)).join(""), { tone: "mid" }));
  out.push(D(bolts.map(([x, y]) => at([x, y, C.ZR])), { size: 0.9, tone: "hi" }));
  return out.join("");
}

// ---------------------------------------------------------------- plugs (back waist) and ports (front waist)
function plug(pa) {
  const p = Hoff(pa, OFF), n = W.Hn(pa);
  const c = Math.cos(22 * RAD), s = Math.sin(22 * RAD);
  const F = G.frameOf([p[0] - n[0] * 4, p[1] - n[1] * 4, C.ZP], [n[0] * c, n[1] * c, s], [-n[1], n[0], 0], [-n[0] * s, -n[1] * s, c]);
  return [
    S(G.solidOf([[0, 12], [14, 12]], F, P), { tone: "hi", className: "m-housing" }),
    S(G.solidOf([[14, 9.5], [24, 9.5]], F, P), { tone: "hi", className: "m-steel" }),
    S(G.solidOf([[24, 6.8], [29, 6.8, 1], [50, 5], [53, 4.2]], F, P), { tone: "hi", className: "m-ceramic" }),
    S(G.solidOf([[53, 3], [62, 3]], F, P), { tone: "hi", className: "m-steel" }),
    S(G.solidOf([[62, 4.2], [66, 4.2]], F, P), { tone: "hi", className: "m-steel" }),
  ].join("");
}
function duct(pa, cls) {
  const p0 = Hoff(pa, OFF - 1), n = W.Hn(pa), t = [-n[1], n[0]];
  const box = (s0, s1, hw) => [[s0, -hw], [s1, -hw], [s1, hw], [s0, hw]].map(([s, w]) => [p0[0] + n[0] * s + t[0] * w, p0[1] + n[1] * s + t[1] * w]);
  const out = [];
  out.push(polySvg(prism(box(0, 40, 17), 46, 74), { cls }));
  out.push(polySvg(prism(box(40, 46, 27), 38, 82), { cls }));
  // port mouth on the flange face, with four studs
  const s = 46.05, f = (w, z) => [p0[0] + n[0] * s + t[0] * w, p0[1] + n[1] * s + t[1] * w, z];
  const mouth = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 2 * Math.PI; mouth.push(f(Math.cos(a) * 12, 60 + Math.sin(a) * 9)); }
  out.push(`<path class="wk-hole" d="${W.pth(mouth.map(at), true)}"/>`, L(W.pth(mouth.map(at), true), { tone: "hi" }));
  out.push(D([f(-21, 44), f(21, 44), f(-21, 76), f(21, 76)].map(at), { size: 1.0, tone: "hi" }));
  return out.join("");
}

// ---------------------------------------------------------------- stationary gear, bridge, shaft top
const gearPts = W.gearPoly([0, 0], 20, 26.5, 33, 2.6, 6.3, 0, false);
const gearFull = polySvg(prism(gearPts, 97, 122, { g: "g" }), { cls: "m-brass" });
C.gearFull = gearFull;
function bridge() {
  const out = [];
  const A = 330 * RAD, ax = [Math.cos(A), Math.sin(A)], px = [-ax[1], ax[0]];
  const reach = Math.hypot(...Hoff(150, OFF * 0.5));
  const rect = (s0, s1, w) => [[s0, -w], [s1, -w], [s1, w], [s0, w]].map(([s, q]) => [ax[0] * s + px[0] * q, ax[1] * s + px[1] * q]);
  const parts = [];
  // gear (upper half above the rotor), risers on the rim, the bar, the hub
  parts.push(polySvg(prism(gearPts, C.ZR - 1, 122, { g: "g" }), { cls: "m-brass" }));
  parts.push(polySvg(prism(rect(-reach - 14, -reach + 14, 15), C.ZR, 124), { cls: "m-side" }));
  parts.push(polySvg(prism(rect(-reach - 14, -20, 10), 124, 132), { cls: "m-side" }));
  // bolts through the arm into the riser
  const bolt = [-1].flatMap((s) => [[s * reach - 6, 0], [s * reach + 6, 0]]).map(([a, b]) => [ax[0] * a + px[0] * b, ax[1] * a + px[1] * b]);
  parts.push(L(bolt.map(([x, y]) => k.ring(x, y, 3.4, 132, P, 14)).join(""), { tone: "mid" }), D(bolt.map(([x, y]) => at([x, y, 132])), { size: 0.75, tone: "hi" }));
  parts.push(S(k.cylinder(0, 0, 36, 122, 14, P, 64, 0.6), { tone: "hi", className: "m-side", inner: L(k.sideArc(0, 0, 36, 127, P, 40), { tone: "faint" }) }));
  const hb = Array.from({ length: 6 }, (_, i) => [Math.cos((i * 60 + 30) * RAD) * 29, Math.sin((i * 60 + 30) * RAD) * 29]);
  parts.push(L(hb.map(([x, y]) => k.ring(x, y, 2.6, 136, P, 12)).join(""), { tone: "mid" }), D(hb.map(([x, y]) => at([x, y, 136])), { size: 0.6, tone: "hi" }));
  // shaft journal and the timing disk (teal), nut
  parts.push(S(k.cylinder(0, 0, 21, 136, C.ZDisk - 7 - 136, P, 48), { tone: "hi", className: "m-shaft" }));
  parts.push(S(k.cylinder(0, 0, C.diskR, C.ZDisk - 7, 7, P, 64, 0.6), { tone: "hi", className: "m-shaft", inner: L(k.ring(0, 0, 15, C.ZDisk, P, 48), { tone: "faint" }) }));
  return { under: parts.join(""), nut: S(k.cylinder(0, 0, C.nutR, C.ZDisk, 5, P, 6, 0), { tone: "hi", className: "m-steel" }) };
}

// ---------------------------------------------------------------- assemble
const BR = bridge();
const TH0 = 90 + 1080 * 4; // red face just past the ports
const dyn0 = W.dynamic(TH0);
const ports = [{ a: 56, cls: "m-steel" }, { a: 124, cls: "m-side" }];
const frontParts = ports.map((p) => ({ d: depth([...Hoff(p.a, OFF + 30), 60]), s: duct(p.a, p.cls) })).sort((a, b) => a.d - b.d).map((x) => x.s).join("");
const body = [
  `<g class="wk-jig">${stand()}${standoffs("back")}</g>`,
  `<g class="wk-jig">${standoffs("front")}</g>`,
  sideHousing(),
  frontParts,
  ringInner(),
  wallHoles(),
  `<g data-part="gas-floor">${dyn0.gasFloor}</g>`,
  `<g data-part="rotor">${dyn0.rotor}</g>`,
  `<g data-part="gas-top">${dyn0.gasTop}</g>`,
  ringOuterSvg(),
  C.plugs.map((a) => ({ a, d: depth([...Hoff(a, OFF), 50]) })).sort((x, y) => x.d - y.d).map((x) => plug(x.a)).join(""),
  BR.under,
  `<g data-part="disk">${dyn0.disk}</g>`,
  BR.nut,
  `<g data-part="light">${dyn0.light}</g>`,
];
const DEFS = `<defs><radialGradient id="wk-glow-g"><stop offset="0" stop-color="#fffbe0" stop-opacity="1"/><stop offset="0.28" stop-color="#ffd84a" stop-opacity=".95"/><stop offset="0.6" stop-color="#ff9a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient></defs>`;

// ---------------------------------------------------------------- tour (tour seconds), shared by both pages
const TA = 90 + 1080 * 4; // red face at the start of intake
const keys = [];
{
  const w1 = 1260, w2 = 1440;
  keys.push([0, TA - 1008 - w1 * 2.0, w1], [2.0, TA - 1008, w1], [3.6, TA, 0], [3.9, TA, 0]);
  keys.push([6.7, TA + 300, 0], [7.0, TA + 300, 0]);            // intake
  keys.push([9.6, TA + 534, 0], [10.15, TA + 534, 0]);          // compression, hold just before TDC
  keys.push([10.45, TA + 566, 210], [12.7, TA + 810, 0], [13.0, TA + 810, 0]); // spark, power
  keys.push([15.6, TA + 1080, 0], [15.9, TA + 1080, 0]);        // exhaust
  const t13 = 17.5, th13 = TA + 1080 + 0.5 * w2 * 1.6;          // spin up
  keys.push([t13, th13, w2]);
  const decel = 1.7, dth = 0.55 * w2 * decel;
  let F = TA + 1080 * Math.ceil((th13 + w2 * 4.0 + dth - TA) / 1080);
  const th14 = F - dth, t14 = t13 + (th14 - th13) / w2;
  keys.push([t14, th14, w2], [t14 + decel, F, 0], [24.5, F, 0]);
}
const tourTheta = (t) => W.thetaAt(t, keys);
// sound moments
function eventsOf() {
  const ev = [];
  const dt = 1 / 1200;
  let prev = tourTheta(0);
  for (let t = dt; t <= 24; t += dt) {
    const th = tourTheta(t);
    // a face reaches top dead centre (u = 180) every 360° of shaft: one firing per shaft turn
    const u0 = (th0) => W.mod(th0 / 3 + 60 - C.PORT - 180, 120);
    const a = W.mod(prev / 3 + 60 - C.PORT - 180, 120), b = W.mod(th / 3 + 60 - C.PORT - 180, 120);
    if (th > prev && b < a) {
      const face = Math.round(W.mod((th / 3 + 60 - C.PORT - 180) - b, 360) / 120) % 3; // which face fired
      const red = W.mod(th / 3 + 60 - C.PORT, 360);
      const isRed = Math.abs(red - 180) < 5;
      const slow = t > 3.8 && t < 15.9;
      ev.push({ t: +t.toFixed(3), type: "spark", i: isRed && slow ? 1 : slow ? 0.45 : 0.6 });
    }
    prev = th;
  }
  const add = (t, type, i) => ev.push({ t, type, i });
  add(3.62, "thunk", 0.35);   // rotor settles at the ports
  add(3.95, "whoosh", 0.5);   // intake
  add(7.05, "slide", 0.45);   // compression
  add(10.12, "tick", 0.4);    // hold at TDC
  add(10.55, "thunk", 0.9);   // power push
  add(13.05, "whoosh", 0.6);  // exhaust
  add(15.95, "turn", 0.7);    // spin up
  add(keys[keys.length - 2][0] + 0.02, "click", 0.6); // resolved
  ev.sort((a, b) => a.t - b.t);
  // keep events >= 0.15 s apart (drop the weaker)
  const outv = [];
  for (const x of ev) { const last = outv[outv.length - 1]; if (last && x.t - last.t < 0.15) { if (x.i > last.i) outv[outv.length - 1] = x; } else outv.push(x); }
  return outv;
}
const EVENTS = eventsOf();

const MATS = {
  steel: ["#8e98a3", "#a9b2bc", "#c3cad2", "#d9dee4", "#eef1f4", "#3b4148", "#7d8791"],
  ceramic: ["#d8d4cc", "#e4e0d8", "#eeebe5", "#f6f4f0", "#fffefb", "#5d5850", "#bdb6aa"],
  brass: ["#b5841f", "#c99430", "#d9a441", "#e6b95e", "#f7e0a0", "#4f3700", "#9c7419"],
  housing: ["#46688f", "#52749c", "#5b7fa6", "#6d8eb5", "#a3bbd6", "#1f3550", "#89a5c6"],
  side: ["#6f8db3", "#7d9abe", "#8aa6c8", "#99b3d2", "#c4d5e8", "#24405f", "#a9c0dc"],
  shaft: ["#1f7774", "#278985", "#2f9e9a", "#47b2ad", "#8fd6d1", "#0a3533", "#196563"],
  rotor: ["#c95f1a", "#dc7026", "#e8823a", "#f39a55", "#ffc48f", "#5a2405", "#b0561a"],
  accent: ["#a82a24", "#bf352e", "#d6453d", "#e45f57", "#f08d86", "#470c08", "#8c241f"],
  hole: ["#20262c", "#20262c", "#20262c", "#20262c", "#1d3b3a", "#0a3533", "#0a3533"],
};
const MAT_CSS = Object.entries(MATS).map(([n, c]) => [0, 1, 2, 3].map((i) => `.iso-solid.m-${n}>.iso-shade[data-shade="${i}"]{fill:${c[i]};stroke:${c[i]}}`).join("") +
  `.iso-solid.m-${n}>.iso-top{fill:${c[4]};stroke:${c[4]}}.iso-solid.m-${n}>.iso-fill{fill:${c[2]}}.iso-solid.m-${n}>.iso-edge{stroke:${c[5]}}.iso-solid.m-${n}>.iso-line:not(.iso-edge){stroke:${c[6]}}`).join("\n");
const CREAM = `
.iso[data-theme="light"]{--anatomy-page:#f5f1e8;--anatomy-card:#fbf8f2;--anatomy-paper:#fbf8f2;--anatomy-face:#fffdf9;--anatomy-top:#fffdf8;
 --anatomy-shade-0:#e2dccf;--anatomy-shade-1:#eae5da;--anatomy-shade-2:#f1ede4;--anatomy-shade-3:#f7f4ed;
 --anatomy-hi:#2a2723;--anatomy-mid:#8b8579;--anatomy-lo:#b8b1a4;--anatomy-faint:#d8d2c5;--anatomy-halo:#8a7f6a;--anatomy-dot:#3a3631}
.iso-solid[class*=" m-"]:not([data-seamless])>.iso-shade,.iso-solid[class*=" m-"]:not([data-seamless])>.iso-top{stroke:none}
.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:.35px}
.wk-plinth,.wk-jig{--anatomy-top:#e6eef8;--anatomy-face:#edf3fa;--anatomy-paper:#e6eef8;--anatomy-shade-3:#cfdeef;--anatomy-shade-2:#b9cde6;--anatomy-shade-1:#a3bddc;--anatomy-shade-0:#89a8cf;--anatomy-hi:#1f3550;--anatomy-mid:#4f6f96;--anatomy-lo:#7f9cc2;--anatomy-faint:#a9c0dc;--anatomy-dot:#1f3550}
.iso-solid>path.wk-cut{fill:#d3e0ef;stroke:#d3e0ef;stroke-width:.35px}
.iso-solid>.iso-line.wk-hatch{stroke:#6f8fb8!important;stroke-width:.5px}
.wk-gas{stroke:none}
.wk-glow{fill:url(#wk-glow-g);mix-blend-mode:normal}
.wk-spark path{fill:#fffbe6;stroke:#ffb11f;stroke-width:.6px;stroke-linejoin:round}
.wk-spark-halo{fill:#ffe27a;opacity:.55}
.wk-hole{fill:#2a2f36;stroke:none}
.wk-slot{fill:#3d5f86;stroke:none}
.iso-line.wk-pocket{stroke-width:.7px}
.iso-line.wk-index{stroke:#f4fbfa!important;stroke-width:1.6px;stroke-linecap:round}
.wk-index-dot{fill:#f4fbfa;stroke:#0a3533;stroke-width:.4px}
` + MAT_CSS;

// ---------------------------------------------------------------- live code
const LIVE_CORE = `
${WK_SRC}
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const W = makeWK({ iso, depthOf, cameraOf }, P, C);
const KEYS = ${JSON.stringify(keys)};
const svg = document.querySelector("svg.iso-svg");
const part = (n) => svg.querySelector('[data-part="' + n + '"]');
const G_ = { gf: part("gas-floor"), rotor: part("rotor"), gt: part("gas-top"), disk: part("disk"), light: part("light") };
let lastTh = null;
function render(th) {
  if (lastTh !== null && Math.abs(th - lastTh) < 1e-4) return;
  lastTh = th;
  const d = W.dynamic(th);
  G_.gf.innerHTML = d.gasFloor; G_.rotor.innerHTML = d.rotor; G_.gt.innerHTML = d.gasTop; G_.disk.innerHTML = d.disk; G_.light.innerHTML = d.light;
}
`;
const LIVE_SHORT = LIVE_CORE + `
const LEAD = 0.2 + 1 / 60;
window.__events = ${JSON.stringify(EVENTS)};
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const t0 = performance.now();
function frame(now) {
  holdClock();
  const T = Math.max(0, (now - t0) / 1000 - LEAD);
  window.__T = T;
  render(W.thetaAt(T, KEYS));
  requestAnimationFrame(frame);
}
window.__T = 0;
window.__render = (T) => { lastTh = null; render(W.thetaAt(T, KEYS)); };
render(W.thetaAt(0, KEYS));
requestAnimationFrame(frame);
`;
const LIVE_FIG = LIVE_CORE + `
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const NAMES = ["intake", "intake", "compression", "power", "exhaust"];
let clock = 0, last = 0, raf = 0, visible = false, th = ${TA}, speed = 0, target = 1;
function phaseName(u) { return u < 100 ? "intake" : u < 180 ? "compression" : u < 270 ? "power" : "exhaust"; }
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now; clock += dt;
  speed += (target - speed) * (1 - Math.exp(-dt * 2.5));
  th += speed * 120 * dt;
  render(th);
  const u = W.phaseOf(W.poseOf(th), 0);
  const text = "shaft " + Math.round(th % 360) + "° · rotor " + Math.round((th / 3) % 360) + "° · red face: " + phaseName(u);
  if (readout.textContent !== text) readout.textContent = text;
  raf = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } };
function toggle() { target = target > 4 ? 1 : 12; run(); }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", toggle);
stage.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
render(th);
`;

const LABEL = "A Wankel rotary engine on a display stand with its top side housing removed: a triangular orange rotor turns inside a peanut-shaped (epitrochoid) steel-blue housing. Its centre rides an eccentric on the teal shaft; an internal gear on the rotor rolls round a fixed brass gear, 3:2, so the shaft turns three times per rotor turn. One rotor face is red; the chamber in front of it fills with blue mixture at the intake port, is squeezed against the two spark plugs, burns and expands, then empties through the exhaust port.";
const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: [DEFS, ...body] });
const fig = k.plateHtml({
  fig: "Fig 1", title: "Wankel rotary engine", hint: "Click or press space to spin it up",
  readout: "shaft 0° · rotor 0° · red face: intake",
  keys: [{ mark: "lit", label: "One rotor face: follow it through intake, compression, power, exhaust" }, { mark: "raised", label: "Eccentric shaft: three turns per rotor turn" }],
  caption: "Housing: epitrochoid with generating radius 105 mm and eccentricity 15 mm (R/e = 7), 80 mm wide. The rotor's centre circles the shaft axis at radius e while the rotor turns at one third of shaft speed, held in phase by a 30-tooth internal gear on the rotor and a 20-tooth stationary gear (3:2). Each of the three faces makes one four-stroke cycle per rotor turn, so the engine fires once per shaft turn.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Wankel engine: click or press space to change speed">${svg}</div>`,
});
const figName = theme === "light" ? "wankel-light.html" : "wankel.html";
writeFileSync(join(HERE, figName), k.pageHtml({ title: "Wankel rotary engine", theme, body: fig, script: kitScript() + LIVE_FIG, width: 640 }).replace("</style>", CREAM + "</style>"));
console.log("wrote", figName, "svg", WIDTH, "x", HEIGHT);

const SHORT_CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:var(--anatomy-paper)}
.short{position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 60%,#fdfbf6 0%,var(--anatomy-paper) 55%,#f3eee3 100%)}
.short .iso-svg{position:absolute;left:3vw;width:94vw;top:var(--top);height:auto;overflow:visible}
`;
const svgH = 94 * HEIGHT / WIDTH * 415 / 738; // in vh at 415x738
const top = Math.max(24, 53 - svgH / 2);
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wankel short</title><style>${k.ISO_CSS}${CREAM}${SHORT_CSS}:root{--top:${top.toFixed(1)}vh}</style></head><body class="iso" data-theme="light"><div class="short">${svg}</div><script type="module">${(kitScript() + LIVE_SHORT).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.preview.json"), JSON.stringify(EVENTS, null, 1));
console.log("wrote short.html; svg height", svgH.toFixed(1), "vh at top", top.toFixed(1), "vh; events", EVENTS.length, "final key", JSON.stringify(keys.slice(-3)));

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;performance.now=()=>0;Date.now=()=>0;window.requestAnimationFrame=(f)=>n++<0?r(()=>f(0)):0;})();';
  for (const pg of ['wankel-light.html', 'wankel.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
