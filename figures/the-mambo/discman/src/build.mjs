import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GALLERY = true;
const LABELS = !GALLERY;
const DW = 600, OX = LABELS ? 130 : 0, WIDTH = DW + 2 * OX, HEIGHT = LABELS ? 500 : 530;

// ---- colours sampled from Dan's photos (well-lit pixels, highlights excluded) ----
const SAMPLED = { yellow: "#ceaa1f", grey: "#424442", orange: "#a04829" };
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const lighten = (h, f) => toHex(hex2(h).map((v) => v + (255 - v) * f));
const darken = (h, f) => toHex(hex2(h).map((v) => v * (1 - f)));
const toneVars = (base, { top = 0.22, lines = 0.3 } = {}) => [
  `--anatomy-top:${lighten(base, top)}`, `--anatomy-lit-top:${lighten(base, top)}`, `--anatomy-paper:${darken(base, 0.06)}`, `--anatomy-face:${base}`,
  `--anatomy-shade-3:${base}`, `--anatomy-shade-2:${darken(base, 0.08)}`, `--anatomy-shade-1:${darken(base, 0.16)}`, `--anatomy-shade-0:${darken(base, 0.24)}`,
].join(";") + (lines ? `;--anatomy-lo:${lighten(base, lines)};--anatomy-faint:${lighten(base, lines * 0.55)};--anatomy-mid:${lighten(base, lines * 1.4)}` : "");
const YEL = toneVars(SAMPLED.yellow, { top: 0.3, lines: 0 }) + `;--anatomy-lo:${darken(SAMPLED.yellow, 0.25)};--anatomy-faint:${darken(SAMPLED.yellow, 0.14)}`;
const GREY = toneVars(SAMPLED.grey, { top: 0.16, lines: 0.28 });
const ORANGE = lighten(SAMPLED.orange, 0.12);
const CHIP = toneVars("#2a2a2e", { top: 0.12, lines: 0.35 });
const SILVER = toneVars("#d9dce2", { top: 0.5, lines: 0 }) + ";--anatomy-lo:#a9adb6;--anatomy-faint:#c3c6cd";

// ---- world: ~1 unit = 1 mm. Disc centre at origin; front (chin) toward +y; cut quadrant x>0, y>0 ----
const PLATE = { x: -82, y: -82, w: 164, d: 178, r: 10 }, PLATE_H = 7, FOOT_H = 4;
const BODY = { x: -68, y: -68, w: 136, d: 150, r: 18 };
const FLOOR = 4, WALL_TOP = 17, LID_TOP = 22, CHIN_Y = 62;
const DISC_R = 60, DISC_Z0 = 10.6, DISC_Z1 = 11.8;
const CUT = (x, y) => x > 0 && y > 0 && y < CHIN_Y;
const S2 = Math.SQRT1_2, U = [S2, S2], N = [-S2, S2];
const SLED_R0 = 26, SLED_R1 = 50, SLED_L = 14, SLED_W = 22, RAIL_OFF = 8, RAIL_Z1 = 6.4, SLED_Z1 = 9.2, LENS_Z1 = 10.0;

// lid hinged at the rear edge and swung open past vertical (rear edge y = BODY.y, hinge line at the wall top)
const LID_ANGLE = 98 * Math.PI / 180, LID_T = 4.6, KNUCKLE_R = 2.4, HINGE = [0, BODY.y - KNUCKLE_R, WALL_TOP - KNUCKLE_R - 0.2];
const LID_V = [0, Math.cos(LID_ANGLE), Math.sin(LID_ANGLE)], LID_A = [0, -Math.sin(LID_ANGLE), Math.cos(LID_ANGLE)];
const LID_F = { o: HINGE.map((h, i) => h + LID_V[i] * KNUCKLE_R - LID_A[i] * (LID_T / 2)), u: [1, 0, 0], v: [0, Math.cos(LID_ANGLE), Math.sin(LID_ANGLE)], a: [0, -Math.sin(LID_ANGLE), Math.cos(LID_ANGLE)] };
const lidAt = (x, v, s = 0) => LID_F.o.map((o, i) => o + LID_F.u[i] * x + LID_F.v[i] * v + LID_F.a[i] * s);
const LID_LEN = CHIN_Y - BODY.y - 1.5;
const P = k.fitProjection([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BODY, 0, LID_TOP + 2), lidAt(-68, LID_LEN, LID_T), lidAt(68, LID_LEN, LID_T), lidAt(-68, LID_LEN), lidAt(68, LID_LEN)], DW, HEIGHT, { pad: 26, azimuth: 45, elevation: 34 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const R = A.recorder(P);
const put = (name, centre, svg, shapes, extra = {}) => R.put({ name, at: centre, svg, shapes: shapes.map((s) => R.solid(s)), ...extra });
const tint = (vars, svg) => `<g style="${vars}">${svg}</g>`;

function dense(ring, step = 1.5) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  return out;
}
function keptArc(ring, cut) { // the one contiguous run of points outside `cut`
  const n = ring.length, keep = ring.map(([x, y]) => !cut(x, y));
  const s = keep.findIndex((v, i) => v && !keep[(i - 1 + n) % n]);
  if (s < 0) return ring.slice();
  const out = [];
  for (let i = 0; i < n; i++) { const j = (s + i) % n; if (!keep[j]) break; out.push(ring[j]); }
  return out;
}
const rotRect = (c, u, len, wid) => { const n = [-u[1], u[0]]; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + u[0] * a * len / 2 + n[0] * b * wid / 2, c[1] + u[1] * a * len / 2 + n[1] * b * wid / 2]); };
const along = (r, off = 0) => [U[0] * r + N[0] * off, U[1] * r + N[1] * off];

// ---- bench plate ----
{
  for (const [x, y] of k.corners(PLATE, 18)) put(R.nameFor("stand.foot"), [x, y, -PLATE_H - 2], S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, FOOT_H, P, 24), { tone: "mid" }), [A.cylinder(x, y, 6, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" })]);
  const screws = k.corners(PLATE, 8);
  const strip = { x: -70, y: PLATE.y + PLATE.d - 12, w: 140, d: 6, r: 1 };
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.2], P);
  put("stand.plate", [0, 0, -PLATE_H], `<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>` +
    S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }) }) +
    L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }) +
    S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }) + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }) +
    D([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.45 }),
    [A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }), A.slab(strip, 0, 0.6, { name: "stand.strip" }, 3)]);
}

// ---- body: tray, side walls (cut away in the front-right quadrant), chin, lid ----
const OUTER = dense(k.ringOf(BODY, 10));
const INNER = dense(k.ringOf(k.insetPlan(BODY, 4), 10));
{
  put("body.tray", [0, 7, 2], tint(GREY, `<path class="iso-halo" d="${k.haloOf(BODY, 0, LID_TOP, P)}" style="filter:blur(5px)"/>` + S(k.slabOf(BODY, 0, FLOOR, P, 10, 0.6), { tone: "mid" })),
    [A.slab(BODY, 0, FLOOR, { name: "body.tray", owner: "body" }, 10)]);
  const cutWall = (x, y) => x > 0 && y > 0 && y < CHIN_Y;
  const PIECES = { far: (x, y) => x + y < 0, side: (x, y) => x + y >= 0 && y <= 0, front: (x, y) => x + y >= 0 && y > 0 && !cutWall(x, y) };
  for (const [name, keep] of Object.entries(PIECES)) {
    const band = [...keptArc(OUTER, (x, y) => !keep(x, y)), ...keptArc(INNER, (x, y) => !keep(x, y)).reverse()];
    const c = band.reduce((a, p) => [a[0] + p[0] / band.length, a[1] + p[1] / band.length], [0, 0]);
    put("body.wall." + name, [c[0], c[1], 10], tint(GREY, S(k.extrude(band, FLOOR, WALL_TOP - FLOOR, P, { convex: false, bevel: 0.4 }), { tone: "mid" })),
      [A.extruded(band, FLOOR, WALL_TOP - FLOOR, { name: "body.wall." + name, owner: "body" })]);
  }
  const chin = OUTER.filter(([, y]) => y >= CHIN_Y);
  chin.push([chin[chin.length - 1][0] < 0 ? -64 : 64, CHIN_Y]);
  const chinRing = [...OUTER.filter(([, y]) => y >= CHIN_Y)];
  const ring = [[68, CHIN_Y], ...chinRing.sort((a, b) => Math.atan2(a[1] - 72, a[0]) - Math.atan2(b[1] - 72, b[0])), [-68, CHIN_Y]];
  // order the chin points round its outline (front arc from +x to -x)
  const front = OUTER.filter(([, y]) => y > CHIN_Y);
  const ordered = [[68, CHIN_Y], ...front.slice().sort((a, b) => b[0] - a[0] || (b[0] > 0 ? a[1] - b[1] : b[1] - a[1])), [-68, CHIN_Y]];
  void ring;
  const sports = k.faceTextSvg(k.sideMatrix([-60, 82], 11.6, P, "left"), "SPORTS", { size: 6.4, tone: "hi" }).replace('class="iso-face-text"', `class="iso-face-text" style="fill:${ORANGE};font-weight:800;font-style:italic;letter-spacing:.02em"`);
  put("body.chin", [0, 72, 18], tint(GREY, S(k.extrude(ordered, WALL_TOP, LID_TOP - WALL_TOP, P, { bevel: 0.6 }), { tone: "mid" })) + sports,
    [A.extruded(ordered, WALL_TOP, LID_TOP - WALL_TOP, { name: "body.chin", owner: "body" })]);
  // lid: the real lid, the body outline behind the chin, hinged on the rear edge and standing open
  const LID = keptArc(OUTER, (x, y) => y >= CHIN_Y - 1.5).map(([x, y]) => [x, y - BODY.y]);
  const lidPaths = G.prismOf(LID_F, LID, 0, LID_T, P);
  const UNDER = toneVars(darken(SAMPLED.yellow, 0.42), { top: 0.05, lines: 0.18 });
  // underside detail: inset moulding rim, disc hold-down hub with its pressure ring, two latch hooks at the free edge
  const inset = keptArc(INNER, (x, y) => y >= CHIN_Y - 6).map(([x, y]) => at(lidAt(x, y - BODY.y, -0.01)));
  const hub = Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return [Math.cos(t), Math.sin(t)]; });
  const ringAt = (r) => k.pathOf(hub.map(([c, sn]) => at(lidAt(c * r, -BODY.y + sn * r, -0.01))), true);
  const hubF = { o: lidAt(0, -BODY.y, 0), a: LID_F.a.map((v) => -v), u: LID_F.u, v: LID_F.v };
  put("lid", lidAt(0, LID_LEN / 2, LID_T / 2), tint(YEL, S(lidPaths, { tone: "hi", crease: "lo" })) +
    `<path d="${k.pathOf(LID.map(([x, v]) => at(lidAt(x, v, 0))), true)}" style="fill:${darken(SAMPLED.yellow, 0.42)};stroke:none"/>` +
    `<path d="${k.pathOf(keptArc(INNER, (x, y) => y >= CHIN_Y - 6).map(([x, y]) => at(lidAt(x, y - BODY.y, 0))), true)}" style="fill:${darken(SAMPLED.yellow, 0.5)};stroke:none"/>` +
    tint(UNDER, L(k.pathOf(inset, true), { tone: "lo" }) + L(ringAt(16) + ringAt(22), { tone: "lo" })),
    [A.prism(LID_F, LID, 0, LID_T, { name: "lid", owner: "body" })]);
  put("lid.hub", lidAt(0, -BODY.y, -1), tint(UNDER, S(G.solidOf([[0, 7], [1.6, 7], [2.2, 6.2, 1], [2.4, 4]], hubF, P, {}), { tone: "mid" })),
    [A.solid(hubF, [[0, 7], [1.6, 7], [2.2, 6.2, 1], [2.4, 4]], { name: "lid.hub", owner: "body" })]);
  for (const x of [-30, 30]) {
    const hook = [[x - 4, LID_LEN - 6], [x + 4, LID_LEN - 6], [x + 4, LID_LEN - 2], [x - 4, LID_LEN - 2]];
    const hf = { o: LID_F.o, u: LID_F.u, v: LID_F.v, a: LID_F.a };
    put(R.nameFor("lid.latch"), lidAt(x, LID_LEN - 4, -1), tint(UNDER, S(G.prismOf(hf, hook, -1.8, 0, P), { tone: "mid" })), [A.prism(hf, hook, -1.8, 0, { name: "lid.latch", owner: "body" })]);
  }
  // hinge: barrel knuckles on the rear edge, alternating lid and body, on one pin
  const XA = (x) => ({ o: [x, HINGE[1], HINGE[2]], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] });
  for (const [x0, x1, lidSide] of [[-52, -36, 0], [-36, -24, 1], [24, 36, 1], [36, 52, 0]]) {
    const F = XA(x0);
    put(R.nameFor("lid.hinge"), [(x0 + x1) / 2, HINGE[1], HINGE[2]], tint(lidSide ? YEL : GREY, S(G.solidOf([[0, KNUCKLE_R], [x1 - x0, KNUCKLE_R]], F, P, {}), { tone: "mid" })),
      [A.solid(F, [[0, KNUCKLE_R], [x1 - x0, KNUCKLE_R]], { name: "lid.hinge", owner: "body" })]);
  }
  const pinF = XA(-53.4);
  put("lid.pin", [-53.4, HINGE[1], HINGE[2]], tint(SILVER, S(G.solidOf([[0, 1], [1.4, 1]], pinF, P, {}), { tone: "hi" })), [A.solid(pinF, [[0, 1], [1.4, 1]], { name: "lid.pin", owner: "body" })]);
  globalThis.__LID = LID;
}
// ---- chin details: LCD with ESP memory icon, buttons, engraved SPORTS, side jacks, HOLD, volume ----
const LCD = { x: -58, y: 65, w: 46, d: 13, r: 1.5 };
{
  put("chin.lcd", [-35, 71, LID_TOP], tint(CHIP, S(k.slabOf(LCD, LID_TOP, 0.4, P, 3), { tone: "mid", crease: "none" })) +
    `<g data-part="lcd"></g>`, [A.slab(LCD, LID_TOP, 0.4, { name: "chin.lcd", owner: "body" }, 3)]);
  const PAD = [36, 72];
  put("chin.pad", [36, 72, LID_TOP + 1], tint(GREY, S(k.cylinder(PAD[0], PAD[1], 8, LID_TOP, 1.2, P, 40, 0.3), { tone: "mid" }) +
    S(k.cylinder(PAD[0], PAD[1], 3.4, LID_TOP + 1.2, 0.8, P, 24), { tone: "mid" })) + D([at([PAD[0], PAD[1] - 5.6, LID_TOP + 1.2]), at([PAD[0] + 5.6, PAD[1], LID_TOP + 1.2]), at([PAD[0], PAD[1] + 5.6, LID_TOP + 1.2]), at([PAD[0] - 5.6, PAD[1], LID_TOP + 1.2])], { size: 0.5, tone: "hi" }),
    [A.cylinder(PAD[0], PAD[1], 8, LID_TOP, 1.2, { name: "chin.pad", owner: "body" }), A.cylinder(PAD[0], PAD[1], 3.4, LID_TOP + 1.2, 0.8, { name: "chin.pad.play", owner: "body" })]);
  const BTN = [[2, 67], [2, 77], [16, 67], [16, 77]];
  BTN.forEach(([x, y], i) => put(R.nameFor("chin.button"), [x, y, LID_TOP + 0.5], tint(GREY, S(k.cylinder(x, y, 2.6, LID_TOP, 1, P, 20, 0.2), { tone: "mid" })) +
    (i === 1 ? `<circle data-part="esp-led" cx="${at([x, y, LID_TOP + 1])[0]}" cy="${at([x, y, LID_TOP + 1])[1]}" r="0.9" style="fill:${ORANGE}"/>` : ""),
    [A.cylinder(x, y, 2.6, LID_TOP, 1, { name: "chin.button", owner: "body" })]));
  // front face: engraved SPORTS (the one label), HOLD slider and volume wheel
  const hold = { x: -40, y: 82, w: 10, d: 2, r: 0.8 }, wheel = { x: -16, y: 81.6, w: 12, d: 3, r: 1.5 };
  put("chin.front", [-28, 83, 10], tint(GREY, S(k.slabOf(hold, 6, 4, P, 2, 0.2), { tone: "mid" }) + S(k.slabOf(wheel, 4, 9, P, 3, 0.3), { tone: "mid", inner: L([0.25, 0.5, 0.75].map((f) => k.rise([wheel.x + wheel.w * f, wheel.y + wheel.d, 0], 4.4, 12.6, P)).join(""), { tone: "lo" }) })),
    [A.slab(hold, 6, 4, { name: "chin.hold", owner: "body" }, 2), A.slab(wheel, 4, 9, { name: "chin.volume", owner: "body" }, 3)], {});
  const jacks = [[68, 69, 18], [68, 76, 18]];
  put("chin.jacks", [68, 72, 18], tint(GREY, L(jacks.map((c) => k.sideRing(c, 1.8, "x", P, 20) + k.sideRing(c, 1.0, "x", P, 16)).join(""), { tone: "lo" })),
    [A.slab({ x: 67.8, y: 66.5, w: 0.2, d: 12, r: 0 }, 16, 4, { name: "chin.jacks", owner: "body" }, 1)]);
}
// ---- mechanism on the tray floor: spindle motor, turntable, rails, sled, lens, sled motor, chips ----
{
  put("mech.spindle", [0, 0, 7], tint(CHIP, S(k.cylinder(0, 0, 9, FLOOR, 5, P, 40, 0.3), { tone: "mid", inner: L(k.sideArc(0, 0, 9, FLOOR + 2, P, 28), { tone: "lo" }) })),
    [A.cylinder(0, 0, 9, FLOOR, 5, { name: "mech.spindle", owner: "mech" })]);
  put("mech.turntable", [0, 0, 9.8], tint(GREY, S(k.cylinder(0, 0, 13, FLOOR + 5, DISC_Z0 - FLOOR - 5, P, 48, 0.3), { tone: "mid" })),
    [A.cylinder(0, 0, 13, FLOOR + 5, DISC_Z0 - FLOOR - 5, { name: "mech.turntable", owner: "mech" })]);
  for (const off of [-RAIL_OFF, RAIL_OFF]) {
    const c = along((SLED_R0 - 6 + SLED_R1 + 6) / 2, off), ring = rotRect(c, U, SLED_R1 - SLED_R0 + SLED_L + 6, 2.4);
    put(R.nameFor("mech.rail"), [c[0], c[1], 5], tint(GREY, S(k.extrude(ring, FLOOR, RAIL_Z1 - FLOOR, P), { tone: "hi", crease: "lo" })), [A.extruded(ring, FLOOR, RAIL_Z1 - FLOOR, { name: "mech.rail", owner: "mech" })]);
  }
  const blockAt = (r) => rotRect(along(r, 0), U, 4, 2 * RAIL_OFF + 6);
  for (const r of [SLED_R0 - SLED_L / 2 - 6, SLED_R1 + SLED_L / 2 + 6]) {
    const ring = blockAt(r), c = along(r, 0);
    put(R.nameFor("mech.block"), [c[0], c[1], 6], tint(GREY, S(k.extrude(ring, FLOOR, 4, P), { tone: "mid" })) + D([along(r, -RAIL_OFF - 1.5), along(r, RAIL_OFF + 1.5)].map(([x, y]) => at([x, y, FLOOR + 4])), { size: 0.4, tone: "hi" }),
      [A.extruded(ring, FLOOR, 4, { name: "mech.block", owner: "mech" })]);
  }
  const sm = along(SLED_R1 + SLED_L / 2 + 6 + 7, 0);
  put("mech.sledmotor", [sm[0], sm[1], 7], tint(CHIP, S(k.cylinder(sm[0], sm[1], 4, FLOOR, 6, P, 24, 0.3), { tone: "mid" })) + D([at([sm[0], sm[1], FLOOR + 6])], { size: 0.6, tone: "hi" }),
    [A.cylinder(sm[0], sm[1], 4, FLOOR, 6, { name: "mech.sledmotor", owner: "mech" })]);
  const sc = along(SLED_R0, 0), sring = rotRect(sc, U, SLED_L, SLED_W);
  const lens = along(SLED_R0, 0);
  put("mech.sled", [sc[0], sc[1], 8], `<g data-part="sled">` + tint(GREY, S(k.extrude(sring, RAIL_Z1, SLED_Z1 - RAIL_Z1, P, { bevel: 0.3 }), { tone: "mid" })) +
    tint(CHIP, S(k.cylinder(lens[0], lens[1], 3, SLED_Z1, LENS_Z1 - SLED_Z1, P, 24), { tone: "mid" })) +
    `<circle cx="${at([lens[0], lens[1], LENS_Z1])[0]}" cy="${at([lens[0], lens[1], LENS_Z1])[1]}" r="1.3" style="fill:#5b4b9a"/>` +
    `<path data-part="beam" class="iso-line" data-tone="lit" d="M${at([lens[0], lens[1], LENS_Z1]).join(" ")}L${at([lens[0], lens[1], DISC_Z0 + 2.6]).join(" ")}" style="stroke:#e5484d;stroke-width:1.1"/>` +
    `<circle data-part="spot" cx="${at([lens[0], lens[1], DISC_Z0 + 2.6])[0]}" cy="${at([lens[0], lens[1], DISC_Z0 + 2.6])[1]}" r="1.1" style="fill:#e5484d"/></g>`,
    [A.extruded(sring, RAIL_Z1, SLED_Z1 - RAIL_Z1, { name: "mech.sled", owner: "mech" }), A.cylinder(lens[0], lens[1], 3, SLED_Z1, LENS_Z1 - SLED_Z1, { name: "mech.lens", owner: "mech" })]);
}
const CHIPS = { dsp: { x: 30, y: 2, w: 12, d: 10, r: 0.8 }, ram: { x: 46, y: 2, w: 12, d: 12, r: 0.8 }, dac: { x: 52, y: 20, w: 7, d: 7, r: 0.6 } };
{
  for (const [name, c] of Object.entries(CHIPS)) {
    const pins = [];
    for (let x = c.x + 1.6; x < c.x + c.w - 1; x += 2) pins.push(at([x, c.y + c.d + 0.6, FLOOR]));
    put("chip." + name, [c.x + c.w / 2, c.y + c.d / 2, 5], tint(CHIP, S(k.slabOf(c, FLOOR, 1.8, P, 2, 0.3), { tone: "mid" })) + D(pins, { size: 0.35, tone: "mid" }) + D([at([c.x + 1.6, c.y + 1.6, FLOOR + 1.8])], { size: 0.4, tone: "lo" }),
      [A.slab(c, FLOOR, 1.8, { name: "chip." + name, owner: "mech" }, 2)]);
  }
  const traces = k.lineOnTop([42, 7], [46, 7], FLOOR, P) + k.lineOnTop([54, 14], [54, 20], FLOOR, P) + k.lineOnTop([59, 23.5], [64, 23.5], FLOOR, P);
  put("pcb.traces", [52, 14, FLOOR], "", [A.slab({ x: 42, y: 6, w: 22, d: 18, r: 0 }, FLOOR, 0.05, { name: "pcb.traces", owner: "mech" }, 1)]);
}
// ---- the disc (cut quadrant), centring chuck ----
const DISC = (() => { const pts = []; for (let i = 0; i <= 270; i += 2) { const a = (90 + i) * Math.PI / 180; pts.push([Math.cos(a) * DISC_R, Math.sin(a) * DISC_R]); } pts.push([0, 0]); return pts; })();
{
  const arc = (r) => { const pts = []; for (let i = 0; i <= 270; i += 3) { const a = (90 + i) * Math.PI / 180; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return k.onTop(pts, DISC_Z1, P); };
  put("disc", [-20, -20, DISC_Z1], tint(SILVER, S(k.extrude(DISC, DISC_Z0, DISC_Z1 - DISC_Z0, P, { convex: false }), { tone: "hi", crease: "lo" }) +
    L(arc(22) + arc(DISC_R - 2.5), { tone: "lo" }) + `<path data-part="label" class="iso-line" data-tone="lo" d=""/>`),
    [A.extruded(DISC, DISC_Z0, DISC_Z1 - DISC_Z0, { name: "disc", owner: "disc" })]);
  put("disc.chuck", [0, 0, 12.8], tint(GREY, S(k.cylinder(0, 0, 7.5, DISC_Z1, 1.8, P, 32, 0.3), { tone: "mid" })) + D([0, 1, 2].map((i) => { const a = i * 2.094; return at([Math.cos(a) * 4.6, Math.sin(a) * 4.6, DISC_Z1 + 1.8]); }), { size: 0.5, tone: "hi" }),
    [A.cylinder(0, 0, 7.5, DISC_Z1, 1.8, { name: "disc.chuck", owner: "disc" })]);
}

A.settle(R, P);
const items = [...R.items].sort((a, b) => a.key - b.key);
A.auditOrExit(R, P);
const rig = [];
items.forEach((it) => { if (!it.name.startsWith("stand.")) { rig.push(`<g data-item="${it.name}">${it.svg}</g>`); if (it.name === "pcb.traces") rig.push(`<g data-part="flow"></g>`); } });
const stand = items.filter((it) => it.name.startsWith("stand.")).map((it) => `<g data-item="${it.name}">${it.svg}</g>`);
const drawing = [...stand, `<g data-part="rig">`, ...rig, `</g>`];

// ---- callouts (labelled build only) ----
let callouts = "", CALL = [];
if (LABELS) {
  const sc = (p) => { const [x, y] = at(p); return [x + OX, y]; };
  CALL = [
    { side: "L", name: "Disc", p: [-24, 34, DISC_Z1] },
    { side: "L", name: "ESP button + LCD", p: [-30, 71, LID_TOP + 0.4] },
    { side: "L", name: "HOLD / volume", p: [-35, 84, 8] },
    { side: "L", name: "Spindle + chuck", p: [-3, -3, DISC_Z1 + 1.8] },
    { side: "R", name: "Laser pickup (sled)", p: [...along(SLED_R0 + 2, -10), 8] },
    { side: "R", name: "ESP memory", p: [52, 8, FLOOR + 1.8] },
    { side: "R", name: "1-bit DAC", p: [55.5, 23.5, FLOOR + 1.8] },
    { side: "R", name: "Phones / line out", p: [68, 72.5, 20.2] },
  ].map((c, i) => ({ ...c, n: i + 1, a: sc(c.p) }));
  for (const side of ["L", "R"]) { const col = CALL.filter((c) => c.side === side).sort((a, b) => a.a[1] - b.a[1]); let y = 30; for (const c of col) { c.y = Math.max(c.a[1], y); y = c.y + 32; } }
  const BR = 10;
  callouts = CALL.map((c) => {
    const bx = c.side === "L" ? OX - 6 : OX + DW + 6, dir = c.side === "L" ? 1 : -1;
    const pts = [[bx + dir * BR, c.y], [c.a[0] - dir * 10, c.y], c.a];
    const tx = c.side === "L" ? bx - BR - 6 : bx + BR + 6;
    return `<g class="co"><path class="iso-line co-l" d="M${pts.map((p) => p.map((v) => v.toFixed(2)).join(" ")).join("L")}"/><circle class="co-dot" cx="${c.a[0].toFixed(2)}" cy="${c.a[1].toFixed(2)}" r="1.6"/>` +
      `<circle class="co-b" cx="${bx}" cy="${c.y.toFixed(2)}" r="${BR}"/><text class="co-n" x="${bx}" y="${(c.y + 4.4).toFixed(2)}">${c.n}</text><text class="co-t" x="${tx}" y="${(c.y + 4).toFixed(2)}" text-anchor="${c.side === "L" ? "end" : "start"}">${c.name}</text></g>`;
  }).join("");
}
const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "A cutaway Sony Discman ESP Sports D-421SP: dark grey body with the yellow lid hinged open at the rear and a quarter cut from the disc and side wall, so the spindle motor, the laser pickup on its rails, and the decoder, memory and 1-bit converter chips on the floor are visible. The disc spins; the pickup reads ahead into a 3-second memory, which keeps the sound playing when a jolt knocks the laser off the track.",
  body: LABELS ? [`<g transform="translate(${OX} 0)">`, ...drawing, `</g>`, callouts] : drawing,
});

const live = `
const P = ${JSON.stringify(P)};
const LABELS = ${LABELS};
const U = ${JSON.stringify(U)}, SLED_R0 = ${SLED_R0}, SLED_R1 = ${SLED_R1}, DISC_Z1 = ${DISC_Z1}, DISC_R = ${DISC_R}, FLOOR = ${FLOOR};
const LCD = ${JSON.stringify(LCD)}, LID_TOP = ${LID_TOP};
const CHIPS = ${JSON.stringify(CHIPS)};
const stage = document.querySelector(".iso-stage"), svg = stage.querySelector("svg");
const $ = (n) => svg.querySelector('[data-part="' + n + '"]');
const rig = $("rig"), sled = $("sled"), beam = $("beam"), spot = $("spot"), label = $("label"), lcd = $("lcd"), flow = $("flow"), led = $("esp-led");
const readout = document.querySelector("[data-readout]");
const stageName = document.querySelector("[data-stage-name]"), stageText = document.querySelector("[data-stage-text]"), meter = document.querySelector("[data-meter]"), meterText = document.querySelector("[data-meter-text]");
const chips = [...document.querySelectorAll("[data-step]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const NS = "http://www.w3.org/2000/svg";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// ---- model. From the manual: ESP "constantly stores the next 3 seconds of sound"; with ESP the disc spins faster than normal.
// Simple model: the pickup reads ahead at READ x playback speed while the memory is below full; audio always plays out of the memory.
const CAP = 3, READ = 2, SPINUP = 1.2, RECOVER = 0.6;
const M = { playing: true, esp: true, buf: 0, t: 0, track: 1, spin: 0, phase: "spinup", phaseT: 0, jolt: 0, shake: 0, skip: 0, r: SLED_R0, angle: 0, refill: false };
function jolt(seconds) { M.jolt = Math.max(M.jolt, seconds); M.shake = 1; if (M.phase !== "spinup") M.phase = "jolt"; M.phaseT = 0; }
function step(dt) {
  M.phaseT += dt;
  M.shake = Math.max(0, M.shake - dt * 2.2);
  if (!M.playing) { M.spin = Math.max(0, M.spin - dt * 1.5); return; }
  M.spin = Math.min(M.esp ? 1 : 0.8, M.spin + dt * 1.2);
  const onTrack = M.phase !== "spinup" && M.jolt <= 0 && M.phase !== "seek";
  if (M.phase === "spinup" && M.phaseT > SPINUP) { M.phase = "read"; M.phaseT = 0; }
  if (M.jolt > 0) { M.jolt -= dt; if (M.jolt <= 0) { M.phase = "seek"; M.phaseT = 0; } }
  if (M.phase === "seek" && M.phaseT > RECOVER) { M.phase = "recover"; M.phaseT = 0; }
  const cap = M.esp ? CAP : 0;
  // reading into memory
  if (onTrack) { const rate = M.buf < cap - 0.02 ? (M.esp ? READ : 1) : 1; M.buf = Math.min(cap + (M.esp ? 0 : 0.02), M.buf + rate * dt); M.refill = rate > 1; }
  else M.refill = false;
  // playing out of memory
  if (M.phase !== "spinup") {
    if (M.buf > 0.0001) { const use = Math.min(M.buf, dt); M.buf -= use; M.t += use; M.skip = Math.max(0, M.skip - dt * 3); }
    else M.skip = 1;
  }
  if (M.phase === "recover" && M.buf >= cap - 0.05) { M.phase = "read"; M.phaseT = 0; }
  M.r = SLED_R0 + ((M.t / 240) % 1) * (SLED_R1 - SLED_R0);
  M.angle += dt * M.spin * 9; // drawn slowly; a real CD turns about 200 to 500 times a minute
}
const STAGES = [
  ["Spinning up", "The spindle motor brings the disc up to speed and the laser pickup focuses on the track of pits."],
  ["Reading ahead", "The pickup reads the pits faster than the music plays and fills the ESP memory with the next seconds of sound."],
  ["Jolt: playing from memory", "A shock knocked the laser off the track. The sound keeps coming from the memory, which drains while the pickup is lost."],
  ["Recovering", "The pickup finds its place again and refills the memory faster than it is played; then it only tops it up."],
];
function stageOf() { return M.phase === "spinup" ? 0 : M.phase === "jolt" || M.phase === "seek" ? 2 : M.phase === "recover" ? 3 : 1; }
// ---- data flow dots: lens -> decoder (DSP) -> memory -> DAC -> jack ----
const dots = [];
for (let i = 0; i < 14; i++) { const el = document.createElementNS(NS, "circle"); el.setAttribute("r", "0.9"); flow.appendChild(el); dots.push({ el, s: i / 14 }); }
const ctr = (c) => [c.x + c.w / 2, c.y + c.d / 2];
function flowPath() { const lens = [U[0] * M.r, U[1] * M.r]; return [[...lens, 9], [...ctr(CHIPS.dsp), 6], [...ctr(CHIPS.ram), 6], [...ctr(CHIPS.dac), 6], [64, 23.5, 6]]; }
function walk(path, s) { const seg = []; let tot = 0; for (let i = 0; i < path.length - 1; i++) { const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); seg.push(l); tot += l; } let d = s * tot; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const f = d / seg[i]; return [path[i].map((v, j) => v + (path[i + 1][j] - v) * f), i]; } d -= seg[i]; } return [path[path.length - 1], seg.length - 1]; }
const onTopP = (pts, z) => "M" + pts.map((p) => iso([p[0], p[1], z], P).map((v) => v.toFixed(2)).join(" ")).join("L");
function drawLabel() {
  let d = "";
  for (let i = 0; i < 16; i++) {
    const a = M.angle + i * Math.PI / 8, deg = ((a * 180 / Math.PI) % 360 + 360) % 360;
    if (deg < 96 || deg > 354) continue;           // skip the cut quadrant
    d += onTopP([[Math.cos(a) * 22, Math.sin(a) * 22], [Math.cos(a) * (DISC_R - 2.5), Math.sin(a) * (DISC_R - 2.5)]], DISC_Z1);
  }
  label.setAttribute("d", d); label.style.opacity = "0.55";
}
function drawLcd() {
  const lvl = M.esp ? Math.round(M.buf / CAP * 12) : 0;
  const ox = LCD.x + 4, oy = LCD.y + 3;
  let out = "";
  // ESP memory icon as in the manual: a cup of dots that fills and drains
  const cup = onTopP([[ox, oy], [ox, oy + 7], [ox + 6, oy + 7], [ox + 6, oy], [ox, oy]], LID_TOP + 0.4);
  out += '<path class="iso-line" d="' + cup + '" style="stroke:#e5484d;stroke-width:.6"/>';
  for (let i = 0; i < 12; i++) { const c = i % 3, r = Math.floor(i / 3); const p = iso([ox + 1.4 + c * 1.6, oy + 6 - r * 1.5, LID_TOP + 0.4], P); out += '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r=".55" style="fill:#e5484d;opacity:' + (i < lvl ? 1 : 0.12) + '"/>'; }
  const mm = Math.floor(M.t / 60), ss = Math.floor(M.t % 60);
  const txt = "0" + M.track + " " + mm + ":" + String(ss).padStart(2, "0");
  out += '<text class="iso-face-text" transform="' + topMatrix([LCD.x + 13, LCD.y + 9.5], LID_TOP + 0.4, P, "x") + '" font-size="6" style="fill:#e5484d;font-family:ui-monospace,monospace">' + (M.skip > 0.5 && M.playing ? "-- -:--" : txt) + '</text>';
  lcd.innerHTML = out;
}
let lastStage = -1;
function draw() {
  sled.setAttribute("transform", translateAlong(P, [U[0] * (M.r - SLED_R0), U[1] * (M.r - SLED_R0), 0]));
  const on = M.playing && M.phase !== "spinup" && M.jolt <= 0 && M.phase !== "seek";
  beam.style.opacity = on ? "1" : "0"; spot.style.opacity = on ? "1" : "0";
  const sh = M.shake * M.shake;
  rig.setAttribute("transform", "translate(" + (Math.sin(M.phaseT * 47) * 3.2 * sh).toFixed(2) + " " + (Math.cos(M.phaseT * 39) * 2.2 * sh).toFixed(2) + ")");
  drawLabel(); drawLcd();
  led.style.opacity = M.esp ? "1" : "0.15";
  const path = flowPath();
  for (const d of dots) { const [p, seg] = walk(path, d.s); const xy = iso(p, P); d.el.setAttribute("cx", xy[0].toFixed(2)); d.el.setAttribute("cy", xy[1].toFixed(2));
    const live = M.playing && (seg === 0 ? on : seg === 1 ? on || M.buf > 0 : M.buf > 0 || on);
    d.el.style.fill = seg === 0 ? "#e5484d" : seg >= 2 ? "${ORANGE}" : "#3e63dd"; d.el.style.opacity = live ? "0.9" : "0"; }
  const st = stageOf();
  const word = !M.playing ? "paused" : M.skip > 0.5 ? "sound skips" : on ? (M.refill ? "reading ahead" : "topping up") : "off track";
  const text = "ESP " + (M.esp ? M.buf.toFixed(1) + " s" : "off") + " · " + word + (LABELS ? "" : " · " + STAGES[st][0]);
  if (readout.textContent !== text) readout.textContent = text;
  if (stageName) {
    if (st !== lastStage) { lastStage = st; stageName.textContent = (st + 1) + " · " + STAGES[st][0]; chips.forEach((c, i) => { c.dataset.state = i < st ? "done" : i === st ? "now" : "next"; }); }
    const extra = M.skip > 0.5 && M.playing ? " The memory ran dry before the laser recovered, so the sound skips." : !M.esp ? " ESP is off: without the memory, a jolt skips at once." : "";
    const t = STAGES[st][1] + extra; if (stageText.textContent !== t) stageText.textContent = t;
    meter.style.width = (M.esp ? M.buf / CAP * 100 : 0).toFixed(1) + "%"; meterText.textContent = (M.esp ? M.buf.toFixed(1) : "0.0") + " / 3.0 s";
  }
  stage.setAttribute("aria-valuetext", STAGES[st][0] + ". " + text);
}
// idle tour: a short bump, then a long shake that outlasts the 3-second memory
const TOUR = [[6, 1.4], [13, 4.4]], TOUR_LEN = 22;
let tourT = 0, tourI = 0, touring = true, idle = 0;
let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now;
  if (touring) { tourT += dt; if (tourI < TOUR.length && tourT >= TOUR[tourI][0]) { jolt(TOUR[tourI][1]); tourI++; } if (tourT > TOUR_LEN) { restart(); } }
  step(dt); draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
function restart() { Object.assign(M, { buf: 0, t: 0, phase: "spinup", phaseT: 0, jolt: 0, skip: 0, playing: true, spin: 0 }); tourT = 0; tourI = 0; }
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = true; restart(); }, 15000); }
function stillFrame() { M.phase = "read"; M.buf = 2.4; M.t = 83; M.r = SLED_R0 + 10; M.angle = 0.4; M.spin = 1; draw(); }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", () => { user(); jolt(1.4); run(); });
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { M.playing = !M.playing; }
  else if (e.key === "j" || e.key === "J") jolt(1.4);
  else if (e.key === "l" || e.key === "L") jolt(4.4);
  else if (e.key === "e" || e.key === "E") { M.esp = !M.esp; if (!M.esp) M.buf = Math.min(M.buf, 0.02); }
  else return;
  user(); e.preventDefault(); run();
});
still.addEventListener("change", () => { if (still.matches) stillFrame(); else run(); });
const skipTo = Number(new URLSearchParams(location.search).get("t")) || 0;
if (skipTo) { for (let t = 0; t < skipTo; t += 1 / 60) { tourT += 1 / 60; if (tourI < TOUR.length && tourT >= TOUR[tourI][0]) { jolt(TOUR[tourI][1]); tourI++; } step(1 / 60); } }
if (still.matches) stillFrame(); else draw();
`;

const style = `<style>
.co-l{stroke:var(--anatomy-mid);stroke-width:.7}.co-dot{fill:var(--anatomy-strong)}
.co-b{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:.8}
.co-n{font:600 11px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle}
.co-t{font:500 11px var(--anatomy-mono);fill:var(--anatomy-strong)}
.dm-stage{margin:0 0 6px;padding:10px 12px;border-radius:8px;background:var(--anatomy-page);box-shadow:var(--anatomy-lift)}
.dm-steps{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px;padding:0;list-style:none;font:500 10.5px var(--anatomy-mono);text-transform:uppercase;letter-spacing:.06em}
.dm-steps li{padding:2px 7px;border-radius:99px;color:var(--anatomy-muted);border:1px solid var(--anatomy-faint)}
.dm-steps li[data-state="done"]{color:var(--anatomy-text)}
.dm-steps li[data-state="now"]{color:#18181a;background:${SAMPLED.yellow};border-color:${SAMPLED.yellow}}
.dm-name{font:600 15px/1.3 var(--anatomy-mono);color:var(--anatomy-strong);margin:0 0 2px}
.dm-text{font:14px/1.45 system-ui,sans-serif;color:var(--anatomy-text);margin:0;min-height:4.3em}
.dm-meter{display:flex;align-items:center;gap:8px;margin-top:6px;font:500 11px var(--anatomy-mono);color:var(--anatomy-text)}
.dm-bar{flex:1;height:6px;border-radius:3px;background:var(--anatomy-faint);overflow:hidden}.dm-bar i{display:block;height:100%;width:0;background:${ORANGE}}
.dm-key{display:none;columns:2;gap:14px;margin:8px 0 0;padding:0 0 0 22px;font:12px/1.6 var(--anatomy-mono);color:var(--anatomy-text)}
@media (max-width:560px){.co-t{display:none}.co-b{r:15px}.co-n{font-size:17px;transform:translateY(2px);transform-box:fill-box}.dm-key{display:block}.dm-text{font-size:13px;min-height:5.8em}}
</style>`;
const panel = LABELS ? `<div class="dm-stage" aria-live="polite"><ol class="dm-steps">${["Spinning up", "Reading ahead", "Jolt", "Recovering"].map((s, i) => `<li data-step="${i}" data-state="${i ? "next" : "now"}">${i + 1} ${s}</li>`).join("")}</ol>` +
  `<p class="dm-name" data-stage-name>1 · Spinning up</p><p class="dm-text" data-stage-text>${"The spindle motor brings the disc up to speed and the laser pickup focuses on the track of pits."}</p>` +
  `<div class="dm-meter"><span>ESP memory</span><span class="dm-bar"><i data-meter></i></span><span data-meter-text>0.0 / 3.0 s</span></div></div>` : "";
const keyList = LABELS ? `<ol class="dm-key">${CALL.map((c) => `<li>${c.name}</li>`).join("")}</ol>` : "";
const plate = k.plateHtml({
  fig: LABELS ? "Fig 3" : "Fig 1",
  title: "Discman ESP D-421SP",
  hint: "Click: jolt · space: play/pause · E: ESP",
  readout: "ESP 0.0 s · spinning up",
  keys: [
    { mark: "red", label: "Laser path: pickup to disc (the real beam is infrared, 780 nm)" },
    { mark: "lit", label: "Data: decoder → 3-second ESP memory → 1-bit DAC → jacks" },
  ],
  caption: "A cutaway Sony Discman ESP “Sports” D-421SP. The spindle motor spins the disc while the laser pickup, on a sled that creeps outward along two rails, reads the track of pits from the underside. The decoder corrects errors and the data goes into the ESP memory, which the manual says “constantly stores the next 3 seconds of sound”: with ESP on the disc spins faster than normal, so the pickup can read ahead. When a shock knocks the laser off the track, the music keeps playing out of the memory until the pickup recovers and refills it; a shake longer than the memory holds still skips. The 1-bit DAC turns the samples into the signal at the headphone and line-out jacks. The memory levels and timings shown are a simple model, not measurements.",
  body: `${panel}<div class="iso-stage" tabindex="0" role="application" aria-label="Discman: click or J for a jolt, L for a long jolt, space to play or pause, E to toggle ESP">${svg}</div>${keyList}${style}`,
});
const out = "index.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Discman ESP D-421SP", theme: "light", body: plate, script: kitScript() + live, width: LABELS ? 900 : 650 }));
console.log("wrote", out, "items", items.length);
