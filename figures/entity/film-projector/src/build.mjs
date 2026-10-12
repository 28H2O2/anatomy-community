import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// World units are 2 mm. x runs along the projector (the lens points +x), y out of the threading side, z up.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 560;
const FEED = [40, 150], TAKE = [-50, 140], UP = [12, 88], LO = [12, 26], ROLL = [-54, 22], REEL = 44;
const PITCH = 3.81, SR = (12 * PITCH) / (2 * Math.PI), CORE = 12.7, THICK = 0.07, FRAMES = 16000, N0 = 4800;
const PLATE = { x: -84, y: -48, w: 176, d: 80, r: 6 };
const BASE = { x: -64, y: -34, w: 128, d: 38, r: 4 };
const BEAM = [88.6, 132];

const rim = (c, r) => Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i * Math.PI) / 12), 15, c[1] + r * Math.sin((i * Math.PI) / 12)]);
const P = k.fitProjection([...k.boxCorners(PLATE, -10, 0), ...rim(FEED, REEL), ...rim(TAKE, REEL), [BEAM[1], 26, 68], [BEAM[1], -6, 36], [-60, -30, 120]], W, H, { pad: 20, azimuth: 62, elevation: 28 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, { tone: "mid", ...style });
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts.map(at), { size: 0.45, ...style });
const seg = (a, b) => k.segment(a, b, P);
const poly3 = (pts, closed) => k.pathOf(pts.map(at), closed);
const layers = { back: [], aper: [], drums: [], late: [], claw: [], gate: [], lens: [] };
const add = (layer, ref, svg, hit) => layers[layer].push({ key: k.depthOf(ref, P), svg: hit ? `<g data-hit="${hit}">${svg}</g>` : svg });
const box = (layer, [x0, y0, z0], [x1, y1, z1], style = {}, o = {}) => {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: o.r ?? 0.3 };
  add(layer, o.at ?? [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, o.steps ?? 2, o.bevel ?? 0), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), o.hit);
};
const turned = (layer, F, profile, style = {}, o = {}) => {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  add(layer, o.at ?? G.add3(F.o, G.mul3(F.a, mid)), S(G.solidOf(profile, F, P), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), o.hit);
};
const Y = (x, z) => G.frameOf([x, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const X = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const knurled = (F, s0, s1, r, n) => k.fadedSvg(G.ribsOf(F, s0, s1, r, n, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" });
const slots = (list) => L(list.map((q) => poly3(q, true)).join(""), { tone: "lo" });

// ---------- bench and base ----------
const raw = [`<path class="iso-halo" d="${k.haloOf(PLATE, -10, 10, P)}"/>`];
for (const [x, y] of k.corners(PLATE, 14).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) raw.push(S(k.cylinder(x, y, 5, -10, 5, P, 24), { tone: "lo" }));
const screws = k.corners(PLATE, 6);
raw.push(S(k.slabOf(PLATE, -6, 6, P, 6, 1.2), { tone: "lo" }), L(k.planOutline(k.insetPlan(PLATE, 3.4), 0, P), { tone: "faint" }), L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => [x, y, 0]), { size: 0.5 }));
const RULER = { x: -62, y: 22, w: 124, d: 5, r: 0.6 };
const ticks = k.topTicks(-60, 60, 2, 5, RULER.y, 0.6, [1.4, 2.6], P, "x");
raw.push(S(k.slabOf(RULER, 0, 0.6, P, 2), { tone: "lo", crease: "none" }), L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
raw.push(`<path class="iso-halo" d="${k.haloOf(BASE, 0, 8, P)}" style="opacity:.7"/>`);
for (const [x, y] of k.corners(BASE, 7)) add("back", [x, y, 1.5], S(k.cylinder(x, y, 3.4, 0, 3, P, 20), { tone: "lo" }));
add("back", [0, -15, 6], S(k.slabOf(BASE, 3, 6, P, 6, 0.8), { tone: "lo" }) + Dt([[-56, 4, 7.5], [56, 4, 7.5]]));

// ---------- body, lamp house, handle ----------
const BODY = { x: -60, y: -30, w: 120, d: 30, r: 3 };
add("back", [0, -15, 54], S(k.slabOf(BODY, 9, 91, P, 4, 1), { inner: L(k.sideSeam(BODY, 17, P, 4) + k.sideSeam(BODY, 93, P, 4), { tone: "faint" }) }) +
  L(poly3([[-56, 0, 14], [56, 0, 14], [56, 0, 96], [-56, 0, 96]], true), { tone: "faint" }) + Dt([[-54, 0, 16], [54, 0, 16], [-54, 0, 94], [54, 0, 94]], { size: 0.55 }) +
  slots(Array.from({ length: 6 }, (_, i) => [[-48 + 3 * i, 0, 34], [-46.6 + 3 * i, 0, 34], [-46.6 + 3 * i, 0, 54], [-48 + 3 * i, 0, 54]])) +
  slots(Array.from({ length: 5 }, (_, i) => [[60, -26 + 3 * i, 14], [60, -24.6 + 3 * i, 14], [60, -24.6 + 3 * i, 24], [60, -26 + 3 * i, 24]])));
const LAMP = { x: 8, y: -27, w: 38, d: 20, r: 2 };
add("back", [27, -17, 109], S(k.slabOf(LAMP, 100, 18, P, 3, 0.8), { inner: L(k.sideSeam(LAMP, 104, P, 3), { tone: "faint" }) }) +
  slots(Array.from({ length: 8 }, (_, i) => [[12 + 4 * i, -23, 118], [13.6 + 4 * i, -23, 118], [13.6 + 4 * i, -11, 118], [12 + 4 * i, -11, 118]])) + Dt([[10, -9, 118], [44, -9, 118], [10, -25, 118], [44, -25, 118]]));
for (const x of [-36, -10]) add("back", [x, -15, 105], S(k.cylinder(x, -15, 1.6, 100, 10, P, 16), { tone: "lo" }));
box("back", [-38, -16.8, 110], [-8, -13.2, 113.4], { tone: "lo" }, { r: 1.6, steps: 4, bevel: 0.4, at: [-23, -15, 112] });

// ---------- reel arms and spindles ----------
for (const [x, z] of [FEED, TAKE]) {
  add("back", [x, -3, (100 + z) / 2], S(k.cylinder(x, -3, 1.8, 100, z - 100, P, 18), { tone: "lo" }));
  turned("back", Y(x, z), [[-6, 3.6], [-1, 3.6], [-0.6, 3]], { tone: "mid" }, { at: [x, -3, z] });
  turned("back", Y(x, z), [[-0.6, 1.3], [15.4, 1.3]], { tone: "lo" }, { at: [x, 4, z] });
  turned("late", Y(x, z), [[15.4, 2.6], [16.4, 2.6], [16.8, 1.8], [17.8, 1.3], [18.4, 0.9]], { tone: "hi" });
}

// ---------- sprockets and the take-up roller ----------
for (const [x, z] of [UP, LO]) {
  const F = Y(x, z);
  turned("back", F, [[0, 9.6], [2.6, 9.6], [3, 9]], { tone: "lo" }, { extra: k.dotsSvg(G.dotsOf(F, 3, 8.1, 6, P, { all: true }), { size: 0.45, tone: "mid" }) });
  turned("drums", F, [[3, SR], [14.2, SR], [14.6, SR - 0.6]], { tone: "mid" }, { extra: L(G.circleOf(F, 14.6, 2.6, P, 32), { tone: "lo" }) + Dt([[x, 14.6, z]], { size: 0.7 }) });
}
turned("back", Y(...ROLL), [[0, 5.6], [2.6, 5.6], [3, 5]], { tone: "lo" });
turned("drums", Y(...ROLL), [[3, 3], [14.2, 3], [14.6, 2.4]], { tone: "mid" }, { extra: Dt([[ROLL[0], 14.6, ROLL[1]]], { size: 0.6 }) });

// ---------- gate, condenser, claw cam, knobs on the threading side ----------
box("aper", [37, 4, 31], [39.6, 16, 35], { tone: "mid" });
box("aper", [37, 4, 44], [39.6, 16, 68], { tone: "mid" }, { extra: Dt([[39.6, 15, 64], [39.6, 15, 47]]) });
box("back", [24, 0, 40], [30, 10, 46.8], { tone: "lo" }, { r: 0.6, steps: 3 });
turned("back", X(22, 10, 52), [[0, 4.4], [0.6, 5.2], [9.8, 5.2], [10.4, 4.6]], { tone: "mid" }, { inner: L(G.arcOf(X(22, 10, 52), 4.2, 5.2, P) + G.arcOf(X(22, 10, 52), 6.2, 5.2, P), { tone: "faint" }) });
box("back", [31, 0, 41], [33.6, 10, 44.2], { tone: "lo" });
turned("back", X(33, 10, 45), [[0, 1.5], [1.4, 1.5]], { tone: "mid" });
const CAM = Y(56, 32);
box("aper", [52, 0, 27], [60, 10, 37], { tone: "lo" }, { r: 0.6, steps: 3, bevel: 0.4 });
turned("aper", CAM, [[10, 4.6], [11.2, 4.6]], { tone: "mid" }, { extra: k.dotsSvg(G.dotsOf(CAM, 11.2, 3.8, 6, P, { all: true }), { size: 0.4, tone: "mid" }) });
const FRAMER = Y(24, 36);
turned("back", FRAMER, [[0, 3.8], [0.8, 3.8], [1.1, 3.2], [4.2, 3.2], [4.6, 2.6]], { tone: "mid" }, { inner: knurled(FRAMER, 1.1, 4.2, 3.2, 28) });
const INCH = Y(-20, 62);
turned("back", INCH, [[0, 5.6], [1, 5.6], [1.3, 4.8], [5.4, 4.8], [6, 3.8]], { tone: "mid" }, { hit: "inch", inner: knurled(INCH, 1.3, 5.4, 4.8, 36), extra: L(G.circleOf(INCH, 6, 2, P, 32), { tone: "lo" }) });
box("back", [-48, 0, 70], [-26, 0.8, 80], { tone: "lo" }, { r: 0.6, steps: 2, extra: L([73, 75.4, 77.8].map((z, i) => seg([-45, 0.8, z], [-45 + (i ? 12 : 17), 0.8, z])).join(""), { tone: "faint", free: true }) + Dt([[-47, 0.8, 75], [-27, 0.8, 75]], { size: 0.4 }) });

// ---------- controls on the front face: run switch and speed selector ----------
const KNOBS = { sw: [-14, 72], fps: [-14, 46] };
const ANG = { sw: [-0.7, 0.7], fps: [-1.05, -0.35, 0.35, 1.05] };
for (const [name, [y, z]] of Object.entries(KNOBS)) {
  const F = X(60, y, z);
  const face = ANG[name].map((a) => poly3([G.pointOf(F, 0.02, 8.2, a + Math.PI / 2), G.pointOf(F, 0.02, 9.8, a + Math.PI / 2)])).join("");
  turned("back", F, [[0, 6.2], [1, 6.2], [1.3, 5.2], [5.2, 5.2], [5.8, 4.4]], { tone: "mid" }, { hit: name, inner: knurled(F, 1.3, 5.2, 5.2, 36), extra: L(G.circleOf(F, 0.02, 8.2, P, 64) + face, { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-part="${name}" data-free="both" style="stroke-width:1"/>` });
}

// ---------- claw, built at rest (out, at the top of its stroke) ----------
box("claw", [51, 11.4, 36], [54.6, 13.4, 40.7], { tone: "mid" }, { at: [52.8, 12.4, 38] });
box("claw", [43.2, 12, 40.7], [53, 13.4, 42.3], { tone: "hi" }, { at: [48, 12.7, 41.5] });
box("claw", [41.8, 12, 40.9], [43.2, 13.4, 42.1], { lit: true }, { at: [42.5, 12.7, 41.5] });

// ---------- gate front: pressure plate (with its window), guides, hinge ----------
box("gate", [40.4, 4.6, 46], [43, 15.4, 61], { tone: "mid" }, { bevel: 0.3 });
box("gate", [41, 0, 50], [42.6, 4.6, 57], { tone: "lo" });
box("gate", [40.4, 4.6, 63], [43, 15.4, 68], { tone: "mid" }, { bevel: 0.3, extra: Dt([[43, 6.4, 65.5], [43, 13.6, 65.5]]) });
box("gate", [40.4, 4.6, 31], [43, 15.4, 35], { tone: "mid" }, { bevel: 0.3, extra: Dt([[43, 6.4, 33], [43, 13.6, 33]]) });
add("gate", [43, 10, 58.2], Dt([[43, 5.8, 58.2], [43, 14.2, 58.2], [43, 5.8, 47.3], [43, 14.2, 47.3]], { size: 0.4 }));

// ---------- shutter bearing and lens ----------
box("lens", [51, 0, 45], [59, 3, 59], { tone: "lo" }, { r: 0.6, steps: 3, extra: Dt([[52.6, 3, 47], [57.4, 3, 47], [52.6, 3, 57], [57.4, 3, 57]], { size: 0.4 }) });
const LENS = X(50, 10, 52);
turned("lens", LENS, [[0, 7], [14, 7], [14.4, 7.8], [24, 7.8], [24.4, 7], [38, 7], [38.6, 6.4]], { tone: "mid" }, {
  inner: knurled(LENS, 14.4, 24, 7.8, 48) + L(G.arcOf(LENS, 4, 7, P) + G.arcOf(LENS, 30, 7, P) + G.arcOf(LENS, 31.4, 7, P), { tone: "faint" }),
  extra: `<path class="pj-glass" d="${G.circleOf(LENS, 38.6, 4.6, P, 48)}"/>` + L(G.circleOf(LENS, 38.6, 4.6, P, 48) + G.circleOf(LENS, 38.6, 2.8, P, 48), { tone: "lo" }),
});

// ---------- the beam: a static shape whose opacity follows the shutter ----------
const beamPts = [];
for (let i = 0; i < 32; i++) {
  const a = (i / 32) * 2 * Math.PI;
  beamPts.push(at([BEAM[0], 10 + 4.4 * Math.cos(a), 52 + 4.4 * Math.sin(a)]), at([BEAM[1], 10 + 15 * Math.cos(a), 52 + 11 * Math.sin(a)]));
}
const [b0, b1] = [at([BEAM[0], 10, 52]), at([BEAM[1], 10, 52])];
const beam = `<defs><linearGradient id="pj-beam" gradientUnits="userSpaceOnUse" x1="${b0[0].toFixed(2)}" y1="${b0[1].toFixed(2)}" x2="${b1[0].toFixed(2)}" y2="${b1[1].toFixed(2)}"><stop offset="0" stop-color="var(--beam)" stop-opacity=".55"/><stop offset="1" stop-color="var(--beam)" stop-opacity="0"/></linearGradient></defs><path class="pj-beam" fill="url(#pj-beam)" d="${k.pathOf(G.hullOf(beamPts), true)}"/>`;

// ---------- order: static layers with the live layers between them ----------
const sorted = (name) => layers[name].sort((a, b) => a.key - b.key).map((it) => it.svg).join("");
const svg = k.figureSvg({
  width: W,
  height: H,
  label: "A 16 mm film projector on a bench, threading side towards you. Film runs from the front reel down to the upper sprocket, through an upper loop into the gate behind the lens, where a claw pulls it down one frame at a time past a two-blade shutter, then through a lower loop, round the lower sprocket and a roller, and up to the rear take-up reel.",
  body: [...raw, sorted("back"), `<g data-live="shutter"></g>`, sorted("aper"), `<g data-live="reels"></g><g data-live="film"></g>`, sorted("drums"), `<g data-live="teeth"></g><g data-live="flanges"></g>`, sorted("late"), `<g data-live="pin"></g><g data-live="claw">${sorted("claw")}</g>`, sorted("gate"), `<g data-live="beam">${beam}</g>`, sorted("lens")],
});

const CSS = `<style>
.pj-stage{--film:#4d3f31;--pack:#3a3027;--beam:#ffe6a8;--lamp:0}
.iso[data-theme="light"] .pj-stage{--film:#b8a383;--pack:#a08a6a;--beam:#f0b03a}
.pj-stage [data-hit]{cursor:pointer}
.pj-film{fill:var(--film);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);stroke-linejoin:round}
.pj-pack{fill:var(--pack);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.pj-perf{fill:var(--anatomy-card);stroke:none}
.pj-glow{fill:var(--beam);opacity:calc(var(--lamp)*.9)}
.pj-beam{opacity:var(--lamp)}
.pj-glass{fill:var(--anatomy-shade-0)}
.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const DATA = { P, V: G.viewOf(P), FEED, TAKE, UP, LO, ROLL, REEL, PITCH, SR, CORE, THICK, FRAMES, N0, KNOBS, ANG, ax: k.axisVector(P, [1, 0, 0]), az: k.axisVector(P, [0, 0, 1]) };
const live = `
const D = ${JSON.stringify(DATA)};
const P = D.P, stage = document.querySelector(".pj-stage"), $ = (s) => stage.querySelector('[data-live="' + s + '"]'), readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const FPS = [1, 2, 6, 24], TAU = 2 * Math.PI, p = D.PITCH;
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const pt = (q) => { const s = iso(q, P); return s[0].toFixed(2) + " " + s[1].toFixed(2); };
const path = (pts, close) => "M" + pts.map(pt).join("L") + (close ? "Z" : "");
const circ = (c, r, y, a0 = 0, a1 = TAU, n = 56) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)]; });
const face = (d, shade, tone) => '<g class="iso-solid"><path class="iso-shade" data-shade="' + shade + '" fill-rule="evenodd" d="' + d + '"/><path class="iso-line iso-edge" data-tone="' + tone + '" d="' + d + '"/></g>';
const packR = (len) => Math.sqrt(D.CORE * D.CORE + (len * D.THICK) / Math.PI);
const left = (c1, r1, c2, r2) => {
  const d = [c2[0] - c1[0], c2[1] - c1[1]], l = Math.hypot(d[0], d[1]), u = [d[0] / l, d[1] / l], h = (r1 - r2) / l, q = Math.sqrt(1 - h * h), v = [-u[1], u[0]];
  const ns = [1, -1].map((s) => [h * u[0] + s * q * v[0], h * u[1] + s * q * v[1]]), n = ns[0][0] < ns[1][0] ? ns[0] : ns[1];
  return [[c1[0] + r1 * n[0], c1[1] + r1 * n[1]], [c2[0] + r2 * n[0], c2[1] + r2 * n[1]]];
};
const arc = (c, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
const bez = (a, b, c, d, n = 22) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = 1 - t; return [0, 1].map((j) => s * s * s * a[j] + 3 * s * s * t * b[j] + 3 * s * t * t * c[j] + t * t * t * d[j]); });
let c = 0, rate = 0, run = false, speed = 1, lamp = 0, inch = null, thF = 0, thT = 0, last = 0, frame = 0, visible = false, now = 0, touched = -1e9, tour = false;
function claw(f) {
  const g = sm((f - 0.05) / 0.22), inn = f < 0.27 ? sm(f / 0.045) : 1 - sm((f - 0.275) / 0.045);
  const z = f < 0.35 ? -g * p : -p * (1 - sm((f - 0.35) / 0.6));
  return { g, dx: -2.4 * inn, dz: z };
}
function draw() {
  const f = c - Math.floor(c), n = D.N0 + Math.floor(c), cl = claw(f), cont = c * p, played = (D.N0 + c) * p;
  const rf = packR((D.FRAMES - D.N0 - c) * p), rt = packR(played);
  const r1 = D.SR + 0.15, r2 = 3.15;
  const [t1, t2] = left(D.FEED, rf, D.UP, r1), [t3, t4] = left(D.ROLL, r2, D.TAKE, rt);
  const a2 = Math.atan2(t2[1] - D.UP[1], t2[0] - D.UP[0]), a3 = Math.atan2(t3[1] - D.ROLL[1], t3[0] - D.ROLL[0]);
  const B = [D.UP[0], D.UP[1] - r1], G1 = [40, 66], G2 = [40, 34], LB = [D.LO[0], D.LO[1] - r1], RB = [D.ROLL[0], D.ROLL[1] - r2];
  const cu = 13 + 3 * (f - cl.g), cw = 13 + 3 * (cl.g - f);
  const parts = [[t1], arc(D.UP, r1, (a2 + TAU) % TAU, 1.5 * Math.PI), bez(B, [B[0] + cu, B[1]], [G1[0], G1[1] + cu], G1).slice(1), [G2], bez(G2, [G2[0], G2[1] - cw], [LB[0] + cw, LB[1]], LB).slice(1), arc(D.ROLL, r2, 1.5 * Math.PI, (a3 + TAU) % TAU).slice(0), [t4]];
  const pts = [], marks = [];
  for (const part of parts) { for (const q of part) pts.push(q); marks.push(pts.length - 1); }
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const sB = s[marks[1]], sG1 = s[marks[2]], sG2 = s[marks[3]], sLB = s[marks[4]], total = s[s.length - 1];
  let j = 0;
  const along = (u) => { if (u < s[j]) j = 0; while (j < s.length - 2 && s[j + 1] < u) j++; const w = (u - s[j]) / (s[j + 1] - s[j] || 1), a = pts[j], b = pts[j + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [[a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w], [(b[0] - a[0]) / l, (b[1] - a[1]) / l]]; };
  const rib = pts.map((q) => [q[0], 14, q[1]]).concat(pts.slice().reverse().map((q) => [q[0], 6, q[1]]));
  let perfs = "", frames = "";
  const mark = (u) => {
    const [q, t] = along(u), e = (a, y) => [q[0] + t[0] * a, y, q[1] + t[1] * a];
    perfs += path([e(-0.32, 12.34), e(0.32, 12.34), e(0.32, 13.26), e(-0.32, 13.26)], true);
    const [m, tm] = along(Math.min(total, u + p / 2)), em = (a, y) => [m[0] + tm[0] * a, y, m[1] + tm[1] * a];
    if (u + p / 2 < total) frames += path([em(-1.8, 7.1), em(1.8, 7.1), em(1.8, 12.1), em(-1.8, 12.1)], true);
  };
  const fc = c - Math.floor(c);
  for (let u = sB + fc * p - Math.ceil(sB / p) * p; u < sG1 - 0.5; u += p) if (u > 0.5) mark(u);
  for (let u = sG1 + 24.5 + cl.g * p - Math.ceil(24.5 / p) * p; u < sG2 - 0.5; u += p) if (u > sG1 + 0.5) mark(u);
  for (let u = sLB + fc * p - Math.ceil((sLB - sG2) / p) * p; u < total - 0.5; u += p) if (u > sG2 + 0.5) mark(u);
  const gate = path([[40.05, 7.4, 50.1], [40.05, 12.6, 50.1], [40.05, 12.6, 53.9], [40.05, 7.4, 53.9]], true);
  $("film").innerHTML = '<path class="pj-film" d="' + path(rib, true) + '"/><path class="pj-perf" d="' + perfs + '"/><path class="iso-line" data-tone="faint" d="' + frames + '"/><path class="pj-glow" d="' + gate + '"/>';
  const reel = (cx, r, th) => {
    const backF = face(path(circ(cx, D.REEL, 4.6), true), 1, "lo");
    const pack = '<path class="pj-pack" fill-rule="evenodd" d="' + path(circ(cx, r, 14), true) + path(circ(cx, D.CORE, 14, TAU, 0), true) + '"/>' + '<path class="iso-line" data-tone="faint" d="' + [0.35, 0.7].map((w) => path(circ(cx, D.CORE + (r - D.CORE) * w, 14), true)).join("") + '"/>';
    const hub = face(path(circ(cx, D.CORE, 14), true), 2, "lo");
    let win = "";
    for (let i = 0; i < 3; i++) { const a = th + (i * TAU) / 3; win += path(circ(cx, 38, 15.4, a - 0.55, a + 0.55, 14).concat(circ(cx, 17, 15.4, a + 0.5, a - 0.5, 8)), true); }
    return [backF + pack + hub, face(path(circ(cx, D.REEL, 15.4), true) + win, 2, "mid") + '<path class="iso-line" data-tone="faint" d="' + path(circ(cx, 42.4, 15.4), true) + '"/>'];
  };
  const A = reel(D.FEED, rf, thF), T = reel(D.TAKE, rt, thT);
  $("reels").innerHTML = A[0] + T[0];
  $("flanges").innerHTML = A[1] + T[1];
  let teeth = "";
  for (const [cx, dir] of [[D.UP, 1], [D.LO, -1]]) for (let i = 0; i < 12; i++) {
    const a = (dir * cont) / D.SR + (i * TAU) / 12, nx = Math.cos(a), nz = Math.sin(a), vis = nx * D.V[0] + nz * D.V[2];
    if (vis > 0.08) { const q = iso([cx[0] + (D.SR + 0.45) * nx, 12.8, cx[1] + (D.SR + 0.45) * nz], P); teeth += '<circle cx="' + q[0].toFixed(2) + '" cy="' + q[1].toFixed(2) + '" r=".55" opacity="' + Math.min(1, vis * 3).toFixed(2) + '"/>'; }
  }
  $("teeth").innerHTML = '<g class="iso-dots" data-tone="hi">' + teeth + "</g>";
  $("claw").setAttribute("transform", translateAlong(P, [cl.dx, 0, cl.dz]));
  const pa = TAU * f + 1.2, pin = [56 + 2.6 * Math.cos(pa), 11.2, 32 + 2.6 * Math.sin(pa)];
  $("pin").innerHTML = wireSvg(iso(pin, P), iso([52.8 + cl.dx, 12.4, 36 + cl.dz], P), { tone: "mid", size: 0.9 });
  const beta = TAU * f + Math.PI / 2 - TAU * 0.16;
  let blades = "";
  for (const b of [beta, beta + Math.PI]) blades += path(Array.from({ length: 15 }, (_, i) => { const a = b - 0.87 + (1.74 * i) / 14; return [34.5, 10 + 9 * Math.cos(a), 45 + 9 * Math.sin(a)]; }).concat([[34.5, 10 + 2.2 * Math.cos(b + 0.87), 45 + 2.2 * Math.sin(b + 0.87)], [34.5, 10 + 2.2 * Math.cos(b - 0.87), 45 + 2.2 * Math.sin(b - 0.87)]]), true);
  $("shutter").innerHTML = face(blades, 1, "mid");
  const dist = Math.min(...[beta, beta + Math.PI].map((b) => Math.abs(((b - Math.PI / 2) % TAU + TAU + Math.PI) % TAU - Math.PI)));
  const open = sm((dist - 0.87 + 0.36) / 0.72), w = sm((12 - rate) / 8);
  stage.style.setProperty("--lamp", (lamp * (w * open + (1 - w) * 0.5)).toFixed(3));
  for (const [name, [y, z]] of Object.entries(D.KNOBS)) {
    const a = name === "sw" ? D.ANG.sw[run ? 1 : 0] : D.ANG.fps[speed], e = (r, b) => [60 + 5.82, y + r * Math.cos(b + Math.PI / 2), z + r * Math.sin(b + Math.PI / 2)];
    stage.querySelector('[data-part="' + name + '"]').setAttribute("d", path([e(1.2, a + Math.PI), e(4.2, a)]));
  }
  const tt = Math.floor(n / 24), text = (run ? FPS[speed] + " fps" + (FPS[speed] < 24 ? " (slowed " + 24 / FPS[speed] + "×)" : "") : "stopped") + " · frame " + n.toLocaleString("en-US") + " · " + Math.floor(tt / 60) + ":" + String(tt % 60).padStart(2, "0") + " of 11:06";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(t) {
  const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60, calm = still.matches;
  last = t; now += dt;
  if (!calm && now - touched > 7 && !inch) { tour = true; run = true; speed = (now % 22) < 15 ? 1 : 3; }
  const goal = run ? FPS[speed] : 0;
  rate = calm ? goal : rate + (goal - rate) * (1 - Math.exp(-dt / 0.35));
  lamp = calm ? +run : lamp + (+run - lamp) * (1 - Math.exp(-dt / 0.25));
  let step = rate * dt;
  if (inch !== null) { const d = inch - c; step = calm ? d : d * (1 - Math.exp(-dt / 0.12)); if (Math.abs(d - step) < 1e-3) { step = d; inch = null; } }
  c += step;
  const ds = step * p;
  thF += ds / packR((D.FRAMES - D.N0 - c) * p); thT -= ds / packR((D.N0 + c) * p);
  draw();
  const busy = run || inch !== null || Math.abs(rate) > 1e-3 || lamp > 1e-3 || (!calm && !tour);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const go = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const touch = () => { if (tour) { tour = false; run = false; } touched = now; go(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "80px 0px" }).observe(stage);
const act = (what) => {
  touch();
  if (what === "sw") run = !run;
  else if (what === "fps") speed = (speed + 1) % 4;
  else if (what === "inch" && !run) inch = Math.floor((inch ?? c) + 1e-6) + 1;
  go();
};
stage.addEventListener("pointerdown", (e) => { const hit = e.target.closest("[data-hit]")?.dataset.hit; if (hit) act(hit); });
stage.addEventListener("keydown", (e) => {
  const key = e.key;
  if (key === " " || key === "Enter") act("sw");
  else if (key === "ArrowUp") { touch(); speed = Math.min(3, speed + 1); }
  else if (key === "ArrowDown") { touch(); speed = Math.max(0, speed - 1); }
  else if (key === "ArrowRight") act("inch");
  else return;
  e.preventDefault();
});
draw();
`;

const body = CSS + k.plateHtml({
  fig: "Fig 10",
  title: "Film projector",
  hint: "Space run · ↑↓ speed · → one frame",
  readout: "stopped · frame 4,800 · 3:20 of 11:06",
  keys: [
    { mark: "lit", label: "Claw: pulls the film down one frame, then lets go" },
    { mark: "raised", label: "Sprockets: feed the film at a steady 18.3 cm/s" },
    { mark: "flat", label: "Loops: take up the difference between steady and stop-go" },
  ],
  caption: "A 16 mm projector threaded with a 400 ft reel: 16,000 frames, 40 to the foot, 11 minutes at 24 frames a second. The sprockets pull film off the front reel at a steady 18.3 cm/s, but in the gate each frame must stand still to be shown. The claw enters a perforation, pulls the film down one 7.62 mm pitch in about a quarter of each cycle and withdraws, while one shutter blade covers the lens; the second blade interrupts the light once more mid-frame, so the picture flickers at 48 Hz instead of 24. The loops above and below the gate grow and shrink by one frame to absorb the stop-go motion. The reels turn at the speed the film sets for their pack radius, so the take-up speeds up less as it fills. Slow speeds are shown slowed down; the readout says by how much.",
  body: `<div class="iso-stage pj-stage" tabindex="0" role="group" aria-label="Film projector. Space starts and stops it, up and down arrows set the speed from 1 to 24 frames a second, right arrow advances one frame while stopped.">${svg}</div>`,
});
const name = THEME === "light" ? "projector-light.html" : "projector.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Film projector", theme: THEME, body, script: kitScript() + live }));
console.log("wrote", name);
