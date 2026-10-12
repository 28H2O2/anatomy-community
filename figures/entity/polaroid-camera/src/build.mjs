import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// A 600-series Polaroid box camera on a bench plate. World units are millimetres: x across the camera
// (its right side is +x), y from the back (-111) to the front (0; the lens housing stands 8 proud), z up.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 450, X1 = 73;
const PLATE = { x: -96, y: -122, w: 212, d: 262, r: 10 };
const LENS = [-4, 74], SHUT = [46, 60], ZH = 37;
const POSE = [[-4, 66, -2], [38, 74, -9], [-38, 78, 7]];

const P = k.fitProjection([...k.boxCorners(PLATE, -14, 0), [-73, -30, 106], [73, -30, 106], [-73, 8, 106]], W, H, { pad: 22, azimuth: 45, elevation: 30 });
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (p, s) => k.solidSvg(p, s);
const L = (d, s) => k.lineSvg(d, s);
const D = (p, s) => k.dotsSvg(p, s);
const pth = (pts, c = true) => k.pathOf(pts, c);
const R = A.recorder(P);
const put = (name, ref, svg, shapes, bias = 0) => R.put({ name, at: ref, bias, svg, shapes: shapes.map((s) => R.solid({ ...s, name: s.name ?? name })) });
const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const TAU = Math.PI * 2;

// rounded rectangle [x0..x1] x [y0..y1], counter-clockwise
function rr(x0, y0, x1, y1, r, n = 5) {
  const c = [[x0 + r, y0 + r], [x1 - r, y0 + r], [x1 - r, y1 - r], [x0 + r, y1 - r]];
  return c.flatMap(([cx, cy], i) => Array.from({ length: n + 1 }, (_, j) => { const t = Math.PI * (1 + i / 2 + j / n / 2); return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; }));
}
const circ = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);
const area = (p) => p.reduce((a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0);
const W3 = (F, s, [u, v]) => G.add3(G.add3(G.add3(F.o, G.mul3(F.a, s)), G.mul3(F.u, u)), G.mul3(F.v, v));
const f1 = (n) => +n.toFixed(2);

// A prism of any polygon (concave too) in a frame's (u, v), from s0 to s1 along F.a, shaded by facing.
function prism(F, poly, s0, s1) {
  const ring = area(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length, capNear = G.dot3(F.a, V) > 0;
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
    fill.push(q); b[G.toneOf(nrm[i], P)].push(q); out.push(pth([far[i], far[j]], false));
  }
  const ca = capNear ? F.a : G.mul3(F.a, -1);
  b[ca[2] > 0.9 ? 4 : G.toneOf(ca, P)].push(pth(scr(near)));
  return { fill: fill.join(""), outline: out.join(""), crease: "", top: b[4].join(""), shades: b.slice(0, 4).map((x) => x.join("")) };
}

// planes: w(u, v, d) is the world point at depth d behind the face, m(d) the face-plane transform
const FRo = (y) => ({ w: (u, v, d) => [u, y - d, v], m: (d) => k.sideMatrix([0, y - d], 0, P, "left"), f: -1 });
const FR = FRo(0), HF = FRo(8);
const SD = { w: (u, v, d) => [X1 - d, -u, v], m: (d) => k.sideMatrix([X1 - d, 0], 0, P, "right"), f: -1 };
const flat = (pl, ring) => pth(ring.map(([u, v]) => [u, pl.f * v]));
const onPl = (pl, d, inner) => `<g transform="${pl.m(d)}">${inner}</g>`;
let clipN = 0;
function recess(pl, ring, depth, { fill = "pol-well", back = "", inside = "" } = {}) {
  const id = `pc${clipN++}`, n = ring.length;
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
const rule = (pl, d, segs, tone = "lo", free = false) => onPl(pl, d, L(segs.map(([u0, u1, v]) => `M${f1(u0)} ${f1(pl.f * v)}H${f1(u1)}`).join(""), { tone, free }));
const ln = (pts, tone = "lo") => L(pth(pts.map(([u, v]) => [u, -v]), false), { tone });

// ---------- the bench ----------
{
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -14, 10, P)}"/>`];
  const feet = k.corners(PLATE, 20).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) out.push(S(k.cylinder(x, y, 9, -14, 5, P, 28), { tone: "lo" }));
  out.push(S(k.slabOf(PLATE, -9, 9, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P, 8), { tone: "faint" }));
  const sc = k.corners(PLATE, 13);
  out.push(L(sc.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }), D(sc.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a millimetre ruler along the front edge: the print is 88 wide
  const strip = { x: 104, y: -96, w: 8, d: 220, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(-92, 120, 2, 5, strip.x, 0.8, [2.6, 5], P, "y");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const lab = { x: 78, y: -118, w: 22, d: 13, r: 1.4 };
  out.push(S(k.slabOf(lab, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([14, 10, 12].map((w, i) => k.lineOnTop([lab.x + 3.5, lab.y + 3.2 + i * 3.3], [lab.x + 3.5 + w, lab.y + 3.2 + i * 3.3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([lab.x + lab.w - 3.5, lab.y + 6.5, 0.8])], { size: 0.45 }));
  put("stand.plate", [10, 0, -9], out.join(""), [A.slab(PLATE, -9, 9), ...feet.map(([x, y]) => A.cylinder(x, y, 9, -14, 5))], -60);
}

// ---------- the body: a wedge, the back sloping down to the mirror's angle ----------
const BP = [[0, 1.5], [0, 96.5], [-1.5, 98], [-46, 98], [-111, 6], [-111, 1.5], [-109.5, 0], [-1.5, 0]];
{
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: -73, y: -111, w: 146, d: 116, r: 6 }, 0, 6, P)}"/>`];
  out.push(S(prism(XF, BP, -X1, X1), { tone: "mid" }));
  // side: rear-shell seam parallel to the back, the film counter, grip ribs, screws
  out.push(onPl(SD, 0, ln([[107.2, 0], [38, 98]], "faint")));
  out.push(recess(SD, rr(5, 78, 19, 89, 1.2), 1.2, { fill: "pol-dark", back: `<text class="pol-count" data-count x="12" y="-80.4" text-anchor="middle" font-size="7.6">6</text>` }));
  out.push(onPl(SD, 0, `<path class="pol-tri" d="M20.5 -83.5l2.4 -1.6v3.2z"/>`));
  for (let i = 0; i < 9; i++) out.push(recess(SD, rr(36, 30.6 + i * 5, 54 - (i > 6 ? 2 : 0), 32.8 + i * 5, 1.1, 3), 0.8, { fill: "pol-dark" }));
  out.push(D([[3.5, 4], [100, 4], [40, 70], [8, 94]].map(([u, z]) => at(SD.w(u, z, 0))), { size: 0.45, tone: "mid" }));
  // cutaway at the slot: the spread rollers, their gears and the top of the film pack
  const gear = (r0, r1, n) => pth(Array.from({ length: n * 4 }, (_, i) => { const a = ((i + 0.5) / (n * 4)) * TAU, r = i % 4 < 2 ? r1 : r0; return [r * Math.cos(a), r * Math.sin(a)]; }));
  const g1 = gear(3.4, 4.2, 12), g2 = gear(4.9, 5.8, 15);
  const inner = `<path class="pol-pack" d="M34 -30H13V-14H34z"/>` + L("M34 -30H13V-14H34", { tone: "lo" }) + L("M34 -27.6H13M34 -19H13", { tone: "faint" }) +
    L("M13 -30L7.8 -35.6L0.8 -37", { tone: "mid" }) +
    `<g data-gear="-1" transform="translate(6 -33.4)"><path class="pol-gear" d="${g1}"/>${L(g1, { tone: "mid" })}${L(pth(circ(0, 0, 2.6, 20)), { tone: "lo" })}${L("M0 1.2V2.6", { tone: "mid" })}<circle class="pol-hub" r="1.2"/></g>` +
    `<g data-gear="0.7" transform="translate(13.5 -28.1)"><path class="pol-gear" d="${g2}"/>${L(g2, { tone: "lo" })}<circle class="pol-hub" r="1.4"/></g>` +
    `<g data-gear="1" transform="translate(6 -40.6)"><path class="pol-roll" d="${pth(circ(0, 0, 3.6, 24))}"/>${L(pth(circ(0, 0, 3.6, 24)), { tone: "mid" })}${L("M0 -1V-3.6", { tone: "mid" })}<circle class="pol-hub" r="1"/></g>`;
  out.push(recess(SD, rr(0.8, 14, 34, 48, 1.5), 2.2, { fill: "pol-dark", back: inner }));
  // front strip between the film door and the lens housing: the exit slot, the rollers behind it
  const slot = rr(-46, 33.5, 46, 40.5, 1, 3);
  out.push(recess(FR, slot, 1.6, { fill: "pol-dark", back: `<path class="pol-roll" d="M-46 -37H46V-33.5H-46z"/><path class="pol-roll2" d="M-46 -40.5H46V-37H-46z"/>` + L("M-46 -37H46", { tone: "mid" }) + L("M-46 -35.3H46M-46 -38.7H46", { tone: "faint" }) }));
  out.push(D([[-66, 37], [66, 37]].map(([x, z]) => at([x, 0, z])), { size: 0.45, tone: "mid" }));
  put("body", [0, -50, 49], out.join(""), [A.prism(XF, BP, -X1, X1)]);
}
// the film door, its finger groove and its latch
{
  const DP = [[0, 0], [5, 0], [5, 29.5], [3.5, 31], [0, 31]];
  put("door", [0, 2.5, 15.5], S(prism(XF, DP, -68, 68), { tone: "mid" }) + rule(FRo(5), 0, [[-68, 68, 9]], "lo"), [A.prism(XF, DP, -68, 68)]);
  const LP = rr(1, 10, 4, 22, 0.8, 2);
  put("latch", [69.8, 2.5, 16], S(prism(XF, LP, 68, 71.5), { tone: "lo" }) + rule(SD, 1.5, [13, 15, 17, 19].map((z) => [-3.95, -1.05, z]), "mid"), [A.prism(XF, LP, 68, 71.5)]);
}
// strap lug on the right side
{
  const LP = rr(-40, 86, -30, 95, 1.5, 3);
  put("lug", [75, -35, 90], S(prism(XF, LP, X1, 76.5), { tone: "lo" }) + onPl(SD, -3.5, `<path class="pol-dark" d="${pth(rr(32, -92, 38, -89, 1.4, 3))}"/>` + L(pth(rr(32, -92, 38, -89, 1.4, 3)), { tone: "lo" })), [A.prism(XF, LP, X1, 76.5)]);
}

// ---------- the lens housing: flash, electric eye, viewfinder, a subtle rainbow ----------
const HP = [[0, 48], [8, 48], [8, 104.5], [6.5, 106], [-30, 106], [-30, 98], [0, 98]];
{
  const out = [S(prism(XF, HP, -70, 70), { tone: "mid" })];
  const fres = Array.from({ length: 7 }, (_, i) => [-62, -34, 86 + i * 2]);
  out.push(recess(HF, rr(-62, 84, -34, 100, 1.5), 1.2, { fill: "pol-flashbg", back: L(fres.map(([u0, u1, v]) => `M${u0} ${-v}H${u1}`).join(""), { tone: "faint" }) + `<rect data-flash class="pol-fl" x="-62" y="-100" width="28" height="16" opacity="0"/>` }));
  out.push(recess(HF, rr(30, 86, 56, 100, 2.5), 2, { fill: "pol-glass", back: `<path class="pol-shine" d="M36 -99L41 -99L34 -87L31 -87z"/>` }));
  out.push(recess(HF, circ(-50, 64, 5.5, 28), 1.5, { fill: "pol-glass", back: L(pth(circ(-50, -64, 3, 20)), { tone: "lo" }) + `<circle class="pol-shine" cx="-51.5" cy="-65.5" r="1.2"/>` }));
  out.push(recess(HF, circ(-36, 57, 2.6, 18), 1, { fill: "pol-glass" }));
  const rain = ["#c8574f", "#d58a45", "#d6b84d", "#6fa167", "#4f86b5"];
  out.push(onPl(HF, 0, rain.map((c, i) => `<rect class="pol-rain" fill="${c}" x="${22.6 + i * 1.15}" y="-106" width="1.16" height="58"/>`).join("")));
  out.push(L(k.lineOnTop([-70, -4], [70, -4], 106, P), { tone: "faint" }), D([at([-60, -20, 106]), at([60, -20, 106])], { size: 0.45, tone: "mid" }));
  out.push(recess(HF, rr(-63, 51.5, -41, 55, 1.5, 3), 1, { fill: "pol-dark" }), D([at([-66, 8, 53.2]), at([-44.5, 8, 58])], { size: 0.5, tone: "mid" }));
  out.push(D([[-64, 52], [64, 52], [-64, 102], [64, 102]].map(([x, z]) => at([x, 8, z])), { size: 0.45, tone: "mid" }));
  out.push(D([at([LENS[0], 8, LENS[1] + 26.5])], { size: 0.7, tone: "hi" }));
  put("housing", [0, 0, 80], out.join(""), [A.box([-70, 0, 48], [70, 8, 106]), A.box([-70, -30, 98], [70, 0, 106], { name: "hood" })]);
}
// ---------- the lens: focus ring (knurled), aperture ring with ticks, glass ----------
{
  const F = G.frameAlong([LENS[0], 8, LENS[1]], [0, 1, 0]);
  const prof = [[0, 24], [1.5, 24], [1.5, 21], [11, 21], [11, 19], [16, 19], [16, 17], [18.5, 17]];
  const ribs = G.ribsOf(F, 1.5, 11, 21, 72, P, { fade: [0.05, 0.45], seams: true });
  const GF = FRo(26.5), [x, z] = LENS;
  const glass = onPl(GF, 0, `<circle class="pol-glass" cx="${x}" cy="${-z}" r="15.5"/>` + L(pth(circ(x, -z, 15.5, 48)), { tone: "lo" }) + L(pth(circ(x, -z, 10.5, 40)), { tone: "faint" }) +
    `<path class="pol-shine" d="M${x - 11.5} ${-z - 3}A12 12 0 0 1 ${x + 2} ${-z - 12}A10.6 10.6 0 0 0 ${x - 11.5} ${-z - 3}z"/><circle class="pol-shine" cx="${x + 4}" cy="${-z + 4}" r="1.6"/>`);
  const svg = S(G.solidOf(prof, F, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }) +
    L(G.spokesOf(F, 11, 19, 21, 48, P), { tone: "faint" }) + L(G.spokesOf(F, 11, 19, 21, 8, P, { phase: 0.1 }), { tone: "mid" }) +
    L(G.spokesOf(F, 16, 17, 19, 24, P, { phase: 0.05 }), { tone: "lo" }) + glass;
  put("lens", [x, 17, z], svg, [A.solid(F, prof)]);
}
// the lighten / darken slider's knob
{
  const KP = rr(-55, 51, -50, 55.5, 0.6, 2);
  put("slider", [-52.5, 9, 53], S(prism(G.frameOf([0, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, 1]), KP.map(([x, z]) => [-x, z]), 8, 10.4), { tone: "lo" }), [A.box([-55, 8, 51], [-50, 10.4, 55.5])]);
}
// ---------- the red shutter button ----------
{
  const F = G.frameAlong([SHUT[0], 8, SHUT[1]], [0, 1, 0]);
  const prof = [[0, 7.5], [1, 7.5], [1, 6], [4.6, 6], [5.3, 5.2]];
  put("shutter", [SHUT[0], 11, SHUT[1]], `<g data-b>${S(G.solidOf(prof, F, P), { tone: "lo", className: "pol-red" })}</g>`, [A.solid(F, prof)]);
}

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

// ---------- the prints: drawn live, a picture in the plane of each sheet ----------
const TM = (z) => k.topMatrix([0, 0], z, P);
const proto = `<g data-p style="display:none"><g data-e clip-path="url(#pcl)"><g><rect class="pol-edge" x="-44" y="-53.5" width="88" height="107" rx="1.2"/></g></g>` +
  `<g data-f clip-path="url(#pcl)"><g><rect class="pol-paper" x="-44" y="-53.5" width="88" height="107" rx="1.2"/>` +
  `<g data-im clip-path="url(#pim)"><rect fill="url(#psky)" x="-39.5" y="-47.5" width="79" height="79"/><circle data-sun fill="#f1dcae" cx="12" cy="-22" r="6.5"/>` +
  `<path fill="#77858b" d="M-39.5 2l12-9 9 4 14-12 11 9 8-4 25 12z"/><rect fill="#4c6271" x="-39.5" y="2" width="79" height="29.5"/>` +
  `<path fill="#d9c49a" opacity=".55" d="M8 4h8l-1 2h-6zM6 9h11l-1 1.6h-8.5zM9 15h6l-.8 1.4h-4.6z"/>` +
  `<path fill="#33393a" d="M-39.5 31.5V18c8-4 16-6 23-5 9 1 13 6 17 18.5z"/><path data-boat fill="#e8e2d4" d="M-12 0l.3-12 6.4 11zM-14 .6h9.6l-1.4 2h-6.8z"/>` +
  `<rect data-h fill="#bdb7ab" x="-39.5" y="-47.5" width="79" height="79"/><rect data-w fill="#c4874a" x="-39.5" y="-47.5" width="79" height="79"/><rect data-v fill="#55626b" x="-39.5" y="-47.5" width="79" height="79"/></g>` +
  `<rect class="pol-pod" x="-41" y="35.5" width="82" height="14" rx="1.5"/><rect class="pol-pe" x="-39.5" y="-47.5" width="79" height="79"/><rect class="pol-pe" x="-44" y="-53.5" width="88" height="107" rx="1.2"/></g></g></g>`;
const defs = `<defs><clipPath id="pcl"><rect x="-200" y="0" width="400" height="400"/></clipPath><clipPath id="pim"><rect x="-39.5" y="-47.5" width="79" height="79"/></clipPath>` +
  `<linearGradient id="psky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d9bb0"/><stop offset=".62" stop-color="#d8b98f"/><stop offset="1" stop-color="#e7c79b"/></linearGradient>` +
  `<radialGradient id="pgl"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
const layer = { svg: `<g data-prints><g transform="${TM(0.3)}"><ellipse data-glow fill="url(#pgl)" cx="-4" cy="62" rx="70" ry="56" opacity="0"/></g>${proto}</g>` };
const front = R.items.findIndex((it) => ["housing", "lens", "shutter"].includes(it.name));
const body = [defs, ...R.items.slice(0, front).map((it) => it.svg), layer.svg, ...R.items.slice(front).map((it) => it.svg)];

const svg = k.figureSvg({
  width: W, height: H,
  label: "A 600-series Polaroid box camera on a bench plate, lens forward. Pressing the red shutter fires the flash, the motor turns the spread rollers seen in a cutaway at the slot, and the print slides out and drops onto the bench, where its picture develops from blue-grey to full colour.",
  body,
});

const live = `
const P=${JSON.stringify(P)},POSE=${JSON.stringify(POSE)},ZH=${ZH},E0=.35,E1=1.75,GA=2.4,GB=3.4,X=20,FULL=12;
const still=matchMedia("(prefers-reduced-motion: reduce)"),TOUR=!still.matches;
const st=document.querySelector(".iso-stage"),svg=st.querySelector("svg"),ro=document.querySelector("[data-readout]");
const lay=svg.querySelector("[data-prints]"),proto=lay.querySelector("[data-p]"),flash=svg.querySelector("[data-flash]"),glow=svg.querySelector("[data-glow]");
const cnt=svg.querySelector("[data-count]"),btn=svg.querySelector("[data-b]"),gears=[...svg.querySelectorAll("[data-gear]")];
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const env=(a,r,f)=>a<0?0:a<r?sm(0,r,a):Math.exp(-(a-r)/f);
const T=(x,y,r)=>"translate("+x.toFixed(2)+" "+y.toFixed(2)+") rotate("+r.toFixed(2)+")";
const devOf=t=>Math.min(1,(1-Math.exp(-t/3.2))/(1-Math.exp(-FULL/3.2)));
let left=6,shots=2,clock=0,last=0,raf=0,visible=false,touring=TOUR,idle=0,turns=0,shown="",nextPose=2;
const prints=[];
function spawn(t0,pose,dark,dev){
  const el=proto.cloneNode(true);el.removeAttribute("style");el.removeAttribute("data-p");
  if(dark)el.setAttribute("data-dark","");
  const n=shots;el.querySelector("[data-sun]").setAttribute("transform","translate("+((n*13)%28-14)+" "+((n*5)%9)+")");
  el.querySelector("[data-boat]").setAttribute("transform","translate("+((n*19)%34-8)+" 0)");
  const p={el,e:el.querySelector("[data-e]"),f:el.querySelector("[data-f]"),t0,pose,dark,dev:dev??t0+E0,base:turns,out:null,
    v:el.querySelector("[data-v]"),h:el.querySelector("[data-h]"),w:el.querySelector("[data-w]"),last:-1};
  turns+=107/3.6;lay.appendChild(el);prints.push(p);return p;
}
spawn(-60,0,false,-100);spawn(-10,1,false,-12);
const newest=()=>{for(let i=prints.length-1;i>=0;i--)if(!prints[i].dark)return prints[i];return null};
function fire(){
  const q=prints[prints.length-1],calm=still.matches;
  if(q&&!calm&&clock-q.t0<E1+.2)return;
  const dark=left===0;if(dark)left=8;else{left--;shots++}
  for(const o of prints)if(o.pose===nextPose&&o.out===null)o.out=clock;
  spawn(clock,nextPose,dark);nextPose=(nextPose+1)%3;run();
}
function mins(t){const m=Math.floor(t),s=Math.floor((t-m)*60);return m+":"+(s<10?"0":"")+s}
function draw(){
  const calm=still.matches;let busy=false;
  for(let i=prints.length-1;i>=0;i--){
    const p=prints[i],a=calm?1e3:clock-p.t0;
    let op=1;
    if(p.out!==null){op=calm?0:1-sm(p.out+GA,p.out+GA+.8,clock);if(op<=0){p.el.remove();prints.splice(i,1);continue}busy=true}
    if(p.dark){op*=1-sm(4.6,5.6,a);if(op<=0){p.el.remove();prints.splice(i,1);continue}}
    p.el.setAttribute("opacity",op.toFixed(3));
    const e=sm(E0,E1,a),g=sm(GA,GB,a),[px,py,pr]=POSE[p.pose];
    const x=px*g,y=(e*107-53.5)*(1-g)+py*g,z=ZH+(1.2-ZH)*g+5*Math.sin(Math.PI*g),r=pr*g,key=e+g*2;
    if(key!==p.last){p.last=key;const t=T(x,y,r);p.f.setAttribute("transform",topMatrix([0,0],z,P));p.e.setAttribute("transform",topMatrix([0,0],z-.9,P));p.f.firstChild.setAttribute("transform",t);p.e.firstChild.setAttribute("transform",t)}
    if(a<GB+.1||(p.dark&&a<5.7))busy=true;
    if(!p.dark){
      const d=calm?1:devOf(Math.max(0,(clock-p.dev)*X/60));
      p.v.setAttribute("opacity",(1-sm(0,.45,d)).toFixed(3));p.h.setAttribute("opacity",(.55*(1-sm(.25,1,d))).toFixed(3));
      p.w.setAttribute("opacity",(.4*Math.sin(Math.PI*sm(.08,.95,d))).toFixed(3));
      if(d<1)busy=true;
    }
  }
  const q=prints[prints.length-1],a=q&&!calm?clock-q.t0:1e3,fl=env(a,.04,.12);
  flash.setAttribute("opacity",fl.toFixed(3));glow.setAttribute("opacity",fl.toFixed(3));
  btn.setAttribute("transform",translateAlong(P,[0,-1.2*env(a,.05,.15),0]));
  const th=(q?q.base+sm(E0,E1,a)*107/3.6:0)*180/Math.PI;
  gears.forEach(g=>{const b=g.getAttribute("transform").split(" rotate")[0];g.setAttribute("transform",b+" rotate("+(th*+g.dataset.gear).toFixed(1)+")")});
  if(cnt.textContent!==String(left))cnt.textContent=left;
  const n=newest(),lead=left+" of 8 left \\u00b7 ";let text;
  if(q&&q.dark&&a<5.7)text="new pack \\u00b7 dark slide out";
  else if(left===0&&(!n||(calm||clock-n.t0>GB)))text="0 of 8 left \\u00b7 press to load a pack";
  else if(!n)text=lead+"ready";
  else if(calm)text=lead+"shown developed";
  else{const b=clock-n.t0,t=Math.max(0,(clock-n.dev)*X/60);
    text=lead+(b<E0?"exposing":b<E1?"ejecting \\u00b7 spreading reagent":t<FULL?"developing "+mins(t)+" of 12:00 \\u00b7 \\u00d7"+X:"developed \\u00b7 12:00")}
  if(text!==shown)ro.textContent=shown=text;
  return busy||fl>.001;
}
function tick(now){
  const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;clock+=dt;
  if(touring&&!still.matches&&clock>2.5){const q=prints[prints.length-1];if(!q||clock-q.t0>(left===0?7:11))fire()}
  const busy=draw();
  raf=visible&&(busy||touring)&&!still.matches?requestAnimationFrame(tick):0;
}
const run=()=>{if(!raf&&visible){last=0;raf=requestAnimationFrame(tick)}else if(still.matches)draw()};
function take(){touring=false;clearTimeout(idle);idle=setTimeout(()=>{if(!TOUR||still.matches)return;touring=true;run()},9000)}
new IntersectionObserver(e=>{visible=e[e.length-1].isIntersecting;if(visible)run()},{rootMargin:"120px 0px"}).observe(st);
st.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat&&!e.metaKey&&!e.ctrlKey){e.preventDefault();take();fire()}});
btn.addEventListener("pointerdown",e=>{e.preventDefault();take();st.focus({preventScroll:true});fire()});
still.addEventListener("change",()=>{draw();run()});
draw();
`;

const css = `<style>
.pol-well{fill:var(--anatomy-shade-1)}.pol-dark{fill:var(--anatomy-shade-0)}.pol-pack{fill:#1a1a1a}.pol-gear{fill:#474747}.pol-hub{fill:var(--anatomy-mid)}
.pol-roll{fill:#2a2a2a}.pol-roll2{fill:#333}.pol-glass{fill:#0c1013}.pol-shine{fill:#fff;opacity:.13}.pol-flashbg{fill:#2a2a28}.pol-fl{fill:#fff}
.pol-count{fill:#e8e8e8;font-family:var(--anatomy-mono);font-weight:600}.pol-tri{fill:var(--anatomy-mid)}.pol-rain{opacity:.42}
.pol-paper{fill:#cfccc4}.pol-edge{fill:#77746d}.pol-pod{fill:#000;opacity:.06}.pol-pe{fill:none;stroke:#8d8a83;stroke-width:.5}
[data-dark] .pol-paper{fill:#161616}[data-dark] [data-im],[data-dark] .pol-pod{display:none}
.pol-red>.iso-fill{fill:#7d2a25}.pol-red>[data-shade="0"]{fill:#5c1d19;stroke:#5c1d19}.pol-red>[data-shade="1"]{fill:#79261f;stroke:#79261f}.pol-red>[data-shade="2"]{fill:#953027;stroke:#953027}.pol-red>[data-shade="3"]{fill:#b13a2f;stroke:#b13a2f}.pol-red>.iso-top{fill:#c4463a;stroke:#c4463a}
[data-b]{cursor:pointer}
[data-theme="light"] .pol-paper{fill:#fdfcf8}[data-theme="light"] .pol-edge{fill:#cfccc4}[data-theme="light"] .pol-pe{stroke:#a9a6a0}
[data-theme="light"] .pol-roll{fill:#4a4a4a}[data-theme="light"] .pol-roll2{fill:#5a5a5a}[data-theme="light"] .pol-glass{fill:#1d2226}[data-theme="light"] .pol-flashbg{fill:#e9e8e2}[data-theme="light"] .pol-pack{fill:#3a3a3a}[data-theme="light"] .pol-gear{fill:#bdbdbd}
[data-theme="light"] .pol-count{fill:#f4f4f4}[data-theme="light"] .pol-dark{fill:#8e8e8e}[data-theme="light"] .pol-rain{opacity:.55}[data-theme="light"] .pol-fl{fill:#fffbe8}
.iso-stage{touch-action:pan-y}.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;
const page = css + k.plateHtml({
  fig: "Fig 6",
  title: "Instant camera",
  hint: "Click the red shutter · Space",
  readout: "6 of 8 left · ready",
  keys: [
    { mark: "lit", label: "The print: 88 × 107 mm with a 79 × 79 mm picture; the wide bottom border held the reagent pod" },
    { mark: "raised", label: "Lens with focus and aperture rings, electric eye, flash and viewfinder windows, red shutter" },
    { mark: "edge", label: "Cutaway at the exit slot: the spread rollers, their gear train and the top of the film pack" },
  ],
  caption: "A 600-series Polaroid box camera. Its back slopes because a mirror inside folds the image down onto the film pack, which lies flat under the slot and carries its own battery. Each press fires the flash, and the motor drives the print through the spread rollers, which burst the reagent pod in its wide border and spread the chemistry across the picture as it leaves the slot. A pack holds 8 shots; the side window counts down, and a new pack first ejects its dark slide. Real development takes about 10–15 minutes, with the image first showing after a minute or two; the figure runs that at 20 times real time (12 minutes in 36 seconds) and the readout gives the real minutes.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Polaroid camera. Space, Enter or a click on the red shutter takes a picture.">${svg}</div>`,
});
const file = THEME === "light" ? "polaroid-light.html" : "polaroid.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Polaroid camera", theme: THEME, body: page, script: kitScript() + live }));
console.log("wrote", file, R.items.length, "items");
A.auditOrExit(R, P);
