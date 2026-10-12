import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// World units are 2 mm. x runs from the boiler to the group (the front is +x), y across, z up from the bench.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 560, DEG = Math.PI / 180;
const BOIL = [-22, 0], GRP = [34, 0], PIV = [34, 0, 120];
const REST = 62, PULL = -18, LEVER = 80, NPOSE = 21;
const PIST = 61, STROKE = 22, PORT = 79;
const PLATE = { x: -74, y: -58, w: 144, d: 116, r: 6 };

const P = k.fitProjection([...k.boxCorners(PLATE, -13, 0), [71.6, 0, 194], [112, 0, 92], [-22, 0, 134], [-48, 44, 40]], W, H, { pad: 22, azimuth: 45, elevation: 30 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, { tone: "mid", ...style });
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts.map(at), { size: 0.45, ...style });
const poly3 = (pts, closed) => k.pathOf(pts.map(at), closed);
const R = A.recorder(P, {});
const V = G.viewOf(P);

function put(name, ref, svg, shapes, o = {}) {
  return R.put({ name: R.nameFor(name), at: ref, svg, shapes: shapes.map((s) => R.solid(Object.assign(s, { name: s.name ?? name }))), ...o });
}
const box = (name, [x0, y0, z0], [x1, y1, z1], style, o = {}) => {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: o.r ?? 0.3 };
  return put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, o.steps ?? 2, o.bevel ?? 0), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.slab(plan, z0, z1 - z0, {}, o.steps ?? 2)], o);
};
function turned(name, F, profile, style = {}, o = {}) {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = A.solid(F, profile, { name, ...o.meta });
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(G.solidOf(profile, F, P, o.lathe ?? {}), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [shape], o);
  return shape;
}
const up = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const cyl = (name, x, y, r, z0, z1, style, o = {}) => turned(name, up(x, y, 0), [[z0, r], [z1, r]], style, o);
// Where a ray from inside a shape leaves it.
function exit(shape, from, dir) {
  let a = 0, b = 60;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; A.sdf(shape, G.add3(from, G.mul3(dir, m))) < 0 ? (a = m) : (b = m); }
  return G.add3(from, G.mul3(dir, (a + b) / 2));
}
// A ring sector in degrees, for the cut walls.
const sector = ([cx, cy], rIn, rOut, a0, a1) => {
  const n = Math.max(3, Math.ceil((a1 - a0) / 3)), arc = (r, rev) => Array.from({ length: n + 1 }, (_, i) => { const a = (rev ? a1 - ((a1 - a0) * i) / n : a0 + ((a1 - a0) * i) / n) * DEG; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  return [...arc(rOut), ...arc(rIn, true)];
};
// A wall cut open on the quarter that faces the viewer: the far half and two cheeks either side of the window.
function cutWall(name, c, rIn, rOut, z0, z1, style = {}, extra = "") {
  return [[135, 315, extra], [90, 135, ""], [315, 360, ""]].map(([a0, a1, x]) => {
    const ring = sector(c, rIn, rOut, a0, a1), m = ((a0 + a1) / 2) * DEG, rm = (rIn + rOut) / 2, sh = A.extruded(ring, z0, z1 - z0, { name });
    put(name, [c[0] + rm * Math.cos(m), c[1] + rm * Math.sin(m), (z0 + z1) / 2], S(k.extrude(ring, z0, z1 - z0, P, { convex: false }), style) + x, [sh]);
    return sh;
  });
}

// bench
const back = [`<path class="iso-halo" d="${k.haloOf(PLATE, -13, 13, P)}"/>`];
for (const [x, y] of k.corners(PLATE, 14).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) back.push(S(k.cylinder(x, y, 6, -13, 5, P, 24), { tone: "lo" }));
R.solid(A.slab(PLATE, -8, 8, { name: "stand.plate" }));
const screws = k.corners(PLATE, 7);
back.push(S(k.slabOf(PLATE, -8, 8, P, 6, 1.2), { tone: "lo" }), L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }), L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => [x, y, 0]), { size: 0.5 }));
const BASE = { x: -64, y: -48, w: 122, d: 96, r: 6 };
back.push(`<path class="iso-halo" d="${k.haloOf(BASE, 0, 4, P)}" style="opacity:.6"/>`);

// base, feet, drip tray and grate
for (const [x, y] of k.corners(BASE, 9)) cyl("foot", x, y, 4.5, 0, 4, { tone: "lo" });
const bs = k.corners(BASE, 5);
box("base", [-64, -48, 4], [58, 48, 16], { tone: "lo" }, { r: 6, steps: 6, bevel: 0.8, extra: L(bs.map(([x, y]) => k.ring(x, y, 1.6, 16, P, 14)).join(""), { tone: "faint" }) + Dt(bs.map(([x, y]) => [x, y, 16])) });
box("tray", [16, -28, 16], [54, 28, 18], {}, { r: 2, steps: 3, bevel: 0.4 });
const slots = Array.from({ length: 7 }, (_, i) => ({ x: 20 + i * 4.6, y: -23, w: 2, d: 46, r: 1 }));
box("grate", [17, -27, 18], [53, 27, 19], {}, { r: 1.5, steps: 3, inner: L(slots.map((s) => k.planOutline(s, 19, P, 3)).join(""), { tone: "lo" }), extra: Dt([[19, -25, 19], [51, 25, 19], [19, 25, 19], [51, -25, 19]], { size: 0.4 }) });

// boiler: foot ring, two bodies either side of a band, dome, filler cap
const BF = up(...BOIL, 0);
const domeR = (s) => 30 * Math.sqrt(Math.max(0, 1 - (s / 15) ** 2)), domeS = (s) => (-30 * s) / (225 * Math.sqrt(Math.max(1e-6, 1 - (s / 15) ** 2)));
cyl("boiler.foot", ...BOIL, 33, 16, 19, { tone: "lo" }, { extra: k.dotsSvg(G.dotsOf(BF, 19, 31.6, 12, P, { all: true })) });
const lower = cyl("boiler", ...BOIL, 30, 19, 62, { tone: "hi" });
cyl("boiler.band", ...BOIL, 31, 62, 66, {}, { inner: L(G.arcOf(BF, 64, 31, P), { tone: "faint" }) });
const upper = cyl("boiler", ...BOIL, 30, 66, 112, { tone: "hi" });
const DOME = Array.from({ length: 21 }, (_, i) => { const s = (14.2 * i) / 20; return [112 + s, domeR(s), 1]; });
DOME[0][2] = 0;
turned("boiler.dome", BF, DOME, { tone: "hi" }, { lathe: { smooth: { slope: (s) => domeS(s - 112), rows: 5 } }, meta: { radius: (s) => domeR(s - 112) } });
const capTop = 126.8;
turned("boiler.cap", BF, [[capTop - 0.6, 8.2], [capTop + 4, 8.2], [capTop + 4.8, 7.2]], {}, { inner: k.fadedSvg(G.ribsOf(BF, capTop - 0.6, capTop + 4, 8.2, 36, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
turned("boiler.knob", BF, [[capTop + 4.8, 2.6], [capTop + 7.4, 2.6, 1], [capTop + 8.4, 1.6, 1], [capTop + 8.8, 0.4]], {});

// sight glass: two stems, two fittings and the glass between
const SG = 30 * DEG, sgo = [BOIL[0] + 36 * Math.cos(SG), BOIL[1] + 36 * Math.sin(SG)];
for (const z of [40, 78]) {
  const F = G.frameAlong([BOIL[0], BOIL[1], z], [Math.cos(SG), Math.sin(SG), 0]);
  turned("glass.stem", F, [[29.8, 1.5], [33.6, 1.5]], {}, { meta: { seated: true, cut: [z < 62 ? lower : upper] } });
  cyl("glass.fitting", ...sgo, 2.6, z - 3, z + 3, {}, { extra: Dt([[sgo[0], sgo[1], z + 3]], { size: 0.4 }) });
}
const LEVEL = 64, gx = (r, a) => [sgo[0] + r * Math.cos(a), sgo[1] + r * Math.sin(a)];
const fa = Math.atan2(V[1], V[0]) + Math.PI / 2;
const water = poly3([[...gx(1, fa), 43], [...gx(1, fa + Math.PI), 43], [...gx(1, fa + Math.PI), LEVEL], [...gx(1, fa), LEVEL]], true);
cyl("glass", ...sgo, 1.6, 43, 75, { tone: "hi" }, { extra: `<path class="es-water" d="${water}"/>` + L(k.ring(...sgo, 1.6, LEVEL, P, 16), { tone: "lo" }) });

// group: neck, flange, cut wall, cap and the yoke
const NF = G.frameAlong([BOIL[0], 0, 92], [1, 0, 0]);
turned("neck.flange", NF, [[34, 9], [36, 9]], {}, { extra: k.dotsSvg(G.dotsOf(NF, 36, 7.2, 4, P, { all: true, phase: Math.PI / 4 })) });
cutWall("group.flange", GRP, 11.6, 16, 54, 60, {});
cyl("shower", ...GRP, 11.6, 59, 60, { tone: "lo" }, { extra: k.dotsSvg(Array.from({ length: 19 }, (_, i) => { const r = i ? (i < 7 ? 4 : 8) : 0, a = (i < 7 ? i : i - 7) * (i < 7 ? 60 : 30) * DEG; return at([GRP[0] + r * Math.cos(a), r * Math.sin(a), 60]); }), { size: 0.3, tone: "faint" }) });
const portF = G.frameAlong([GRP[0] - 11.6, 0, PORT], [-1, 0, 0]);
const grpWall = cutWall("group.wall", GRP, 11.6, 14.5, 60, 108, { tone: "hi" }, L(G.circleOf(portF, 0, 1.4, P, 24), { tone: "lo" }));
turned("neck", NF, [[29.2, 6], [34, 6]], {}, { meta: { seated: true, cut: [upper] } });
turned("neck", NF, [[36, 6], [41.6, 6]], {}, { meta: { seated: true, cut: [grpWall[0]] } });
cyl("group.cap", ...GRP, 15.5, 108, 112, {}, { extra: Dt([0, 1, 2, 3].map((i) => [GRP[0] + 12.4 * Math.cos((45 + 90 * i) * DEG), 12.4 * Math.sin((45 + 90 * i) * DEG), 112]), { size: 0.5 }) });
for (const y of [-4, 2.5]) box("yoke", [28, y, 112], [40, y + 1.5, 126], {}, { r: 0.4 });
const PINF = G.frameAlong(PIV, [0, 1, 0]);
turned("lever.hub", PINF, [[-2.5, 4.2], [2.5, 4.2]], {});
for (const s of [-4.8, 4]) turned("pin", PINF, [[s, 1.8], [s + 0.8, 1.8]], {}, { extra: s > 0 ? Dt([G.pointOf(PINF, 4.8, 0, 0)], { size: 0.5 }) : "" });

// piston, rod, spring and the water under the piston (moving, seen through the window)
const clip = (d) => `<g clip-path="url(#es-gc)">${d}</g>`;
put("piston", [GRP[0], 0, PIST + 4], clip(`<g data-part="piston">${S(k.cylinder(...GRP, 11.4, PIST, 8, P, 64), { tone: "hi" })}${L([PIST + 2, PIST + 5].map((z) => k.sideArc(...GRP, 11.4, z, P, 32)).join(""), { tone: "lo" })}</g>`), [A.cylinder(...GRP, 11.4, PIST, 8)]);
put("rod", [GRP[0], 0, 88], clip(`<g data-part="piston">${S(k.cylinder(...GRP, 2, PIST + 8, 40, P, 20), { tone: "mid", crease: "none" })}</g>`), [A.cylinder(...GRP, 2, PIST + 8, 39)]);
for (const [a0, n] of [[135, 0], [-45, 1]]) { const ring = sector(GRP, 7.6, 9.2, a0, a0 + 180); put("spring", [GRP[0], 0, 90], clip(`<g data-part="spring${n}"></g>`), [A.extruded(ring, PIST + 8, 108 - PIST - 8)]); }
put("chamber", [GRP[0], 0, 60.5], clip(`<g data-part="water"></g>`), [A.cylinder(...GRP, 11.4, 60, 1)]);

// portafilter: cut basket wall, floor, puck, spouts, handle
const pfWall = cutWall("pf.wall", GRP, 11, 13.5, 46, 54, {});
turned("pf.floor", up(...GRP, 0), [[42.6, 6], [43.4, 9.4, 1], [44.4, 12.2, 1], [46, 13.5]]);
cyl("puck", ...GRP, 10.8, 46, 51.6, { tone: "lo", className: "es-puck" });
cyl("spout.block", ...GRP, 3.4, 39, 42.6, {});
for (const y of [-2.2, 2.2]) cyl("spout", GRP[0], y, 1.1, 36.6, 39, {});
const HA = 330 * DEG, HD = [Math.cos(HA), Math.sin(HA), 0], HF = G.frameAlong([GRP[0], 0, 50], HD);
turned("pf.stem", HF, [[13.2, 2.6], [22, 2.6], [22, 3.2]], {}, { meta: { seated: true, cut: [pfWall[2]] } });
const GRIP = [[22, 3.2], [24, 3.6, 1], [34, 4, 1], [44, 3.8, 1], [47.4, 3, 1], [48, 1.6]];
turned("pf.handle", HF, GRIP, { tone: "lo" }, { inner: L([25.4, 26.6].map((s) => G.arcOf(HF, s, 3.7, P)).join(""), { tone: "faint" }) });

// gauges: boiler 0–2 bar on a back stem, group 0–12 bar on a side stem
function gauge(name, F, r, max, n, every, host, stemFrom, stemFrame) {
  const face = 5.6, ang = (v) => (-135 + (270 * v) / max) * DEG;
  turned(name + ".stem", stemFrame, [[stemFrom, 1.4], [stemFrame.len, 1.4]], {}, { meta: { seated: true, cut: [host] } });
  const tick = (i) => { const a = ang((max * i) / n), big = i % every === 0; return poly3([G.pointOf(F, face, r - 1.6, a), G.pointOf(F, face, r - (big ? 3.4 : 2.5), a)]); };
  const all = Array.from({ length: n + 1 }, (_, i) => i);
  const ticks = L(all.filter((i) => i && i % every).map(tick).join(""), { tone: "lo" }) + L(all.filter((i) => i && !(i % every)).map(tick).join(""), { tone: "mid" }) + L(tick(0), { tone: "hi" });
  const arc = poly3(Array.from({ length: 49 }, (_, i) => G.pointOf(F, face, r - 1.6, ang((max * i) / 48))));
  turned(name, F, [[0, r - 0.6], [0.8, r], [face - 0.6, r], [face, r - 0.5], [face, r - 1.0]], {}, {
    inner: L(G.circleOf(F, face, r - 1.0, P, 64), { tone: "lo" }),
    extra: L(arc, { tone: "faint" }) + ticks + `<path class="iso-line" data-tone="lit" data-free="both" data-part="${name}.needle" style="stroke-width:1"/>` + Dt([G.pointOf(F, face + 0.2, 0, 0)], { size: 0.8, tone: "mid" }),
  });
  return { o: G.pointOf(F, face + 0.25, 0, 0), u: F.u, v: F.v, r: r - 2.2, max };
}
// Screen-mirrored world: a face's right is z × −a.
const gaugeFrame = (o, a) => { const right = G.unit3(G.cross3([0, 0, 1], G.mul3(a, -1))); return G.frameOf(o, a, [0, 0, 1], right); };
// Boiler gauge: radial at 75°, stem into its back.
const BA = [Math.cos(75 * DEG), Math.sin(75 * DEG), 0], BS = G.frameAlong([BOIL[0], 0, 104], BA);
BS.len = 35;
const BG = gauge("bg", gaugeFrame(G.add3([BOIL[0], 0, 104], G.mul3(BA, 35)), BA), 9, 2, 20, 5, upper, 29.6, BS);
// Group gauge: stem radial at 120° into the rim; face at 30°, square to it.
const SA = [Math.cos(120 * DEG), Math.sin(120 * DEG), 0], GA = [Math.cos(30 * DEG), Math.sin(30 * DEG), 0];
const GS = G.frameAlong([GRP[0], 0, 98], SA);
GS.len = 18.5;
const GG = gauge("gg", gaugeFrame(G.add3(G.add3([GRP[0], 0, 98], G.mul3(SA, 26.5)), G.mul3(GA, -2.8)), GA), 8, 12, 24, 4, grpWall[1], 14.3, GS);

// steam valve, knob and wand
const WA = 120 * DEG, WD = [Math.cos(WA), Math.sin(WA), 0], VF = G.frameAlong([BOIL[0], 0, 92], WD);
const valve = turned("steam.valve", VF, [[29.6, 4], [39, 4], [39.6, 3.4], [41.6, 3.4], [41.6, 2.4], [42.4, 2.4]], {}, { meta: { seated: true, cut: [upper] } });
const vtop = G.pointOf(VF, 35.6, 0, 0);
cyl("steam.spindle", vtop[0], vtop[1], 1.3, 95.8, 99, {}, { meta: { seated: true, cut: [valve] } });
cyl("steam.knob", vtop[0], vtop[1], 4.6, 99, 104, {}, { inner: k.fadedSvg(G.ribsOf(up(vtop[0], vtop[1], 0), 99, 104, 4.6, 30, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }), extra: Dt([[vtop[0], vtop[1], 104]], { size: 0.6 }) });
const w0 = G.pointOf(VF, 42.4, 0, 0), w1 = G.pointOf(VF, 48.4, 0, 0);
const tipF = G.frameAlong([w1[0], w1[1], 44], [0, 0, -1]);
turned("steam.tip", tipF, [[0, 2.2], [3.2, 2.2], [4.2, 1.6], [5, 1.2]], {}, { extra: Dt([G.pointOf(tipF, 5, 0, 0)], { size: 0.5, tone: "lo" }) });
const WAND = G.fillet([w0, w1, [w1[0], w1[1], 44]], 5, 10, { P, tube: 1.6 });
R.route("wand", WAND, 1.6, {});
tubePieces(WAND, 1.6, P, { maxLength: 12 }).forEach((piece, i) => R.put({ name: `wand:${i}`, at: piece.mid, svg: tubeSvg(piece, { tone: "mid" }), shapes: [A.tube(piece.points, piece.radii)], route: "wand", chunk: i }));

// cup on its saucer, coffee inside (moves away on reset)
const CZ = 20.5, RIM = CZ + 14;
const CF = up(...GRP, 0);
cyl("saucer", ...GRP, 15, 19, 20.5, {}, { cup: 1, inner: L(k.ring(...GRP, 12.6, 20.5, P, 64), { tone: "faint" }) });
const CUPP = [[CZ, 7.6], [CZ + 0.8, 8.4, 1], [CZ + 3, 9.9, 1], [CZ + 6.5, 11.2, 1], [CZ + 10.5, 12.1, 1], [RIM, 12.6]];
const rimIn = 11.6;
const opening = k.ring(...GRP, rimIn, RIM, P, 64);
const cupShape = turned("cup", CF, CUPP, { tone: "hi" }, { cup: 1, hit: "cup", extra: `<path class="es-inside" d="${opening}"/><g clip-path="url(#es-cc)"><path class="es-coffee" data-part="coffee"/><path class="es-stream" data-part="pour-in"/></g>` + L(opening, { tone: "lo" }) });
const normal = (p) => G.unit3([0, 1, 2].map((i) => { const d = [0, 0, 0]; d[i] = 0.01; return A.sdf(cupShape, G.add3(p, d)) - A.sdf(cupShape, G.sub3(p, d)); }));
const hEnd = (z) => { const p = exit(cupShape, [GRP[0], 0, z], [0, 1, 0]); return [p, G.add3(p, G.mul3(normal(p), 2.6))]; };
const [h0, h1] = hEnd(33), [h3, h2] = hEnd(23.8);
const HAND = G.fillet([h0, h1, [GRP[0], 20.6, 32.4], [GRP[0], 20.6, 24.4], h2, h3], 4, 8, { P, tube: 1.1 });
R.route("cup.handle", HAND, 1.1, {});
tubePieces(HAND, 1.1, P, { maxLength: 8 }).forEach((piece, i) => R.put({ name: `handle:${i}`, at: piece.mid, svg: tubeSvg(piece, { tone: "hi" }), shapes: [A.tube(piece.points, piece.radii)], route: "cup.handle", chunk: i, cup: 1 }));

// the lever, prebuilt at every pose
const leverAt = (deg) => {
  const a = [Math.cos(deg * DEG), 0, Math.sin(deg * DEG)], F = G.frameOf(PIV, a, [0, 1, 0], G.cross3(a, [0, 1, 0]));
  const bar = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]];
  const grip = [[52, 2.2], [53, 3.2, 1], [58, 3.7, 1], [68, 3.9, 1], [75, 3.4, 1], [78.6, 2.4, 1], [79.4, 1.2]];
  const svg = S(G.prismOf(F, bar, 3.9, 52, P), {}) + S(G.solidOf(grip, F, P), { tone: "hi" });
  return { svg, shapes: [A.prism(F, bar, 3.9, 52), A.solid(F, grip)] };
};
const POSES = Array.from({ length: NPOSE }, (_, i) => leverAt(REST + ((PULL - REST) * i) / (NPOSE - 1)));
put("lever", G.pointOf(G.frameAlong(PIV, [Math.cos(REST * DEG), 0, Math.sin(REST * DEG)]), 30, 0, 0), `<g data-part="lever">${POSES[0].svg}</g>`, POSES[0].shapes, { hit: "lever" });

// order
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((it) => `<g${it.cup ? " data-cup" : ""}${it.hit ? ` data-hit="${it.hit}"` : ""}>${it.svg}</g>`);
const cut = k.pathOf(G.hullOf([60, 108].flatMap((z) => Array.from({ length: 64 }, (_, i) => at([GRP[0] + 11.6 * Math.cos((i * Math.PI) / 32), 11.6 * Math.sin((i * Math.PI) / 32), z])))), true);
const defs = `<defs><clipPath id="es-gc"><path d="${cut}"/></clipPath><clipPath id="es-cc"><path d="${opening}"/></clipPath></defs>`;
const svg = k.figureSvg({
  width: W,
  height: H,
  label: "A spring-lever espresso machine. A chrome boiler with a band, sight glass, 0–2 bar gauge and steam wand feeds the group through a flanged neck. The group is cut open to show the piston, spring and water; a 0–12 bar gauge reads it, and the lever pivots in a yoke on top. Below, the portafilter with its puck and spouts hangs over a cup on the slotted drip-tray grate.",
  body: [defs, ...back, ...groups, `<g data-part="pour"></g><g data-part="steam"></g>`],
});

const CSS = `<style>
.es-stage{--cf:#5a3218;--cr:#b07a45;--st:#b8743a;--wt:#5f8fb8}
.iso[data-theme="light"] .es-stage{--cf:#6b3a1a;--cr:#c99760;--st:#7a4320;--wt:#7fb0d8}
.es-stage [data-hit]{cursor:pointer}
.es-water{fill:var(--wt);opacity:.45;stroke:none}
.es-wbody .iso-fill,.es-wbody .iso-top,.es-wbody .iso-shade{fill:var(--wt);opacity:.5}
.es-inside{fill:var(--anatomy-shade-1)}
.es-coffee{fill:var(--cr);stroke:var(--cf);stroke-width:.6}
.es-stream{fill:none;stroke:var(--st);stroke-linecap:round}
.es-steam path{fill:none;stroke:var(--anatomy-faint);stroke-linecap:round;stroke-width:1.4}
.es-puck .iso-fill,.es-puck .iso-top,.es-puck .iso-shade{fill:var(--cf)}
.es-puck .iso-top{fill:color-mix(in oklab,var(--cf) 80%,white)}
.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const DATA = { P, PIV, REST, PULL, poses: POSES.map((p) => p.svg), BG, GG, GRP, PIST, STROKE, RIM, CZ, rimIn, spouts: [-2.2, 2.2].map((y) => [GRP[0], y, 36.6]), cupMove: k.axisVector(P, [40, 0, 0]) };
const live = `
const D = ${JSON.stringify(DATA)};
const P = D.P, stage = document.querySelector(".es-stage"), $ = (s) => stage.querySelector(s), readout = document.querySelector("[data-readout]");
const lever = $('[data-part="lever"]'), pistons = stage.querySelectorAll('[data-part="piston"]'), springs = [0, 1].map((n) => $('[data-part="spring' + n + '"]')), wbody = $('[data-part="water"]');
const nb = $('[data-part="bg.needle"]'), ng = $('[data-part="gg.needle"]'), coffee = $('[data-part="coffee"]'), pin = $('[data-part="pour-in"]'), pour = $('[data-part="pour"]'), steam = $('[data-part="steam"]');
const cups = [...stage.querySelectorAll("[data-cup]")], still = matchMedia("(prefers-reduced-motion: reduce)");
const SPEED = 2, VOL = 44, WET = 18, K = 0.36;
const ease = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const f2 = (v) => v.toFixed(2);
// The shot model, in real seconds: x is the piston's lift (0 down, 1 fully up), bar is the group pressure.
let x = 0, phase = "idle", t = 0, bar = 0, boil = 1.0, wet = 0, out = 0, flow = 0, show = 0, cupGo = 0, gone = 0, pose = -1;
let drag = null, frame = 0, last = 0, visible = false, touched = -1e9, now = 0, tourAt = 2;
function step(dt) {
  if (phase === "pull" || phase === "held") {
    if (phase === "pull" && !drag) { x = Math.min(1, x + dt / 0.9); if (x >= 1) phase = "held"; }
    const open = ease(0.78, 0.86, x);
    bar += (open * boil - bar) * (1 - Math.exp(-dt / 0.4));
    if (open > 0.5) { wet = Math.min(WET, wet + 2.5 * dt * open); t += dt; }
  } else if (phase === "shot") {
    t += dt;
    const ramp = 1 - Math.exp(-(t - t0) / 0.9), target = 1 + (2 + 7.4 * x) * ramp * (0.35 + 0.65 * ease(0, 6, wet));
    bar += (target - bar) * (1 - Math.exp(-dt / 0.5));
    const q = K * bar * (x > 0 ? 1 : 0), v = Math.min(q * dt, x * VOL);
    x -= v / VOL;
    const soak = Math.min(v, WET - wet);
    wet += soak; out += v - soak; flow = (v - soak) / dt;
    if (x <= 0.002) { x = 0; phase = "done"; }
  } else { bar += (0 - bar) * (1 - Math.exp(-dt / 0.6)); flow = 0; }
  boil = 1.0 - 0.06 * (phase === "held" ? 1 : 0);
}
let t0 = 0;
function release() { if (phase === "held" || (phase === "pull" && x > 0.85)) (phase = "shot"), (t0 = t); else if (phase === "pull") phase = "back"; }
function reset() { cupGo = 1; }
function pt(F, r, a) { return iso([0, 1, 2].map((i) => F.o[i] + (F.u[i] * Math.cos(a) + F.v[i] * Math.sin(a)) * r), P); }
function needle(el, F, v) {
  const a = (-135 + (270 * Math.min(F.max * 1.04, v)) / F.max) * Math.PI / 180, p0 = pt(F, F.r * 0.24, a + Math.PI), p1 = pt(F, F.r, a);
  el.setAttribute("d", "M" + f2(p0[0]) + " " + f2(p0[1]) + "L" + f2(p1[0]) + " " + f2(p1[1]));
}
function helix(z0, z1) {
  const n = 9 * 24, d = ["", ""], c = D.GRP;
  let prev = -1;
  for (let i = 0; i <= n; i++) {
    const a = (i / 24) * 2 * Math.PI, fr = +(Math.cos(a - Math.PI / 4) > 0), p = iso([c[0] + 8.4 * Math.cos(a), c[1] + 8.4 * Math.sin(a), z0 + ((z1 - z0) * i) / n], P);
    d[fr] += (prev === fr ? "L" : "M") + f2(p[0]) + " " + f2(p[1]);
    if (prev !== fr && prev >= 0) d[prev] += "L" + f2(p[0]) + " " + f2(p[1]);
    prev = fr;
  }
  const e = [z0, z1].map((z) => iso([c[0] + 8.4, c[1], z], P)).map((p) => '<circle class="iso-wire-end" r=".9" cx="' + f2(p[0]) + '" cy="' + f2(p[1]) + '"/>').join("");
  return d.map((p, n) => '<path class="iso-line" data-tone="' + (n ? "hi" : "lo") + '" style="stroke-width:1.1" d="' + p + '"/>' + (n ? e : ""));
}
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
// Between prebuilt poses, the thin lever's leftover turn is an affine map on screen.
function leverXf(ph) {
  const c = Math.cos(ph), s = Math.sin(ph), o = iso(D.PIV, P);
  const [X, Y, Z] = D.PIV, ex = iso([X + 1, Y, Z], P), ez = iso([X, Y, Z + 1], P);
  const a = ex[0] - o[0], b = ez[0] - o[0], cc = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * cc;
  const q = [a * c + b * s, a * -s + b * c, cc * c + d * s, cc * -s + d * c];
  const m = [(q[0] * d - q[1] * cc) / det, (q[2] * d - q[3] * cc) / det, (-q[0] * b + q[1] * a) / det, (-q[2] * b + q[3] * a) / det];
  return "matrix(" + [m[0], m[1], m[2], m[3], o[0] - m[0] * o[0] - m[2] * o[1], o[1] - m[1] * o[0] - m[3] * o[1]].map((v) => v.toFixed(4)).join(" ") + ")";
}
function draw() {
  const lift = x * D.STROKE, zp = D.PIST + lift;
  const n = D.poses.length - 1, i = Math.round(x * n);
  if (i !== pose) { pose = i; lever.innerHTML = D.poses[i]; }
  lever.setAttribute("transform", leverXf((D.PULL - D.REST) * (x - i / n) * Math.PI / 180));
  for (const el of pistons) el.setAttribute("transform", translateAlong(P, [0, 0, lift]));
  const hx = helix(zp + 8, 107.6);
  springs.forEach((el, n) => (el.innerHTML = hx[n]));
  wbody.innerHTML = lift > 0.2 ? solidSvg(cylinder(D.GRP[0], D.GRP[1], 11.4, 60, lift + 1, P, 48), { tone: "lo", className: "es-wbody" }) : "";
  needle(nb, D.BG, boil); needle(ng, D.GG, bar);
  const level = D.CZ + 1.4 + (out / 44) * (D.RIM - D.CZ - 2.6), r = 7.8 + (D.rimIn - 7.8) * Math.min(1, (level - D.CZ - 1.4) / (D.RIM - D.CZ - 1.4)) ** 0.7;
  coffee.setAttribute("d", out > 0.05 ? ring(D.GRP[0], D.GRP[1], r, level, P, 48) : "");
  const w = show * (gone < 0.01 ? 1 : 0);
  let a = "", b = "";
  for (const s of D.spouts) {
    const p0 = iso(s, P), p1 = iso([s[0], s[1], D.RIM], P), p2 = iso([s[0], s[1], level], P), wob = Math.sin(now * 9 + s[1]) * 0.15;
    a += "M" + f2(p0[0]) + " " + f2(p0[1]) + "L" + f2(p1[0] + wob) + " " + f2(p1[1]);
    b += "M" + f2(p1[0] + wob) + " " + f2(p1[1]) + "L" + f2(p2[0] + wob) + " " + f2(p2[1]);
  }
  pour.innerHTML = w > 0.01 ? '<path class="es-stream" style="stroke-width:' + f2(0.5 + 1.3 * w) + ';opacity:' + f2(Math.min(1, w * 1.6)) + '" d="' + a + '"/>' : "";
  pin.setAttribute("d", w > 0.01 ? b : "");
  pin.style.strokeWidth = f2(0.5 + 1.3 * w); pin.style.opacity = f2(Math.min(1, w * 1.6));
  const off = D.cupMove.map((m) => m * cupGo);
  for (const el of cups) { el.setAttribute("transform", "translate(" + f2(off[0]) + " " + f2(off[1]) + ")"); el.style.opacity = f2(1 - ease(0.5, 0.95, cupGo)); }
  const hot = Math.min(1, out / 10) * (1 - cupGo);
  if (hot > 0.01) {
    const c = iso([D.GRP[0] + 12, -4, D.RIM + 1], P), sp = [];
    for (let j = 0; j < 3; j++) {
      const ph = ((now * 0.35 + j / 3) % 1), y0 = c[1] - ph * 16, x0 = c[0] - 4 + j * 5;
      sp.push('<path style="opacity:' + f2(hot * Math.sin(ph * Math.PI) * 0.8) + '" d="M' + f2(x0) + " " + f2(y0) + "c" + "3 -4 -3 -7 0 -11" + '"/>');
    }
    steam.innerHTML = '<g class="es-steam">' + sp.join("") + "</g>";
  } else steam.innerHTML = "";
  const text = bar.toFixed(1) + " bar · " + fmt(t) + " · " + Math.round(out) + " g";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(ms) {
  const dt = last ? Math.min((ms - last) / 1000, 1 / 30) : 1 / 60, calm = still.matches;
  last = ms; now += dt;
  if (calm && touched < 0) { draw(); frame = 0; return; }
  if (!calm && now - touched > 8 && phase === "idle" && cupGo === 0 && now > tourAt) { phase = "pull"; tourAt = 1e9; holdUntil = now + 2.2; }
  if (!calm && holdUntil && phase === "held" && now > holdUntil && now - touched > 8) { holdUntil = 0; release(); }
  if (phase === "back") { x = Math.max(0, x - dt / 0.5); if (!x) phase = "idle"; }
  if (drag) x = drag.x;
  for (let n = 0; n < 4; n++) step((dt * SPEED) / 4);
  show += ((phase === "shot" ? ease(0.15, 1.1, flow) : 0) - show) * (1 - Math.exp(-dt / 0.25));
  if (cupGo > 0) { cupGo = Math.min(2, cupGo + dt * 1.6); if (cupGo >= 1 && gone === 0) { gone = 1; phase = "idle"; x = 0; t = 0; out = 0; wet = 0; bar = 0; show = 0; pose = -1; } if (cupGo >= 2) { cupGo = 0; gone = 0; tourAt = now + 3; } }
  const keep = cupGo; cupGo = cupGo > 1 ? 2 - cupGo : cupGo; draw(); cupGo = keep;
  const busy = drag || phase !== "idle" && phase !== "done" || bar > 0.01 || show > 0.002 || cupGo > 0 || (!calm && (tourAt < 1e8 || out > 0.5));
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
  if (phase === "done" && !calm && now - touched > 8) { if (tourAt > 1e8) tourAt = now + 6; else if (now > tourAt && !cupGo) reset(); }
}
let holdUntil = 0;
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const touch = () => { touched = now; holdUntil = 0; tourAt = now + 8; run(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
function pullOrRelease() { if (phase === "idle" || phase === "back") phase = "pull"; else if (phase === "pull" || phase === "held") release(); else if (phase === "done") reset(); }
stage.addEventListener("pointerdown", (e) => {
  const hit = e.target.closest("[data-hit]")?.dataset.hit;
  touch();
  if (hit === "cup") reset();
  if (hit === "lever" && (phase === "idle" || phase === "held" || phase === "back")) { drag = { y: e.clientY, x0: x, x, px: stage.getBoundingClientRect().height * 0.3 }; phase = "pull"; stage.setPointerCapture(e.pointerId); }
});
stage.addEventListener("pointermove", (e) => { if (drag) { drag.x = Math.min(1, Math.max(0, drag.x0 + (e.clientY - drag.y) / drag.px)); x = drag.x; run(); } });
stage.addEventListener("pointerup", () => { if (drag) { drag = null; if (x >= 1) phase = "held"; release(); touch(); } });
stage.addEventListener("pointercancel", () => { drag = null; if (phase === "pull") phase = "back"; run(); });
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") pullOrRelease();
  else if (e.key === "Escape") reset();
  else return;
  e.preventDefault();
  touch();
});
if (still.matches) { phase = "pull"; x = 1; phase = "held"; for (let n = 0; n < 160; n++) step(0.025); release(); for (let n = 0; n < 280; n++) step(0.025); show = 1; }
draw();
`;

const body = CSS + k.plateHtml({
  fig: "Fig 7",
  title: "Spring-lever espresso",
  hint: "Space or drag the lever · Esc: new cup",
  readout: "0.0 bar · 0:00 · 0 g",
  keys: [
    { mark: "lit", label: "Group gauge needle: the pressure on the puck, 0–12 bar" },
    { mark: "raised", label: "Lever, piston and spring: pulling down loads the spring" },
    { mark: "blue", label: "Water: in the sight glass and under the piston" },
  ],
  caption: "Pulling the lever down lifts the piston, compresses the spring and uncovers the inlet port, so boiler water at about 1 bar fills the chamber and soaks the 18 g puck (pre-infusion). Releasing it lets the spring drive the piston down: the pressure on the puck climbs to about 9 bar, then falls away as the spring extends, and the shot runs out by the spouts until the piston bottoms, about 36 g in 25–30 s with a 4 s pre-infusion. Flow here is modelled as proportional to pressure; time runs 2× fast, and the readout shows real seconds.",
  body: `<div class="iso-stage es-stage" tabindex="0" role="group" aria-label="Espresso machine. Space pulls the lever, Space again pulls the shot, Escape resets.">${svg}</div>`,
});
const name = THEME === "light" ? "espresso-light.html" : "espresso.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Spring-lever espresso", theme: THEME, body, script: kitScript() + live }));
console.log("wrote", name, R.items.length, "items");
A.auditOrExit(R, P);
