import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// ---------- model: Hasselman–Johnson effective medium with an interfacial conductance h ----------
// k_eff = k_m [k_d(1+2α) + 2k_m + 2f(k_d(1−α) − k_m)] / [k_d(1+2α) + 2k_m − f(k_d(1−α) − k_m)], α = k_m / (a h)
const MODEL = { kCu: 400, kD: 1500, a: 100e-6, h: { u: 3e6, a: 2e7, b: 5e7 } };
const kEff = (f, h, m = MODEL) => {
  const al = m.kCu / (m.a * h), A1 = m.kD * (1 + 2 * al) + 2 * m.kCu, B1 = m.kD * (1 - al) - m.kCu;
  return (m.kCu * (A1 + 2 * f * B1)) / (A1 - f * B1);
};

// World units are 0.5 mm. x runs down the line (hoppers → coater → drum → press → loupe), y across, z up.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 640, H = 450;
const PLATE = { x: -164, y: -58, w: 252, d: 120, r: 6 };
const TX = -130, LANE = 22, TRAY = 53, STROKE = 7.6;
const P = k.fitProjection([...k.boxCorners(PLATE, -13, 0), [TX, -22, 166], [TX, 22, 166], [70, 0, 72]], W, H, { pad: 22, azimuth: 54, elevation: 33 });
const V = A.cameraBasis(P).V;
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, { tone: "mid", ...style });
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts.map(at), { size: 0.45, ...style });
const seg = (a, b) => k.segment(a, b, P);
const poly3 = (pts, closed) => k.pathOf(pts.map(at), closed);
const R = A.recorder(P, { order: ["car", "ram"], spring: { stiffness: 90, damping: 19 } });
const CAR = { piece: "car", move: [0, 2 * LANE, 0] }, RAM = { piece: "ram", move: [0, 0, -STROKE] };
const f2 = (v) => Math.round(v * 100) / 100;

function put(name, ref, svg, shapes, o = {}) {
  return R.put({ name: R.nameFor(name), at: ref, svg, shapes: shapes.map((s) => R.solid({ name, ...s })), ...o });
}
const box = (name, [x0, y0, z0], [x1, y1, z1], style, o = {}) => {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: o.r ?? 0.3 };
  return put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, o.steps ?? 2, o.bevel ?? 0), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.slab(plan, z0, z1 - z0, { owner: o.owner }, o.steps ?? 2)], o);
};
const up = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
function turned(name, F, profile, style = {}, o = {}) {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  return put(name, G.add3(F.o, G.mul3(F.a, mid)), (o.pre ?? "") + S(G.solidOf(profile, F, P), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.solid(F, profile, { owner: o.owner })], o);
}
// A seeded PRNG for every scattered thing.
let seed = 9;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- bench ----------
const back = [`<path class="iso-halo" d="${k.haloOf(PLATE, -13, 13, P)}"/>`];
for (const [x, y] of k.corners(PLATE, 14).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) back.push(S(k.cylinder(x, y, 6, -13, 5, P, 24), { tone: "lo" }));
R.solid(A.slab(PLATE, -8, 8, { name: "stand.plate" }));
const screws = k.corners(PLATE, 7);
back.push(S(k.slabOf(PLATE, -8, 8, P, 6, 1.2), { tone: "lo" }), L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }), L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => [x, y, 0]), { size: 0.5 }));
const label = { x: 0, y: 44, w: 34, d: 9, r: 1 };
back.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }), L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([label.x + 3, label.y + 4.4], 0.8, P, "x"), "Cu / DIAMOND PM", { size: 2.3, tone: "lo" }));
back.push(L(k.lineOnTop([label.x + 3, label.y + 6.8], [label.x + 20, label.y + 6.8], 0.8, P), { tone: "faint", free: true }));
R.solid(A.slab(label, 0, 0.8, { name: "stand.label" }));

// ---------- dosing tower: four posts, two beams for the hoppers, two rails for the coater carriage ----------
const XO = [TX - 18, TX - 14], XI = [TX + 14, TX + 18];
for (const [x0, x1] of [XO, XI]) for (const s of [-1, 1]) box("post.foot", [x0 - 2, s > 0 ? 38 : -46, 0], [x1 + 2, s > 0 ? 46 : -38, 1.5], { tone: "lo" }, { r: 0.8, extra: Dt([[x0 - 1, s > 0 ? 45 : -39, 1.5], [x1 + 1, s > 0 ? 39 : -45, 1.5]]) });
for (const [x0, x1] of [XO, XI]) for (const s of [-1, 1]) box("post", [x0, s > 0 ? 40 : -44, 1.5], [x1, s > 0 ? 44 : -40, 150], { tone: "mid" }, { extra: Dt([[(x0 + x1) / 2, s > 0 ? 44 : -40, 60], [(x0 + x1) / 2, s > 0 ? 44 : -40, 140]]) });
for (const [x0, x1] of [XO, XI]) {
  box("beam", [x0, -40, 146], [x1, 40, 150], { tone: "mid" });
  box("rail", [x0, -40, 70], [x1, 40, 74], { tone: "mid" }, { inner: L(seg([(x0 + x1) / 2, -37.5, 74], [(x0 + x1) / 2, 37.5, 74]), { tone: "faint" }) });
  for (const s of [-1, 1]) box("stop", [x0, s > 0 ? 37.5 : -40, 74], [x1, s > 0 ? 40 : -37.5, 77], { tone: "lo" });
}
for (const y of [-LANE, LANE]) {
  const F = up(TX, y, 0), cu = y < 0;
  const fill = `<path class="m-${cu ? "cu" : "dia"}" d="${G.circleOf(F, 164, 13.6, P, 48)}"/>`;
  const grain = Array.from({ length: 22 }, () => { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 12; return [TX + r * Math.cos(a), y + r * Math.sin(a), 164]; });
  turned("hopper.cone", F, [[116, 2], [124, 2], [124, 2.6], [150, 13]], { tone: "hi" }, { inner: L(G.circleOf(F, 120, 2, P, 24), { tone: "faint" }) });
  turned("hopper", F, [[150, 17], [152, 17], [152, 14], [165, 14], [165, 15], [166.5, 15]], { tone: "hi" }, { inner: L(G.circleOf(F, 160, 14, P, 64), { tone: "faint" }), extra: fill + Dt(grain, { size: 0.35, tone: "faint" }) + k.dotsSvg(G.dotsOf(F, 152, 15.6, 12, P, { all: true }), { size: 0.45 }) });
}

// ---------- the coater: a bell jar on a carriage that the a / 0 / b selector shifts across the lanes ----------
const CY = -LANE, CF = up(TX, CY, 0);
box("carriage", [TX - 18, CY - 15, 74], [TX + 18, CY + 15, 76], { lit: true }, { ...CAR, r: 1, steps: 3, extra: Dt([[TX - 16, CY - 13, 76], [TX + 16, CY - 13, 76], [TX - 16, CY + 13, 76], [TX + 16, CY + 13, 76]]) });
turned("spout", CF, [[63, 2.2], [74, 2.2]], { tone: "lo" }, { ...CAR, extra: L(G.circleOf(CF, 66, 2.2, P, 24), { tone: "faint" }) });
turned("jar.base", CF, [[76, 14], [79, 14]], { tone: "mid" }, { ...CAR, extra: Dt([0, 1, 2, 3, 4, 5, 6, 7].map((i) => G.pointOf(CF, 79, 12.6, (i * Math.PI) / 4)).filter((p) => G.dot3(G.sub3(p, CF.o), V) > -60)) });
const GF = up(TX + 13, CY + 10, 0), FT = up(TX - 13, CY + 10, 0);
turned("gauge.stem", GF, [[76, 1], [79, 1]], { tone: "lo" }, CAR);
turned("gauge", GF, [[79, 3.2], [81, 3.2], [81.4, 2.8]], { tone: "mid" }, { ...CAR, extra: L(G.circleOf(GF, 81.4, 2.2, P, 24), { tone: "faint" }) + `<path class="iso-line" data-tone="hi" data-free="both" d="${poly3([G.pointOf(GF, 81.4, 0.3, 2.4), G.pointOf(GF, 81.4, 1.9, -0.7)])}"/>` });
turned("feedthrough", FT, [[76, 2.6], [78, 2.6], [78, 1.6], [83, 1.6], [83, 2.2], [85, 2.2]], { tone: "mid" }, { ...CAR, extra: Dt([[TX - 13, CY + 10, 85]], { size: 0.6, tone: "hi" }) });
const BF = G.frameOf([TX, CY, 88], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
// Inside the glass: the sputter target hanging from the dome, the plasma and the tumbling basket.
const IN = [
  `<path class="cd-plasma" d="${poly3([[TX - 9, CY, 82], [TX + 9, CY, 82], [TX + 9, CY, 99], [TX - 9, CY, 99]], true)}"/>`,
  S(G.disc(98, 100, 6.5, CF, P), { tone: "hi" }),
  L(G.circleOf(BF, -6, 6, P, 32) + G.circleOf(BF, 6, 6, P, 32) + [0, 1, 2, 3].map((i) => seg(G.pointOf(BF, -6, 6, i * 1.571 + 0.4), G.pointOf(BF, 6, 6, i * 1.571 + 0.4))).join(""), { tone: "lo" }),
  `<g data-p="basket"></g>`,
].join("");
turned("jar", CF, [[79, 13.2], [81.5, 13.2], [81.5, 12.5], [99, 12.5, 1], [104, 9.5, 1], [107.2, 4, 1], [108, 2.4], [113, 2.4]], { tone: "hi" }, { ...CAR, pre: `<g class="cd-in">${IN}</g>` });

// ---------- vibratory feeders: two horizontal trays that turn in plan and meet over the drum funnel ----------
const trayRing = (a, b, w) => { const d = G.unit3([b[0] - a[0], b[1] - a[1], 0]), n = [-d[1] * w, d[0] * w]; return [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]]; };
const ext = (ring, z0, z1, style) => S(k.extrude(ring, z0, z1 - z0, P), style);
const TRAYS = [-1, 1].map((s) => ({ a: [TX - 6, s * (LANE + 1.8)], b: [-89, s * 5.6] }));
for (const { a, b } of TRAYS) {
  const d = G.unit3([b[0] - a[0], b[1] - a[1], 0]), n = [-d[1], d[0]];
  const off = (p, t) => [p[0] + n[0] * t, p[1] + n[1] * t];
  const floor = trayRing(a, b, 5), walls = [trayRing(off(a, 4.4), off(b, 4.4), 0.6), trayRing(off(a, -4.4), off(b, -4.4), 0.6), trayRing([a[0] + d[0] * 0.6, a[1] + d[1] * 0.6], [a[0], a[1]], 3.8)];
  const parts = walls.map((r) => [k.depthOf([r[0][0], r[0][1], 55], P), r]).sort((p, q) => p[0] - q[0]);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const near = parts.pop()[1];
  put("tray", [mid[0], mid[1], TRAY + 2], ext(floor, TRAY, TRAY + 1.5, { tone: "mid" }) + parts.map(([, r]) => ext(r, TRAY + 1.5, TRAY + 4, { tone: "mid" })).join(""), [A.extruded(floor, TRAY, 1.5), ...parts.map(([, r]) => A.extruded(r, TRAY + 1.5, 2.5))]);
  put("tray.lip", [mid[0], mid[1], TRAY + 3], ext(near, TRAY + 1.5, TRAY + 4, { tone: "mid" }), [A.extruded(near, TRAY + 1.5, 2.5)]);
  const pm = off(a, 0).map((v, i) => v + d[i] * 18);
  box("feeder", [pm[0] - 5, pm[1] - 4, TRAY - 7], [pm[0] + 5, pm[1] + 4, TRAY], { tone: "mid" }, { r: 1, steps: 3, inner: L([-3, -1, 1, 3].map((t) => seg([pm[0] + t, pm[1] + 4, TRAY - 7], [pm[0] + t, pm[1] + 4, TRAY])).join(""), { tone: "faint" }) });
  box("feeder.post", [pm[0] - 2, pm[1] - 2, 0], [pm[0] + 2, pm[1] + 2, TRAY - 7], { tone: "lo" });
}
const FF = up(-89, 0, 0);
turned("funnel", FF, [[43, 2.2], [45, 2.2], [51.5, 9.2], [53, 9.2]], { tone: "mid" }, { inner: L(G.circleOf(FF, 51.5, 9.2, P), { tone: "faint" }) });

// ---------- mixing drum on trunnions ----------
const DF = G.frameOf([-89, 0, 30], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
turned("drum", DF, [[-27, 7], [-24, 11.4, 1], [-22, 12], [-17.5, 12], [-17.5, 12.6], [-14.5, 12.6], [-14.5, 12], [14.5, 12], [14.5, 12.6], [17.5, 12.6], [17.5, 12], [22, 12], [24, 11.4, 1], [27, 7]], { tone: "hi" }, { extra: `<g data-p="drum"></g>` });
for (const s of [-1, 1]) {
  turned("axle", DF, s < 0 ? [[-36, 2.5], [-27, 2.5]] : [[27, 2.5], [36, 2.5]], { tone: "lo" });
  box("trunnion", [-93, s > 0 ? 30 : -34, 0], [-85, s > 0 ? 34 : -30, 27.5], { tone: "mid" }, { extra: Dt([[-89, s > 0 ? 34 : -30, 6]]) });
}
box("motor", [-101, 38, 0], [-79, 50, 13], { tone: "lo" }, { r: 2, steps: 3, inner: L([-98, -95, -92, -89, -86, -83].map((x) => seg([x, 50, 0], [x, 50, 13])).join(""), { tone: "faint" }) });

// ---------- discharge tray to the die ----------
const DR = trayRing([-80, 0], [-29.5, 0], 4);
put("chute", [-55, 0, 17], ext(DR, 15, 16.5, { tone: "mid" }) + ext(trayRing([-80, -3.4], [-29.5, -3.4], 0.6), 16.5, 18.5, { tone: "mid" }) + ext(trayRing([-80, 3.4], [-29.5, 3.4], 0.6), 16.5, 18.5, { tone: "mid" }), [A.extruded(DR, 15, 1.5), A.extruded(trayRing([-80, -3.4], [-29.5, -3.4], 0.6), 16.5, 2), A.extruded(trayRing([-80, 3.4], [-29.5, 3.4], 0.6), 16.5, 2)]);
box("chute.post", [-58, -2, 0], [-54, 2, 15], { tone: "lo" });

// ---------- die press: base, platen, die, two columns, crosshead, punch and hand wheel ----------
const PX = -20;
box("press.base", [PX - 18, -22, 0], [PX + 18, 22, 4], { tone: "lo" }, { r: 1.5, steps: 3, bevel: 0.5, extra: Dt([[PX - 15, -19, 4], [PX + 15, -19, 4], [PX - 15, 19, 4], [PX + 15, 19, 4]]) });
const PF = up(PX, 0, 0);
turned("platen", PF, [[4, 12], [6, 12]], { tone: "mid" });
put("die", [PX, 0, 11], S(G.ringBand(6, 16, 4.4, 9, PF, P), { tone: "mid" }) + `<path class="cd-slug" data-p="slug" d="${G.circleOf(PF, 15.6, 4.4, P, 32)}"/>`, [A.ring(PF, 6, 16, 4.4, 9)]);
turned("punch.low", PF, [[6, 4.2], [9, 4.2]], { tone: "lo" });
for (const y of [-17, 17]) {
  const F = up(PX, y, 0);
  turned("collar", F, [[4, 3.6], [5.6, 3.6], [6, 3.2]], { tone: "lo" });
  turned("column", F, [[6, 2.4], [62, 2.4]], { tone: "mid" });
  turned("nut", F, [[68, 3.4], [70, 3.4], [70.4, 2.8]], { tone: "lo" }, { extra: L(G.circleOf(F, 70.4, 1.6, P, 20), { tone: "faint" }) });
}
box("crosshead", [PX - 6, -21, 62], [PX + 6, 21, 68], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.5, extra: Dt([[PX - 4, 0, 68], [PX + 4, 0, 68]]) });
const PUNCH = G.frameOf([PX, 0, 62], [0, 0, -1], [1, 0, 0], [0, 1, 0]), ROD = G.rodOut(PUNCH, 0, 38, 4, P, { stroke: STROKE });
put("punch", [PX, 0, 40], `<clipPath id="cd-rod"><path data-hold d="${ROD.clip}"/></clipPath><g clip-path="url(#cd-rod)">${S(ROD.paths, { tone: "hi" })}</g>`, [A.slide(PUNCH, 0, 38, 4)], RAM);
const SCR = G.frameOf([PX, 0, 68], [0, 0, 1], [1, 0, 0], [0, 1, 0]), SROD = G.rodOut(SCR, 0, 16, 2.4, P, { stroke: STROKE });
put("screw", [PX, 0, 76], `<clipPath id="cd-scr"><path data-hold d="${SROD.clip}"/></clipPath><g clip-path="url(#cd-scr)">${S(SROD.paths, { tone: "mid" })}</g>` + L(G.circleOf(SCR, 0.02, 2.8, P, 24), { tone: "faint" }), [A.slide(SCR, 0, 16, 2.4)], RAM);
const spokes = G.spokesOf(SCR, 19, 4.5, 12.5, 6, P, { phase: 0.3 });
turned("wheel", SCR, [[16, 4], [17.2, 4], [17.2, 12.5], [19, 12.5], [19, 4.5], [20.5, 4.5]], { tone: "mid" }, { ...RAM, hit: "press", inner: L(spokes + G.circleOf(SCR, 19, 10.5, P) + G.circleOf(SCR, 19, 4.5, P, 32), { tone: "lo" }) });
const HF = G.frameOf(G.pointOf(SCR, 0, 10.5, 0.3), [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("handle", HF, [[19, 1.4], [25, 1.4], [26, 1]], { tone: "hi" }, { ...RAM, hit: "press" });

// ---------- selector: a three-position rotary switch (a · 0 · b) on a small control box ----------
const SX = -56, SY = 47;
box("switch.box", [SX - 9, SY - 6, 0], [SX + 9, SY + 6, 11], { tone: "mid" }, { r: 1.5, steps: 3, bevel: 0.6, extra: Dt([[SX - 7, SY - 4, 11], [SX + 7, SY + 4, 11]]) });
const KF = up(SX, SY, 0), SEL = [-0.9, 0, 0.9].map((a) => a - Math.PI / 2);
const ticks = SEL.map((a) => poly3([G.pointOf(KF, 11.02, 5.6, a), G.pointOf(KF, 11.02, 7.2, a)])).join("");
turned("switch", KF, [[11, 4.6], [12, 4.6], [12.4, 4.2], [15, 4.2], [15.5, 3.4]], { tone: "hi" }, { hit: "sel", inner: k.fadedSvg(G.ribsOf(KF, 12.4, 15, 4.2, 30, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }), extra: L(ticks, { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-part="pointer" data-free="both" style="stroke-width:1"/>` });

// ---------- inspection: the pressed disc on a stage, and a loupe facing the reader ----------
const IX = 44, IY = 24, IF = up(IX, IY, 0);
turned("stage.foot", IF, [[0, 10], [2, 10], [2.6, 8]], { tone: "lo" });
turned("stage.post", IF, [[2.6, 2.4], [24, 2.4]], { tone: "mid" });
turned("stage", IF, [[24, 9], [26, 9]], { tone: "mid" });
put("puck", [IX, IY, 27.5], `<g class="cd-puck">${S(G.disc(26, 29.5, 6, IF, P), { tone: "hi" })}<path class="cd-ptop" d="${G.circleOf(IF, 29.5, 6, P, 40)}"/></g>`, [A.disc(IF, 26, 29.5, 6)]);
const LC = [IX + 34, IY - 34, 64], LF = G.frameAlong(LC, V), RL = 31;
const wdn = G.unit3(G.sub3([0, 0, -1], G.mul3(V, -V[2])));
const BALL = G.add3(G.add3(LC, G.mul3(wdn, RL + 1.5)), G.mul3(V, -3.6));
const LB = up(BALL[0], BALL[1], 0);
turned("loupe.foot", LB, [[0, 9], [2, 9], [2.6, 7]], { tone: "lo" }, { owner: "loupe" });
turned("loupe.post", LB, [[2.6, 1.6], [BALL[2], 1.6]], { tone: "mid" }, { owner: "loupe" });
put("loupe.ball", BALL, S(G.sphereOf(BALL, 2, P), { tone: "mid" }), [A.ball(BALL, 2, { owner: "loupe" })]);
put("loupe", LC, S(G.ringBand(-1.6, 1.6, RL, RL + 3, LF, P), { tone: "mid" }) + `<g data-p="lens"></g>` + L(G.circleOf(LF, 1.6, RL + 1.5, P, 96), { tone: "faint" }), [A.ring(LF, -1.6, 1.6, RL, RL + 3, { owner: "loupe" })], { bias: 200 });

// ---------- live particle slots ----------
for (const y of [-LANE, LANE]) {
  put("fall", [TX, y, 60], `<g data-p="fall${y < 0 ? 0 : 1}"></g>`, [A.cylinder(TX, y, 0.6, TRAY + 3.1, 7.4)]);
  put("fall.top", [TX, y, 114], `<g data-p="top${y < 0 ? 0 : 1}"></g>`, [A.cylinder(TX, y, 0.6, 113.6, 2.4)]);
}
TRAYS.forEach((t, i) => { const d = G.unit3([t.b[0] - t.a[0], t.b[1] - t.a[1], 0]); put("trayflow", [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2, TRAY + 3], `<g data-p="tray${i}"></g>`, [A.extruded(trayRing([t.a[0] + d[0], t.a[1] + d[1]], t.b, 1), TRAY + 1.5, 1.6)]); });
put("chuteflow", [-55, 0, 18], `<g data-p="chute"></g>`, [A.extruded(trayRing([-79, 0], [-30.5, 0], 1), 16.5, 1.2)], { bias: 30 });

// ---------- order ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((it) => {
  const mv = it.move.some((v) => v) ? ` data-mv="${k.axisVector(P, it.move).map(f2).join(" ")}" data-pc="${it.piece}"` : "";
  return `<g${mv}${it.hit ? ` data-hit="${it.hit}"` : ""}${it.name === "jar" ? ' class="cd-jar"' : ""}>${it.svg}</g>`;
});

// ---------- the micrograph under the loupe: a lattice of diamond sites in fine hexagonal Cu grains ----------
const SC = G.scaleOf(P), RHO = RL * SC, LCS = at(LC).map(f2), A0 = RHO / 3.1;
const sites = [];
for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
  const x = (i + (j & 1) / 2) * A0, y = j * A0 * 0.866;
  if (Math.hypot(x, y) < RHO + A0 * 0.5) sites.push([f2(x + (rnd() - 0.5) * A0 * 0.1), f2(y + (rnd() - 0.5) * A0 * 0.1), f2(rnd() * 6.283), Array.from({ length: 7 }, () => f2(0.86 + rnd() * 0.14))]);
}
const hexR = A0 / 3.4, hex = [];
for (let j = -10; j <= 10; j++) for (let i = -7; i <= 7; i++) {
  const cx = i * hexR * 1.732 + (j & 1) * hexR * 0.866, cy = j * hexR * 1.5;
  if (Math.hypot(cx, cy) > RHO + hexR) continue;
  hex.push("M" + [0, 1, 2, 3].map((q) => { const a = ((q * 60 - 90) * Math.PI) / 180; return f2(cx + hexR * Math.cos(a)) + " " + f2(cy + hexR * Math.sin(a)); }).join("L"));
}

const svg = k.figureSvg({
  width: W,
  height: H,
  label: "A powder-metallurgy bench line. Two hoppers, copper powder and diamond grit, feed through a dosing tower in which a PVD bell-jar coater rides a carriage across the two lanes; two vibratory trays carry the powders to a funnel over a mixing drum, a chute takes the mix to a die press with a hand wheel, and the pressed disc sits on a stage beside a loupe that shows its cross-section.",
  body: [...back, ...groups],
});

const CSS = `<style>
.cd-stage{--cu:#c07a50;--dia:#a8cbe0;--carb:#86ad5c;--glass:.16}
.iso[data-theme="light"] .cd-stage{--cu:#b8693c;--dia:#8fbad6;--carb:#5f9440;--glass:.22}
.cd-stage [data-hit]{cursor:pointer}
.m-cu,.p-cu{fill:var(--cu)}.m-dia,.p-dia{fill:var(--dia)}.m-cu,.m-dia{stroke:none;opacity:.85}
.p-c{stroke:var(--carb);stroke-width:1.1}.p-cu,.p-dia{stroke-width:.4}.p-cu:not(.p-c),.p-dia:not(.p-c){stroke:color-mix(in oklab,currentColor 0%,var(--anatomy-paper))}
.cd-jar .iso-solid>path{fill-opacity:var(--glass)}
.cd-plasma{fill:var(--carb);stroke:none;opacity:calc(var(--pl,0)*.22);filter:blur(3px)}
.cd-slug{fill:color-mix(in oklab,var(--cu) 60%,var(--dia));stroke:none;opacity:var(--sl,0)}
.cd-ptop{fill:color-mix(in oklab,var(--cu) 70%,var(--dia));stroke:var(--anatomy-lo);stroke-width:.6}
.cd-puck{opacity:var(--pk,1)}
.lens-cu{fill:var(--cu)}.lens-g{fill:none;stroke:color-mix(in oklab,var(--cu) 55%,black);stroke-width:.5}
.cd-stage[data-route=a] .lens-g{stroke:var(--carb);stroke-width:.9}
.lens-d{fill:var(--dia);stroke:color-mix(in oklab,var(--dia) 50%,black);stroke-width:.5}
.cd-stage[data-route=b] .lens-d{stroke:var(--carb);stroke-width:1.2}
.lens-gap{fill:none;stroke:var(--anatomy-paper);stroke-width:1.4;opacity:0}
.cd-stage[data-route=u] .lens-gap{opacity:.9}
.iso-swatch[data-mark=cu] path{stroke:var(--cu);stroke-width:4}.iso-swatch[data-mark=dia] path{stroke:var(--dia);stroke-width:4}.iso-swatch[data-mark=carb] path{stroke:var(--carb);stroke-width:4}
@media (max-width:480px){.iso-plate-corner[data-corner="readout"]{font-size:9px;letter-spacing:0}}
.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const fall = (y, z0, z1) => [[TX, y, z0], [TX, y, z1]];
const trayPath = (t) => [[t.a[0], t.a[1], TRAY + 2.4], [t.b[0], t.b[1], TRAY + 2.4], [-89, 0, 46]];
const DATA = {
  P, M: MODEL, LC: LCS, RHO: f2(RHO), A0: f2(A0), sites, hex: hex.join(""), V, DF, SEL, KF, TX, LANE, TRAY,
  fallFree: [fall(-LANE, 115, TRAY + 2.4), fall(LANE, 115, TRAY + 2.4)], fallIn: [fall(-LANE, 115, 108), fall(LANE, 115, 108)], fallOut: [fall(-LANE, 62.5, TRAY + 2.4), fall(LANE, 62.5, TRAY + 2.4)],
  trays: TRAYS.map(trayPath), chute: [[-79, 0, 17], [-30, 0, 17], [PX - 6.5, 0, 16.4]], CB: [TX, -LANE, 88],
};
const live = `
const D = ${JSON.stringify(DATA)};
const kEff = ${kEff.toString()};
const P = D.P, stage = document.querySelector(".cd-stage"), $ = (s) => stage.querySelector(s), readout = document.querySelector("[data-readout]");
const movers = [...stage.querySelectorAll("[data-mv]")].map((el) => [el, el.dataset.mv.split(" ").map(Number), el.dataset.pc]);
const slot = (n) => $('[data-p="' + n + '"]'), still = matchMedia("(prefers-reduced-motion: reduce)");
const pointer = $('[data-part="pointer"]');
const POS = { a: 0, u: 0.5, b: 1 }, NAME = { a: "post-mixed", u: "uncoated", b: "pre-coated" };
const ease = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const f1 = (v) => v.toFixed(1);
let route = "b", shown = "b", vol = 60, car = 1, carV = 0, dial = 1, t = 99, angle = 0;
let frame = 0, last = 0, visible = false, now = 0, touched = -1e9, tourAt = 3;
// lens: Cu grains, diamonds sized so their area share equals the volume share
const lens = slot("lens"), [lx, ly] = D.LC, rho = D.RHO;
function lensSvg() {
  const r = D.A0 * Math.sqrt((vol / 100) * 0.866 / Math.PI);
  let d = "", gap = "";
  for (const [x, y, rot, j] of D.sites) {
    const pts = j.map((s, i) => { const a = rot + (i / j.length) * 6.283; return f1(x + Math.cos(a) * r * s) + " " + f1(y + Math.sin(a) * r * s); });
    d += "M" + pts.join("L") + "Z";
    gap += "M" + f1(x + r * 0.95) + " " + f1(y) + "A" + f1(r * 0.95) + " " + f1(r * 0.95) + " 0 0 1 " + f1(x - r * 0.95) + " " + f1(y);
  }
  lens.innerHTML = '<clipPath id="cd-lens"><circle r="' + rho + '"/></clipPath><g transform="translate(' + lx + " " + ly + ')" clip-path="url(#cd-lens)"><circle class="lens-cu" r="' + rho + '"/><path class="lens-g" d="' + D.hex + '"/><path class="lens-d" d="' + d + '"/><path class="lens-gap" d="' + gap + '"/></g>';
}
const dot = (p, cls, r) => { const q = iso(p, P); return '<circle class="' + cls + '" r="' + r + '" cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '"/>'; };
const along = (path, u) => {
  const L = []; let tot = 0;
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(...path[i].map((v, k) => v - path[i - 1][k])); L.push(l); tot += l; }
  let s = u * tot;
  for (let i = 0; i < L.length; i++) { if (s <= L[i] || i === L.length - 1) { const f = Math.min(1, s / L[i]); return path[i].map((v, k) => v + (path[i + 1][k] - v) * f); } s -= L[i]; }
};
let hi = "";
function stream(path, t0, t1, dur, n, cls) {
  let out = "";
  for (let i = 0; i < n; i++) { const e = t0 + ((t1 - t0) * i) / n, u = (t - e) / dur; if (u >= 0 && u <= 1) { const p = along(path, u), d = dot(p, cls, 1.1); if (p[2] > 88) hi += d; else out += d; } }
  return out;
}
function particles() {
  const coat = route === "u" ? -1 : route === "a" ? 0 : 1, cls = (lane, c) => (lane ? "p-dia" : "p-cu") + (c ? " p-c" : "");
  const fall = ["", ""], top = ["", ""], tray = [];
  for (const lane of [0, 1]) {
    hi = "";
    if (lane === coat) {
      fall[lane] = stream(D.fallIn[lane], 0, 2, 0.4, 10, cls(lane, 0)) + stream(D.fallOut[lane], 3, 5, 0.5, 10, cls(lane, 1));
      tray.push(stream(D.trays[lane], 3.5, 5.5, 2, 10, cls(lane, 1)));
    } else {
      fall[lane] = stream(D.fallFree[lane], 0.5, 2.5, 1.1, 10, cls(lane, 0));
      tray.push(stream(D.trays[lane], 1.6, 3.6, 2, 10, cls(lane, 0)));
    }
    top[lane] = hi;
  }
  slot("top0").innerHTML = top[0]; slot("top1").innerHTML = top[1];
  slot("fall0").innerHTML = fall[0]; slot("fall1").innerHTML = fall[1]; slot("tray0").innerHTML = tray[0]; slot("tray1").innerHTML = tray[1];
  let b = "";
  if (coat >= 0 && t > 0.4 && t < 5) for (let i = 0; i < 8; i++) { const a = angle * 2 + i * 0.785, c = D.CB; b += dot([c[0] + Math.sin(i * 1.3) * 4, c[1] + Math.cos(a) * 3.6, c[2] + Math.sin(a) * 3.6], cls(coat, t > 2.2), 1.3); }
  slot("basket").innerHTML = b;
  let c = "";
  for (let i = 0; i < 16; i++) { const e = 7 + i * 0.12, u = (t - e) / 1.3, lane = i % 2; if (u >= 0 && u <= 1) c += dot(along(D.chute, u), cls(lane, lane === coat), 1.5); }
  slot("chute").innerHTML = c;
  let dd = "";
  for (let i = 0; i < 18; i++) { const a = angle + (i / 18) * 6.283; for (const s of [-16, 16]) { const n = [Math.cos(a), 0, Math.sin(a)]; if (n[0] * D.V[0] + n[2] * D.V[2] > 0.15) dd += dot([D.DF.o[0] + n[0] * 12.6, s, D.DF.o[2] + n[2] * 12.6], "iso-dot", 0.5); } }
  slot("drum").innerHTML = dd;
}
function draw() {
  const stroke = ease(9.4, 10.4, t) * (1 - ease(11, 12, t));
  for (const [el, [dx, dy], pc] of movers) { const s = pc === "car" ? car : stroke; el.setAttribute("transform", "translate(" + f1(dx * s) + " " + f1(dy * s) + ")"); holdStill(el, [dx * s, dy * s]); }
  stage.style.setProperty("--pl", (t > 0.3 && t < 5 && route !== "u" ? Math.min(1, (t - 0.3) * 2, (5 - t) * 2) : 0).toFixed(2));
  stage.style.setProperty("--sl", (ease(8, 8.6, t) * (1 - ease(12, 12.4, t))).toFixed(2));
  stage.style.setProperty("--pk", (t < 8 ? 1 : ease(12.2, 13, t)).toFixed(2));
  const a = D.SEL[0] + dial * (D.SEL[2] - D.SEL[0]), c = D.KF.o;
  const p = (r, q) => iso([c[0] + Math.cos(q) * r, c[1] + Math.sin(q) * r, 15.5], P);
  const p0 = p(1, a + Math.PI), p1 = p(3.2, a);
  pointer.setAttribute("d", "M" + f1(p0[0]) + " " + f1(p0[1]) + "L" + f1(p1[0]) + " " + f1(p1[1]));
  particles();
  if (stage.dataset.route !== shown) stage.dataset.route = shown;
  const h = D.M.h[shown], keff = Math.round(kEff(vol / 100, h, D.M) / 10) * 10;
  const text = "route " + (shown === "u" ? "0" : shown) + " · " + NAME[shown] + " · " + vol + " vol% · ≈ " + keff + " W/m·K (model)";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(ts) {
  const dt = last ? Math.min((ts - last) / 1000, 1 / 30) : 1 / 60, calm = still.matches;
  last = ts; now += dt;
  if (!calm && now - touched > 9 && t > 13.5 && now > tourAt) { setRoute(route === "b" ? "a" : "b", true); tourAt = now + 15; }
  const goal = POS[route];
  if (calm) (car = goal), (carV = 0), (dial = goal), (t = 99), (shown = route);
  else {
    for (let i = 0; i < 4; i++) { carV += (((goal - car) * 90 - carV * 19) * dt) / 4; car += (carV * dt) / 4; }
    dial += (goal - dial) * (1 - Math.exp(-dt / 0.12));
    if (t < 99) { t += dt; angle += dt * (t > 3 && t < 7.5 ? 2.4 : 0.3); }
    if (t > 12.2) shown = route;
  }
  draw();
  const busy = Math.abs(goal - car) > 1e-4 || Math.abs(carV) > 1e-4 || Math.abs(goal - dial) > 1e-3 || t < 13.5 || (!calm && tourAt < 1e8);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const go = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function setRoute(r, batch) { route = r; if (batch) t = Math.abs(car - POS[r]) > 0.05 ? -1.2 : 0; go(); }
const touch = () => { touched = now; tourAt = now + 9; go(); };
const batch = () => { if (t > 12 || t < 0) t = 0; go(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "80px 0px" }).observe(stage);
stage.addEventListener("pointerdown", (e) => {
  const hit = e.target.closest("[data-hit]")?.dataset.hit;
  if (!hit) return;
  touch();
  if (hit === "sel") setRoute(route === "a" ? "u" : route === "u" ? "b" : "a", true);
  if (hit === "press") batch();
});
stage.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "a" || key === "b") setRoute(key, true);
  else if (key === "0" || key === "u") setRoute("u", true);
  else if (key === " " || key === "enter") batch();
  else if (key === "arrowup" || key === "arrowright") vol = Math.min(65, vol + 5);
  else if (key === "arrowdown" || key === "arrowleft") vol = Math.max(40, vol - 5);
  else return;
  e.preventDefault();
  if (key.startsWith("arrow")) lensSvg();
  touch();
});
lensSvg();
stage.dataset.route = shown;
draw();
`;

const body = CSS + k.plateHtml({
  fig: "Fig 9",
  title: "CU / DIAMOND COMPOSITE",
  hint: "A · B · 0 · Space · ↑↓ vol%",
  readout: "route b · pre-coated · 60 vol% · ≈ " + Math.round(kEff(0.6, MODEL.h.b) / 10) * 10 + " W/m·K (model)",
  keys: [
    { mark: "cu", label: "Cu particle" },
    { mark: "dia", label: "Diamond particle (uncoated)" },
    { mark: "carb", label: "Interfacial layer: Ti / Cr / Mo / W carbide" },
    { mark: "lit", label: "Coater carriage: the selector moves it onto the Cu lane (a), the diamond lane (b) or off both (0)" },
  ],
  caption: "Copper barely wets diamond, so a bare Cu–diamond interface passes heat poorly; a carbide interlayer tens to a few hundred nm thick (TiC, Cr₃C₂/Cr₇C₃, Mo₂C, WC) bonds the two. (a) Post-mixing: the Cu powder carries the carbide former, mixed with bare diamond and pressed; the carbide sits on the Cu particle surfaces and reaches the diamond only where they meet during sintering. (b) Pre-coating: every diamond is PVD/CVD-coated first, so the carbide covers each one uniformly at a controlled thickness. The readout is a Hasselman–Johnson model estimate, not a measurement: k(Cu) 400, k(diamond) 1500 W/m·K, 200 µm diamond, interfacial conductance 3×10⁶ (bare), 2×10⁷ (post-mixed) and 5×10⁷ W/m²·K (pre-coated), within the 10⁶–10⁸ range reported. It gives about 300, 640 and 760 W/m·K at 60 vol%, matching reported composites (500–900) and the bare case (route 0, pale gaps at the diamonds) falling below copper.",
  body: `<div class="iso-stage cd-stage" tabindex="0" role="group" data-route="b" aria-label="Copper diamond composite line. A, B or 0 choose the route, Space runs a batch, up and down arrows set the diamond volume share.">${svg}</div>`,
});
const name = THEME === "light" ? "cu-diamond-light.html" : "cu-diamond.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Cu / diamond composite", theme: THEME, body, script: kitScript() + live }));
console.log("wrote", name, R.items.length, "items");
A.auditOrExit(R, P);
