// the quotum machine: one bench that shows how a seat on quotum works. node build.mjs writes quotum-machine.html next to this file.
// stake → seat → key → the bell at 20:00 UTC → buyback and burn. Built on the Anatomy kit, light theme in the quotum inks.
// the numbers are one real day, bell 17 (2026-10-12), read from bell17.json at build time; the page touches no network.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const B17 = JSON.parse(readFileSync(join(HERE, "bell17.json"), "utf8"));
const WIDTH = 640, HEIGHT = 400;

// ---- the bench (world units, z up)
const PLATE = { x: -150, y: -70, w: 300, d: 140, r: 8 }, PLATE_H = 12, FOOT_H = 5;
// seat rack: a low platform at the front left with a 10 × 10 field of pegs, one per seat
const RACK = { x: -138, y: -4, w: 58, d: 58, r: 3 }, RACK_H = 6, PEG_GAP = 5.6, PEG_R = 1.3;
// tax hopper: a tall box at the back left with a funnel mouth, the trading tax falls in all day
const HOPPER = { x: -136, y: -62, w: 34, d: 30, r: 3 }, HOPPER_H = 34;
// trough from the hopper to the tank
const TROUGH = { x: -102, y: -46, w: 118, d: 7, r: 1 }, TROUGH_Z = 24;
// cap gauge: a dial on a post in the middle
const DIAL = [-40, 10], DIAL_R = 17, DIAL_Z = 54, DIAL_H = 9, DIAL_TOP = DIAL_Z + DIAL_H;
// tank: a sight glass of what the seats have not spent yet
const TANK = [28, -22], TANK_R = 15, TANK_H = 36;
// gallows and bell
const POSTS = [[104, -50], [104, 44]], POST_R = 3.2, POST_TOP = 112;
const BAR = { x: 100, y: -54, w: 8, d: 108, r: 1.5 }, BAR_Z = 108, BAR_H = 5;
const BELL = [104, -3], BELL_TOP = 100, BELL_PROFILE = [[2.6, 6], [5, 10], [7, 10], [9, 8], [12.5, 5], [14.5, 2.5]]; // [radius, height] from the crown down
const CLAPPER_Z = BELL_TOP - 41, CLAPPER_R = 2;
// brazier under the bell: where the unspent QUOTUM burns
const BRAZ = [104, -3], BRAZ_R = 17, BRAZ_Z = 0, BRAZ_H = 14, BRAZ_RIM = 3;
// the lever the rope pulls, at the front right of the plate
const LEVER = [134, 50];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...POSTS.map(([x, y]) => [x, y, POST_TOP + 2]), [HOPPER.x, HOPPER.y, HOPPER_H + 2]],
  WIDTH, HEIGHT, { pad: 28, azimuth: 40, elevation: 32 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a ruler of 24 hours along the front edge, the bell hour as the major mark
  const strip = { x: -120, y: PLATE.y + PLATE.d - 14, w: 240, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 232 / 24, 4, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([strip.x + 4 + 20 * 232 / 24, strip.y + 0.8], [strip.x + 4 + 20 * 232 / 24, strip.y + 5.6], 0.6, P), { tone: "lit" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // a label plate: three rule lines stand for the engraved title
  const label = { x: 60, y: 40, w: 36, d: 14, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  [[4, 22], [4, 16], [4, 26]].forEach(([a, b], i) => out.push(L(k.lineOnTop([label.x + a, label.y + 3.5 + i * 3.2], [label.x + b, label.y + 3.5 + i * 3.2], 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([label.x + 2, label.y + 2, 0.8]), at([label.x + label.w - 2, label.y + label.d - 2, 0.8])], { size: 0.45 }));
  return out.join("");
}

function hopper() {
  const out = [];
  out.push(S(k.slabOf(HOPPER, 0, HOPPER_H - 8, P, 5, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(HOPPER, -2), HOPPER_H - 8, 8, P, 5, 0.8), { tone: "mid" })); // the funnel mouth, wider than the box
  out.push(L(k.planOutline(k.insetPlan(HOPPER, 2), HOPPER_H, P), { tone: "lo" })); // the mouth opening
  out.push(L(k.planOutline(k.insetPlan(HOPPER, 7), HOPPER_H, P), { tone: "faint" }));
  const seam = k.sideSeam(HOPPER, 12, P, 5);
  out.push(L(seam, { tone: "faint" }));
  out.push(D(k.corners(HOPPER, 4).map(([x, y]) => at([x, y, HOPPER_H - 8])), { size: 0.45 }));
  // the trough: a channel from the hopper's side to the tank, on two little posts
  for (const x of [TROUGH.x + 24, TROUGH.x + 70]) out.push(S(k.cylinder(x, TROUGH.y + 3.5, 2, 0, TROUGH_Z, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(TROUGH, TROUGH_Z, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TROUGH, 1.2), TROUGH_Z + 4, P, 3), { tone: "faint" }));
  return out.join("");
}

function rack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(RACK, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(RACK, 0, RACK_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(RACK, 2.5), RACK_H, P, 4), { tone: "faint" }));
  out.push(D(k.corners(RACK, 3).map(([x, y]) => at([x, y, RACK_H])), { size: 0.45 }));
  // 100 pegs, far row first; the live seats are rebuilt in the page from the same geometry
  const pegs = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) pegs.push([RACK.x + 4 + PEG_GAP * c + PEG_GAP / 2, RACK.y + 4 + PEG_GAP * r + PEG_GAP / 2, r * 10 + c]);
  for (const [x, y, i] of byDepth(pegs)) out.push(`<g data-peg="${i}">${S(k.cylinder(x, y, PEG_R, RACK_H, 2, P, 10), { tone: "lo", crease: "none" })}</g>`);
  return out.join("");
}

function gauge() {
  const out = [];
  const [x, y] = DIAL;
  out.push(S(k.cylinder(x, y, 5, 0, 4, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 2.9, 4, DIAL_Z - 4, P, 20), { tone: "mid", crease: "none" }));
  out.push(L([20, 36].map((z) => k.sideArc(x, y, 2.9, z, P, 12)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3, P, 36), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 2.2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 3, 50, 10, DIAL_TOP, [1.2, 2.6], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.6, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 9], DIAL_TOP, P, "x"), "$50", { size: 2.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}
// the cap needle: 0 at the left stop, $50 at the right, a three-quarter sweep
const needleAt = (share) => {
  const a = -Math.PI * 0.75 + Math.PI * 1.5 * Math.min(1, Math.max(0, share));
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(a) * 3, y + Math.cos(a) * 3], [x + Math.sin(a) * (DIAL_R - 4), y - Math.cos(a) * (DIAL_R - 4)], DIAL_TOP + 0.2, P);
};

function tank() {
  const out = [];
  const [x, y] = TANK;
  out.push(S(k.cylinder(x, y, TANK_R + 3, 0, 3, P, 48), { tone: "mid" })); // base ring
  out.push(S(k.cylinder(x, y, TANK_R, 3, TANK_H, P, 48), { tone: "hi", crease: "lo" })); // the glass
  out.push(L([12, 21, 30].map((z) => k.sideArc(x, y, TANK_R, z, P, 28)).join(""), { tone: "faint" })); // graduation bands
  out.push(S(k.cylinder(x, y, TANK_R + 1.5, 3 + TANK_H, 2.5, P, 48), { tone: "mid" })); // lid ring
  // the drain to the brazier: a short pipe out of the base toward the bell
  out.push(S(k.slabOf({ x: x + TANK_R + 1, y: y - 2.5, w: BRAZ[0] - BRAZ_R - x - TANK_R - 1, d: 5, r: 2 }, 1, 4, P, 3), { tone: "mid", crease: "none" }));
  return out.join("");
}
// the level inside the glass: a disc at the height of what is still unspent
const levelAt = (share) => S(k.cylinder(TANK[0], TANK[1], TANK_R - 1.4, 3, Math.max(0.6, share * (TANK_H - 2)), P, 48), { tone: "mid", crease: "none", lit: true });

function gallows() {
  const out = [];
  for (const [x, y] of POSTS) {
    out.push(S(k.cylinder(x, y, 5, 0, 4, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, POST_R, 4, POST_TOP - 4, P, 20), { tone: "mid", crease: "none" }));
    out.push(L([40, 76].map((z) => k.sideArc(x, y, POST_R, z, P, 12)).join(""), { tone: "faint" }));
  }
  out.push(S(k.slabOf(BAR, BAR_Z, BAR_H, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([104, -46, BAR_Z + BAR_H]), at([104, 40, BAR_Z + BAR_H])], { size: 0.45 }));
  // the yoke the bell hangs from
  out.push(S(k.slabOf({ x: 100, y: -9, w: 8, d: 12, r: 1.5 }, BELL_TOP + 2, BAR_Z - BELL_TOP - 2, P, 3), { tone: "mid", crease: "none" }));
  return out.join("");
}
function brazier() {
  const out = [];
  const [x, y] = BRAZ;
  for (const a of [0.5, 2.6, 4.7]) out.push(S(k.cylinder(x + Math.cos(a) * (BRAZ_R - 2), y + Math.sin(a) * (BRAZ_R - 2), 2.2, 0, 3, P, 14), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, BRAZ_R, 3, BRAZ_H - 3, P, 56, 0.6), { tone: "lo", crease: "lo" }));
  out.push(L(k.sideArc(x, y, BRAZ_R, 8, P, 32), { tone: "faint" }));
  out.push(L(k.ring(x, y, BRAZ_R - BRAZ_RIM, BRAZ_H, P, 56), { tone: "lo" })); // the mouth
  out.push(S(k.cylinder(x, y, BRAZ_R - BRAZ_RIM - 0.6, BRAZ_H - 4, 0.5, P, 48), { tone: "lo", crease: "none" })); // the ash bed, below the rim
  return out.join("");
}
function bell() {
  // the bell as stacked discs from the crown down; the whole group swings in the page about the yoke pin
  const out = [];
  const [x, y] = BELL;
  let z = BELL_TOP;
  out.push(S(k.cylinder(x, y, 1.8, z, 2, P, 12), { tone: "mid", crease: "none" })); // pin
  for (const [r, h] of BELL_PROFILE) { z -= h; out.push(S(k.cylinder(x, y, r, z, h, P, 40), { tone: "hi", crease: r > 9 ? "lo" : "faint", lit: true })); }
  out.push(L(k.sideArc(x, y, 12.5, z + 3, P, 24), { tone: "lo" })); // the sound bow line
  out.push(S(k.cylinder(x, y, 0.8, CLAPPER_Z, 12, P, 8), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, CLAPPER_R, CLAPPER_Z - 3, 3, P, 14), { tone: "mid" }));
  return { svg: out.join(""), lip: z };
}
const BELLART = bell();
// the rope: from the bell's crown, over the bar end, down to the lever
const rope = () => [k.segment([BELL[0], BELL[1] + 3, BELL_TOP], [BELL[0], BAR.y + BAR.d, BAR_Z + BAR_H + 1], P), k.segment([BELL[0], BAR.y + BAR.d, BAR_Z + BAR_H + 1], [LEVER[0], LEVER[1], 10], P)].join("");
function lever() {
  const out = [];
  const [x, y] = LEVER;
  out.push(S(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 2 }, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.4, 4, 8, P, 10), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 2.6, 12, 2, P, 16), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 2.6, 12, 14, 16, P), { tone: "lo" }));
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "qm-back",
  label: "The quotum machine on a bench. A hopper at the back collects the trading tax all day and a trough carries it to a sight glass. A rack of a hundred pegs holds the seats, the lit ones live. A dial reads today's cap per seat. Above the sight glass a bell hangs from a gallows with a rope to a lever. Under the bell a brazier: at 20:00 UTC the bell rings, what the seats left unspent drains from the glass into the brazier and burns.",
  body: [
    plate(), hopper(), rack(), gauge(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0.07)}" style="stroke-width:1.1"/>`,
    tank(), `<g data-part="level">${levelAt(0.9)}</g>`, brazier(), gallows(),
    `<path data-part="rope" class="iso-line" data-tone="lo" d="${rope()}"/>`,
    `<g data-part="bell">${BELLART.svg}</g>`,
    lever(),
  ],
});

const pivot = at([BELL[0], BELL[1], BELL_TOP + 2]);
const mouth = at([BRAZ[0], BRAZ[1], BRAZ_H]);
const mouthR = Math.hypot(...[at([BRAZ[0] + BRAZ_R - BRAZ_RIM, BRAZ[1], BRAZ_H]), mouth].reduce((a, b) => [a[0] - b[0], a[1] - b[1]]));

const live = `
const P = ${JSON.stringify(P)}, DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const TANK = ${JSON.stringify(TANK)}, TANK_R = ${TANK_R}, TANK_H = ${TANK_H};
const PIVOT = ${JSON.stringify(pivot)}, MOUTH = ${JSON.stringify(mouth)}, MOUTH_R = ${mouthR.toFixed(2)}, VIEW = [${WIDTH}, ${HEIGHT}];
const stage = document.querySelector(".iso-stage"), svg = stage.querySelector("svg.qm-back"), canvas = stage.querySelector("canvas");
const needle = svg.querySelector('[data-part="needle"]'), level = svg.querySelector('[data-part="level"]'), bellG = svg.querySelector('[data-part="bell"]');
const readout = document.querySelector("[data-readout]"), still = matchMedia("(prefers-reduced-motion: reduce)");
// the numbers: bell 17 (2026-10-12), baked at build time. what the seats spent and what burned are the day's real totals
const B17 = ${JSON.stringify(B17)};
const N = { session: B17.session, liveSeats: B17.live, ceiling: 50, seats: B17.seats.map((seat) => ({ seat })), spentUsd: B17.spentUsd, burnedUsd: B17.burnedUsd };
const pegEls = [...svg.querySelectorAll("[data-peg]")];
function pegs() { const live = new Set((N.seats.length ? N.seats.map((s) => s.seat - 1) : Array.from({ length: N.liveSeats }, (_, i) => i))); pegEls.forEach((g) => { const on = live.has(+g.dataset.peg); g.querySelector(".iso-solid")?.toggleAttribute("data-lit", on); g.style.opacity = on ? 1 : 0.55; }); }
pegs();
// the model: a day runs from 00:00 to 24:00 UTC. the glass holds the day's unspent share until the bell at 20:00 burns it
const BELL_H = 20;
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const levelAt = (share) => solidSvg(cylinder(TANK[0], TANK[1], TANK_R - 1.4, 3, Math.max(0.6, share * (TANK_H - 2)), P, 48), { tone: "mid", crease: "none", lit: true });
let hour = 9, target = 9, touring = true, clock = 0, last = 0, frame = 0, visible = false, idleTimer = 0, rang = -1, swing = 0, swingV = 0, fire = 0;
const DAY = 14;  // seconds per day on tour
const fmt = (v) => "$" + v.toFixed(2);
function draw(dt) {
  const h = hour, afterBell = h >= BELL_H;
  const pool = N.spentUsd + N.burnedUsd, spent = N.spentUsd, unspent = N.burnedUsd / pool;
  const share = afterBell ? Math.max(0, 1 - (h - BELL_H) / 0.35) * unspent : unspent;
  level.innerHTML = levelAt(share);
  needle.setAttribute("d", needleAt(pool / N.liveSeats / N.ceiling));
  // the bell: a kick at 20:00, then a damped swing about the yoke pin
  if (afterBell && rang !== Math.floor(clock / DAY)) { rang = Math.floor(clock / DAY); swingV = still.matches ? 0 : 9; fire = 1; }
  swingV += (-swing * 42 - swingV * 1.8) * dt; swing += swingV * dt; if (Math.abs(swing) < 0.02 && Math.abs(swingV) < 0.02) { swing = 0; swingV = 0; }
  bellG.setAttribute("transform", \`rotate(\${swing.toFixed(2)} \${PIVOT[0]} \${PIVOT[1]})\`);
  fire = afterBell ? Math.max(fire - dt / 2.4, 0) : Math.max(fire - dt / 0.6, 0);
  const burned = afterBell ? N.burnedUsd : 0;
  const hh = String(Math.floor(h)).padStart(2, "0"), mm = String(Math.floor((h % 1) * 60)).padStart(2, "0");
  const text = \`\${hh}:\${mm} UTC, \${afterBell ? fmt(burned) + " burned" : N.liveSeats + " seats live, " + fmt(spent) + " spent"}\`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(h)));
  stage.setAttribute("aria-valuetext", text);
  drawFire(dt);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
  if (touring) { clock += dt; target = (clock % DAY) / DAY * 24; }
  hour = still.matches ? target : (Math.abs(target - hour) > 12 ? target : hour + (target - hour) * (1 - Math.exp(-dt / 0.2)));
  draw(dt);
  const settled = !touring && Math.abs(target - hour) < 0.001 && swing === 0 && fire === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (h) => { touring = false; target = Math.min(23.99, Math.max(0, h)); if (target >= BELL_H && hour < BELL_H) { rang = -1; clock = 0; } clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = target / 24 * DAY; run(); }, 4000); run(); };
new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { touring = false; target = 19.5; hour = 19.5; }
stage.addEventListener("pointermove", (e) => { const b = svg.getBoundingClientRect(); const s = Math.min(1, Math.max(0, ((e.clientX - b.left) / b.width - 0.12) / 0.76)); steer(s * 24); });
stage.addEventListener("keydown", (e) => { const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!step) return; e.preventDefault(); steer(Math.round(target) + step); });

// the fire in the brazier: a WebGL flame drawn on paper, premultiplied alpha, ink only where there is light, nothing beyond the mouth's own glow
const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
let prog = null, U = {};
if (gl) {
  const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const fs = \`precision highp float;uniform vec2 uRes;uniform vec2 uView;uniform vec2 uM;uniform float uR;uniform float uT;uniform float uI;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){vec2 vb=gl_FragCoord.xy/uRes*uView; vb.y=uView.y-vb.y; vec2 d=(vb-uM)/uR; // d.x across the mouth, d.y up (negative = above)
    float up=-d.y; if(up<-.35||abs(d.x)>1.25){gl_FragColor=vec4(0.);return;}
    float h=2.8*uI; // flame height in mouth radii
    float w=1.-smoothstep(.0,1.,abs(d.x)/(1.1-up*.3)); // narrower higher up
    float n=fbm(vec2(d.x*2.2+uT*.3,up*2.4-uT*2.6))*.9+fbm(vec2(d.x*5.+uT*.7,up*5.-uT*4.))*.35;
    float body=smoothstep(.15,.95,w*(1.-up/h)*(.55+n*.8)); body*=smoothstep(-.35,.05,up)*uI; // rooted in the mouth, zero before the rim
    float core=smoothstep(.55,1.,body);
    vec3 ink=mix(vec3(.86,.33,.08),vec3(.99,.78,.35),core); ink=mix(ink,vec3(1.,.96,.82),smoothstep(.85,1.,body)); // ember orange, pale core on paper
    float a=body*.92; gl_FragColor=vec4(ink*a,a);}\`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const p = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
  for (const n of ["uRes", "uView", "uM", "uR", "uT", "uI"]) U[n] = gl.getUniformLocation(prog, n);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.BLEND);
}
let t0 = performance.now();
function drawFire(dt) {
  if (!gl) { canvas.hidden = true; return; }
  const w = canvas.clientWidth, h = canvas.clientHeight, s = Math.min(1.5, devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * s)) { canvas.width = Math.round(w * s); canvas.height = Math.round(h * s); gl.viewport(0, 0, canvas.width, canvas.height); }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  if (fire <= 0) return;
  gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform2f(U.uView, VIEW[0], VIEW[1]); gl.uniform2f(U.uM, MOUTH[0], MOUTH[1]); gl.uniform1f(U.uR, MOUTH_R);
  gl.uniform1f(U.uT, (performance.now() - t0) / 1000); gl.uniform1f(U.uI, Math.sin(Math.min(1, fire) * Math.PI / 2));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
draw(1 / 60);
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "The quotum machine",
  hint: "Hover to move through the day",
  readout: "09:00 UTC, 13 seats live, $30.92 spent",
  keys: [
    { mark: "lit", label: "Live seats, the bell and what is left in the glass" },
    { mark: "raised", label: "Tax hopper, cap dial, sight glass, brazier" },
  ],
  caption: "One real day, bell 17: 13 seats live, $30.92 spent, $43.86 burned. Trading tax falls into the hopper all day and sets the cap on the dial, the same for every seat. The seats draw it down through the sight glass as they use their keys. At 20:00 UTC the lever pulls the rope, the bell rings, and whatever is still in the glass drains into the brazier and burns as QUOTUM.",
  body: `<div class="iso-stage qm" tabindex="0" role="slider" aria-label="The quotum machine: arrow keys move the clock an hour" aria-valuemin="0" aria-valuemax="24" aria-valuenow="9">${svg}<canvas class="qm-fire" aria-hidden="true"></canvas></div>`,
});

// quotum inks over the kit's light theme; system faces, no font files
const QUOTUM_CSS = `
.iso[data-theme="light"]{--anatomy-page:#FAFAF7;--anatomy-card:#FAFAF7;--anatomy-text:rgba(24,11,81,.72);--anatomy-strong:#180b51;--anatomy-muted:rgba(24,11,81,.55);
--anatomy-paper:#FAFAF7;--anatomy-face:#FFFFFE;--anatomy-top:#FFFFFE;--anatomy-shade-0:#dcdae6;--anatomy-shade-1:#e5e3ec;--anatomy-shade-2:#edecf2;--anatomy-shade-3:#f4f3f6;
--anatomy-lit-top:#fffdf2;--anatomy-lit-shade:#efeadb;--anatomy-hi:#180b51;--anatomy-mid:rgba(24,11,81,.62);--anatomy-lo:rgba(24,11,81,.38);--anatomy-faint:rgba(24,11,81,.2);--anatomy-lit:#8F6A30;
--anatomy-halo:#8c86a8;--anatomy-halo-opacity:.28;--anatomy-dot:#180b51;--anatomy-mono:ui-monospace,Menlo,monospace}
body{font-family:Georgia,'Times New Roman',serif;background:#FAFAF7}
.iso-stage.qm{position:relative}
.qm-fire{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
`;

const page = k.pageHtml({ title: "The quotum machine", theme: "light", body, script: kitScript() + live }).replace("</head>", `<style>${QUOTUM_CSS}</style></head>`);
writeFileSync(join(HERE, "quotum-machine.html"), page);
console.log("wrote quotum-machine.html");
