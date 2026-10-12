import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const { iso, pathOf, extrude, solidSvg, lineSvg, dotsSvg, depthOf, cylinder, sideArc } = k;
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

// World units are 2.5 mm: a 7-inch single (175 mm) is 70 across. x across the cabinet, y from the back
// wall (-150) to the front (+115), z up from the floor. Ten records stand on edge in a carousel at the back
// of the glass case; a fork on an overhead trolley pulls one out in its own plane, tips it flat onto the
// turntable in front, and the tonearm swings in from its rest.
const W = 600, H = 660;
const M = {
  x0: -20, y0: -55, rr: 50, rec: 35, zr: 174, deck: 152, cz: 209,
  px: -20, py: 72, plat: 30, ztop: 171, beam: 280,
  tx: 32, ty: 50, arm: 58, slot: Math.PI / 2,
};
M.ys = M.y0 + M.rr;
const LEAD = 33.5, RUNOUT = 21.5;
const angleAt = (r) => Math.atan2(M.py - M.ty, M.px - M.tx) - Math.acos((M.arm ** 2 + Math.hypot(M.px - M.tx, M.py - M.ty) ** 2 - r * r) / (2 * M.arm * Math.hypot(M.px - M.tx, M.py - M.ty)));
M.lead = angleAt(LEAD);
M.out = angleAt(RUNOUT);
M.rest = Math.PI / 2;
const TIMES = Array.from({ length: 10 }, (_, i) => 150 + ((i * 37) % 31));
const BODY = { x: -115, y: -150, w: 215, d: 265, r: 12 };

const P = k.fitProjection([...k.boxCorners(BODY, -2, 300)], W, H, { pad: 26, azimuth: 45, elevation: 38 });
const at = (p) => iso(p, P);
const S = solidSvg;
const L = lineSvg;
const byDepth = (pts) => [...pts].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));

// ---------- shared with the page (inlined with toString) ----------
function hull(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const run = (list) => list.reduce((h, p) => { while (h.length > 1 && x(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); return h; }, []);
  const lo = run(s), up = run([...s].reverse());
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
function view(P) {
  const o = depthOf([0, 0, 0], P);
  return [depthOf([1, 0, 0], P) - o, depthOf([0, 1, 0], P) - o, depthOf([0, 0, 1], P) - o];
}
function disc(c, n, R, P, lit, spin) {
  const V = view(P);
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nz = (a) => { const l = Math.hypot(...a); return a.map((q) => q / l); };
  const u = Math.abs(n[2]) > 0.999 ? [1, 0, 0] : nz(cr(n, [0, 0, 1])), v = cr(n, u);
  const f = n[0] * V[0] + n[1] * V[1] + n[2] * V[2] > 0 ? 0.4 : -0.4;
  const pt = (o, r, a) => iso([0, 1, 2].map((i) => c[i] + n[i] * o + r * (Math.cos(a) * u[i] + Math.sin(a) * v[i])), P);
  const ell = (o, r) => Array.from({ length: 56 }, (_, i) => pt(o, r, (i / 56) * Math.PI * 2));
  const face = (r) => pathOf(ell(f, r), true);
  const body = pathOf(hull([...ell(-0.4, R), ...ell(0.4, R)]), true);
  const ln = (d, t) => `<path class="iso-line" data-tone="${t}" d="${d}"/>`;
  let s = `<g class="iso-solid jk-disc"${lit ? " data-lit" : ""}><path class="iso-fill" d="${body}"/><path class="iso-shade" data-shade="0" d="${body}"/><path class="jk-vinyl" d="${face(R - 0.6)}"/>`;
  for (const r of [32.6, 29.8, 26.4, 23.2, 20]) s += ln(face(r), "faint");
  s += `<path class="iso-top" d="${face(17)}"/>` + ln(face(17), "lo") + ln(face(12.5), "faint") + `<path class="iso-fill" d="${face(7.6)}"/>` + ln(face(7.6), "mid");
  if (spin != null) s += ln(pathOf([pt(f, 7.6, spin), pt(f, 12.5, spin)]), "mid") + ln(pathOf([pt(f, 12.5, spin + 2.1), pt(f, 17, spin + 2.1)]), "lo");
  return s + `<path class="iso-line iso-edge" data-tone="${lit ? "hi" : "mid"}" d="${body}"/></g>`;
}
function ringAt(cx, cy, len, wid, a) {
  const c = Math.cos(a), s = Math.sin(a), l = len / 2, w = wid / 2;
  return [[-l, -w], [l, -w], [l, w], [-l, w]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
function mech(St, M, P, keep) {
  const out = [];
  let sh = [];
  const put = (p, svg) => { out.push([depthOf(p, P), svg, sh]); sh = []; };
  const C = (x, y, r, z, h, o, st = 28, bv = 0) => { sh.push(["c", x, y, r, z, h]); return solidSvg(cylinder(x, y, r, z, h, P, st, bv), { tone: "mid", ...o }); };
  const B = (x, y, w, d, z, h, o, r = 0.6) => { sh.push(["s", { x, y, w, d, r }, z, h]); return solidSvg(slabOf({ x, y, w, d, r }, z, h, P, r > 2 ? 6 : 2, r > 2 ? 0.8 : 0.3), { tone: "mid", ...o }); };
  const E = (cx, cy, len, wid, a, z, h, o) => { const g = ringAt(cx, cy, len, wid, a); sh.push(["e", g, z, h]); return solidSvg(extrude(g, z, h, P), { tone: "mid", ...o }); };
  const D = (c, n, lit, spin) => { sh.push(["d", c, n]); return disc(c, n, M.rec, P, lit, spin); };
  const dot = (pts, o) => dotsSvg(pts.map((p) => iso(p, P)), { size: 0.45, ...o });
  const ring = (cx, cy, r, z, t) => lineSvg(onTopRing(cx, cy, r, z, P), { tone: t });
  const { x0, y0, rr, zr, deck, px, py, plat, ztop, tx, ty, arm, cz: rz } = M;
  const pos = (i) => St.alpha + i * Math.PI / 5;
  const dd = (i) => depthOf([Math.cos(pos(i)), Math.sin(pos(i)), 0], P) - depthOf([0, 0, 0], P);
  const order = Array.from({ length: 10 }, (_, i) => i).sort((a, b) => dd(a) - dd(b));
  put([x0, y0, deck - 40], C(x0, y0, 7, deck, zr - 6 - deck));
  const spoke = (i) => { const a = pos(i), c = Math.cos(a), s = Math.sin(a); return E(x0 + c * 51, y0 + s * 51, 72, 5, a, zr - 4, 4) + dot([[x0 + c * 83, y0 + s * 83, zr], [x0 + c * 20, y0 + s * 20, zr]]); };
  put([x0, y0, deck - 36], order.filter((i) => dd(i) < 0).map(spoke).join(""));
  put([x0, y0, deck - 32], C(x0, y0, 15, zr - 6, 6, {}, 40, 0.6));
  put([x0, y0, deck - 28], order.filter((i) => dd(i) >= 0).map(spoke).join(""));
  put([x0, y0, rz], C(x0, y0, 8, zr, 64, { crease: "none" }) + C(x0, y0, 10.5, zr + 64, 3, {}, 32, 0.6) + dot([[x0, y0, zr + 67]], { size: 0.5, tone: "hi" }));
  for (let i = 0; i < 10; i++) {
    if (i === St.sel && St.out) continue;
    const a = pos(i), c = [x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr, rz];
    put(c, D(c, [-Math.sin(a), Math.cos(a), 0], false));
  }
  put([px, py, deck], B(px - 33, py - 33, 66, 66, deck, 12, { tone: "lo" }, 8) + C(px, py, 12, deck + 12, 2, {}, 32) + dot([[px - 28, py - 28, deck + 12], [px + 28, py - 28, deck + 12], [px - 28, py + 28, deck + 12], [px + 28, py + 28, deck + 12]]));
  const sp = St.spin;
  const strobe = Array.from({ length: 24 }, (_, i) => [px + Math.cos(sp + i * Math.PI / 12) * 28.4, py + Math.sin(sp + i * Math.PI / 12) * 28.4, ztop]);
  put([px, py, ztop - 2], C(px, py, plat, deck + 14, ztop - deck - 14, { tone: "hi", crease: "lo" }, 64, 0.5) + ring(px, py, 26.8, ztop, "lo") + dot(strobe, { size: 0.42, tone: "mid" }) + ring(px, py, 20, ztop, "faint") + ring(px, py, 13, ztop, "faint"));
  put([px, py, ztop + 1], C(px, py, 7.2, ztop, 3.4, { tone: "hi" }, 32, 0.4) + C(px, py, 1.3, ztop + 3.4, 4, { tone: "hi" }, 16));
  const q = St.q, th = Math.max(0, q - 1) * Math.PI / 2;
  const yc = M.ys + (py - M.ys) * Math.min(1, q), cz = q <= 1 ? rz + 8 * q : ztop + 0.4 + 45.6 * Math.cos(th);
  if (St.out) {
    const c = St.on ? [px, py, ztop + 0.4] : [x0, yc, cz];
    put(c, D(c, St.on ? [0, 0, 1] : [-Math.cos(th), 0, Math.sin(th)], true, St.on ? -sp : null));
  }
  const g = 36.7 + St.open * 3, bz = cz + 38;
  put([x0, yc - g, cz], B(x0 - 1.5, yc - g - 1.5, 3, 3, cz - 2, bz - cz + 2));
  put([x0, yc + g, cz + 1], B(x0 - 1.5, yc + g - 1.5, 3, 3, cz - 2, bz - cz + 2));
  put([x0, yc, bz + 2], B(x0 - 2.5, yc - g - 3, 5, 2 * g + 6, bz, 4) + C(x0, yc, 1.6, bz + 4, M.beam - 8 - bz - 4, { crease: "none" }, 16) + B(x0 - 7, yc - 9, 14, 18, M.beam - 8, 8) + dot([[x0 + 7, yc - 5, M.beam - 4], [x0 + 7, yc + 5, M.beam - 4]]));
  put([74, 25, deck + 6], B(58, -10, 34, 70, deck, 10, { tone: "lo" }) + B(78, 30, 12, 16, deck + 10, 12) + [[66, 2], [66, 18], [82, 2], [82, 18], [66, 40]].map(([x, y]) => C(x, y, 4.6, deck + 10, 2, {}, 24) + C(x, y, 3.6, deck + 12, 15, { tone: "hi", crease: "none", inner: lineSvg(sideArcOf(x, y, 3.6, deck + 22, P), { tone: "faint" }) }, 24) + dot([[x, y, deck + 27]], { size: 0.6, tone: "hi" })).join("") + dot([[61, -7, deck + 10], [89, -7, deck + 10], [61, 57, deck + 10], [89, 57, deck + 10]]));
  const ra = [tx + Math.cos(M.rest) * 40, ty + Math.sin(M.rest) * 40];
  put([ra[0], ra[1], deck], C(ra[0], ra[1], 4, deck, 2, { tone: "lo" }, 20) + C(ra[0], ra[1], 2.2, deck + 2, 24, { crease: "none" }, 16) + B(ra[0] - 3.5, ra[1] - 1.5, 7, 3, deck + 26, 3));
  const az = ztop + 5 + 5 * St.lift, ph = St.arm, dx = Math.cos(ph), dy = Math.sin(ph), nx = -dy, ny = dx;
  const tip = [tx + dx * arm, ty + dy * arm], hx = tip[0] - dx * 1.5, hy = tip[1] - dy * 1.5;
  let ta = C(tx, ty, 9, deck, 8, { tone: "lo" }, 36, 0.6) + C(tx, ty, 6, deck + 8, az - deck - 8, {}, 32) + B(tx + 8, ty - 14, 6, 6, deck, 14) + C(tx + 11, ty - 11, 1.2, deck + 14, 1 + 5 * St.lift, {}, 12);
  ta += E(tx - dx * 10.5, ty - dy * 10.5, 9, 8, ph, az - 2, 7);
  ta += E(tx + dx * 23, ty + dy * 23, 58, 2.6, ph, az, 2.4, { tone: "hi" });
  ta += C(tx, ty, 2.4, az + 2.4, 1.6, {}, 16);
  ta += E(hx, hy, 11, 6.5, ph + 0.35, az - 1.6, 1.6, { tone: "hi" });
  ta += E(tip[0], tip[1], 5.5, 3.8, ph + 0.35, az - 4.2, 2.6);
  ta += E(hx + Math.cos(ph + 1.92) * 4.8, hy + Math.sin(ph + 1.92) * 4.8, 3, 1.2, ph + 1.92, az - 1.4, 1);
  put([tip[0], tip[1], az + 40], ta);
  out.sort((a, b) => a[0] - b[0]);
  return keep ? out : out.map((o) => o[1]).join("");
}
function sideArcOf(x, y, r, z, P) { return sideArc(x, y, r, z, P, 20); }
function onTopRing(cx, cy, r, z, P) { return pathOf(Array.from({ length: 64 }, (_, i) => iso([cx + Math.cos(i / 32 * Math.PI) * r, cy + Math.sin(i / 32 * Math.PI) * r, z], P)), true); }
const { slabOf } = k;

// ---------- static cabinet ----------
const R = A.recorder(P);
const back = [], front = [];
const item = (list, name, ref, svg, shapes) => { list.push(svg); R.put({ name, at: ref, key: list === back ? back.length : 1000 + front.length, svg, shapes: shapes.map(R.solid) }); };
const slab = (list, name, plan, z, h, o = {}, steps = 4, bevel = 0.6) => item(list, name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...o }), [A.slab(plan, z, h, { name }, steps)]);
const cyl = (list, name, x, y, r, z, h, o = {}) => item(list, name, [x, y, z + h / 2], S(cylinder(x, y, r, z, h, P, Math.max(16, Math.round(r * 5))), { tone: "mid", ...o }), [A.cylinder(x, y, r, z, h, { name })]);

back.push(`<path class="iso-halo" d="${k.haloOf(BODY, 0, 150, P)}"/>`);
for (const [x, y] of byDepth(k.corners(BODY, 16))) cyl(back, "stand.foot", x, y, 6, 0, 6, { tone: "lo" });
slab(back, "stand.plinth", k.insetPlan(BODY, 4), 6, 8, { tone: "lo" }, 8, 0.8);
const seam = (z) => L(k.sideSeam(BODY, z, P, 8), { tone: "faint" });
slab(back, "stand.body", BODY, 14, 136, { inner: seam(30) + seam(104) + seam(140) }, 8, 1.6);
const DECK = k.insetPlan(BODY, 8);
slab(back, "stand.deck", DECK, 150, 2, { tone: "lo", crease: "none" }, 8, 0.4);
back.push(L(k.corners(DECK, 6).map(([x, y]) => k.ring(x, y, 2, 152, P, 16)).join(""), { tone: "lo" }), dotsSvg(k.corners(DECK, 6).map(([x, y]) => at([x, y, 152])), { size: 0.5 }));
const planks = (plan) => L([186, 220, 254].map((z) => k.sideSeam(plan, z, P, 4)).join(""), { tone: "faint" });
const WB = { x: -115, y: -150, w: 215, d: 8, r: 2 }, WL = { x: -115, y: -142, w: 8, d: 257, r: 2 };
slab(back, "stand.wall.back", WB, 152, 138, { inner: planks(WB) + L(k.segment([-107, -142, 152], [-107, -142, 290], P), { tone: "faint" }) });
slab(back, "stand.wall.left", WL, 152, 138, { inner: planks(WL) });
slab(back, "stand.post.br", { x: 94, y: -142, w: 6, d: 6, r: 1 }, 152, 138);
slab(back, "stand.bracket", { x: M.x0 - 7, y: -142, w: 14, d: 9, r: 1 }, M.beam - 10, 10);
back.push(dotsSvg([at([M.x0 - 5, -136, M.beam - 5]), at([M.x0 + 5, -136, M.beam - 5])], { size: 0.45 }));
slab(back, "stand.crown", { x: -119, y: -154, w: 223, d: 16, r: 6 }, 290, 8, {}, 8, 1);
{
  const F = G.frameAlong([-117, -146, 307], [1, 0, 0]), prof = [[0, 9], [3, 9], [3, 7.6], [216, 7.6], [216, 9], [219, 9]];
  const bands = [3, 216].map((s) => G.arcOf(F, s, 7.6, P)).join("");
  item(back, "stand.crown.roll", [-8, -146, 307], S(G.solidOf(prof, F, P), { tone: "mid", inner: L(bands, { tone: "faint" }) }), [A.solid(F, prof, { name: "stand.crown.roll" })]);
}
slab(back, "stand.rail.left", { x: -119, y: -138, w: 12, d: 249, r: 2 }, 290, 4);

slab(front, "stand.beam", { x: M.x0 - 3, y: -142, w: 6, d: 256, r: 1 }, M.beam, 6);
front.push(dotsSvg([-120, -60, 0, 60, 100].map((y) => at([M.x0, y, M.beam + 6])), { size: 0.42 }));
slab(front, "stand.beam.hanger", { x: M.x0 - 4, y: 107, w: 8, d: 7, r: 1 }, M.beam + 6, 290 - M.beam - 6, {}, 2, 0.3);
slab(front, "stand.rail.right", { x: 92, y: -138, w: 12, d: 249, r: 2 }, 290, 4);
slab(front, "stand.rail.front", { x: -119, y: 111, w: 223, d: 8, r: 2 }, 290, 4, {}, 4, 0.6);
front.push(dotsSvg([-100, -60, 40, 80].map((x) => at([x, 115, 294])), { size: 0.45 }));
slab(front, "stand.trim", { x: 100, y: -138, w: 2, d: 240, r: 1 }, 126, 4);
slab(front, "stand.panel", { x: 100, y: -126, w: 1.5, d: 216, r: 6 }, 32, 82, {}, 6, 0.4);
front.push(L(Array.from({ length: 9 }, (_, i) => pathOf([[0, 0], [0, 8], [3, 8], [3, 0]].map(([dy, dz]) => at([101.5, -96 + i * 20 + dy, 92 + dz])), true)).join(""), { tone: "lo" }));
front.push(dotsSvg([[-120, 38], [-120, 108], [84, 38], [84, 108]].map(([y, z]) => at([101.5, y, z])), { size: 0.45 }));
front.push(L([22, 36, 70].map((a) => k.segment([-107, a, 294], [-107 + 111 - a, 111, 294], P)).join(""), { tone: "faint" }));
// grille: chrome bars over a dark cloth panel, between a sill and a header
slab(front, "stand.grille.cloth", { x: -88, y: 115, w: 161, d: 1.5, r: 0.5 }, 22, 62, { tone: "lo" }, 2, 0);
slab(front, "stand.grille.sill", { x: -92, y: 115, w: 169, d: 9, r: 1.5 }, 18, 4);
for (const x of Array.from({ length: 15 }, (_, i) => -82 + i * 11)) cyl(front, "stand.grille.bar", x, 120, 2, 22, 62, { tone: "hi", crease: "none" });
slab(front, "stand.grille.head", { x: -92, y: 115, w: 169, d: 9, r: 1.5 }, 84, 4);
// selector console: ten buttons, a strip of title cards, reject, coin plate
const CON = { x: -84, y: 115, w: 157, d: 24, r: 3 };
slab(front, "stand.console", CON, 108, 16, {}, 4, 1);
slab(front, "stand.titles", { x: -80, y: 117, w: 126, d: 5, r: 0.8 }, 124, 1.2, { tone: "lo" }, 2, 0.2);
front.push(L(Array.from({ length: 10 }, (_, i) => k.planOutline({ x: -78.6 + i * 12.5, y: 117.8, w: 10.2, d: 3.4, r: 0.4 }, 125.2, P, 2)).join(""), { tone: "faint" }));
const BTN = Array.from({ length: 10 }, (_, i) => [-74 + i * 12.5, 129]);
BTN.forEach(([x, y], i) => {
  front.push(`<g data-btn="${i}" style="cursor:pointer">`);
  cyl(front, "stand.button", x, y, 4.2, 124, 2.4, { tone: "mid" });
  front.push(`<circle cx="${at([x, y, 126])[0]}" cy="${at([x, y, 126])[1]}" r="7" fill="transparent"/></g>`);
});
front.push(`<g data-btn="reject" style="cursor:pointer">`);
cyl(front, "stand.reject", 58, 129, 5, 124, 2.4, { tone: "mid" });
front.push(L(k.ring(58, 129, 2.6, 126.4, P, 24), { tone: "lo" }) + `<circle cx="${at([58, 129, 126])[0]}" cy="${at([58, 129, 126])[1]}" r="8" fill="transparent"/></g>`);
slab(front, "stand.coin", { x: 46, y: 139, w: 20, d: 1.4, r: 0.8 }, 110, 12, {}, 2, 0.3);
const slot = [[55, 111], [57, 111], [57, 120], [55, 120]].map(([x, z]) => at([x, 140.4, z]));
front.push(L(pathOf(slot, true), { tone: "hi" }), dotsSvg([at([50, 140.4, 113]), at([50, 140.4, 119]), at([62, 140.4, 113]), at([62, 140.4, 119])], { size: 0.45 }));
front.push(dotsSvg([-80, -40, 0, 40].map((x) => at([x, 139, 116])), { size: 0.4, tone: "lo" }));

// mechanism at rest, recorded for the audit in the page's own order
const REST = { alpha: M.slot - 2 * Math.PI / 5, q: 1, open: 0, sel: -1, out: false, on: false, spin: 0, lift: 1, arm: M.rest };
const mechSvg = mech(REST, M, P);
mech(REST, M, P, true).forEach(([, svg, sh], i) => R.put({ name: "mech." + i, at: [0, 0, 0], key: 500 + i, svg, shapes: sh.map(([t, ...a]) => R.solid(t === "c" ? A.cylinder(...a, { name: "mech." + i }) : t === "s" ? A.slab(a[0], a[1], a[2], { name: "mech." + i }, a[0].r > 2 ? 6 : 2) : t === "e" ? A.extruded(...a, { name: "mech." + i }) : A.disc(G.frameAlong(a[0], a[1]), -0.4, 0.4, M.rec, { name: "mech." + i }))) }));
const svg = k.figureSvg({
  width: W, height: H,
  label: "A 1950s jukebox with a glass top. Ten 45 rpm records stand on edge in a carousel; a fork on an overhead trolley pulls the chosen record out, tips it flat onto the turntable, and the tonearm swings in to play it.",
  body: [...back, `<g data-mech>${mechSvg}</g>`, ...front],
});

const LIVE = `
const P = ${JSON.stringify(P)}, M = ${JSON.stringify(M)}, TIMES = ${JSON.stringify(TIMES)}, FAST = 10;
${[hull, view, disc, ringAt, mech, sideArcOf, onTopRing].map(String).join("\n")}
const stage = document.querySelector(".iso-stage"), layer = stage.querySelector("[data-mech]"), readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const St = ${JSON.stringify(REST)};
let steps = [], step = null, rpm = 0, want = -1, cur = -1, played = 0, reject = false, visible = false, frame = 0, last = 0, idle = 0, tourAt = 0, touched = false, dirty = true;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const T = (d, to, tag, end) => ({ d, to, tag, end });
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
function load(n) {
  cur = n; played = 0; St.sel = n;
  let target = M.slot - n * Math.PI / 5, d = ((target - St.alpha) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  steps = [T(0.5 + Math.abs(d) * 0.5, { alpha: St.alpha + d }, "turn"), T(1, { q: 0, open: 1 }, "fetch"), T(0.4, { open: 0 }, "grip", () => { St.out = true; }),
    T(2.4, { q: 2 }, "lift"), T(0.4, { open: 1 }, "drop", () => { St.on = true; }), T(1, { q: 1, open: 0 }, "clear"),
    T(1.4, { arm: M.lead }, "cue"), T(0.7, { lift: 0 }, "lower"), T(TIMES[n] / FAST, { arm: M.out }, "play", () => { played = TIMES[n]; }), ...back()];
}
function back() {
  return [T(0.5, { lift: 1 }, "end"), T(1.3, { arm: M.rest }, "home"), T(1, { q: 2, open: 1 }, "unload"), T(0.4, { open: 0 }, "grip", () => { St.on = false; }),
    T(2.4, { q: 0 }, "return"), T(0.4, { open: 1 }, "release", () => { St.out = false; }), T(1, { q: 1, open: 0 }, "park", () => { cur = -1; St.sel = -1; if (want >= 0) { const n = want; want = -1; load(n); } })];
}
function select(n) {
  touched = true; idle = 0; want = n; reject = false;
  if (cur < 0 && !step) { want = -1; load(n); }
  else if (step && ["cue", "lower", "play"].includes(step.tag)) { step = null; steps = back(); }
  run();
}
function cancel() { touched = true; idle = 0; want = -1; if (step && ["cue", "lower", "play"].includes(step.tag)) { step = null; steps = back(); } else if (cur >= 0) reject = true; run(); }
function advance(dt) {
  rpm += ((St.on && step && ["cue", "lower", "play"].includes(step.tag) ? 45 : 0) - rpm) * (1 - Math.exp(-dt / 0.5));
  if (rpm < 0.05 || still.matches) rpm = rpm < 0.05 ? 0 : 45 * (St.on && step && ["cue", "lower", "play"].includes(step.tag));
  if (!still.matches) St.spin += rpm / 60 * 2 * Math.PI * dt * 0.25;
  if (!step && steps.length) { step = steps.shift(); step.t = 0; step.from = {}; for (const key in step.to) step.from[key] = St[key]; }
  if (step) {
    if (!(still.matches && step.tag === "play")) step.t = still.matches ? 1 : Math.min(1, step.t + dt / step.d);
    const e = step.tag === "play" ? step.t : ease(step.t);
    for (const key in step.to) St[key] = step.from[key] + (step.to[key] - step.from[key]) * e;
    if (step.tag === "play") played = step.t * TIMES[cur];
    if (step.t >= 1) { const s = step; step = null; s.end && s.end(); if (reject && s.tag === "clear") { reject = false; steps = back(); } }
  }
  dirty = true;
}
function draw() {
  layer.innerHTML = mech(St, M, P);
  stage.querySelectorAll("[data-btn]").forEach((b) => { const on = String(cur) === b.dataset.btn; b.querySelector(".iso-solid").toggleAttribute("data-lit", on); b.style.transform = on ? "translateY(0.8px)" : ""; });
  const tag = step ? step.tag : "";
  const text = cur < 0 ? "select a record · 0 rpm" : "No. " + ((cur + 1) % 10) + " · " + Math.round(rpm) + " rpm · " + fmt(played) + " / " + fmt(TIMES[cur]) + (tag === "play" ? " · ×" + FAST : "");
  if (readout.textContent !== text) readout.textContent = text;
  dirty = false;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now;
  idle += dt;
  if (!still.matches && !step && !steps.length && cur < 0 && idle > (touched ? 8 : 1.5)) { tourAt = (tourAt + 3) % 10; idle = 0; want = -1; load(tourAt); }
  advance(dt);
  if (dirty) draw();
  const hold = still.matches && step && step.tag === "play";
  const busy = !hold && (step || steps.length || rpm > 0 || !still.matches);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
stage.addEventListener("click", (ev) => { const b = ev.target.closest("[data-btn]"); if (!b) return; b.dataset.btn === "reject" ? cancel() : select(Number(b.dataset.btn)); });
stage.addEventListener("keydown", (ev) => {
  if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); select((Number(ev.key) + 9) % 10); }
  else if (ev.key === "Escape") { ev.preventDefault(); cancel(); }
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 3",
  title: "Jukebox",
  hint: "Press 1–0 or click a button · Esc rejects",
  readout: "select a record · 0 rpm",
  keys: [
    { mark: "lit", label: "The selected 45: carried, tipped flat, played" },
    { mark: "raised", label: "Carousel of ten records, transfer fork, turntable, tonearm" },
  ],
  caption: "A 7-inch single is 175 mm across and turns at 45 rpm for about two and a half to three minutes. The carousel turns the chosen slot to the front, the fork pulls the record out in its own plane, tips it flat onto the spindle, and the tonearm drops into the lead-in groove and tracks inward. Play is shown ten times faster than real time; the readout counts true song time.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Jukebox: press 1 to 0 to choose a record, Escape to reject it">${svg}</div>`,
});
const CSS = `<style>.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}.jk-vinyl{fill:var(--anatomy-shade-1)}.iso[data-theme="light"] .jk-vinyl{fill:#d6d6d3}.jk-disc[data-lit]>.jk-vinyl{fill:var(--anatomy-lit-shade)}</style>`;
const name = THEME === "light" ? "jukebox-light.html" : "jukebox.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Jukebox", theme: THEME, body: CSS + body, script: kitScript() + LIVE, width: 650 }));
console.log("wrote", name);
A.auditOrExit(R, P);
