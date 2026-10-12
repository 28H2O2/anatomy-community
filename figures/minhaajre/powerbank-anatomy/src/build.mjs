import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// UGREEN Nexode PB722 (SKU 35525) — 25 000 mAh / 90 Wh / 200 W.
// Framework-free gallery figure ported from powerbank-anatomy (React).
// Lid lifted on spacer posts: shell, 5 pouch cells, thermal pad, PCB head.

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

const W = 720;
const H = 560;

// ---- live model (ported from powerbank-anatomy src/lib/powerbank.ts) ----
const CELL_MIN = 3.0;
const CELL_MAX = 4.2;
function createBank() {
  return { cellV: 3.85, cellPct: 62, outV: 0, outA: 0, tempC: 27, cycle: 0 };
}
function stepBank(s, loadA, charging, dt) {
  s.cycle += 1;
  if (charging) {
    const rate = 2.0 * dt;
    s.cellPct = Math.min(100, s.cellPct + rate * 1.4);
    s.cellV = CELL_MIN + (s.cellPct / 100) * (CELL_MAX - CELL_MIN);
    s.outV += (0 - s.outV) * Math.min(1, dt * 4);
    s.outA += (0 - s.outA) * Math.min(1, dt * 4);
    s.tempC += (34 - s.tempC) * Math.min(1, dt * 0.4);
    return "charge";
  }
  if (loadA > 0.01) {
    const drain = loadA * dt * 0.32;
    s.cellPct = Math.max(0, s.cellPct - drain);
    s.cellV = CELL_MIN + (s.cellPct / 100) * (CELL_MAX - CELL_MIN);
    const target = loadA > 4 ? 20 : loadA > 2.5 ? 12 : loadA > 1.5 ? 9 : 5.05;
    s.outV += (target - s.outV) * Math.min(1, dt * 5);
    s.outA += (loadA - s.outA) * Math.min(1, dt * 5);
    s.tempC += (27 + loadA * 3.2 - s.tempC) * Math.min(1, dt * 0.4);
    return "boost";
  }
  s.outV += (0 - s.outV) * Math.min(1, dt * 4);
  s.outA += (0 - s.outA) * Math.min(1, dt * 4);
  s.tempC += (26 - s.tempC) * Math.min(1, dt * 0.3);
  return "rest";
}
function readout(s, phase) {
  const watts = s.outV * s.outA;
  if (phase === "charge") return "IN 65 W max · cell " + s.cellV.toFixed(2) + " V · " + Math.round(s.cellPct) + "%";
  if (phase === "boost") return "OUT " + s.outV.toFixed(1) + " V " + s.outA.toFixed(1) + " A " + watts.toFixed(0) + " W · " + Math.round(s.cellPct) + "%";
  return "idle · cell " + s.cellV.toFixed(2) + " V · " + Math.round(s.cellPct) + "%";
}

// ---- geometry (ported from BankFigure geometry.ts; button moved onto the
// frame at y=46 and the PCB shortened so the USB ports stand on the frame) ----
const BENCH = { x: -12, y: -12, w: 174, d: 76, r: 3 };
const SHELL = { x: 0, y: 0, w: 150, d: 52, r: 5 };
const FRAME = { x: 3, y: 3, w: 144, d: 46, r: 4 };

const P = k.fitProjection(k.boxCorners(BENCH, -15, 40), W, H, { pad: 34, azimuth: 42, elevation: 30 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);

const R = A.recorder(P);
const record = R.solid;
function put(name, ref, svg, shapes, opts) {
  return R.put({ name, at: ref, bias: 0, svg, shapes, piece: "bank", ...(opts || {}) });
}
function slabItem(name, plan, z, h, style, opts) {
  const o = opts || {};
  const shape = record(A.slab(plan, z, h, { name }, o.steps || 4));
  const paths = k.slabOf(plan, z, h, P, o.steps || 4, o.bevel === undefined ? 0.5 : o.bevel);
  const ref = [(plan.x + plan.x + plan.w) / 2, (plan.y + plan.y + plan.d) / 2, z + h / 2];
  put(name, ref, S(paths, { tone: "mid", ...(style || {}), ...(o.inner ? { inner: o.inner } : {}) }) + (o.extra || ""), [shape], { bias: o.bias || 0 });
  return shape;
}
function cylItem(name, cx, cy, r, z, h, style, steps) {
  const shape = record(A.cylinder(cx, cy, r, z, h, { name }));
  put(name, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps || 20), { tone: "mid", ...(style || {}) }), [shape]);
  return shape;
}

// ---- bench (ground) ----
const back = [];
back.push('<path class="iso-halo" d="' + k.haloOf(BENCH, -10, 10, P) + '"/>');
for (const [fx, fy] of k.corners(BENCH, 22)) {
  cylItemStand("stand.foot", fx, fy);
}
function cylItemStand(name, cx, cy) {
  const shape = record(A.cylinder(cx, cy, 6, -15, 5, { name }));
  R.put({ name, at: [cx, cy, -12.5], bias: 0, svg: S(k.cylinder(cx, cy, 6, -15, 5, P, 24), { tone: "mid" }), shapes: [shape], piece: "stand" });
}
{
  const shape = record(A.slab(BENCH, -10, 10, { name: "stand.plate", ground: true }, 8));
  const svg = S(k.slabOf(BENCH, -10, 10, P, 8, 1.2), { tone: "mid", inner: Ln(k.sideSeam(BENCH, -4, P, 8), { tone: "faint" }) })
    + Ln(k.planOutline(BENCH, 0, P), { tone: "lo" });
  R.put({ name: "stand.plate", at: [75, 26, -5], bias: 0, svg, shapes: [shape], piece: "stand" });
}
for (const ry of [-10, 59]) {
  const rail = { x: -8, y: ry, w: 166, d: 3, r: 1 };
  const shape = record(A.slab(rail, 0, 1.5, { name: "stand.rail" }, 3));
  R.put({ name: "stand.rail", at: [75, ry + 1.5, 0.75], bias: 0, svg: S(k.slabOf(rail, 0, 1.5, P, 3, 0.4), { tone: "mid" }), shapes: [shape], piece: "stand" });
}
{
  const strip = { x: 6, y: 53, w: 138, d: 5, r: 1 };
  const shape = record(A.slab(strip, 0, 0.6, { name: "stand.strip" }, 3));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y, 0.6, [1.6, 2.0], P);
  const svg = S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" })
    + Ln(ticks.minor, { tone: "lo" }) + Ln(ticks.major, { tone: "mid" });
  R.put({ name: "stand.strip", at: [75, 55.5, 0.3], bias: 0, svg, shapes: [shape], piece: "stand" });
}
k.corners(BENCH, 10).forEach(([sx, sy], i) => {
  const shape = record(A.ball([sx, sy, 0.5], 0.5, { name: "stand.screw" }));
  R.put({
    name: "stand.screw", at: [sx, sy, 0.5], bias: 0.1,
    svg: k.dotsSvg([at([sx, sy, 0.5])], { size: 0.5 }),
    shapes: [shape], piece: "stand",
  });
});

// ---- powerbank stack ----
slabItem("bank.base", SHELL, 0, 3, { tone: "mid" }, { steps: 8, bevel: 0.6, inner: Ln(k.planOutline(SHELL, 5, P), { tone: "faint" }) });
slabItem("bank.frame", FRAME, 3, 2, { tone: "hi" }, { steps: 8 });
for (let i = 0; i < 5; i++) {
  const plan = { x: 8 + i * 19, y: 11, w: 17, d: 30, r: 2 };
  const shape = record(A.slab(plan, 5, 9, { name: "bank.cell" }, 6));
  put("bank.cell", [plan.x + plan.w / 2, plan.y + plan.d / 2, 9.5],
    '<g data-part="cell-' + i + '">' + S(k.slabOf(plan, 5, 9, P, 6, 0.5), { tone: "hi", inner: Ln(k.planOutline(plan, 14, P), { tone: "faint" }) }) + "</g>",
    [shape]);
  slabItem("bank.tab", { x: plan.x, y: 36.5, w: 17, d: 4, r: 1 }, 15.6, 0.8, { tone: "mid" }, { steps: 3, bevel: 0.2 });
}
slabItem("bank.thermal", { x: 8, y: 11, w: 95, d: 30, r: 2 }, 14, 1.6, { tone: "mid" }, { steps: 4, bevel: 0.3 });
slabItem("bank.pcb", { x: 108, y: 6, w: 36, d: 36, r: 1.5 }, 5, 2.5, { tone: "hi" }, { steps: 4 });
function litPart(name, plan, z, h, style, opts) {
  const o = opts || {};
  const shape = record(A.slab(plan, z, h, { name }, 4));
  put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2],
    '<g data-part="' + o.part + '">' + S(k.slabOf(plan, z, h, P, 4, 0.4), { tone: "mid", ...(style || {}) }) + "</g>",
    [shape]);
}
litPart("bank.boost", { x: 111, y: 9, w: 12, d: 11, r: 1 }, 7.5, 4.5, { tone: "hi" }, { part: "boost" });
slabItem("bank.mosfet", { x: 112, y: 6.5, w: 5, d: 2.4, r: 0.6 }, 7.5, 1.5, {}, { steps: 2, bevel: 0.2 });
slabItem("bank.mosfet", { x: 119, y: 6.5, w: 5, d: 2.4, r: 0.6 }, 7.5, 1.5, {}, { steps: 2, bevel: 0.2 });
{
  const shape = record(A.cylinder(141, 36.5, 2.8, 7.5, 4, { name: "bank.ind" }));
  put("bank.ind", [141, 36.5, 9.5],
    '<g data-part="ind">' + S(k.cylinder(141, 36.5, 2.8, 7.5, 4, P, 28), { tone: "mid" }) + "</g>", [shape]);
}
litPart("bank.mcu", { x: 111, y: 23, w: 12, d: 8, r: 1 }, 7.5, 2.5, {}, { part: "mcu" });
litPart("bank.pd", { x: 126, y: 23, w: 12, d: 8, r: 1 }, 7.5, 2.5, {}, { part: "pd" });
litPart("bank.disp", { x: 126, y: 9, w: 12, d: 11, r: 1 }, 7.5, 2, {}, { part: "disp" });
litPart("bank.gauge", { x: 111, y: 33, w: 10, d: 7, r: 1 }, 7.5, 1.5, {}, { part: "gauge" });
{
  const shape = record(A.cylinder(133, 36.5, 2.2, 7.5, 3, { name: "bank.buck" }));
  put("bank.buck", [133, 36.5, 9], S(k.cylinder(133, 36.5, 2.2, 7.5, 3, P, 20), { tone: "mid" }), [shape]);
}
{
  const shape = record(A.cylinder(139.5, 7.3, 1, 7.5, 1.2, { name: "bank.ntc" }));
  put("bank.ntc", [139.5, 7.3, 8.1], S(k.cylinder(139.5, 7.3, 1, 7.5, 1.2, P, 12), { tone: "mid" }), [shape]);
}
litPart("bank.usbIn", { x: 128, y: 42.5, w: 8, d: 7, r: 1 }, 5, 4, {}, { part: "usbIn" });
litPart("bank.usbOut", { x: 118, y: 42.5, w: 8, d: 7, r: 1 }, 5, 4, {}, { part: "usbOut" });
litPart("bank.usbA", { x: 108, y: 42.5, w: 8, d: 7, r: 1 }, 5, 4, {}, { part: "usbA" });
{
  const shape = record(A.cylinder(20, 46, 2.6, 5, 1.6, { name: "bank.btn" }));
  put("bank.btn", [20, 46, 5.8],
    '<g data-part="btn">' + S(k.cylinder(20, 46, 2.6, 5, 1.6, P, 24), { tone: "mid" }) + "</g>", [shape]);
}
for (const [px, py] of [[110, 8], [142, 8], [110, 40], [142, 40]]) {
  const shape = record(A.ball([px, py, 8.0], 0.5, { name: "bank.pcbbolt" }));
  R.put({ name: "bank.pcbbolt", at: [px, py, 8.0], bias: 0.1, svg: k.dotsSvg([at([px, py, 8.0])], { size: 0.5 }), shapes: [shape], piece: "bank" });
}
for (const [px, py] of [[10, 4.5], [96, 4.5], [10, 47.5], [96, 47.5]]) {
  const shape = record(A.ball([px, py, 5.55], 0.55, { name: "bank.framebolt" }));
  R.put({ name: "bank.framebolt", at: [px, py, 5.55], bias: 0.1, svg: k.dotsSvg([at([px, py, 5.55])], { size: 0.55 }), shapes: [shape], piece: "bank" });
}
// exploded-view spacer posts: the lifted lid rests on these
for (const [px, py] of [[5.5, 27], [105.5, 44], [60, 4.5], [60, 47.5]]) {
  const shape = record(A.cylinder(px, py, 1.1, 5, 29, { name: "bank.post" }));
  put("bank.post", [px, py, 19.5], S(k.cylinder(px, py, 1.1, 5, 29, P, 16), { tone: "mid" }), [shape]);
}
{
  const lid = { x: 0, y: 0, w: 150, d: 52, r: 5 };
  const shape = record(A.slab(lid, 34, 2.5, { name: "bank.lid" }, 8));
  put("bank.lid", [75, 26, 35.25],
    '<g data-part="lid">' + S(k.slabOf(lid, 34, 2.5, P, 8, 0.6), { tone: "hi", inner: Ln(k.planOutline(lid, 36.5, P), { tone: "mid" }) }) + "</g>",
    [shape]);
  slabItem("bank.lens", { x: 126, y: 9, w: 12, d: 11, r: 1 }, 36.5, 0.8, {}, { steps: 3, bevel: 0.2 });
}

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => '<g class="it" data-name="' + item.name + '">' + item.svg + "</g>");

// ---- live overlays (placeholders; the page script fills them, so the audit
// never sees line markup, only recorded shapes) ----
const DIS3 = [[60, 26, 15.5], [108, 26, 15.5], [114, 34, 12], [113, 46, 9]];
const CHG3 = [[132, 46, 9], [120, 32, 9], [60, 26, 15.5]];
const DIS = DIS3.map(at);
const CHG = CHG3.map(at);
const flowDischarge = k.wireSvg(DIS[0], DIS[DIS.length - 1], { via: DIS.slice(1, -1), tone: "lit", dashed: true, flow: true });

// initial model state: drain 2 A from 62% until the output settles
const init = createBank();
for (let i = 0; i < 120; i++) stepBank(init, 2.0, false, 1 / 60);
const initPhase = "boost";
const initReadout = readout(init, initPhase);
const fillW = Math.max(0, Math.min(1, init.cellPct / 100)) * 87;
const fillD = k.lineOnTop([12, 26], [12 + fillW, 26], 14.5, P);
const fillLine = Ln(fillD, { tone: "lit", flow: true, free: true });

const LIT = { boost: ["boost", "ind", "pd", "disp", "usbOut", "usbA", "cell-2"], charge: ["ind", "disp", "usbIn"], rest: [] };
function applyLit(svg, lit) {
  let out = svg;
  for (const part of lit) out = out.split('data-part="' + part + '"').join('data-part="' + part + '" data-lit=""');
  return out;
}
let bodySvg = back.join("") + applyLit(groups.join(""), LIT[initPhase])
  + '<g data-part="flow">' + flowDischarge + "</g>"
  + '<g data-part="fill">' + fillLine + "</g>";

const LABELS = [
  ["skin", "01 shell", 24, 2, 37, "01 Outer shell: flame-retardant unibody, 155 × 54 × 51 mm, 510 g."],
  ["display", "02 display", 132, 10, 10, "02 TFT smart display: live V/A/W per port plus remaining time."],
  ["cell", "03 cells", 30, 13, 14, "03 Li-polymer cell pack: five pouches, 25 000 mAh / 90 Wh at 3.0–4.2 V."],
  ["thermal", "04 thermal", 96, 13, 16, "04 Thermal system: gap pads move heat to the shell; NTC throttles past ~45 °C."],
  ["boost", "06 boost", 117, 10, 12, "06 200 W boost stage: coil + MOSFETs switch ~3.7 V up to 5–28 V."],
  ["inductor", "coil", 141, 36, 12, "06 Boost coil: the inductor that stores each switching pulse."],
  ["mcu", "MCU", 117, 25, 10, "05 Protection + gauge: cut-offs and coulomb counting sit with the MCU."],
  ["pd", "07 PD", 132, 25, 10, "07 PD3.1 controller: C1 to 140 W, C2 to 100 W, A to 22.5 W, 200 W shared."],
  ["usb", "USB ×3", 122, 48, 9, "08 Ports + fuel gauge: 2× USB-C + 1× USB-A; C1/C2 take 65 W back in."],
  ["frame", "frame", 146, 6, 5, "Frame: inner chassis tying the stack to the shell base."],
  ["base", "09 base", 75, 1, 3, "09 65 W input stage on the shell base: 20 V × 3.25 A bucked to ≤4.2 V."],
];
const labelSvg = '<g class="pb-labels">' + LABELS.map((l) => {
  const p = at([l[2], l[3], l[4]]);
  return '<g transform="translate(' + p[0].toFixed(2) + "," + p[1].toFixed(2) + ')" data-layer="' + l[0] + '">'
    + '<circle r="5" class="pb-dot"/><text x="11" y="4" class="pb-tag">' + l[1] + "</text></g>";
}).join("") + "</g>";
bodySvg += labelSvg;

const CAPTION = "UGREEN Nexode PB722 (SKU 35525) — 25 000 mAh / 90 Wh / 200 W, 155 × 54 × 51 mm, 510 g, TFT smart display. Lid lifted on spacer posts: shell, five pouch cells, thermal pad, PCB with boost coil, MCU, PD controller and three USB ports. Drag the load slider or press Fill; the readout mirrors the pack model. Hover a numbered dot for its layer.";
const DEFAULT_CAPTION = "Lid lifted: shell, display, cells, thermal, PCB. Hover a dot.";
const LAYER_TEXT = {};
for (const l of LABELS) LAYER_TEXT[l[0]] = l[5];

const svg = k.figureSvg({ width: W, height: H, label: "Layered isometric cutaway of the UGREEN Nexode PB722 powerbank", body: bodySvg });

const CSS = ".pb-labels .pb-dot{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:1.6}"
  + ".pb-labels [data-layer]{cursor:pointer}"
  + ".pb-labels .pb-tag{font-family:ui-sans-serif,system-ui,sans-serif;font-size:11px;font-weight:600;fill:var(--anatomy-strong);paint-order:stroke;stroke:var(--anatomy-card);stroke-width:3px}"
  + ".pb-controls{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:12px 2px 0;color:var(--anatomy-text);font-size:13px}"
  + ".pb-controls label{display:flex;align-items:center;gap:8px}"
  + ".pb-controls input[type=range]{width:180px;accent-color:var(--anatomy-strong)}"
  + ".pb-controls button{background:var(--anatomy-card);color:var(--anatomy-strong);border:1px solid var(--anatomy-lo);border-radius:8px;padding:4px 12px;font-size:13px;cursor:pointer}"
  + ".pb-controls button:hover{border-color:var(--anatomy-mid)}"
  + ".pb-controls [data-load]{font-family:var(--anatomy-mono);color:var(--anatomy-strong)}"
  + ".iso-stage[data-paused] .iso-line[data-flow],.iso-stage[data-paused] .iso-dots circle[data-pulse]{animation-play-state:paused}";

const live = [
  "const P = " + JSON.stringify(P) + ";",
  "const DIS = " + JSON.stringify(DIS.map((p) => p.map((v) => Math.round(v * 100) / 100))) + ";",
  "const CHG = " + JSON.stringify(CHG.map((p) => p.map((v) => Math.round(v * 100) / 100))) + ";",
  "const CELL_MIN = " + CELL_MIN + ", CELL_MAX = " + CELL_MAX + ";",
  "const createBank = " + createBank.toString() + ";",
  "const stepBank = " + stepBank.toString() + ";",
  "const readout = " + readout.toString() + ";",
  "const LAYERS = " + JSON.stringify(LAYER_TEXT) + ";",
  "const DEFAULT_CAPTION = " + JSON.stringify(DEFAULT_CAPTION) + ";",
  "const s = createBank();",
  "for (let i = 0; i < 120; i++) stepBank(s, 2.0, false, 1/60);",
  "let load = 2.0, charging = false, playing = true, phase = 'boost';",
  "const stage = document.querySelector('.iso-stage');",
  "const svg = stage.querySelector('svg');",
  "const readoutEl = document.querySelector('[data-readout]');",
  "const captionEl = document.querySelector('.iso-caption');",
  "const flowG = svg.querySelector('[data-part=\"flow\"]');",
  "const fillG = svg.querySelector('[data-part=\"fill\"]');",
  "const slider = document.querySelector('[data-slider]');",
  "const loadVal = document.querySelector('[data-load]');",
  "const modeBtn = document.querySelector('[data-mode]');",
  "const playBtn = document.querySelector('[data-play]');",
  "const resetBtn = document.querySelector('[data-reset]');",
  "const litGroups = {};",
  "svg.querySelectorAll('[data-part]').forEach(function (g) { litGroups[g.getAttribute('data-part')] = g; });",
  "const LIT = { boost: ['boost','ind','pd','disp','usbOut','usbA','cell-2'], charge: ['ind','disp','usbIn'], rest: [] };",
  "const still = matchMedia('(prefers-reduced-motion: reduce)');",
  "const clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };",
  "let lastFlow = 'boost', lastFill = '', lastText = '';",
  "function flowSvg(ph) {",
  "  if (ph === 'boost') return wireSvg(DIS[0], DIS[DIS.length-1], { via: DIS.slice(1,-1), tone: 'lit', dashed: true, flow: true });",
  "  if (ph === 'charge') return wireSvg(CHG[0], CHG[CHG.length-1], { via: CHG.slice(1,-1), tone: 'green', dashed: true, flow: true });",
  "  return '';",
  "}",
  "function draw(dt) {",
  "  if (dt) stepBank(s, charging ? 0 : load, charging, dt);",
  "  phase = charging ? 'charge' : (load > 0.01 ? 'boost' : 'rest');",
  "  const text = readout(s, phase);",
  "  if (text !== lastText) { lastText = text; readoutEl.textContent = text; stage.setAttribute('aria-label', 'Powerbank cutaway. ' + text); }",
  "  if (phase !== lastFlow) { lastFlow = phase; flowG.innerHTML = flowSvg(phase);",
  "    Object.keys(litGroups).forEach(function (name) {",
  "      if (LIT.boost.indexOf(name) < 0 && LIT.charge.indexOf(name) < 0) return;",
  "      if (LIT[phase].indexOf(name) >= 0) litGroups[name].setAttribute('data-lit', '');",
  "      else litGroups[name].removeAttribute('data-lit');",
  "    });",
  "  }",
  "  const w = clamp(s.cellPct, 0, 100) / 100 * 87;",
  "  const d = w < 1 ? '' : lineOnTop([12,26],[12+w,26],14.5,P);",
  "  if (d !== lastFill) { lastFill = d; fillG.innerHTML = d ? lineSvg(d, { tone: 'lit', flow: phase !== 'rest', free: true }) : ''; }",
  "  const lv = load.toFixed(1) + ' A';",
  "  if (loadVal.textContent !== lv) loadVal.textContent = lv;",
  "}",
  "let frame = 0, last = 0, visible = false;",
  "function tick(now) {",
  "  const dt = last ? Math.min((now - last) / 1000, 1/30) : 1/60;",
  "  last = now;",
  "  draw(still.matches ? 0 : dt);",
  "  frame = (visible && playing && !still.matches) ? requestAnimationFrame(tick) : 0;",
  "}",
  "function run() { if (!frame && visible && playing && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } }",
  "function poke() { if (still.matches || !playing) { lastFlow = ''; lastFill = '###'; draw(0); } else run(); }",
  "new IntersectionObserver(function (entries) { visible = entries[entries.length-1].isIntersecting; if (visible) run(); }, { rootMargin: '120px 0px' }).observe(stage);",
  "slider.addEventListener('input', function () { load = parseFloat(slider.value); poke(); });",
  "modeBtn.addEventListener('click', function () { charging = !charging; modeBtn.textContent = charging ? 'Fill: on' : 'Fill: off'; poke(); });",
  "playBtn.addEventListener('click', function () { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; if (playing) { stage.removeAttribute('data-paused'); run(); } else stage.setAttribute('data-paused', ''); });",
  "resetBtn.addEventListener('click', function () { const b = createBank(); for (const key of Object.keys(b)) s[key] = b[key];",
  "  for (let i = 0; i < 120; i++) stepBank(s, 2.0, false, 1/60);",
  "  load = 2.0; charging = false; playing = true; slider.value = '2';",
  "  modeBtn.textContent = 'Fill: off'; playBtn.textContent = 'Pause'; stage.removeAttribute('data-paused'); lastFlow = ''; lastFill = '###'; draw(0); run(); });",
  "stage.addEventListener('keydown', function (event) {",
  "  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;",
  "  event.preventDefault();",
  "  load = clamp(Math.round((load + (event.key === 'ArrowRight' ? 0.1 : -0.1)) * 10) / 10, 0, 5);",
  "  slider.value = String(load); poke();",
  "});",
  "svg.querySelectorAll('.pb-labels [data-layer]').forEach(function (g) {",
  "  g.addEventListener('mouseenter', function () { captionEl.textContent = LAYERS[g.getAttribute('data-layer')] || DEFAULT_CAPTION; });",
  "  g.addEventListener('mouseleave', function () { captionEl.textContent = DEFAULT_CAPTION; });",
  "  g.addEventListener('click', function () { captionEl.textContent = LAYERS[g.getAttribute('data-layer')] || DEFAULT_CAPTION; });",
  "});",
  "draw(0);",
].join("\n");

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "PB722 · layered cutaway",
  hint: "drag the load slider",
  readout: initReadout,
  keys: [
    { mark: "raised", label: "structure" },
    { mark: "lit", label: "stored charge" },
    { mark: "dashed", label: "energy flow" },
  ],
  caption: CAPTION,
  body: '<div class="iso-stage" tabindex="0" role="img" aria-label="Powerbank cutaway. ' + initReadout + '">' + svg + "</div>",
});

const controls = '<div class="pb-controls"><label>USB load <input type="range" min="0" max="5" step="0.1" value="2" data-slider aria-label="USB load in amps"> <span data-load>2.0 A</span></label>'
  + '<button type="button" data-mode>Fill: off</button>'
  + '<button type="button" data-play>Pause</button>'
  + '<button type="button" data-reset>Reset</button></div>';

const page = k.pageHtml({ title: "Powerbank cutaway", theme: THEME, body: "<style>" + CSS + "</style>" + plate + controls, script: kitScript() + "\n" + live, width: 780 });
const name = THEME === "light" ? "powerbank-light.html" : "powerbank.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB", R.items.length + " items");

A.auditOrExit(R, P, {});
