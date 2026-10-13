import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 380;
const WAIT = 300;

const PLATE = { x: -140, y: -58, w: 280, d: 122, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const KEY = [-92, -16];
const KEY_BASE = { x: KEY[0] - 20, y: KEY[1] - 20, w: 40, d: 40, r: 3 };
const HOUSING = { x: KEY[0] - 14, y: KEY[1] - 14, w: 28, d: 28, r: 3 };
const HOUSING_TOP = 13;
const CAP = { x: KEY[0] - 16, y: KEY[1] - 16, w: 32, d: 32, r: 4.5 };
const CAP_Z = 17;
const CAP_H = 9;
const TRAVEL = 4;

const DIAL = [0, -16];
const DIAL_R = 26;
const DIAL_Z = 22;
const DIAL_TOP = DIAL_Z + 4;
const FROM = (-150 * Math.PI) / 180;
const SPAN = (300 * Math.PI) / 180;

const BELL = [94, -10];
const BELL_Z = 14;
const BELL_TOP = BELL_Z + 16;
const MAST = [94, -46];
const ARM_Z = 70;
const COIL_Z = [50, ARM_Z];
const PLUNGER = [36, 54];
const STRIKE = 5;

const TAPE = { x: -124, y: 30, w: 248, d: 16, r: 0.6 };
const HEAD_X = -80;
const TAPE_END = 115;
const TAPE_V = 40;
const ROWS = [35, 41];
const SPOOLS = [-124, 124];
const RULER = { x: HEAD_X - 4, y: 49, w: TAPE_END - HEAD_X + 2, d: 7, r: 1 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [MAST[0], MAST[1], ARM_Z + 4], [BELL[0], BELL[1], ARM_Z + 4]],
  WIDTH,
  HEIGHT,
  { pad: 34, azimuth: 58 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const up = (x, y, z) => G.frameAlong([x, y, z], [0, 0, 1]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -6, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const label = { x: -64, y: -52, w: 30, d: 12, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  out.push(L([[18, -48.5], [12, -45.5], [15, -42.5]].map(([w, y]) => k.lineOnTop([label.x + 4, y], [label.x + 4 + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 26.5, label.y + 3, 0.8]), at([label.x + 26.5, label.y + 9, 0.8])], { size: 0.4 }));
  return out.join("");
}

function ruler() {
  const out = [S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const ticks = k.topTicks(HEAD_X, TAPE_END, 4, 5, RULER.y + 0.6, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([HEAD_X, RULER.y + 0.6], [HEAD_X, RULER.y + RULER.d], 0.6, P), { tone: "hi" }));
  out.push(D([at([RULER.x + RULER.w - 1.8, RULER.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

function tape() {
  const out = [S(k.slabOf(TAPE, 0, 0.5, P, 2), { tone: "hi", crease: "none" })];
  for (const y of [TAPE.y + 1.4, TAPE.y + TAPE.d - 1.4]) out.push(L(k.lineOnTop([TAPE.x, y], [TAPE.x + TAPE.w, y], 0.5, P), { tone: "faint" }));
  return out.join("");
}

function spool(x) {
  const y = TAPE.y + TAPE.d / 2;
  const out = [];
  out.push(S(k.cylinder(x, y, 10, 0, 1.2, P, 40), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 7.2, 1.2, 8, P, 40), { tone: "hi", crease: "none" }));
  out.push(L([3.4, 5.6].map((z) => k.sideArc(x, y, 7.2, z, P, 24)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 10, 9.2, 1.2, P, 40, 0.4), { tone: "mid" }));
  out.push(L(k.ring(x, y, 3.2, 10.4, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.8, 10.4, 1.4, P, 16), { tone: "mid" }));
  return out.join("");
}

function head() {
  const out = [];
  const near = { x: HEAD_X - 5, y: TAPE.y + TAPE.d + 0.6, w: 10, d: 4, r: 0.8 };
  const far = { x: HEAD_X - 5, y: TAPE.y - 4.6, w: 10, d: 4, r: 0.8 };
  const bridge = { x: HEAD_X - 6, y: TAPE.y - 5.6, w: 12, d: TAPE.d + 11.2, r: 1.4 };
  out.push(S(k.slabOf(far, 0, 7, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(near, 0, 7, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(bridge, 7, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(D(ROWS.map((y) => at([HEAD_X, y, 11])), { size: 0.55, tone: "hi" }));
  out.push(D([at([HEAD_X - 4, bridge.y + 1.6, 11]), at([HEAD_X + 4, bridge.y + 1.6, 11]), at([HEAD_X - 4, bridge.y + bridge.d - 1.6, 11]), at([HEAD_X + 4, bridge.y + bridge.d - 1.6, 11])], { size: 0.4 }));
  return out.join("");
}

function keySwitch() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(KEY_BASE, 3), 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(KEY_BASE, 0, 3, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(KEY_BASE, 3.4).map((p) => at([p[0], p[1], 3])), { size: 0.45 }));
  out.push(S(k.slabOf(HOUSING, 3, 6, P, 4), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(HOUSING, 1.2), 9, HOUSING_TOP - 9, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(HOUSING, 5), HOUSING_TOP, P, 3), { tone: "faint" }));
  return out.join("");
}

const stemOf = (press) => S(k.cylinder(KEY[0], KEY[1], 3, HOUSING_TOP, Math.max(0.05, CAP_Z - HOUSING_TOP - press), P, 20), { tone: "mid", crease: "none" });

function keycap() {
  const out = [];
  const top = CAP_Z + CAP_H;
  out.push(S(k.slabOf(CAP, CAP_Z, CAP_H - 2, P, 6), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(CAP, 2.2), top - 2, 2, P, 6, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(CAP, 5.2), top, P, 6), { tone: "faint" }));
  out.push(L(k.ring(KEY[0], KEY[1], 6.2, top, P, 32), { tone: "faint" }));
  out.push(L(k.lineOnTop([KEY[0] - 2.4, KEY[1] + 7.4], [KEY[0] + 2.4, KEY[1] + 7.4], top, P), { tone: "lo", free: true }));
  return out.join("");
}

function timer() {
  const [x, y] = DIAL;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 30, y: y - 30, w: 60, d: 60, r: 30 }, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(x, y, 31, 0, 4, P, 72, 0.6), { tone: "mid" }));
  out.push(D([0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 + 0.3; return at([x + Math.sin(a) * 28.6, y - Math.cos(a) * 28.6, 4]); }), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, DIAL_R, 4, DIAL_Z - 4, P, 72), { tone: "mid", crease: "none", inner: L([10, 14].map((z) => k.sideArc(x, y, DIAL_R, z, P, 48)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_TOP - DIAL_Z, P, 72, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_Z, DIAL_TOP, 96, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, DIAL_R - 2.2, DIAL_TOP, P, 72), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.2, 30, 5, DIAL_TOP, [1.6, 3.4], P, FROM, SPAN);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const zero = [Math.sin(FROM), -Math.cos(FROM)];
  out.push(L(k.lineOnTop([x + zero[0] * (DIAL_R - 7), y + zero[1] * (DIAL_R - 7)], [x + zero[0] * (DIAL_R - 2.2), y + zero[1] * (DIAL_R - 2.2)], DIAL_TOP, P), { tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y - 9], DIAL_TOP, P, "x"), "300 ms", { size: 3, tone: "lo", anchor: "middle" }));
  const crown = [x + DIAL_R + 3.4, y];
  out.push(S(k.slabOf({ x: x + DIAL_R - 1, y: y - 2.4, w: 4, d: 4.8, r: 1.2 }, 12, 5, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: crown[0], y: y - 4, w: 3, d: 8, r: 1.4 }, 10.6, 7.8, P, 3), { tone: "mid" }));
  return out.join("");
}

function hub() {
  const [x, y] = DIAL;
  return S(k.cylinder(x, y, 2.4, DIAL_TOP, 1.4, P, 20), { tone: "mid" }) + D([at([x, y, DIAL_TOP + 1.4])], { size: 0.5, tone: "hi" });
}

function mast() {
  const [x, y] = MAST;
  const out = [];
  const foot = { x: x - 8, y: y - 8, w: 16, d: 16, r: 2 };
  out.push(S(k.slabOf(foot, 0, 5, P, 3, 0.5), { tone: "mid" }));
  out.push(D(k.corners(foot, 2.6).map((p) => at([p[0], p[1], 5])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 3.4, 5, ARM_Z - 5, P, 24), { tone: "mid", crease: "none", inner: L([24, 48].map((z) => k.sideArc(x, y, 3.4, z, P, 16)).join(""), { tone: "faint" }) }));
  return out.join("");
}

function bellBase() {
  const [x, y] = BELL;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 16, y: y - 16, w: 32, d: 32, r: 16 }, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(x, y, 13, 0, 3, P, 48, 0.5), { tone: "mid" }));
  out.push(D([0, 1, 2, 3].map((i) => { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; return at([x + Math.sin(a) * 10.4, y - Math.cos(a) * 10.4, 3]); }), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 2.8, 3, BELL_Z - 3, P, 20), { tone: "mid", crease: "none" }));
  return out.join("");
}

function bell() {
  const [x, y] = BELL;
  const profile = [[0, 19], [1.2, 19], [2, 18, 1], [4, 16.6, 1], [7, 14.2, 1], [10, 11.2, 1], [13, 7.4, 1], [15, 3.6, 1], [16, 0]];
  const out = [S(G.solidOf(profile, up(x, y, BELL_Z), P), { tone: "hi", crease: "lo", inner: L(G.arcOf(up(x, y, BELL_Z), 1.2, 19, P), { tone: "faint" }) })];
  out.push(S(k.cylinder(x, y, 2.6, BELL_TOP - 0.4, 1.4, P, 20), { tone: "mid" }));
  return out.join("");
}

function plunger() {
  const [x, y] = BELL;
  return S(k.cylinder(x, y, 2.2, PLUNGER[0], PLUNGER[1] - PLUNGER[0], P, 20), { tone: "hi", crease: "none", lit: true })
    + S(k.cylinder(x, y, 3, PLUNGER[0], 1.6, P, 20), { tone: "hi", lit: true });
}

function solenoid() {
  const [x, y] = BELL;
  const out = [];
  out.push(S(k.cylinder(x, y, 9.4, COIL_Z[0], 2, P, 48), { tone: "mid" }));
  const wraps = Array.from({ length: 11 }, (_, i) => k.sideArc(x, y, 8, COIL_Z[0] + 3.2 + i * 1.3, P, 32)).join("");
  out.push(S(k.cylinder(x, y, 8, COIL_Z[0] + 2, COIL_Z[1] - COIL_Z[0] - 4, P, 48), { tone: "hi", crease: "none", inner: L(wraps, { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 9.4, COIL_Z[1] - 2, 2, P, 48), { tone: "mid" }));
  return out.join("");
}

function arm() {
  const out = [];
  const plan = { x: MAST[0] - 5, y: MAST[1] - 5, w: 10, d: BELL[1] - MAST[1] + 15, r: 2 };
  out.push(S(k.slabOf(plan, ARM_Z, 4, P, 4, 0.5), { tone: "mid" }));
  out.push(D([at([MAST[0], MAST[1], ARM_Z + 4]), at([BELL[0] - 3, BELL[1], ARM_Z + 4]), at([BELL[0] + 3, BELL[1], ARM_Z + 4])], { size: 0.45 }));
  out.push(S(k.cylinder(MAST[0], MAST[1], 2.6, ARM_Z + 4, 1.6, P, 16), { tone: "mid" }));
  return out.join("");
}

function wires() {
  const z = 0;
  const a = [
    at([KEY_BASE.x + KEY_BASE.w, KEY[1] + 8, 1.5]),
    at([KEY_BASE.x + KEY_BASE.w + 6, KEY[1] + 8, z]),
    at([-36, KEY[1] + 8, z]),
    at([-30.6, KEY[1] + 8, 2]),
  ];
  const b = [
    at([30.6, DIAL[1] - 8, 2]),
    at([40, DIAL[1] - 8, z]),
    at([62, MAST[1], z]),
    at([MAST[0] - 8, MAST[1], 2.5]),
  ];
  return k.wireSvg(a[0], a[3], { via: a.slice(1, 3), tone: "lo", size: 1 }) + k.wireSvg(b[0], b[3], { via: b.slice(1, 3), tone: "lo", size: 1 });
}

const needleAt = (ms) => {
  const angle = FROM + (Math.max(0, Math.min(WAIT, ms)) / WAIT) * SPAN;
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 4, y + Math.cos(angle) * 4], [x + Math.sin(angle) * (DIAL_R - 4.6), y - Math.cos(angle) * (DIAL_R - 4.6)], DIAL_TOP + 0.2, P);
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A debounce bench. A large keyswitch on the left rewinds a 300 millisecond wind-down timer in the middle every time it is pressed. Only when the timer runs all the way down does a solenoid on the right strike a bell, once. A paper tape along the front is punched with a small hole for every keypress and a large mark for every bell strike, so bursts of presses produce a single call 300 ms after the last one.",
  body: [
    plate(),
    ruler(),
    tape(),
    `<g data-part="marks"><g class="iso-dots" data-tone="hi" data-row="0"></g><g class="iso-dots" data-tone="lit" data-row="1"></g></g>`,
    wires(),
    keySwitch(),
    `<g data-part="stem">${stemOf(0)}</g>`,
    `<g data-part="cap">${keycap()}</g>`,
    timer(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.2"/>`,
    hub(),
    mast(),
    `<g data-part="bell">${bellBase()}${bell()}</g>`,
    `<g data-part="plunger">${plunger()}</g>`,
    solenoid(),
    arm(),
    spool(SPOOLS[0]),
    head(),
    spool(SPOOLS[1]),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const WAIT = ${WAIT}, TRAVEL = ${TRAVEL}, STRIKE = ${STRIKE}, HEAD_X = ${HEAD_X}, TAPE_END = ${TAPE_END}, TAPE_V = ${TAPE_V};
const ROWS = ${JSON.stringify(ROWS)};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP}, FROM = ${FROM}, SPAN = ${SPAN};
const KEY = ${JSON.stringify(KEY)}, HOUSING_TOP = ${HOUSING_TOP}, CAP_Z = ${CAP_Z};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const cap = part("cap"), stem = part("stem"), needle = part("needle"), plungerEl = part("plunger"), bellEl = part("bell");
const rows = [...part("marks").children];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const stemOf = (press) => solidSvg(cylinder(KEY[0], KEY[1], 3, HOUSING_TOP, Math.max(0.05, CAP_Z - HOUSING_TOP - press), P, 20), { tone: "mid", crease: "none" });
const TOUR = (() => {
  const out = [];
  let t = 1400;
  const burst = (gaps) => gaps.forEach((gap) => { t += gap; out.push(t); });
  burst([0, 110, 95, 140, 120, 90, 135, 105]);
  t += 1500;
  burst([0, 520, 520]);
  t += 1500;
  burst([0, 160, 120, 180, 100, 150]);
  t += 1900;
  return { at: out, length: t };
})();
let time = 0, deadline = null, keys = 0, calls = 0, pressedAt = -1e9, struckAt = -1e9, shown = 0;
let marks = [];
let frame = 0, last = 0, visible = false, touring = !still.matches, tourClock = 0, tourIndex = 0, idleTimer = 0;
const ease = (t) => t * t * (3 - 2 * t);
const pulse = (age, rise, fall) => (age < 0 ? 0 : age < rise ? ease(age / rise) : Math.exp(-(age - rise) / fall));
function press() {
  keys++;
  pressedAt = time;
  deadline = time + WAIT;
  marks.push({ t: time, row: 0 });
  run();
}
function fire() {
  calls++;
  struckAt = deadline;
  marks.push({ t: deadline, row: 1 });
  deadline = null;
}
function say() {
  const left = deadline === null ? null : Math.max(0, Math.ceil(deadline - time));
  const text = keys + (keys === 1 ? " key" : " keys") + " · " + calls + (calls === 1 ? " call" : " calls") + " · " + (left === null ? "quiet" : "fires in " + left + " ms");
  if (readout.textContent !== text) readout.textContent = text;
}
function draw(calm) {
  const down = calm ? (time - pressedAt < 90 ? TRAVEL : 0) : TRAVEL * pulse((time - pressedAt) / 1000, 0.025, 0.06);
  cap.setAttribute("transform", translateAlong(P, [0, 0, -down]));
  stem.innerHTML = stemOf(down);
  needle.setAttribute("d", needleAt(shown));
  const age = (time - struckAt) / 1000;
  const hit = calm ? 0 : STRIKE * pulse(age, 0.03, 0.07);
  plungerEl.setAttribute("transform", translateAlong(P, [0, 0, -hit]));
  const shake = calm ? 0 : 0.7 * Math.sin(age * 95) * Math.exp(-age / 0.22) * (age > 0.03 ? 1 : 0);
  bellEl.setAttribute("transform", translateAlong(P, [shake, -shake * 0.4, 0]));
  const html = ["", ""];
  marks = marks.filter((m) => HEAD_X + ((time - m.t) / 1000) * TAPE_V < TAPE_END + 2);
  for (const m of marks) {
    const x = HEAD_X + ((time - m.t) / 1000) * TAPE_V;
    const alpha = Math.min(1, Math.max(0, (TAPE_END - x) / 14));
    const [sx, sy] = iso([x, ROWS[m.row], 0.5], P);
    html[m.row] += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="' + (m.row ? 2.6 : 1.3) + '"' + (alpha < 1 ? ' fill-opacity="' + alpha.toFixed(2) + '"' : "") + "/>";
  }
  rows[0].innerHTML = html[0];
  rows[1].innerHTML = html[1];
  say();
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  time += dt * 1000;
  if (touring) {
    tourClock += dt * 1000;
    while (tourIndex < TOUR.at.length && tourClock >= TOUR.at[tourIndex]) { tourIndex++; press(); }
    if (tourClock >= TOUR.length) { tourClock = 0; tourIndex = 0; }
  }
  if (deadline !== null && time >= deadline) fire();
  const target = deadline === null ? 0 : deadline - time;
  shown = calm ? target : shown + (target - shown) * (1 - Math.exp(-dt / (target > shown ? 0.035 : 0.02)));
  draw(calm);
  const settled = !touring && deadline === null && marks.length === 0 && time - struckAt > 1500 && time - pressedAt > 500;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
function interact() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; tourClock = 0; tourIndex = 0; run(); }, 3600);
  press();
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerdown", (event) => { event.preventDefault(); stage.focus({ preventScroll: true }); interact(); });
addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Tab" || event.key === "Shift" || event.key === "Escape") return;
  if (event.key === " " || event.key.startsWith("Arrow")) event.preventDefault();
  interact();
});
draw(still.matches);
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Debounce, 300 ms",
  hint: "Type anything, or tap the key",
  readout: "0 keys · 0 calls · quiet",
  keys: [
    { mark: "lit", label: "Needle and striker: the time left, and the one call it allows" },
    { mark: "raised", label: "Keycap: every press rewinds the timer to 300 ms" },
    { mark: "dotted", label: "Tape: small dots are keypresses, big marks are calls" },
  ],
  caption:
    "debounce(fn, 300) as a bench instrument. Each keypress winds the timer back to full; the solenoid only fires when 300 ms pass with no new press. A burst of typing becomes one call, 300 ms after the last key. Taps slower than 300 ms apart fire every time. Each ruler tick is 100 ms of tape, so the gap before every big mark is the 300 ms wait itself.",
  body: `<style>[data-part="marks"] [data-row="0"] circle{opacity:.7}[data-part="marks"] [data-row="1"] circle{fill:var(--anatomy-lit);opacity:1}</style><div class="iso-stage" tabindex="0" role="group" aria-label="Debounce bench: press any key or tap to press the keyswitch" style="touch-action:pan-y;cursor:pointer">${svg}</div>`,
});

const name = theme === "light" ? "debounce-light.html" : "debounce.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Debounce bench", theme, body, script: kitScript() + live }));
console.log("wrote", name);
