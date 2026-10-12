import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

// The truth: a C60 cassette, 30 min a side at 4.76 cm/s, 18 µm tape on 11 mm hubs. World units are mm.
const M = { v: 47.6, side: 1800, th: 0.018, hub: 11, ff: 24 };
M.len = M.v * M.side;
M.full = Math.sqrt(M.hub ** 2 + (M.len * M.th) / Math.PI);

// x along the player, y from back to front (the door faces +y), z up. It stands on a bench plate.
const W = 600, H = 400;
const PLATE = { x: -92, y: -46, w: 196, d: 100, r: 8 };
const CASE = { x: -67, y: -14.5, w: 134, d: 29, r: 3.5 };
const Z0 = 1.4, ZT = 89.4, FY = 14.5, DY = 15.5, CY = 12.5;
const DOOR = { x0: -63, x1: 58, z0: 4.2, z1: 87.4 };
const WIN = { x0: -56, x1: 52, z0: 9, z1: 84, r: 4 };
const CX = -2, HZ = 43, TL = 73.5;
const HUBS = [CX - 21, CX + 21];
const ROLL = [[CX - 43, 71], [CX + 43, 71]];
const CAP = [CX + 28, TL - 1.2];
const KEYS = [-56, -39, -22, -5].map((x) => ({ x, y: -5.5, w: 15, d: 11, r: 1.2 }));
const JACK = [[44, -6], [56, -6]];
const WHEELS = [66, 50];

const P = k.fitProjection([...k.boxCorners(PLATE, -15, 0), [-67, -14.5, ZT + 4], [67, 14.5, ZT], [56, -6, 123]], W, H, { pad: 26, azimuth: 58, elevation: 32 });
const V = G.viewOf(P), KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const path3 = (pts, closed) => k.pathOf(pts.map(at), closed);
const f1 = (v) => Math.round(v * 100) / 100;

const R = A.recorder(P);
const put = (name, ref, svg, shapes = [], o = {}) => R.put({ name, at: ref, svg, shapes: shapes.map(R.solid), piece: "w", ...o });
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.4, steps = 2, bevel = 0, inner = "", extra = "", bias = 0, attrs } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  return put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.slab(plan, z0, z1 - z0, { name }, steps)], { bias, attrs });
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, meta = {}, wrap = (s) => s } = {}) {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  return put(name, G.add3(F.o, G.mul3(F.a, mid)), wrap(S(G.solidOf(profile, F, P), { tone: "mid", ...style, inner })) + extra, [A.solid(F, profile, { name, ...meta })], { bias });
}
const zF = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// ---------- bench plate ----------
const back = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
for (const [x, y] of byDepth(k.corners(PLATE, 20))) back.push(S(k.cylinder(x, y, 7, -15, 1.6, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 5.4, -13.4, 3.4, P, 28), { tone: "mid" }));
back.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
const screws = k.corners(PLATE, 10);
back.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }), Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
const STRIP = { x: PLATE.x + 14, y: PLATE.y + PLATE.d - 12, w: 120, d: 6, r: 1 };
const ticks = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y, 0.6, [1.8, 3.4], P);
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }), Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
const LABEL = { x: 44, y: PLATE.y + PLATE.d - 20, w: 34, d: 12, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }), Ln(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(Ln([22, 15, 18].map((w, i) => k.lineOnTop([LABEL.x + 4, LABEL.y + 3.2 + i * 2.8], [LABEL.x + 4 + w, LABEL.y + 3.2 + i * 2.8], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([2.4, 9.6].map((y) => at([LABEL.x + LABEL.w - 2.6, LABEL.y + y, 0.8])), { size: 0.45 }));
R.solid(A.slab(PLATE, -10, 10, { name: "stand.plate", ground: true }, 8));
back.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CASE, -2), 0, 3, P)}"/>`);

// ---------- case ----------
for (const [x, y] of k.corners(CASE, 6)) put("pad", [x, y, 0.7], S(k.cylinder(x, y, 2.6, 0, Z0, P, 20), { tone: "lo" }), [A.cylinder(x, y, 2.6, 0, Z0, { name: "pad" })]);
const SEAMY = -3;
const seam = path3([[-67, SEAMY, ZT], [67, SEAMY, ZT], [67, SEAMY, Z0]]);
const XE = 67;
const slotPts = (cy, cz) => [[XE, cy - 2.4, cz - 7.4], [XE, cy + 2.4, cz - 7.4], [XE, cy + 2.4, cz + 7.4], [XE, cy - 2.4, cz + 7.4]];
const caseExtra = Ln(k.planOutline({ x: -58.4, y: -7.9, w: 70.8, d: 15.8, r: 2.4 }, ZT, P, 4), { tone: "lo" }) + WHEELS.map((cz) => `<path class="wk-bore" d="${path3(slotPts(-4, cz), true)}"/>` + Ln(path3(slotPts(-4, cz), true), { tone: "lo" })).join("");
const CASE_SHAPE = box("case", [-67, -14.5, Z0], [67, 14.5, ZT], { tone: "mid" }, { r: 3.5, steps: 6, bevel: 1.2, inner: Ln(k.sideSeam(CASE, ZT - 3, P, 6), { tone: "faint" }) + Ln(seam, { tone: "lo" }), extra: caseExtra }).shapes[0];

// the door: a brushed plate with a window cut through it
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const C = (x, z, r, cls = "iso-fill", extra = "") => `<circle class="${cls}" cx="${f1(x)}" cy="${f1(-z)}" r="${f1(r)}"${extra}/>`;
const lf = (d, tone = "lo", extra = "") => `<path class="iso-line" data-tone="${tone}" d="${d}"${extra}/>`;
const fl = (cls, d, extra = "") => `<path class="${cls}" d="${d}"${extra}/>`;
const seg = (pts) => k.pathOf(pts.map(([x, z]) => [x, -z]));

const brushed = [];
for (let z = WIN.z0 + 0.8; z < DOOR.z1 - 0.4; z += 1.3) {
  if (z > WIN.z1) { brushed.push(seg([[DOOR.x0, z], [DOOR.x1, z]])); continue; }
  const dz = Math.max(0, WIN.r - Math.min(z - WIN.z0, WIN.z1 - z));
  const dx = WIN.r - Math.sqrt(Math.max(0, WIN.r ** 2 - dz ** 2));
  brushed.push(seg([[DOOR.x0, z], [WIN.x0 + dx, z]]), seg([[WIN.x1 - dx, z], [DOOR.x1, z]]));
}

// the window's recess walls and its content, drawn in the plane of the cassette (local x, -z)
function recess(w, y, depth, inside) {
  const ring = k.roundedPlan({ x: w.x0, y: w.z0, w: w.x1 - w.x0, d: w.z1 - w.z0, r: w.r }, 6);
  const [cx, cz] = [(w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2];
  const tops = [], sides = [[], [], [], []];
  ring.forEach(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / l, -(bx - ax) / l];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    const n3 = [nx, 0, nz];
    if (G.dot3(n3, V) <= 0) return;
    if (nz > 0.7) tops.push(quad);
    else sides[G.toneOf(n3, P)].push(quad);
  });
  const shape = flat(w.x0, w.z0, w.x1, w.z1, w.r);
  return `<clipPath id="wk-win"><path transform="${planeOf(y)}" d="${shape}"/></clipPath><g clip-path="url(#wk-win)"><g transform="${planeOf(y - depth)}">${fl("wk-well", shape)}${inside}</g>${fl("iso-top", tops.join(""))}${sides.map((d, i) => (d.length ? `<path class="iso-shade" data-shade="${i}" d="${d.join("")}"/>` : "")).join("")}<path class="wk-glass" d="${[[w.x0 + 18, w.x0 + 30], [w.x0 + 36, w.x0 + 41]].map(([a, b]) => k.pathOf([[a, w.z0], [b, w.z0], [b + 22, w.z1], [a + 22, w.z1]].map(([x, z]) => at([x, y, z])), true)).join("")}"/></g><g transform="${planeOf(y)}">${lf(shape, "lo")}${lf(flat(w.x0 - 1.6, w.z0 - 1.6, w.x1 + 1.6, w.z1 + 1.6, w.r + 1.6), "faint")}</g>`;
}

// cassette: a clear C60 shell, tape opening up, with head openings in its top edge
const SH = { x0: CX - 50.2, x1: CX + 50.2, z0: 11, z1: 74.8 };
const NOTCH = [[CX - 22, CX - 12], [CX - 7, CX + 7], [CX + 21, CX + 35]];
const shellPts = [[SH.x0 + 3, SH.z0], [SH.x1 - 3, SH.z0], [SH.x1, SH.z0 + 3], [SH.x1, SH.z1 - 2], [SH.x1 - 6, SH.z1]];
for (const [a, b] of [...NOTCH].reverse()) shellPts.push([b, SH.z1], [b, SH.z1 - 3], [a, SH.z1 - 3], [a, SH.z1]);
shellPts.push([SH.x0 + 6, SH.z1], [SH.x0, SH.z1 - 2], [SH.x0, SH.z0 + 3]);
const shellD = k.pathOf(shellPts.map(([x, z]) => [x, -z]), true);
const screw = (x, z) => C(x, z, 1.3, "iso-top") + lf(seg([[x - 1.3, z], [x + 1.3, z]]) + seg([[x, z - 1.3], [x, z + 1.3]]), "lo");
const tooth = (cx, a) => { const p = (r, t) => [cx + r * Math.sin(a + t), -(HZ + r * Math.cos(a + t))]; return k.pathOf([p(4.6, -0.28), p(2.6, 0), p(4.6, 0.28)], true); };
const hub = (i) => {
  const cx = HUBS[i];
  const teeth = [0, 1, 2, 3, 4, 5].map((j) => tooth(cx, (j * Math.PI) / 3)).join("");
  return `<g data-reel="${i}">${C(cx, HZ, M.hub, "iso-top")}${C(cx, HZ, 9.2, "iso-line", ' data-tone="faint"')}${C(cx, HZ, 4.6, "wk-bore")}<g data-sharp>${lf(k.pathOf(k.roundedPlan({ x: cx - 1.6, y: -HZ - M.hub, w: 3.2, d: 2.4, r: 0.4 }, 2), true), "lo")}${fl("iso-top", teeth)}${lf(teeth, "lo")}</g>${C(cx, HZ, 3.6, "wk-blur", ' style="opacity:0"')}</g>`;
};
const packRings = (i) => Array.from({ length: 9 }, (_, j) => C(HUBS[i], HZ, M.hub + 1.5 + j * 1.5, "iso-line", ' data-tone="faint"')).join("");
const heads = [[CX - 20.5, CX - 13.5, 0.8], [CX - 6, CX + 6, 1.4]];
const headsSvg = `<g data-part="heads">${fl("iso-shade", flat(CX - 24, 79.6, CX + 10, 83.2, 0.6), ' data-shade="2"')}${lf(flat(CX - 24, 79.6, CX + 10, 83.2, 0.6), "mid")}${[CX - 21.6, CX + 7.6].map((x) => C(x, 81.4, 0.9, "wk-bore")).join("")}${heads.map(([a, b, rr]) => fl("iso-top", flat(a, 75.4, b, 79.6, rr)) + lf(flat(a, 75.4, b, 79.6, rr), "hi") + lf(seg([[a, 77.8], [b, 77.8]]), "faint")).join("")}${lf(seg([[CX, 75.4], [CX, 77.8]]), "mid")}</g>`;
const pinchSvg = `<g data-part="pinch">${fl("iso-shade", flat(CAP[0] - 2.2, 79.6, CAP[0] + 13, 83.2, 0.8), ' data-shade="1"')}${lf(flat(CAP[0] - 2.2, 79.6, CAP[0] + 13, 83.2, 0.8), "mid")}${C(CAP[0] + 9.4, 81.4, 1, "wk-bore")}${C(CAP[0], TL + 4.2, 4.2, "wk-roller")}${lf(k.pathOf(k.roundedPlan({ x: CAP[0] - 4.2, y: -TL - 8.4, w: 8.4, d: 8.4, r: 4.2 }, 10), true), "mid")}${C(CAP[0], TL + 4.2, 1.4, "iso-top")}${lf(k.pathOf(k.roundedPlan({ x: CAP[0] - 1.4, y: -TL - 5.6, w: 2.8, d: 2.8, r: 1.4 }, 6), true), "lo")}</g>`;
const label = fl("iso-top", flat(CX - 42, 13.2, CX + 42, 18, 1)) + lf(flat(CX - 42, 13.2, CX + 42, 18, 1), "faint") + lf([[30, 14.6], [22, 16.6]].map(([w, z]) => seg([[CX - 39, z], [CX - 39 + w, z]])).join(""), "lo", ' data-free=""') + lf(seg([[CX + 20, 14.6], [CX + 38, 14.6]]), "lo", ' data-free=""');
const inside = [
  fl("wk-shell", shellD), lf(shellD, "mid"),
  lf(flat(SH.x0 + 2.4, SH.z0 + 2.4, SH.x1 - 2.4, SH.z1 - 5, 2), "faint"),
  label,
  ...[0, 1].map((i) => `<clipPath id="wk-pack${i}"><circle data-pclip="${i}" cx="${HUBS[i]}" cy="${-HZ}" r="${M.full}"/></clipPath>${C(HUBS[i], HZ, M.full, "wk-pack", ` data-pack="${i}"`)}<g clip-path="url(#wk-pack${i})">${packRings(i)}</g>`),
  hub(0), hub(1),
  ...[[SH.x0 + 5, SH.z0 + 5], [SH.x1 - 5, SH.z0 + 5], [SH.x0 + 5, SH.z1 - 7], [SH.x1 - 5, SH.z1 - 7], [CX, 30]].map(([x, z]) => screw(x, z)),
  ...ROLL.map(([x, z]) => C(x, z, 2.5, "iso-top") + C(x, z, 2.5, "iso-line", ' data-tone="mid"') + C(x, z, 0.8, "wk-bore")),
  fl("iso-shade", flat(CX - 4, 71.4, CX + 4, TL - 0.3, 0.3), ' data-shade="3"'), lf(flat(CX - 4, 71.4, CX + 4, TL - 0.3, 0.3), "faint"),
  ...[CX - 23.5, CX + 37.5].map((x) => C(x, 72.3, 1, "iso-top") + C(x, 72.3, 1, "iso-line", ' data-tone="mid"')),
  C(CAP[0], CAP[1], 1.2, "wk-capstan"),
  `<path class="iso-line wk-tape" data-tone="lit" data-part="tape" d=""/>`,
  headsSvg, pinchSvg,
].join("");

const doorText = k.faceTextSvg(k.sideMatrix([CX, DY], 5.4, P, "left"), "WALKMAN", { size: 3.2, tone: "lo", anchor: "middle" });
put("door", [CX, DY, 46], S(k.slabOf({ x: DOOR.x0, y: FY, w: DOOR.x1 - DOOR.x0, d: DY - FY, r: 0.4 }, DOOR.z0, DOOR.z1 - DOOR.z0, P, 2, 0.4), { tone: "mid" }) + `<g transform="${planeOf(DY)}">${lf(brushed.join(""), "faint", ' class="wk-brush"')}</g>` + recess(WIN, DY, DY - CY, inside) + doorText + Dots([[DOOR.x0 + 2.6, 6.6], [DOOR.x1 - 2.6, 6.6], [DOOR.x0 + 2.6, 85], [DOOR.x1 - 2.6, 85]].map(([x, z]) => at([x, DY, z])), { size: 0.5 }), [A.slab({ x: DOOR.x0, y: FY, w: DOOR.x1 - DOOR.x0, d: 1, r: 0.4 }, DOOR.z0, DOOR.z1 - DOOR.z0, { name: "door" }, 2)]);
box("latch", [CX - 7, DY, 84.2], [CX + 5, DY + 0.9, DOOR.z1], { tone: "hi" }, { inner: Ln(path3([[CX - 7, DY + 0.9, 85.8], [CX + 5, DY + 0.9, 85.8]]), { tone: "faint" }) });
for (const x of [-50, 34]) {
  const F = G.frameOf([x, FY + 1.3, 2.9], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("hinge", F, [[0, 1.3], [10, 1.3]], {}, { extra: Ln(G.arcOf(F, 5, 1.3, P), { tone: "faint" }) });
}

// top: the transport keys standing on the top face, the hotline button and the two jacks
const ICON = [
  [[-3, -3], [3, -3], [3, 3], [-3, 3]],
  [[0.2, -3.4], [0.2, 3.4], [-3.8, 0], [0.2, -3.4], [4.2, -3.4], [4.2, 3.4], [0.2, 0]],
  [[-2.6, -3.6], [-2.6, 3.6], [3.8, 0]],
  [[-0.2, -3.4], [-0.2, 3.4], [3.8, 0], [-0.2, -3.4], [-4.2, -3.4], [-4.2, 3.4], [-0.2, 0]],
];
const KEY_H = 4, LATCH = 2.6;
const keySvg = (i, h) => {
  const p = KEYS[i], cx = p.x + p.w / 2, cy = p.y + p.d / 2, top = ZT + h;
  const icon = i === 1 || i === 3 ? [ICON[i].slice(0, 3), ICON[i].slice(4)] : [ICON[i]];
  return S(k.slabOf(p, ZT, h, P, 3, 0.4), { tone: i === 2 ? "hi" : "mid", lit: i === 2 }) + Ln(icon.map((poly) => k.onTop(poly.map(([u, v]) => [cx + u, cy + v]), top, P, true)).join(""), { tone: "mid" });
};
KEYS.forEach((p, i) => put(`key${i}`, [p.x + p.w / 2, 0, ZT + 2], `<g data-key="${i}" class="wk-key">${keySvg(i, KEY_H)}</g>`, [A.slab(p, ZT, KEY_H, { name: `key${i}` }, 3)]));
turned("hotline", zF(28, -3, ZT), [[0, 3.6], [0.8, 3.6], [0.8, 2.8], [2.6, 2.8]], { tone: "hi" }, { extra: Ln(k.ring(28, -3, 1.4, ZT + 2.6, P, 20), { tone: "lo" }) });
JACK.forEach(([x, y], i) => turned(`jack${i}`, zF(x, y, ZT), [[0, 3.6], [1.2, 3.6]], {}, { extra: (i ? "" : `<path class="wk-bore" d="${k.ring(x, y, 1.8, ZT + 1.2, P, 24)}"/>`) + Ln(k.ring(x, y, 2.6, ZT + 1.2, P, 28), { tone: "faint" }) }));
const PF = zF(56, -6, ZT + 1.2);
const PLUG = [[0, 2.4], [1.6, 2.4], [1.6, 3.6], [11, 3.6], [12.5, 2.2, 1], [20, 1.4]];
turned("plug", PF, PLUG, { tone: "mid" }, { extra: k.fadedSvg(G.ribsOf(PF, 2.2, 10.4, 3.6, 28, P, { seams: true, fade: [0.05, 0.5] }), { tone: "lo" }) + Ln([14.5, 16.5, 18.5].map((s) => G.arcOf(PF, s, 2.2 - (s - 12.5) * 0.107, P, { slope: -0.107 })).join(""), { tone: "faint" }) });

// end face: battery door, two knurled thumbwheels in slots, a strap lug
box("battery", [XE, -11, 7], [XE + 0.6, 11, 36], {}, { r: 0.3, extra: Ln([-4, 0, 4].map((y) => path3([[XE + 0.6, y - 0.6, 26], [XE + 0.6, y + 0.6, 26], [XE + 0.6, y + 0.6, 33], [XE + 0.6, y - 0.6, 33]], true)).join(""), { tone: "lo" }) + Dots([[-8, 10], [8, 10]].map(([y, z]) => at([XE + 0.6, y, z])), { size: 0.55 }) });
WHEELS.forEach((cz, i) => {
  const cy = -4, F = G.frameOf([XE - 2.6, cy - 1.6, cz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const clip = k.pathOf([[XE, cy - 1.6, cz - 9], [XE, cy - 1.6, cz + 9], [XE + 9, cy - 1.6, cz + 9], [XE + 9, cy + 1.6, cz + 9], [XE + 9, cy + 1.6, cz - 9], [XE, cy + 1.6, cz - 9]].map(at), true);
  const ribs = G.ribsOf(F, 0, 3.2, 7.5, 44, P, { fade: [0.05, 0.5] });
  turned(`wheel${i}`, F, [[0, 7.5], [3.2, 7.5]], { tone: i ? "mid" : "hi" }, { meta: { cut: CASE_SHAPE, seated: true }, wrap: (s) => `<clipPath id="wk-wh${i}"><path d="${clip}"/></clipPath><g clip-path="url(#wk-wh${i})">${s}${k.fadedSvg(ribs, { tone: "lo" })}</g>` });
});
box("lug", [XE, -3, 78], [XE + 3.2, 3, 85], {}, { r: 0.8, extra: Ln(path3([[XE + 3.2, -1.2, 80], [XE + 3.2, 1.2, 80], [XE + 3.2, 1.2, 83], [XE + 3.2, -1.2, 83]], true), { tone: "lo" }) });

// the headphone cable: out of the plug's strain relief, over and down to a remote lying on the bench
const REMOTE = [[77, 30, 0], [91, 46, 6]];
box("remote", REMOTE[0], REMOTE[1], {}, { r: 2, steps: 4, bevel: 0.5, extra: Ln(k.planOutline({ x: 80, y: 33, w: 8, d: 10, r: 1 }, 6, P, 3), { tone: "faint" }) + Dots([at([84, 38, 6])], { size: 0.8, tone: "hi" }) });
const CR = 1.15;
const route = G.fillet([[56, -6, ZT + 1.2 + 20], [56, -6, 121], [84, -6, 121], [84, -6, CR * 1.5], [84, 30, CR * 1.5]], 9, 12, { P, tube: CR });
R.route("cable", route, CR, { limp: true, piece: "w" });
tubePieces(route, CR, P, { maxLength: 16, spacing: 0.8 }).forEach((piece, i) => R.put({ name: `cable:${i}`, at: piece.mid, bias: 0.05, piece: "w", svg: tubeSvg(piece, { tone: "mid" }), shapes: [A.tube(piece.points, piece.radii)] }));

// ---------- order ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const body = R.items.map((it) => `<g class="it" data-name="${it.name}"${it.attrs ?? ""}>${it.svg}</g>`).join("");

const DATA = { P, M, HUBS, HZ, ROLL, CAP, TL, KEYS, ICON, KEY_H, LATCH, ZT, plane: planeOf(CY) };
const LIVE = `
const D = ${JSON.stringify(DATA)};
const { P, M } = D;
const stage = document.querySelector(".iso-stage"), svg = stage.querySelector("svg"), readout = document.querySelector("[data-readout]");
const $ = (s) => svg.querySelector(s);
const reels = [0, 1].map((i) => $('[data-reel="' + i + '"]')), packs = [0, 1].map((i) => $('[data-pack="' + i + '"]')), clips = [0, 1].map((i) => $('[data-pclip="' + i + '"]'));
const keys = [0, 1, 2, 3].map((i) => $('[data-key="' + i + '"]'));
const tape = $('[data-part="tape"]'), heads = $('[data-part="heads"]'), pinch = $('[data-part="pinch"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const S = { mode: "stop", wound: M.len * 0.4, v: 0, ang: [0, 0], head: 0, roll: 1, key: [0, 0, 0, 0], tap: 0 };
const TARGET = { stop: 0, play: M.v, ff: M.v * M.ff, rew: -M.v * M.ff };
const KEY_OF = { stop: 0, rew: 1, play: 2, ff: 3 };
const ICONS = D.ICON;
const keyPaths = (i, h) => {
  const p = D.KEYS[i], cx = p.x + p.w / 2, cy = p.y + p.d / 2, top = D.ZT + h;
  const polys = i === 1 || i === 3 ? [ICONS[i].slice(0, 3), ICONS[i].slice(4)] : [ICONS[i]];
  return solidSvg(slabOf(p, D.ZT, h, P, 3, 0.4), { tone: i === 2 ? "hi" : "mid", lit: i === 2 }) + lineSvg(polys.map((q) => onTop(q.map(([u, v]) => [cx + u, cy + v]), top, P, true)).join(""), { tone: "mid" });
};
const radius = (len) => Math.sqrt(M.hub * M.hub + (Math.max(0, len) * M.th) / Math.PI);
function tangent(c1, r1, c2, r2, side) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], L = Math.hypot(dx, dy), b = Math.acos((r1 - r2) / L), a = Math.atan2(dy, dx);
  const n = [a + b, a - b].map((t) => [Math.cos(t), Math.sin(t)]).sort((p, q) => side * (p[0] - q[0]))[0];
  return [[c1[0] + r1 * n[0], c1[1] + r1 * n[1]], [c2[0] + r2 * n[0], c2[1] + r2 * n[1]]];
}
const f = (v) => v.toFixed(2);
const clock = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
let lastKeys = "";
function draw() {
  const rs = [radius(M.len - S.wound), radius(S.wound)];
  const blur = Math.min(1, Math.max(0, (Math.abs(S.v) / Math.min(...rs) / (2 * Math.PI) - 1.2) / 1.5));
  reels.forEach((el) => { el.querySelector("[data-sharp]").style.opacity = f(1 - 0.85 * blur); el.querySelector(".wk-blur").style.opacity = f(blur * 0.8); });
  rs.forEach((r, i) => { packs[i].setAttribute("r", f(r)); clips[i].setAttribute("r", f(r)); reels[i].setAttribute("transform", "rotate(" + f((S.ang[i] * 180) / Math.PI) + " " + D.HUBS[i] + " " + -D.HZ + ")"); });
  const c = (x, z) => [x, -z];
  const a = tangent(c(D.HUBS[0], D.HZ), rs[0], c(...D.ROLL[0]), 2.5, 1), b = tangent(c(...D.ROLL[1]), 2.5, c(D.HUBS[1], D.HZ), rs[1], -1);
  tape.setAttribute("d", "M" + a[0].map(f) + "L" + a[1].map(f) + "M" + f(D.ROLL[0][0]) + " " + f(-D.TL) + "L" + f(D.ROLL[1][0]) + " " + f(-D.TL) + "M" + b[0].map(f) + "L" + b[1].map(f));
  heads.setAttribute("transform", "translate(0 " + f(S.head * 1.75) + ")");
  pinch.setAttribute("transform", "translate(0 " + f(-S.roll * 2.1) + ")");
  const ks = S.key.map((d) => d.toFixed(2)).join();
  if (ks !== lastKeys) { lastKeys = ks; S.key.forEach((d, i) => (keys[i].innerHTML = keyPaths(i, D.KEY_H - d))); }
  const rpm = rs.map((r) => Math.abs((S.v / r) * 60 / (2 * Math.PI)));
  const word = S.mode === "stop" ? (S.wound >= M.len - 1 ? "end of side" : "stopped") : S.mode === "play" ? "play" : S.mode === "ff" ? "ff ×" + M.ff : "rew ×" + M.ff;
  const text = word + " · A " + clock(S.wound / M.v) + " · take-up " + rpm[1].toFixed(0) + " · supply " + rpm[0].toFixed(0) + " rpm";
  if (readout.textContent !== text) readout.textContent = text;
}
const TOUR = [["stop", 1.4], ["play", 6], ["ff", 4.5], ["play", 5], ["rew", 4], ["stop", 1.6]];
let frame = 0, last = 0, visible = false, touring = !still.matches, tclock = 0, quiet = 0;
function setMode(mode) {
  if (mode === "stop" && S.mode !== "stop") S.tap = 0.18;
  S.mode = mode;
  stage.setAttribute("aria-valuetext", mode);
}
function tourMode(t) { t %= TOUR.reduce((s, [, d]) => s + d, 0); for (const [m, d] of TOUR) { if (t < d) return m; t -= d; } return "stop"; }
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { tclock += dt; const m = tourMode(tclock); if (m !== S.mode) setMode(m); }
  else if ((quiet += dt) > 8 && S.mode === "stop" && !calm) { touring = true; tclock = 0; }
  const ease = (x, t, tau) => (calm ? t : x + (t - x) * (1 - Math.exp(-dt / tau)));
  const target = TARGET[S.mode];
  S.v = ease(S.v, target, S.mode === "play" || (S.mode === "stop" && Math.abs(S.v) < 60) ? 0.12 : 0.45);
  if (Math.abs(S.v - target) < 0.05) S.v = target;
  S.wound += S.v * dt;
  if (S.wound >= M.len) { S.wound = M.len; S.v = 0; if (S.mode !== "stop") setMode("stop"); }
  if (S.wound <= 0) { S.wound = 0; S.v = 0; if (S.mode !== "stop") setMode("stop"); }
  const rs = [radius(M.len - S.wound), radius(S.wound)];
  if (!calm) rs.forEach((r, i) => (S.ang[i] += (S.v / r) * dt));
  const on = S.mode === "play" ? 1 : 0;
  S.head = ease(S.head, on, 0.08); S.roll = ease(S.roll, 1 - on, 0.08);
  S.tap = Math.max(0, S.tap - dt);
  S.key = S.key.map((d, i) => { const t = i === KEY_OF[S.mode] && i ? D.LATCH : i === 0 && S.tap > 0 ? D.KEY_H - 1 : 0; const n = ease(d, t, 0.05); return Math.abs(n - t) < 0.01 ? t : n; });
  draw();
  const settled = !touring && S.mode === "stop" && S.v === 0 && S.tap === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const press = (mode) => { touring = false; quiet = 0; setMode(S.mode === mode && mode !== "stop" ? "stop" : mode); run(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
keys.forEach((el, i) => el.addEventListener("click", () => press(["stop", "rew", "play", "ff"][i])));
stage.addEventListener("keydown", (e) => {
  const m = e.key === " " ? (S.mode === "play" ? "stop" : "play") : e.key === "ArrowLeft" ? "rew" : e.key === "ArrowRight" ? "ff" : e.key === "Escape" || e.key === "s" ? "stop" : null;
  if (!m) return;
  e.preventDefault();
  press(m);
});
draw();
`;

const CSS = `.wk-well{fill:var(--anatomy-shade-0)}.wk-shell{fill:var(--anatomy-face);fill-opacity:.55}.wk-pack{fill:var(--anatomy-shade-1);stroke:var(--anatomy-mid);stroke-width:.4}.wk-bore{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:.3}.wk-roller{fill:var(--anatomy-shade-0);stroke:none}.wk-capstan{fill:var(--anatomy-hi)}.wk-glass{fill:var(--anatomy-hi);opacity:.035;pointer-events:none}.wk-brush{opacity:.55}.wk-tape{stroke-width:.9}.wk-key{cursor:pointer}.iso[data-theme="light"] .wk-pack{fill:var(--anatomy-faint);fill-opacity:.5}.wk-blur{fill:none;stroke:var(--anatomy-lo);stroke-width:2}`;
const svg = k.figureSvg({
  width: W,
  height: H,
  label: "A metal-bodied portable cassette player in the style of the 1979 Sony Walkman TPS-L2, standing on a bench plate. Through the door window a clear C60 cassette shows its two tape packs, hubs and screws, and the tape path along its top edge past the guide rollers, erase head, play head, capstan and pinch roller. Four transport keys sit on top beside the hotline button and two headphone jacks; a headphone plug in one jack leads its cable down to a remote on the bench. Volume and tone thumbwheels, a battery door and a strap lug are on the end.",
  body: [...back, body],
});
const page = k.pageHtml({
  title: "Walkman",
  theme: THEME,
  body:
    `<style>${CSS}.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}</style>` +
    k.plateHtml({
      fig: "Fig 1",
      title: "Cassette player, 1979",
      hint: "Click keys · Space · ← →",
      readout: "stopped · A 12:00",
      keys: [
        { mark: "lit", label: "Tape: from the supply pack past the heads and capstan to the take-up pack" },
        { mark: "raised", label: "Play key: latches down, swings the pinch roller onto the capstan and the heads onto the tape" },
      ],
      caption: `A C60 cassette holds ${(M.len / 1000).toFixed(1)} m of ${M.th * 1000} µm tape per side, played at 4.76 cm/s for 30 minutes. The capstan pulls the tape at that constant speed, so each reel turns at ω = v / r for its pack radius: the take-up hub starts at ${((M.v / M.hub) * 60 / (2 * Math.PI)).toFixed(0)} rpm on its bare ${M.hub} mm hub and slows to ${((M.v / M.full) * 60 / (2 * Math.PI)).toFixed(0)} rpm as its pack grows to ${M.full.toFixed(1)} mm, while the supply reel does the reverse. Fast wind runs the tape about ${M.ff} times faster with the pinch roller lifted.`,
      body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Cassette player. Space plays or stops, left and right arrows rewind and fast-forward, Escape stops; or click the keys on top." aria-valuetext="stopped">${svg}</div>`,
    }),
  script: kitScript() + LIVE,
});
const name = THEME === "light" ? "walkman-light.html" : "walkman.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `scale ${KS.toFixed(3)}`);
A.auditOrExit(R, P, {});
