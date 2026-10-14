import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { JOBS, KEEP, RUNNERS, STAGES, createSim } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 420;

// World: x along the coordinator, y from the coordinator (back) toward the runners (front), z up.
const PLATE = { x: -176, y: -116, w: 352, d: 226, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const PLINTH = { x: -156, y: -104, w: 312, d: 62, r: 4 };
const PLINTH_H = 24;
const FRONT = PLINTH.y + PLINTH.d; // the coordinator's front face, y = -42
const TRAY_Z = PLINTH_H;
const TRAY_H = 3;
const SLOT_Y = -74;
const SLOT_X = [-122, -60, -18, 24, 92];
const TRAYS = [
  { x: -142, y: -88, w: 40, d: 28, r: 2 },
  { x: -82, y: -88, w: 128, d: 28, r: 2 },
  { x: 72, y: -88, w: 40, d: 28, r: 2 },
];
const LAMP_Y = -53;

const PUCK_R = 7;
const PUCK_H = 6;
const KEY_H = 1.3;
const PUCK_TOP = PUCK_H + KEY_H;
const AT_SLOT = TRAY_Z + TRAY_H + PUCK_TOP;

// Gantry: back beam on the plinth, front beam on posts from the plate.
const BEAM_Z = 76;
const BEAM_H = 8;
const BEAMS = [{ x: -150, y: -103, w: 300, d: 8, r: 1 }];
const POST_X = [-154, 148];
const BRIDGE = { x: -7, y: -108, w: 14, d: 94, r: 1.5 };
const BRIDGE_Z = BEAM_Z + BEAM_H;
const BRIDGE_H = 7;
const HEAD = { x: -11, y: -9, w: 22, d: 18, r: 2 };
const HEAD_Z = BRIDGE_Z + BRIDGE_H;
const HEAD_H = 9;
const GRIP_H = 3;
const UP = 50;

// Runners: a carriage on two rails from the pickup seat under the gantry to the executor press.
const RUNNER_X = [-96, 76];
const HOME_Y = -24;
const WORK_Y = 70;
const RAIL_FROM = -38; // the back end stop sits against the coordinator
const RAIL_TO = 90;
const CAR = { x: -15, y: -13, w: 30, d: 26, r: 2.5 };
const CAR_Z = 3.5;
const CAR_TOP = 10;
const SEAT_R = 9.4;
const SEAT_TOP = CAR_TOP + 2;
const AT_SEAT = SEAT_TOP + PUCK_TOP;
const PRESS_Z = 54;
const PRESS_H = 8;
const RAM_REST = 40;
const CABINET = { x: 26, y: 40, w: 24, d: 52, r: 2.5 };
const CABINET_H = 30;
const CABLE_X = 38;
const PORT_Z = 10;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners({ x: -154, y: -106, w: 308, d: 104 }, 0, HEAD_Z + HEAD_H + 6),
    ...RUNNER_X.map((x) => [x, WORK_Y, PRESS_Z + PRESS_H + 6]),
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 52 },
);

// Every painted group is one audit item, keyed by its place in the paint order, so
// `--audit` checks the hand-set order (and supports, cables) instead of re-sorting it.
let R = A.recorder(P);
let bag = null;
const rec = (shape) => (bag && bag.push(shape), shape);
const part = (name, draw, offset = null) => {
  const outer = bag;
  bag = [];
  const svg = draw();
  const shapes = bag.map((shape, index) => ({ ...(offset ? A.moved(shape, offset) : shape), name: `${name}.${index}` }));
  bag = outer;
  R.put({ name, key: R.items.length, shapes, svg: offset ? undefined : svg });
  R.solids.push(...shapes);
  return svg;
};

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, style = { tone: "mid" }, steps = 3, bevel = 0.5) => (rec(A.slab(plan, z, h)), S(k.slabOf(plan, z, h, P, steps, bevel), style));
const cyl = (x, y, r, z, h, style = { tone: "mid" }, steps = 24, bevel = 0) => (rec(A.cylinder(x, y, r, z, h)), S(k.cylinder(x, y, r, z, h, P, steps, bevel), style));
const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
// A cable plug: a turned body on a port face, its axis the face normal. The cable leaves its end.
const PLUG = [[0, 2.2], [2.4, 2.2], [2.4, 1.5], [4.2, 1.5]];
const plugOf = (scale) => PLUG.map(([s, r]) => [s * scale, r * scale]);
const plug = (o, axis, scale = 1) => {
  const F = G.frameAlong(o, axis);
  rec(A.solid(F, plugOf(scale)));
  return S(G.solidOf(plugOf(scale), F, P, { steps: 20 }), { tone: "mid", crease: "lo" });
};
const plugEnd = (o, axis, scale = 1) => o.map((v, i) => v + axis[i] * 4.2 * scale);
const screws = (points, z, size = 0.45) => D(points.map(([x, y]) => at([x, y, z])), { size });

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(cyl(x, y, 7, -PLATE_H - FOOT_H, 1.6, { tone: "lo" }, 28));
    out.push(cyl(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, { tone: "mid" }, 28));
  }
  rec(A.slab(PLATE, -PLATE_H, PLATE_H));
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const corner = k.corners(PLATE, 10);
  out.push(L(corner.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(screws(corner, 0, 0.5));
  // A ruler along the front edge, the runners' travel axis marked on the plate.
  const strip = { x: -150, y: PLATE.y + PLATE.d - 14, w: 300, d: 6, r: 1 };
  out.push(slab(strip, 0, 0.6, { tone: "lo", crease: "none" }, 3, 0));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(screws([[strip.x + 2, strip.y + 3], [strip.x + strip.w - 2, strip.y + 3]], 0.6));
  // Label plate at the front left corner.
  const label = { x: -160, y: 56, w: 34, d: 18, r: 1.2 };
  out.push(slab(label, 0, 0.8, { tone: "mid" }, 3, 0.3));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  [[22], [16], [19]].forEach(([w], index) => out.push(L(k.lineOnTop([label.x + 5, label.y + 5 + index * 4], [label.x + 5 + w, label.y + 5 + index * 4], 0.8, P), { tone: "lo", free: true })));
  out.push(screws([[label.x + 2.4, label.y + 2.4], [label.x + label.w - 2.4, label.y + label.d - 2.4]], 0.8, 0.4));
  return out.join("");
}

// The coordinator: GitLab's job queue as three stage trays of job pucks.
function plinth() {
  const out = [];
  const bottom = { ...PLINTH };
  rec(A.slab(PLINTH, 0, PLINTH_H));
  out.push(S(k.slabOf(PLINTH, 0, PLINTH_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(bottom, 4, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 3.5), PLINTH_H, P, 4), { tone: "faint" }));
  const corner = k.corners(PLINTH, 7);
  out.push(screws(corner, PLINTH_H, 0.5));
  // API ports on the front face, one per runner cable.
  for (const x of [...RUNNER_X.map((x) => x + CABLE_X), PUSH_X]) {
    out.push(slab({ x: x - 5, y: FRONT - 0.5, w: 10, d: 3, r: 1 }, PORT_Z - 5, 10, { tone: "mid" }, 2, 0.3));
    out.push(D([at([x - 3.4, FRONT + 2.5, PORT_Z + 3.6]), at([x + 3.4, FRONT + 2.5, PORT_Z + 3.6])], { size: 0.35 }));
    out.push(plug([x, FRONT + 2.5, PORT_Z], [0, 1, 0], x === PUSH_X ? 0.7 : 1));
  }
  return out.join("");
}

// The commits: a card rack in front of the coordinator. Every push raises a card out of the front slot;
// the band on its top edge is that commit's pipeline status.
const RACK = { x: -24, y: 24, w: 44, d: 70, r: 2.5 };
const RACK_Z = 0;
const RACK_TOP = 4;
const RACK_CX = -2;
const CARD = { w: 34, t: 1.6, h: 22 };
const CARD_FRONT = 68;
const CARD_PITCH = 8;
const BUTTON = [RACK_CX, 86];
const PUSH_X = -18; // the push cable runs from the rack's back into the coordinator

const cardTemplate = (() => {
  const plan = { x: RACK_CX - CARD.w / 2, y: -CARD.t / 2, w: CARD.w, d: CARD.t, r: 0.4 };
  const face = k.sideMatrix([0, CARD.t / 2], RACK_TOP + CARD.h, P, "left");
  return `<g clip-path="url(#gr-card-clip)"><g data-rise><g class="gr-card">${S(k.slabOf(plan, RACK_TOP, CARD.h, P, 2), { tone: "mid", crease: "faint" })}<g transform="${face}"><rect class="gr-band" data-status="__STATUS__" x="${RACK_CX - CARD.w / 2 + 1.2}" y="0.9" width="${CARD.w - 2.4}" height="2.6" rx="0.6"/><text class="iso-face-text gr-sha" data-tone="hi" x="${RACK_CX}" y="8.8" font-size="3.8" text-anchor="middle">__SHA__</text><text class="iso-face-text" data-tone="mid" x="${RACK_CX}" y="12.8" font-size="2.6" text-anchor="middle">__NUM__</text></g></g></g></g>`;
})();
const cardShape = () => rec(A.slab({ x: RACK_CX - CARD.w / 2, y: -CARD.t / 2, w: CARD.w, d: CARD.t, r: 0.4 }, RACK_TOP, CARD.h));
const cardAt = (slot) => k.translateAlong(P, [0, CARD_FRONT - slot * CARD_PITCH, 0]);
// In a card's own frame: everything above the slot line on the rack top, so a rising card appears out of its slot.
const cardClip = () => {
  const x0 = RACK_CX - CARD.w / 2 - 3, x1 = RACK_CX + CARD.w / 2 + 3, y = CARD.t / 2 + 0.3;
  const points = [[x0, y, RACK_TOP], [x1, y, RACK_TOP], [x1, y, RACK_TOP + 80], [x0, y, RACK_TOP + 80]].map(at);
  return `<clipPath id="gr-card-clip" clipPathUnits="userSpaceOnUse"><path d="${k.pathOf(points, true)}"/></clipPath>`;
};

function rackBack() {
  const out = [`<defs>${cardClip()}</defs>`];
  out.push(`<path class="iso-halo" d="${k.haloOf(RACK, RACK_Z, RACK_TOP, P)}" style="opacity:.6"/>`);
  rec(A.slab(RACK, RACK_Z, RACK_TOP - RACK_Z));
  out.push(S(k.slabOf(RACK, RACK_Z, RACK_TOP - RACK_Z, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(RACK, 1.4, P, 4), { tone: "faint" }) }));
  out.push(screws(k.corners(RACK, 2.4), RACK_TOP, 0.45));
  out.push(slab({ x: RACK.x + 2.4, y: CARD_FRONT - (KEEP - 0.5) * CARD_PITCH, w: 3, d: (KEEP - 0.2) * CARD_PITCH + 2, r: 0.8 }, RACK_TOP, 7, { tone: "mid" }, 2, 0.4));
  for (let slot = 0; slot < KEEP; slot++) {
    const y = CARD_FRONT - slot * CARD_PITCH + CARD.t / 2 + 0.5;
    out.push(L(k.lineOnTop([RACK.x + 5.4, y], [RACK.x + RACK.w - 5.4, y], RACK_TOP, P), { tone: "faint" }));
  }
  return out.join("");
}

const PUSH_PLUG = [[PUSH_X, RACK.y, 2.2], [0, -1, 0], 0.6];
const pushCable = () => {
  const from = plugEnd(...PUSH_PLUG);
  const to = plugEnd([PUSH_X, FRONT + 2.5, PORT_Z], [0, 1, 0], 0.7);
  return [from, [PUSH_X, from[1] - 2.4, 2.2], [PUSH_X, from[1] - 4.4, 0.9], [PUSH_X, FRONT + 13, 0.9], [PUSH_X, to[1] + 2.6, PORT_Z], to];
};
const pushLine = () => route("cable.push", pushCable(), pushLineSvg()) + part("cable.push.plug", () => plug(...PUSH_PLUG));
function pushLineSvg() {
  const points = pushCable().map(at);
  const d = k.pathOf(points);
  return [
    `<path class="gr-cable" d="${d}"/>`,
    k.wireSvg(points[0], points[points.length - 1], { via: points.slice(1, -1), tone: "mid", size: 1.1 }),
    `<circle class="gr-pulse" data-push-pulse r="2" cx="${points[0][0]}" cy="${points[0][1]}" style="opacity:0"/>`,
  ].join("");
}

function rackFront() {
  const out = [];
  out.push(slab({ x: RACK.x + RACK.w - 5.4, y: CARD_FRONT - (KEEP - 0.5) * CARD_PITCH, w: 3, d: (KEEP - 0.2) * CARD_PITCH + 2, r: 0.8 }, RACK_TOP, 7, { tone: "mid" }, 2, 0.4));
  // The push button: press it to push a new commit.
  const [x, y] = BUTTON;
  const ctl = [];
  ctl.push(cyl(x, y, 6.4, RACK_TOP, 1.6, { tone: "lo" }, 36, 0.3));
  ctl.push(L(k.ring(x, y, 5.4, RACK_TOP + 1.6, P, 36), { tone: "faint" }));
  ctl.push(`<g data-cap>${cyl(x, y, 4.5, RACK_TOP + 1.6, 2.8, { tone: "hi", crease: "lo" }, 36, 0.5)}${L(k.ring(x, y, 2.6, RACK_TOP + 4.4, P, 28), { tone: "lo" })}</g>`);
  const hit = k.cylinder(x, y, 8.4, RACK_TOP, 7, P, 24).fill;
  out.push(`<g class="gr-ctl" data-push>${ctl.join("")}<path class="gr-hit" d="${hit}"/></g>`);
  return out.join("");
}

function gantryBack() {
  const out = [];
  for (const x of POST_X) {
    out.push(slab({ x: x - 2, y: BEAMS[0].y - 2, w: 10, d: 12, r: 1 }, PLINTH_H, 1.5, { tone: "lo" }, 2, 0.3));
    out.push(slab({ x, y: BEAMS[0].y, w: 6, d: 8, r: 1 }, PLINTH_H + 1.5, BEAM_Z - PLINTH_H - 1.5, { tone: "mid" }, 2, 0.3));
    out.push(screws([[x - 0.5, BEAMS[0].y + 8.8], [x + 6.5, BEAMS[0].y + 8.8]], PLINTH_H + 1.5, 0.35));
  }
  out.push(beam(BEAMS[0]));
  return out.join("");
}

function beam(plan) {
  const out = [slab(plan, BEAM_Z, BEAM_H, { tone: "mid" }, 2, 0.5)];
  out.push(L(k.lineOnTop([plan.x, plan.y + plan.d / 2], [plan.x + plan.w, plan.y + plan.d / 2], BEAM_Z + BEAM_H, P), { tone: "faint" }));
  const ticks = k.topTicks(plan.x + 8, plan.x + plan.w - 8, 6, 5, plan.y + plan.d - 0.4, BEAM_Z + BEAM_H, [-1.2, -2.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(screws([[plan.x + 3, plan.y + plan.d / 2], [plan.x + plan.w - 3, plan.y + plan.d / 2]], BEAM_Z + BEAM_H, 0.45));
  return out.join("");
}

function trays() {
  const out = [];
  TRAYS.forEach((plan) => {
    out.push(slab(plan, TRAY_Z, TRAY_H, { tone: "mid" }, 3, 0.4));
    out.push(screws(k.corners(plan, 2.6), TRAY_Z + TRAY_H, 0.4));
  });
  // One ringed slot per job, with its status lamp in front.
  SLOT_X.forEach((x, index) => {
    out.push(L(k.ring(x, SLOT_Y, PUCK_R + 1.4, TRAY_Z + TRAY_H, P, 40), { tone: "lo" }));
    out.push(L(k.ring(x, SLOT_Y, PUCK_R + 2.6, TRAY_Z + TRAY_H, P, 40), { tone: "faint" }));
    // Status lamp in front of the slot.
    out.push(cyl(x, LAMP_Y, 3, PLINTH_H, 1.4, { tone: "mid" }, 20));
    out.push(`<path class="gr-lamp" data-job="${index}" data-state="created" d="${k.ring(x, LAMP_Y, 2.1, PLINTH_H + 1.4, P, 24)}Z"/>`);
  });
  // Stage marks: one tick per stage on the plinth top in front of each tray.
  STAGES.forEach((_, stage) => {
    const plan = TRAYS[stage];
    for (let i = 0; i <= stage; i++) out.push(D([at([plan.x + 4 + i * 2.6, LAMP_Y + 6, PLINTH_H])], { size: 0.6, tone: "hi" }));
  });
  return out.join("");
}

// A job: a turned puck whose key is its tag. `docker` is a key along y, `prod` a key along x.
function puck(job) {
  const out = [cyl(0, 0, PUCK_R, 0, PUCK_H, { tone: "hi", crease: "lo" }, 40, 0.6)];
  out.push(L(k.sideArc(0, 0, PUCK_R, 2, P, 32), { tone: "faint" }));
  out.push(L(k.ring(0, 0, PUCK_R - 2, PUCK_H, P, 32), { tone: "faint" }));
  const key = job.tags.includes("prod") ? { x: -5, y: -1.1, w: 10, d: 2.2, r: 0.6 } : { x: -1.1, y: -5, w: 2.2, d: 10, r: 0.6 };
  out.push(slab(key, PUCK_H, KEY_H, { tone: "hi", crease: "lo" }, 2, 0));
  return `<g class="gr-puck" data-puck="${job.index}">${out.join("")}</g>`;
}

function rails(rx) {
  const out = [];
  for (const dx of [-12, 8]) {
    const plan = { x: rx + dx, y: RAIL_FROM, w: 4, d: RAIL_TO - RAIL_FROM, r: 1 };
    out.push(slab(plan, 0, CAR_Z, { tone: "mid" }, 2, 0.4));
    out.push(screws([RAIL_FROM + 6, 26, RAIL_TO - 6].map((y) => [rx + dx + 2, y]), CAR_Z, 0.4));
  }
  for (const y of [RAIL_FROM - 4, RAIL_TO]) {
    out.push(slab({ x: rx - 15, y, w: 30, d: 4, r: 1 }, 0, 7, { tone: "mid" }, 2, 0.4));
    out.push(screws([[rx - 12, y + 2], [rx + 12, y + 2]], 7, 0.4));
  }
  // A ruler between the rails: the carriage's stroke.
  const strip = { x: rx - 6, y: HOME_Y + 14, w: 12, d: WORK_Y - HOME_Y - 28, r: 1 };
  out.push(slab(strip, 0, 0.5, { tone: "lo", crease: "none" }, 2, 0));
  const ticks = k.topTicks(strip.y + 3, strip.y + strip.d - 3, 4, 5, strip.x + 0.4, 0.5, [1.6, 3.2], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function carriage(rx, runner) {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan({ ...CAR, x: rx + CAR.x, y: HOME_Y + CAR.y }, 3), CAR_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  const plan = { ...CAR, x: rx + CAR.x, y: HOME_Y + CAR.y };
  for (const dx of [-12, 8]) for (const dy of [-11, 4]) out.push(slab({ x: rx + dx - 1, y: HOME_Y + dy, w: 6, d: 7, r: 1 }, CAR_Z, 2, { tone: "lo" }, 2, 0.3));
  out.push(slab(plan, CAR_Z + 2, CAR_TOP - CAR_Z - 2, { tone: "mid" }, 4, 0.6));
  out.push(screws(k.corners(plan, 2.8), CAR_TOP, 0.45));
  // The seat: keyways for every tag this runner carries.
  out.push(cyl(rx, HOME_Y, SEAT_R, CAR_TOP, 2, { tone: "mid" }, 36, 0.5));
  out.push(L(k.ring(rx, HOME_Y, PUCK_R + 0.6, SEAT_TOP, P, 36), { tone: "lo" }));
  const ways = [];
  if (runner.tags.includes("docker")) ways.push([[rx - 1.4, HOME_Y - SEAT_R + 0.6], [rx + 1.4, HOME_Y - SEAT_R + 0.6]], [[rx - 1.4, HOME_Y + SEAT_R - 0.6], [rx + 1.4, HOME_Y + SEAT_R - 0.6]]);
  if (runner.tags.includes("prod")) ways.push([[rx - SEAT_R + 0.6, HOME_Y - 1.4], [rx - SEAT_R + 0.6, HOME_Y + 1.4]], [[rx + SEAT_R - 0.6, HOME_Y - 1.4], [rx + SEAT_R - 0.6, HOME_Y + 1.4]]);
  out.push(L(ways.map(([a, b]) => k.lineOnTop(a, b, SEAT_TOP, P)).join(""), { tone: "hi" }));
  return out.join("");
}

// The carriage's drag handle on its +x face. At the executor it passes in front of the
// press post while the carriage body stays behind it, so it is painted in its own slot.
function carriageGrip(rx) {
  const out = [];
  const grip = HOME_Y + 9;
  out.push(slab({ x: rx + CAR.x + CAR.w, y: grip - 2, w: 2.6, d: 4, r: 0.8 }, CAR_Z + 3, 2.4, { tone: "mid", crease: "none" }, 2, 0));
  out.push(cyl(rx + CAR.x + CAR.w + 5, grip, 2.6, CAR_Z + 2, 4.4, { tone: "mid" }, 20));
  out.push(L(k.knurl(rx + CAR.x + CAR.w + 5, grip, 2.6, CAR_Z + 2, CAR_Z + 6.4, 18, P), { tone: "lo" }));
  return out.join("");
}

function pressPost(rx, dx) {
  const out = [];
  out.push(slab({ x: rx + dx - 2, y: WORK_Y - 8, w: 10, d: 16, r: 1.2 }, 0, 2, { tone: "lo" }, 2, 0.3));
  out.push(slab({ x: rx + dx, y: WORK_Y - 5, w: 6, d: 10, r: 1 }, 2, PRESS_Z - 2, { tone: "mid" }, 2, 0.4));
  out.push(screws([[rx + dx + 3, WORK_Y - 6.6], [rx + dx + 3, WORK_Y + 6.6]], 2, 0.4));
  return out.join("");
}

function pressTop(rx) {
  const out = [];
  const plan = { x: rx - 24, y: WORK_Y - 7, w: 48, d: 14, r: 1.5 };
  out.push(slab(plan, PRESS_Z, PRESS_H, { tone: "mid" }, 3, 0.6));
  out.push(screws([[rx - 21, WORK_Y], [rx + 21, WORK_Y]], PRESS_Z + PRESS_H, 0.45));
  // The ram's cylinder housing.
  out.push(cyl(rx, WORK_Y, 5.6, PRESS_Z + PRESS_H, 7, { tone: "mid" }, 28, 0.4));
  out.push(L(k.sideArc(rx, WORK_Y, 5.6, PRESS_Z + PRESS_H + 3, P, 20), { tone: "faint" }));
  out.push(cyl(rx, WORK_Y, 3.4, PRESS_Z + PRESS_H + 7, 2, { tone: "mid" }, 20));
  // Progress gauge: the job's elapsed share of its run.
  const g = [rx + 15, WORK_Y];
  out.push(cyl(g[0], g[1], 6.4, PRESS_Z + PRESS_H, 2.6, { tone: "hi", crease: "lo" }, 36, 0.4));
  out.push(L(k.ring(g[0], g[1], 5, PRESS_Z + PRESS_H + 2.6, P, 36), { tone: "lo" }));
  const ticks = k.radialTicks(g[0], g[1], 5, 20, 5, PRESS_Z + PRESS_H + 2.6, [0.9, 1.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(g[0], g[1], 0.9, PRESS_Z + PRESS_H + 2.6, P, 12), { tone: "mid" }));
  return out.join("");
}

const GAUGE_TOP = PRESS_Z + PRESS_H + 2.6;
const needleAt = (rx, share) => {
  const angle = share * Math.PI * 2;
  const [x, y] = [rx + 15, WORK_Y];
  return k.lineOnTop([x - Math.sin(angle) * 1.6, y + Math.cos(angle) * 1.6], [x + Math.sin(angle) * 4.3, y - Math.cos(angle) * 4.3], GAUGE_TOP + 0.1, P);
};

const ramSvg = (rx, z) =>
  (rec(A.cylinder(rx, WORK_Y, 2.2, z + 2.4, PRESS_Z - z - 2.4)), rec(A.cylinder(rx, WORK_Y, 5.2, z, 2.4)), "") +
  k.solidSvg(k.cylinder(rx, WORK_Y, 2.2, z + 2.4, PRESS_Z - z - 2.4, P, 18), { tone: "hi", crease: "none" }) +
  k.solidSvg(k.cylinder(rx, WORK_Y, 5.2, z, 2.4, P, 28, 0.4), { tone: "hi", crease: "lo" });

function cabinet(rx, index) {
  const out = [];
  const plan = { ...CABINET, x: rx + CABINET.x, y: CABINET.y };
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, 0, CABINET_H, P)}" style="opacity:.5"/>`);
  rec(A.slab(plan, 0, CABINET_H));
  out.push(S(k.slabOf(plan, 0, CABINET_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 5, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 3), CABINET_H, P, 4), { tone: "faint" }));
  out.push(screws(k.corners(plan, 1.8), CABINET_H, 0.45));
  // Top: poll lamp, tag plate, pause switch.
  const lamp = [plan.x + 8, plan.y + 10];
  out.push(cyl(lamp[0], lamp[1], 3.6, CABINET_H, 2, { tone: "mid" }, 24));
  out.push(`<path class="gr-lamp" data-runner="${index}" data-state="idle" d="${k.ring(lamp[0], lamp[1], 2.5, CABINET_H + 2, P, 24)}Z"/>`);
  const tag = { x: plan.x + 5, y: plan.y + 19, w: 14, d: 14, r: 1.2 };
  out.push(slab(tag, CABINET_H, 0.8, { tone: "mid" }, 3, 0.3));
  out.push(L(k.ring(tag.x + 7, tag.y + 7, 5, CABINET_H + 0.8, P, 28), { tone: "lo" }));
  const runner = RUNNERS[index];
  const ways = [];
  if (runner.tags.includes("docker")) ways.push([[tag.x + 7, tag.y + 3], [tag.x + 7, tag.y + 11]]);
  if (runner.tags.includes("prod")) ways.push([[tag.x + 3, tag.y + 7], [tag.x + 11, tag.y + 7]]);
  out.push(L(ways.map(([a, b]) => k.lineOnTop(a, b, CABINET_H + 0.8, P)).join(""), { tone: "hi" }));
  out.push(screws([[tag.x + 1.6, tag.y + 1.6], [tag.x + 12.4, tag.y + 12.4]], CABINET_H + 0.8, 0.35));
  out.push(toggle(index, [plan.x + 12, plan.y + 43]));
  return out.join("");
}

// The runner's pause switch: a bat-handle toggle, forward is ON (polling), back is OFF.
const SWITCH = RUNNER_X.map((rx) => [rx + CABINET.x + 12, CABINET.y + 43]);
const LEVER_BASE = CABINET_H + 0.8 + 0.9 + 1.8;
const LEVER_ANGLES = Array.from({ length: 9 }, (_, i) => -26 + i * 6.5);
const BALL = { c: 7.7, r: 1.35, neck: 0.72 };
const LEVER_PROFILE = (() => {
  const from = Math.asin(BALL.neck / BALL.r);
  const out = [[0, 1.05], [0.7, 1.05], [BALL.c - BALL.r * Math.cos(from), BALL.neck]];
  for (let i = 1; i <= 12; i++) {
    const phi = from + ((Math.PI - from) * i) / 12;
    out.push([BALL.c - BALL.r * Math.cos(phi), BALL.r * Math.sin(phi), 1]);
  }
  return out;
})();
const leverSvg = ([x, y], degrees) => {
  const a = (degrees * Math.PI) / 180;
  const F = G.frameAlong([x, y, LEVER_BASE], [0, Math.sin(a), Math.cos(a)]);
  rec(A.solid(F, LEVER_PROFILE));
  return S(G.solidOf(LEVER_PROFILE, F, P, { steps: 20, rows: 3 }), { tone: "hi", crease: "lo" });
};

function toggle(index, [x, y]) {
  const out = [];
  const plate = { x: x - 5, y: y - 6.5, w: 10, d: 13, r: 1.2 };
  out.push(slab(plate, CABINET_H, 0.8, { tone: "mid" }, 3, 0.3));
  out.push(screws([[plate.x + 1.8, plate.y + 1.8], [plate.x + plate.w - 1.8, plate.y + plate.d - 1.8]], CABINET_H + 0.8, 0.35));
  // ON mark (a dot) toward the front, OFF mark (a ring) toward the back.
  out.push(D([at([x - 3, y + 4.4, CABINET_H + 0.8])], { size: 0.65, tone: "hi" }));
  out.push(L(k.ring(x + 3, y - 4.4, 0.75, CABINET_H + 0.8, P, 14), { tone: "mid" }));
  rec(A.cylinder(x, y, 2.4, CABINET_H + 0.8, 0.9));
  out.push(S(k.cylinder(x, y, 2.6, CABINET_H + 0.8, 0.9, P, 6), { tone: "mid" }));
  out.push(cyl(x, y, 1.7, CABINET_H + 1.7, 1.8, { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 1.7, CABINET_H + 2.6, P, 14), { tone: "faint" }) }, 18));
  out.push(`<g data-lever="${index}">${leverSvg([x, y], pose.lever[index])}</g>`);
  const hit = k.slabOf(k.insetPlan(plate, -2), CABINET_H, 12, P, 3).fill;
  return `<g class="gr-ctl" data-switch="${index}">${out.join("")}<path class="gr-hit" d="${hit}"/></g>`;
}

// The runner's API cable: from the cabinet's back, along the plate, into the coordinator's port.
const cabinetPlug = (rx) => [[rx + CABLE_X, CABINET.y, 7], [0, -1, 0], 1];
const cableOf = (rx) => {
  const x = rx + CABLE_X;
  const from = plugEnd(...cabinetPlug(rx));
  const to = plugEnd([x, FRONT + 2.5, PORT_Z], [0, 1, 0]);
  return [from, [x, from[1] - 2.6, 7], [x, from[1] - 7, 0.9], [x, FRONT + 15, 0.9], [x, to[1] + 3, PORT_Z], to];
};

// The drawn stroke is 2.6 px wide: its radius in world units.
const CABLE_R = 1.3 / A.cameraBasis(P).k;
const route = (name, points, svg) => {
  const tubes = R.route(name, points, CABLE_R, { touch: ["stand.*"] });
  R.put({ name, key: R.items.length, shapes: tubes, svg, route: name });
  return svg;
};

function cable(rx, index) {
  return route(`cable.${index}`, cableOf(rx), cableSvg(rx, index)) + part(`cable.${index}.plug`, () => plug(...cabinetPlug(rx)));
}
function cableSvg(rx, index) {
  const points = cableOf(rx).map(at);
  const d = k.pathOf(points);
  return [
    `<path class="gr-cable" d="${d}"/>`,
    k.wireSvg(points[0], points[points.length - 1], { via: points.slice(1, -1), tone: "mid", size: 1.1 }),
    `<path class="iso-line gr-trace" data-runner="${index}" data-tone="lit" data-flow="" d="${d}" style="opacity:0"/>`,
    `<circle class="gr-pulse" data-runner="${index}" r="1.7" cx="${points[0][0]}" cy="${points[0][1]}" style="opacity:0"/>`,
  ].join("");
}

// Quill and gripper, hanging from the bridge down to the gripper's bottom at z.
const quillSvg = (z) =>
  (rec(A.cylinder(0, 0, 1.8, z + GRIP_H, BRIDGE_Z - z - GRIP_H)), rec(A.cylinder(0, 0, 4.4, z, GRIP_H)), "") +
  k.solidSvg(k.cylinder(0, 0, 1.8, z + GRIP_H, BRIDGE_Z - z - GRIP_H, P, 16), { tone: "mid", crease: "none" }) +
  k.solidSvg(k.cylinder(0, 0, 4.4, z, GRIP_H, P, 28, 0.3), { tone: "mid", crease: "lo" }) +
  k.lineSvg(k.sideArc(0, 0, 4.4, z + 1.2, P, 20), { tone: "faint" });

function bridge() {
  const out = [];
  // A cantilever arm riding on the beam, so nothing stands in front of the trays:
  // it rests on the beam's top and a bearing block runs on its front face.
  const shoe = { x: -13, y: BEAMS[0].y + BEAMS[0].d, w: 26, d: 3, r: 1 };
  out.push(slab(shoe, BEAM_Z - 3, BEAM_H + 3, { tone: "mid" }, 2, 0.4));
  out.push(screws([[-10, shoe.y + shoe.d / 2], [10, shoe.y + shoe.d / 2]], BEAM_Z + BEAM_H, 0.4));
  out.push(slab(BRIDGE, BRIDGE_Z, BRIDGE_H, { tone: "mid" }, 2, 0.5));
  const gusset = { x: -5, y: shoe.y + shoe.d, w: 10, d: 10, r: 1 };
  out.push(slab(gusset, BRIDGE_Z - 4, 4, { tone: "mid" }, 2, 0.3));
  out.push(L(k.lineOnTop([0, BRIDGE.y], [0, BRIDGE.y + BRIDGE.d], BRIDGE_Z + BRIDGE_H, P), { tone: "faint" }));
  out.push(screws([[-5, BRIDGE.y + 3], [5, BRIDGE.y + 3], [-5, BRIDGE.y + BRIDGE.d - 3], [5, BRIDGE.y + BRIDGE.d - 3]], BRIDGE_Z + BRIDGE_H, 0.4));
  return out.join("");
}

function head() {
  const out = [];
  out.push(slab(HEAD, HEAD_Z, HEAD_H, { tone: "mid" }, 3, 0.6));
  out.push(screws(k.corners(HEAD, 2.4), HEAD_Z + HEAD_H, 0.45));
  out.push(cyl(0, 0, 5.4, HEAD_Z + HEAD_H, 5, { tone: "mid" }, 28, 0.4));
  out.push(L(k.sideArc(0, 0, 5.4, HEAD_Z + HEAD_H + 2, P, 20), { tone: "faint" }));
  out.push(cyl(0, 0, 3, HEAD_Z + HEAD_H + 5, 2.4, { tone: "mid" }, 20));
  out.push(L(k.knurl(0, 0, 3, HEAD_Z + HEAD_H + 5, HEAD_Z + HEAD_H + 7.4, 16, P), { tone: "lo" }));
  return out.join("");
}

// A moment of the machine: where the gantry is (quill bottom at z), where each puck is
// ("slot", "carry", or the index of the runner whose seat holds it), each carriage's
// share of its stroke, each ram's z and each switch's lever angle.
const REST = { g: [SLOT_X[0], SLOT_Y, UP], at: JOBS.map(() => "slot"), drive: [0, 0], ram: [RAM_REST, RAM_REST], lever: [26, 26] };
let pose = REST;
const seedSim = createSim({ slot: () => [0, 0], seat: () => [0, 0], up: 0, atSlot: 0, atSeat: 0 });

// Painter's order, back to front, bottom to top. A puck is drawn where it sits:
// in its slot, in a runner's seat, or under the gantry's quill.
function scene(at) {
  pose = at;
  R = A.recorder(P);
  const [gx, gy, gz] = pose.g;
  const puckPart = (index, offset) => part(`puck.${index}`, () => puck({ ...JOBS[index], index }), offset);
  const body = [part("stand", plate), part("plinth", plinth), part("gantry.back", gantryBack)];
  body.push(part("trays", trays));
  body.push(`<g data-layer="slots">${byDepth(SLOT_X.map((x, index) => [x, SLOT_Y, index])).map(([x, y, index]) => {
    const offset = [x, y, TRAY_Z + TRAY_H];
    const held = pose.at[index] === "slot" ? `<g data-hold-puck="${index}" transform="${k.translateAlong(P, offset)}">${puckPart(index, offset)}</g>` : "";
    return `<g data-slot="${index}">${held}</g>`;
  }).join("")}</g>`);
  const cards = () => seedSim.commits.slice(-KEEP).map((commit, index, list) => {
    const slot = list.length - 1 - index;
    const svg = part(`card.${slot}`, () => (cardShape(), cardTemplate), [0, CARD_FRONT - slot * CARD_PITCH, 0]);
    return `<g data-card="${commit.number}" transform="${cardAt(slot)}">${svg.replace("__STATUS__", commit.status).replace("__SHA__", commit.sha).replace("__NUM__", `#${commit.number}`)}</g>`;
  });
  RUNNER_X.forEach((rx, index) => body.push(cable(rx, index)));
  RUNNER_X.forEach((rx, index) => {
    const n = (name) => `${name}.${index}`;
    const travel = [0, pose.drive[index] * (WORK_Y - HOME_Y), 0];
    const seated = () => pose.at.map((where, job) => [where, job]).filter(([where]) => where === index).map(([, job]) => {
      const offset = [rx, HOME_Y + travel[1], SEAT_TOP];
      return `<g data-hold-puck="${job}" transform="${k.translateAlong(P, [rx, HOME_Y, SEAT_TOP])}">${puckPart(job, offset)}</g>`;
    });
    body.push(part(n("press.post.back"), () => pressPost(rx, -22)));
    body.push(part(n("rails"), () => rails(rx)));
    body.push(`<g data-carriage="${index}">${part(n("carriage"), () => carriage(rx, RUNNERS[index]), travel)}<g data-seat="${index}">${seated().join("")}</g></g>`);
    body.push(`<g data-ram="${index}">${part(n("ram"), () => ramSvg(rx, pose.ram[index]))}</g>`);
    body.push(part(n("press.post.front"), () => pressPost(rx, 16)));
    body.push(`<g data-grip="${index}">${part(n("carriage.grip"), () => carriageGrip(rx), travel)}</g>`);
    body.push(part(n("press.top"), () => pressTop(rx)));
    body.push(`<path class="iso-line" data-needle="${index}" data-tone="lit" data-free="start" style="stroke-width:1" d="${needleAt(rx, 0)}"/>`);
    body.push(part(n("cabinet"), () => cabinet(rx, index)));
    if (index === 0) body.push(pushLine(), part("rack.back", rackBack), `<g data-cards>${cards().join("")}</g>`, part("rack.front", rackFront));
  });
  const carried = pose.at.map((where, job) => [where, job]).filter(([where]) => where === "carry").map(([, job]) => puckPart(job, [gx, gy, gz - PUCK_TOP]));
  body.push(`<g data-quill>${part("quill", () => quillSvg(gz), [gx, gy, 0])}</g><g data-carry>${carried.join("")}</g>`);
  body.push(`<g data-bridge>${part("bridge", bridge, [gx, 0, 0])}<g data-head>${part("head", head, [gx, gy, 0])}</g></g>`);
  return body;
}
const body = scene(REST);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A GitLab coordinator drawn as a cabinet holding three stage trays of job pucks (build, test, deploy), a rack of commit cards with a push button, a gantry above it, and two runner stations in front, each with a pause switch. Every push raises a commit card whose top band shows that commit's pipeline status. Each runner asks the coordinator for work over its cable every 3 seconds; when a pending job's key matches the runner's keyways, the gantry hands the puck to the runner, whose carriage takes it to the executor press, runs it, then brings it back and reports the result.",
  body,
});

const CSS = `
.gr-cable{fill:none;stroke:var(--anatomy-shade-0);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.gr-lamp{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);transition:fill .35s}
.gr-lamp[data-state="pending"],.gr-lamp[data-state="idle"]{fill:var(--anatomy-mid)}
.gr-lamp[data-state="running"],.gr-lamp[data-state="polling"],.gr-lamp[data-state="busy"]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.gr-lamp[data-state="passed"]{fill:var(--anatomy-green);stroke:var(--anatomy-green)}
.gr-lamp[data-state="paused"]{fill:var(--anatomy-shade-0);stroke:var(--anatomy-faint)}
.gr-pulse{fill:var(--anatomy-lit);stroke:var(--anatomy-paper);stroke-width:.6}
.gr-pulse[data-kind="none"]{fill:var(--anatomy-paper);stroke:var(--anatomy-mid)}
.gr-trace{transition:opacity .4s}
.gr-band{fill:var(--anatomy-mid);stroke:none;transition:fill .3s}
.gr-band[data-status="running"]{fill:var(--anatomy-lit)}
.gr-band[data-status="passed"]{fill:var(--anatomy-green)}
.gr-band[data-status="canceled"]{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:.4}
.gr-ctl{cursor:pointer}
.gr-hit{fill:transparent;stroke:none;pointer-events:all}
.gr-ctl:hover .iso-edge{stroke:var(--anatomy-lit)}
.gr-ctl:focus{outline:none}
.iso-stage{outline:none;touch-action:pan-y}
@media (max-width:560px){.iso-plate-corner[data-corner="hint"]{white-space:normal;right:0;line-height:1.5}}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (prefers-reduced-motion:reduce){.gr-lamp,.gr-trace,.gr-band{transition:none}}
`;

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const DATA = {
  P,
  slotX: SLOT_X,
  slotY: SLOT_Y,
  runnerX: RUNNER_X,
  homeY: HOME_Y,
  workY: WORK_Y,
  trayTop: TRAY_Z + TRAY_H,
  seatTop: SEAT_TOP,
  puckTop: PUCK_TOP,
  atSlot: AT_SLOT,
  atSeat: AT_SEAT,
  up: UP,
  ramRest: RAM_REST,
  bridgeZ: BRIDGE_Z,
  pressZ: PRESS_Z,
  gripH: GRIP_H,
  gaugeTop: GAUGE_TOP,
  cables: RUNNER_X.map(cableOf),
  levers: SWITCH.map((at) => LEVER_ANGLES.map((angle) => leverSvg(at, angle))),
  leverAngles: LEVER_ANGLES,
  card: cardTemplate,
  pushCable: pushCable(),
  cardFront: CARD_FRONT,
  cardPitch: CARD_PITCH,
  cardH: CARD.h + 1,
};
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));

const bodyHtml = `<style>${CSS}</style>` + k.plateHtml({
  fig: "Fig 1",
  title: "GitLab Runner",
  hint: "Button: push · switch: pause runner",
  readout: "",
  keys: [
    { mark: "lit", label: "The job being run, and the runner's request on its cable" },
    { mark: "green", label: "Job passed" },
    { mark: "raised", label: "Keys = tags: docker along, prod across; a runner's tag plate and seat show the keys it accepts" },
    { mark: "dim", label: "Commit card band: pipeline pending, running, passed, or hollow when canceled" },
  ],
  caption:
    "GitLab never pushes work to a runner. Each runner asks the coordinator for a job every 3 s (check_interval) over its own cable; GitLab hands over the oldest pending job whose tags the runner has (a puck whose key fits the seat), or nothing. The runner carries the job to its executor, streams the log back while it runs and reports the result. Only when every job of a stage has passed do the next stage's jobs become pending: runner-a has only docker, so deploy (prod) waits for runner-b. Each push raises a commit card and creates a pipeline for that commit; the card's band carries the pipeline's status. These jobs are interruptible, so pushing while a pipeline runs cancels it (hollow band): the runners abort, bring their jobs back, and the jobs reset for the new commit. Flip runner-b's switch back and deploy stays stuck.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="GitLab Runner figure. Click the push button on the coordinator, or press Enter, to push a new commit; it creates a new pipeline and cancels a running one. Click a runner's switch, or press 1 for runner-a and 2 for runner-b, to pause or resume that runner.">${svg}<span class="gr-sr" role="status" aria-live="polite" data-status style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></span></div>`,
});

const file = theme === "light" ? "gitlab-runner-light.html" : "gitlab-runner.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "GitLab Runner", theme, body: bodyHtml, script: kitScript() + modelSource + LIVE, width: 720 }));
console.log("wrote", file);

if (process.argv.includes("--audit")) {
  const with_ = (changes) => ({ ...REST, ...changes });
  const at = (pairs) => JOBS.map((_, job) => (job in pairs ? pairs[job] : "slot"));
  const seat = (i) => [RUNNER_X[i], HOME_Y];
  const poses = [
    ["rest", REST],
    ...SLOT_X.map((x, s) => [`grip slot ${s}`, with_({ g: [x, SLOT_Y, AT_SLOT] })]),
    ...SLOT_X.map((x, s) => [`lift from slot ${s}`, with_({ g: [x, SLOT_Y, AT_SLOT + 12], at: at({ [s]: "carry" }) })]),
    ["carry mid-air", with_({ g: [(SLOT_X[4] + RUNNER_X[0]) / 2, (SLOT_Y + HOME_Y) / 2, UP], at: at({ 4: "carry" }) })],
    ...[0, 1].map((i) => [`over seat ${i}`, with_({ g: [...seat(i), UP], at: at({ [i * 4]: "carry" }) })]),
    ...[0, 1].map((i) => [`set on seat ${i}`, with_({ g: [...seat(i), AT_SEAT], at: at({ [i * 4]: "carry" }) })]),
    ...[0, 1].map((i) => [`released on seat ${i}`, with_({ g: [...seat(i), AT_SEAT], at: at({ [i * 4]: i }) })]),
    ["carriages mid-stroke", with_({ at: at({ 1: 0, 4: 1 }), drive: [0.5, 0.5] })],
    ["pressing", with_({ at: at({ 1: 0, 4: 1 }), drive: [1, 1], ram: [AT_SEAT, AT_SEAT] })],
    ["running", with_({ at: at({ 1: 0, 4: 1 }), drive: [1, 1], ram: [AT_SEAT + 1.4, AT_SEAT + 1.4] })],
    ["empty at executor", with_({ drive: [1, 1] })],
    ["paused", with_({ lever: [-26, -26] })],
    ...[-13, 0, 13].map((a) => [`lever ${a}`, with_({ lever: [a, a] })]),
  ];
  let total = 0;
  for (const [label, moment] of poses) {
    scene(moment);
    R.settled = { items: R.items, overlaps: A.overlapsOf(R.items, P, { states: [0], skip: A.sameRun }), solved: { dropped: [], rules: 0 }, states: [0] };
    const result = A.audit(R, P, { frames: [], apart: false });
    const count = A.failures(result);
    total += count;
    console.log(`${label}: ${count ? `${count} problem${count === 1 ? "" : "s"}` : "ok"} · ${R.solids.length} solids · ${R.settled.overlaps.pairs.length} overlaps`);
    if (count) console.log(A.report(result).split("\n").filter((line) => !/: 0( |$)|^(in passing|loose ends: 0)/.test(line)).map((line) => `    ${line}`).join("\n"));
  }
  console.log(total ? `audit failed: ${total} problems over ${poses.length} poses` : `audit passed over ${poses.length} poses`);
  if (total) process.exitCode = 1;
}
