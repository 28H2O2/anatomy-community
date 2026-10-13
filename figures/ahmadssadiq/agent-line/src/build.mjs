import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { createCore } from "./core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const C = createCore(k);
const { L, P, at, shift } = C;

const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const solid = (plan, z, h, steps = 5, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const cyl = (cx, cy, r, z, h, steps = 28, bevel = 0) => k.cylinder(cx, cy, r, z, h, P, steps, bevel);
const circ = (cx, cy, r, z, steps = 32) => k.ring(cx, cy, r, z, P, steps);
const seg = (a, b) => k.segment(a, b, P);
const outline = (plan, z, steps = 6) => k.planOutline(plan, z, P, steps);
const tenth = (value) => Math.round(value * 10) / 10;
const group = (part, children, extra = {}) => k.groupSvg(children, { "data-part": part, ...extra });

const { BASE, BASE_H, FOOT_H, TOOL_X, RAM_X, RAM_Y, GATE_X, PRESS_X, CART_TOP, CARD_TOP, CART_Z, CART_H, TRAY_Z, TRAY_H, TRAY_TOP, BRIDGE_Z, BRIDGE_H } = L;
const PAD_H = 1.5;

// ─── Base ────────────────────────────────────────────────────────────────────
function base() {
  const out = [`<path class="iso-halo" d="${solid(BASE, -BASE_H - FOOT_H, BASE_H).fill}"/>`];
  const feet = [
    [BASE.x + 18, BASE.y + 16],
    [BASE.x + BASE.w - 18, BASE.y + 16],
    [BASE.x + 18, BASE.y + BASE.d - 16],
    [BASE.x + BASE.w - 18, BASE.y + BASE.d - 16],
  ];
  for (const [x, y] of feet) {
    out.push(S(cyl(x, y, 7, -BASE_H - FOOT_H, 1.6), { tone: "lo" }));
    out.push(S(cyl(x, y, 5.5, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6), { tone: "mid" }));
  }
  out.push(S(solid(BASE, -BASE_H, BASE_H, 8, 1.6), { tone: "mid" }));
  out.push(Ln(outline(k.insetPlan(BASE, 4.5), 0, 8), { tone: "lo" }));
  const screws = k.corners(BASE, 8);
  out.push(Ln(screws.map(([x, y]) => circ(x, y, 2.2, 0, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const label = { x: 84, y: -44, w: 56, d: 11, r: 2 };
  out.push(S(solid(label, 0, 0.8, 4), { tone: "lo", crease: "none" }));
  out.push(Ln(outline(k.insetPlan(label, 1.6), 0.8, 4), { tone: "faint" }));
  out.push(Ln([0, 1, 2].map((row) => k.onTop([[label.x + 8, label.y + 3.4 + row * 2.1], [label.x + (row === 1 ? 34 : 44), label.y + 3.4 + row * 2.1]], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 3.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ─── Tool rack ───────────────────────────────────────────────────────────────
function rack() {
  const R = { x: -114, y: -42, w: 83, d: 20, r: 2 };
  const out = [S(solid(R, 0, TRAY_Z, 5, 0.8), { tone: "lo" })];
  for (const cx of TOOL_X) out.push(Ln(outline({ x: cx - 7.8, y: -38.8, w: 15.6, d: 16.6, r: 1.8 }, TRAY_Z, 6), { tone: "faint" }));
  out.push(S(solid({ x: R.x, y: R.y, w: R.w, d: 3, r: 1 }, TRAY_Z, 13, 3, 0.8), { tone: "mid" }));
  out.push(D([at([R.x + 6, R.y + 1.5, TRAY_Z + 13]), at([R.x + R.w - 6, R.y + 1.5, TRAY_Z + 13])], { size: 0.5 }));
  out.push(S(solid({ x: R.x, y: -39, w: 3, d: 17, r: 1 }, TRAY_Z, 7, 3, 0.5), { tone: "mid" }));
  out.push(S(solid({ x: R.x + R.w - 3, y: -39, w: 3, d: 17, r: 1 }, TRAY_Z, 7, 3, 0.5), { tone: "mid" }));
  return out.join("");
}

const TRAY_Y = -38.5;
const TRAY_DEPTH = 14;
const TOOL_Y = TRAY_Y + TRAY_DEPTH / 2;

function toolsOf(index, cx) {
  switch (index) {
    case 0:
      return [cyl(cx, TOOL_Y, 2.6, TRAY_TOP, 5, 20, 0.3)];
    case 1:
      return [solid({ x: cx - 3, y: TOOL_Y - 3, w: 6, d: 6, r: 1 }, TRAY_TOP, 4, 4, 0.4)];
    case 2:
      return [cyl(cx, TOOL_Y, 3.4, TRAY_TOP, 2, 24, 0.3), cyl(cx, TOOL_Y, 1.8, TRAY_TOP + 2, 4.5, 18)];
    default:
      return [
        solid({ x: cx - 4.4, y: TOOL_Y - 1.6, w: 8.8, d: 3.2, r: 0.8 }, TRAY_TOP, 3, 3, 0.3),
        cyl(cx - 2.8, TOOL_Y, 1.3, TRAY_TOP + 3, 4, 14),
        solid({ x: cx + 1.2, y: TOOL_Y - 1.6, w: 2.6, d: 3.2, r: 0.6 }, TRAY_TOP + 3, 2.5, 2),
      ];
  }
}

function tray(index) {
  const cx = TOOL_X[index];
  const plan = { x: cx - 7, y: TRAY_Y, w: 14, d: TRAY_DEPTH, r: 1.4 };
  const out = [S(solid(plan, TRAY_Z, TRAY_H, 5, 0.5), { tone: "mid" }), Ln(outline(k.insetPlan(plan, 2.2), TRAY_TOP, 5), { tone: "faint" })];
  for (const paths of toolsOf(index, cx)) out.push(S(paths, { tone: "mid" }));
  out.push(S(solid({ x: cx - 3.5, y: TRAY_Y + TRAY_DEPTH, w: 7, d: 1.6, r: 0.6 }, 3.4, 2.4, 3, 0.3), { tone: "mid" }));
  out.push(Ln(k.onTop([[cx - 2, TRAY_Y + TRAY_DEPTH + 1.6], [cx + 2, TRAY_Y + TRAY_DEPTH + 1.6]], 5.8, P), { tone: "lo", free: true }));
  return group("tray", out, { "data-tool": index });
}

// ─── Gate, press posts, rail ─────────────────────────────────────────────────
function gateBack() {
  return [
    S(solid({ x: GATE_X - 6, y: -26, w: 12, d: 11, r: 2 }, 0, PAD_H, 3, 0.4), { tone: "lo" }),
    D([at([GATE_X - 4.6, -24, PAD_H]), at([GATE_X + 4.6, -24, PAD_H])], { size: 0.45 }),
    S(solid({ x: GATE_X - 4, y: -22.5, w: 8, d: 7.5, r: 1.5 }, PAD_H, BRIDGE_Z - PAD_H, 4, 0.5), { tone: "mid" }),
  ].join("");
}

function gateFront() {
  const ticksMinor = [5, 7, 9, 11, 13, 15].map((z) => seg([GATE_X - 1.4, 23, z], [GATE_X + 0.2, 23, z])).join("");
  const ticksMajor = [6, 10, 14].map((z) => seg([GATE_X - 1.4, 23, z], [GATE_X + 1.6, 23, z])).join("");
  return [
    S(solid({ x: GATE_X - 6, y: 15, w: 12, d: 11, r: 2 }, 0, PAD_H, 3, 0.4), { tone: "lo" }),
    D([at([GATE_X - 4.6, 24.6, PAD_H]), at([GATE_X + 4.6, 24.6, PAD_H])], { size: 0.45 }),
    S(solid({ x: GATE_X - 4, y: 15.5, w: 8, d: 7.5, r: 1.5 }, PAD_H, BRIDGE_Z - PAD_H, 4, 0.5), { tone: "mid" }),
    S(solid({ x: GATE_X - 3.4, y: 23, w: 2, d: 0.6, r: 0.2 }, 3, 13.5, 2), { tone: "lo", crease: "none" }),
    Ln(ticksMinor, { tone: "lo" }),
    Ln(ticksMajor, { tone: "mid" }),
  ].join("");
}

function bridge() {
  const plan = { x: GATE_X - 4, y: -22.5, w: 8, d: 45.5, r: 1.5 };
  const top = BRIDGE_Z + BRIDGE_H;
  return [
    S(solid(plan, BRIDGE_Z, BRIDGE_H, 4, 0.8), { tone: "mid" }),
    Ln(outline(k.insetPlan(plan, 1.4), top, 4), { tone: "faint" }),
    Ln([0, 1, 2].map((row) => k.onTop([[GATE_X - 2.4, 6 + row * 2.4], [GATE_X + (row === 1 ? 0.6 : 2.4), 6 + row * 2.4]], top, P)).join(""), { tone: "lo", free: true }),
    D([at([GATE_X, -18, top]), at([GATE_X, 18, top])], { size: 0.45 }),
  ].join("");
}

const FACE = L.POST_FACE_Y + 0.7;
const ARM_Z = 34;
const ARM_H = 6;

function pressPost() {
  const post = { x: PRESS_X, y: -26, w: 12, d: 10, r: 2 };
  const out = [
    S(solid({ x: PRESS_X - 2, y: -29, w: 16, d: 13, r: 2 }, 0, PAD_H, 3, 0.4), { tone: "lo" }),
    D([at([PRESS_X + 1, -27.5, PAD_H]), at([PRESS_X + 11, -27.5, PAD_H])], { size: 0.45 }),
    S(solid(post, PAD_H, ARM_Z - PAD_H, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(post, 10, P, 4), { tone: "faint" }) }),
    S(solid({ x: RAM_X - 4, y: L.POST_FACE_Y, w: 8, d: 0.7, r: 0.4 }, L.LOCK_Z - 4, 8, 2, 0.2), { tone: "lo", crease: "none" }),
    Ln(k.sideRing([RAM_X, FACE, L.LOCK_Z], 3, "y", P, 28), { tone: "mid" }),
    Ln(k.sideRing([RAM_X, FACE, L.LOCK_Z], 0.9, "y", P, 12), { tone: "hi" }),
    Ln(
      [0, 90]
        .map((degrees) => {
          const a = (degrees * Math.PI) / 180;
          return seg([RAM_X + Math.cos(a) * 3.3, FACE, L.LOCK_Z + Math.sin(a) * 3.3], [RAM_X + Math.cos(a) * 3.9, FACE, L.LOCK_Z + Math.sin(a) * 3.9]);
        })
        .join(""),
      { tone: "lo", free: true },
    ),
    S(solid({ x: RAM_X - 4, y: L.POST_FACE_Y, w: 8, d: 0.7, r: 0.4 }, 23, 4.4, 2, 0.2), { tone: "lo", crease: "none" }),
    Ln(seg([RAM_X - 3.6, FACE, 23.6], [RAM_X + 3.6, FACE, 23.6]), { tone: "lo", free: true }),
  ];
  return out.join("");
}

function rails() {
  const out = [];
  for (const x of [L.RAIL_X0 - 4, L.RAIL_X1]) out.push(S(solid({ x, y: -L.RAIL_Y - 4, w: 4, d: L.RAIL_Y * 2 + 8, r: 1 }, 0, 6, 3, 0.5), { tone: "mid" }));
  out.push(D([L.RAIL_X0 - 2, L.RAIL_X1 + 2].flatMap((x) => [at([x, -L.RAIL_Y, 6]), at([x, L.RAIL_Y, 6])]), { size: 0.45 }));
  for (const side of [-1, 1]) out.push(S(solid({ x: L.RAIL_X0, y: side * L.RAIL_Y - L.RAIL_W / 2, w: L.RAIL_X1 - L.RAIL_X0, d: L.RAIL_W, r: 0.8 }, 0, L.RAIL_H, 3, 0.5), { tone: "lo" }));
  const ticks = k.topTicks(-132, 132, 4, 5, L.RAIL_Y - L.RAIL_W / 2, L.RAIL_H, [1.4, 2.6], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(D([-120, -60, 0, 60, 120].flatMap((x) => [at([x, -L.RAIL_Y, L.RAIL_H]), at([x, L.RAIL_Y, L.RAIL_H])]), { size: 0.45 }));
  return out.join("");
}

// ─── Cart and card (built at x = 0) ──────────────────────────────────────────
function cartBack() {
  const plate = { x: -L.CART_W / 2, y: -L.CART_D / 2, w: L.CART_W, d: L.CART_D, r: 3 };
  const out = [`<path class="iso-halo al-shadow" d="${solid(k.insetPlan(plate, 3), 0.8, 0.1).fill}"/>`];
  for (const x of [-12.5, 4.5]) out.push(S(solid({ x, y: -L.CART_D / 2 - 3, w: 8, d: 3, r: 0.8 }, 1, CART_TOP - 1, 3, 0.4), { tone: "lo" }));
  out.push(S(solid(plate, CART_Z, CART_H, 6, 0.8), { tone: "mid" }));
  out.push(Ln(outline({ x: -12.6, y: -9.1, w: 25.2, d: 18.2, r: 2 }, CART_TOP, 8), { tone: "faint" }));
  out.push(D([-1, 1].flatMap((sx) => [-1, 1].map((sy) => at([sx * 13.8, sy * 10.3, CART_TOP]))), { size: 0.45, tone: "lo" }));
  return out.join("");
}

function card() {
  const plan = { x: -L.CARD_W / 2, y: -L.CARD_D / 2, w: L.CARD_W, d: L.CARD_D, r: 1.6 };
  const rules = [[-11, -1, -3], [-11, -4, -0.8], [-11, -2, 1.4], [-11, -6, 3.6]].map(([from, to, y]) => k.onTop([[from, y], [to, y]], CARD_TOP, P)).join("");
  return group("card", [S(solid(plan, CART_TOP, L.CARD_H, 6, 0.5), { tone: "hi", lit: true }), Ln(rules, { tone: "lo", free: true }), Ln(circ(L.ZONE[0], L.ZONE[1], 3.8, CARD_TOP, 32), { tone: "mid", dotted: true })].join(""));
}

const tabPlan = (index) => ({ x: L.TAB_X[index], y: L.TAB_Y, w: L.TAB_W, d: L.TAB_D, r: 0.5 });
const tabSolid = (index) => S(solid(tabPlan(index), CARD_TOP, L.TAB_NORMAL[index], 2, 0.3), { tone: "hi" });

function dynamicTab() {
  const paths = C.tabOf(0);
  const shades = paths.shades.map((d, index) => `<path class="iso-shade" data-shade="${index}" d="${d}"/>`).join("");
  return `<g class="iso-solid" data-part="tab"><path class="iso-fill" d="${paths.fill}"/>${shades}<path class="iso-top" d="${paths.top}"/><path class="iso-line iso-crease" data-tone="faint" d="${paths.crease}"/><path class="iso-line iso-bevel" data-tone="faint" d="${paths.bevel || ""}"/><path class="iso-line iso-edge" data-tone="hi" d="${paths.outline}"/></g>`;
}

function stamp() {
  const dots = C.BIT_ANGLES.map((angle) => at([L.ZONE[0] + 2.3 * Math.cos(angle), L.ZONE[1] + 2.3 * Math.sin(angle), CARD_TOP]));
  const circles = dots.map(([x, y]) => `<circle data-part="stamp-dot" class="al-bit-dot" cx="${tenth(x)}" cy="${tenth(y)}" r="0.65"/>`).join("");
  return `<g data-part="stamp" opacity="0">${Ln(circ(L.ZONE[0], L.ZONE[1], 3.4, CARD_TOP, 32), { tone: "hi" })}${Ln(circ(L.ZONE[0], L.ZONE[1], 1.1, CARD_TOP, 14), { tone: "mid" })}<g class="iso-dots" data-tone="hi">${circles}</g></g>`;
}

function cartFront() {
  return [-12.5, 4.5].map((x) => S(solid({ x, y: L.CART_D / 2, w: 8, d: 3, r: 0.8 }, 1, CART_TOP - 1, 3, 0.4), { tone: "lo" })).join("");
}

// ─── Press: key, ram, housing, arm ───────────────────────────────────────────
function lockLive() {
  const idDots = [0, 1, 2, 3].map((index) => at([RAM_X - 2.8 + index * 1.87, FACE, 25.2]));
  const plate = idDots.map(([x, y]) => `<circle data-part="plate-dot" class="al-bit-dot" cx="${tenth(x)}" cy="${tenth(y)}" r="0.6"/>`).join("");
  const key = C.keyOf(0);
  const keyDots = key.dots.map(([x, y]) => `<circle data-part="key-dot" class="al-bit-dot" cx="${tenth(x)}" cy="${tenth(y)}" r="0.55"/>`).join("");
  return `<g class="iso-dots" data-tone="hi">${plate}</g><path data-part="neck" class="al-key" d="${key.neck}"/><path data-part="head" class="al-key" d="${key.head}"/><g class="iso-dots" data-tone="hi">${keyDots}</g>`;
}

function ram() {
  return [S(cyl(RAM_X, RAM_Y, 2, 10.7, 23.3, 16), { tone: "mid", crease: "none" }), S(cyl(RAM_X, RAM_Y, 4.2, CARD_TOP + 0.1, 3, 28, 0.4), { tone: "mid" }), Ln(circ(RAM_X, RAM_Y, 3, CARD_TOP + 3.1, 24), { tone: "lo" })].join("");
}

function housing() {
  return [S(cyl(RAM_X, RAM_Y, 5.2, ARM_Z - 8, 8, 28, 0.4), { tone: "mid" }), Ln(k.sideArc(RAM_X, RAM_Y, 5.2, ARM_Z - 4, P, 24), { tone: "faint" })].join("");
}

function arm() {
  const plan = { x: PRESS_X - 1, y: -27, w: 14, d: 38, r: 2.5 };
  return [S(solid(plan, ARM_Z, ARM_H, 5, 0.8), { tone: "mid" }), Ln(outline(k.insetPlan(plan, 2), ARM_Z + ARM_H, 5), { tone: "faint" }), D([at([PRESS_X + 6, -22, ARM_Z + ARM_H]), at([PRESS_X + 6, 7, ARM_Z + ARM_H])], { size: 0.45 })].join("");
}

// ─── Recorder ────────────────────────────────────────────────────────────────
const BAR_H = 5;
const PEN_ARM_TOP = BAR_H + 2.6;

function recorder() {
  const out = [`<path class="iso-halo" d="${solid({ x: -130, y: 34, w: 260, d: 30, r: 1.2 }, 0, 0.1).fill}"/>`];
  out.push(S(solid({ x: -130, y: 38, w: 4, d: 22, r: 0.6 }, 0, BAR_H, 3, 0.6), { tone: "mid" }));
  out.push(S(solid({ x: 126, y: 38, w: 4, d: 22, r: 0.6 }, 0, BAR_H, 3, 0.6), { tone: "mid" }));
  out.push(S(solid({ x: -130, y: 34, w: 260, d: 4, r: 1.2 }, 0, BAR_H, 4, 0.6), { tone: "mid" }));
  out.push(D([-120, 120].map((x) => at([x, 36, BAR_H])), { size: 0.5 }));
  out.push(S(solid({ x: L.PAPER_X, y: L.PAPER_Y, w: L.PAPER_W, d: L.PAPER_D, r: 0 }, 0, L.PAPER_Z, 2), { tone: "mid", crease: "none", className: "al-paper" }));
  out.push(Ln(L.PEN_X.map((x) => k.onTop([[x, L.PAPER_Y], [x, L.PAPER_Y + L.PAPER_D]], L.PAPER_Z, P)).join(""), { tone: "faint" }));
  return out.join("");
}

function chart() {
  const rest = C.chartOf([], 0);
  const clip = k.onTop([[L.PAPER_X, L.PAPER_Y], [L.PAPER_X + L.PAPER_W, L.PAPER_Y], [L.PAPER_X + L.PAPER_W, L.PAPER_Y + L.PAPER_D], [L.PAPER_X, L.PAPER_Y + L.PAPER_D]], L.PAPER_Z, P, true);
  const traces = rest.traces.map((d) => `<path data-part="trace" class="iso-line al-trace" data-tone="hi" d="${d}"/>`).join("");
  return `<defs><clipPath id="al-paper"><path d="${clip}"/></clipPath></defs><g clip-path="url(#al-paper)"><path data-part="ruling" class="iso-line" data-tone="lo" d="${rest.ruling}"/>${traces}</g>`;
}

function pens() {
  const rail = S(solid({ x: -124, y: 34.5, w: 248, d: 3, r: 1 }, BAR_H, 3, 3, 0.5), { tone: "mid" });
  const each = L.PEN_X.map((x) =>
    group(
      "pen",
      [
        S(solid({ x: x - 1.2, y: 37.5, w: 2.4, d: 2.2, r: 0.5 }, 1.4, PEN_ARM_TOP - 1.4, 2, 0.2), { tone: "mid" }),
        D([at([x, 37.5 + 1.1, PEN_ARM_TOP])], { size: 0.5, tone: "mid" }),
        D([at([x, L.PEN_Y, L.PAPER_Z + 0.2])], { size: 0.8, tone: "hi" }),
      ].join(""),
    ),
  );
  const front = [S(solid({ x: -130, y: 60, w: 260, d: 4, r: 1.2 }, 0, BAR_H, 4, 0.6), { tone: "mid" }), D([-120, 120].map((x) => at([x, 62, BAR_H])), { size: 0.5 })].join("");
  return rail + each.join("") + front;
}

// ─── Assemble ────────────────────────────────────────────────────────────────
const body = [
  base(),
  rack(),
  ...TOOL_X.map((_, index) => tray(index)),
  gateBack(),
  pressPost(),
  lockLive(),
  rails(),
  group(
    "cart",
    [cartBack(), card(), tabSolid(0), tabSolid(1), dynamicTab(), tabSolid(3), tabSolid(4), stamp(), cartFront()].join(""),
    { transform: shift(L.HOME_X) },
  ),
  gateFront(),
  group("bridge", bridge()),
  group("ram", ram(), { transform: shift(0, 0, L.RAM_RISE) }),
  housing(),
  arm(),
  recorder(),
  chart(),
  pens(),
];

const svg = k.figureSvg({
  width: L.WIDTH,
  height: L.HEIGHT,
  label:
    "An agent line, drawn as a machine. A job card rides a rail past a rack of four tool drawers, through a gate that only lets a card through if its fields fit, and under a keyed press that stamps it with the agent's seal. In front of the rail a strip-chart recorder has one pen per station, and each pen draws a spike on the moving paper every time its station acts.",
  body,
});

// The names of the kit functions the shared core uses, passed to it in the page.
const live = `
const core = createCore({ fitProjection, boxCorners, iso, slabOf, onTop, pathOf, translateAlong });
${readFileSync(join(HERE, "live.js"), "utf8")}
`;
const coreSource = readFileSync(join(HERE, "core.mjs"), "utf8").replace(/^export /gm, "");

const extra = `<style>
.iso-stage{cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;position:relative}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.iso-svg{overflow:visible}
.al-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.al-shadow{filter:blur(4px);opacity:.8;transform:translateY(1px)}
.al-paper>.iso-top{fill:var(--anatomy-lit-top)}
.al-trace{stroke-linejoin:round}
.al-key{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);stroke-linejoin:round;vector-effect:non-scaling-stroke}
.al-bit-dot{fill:var(--anatomy-dot);stroke:none;transition:opacity 240ms var(--anatomy-ease)}
@media (prefers-reduced-motion:reduce){.iso-stage *{transition:none!important}}
</style>`;

const figure = k.plateHtml({
  fig: "Fig 1",
  title: "An agent step",
  hint: "Click a drawer · B bad card",
  readout: "idle · tool 2 next",
  keys: [
    { mark: "lit", label: "The job card, whatever is being checked" },
    { mark: "edge", label: "The trace each station draws" },
    { mark: "dotted", label: "Where the seal lands" },
  ],
  caption:
    "One agent step, drawn as a machine. A card goes to the drawer for its tool, is checked at the gate against its schema and sent back if a field doesn't fit, and is sealed by a press that only turns with the agent's own key. The recorder in front draws what every station did. An illustration of the design, not measured data.",
  body: `${extra}<div class="iso-stage" tabindex="0" role="group" aria-label="Agent line. Press Space or click a drawer to send a card through. Left and right arrows choose a drawer. B makes the next card malformed."><span class="al-live" aria-live="polite"></span>${svg}</div>`,
});

const name = theme === "light" ? "agent-line-light.html" : "agent-line.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "An agent step", theme, body: figure, script: kitScript() + "\n" + coreSource + "\n" + live }));
console.log("wrote", name);
