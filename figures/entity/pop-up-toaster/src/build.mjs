import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

// World units are 2 mm. x runs along the slots (the control end is +x), y across them, z up from the bench.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 600, H = 430;
const REST = 58, DROP = 40, CUT = 34, TOP = 92;
const SPRING = { stiffness: 120, damping: 12 };
const PLATE = { x: -82, y: -58, w: 180, d: 126, r: 6 };

const P = k.fitProjection([...k.boxCorners(PLATE, -13, 0), [-62, -44, 116], [63, 44, 116], [77, -26, 66]], W, H, { pad: 26, azimuth: 45, elevation: 32 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, { tone: "mid", ...style });
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts.map(at), { size: 0.45, ...style });
const seg = (a, b) => k.segment(a, b, P);
const poly3 = (pts, closed) => k.pathOf(pts.map(at), closed);
const R = A.recorder(P, { order: ["car"], spring: SPRING });
const CAR = { piece: "car", move: [0, 0, -DROP] };

function put(name, ref, svg, shapes, o = {}) {
  return R.put({ name: R.nameFor(name), at: ref, svg, shapes: shapes.map((s) => R.solid({ name, ...s })), ...o });
}
const arc = (cx, cy, r, a0, n = 6) => Array.from({ length: n + 1 }, (_, i) => {
  const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
function prism(name, ring, z0, z1, style = {}, o = {}) {
  const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  const convex = o.convex ?? true;
  return put(name, [cx, cy, (z0 + z1) / 2], S(k.extrude(ring, z0, z1 - z0, P, { convex, bevel: o.bevel ?? 0 }), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.extruded(ring, z0, z1 - z0)], o);
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const box = (name, [x0, y0, z0], [x1, y1, z1], style, o = {}) => {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: o.r ?? 0.3 };
  return put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, o.steps ?? 2, o.bevel ?? 0), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.slab(plan, z0, z1 - z0, {}, o.steps ?? 2)], o);
};
function turned(name, F, profile, style = {}, o = {}) {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  return put(name, G.add3(F.o, G.mul3(F.a, mid)), S(G.solidOf(profile, F, P), { ...style, inner: o.inner ?? "" }) + (o.extra ?? ""), [A.solid(F, profile)], o);
}

// ---------- bench ----------
const back = [`<path class="iso-halo" d="${k.haloOf(PLATE, -13, 13, P)}"/>`];
for (const [x, y] of k.corners(PLATE, 14).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) back.push(S(k.cylinder(x, y, 6, -13, 5, P, 24), { tone: "lo" }));
R.solid(A.slab(PLATE, -8, 8, { name: "stand.plate" }));
const screws = k.corners(PLATE, 7);
back.push(S(k.slabOf(PLATE, -8, 8, P, 6, 1.2), { tone: "lo" }), L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }), L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }), Dt(screws.map(([x, y]) => [x, y, 0]), { size: 0.5 }));
const label = { x: -78, y: 52, w: 25, d: 10, r: 1 };
back.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }), L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([label.x + 3.2, label.y + 4.2], 0.8, P, "x"), "900 W 230 V", { size: 2.4, tone: "lo" }));
back.push(L([6.6, 8.4].map((y, i) => k.lineOnTop([label.x + 3.2, label.y + y], [label.x + 3.2 + (i ? 12 : 18), label.y + y], 0.8, P)).join(""), { tone: "faint", free: true }));
back.push(`<path class="iso-halo" d="${k.haloOf({ x: -62, y: -44, w: 125, d: 88, r: 8 }, 0, 6, P)}" style="opacity:.6"/>`);
R.solid(A.slab(label, 0, 0.8, { name: "stand.label" }));

// ---------- base, feet, crumb tray ----------
for (const [x, y] of [[-50, -32], [51, -32], [-50, 32], [51, 32]]) put("foot", [x, y, 2.5], S(k.cylinder(x, y, 4.5, 0, 5, P, 20), { tone: "lo" }), [A.cylinder(x, y, 4.5, 0, 5)]);
const PAN = { x: -62, y: -44, w: 125, d: 88, r: 8 };
put("pan", [0, 0, 8], S(k.slabOf(PAN, 5, 6, P, 8, 0.6), { tone: "lo" }), [A.slab(PAN, 5, 6)]);
box("tray.lip", [-36, 44, 6], [30, 45.4, 10], { tone: "mid" }, { extra: Dt([[-33, 45.4, 8], [27, 45.4, 8]]) });
box("tray.tab", [-8, 45.4, 7.2], [4, 49.5, 8.8], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.3 });

// ---------- shell: a window cutaway on the near side and the near half of the control end ----------
const CHROME = (x0, x1, z0, z1) => [x0, x0 + 3, x1 - 9, x1 - 6].map((x) => seg([x, 44, z0], [x, 44, z1])).join("");
for (const [cx, cy, a0] of [[-54, -36, 180], [55, -36, 270], [55, 36, 0], [-54, 36, 90]]) prism("shell.corner", [[cx, cy], ...arc(cx, cy, 8, a0, 8)], 11, TOP);
prism("shell.endL", rect(-62, -36, -59.5, 36), 11, TOP);
prism("shell.far", rect(-54, -44, 55, -41.5), 11, TOP);
prism("shell.near", rect(-54, 41.5, 55, 44), 11, CUT, {}, { inner: L(CHROME(-40, 20, 11, CUT), { tone: "faint" }) });
box("shell.end", [60.5, -36, 11], [63, -28, TOP], {}, { extra: Dt([[63, -33, 88]]) });
box("shell.jamb", [60.5, -24, CUT], [63, -21, TOP]);
box("shell.stub", [60.5, -24, 11], [63, 36, CUT], {}, { extra: Dt([[63, 33, 14], [63, -20, 14]]) });
box("shell.slotLo", [60.5, -28, 11], [63, -24, 13]);
box("shell.slotHi", [60.5, -28, 70], [63, -24, TOP]);
// The top: five chrome strips round the two slots, which are 144 × 36 mm.
const SLOTS = [18, -18];
prism("top.far", [...arc(-54, -36, 8, 180), ...arc(55, -36, 8, 270), [63, -28.6], [-62, -28.6]], TOP, 100, {}, { bevel: 0.8 });
prism("top.near", [[-62, 28.6], [63, 28.6], ...arc(55, 36, 8, 0), ...arc(-54, 36, 8, 90)], TOP, 100, {}, { bevel: 0.8 });
prism("top.left", rect(-62, -28.6, -51.6, 28.6), TOP, 100);
prism("top.right", rect(23.6, -28.6, 63, 28.6), TOP, 100, {}, { extra: Dt([[58, -22, 100], [58, 22, 100]]) });
prism("top.mid", rect(-51.6, -7.4, 23.6, 7.4), TOP, 100);
for (const c of SLOTS) for (const [a, b] of [[[-51.6, c - 10.6], [23.6, c - 9]], [[-51.6, c + 9], [23.6, c + 10.6]], [[-51.6, c - 9], [-50, c + 9]], [[22, c - 9], [23.6, c + 9]]]) box("lip", [...a, TOP], [...b, 101.4], { tone: "mid" }, { r: 0.5, bevel: 0.3 });

// ---------- element boards: mica cards wound with zig-zag nichrome ----------
const zig = (y, z0, z1) => Array.from({ length: 34 }, (_, i) => [-46 + i * 2, y, i % 2 ? z1 : z0]);
for (const [y0, z1] of [[-35, 88], [-0.6, 88], [34, 44]]) {
  const y = y0 + 1.05, wire = zig(y, 17, z1 - 3);
  const face = poly3([[-50, y, 14], [24, y, 14], [24, y, z1], [-50, y, z1]], true);
  const el = `<path class="tw-tint" d="${face}"/><g class="tw-el"><path class="tw-glow" d="${poly3(wire)}"/><path class="iso-line tw-wire" d="${poly3(wire)}"/></g>`;
  box("board", [-50, y0, 11], [24, y0 + 1, z1], { tone: "lo" }, { extra: el + Dt([wire[0], wire[33], [22, y, 15], [22, y, z1 - 4]], { size: 0.6, tone: "mid" }) });
}

// ---------- carriage: racks, cross bar, slider, lever ----------
for (const c of SLOTS) box("rack", [-44, c - 4, REST - 1.5], [26, c + 4, REST], { tone: "mid" }, { ...CAR, inner: L([-1.5, 1.5].map((d) => seg([-44, c + d, REST], [26, c + d, REST])).join(""), { tone: "faint" }) });
box("carriage", [26, -22, REST - 2], [38, 22, REST], {}, { ...CAR, extra: Dt([[32, -18, REST], [32, 18, REST]]) });
box("slider", [38, -30, REST - 1], [47, -18, REST + 6], {}, { ...CAR, bevel: 0.4 });
box("lever.arm", [47, -27, REST + 1], [68, -25, REST + 3.5], {}, { ...CAR, hit: "lever" });
box("lever", [68, -35, REST], [80, -17, REST + 4.5], { lit: true }, { ...CAR, hit: "lever", r: 2.4, steps: 4, bevel: 0.6, inner: L([71, 73, 75, 77].map((x) => seg([x, -35, REST + 4.5], [x, -17, REST + 4.5])).join(""), { tone: "lo" }) });

// ---------- rail, return spring bracket, latch and bimetal ----------
box("rail", [38, -33, 11], [46, -30, TOP], {}, { inner: L(seg([42, -30, 11], [42, -30, TOP]), { tone: "faint" }) });
box("bracket", [38, -27, 88], [46, -21, TOP], {}, { extra: Dt([[42, -24, 88]], { size: 0.6 }) });
put("spring", [42, -24, 76], `<g data-part="spring"></g>`, [A.cylinder(42, -24, 2.8, 72, 16)]);
box("latch.post", [41, -17, 11], [43, -15, 26]);
box("latch", [38, -18, 26], [46, -14, 29.5], {}, { extra: Dt([[42, -14, 27.8]], { size: 0.6 }) });
box("latch.finger", [44, -14, 27], [48, -12, 29]);
box("bimetal.mount", [44, -13, 11], [50, -7, 15], { tone: "lo" });
box("bimetal", [46.4, -12, 15], [47, -8, 36], { tone: "lo" });
box("bimetal.b", [47, -12, 15], [47.6, -8, 36], { tone: "hi" }, { extra: `<path class="tw-bi" d="${poly3([[47.6, -12, 15], [47.6, -8, 15], [47.6, -8, 36], [47.6, -12, 36]], true)}"/>` });

// ---------- bread guards (wire frames that close on the slice) ----------
for (const c of SLOTS) for (const side of [1, -1]) {
  const y = c + side * 8, wires = [[[-38, y, 24], [16, y, 24]], [[-38, y, 80], [16, y, 80]], ...[-32, -16, 0, 12].map((x) => [[x, y, 24], [x, y, 80]])];
  R.put({ name: R.nameFor("guard"), at: [-11, y, 52], svg: L(wires.map(([a, b]) => seg(a, b)).join(""), { tone: "mid" }) + Dt([[-38, y, 24], [16, y, 24], [-38, y, 80], [16, y, 80]], { size: 0.55, tone: "mid" }), piece: "car", move: [0, -side * 2.6, 0], shapes: wires.map(([a, b]) => A.tube([a, b], 0.45, { name: "guard" })) });
}

// ---------- bread: two slices, 108 × 112 mm, 14 mm thick ----------
const SLICE = [[-40, 0], [14, 0], [14, 44], [12, 50], [6, 54], [-13, 56], [-32, 54], [-38, 50], [-40, 44]].map(([x, z]) => [x, z + REST]);
const CRUST = [[-38.4, 1.6], [12.4, 1.6], [12.4, 43.6], [10.6, 48.8], [5.2, 52.4], [-13, 54.3], [-31.2, 52.4], [-36.6, 48.8], [-38.4, 43.6]];
const crumb = Array.from({ length: 46 }, (_, i) => [-36 + ((i * 37) % 47), 4 + ((i * 53) % 47) * 1.02]);
for (const c of SLOTS) {
  const F = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), y = c + 3.5;
  const svg = `<g class="tw-br" data-br="${c > 0 ? 0 : 1}">${S(G.prismOf(F, SLICE, c - 3.5, c + 3.5, P), { tone: "lo" })}${L(poly3(CRUST.map(([x, z]) => [x, y, REST + z]), true), { tone: "lo" })}${Dt(crumb.map(([x, z]) => [x, y, REST + z]), { size: 0.35, tone: "faint" })}</g>`;
  put("bread", [-13, c, REST + 28], svg, [A.prism(F, SLICE, c - 3.5, c + 3.5)], CAR);
}

// ---------- controls on the end panel: browning knob, ticks 1–6, cancel button, cord ----------
const KNOB = G.frameOf([63, 10, 22], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const tickAt = (i) => (-120 + i * 48) * (Math.PI / 180);
const onFace = (F, s, r, a) => G.pointOf(F, s, r, a + Math.PI / 2);
const ticks = [0, 1, 2, 3, 4, 5].map((i) => poly3([onFace(KNOB, 0.02, 9, tickAt(i)), onFace(KNOB, 0.02, 10.4 + i * 0.45, tickAt(i))])).join("");
const knurl = G.ribsOf(KNOB, 1.6, 6, 6.6, 40, P, { fade: [0.1, 0.55], seams: true });
turned("knob", KNOB, [[0, 7.2], [1.2, 7.2], [1.6, 6.6], [6, 6.6], [6.6, 5.6]], {}, { hit: "knob", inner: k.fadedSvg(knurl, { tone: "lo" }), extra: L(G.circleOf(KNOB, 0.02, 9, P, 64) + ticks, { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-part="pointer" data-free="both" style="stroke-width:1"/>` });
const CANCEL = G.frameOf([63, 30, 22], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
turned("cancel.bezel", CANCEL, [[0, 4.2], [0.8, 4.2]], { tone: "lo" });
turned("cancel", CANCEL, [[0.8, 3.1], [2.6, 3.1], [3, 2.6]], {}, { hit: "cancel", extra: L(G.circleOf(CANCEL, 3, 1.4, P, 32), { tone: "lo" }) });
const BOOT = G.frameAlong([-46, 44, 18], [0, 1, 0]);
turned("cord.boot", BOOT, [[0, 3.2], [2, 3.2], [2.4, 2.6], [9, 1.6]], { tone: "lo" }, { inner: L([4, 5.6, 7.2].map((s) => G.arcOf(BOOT, s, 2.6 - (s - 2.4) * (1 / 6.6), P, { slope: -1 / 6.6 })).join(""), { tone: "faint" }) });
box("plug", [70, 50, 0], [82, 62, 8], { tone: "lo" }, { r: 1.4, steps: 3, bevel: 0.5, inner: L([73, 75, 77, 79].map((x) => seg([x, 50, 8], [x, 62, 8])).join(""), { tone: "faint" }) });
const PB = G.frameAlong([70, 56, 4], [-1, 0, 0]);
turned("plug.boot", PB, [[0, 2.6], [5, 1.6]], { tone: "lo" });
for (const y of [53, 58]) box("prong", [82, y, 3.4], [88, y + 1, 4.6], { tone: "mid" });
const ROUTE = G.fillet([[-46, 53, 18], [-46, 57, 18], [-46, 62, 2.2], [-30, 63, 2.2], [52, 63, 2.2], [60, 56, 4], [65, 56, 4]], 6, 10, { P, tube: 1.1 });
R.route("cord", ROUTE, 1.1, { limp: true });
tubePieces(ROUTE, 1.1, P, { maxLength: 14 }).forEach((piece, i) => R.put({ name: `cord:${i}`, at: piece.mid, svg: tubeSvg(piece, { tone: "lo" }), shapes: [A.tube(piece.points, piece.radii)], route: "cord", chunk: i }));

// ---------- order ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const f2 = (v) => Math.round(v * 100) / 100;
const groups = R.items.map((it) => {
  const mv = it.move.some((v) => v) ? ` data-mv="${k.axisVector(P, it.move).map(f2).join(" ")}"` : "";
  return `<g${mv}${it.hit ? ` data-hit="${it.hit}"` : ""}>${it.svg}</g>`;
});
const svg = k.figureSvg({
  width: W,
  height: H,
  label: "A two-slot chrome pop-up toaster on a bench, with a window cut in its near side and control end. Inside: mica boards wound with zig-zag nichrome element wire, wire guards either side of each slice, the bread carriage on its rail with the return spring, the latch and the bimetal strip that trips it. On the end: the lever in its slot, the browning knob with ticks 1 to 6, the cancel button and the cord leaving through a strain relief to a plug on the bench.",
  body: [...back, ...groups],
});

const CSS = `<style>
.tw-stage{--g:0;--o:0;--w0:#7a1608;--w1:#ff8a2a;--raw:#6f6046;--toast:#2b1608}
.iso[data-theme="light"] .tw-stage{--w0:#b3220e;--w1:#f07a12;--raw:#e7d3a3;--toast:#6a3510}
.tw-stage [data-hit]{cursor:pointer}
.tw-stage{--hc:color-mix(in oklab,var(--w1) calc(var(--o)*100%),var(--w0))}
.tw-wire{stroke:color-mix(in oklab,var(--hc) calc(var(--g)*100%),var(--anatomy-mid))}
.tw-glow{fill:none;stroke:var(--hc);stroke-width:2.6;stroke-linejoin:round;opacity:calc(var(--g)*.55);filter:blur(1.4px)}
.tw-tint{fill:var(--hc);stroke:none;opacity:calc(var(--g)*.2)}
.tw-bi{fill:var(--w0);stroke:none;opacity:calc(var(--h,0)*.5)}
.tw-br{--bc:color-mix(in oklab,var(--toast) calc(var(--b,0)*100%),var(--raw));--anatomy-paper:var(--bc);--anatomy-top:color-mix(in oklab,var(--bc) 88%,white);--anatomy-shade-3:var(--bc);--anatomy-shade-2:color-mix(in oklab,var(--bc) 92%,black);--anatomy-shade-1:color-mix(in oklab,var(--bc) 84%,black);--anatomy-shade-0:color-mix(in oklab,var(--bc) 76%,black)}
.iso-stage:focus{outline:none}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const DATA = { P, REST, DROP, KNOB, ticks: [0, 1, 2, 3, 4, 5].map(tickAt), cancelMove: k.axisVector(P, [-1.4, 0, 0]) };
const live = `
const D = ${JSON.stringify(DATA)};
const P = D.P, stage = document.querySelector(".tw-stage"), $ = (s) => stage.querySelector(s), readout = document.querySelector("[data-readout]");
const movers = [...stage.querySelectorAll("[data-mv]")].map((el) => [el, el.dataset.mv.split(" ").map(Number)]);
const breads = [...stage.querySelectorAll(".tw-br")], spring = $('[data-part="spring"]'), pointer = $('[data-part="pointer"]'), cancelEl = $('[data-hit="cancel"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SPEED = 12, CYCLE = (n) => 90 + 18 * (n - 1);
const ease = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pt = (F, s, r, a) => iso([0, 1, 2].map((i) => F.o[i] + F.a[i] * s + (F.u[i] * Math.cos(a + Math.PI / 2) + F.v[i] * Math.sin(a + Math.PI / 2)) * r), P);
let s = 0, v = 0, latched = false, drag = null, setting = 4, dial = 4, T = 20, brown = 0, fade = 0, elapsed = 0;
let frame = 0, last = 0, visible = false, touched = -1e9, now = 0, tourAt = 2.5, poke = 0;
const fmt = (t) => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
function press() { if (latched) return; latched = true; elapsed = 0; if (brown > 0.02) fade = 1; run(); }
function pop() { if (latched) { latched = false; run(); } }
function helix(z0) {
  const z1 = 88, n = 14 * 24, d = ["", ""];
  let prev = -1;
  for (let i = 0; i <= n; i++) {
    const a = (i / 24) * 2 * Math.PI, f = +(Math.cos(a - Math.PI / 4) > 0), p = iso([42 + 2.6 * Math.cos(a), -24 + 2.6 * Math.sin(a), z0 + ((z1 - z0) * i) / n], P);
    d[f] += (prev === f ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2);
    if (prev !== f && prev >= 0) d[prev] += "L" + p[0].toFixed(2) + " " + p[1].toFixed(2);
    prev = f;
  }
  const e = [iso([44.6, -24, z0], P), iso([44.6, -24, z1], P)];
  return '<path class="iso-line" data-tone="lo" d="' + d[0] + '"/><path class="iso-line" data-tone="mid" d="' + d[1] + '"/>' + e.map((p) => '<circle class="iso-wire-end" r=".8" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '"/>').join("");
}
function draw() {
  for (const [el, [dx, dy]] of movers) el.setAttribute("transform", "translate(" + (dx * s).toFixed(2) + " " + (dy * s).toFixed(2) + ")");
  spring.innerHTML = helix(D.REST + 6 - D.DROP * s);
  const a = D.ticks[0] + (dial - 1) * (D.ticks[1] - D.ticks[0]), p0 = pt(D.KNOB, 6.62, 1.4, a + Math.PI), p1 = pt(D.KNOB, 6.62, 4.8, a);
  pointer.setAttribute("d", "M" + p0.map((x) => x.toFixed(2)).join(" ") + "L" + p1.map((x) => x.toFixed(2)).join(" "));
  cancelEl.setAttribute("transform", "translate(" + D.cancelMove.map((m) => (m * poke).toFixed(2)).join(" ") + ")");
  stage.style.setProperty("--g", ease(400, 640, T).toFixed(3));
  stage.style.setProperty("--o", ease(540, 690, T).toFixed(3));
  stage.style.setProperty("--h", (latched ? Math.min(1, elapsed / CYCLE(setting)) : 0).toFixed(3));
  for (const el of breads) el.style.setProperty("--b", (brown * (1 - fade)).toFixed(3));
  const left = latched ? fmt(Math.max(0, CYCLE(setting) - elapsed)) + " left" : s > 0.3 ? "popping" : "ready";
  const text = "setting " + setting + " · " + Math.round(T) + " °C · " + left;
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(t) {
  const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60, calm = still.matches;
  last = t; now += dt;
  if (!calm && now - touched > 8 && !latched && s < 0.02 && now > tourAt) { setting = (setting % 5) + 2; press(); tourAt = 1e9; }
  const sim = dt * SPEED, on = latched && s > 0.6;
  if (latched && (elapsed += on ? sim : 0) >= CYCLE(setting)) { pop(); tourAt = now + 4; }
  T += ((on ? 650 : 20) - T) * (1 - Math.exp(-sim / (on ? 22 : 50)));
  if (fade > 0) { fade = Math.max(0, fade - dt * 2); if (!fade) brown = 0; }
  else if (on) brown = Math.min(1, brown + (sim * Math.max(0, (T - 120) / 530) ** 2) / 165);
  const goal = drag ? drag.s : latched ? 1 : 0, kk = drag ? 900 : goal > s ? 260 : ${SPRING.stiffness}, c = goal > s || drag ? 2 * Math.sqrt(kk) : ${SPRING.damping};
  if (calm) (s = goal), (v = 0);
  else for (let i = 0; i < 4; i++) { v += (((goal - s) * kk - v * c) * dt) / 4; s += (v * dt) / 4; }
  dial += (setting - dial) * (calm ? 1 : 1 - Math.exp(-dt / 0.12));
  poke = Math.max(0, poke - dt * 4);
  draw();
  const busy = latched || drag || Math.abs(goal - s) > 1e-4 || Math.abs(v) > 1e-4 || T > 21 || fade > 0 || Math.abs(setting - dial) > 1e-3 || poke > 0 || (!calm && tourAt < 1e8);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const touch = () => { touched = now; tourAt = now + 8; run(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" }).observe(stage);
const dropPx = () => (k0 => (k0[1] * stage.querySelector("svg").getBoundingClientRect().height) / ${H})(axisVector(P, [0, 0, -D.DROP]));
stage.addEventListener("pointerdown", (e) => {
  const hit = e.target.closest("[data-hit]")?.dataset.hit;
  touch();
  if (hit === "knob") setting = (setting % 6) + 1;
  if (hit === "cancel") (poke = 1), pop();
  if (hit === "lever" && !latched) { drag = { y: e.clientY, s, px: dropPx() }; stage.setPointerCapture(e.pointerId); }
});
stage.addEventListener("pointermove", (e) => { if (drag) { drag.s = Math.min(1, Math.max(0, (e.clientY - drag.y) / drag.px)); run(); } });
const up = () => { if (drag) { drag = null; press(); } };
stage.addEventListener("pointerup", up);
stage.addEventListener("pointercancel", () => { drag = null; run(); });
stage.addEventListener("keydown", (e) => {
  const key = e.key;
  if (key === " " || key === "Enter") press();
  else if (key === "Escape") (poke = 1), pop();
  else if (key === "ArrowUp" || key === "ArrowRight") setting = Math.min(6, setting + 1);
  else if (key === "ArrowDown" || key === "ArrowLeft") setting = Math.max(1, setting - 1);
  else return;
  e.preventDefault();
  touch();
});
draw();
`;

const body = CSS + k.plateHtml({
  fig: "Fig 4",
  title: "Pop-up toaster",
  hint: "Space or drag the lever · ↑↓ browning · Esc",
  readout: "setting 4 · 20 °C · ready",
  keys: [
    { mark: "lit", label: "Lever and carriage: press to lower the bread and latch it" },
    { mark: "red", label: "Nichrome element: dull red to orange at about 600–700 °C" },
    { mark: "raised", label: "Bread: its colour follows the heat it has taken in" },
  ],
  caption: "A 900 W two-slot toaster with a window cut in its near side. Pressing the lever lowers the carriage, closes the wire guards on the slices and latches; the nichrome wound on the three mica boards heats to about 650 °C and glows from dull red to orange. The browning knob sets the cycle from 1:30 (1) to 3:00 (6); when it ends the bimetal strip trips the latch and the return spring throws the carriage up. Time runs 12× fast here; the readout shows real toaster times.",
  body: `<div class="iso-stage tw-stage" tabindex="0" role="group" aria-label="Toaster. Space presses the lever, up and down arrows set the browning from 1 to 6, Escape cancels.">${svg}</div>`,
});
const name = THEME === "light" ? "toaster-light.html" : "toaster.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Pop-up toaster", theme: THEME, body, script: kitScript() + live }));
console.log("wrote", name, R.items.length, "items");
A.auditOrExit(R, P);
