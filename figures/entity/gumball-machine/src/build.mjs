import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// World units are millimetres. x runs across the machine (the front face is +y), z up from the bench.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 480, TAU = Math.PI * 2, RAD = Math.PI / 180;
const BALL = 12.5, GLASS = 80, FLOOR = 172, ZC = FLOOR + Math.sqrt(GLASS ** 2 - 52 ** 2), ZT = ZC + Math.sqrt(GLASS ** 2 - 40 ** 2);
const BASE = { x: -70, y: -70, w: 140, d: 140, r: 12 };
const BODY = { x: -55, y: -55, w: 110, d: 110, r: 14 };
const HUB = [18, 0, 116], SLOT = [-20, 61, 141];

const P = k.fitProjection([...k.boxCorners(BASE, 0, 0), [-GLASS, -GLASS, ZC], [GLASS, GLASS, ZC], [0, 0, ZT + 30], [0, 118, 30]], W, H, { pad: 22, azimuth: 45, elevation: 32 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, { tone: "mid", ...style });
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts.map(at), { size: 0.5, ...style });
const seg = (a, b) => k.segment(a, b, P);
const poly3 = (pts, closed = true) => k.pathOf(pts.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;
const R = A.recorder(P);
const put = (name, ref, svg, shapes, o = {}) => R.put({ name: R.nameFor(name), at: ref, svg, shapes: shapes.map((s) => R.solid({ name, ...s })), ...o });
const box = (name, [x0, y0, z0], [x1, y1, z1], style, o = {}) => {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: o.r ?? 0.4 };
  return put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, o.steps ?? 2, o.bevel ?? 0), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.slab(plan, z0, z1 - z0, {}, o.steps ?? 2)], o);
};
const turned = (name, F, profile, style = {}, o = {}) => {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  return put(name, G.add3(F.o, G.mul3(F.a, mid)), S(G.solidOf(profile, F, P), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.solid(F, profile)], o);
};
const UP = (o) => G.frameAlong(o, [0, 0, 1]);
const ALONG_X = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const prismX = (name, poly, x0, x1, style = {}, o = {}) => put(name, [(x0 + x1) / 2, poly[0][0], poly[0][1]], S(G.prismOf(ALONG_X([0, 0, 0]), poly, x0, x1, P), style) + (o.extra ?? ""), [A.prism(ALONG_X([0, 0, 0]), poly, x0, x1)], o);
const dome = (r0, s0, h, n = 8) => Array.from({ length: n + 1 }, (_, i) => [s0 + h * Math.sin((i / n) * Math.PI / 2), r0 * Math.cos((i / n) * Math.PI / 2) + (i === n ? 0.01 : 0), 1]);

// ---------- base: cast plate on four rubber feet ----------
const back = [`<path class="iso-halo" d="${k.haloOf(BASE, 0, 6, P)}"/>`];
for (const [x, y] of k.corners(BASE, 14).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) back.push(S(k.cylinder(x, y, 8, 0, 6, P, 24), { tone: "lo" }));
R.solid(A.slab(BASE, 6, 12, { name: "stand.base" }));
const screws = k.corners(BASE, 8);
back.push(S(k.slabOf(BASE, 6, 12, P, 6, 1.4), { tone: "lo", inner: L(k.sideSeam(BASE, 12, P, 6), { tone: "faint" }) }), L(k.planOutline(k.insetPlan(BASE, 4), 18, P, 6), { tone: "faint" }));
back.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 18, P, 14)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => [x, y, 18]), { size: 0.55 }));

// ---------- body: skirt, red cast housing, top lip ----------
const RED = { className: "gb-red" };
box("skirt", [-58, -58, 18], [58, 58, 26], { tone: "mid" }, { r: 16, steps: 6, bevel: 0.8, inner: L(k.sideSeam(k.insetPlan({ x: -58, y: -58, w: 116, d: 116, r: 16 }, 0), 22, P, 6), { tone: "faint" }) });
put("body", [0, 0, 92], S(k.slabOf(BODY, 26, 128, P, 6, 1), { tone: "mid", ...RED, inner: L(k.sideSeam(BODY, 40, P, 6) + k.sideSeam(BODY, 148, P, 6), { tone: "lo" }) }), [A.slab(BODY, 26, 128, {}, 6)]);
const LIP = { x: -57, y: -57, w: 114, d: 114, r: 15 };
put("lip", [0, 0, 157], S(k.slabOf(LIP, 154, 6, P, 6, 0.8), { tone: "mid", ...RED }) + L(k.planOutline(k.insetPlan(LIP, 5), 160, P, 6), { tone: "lo" }), [A.slab(LIP, 154, 6, {}, 6)]);

// ---------- collar, coin wheel band, glass globe and gumballs ----------
const COL = UP([0, 0, 0]);
turned("collar", COL, [[160, 61], [161, 61], [168, 60]], { tone: "hi" }, { extra: k.dotsSvg(G.dotsOf(COL, 164.5, 60.6, 16, P, { phase: 0.2 }), { size: 0.55 }) });
const WHEEL = UP([0, 0, 0]), NOTCH = 24, wheelRibs = (ph) => k.fadedSvg(G.ribsOf(WHEEL, 168, 172, 56, NOTCH, P, { phase: ph, fade: [0.05, 0.5] }), { tone: "lo" });
turned("wheel", WHEEL, [[168, 56], [172, 56]], { tone: "hi" }, { inner: `<g data-part="wheel">${wheelRibs(0)}</g>` });

let seed = 0x9e3779b9;
const rnd = () => ((seed = (seed + 0x6d2b79f5) | 0), (((seed ^ (seed >>> 15)) * (1 | seed)) >>> 0) / 4294967296);
const RIN = GLASS - 2, LIM = RIN - BALL, balls = [];
while (balls.length < 78) {
  let best = null;
  for (let t = 0; t < 40; t++) {
    const rr = LIM * Math.sqrt(rnd()), a = rnd() * TAU, x = rr * Math.cos(a), y = rr * Math.sin(a);
    let z = Math.max(FLOOR + BALL, ZC - Math.sqrt(Math.max(0, LIM ** 2 - rr * rr)));
    for (const b of balls) { const dh = Math.hypot(b[0] - x, b[1] - y); if (dh < 2 * BALL) z = Math.max(z, b[2] + Math.sqrt(4 * BALL * BALL - dh * dh)); }
    if (rr ** 2 + (z - ZC) ** 2 <= LIM ** 2 + 1e-6 && (!best || z < best[2])) best = [x, y, z];
  }
  if (!best) break;
  balls.push([...best, Math.floor(rnd() * 5)]);
}
const rank = balls.map((b, i) => i).sort((a, b) => balls[b][2] - balls[a][2]);
const ballSvg = (c, cls, extra = "") => `<g class="gb ${cls}" data-c="${c[3]}"${extra}>${S(G.sphereOf(c.slice(0, 3), BALL, P, { steps: 28 }), { tone: "lo", crease: "none" })}<path class="gb-shine" d="${k.pathOf(G.hullOf(Array.from({ length: 12 }, (_, i) => at(G.add3(c, [Math.cos((i / 12) * TAU) * 2.6 - 2, Math.sin((i / 12) * TAU) * 2.6 + 2, 8 + Math.sin((i / 12) * TAU) * 1.4])))), true)}"/></g>`;
const heap = balls.map((b, i) => [b, i]).sort((a, b) => k.depthOf(a[0], P) - k.depthOf(b[0], P)).map(([b, i]) => ballSvg(b, "gb-heap", ` data-r="${rank.indexOf(i)}"`)).join("");
const GF = UP([0, 0, ZC]);
const gprof = Array.from({ length: 17 }, (_, i) => { const s = (ZC - FLOOR) * -1 + ((ZT - FLOOR) * i) / 16; return [s, Math.sqrt(GLASS ** 2 - s * s), 1]; });
gprof[0][2] = gprof[16][2] = 0;
const gl = G.solidOf(gprof, GF, P);
const glint = (a0, a1, r0, r1, z0) => k.pathOf([...G.arcPoints(UP([0, 0, z0]), 0, r0, a0, a1, 16), ...G.arcPoints(UP([0, 0, z0 + 6]), 0, r1, a1, a0, 16)].map(at), true);
const floor = UP([0, 0, FLOOR]);
const globe = `<path class="gb-glass" d="${gl.fill}"/>` + `<path class="gb-floor" d="${k.pathOf(G.arcPoints(floor, 0, 51, 0, TAU, 64).map(at), true)}"/>` + L(G.circleOf(floor, 0, 30, P, 48), { tone: "faint" }) +
  `<g data-part="heap">${heap}</g>` + `<path class="gb-hl" d="${glint(150 * RAD, 200 * RAD, 70, 74, ZC + 20)}"/><path class="gb-hl" data-soft="" d="${glint(20 * RAD, 70 * RAD, 77, 78.5, ZC - 6)}"/>` +
  `<path class="iso-line iso-edge gb-rim" d="${gl.outline}"/>`;
put("globe", [0, 0, ZC], globe, [A.solid(GF, gprof)]);

// ---------- lid: ring, dome, knob, lock with keyhole ----------
const LID = UP([0, 0, 0]);
turned("lid.ring", LID, [[ZT, 46], [ZT + 8, 46]], { tone: "hi" }, { inner: L(G.arcOf(LID, ZT + 2, 46, P), { tone: "faint" }) });
turned("lid.dome", LID, [[ZT + 8, 44, 0], ...dome(44, ZT + 8, 14).slice(1)], { tone: "hi" }, { inner: L(G.arcOf(LID, ZT + 9.5, 43.6, P, { slope: -0.1 }), { tone: "faint" }) });
turned("lid.stem", LID, [[ZT + 21.6, 4], [ZT + 25, 4]], { tone: "lo" });
turned("lid.knob", LID, [[ZT + 25, 7, 0], ...dome(7, ZT + 25, 6, 6).slice(1)]);
const LOCK = G.frameAlong([0, 0, ZT + 4], [0, 1, 0]), LS = Math.sqrt(46 ** 2 - 3.6 ** 2);
turned("lock", LOCK, [[LS, 3.6], [50.5, 3.6], [51.2, 3]], { tone: "hi" }, { extra: `<path class="gb-hole" d="${k.pathOf([...G.arcPoints(LOCK, 51.2, 1.1, 0, TAU, 16)].map(at), true)}"/>` + L(seg([0, 51.2, ZT + 3.2], [0, 51.2, ZT + 1.6]), { tone: "faint" }) });

// ---------- coin mechanism plate on the front ----------
box("plate", [-40, 55, 92], [40, 58, 152], {}, { r: 3, steps: 4, bevel: 0.6, extra: Dt([[-36, 58, 96], [36, 58, 96], [-36, 58, 148], [36, 58, 148]], { size: 0.6 }) });
box("slot.bezel", [-37, 58, 136], [-3, 61, 146], { tone: "hi" }, { r: 1, steps: 3, bevel: 0.4, hit: "slot", extra: `<path class="gb-hole" d="${poly3([[-34, 61, 140], [-6, 61, 140], [-6, 61, 142], [-34, 61, 142]])}"/>` });
const priceM = (() => { const o = at([-30, 59, 128]), x = k.axisVector(P, [1, 0, 0]), z = k.axisVector(P, [0, 0, -1]); return `matrix(${[...x, ...z, ...o].map(f2).join(" ")})`; })();
box("price", [-34, 58, 116], [-6, 59, 132], { tone: "lo" }, { r: 0.8, steps: 3, extra: k.faceTextSvg(priceM, "25¢", { size: 6.4, tone: "hi" }) + L([seg([-30, 59, 122.5], [-12, 59, 122.5]), seg([-30, 59, 119.5], [-18, 59, 119.5])].join(""), { tone: "faint", free: true }) });
box("pawl.pivot", [34, 58, 122], [38, 60, 126], { tone: "lo" }, { r: 1.8, steps: 4 });
box("pawl", [31.6, 60, 119.6], [37, 61.2, 122.6], { tone: "hi" }, { extra: Dt([[36, 61.2, 121.1]], { size: 0.6 }) });

// ---------- crank: ratchet wheel, knurled hub, arm and knob (the turning faces are drawn live) ----------
const TEETH = 20, KNURL = 28;
const saw = Array.from({ length: TEETH * 2 }, (_, i) => { const a = (Math.floor(i / 2) / TEETH) * TAU + (i % 2) * 0.02; return [(i % 2 ? 11.6 : 14) * Math.cos(a), (i % 2 ? 11.6 : 14) * Math.sin(a)].map(f2); });
const arm = G.stadium(7, 4.6, 26, 20).map((p) => p.map(f2));
const HF = G.frameOf(HUB, [0, 1, 0], [1, 0, 0], [0, 0, 1]), HB = G.frameOf(G.add3(HUB, [0, 61, 0]), [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const KNOB = [[0, 4.4], [9, 5.2], ...dome(5.2, 9, 4, 5).slice(1)], KF = G.frameAlong(G.add3(HUB, [0, 73, 26]), [0, 1, 0]);
const hubSvg = S(G.solidOf([[0, 9], [8, 9], [9, 8]], HB, P), { tone: "mid", inner: `<g data-part="ribs"></g>` + L(G.arcOf(HB, 1, 9, P) + G.arcOf(HB, 7.4, 9, P), { tone: "lo" }) });
const crankSvg = `<g data-part="ratchet"></g>${hubSvg}<g data-part="arm"></g>${Dt([G.add3(HUB, [0, 73, 0])], { size: 0.8, tone: "lo" })}<g data-part="knob">${S(G.solidOf(KNOB, KF, P), { tone: "hi", lit: true })}</g>`;
const crankShapes = [A.disc(HF, 58, 61, 14), A.solid(HB, [[0, 9], [8, 9], [9, 8]]), A.prism(G.frameOf(HUB, [0, 1, 0], [0, 0, 1], [1, 0, 0]), arm, 70, 73), A.solid(KF, KNOB)];
R.put({ name: "crank", at: G.add3(HUB, [0, 66, 0]), svg: `<g data-part="crank" data-hit="crank">${crankSvg}</g>`, shapes: crankShapes.map((s) => R.solid({ name: "crank", ...s })) });

// ---------- delivery chute: escutcheon, walls, floor, hinged flap ----------
const OPEN = [[-13, 57, 50], [13, 57, 50], [13, 57, 82], [-13, 57, 82]];
box("escutcheon", [-20, 55, 44], [20, 57, 88], {}, { r: 0.6, bevel: 0.4, extra: `<path class="gb-hole" d="${poly3(OPEN)}"/>` + Dt([[-17, 57, 47], [17, 57, 47], [-17, 57, 85], [17, 57, 85]], { size: 0.55 }) });
const ZF = (y) => 52 - ((y - 57) * 19) / 43, YE = 112;
const wallP = [[57, ZF(57) - 2], [YE, ZF(YE) - 2], [YE, ZF(YE) + 21.6], [57, ZF(57) + 16]];
prismX("wall.far", wallP, -15, -13, { tone: "mid" });
prismX("floor", [[57, ZF(57) - 2], [YE, ZF(YE) - 2], [YE, ZF(YE)], [57, ZF(57)]], -13, 13, { tone: "lo" });
prismX("wall.near", wallP, 13, 15, { tone: "mid" }, { extra: Dt([[15, 62, ZF(62) + 9], [15, 107, ZF(107) + 9]], { size: 0.55 }) });
const D = G.unit3([0, 43, -19]), N = G.unit3([0, 19, 43]), S0 = [0, 57, 52];
const centreAt = (s) => G.add3(G.add3(S0, G.mul3(D, s)), G.mul3(N, BALL));
const SSTOP = (YE + 0.7 - BALL - S0[1] - N[1] * BALL) / D[1], SIN = 19 / Math.hypot(43, 19);
const HINGE = [0, YE + 2.2, ZF(YE) + 19.4], FLAPS = 16;
function flap(a) {
  const F = G.frameOf(HINGE, [1, 0, 0], [0, Math.cos(-Math.PI / 2 + a), Math.sin(-Math.PI / 2 + a)], [0, -Math.sin(-Math.PI / 2 + a), Math.cos(-Math.PI / 2 + a)]);
  const plate = [[1.4, -1.5], [21, -1.5], [21, 0.1], [1.4, 0.1]], tab = [[19, 0.1], [21, 0.1], [21, 2.5], [19, 2.5]];
  return S(G.prismOf(F, plate, -12.6, 12.6, P), { tone: "hi" }) + S(G.prismOf(F, tab, -6, 6, P), { tone: "mid" });
}
const flapFrames = Array.from({ length: FLAPS }, (_, i) => flap((i / (FLAPS - 1)) * 80 * RAD));
const flapF = G.frameOf(HINGE, [1, 0, 0], [0, 0, -1], [0, 1, 0]);
R.put({ name: "flap", at: G.add3(HINGE, [0, 0.8, -9]), svg: `<g data-part="flap" data-hit="flap">${flapFrames[0]}</g>`, shapes: [R.solid(A.prism(flapF, [[1.4, -1.5], [21, -1.5], [21, 0.1], [1.4, 0.1]], -12.6, 12.6, { name: "flap" }))] });
const PIN = G.frameAlong(HINGE, [1, 0, 0]);
turned("hinge", PIN, [[-13, 1.4], [13, 1.4]], { tone: "lo" });
for (const x of [-15, 13]) { const F = G.frameAlong([x, HINGE[1], HINGE[2]], [1, 0, 0]); put("knuckle", F.o, S(G.solidOf([[0, 2.2], [2, 2.2]], F, P)), [A.disc(F, 0, 2, 2.2)]); }

// ---------- the vended balls (two slots), the coin ----------
const restC = centreAt(SSTOP);
const clipBall = k.pathOf(G.hullOf([...OPEN, ...OPEN.map(([x, , z]) => [x, 200, z > 60 ? z + 20 : z - 60])].map(at)), true);
for (const i of [1, 0]) { const c = G.add3(restC, G.mul3(D, -2 * BALL * i)); R.put({ name: `vend#${i}`, at: c, svg: `<g clip-path="url(#gb-clipb)"><g data-part="vend" data-i="${i}" style="display:none">${ballSvg([...c, 0], "gb-vend")}</g></g>`, shapes: [R.solid(A.ball(c, BALL, { name: "vend" }))] }); }
const COIN = [SLOT[0], SLOT[1] + 12.2, SLOT[2]];
const clipCoin = (() => { const p0 = at([-400, 61, SLOT[2]]), p1 = at([400, 61, SLOT[2]]), q = k.axisVector(P, [0, 400, 0]); return k.pathOf([p0, p1, [p1[0] + q[0], p1[1] + q[1]], [p0[0] + q[0], p0[1] + q[1]]], true); })();
put("coin", COIN, `<g clip-path="url(#gb-clipc)"><g data-part="coin" style="display:none">${S(k.cylinder(COIN[0], COIN[1], 12.13, SLOT[2] - 0.875, 1.75, P, 40), { tone: "hi" })}${L(k.ring(COIN[0], COIN[1], 10.6, SLOT[2] + 0.875, P, 40), { tone: "faint" })}</g></g>`, [A.cylinder(COIN[0], COIN[1], 12.13, SLOT[2] - 0.875, 1.75)]);

// ---------- coin box door on the side ----------
box("door", [55, -32, 44], [57.5, 32, 104], {}, { r: 0.5, bevel: 0.5, inner: L(seg([57.5, -28, 44], [57.5, -28, 104]), { tone: "faint" }), extra: Dt([[57.5, -30, 48], [57.5, -30, 100], [57.5, 30, 48], [57.5, 30, 100]], { size: 0.55 }) });
const DL = G.frameAlong([57.5, 14, 74], [1, 0, 0]);
turned("door.lock", DL, [[0, 5], [3.4, 5], [4, 4.4]], { tone: "hi" }, { extra: `<path class="gb-hole" d="${k.pathOf(G.arcPoints(DL, 4, 1.2, 0, TAU, 16).map(at), true)}"/>` });
box("label", [55, -30, 118], [56.2, 30, 142], { tone: "lo" }, { r: 0.4, extra: L([126, 130, 134].map((z, i) => seg([56.2, -24, z], [56.2, 24 - i * 10, z])).join(""), { tone: "faint", free: true }) });

// ---------- order ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((it) => `<g${it.hit ? ` data-hit="${it.hit}"` : ""}>${it.svg}</g>`);
const defs = `<defs><clipPath id="gb-clipb"><path d="${clipBall}"/></clipPath><clipPath id="gb-clipc"><path d="${clipCoin}"/></clipPath></defs>`;
const svg = k.figureSvg({
  width: W,
  height: H,
  label: "A classic coin-op gumball machine on a cast base with four feet: a red housing with a chrome coin mechanism plate carrying the coin slot, the 25 cent price plate and a crank on a knurled hub with a ratchet and pawl; below it the delivery chute with its hinged flap. On top, a chrome collar and the notched coin wheel carry a glass globe full of one-inch gumballs, closed by a domed lid with a lock.",
  body: [defs, ...back, ...groups],
});

const CSS = `<style>
.gb-stage [data-hit]{cursor:pointer}.gb-stage [data-hit="crank"]{cursor:grab}
.gb-stage{--c0:#9c4a42;--c1:#b39a52;--c2:#5f8a63;--c3:#566f99;--c4:#c9c2b4;--rd:#7a2f2b;--glass:rgba(200,215,230,.07);--hl:rgba(255,255,255,.22)}
.iso[data-theme="light"] .gb-stage{--c0:#d98a7e;--c1:#e6cf86;--c2:#9fc6a0;--c3:#9fb3d6;--c4:#f2eee6;--rd:#d9837a;--glass:rgba(120,150,180,.08);--hl:rgba(255,255,255,.75)}
.gb[data-c="0"]{--b:var(--c0)}.gb[data-c="1"]{--b:var(--c1)}.gb[data-c="2"]{--b:var(--c2)}.gb[data-c="3"]{--b:var(--c3)}.gb[data-c="4"]{--b:var(--c4)}
.gb,.gb-red{--anatomy-paper:var(--b);--anatomy-top:color-mix(in oklab,var(--b) 85%,white);--anatomy-shade-3:color-mix(in oklab,var(--b) 90%,white);--anatomy-shade-2:var(--b);--anatomy-shade-1:color-mix(in oklab,var(--b) 86%,black);--anatomy-shade-0:color-mix(in oklab,var(--b) 72%,black)}
.gb-red{--b:var(--rd)}
.gb-shine{fill:var(--hl);stroke:none}
.gb-glass{fill:var(--glass);stroke:none}.gb-floor{fill:var(--anatomy-shade-1);stroke:none;opacity:.8}
.gb-hl{fill:var(--hl);stroke:none}.gb-hl[data-soft]{opacity:.5}
.gb-rim{stroke:var(--anatomy-hi)}
.gb-hole{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const DATA = {
  P, N: balls.length, hub: HUB, saw, arm, KNURL, HUB: at(G.add3(HUB, [0, 70, 0])), X: k.axisVector(P, [1, 0, 0]), Z: k.axisVector(P, [0, 0, 1]),
  dv: k.axisVector(P, D), sStop: SSTOP, a: (5 / 7) * 9810 * SIN, fall: Math.sqrt((2 * (FLOOR - 64)) / 9810),
  coinV: k.axisVector(P, [0, 1, 0]), colours: rank.map((i) => balls[i][3]),
};
const live = `
const D = ${JSON.stringify(DATA)}, FL = ${JSON.stringify(flapFrames)}, WH = ${JSON.stringify(Array.from({ length: 12 }, (_, i) => wheelRibs((i / 12) * (TAU / NOTCH))))};
const stage = document.querySelector(".gb-stage"), $ = (s) => stage.querySelector(s), readout = document.querySelector("[data-readout]");
const ratchetEl = $('[data-part="ratchet"]'), armEl = $('[data-part="arm"]'), ribsEl = $('[data-part="ribs"]'), knobEl = $('[data-part="knob"]'), flapEl = $('[data-part="flap"]'), wheelEl = $('[data-part="wheel"]'), coinEl = $('[data-part="coin"]');
const heap = [...stage.querySelectorAll(".gb-heap")].sort((a, b) => a.dataset.r - b.dataset.r), vends = [...stage.querySelectorAll('[data-part="vend"]')].sort((a, b) => a.dataset.i - b.dataset.i);
const still = matchMedia("(prefers-reduced-motion: reduce)"), svgEl = stage.querySelector("svg");
let coins = 0, sold = 0, coinIn = false, coinT = -1, th = 0, goal = 0, jig = 0, jv = 0, flapA = 0, flapGoal = 0, drag = null;
let chute = [], frame = 0, last = 0, visible = false, now = 0, touched = -1e9, tourAt = 3, shown = "";
const left = () => D.N - sold;
function insert() { if (coinIn || coinT >= 0 || !left() || chute.length > 1) return false; coinT = 0; coins++; return true; }
function vend() {
  const el = heap[sold]; if (!el) return;
  el.style.display = "none"; const c = D.colours[sold]; sold++;
  chute.push({ s: -16, v: 0, t: -D.fall, c, take: 0 });
}
function take() { if (chute.some((b) => b.t >= 0)) flapGoal = 1; }
function turnTo(t) {
  if (!coinIn) return;
  t = Math.max(th, Math.min(360, t));
  if (th < 200 && t >= 200) vend();
  th = t;
  if (th >= 360) { th = 0; goal = 0; coinIn = false; drag = null; }
}
let crankAt = -1;
const V3 = towardViewer(D.P), H3 = D.hub;
const onFace = (p, q, y, t) => iso([H3[0] + p * Math.cos(t) + q * Math.sin(t), y, H3[2] - p * Math.sin(t) + q * Math.cos(t)], D.P);
const along = (p, q, y, t) => iso([H3[0] + q * Math.sin(t) + p * Math.cos(t), y, H3[2] + q * Math.cos(t) - p * Math.sin(t)], D.P);
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list) => { const h = []; for (const p of list) { while (h.length > 1 && (h[h.length - 1][0] - h[h.length - 2][0]) * (p[1] - h[h.length - 2][1]) - (h[h.length - 1][1] - h[h.length - 2][1]) * (p[0] - h[h.length - 2][0]) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
  return [...half(pts), ...half(pts.reverse())];
}
const solid = (backPts, frontPts, convex) => '<g class="iso-solid"><path class="iso-fill" d="' + pathOf(convex ? hull([...backPts, ...frontPts]) : backPts, true) + '"/>' + (convex ? '' : '<path class="iso-shade" data-shade="0" d="' + pathOf(backPts, true) + '"/><path class="iso-line iso-edge" data-tone="mid" d="' + pathOf(backPts, true) + '"/>') + '<path class="iso-shade" data-shade="2" d="' + pathOf(frontPts, true) + '"/><path class="iso-line iso-crease" data-tone="faint" d="' + pathOf(frontPts, true) + '"/>' + (convex ? '<path class="iso-line iso-edge" data-tone="mid" d="' + pathOf(hull([...backPts, ...frontPts]), true) + '"/>' : '<path class="iso-line iso-edge" data-tone="mid" d="' + pathOf(frontPts, true) + '"/>') + '</g>';
function drawCrank(t) {
  ratchetEl.innerHTML = solid(D.saw.map(([x, y]) => onFace(x, y, 58, t)), D.saw.map(([x, y]) => onFace(x, y, 61, t)), false);
  armEl.innerHTML = solid(D.arm.map(([x, y]) => along(y, x, 70, t)), D.arm.map(([x, y]) => along(y, x, 73, t)), true);
  const lv = {};
  for (let i = 0; i < D.KNURL; i++) {
    const a = t + (i / D.KNURL) * 2 * Math.PI, rad = [Math.sin(a), 0, Math.cos(a)], f = rad[0] * V3[0] + rad[2] * V3[2];
    const al = Math.round(Math.min(1, Math.max(0, (f - 0.05) / 0.45)) * 10) / 10;
    if (al < 0.1) continue;
    const p0 = iso([H3[0] + 9 * rad[0], H3[1] + 62, H3[2] + 9 * rad[2]], D.P), p1 = iso([H3[0] + 9 * rad[0], H3[1] + 68.4, H3[2] + 9 * rad[2]], D.P);
    lv[al] = (lv[al] || "") + pathOf([p0, p1]);
  }
  ribsEl.innerHTML = Object.entries(lv).map(([al, d]) => '<path class="iso-line" data-tone="lo" opacity="' + al + '" d="' + d + '"/>').join("");
  const k0 = iso([H3[0], 0, H3[2] + 26], D.P), k1 = iso([H3[0] + 26 * Math.sin(t), 0, H3[2] + 26 * Math.cos(t)], D.P);
  knobEl.setAttribute("transform", "translate(" + (k1[0] - k0[0]).toFixed(2) + " " + (k1[1] - k0[1]).toFixed(2) + ")");
}
function draw() {
  const ang = ((th + jig) % 360 + 360) % 360;
  if (crankAt !== ang) { crankAt = ang; drawCrank((ang * Math.PI) / 180); }
  const fi = Math.round(flapA * (FL.length - 1));
  if (flapEl.dataset.f != fi) { flapEl.dataset.f = fi; flapEl.innerHTML = FL[fi]; }
  const wa = (sold - (coinIn && th >= 200 ? 1 : 0) + (coinIn ? th / 360 : 0)) * (360 / 6);
  const wi = Math.floor(((wa % 15) / 15) * WH.length) % WH.length;
  if (wheelEl.dataset.f != wi) { wheelEl.dataset.f = wi; wheelEl.innerHTML = WH[wi]; }
  coinEl.style.display = coinT >= 0 ? "" : "none";
  if (coinT >= 0) { const y = 22 - 50 * Math.min(1, coinT); coinEl.setAttribute("transform", "translate(" + (D.coinV[0] * y).toFixed(2) + " " + (D.coinV[1] * y).toFixed(2) + ")"); }
  vends.forEach((el, i) => {
    const b = chute[i];
    el.style.display = b && b.t >= 0 ? "" : "none";
    if (!b) return;
    el.querySelector(".gb").dataset.c = b.c;
    const d = b.s - D.sStop + 25 * i + b.take * 30;
    el.setAttribute("transform", "translate(" + (D.dv[0] * d).toFixed(2) + " " + (D.dv[1] * d - b.take * 40).toFixed(2) + ")");
    el.style.opacity = (1 - b.take).toFixed(2);
  });
  const text = coins * 25 + "¢ · " + sold + (sold === 1 ? " ball · " : " balls · ") + left() + " left" + (coinIn ? " · turn" : "");
  if (text !== shown) readout.textContent = shown = text;
}
function tour() {
  if (!left()) { sold = 0; heap.forEach((el) => (el.style.display = "")); }
  if (chute.some((b) => b.t >= 0 && Math.abs(b.v) < 1)) { take(); tourAt = now + 2.5; }
  else if (!coinIn && coinT < 0) { insert(); tourAt = now + 1.4; }
  else if (coinIn && !drag) { goal = 360; tourAt = now + 3.2; }
}
function tick(t) {
  const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60, calm = still.matches;
  last = t; now += dt;
  if (!calm && now - touched > 7 && now > tourAt) tour();
  if (coinT >= 0) { coinT += calm ? 1 : dt / 0.55; if (coinT >= 1) { coinT = -1; coinIn = true; } }
  if (coinIn && !drag && goal > th) turnTo(calm ? goal : th + Math.min(goal - th, dt * 420 * Math.min(1, 0.25 + (goal - th) / 60)));
  jv += (-jig * 700 - jv * 18) * dt; jig += jv * dt; if (calm) jig = jv = 0;
  for (const b of chute) {
    if (b.t < 0) { b.t += dt; continue; }
    const i = chute.indexOf(b), stop = D.sStop - 25 * i;
    if (calm) { b.s = stop; b.v = 0; }
    b.v += D.a * dt; b.s += b.v * dt;
    if (b.s >= stop) { b.s = stop; b.v = Math.abs(b.v) > 60 ? -0.3 * b.v : 0; }
    b.t += dt;
  }
  const fg = flapGoal;
  flapA = calm ? fg : flapA + (fg - flapA) * (1 - Math.exp(-dt / 0.09));
  if (flapGoal && flapA > 0.7) chute.forEach((b) => { if (b.t >= 0) b.take = Math.min(1, b.take + (calm ? 1 : dt / 0.3)); });
  if (chute.length && chute.every((b) => b.take >= 1)) { chute = []; flapGoal = 0; }
  else if (chute.some((b) => b.take >= 1)) { chute = chute.filter((b) => b.take < 1); flapGoal = 0; }
  draw();
  const busy = coinT >= 0 || drag || (coinIn && goal > th) || Math.abs(jig) > 0.05 || Math.abs(jv) > 0.05 || chute.some((b) => b.t < 0 || Math.abs(b.v) > 0 || b.s < D.sStop - 25 * chute.indexOf(b) || b.take > 0) || Math.abs(flapA - flapGoal) > 0.002 || !calm;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const touch = () => { touched = now; tourAt = now + 7; run(); };
const kick = () => { jv = jv > 0 ? -90 : 90; };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
function angleAt(e) {
  const r = svgEl.getBoundingClientRect(), s = ${W} / r.width, px = (e.clientX - r.left) * s - D.HUB[0], py = (e.clientY - r.top) * s - D.HUB[1];
  const det = D.X[0] * D.Z[1] - D.X[1] * D.Z[0], a = (px * D.Z[1] - py * D.Z[0]) / det, b = (D.X[0] * py - D.X[1] * px) / det;
  return [(Math.atan2(a, b) * 180) / Math.PI, Math.hypot(px, py)];
}
stage.addEventListener("pointerdown", (e) => {
  const hit = e.target.closest("[data-hit]")?.dataset.hit;
  touch();
  if (hit === "slot") insert();
  else if (hit === "flap") take();
  else if (hit === "crank" || angleAt(e)[1] < 44) { drag = { a: angleAt(e)[0] }; stage.setPointerCapture(e.pointerId); }
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const a = angleAt(e)[0]; let d = a - drag.a; d -= Math.round(d / 360) * 360; drag.a = a;
  if (coinIn) { goal = th + Math.max(0, d); turnTo(goal); } else { jig = Math.max(-9, Math.min(9, jig + d)); jv = 0; }
  touch();
});
const up = () => { drag = null; run(); };
stage.addEventListener("pointerup", up);
stage.addEventListener("pointercancel", up);
stage.addEventListener("keydown", (e) => {
  const key = e.key;
  if (key === "c" || key === "C") insert();
  else if (key === " " || key === "ArrowRight") { if (coinIn) goal = 360; else kick(); }
  else if (key === "Enter") take();
  else return;
  e.preventDefault();
  touch();
});
draw();
`;

const body = CSS + k.plateHtml({
  fig: "Fig 5",
  title: "Gumball machine",
  hint: "C coin · Space/drag crank · Enter flap",
  readout: `0¢ · 0 balls · ${balls.length} left`,
  keys: [
    { mark: "lit", label: "Crank knob: one full turn sells one ball, and only with a coin in" },
    { mark: "raised", label: "Gumballs: 25 mm (1 in), packed as they fell" },
    { mark: "flat", label: "Chute: the ball rolls at a = 5/7 · g · sin θ" },
  ],
  caption: `A classic 25¢ gumball machine. A quarter (24.26 mm) in the slot frees the crank; without one the ratchet lets it rock but not turn. One full turn rotates the coin wheel under the globe by one of its six pockets, and the pocket that reaches the hole drops exactly one ball, which falls ${Math.round(FLOOR - 64)} mm inside the body and rolls down the ${(Math.asin(SIN) / RAD).toFixed(0)}° chute like a rolling sphere, a = 5/7 · g · sin θ ≈ ${(DATA.a / 1000).toFixed(1)} m/s², to stop against the flap in about ${Math.sqrt((2 * (SSTOP + 16)) / DATA.a).toFixed(2)} s. The globe holds the ${balls.length} balls drawn here.`,
  body: `<div class="iso-stage gb-stage" tabindex="0" role="group" aria-label="Gumball machine. C inserts a quarter, Space or the right arrow turns the crank, Enter lifts the flap to take the ball.">${svg}</div>`,
});
const name = THEME === "light" ? "gumball-light.html" : "gumball.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Gumball machine", theme: THEME, body, script: kitScript() + live }));
console.log("wrote", name, R.items.length, "items", balls.length, "balls");
A.auditOrExit(R, P);
