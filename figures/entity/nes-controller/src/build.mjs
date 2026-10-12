import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// An NES controller (NES-004) lying face up on a bench, its front shell cut away down to a strip along the
// cord edge. World units are 0.5 mm: x along the controller (+x toward A), y from the cord edge (-53) to the
// near edge (+53), z up from the bench.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 440;
const PLATE = { x: -146, y: -104, w: 324, d: 190, r: 12 };
const C = { x: -120, y: -53, w: 240, d: 106, r: 6 };
const PCB = { x: -110, y: -46, w: 220, d: 90, r: 3 };
const ZR = 14, ZP = 17, ZS = 18.5, ZT = 30, YC = -30;
const DP = { x: -76, y: 22 }, BR = 9.5, CHIP = { y: -19.5 };
const AB = [["B", 52, 28], ["A", 84, 28]], SS = [["SELECT", -14, 28], ["START", 12, 28]];
const PIN = (i) => -17.78 + 5.08 * i;

const P = k.fitProjection([...k.boxCorners(PLATE, -15, 0), [C.x, C.y, ZT], [C.x + C.w, C.y, ZT], [-120, 53, ZT]], W, H, { pad: 22, azimuth: 40, elevation: 35 });
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (p, s) => k.solidSvg(p, s);
const L = (d, s) => k.lineSvg(d, s);
const D = (p, s) => k.dotsSvg(p, s);
const pth = (pts, c = true) => k.pathOf(pts, c);
const R = A.recorder(P);
const put = (name, ref, svg, shapes, attrs = "", bias = 0) => R.put({ name, at: ref, bias, svg, attrs, shapes: shapes.map((s) => R.solid({ ...s, name: s.name ?? name })) });
const YF = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const ZF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const TAU = Math.PI * 2;
const circ = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);
const pill = (cx, cy, half, r, n = 10) => G.stadium(r, r, half * 2, n * 2).map(([u, v]) => [cx + u - half, cy + v]);
const area = (p) => p.reduce((a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0);
const W3 = (F, s, [u, v]) => G.add3(G.add3(G.add3(F.o, G.mul3(F.a, s)), G.mul3(F.u, u)), G.mul3(F.v, v));
const top = (z, inner) => `<g transform="${k.topMatrix([0, 0], z, P)}">${inner}</g>`;
const face = (y, inner) => `<g transform="${k.sideMatrix([0, y], 0, P, "left")}">${inner}</g>`;
const rect = (x0, y0, x1, y1) => `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
const box = (x0, y0, z0, x1, y1, z1) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0, z0, h: z1 - z0 });

// a prism of any polygon (concave too) in a frame's (u, v), from s0 to s1 along F.a, shaded by facing
function prism(F, poly, s0, s1) {
  const ring = area(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length, capNear = G.dot3(F.a, V) > 0;
  const near = ring.map((p) => at(W3(F, capNear ? s1 : s0, p))), far = ring.map((p) => at(W3(F, capNear ? s0 : s1, p)));
  const scr = (q) => (area(q) < 0 ? [...q].reverse() : q);
  const fill = [pth(scr(near))], out = [pth(near)], b = [[], [], [], [], []];
  const nrm = ring.map(([x0, y0], i) => { const [x1, y1] = ring[(i + 1) % n]; return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0)))); });
  const vis = nrm.map((m) => G.dot3(m, V) > 1e-9);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (vis[i] !== vis[(i + n - 1) % n]) out.push(pth([near[i], far[i]], false));
    if (!vis[i]) continue;
    const q = pth(scr([near[i], near[j], far[j], far[i]]));
    fill.push(q);
    b[G.toneOf(nrm[i], P)].push(q);
    out.push(pth([far[i], far[j]], false));
  }
  const ca = capNear ? F.a : G.mul3(F.a, -1);
  b[ca[2] > 0.9 ? 4 : G.toneOf(ca, P)].push(pth(scr(near)));
  return { fill: fill.join(""), outline: out.join(""), crease: "", top: b[4].join(""), shades: b.slice(0, 4).map((x) => x.join("")) };
}
// a seam round a prism at s: the visible run of its side, ending on the silhouette
function seam(F, poly, s) {
  const ring = area(poly) > 0 ? poly : [...poly].reverse(), n = ring.length, runs = [];
  const vis = ring.map(([x0, y0], i) => { const [x1, y1] = ring[(i + 1) % n]; return G.dot3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))), V) > 1e-9; });
  const start = vis.findIndex((v, i) => !vis[(i + n - 1) % n] && v);
  let cur = null;
  for (let t = 0; t < n; t++) {
    const i = (start + t) % n;
    if (vis[i]) (cur ??= [at(W3(F, s, ring[i]))]).push(at(W3(F, s, ring[(i + 1) % n])));
    else if (cur) runs.push(cur), (cur = null);
  }
  if (cur) runs.push(cur);
  return runs.map((r) => pth(r, false)).join("");
}
const block = (b, tone, extra = "", steps = 1) => S(k.slabOf(b, b.z0, b.h, P, steps), { tone, crease: "none" }) + extra;
const boxShape = (b) => A.box([b.x, b.y, b.z0], [b.x + b.w, b.y + b.d, b.z0 + b.h]);
const turned = (x, y, z, mer, tone, name) => {
  const F = G.frameAlong([x, y, z], [0, 0, 1]);
  return { svg: S(G.lathe(mer, F, P), { tone }), shape: A.lathe(F, mer, { name }) };
};

// ---------- the bench ----------
{
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
  const feet = k.corners(PLATE, 20).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) out.push(S(k.cylinder(x, y, 9, -15, 5, P, 28), { tone: "lo" }));
  out.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.4), { tone: "mid" }), L(k.planOutline(k.insetPlan(PLATE, 6), 0, P, 8), { tone: "lo" }));
  const sc = k.corners(PLATE, 13);
  out.push(L(sc.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }), D(sc.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -120, y: 70, w: 226, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(-116, 102, 2, 5, strip.y, 0.8, [2.6, 4.4], P, "x");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const lab = { x: -132, y: -94, w: 46, d: 14, r: 1.4 };
  out.push(S(k.slabOf(lab, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([34, 26, 30].map((w, i) => k.lineOnTop([lab.x + 4, lab.y + 3.5 + i * 3.5], [lab.x + 4 + w, lab.y + 3.5 + i * 3.5], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([lab.x + lab.w - 3.5, lab.y + 7, 0.8])], { size: 0.45 }));
  put("stand.plate", [0, -30, -10], out.join(""), [A.slab(PLATE, -10, 10), ...feet.map(([x, y]) => A.cylinder(x, y, 9, -15, 5))], "", -60);
}

// ---------- rear shell, with the PCB on it ----------
put("shell.rear", [0, 0, 7], `<path class="iso-halo" d="${k.haloOf(C, 0, 6, P)}"/>` + S(k.slabOf(C, 0, ZR, P, 6, 1), { tone: "mid", inner: k.sideSeam(C, 4, P, 6) }) +
  L(k.planOutline(k.insetPlan(C, 3), ZR, P, 6), { tone: "faint" }), [A.slab(C, 0, ZR)]);

// carbon comb pads: two interleaved combs, drawn filled so no finger ends in the air
const PADS = { U: [DP.x, DP.y - 13, 5.5, 5.5], D: [DP.x, DP.y + 13, 5.5, 5.5], L: [DP.x - 13, DP.y, 5.5, 5.5], R: [DP.x + 13, DP.y, 5.5, 5.5],
  SELECT: [-14, 28, 10, 6], START: [12, 28, 10, 6], B: [52, 28, 12, 12], A: [84, 28, 12, 12] };
function comb([cx, cy, hw, hh]) {
  const x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, n = Math.floor((hh * 2 - 0.4) / 2.2);
  const a = [rect(x0, y0, x0 + 1.4, cy + hh)], b = [rect(x1 - 1.4, y0, x1, cy + hh)];
  for (let i = 0; i <= n; i++) { const y = y0 + 0.2 + i * 2.2 * (hh * 2 - 1.4) / (n * 2.2); (i % 2 ? b : a).push(i % 2 ? rect(x0 + 2.4, y, x1, y + 1.2) : rect(x0, y, x1 - 2.4, y + 1.2)); }
  return `<path class="nes-carbon" d="${a.join("")}"/><path class="nes-carbon" d="${b.join("")}"/>`;
}
// copper: each pad to its input leg on the 4021, routed so no two traces cross
const TR = {
  D: [[DP.x - 5.5, 33], [-100, 33], [-100, -7.5], [PIN(0), -7.5], [PIN(0), -10.6]],
  L: [[DP.x - 13, 16.5], [DP.x - 13, -5], [PIN(1), -5], [PIN(1), -10.6]],
  U: [[DP.x, 3.5], [DP.x, -2.5], [PIN(2), -2.5], [PIN(2), -10.6]],
  R: [[DP.x + 13, 16.5], [DP.x + 13, 0], [PIN(3), 0], [PIN(3), -10.6]],
  SELECT: [[-14, 22], [-14, 2.5], [PIN(4), 2.5], [PIN(4), -10.6]],
  START: [[12, 22], [12, -2.5], [PIN(5), -2.5], [PIN(5), -10.6]],
  B: [[52, 16], [52, -5], [PIN(6), -5], [PIN(6), -10.6]],
  A: [[84, 16], [84, -7.5], [PIN(7), -7.5], [PIN(7), -10.6]],
};
const IN = ["D", "L", "U", "R", "SELECT", "START", "B", "A"];
const BOSS = [[-104, 39], [-36, 40], [36, 40], [104, 39]];
{
  const pl = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
  const art = [L(rect(PCB.x + 4, PCB.y + 4, PCB.x + PCB.w - 4, PCB.y + PCB.d - 4), { tone: "faint" })];
  // the far legs to the cord's five wires (VDD, DATA, LATCH, CLOCK, GND) run under the shell strip
  art.push(L([0, 2, 5, 6, 7].map((i) => `M${PIN(i)} -28.4V-44`).join(""), { tone: "lo" }));
  for (const c of IN) art.push(`<g data-pad="${c}">${comb(PADS[c])}</g>`, `<g data-tr="${c}">${L(pl(TR[c]), { tone: "mid" })}</g>`);
  art.push(L(BOSS.map(([x, y]) => pth(circ(x, y, 5.2, 28))).join(""), { tone: "lo" }));
  put("pcb", [0, 0, 15.5], S(k.slabOf(PCB, ZR, ZP - ZR, P, 3), { tone: "lo", crease: "none" }) + top(ZP, art.join("")), [A.slab(PCB, ZR, ZP - ZR, {}, 3)]);
}
// screw bosses standing through the board, each with its screw's tip in the bore
for (const [x, y] of BOSS) put("boss", [x, y, 21], S(k.cylinder(x, y, 4, ZP, 9, P, 28), { tone: "mid" }) + L(k.ring(x, y, 1.8, 26, P, 20), { tone: "lo" }) + D([at([x, y, 26])], { size: 0.5, tone: "hi" }), [A.cylinder(x, y, 4, ZP, 9)]);

// ---------- the 4021 shift register: a 16-pin DIP ----------
{
  const body = { x: -20.3, y: CHIP.y - 6.35, w: 40.6, d: 12.7, r: 0.5 };
  const notch = top(24, L(`M-20.3 ${CHIP.y - 1.8}A1.8 1.8 0 0 1 -20.3 ${CHIP.y + 1.8}`, { tone: "mid" }));
  const label = k.faceTextSvg(k.topMatrix([-11, CHIP.y + 1.2], 24, P), "CD4021", { size: 3.4, tone: "mid" });
  put("chip", [0, CHIP.y, 21], S(k.slabOf(body, 18, 6, P, 2, 0.4), { tone: "lo" }) + notch + label + D([at([-16.5, CHIP.y + 3.6, 24])], { size: 0.45, tone: "mid" }), [A.slab(body, 18, 6, {}, 2)]);
  for (const side of [-1, 1]) {
    const y0 = side < 0 ? CHIP.y - 8.9 : CHIP.y + 6.35;
    const legs = Array.from({ length: 8 }, (_, i) => box(PIN(i) - 0.8, y0, ZP, PIN(i) + 0.8, y0 + 2.55, 21.5));
    put(side < 0 ? "legs.far" : "legs.near", [0, y0 + 1.3, 19], legs.map((b, i) => `<g${side > 0 ? ` data-leg="${IN[i]}"` : ""}>${block(b, "mid")}</g>`).join(""), legs.map(boxShape));
  }
}

// ---------- rubber: domes on the pads, each with a collapsed twin shown while pressed ----------
const DOMES = { pad: [[0, 0], [0, 5], [1.2, 4.7, 1], [4.2, 3, 1], [5.5, 2.4], [5.5, 0]], padDown: [[0, 0], [0, 5.3], [0.6, 5.1, 1], [1.6, 3.6, 1], [2, 2.6], [2, 0]],
  ab: [[0, 0], [0, 9.5], [1.2, 9.1, 1], [3.8, 7.4, 1], [5, 6.4], [5, 0]], abDown: [[0, 0], [0, 9.9], [0.6, 9.7, 1], [1.6, 8.2, 1], [2, 6.4], [2, 0]] };
function dome(code, x, y, z, up, down) {
  const a = turned(x, y, z, up, "lo", `dome.${code}`), b = turned(x, y, z, down, "lo");
  put(`dome.${code}`, [x, y, z + 2], `<g data-dome="${code}" data-st="0">${a.svg}</g><g data-dome="${code}" data-st="1" style="display:none">${b.svg}</g>`, [a.shape]);
}
// D-pad rubber: a thin cross web, four domes and the centre pivot the cross rocks on
{
  const web = [box(DP.x - 13, DP.y - 2.5, ZP, DP.x + 13, DP.y + 2.5, ZS), box(DP.x - 2.5, DP.y - 13, ZP, DP.x + 2.5, DP.y + 13, ZS)];
  put("web.pad", [DP.x, DP.y, ZP + 0.7], block(web[0], "lo") + block(web[1], "lo"), web.map(boxShape));
  for (const [c, dx, dy] of [["U", 0, -13], ["D", 0, 13], ["L", -13, 0], ["R", 13, 0]]) dome(c, DP.x + dx, DP.y + dy, ZS, DOMES.pad, DOMES.padDown);
}
{
  const web = box(52, 25.5, ZP, 84, 30.5, ZS);
  put("web.ab", [68, 28, ZP + 0.7], block(web, "lo"), [boxShape(web)]);
  for (const [c, x, y] of AB) dome(c, x, y, ZS, DOMES.ab, DOMES.abDown);
}
// Select and Start: rubber pills on their own flattening skirts
for (const [c, x, y] of SS) {
  const skirt = (h) => S(prism(ZF, pill(x, y, 6, 4.2), ZP, ZP + h), { tone: "lo" });
  put(`skirt.${c}`, [x, y, ZP + 1.5], `<g data-dome="${c}" data-st="0">${skirt(3)}</g><g data-dome="${c}" data-st="1" style="display:none">${skirt(1.2)}</g>`, [A.prism(ZF, pill(x, y, 6, 4.2), ZP, ZP + 3)]);
  const body = pill(x, y, 6, 2.8);
  put(c, [x, y, 24], `<g data-b="${c}">${S(prism(ZF, body, ZP + 3, 27), { tone: "mid" })}</g>`, [A.prism(ZF, body, ZP + 3, 27)]);
}

// ---------- the buttons ----------
{
  const a = 7.5, s = 19, { x, y } = DP, z0 = 24, z1 = 31.5;
  const piv = turned(x, y, ZS, [[0, 0], [0, 3.2], [z0 - ZS, 3.2], [z0 - ZS, 0]], "lo", "pivot");
  put("pivot", [x, y, 21], piv.svg, [piv.shape]);
  const cross = [[a, -a], [s, -a], [s, a], [a, a], [a, s], [-a, s], [-a, a], [-s, a], [-s, -a], [-a, -a], [-a, -s], [a, -s]].map(([u, v]) => [x + u, y + v]);
  const arrows = [0, 1, 2, 3].map((q) => { const c = Math.cos((q * Math.PI) / 2), sn = Math.sin((q * Math.PI) / 2); return pth([[15, 0], [10.5, 3], [10.5, -3]].map(([u, v]) => [x + u * c - v * sn, y + u * sn + v * c])); });
  const cap = top(z1, L(arrows.join(""), { tone: "mid" }) + L(pth(circ(x, y, 4, 24)), { tone: "faint" }));
  put("dpad", [x, y, 28], `<g data-b="PAD">${S(prism(ZF, cross, z0, z1), { tone: "lo" })}${cap}</g>`,
    [A.box([x - s, y - a, z0], [x + s, y + a, z1]), A.box([x - a, y + a, z0], [x + a, y + s, z1], { name: "dpad.d" }), A.box([x - a, y - s, z0], [x + a, y - a, z1], { name: "dpad.u" })]);
}
for (const [c, x, y] of AB) {
  const b = turned(x, y, 23.5, [[0, 0], [0, BR], [8.8, BR], [9.5, BR - 0.8], [9.5, 0]], "hi", c);
  put(c, [x, y, 28], `<g data-b="${c}">${b.svg}${top(33, L(pth(circ(x, y, 6.5, 40)), { tone: "faint" }))}</g>`, [b.shape]);
}

// ---------- the front shell, cut away to a strip along the cord edge ----------
{
  const U = [[-120, ZR], [-117, ZR], [-117, 27], [117, 27], [117, ZR], [120, ZR], [120, ZT], [-120, ZT]];
  const wall = box(-117, -53, ZR, 117, -50, 27);
  put("shell.wall", [0, -51.5, 20], block(wall, "mid"), [boxShape(wall)]);
  const plate = [[-112, YC], [-112, -43], [-109, -46], [109, -46], [112, -43], [112, YC]];
  const art = `<path class="nes-plate" d="${pth(plate)}"/>` + L(pth(plate, false), { tone: "lo" }) + L(`M60 -40H100M60 -36.5H92`, { tone: "faint", free: true });
  put("shell.front", [0, -41.5, 24], S(prism(YF, U, -53, YC), { tone: "mid", inner: L(seam(YF, U, -40), { tone: "faint" }) }) + top(ZT, art),
    [A.box([-120, -53, 27], [120, YC, ZT]), A.box([-120, -53, ZR], [-117, YC, 27], { name: "shell.l" }), A.box([117, -53, ZR], [120, YC, 27], { name: "shell.r" })]);
}

// ---------- the cord: strain relief, cable, boot and the 7-pin plug ----------
const CORD = 2.4, PX = 140;
{
  const F = G.frameAlong([40, -53, ZR], [0, -1, 0]);
  const mer = [[0, 0], [0, 6], [3, 6], [3, 5], [14, 3.6], [14, 0]];
  put("relief", [40, -60, ZR], S(G.lathe(mer, F, P), { tone: "lo" }), [A.lathe(F, mer)]);
}
{
  const pts = [[40, -67, ZR], [40, -80, ZR], [40, -94, CORD], [PX, -94, CORD], [PX, 4, CORD], [PX, 18, 8], [PX, 26, 8]];
  const route = G.fillet(pts, 8, 10, { P, tube: CORD });
  R.route("cord", route, CORD, { touch: ["stand.plate"], limp: true });
  tubePieces(route, CORD, P, { maxLength: 6, spacing: 1.6 }).forEach((piece, i) =>
    R.put({ name: `cord:${i}`, at: piece.mid, bias: 0.05, svg: tubeSvg(piece, { tone: "mid" }), route: "cord", chunk: i, attrs: ` data-route="cord" data-chunk="${i}"`, shapes: [R.solid(A.tube(piece.points, piece.radii, { name: `cord:${i}`, owner: "cord" }))] }));
}
{
  const F = G.frameAlong([PX, 26, 8], [0, 1, 0]);
  const mer = [[0, 0], [0, 3.6], [6, 5, 1], [10, 6.4], [10, 0]];
  put("boot", [PX, 31, 8], S(G.lathe(mer, F, P), { tone: "lo" }), [A.lathe(F, mer)]);
  const prof = [[PX - 13, 0], [PX + 13, 0], [PX + 13, 13], [PX + 10, 16], [PX - 10, 16], [PX - 13, 13]];
  const ribs = [42, 45, 48, 51].map((s) => seam(YF, prof, s)).join("");
  const sock = [[PX - 9, 4], [PX + 9, 4], [PX + 9, 10], [PX + 6.5, 12.5], [PX - 6.5, 12.5], [PX - 9, 10]].map(([x, z]) => [x, -z]);
  const pins = [[-6, 10], [-2, 10], [2, 10], [6, 10], [-4, 6.5], [0, 6.5], [4, 6.5]];
  const pinFace = face(76, `<path class="nes-plate" d="${pth(sock)}"/>` + L(pth(sock), { tone: "lo" }) + L(pins.map(([x, z]) => pth(circ(PX + x, -z, 1.1, 16))).join(""), { tone: "mid" }));
  put("plug", [PX, 56, 8], S(prism(YF, prof, 36, 76), { tone: "mid", inner: L(ribs, { tone: "lo" }) }) + pinFace + D(pins.map(([x, z]) => at([PX + x, 76, z])), { size: 0.45, tone: "hi" }), [A.prism(YF, prof, 36, 76)]);
}

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const svg = k.figureSvg({
  width: W, height: H,
  label: "An NES controller lying face up on a bench with its front shell cut away. The D-pad, Select, Start, B and A sit on rubber domes over carbon comb pads on the board; copper traces run from each pad to a 4021 shift-register chip, and the cord runs from a strain relief to the seven-pin plug. Pulses run along the cord as the console polls it.",
  body: R.items.map((it) => `<g class="it" data-name="${it.name}"${it.attrs ?? ""}>${it.svg}</g>`),
});

const live = `
const P=${JSON.stringify(P)},still=matchMedia("(prefers-reduced-motion: reduce)");
const st=document.querySelector(".iso-stage"),svg=st.querySelector("svg"),ro=document.querySelector("[data-readout]");
const ORDER=["A","B","SELECT","START","U","D","L","R"],NAME={A:"A",B:"B",SELECT:"Select",START:"Start",U:"Up",D:"Down",L:"Left",R:"Right"};
const DROP={A:3,B:3,SELECT:1.8,START:1.8,PAD:2},PERIOD=3.2,LAT=0.45,T0=0.6,GAP=0.24,RUN=1.1;
const q=s=>[...svg.querySelectorAll(s)],by=a=>{const m={};q("["+a+"]").forEach(g=>(m[g.getAttribute(a)]??=[]).push(g));return m};
const B={};q("[data-b]").forEach(g=>B[g.dataset.b]={g,at:0});
const DOME=by("data-dome"),PAD=by("data-pad"),TR=by("data-tr"),LEG=by("data-leg");
const cord=q("[data-route]").sort((a,b)=>a.dataset.chunk-b.dataset.chunk),N=cord.length;
const KEYS={ArrowUp:"U",ArrowDown:"D",ArrowLeft:"L",ArrowRight:"R",z:"B",Z:"B",x:"A",X:"A",Shift:"SELECT",Enter:"START"};
const TOUR=[[],["A"],["U"],["B","R"],[],["START"],["L"],["SELECT"],["D","A"]];
const user=new Set(),auto=new Set();
let touring=!still.matches,step=0,raf=0,visible=false,last=0,clock=0,word=[1,1,1,1,1,1,1,1],idle=0,shown="",sig=[];
const held=()=>touring?auto:user;
const say=w=>{const n=ORDER.filter((c,i)=>!w[i]).map(c=>NAME[c]);const t="poll 0b"+w.join("")+" \\u00b7 "+(n.length?n.join(" + "):"none");if(t!==shown)ro.textContent=shown=t};
function poll(dt){
  const t0=clock;clock+=dt;
  if(clock>=PERIOD){clock-=PERIOD}
  if(touring&&t0<PERIOD/2&&clock>=PERIOD/2){step=(step+1)%TOUR.length;auto.clear();TOUR[step].forEach(c=>auto.add(c))}
  if(clock<t0||t0===0&&clock>0&&!sig.length){word=ORDER.map(c=>held().has(c)?0:1);say(word)}
  const s=new Array(N).fill("");
  if(clock<LAT){const x=N*(1-clock/LAT);for(let j=0;j<N;j++)if(Math.abs(j+0.5-x)<1.2)s[j]="L"}
  for(let i=0;i<8;i++){const x=(clock-T0-i*GAP)/RUN*N;if(x<-1||x>N+1)continue;for(let j=0;j<N;j++)if(Math.abs(j+0.5-x)<0.7)s[j]=String(word[i])}
  sig=s;cord.forEach((g,j)=>{if(s[j])g.setAttribute("data-sig",s[j]);else g.removeAttribute("data-sig")});
}
function draw(dt){
  const h=held(),down={PAD:["U","D","L","R"].some(c=>h.has(c)),A:h.has("A"),B:h.has("B"),START:h.has("START"),SELECT:h.has("SELECT")};
  let moving=false;
  for(const n in B){const b=B[n],t=down[n]?DROP[n]:0;b.at=still.matches?t:b.at+(t-b.at)*(1-Math.exp(-dt/0.04));if(Math.abs(t-b.at)<0.01)b.at=t;else moving=true;b.g.setAttribute("transform",translateAlong(P,[0,0,-b.at]))}
  for(const c of ORDER){
    const key=["U","D","L","R"].includes(c)?"PAD":c,on=h.has(c)&&B[key].at>DROP[key]*0.5;
    (DOME[c]||[]).forEach(g=>g.style.display=(g.dataset.st==="1")===on?"":"none");
    for(const m of [PAD,TR,LEG])(m[c]||[]).forEach(g=>g.toggleAttribute("data-on",on));
  }
  if(still.matches){cord.forEach(g=>g.removeAttribute("data-sig"));sig=[];say(ORDER.map(c=>h.has(c)?0:1))}
  return moving;
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/20):1/60;last=now;
  if(!still.matches)poll(dt);
  const moving=draw(dt);
  raf=visible&&(!still.matches||moving||user.size)?requestAnimationFrame(tick):0;
}
const run=()=>{if(!raf&&visible){last=0;raf=requestAnimationFrame(tick)}};
function take(){if(touring){touring=false;auto.clear()}clearTimeout(idle);idle=setTimeout(()=>{if(still.matches||user.size)return;touring=true;run()},8000)}
function press(c){take();user.add(c);run()}
function release(c){user.delete(c);run()}
new IntersectionObserver(e=>{visible=e[e.length-1].isIntersecting;if(visible)run()},{rootMargin:"80px 0px"}).observe(st);
st.addEventListener("keydown",e=>{const c=KEYS[e.key];if(!c||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();if(!e.repeat)press(c)});
st.addEventListener("keyup",e=>{const c=KEYS[e.key];if(c)release(c)});
st.addEventListener("blur",()=>{user.clear();run()});
still.addEventListener("change",()=>{touring=!still.matches&&!user.size;run()});
let ptr=null;
svg.addEventListener("pointerdown",e=>{
  const g=e.target.closest("[data-b]");if(!g)return;
  let c=g.dataset.b;
  if(c==="PAD"){const m=svg.getScreenCTM().inverse(),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m),o=iso([${DP.x},${DP.y},31.5],P),ex=axisVector(P,[1,0,0]),ey=axisVector(P,[0,1,0]);
    const dx=p.x-o[0],dy=p.y-o[1],det=ex[0]*ey[1]-ex[1]*ey[0],u=(dx*ey[1]-dy*ey[0])/det,v=(ex[0]*dy-ex[1]*dx)/det;
    c=Math.abs(u)>Math.abs(v)?(u>0?"R":"L"):(v>0?"D":"U")}
  ptr=c;press(c);st.focus({preventScroll:true});e.preventDefault();
});
addEventListener("pointerup",()=>{if(ptr){release(ptr);ptr=null}});
addEventListener("pointercancel",()=>{if(ptr){release(ptr);ptr=null}});
say(word);draw(1);
`;

const css = `<style>
.nes-carbon{fill:var(--anatomy-lo);stroke:none}[data-pad][data-on] .nes-carbon{fill:var(--anatomy-lit)}
.nes-plate{fill:var(--anatomy-shade-0)}[data-b]{cursor:pointer}
[data-tr][data-on] .iso-line{stroke:var(--anatomy-lit)}[data-leg][data-on] .iso-fill,[data-leg][data-on] .iso-shade,[data-leg][data-on] .iso-top{fill:var(--anatomy-lit)}
.it[data-sig="1"] :is(.tb-body,.tb-shine,.tb-shade),.it[data-sig="L"] :is(.tb-body,.tb-shine,.tb-shade){fill:var(--anatomy-lit)}
.it[data-sig="0"] :is(.tb-body,.tb-shine,.tb-shade){fill:var(--anatomy-mid)}.it[data-sig] .tb-edge{stroke:var(--anatomy-lit)}
.iso-stage{touch-action:pan-y}.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;
const body = css + k.plateHtml({
  fig: "Fig 8",
  title: "NES controller",
  hint: "Arrows, Z, X, Shift, Enter",
  readout: "poll 0b11111111 · none",
  keys: [
    { mark: "lit", label: "On the cord: the latch pulse runs in, then eight bits run out, bright for 1, grey for 0" },
    { mark: "raised", label: "Each button rests on a rubber dome; pressed, the dome's carbon pill bridges the comb pad" },
    { mark: "edge", label: "The 4021 shift register holds the eight button lines and sends them out one at a time" },
  ],
  caption: "An NES controller with its front shell cut away. About 60 times a second the console pulses LATCH for 12 µs, which copies the eight button lines into the 4021 shift register; it then reads DATA eight times, clocking the register between reads, so the bits come out in the order A, B, Select, Start, Up, Down, Left, Right. The lines are active-low: a pressed button reads 0. A whole read takes about 100 µs; here it is slowed about 20,000 times, to two seconds. Z is B, X is A, Shift is Select, Enter is Start and the arrows are the D-pad; the readout shows the last word read, A first.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="NES controller. Arrow keys press the D-pad, Z is B, X is A, Shift is Select, Enter is Start.">${svg}</div>`,
});
const file = THEME === "light" ? "nes-controller-light.html" : "nes-controller.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "NES controller", theme: THEME, body, script: kitScript() + live }));
console.log("wrote", file, R.items.length, "items");
A.auditOrExit(R, P);
