// Zipper: a #5 metal zipper laid on a display base, its slider cut open to show the Y channel and the diamond.
// node build.mjs [--light]  -> zipper.html / zipper-light.html, and always short.html (light, 9:16, no chrome)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const ZIP_SRC = readFileSync(join(HERE, "zip.js"), "utf8");
import { makeZip } from "./zip.gen.mjs";

// ---------------------------------------------------------------- truth (world units = mm)
// #5 metal zipper: tooth pitch 3 mm per side (interleaved: a tooth every 1.5 mm), chain ~5.6 mm wide, teeth 2.4 mm thick,
// tape 12 mm wide; slider 16 mm long. The slider's Y channel spreads the bead lines 4.2 mm per side at the mouth.
const C = {
  hp: 1.7, dL: 3.2, Y0: 2.4, D: 5.2, a: 6.5, Ls: 17.5, lam: 7, TZ: 1.2, pitch: 3, s0: 1.5, N: 16, red: 5,
  sEnd: 53, sStop: 1.5 + 3 * 15 + 1.5 + 1.7, tapeStart: -10, tapeW: 10, tapeT: 0.5, dW: 1.0, cutX: 4.4,
  PZ: { b0: -2.4, b1: -1.45, lipB: -0.42, lipT: 0.42, t0: 1.45, t1: 2.4, cut: 1.95 },
};
const AZ = 160, EL = 56;
const BASE = { x: -18, y: -24, w: 78, d: 48, r: 4 };
const BZ = -2.4, BH = 4, FOOT = 2;
const WIDTH = 400;
const fitPts = [...k.boxCorners(BASE, BZ - BH - FOOT, BZ), [-9, 12, 6.5], [-9, -12, 6.5]];
let P = k.fitProjection(fitPts, WIDTH, 2000, { pad: 8, azimuth: AZ, elevation: EL });
const ys = fitPts.map((p) => k.iso(p, P)[1]);
const HEIGHT = Math.ceil(Math.max(...ys) - Math.min(...ys) + 16);
P = { ...P, origin: [P.origin[0], P.origin[1] - Math.min(...ys) + 8] };

const K = { iso: k.iso, depthOf: k.depthOf, extrude: k.extrude, solidSvg: k.solidSvg, lineSvg: k.lineSvg, translateAlong: k.translateAlong };
const Z = makeZip(K, P, C);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// slider travel: bottom = against the bottom stop's teeth, top = mouth against the top stops
const X_BOT = 1.5;
let X_TOP = 40;
for (let X = 5; X < 60; X += 0.01) { if (Z.frameAt(C.sStop, X, 1).xi < Z.mouthX + 1.15) { X_TOP = +(X - 0.01).toFixed(2); break; } }

// ---------------------------------------------------------------- base and clamp (static)
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, BZ - BH - FOOT, BH, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 7))) {
    out.push(S(k.cylinder(x, y, 3.6, BZ - BH - FOOT, FOOT, P, 28), { tone: "lo" }));
  }
  out.push(S(k.slabOf(BASE, BZ - BH, BH, P, 8, 0.8), { tone: "mid", inner: L(k.sideSeam(BASE, BZ - BH + 1.2, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 2.6), BZ, P), { tone: "lo" }));
  const screws = k.corners(BASE, 5.2);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.1, BZ, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, BZ])), { size: 0.55 }));
  // ruler strip along the near long edge: 1 mm ticks, every 5th long
  const strip = { x: -6, y: 20.2, w: 62, d: 2.4, r: 0.5 };
  out.push(S(k.slabOf(strip, BZ, 0.35, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 1, strip.x + strip.w - 1, 1, 5, strip.y, BZ + 0.35, [0.9, strip.d], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // label plate on the far side
  const label = { x: 32, y: -22.4, w: 20, d: 5.4, r: 0.8 };
  out.push(S(k.slabOf(label, BZ, 0.4, P, 4, 0.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(label, 0.8), BZ + 0.4, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 3, label.y + 1.8 + i * 1.4], [label.x + 17 - i * 3, label.y + 1.8 + i * 1.4], BZ + 0.4, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 1.4, label.y + 1.4, BZ + 0.4]), at([label.x + label.w - 1.4, label.y + label.d - 1.4, BZ + 0.4])], { size: 0.4 }));
  // the clamp's lower jaw, under the tapes
  out.push(S(k.slabOf(JAW, BZ, -C.tapeT / 2 - BZ, P, 4, 0.3), { tone: "hi", className: "m-blue" }));
  return out.join("");
}
const JAW = { x: -14, y: -14.5, w: 8, d: 29, r: 1 };
function clampTop() {
  const out = [];
  const z0 = C.tapeT / 2, h = 2.4;
  out.push(S(k.slabOf(JAW, z0, h, P, 4, 0.4), { tone: "hi", className: "m-blue", inner: L(k.planOutline(k.insetPlan(JAW, 1.2), z0 + h, P, 4), { tone: "lo" }) }));
  for (const y of [-10, 10]) {
    const x = -10;
    out.push(S(k.cylinder(x, y, 1.3, z0 + h, 1.0, P, 20), { tone: "hi", className: "m-steel" }));
    out.push(S(k.cylinder(x, y, 2.3, z0 + h + 1.0, 2.0, P, 32, 0.25), { tone: "hi", className: "m-steel", crease: "none", inner: L(k.knurl(x, y, 2.3, z0 + h + 1.0, z0 + h + 3.0, 22, P), { tone: "lo" }) }));
    out.push(L(k.ring(x, y, 1.1, z0 + h + 3.0, P, 20), { tone: "lo" }));
  }
  out.push(D([at([-12.2, 0, z0 + h]), at([-7.8, 0, z0 + h])], { size: 0.5, tone: "hi" }));
  return out.join("");
}
function bottomStop() {
  const ring = [[-3.6, -3.5], [-0.45, -3.5], [-0.45, 3.5], [-3.6, 3.5]];
  const z = 1.3;
  const lines = [-2.6, -1.5].map((x) => k.segment([x, -3.5, z], [x, 3.5, z], P)).join("");
  return S(k.extrude(ring, -z, 2 * z, P), { tone: "hi", className: "m-brass", inner: L(lines, { tone: "lo" }) });
}

// ---------------------------------------------------------------- tour (24 s)
const SEG = [];
let tt = 0.25;
const push = (dur, x1, e = "s", hold = 0) => { const x0 = SEG.length ? SEG[SEG.length - 1].x1 : X_BOT; SEG.push({ t0: +tt.toFixed(3), t1: +(tt + dur).toFixed(3), x0, x1, e }); tt += dur + hold; };
push(1.2, X_TOP, "c", 0.6);           // hook: a fast zip up
push(1.6, X_BOT, "c", 0.55);          // unzip
const slowStart = tt;
const SLOW = [];
const redS = Z.TEETH.filter((t) => t.red).map((t) => t.s);
for (let n = 0; n < 12; n++) {
  const sN = Math.ceil((X_BOT + C.a + 0.2) / 1.5) * 1.5 + 1.5 * n;
  const red = redS.some((s) => Math.abs(s - sN) < 0.01);
  const target = sN - C.a + 0.14;
  SLOW.push({ n, red, t: tt, s: sN });
  push(red ? 1.0 : 0.5, +target.toFixed(3), "s", red ? 1.05 : 0.22);
}
tt += 0.3;
push(2.3, X_BOT, "s", 0.4);           // unzip again: the diamond prises the teeth apart
push(1.35, X_TOP, "c", 0);            // fast zip to the top stops
const TOUR_END = tt;

// events: a tooth locks (or unlocks) when it crosses the end of the Y, xi = a
function eventsOf() {
  const ev = [];
  const sList = Z.TEETH.map((t) => ({ s: t.s, red: t.red }));
  let prev = Z.Xat(0, SEG);
  const inSlow = (t) => t >= slowStart && t < SLOW[SLOW.length - 1].t + 2.0;
  for (let i = 1; i <= 24000; i++) {
    const t = i / 1000, X = Z.Xat(t, SEG);
    for (const q of sList) {
      const th = q.s - C.a;
      if (prev < th && X >= th) ev.push({ t, type: inSlow(t) ? "click" : "tick", i: q.red ? 1 : inSlow(t) ? 0.65 : 0.75, lock: true });
      else if (prev >= th && X < th) ev.push({ t, type: "tick", i: 0.5 });
    }
    prev = X;
  }
  const heavy = [];
  for (const sg of SEG) {
    const d = sg.x1 - sg.x0;
    if (Math.abs(d) < 5) continue;
    heavy.push({ t: sg.t0, type: d > 0 ? "whoosh" : "slide", i: d > 0 ? 0.8 : 0.7 });
    heavy.push({ t: sg.t1, type: "thunk", i: d > 0 ? 1 : 0.5 });
  }
  // keep heavy ones; thin ticks/clicks to >= 0.15 s from each other and from heavy ones
  const out = [...heavy];
  ev.sort((p, q) => p.t - q.t);
  for (const e of ev) {
    if (out.some((o) => Math.abs(o.t - e.t) < 0.15 && !(e.i === 1 && o.type !== "thunk"))) continue;
    out.push({ t: e.t, type: e.type, i: e.i });
  }
  return out.sort((p, q) => p.t - q.t).map((e) => ({ t: +e.t.toFixed(3), type: e.type, i: e.i }));
}
const EVENTS = eventsOf();

// ---------------------------------------------------------------- clearance check: teeth vs the diamond and the lips
{
  const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const dia = Z.diamondRing();
  let worst = 0, where = null;
  for (let s = 0; s < 40; s += 0.05) for (const sg of [-1, 1]) {
    const F = Z.frameAt(s, 0, sg);
    for (const [u, v] of Z.TOOTH) { const p = Z.onFrame(F, u, v); if (inPoly(p, dia)) { const d = Math.abs(p[1]); if (!where || 1) { worst++; where = [s.toFixed(2), F.xi.toFixed(2), p.map((q) => q.toFixed(2))]; } } }
  }
  console.log("tooth vertices inside the diamond:", worst, where || "");
}
// ---------------------------------------------------------------- assemble
const SL = Z.sliderParts();
const f0 = Z.frame(X_BOT, SL);
const body = [
  `<g class="zp-jig">${base()}</g>`,
  `<g data-part="sl-bottom" transform="${f0.tr}">${SL.bottom}</g>`,
  `<g data-part="tapes">${f0.tapes}</g>`,
  `<g data-part="beyond">${f0.beyond}</g>`,
  `<g data-part="sl-far" transform="${f0.tr}">${SL.far}</g>`,
  `<g data-part="inside">${f0.inside}</g>`,
  `<g data-part="sl-near" transform="${f0.tr}">${SL.near}</g>`,
  bottomStop(),
  `<g class="zp-jig">${clampTop()}</g>`,
];
const LABEL = "A metal zipper lies on a display base, its closed end clamped. The slider is cut open across the top: two lips form a Y-shaped channel around a wedge (the diamond) at the mouth. Moving the slider up bends the two tapes in at an angle so each tooth's head drops into the gap between two opposite teeth, left, right, left; pulling it back, the diamond pries them apart. One tooth pair is red.";

const MATS = {
  steel: ["#8e98a3", "#a9b2bc", "#c3cad2", "#d9dee4", "#eef1f4", "#3b4148", "#7d8791"],
  brass: ["#b5841f", "#c99430", "#d9a441", "#e6b95e", "#f7e0a0", "#4f3700", "#9c7419"],
  blue: ["#46688f", "#52749c", "#5b7fa6", "#6d8eb5", "#a3bbd6", "#1f3550", "#89a5c6"],
  rib: ["#1f7774", "#278985", "#2f9e9a", "#47b2ad", "#8fd6d1", "#0a3533", "#196563"],
  cord: ["#17605d", "#1d6f6c", "#257f7b", "#2f908b", "#5fbab4", "#0a3533", "#196563"],
  orange: ["#c95f1a", "#dc7026", "#e8823a", "#f39a55", "#ffd0a3", "#5a2405", "#b0561a"],
  accent: ["#a82a24", "#bf352e", "#d6453d", "#e45f57", "#f6a39c", "#470c08", "#8c241f"],
};
const MAT_CSS = Object.entries(MATS).map(([n, c]) => [0, 1, 2, 3].map((i) => `.iso-solid.m-${n}>.iso-shade[data-shade="${i}"]{fill:${c[i]};stroke:${c[i]}}`).join("") +
  `.iso-solid.m-${n}>.iso-top{fill:${c[4]};stroke:${c[4]}}.iso-solid.m-${n}>.iso-fill{fill:${c[2]}}.iso-solid.m-${n}>.iso-edge{stroke:${c[5]}}.iso-solid.m-${n}>.iso-line:not(.iso-edge){stroke:${c[6]}}`).join("\n");
const CREAM = `
.iso[data-theme="light"]{--anatomy-page:#f5f1e8;--anatomy-card:#fbf8f2;--anatomy-paper:#fbf8f2;--anatomy-face:#fffdf9;--anatomy-top:#fffdf8;
 --anatomy-shade-0:#e2dccf;--anatomy-shade-1:#eae5da;--anatomy-shade-2:#f1ede4;--anatomy-shade-3:#f7f4ed;
 --anatomy-hi:#2a2723;--anatomy-mid:#8b8579;--anatomy-lo:#b8b1a4;--anatomy-faint:#d8d2c5;--anatomy-halo:#8a7f6a;--anatomy-dot:#3a3631}
.iso-solid[class*=" m-"]:not([data-seamless])>.iso-shade,.iso-solid[class*=" m-"]:not([data-seamless])>.iso-top{stroke:none}
.zp-jig{--anatomy-top:#e6eef8;--anatomy-face:#edf3fa;--anatomy-paper:#e6eef8;--anatomy-shade-3:#cfdeef;--anatomy-shade-2:#b9cde6;--anatomy-shade-1:#a3bddc;--anatomy-shade-0:#89a8cf;--anatomy-hi:#1f3550;--anatomy-mid:#4f6f96;--anatomy-lo:#7f9cc2;--anatomy-faint:#a9c0dc;--anatomy-dot:#1f3550}
.iso-solid>path.cp-cut{fill:var(--cp-cut,#eef4fb);stroke:var(--cp-cut,#eef4fb);stroke-width:.4px}
.iso-solid>.iso-line.cp-hatch{stroke:var(--cp-hatch,#8eaad0)!important;stroke-width:.45px}
.iso-solid.m-orange{--cp-cut:#fde3c8;--cp-hatch:#cf7a3c}
` + MAT_CSS;

// ---------------------------------------------------------------- live code (shared by both pages)
const LIVE_CORE = `
${ZIP_SRC}
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const K = { iso, depthOf, extrude, solidSvg, lineSvg, translateAlong };
const Z = makeZip(K, P, C);
const SEG = ${JSON.stringify(SEG)};
const TOUR_END = ${TOUR_END.toFixed(3)};
const svg = document.querySelector("svg.iso-svg");
const part = (n) => svg.querySelector('[data-part="' + n + '"]');
const G_ = { b: part("sl-bottom"), tapes: part("tapes"), beyond: part("beyond"), far: part("sl-far"), inside: part("inside"), near: part("sl-near") };
const SL = { diamond: ${JSON.stringify(SL.diamond)}, lips: ${JSON.stringify(SL.lips)} };
let lastX = NaN;
function render(X) {
  const q = Math.round(X * 400) / 400;
  if (q === lastX) return;
  lastX = q;
  const f = Z.frame(q, SL);
  G_.tapes.innerHTML = f.tapes; G_.beyond.innerHTML = f.beyond; G_.inside.innerHTML = f.inside;
  for (const g of [G_.b, G_.far, G_.near]) g.setAttribute("transform", f.tr);
}
`;

const LIVE_SHORT = LIVE_CORE + `
const LEAD = 0.2 + 1 / 60;
window.__events = ${JSON.stringify(EVENTS)};
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const t0 = performance.now();
function frame(now) {
  holdClock();
  const T = Math.max(0, (now - t0) / 1000 - LEAD);
  window.__T = T;
  render(Z.Xat(T, SEG));
  requestAnimationFrame(frame);
}
render(Z.Xat(0, SEG));
requestAnimationFrame(frame);
`;

const LIVE_FIG = LIVE_CORE + `
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let clock = 0, last = 0, raf = 0, visible = false;
const LOOP = 24;
function say(X) {
  const locked = Z.TEETH.filter((t) => t.s - C.a <= X).length;
  const text = "slider at " + X.toFixed(1) + " mm · " + locked + " of " + Z.TEETH.length + " teeth locked";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now; clock = (clock + dt) % LOOP;
  const X = Z.Xat(clock, SEG);
  render(X); say(X);
  raf = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", () => { clock = clock < 4.2 ? 4.2 : clock; run(); });
render(${X_BOT}); say(${X_BOT});
`;

const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body });
const fig = k.plateHtml({
  fig: "Fig 1",
  title: "Zipper",
  hint: "Click to jump to the slow zip",
  readout: "slider at 1.5 mm",
  keys: [
    { mark: "lit", label: "One tooth pair: watch it lock in the Y" },
    { mark: "raised", label: "Slider cut open: lips, Y channel and the diamond" },
  ],
  caption: "A #5 metal zipper: teeth every 3 mm on each tape, offset half a pitch so they alternate left, right. The slider's Y channel bends both tapes in at an angle, which opens the gaps between neighbouring teeth just enough for each opposite head to drop in; straightened again in the slider's tail, the necks close around the heads and the chain locks. Pulled back, the diamond in the mouth pries the heads out one by one.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Zipper">${svg}</div>`,
});
const figName = theme === "light" ? "zipper-light.html" : "zipper.html";
writeFileSync(join(HERE, figName), k.pageHtml({ title: "Zipper", theme, body: fig, script: kitScript() + LIVE_FIG, width: 560 }).replace("</style>", CREAM + "</style>"));

const SHORT_CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:var(--anatomy-paper)}
.short{position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 60%,#fdfbf6 0%,var(--anatomy-paper) 55%,#f3eee3 100%)}
.short .iso-svg{position:absolute;left:4vw;width:92vw;top:var(--top,24vh);height:auto;overflow:visible}
`;
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zipper short</title><style>${k.ISO_CSS}${CREAM}${SHORT_CSS}</style></head><body class="iso" data-theme="light"><div class="short">${svg}</div><script type="module">${(kitScript() + LIVE_SHORT).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.preview.json"), JSON.stringify(EVENTS, null, 1));
console.log("wrote", figName, "short.html; viewBox", WIDTH, HEIGHT, "X_TOP", X_TOP, "tour ends", TOUR_END.toFixed(2), "events", EVENTS.length, "slow red at", SLOW.filter((s) => s.red).map((s) => s.t.toFixed(2)).join(","));

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['zipper-light.html', 'zipper.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
