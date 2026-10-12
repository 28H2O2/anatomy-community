import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// A 1989 Game Boy (DMG-01) standing in a cradle on a bench plate. World units are 0.5 mm: x across the
// face (the player's right is +x), y from the back shell (-64) to the face (0), z up from the bench.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 660;
const X0 = -90, X1 = 90, Y0 = -64, Z0 = 8, Z1 = 304;
const PLATE = { x: -150, y: -128, w: 290, d: 196, r: 12 };
const CART = { x0: -57, x1: 57, y0: -60, y1: -46, h: 26 };
const PX = 0.6, LCD = { x: -44, z: 268.4 }; // one Game Boy pixel is 0.3 mm; 160 x 144 of them
const DP = { x: -46, z: 116, r: 28 }, BA = [64, 124], BB = [36, 112], BR = 10;
const SEL = [[-14, 70], [16, 70]], TILT = 0.42;

const P = k.fitProjection([...k.boxCorners(PLATE, -15, 0), [X0, Y0, Z1 + CART.h], [X1, 0, Z1 + CART.h], [X0, 0, Z0], [X1, Y0, Z1 + CART.h]], W, H, { pad: 26, azimuth: 132, elevation: 32 });
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (p, s) => k.solidSvg(p, s);
const L = (d, s) => k.lineSvg(d, s);
const D = (p, s) => k.dotsSvg(p, s);
const pth = (pts, c = true) => k.pathOf(pts, c);
const R = A.recorder(P);
const put = (name, ref, svg, shapes, bias = 0) => R.put({ name, at: ref, bias, svg, shapes: shapes.map((s) => R.solid({ ...s, name: s.name ?? name })) });
const YF = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const ZF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const TAU = Math.PI * 2;

// rounded rectangle [x0..x1] x [y0..y1], radii [bl, br, tr, tl], counter-clockwise
function rr(x0, y0, x1, y1, r, n = 6) {
  const q = Array.isArray(r) ? r : [r, r, r, r];
  const c = [[x0 + q[0], y0 + q[0]], [x1 - q[1], y0 + q[1]], [x1 - q[2], y1 - q[2]], [x0 + q[3], y1 - q[3]]];
  return c.flatMap(([cx, cy], i) => (q[i] < 0.01 ? [[cx, cy]] : Array.from({ length: n + 1 }, (_, j) => { const t = Math.PI * (1 + i / 2 + j / n / 2); return [cx + q[i] * Math.cos(t), cy + q[i] * Math.sin(t)]; })));
}
const pill = (cx, cy, half, r, ang, n = 10) => G.stadium(r, r, half * 2, n * 2).map(([u, v]) => [u - half, v]).map(([u, v]) => [cx + u * Math.cos(ang) - v * Math.sin(ang), cy + u * Math.sin(ang) + v * Math.cos(ang)]);
const circ = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);
const area = (p) => p.reduce((a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0);
const W3 = (F, s, [u, v]) => G.add3(G.add3(G.add3(F.o, G.mul3(F.a, s)), G.mul3(F.u, u)), G.mul3(F.v, v));

// A prism of any polygon (concave too) in a frame's (u, v), from s0 to s1 along F.a, shaded by facing.
function prism(F, poly, s0, s1) {
  const ring = area(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length;
  const capNear = G.dot3(F.a, V) > 0;
  const near = ring.map((p) => at(W3(F, capNear ? s1 : s0, p)));
  const far = ring.map((p) => at(W3(F, capNear ? s0 : s1, p)));
  const scr = (q) => (area(q) < 0 ? [...q].reverse() : q);
  const fill = [pth(scr(near))], out = [pth(near)], b = [[], [], [], [], []];
  const nrm = ring.map(([x0, y0], i) => { const [x1, y1] = ring[(i + 1) % n]; return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0)))); });
  const face = nrm.map((m) => G.dot3(m, V) > 1e-9);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (face[i] !== face[(i + n - 1) % n]) out.push(pth([near[i], far[i]], false));
    if (!face[i]) continue;
    const q = pth(scr([near[i], near[j], far[j], far[i]]));
    fill.push(q);
    b[G.toneOf(nrm[i], P)].push(q);
    out.push(pth([far[i], far[j]], false));
  }
  const ca = capNear ? F.a : G.mul3(F.a, -1);
  b[ca[1] > 0.9 ? 4 : G.toneOf(ca, P)].push(pth(scr(near)));
  return { fill: fill.join(""), outline: out.join(""), crease: "", top: b[4].join(""), shades: b.slice(0, 4).map((x) => x.join("")) };
}
// the visible run of a prism's side at s: a seam that wraps the corners and ends on the silhouette
function seam(F, poly, s) {
  const ring = area(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length, runs = [];
  let cur = null;
  const vis = ring.map(([x0, y0], i) => { const [x1, y1] = ring[(i + 1) % n]; return G.dot3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))), V) > 1e-9; });
  const start = vis.findIndex((v, i) => !vis[(i + n - 1) % n] && v);
  for (let t = 0; t < n; t++) {
    const i = (start + t) % n;
    if (vis[i]) (cur ??= [at(W3(F, s, ring[i]))]).push(at(W3(F, s, ring[(i + 1) % n])));
    else if (cur) runs.push(cur), (cur = null);
  }
  if (cur) runs.push(cur);
  return runs.map((r) => pth(r, false)).join("");
}

// planes: w(u, v, d) is the world point at depth d behind the face, m(d) the face-plane transform
const FR = { w: (u, v, d) => [u, -d, v], m: (d) => k.sideMatrix([0, -d], 0, P, "left"), f: -1 };
const LS = { w: (u, v, d) => [X0 + d, -u, v], m: (d) => k.sideMatrix([X0 + d, 0], 0, P, "right"), f: -1 };
const TP = { w: (u, v, d) => [u, v, Z1 - d], m: (d) => k.topMatrix([0, 0], Z1 - d, P), f: 1 };
const flat = (pl, ring) => pth(ring.map(([u, v]) => [u, pl.f * v]));
const onPl = (pl, d, inner) => `<g transform="${pl.m(d)}">${inner}</g>`;
let clipN = 0;
function recess(pl, ring, depth, { fill = "gb-well", back = "", inside = "" } = {}) {
  const id = `gbc${clipN++}`, n = ring.length;
  const cu = ring.reduce((a, p) => a + p[0], 0) / n, cv = ring.reduce((a, p) => a + p[1], 0) / n;
  const b = [[], [], [], [], []];
  ring.forEach(([au, av], i) => {
    const [bu, bv] = ring[(i + 1) % n];
    const len = Math.hypot(bu - au, bv - av) || 1;
    let [nu, nv] = [(bv - av) / len, -(bu - au) / len];
    if (nu * (cu - (au + bu) / 2) + nv * (cv - (av + bv) / 2) < 0) [nu, nv] = [-nu, -nv];
    const nw = G.sub3(pl.w(au + nu, av + nv, 0), pl.w(au, av, 0));
    if (G.dot3(nw, V) <= 0) return;
    b[G.toneOf(nw, P)].push(pth([at(pl.w(au, av, 0)), at(pl.w(bu, bv, 0)), at(pl.w(bu, bv, depth)), at(pl.w(au, av, depth))]));
  });
  const shape = flat(pl, ring);
  return `<clipPath id="${id}"><path transform="${pl.m(0)}" d="${shape}"/></clipPath><g clip-path="url(#${id})">` +
    b.map((d, t) => (d.length ? (t === 4 ? `<path class="iso-top" d="${d.join("")}"/>` : `<path class="iso-shade" data-shade="${t}" d="${d.join("")}"/>`) : "")).join("") +
    onPl(pl, depth, `<path class="${fill}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/>`) + inside + `</g>` + onPl(pl, 0, `<path class="iso-line" data-tone="lo" d="${shape}"/>`);
}
const rule = (pl, d, segs, tone = "lo", free = true) => onPl(pl, d, L(segs.map(([u0, u1, v]) => `M${u0} ${pl.f * v}H${u1}`).join(""), { tone, free }));

// ---------- the bench ----------
{
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
  const feet = k.corners(PLATE, 20).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) out.push(S(k.cylinder(x, y, 9, -15, 5, P, 28), { tone: "lo" }));
  out.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P, 8), { tone: "lo" }));
  const sc = k.corners(PLATE, 13);
  out.push(L(sc.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }), D(sc.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a ruler strip along the front edge, in millimetres (2 units)
  const strip = { x: -100, y: 50, w: 200, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(-96, 96, 2, 5, strip.y, 0.8, [3, 5.5], P, "x");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // a label plate: three rule lines and a screw
  const lab = { x: 34, y: -118, w: 46, d: 14, r: 1.4 };
  out.push(S(k.slabOf(lab, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([34, 26, 30].map((w, i) => k.lineOnTop([lab.x + 4, lab.y + 3.5 + i * 3.5], [lab.x + 4 + w, lab.y + 3.5 + i * 3.5], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([lab.x + lab.w - 3.5, lab.y + 7, 0.8])], { size: 0.45 }));
  put("stand.plate", [0, -30, -10], out.join(""), [A.slab(PLATE, -10, 10), ...feet.map(([x, y]) => A.cylinder(x, y, 9, -15, 5))], -40);
}
// the cradle the Game Boy stands in, with two front lips
const CR = { x: -108, y: -84, w: 216, d: 104, r: 6 };
put("cradle", [0, -32, 4], `<path class="iso-halo" d="${k.haloOf(CR, 0, 6, P)}"/>` + S(k.slabOf(CR, 0, Z0, P, 6, 1), { tone: "lo", inner: k.sideSeam(CR, 3, P, 6) }) +
  L(k.planOutline(k.insetPlan(CR, 4), Z0, P, 6), { tone: "faint" }) + D(k.corners(CR, 8).map(([x, y]) => at([x, y, Z0])), { size: 0.45 }), [A.slab(CR, 0, Z0)]);
for (const x of [-84, 2]) {
  const lip = { x, y: 0, w: 38, d: 8, r: 1.6 };
  put("lip", [x + 19, 4, Z0 + 4], S(k.slabOf(lip, Z0, 7, P, 3, 0.5), { tone: "lo" }) + D([at([x + 6, 4, Z0 + 7]), at([x + 32, 4, Z0 + 7])], { size: 0.4 }), [A.slab(lip, Z0, 7, {}, 3)]);
}

// ---------- the case ----------
const OUT = rr(X0, Z0, X1, Z1, [3, 48, 5, 5], 10);
const FACE = rr(X0 + 1.6, Z0 + 1.6, X1 - 1.6, Z1 - 1.6, [2, 46.4, 3.6, 3.6], 10);
const bezelRing = rr(-78, 160, 78, 280, [4, 22, 4, 4], 8);
const lcdRing = rr(LCD.x, LCD.z - 144 * PX, LCD.x + 160 * PX, LCD.z, 0.6, 2);
const lcdBack = onPl(FR, 2.6, `<rect class="gb-lcdrim" x="${LCD.x - 3}" y="${-LCD.z - 3}" width="${160 * PX + 6}" height="${144 * PX + 6}"/>`);

// the picture: 160 x 144 pixels in four greens, tiles and sprites 8 x 8
const TILES = {
  g: "3333333321212121121212122222222212222122222122222212222222222212",
  e: "2212222222222122212222222222222222222212222122222222222212222122",
  b: "3333333321112111211121113333333311121112111211123333333321112111",
  q: "0333333031111113311331133111131331113113311111133111311303333330",
};
const SPR = ["0033330003111130313113133111111303322330003223000320023033000033", "0033330003111130313113133111111303322330003223000302203000330330"];
function pixels(map) {
  const runs = { 1: [], 2: [], 3: [] };
  for (const [tile, tx, ty] of map) for (let r = 0; r < 8; r++) {
    let c = 0;
    while (c < 8) {
      const v = TILES[tile][r * 8 + c];
      let e = c;
      while (e < 8 && TILES[tile][r * 8 + e] === v) e++;
      if (v !== "0") runs[v].push(`M${tx + c} ${ty + r}h${e - c}v1h${c - e}z`);
      c = e;
    }
  }
  return runs;
}
const map = [];
for (let i = 0; i < 20; i++) map.push(["g", i * 8, 120], ["e", i * 8, 128], ["e", i * 8, 136]);
for (let i = 0; i < 5; i++) map.push([i === 2 ? "q" : "b", 88 + i * 8, 80]);
const px = pixels(map);
const sprite = (s, i) => `<g data-fr="${i}"${i ? ' style="display:none"' : ""}>` + [1, 2, 3].map((v) => `<path class="gb-s${v}" d="${[...s].map((ch, j) => (ch === String(v) ? `M${j % 8} ${j >> 3}h1v1h-1z` : "")).join("")}"/>`).join("") + `</g>`;
const scene = `<g transform="translate(${LCD.x} ${-LCD.z}) scale(${PX})"><rect class="gb-s0" width="160" height="144"/>` +
  `<path class="gb-s1" d="M0 120V104h8v-8h8v-8h16v8h8v8h8v16zM112 120v-8h8v-8h24v8h8v8zM24 32h24v-4h12v4h16v8H24zM104 20h16v-4h12v4h8v6h-36z"/>` +
  [1, 2, 3].map((v) => `<path class="gb-s${v}" d="${px[v].join("")}"/>`).join("") +
  `<g data-spr transform="translate(32 112)">${SPR.map(sprite).join("")}</g><rect fill="url(#gbpx)" width="160" height="144"/></g>`;

{
  const out = [`<defs><pattern id="gbpx" width="1" height="1" patternUnits="userSpaceOnUse"><path class="gb-grid" d="M0 0H1M0 0V1"/></pattern></defs>`];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: X0, y: Y0, w: 180, d: 64, r: 4 }, Z0, 6, P)}"/>`);
  out.push(S(prism(YF, OUT, Y0, -2.4), { tone: "mid", inner: L(seam(YF, OUT, -30), { tone: "lo" }) }));
  out.push(S(prism(YF, FACE, -2.4, 0), { tone: "mid" }));
  // face: the ridge under the top edge, the bezel with its rules, LED and window
  out.push(rule(FR, 0, [[X0 + 1.6, X1 - 1.6, 288]], "lo", false));
  const words = [[-26, -17], [-15, -2], [0, 13], [15, 26]].map(([a, b]) => [a, b, 274]);
  const bez = [rule(FR, 0.8, [[-78, -30, 276.6], [30, 78, 276.6], [-78, -30, 271.8], [30, 78, 271.8]], "mid"), rule(FR, 0.8, words, "lo"),
    onPl(FR, 0.8, L(k.pathOf(circ(-62, 228, 3.4, 20).map(([u, v]) => [u, -v]), true), { tone: "lo" })),
    `<g data-part="led">${D([at([-62, -0.8, 228])], { size: 0.9, tone: "hi" })}</g>`, rule(FR, 0.8, [[-70, -54, 216]], "lo"),
    recess(FR, lcdRing, 1.8, { fill: "gb-lcd", back: scene + `<g transform="translate(0 0)"></g>`, inside: "" })];
  out.push(recess(FR, bezelRing, 0.8, { fill: "gb-bezel", inside: bez.join("") }));
  out.push(onPl(FR, 0, k.faceTextSvg("", "GAME BOY", { size: 7, tone: "lo" }).replace("<text", `<text x="-77" y="-149" font-style="italic" font-weight="700"`)));
  // the D-pad well, the A/B pill, the Start/Select dimples and six speaker slots
  out.push(recess(FR, circ(DP.x, DP.z, DP.r, 48), 1.4));
  out.push(recess(FR, pill((BA[0] + BB[0]) / 2, (BA[1] + BB[1]) / 2, Math.hypot(BA[0] - BB[0], BA[1] - BB[1]) / 2, 14, TILT, 12), 1.6));
  for (const [x, z] of SEL) out.push(recess(FR, pill(x, z, 8, 4.6, TILT, 6), 1));
  for (let i = 0; i < 6; i++) out.push(recess(FR, pill(30 + i * 8, 42, 12, 2, 1.05, 5), 3, { fill: "gb-dark" }));
  out.push(rule(FR, 0, [[-20, -8, 60], [10, 22, 60]], "faint"));
  // left side: contrast slot, EXT connector, DC jack, each with its moulded label
  out.push(recess(LS, rr(26, 222, 38, 250, 2, 3), 3, { fill: "gb-dark" }));
  out.push(recess(LS, rr(17, 166, 47, 190, 4, 4), 5, { fill: "gb-dark", back: onPl(LS, 5, L(pth(rr(22, 175, 42, 181, 1, 2).map(([u, v]) => [u, -v])), { tone: "lo" })) }) +
    D([0, 1, 2, 3, 4, 5].map((i) => at(LS.w(24.5 + i * 3, 178, 5))), { size: 0.35, tone: "mid" }));
  out.push(recess(LS, circ(32, 70, 5.5, 20), 4, { fill: "gb-dark", inside: D([at(LS.w(32, 70, 4))], { size: 0.5, tone: "mid" }) }));
  out.push(rule(LS, 0, [[24, 40, 214], [22, 42, 160], [26, 38, 60]], "faint"));
  // top: the cartridge slot, the power slide's slot and its OFF / ON marks
  out.push(recess(TP, rr(-60, -62.6, 60, -43.4, 1.5, 3), 4, { fill: "gb-dark" }));
  out.push(recess(TP, rr(-80, -24, -42, -12, 2, 3), 2.4, { fill: "gb-dark" }));
  out.push(D([at([-80, -8, Z1]), at([-42, -8, Z1])], { size: 0.45, tone: "lo" }));
  put("case", [0, -32, 150], `<g data-part="case">${out.join("")}</g>`, [A.prism(YF, OUT, Y0, 0)]);
}

// ---------- the cartridge ----------
{
  const c = CART, top = Z1 + c.h;
  const poly = [[c.x0, Z1], [c.x1, Z1], [c.x1, top - 9], [c.x1 - 9, top], [c.x0 + 2, top], [c.x0, top - 2]];
  const CF = { w: (u, v, d) => [u, c.y1 - d, v], m: (d) => k.sideMatrix([0, c.y1 - d], 0, P, "left"), f: -1 };
  const lab = rr(-47, Z1 - 4, 45, top - 6, [0, 0, 2, 2], 3);
  const out = [S(prism(YF, poly, c.y0, c.y1), { tone: "mid" })];
  out.push(`<clipPath id="gbcart"><path transform="${CF.m(0)}" d="${flat(CF, rr(c.x0, Z1, c.x1, top, 0, 1))}"/></clipPath><g clip-path="url(#gbcart)">` +
    recess(CF, lab, 1, { fill: "gb-label", back: rule(CF, 1, [[-40, 10, top - 12], [-40, -6, top - 16]], "lo") }) + `</g>`);
  out.push(rule(CF, 0, [0, 1, 2, 3, 4].map((i) => [c.x0, -47, Z1 + 3 + i * 3]), "lo", false));
  out.push(D([at([c.x1 - 5, c.y1, top - 13])], { size: 0.45, tone: "lo" }));
  put("cart", [0, (c.y0 + c.y1) / 2, Z1 + 13], out.join(""), [A.prism(YF, poly, c.y0, c.y1)]);
}
// ---------- the power slide (moves along x) ----------
{
  const knob = { x: -79, y: -22.5, w: 12, d: 9, r: 1.2 };
  const ridges = [2.5, 5, 7.5, 10].map((dx) => k.lineOnTop([knob.x + dx, knob.y + 0.8], [knob.x + dx, knob.y + knob.d - 0.8], Z1 + 3.2, P)).join("");
  put("power", [knob.x + 6, -18, Z1 + 2], `<g data-b="POW">${S(k.slabOf(knob, Z1 - 1, 4.2, P, 3, 0.4), { tone: "mid" })}${L(ridges, { tone: "lo" })}</g>`, [A.slab(knob, Z1, 3.2, {}, 3)]);
}
// ---------- the contrast wheel, knurled, standing out of the left side ----------
{
  const r = 12, cx = X0 + 8.5, cz = 236, half = Math.acos(8.5 / r);
  const arc = Array.from({ length: 13 }, (_, i) => Math.PI - half + (i / 12) * 2 * half);
  const poly = arc.map((a) => [cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  const kn = arc.slice(1, -1).flatMap((a) => [a - 0.06, a + 0.06]).filter((a, i) => i % 2 === 0).map((a) => pth([at([cx + r * Math.cos(a), -36, cz + r * Math.sin(a)]), at([cx + r * Math.cos(a), -28, cz + r * Math.sin(a)])], false));
  put("contrast", [X0 - 2, -32, cz], S(prism(YF, poly, -36, -28), { tone: "lo" }) + L(kn.join(""), { tone: "mid" }), [A.prism(YF, poly, -36, -28)]);
}
// ---------- the D-pad: a cross on a pivot, with arrows and a dimple ----------
{
  const a = 7.6, s = 22, { x, z } = DP;
  const cross = [[a, -a], [s, -a], [s, a], [a, a], [a, s], [-a, s], [-a, a], [-s, a], [-s, -a], [-a, -a], [-a, -s], [a, -s]].map(([u, v]) => [x + u, z + v]);
  const inset = [[a - 1.2, -a + 1.2], [s - 1.2, -a + 1.2], [s - 1.2, a - 1.2], [a - 1.2, a - 1.2], [a - 1.2, s - 1.2], [-a + 1.2, s - 1.2], [-a + 1.2, a - 1.2], [-s + 1.2, a - 1.2], [-s + 1.2, -a + 1.2], [-a + 1.2, -a + 1.2], [-a + 1.2, -s + 1.2], [a - 1.2, -s + 1.2]].map(([u, v]) => [x + u, -(z + v)]);
  const arrows = [0, 1, 2, 3].map((q) => { const c = Math.cos((q * Math.PI) / 2), sn = Math.sin((q * Math.PI) / 2); return [[17, 0], [12.5, 3.2], [12.5, -3.2]].map(([u, v]) => [x + u * c - v * sn, -(z + u * sn + v * c)]); });
  const capD = pth(cross.map(([u, v]) => at([u, 5, v])));
  const cap = onPl(FR, -5, L(pth(inset), { tone: "faint" }) + L(arrows.map((t) => pth(t)).join(""), { tone: "mid" }) + L(pth(circ(x, -z, 4.6, 20)), { tone: "lo" }));
  put("dpad", [x, 3, z], `<g data-b="PAD">${S(prism(YF, cross, -1.4, 5), { tone: "lo" })}${S({ fill: capD, outline: capD, crease: "", top: capD, shades: ["", "", "", ""] }, { tone: "lo" })}${cap}</g>`, [A.box([x - s, 0, z - a], [x + s, 5, z + a]), A.box([x - a, 0, z + a], [x + a, 5, z + s], { name: "dpad.up" }), A.box([x - a, 0, z - s], [x + a, 5, z - a], { name: "dpad.down" })]);
}
// ---------- A and B: domed buttons; Start and Select: rubber pills ----------
const dome = [[-1.6, 0], [-1.6, BR], [2.4, BR], [3.6, BR - 1.2, 1], [4.4, BR - 4, 1], [4.7, 0]];
for (const [name, [x, z]] of [["B", BB], ["A", BA]]) {
  const F = G.frameAlong([x, 0, z], [0, 1, 0]);
  put(name, [x, 3, z], `<g data-b="${name}">${S(G.lathe(dome, F, P), { tone: "hi" })}</g>`, [A.lathe(F, [[0, 0], [0, BR], [2.4, BR], [3.6, BR - 1.2, 1], [4.4, BR - 4, 1], [4.7, 0]])]);
}
SEL.forEach(([x, z], i) => {
  const poly = pill(x, z, 7, 3, TILT, 6);
  put(i ? "START" : "SELECT", [x, 1, z], `<g data-b="${i ? "START" : "SELECT"}">${S(prism(YF, poly, -1, 2.2), { tone: "lo" })}</g>`, [A.prism(YF, poly, 0, 2.2)]);
});

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const svg = k.figureSvg({
  width: W, height: H,
  label: "A 1989 Nintendo Game Boy (DMG-01) standing in a cradle on a bench plate, a cartridge in its top slot. Its 160 by 144 pixel screen shows a small sprite on a ground of tiles under a row of bricks; the D-pad, A, B, Start and Select press down as they are used.",
  body: R.items.map((it) => it.svg),
});

const live = `
const P=${JSON.stringify(P)},TOUR=!matchMedia("(prefers-reduced-motion: reduce)").matches;
const st=document.querySelector(".iso-stage"),svg=st.querySelector("svg"),ro=document.querySelector("[data-readout]");
const spr=svg.querySelector("[data-spr]"),fr=[...svg.querySelectorAll("[data-fr]")],B={};
svg.querySelectorAll("[data-b]").forEach(g=>B[g.dataset.b]={g,at:0});
const DEPTH={PAD:1.3,A:1.5,B:1.5,START:0.9,SELECT:0.9},still=matchMedia("(prefers-reduced-motion: reduce)");
const KEYS={ArrowLeft:"L",a:"L",A:"L",ArrowRight:"R",d:"R",D:"R",ArrowUp:"U",w:"U",W:"U",ArrowDown:"D",s:"D",S:"D",x:"A",X:"A",z:"B",Z:"B",Enter:"START",Shift:"SELECT",Backspace:"SELECT"};
const NAME={L:"\\u2190",R:"\\u2192",U:"\\u2191",D:"\\u2193",A:"A",B:"B",START:"Start",SELECT:"Select"};
const user=new Set(),auto=new Set();
let x=32,y=112,vy=0,ground=true,face=1,walk=0,was=false,paused=false,acc=0,last=0,raf=0,visible=false,touring=TOUR,idle=0,dir=1,wait=0,jumpHold=0,shown="";
const held=()=>touring?auto:user;
const onPlat=()=>x+8>88&&x<128;
function frame(){
  const h=held(),dx=(h.has("R")?1:0)-(h.has("L")?1:0);
  if(paused)return;
  if(dx){x=Math.max(0,Math.min(152,x+dx));face=dx;walk++}else walk=0;
  const j=h.has("A")||h.has("B")||h.has("U");
  if(j&&!was&&ground){vy=-4.2;ground=false}
  was=j;
  if(ground&&y===72&&!onPlat())ground=false;
  if(!ground){
    vy=Math.min(4,vy+0.2);const ny=y+vy;
    if(vy<0&&y>=88&&ny<88&&onPlat()){y=88;vy=0}
    else if(vy>0&&y+8<=80&&ny+8>=80&&onPlat()){y=72;vy=0;ground=true}
    else if(ny>=112){y=112;vy=0;ground=true}else y=ny;
  }
}
function pilot(){
  auto.clear();
  if(wait>0){wait--;return}
  if(jumpHold>0){jumpHold--;auto.add(dir>0?"A":"B")}
  if(dir>0&&x>=144){dir=-1;wait=50;return}
  if(dir<0&&x<=16){dir=1;wait=50;return}
  if(ground&&((dir>0&&x===66)||(dir<0&&x===134)))jumpHold=9;
  auto.add(dir>0?"R":"L");
}
function draw(dt){
  const rx=Math.round(x),ry=Math.round(y);
  spr.setAttribute("transform",face>0?"translate("+rx+" "+ry+")":"translate("+(rx+8)+" "+ry+") scale(-1 1)");
  const f=!ground||(walk>>3)&1?1:0;
  fr.forEach((g,i)=>g.style.display=i===f?"":"none");
  const h=held(),down={PAD:["L","R","U","D"].some(c=>h.has(c)),A:h.has("A"),B:h.has("B"),START:h.has("START"),SELECT:h.has("SELECT")};
  let moving=false;
  for(const n in DEPTH){const b=B[n],t=down[n]?DEPTH[n]:0;b.at=still.matches?t:b.at+(t-b.at)*(1-Math.exp(-dt/0.035));if(Math.abs(t-b.at)<0.01)b.at=t;else moving=true;b.g.setAttribute("transform",translateAlong(P,[0,-b.at,0]));b.g.toggleAttribute("data-down",!!down[n])}
  const name=["A","B","START","SELECT","L","R","U","D"].find(c=>h.has(c));
  const text="x "+rx+" \\u00b7 y "+ry+" \\u00b7 "+(paused?"paused":name?NAME[name]:"\\u2013");
  if(text!==shown)ro.textContent=shown=text;
  return moving;
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;acc+=dt;
  let n=0;while(acc>=1/59.73&&n<4){if(touring)pilot();frame();acc-=1/59.73;n++}
  if(n===4)acc=0;
  const moving=draw(dt);
  const busy=touring||user.size||!ground||moving;
  raf=visible&&busy?requestAnimationFrame(tick):0;
}
const run=()=>{if(!raf&&visible){last=0;acc=0;raf=requestAnimationFrame(tick)}};
function take(){if(touring){touring=false;auto.clear()}clearTimeout(idle);idle=setTimeout(()=>{if(!TOUR||still.matches||user.size)return;touring=true;run()},8000)}
function press(c){take();if(c==="START"&&!user.has(c))paused=!paused;user.add(c);run()}
function release(c){user.delete(c);run()}
new IntersectionObserver(e=>{visible=e[e.length-1].isIntersecting;if(visible)run()},{rootMargin:"120px 0px"}).observe(st);
st.addEventListener("keydown",e=>{const c=KEYS[e.key];if(!c||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();if(!e.repeat)press(c)});
st.addEventListener("keyup",e=>{const c=KEYS[e.key];if(c)release(c)});
st.addEventListener("blur",()=>{user.clear();run()});
let ptr=null;
svg.addEventListener("pointerdown",e=>{
  const g=e.target.closest("[data-b]");if(!g)return;
  let c=g.dataset.b;
  if(c==="POW")return;
  if(c==="PAD"){const m=svg.getScreenCTM().inverse(),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m),o=iso([${DP.x},5,${DP.z}],P),ex=axisVector(P,[1,0,0]),ez=axisVector(P,[0,0,1]);
    const vx=p.x-o[0],vy=p.y-o[1],u=(vx*ex[0]+vy*ex[1])/Math.hypot(...ex)**2,w=(vx*ez[0]+vy*ez[1])/Math.hypot(...ez)**2;
    c=Math.abs(u)>Math.abs(w)?(u>0?"R":"L"):(w>0?"U":"D")}
  ptr=c;press(c);st.focus({preventScroll:true});e.preventDefault();
});
addEventListener("pointerup",()=>{if(ptr){release(ptr);ptr=null}});
addEventListener("pointercancel",()=>{if(ptr){release(ptr);ptr=null}});
draw(1);
`;

const css = `<style>
.gb-well{fill:var(--anatomy-shade-1)}.gb-dark{fill:var(--anatomy-shade-0)}.gb-bezel{fill:var(--anatomy-shade-0)}
.gb-label{fill:var(--anatomy-lit-top)}.gb-lcdrim{fill:#5e6b4e}
.gb-s0{fill:#9bbc0f}.gb-s1{fill:#8bac0f}.gb-s2{fill:#306230}.gb-s3{fill:#0f380f}
.gb-grid{fill:none;stroke:#0f380f;stroke-width:.14;opacity:.22}
[data-b]{cursor:pointer}
[data-theme="light"] .gb-bezel{fill:#c9c9cc}[data-theme="light"] .gb-lcdrim{fill:#7d8a6c}
.iso-stage{touch-action:pan-y}.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;
const body = css + k.plateHtml({
  fig: "Fig 2",
  title: "Game Boy",
  hint: "Arrows move · Z / X jump · Enter start",
  readout: "x 32 · y 112 · –",
  keys: [
    { mark: "lit", label: "The screen: 160 × 144 pixels in four greens, redrawn 59.7 times a second" },
    { mark: "raised", label: "D-pad, A, B, Start and Select; each goes down in its well as it is held" },
    { mark: "edge", label: "Cartridge in the top slot, contrast wheel and EXT connector on the left side" },
  ],
  caption: "The original Game Boy of 1989 stands in a cradle with a cartridge in its slot. Its reflective LCD is 160 by 144 pixels in four shades of green and is redrawn about 59.7 times a second; the sprite is one 8 × 8 tile, the ground and bricks are 8 × 8 background tiles. Arrow keys, WASD or a press on the D-pad walk it, Z, X or A and B make it jump onto the bricks, and Enter (Start) pauses. The readout gives the sprite's top-left corner in screen pixels and the button held.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Game Boy. Arrow keys walk the sprite, Z or X jumps, Enter pauses.">${svg}</div>`,
});
const file = THEME === "light" ? "gameboy-light.html" : "gameboy.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Game Boy", theme: THEME, body: body, script: kitScript() + live }));
console.log("wrote", file, R.items.length, "items");
A.auditOrExit(R, P);
