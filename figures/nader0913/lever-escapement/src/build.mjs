// Mechanical watch movement (28,800 bph Swiss lever) in a movement holder.
// node build.mjs -> watch-light.html (figure page, light, scene.js) + short.html (60 s chapter tour, scene2.js + tour.js) + events.preview.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL_SRC = readFileSync(join(HERE, "model.js"), "utf8");
const SCENE_SRC = readFileSync(join(HERE, "scene.js"), "utf8");
const SCENE2_SRC = readFileSync(join(HERE, "scene2.js"), "utf8");
const TOUR_SRC = readFileSync(join(HERE, "tour.js"), "utf8");
import { makeWatch } from "./model.gen.mjs";
import { makeScene } from "./scene.gen.mjs";
import { makeScene2 } from "./scene2.gen.mjs";
import { makeTour } from "./tour.gen.mjs";
const M = makeWatch();

// ---------- camera ----------
const AZ = -35, EL = 50;
const W = 400, FIG_H = 318;
const bound = [];
for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; for (const z of [-3.4, 0.4]) bound.push([(M.PLATE_R + 1.9) * Math.cos(a), (M.PLATE_R + 1.9) * Math.sin(a), z]); }
bound.push([M.BAL[0], M.BAL[1], 4.6]);
const P = k.fitProjection(bound, W, FIG_H, { pad: 8, azimuth: AZ, elevation: EL });

// ---------- palette: one four-tone ramp per hue, outlines in a dark ink of the same hue ----------
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (c, w, t) => "#" + hex(c).map((v, i) => Math.round(v + (hex(w)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const W_ = "#ffffff", K_ = "#1b1d22";
function rampVars(b, { top = 0.5, s3 = 0.3, s2 = 0.12, s1 = -0.04, s0 = -0.2, ink = 0.62 } = {}) {
  const tone = (t) => (t >= 0 ? mix(b, W_, t) : mix(b, K_, -t));
  return [["paper", tone(s2)], ["face", tone(s2 + 0.08)], ["top", tone(top)], ["lit-top", tone(top + 0.08)], ["lit-shade", tone(s3)],
    ["shade-3", tone(s3)], ["shade-2", tone(s2)], ["shade-1", tone(s1)], ["shade-0", tone(s0)],
    ["hi", mix(b, K_, ink)], ["mid", mix(b, K_, ink - 0.2)], ["lo", mix(b, K_, ink - 0.38)], ["faint", mix(b, K_, 0.14)], ["lit", mix(b, K_, ink + 0.08)], ["dot", mix(b, K_, 0.7)]];
}
const RAMPS = {
  bench: rampVars("#5b7fa6", { top: 0.62, s3: 0.46, s2: 0.3, s1: 0.12, s0: -0.04 }),
  steel: rampVars("#5b7fa6", { top: 0.44, s3: 0.28, s2: 0.1, s1: -0.06, s0: -0.2 }),
  orange: rampVars("#e8823a", { top: 0.42, s3: 0.26, s2: 0.1, s1: -0.06, s0: -0.22 }),
  gold: rampVars("#d9a441", { top: 0.46, s3: 0.28, s2: 0.1, s1: -0.06, s0: -0.22 }),
  teal: rampVars("#2f9e9a", { top: 0.46, s3: 0.28, s2: 0.1, s1: -0.06, s0: -0.22 }),
  red: rampVars("#d6453d", { top: 0.4, s3: 0.24, s2: 0.08, s1: -0.08, s0: -0.24, ink: 0.66 }),
  ruby: rampVars("#e0675f", { top: 0.55, s3: 0.36, s2: 0.18, s1: 0.0, s0: -0.16, ink: 0.66 }),
  plum: rampVars("#a8486f", { top: 0.42, s3: 0.26, s2: 0.1, s1: -0.06, s0: -0.22, ink: 0.66 }),
  grey: rampVars("#8a929c", { top: 0.55, s3: 0.36, s2: 0.18, s1: 0.0, s0: -0.16, ink: 0.7 }),
  blued: rampVars("#2f5a9e", { top: 0.3, s3: 0.16, s2: 0.0, s1: -0.14, s0: -0.3, ink: 0.7 }),
  cream: rampVars("#efe7d4", { top: 0.6, s3: 0.3, s2: 0.1, s1: -0.06, s0: -0.16, ink: 0.72 }),
};
const PALETTE_CSS = Object.entries(RAMPS).map(([n, vs]) => `.pc-${n}{${vs.map(([a, c]) => `--anatomy-${a}:${c}`).join(";")}}`).join("\n");
const EXTRA_CSS = `
.wt-perlage{stroke-width:.3px;opacity:.4}
.wt-cut{fill:#dfe8f3;stroke:none}
.wt-hatchline{stroke-width:.35px}
.wt-hair{stroke-width:.55px}
.wt-spring{stroke-width:.5px}
.wt-floor{fill:#7c5a1c}
.wt-cutface{fill:#f2dca8;stroke:#6b4b10;stroke-width:.35px}
.wt-hatch{stroke:#a07a2c;stroke-width:.35px;fill:none}
.iso-svg{--anatomy-weight:.6px}
`;

// ====================================================================================
// figure page (unchanged: scene.js, real time, hover for slow motion)
// ====================================================================================
{
  const scene = makeScene(k, M, P);
  const S0 = M.state(M.realOf(0));
  const bodyInner = scene.list.map((it) => (it.dyn ? `<g data-dyn="${it.dyn}">${scene.dyn(it.dyn, S0)}</g>` : it.svg)).join("");
  const LABEL = "A mechanical watch movement lying in a movement holder, seen from the back. The mainspring barrel drives the centre, third and fourth wheels at true ratios; the fourth wheel carries a small seconds hand and drives the 15-tooth escape wheel. The pallet fork locks and releases the escape wheel half a tooth per swing of the balance wheel, which swings four times a second (28,800 beats per hour).";
  const svgFig = k.figureSvg({ width: W, height: FIG_H, label: LABEL, body: bodyInner });
  const SCENE_K = "{ iso, cameraOf, depthOf, cylinder, solidSvg, lineSvg, dotsSvg, ring, sideArc, lineOnTop }";
  const LIVE_FIG = `
${MODEL_SRC}
${SCENE_SRC}
const P = ${JSON.stringify(P)};
const M = makeWatch();
const SC = makeScene(${SCENE_K}, M, P, { dynOnly: true });
const slots = [...document.querySelectorAll("[data-dyn]")].map((g) => [g, g.dataset.dyn]);
const prev = new Map();
let lastKey = "";
function draw(S) {
  const key = S.esc.toFixed(5) + "|" + S.phi.toFixed(4) + "|" + S.psi.toFixed(5);
  if (key === lastKey) return;
  lastKey = key;
  const made = {};
  for (const [g, n] of slots) { const html = made[n] || (made[n] = SC.dyn(n, S)); if (prev.get(g) !== html) { g.innerHTML = html; prev.set(g, html); } }
}
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let r = 0, last = 0, slow = 0, slowT = 0, raf = 0, visible = false;
stage.addEventListener("pointerenter", () => (slowT = 1));
stage.addEventListener("pointerleave", () => (slowT = 0));
stage.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); slowT = 1 - slowT; } });
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
  last = now;
  slow += (slowT - slow) * (1 - Math.exp(-dt / 0.35));
  const near = Math.abs(M.phiOf(r)) < 40 * Math.PI / 180 ? 1 / 9 : 1;
  const v = Math.exp((Math.log(1 / 20)) * slow) * (slow > 0.5 ? near : 1);
  if (!still.matches) r += dt * v;
  const S = M.state(r);
  draw(S);
  const text = (slow > 0.5 ? "slow motion · " : "28,800 bph · ") + "beat " + S.n + " · lever " + (S.psi * 180 / Math.PI).toFixed(1) + "° · " + ["locked", "unlocking / impulse", "drop", "locked"][S.phase];
  if (readout.textContent !== text) readout.textContent = text;
  raf = visible ? requestAnimationFrame(tick) : 0;
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); } }).observe(stage);
`;
  const fig = k.plateHtml({
    fig: "Fig 1", title: "Lever escapement", hint: "Hover to slow it down 20x", readout: "28,800 bph · beat 0 · lever 7.0° · locked",
    keys: [{ mark: "lit", label: "Pallet fork: two stones lock and release the escape wheel" }, { mark: "raised", label: "Balance and hairspring: 4 swings a second" }],
    caption: "The barrel drives the centre wheel (1 turn an hour), third wheel (8 an hour), fourth wheel (1 a minute, small seconds) and the 15-tooth escape wheel (16 a minute). Each swing of the balance unlocks one pallet stone; a tooth slides across its slanted face and gives the balance a push, then the wheel drops onto the other stone: half a tooth, 12°, per beat, 8 beats a second.",
    body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Watch movement: hover to slow down">${svgFig}</div>`,
  });
  const FIG_PALETTE = PALETTE_CSS + "\n.pc-red{}";
  writeFileSync(join(HERE, "watch-light.html"), k.pageHtml({ title: "Lever escapement", theme: "light", body: fig + `<style>${FIG_PALETTE}${EXTRA_CSS}</style>`, script: kitScript() + LIVE_FIG, width: 640 }));
}

// ====================================================================================
// short: 60 s chapter tour (scene2.js + tour.js)
// ====================================================================================
const VW = 400, VH = 711.11;
const PAPER = "#f6f3ec";
// keyless works bodies from the kit's lathe (static), along the stem axis
const pre = (() => {
  const probe = makeScene2(k, M, P, { dynOnly: true });
  const g = probe.geo;
  const F = G.frameAlong([0, 0, g.STEM_Z], [g.SDIR[0], g.SDIR[1], 0]);
  const stem = G.disc(g.WPs[1], g.CR0 + 0.1, 0.24, F, P);
  const wpinion = G.disc(g.WPs[0], g.WPs[1], g.WP_R, F, P);
  const c0 = g.CR0, c1 = g.CR1, R = g.CR_R;
  const crown = G.lathe([[c0, 0], [c0, 0.55], [c0 + 0.12, 0.62], [c0 + 0.18, R - 0.12], [c0 + 0.3, R], [c1 - 0.22, R], [c1 - 0.08, R - 0.14], [c1, R - 0.42], [c1, 0]], F, P);
  return { stem, wpinion, crown };
})();
const scene2 = makeScene2(k, M, P, { pre });
const g2 = scene2.geo;
const TR0 = makeTour(M, { FULL: [0, 0, 1], LX: [0, 0, 1], L4: [0, 0, 1], L5: [0, 0, 1], L0: [0, 0, 1] });
const S0 = TR0.stateAt(0);
const sceneInner = scene2.list.map((it) => (it.dyn ? `<g data-dyn="${it.dyn}"${it.g ? ` data-g="${it.g}"` : ""}>${scene2.dyn(it.dyn, S0)}</g>` : it.svg)).join("");
const xray2Inner = scene2.x2list.map((it) => (it.dyn ? `<g data-dyn="${it.dyn}">${scene2.dyn(it.dyn, S0)}</g>` : it.svg)).join("");
const xrayInner = scene2.xlist.map((it) => (it.dyn ? `<g data-dyn="${it.dyn}">${scene2.dyn(it.dyn, S0)}</g>` : it.svg)).join("");

// ---------- camera framings: bbox of a stage's points, filling ~88% of the width ----------
const ring3 = (c, r, z, n = 48) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * 2 * Math.PI), c[1] + r * Math.sin((i / n) * 2 * Math.PI), z]);
const crownPts = (() => { const out = []; for (const s of [g2.ST1 - 1, g2.CR1]) for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI; out.push([g2.SDIR[0] * s - g2.SDIR[1] * g2.CR_R * Math.cos(a), g2.SDIR[1] * s + g2.SDIR[0] * g2.CR_R * Math.cos(a), g2.STEM_Z + g2.CR_R * Math.sin(a)]); } return out; })();
function frame(pts, { fill = 0.88, maxH = 300, dy = 0 } = {}) {
  const q = pts.map((p) => k.iso(p, P));
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((fill * VW) / (x1 - x0), maxH / (y1 - y0));
  return [+((x0 + x1) / 2).toFixed(2), +((y0 + y1) / 2 + dy).toFixed(2), +s.toFixed(4)];
}
const { B, C, TH, FO, E, A, BAL } = M;
const forkPts = [...ring3(A, 1.0, 2.1, 12), ...ring3(M.add(A, M.pol(M.LEVER - M.RP, M.LINE)), 0.6, 2.1, 12)];
const CAM = {
  FULL: frame([...ring3([0, 0], g2.HOLD_R + 0.3, -1.8, 90), ...ring3([0, 0], g2.HOLD_R + 0.3, 0.8, 90), ...crownPts, ...ring3([0, 0], g2.HOLD_R, -3.4, 30)], { fill: 0.9, maxH: 300 }),
  C1: frame([...crownPts, ...ring3(B, M.rB + 0.2, 1.3), ...ring3(B, M.rB + 0.2, 2.6), ...ring3(g2.CW, g2.CW_R + 0.3, 2.6, 24)], { maxH: 290 }),
  C2: frame([...ring3(B, M.rB + 0.3, 1.0), ...ring3(B, M.rB + 0.3, 2.4), ...ring3(C, M.rC + 0.3, 1.5)], { maxH: 290 }),
  C3a: frame([...ring3(C, M.rC + 0.4, 1.5), ...ring3(TH, M.rT + 0.4, 0.7)], { maxH: 460 }),
  C3b: frame([...ring3(TH, M.rT + 0.4, 0.7), ...ring3(FO, 4.6, 1.0), ...ring3(FO, 4.6, 3.3)], { maxH: 460 }),
  C3c: frame([...ring3(FO, 4.6, 1.0), ...ring3(FO, 4.6, 3.3), ...ring3(E, M.RE + 0.6, 2.0), ...forkPts.slice(0, 12)], { maxH: 460 }),
  C4: frame([...ring3(E, M.RE + 0.4, 1.9), ...ring3(E, M.RE + 0.4, 2.3), ...forkPts], { fill: 0.86, maxH: 290 }),
  C5: frame([...ring3(BAL, M.BAL_R + 0.3, 3.0), ...ring3(BAL, M.BAL_R + 0.3, 4.0), ...ring3(A, 1.0, 2.1, 12)], { fill: 0.88, maxH: 290 }),
};
// loupe focus points [x, y, zoom] in scene units (loupe radius LR)
const LCX = 200, LCY = 590, LR = 110;
const isoP = (x, y, z) => k.iso([x, y, z], P);
const LX = (() => { const c = isoP(B[0], B[1], 0.9), e = ring3(B, M.rB + 0.25, 0.9).map((p) => k.iso(p, P)); const w = Math.max(...e.map((p) => p[0])) - Math.min(...e.map((p) => p[0])); return [+c[0].toFixed(2), +c[1].toFixed(2), +((2 * LR * 0.9) / w).toFixed(3)]; })();
const L4 = (() => { const q1 = M.add(E, M.pol(M.RE, M.entry.a)), q2 = M.add(E, M.pol(M.RE, M.exit.a)); const m = [(q1[0] + q2[0]) / 2 * 0.75 + A[0] * 0.25, (q1[1] + q2[1]) / 2 * 0.75 + A[1] * 0.25]; const c = isoP(m[0], m[1], 2.0); const span = Math.hypot(...M.sub(isoP(...q1, 2), isoP(...q2, 2))) + 1.6 * P.scale * 1.5; return [+c[0].toFixed(2), +c[1].toFixed(2), +((2 * LR * 0.9) / span).toFixed(3)]; })();
const L0 = (() => { const m = M.add(E, [(A[0] - E[0]) * 0.55, (A[1] - E[1]) * 0.55]); const c = isoP(m[0], m[1], 2.0); return [+c[0].toFixed(2), +c[1].toFixed(2), +(CAM.FULL[2] * 3.6).toFixed(3)]; })();
const L5 = (() => { const m = M.add(BAL, M.pol(0.75, M.LINE + Math.PI)); const c = isoP(m[0], m[1], 2.3); return [+c[0].toFixed(2), +c[1].toFixed(2), +(CAM.C5[2] * 1.7).toFixed(3)]; })();
L4[2] = +(CAM.C4[2] * 2.0).toFixed(3);
Object.assign(CAM, { LX, L4, L5, L0 });
const TR = makeTour(M, CAM);
const EVENTS = TR.eventsOf();

const SHORT_CSS = `
html,body{height:100%;overflow:hidden;margin:0}
body.iso[data-theme="light"]{--anatomy-page:${PAPER};--anatomy-paper:${PAPER};--anatomy-card:${PAPER};--anatomy-face:#fffdf8;--anatomy-top:#fffdf8;--anatomy-lit-top:#ffffff;
 --anatomy-shade-0:#d9d5cc;--anatomy-shade-1:#e3e0d8;--anatomy-shade-2:#ece9e2;--anatomy-shade-3:#f4f2ec;--anatomy-halo:#857e6c;background:${PAPER}}
.short{position:fixed;inset:0}
.short svg.iso-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden}
.wt-perlage{stroke-width:calc(var(--anatomy-weight)*.5);opacity:.4}
.wt-cut{fill:#dfe8f3;stroke:none}
.wt-hatchline{stroke-width:calc(var(--anatomy-weight)*.6)}
.wt-hair{stroke-width:calc(var(--anatomy-weight)*.9)}
.wt-knurl{stroke-width:calc(var(--anatomy-weight)*.8)}
.wt-sp-o{fill:none;stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight)*1.7);stroke-linecap:round;stroke-linejoin:round}
.wt-sp-i{fill:none;stroke:var(--anatomy-shade-2);stroke-width:calc(var(--anatomy-weight)*.7);stroke-linecap:round;stroke-linejoin:round}
.wt-floor{fill:var(--anatomy-shade-0)}
.wt-xwall{fill:var(--anatomy-shade-1)}
.wt-xfloor{fill:var(--anatomy-shade-2)}
.wt-cutface{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight)}
.wt-loupe-glass{fill:#fbf9f4}
.wt-loupe-rim{fill:none;stroke:#7f9fc8;stroke-width:6px}
.wt-loupe-edge{fill:none;stroke:#1f3550;stroke-width:.9px}
.wt-loupe-shine{fill:none;stroke:#ffffff;stroke-width:2.2px;opacity:.55;stroke-linecap:round}
`;
const shine = `M${LCX - LR * 0.72} ${LCY - LR * 0.45}A${LR * 0.86} ${LR * 0.86} 0 0 1 ${LCX - LR * 0.28} ${LCY - LR * 0.8}`;
const svgShort = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="A watch movement, explained stage by stage: the crown winds the mainspring, the barrel drives the gear train, the escape wheel and pallet fork release it one tooth at a time, and the balance wheel swings four times a second.">` +
  `<defs><linearGradient id="wt-topfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PAPER}"/><stop offset=".8" stop-color="${PAPER}"/><stop offset="1" stop-color="${PAPER}" stop-opacity="0"/></linearGradient>` +
  `<clipPath id="wt-loupe-clip" clipPathUnits="userSpaceOnUse"><circle cx="${LCX}" cy="${LCY}" r="${LR}"/></clipPath>` +
  `<g id="wt-xray">${xrayInner}</g><g id="wt-xray2">${xray2Inner}</g></defs>` +
  `<g id="wt-cam"><g id="wt-scene">${sceneInner}</g></g>` +
  `<rect x="0" y="0" width="${VW}" height="196" fill="url(#wt-topfade)"/>` +
  `<g id="wt-loupe"><circle class="wt-loupe-glass" cx="${LCX}" cy="${LCY}" r="${LR}"/>` +
  `<g clip-path="url(#wt-loupe-clip)"><g id="wt-lc"><use id="wt-lx" href="#wt-xray" style="display:none"/><use id="wt-ls" href="#wt-scene"/><use id="wt-lu" href="#wt-xray2" style="display:none"/></g></g>` +
  `<path class="wt-loupe-shine" d="${shine}"/><circle class="wt-loupe-rim" cx="${LCX}" cy="${LCY}" r="${LR + 3}"/><circle class="wt-loupe-edge" cx="${LCX}" cy="${LCY}" r="${LR + 6}"/><circle class="wt-loupe-edge" cx="${LCX}" cy="${LCY}" r="${LR}"/></g>` +
  `</svg>`;

const RAMP_JS = Object.fromEntries(Object.entries(RAMPS).map(([n, vs]) => [n, vs.map(([a, c]) => [a, hex(c)])]));
const SCENE_K = "{ iso, cameraOf, depthOf, cylinder, solidSvg, lineSvg, dotsSvg, ring, sideArc, lineOnTop }";
const LIVE_SHORT = `
${MODEL_SRC}
${SCENE2_SRC}
${TOUR_SRC}
const P = ${JSON.stringify(P)};
const M = makeWatch();
const CAM = ${JSON.stringify(CAM)};
const TR = makeTour(M, CAM);
const SC = makeScene2(${SCENE_K}, M, P, { dynOnly: true });
window.__events = ${JSON.stringify(EVENTS)};
window.__tour = { len: TR.LEN, chapters: TR.CH };
const RAMPS = ${JSON.stringify(RAMP_JS)};
const PAPER = ${JSON.stringify(hex(PAPER))};
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const D2R = Math.PI / 180, ESC_W = 2 * Math.PI * 16 / 60;
// ---------- slot kinds: how each moving slot is sampled (motion blur) or replaced by its "spinning" picture ----------
const W_ = (rot, pitchDeg, ratio) => ({ wheel: true, rot, pitch: pitchDeg * D2R, w: Math.abs(ratio) * ESC_W });
const KIND = {
  barrel: W_((S) => S.barrel, 5, M.ratio.barrel), xteeth: W_((S) => S.barrel, 5, M.ratio.barrel), xin: W_((S) => S.barrel, 30, M.ratio.barrel),
  centre: W_((S) => S.esc * M.ratio.centre, 4.5, M.ratio.centre), centrePinion: W_((S) => S.esc * M.ratio.centre, 30, M.ratio.centre),
  third: W_((S) => S.esc * M.ratio.third, 4.8, M.ratio.third), thirdPinionLo: W_((S) => S.esc * M.ratio.third, 36, M.ratio.third), thirdPinionHi: W_((S) => S.esc * M.ratio.third, 36, M.ratio.third),
  fourth: W_((S) => S.esc * M.ratio.fourth, 3.2, M.ratio.fourth), fourthPinionLo: W_((S) => S.esc * M.ratio.fourth, 36, M.ratio.fourth), fourthPinionHi: W_((S) => S.esc * M.ratio.fourth, 36, M.ratio.fourth),
  seconds: W_((S) => S.esc * M.ratio.fourth, 30, M.ratio.fourth),
  escape: W_((S) => S.esc, 24, 1), escPinionLo: W_((S) => S.esc, 51, 1), escPinionHi: W_((S) => S.esc, 51, 1),
  stonesLo: { reg: true }, fork: { reg: true }, roller: { reg: true }, balance: { reg: true }, hairspring: { reg: true },
  crownRibs: { rot: (S) => S.crown, pitch: 20 * D2R }, wpRibs: { rot: (S) => S.crown, pitch: 30 * D2R }, crownWheel: { rot: (S) => 2 * S.arbor, pitch: 24 * D2R }, ratchet: { rot: (S) => S.arbor, pitch: 12 * D2R },
};
const slots = [...document.querySelectorAll("[data-dyn]")].map((g) => ({ g, n: g.dataset.dyn, prev: "", x: g.closest("#wt-xray") ? "x" : g.closest("#wt-xray2") ? "u" : "" }));
const ghosts = [...document.querySelectorAll("[data-g]")].map((g) => ({ g, k: g.dataset.g, prev: -1 }));
const blurCache = {};
const blurOf = (n) => (n in blurCache ? blurCache[n] : (blurCache[n] = SC.blur(n)));
// regulating organ spinning too fast to follow: the average of 8 phases of one swing (time-independent)
const regCache = {};
function regBlur(n) {
  if (n in regCache) return regCache[n];
  let h = "";
  for (let i = 0; i < 8; i++) { const S = M.state(0.0101 + (i / 8) * 0.25); S.barrel = 0; S.arbor = 0; S.crown = 0; S.click = 0; S.N = 11; h += i ? '<g opacity="' + (1 / (i + 1)).toFixed(3) + '">' + SC.dyn(n, S) + "</g>" : SC.dyn(n, S); }
  return (regCache[n] = h);
}
const EXPO = 1 / 60;
const wrapAvg = (parts) => parts.map((h, i) => (i ? '<g opacity="' + (1 / (i + 1)).toFixed(3) + '">' + h + "</g>" : h)).join("");
function slotHtml(n, t, St, ts, sub) {
  const kd = KIND[n];
  if (!kd) return SC.dyn(n, St(0.5));
  let b = 0, N = 1;
  if (kd.wheel) {
    const vavg = kd.w * ts * EXPO / kd.pitch;
    b = SC.hasBlur(n) ? sm((vavg - 0.55) / 0.8) : 0;
    const d = Math.abs(kd.rot(St(1)) - kd.rot(St(0)));
    N = Math.max(1, Math.min(8, Math.ceil(d / (kd.pitch * 0.14))));
  } else if (kd.reg) {
    b = sm((Math.log(Math.max(ts, 1e-6)) - Math.log(1.5)) / (Math.log(5) - Math.log(1.5)));
    let tv = 0, p0 = St(0).phi;
    for (let j = 1; j <= 6; j++) { const p1 = St(j / 6).phi; tv += Math.abs(p1 - p0); p0 = p1; }
    N = Math.max(1, Math.min(8, Math.ceil(tv / (11 * D2R))));
  } else if (kd.rot) {
    const d = Math.abs(kd.rot(St(1)) - kd.rot(St(0)));
    N = Math.max(1, Math.min(6, Math.ceil(d / (kd.pitch * 0.14))));
  }
  let h = "";
  if (b < 0.999) {
    const parts = [];
    if (N === 1) parts.push(SC.dyn(n, St(0.5)));
    else for (let i = 0; i < N; i++) parts.push(SC.dyn(n, St(i / (N - 1))));
    h = wrapAvg(parts);
    if (b > 0.001) h = '<g opacity="' + (1 - b).toFixed(3) + '">' + h + "</g>";
  }
  if (b > 0.001) h += '<g opacity="' + b.toFixed(3) + '">' + (kd.reg ? regBlur(n) : blurOf(n)) + "</g>";
  return h;
}
// ---------- colours: each painted group is tinted toward red (highlight) and toward the paper (recede) ----------
const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const styleCache = new Map();
function styleOf(cls, h, f) {
  const key = cls + "|" + h.toFixed(3) + "|" + f.toFixed(3);
  let s = styleCache.get(key);
  if (s !== undefined) return s;
  const base = RAMPS[cls], red = RAMPS.red;
  if (!base || (h < 0.0005 && f < 0.0005)) s = "";
  else s = base.map(([a, c], i) => { const r = red[i][1]; const m = c.map((v, j) => v + (r[j] - v) * h).map((v, j) => v + (PAPER[j] - v) * f); return "--anatomy-" + a + ":" + toHex(m); }).join(";");
  if (styleCache.size > 5000) styleCache.clear();
  styleCache.set(key, s);
  return s;
}
const camG = document.getElementById("wt-cam"), loupe = document.getElementById("wt-loupe"), lc = document.getElementById("wt-lc");
const lx = document.getElementById("wt-lx"), ls = document.getElementById("wt-ls"), lu = document.getElementById("wt-lu");
const LCX = ${LCX}, LCY = ${LCY};
let lastT = null;
function render(T) {
  if (T === lastT) return;
  lastT = T;
  const ts = TR.tsOf(T);
  const cache = new Map();
  const St = (q) => { const key = q.toFixed(4); let S = cache.get(key); if (!S) { S = TR.stateAt(T + (q - 0.5) * EXPO); cache.set(key, S); } return S; };
  const L = TR.loupeAt(T);
  for (const sl of slots) {
    if (sl.x && !(L.o > 0.002 && L.w[sl.x] > 0.002)) continue;
    const html = slotHtml(sl.n, T, St, ts);
    if (html !== sl.prev) { sl.g.innerHTML = html; sl.prev = html; }
  }
  // looks
  const look = TR.lookAt(T);
  for (const el of document.querySelectorAll("[data-p]")) {
    const p = el.getAttribute("data-p"), v = look[p];
    if (!v) continue;
    const cls = el.getAttribute("class").slice(3);
    const s = styleOf(cls, v[0], v[1] * 1);
    if (el.__s !== s) { el.style.cssText = s; el.__s = s; }
  }
  for (const gh of ghosts) { const v = look[gh.k]; const o = v ? +v[2].toFixed(3) : 1; if (o !== gh.prev) { gh.g.setAttribute("opacity", o); gh.prev = o; } }
  // camera
  const c = TR.camAt(T);
  camG.setAttribute("transform", "translate(200 " + c.Y.toFixed(3) + ") scale(" + c.s.toFixed(5) + ") translate(" + (-c.cx).toFixed(3) + " " + (-c.cy).toFixed(3) + ")");
  camG.style.setProperty("--anatomy-weight", (0.6 / Math.sqrt(c.s)).toFixed(4) + "px");
  // loupe
  if (L.o > 0.002) {
    loupe.style.display = "";
    loupe.setAttribute("opacity", L.o.toFixed(3));
    const sc = 0.86 + 0.14 * L.o;
    loupe.setAttribute("transform", "translate(" + LCX + " " + LCY + ") scale(" + sc.toFixed(4) + ") translate(" + -LCX + " " + -LCY + ")");
    lc.setAttribute("transform", "translate(" + LCX + " " + LCY + ") scale(" + L.z.toFixed(5) + ") translate(" + (-L.fx).toFixed(3) + " " + (-L.fy).toFixed(3) + ")");
    lc.style.setProperty("--anatomy-weight", (0.6 / Math.sqrt(L.z)).toFixed(4) + "px");
    for (const [el, w] of [[lx, L.w.x], [ls, L.w.s], [lu, L.w.u]]) { el.style.display = w > 0.002 ? "" : "none"; el.setAttribute("opacity", Math.min(1, w).toFixed(3)); }
  } else loupe.style.display = "none";
  window.__T = T;
  window.__state = { T, r: St(0.5).r, ts, n: St(0.5).n, phase: St(0.5).phase };
}
window.__render = render;
// tour time is pinned to page time: T = performance.now()/1000 - K (video offset from the recorder's meta.json)
const K = 0.5;
window.__K = K;
const holdClock = () => { try { const c = window.__pwClock && window.__pwClock.controller; if (c && c._realTime) c._innerPause(); } catch (e) {} };
holdClock();
function frame() {
  holdClock();
  if (!window.__manual) render(Math.min(TR.LEN + 1, performance.now() / 1000 - K));
  requestAnimationFrame(frame);
}
const pin = /T=([0-9.]+)/.exec(location.hash);
if (pin) window.__manual = true;
render(pin ? +pin[1] : 0);
requestAnimationFrame(frame);
`;
const shortHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>How a watch really ticks</title><style>${k.ISO_CSS}${PALETTE_CSS}${SHORT_CSS}</style></head><body class="iso" data-theme="light"><main class="short">${svgShort}</main><script type="module">${(kitScript() + LIVE_SHORT).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
if (process.argv.includes("--short")) writeFileSync(join(HERE, "short.html"), shortHtml);
if (process.argv.includes("--short")) writeFileSync(join(HERE, "events.preview.json"), JSON.stringify(EVENTS, null, 1));
console.log("wrote short.html, watch-light.html", { kb: Math.round(shortHtml.length / 1024), events: EVENTS.length, CAM });

// gallery: hold still under prefers-reduced-motion
{ const RM = '(()=>{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)return;const r=window.requestAnimationFrame.bind(window);let n=0;window.requestAnimationFrame=(f)=>n++<3?r(f):0;})();';
  for (const pg of ['watch-light.html']) { const fp = join(HERE, pg); try { const h = readFileSync(fp, "utf8"); if (!h.includes("gallery-rm")) writeFileSync(fp, h.replace(/<head[^>]*>/, (m) => m + '<script id="gallery-rm">' + RM + '</script>')); } catch (e) {} } }
