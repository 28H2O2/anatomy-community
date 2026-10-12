// Pin tumbler lock in cutaway. node build.mjs  -> lock-light.html (figure card) and short.html (9:16 video page)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { mPrism, mFace, mGroove, mItems, mSvg, mHatch, mArc } from "./engine.mjs";
import { LK, lkState, lkEvents } from "./model.mjs";
import { lkFrame, lkDriver, lkPinRing } from "./draw.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (f) => readFileSync(join(HERE, f), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const { R, RH, TOWER, TOWER_Y, ZTOP, PIN_R, Z, COVER, FACE } = LK;
const AZ = 58, EL = 30;

// ---- world extents for the fit
const BASE = { x: -13.5, y: -11, w: 40, d: 40.5, r: 3 };
const BASE_TOP = -7.4, BASE_H = 3, FOOT_H = 1.6;
const fitFor = (top) => [
  ...k.boxCorners(BASE, BASE_TOP - BASE_H - FOOT_H, BASE_TOP),
  ...[-12.5, 10.6].flatMap((x) => [[x, 0, FACE + top + 24.6], [x, 0, FACE + top + 18]]),
  [TOWER + 1, -TOWER_Y, ZTOP], [-RH, 0, ZTOP],
];
const fitPoints = fitFor(LK.OUT);

function scene(P) {
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (pts, style) => k.dotsSvg(pts, style);
  const at = (p) => k.iso(p, P);
  const parts = {};
  // ---- base: plate on feet, corner screws, ruler along the bolt, label plate
  {
    const o = [`<path class="iso-halo" d="${k.haloOf(BASE, BASE_TOP - BASE_H - FOOT_H, BASE_H, P)}"/>`];
    const feet = k.corners(BASE, 4.5).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
    for (const [x, y] of feet) o.push(S(k.cylinder(x, y, 2.6, BASE_TOP - BASE_H - FOOT_H, FOOT_H, P, 24), { tone: "lo" }));
    o.push(S(k.slabOf(BASE, BASE_TOP - BASE_H, BASE_H, P, 8, 0.5), { tone: "mid" }));
    o.push(L(k.planOutline(k.insetPlan(BASE, 1.6), BASE_TOP, P), { tone: "faint" }));
    const screws = k.corners(BASE, 3.2);
    o.push(L(screws.map(([x, y]) => k.ring(x, y, 0.9, BASE_TOP, P, 16)).join(""), { tone: "lo" }));
    o.push(D(screws.map(([x, y]) => at([x, y, BASE_TOP])), { size: 0.55 }));
    const strip = { x: 12.2, y: 12.5, w: 3.4, d: 15.5, r: 0.4 };
    o.push(S(k.slabOf(strip, BASE_TOP, 0.35, P, 2), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(14, 27, 1, 5, strip.x + 0.4, BASE_TOP + 0.35, [0.6, 1.05], P, "y");
    o.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid", free: "end" }));
    o.push(L(k.lineOnTop([strip.x + 0.4, 16], [strip.x + 1.2, 16], BASE_TOP + 0.35, P), { tone: "hi" }));
    o.push(L(k.lineOnTop([strip.x + 0.4, 14], [strip.x + 0.4, 27], BASE_TOP + 0.35, P), { tone: "lo" }));
    const label = { x: 17.2, y: 16.5, w: 7.4, d: 10.5, r: 0.6 };
    o.push(S(k.slabOf(label, BASE_TOP, 0.35, P, 3), { tone: "lo", crease: "none" }));
    for (const [i, yy] of [17.6, 19.2, 20.8].entries()) o.push(L(k.lineOnTop([label.x + 1.4, yy + 1.0], [label.x + label.w - (i === 2 ? 3.4 : 1.4), yy + 1.0], BASE_TOP + 0.35, P), { tone: "lo", free: true }));
    o.push(D([[label.x + 1.0, label.y + label.d - 1.0], [label.x + label.w - 1.0, label.y + label.d - 1.0]].map(([x, y]) => at([x, y, BASE_TOP + 0.35])), { size: 0.45 }));
    parts.base = `<g class="lk-base">${o.join("")}</g>`;
  }
  // ---- posts under the housing
  {
    const o = [];
    for (const [x, y] of [[-4.6, -6.0], [17.4, -2.2]]) {
      o.push(S(k.cylinder(x, y, 2.2, BASE_TOP, 0.9, P, 24), { tone: "mid" }));
      o.push(S(k.cylinder(x, y, 1.35, BASE_TOP + 0.9, -0.9 - BASE_TOP - 0.9, P, 20), { tone: "mid", crease: "none" }));
      o.push(S(k.cylinder(x, y, 2.2, -0.9, 0.9, P, 24), { tone: "mid" }));
      o.push(D([at([x + 1.6 * Math.cos(1.0), y + 1.6 * Math.sin(1.0), BASE_TOP + 0.9])], { size: 0.4 }));
    }
    parts.posts = `<g class="lk-steel">${o.join("")}</g>`;
  }
  // ---- bolt: a yoke with a slot for the cam stud, and a bar that throws into the keeper
  {
    const yokeRing = [[-2.4, -2.6], [12.4, -2.6], [12.4, 2.6], [-2.4, 2.6]];
    const slot = [...mArc(11.0, 0, 1.45, -Math.PI / 2, Math.PI / 2, 10), ...mArc(-1.0 + 0.0, 0, 1.45, Math.PI / 2, Math.PI * 1.5, 10)];
    const yoke = mPrism([yokeRing, slot], { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, BASE_TOP + 0.05, -5.0, { tone: "hi" });
    const o = [mSvg(mItems(yoke, P)[0])];
    o.push(D([[0.6, -1.9], [10.2, -1.9]].map(([x, y]) => at([x, y + 0.6, -5.0])), { size: 0.45, tone: "mid" }));
    const bar = { x: 1.6, y: 2.6, w: 6.8, d: 13.4, r: 0.5 };
    o.push(S(k.slabOf(bar, BASE_TOP + 0.05, -5.0 - BASE_TOP - 0.05, P, 3, 0.35), { tone: "hi" }));
    o.push(L(k.lineOnTop([5, 2.6], [5, 16.0], -5.0, P), { tone: "faint" }));
    parts.bolt = `<g data-part="bolt" class="lk-bolt">${o.join("")}</g>`;
    const cheek = (x0) => S(k.slabOf({ x: x0, y: 12.2, w: 1.6, d: 3.6, r: 0.3 }, BASE_TOP, -4.5 - BASE_TOP, P, 2), { tone: "mid" });
    parts.guideBack = `<g class="lk-steel">${cheek(-0.2)}</g>`;
    parts.guideFront = `<g class="lk-steel">${cheek(8.6)}${S(k.slabOf({ x: -0.6, y: 11.9, w: 11.2, d: 4.2, r: 0.6 }, -4.5, 0.9, P, 3, 0.3), { tone: "mid" })}${D([[1.2, 14.0], [8.8, 14.0]].map(([x, y]) => at([x, y, -3.6])), { size: 0.55, tone: "mid" })}${L([[1.2, 14.0], [8.8, 14.0]].map(([x, y]) => k.ring(x, y, 0.85, -3.6, P, 14)).join(""), { tone: "lo" })}</g>`;
    const keeper = { x: -1.2, y: 19.2, w: 12.4, d: 7.2, r: 0.8 };
    parts.keeper = `<g class="lk-steel">${S(k.slabOf(keeper, BASE_TOP, 6.0, P, 3, 0.4), { tone: "mid" })}${L(k.sideSeam(keeper, BASE_TOP + 2.6, P, 3), { tone: "faint" })}${D([[1.4, 22.8], [8.6, 22.8]].map(([x, y]) => at([x, y, BASE_TOP + 6])), { size: 0.55, tone: "mid" })}${L([[1.4, 22.8], [8.6, 22.8]].map(([x, y]) => k.ring(x, y, 0.9, BASE_TOP + 6, P, 14)).join(""), { tone: "lo" })}</g>`;
  }
  // ---- housing (steel), cut open on y = 0
  {
    const xc = Math.sqrt(RH * RH - TOWER_Y * TOWER_Y);
    const outer = mArc(0, 0, RH, Math.atan2(-TOWER_Y, xc), -Math.PI, 40);
    const ring = [[-RH, 0], [-R, 0], ...mArc(0, 0, R, -Math.PI, 0, 48).slice(1, -1), [R, 0], [TOWER, 0], [TOWER, -TOWER_Y], ...outer.slice(0, -1)];
    const ZF = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
    const body = mPrism([ring], ZF, 0, ZTOP, { tone: "mid", skip: (p, q) => Math.abs(p[1]) < 1e-9 && Math.abs(q[1]) < 1e-9 && Math.min(p[0], q[0]) >= R - 1e-9 });
    const top = body.faces.find((f) => f.n[2] > 0.99);
    body.faces = body.faces.filter((f) => f !== top);
    // the left strip of the cut gets hatched
    const left = body.faces.find((f) => f.n[1] > 0.99);
    left.lines = mHatch([[[-RH, 0], [-R, 0], [-R, ZTOP], [-RH, ZTOP]]], Math.PI / 4, 0.95, 0.2).map(([a, b]) => [[a[0], 0, a[1]], [b[0], 0, b[1]]]);
    left.lineTone = "lo"; left.fill = "cut";
    const grooves = { faces: Z.flatMap((z) => mGroove({ o: [0, 0, z], a: [1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] }, R - 0.17, COVER, PIN_R, 14).faces), tone: "lo" };
    const edges = [0, ...Z.flatMap((z) => [z - PIN_R, z + PIN_R]).sort((a, b) => a - b), ZTOP];
    const bands = [];
    for (let i = 0; i < edges.length; i += 2) {
      const z0 = edges[i], z1 = edges[i + 1];
      const hatch = mHatch([[[R, z0], [TOWER, z0], [TOWER, z1], [R, z1]]], Math.PI / 4, 0.95, 0.2).map(([a, b]) => [[a[0], 0, a[1]], [b[0], 0, b[1]]]);
      bands.push(mFace([[R, 0, z0], [TOWER, 0, z0], [TOWER, 0, z1], [R, 0, z1]], [0, 1, 0], [i === 0 ? [0, 0, -1] : null, [1, 0, 0], i === edges.length - 2 ? [0, 0, 1] : null, false], { tone: "mid", lines: hatch, lineTone: "lo", fill: "cut" }));
    }
    parts.housingA = `<g class="lk-steel">${mSvg(mItems(body, P)[0])}${mSvg(mItems(grooves, P)[0])}</g>`;
    const topRing = mArc(8.3, 0, 0, 0, 0, 0);
    void topRing;
    parts.housingB = `<g class="lk-steel">${mSvg(mItems({ faces: bands, tone: "mid" }, P)[0])}${mSvg(mItems({ faces: [top], tone: "mid" }, P)[0])}${L(k.onTop(mArc(0, 0, 8.25, -Math.PI, 0, 40), ZTOP, P), { tone: "faint" })}${D([[14.0, -2.0], [18.6, -2.0]].map(([x, y]) => at([x, y, ZTOP])), { size: 0.5, tone: "mid" })}${L([[14.0, -2.0], [18.6, -2.0]].map(([x, y]) => k.ring(x, y, 0.8, ZTOP, P, 14)).join(""), { tone: "lo" })}</g>`;
    // chamber cover on the tower end, two screws
    const cover = { x: TOWER, y: -TOWER_Y, w: 0.9, d: TOWER_Y, r: 0 };
    const cv = k.slabOf(cover, 1.0, ZTOP - 2.0, P, 1, 0);
    const scr = [[TOWER + 0.9, -2.0, 3.3], [TOWER + 0.9, -2.0, ZTOP - 3.3]];
    parts.cover = `<g class="lk-steel">${S(cv, { tone: "mid" })}${L(scr.map((p) => k.sideRing(p, 1.05, "x", P, 20)).join(""), { tone: "mid" })}${D(scr.map(at), { size: 0.55, tone: "mid" })}${L(scr.map((p) => k.segment([p[0], p[1] - 1.05, p[2]], [p[0], p[1] + 1.05, p[2]], P)).join(""), { tone: "mid" })}</g>`;
    // the shear line: where the plug meets the housing (the one lit accent)
    parts.shear = `<path class="iso-line lk-shear" d="${k.segment([R, 0, 0], [R, 0, ZTOP], P)}${k.segment([-R, 0, 0], [-R, 0, ZTOP], P)}"/>`;
    // clip: the openings through which the inside of the bore shows
    const rect = [[-R, 0, 0], [R, 0, 0], [R, 0, ZTOP], [-R, 0, ZTOP]].map(at);
    const topHole = mArc(0, 0, R, 0, -Math.PI, 40).map(([x, y]) => at([x, y, ZTOP]));
    parts.clip = `<clipPath id="lk-bore"><path d="${k.pathOf(rect, true)}"/><path d="${k.pathOf(topHole, true)}"/></clipPath>`;
  }
  // ---- drivers (built at x = 0, moved along x)
  parts.drivers = Z.map((z, n) => `<g data-driver="${n}" class="lk-driver">${mSvg(mItems(lkDriver(n), P)[0])}${L(lkPinRing(P, 0.4, z, PIN_R) + lkPinRing(P, LK.DRIVER - 0.4, z, PIN_R), { tone: "mid" })}</g>`).join("");
  return parts;
}

function svgFor(P, width, height, label) {
  const p = scene(P);
  const f = lkFrame(P, lkState(0));
  const body = [
    `<defs>${p.clip}</defs><g data-part="root">`,
    p.base, p.posts, p.guideBack, p.bolt.replace('data-part="bolt"', `data-part="bolt" transform="${f.bolt}"`), p.guideFront, p.keeper,
    `<g data-part="cam" class="lk-cam">${f.cam}</g>`,
    p.housingA,
    `<g data-part="springBack" class="lk-spring-back"><path d="${f.springBack}"/></g>`,
    p.housingB, p.cover,
    `<g clip-path="url(#lk-bore)" data-part="inside">${f.inside}</g>`,
    p.shear,
    `<g data-part="outside">${f.outside}</g>`,
    `<g data-part="alert">${f.alert}</g>`,
    p.drivers.replace(/data-driver="(\d)"/g, (m, n) => `${m} transform="${f.drivers[+n]}"`),
    `<g data-part="springFront" class="lk-spring"><path class="lk-wire" d="${f.springFront}"/><path class="lk-wire-hi" d="${f.springFront}"/></g>`,
    `<g data-part="high" class="lk-key">${f.high}</g></g>`,
  ];
  return k.figureSvg({ width, height, label, body });
}

const MATERIALS = `
.lk-f{stroke-width:.45px;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.lk-f[data-shade="0"]{stroke:var(--anatomy-shade-0)}.lk-f[data-shade="1"]{stroke:var(--anatomy-shade-1)}.lk-f[data-shade="2"]{stroke:var(--anatomy-shade-2)}.lk-f[data-shade="3"]{stroke:var(--anatomy-shade-3)}.iso-top.lk-f{stroke:var(--anatomy-top)}
.lk-cut{fill:var(--lk-cut);stroke:var(--lk-cut)}
/* textbook palette: steel-blue body, orange moving parts, brass pins, teal key, grey springs/drivers, red accent */
.lk-base{--anatomy-top:#fbf6ec;--anatomy-shade-3:#f2e9d8;--anatomy-shade-2:#e9ddc7;--anatomy-shade-1:#ddcdb2;--anatomy-shade-0:#cbb797;--anatomy-hi:#4a3c2a;--anatomy-mid:#a8957a;--anatomy-lo:#cbb99d;--anatomy-faint:#e6d9c4;--anatomy-paper:#fbf6ec}
.lk-steel{--anatomy-top:#cddbeb;--anatomy-shade-3:#adc3dc;--anatomy-shade-2:#90aacc;--anatomy-shade-1:#7693ba;--anatomy-shade-0:#5b7fa6;--anatomy-hi:#1c3048;--anatomy-mid:#3f5f86;--anatomy-lo:#6f8db3;--anatomy-faint:#9fb6d2;--anatomy-paper:#cddbeb;--lk-cut:#e2eaf4}
.lk-steel .lk-cut~.iso-line[data-tone="lo"]{stroke:#7f9cc0}
.lk-bolt,.lk-cam,.lk-plug{--anatomy-top:#fbd3ae;--anatomy-shade-3:#f6b57e;--anatomy-shade-2:#f09c5a;--anatomy-shade-1:#e8823a;--anatomy-shade-0:#c96a26;--anatomy-hi:#4f2304;--anatomy-mid:#a2531a;--anatomy-lo:#e19a62;--anatomy-faint:#f3c39a;--anatomy-paper:#fbd3ae;--lk-cut:#fde6d1}
.lk-plug .lk-cut~.iso-line[data-tone="lo"]{stroke:#e9a06a}
.lk-pin{--anatomy-top:#f8e4a8;--anatomy-shade-3:#f0cf76;--anatomy-shade-2:#e6bb58;--anatomy-shade-1:#d9a441;--anatomy-shade-0:#b9862a;--anatomy-hi:#553c00;--anatomy-mid:#9c7419;--anatomy-lo:#c9a145;--anatomy-faint:#e5c977}
.lk-driver{--anatomy-top:#f2f4f6;--anatomy-shade-3:#dde1e6;--anatomy-shade-2:#c8ced5;--anatomy-shade-1:#b1b9c2;--anatomy-shade-0:#959ea9;--anatomy-hi:#22282f;--anatomy-mid:#68717c;--anatomy-lo:#9aa2ac;--anatomy-faint:#c9cfd6}
.lk-key{--anatomy-top:#bfe5e2;--anatomy-shade-3:#90d0cb;--anatomy-shade-2:#62bab5;--anatomy-shade-1:#40a8a3;--anatomy-shade-0:#2f8e8a;--anatomy-hi:#0b3a38;--anatomy-mid:#1f6e6a;--anatomy-lo:#5db1ac;--anatomy-faint:#9fd6d2}
.lk-spring-back path{fill:none;stroke:#8d96a1;stroke-width:1.1px;stroke-linecap:round;vector-effect:non-scaling-stroke}
.lk-wire{fill:none;stroke:#555e69;stroke-width:2.3px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.lk-wire-hi{fill:none;stroke:#e9edf1;stroke-width:0.8px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.lk-shear{stroke:var(--lk-accent);stroke-width:3.2px;stroke-linecap:round;opacity:var(--lk-shear,.9)}
.lk-alert .iso-line{stroke:var(--lk-accent)!important;stroke-width:2px}
.lk-alert-fill{fill:var(--lk-accent);opacity:.6;stroke:none}
.lk-alert .iso-crease{display:none}
.iso[data-theme="light"]{--lk-accent:#d6453d;--anatomy-weight:.7px}
`;

const live = (P, short, box) => `
const P = ${JSON.stringify(P)};
const BOX = ${JSON.stringify(box || null)};
const fitFor = ${fitFor.toString().replace(/k\./g, "")};
const BASE = ${JSON.stringify(BASE)}, BASE_TOP = ${BASE_TOP}, BASE_H = ${BASE_H}, FOOT_H = ${FOOT_H}, FACE = ${FACE}, TOWER = ${TOWER}, TOWER_Y = ${TOWER_Y}, ZTOP = ${ZTOP}, RH = ${RH};
const LK_ = LK;
const SHORT = ${short};
const svg = document.querySelector("svg.iso-svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const parts = { bolt: q("bolt"), cam: q("cam"), springBack: q("springBack").firstElementChild, inside: q("inside"), outside: q("outside"), alert: q("alert"), high: q("high"), springFront: q("springFront") };
const root = q("root");
const drivers = [...svg.querySelectorAll("[data-driver]")];
const shear = svg.querySelector(".lk-shear");
const readout = document.querySelector("[data-readout]");
window.__events = lkEvents();
const freeze = /t=([\\d.]+)/.exec(location.hash);
const still = matchMedia("(prefers-reduced-motion: reduce)").matches && !SHORT;
let t0 = null, paused = false, pauseAt = 0;
function sayOf(s) {
  const gaps = s.tops.map((x) => x - ${LK.R});
  if (s.alpha < 0.99) return "changing keys";
  if (s.phi > 0.01 && s.key === 1) return "plug " + Math.round(s.phi * 180 / Math.PI) + "° · bolt out " + s.bolt.toFixed(1) + " mm";
  if (s.ins > 0.01) return (s.key ? "right" : "wrong") + " key · " + (${LK.OUT} - s.ins).toFixed(1) + " mm in";
  if (s.key === 0) return "wrong key · pin 4 is " + gaps[3].toFixed(2) + " mm over the shear line";
  return "right key · all 5 gaps on the shear line";
}
function draw(time) {
  const s = lkState(time);
  const f = lkFrame(P, s);
  parts.bolt.setAttribute("transform", f.bolt);
  if (BOX) {
    const Q = fitProjection(fitFor(s.ins + s.lift), BOX.w, BOX.h, { pad: 0, azimuth: P.azimuth, elevation: P.elevation });
    const z = Q.scale / P.scale, ox = Q.origin[0] + BOX.x, oy = Q.origin[1] + BOX.y;
    root.setAttribute("transform", "matrix(" + z.toFixed(5) + " 0 0 " + z.toFixed(5) + " " + (ox - P.origin[0] * z).toFixed(3) + " " + (oy - P.origin[1] * z).toFixed(3) + ")");
  }
  parts.cam.innerHTML = f.cam;
  parts.springBack.setAttribute("d", f.springBack);
  parts.inside.innerHTML = f.inside;
  parts.outside.innerHTML = f.outside;
  parts.alert.innerHTML = f.alert;
  parts.high.innerHTML = f.high;
  parts.high.style.opacity = s.alpha < 1 ? s.alpha.toFixed(3) : "";
  for (const p of parts.springFront.children) p.setAttribute("d", f.springFront);
  drivers.forEach((g, n) => g.setAttribute("transform", f.drivers[n]));
  // the shear line brightens when every gap sits on it
  const aligned = s.key === 1 && s.ins < 0.02 && s.alpha > 0.99 ? 1 : 0;
  shear.style.setProperty("--lk-shear", (0.7 + 0.3 * aligned).toFixed(2));
  if (readout) { const text = sayOf(s); if (readout.textContent !== text) readout.textContent = text; }
}
function tick(now) {
  if (t0 === null) t0 = now;
  // a recorder may pin the tour time per frame (window.__lkT), so wall-clock drift cannot leak into a video
  if (!paused) draw(typeof window.__lkT === "number" ? window.__lkT : (now - t0) / 1000);
  requestAnimationFrame(tick);
}
if (freeze) draw(+freeze[1]);
else if (still) draw(12.6);
else requestAnimationFrame(tick);
if (!SHORT) {
  const stage = document.querySelector(".iso-stage");
  stage.addEventListener("click", () => { paused = !paused; if (!paused) { t0 = performance.now() - pauseAt * 1000; } else pauseAt = (performance.now() - t0) / 1000; });
  stage.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); stage.click(); } });
}
`;

const SCRIPT = (P, short, box) => kitScript() + strip("engine.mjs") + strip("model.mjs") + "const k = { iso, pathOf, translateAlong, solidSvg, cylinder, extrude, dotsSvg, lineSvg, ring, rise, segment };\n" + strip("draw.mjs") + live(P, short, box);
const LABEL = "A pin tumbler lock cut open on a display stand: brass plug with a key in its keyway, five pin stacks (brass key pins, steel driver pins, springs) in a steel housing, a cam under the plug and a bolt that slides into a keeper. When the right key lifts every gap to the shear line the plug turns 90 degrees and the cam throws the bolt 10 mm.";

// ---- figure page (card)
{
  const W = 600, H = 700;
  const fbox = { x: 40, y: 24, w: 520, h: 652 };
  const P0 = k.fitProjection(fitPoints, fbox.w, fbox.h, { pad: 0, azimuth: AZ, elevation: EL });
  const P = { ...P0, origin: [P0.origin[0] + fbox.x, P0.origin[1] + fbox.y] };
  const svg = svgFor(P, W, H, LABEL);
  const body = k.plateHtml({
    fig: "Fig 1", title: "Pin tumbler lock", hint: "Click to pause the tour", readout: "wrong key · 28.6 mm out",
    keys: [{ mark: "red", label: "Shear line: the gap between plug (orange) and housing (blue)" }, { mark: "raised", label: "Key pins (brass) cut to the key (teal); driver pins (steel) on springs" }],
    caption: "A Schlage-sized 5-pin cylinder: 12.7 mm plug, 2.92 mm pins 3.97 mm apart, cuts in 0.381 mm steps. The wrong key leaves pin 4 2.29 mm too high, so its key pin straddles the shear line and the plug cannot turn. The right key lifts every key-pin top exactly to the shear line; the plug turns 90°, its cam swings and slides the bolt 10 mm into the keeper.",
    body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Pin tumbler lock tour">${svg}</div>`,
  });
  const html = k.pageHtml({ title: "Pin tumbler lock", theme: "light", body, script: SCRIPT(P, false, fbox), width: 640 }).replace("</style>", MATERIALS + "</style>");
  writeFileSync(join(HERE, "lock-light.html"), html);
}
// ---- short page (video only: node build.mjs --short)
if (process.argv.includes("--short")) {
  const W = 400, H = 711;
  const box = { x: 20, y: 0.215 * H, w: 360, h: H - 0.215 * H - 14 };
  const P0 = k.fitProjection(fitPoints, box.w, box.h, { pad: 0, azimuth: AZ, elevation: EL });
  const P = { ...P0, origin: [P0.origin[0] + box.x, P0.origin[1] + box.y] };
  const svg = svgFor(P, W, H, LABEL);
  const css = k.ISO_CSS + MATERIALS + `
html,body{margin:0;height:100%;overflow:hidden}
body{background:var(--anatomy-paper)}
.iso[data-theme="light"]{--anatomy-page:#f5f2eb;--anatomy-card:#f5f2eb;--anatomy-paper:#f5f2eb;--anatomy-weight:.85px}
.lk-short{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.lk-short svg{width:100vw;height:100vh;max-width:none}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pin tumbler lock · short</title><style>${css}</style></head><body class="iso" data-theme="light"><div class="lk-short">${svg.replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" ')}</div><script type="module">${SCRIPT(P, true, box).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
  writeFileSync(join(HERE, "short.html"), html);
}
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.json"), JSON.stringify(lkEvents(), null, 1));
console.log("wrote lock-light.html");
