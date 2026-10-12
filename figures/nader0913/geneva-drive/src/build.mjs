// Geneva drive on a projector bench: node build.mjs -> geneva-light.html (figure page) + short.html (9:16 video page)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { C, makeScene, PALETTE_CSS, kinematics } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = fileURLToPath(new URL("../../../../.skill/kit", import.meta.url));
const AZ = 62, EL = 46;
const W = 600;

// ---------- camera ----------
const PL = C.PLATE;
const bound = [...k.boxCorners(PL, -C.PLATE_H - C.FOOT_H, 0), [-C.rollX - C.rollR, C.filmY - 2 * C.rollR, C.zt + 4], [C.rollX + C.rollR, C.filmY - 2 * C.rollR, C.zt + 4], [0, 0, C.zt + 12], [C.gateX, C.filmY - 50, 172]];
const flat = bound.map((p) => k.iso(p, { origin: [0, 0], scale: 1, azimuth: AZ, elevation: EL }));
const spanX = Math.max(...flat.map((p) => p[0])) - Math.min(...flat.map((p) => p[0]));
const spanY = Math.max(...flat.map((p) => p[1])) - Math.min(...flat.map((p) => p[1]));
const H = Math.round((W - 30) * (spanY / spanX) + 30);
const P = k.fitProjection(bound, W, H, { pad: 15, azimuth: AZ, elevation: EL });

// ---------- tour: crank angle psi(t) as Hermite keyframes [t, psi deg, omega deg/s] ----------
const KIN = kinematics();
const FAST = 576; // 1.6 rev/s in the hook
const keys = [];
{
  const E1 = 360 * 6 - 45;              // the slow step's entry angle (pin meets the slot)
  const p2 = E1 - 62, t2rel = 1.4;      // end of the slow-down
  const p1 = p2 - 440;                  // hook ends here, at full speed
  const base = p1 - FAST * 3.0;
  const p0 = base - (((base - 180) % 360) + 360) % 360; // start locked, pin on the far side
  const t1 = (p1 - p0) / FAST;
  const t2 = t1 + t2rel;
  keys.push([0, p0, FAST], [t1, p1, FAST], [t2, p2, 42]);
  keys.push([t2 + 1.3, E1 - 7, 9]);      // creep up to the slot mouth
  keys.push([t2 + 2.1, E1 + 3, 12]);     // the pin slides in tangentially
  keys.push([t2 + 5.1, E1 + 87, 26]);    // one quarter turn of the wheel, slowly
  keys.push([t2 + 5.9, E1 + 95, 8]);     // locked again
  const t7 = t2 + 7.9;
  keys.push([t7, E1 + 200, 110]);
  const t8 = t7 + 2.0, p8 = E1 + 200 + (110 + 720) / 2 * 2.0;
  keys.push([t8, p8, 720]);
  const tStop = 23.1, t9 = tStop - 1.9;
  const p9 = p8 + 720 * (t9 - t8);
  let pf = p9 + 720 * 1.9 / 2; // natural stop distance
  pf = pf - ((((pf - 180) % 360) + 360) % 360); // stop locked, pin on the far side
  if (pf - p9 < 720 * 1.9 / 3 + 5) pf += 360;
  keys.push([t9, p9, 720], [tStop, pf, 0], [24.5, pf, 0]);
}
const psiAt = (t) => {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, p0, v0] = keys[i - 1], [t1, p1, v1] = keys[i];
      const h = t1 - t0, u = (t - t0) / h;
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
      return h00 * p0 + h10 * h * v0 + h01 * p1 + h11 * h * v1;
    }
  }
  return keys[keys.length - 1][1];
};
// monotone check + events from the same model
const EVENTS = [{ t: 0.12, type: "whoosh", i: 0.55 }];
{
  let prev = psiAt(0), lastT = -1;
  const dt = 0.0005;
  for (let t = dt; t <= 24; t += dt) {
    const p = psiAt(t);
    if (p < prev - 1e-6) throw new Error("tour not monotone at " + t.toFixed(3));
    const w = (p - prev) / dt;
    for (const [phase, kind] of [[-45, "in"], [0, "mid"], [45, "out"]]) {
      const n0 = Math.floor((prev - phase) / 360), n1 = Math.floor((p - phase) / 360);
      if (n1 > n0) {
        const fast = w > 150;
        if (fast) { if (kind === "in") EVENTS.push({ t: +t.toFixed(3), type: "tick", i: +Math.min(1, 0.45 + w / 2000).toFixed(2) }); }
        else if (kind === "in") EVENTS.push({ t: +t.toFixed(3), type: "click", i: 0.9 });
        else if (kind === "mid") EVENTS.push({ t: +t.toFixed(3), type: "slide", i: 0.7 });
        else EVENTS.push({ t: +t.toFixed(3), type: "thunk", i: 0.85 });
      }
    }
    prev = p; void lastT;
  }
  const tUp = keys[6][0] + 0.6;
  EVENTS.push({ t: +tUp.toFixed(2), type: "whoosh", i: 0.7 });
  EVENTS.push({ t: +(keys[keys.length - 2][0]).toFixed(2), type: "turn", i: 0.5 });
  EVENTS.sort((a, b) => a.t - b.t);
}

// ---------- static art with slots ----------
const scene = makeScene(k, G, P);
const stateOf = (psiDeg) => {
  const q = KIN.pose(psiDeg * Math.PI / 180);
  const filmRot = q.rot - Math.PI / 4;
  const m = 8 * C.pitch;
  const fo = filmRot * C.drumR;
  const shut = Math.max(0, Math.min(1, (Math.abs(q.beta) - Math.PI / 4) / 0.22));
  return { pinA: q.pinA, wheelA: KIN.angGD + q.rot, filmOff: ((fo % m) + m) % m, rollA: -fo / C.rollR, glow: shut * shut * (3 - 2 * shut), steps: Math.round(filmRot / (Math.PI / 2)) };
};
const s0 = stateOf(psiAt(0));
const body = scene.list.map((it) => (it.dyn ? `<g data-dyn="${it.dyn}">${scene.dyn(it.dyn, s0)}</g>` : it.svg)).join("");
const LABEL = "A Geneva drive on a projector bench. A motor turns a crank whose red pin enters one of the four radial slots of a brass Maltese-cross wheel once per turn and turns it a quarter turn; between steps the orange locking disc holds the wheel still. The wheel's shaft carries a 16-tooth sprocket that pulls 35 mm film four perforations, one frame, per step through a lit gate.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body });

const moduleOf = (src, prelude = "") => {
  const names = [...src.matchAll(/^export\s+(?:const|function|let|class)\s+(\w+)/gm)].map((m) => m[1]);
  const code = src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
  return `(() => {${prelude}\n${code}\nreturn { ${names.join(", ")} };})()`;
};
const inline = `
const k = ${moduleOf(readFileSync(join(KIT, "iso-kit.mjs"), "utf8"))};
const SC = ${moduleOf(readFileSync(join(HERE, "scene.mjs"), "utf8"))};
`;
const live = ({ short }) => `
${inline}
const P = ${JSON.stringify(P)};
const KEYS = ${JSON.stringify(keys)};
const C = SC.C;
window.__events = ${JSON.stringify(EVENTS)};
const KIN = SC.kinematics();
const scene = SC.makeScene(k, null, P, { dynOnly: true });
const slots = [...document.querySelectorAll("[data-dyn]")];
const readout = document.querySelector("[data-readout]");
const SHORT = ${short};
function psiAt(t) {
  for (let i = 1; i < KEYS.length; i++) {
    if (t <= KEYS[i][0]) {
      const [t0, p0, v0] = KEYS[i - 1], [t1, p1, v1] = KEYS[i];
      const h = t1 - t0, u = (t - t0) / h;
      return (2*u**3 - 3*u**2 + 1) * p0 + (u**3 - 2*u**2 + u) * h * v0 + (-2*u**3 + 3*u**2) * p1 + (u**3 - u**2) * h * v1;
    }
  }
  return KEYS[KEYS.length - 1][1];
}
const stateOf = ${stateOf.toString()};
let lastKey = "";
function draw(psi, w) {
  const st = stateOf(psi);
  const key = psi.toFixed(3);
  if (key !== lastKey) { lastKey = key; for (const g of slots) g.innerHTML = scene.dyn(g.dataset.dyn, st); }
  if (readout) {
    const text = (w / 360).toFixed(2) + " rev/s · wheel " + (st.glow < 0.99 ? "turning" : "locked") + " · frame " + (((st.steps % 1000) + 1000) % 1000);
    if (readout.textContent !== text) readout.textContent = text;
  }
}
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
const t0 = performance.now();
let loopBase = 0;
const SPAN = KEYS[KEYS.length - 2][1] - KEYS[0][1];
function frame(now) {
  holdClock();
  let T = Math.max(0, (now - t0) / 1000);
  window.__T = T;
  let psi;
  if (SHORT) psi = psiAt(Math.min(T, 24));
  else { const n = Math.floor(T / 24); psi = psiAt(T - n * 24) + n * SPAN; T = T - n * 24; }
  const w = (psiAt(Math.min(24, T + 0.01)) - psiAt(Math.max(0, T - 0.01))) / 0.02;
  draw(psi, w);
  requestAnimationFrame(frame);
}
draw(psiAt(0), ${FAST});
requestAnimationFrame(frame);
`;

// figure page
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Geneva drive",
  hint: "Watch the red pin: one turn, one frame",
  readout: "1.60 rev/s · wheel locked · frame 0",
  keys: [
    { mark: "lit", label: "Drive pin: enters a slot tangentially, turns the wheel 90°, leaves" },
    { mark: "raised", label: "Locking disc: holds the wheel still for the other 270° of each turn" },
  ],
  caption: `Four slots, centre distance ${C.a}: the crank radius is ${C.a} · sin 45° = ${C.R.toFixed(1)}, so the pin meets each slot moving straight along it and the wheel starts and stops without a knock. The wheel turns during a quarter of each crank turn and dwells for three quarters. Its 16-tooth sprocket moves 35 mm film one 19 mm frame (four perforations) per step; a projector does this 24 times a second while the shutter hides the move.`,
  body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Geneva drive">${svg}</div>`,
});
const css = `<style>.iso-stage{outline:none}\n${PALETTE_CSS}</style>`;
writeFileSync(join(HERE, "geneva-light.html"), k.pageHtml({ title: "Geneva drive", theme: "light", body: plate + css, script: live({ short: false }), width: 760 }));

// short page
const aspect = H / W;
const figWv = 92; // vw
const figHvh = (figWv / 100) * 415 * aspect / 738 * 100;
const topVh = 29;
const shortCss = `
html,body{height:100%;margin:0;overflow:hidden}
body.iso[data-theme="light"]{--anatomy-page:#f6f3ec;--anatomy-paper:#f6f3ec;--anatomy-card:#f6f3ec;--anatomy-face:#fffdf8;--anatomy-top:#fffdf8;--anatomy-lit-top:#ffffff;
 --anatomy-shade-0:#d9d5cc;--anatomy-shade-1:#e3e0d8;--anatomy-shade-2:#ece9e2;--anatomy-shade-3:#f4f2ec;--anatomy-halo:#857e6c;--anatomy-weight:.8px;
 background:radial-gradient(120% 70% at 50% 62%,#fbf9f4 0%,#f6f3ec 55%,#efebe2 100%)}
.short{position:fixed;inset:0}
.short .iso-svg{position:absolute;left:${(100 - figWv) / 2}vw;width:${figWv}vw;top:${topVh.toFixed(2)}vh}
`;
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Geneva drive short</title><style>${k.ISO_CSS}${PALETTE_CSS}\n${shortCss}</style></head><body class="iso" data-theme="light"><main class="short">${svg}</main><script type="module">${live({ short: true }).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.tour.json"), JSON.stringify(EVENTS, null, 1));
console.log({ W, H, aspect: aspect.toFixed(3), figHvh: figHvh.toFixed(1), topVh: topVh.toFixed(1), paths: (svg.match(/<path/g) || []).length, kb: Math.round(shortHtml.length / 1024), keys: keys.map((x) => x.map((v) => +v.toFixed(2))), events: EVENTS.length, sd: KIN.sd });

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['geneva-light.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
