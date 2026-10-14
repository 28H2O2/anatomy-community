import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { C, HEAD, LIVE_FUNCTIONS, buildWell, dispenser, collector, beam, recoater, scanHead, section, hatch } from "./draw.mjs";
import { DEFAULTS, RANGES, MATERIAL, meltPool } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 720;
const HEIGHT = 690;

const BASE = { x: 200, y: 40, w: 420, d: 620, r: 6 };
const P = k.fitProjection(
  [...k.boxCorners(BASE, 0, 30), [200, 40, 554], [330, 60, 640], [592, 472, 626], [620, 40, 554], [200, 660, 540]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 45 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const faceX = (x, y0, y1, z0, z1) => k.pathOf([at([x, y0, z0]), at([x, y1, z0]), at([x, y1, z1]), at([x, y0, z1])], true);
const faceY = (y, x0, x1, z0, z1) => k.pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, 0, 30, P)}"/>`];
  for (const [x, y] of k.corners(BASE, 26)) out.push(S(k.cylinder(x, y, 12, 0, 8, P, 28), { tone: "lo" }));
  out.push(S(k.slabOf(BASE, 8, 22, P, 6, 1.2), { tone: "lo" }));
  out.push(S(k.slabOf({ x: 450, y: 660, w: 130, d: 1.4, r: 0.4 }, 12, 14, P, 2), { tone: "mid", crease: "none" }));
  out.push(L([[456, 22.5, 0.8], [456, 19, 0.55], [456, 15.5, 0.7]].map(([x, z, share]) => k.segment([x, 661.4, z], [x + 118 * share, 661.4, z], P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([576, 661.4, 19]), at([454, 661.4, 19])], { size: 0.45 }));
  return out.join("");
}

function walls() {
  const out = [];
  const seamsX = [200, 380, 560].map((y) => k.segment([212, y, 30], [212, y, 540], P)).join("");
  out.push(S(k.slabOf({ x: 200, y: 40, w: 12, d: 620, r: 0 }, 30, 510, P, 2, 0.6), { tone: "mid", inner: L(seamsX, { tone: "faint" }) }));
  const seamsY = [330, 460].map((x) => k.segment([x, 52, 30], [x, 52, 540], P)).join("");
  out.push(S(k.slabOf({ x: 212, y: 40, w: 408, d: 12, r: 0 }, 30, 510, P, 2, 0.6), { tone: "mid", inner: L(seamsY, { tone: "faint" }) }));
  out.push(D([at([212, 60, 530]), at([212, 640, 530]), at([222, 52, 530]), at([610, 52, 530])], { size: 0.5 }));
  return out.join("");
}

function upper() {
  const out = [];
  out.push(S(k.slabOf({ x: 212, y: 52, w: 408, d: 210, r: 0 }, 540, 14, P, 2, 0.8), { tone: "mid" }));
  out.push(D(k.corners({ x: 212, y: 52, w: 408, d: 210 }, 10).map(([x, y]) => at([x, y, 554])), { size: 0.5 }));
  const laser = { x: 212, y: 60, w: 86, d: 162, r: 3 };
  const vents = [];
  for (let y = 76; y <= 132; y += 7) vents.push(k.segment([298, y, 566], [298, y, 636], P));
  out.push(S(k.slabOf(laser, 554, 94, P, 3, 1.2), { tone: "mid", inner: L(faceX(298, 70, 138, 566, 636), { tone: "lo" }) + L(vents.join(""), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: 222, y: 222, w: 66, d: 1.2, r: 0.3 }, 600, 30, P, 2), { tone: "mid", crease: "none" }));
  out.push(L([[622, 0.85], [614, 0.6], [606, 0.72]].map(([z, share]) => k.segment([227, 223.2, z], [227 + 56 * share, 223.2, z], P)).join(""), { tone: "lo", free: true }));
  out.push(`<circle class="m-led" cx="${at([298, 196, 630])[0].toFixed(1)}" cy="${at([298, 196, 630])[1].toFixed(1)}" r="2.2"/>`);
  out.push(S(k.slabOf({ x: 298, y: 134, w: 6, d: 12, r: 1 }, 606, 12, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function liners() {
  const out = [];
  out.push(S(k.slabOf({ x: 312, y: 94, w: 8, d: 516, r: 0 }, 30, 175, P, 2), { tone: "lo" }));
  for (const y of [94, 264, 534]) out.push(S(k.slabOf({ x: 320, y, w: 250, d: 6, r: 0 }, 30, 175, P, 2), { tone: "lo" }));
  return out.join("");
}

const deck = (plan) => S(k.slabOf({ ...plan, r: 0 }, 205, 15, P, 2, 0.6), { tone: "mid" });

function backDeck() {
  const out = [deck({ x: 212, y: 52, w: 108, d: 608 })];
  out.push(D([[220, 64], [220, 648], [312, 64], [312, 648]].map(([x, y]) => at([x, y, 220])), { size: 0.5 }));
  out.push(S(k.slabOf({ x: 282, y: 78, w: 24, d: 556, r: 1 }, 220, 12, P, 2, 0.5), { tone: "mid" }));
  out.push(D([90, 360, 620].map((y) => at([294, y, 232])), { size: 0.45 }));
  const strip = { x: 260, y: 96, w: 12, d: 520, r: 0.5 };
  out.push(S(k.slabOf(strip, 220, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 10, 5, strip.x + 0.6, 220.6, [3, 6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const nozzle = { x: 212, y: 275, w: 34, d: 240, r: 1 };
  const grid = [];
  for (let y = 290; y <= 500; y += 30) grid.push(k.segment([246, y, 226], [246, y, 258], P));
  out.push(S(k.slabOf({ x: 212, y: 370, w: 22, d: 50, r: 1 }, 262, 40, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(nozzle, 220, 42, P, 2, 0.6), { tone: "mid", inner: L(faceX(246, 280, 510, 226, 258), { tone: "lo" }) + L(grid.join(""), { tone: "lo" }) }));
  return out.join("");
}

function frontParts() {
  const out = [];
  out.push(deck({ x: 320, y: 610, w: 250, d: 50 }));
  out.push(D([[332, 648], [558, 648]].map(([x, y]) => at([x, y, 220])), { size: 0.5 }));
  for (const [x, y] of [[600, 67], [600, 645]]) out.push(S(k.cylinder(x, y, 9, 30, 175, P, 24), { tone: "mid", inner: L(k.sideArc(x, y, 9, 50, P, 16) + k.sideArc(x, y, 9, 185, P, 16), { tone: "faint" }) }));
  out.push(deck({ x: 570, y: 52, w: 44, d: 608 }));
  out.push(D([[578, 64], [606, 64], [578, 648], [606, 648]].map(([x, y]) => at([x, y, 220])), { size: 0.5 }));
  return out.join("");
}

function flow() {
  const lines = [];
  for (let y = 290; y <= 500; y += 30) lines.push(k.segment([246, y, 238], [578, y, 238], P));
  return L(lines.join(""), { tone: "mid", flow: true });
}

const hatchY = (y, x0, x1, z0, z1) => {
  const out = [];
  for (let t = z0 - (x1 - x0); t < z1; t += 4) {
    const a = Math.max(0, z0 - t), b = Math.min(x1 - x0, z1 - t);
    if (b - a > 0.6) out.push(k.segment([x0 + a, y, t + a], [x0 + b, y, t + b], P));
  }
  return out.join("");
};
const hatchX = (x, y0, y1, z0, z1) => {
  const out = [];
  for (let t = z0 - (y1 - y0); t < z1; t += 4) {
    const a = Math.max(0, z0 - t), b = Math.min(y1 - y0, z1 - t);
    if (b - a > 0.6) out.push(k.segment([x, y0 + a, t + a], [x, y0 + b, t + b], P));
  }
  return out.join("");
};

function fibre() {
  const ends = [[304, 140, 612], [330, 140, 656], [358, 152, 646], [360, 162, 604]];
  const points = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, u = 1 - t;
    points.push([0, 1, 2].map((axis) => u ** 3 * ends[0][axis] + 3 * u * u * t * ends[1][axis] + 3 * u * t * t * ends[2][axis] + t ** 3 * ends[3][axis]));
  }
  return tubePieces(points, 3.4, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}

function optics() {
  const out = [];
  out.push(S(k.cylinder(C.lens[0], C.lens[1], 22, 470, 84, P, 40), { tone: "hi", inner: L(k.sideArc(C.lens[0], C.lens[1], 22, 492, P, 24) + k.sideArc(C.lens[0], C.lens[1], 22, 532, P, 24), { tone: "faint" }) }));
  const floor = { x: 300, y: 150, w: 292, d: 322, r: 0 };
  out.push(S(k.slabOf(floor, 554, 8, P, 2, 1), { tone: "mid" }));
  out.push(D([[580, 462], [580, 166], [316, 462]].map(([x, y]) => at([x, y, HEAD.floor])), { size: 0.5 }));
  out.push(S(k.slabOf({ x: 300, y: 150, w: 292, d: 8, r: 0 }, HEAD.floor, 68, P, 2, 0.5), { tone: "mid", inner: L(hatchX(592, 150, 158, HEAD.floor, 630), { tone: "lo" }) }));
  out.push(S(k.slabOf({ x: 300, y: 158, w: 8, d: 314, r: 0 }, HEAD.floor, 68, P, 2, 0.5), { tone: "mid", inner: L(hatchY(472, 300, 308, HEAD.floor, 630), { tone: "lo" }) }));
  const vents = [];
  for (let x = 512; x <= 576; x += 6) vents.push(k.segment([x, 252, 570], [x, 252, 600], P));
  out.push(S(k.slabOf({ x: 500, y: 166, w: 84, d: 86, r: 1 }, HEAD.floor, 46, P, 2, 0.8), { tone: "mid", inner: L(faceY(252, 506, 582, 570, 600), { tone: "lo" }) + L(vents.join(""), { tone: "faint" }) }));
  out.push(fibre());
  out.push(S(G.disc(-6, 0, 6, G.frameAlong([360, 168, 604], [0, 1, 0]), P), { tone: "mid" }));
  out.push(S(G.disc(0, 82, 13, G.frameAlong([360, 168, 604], [0, 1, 0]), P), { tone: "hi", lit: true, inner: L(G.arcOf(G.frameAlong([360, 168, 604], [0, 1, 0]), 20, 13, P) + G.arcOf(G.frameAlong([360, 168, 604], [0, 1, 0]), 62, 13, P), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: 352, y: 186, w: 16, d: 20, r: 1 }, HEAD.floor, 29, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 352, y: 226, w: 16, d: 20, r: 1 }, HEAD.floor, 29, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 380, y: 188, w: 28, d: 26, r: 1 }, HEAD.floor, 34, P, 2, 0.5), { tone: "mid" }));
  out.push(S(G.disc(0, 26, 8, G.frameAlong([348, 274, 604], [-1, 0, 0]), P), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 348, y: 262, w: 24, d: 24, r: 0.5 }, 592, 24, P, 2, 0.6), { tone: "hi", lit: true, inner: L(k.segment([372, 262, 592], [372, 286, 616], P), { tone: "hi" }) }));
  out.push(S(k.slabOf({ x: 350, y: 264, w: 20, d: 20, r: 0.5 }, HEAD.floor, 30, P, 2), { tone: "mid" }));
  return out.join("");
}

const headParts = {
  galvoX:
    S(k.cylinder(HEAD.mirrorX[0], HEAD.mirrorX[1], 12, HEAD.floor, 32, P, 32, 0.5), { tone: "mid", inner: L(k.knurl(HEAD.mirrorX[0], HEAD.mirrorX[1], 12, HEAD.floor, HEAD.floor + 32, 14, P), { tone: "faint" }) }) +
    S(k.cylinder(HEAD.mirrorX[0], HEAD.mirrorX[1], 2.6, HEAD.floor + 32, 4, P, 16), { tone: "mid" }),
  galvoY:
    S(k.slabOf({ x: 400, y: 385, w: 28, d: 20, r: 1 }, HEAD.floor, 31, P, 2, 0.4), { tone: "mid" }) +
    S(G.disc(0, 28, 11, G.frameAlong([400, 395, 604], [1, 0, 0]), P), { tone: "mid", inner: L(G.arcOf(G.frameAlong([400, 395, 604], [1, 0, 0]), 9, 11, P) + G.arcOf(G.frameAlong([400, 395, 604], [1, 0, 0]), 19, 11, P), { tone: "faint" }) }) +
    S(G.disc(28, 32, 2.6, G.frameAlong([400, 395, 604], [1, 0, 0]), P), { tone: "mid" }),
  ftheta: S(k.cylinder(445, 395, 26, HEAD.floor, 28, P, 48, 0.6), { tone: "hi", lit: true, inner: L(k.sideArc(445, 395, 26, 572, P, 32) + k.sideArc(445, 395, 26, 582, P, 32), { tone: "faint" }) }) + L(k.ring(445, 395, 17, 590, P, 40), { tone: "lo" }),
};

function headFront() {
  return "";
}

function hood() {
  const out = [];
  const slots = [];
  for (let y = 284; y <= 506; y += 10) slots.push(k.lineOnTop([584, y], [604, y], 246, P));
  out.push(S(k.slabOf({ x: 578, y: 262, w: 32, d: 266, r: 1 }, 220, 26, P, 2, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline({ x: 584, y: 278, w: 20, d: 234, r: 0 }, 246, P, 2), { tone: "lo" }));
  out.push(L(slots.join(""), { tone: "faint" }));
  return out.join("");
}

const r0 = meltPool(DEFAULTS.P, DEFAULTS.v, DEFAULTS.h);
const startHb = 40;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A cut-away EOS M 290 metal 3D printer. On top sit the fibre laser and the scanner head with its F-theta lens. Below, inside the argon chamber, a recoater blade spreads powder from the dispenser well across the build well, and the laser melts one layer of the part at a time while the build platform drops one layer after each pass. Argon flows across the bed from the inlet nozzle to the outlet hood.",
  body: [
    base(),
    walls(),
    upper(),
    liners(),
    backDeck(),
    deck({ x: 320, y: 52, w: 250, d: 48 }),
    `<g data-part="dispenser">${dispenser(P, C.stock - startHb)}</g>`,
    deck({ x: 320, y: 255, w: 250, d: 15 }),
    `<g data-part="build">${buildWell(P, startHb, [], [], null, startHb - C.layer)}</g>`,
    deck({ x: 320, y: 520, w: 250, d: 20 }),
    `<g data-part="collector">${collector(P, 30)}</g>`,
    frontParts(),
    flow(),
    `<g data-part="recoater" transform="${k.translateAlong(P, [0, C.recoatFrom, 0])}">${recoater(P)}</g>`,
    `<g data-part="beam">${beam(P, [C.centre[0] + 10, C.centre[1] - 8], true, r0.width, r0.ke)}</g>`,
    optics(),
    `<g data-part="head">${scanHead(P, [C.centre[0] + 10, C.centre[1] - 8], true, headParts)}</g>`,
    headFront(),
    hood(),
  ],
});

const controls = ["P", "v", "h"]
  .map((key) => {
    const [lo, hi, step] = RANGES[key];
    const name = { P: "Laser power", v: "Scan speed", h: "Hatch distance" }[key];
    const unit = { P: "W", v: "mm/s", h: "mm" }[key];
    const value = DEFAULTS[key];
    return `<label class="m-control"><span class="m-name">${name}</span><input type="range" id="m-${key}" min="${lo}" max="${hi}" step="${step}" value="${value}"><output id="m-${key}-out">${key === "h" ? value.toFixed(3) : value} ${unit}</output></label>`;
  })
  .join("");

const style = `<style>
.m-powder{opacity:.5}
.m-track{fill:var(--anatomy-hi);fill-opacity:.3;stroke:none}
.m-hot{fill:var(--anatomy-red);fill-opacity:.75;stroke:none}
.m-cone{fill:var(--anatomy-lit);fill-opacity:.07;stroke:none}
.m-glow{fill:var(--anatomy-red);fill-opacity:.35;stroke:none}
.m-pool{fill:var(--anatomy-lit);stroke:var(--anatomy-red);stroke-width:.6}
.m-spark{fill:var(--anatomy-red);stroke:none}
.m-pore{stroke:none}
.m-led{fill:var(--anatomy-red)}
.m-solid .m-powder{opacity:1}
.m-solid .m-pore{display:none}
.m-xray{position:absolute;top:44px;right:24px;display:flex;gap:6px;align-items:center;font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-muted);cursor:pointer;z-index:1}
.m-xray input{accent-color:var(--anatomy-strong);margin:0}
.m-mirror{fill:var(--anatomy-lit-shade);stroke:var(--anatomy-hi);stroke-width:.8;stroke-linejoin:round}
.m-pore[data-kind="kh"]{fill:var(--anatomy-red)}
.m-pore[data-kind="lof"]{fill:var(--anatomy-blue)}
[data-part]{transition:opacity .35s ease}
.m-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px 18px;padding:4px 20px 18px}
.m-control{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:12px;color:var(--anatomy-text);align-items:center}
.m-control input{grid-column:1/-1;width:100%;accent-color:var(--anatomy-strong)}
.m-control output{font-family:var(--anatomy-mono);color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.m-name{color:var(--anatomy-strong)}
.m-progress{display:flex;align-items:center;gap:12px;padding:6px 20px 14px;font-family:var(--anatomy-mono);font-size:11px;color:var(--anatomy-muted);font-variant-numeric:tabular-nums}
.m-bar{flex:1;height:4px;background:var(--anatomy-faint);border-radius:2px;overflow:hidden}
.m-bar span{display:block;height:100%;width:0;background:var(--anatomy-strong);transition:width .3s ease}
#m-progress-text{white-space:nowrap}
.m-verdict{padding:0 20px 18px;font-size:12px;color:var(--anatomy-muted);font-family:var(--anatomy-mono)}
.m-verdict b{color:var(--anatomy-strong);font-weight:500}
</style>`;

const readoutOf = (r) => `pool ${r.width.toFixed(0)} × ${r.depth.toFixed(0)} µm · ${r.regime} · ${(100 - r.porosity).toFixed(2)} % dense`;
const verdictOf = (r) => `Keyhole number <b>${r.ke.toFixed(2)}</b> · overlap (h/W)²+(t/D)² <b>${r.overlap.toFixed(2)}</b> · Eᵥ <b>${r.energy.toFixed(1)}</b> J/mm³ · build rate <b>${r.rate.toFixed(1)}</b> mm³/s`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "EOS M 290, cut away",
  hint: "Set power, speed and hatch below",
  readout: readoutOf(r0),
  keys: [
    { mark: "lit", label: "Part and laser" },
    { mark: "red", label: "Melt pool, keyhole pores" },
    { mark: "blue", label: "Lack-of-fusion pores" },
    { mark: "dashed", label: "Argon flow over the bed" },
  ],
  caption:
    "Laser powder bed fusion in nickel alloy IN718, 40 µm layers, 100 µm spot, plate at 80 °C. The pool width comes from a Rosenthal moving heat source, keyholing from King et al.'s normalised enthalpy, and lack of fusion from the Tang–Pistorius–Beuth overlap rule; porosity is fitted to NIST's EOS M 290 runs (about 1.9 % at 195 W and 1400 mm/s, 0.2 % at 370 W and 700 mm/s). Tracks are drawn W wide and h apart, so gaps between them are lack of fusion.",
  body: `${style}<label class="m-xray"><input type="checkbox" id="m-xray" checked> X-ray powder</label><div class="iso-stage">${svg}</div><div class="m-progress"><div class="m-bar" role="progressbar" aria-label="Build progress" aria-valuemin="0" aria-valuemax="100" id="m-bar"><span id="m-bar-fill"></span></div><span id="m-progress-text">Build ${Math.round(((startHb - C.layer) / C.hMax) * 100)} % · layer ${(startHb - C.layer) / C.layer} of ${C.hMax / C.layer}</span></div><div class="m-controls">${controls}</div><p class="m-verdict" id="m-verdict">${verdictOf(r0)}</p>`,
});

const live = `
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const HEAD = ${JSON.stringify(HEAD)};
const HEAD_PARTS = ${JSON.stringify(headParts)};
const DEFAULTS = ${JSON.stringify(DEFAULTS)};
const MATERIAL = ${JSON.stringify(MATERIAL)};
${meltPool.toString()}
${LIVE_FUNCTIONS.map((fn) => fn.toString()).join("\n")}
const readoutOf = ${readoutOf.toString()};
const verdictOf = ${verdictOf.toString()};
const svg = document.querySelector(".iso-stage svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const groups = { build: part("build"), dispenser: part("dispenser"), collector: part("collector"), recoater: part("recoater"), beam: part("beam"), head: part("head") };
const readout = document.querySelector("[data-readout]");
const verdict = document.getElementById("m-verdict");
const progressText = document.getElementById("m-progress-text"), progressFill = document.getElementById("m-bar-fill"), progressBar = document.getElementById("m-bar");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const inputs = { P: document.getElementById("m-P"), v: document.getElementById("m-v"), h: document.getElementById("m-h") };
const outputs = { P: document.getElementById("m-P-out"), v: document.getElementById("m-v-out"), h: document.getElementById("m-h-out") };
const params = { ...DEFAULTS };
let model = meltPool(params.P, params.v, params.h);
let seed = 12345;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const state = { hb: ${startHb}, stock: C.stock - ${startHb}, fill: 30, layer: ${startHb / 4}, phase: "expose", t: 0, ry: C.recoatFrom, lift: 0, plan: null, done: [], pores: [] };
function planLayer() {
  const spacing = Math.min(16, Math.max(3, 7 * params.h / 0.11));
  const half = Math.max(0.6, (model.width / (params.h * 1000)) * spacing / 2);
  const shape = section(state.hb - C.layer / 2);
  const contour = shape.map((point, i) => ({ a: point, b: shape[(i + 1) % shape.length], half: Math.max(0.6, half * 0.7) }));
  const infill = hatch(shape, ((state.layer * 67) % 180) * Math.PI / 180, spacing, half);
  state.plan = contour.concat(infill);
  let total = 0;
  state.cum = state.plan.map((line) => (total += Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1])));
  state.total = total || 1;
}
function exposureTime() { return Math.min(9, Math.max(1.4, 3.6 * 960 / params.v)); }
function addPores() {
  const expected = model.porosity * 1.6;
  let count = Math.floor(expected) + (random() < expected % 1 ? 1 : 0);
  const share = model.keyhole / Math.max(1e-6, model.keyhole + model.lackOfFusion);
  for (let i = 0; i < Math.min(count, 6); i++) {
    const kind = random() < share ? "kh" : "lof";
    const shape = section(state.hb - 2);
    let x = C.centre[0], y = C.centre[1];
    for (let tries = 0; tries < 40; tries++) { const px = C.centre[0] - 55 + random() * 110, py = C.centre[1] - 55 + random() * 110; if (inside([px, py], shape)) { x = px; y = py; break; } }
    state.pores.push({ x, y, rel: state.hb - 2 - random() * 2, kind, r: kind === "kh" ? 1.2 : 0.8 + random() * 0.9 });
  }
  if (state.pores.length > 220) state.pores.splice(0, state.pores.length - 220);
}
function spotAt(progress) {
  const lines = state.plan, target = progress * state.total;
  let index = state.cum.findIndex((value) => value >= target);
  if (index < 0) index = lines.length - 1;
  const start = index ? state.cum[index - 1] : 0;
  const length = state.cum[index] - start || 1;
  const local = Math.min(1, Math.max(0, (target - start) / length));
  const line = lines[index];
  return { index, local, point: [line.a[0] + (line.b[0] - line.a[0]) * local, line.a[1] + (line.b[1] - line.a[1]) * local] };
}
function draw() {
  const zp = C.bed - state.hb;
  const pores = state.pores.map((pore) => ({ ...pore, z: zp + pore.rel }));
  let tracks = [], flash = null, spot = null;
  if (state.phase === "expose" && state.plan) {
    const progress = Math.min(1, state.t / exposureTime());
    const at = spotAt(progress);
    tracks = state.plan.slice(0, at.index);
    const line = state.plan[at.index];
    const tail = Math.max(0, at.local - 0.18);
    tracks.push({ a: line.a, b: at.point, half: line.half });
    flash = { a: [line.a[0] + (line.b[0] - line.a[0]) * tail, line.a[1] + (line.b[1] - line.a[1]) * tail], b: at.point, half: line.half };
    spot = at.point;
  } else if ((state.phase === "lower" || state.phase === "recoat") && state.lastPlan) {
    const edge = state.phase === "lower" ? -Infinity : state.ry;
    for (const line of state.lastPlan) {
      const ya = line.a[1], yb = line.b[1];
      if (ya < edge && yb < edge) continue;
      if (ya >= edge && yb >= edge) { tracks.push(line); continue; }
      const t = (edge - ya) / (yb - ya);
      const cut = [line.a[0] + (line.b[0] - line.a[0]) * t, edge];
      tracks.push(ya >= edge ? { a: line.a, b: cut, half: line.half } : { a: cut, b: line.b, half: line.half });
    }
  }
  const fused = state.phase === "lower" ? state.from.hb : state.phase === "reset" ? state.hb : state.hb - C.layer;
  groups.build.innerHTML = buildWell(P, state.hb, tracks, pores, flash, Math.max(0, fused));
  groups.dispenser.innerHTML = dispenser(P, state.stock);
  groups.collector.innerHTML = collector(P, state.fill);
  groups.recoater.setAttribute("transform", translateAlong(P, [0, state.ry, state.lift]));
  groups.beam.innerHTML = spot ? beam(P, spot, true, model.width, model.ke) : "";
  groups.head.innerHTML = scanHead(P, spot, !!spot, HEAD_PARTS);
  const layers = C.hMax / C.layer;
  const done = state.phase === "reset" ? layers : Math.max(0, Math.round(fused / C.layer));
  const share = Math.round((done / layers) * 100);
  const label = state.phase === "reset" || done >= layers ? "Build complete · starting a new build" : "Build " + share + " % · layer " + done + " of " + layers;
  if (progressText.textContent !== label) progressText.textContent = label;
  if (progressFill.style.width !== share + "%") { progressFill.style.width = share + "%"; progressBar.setAttribute("aria-valuenow", String(share)); }
  const text = readoutOf(model);
  if (readout.textContent !== text) readout.textContent = text;
}
function advance(dt) {
  state.t += dt;
  if (state.phase === "expose") {
    if (state.t >= exposureTime()) { addPores(); state.lastPlan = state.plan; state.phase = "lower"; state.t = 0; state.from = { hb: state.hb, stock: state.stock, fill: state.fill }; }
  } else if (state.phase === "lower") {
    const q = Math.min(1, state.t / 0.5), e = q * q * (3 - 2 * q);
    state.hb = state.from.hb + C.layer * e;
    state.stock = Math.max(20, state.from.stock - C.layer * e);
    if (q >= 1) { state.phase = "recoat"; state.t = 0; }
  } else if (state.phase === "recoat") {
    const q = Math.min(1, state.t / 1.4), e = q * q * (3 - 2 * q);
    state.ry = C.recoatFrom + (C.recoatTo - C.recoatFrom) * e;
    state.fill = state.from.fill + 2 * e;
    if (q >= 1) { state.phase = "return"; state.t = 0; }
  } else if (state.phase === "return") {
    const q = Math.min(1, state.t / 0.8), e = q * q * (3 - 2 * q);
    state.lift = 6 * Math.sin(Math.PI * q);
    state.ry = C.recoatTo + (C.recoatFrom - C.recoatTo) * e;
    if (q >= 1) {
      state.lift = 0; state.layer += 1; state.t = 0;
      if (state.hb >= C.hMax) { state.phase = "reset"; } else { state.phase = "expose"; planLayer(); }
    }
  } else if (state.phase === "reset") {
    if (state.t > 1.6 && state.t < 2.0) { for (const name of ["build", "dispenser", "collector"]) groups[name].style.opacity = "0"; }
    else if (state.t >= 2.0 && !state.cleared) { state.cleared = true; state.hb = 4; state.stock = C.stock - 4; state.fill = 30; state.pores = []; state.layer = 1; }
    if (state.t > 2.4) { for (const name of ["build", "dispenser", "collector"]) groups[name].style.opacity = ""; state.cleared = false; state.phase = "expose"; state.t = 0; planLayer(); }
  }
}
let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  advance(dt);
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function setParam(key, value) {
  params[key] = value;
  outputs[key].textContent = (key === "h" ? value.toFixed(3) : String(value)) + " " + { P: "W", v: "mm/s", h: "mm" }[key];
  model = meltPool(params.P, params.v, params.h);
  verdict.innerHTML = verdictOf(model);
  if (state.phase === "expose") {
    const progress = Math.min(1, state.t / exposureTime());
    planLayer();
    if (key === "v") state.t = progress * exposureTime();
  }
  if (still.matches || !frame) draw();
}
for (const key of Object.keys(inputs)) inputs[key].addEventListener("input", () => setParam(key, Number(inputs[key].value)));
const xray = document.getElementById("m-xray");
xray.addEventListener("change", () => { svg.classList.toggle("m-solid", !xray.checked); });
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(svg);
const built = state.hb;
for (let h = C.layer; h < built; h += C.layer) { state.hb = h; addPores(); }
state.hb = built;
planLayer();
state.t = exposureTime() * 0.55;
draw();
`;

const file = theme === "light" ? "m290-metal-3d-printer-light.html" : "m290-metal-3d-printer.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "M 290 metal 3D printer", theme, body, script: kitScript() + live, width: 760 }));
console.log("wrote", file);
