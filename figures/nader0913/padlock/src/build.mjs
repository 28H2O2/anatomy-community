// Three-wheel combination padlock in cutaway. node build.mjs -> padlock-light.html (figure card) and short.html (9:16)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { mPrism, mItems, mSvg, mHatch, mArc } from "./engine.mjs";
import { PL, plState, plEvents } from "./model.mjs";
import { plFrame } from "./draw.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (f) => readFileSync(join(HERE, f), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const { AX, AY, SX, BX0, BX1, BY0, BY1, BZ1, BR, FLOOR, SLAB, BACKY } = PL;

const BASE = { x: -24, y: -14, w: 48, d: 33, r: 3.5 };
const BASE_H = 3, FOOT_H = 1.6;
const fitPoints = [
  ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
  [AX, AY, PL.LEG_TOP + PL.ARC_R + PL.LIFT + 2.6], [0, AY, PL.LEG_TOP + PL.ARC_R + PL.LIFT + 2.6], [SX, AY, PL.LEG_TOP + PL.LIFT + 2.6],
  [AX + 16 + 2.6, AY, PL.LEG_TOP + PL.LIFT + 2.6], [AX + 18.6, AY, BZ1 + 1], [AX + 8, AY + 8, PL.LEG_TOP + PL.ARC_R + PL.LIFT + 2.6],
];
const ZF = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
const arc = (cx, cy, r, a0, a1, n) => mArc(cx, cy, r, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180, n);

function scene(P, opt = { base: true }) {
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (pts, style) => k.dotsSvg(pts, style);
  const at = (p) => k.iso(p, P);
  const parts = {};
  // ---- display base: plate on feet, corner screws, ruler, label plate
  {
    const o = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
    const feet = k.corners(BASE, 5).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
    for (const [x, y] of feet) o.push(S(k.cylinder(x, y, 3, -BASE_H - FOOT_H, FOOT_H, P, 24), { tone: "lo" }));
    o.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 0.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 1.1, P, 8), { tone: "faint" }) }));
    o.push(L(k.planOutline(k.insetPlan(BASE, 2), 0, P), { tone: "faint" }));
    const screws = k.corners(BASE, 3.6);
    o.push(L(screws.map(([x, y]) => k.ring(x, y, 1.1, 0, P, 16)).join(""), { tone: "lo" }));
    o.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
    // ruler strip along the right edge: 1 mm ticks
    const strip = { x: 18.5, y: -9, w: 3.4, d: 20, r: 0.5 };
    o.push(S(k.slabOf(strip, 0, 0.4, P, 2), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(-7, 9, 1, 5, strip.x + 0.4, 0.4, [0.8, 1.5], P, "y");
    o.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid", free: "end" }));
    o.push(L(k.lineOnTop([strip.x + 0.4, -7], [strip.x + 0.4, 9], 0.4, P), { tone: "lo" }));
    // label plate front-left
    const label = { x: -20, y: 9.6, w: 12, d: 7, r: 0.8 };
    o.push(S(k.slabOf(label, 0, 0.4, P, 3), { tone: "lo", crease: "none" }));
    for (const [i, yy] of [11.4, 13.1, 14.8].entries()) o.push(L(k.lineOnTop([label.x + 2, yy], [label.x + label.w - (i === 2 ? 5 : 2), yy], 0.4, P), { tone: "lo", free: true }));
    o.push(D([[label.x + 1.1, label.y + 1.1], [label.x + label.w - 1.1, label.y + label.d - 1.1]].map(([x, y]) => at([x, y, 0.4])), { size: 0.45 }));
    // soft shadow under the lock body
    o.push(`<path class="iso-halo" d="${k.haloOf({ x: BX0, y: BY0, w: BX1 - BX0, d: BY1 - BY0, r: BR }, 0, 2, P)}" style="filter:blur(3px)"/>`);
    parts.base = opt.base ? `<g class="pl-base">${o.join("")}</g>` : `<path class="iso-halo" d="${k.haloOf({ x: BX0, y: BY0, w: BX1 - BX0, d: BY1 - BY0, r: BR }, 0, 2, P)}" style="filter:blur(2px)"/>`;
  }
  // ---- body (steel-blue), cut open on the right: front and end walls of the wheel chamber removed
  {
    const left = [[0, BY0], ...arc(-12, -3.5, BR, -90, -180, 10), ...arc(-12, 3.5, BR, 180, 90, 10), [0, BY1]];
    const right = [[0, BY1], ...arc(12, 3.5, BR, 90, 0, 10), ...arc(12, -3.5, BR, 0, -90, 10), [0, BY0]];
    const aEnd = (Math.asin((BACKY + 3.5) / BR) * 180) / Math.PI;
    const back = [[0, BACKY], [0, BY0], ...arc(12, -3.5, BR, -90, aEnd, 6)];
    const lb = mPrism([left], ZF, 0, BZ1, { tone: "hi" });
    const cutFace = lb.faces.find((f) => f.n[0] > 0.99);
    cutFace.fill = "cut"; cutFace.lineTone = "lo";
    cutFace.lines = mHatch([[[BY0, 0], [BY1, 0], [BY1, BZ1], [BY0, BZ1]]], Math.PI / 4, 0.95, 0.2).map(([a, b]) => [[0, a[0], a[1]], [0, b[0], b[1]]]);
    const bw = mPrism([back], ZF, FLOOR, SLAB, { tone: "hi" });
    const bs = mPrism([right], ZF, 0, FLOOR, { tone: "hi" });
    const ts = mPrism([right], ZF, SLAB, BZ1, { tone: "hi" });
    const end = ts.faces.filter((f) => f.n[0] > 0.2 && Math.abs(f.n[2]) < 0.5);
    void end;
    const it = (m) => mSvg(mItems(m, P)[0]);
    // nameplate recess and four rivets on the left block's front face
    const y = BY1, nx0 = -13, nx1 = -3, nz0 = 15, nz1 = 31;
    const fr = (x, z) => at([x, y, z]);
    const plateD = k.pathOf([fr(nx0, nz0), fr(nx1, nz0), fr(nx1, nz1), fr(nx0, nz1)], true);
    const rules = [0, 1, 2].map((i) => k.pathOf([fr(nx0 + 2, nz1 - 4 - i * 3.2), fr(nx1 - (i === 2 ? 4 : 2), nz1 - 4 - i * 3.2)])).join("");
    const riv = [[-13.5, 4], [-2.5, 4], [-13.5, 40], [-2.5, 40]].map(([x, z]) => [x, y, z]);
    const lbDeco = `<path class="iso-line" data-tone="mid" d="${plateD}"/>${L(rules, { tone: "lo", free: true })}${L(riv.map((p) => k.sideRing(p, 0.9, "y", P, 18)).join(""), { tone: "mid" })}${D(riv.map(at), { size: 0.5, tone: "mid" })}`;
    // short-leg bore and two screws on the left block top
    const hole = (x) => `<path class="pl-hole" d="${k.pathOf(Array.from({ length: 32 }, (_, i) => at([x + 2.9 * Math.cos(i * Math.PI / 16), AY + 2.9 * Math.sin(i * Math.PI / 16), BZ1])), true)}"/>`;
    const lbTop = `${hole(SX)}${L(k.ring(SX, AY, 2.9, BZ1, P, 32), { tone: "mid" })}${L(k.ring(-12.5, -4.2, 0.9, BZ1, P, 14), { tone: "lo" })}${D([at([-12.5, -4.2, BZ1])], { size: 0.5, tone: "mid" })}`;
    const tsTop = `${hole(AX)}${L(k.ring(AX, AY, 2.9, BZ1, P, 32), { tone: "mid" })}${L([[3, -4.6], [13.5, -4.6]].map(([x, yy]) => k.ring(x, yy, 0.9, BZ1, P, 14)).join(""), { tone: "lo" })}${D([[3, -4.6], [13.5, -4.6]].map(([x, yy]) => at([x, yy, BZ1])), { size: 0.5, tone: "mid" })}`;
    parts.bodyBack = `<g class="pl-steel">${it(lb)}${lbDeco}${lbTop}${it(bw)}${it(bs)}${L(k.ring(AX, AY, 2.9, FLOOR, P, 28), { tone: "mid" })}</g>`;
    parts.bodyTop = `<g class="pl-steel">${it(ts)}${tsTop}</g>`;
  }
  return parts;
}

function svgFor(P, width, height, label) {
  const p = scene(P);
  const f = plFrame(P, plState(0));
  const body = [
    `<g data-part="root">`, p.base, p.bodyBack,
    `<g data-part="stack">${f.stack}</g>`,
    p.bodyTop,
    `<g data-part="shackle">${f.shackle}</g>`,
    `</g>`,
  ];
  return k.figureSvg({ width, height, label, body });
}

const HEAT_VARS = ["top", "s3", "s2", "s1", "s0", "hi", "mid", "lo", "faint", "cut", "hatch"];
const HEAT_ORANGE = ["#fbd3ae", "#f6b57e", "#f09c5a", "#e8823a", "#c96a26", "#4f2304", "#a2531a", "#e19a62", "#f3c39a", "#fde6d1", "#e9a06a"];
const HEAT_RED = ["#f7bdb7", "#ee8b84", "#e3655d", "#d6453d", "#ad2f28", "#4a0d0a", "#9e2a24", "#e07a73", "#f0aca6", "#fbdcd9", "#e58a83"];
const HEAT_PROP = { top: "--anatomy-top", s3: "--anatomy-shade-3", s2: "--anatomy-shade-2", s1: "--anatomy-shade-1", s0: "--anatomy-shade-0", hi: "--anatomy-hi", mid: "--anatomy-mid", lo: "--anatomy-lo", faint: "--anatomy-faint", cut: "--lk-cut" };
const HEAT_CSS = [0, 1, 2].map((i) => `.pl-w${i}{${HEAT_VARS.filter((v) => v !== "hatch").map((v, j) => `${HEAT_PROP[v]}:var(--w${i}-${v},${HEAT_ORANGE[j]})`).join(";")};--anatomy-paper:var(--w${i}-top,#fbd3ae)}.pl-w${i} .lk-cut~.iso-line[data-tone="lo"]{stroke:var(--w${i}-hatch,#e9a06a)}`).join("\n");
const MATERIALS = `
.lk-f{stroke-width:.45px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.lk-f[data-shade="0"]{stroke:var(--anatomy-shade-0)}.lk-f[data-shade="1"]{stroke:var(--anatomy-shade-1)}.lk-f[data-shade="2"]{stroke:var(--anatomy-shade-2)}.lk-f[data-shade="3"]{stroke:var(--anatomy-shade-3)}.iso-top.lk-f{stroke:var(--anatomy-top)}
.lk-cut{fill:var(--lk-cut);stroke:var(--lk-cut)}
.lk-f.lk-ho{stroke:none}
.pl-hole{fill:#46658c;stroke:none}
.pl-base{--anatomy-top:#fbf6ec;--anatomy-shade-3:#f2e9d8;--anatomy-shade-2:#e9ddc7;--anatomy-shade-1:#ddcdb2;--anatomy-shade-0:#cbb797;--anatomy-hi:#4a3c2a;--anatomy-mid:#a8957a;--anatomy-lo:#cbb99d;--anatomy-faint:#e6d9c4;--anatomy-paper:#fbf6ec}
.pl-steel{--anatomy-top:#cddbeb;--anatomy-shade-3:#adc3dc;--anatomy-shade-2:#90aacc;--anatomy-shade-1:#7693ba;--anatomy-shade-0:#5b7fa6;--anatomy-hi:#1c3048;--anatomy-mid:#3f5f86;--anatomy-lo:#6f8db3;--anatomy-faint:#9fb6d2;--anatomy-paper:#cddbeb;--lk-cut:#e2eaf4}
.pl-steel .lk-cut~.iso-line[data-tone="lo"]{stroke:#7f9cc0}
.pl-wheel{--anatomy-top:#fbd3ae;--anatomy-shade-3:#f6b57e;--anatomy-shade-2:#f09c5a;--anatomy-shade-1:#e8823a;--anatomy-shade-0:#c96a26;--anatomy-hi:#4f2304;--anatomy-mid:#a2531a;--anatomy-lo:#e19a62;--anatomy-faint:#f3c39a;--anatomy-paper:#fbd3ae;--lk-cut:#fde6d1}
.pl-wheel .lk-cut~.iso-line[data-tone="lo"]{stroke:#e9a06a}
.pl-brass{--anatomy-top:#f8e4a8;--anatomy-shade-3:#f0cf76;--anatomy-shade-2:#e6bb58;--anatomy-shade-1:#d9a441;--anatomy-shade-0:#b9862a;--anatomy-hi:#553c00;--anatomy-mid:#9c7419;--anatomy-lo:#c9a145;--anatomy-faint:#e5c977;--lk-cut:#fbefc9}
.pl-brass .lk-cut~.iso-line[data-tone="lo"]{stroke:#d3ad55}
.pl-grey{--anatomy-top:#f2f4f6;--anatomy-shade-3:#dde1e6;--anatomy-shade-2:#c8ced5;--anatomy-shade-1:#b1b9c2;--anatomy-shade-0:#959ea9;--anatomy-hi:#22282f;--anatomy-mid:#68717c;--anatomy-lo:#9aa2ac;--anatomy-faint:#c9cfd6;--lk-cut:#f4f6f8}
.pl-grey .lk-cut~.iso-line[data-tone="lo"]{stroke:#a3abb4}
.pl-teal{--anatomy-top:#bfe5e2;--anatomy-shade-3:#90d0cb;--anatomy-shade-2:#62bab5;--anatomy-shade-1:#40a8a3;--anatomy-shade-0:#2f8e8a;--anatomy-hi:#0b3a38;--anatomy-mid:#1f6e6a;--anatomy-lo:#5db1ac;--anatomy-faint:#9fd6d2}
.pl-red{--anatomy-shade-0:#a82a24;--anatomy-shade-1:#bf352e;--anatomy-shade-2:#d6453d;--anatomy-shade-3:#e45f57;--anatomy-top:#f6a39c}
.pl-wire-back{fill:none;stroke:#9aa3ad;stroke-width:1.1px;stroke-linecap:round;vector-effect:non-scaling-stroke}
.pl-wire{fill:none;stroke:#555e69;stroke-width:2.4px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.pl-wire-hi{fill:none;stroke:#e9edf1;stroke-width:0.8px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.iso[data-theme="light"]{--anatomy-weight:.7px}
.pl-gate{--anatomy-shade-0:#5e4410;--anatomy-shade-1:#6e5016;--anatomy-shade-2:#7d5c1c;--anatomy-shade-3:#8c6a24;--anatomy-top:#9c7a30}
.pl-guide-line{fill:none;stroke:#1c3048;stroke-width:1.3px;stroke-opacity:.8;vector-effect:non-scaling-stroke}
.pl-guide .iso-dots circle{fill:#1c3048}
${HEAT_CSS}
`;

const live = (P, short) => `
const P = ${JSON.stringify(P)};
const SHORT = ${short};
const svg = document.querySelector("svg.iso-svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const G_ = { stack: q("stack"), shackle: q("shackle") };
const readout = document.querySelector("[data-readout]");
window.__events = plEvents();
let lastKey = "";
function draw(t) {
  const s = plState(t);
  const key = s.d.map((v) => v.toFixed(4)).join(",") + "|" + s.lift.toFixed(4) + "|" + s.psi.toFixed(3);
  if (key !== lastKey) { lastKey = key; const f = plFrame(P, s); G_.stack.innerHTML = f.stack; G_.shackle.innerHTML = f.shackle; }
  if (readout) {
    const dg = s.d.map((v) => ((Math.round(v) % 10) + 10) % 10).join(" ");
    const n = s.aligned.reduce((a, b) => a + b, 0);
    const text = "dial " + dg + " · " + n + "/3 gates in line · " + (s.lift > 1 ? "shackle up " + s.lift.toFixed(1) + " mm" : "locked");
    if (readout.textContent !== text) readout.textContent = text;
  }
}
if (SHORT) {
  const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
  holdClock();
  const t0 = performance.now();
  const frame = (now) => { holdClock(); const T = Math.max(0, now / 1000 - 0.5); /* tour time = page time - 0.5 s: the recorder's first frame lands at page time ~0.517 s */ window.__T = T; draw(Math.min(T, ${PL_TOUR_END})); requestAnimationFrame(frame); };
  draw(0); window.__T = 0;
  requestAnimationFrame(frame);
} else {
  const freeze = /t=([\\d.]+)/.exec(location.hash);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t0 = null, paused = false, pauseAt = 0;
  const tick = (now) => { if (t0 === null) t0 = now; if (!paused) draw(((now - t0) / 1000) % 24); requestAnimationFrame(tick); };
  if (freeze) draw(+freeze[1]); else if (still) draw(21.5); else requestAnimationFrame(tick);
  const stage = document.querySelector(".iso-stage");
  stage.addEventListener("click", () => { paused = !paused; if (!paused) t0 = performance.now() - pauseAt * 1000; else pauseAt = ((performance.now() - t0) / 1000) % 24; });
  stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); stage.click(); } });
}
`;
const PL_TOUR_END = 24;
const SCRIPT = (P, short) => kitScript() + strip("engine.mjs") + strip("model.mjs") + "const k = { iso, pathOf, solidSvg, cylinder, lineSvg, dotsSvg };\n" + strip("draw.mjs") + live(P, short);
const LABEL = "A three-wheel combination padlock cut open on a display base. The long leg of the shackle runs down through three thumbwheels; each wheel carries a brass sleeve with one gate, and the leg carries one lug under each sleeve. Wrong digits: the lugs hit the sleeves and the shackle stays shut. Dialled to the combination, all three gates line up over the lugs, a spring throws the shackle up 6.4 mm and it swings open.";

{
  const W = 600, H = 760;
  const fbox = { x: 50, y: 30, w: 500, h: 700 };
  const P0 = k.fitProjection(fitPoints, fbox.w, fbox.h, { pad: 0, azimuth: PL.AZ, elevation: PL.EL });
  const P = { ...P0, origin: [P0.origin[0] + fbox.x, P0.origin[1] + fbox.y] };
  const body = k.plateHtml({
    fig: "Fig 1", title: "Combination padlock", hint: "Click to pause the tour", readout: "dial 9 3 3 · 0/3 gates in line · locked",
    keys: [{ mark: "red", label: "Gates: one slot per wheel sleeve; all three must face the lugs" }, { mark: "raised", label: "Thumbwheels (orange) turn 36° per digit on the shackle leg (teal)" }],
    caption: "Three wheels of ten digits give 1000 combinations. Each wheel turns in 36° detents and carries a brass sleeve with one gate; the shackle's long leg has a lug under each sleeve. With any wheel off its digit the lugs strike the sleeves after 1.2 mm. At 2-7-5 the three gates line up, the spring lifts the shackle 6.4 mm, the short leg (4 mm deep) clears the body and the shackle swivels on its long leg.",
    body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Combination padlock tour">${svgFor(P, W, H, LABEL)}</div>`,
  });
  const html = k.pageHtml({ title: "Combination padlock", theme: "light", body, script: SCRIPT(P, false), width: 640 }).replace("</style>", MATERIALS + "</style>");
  writeFileSync(join(HERE, "padlock-light.html"), html);
}
{
  // ---- the short: 9:16, two views of one model. Top: the whole lock (context). Bottom: a 4.6x cutaway of the wheel stack.
  const W = 400, H = 711;
  const topPts = [
    ...k.boxCorners({ x: BX0, y: BY0, w: BX1 - BX0, d: BY1 - BY0, r: BR }, 0, BZ1),
    [AX, AY, PL.LEG_TOP + PL.ARC_R + PL.LIFT + 2.6], [0, AY, PL.LEG_TOP + PL.ARC_R + PL.LIFT + 2.6], [SX, AY, PL.LEG_TOP + PL.LIFT + 2.6],
  ];
  const tbox = { x: 40, y: 159, w: 320, h: 174 };
  const T0p = k.fitProjection(topPts, tbox.w, tbox.h, { pad: 0, azimuth: PL.AZ, elevation: PL.EL });
  const P = { ...T0p, origin: [T0p.origin[0] + tbox.x, T0p.origin[1] + tbox.y] };
  // detail window
  const F = { x: 14, y: 348, w: 372, h: 350, r: 20 };
  const dPts = [];
  for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12; for (const z of [PL.CELL0 - 0.2, PL.CELL0 + 2 * PL.PITCH + PL.WH + 0.2]) dPts.push([AX + 8.2 * Math.cos(a), AY + 8.2 * Math.sin(a), z]); }
  const D0 = k.fitProjection(dPts, F.w, F.h, { pad: 6, azimuth: PL.AZ, elevation: PL.EL });
  const P2 = { ...D0, origin: [D0.origin[0] + F.x, D0.origin[1] + F.y] };
  // the same window on the small lock: map the frame through P2 -> world screen units -> P
  const map = ([x, y]) => [((x - P2.origin[0]) / P2.scale) * P.scale + P.origin[0], ((y - P2.origin[1]) / P2.scale) * P.scale + P.origin[1]];
  const [s0, s1] = [map([F.x, F.y]), map([F.x + F.w, F.y + F.h])];
  const sm = { x: s0[0], y: s0[1], w: s1[0] - s0[0], h: s1[1] - s0[1], r: (F.r * P.scale) / P2.scale };
  const rr = (b, cls) => `<rect class="${cls}" x="${b.x.toFixed(2)}" y="${b.y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" rx="${b.r.toFixed(2)}"/>`;
  const st = plState(0);
  const pTop = scene(P, { base: false }), pDet = scene(P2, { base: false });
  const fTop = plFrame(P, st), fDet = plFrame(P2, st, { guide: true, legTop: 50 });
  // connectors: from the small window's lower corners to the big frame's upper corners (they end on both frames)
  const con = [[sm.x + sm.r * 0.3, sm.y + sm.h - sm.r * 0.3, F.x + F.r * 0.3, F.y + F.r * 0.3], [sm.x + sm.w - sm.r * 0.3, sm.y + sm.h - sm.r * 0.3, F.x + F.w - F.r * 0.3, F.y + F.r * 0.3]];
  const body = [
    `<defs><clipPath id="pl-det-clip" clipPathUnits="userSpaceOnUse">${rr(F, "")}</clipPath></defs>`,
    `<g class="pl-con">${con.map(([a, b, c, d]) => `<path d="M${a.toFixed(2)} ${b.toFixed(2)}L${c.toFixed(2)} ${d.toFixed(2)}"/>`).join("")}</g>`,
    `<g data-part="top">`, pTop.base, pTop.bodyBack, `<g data-part="stack">${fTop.stack}</g>`, pTop.bodyTop, `<g data-part="shackle">${fTop.shackle}</g>`, `</g>`,
    rr(sm, "pl-win"),
    `<g class="pl-det">`, rr(F, "pl-det-glass"),
    `<g clip-path="url(#pl-det-clip)">`, pDet.bodyBack, `<g data-part="dstack">${fDet.stack}</g>`, `</g>`,
    rr({ x: F.x - 3, y: F.y - 3, w: F.w + 6, h: F.h + 6, r: F.r + 3 }, "pl-det-rim"), rr({ x: F.x - 6, y: F.y - 6, w: F.w + 12, h: F.h + 12, r: F.r + 6 }, "pl-det-edge"), rr(F, "pl-det-edge"),
    `</g>`,
  ];
  const svg = k.figureSvg({ width: W, height: H, label: LABEL, body });
  const css = k.ISO_CSS + MATERIALS + `
html,body{margin:0;height:100%;overflow:hidden}
body{background:var(--anatomy-paper)}
.iso[data-theme="light"]{--anatomy-page:#f5f2eb;--anatomy-card:#f5f2eb;--anatomy-paper:#f5f2eb;--anatomy-weight:.85px}
.pl-short{position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 60%,#fdfbf6 0%,#f5f2eb 55%,#f1ece1 100%)}
.pl-short svg{width:100vw;height:100vh;max-width:none}
.pl-det-glass{fill:#dbe4ee}
.pl-det-rim{fill:none;stroke:#9fb6d2;stroke-width:6px}
.pl-det-edge{fill:none;stroke:#1f3550;stroke-width:.9px}
.pl-win{fill:none;stroke:#1f3550;stroke-width:1.1px}
.pl-con path{fill:none;stroke:#1f3550;stroke-width:.8px;stroke-opacity:.55}`;
  const LIVE = `
const P = ${JSON.stringify(P)}, P2 = ${JSON.stringify(P2)};
const svg = document.querySelector("svg.iso-svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const G_ = { stack: q("stack"), shackle: q("shackle"), dstack: q("dstack") };
const HV = ${JSON.stringify(HEAT_VARS)}, HO = ${JSON.stringify(HEAT_ORANGE)}, HR = ${JSON.stringify(HEAT_RED)};
const hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const HOx = HO.map(hx), HRx = HR.map(hx);
const mix = (j, h) => "#" + HOx[j].map((v, c) => Math.round(v + (HRx[j][c] - v) * h).toString(16).padStart(2, "0")).join("");
window.__events = plEvents();
let lastKey = "", lastHeat = "";
function draw(t) {
  const s = plState(t);
  const key = s.d.map((v) => v.toFixed(4)).join(",") + "|" + s.lift.toFixed(4);
  if (key !== lastKey) { lastKey = key; const f = plFrame(P, s); G_.stack.innerHTML = f.stack; G_.shackle.innerHTML = f.shackle; G_.dstack.innerHTML = plFrame(P2, s, { guide: true, legTop: 50 }).stack; }
  const hk = s.heat.map((h) => h.toFixed(3)).join(",");
  if (hk !== lastHeat) { lastHeat = hk; s.heat.forEach((h, i) => HV.forEach((v, j) => svg.style.setProperty("--w" + i + "-" + v, mix(j, h)))); }
  window.__state = { d: s.d, lift: s.lift, heat: s.heat };
}
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const frame = (now) => { holdClock(); const T = Math.max(0, now / 1000 - 0.5); /* tour time = page time - 0.5 s */ window.__T = T; draw(Math.min(T, 24)); requestAnimationFrame(frame); };
draw(0); window.__T = 0;
requestAnimationFrame(frame);
`;
  const script = kitScript() + strip("engine.mjs") + strip("model.mjs") + "const k = { iso, pathOf, solidSvg, cylinder, lineSvg, dotsSvg };\n" + strip("draw.mjs") + LIVE;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Combination padlock · short</title><style>${css}</style></head><body class="iso" data-theme="light"><div class="pl-short">${svg.replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" ')}</div><script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
  if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), html);
  console.log("short scales top", P.scale.toFixed(2), "detail", P2.scale.toFixed(2), "small window", JSON.stringify(sm));
}
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.preview.json"), JSON.stringify(plEvents(), null, 1));
console.log("wrote padlock-light.html short.html; events", plEvents().length);

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['padlock-light.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
