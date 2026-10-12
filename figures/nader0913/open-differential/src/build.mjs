// Open bevel-gear differential on a bench stand.
// node build.mjs            -> differential-light.html (figure page, light theme) and short.html (9:16 video page)
// node build.mjs --dark     -> also differential.html (dark theme)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { C, makeScene, PALETTE_CSS } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = fileURLToPath(new URL("../../../../.skill/kit", import.meta.url));
const AZIMUTH = 16;
const ELEVATION = 46;
const W = 600;

// ---------- truth: the model every number and every motion comes from ----------
const TRUTH = {
  ratio: C.RING_TEETH / C.PINION_TEETH, // 37:10 = 3.70
  track: 1.5, // m
  turnRadius: 5.0, // m, centre of the axle
  tyre: 0.33, // m rolling radius
  speed: 12, // km/h
};
TRUTH.split = TRUTH.track / 2 / TRUTH.turnRadius; // 0.15: outer +15 %, inner -15 % -> 30 % apart
TRUTH.rpm = ((TRUTH.speed / 3.6) / (2 * Math.PI * TRUTH.tyre)) * 60; // 96.5 rpm straight

// ---------- camera ----------
const bound = [
  ...k.boxCorners(C.PLATE, C.BASE - C.PLATE_H - C.FOOT_H, C.BASE),
  ...[-1, 1].flatMap((s) => [-C.WHEEL_R, C.WHEEL_R].flatMap((y) => [-C.WHEEL_R, C.WHEEL_R].flatMap((z) => [[s * (C.WHEEL_X + 7), y, z], [s * (C.WHEEL_X - 7), y, z]]))),
  [C.PIN_X, C.FLANGE[1], 13],
  [C.PIN_X, C.FLANGE[1], -13],
];
const flat = bound.map((p) => k.iso(p, { origin: [0, 0], scale: 1, azimuth: AZIMUTH, elevation: ELEVATION }));
const spanX = Math.max(...flat.map((p) => p[0])) - Math.min(...flat.map((p) => p[0]));
const spanY = Math.max(...flat.map((p) => p[1])) - Math.min(...flat.map((p) => p[1]));
const H = Math.round((W - 40) * (spanY / spanX) + 40);
const P = k.fitProjection(bound, W, H, { pad: 20, azimuth: AZIMUTH, elevation: ELEVATION });

// ---------- static art with slots for the moving parts ----------
const scene = makeScene(k, G, P);
const initial = { L: 0, R: 0, C: 0, P: 0, S: 0, rpmL: 0, rpmR: 0 };
const body = scene.list.map((item) => (item.dyn ? `<g data-dyn="${item.dyn}"${item.col ? ` class="pc-${item.col}"` : ""}>${scene.dyn(item.dyn, initial)}</g>` : item.svg)).join("");
const label =
  "An open bevel-gear differential on a bench stand. An input pinion drives a ring gear bolted to an open cage carrier; inside it two spider gears on a cross pin mesh with two side gears, which drive the left and right half shafts out to two wheels. Two tachometers on the bench read each wheel's speed.";
const svg = k.figureSvg({ width: W, height: H, label, body });

// ---------- inline the kit + scene for the page ----------
const moduleOf = (src, prelude = "") => {
  const names = [...src.matchAll(/^export\s+(?:const|function|let|class)\s+(\w+)/gm)].map((m) => m[1]);
  const code = src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
  return `(() => {${prelude}\n${code}\nreturn { ${names.join(", ")} };})()`;
};
const kitSrc = readFileSync(join(KIT, "iso-kit.mjs"), "utf8");
const latheSrc = readFileSync(join(KIT, "lathe.mjs"), "utf8");
const sceneSrc = readFileSync(join(HERE, "scene.mjs"), "utf8");
const inline = `
const k = ${moduleOf(kitSrc)};
const G = ${moduleOf(latheSrc, "const { cameraOf, iso, pathOf } = k;")};
const SC = ${moduleOf(sceneSrc)};
`;

// ---------- motion: one model, one timeline ----------
// steer: +1 = left turn (right wheel outside), -1 = right turn. speed: 0..1 of cruise.
const TOUR = { length: 24, keys: [[0, 0], [5, 0], [6.5, 1], [10, 0 + 1], [11.5, 0], [14, 0], [15.5, -1], [19, -1], [20.5, 0], [24, 0]] };
const EVENTS = [
  { t: 0, type: "start", i: 0 },
  { t: 1.6, type: "whirr", i: 0.5 },
  { t: 5, type: "turn", i: 0 },
  { t: 6.5, type: "whirr", i: 1 },
  { t: 10, type: "straight", i: 1 },
  { t: 11.5, type: "whirr", i: 0.5 },
  { t: 14, type: "turn", i: 0 },
  { t: 15.5, type: "whirr", i: 1 },
  { t: 19, type: "straight", i: 1 },
  { t: 20.5, type: "whirr", i: 0.5 },
];
const live = ({ short }) => `
${inline}
const P = ${JSON.stringify(P)};
const TRUTH = ${JSON.stringify(TRUTH)};
const TOUR = ${JSON.stringify(TOUR)};
window.__events = ${JSON.stringify(EVENTS)};
const scene = SC.makeScene(k, G, P, { dynOnly: true });
const slots = [...document.querySelectorAll("[data-dyn]")];
const readout = document.querySelector("[data-readout]");
const stage = document.querySelector(".iso-stage");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const smooth = (t) => t * t * (3 - 2 * t);
function tourSteer(t) {
  const keys = TOUR.keys;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b] = keys[i];
      return a + (b - a) * smooth((t - t0) / (t1 - t0 || 1));
    }
  }
  return 0;
}
const SHORT = ${short};
// recording: Playwright's fake clock also flows with real time; stop that so page time = sum of runFor steps (frame-exact)
if (SHORT && globalThis.__pwClock) { try { globalThis.__pwClock.controller.now(); globalThis.__pwClock.controller._innerPause(); } catch (e) {} }
const W0 = 0.3 * Math.PI * 2; // drawn wheel speed at cruise: 0.3 rev/s (slow motion of the true 96.5 rpm)
const state = { L: 0, R: 0, C: 0, P: 0, S: 0, rpmL: 0, rpmR: 0 };
let start = null, last = null, steer = 0, speed = 0, touring = true, target = 0, idle = 0, frame = 0;
function rates(st, sp) {
  const split = TRUTH.split * st;
  const wC = W0 * sp;
  const wL = wC * (1 - split), wR = wC * (1 + split);
  return { wL, wR, wC, wP: wC * TRUTH.ratio, wS: -(${C.SIDE_TEETH} / ${C.SPIDER_TEETH}) * (wR - wC) };
}
function draw() {
  for (const g of slots) g.innerHTML = scene.dyn(g.dataset.dyn, state);
  if (readout) {
    const r = rates(steer, speed);
    const text = (Math.abs(steer) < 0.02 ? "straight" : steer > 0 ? "left turn" : "right turn") + " · L " + Math.round(state.rpmL) + " rpm · R " + Math.round(state.rpmR) + " rpm · spiders " + Math.round(Math.abs(r.wS) / W0 * TRUTH.rpm) + " rpm";
    if (readout.textContent !== text) readout.textContent = text;
  }
}
function tick() {
  const now = performance.now();
  if (start === null) { start = now; last = now; }
  const t = (now - start) / 1000;
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (touring) {
    const tt = SHORT ? Math.min(t, TOUR.length) : t % TOUR.length;
    steer = tourSteer(tt);
    speed = SHORT ? smooth(Math.min(1, t / 1.6)) : Math.max(speed, smooth(Math.min(1, t / 1.6)));
  } else {
    steer += (target - steer) * (1 - Math.exp(-dt / 0.35));
    speed += (1 - speed) * (1 - Math.exp(-dt / 0.5));
    if (performance.now() - idle > 3600) { touring = true; start = now - 4000; }
  }
  if (still.matches) { dt = 0; steer = 0; speed = 1; }
  const n = Math.max(1, Math.ceil(dt * 240));
  for (let i = 0; i < n; i++) {
    const r = rates(steer, speed);
    const h = dt / n;
    state.L += r.wL * h; state.R += r.wR * h; state.C += r.wC * h; state.P += r.wP * h; state.S += r.wS * h;
  }
  const split = TRUTH.split * steer;
  state.rpmL = TRUTH.rpm * speed * (1 - split);
  state.rpmR = TRUTH.rpm * speed * (1 + split);
  window.__state = { t, steer, speed, ...state };
  draw();
  frame = still.matches ? 0 : requestAnimationFrame(tick);
}
if (stage && !SHORT) {
  stage.addEventListener("pointermove", (event) => {
    const box = stage.getBoundingClientRect();
    target = Math.max(-1, Math.min(1, -(((event.clientX - box.left) / box.width) - 0.5) * 2.6));
    touring = false; idle = performance.now();
  });
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") target = 1; else if (event.key === "ArrowRight") target = -1; else if (event.key === "ArrowUp" || event.key === "ArrowDown") target = 0; else return;
    event.preventDefault(); touring = false; idle = performance.now();
  });
}
frame = requestAnimationFrame(tick);
`;

// ---------- figure page (light ships) ----------
const theme = "light";
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Open differential",
  hint: "Hover left or right to steer",
  readout: "straight · L 97 rpm · R 97 rpm · spiders 0 rpm",
  keys: [
    { mark: "lit", label: "Spider gears: still on their pin going straight, turning on it in a corner" },
    { mark: "raised", label: "Ring gear 37 teeth, pinion 10: 3.7 : 1" },
  ],
  caption: `Going straight the cage, both side gears and both wheels turn together at ${TRUTH.rpm.toFixed(0)} rpm (12 km/h on 0.33 m tyres) and the spider gears ride round without spinning. In a 5 m turn with a 1.5 m track the outer wheel must run 15 % faster and the inner 15 % slower, so the spiders roll on their pin: one wheel gains exactly what the other loses and (left + right) / 2 stays the cage speed.`,
  body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Differential: hover or arrow keys to steer">${svg}</div>`,
});
const pageCss = `<style>.iso-stage{outline:none}\n${PALETTE_CSS}</style>`;
writeFileSync(join(HERE, "differential-light.html"), k.pageHtml({ title: "Open differential", theme, body: plate + pageCss, script: live({ short: false }), width: 760 }));

// ---------- short page: 9:16, figure only ----------
const shortCss = `
html,body{height:100%;overflow:hidden}
body.iso[data-theme="light"]{--anatomy-page:#f6f3ec;--anatomy-paper:#f6f3ec;--anatomy-card:#f6f3ec;--anatomy-face:#fffdf8;--anatomy-top:#fffdf8;--anatomy-lit-top:#ffffff;
 --anatomy-shade-0:#d9d5cc;--anatomy-shade-1:#e3e0d8;--anatomy-shade-2:#ece9e2;--anatomy-shade-3:#f4f2ec;--anatomy-halo:#857e6c;--anatomy-weight:.8px;
 background:radial-gradient(120% 70% at 50% 62%,#fbf9f4 0%,#f6f3ec 55%,#efebe2 100%)}
.short{position:fixed;inset:0}
.short .iso-svg{position:absolute;left:2%;width:96%;top:${"SVG_TOP"}}
`;
const aspect = H / W;
// top 22% stays empty for a title; centre the figure in the remaining space, a touch low
const figH = 0.96 * 415 * aspect; // px at the recorder's 415 px viewport
const top = 0.205 * 738; // figure top lands at ~25% (svg has its own pad), leaving the top band for the title
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Differential short</title><style>${k.ISO_CSS}${PALETTE_CSS}\n${shortCss.replace("SVG_TOP", ((top / 738) * 100).toFixed(2) + "%")}</style></head><body class="iso" data-theme="light"><main class="short">${svg}</main><script type="module">${live({ short: true }).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.json"), JSON.stringify(EVENTS, null, 1));
console.log("wrote differential-light.html, short.html", { W, H, aspect: aspect.toFixed(3), figH: figH.toFixed(0), top: top.toFixed(0), paths: (svg.match(/<path/g) || []).length, kb: Math.round(svg.length / 1024) });

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['differential-light.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
