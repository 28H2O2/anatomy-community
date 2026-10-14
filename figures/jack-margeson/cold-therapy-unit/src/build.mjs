import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg, runsOf, crossingsOf } from "../../../../.skill/kit/tube.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { MODEL, FLOW, DIAL_RANGE, model } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

const W = 600;
const H = 400;

const PLATE = { x: -140, y: -72, w: 290, d: 150, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const TANK = { x: -126, y: -46, w: 92, d: 84, r: 1 };
const WALL = 7;
const TANK_Z = 3;
const FLOOR_Z = TANK_Z + WALL;
const RIM_Z = 92;
const SILL_Z = 24;
const WATER_Z = 58;
const FILL_Z = 63;
const INNER = { x: TANK.x + WALL, y: TANK.y + WALL, w: TANK.w - 2 * WALL, d: TANK.d - 2 * WALL, r: 0.5 };
const LID = { x: TANK.x - 1.5, y: TANK.y - 1.5, w: TANK.w + 3, d: TANK.d + 3, r: 7 };
const LID_TOP = 104;
const PORT_Z = 98;
const LID_X = LID.x + LID.w;
const LID_Y = LID.y + LID.d;

const PUMP = [-92, -8];
const DROP = [-60, 8];
const KNOB = [-102, 8];
const KNOB_TOP = LID_TOP + 0.8 + 1.2 + 7;
const KNOB_SWEEP = [-Math.PI, Math.PI * 1.5];
const DIAL = [-60, 8];
const DIAL_R = 12;
const DIAL_TOP = LID_TOP + 7;

const XL = 88;
const ZL = 40;
const LEG = [-62, 62];
const WRAP = [-20, 20];
const HOSE_Y = [-6, 6];
const HOSE_R = 2.2;

const limb = (s) => 20.5 - 0.075 * s + 2 * Math.exp(-((s / 13) ** 2));
const limbSlope = (s) => -0.075 - ((2 * 2 * s) / 169) * Math.exp(-((s / 13) ** 2));
const wrap = (s) => limb(s) + 3.2;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-109, -33.5, 119], [XL, LEG[0], ZL + 26], [-51, -33.5, 119]],
  W,
  H,
  { pad: 30, azimuth: 45 },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f2 = (v) => Math.round(v * 100) / 100;

const R = A.recorder(P);
const record = R.solid;
const INSIDE = -600;
function put(name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "rig", ...rest });
}
function box(name, plan, z, h, style = {}, { steps = 3, bevel = 0, extra = "", inner = "", bias = 0, meta = {} } = {}) {
  const shape = record(A.slab(plan, z, h, { name, ...meta }, steps));
  put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
function post(name, [x, y], r, z, h, style = {}, { steps = 28, bevel = 0, extra = "", inner = "", bias = 0, meta = {} } = {}) {
  const shape = record(A.cylinder(x, y, r, z, h, { name, ...meta }));
  put(name, [x, y, z + h / 2], S(k.cylinder(x, y, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, smooth, bevel = 0, owner, radius = null } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth !== undefined ? { smooth } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, owner, radius }));
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
function padOn(name, host, point, outward, a, h, style = {}) {
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const inside = (p) => A.sdf(host, p) < 0;
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2)));
  const face = Ln(G.circleOf(F, h, a * 0.62, P, 20), { tone: "faint" });
  put(name, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone: "hi", ...style }) + face, [record(A.disc(F, low - 0.05, h, a, { name, seated: true, cut: [host] }))], { bias: 0.1 });
  return G.add3(point, G.mul3(axis, h));
}

const FLOWS = [];
function line(name, points, r, { tone = "hi", bend = 13, shell = 5, rim = 1.7, clips = [], rings, limp = false, touch, bundle, flow = 0, maxLength = 14 } = {}) {
  const route = G.fillet(points, bend, 12, { P, tube: r });
  const total = G.pathLength(route);
  const gaps = [[0, shell], [total - shell, total]];
  for (const clip of clips) for (const cross of crossingsOf(route, clip.centre, clip.axis, clip.reach)) gaps.push([cross - clip.half, cross + clip.half]);
  gaps.sort((a, b) => a[0] - b[0]);
  R.route(name, route, r, { gaps, limp, touch, bundle, rims: [r * rim, r * rim], piece: "rig" });
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.6, Math.min(1.4, r)), gaps, ...(rings ? { rings } : {}) }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii)], { bias: 0.05, route: name, chunk: index }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-shell, 0] : [0, shell];
    const shape = record(A.disc(F, s0, s1, r * rim, { name: `${name}.nut${index}`, owner: name }));
    const ribs = k.fadedSvg(G.ribsOf(F, s0, s1, r * rim, Math.round(r * rim * 5), P, { fade: [0.1, 0.55] }), { tone: "lo" });
    put(`${name}.nut${index}`, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * rim, F, P, { bevel: 0.2 }), { tone: "mid" }) + ribs, [shape], { bias: 0.15 });
  });
  if (flow) {
    for (const [from, to] of runsOf(total, gaps)) {
      const run = G.cut(route, from, to).map(at);
      FLOWS.push(flow > 0 ? run : run.reverse());
    }
  }
  return route;
}

/* ---------- static back layer: bench plate, tank floor and the two far walls ---------- */
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
  back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true }, 8));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
const plateScrews = k.corners(PLATE, 10);
back.push(Ln(plateScrews.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(plateScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

const STRIP = { x: -96, y: PLATE.y + PLATE.d - 13, w: 232, d: 6, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y, 0.6, [1.8, 3.4], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3, 0.6])], { size: 0.45 }));

const LABEL = { x: 2, y: 34, w: 36, d: 15, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 3), { tone: "faint" }));
back.push(Ln([[26, 4.4], [18, 7.4], [22, 10.4]].map(([length, dy]) => k.lineOnTop([LABEL.x + 4, LABEL.y + dy], [LABEL.x + 4 + length, LABEL.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + 2, LABEL.y + 7.5, 0.8]), at([LABEL.x + LABEL.w - 2, LABEL.y + 7.5, 0.8])], { size: 0.4 }));

for (const [x, y] of byDepth(k.corners(TANK, 10))) {
  back.push(S(k.cylinder(x, y, 4.2, 0, TANK_Z, P, 20), { tone: "lo" }));
  record(A.cylinder(x, y, 4.2, 0, TANK_Z, { name: R.nameFor("tank.foot") }));
}
back.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(TANK, 4), TANK_Z, 0.1, P)}" style="filter:blur(5px)"/>`);
back.push(S(k.slabOf(TANK, TANK_Z, WALL, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(TANK, TANK_Z + 3.5, P, 3), { tone: "faint" }) }));
record(A.slab(TANK, TANK_Z, WALL, { name: "tank.floor" }, 3));
const WALL_X = { x: TANK.x, y: TANK.y, w: WALL, d: TANK.d, r: 1 };
const WALL_Y = { x: TANK.x + WALL, y: TANK.y, w: TANK.w - WALL, d: WALL, r: 1 };
for (const [name, plan, core] of [
  ["tank.wall-x", WALL_X, [[TANK.x + WALL / 2, TANK.y + TANK.d, FLOOR_Z], [TANK.x + WALL / 2, TANK.y + TANK.d, RIM_Z]]],
  ["tank.wall-y", WALL_Y, [[TANK.x + TANK.w, TANK.y + WALL / 2, FLOOR_Z], [TANK.x + TANK.w, TANK.y + WALL / 2, RIM_Z]]],
]) {
  back.push(S(k.slabOf(plan, FLOOR_Z, RIM_Z - FLOOR_Z, P, 3), { tone: "mid", inner: Ln(k.sideSeam(plan, FILL_Z, P, 3), { tone: "lo" }) + Ln(k.segment(core[0], core[1], P), { tone: "faint" }) }));
  record(A.slab(plan, FLOOR_Z, RIM_Z - FLOOR_Z, { name }, 3));
}

/* ---------- inside the tank: pump on its riser, the return drop, ice ---------- */
const [px, py] = PUMP;
post("pump.strainer", PUMP, 10, 14, 5, { tone: "hi", crease: "lo" }, { bias: INSIDE, extra: Ln(k.knurl(px, py, 10, 14, 19, 30, P, 0), { tone: "lo" }) });
post("pump.body", PUMP, 9, 19, 11, { tone: "hi", crease: "lo" }, { bias: INSIDE, bevel: 0.6, extra: Ln(k.sideArc(px, py, 9, 26, P, 24), { tone: "faint" }) + Dots([[5, 0], [-2.5, 4.3], [-2.5, -4.3]].map(([dx, dy]) => at([px + dx, py + dy, 30])), { size: 0.45 }) });
post("pump.neck", PUMP, 4.6, 30, 3, { tone: "mid" }, { bias: INSIDE, steps: 20 });
post("pump.riser", PUMP, 3, 33, RIM_Z - 33, { tone: "mid", crease: "none" }, { bias: INSIDE, steps: 20, extra: Ln([42, 70, 86].map((z) => k.sideArc(px, py, 3, z, P, 14)).join(""), { tone: "faint" }) });
post("return.collar", DROP, 3.8, RIM_Z - 3, 3, { tone: "mid" }, { bias: INSIDE, steps: 20 });
post("return.drop", DROP, 2.6, 50, RIM_Z - 3 - 50, { tone: "mid", crease: "none" }, { bias: INSIDE, steps: 20, extra: Ln(k.sideArc(DROP[0], DROP[1], 2.6, 80, P, 14), { tone: "faint" }) });

const ICE = [[-108, -28, 0.3], [-90, -30, 1.0], [-72, -26, 0.6], [-54, -30, 0.2], [-106, -6, 0.9], [-74, -6, 0.1], [-54, -8, 0.7], [-108, 16, 0.5], [-88, 14, 1.2], [-72, 20, 0.3]];
const iceRing = ([x, y, turn], half = 4.8) => [0, 1, 2, 3].map((corner) => [x + half * Math.SQRT2 * Math.cos(turn + (corner * Math.PI) / 2), y + half * Math.SQRT2 * Math.sin(turn + (corner * Math.PI) / 2)]);
const iceTops = [];
for (const cube of byDepth(ICE)) {
  const ring = iceRing(cube);
  const name = R.nameFor("ice");
  put(name, [cube[0], cube[1], WATER_Z - 4], S(k.extrude(ring, WATER_Z - 9.2, 10.2, P), { tone: "hi", crease: "lo" }), [record(A.extruded(ring, WATER_Z - 9.2, 10.2, { name, ground: true }))], { bias: INSIDE });
  iceTops.push(S(k.extrude(ring, WATER_Z, 1, P), { tone: "hi", crease: "lo" }) + Ln(k.onTop(iceRing(cube, 2.6), WATER_Z + 1, P, true), { tone: "faint" }));
}
const water =
  S(k.slabOf(INNER, FLOOR_Z, WATER_Z - FLOOR_Z, P, 2), { tone: "mid", crease: "lo", className: "water" }) +
  Ln([PUMP, DROP].map(([x, y], index) => k.ring(x, y, index ? 5.4 : 6.4, WATER_Z, P, 24)).join(""), { tone: "lo" });

/* ---------- cooler: cut-down near walls, lid and what the lid carries ---------- */
const SILL_Y = { x: TANK.x + WALL, y: TANK.y + TANK.d - WALL, w: TANK.w - WALL, d: WALL, r: 1 };
const SILL_X = { x: TANK.x + TANK.w - WALL, y: TANK.y + WALL, w: WALL, d: TANK.d - 2 * WALL, r: 1 };
box("tank.sill-x", SILL_X, FLOOR_Z, SILL_Z - FLOOR_Z, {}, { extra: Ln(k.lineOnTop([SILL_X.x + WALL / 2, SILL_X.y], [SILL_X.x + WALL / 2, SILL_X.y + SILL_X.d], SILL_Z, P), { tone: "faint" }) });
box("tank.sill-y", SILL_Y, FLOOR_Z, SILL_Z - FLOOR_Z, {}, { extra: Ln(k.lineOnTop([SILL_Y.x, SILL_Y.y + WALL / 2], [SILL_Y.x + SILL_Y.w, SILL_Y.y + WALL / 2], SILL_Z, P), { tone: "faint" }) });

const lidScrews = k.corners(LID, 9);
box("lid", LID, RIM_Z, LID_TOP - RIM_Z, {}, {
  steps: 8,
  bevel: 1.2,
  inner: Ln(k.sideSeam(LID, RIM_Z + 3, P, 8), { tone: "faint" }),
  extra: Ln(k.planOutline(k.insetPlan(LID, 4), LID_TOP, P), { tone: "faint" }) + Ln(lidScrews.map(([x, y]) => k.ring(x, y, 1.8, LID_TOP, P, 14)).join(""), { tone: "lo" }) + Dots(lidScrews.map(([x, y]) => at([x, y, LID_TOP])), { size: 0.45 }),
});

for (const x of [-104, -56]) post(R.nameFor("handle.post"), [x, -30], 3, LID_TOP, 9, {}, { steps: 18 });
box("handle.bar", { x: -109, y: -33.5, w: 58, d: 7, r: 3.4 }, LID_TOP + 9, 5, {}, { steps: 6, bevel: 0.6, extra: Dots([at([-104, -30, LID_TOP + 14]), at([-56, -30, LID_TOP + 14])], { size: 0.45 }) });

const [kx, ky] = KNOB;
const knobTicks = k.radialTicks(kx, ky, 13, 9, 3, LID_TOP + 0.8, [2, 3.4], P, KNOB_SWEEP[0], KNOB_SWEEP[1]);
post("knob.scale", KNOB, 13, LID_TOP, 0.8, { tone: "lo", crease: "none" }, { steps: 48, extra: Ln(knobTicks.minor, { tone: "lo" }) + Ln(knobTicks.major, { tone: "mid" }) });
post("knob.collar", KNOB, 8.4, LID_TOP + 0.8, 1.2, {}, { steps: 32 });
post("knob", KNOB, 7, LID_TOP + 2, 7, { tone: "hi", crease: "lo" }, { steps: 36, bevel: 0.6, extra: Ln(k.knurl(kx, ky, 7, LID_TOP + 2, KNOB_TOP, 34, P, 0), { tone: "lo" }) });

const [dx, dy] = DIAL;
const dialTicks = k.radialTicks(dx, dy, DIAL_R - 2.4, 20, 5, DIAL_TOP, [1.4, 2.8], P, KNOB_SWEEP[0], KNOB_SWEEP[1]);
post("dial", DIAL, DIAL_R, LID_TOP, DIAL_TOP - LID_TOP, { tone: "hi", crease: "lo" }, {
  steps: 56,
  bevel: 0.8,
  inner: Ln(k.sideArc(dx, dy, DIAL_R, DIAL_TOP - 3, P, 36), { tone: "faint" }),
  extra:
    Ln(k.knurl(dx, dy, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 64, P, 0), { tone: "lo" }) +
    Ln(k.ring(dx, dy, DIAL_R - 2.4, DIAL_TOP, P, 56), { tone: "lo" }) +
    Ln(dialTicks.minor, { tone: "lo" }) +
    Ln(dialTicks.major, { tone: "mid" }) +
    Ln(k.ring(dx, dy, 1.5, DIAL_TOP, P, 14), { tone: "mid" }) +
    k.faceTextSvg(k.topMatrix([dx + 3.4, dy + 3.4], DIAL_TOP, P, "x"), "°C", { size: 2.6, tone: "lo", anchor: "middle" }),
});

const portFrame = (y) => G.frameOf([LID_X, y, PORT_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
HOSE_Y.forEach((y, index) => turned(`lid.port${index}`, portFrame(y), [[0, 4.6], [3, 4.6]], {}, { bevel: 0.3 }));
const JACK = G.frameOf([-110, LID_Y, PORT_Z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
turned("lid.jack", JACK, [[0, 2.8], [2.5, 2.8]], {}, { bevel: 0.2 });

/* ---------- limb form on its cradles, with the wrap pad ---------- */
const LIMB = G.frameOf([XL, 0, ZL], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const RAIL = { x: XL - 13, y: -52, w: 26, d: 104, r: 2 };
box("form.rail", RAIL, 0, 3, {}, { bevel: 0.4, extra: Dots([-46, -12, 12, 46].map((y) => at([XL + 10, y, 3])), { size: 0.45 }) });
for (const [from, to] of [[-45, -35], [35, 45]]) {
  const top = ZL - Math.max(limb(from), limb(to));
  box(R.nameFor("form.cradle"), { x: XL - 9, y: from, w: 18, d: to - from, r: 1.5 }, 3, top - 3, {}, { bevel: 0.4 });
}
const smooth = { slope: limbSlope, radius: limb };
const seamAt = (s, tone = "faint") => Ln(G.arcOf(LIMB, s, limb(s), P, { slope: limbSlope(s) }), { tone });
turned("form.thigh", LIMB, [[LEG[0], limb(LEG[0])], [WRAP[0], limb(WRAP[0])]], { tone: "mid" }, { smooth, radius: limb, inner: seamAt(-54) + seamAt(-28) });
const WRAP_SHAPE = turned("pad", LIMB, [[WRAP[0], wrap(WRAP[0])], [WRAP[1], wrap(WRAP[1])]], { tone: "hi", lit: true }, {
  smooth: { slope: limbSlope, radius: wrap },
  radius: wrap,
  inner: [-17, 17].map((s) => Ln(G.arcOf(LIMB, s, wrap(s), P, { slope: limbSlope(s) }), { tone: "mid" })).join("") + [-13.6, -10.2, -6.8, -3.4, 0, 3.4, 6.8, 10.2, 13.6].map((s) => Ln(G.arcOf(LIMB, s, wrap(s), P, { slope: limbSlope(s) }), { tone: "lo" })).join(""),
});
turned("form.shin", LIMB, [[WRAP[1], limb(WRAP[1])], [LEG[1], limb(LEG[1])]], { tone: "mid" }, {
  smooth,
  radius: limb,
  inner: seamAt(28) + seamAt(54),
  extra: Ln(G.circleOf(LIMB, LEG[1], 6, P, 28), { tone: "faint" }) + Dots([at([XL, LEG[1], ZL])], { size: 0.55 }),
});
const PADS = HOSE_Y.map((y, index) => padOn(`pad.port${index}`, WRAP_SHAPE, [XL, y, ZL + wrap(y)], [0, 0, 1], 4.4, 2.4, { lit: true }));

/* ---------- hoses: supply out, return back, clipped as a pair ---------- */
const stadium = G.stadium(3.9, 3.9, HOSE_Y[1] - HOSE_Y[0]).map(([x, y]) => [x + HOSE_Y[0], y]);
const CLIPS = [
  { name: "clip.a", F: G.frameOf([20, 0, PORT_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), half: 2.4 },
  { name: "clip.b", F: G.frameOf([XL, 0, 78], [0, 0, 1], [0, 1, 0], [-1, 0, 0]), half: 2.2 },
].map((clip) => ({ ...clip, centre: clip.F.o, axis: clip.F.a, reach: 11 }));
for (const clip of CLIPS) {
  const shape = record(A.prism(clip.F, stadium, -clip.half, clip.half, { name: clip.name, fitting: true }));
  put(clip.name, clip.F.o, S(G.prismOf(clip.F, stadium, -clip.half, clip.half, P), { tone: "mid" }), [shape], { bias: 0.1 });
}
HOSE_Y.forEach((y, index) =>
  line(index ? "hose.return" : "hose.supply", [[LID_X + 3, y, PORT_Z], [XL, y, PORT_Z], PADS[index]], HOSE_R, {
    clips: CLIPS,
    touch: CLIPS.map((clip) => clip.name),
    bundle: "twin",
    rings: { pitch: 2.6, fade: [0.1, 0.55] },
    flow: index ? -1 : 1,
  }),
);

/* ---------- power: jack on the lid, lead down to the supply brick ---------- */
const BRICK = { x: -121, y: 46, w: 22, d: 16, r: 2.5 };
box("brick", BRICK, 0, 9, {}, { steps: 4, bevel: 0.6, extra: Ln(k.planOutline(k.insetPlan(BRICK, 3), 9, P, 3), { tone: "faint" }) });
post("brick.relief", [-110, 54], 2.6, 9, 2.4, {}, { steps: 16 });
line("lead", [[-110, LID_Y + 2.5, PORT_Z], [-110, 54, PORT_Z], [-110, 54, 11.4]], 0.9, { tone: "mid", bend: 5, shell: 2.2, rim: 1.9, limp: true, maxLength: 16 });

/* ---------- order, audit, page ---------- */
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const split = R.items.findIndex((item) => item.key > INSIDE / 2);
const wrapItem = (item) => `<g class="it" data-name="${item.name}">${item.svg}</g>`;
const inside = R.items.slice(0, split).map(wrapItem).join("");
const outside = R.items.slice(split).map(wrapItem).join("");

const turnOf = (share) => KNOB_SWEEP[0] + share * KNOB_SWEEP[1];
const hand = ([x, y], angle, tail, tip, z) => k.lineOnTop([x - Math.sin(angle) * tail, y + Math.cos(angle) * tail], [x + Math.sin(angle) * tip, y - Math.cos(angle) * tip], z, P);
const START = FLOW.start;
const first = model(START);
const needleAt = (temperature) => hand(DIAL, turnOf(Math.min(1, Math.max(0, temperature / DIAL_RANGE))), 2.6, DIAL_R - 3.6, DIAL_TOP + 0.2);
const pointerAt = (flow) => hand(KNOB, turnOf((flow - FLOW.min) / (FLOW.max - FLOW.min)), 0, 6.4, KNOB_TOP);
const flowEnds = FLOWS.flatMap((run) => [run[0], run[run.length - 1]]);

const label =
  "A cold therapy unit on a bench. An insulated cooler, drawn with its two near walls cut down, holds ice water; a pump hanging from the lid on its riser sends the water out through one insulated hose to a pad wrapped round the knee of a limb form, and a second hose brings it back to the cooler, past a dial thermometer on the lid. A knob on the lid sets the flow.";
const svg = k.figureSvg({
  width: W,
  height: H,
  label,
  body: [
    back.join(""),
    inside,
    water,
    iceTops.join(""),
    outside,
    `<g data-part="flow">${FLOWS.map((run) => Ln(k.pathOf(run), { tone: "lit", flow: true, className: "flowline" })).join("")}${Dots(flowEnds, { size: 0.55, tone: "hi" })}</g>`,
    `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="start" d="${pointerAt(START)}" style="stroke-width:1.1"/>`,
    Dots([at([kx, ky, KNOB_TOP])], { size: 0.5, tone: "hi" }),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="${needleAt(first.back)}" style="stroke-width:1.1"/>`,
  ],
});

const DATA = { P, KNOB, DIAL, DIAL_R, DIAL_TOP, KNOB_TOP, KNOB_SWEEP, FLOW, DIAL_RANGE, MODEL };
const LIVE = `
const D = ${JSON.stringify(DATA)};
const P = D.P, MODEL = D.MODEL, FLOW = D.FLOW;
const model = ${model.toString()};
const turnOf = (share) => D.KNOB_SWEEP[0] + share * D.KNOB_SWEEP[1];
const hand = ([x, y], angle, tail, tip, z) => lineOnTop([x - Math.sin(angle) * tail, y + Math.cos(angle) * tail], [x + Math.sin(angle) * tip, y - Math.cos(angle) * tip], z, P);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const needle = svg.querySelector('[data-part="needle"]');
const pointer = svg.querySelector('[data-part="pointer"]');
const marks = [...svg.querySelectorAll(".flowline")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const sayOf = (flow, now) => Math.round(flow / 5) * 5 + " mL/min · pad " + now.pad.toFixed(1) + " °C · back " + now.back.toFixed(1) + " °C · ice " + now.hours.toFixed(1) + " h";
let flow = FLOW.start, target = flow, shown = model(flow).back, travel = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0;
function draw() {
  const now = model(flow);
  pointer.setAttribute("d", hand(D.KNOB, turnOf((flow - FLOW.min) / (FLOW.max - FLOW.min)), 0, 6.4, D.KNOB_TOP));
  needle.setAttribute("d", hand(D.DIAL, turnOf(clamp(shown / D.DIAL_RANGE, 0, 1)), 2.6, D.DIAL_R - 3.6, D.DIAL_TOP + 0.2));
  for (const mark of marks) mark.style.strokeDashoffset = (-travel).toFixed(2);
  const text = sayOf(flow, now);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(flow)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(time) {
  const dt = last ? Math.min((time - last) / 1000, 1 / 30) : 1 / 60;
  last = time;
  const calm = still.matches;
  if (touring) { clock += dt; target = FLOW.stops[Math.floor(clock / 3.4) % FLOW.stops.length]; }
  flow = calm ? target : flow + (target - flow) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(target - flow) < 0.05) flow = target;
  const want = model(flow).back;
  shown = calm ? want : shown + (want - shown) * (1 - Math.exp(-dt / 0.9));
  if (Math.abs(want - shown) < 0.004) shown = want;
  if (!calm) travel = (travel + dt * 22 * flow / FLOW.start) % 940;
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, FLOW.min, FLOW.max);
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(FLOW.min + clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1) * (FLOW.max - FLOW.min));
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + 30;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - 30;
  if (event.key === "Home") to = FLOW.min;
  if (event.key === "End") to = FLOW.max;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
still.addEventListener("change", () => { touring = !still.matches; run(); });
draw();
`;

const CSS = `<style>
.iso .water>.iso-fill{fill:var(--anatomy-hi);fill-opacity:.05}
.iso .water>.iso-shade{fill:var(--anatomy-hi);fill-opacity:.04}
.iso .water>.iso-top{fill:var(--anatomy-hi);fill-opacity:.1}
.iso .iso-line.flowline{animation:none;stroke-dasharray:2.4 7;stroke-width:1.1px}
.iso-stage{cursor:ew-resize;touch-action:pan-y}
</style>`;

const body =
  CSS +
  k.plateHtml({
    fig: "Fig 1",
    title: "Cold therapy unit",
    hint: "Hover to set the flow",
    readout: `${START} mL/min · pad ${first.pad.toFixed(1)} °C · back ${first.back.toFixed(1)} °C · ice ${first.hours.toFixed(1)} h`,
    keys: [
      { mark: "lit", label: "Wrap pad on a limb form: where the water takes heat from the joint" },
      { mark: "raised", label: "Insulated cooler, near walls cut down: ice water, pump, return" },
      { mark: "dashed", label: "Supply and return hoses; the marks move with the water" },
    ],
    caption: `An ice machine for physical therapy is a pumped loop. Water at about ${MODEL.bath} °C leaves the ice bath, takes heat from the limb through the pad and comes back warmer. Turn the flow down and each gram of water stays longer in the pad, so the pad and the return both run warmer and the ice lasts longer. The numbers are a simple heat balance: ${MODEL.ua} W/K between pad and limb through a dressing, skin side at ${MODEL.skin} °C, ${MODEL.ice / 1000} kg of ice.`,
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Cold therapy unit: arrow keys change the pump flow" aria-valuemin="${FLOW.min}" aria-valuemax="${FLOW.max}" aria-valuenow="${START}">${svg}</div>`,
  });

const file = THEME === "light" ? "ice-machine-light.html" : "ice-machine.html";
const page = k.pageHtml({ title: "Cold therapy unit", theme: THEME, body, script: kitScript() + LIVE, width: 650 });
writeFileSync(join(HERE, file), page);
console.log("wrote", file, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `scale ${KS.toFixed(3)}`);

A.auditOrExit(R, P, {});
