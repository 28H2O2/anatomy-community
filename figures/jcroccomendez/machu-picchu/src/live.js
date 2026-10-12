const { P, LOWER, BATTER, HEIGHT, COURSE_TOP, WALL_BASE, FIRST, NOTE } = __DATA__;

// ---- Language ----------------------------------------------------------------------------
// English by default; the reader's choice is remembered in this browser only.
let lang = "en";
try { if (LANGS.includes(localStorage.getItem("mp-lang"))) lang = localStorage.getItem("mp-lang"); } catch {}
const T = () => TEXT[lang];
const n = (value, digits) => num(lang, value, digits);
const lookup = (key) => key.split(".").reduce((o, part) => (o == null ? o : o[part]), T());
const kk = { solidSvg, lineSvg, slabOf, pathOf, iso, dotsSvg, ring };
const PARTS = makeParts(kk, GG, P);
const { XL, XC, WALL, C2, BLOCK, SPARE, ROPE_X } = GEO;
const XM = (BLOCK.x0 + BLOCK.x1) / 2;
const HW = (BLOCK.x1 - BLOCK.x0) / 2 - 1.5;
const yFront = (z) => 26 - (z - WALL_BASE) * BATTER;

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (part) => svg.querySelector(`[data-part="${part}"]`);
const blockEl = $("block"), nubEl = $("nub"), seatEl = $("seat"), poleEl = $("pole"), marksEl = $("marks");
const hammerEl = $("hammer"), dustEl = $("dust");
const drainedEl = $("drained"), clayEl = $("clay"), seepEl = $("seep"), wetEl = $("wet"), tableEl = $("table-line");
const shakeEl = $("table"), cracksEl = $("cracks");
const quakeEls = [...svg.querySelectorAll("[data-quake]")].map((el) => [el, Number(el.dataset.quake), Number(el.dataset.phase)]);
const puddleEl = $("puddle"), spillEl = $("spill");
const outflowEls = [...svg.querySelectorAll('[data-part="outflow"]')];
const courseEls = [...svg.querySelectorAll("[data-course]")].map((el) => [el, Number(el.dataset.course)]);
const rainEl = svg.querySelector(".mp-rain"), splashEl = svg.querySelector(".mp-splash");
const rainButtons = [...document.querySelectorAll("[data-rain]")];
const fillButtons = [...document.querySelectorAll("[data-fill]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fmtGap = (g) => n(g, g < 1 ? 2 : 1);
const PEOPLE = Math.max(1, Math.round(PUSH_N / 500));
const SEATED = 0.35;
const PER_PASS = 3.4;
const HOLD = 3;
const IDLE_MS = 12000;

// ---- Fitting -----------------------------------------------------------------------------
// tour: the passes play by themselves. hand: the reader works the pole and the hammer.
const fit = { mode: "tour", lift: 0, g: GAP0_MM, rest: GAP0_MM, marks: 0, seen: contactOf(GAP0_MM), trials: 0, held: false, fall: 0, raised: false, note: null, noteAt: 0 };
const hammer = { t: -1, x: XM };
let u = SEATED, target = u, clock = 0, touring = !still.matches, idle = 0;
let drag = null;

function tourAt(t) {
  const run = PASSES * PER_PASS;
  const c = t % (run + HOLD + 2.2);
  if (c < run) return c / PER_PASS;
  return c < run + HOLD ? PASSES : 0;
}

function toHand() {
  if (fit.mode !== "hand") {
    fit.mode = "hand";
    fit.trials = 0;
  }
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (still.matches || drag) return;
    fit.mode = "tour";
    touring = true;
    const pass = clamp(Math.round(Math.log(fit.g / GAP0_MM) / Math.log(KEEP)), 0, PASSES - 1);
    clock = pass * PER_PASS;
    u = target = pass;
    run();
  }, IDLE_MS);
  run();
}

function seat() {
  fit.trials++;
  fit.rest = fit.g;
  fit.seen = contactOf(fit.g);
  fit.marks = 1;
  say(fit.g > BLADE_MM ? "seated" : "closed", { trial: fit.trials, g: fit.g, contact: Math.round(fit.seen * 100) });
}

// A note is kept as a key and its values, so it reads in whichever language is showing.
const say = (key, vars = {}) => { fit.note = { key, vars }; fit.noteAt = performance.now(); };

function strike(x) {
  hammer.t = 0;
  hammer.x = clamp(x, BLOCK.x0 + 3, BLOCK.x1 - 3);
  if (fit.lift < LIFT * 0.5) {
    say("liftFirst");
    hammer.t = -1;
    return;
  }
  if (fit.g <= 0.2) say("flat");
  else if (fit.marks < 0.15) say(fit.trials ? "noDust" : "setFirst");
  else if (Math.abs(hammer.x - XM) <= fit.seen * HW + 1.8) {
    fit.g = Math.max(0.2, fit.g * 0.72);
    fit.marks *= 0.55;
    say("pounded");
  } else say("miss");
}

// ---- Rain and the water in the terrace ---------------------------------------------------
const water = { hw: 0, pond: 0, out: 0, rain: 1, fill: "drained", hours: 0, flow: 0, seep: 1 };
const drops = [];
const splashes = [];
let spawnDebt = 0;
const REGIONS = [
  { w: 0.42, y: [26, 58], z: LOWER },
  { w: 0.58, y: [WALL.front + 5, yFront(COURSE_TOP) - 1], z: COURSE_TOP },
];
const onCut = (y, z) => iso([XC, y, z], P);

function stepRain(dt) {
  const rain = RAINS[water.rain].mmh / 1000;
  let left = dt * SIM_HOURS_PER_S;
  while (left > 1e-6) {
    const h = Math.min(left, 0.05);
    Object.assign(water, stepWater(water, rain, water.fill, h));
    left -= h;
  }
  water.hours += dt * SIM_HOURS_PER_S;
  const k = 1 - Math.exp(-dt / 0.6);
  water.flow += (clamp(water.out / 0.01, 0, 1) - water.flow) * k;
  water.seep += ((rain > 0 && water.fill === "drained" ? 1 : 0) - water.seep) * k;
  if (!still.matches && rain > 0) {
    spawnDebt += dt * RAINS[water.rain].mmh * 6;
    while (spawnDebt >= 1) {
      spawnDebt--;
      const r = Math.random() < REGIONS[0].w ? REGIONS[0] : REGIONS[1];
      const surf = r.z;
      drops.push({ x: XL + 2 + Math.random() * (XC - XL - 4), y: r.y[0] + Math.random() * (r.y[1] - r.y[0]), z: surf + 60 + Math.random() * 40, surf });
    }
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.z -= 170 * dt;
    if (d.z <= d.surf) {
      splashes.push({ x: d.x, y: d.y, z: d.surf + 0.05, t: 0 });
      drops.splice(i, 1);
    }
  }
  for (let i = splashes.length - 1; i >= 0; i--) if ((splashes[i].t += dt) > 0.32) splashes.splice(i, 1);
}

function drawRain() {
  rainEl.setAttribute("d", drops.map((d) => pathOf([iso([d.x, d.y, d.z + 3.2], P), iso([d.x, d.y, d.z], P)])).join(""));
  splashEl.setAttribute("d", splashes.map((s) => ring(s.x, s.y, 0.4 + (2.4 * s.t) / 0.32, s.z, P, 12)).join(""));
  splashEl.style.opacity = splashes.length ? "0.7" : "0";
}

function drawWater() {
  const clay = water.fill === "clay";
  drainedEl.style.display = clay ? "none" : "";
  clayEl.style.display = clay ? "" : "none";
  seepEl.setAttribute("opacity", water.seep.toFixed(3));
  outflowEls.forEach((el) => el.setAttribute("opacity", water.flow.toFixed(3)));
  stage.style.setProperty("--mp-flow", `${Math.round(2400 - 1400 * clamp(RAINS[water.rain].mmh / 50, 0, 1))}ms`);
  const top = WALL_BASE + (water.hw * 1000) / UNIT_MM;
  if (water.hw > 0.004) {
    wetEl.setAttribute("d", pathOf([onCut(-72, WALL_BASE), onCut(0, WALL_BASE), onCut(0, top), onCut(-72, top)], true));
    tableEl.setAttribute("d", pathOf([onCut(-72, top), onCut(0, top)]));
  } else {
    wetEl.setAttribute("d", "");
    tableEl.setAttribute("d", "");
  }
  puddleEl.setAttribute("opacity", (clamp(water.pond / 0.01, 0, 1) * 0.6).toFixed(3));
  spillEl.setAttribute("opacity", clamp((water.pond - 0.004) / 0.01, 0, 1).toFixed(3));
  const thrust = thrustOf(water.hw);
  const bulge = 2.2 * clamp((thrust - THRUST_DRY) / (THRUST_SAT - THRUST_DRY), 0, 1);
  for (const [el, z] of courseEls) {
    const b = bulge * Math.sin((Math.PI * (z - WALL_BASE)) / (COURSE_TOP - WALL_BASE));
    el.setAttribute("transform", b > 0.01 ? translateAlong(P, [0, b, 0]) : "");
  }
  const r = RAINS[water.rain];
  const ratio = thrust / THRUST_DRY;
  view.thrust = thrust;
  view.waterText =
    fmt(T().water, { rain: fmt(T().rains[water.rain], { mmh: r.mmh }), fill: T().fills[water.fill], hours: Math.round(water.hours), hw: n(water.hw, 2) }) +
    (ratio > 1.05 ? fmt(T().ratio, { ratio: n(ratio, 1) }) : "");
}

const waterBusy = () => RAINS[water.rain].mmh > 0 || water.hw > 0.002 || water.pond > 0 || drops.length || splashes.length || Math.abs(water.flow) > 0.002 || Math.abs(water.seep) > 0.002;

// ---- Drawing the fitting -----------------------------------------------------------------
const drawn = { raise: null, gap: null, seen: null, marks: null, text: null, hammer: null };

function drawFit() {
  // The block is the template and keeps its shape; the seat under it is what gets pounded.
  const raise = raiseOf(fit.g, fit.rest, fit.lift);
  if (raise !== drawn.raise) {
    const blockTransform = translateAlong(P, [0, 0, raise]);
    blockEl.setAttribute("transform", blockTransform);
    nubEl.setAttribute("transform", blockTransform);
    poleEl.innerHTML = PARTS.pole(raise);
    drawn.raise = raise;
  }
  const g = visOf(fit.g);
  if (g !== drawn.gap || fit.seen !== drawn.seen) {
    if (g !== drawn.gap) seatEl.innerHTML = PARTS.seat(g);
    marksEl.innerHTML = PARTS.marks(fit.seen, g);
    drawn.gap = g;
    drawn.seen = fit.seen;
  }
  const m = (fit.marks * Math.min(1, fit.lift / (LIFT * 0.4))).toFixed(3);
  if (m !== drawn.marks) { marksEl.setAttribute("opacity", m); drawn.marks = m; }
  // The hammerstone: up, down onto the seat, a little rebound, gone.
  let h = "0", dz = 0;
  if (hammer.t >= 0 && hammer.t < 0.45) {
    const t = hammer.t;
    dz = t < 0.12 ? 1.6 + 1.2 * smoothstep(t / 0.12) : t < 0.2 ? 2.8 * (1 - ((t - 0.12) / 0.08) ** 2) : 1.6 * Math.sin((Math.PI * (t - 0.2)) / 0.5);
    h = String(clamp(Math.min(t / 0.06, (0.45 - t) / 0.12), 0, 1).toFixed(3));
  }
  // It strikes the seat, so it rides the seat's hump.
  dz += PARTS.humpOf(hammer.x, g) - 0.1;
  const key = `${h}|${hammer.x}|${dz.toFixed(2)}`;
  if (key !== drawn.hammer) {
    hammerEl.setAttribute("opacity", h);
    hammerEl.setAttribute("transform", translateAlong(P, [hammer.x, 0, dz]));
    const d = hammer.t - 0.2;
    if (d >= 0 && d < 0.4) {
      const spread = 0.8 + 4 * smoothstep(d / 0.4);
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        return iso([hammer.x + Math.cos(a) * spread, BLOCK.y1 - 1 + Math.sin(a) * spread * 0.4, C2[0] + 0.6 + PARTS.humpOf(hammer.x, g) + Math.sin(Math.PI * d / 0.4) * 1.4], P);
      });
      dustEl.innerHTML = dotsSvg(pts, { size: 0.5, tone: "hi" });
      dustEl.setAttribute("opacity", (1 - d / 0.4).toFixed(3));
    } else if (dustEl.innerHTML) dustEl.innerHTML = "";
    drawn.hammer = key;
  }
  let text;
  const kn = n(PUSH_N / 1000, 1);
  if (fit.mode === "tour") {
    const s = stateAt(u);
    text = fmt(T().pass, { pass: s.pass + 1, passes: PASSES, verb: T().verbs[s.phase], gap: fmtGap(s.gap), contact: Math.round(s.contact * 100) });
  } else if ((drag || fit.held) && performance.now() - fit.noteAt > 1600) text = fit.lift > 0.2 ? fmt(T().lifting, { cm: Math.round(fit.lift * 3), kn, people: PEOPLE }) : fmt(T().bear, { kn });
  else if (fit.note) text = fmt(T()[fit.note.key], { ...fit.note.vars, gap: fit.note.vars.g === undefined ? "" : fmtGap(fit.note.vars.g) });
  else text = T().idle;
  if (text !== drawn.text) {
    view.fitText = text;
    stage.setAttribute("aria-valuetext", text);
    drawn.text = text;
  }
}

// ---- Earthquakes on the shake table ------------------------------------------------------
// The whole model rides the table. In a dry-laid wall each block also slips against its
// neighbours, more in the upper course, a little out of step, and settles back as the shaking
// dies. A mortared wall moves as one piece; past QUAKE.crack g it cracks, and the cracks stay.
const quake = { t: -1, kind: 0, peak: 0, wall: "dry", cracked: 0, done: false };
const UNIT_M = UNIT_MM / 1000;

function shake(kind) {
  quake.t = 0;
  quake.kind = kind;
  quake.peak = 0;
  quake.done = false;
  shakeButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.shake) === kind)));
  if (still.matches) {
    // No motion: jump to how the wall ends up.
    quake.t = -1;
    quake.peak = QUAKES[kind].pga;
    quake.done = true;
    if (quake.wall === "mortar" && quake.peak > QUAKE.crack) quake.cracked = 1;
    shakeButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
  }
}

function stepQuake(dt) {
  if (quake.t < 0) return;
  quake.t += dt;
  const q = quakeAt(quake.t, QUAKES[quake.kind].pga);
  quake.peak = Math.max(quake.peak, q.acc);
  if (quake.wall === "mortar" && q.acc > QUAKE.crack) quake.cracked = Math.max(quake.cracked, 0.001);
  if (quake.cracked > 0 && quake.cracked < 1) quake.cracked = Math.min(1, quake.cracked + dt / 0.35);
  if (quake.t > QUAKE.length) {
    quake.t = -1;
    quake.done = true;
    shakeButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
  }
}

const quakeBusy = () => quake.t >= 0 || (quake.cracked > 0 && quake.cracked < 1);
let quakeDrawn = "";

function drawQuake() {
  const kind = QUAKES[quake.kind];
  const q = quakeAt(quake.t, kind.pga);
  const scale = QUAKE.exag / UNIT_M;
  const ground = q.disp * scale;
  const key = `${quake.t >= 0 ? quake.t.toFixed(3) : "rest"}|${quake.wall}|${quake.cracked.toFixed(3)}`;
  if (key !== quakeDrawn) {
    quakeDrawn = key;
    shakeEl.setAttribute("transform", Math.abs(ground) > 1e-3 ? translateAlong(P, [ground, 0, 0]) : "");
    const dry = quake.wall === "dry";
    for (const [el, level, phase] of quakeEls) {
      const slip = dry && q.w ? QUAKE.slip * level * q.amp * q.env * Math.sin(q.w * quake.t - 0.6 - phase * 1.2) * scale : 0;
      el.setAttribute("transform", Math.abs(slip) > 1e-3 ? translateAlong(P, [slip, 0, Math.abs(slip) * 0.12]) : "");
    }
    cracksEl.setAttribute("opacity", quake.cracked.toFixed(3));
    stage.toggleAttribute("data-mortar", quake.wall === "mortar");
  }
  view.acc = q.acc;
  const quakeName = fmt(T().quakes[quake.kind], { pga: n(kind.pga, 2) });
  const wallName = T().walls[quake.wall];
  if (quake.t >= 0) {
    const mm = QUAKE.slip * q.amp * q.env * 1000;
    view.quakeText = quake.wall === "dry" ? fmt(T().shaking, { quake: quakeName, wall: wallName, mm: n(mm, 1) }) : fmt(T().shakingRigid, { quake: quakeName, wall: wallName });
  } else if (quake.done) {
    const peak = n(quake.peak, 2);
    view.quakeText = quake.wall === "dry" ? fmt(T().afterDry, { quake: quakeName, peak }) : fmt(quake.cracked > 0 ? T().afterCracked : T().afterSound, { quake: quakeName, peak });
  } else view.quakeText = T().quakeIdle;
}

function quakePhase() {
  if (quake.t < 0) return quake.done ? [3, 1] : [0, 1];
  const q = quakeAt(quake.t, QUAKES[quake.kind].pga);
  const settle = QUAKE.rise + QUAKE.decay;
  if (quake.t < settle) return [1, quake.t / settle];
  return [2, clamp((quake.t - settle) / (QUAKE.length - settle), 0, 1)];
}

// ---- Hauling the spare stone -------------------------------------------------------------
// The reader pulls the rope's end over the terrace. While the rope is slack nothing moves; once it is
// taut the stone slides after it, forward only, up to HAUL_MAX. Left alone, it is set back in place.
const haul = { s: 0, end: null, taut: false, drag: null, back: false };
const spareEl = $("spare"), ropeEl = $("rope");
const HAUL_KN = dragOf(SPARE_KG) / 1000;
const HAUL_CREW = crewOf(dragOf(SPARE_KG));
const tieY = () => SPARE.y + SPARE.d + 0.85 + haul.s; // where the rope meets the ground in front of the stone
let haulIdle = 0, haulDrawn = "";

function pullTo([px, py]) {
  const x = clamp(px, XL + 2, -19);
  const y = clamp(py, tieY() + 0.5, yFront(COURSE_TOP) - 1.5);
  let dx = x - ROPE_X, dy = y - tieY(), d = Math.hypot(dx, dy);
  if (d > ROPE_L && Math.abs(dx) < ROPE_L) {
    // Taut: the stone slides forward until the rope is just its length.
    haul.s = clamp(Math.max(haul.s, y - (tieY() - haul.s) - Math.sqrt(ROPE_L * ROPE_L - dx * dx)), 0, HAUL_MAX);
    dy = y - tieY();
    d = Math.hypot(dx, dy);
  }
  haul.taut = d >= ROPE_L - 0.05;
  // The hands can be no farther from the stone than the rope is long.
  const k = d > ROPE_L ? ROPE_L / d : 1;
  haul.end = [ROPE_X + dx * k, tieY() + dy * k];
}

function endHaul() {
  haul.drag = null;
  stage.removeAttribute("data-dragging");
  clearTimeout(haulIdle);
  haulIdle = setTimeout(() => { haul.back = true; run(); }, IDLE_MS);
  run();
}

function stepHaul(dt) {
  if (!haul.back) return;
  haul.end = null;
  haul.taut = false;
  haul.s = still.matches ? 0 : haul.s * Math.exp(-dt / 0.25);
  if (haul.s < 0.02) { haul.s = 0; haul.back = false; }
}

function drawHaul() {
  const key = `${haul.s.toFixed(3)}|${haul.end ? haul.end.map((v) => v.toFixed(2)).join(",") : "-"}`;
  if (key !== haulDrawn) {
    spareEl.setAttribute("transform", haul.s > 0.001 ? translateAlong(P, [0, haul.s, 0]) : "");
    ropeEl.innerHTML = PARTS.rope(haul.s, haul.end, ROPE_L);
    haulDrawn = key;
  }
  const cm = Math.round(haul.s * 3);
  if (haul.drag && !haul.taut) view.haulText = T().haulSlack;
  else if (haul.s >= HAUL_MAX - 0.01) view.haulText = fmt(T().haulThere, { cm, t: n(BLOCK_KG / 1000, 1), block: crewOf(dragOf(BLOCK_KG)) });
  else if (haul.drag || haul.s > 0.01) view.haulText = fmt(T().haulSliding, { cm, kn: n(HAUL_KN, 1), people: HAUL_CREW });
  else view.haulText = fmt(T().haulIdle, { kg: SPARE_KG, flat: HAUL_CREW, ramp: crewOf(dragOf(SPARE_KG, RAMP_DEG)), deg: RAMP_DEG });
}

function haulPhase() {
  if (haul.s >= HAUL_MAX - 0.01) return [3, 1];
  if (haul.drag && !haul.taut) return [1, clamp(Math.hypot(haul.end[0] - ROPE_X, haul.end[1] - tieY()) / ROPE_L, 0, 1)];
  if (haul.drag || haul.s > 0.01) return [2, haul.s / HAUL_MAX];
  return [0, 1];
}

const haulBusy = () => haul.back || Boolean(haul.drag);

// ---- The live readout in the panel ---------------------------------------------------------
// It follows the part being explained: the joint gap for the wall and the block, the thrust on
// the terrace wall for the terrace, its fill and its drains. The bar shows where the cycle is.
const view = { fitText: "", waterText: "", thrust: THRUST_DRY, quakeText: "", acc: 0, haulText: "" };
const bigEl = document.querySelector("[data-big]");
const unitEl = document.querySelector("[data-unit]");
const subEl = document.querySelector("[data-sub]");
const segEls = [...document.querySelectorAll("[data-seg]")].map((el) => [el, el.querySelector("b"), el.querySelector("span")]);
// Equal steps keep the four labels in fixed places; the fill shows progress within a step.
const BARS = { fit: [1, 1, 1, 1], water: [1, 1, 1, 1], quake: [1, 1, 1, 1], haul: [1, 1, 1, 1] };
const modeOf = (id) => (id === 8 ? "quake" : id === 4 ? "haul" : id >= 5 ? "water" : "fit");
let readMode = modeOf(FIRST);
let shown = "";

function fitPhase() {
  if (fit.mode === "tour") {
    const t = clamp(u, 0, PASSES);
    const pass = Math.min(PASSES - 1, Math.floor(t));
    const f = t - pass;
    if (pass === PASSES - 1 && f >= PHASES.sit[0]) return [1, 1];
    const bounds = [PHASES.lower, PHASES.sit, PHASES.lift, PHASES.dress];
    const i = bounds.findIndex(([a, b]) => f < b);
    const [a, b] = bounds[i < 0 ? 3 : i];
    return [i < 0 ? 3 : i, clamp((f - a) / (b - a), 0, 1)];
  }
  if (drag || fit.held) return [2, fit.lift / LIFT];
  if (fit.lift > 0) return [0, 1 - fit.lift / LIFT];
  if (hammer.t >= 0) return [3, clamp(hammer.t / 0.45, 0, 1)];
  return [1, 1];
}
function waterPhase() {
  if (water.pond > 0.004) return [3, clamp(water.pond / 0.03, 0.1, 1)];
  if (water.hw >= WALL_M - 0.001) return [2, 1];
  if (water.hw > 0.03) return [1, water.hw / WALL_M];
  return [0, RAINS[water.rain].mmh ? 1 : 0.4];
}

function drawReadout() {
  const mode = readMode;
  const [big, unit, labels, sub, [active, fill]] = {
    fit: () => [fmtGap(fit.g), T().gapUnit, T().fitBar, view.fitText, fitPhase()],
    water: () => [n(view.thrust, 1), T().thrustUnit, T().waterBar, view.waterText, waterPhase()],
    quake: () => [n(view.acc, 2), T().accUnit, T().quakeBar, view.quakeText, quakePhase()],
    haul: () => [n(HAUL_KN, 1), T().haulUnit, T().haulBar, view.haulText, haulPhase()],
  }[mode]();
  const key = `${lang}|${readMode}|${big}|${sub}|${active}|${fill.toFixed(2)}`;
  if (key === shown) return;
  shown = key;
  if (bigEl.textContent !== big) bigEl.textContent = big;
  if (unitEl.textContent !== unit) unitEl.textContent = unit;
  if (subEl.textContent !== sub) subEl.textContent = sub;
  BARS[readMode].forEach((flex, i) => {
    const label = labels[i];
    const [el, bar, name] = segEls[i];
    el.style.flexGrow = String(flex);
    if (name.textContent !== label) name.textContent = label;
    el.toggleAttribute("data-on", i === active);
    bar.style.width = `${(i < active ? 1 : i === active ? fill : 0) * 100}%`;
  });
}

// ---- The loop ----------------------------------------------------------------------------
let frame = 0, last = 0, visible = false;

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (fit.mode === "tour") {
    if (touring) { clock += dt; target = tourAt(clock); }
    const rewinding = target < u - 1;
    const tau = touring && !rewinding ? 0.05 : rewinding ? 0.45 : 0.35;
    u = still.matches ? target : u + (target - u) * (1 - Math.exp(-dt / tau));
    if (Math.abs(target - u) < 1e-4) u = target;
    const s = stateAt(u);
    fit.lift = s.lift; fit.g = s.gap; fit.rest = s.rest; fit.marks = s.marks; fit.seen = s.contact;
    if (s.strike >= 0 && s.strike < STRIKES) {
      const n = Math.floor(s.strike);
      hammer.x = XM + [-0.5, 0.45, 0][n] * s.contact * HW;
      hammer.t = (s.strike - n) * 0.45;
    } else hammer.t = -1;
    stage.setAttribute("aria-valuenow", String(s.pass + 1));
  } else {
    const want = drag ? drag.lift : fit.held ? LIFT : 0;
    if (want > fit.lift || drag || fit.held) {
      fit.fall = 0;
      fit.lift += (want - fit.lift) * (still.matches ? 1 : 1 - Math.exp(-dt / 0.06));
      if (fit.lift > 0.5) fit.raised = true;
    } else if (fit.lift > 0) {
      fit.fall += 260 * dt;
      fit.lift = still.matches ? 0 : Math.max(0, fit.lift - fit.fall * dt);
    }
    if (fit.lift <= 0.001 && fit.raised) { fit.lift = 0; fit.raised = false; seat(); }
    if (hammer.t >= 0) { hammer.t += dt; if (hammer.t > 0.65) hammer.t = -1; }
  }
  stepRain(dt);
  stepQuake(dt);
  stepHaul(dt);
  drawFit();
  drawWater();
  drawRain();
  drawQuake();
  drawHaul();
  drawReadout();
  const fitBusy = fit.mode === "tour" ? touring || u !== target : drag || fit.held || fit.lift > 0 || hammer.t >= 0;
  frame = visible && (fitBusy || waterBusy() || quakeBusy() || haulBusy()) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

// ---- Pointer: drag the pole or the rope, click the seat ----------------------------------
const viewOfEvent = (e) => {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};
// The point (x, y) on the level plane z under a point of the drawing.
const planeAt = (v, z) => {
  const o = iso([0, 0, z], P), ex = iso([1, 0, z], P), ey = iso([0, 1, z], P);
  const ax = ex[0] - o[0], ay = ex[1] - o[1], bx = ey[0] - o[0], by = ey[1] - o[1];
  const det = ax * by - ay * bx, dx = v.x - o[0], dy = v.y - o[1];
  return [(dx * by - dy * bx) / det, (ax * dy - ay * dx) / det];
};
const overSeat = (e) => {
  if (fit.lift < LIFT * 0.5) return null;
  // The plane halfway up the seat's hump.
  const [x, y] = planeAt(viewOfEvent(e), C2[0] + visOf(fit.g) / 2);
  return x > BLOCK.x0 - 2 && x < BLOCK.x1 + 2 && y > BLOCK.y0 && y < BLOCK.y1 + 6 ? x : null;
};

stage.addEventListener("pointerdown", (e) => {
  if (e.target.dataset && e.target.dataset.grab === "rope") {
    clearTimeout(haulIdle);
    haul.back = false;
    haul.drag = { id: e.pointerId };
    choose(4);
    spotlight(4);
    pullTo(planeAt(viewOfEvent(e), COURSE_TOP));
    stage.setPointerCapture(e.pointerId);
    stage.setAttribute("data-dragging", "");
    e.preventDefault();
    run();
    return;
  }
  if (e.target.classList && e.target.classList.contains("mp-grab")) {
    toHand();
    choose(2);
    spotlight(2);
    fit.held = false;
    drag = { y0: viewOfEvent(e).y, lift0: fit.lift, lift: fit.lift, id: e.pointerId };
    stage.setPointerCapture(e.pointerId);
    stage.setAttribute("data-dragging", "");
    e.preventDefault();
    run();
    return;
  }
  const x = overSeat(e);
  if (x !== null) {
    toHand();
    strike(x);
    run();
  }
});
stage.addEventListener("pointermove", (e) => {
  if (haul.drag && e.pointerId === haul.drag.id) {
    pullTo(planeAt(viewOfEvent(e), COURSE_TOP));
    run();
    return;
  }
  if (drag && e.pointerId === drag.id) {
    const dy = viewOfEvent(e).y - drag.y0;
    drag.lift = clamp(drag.lift0 + dy / screenRise(RATIO, P), 0, LIFT);
    toHand();
    return;
  }
  if (overSeat(e) !== null) stage.setAttribute("data-aim", "");
  else stage.removeAttribute("data-aim");
});
const endDrag = (e) => {
  if (haul.drag && e.pointerId === haul.drag.id) return endHaul();
  if (!drag || e.pointerId !== drag.id) return;
  drag = null;
  stage.removeAttribute("data-dragging");
  toHand();
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// ---- Keyboard ----------------------------------------------------------------------------
stage.addEventListener("keydown", (e) => {
  if (e.key === " ") {
    e.preventDefault();
    toHand();
    fit.held = !fit.held;
    run();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    toHand();
    strike(XM);
    run();
    return;
  }
  const here = Math.min(PASSES - 1, Math.floor(fit.mode === "tour" ? target : Math.log(fit.g / GAP0_MM) / Math.log(KEEP)));
  let to = null;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") to = Math.min(PASSES - 1, here + 1);
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = Math.max(0, here - 1);
  if (e.key === "Home") to = 0;
  if (e.key === "End") to = PASSES - 1;
  if (to === null) return;
  e.preventDefault();
  fit.mode = "tour";
  fit.held = false;
  touring = false;
  target = to + SEATED;
  clearTimeout(idle);
  idle = setTimeout(() => { if (still.matches || fit.mode !== "tour") return; touring = true; clock = target * PER_PASS; run(); }, IDLE_MS);
  run();
});

// ---- Parts and the side panel -----------------------------------------------------------
// Clicking a part, or its name in the list, picks it and the panel explains it. Pointing only
// previews: the part stands out while the rest of the drawing steps back, and in the drawing a
// label names it, so moving the pointer around (or scrolling the panel) never swaps the text.
const picks = [...document.querySelectorAll("[data-pick]")];
const abouts = [...document.querySelectorAll("[data-about]")];
const sectionEls = [...svg.querySelectorAll("[data-section]")];
const list = document.querySelector(".mp-list");
let chosen = FIRST, lit = 0;

function choose(id) {
  readMode = modeOf(id);
  drawReadout();
  if (id === chosen) return;
  chosen = id;
  picks.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.pick) === id)));
  abouts.forEach((a) => { a.hidden = Number(a.dataset.about) !== id; });
}
function spotlight(id) {
  if (id === lit) return;
  lit = id;
  stage.toggleAttribute("data-spot", Boolean(id));
  // A group may belong to several parts ("1 7": the ashlar wall is also what the quake tests).
  sectionEls.forEach((g) => g.toggleAttribute("data-on", g.dataset.section.split(" ").map(Number).includes(id)));
}
const sectionOf = (el) => {
  const g = el && el.closest ? el.closest("[data-section]") : null;
  return g ? Number(g.dataset.section.split(" ")[0]) : 0;
};

const tipEl = document.querySelector(".mp-tip");
const plateEl = stage.closest(".iso-plate");
function tip(id, e) {
  if (!id || e.pointerType === "touch" || drag || haul.drag) { tipEl.hidden = true; return; }
  const box = plateEl.getBoundingClientRect();
  tipEl.textContent = `${String(id).padStart(2, "0")} · ${T().sections[id - 1].name}`;
  tipEl.hidden = false;
  tipEl.style.left = `${Math.min(e.clientX - box.left + 14, box.width - tipEl.offsetWidth - 8)}px`;
  tipEl.style.top = `${e.clientY - box.top + 18}px`;
}

svg.addEventListener("pointerover", (e) => {
  if (drag || haul.drag) return;
  spotlight(sectionOf(e.target));
});
svg.addEventListener("pointermove", (e) => tip(sectionOf(e.target), e));
svg.addEventListener("click", (e) => {
  const id = sectionOf(e.target);
  if (id) choose(id);
});
stage.addEventListener("pointerleave", () => {
  tipEl.hidden = true;
  if (!drag && !haul.drag) spotlight(0);
});
picks.forEach((b) => {
  const id = Number(b.dataset.pick);
  b.addEventListener("pointerenter", () => spotlight(id));
  b.addEventListener("focus", () => spotlight(id));
  b.addEventListener("blur", () => spotlight(0));
  b.addEventListener("click", () => choose(id));
});
list.addEventListener("pointerleave", () => spotlight(0));

// ---- Theme ------------------------------------------------------------------------------
// Reuse the existing CSS palettes in place so switching never interrupts a simulation.
const themeButtons = [...document.querySelectorAll('[data-theme-toggle]')];
function syncTheme() {
  themeButtons.forEach((button) => {
    button.setAttribute('aria-checked', String(document.body.dataset.theme === 'dark'));
    button.title = T().darkTheme;
  });
}
themeButtons.forEach((button) => button.addEventListener('click', () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  try { localStorage.setItem('mp-theme', next); } catch {}
  syncTheme();
}));
syncTheme();

// ---- Switching language -----------------------------------------------------------------
const langButtons = [...document.querySelectorAll("[data-lang]")];
const noteEl = document.querySelector("[data-note]");
const cornerKeys = { fig: "fig", title: "cutaway", hint: "hint" };

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = T().title;
  // Text with numbers in it carries them in data-vars.
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = el.dataset.vars ? fmt(lookup(el.dataset.i18n), JSON.parse(el.dataset.vars)) : lookup(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", lookup(el.dataset.i18nLabel)));
  Object.entries(cornerKeys).forEach(([corner, key]) => {
    const el = document.querySelector(`[data-corner="${corner}"]`);
    if (el) el.textContent = T()[key];
  });
  svg.setAttribute("aria-label", T().figure);
  noteEl.textContent = `${T().stats.join(" · ")}. ${fmt(T().note, { tonnes: n(NOTE.tonnes, 1), exag: NOTE.exag, dry: n(NOTE.dry, 1), sat: n(NOTE.sat, 1), sim: NOTE.sim })} ${fmt(T().quakeNote, { exag: NOTE.quake })} ${fmt(T().haulNote, { mu: n(NOTE.mu, 1), pull: n(NOTE.pull, 1) })} ${T().sources}`;
  langButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  syncTheme();
  drawn.text = null;
  drawFit();
  drawWater();
  drawQuake();
  drawHaul();
  drawReadout();
  rampLive.refresh(lang);
}
langButtons.forEach((b) => b.addEventListener("click", () => {
  try { localStorage.setItem("mp-lang", b.dataset.lang); } catch {}
  applyLang(b.dataset.lang);
}));

// ---- Figures -----------------------------------------------------------------------------
// The tabs above the drawing switch the figure and its panel together. Fig 2 has an address of its
// own (#fig-2); a hidden Fig 1 stops moving because its stage leaves the screen.
const tabButtons = [...document.querySelectorAll("[data-tab]")];
const shows = [...document.querySelectorAll("[data-show]")];

function showFig(n, remember = true) {
  tabButtons.forEach((b) => {
    const on = Number(b.dataset.tab) === n;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  shows.forEach((el) => { el.hidden = Number(el.dataset.show) !== n; });
  rampLive.setActive(n === 2);
  if (remember) history.replaceState(null, "", n === 1 ? location.pathname + location.search : "#fig-2");
}
tabButtons.forEach((b) => {
  b.addEventListener("click", () => showFig(Number(b.dataset.tab)));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = tabButtons[(tabButtons.indexOf(b) + (e.key === "ArrowRight" ? 1 : tabButtons.length - 1)) % tabButtons.length];
    showFig(Number(next.dataset.tab));
    next.focus();
  });
});
if (location.hash === "#fig-2") showFig(2, false);

// ---- Controls ----------------------------------------------------------------------------
const press = (buttons, active) => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === active)));
rainButtons.forEach((b) => b.addEventListener("click", () => {
  water.rain = Number(b.dataset.rain);
  water.hours = 0;
  choose(6);
  press(rainButtons, b);
  run();
}));
fillButtons.forEach((b) => b.addEventListener("click", () => {
  if (water.fill === b.dataset.fill) return;
  water.fill = b.dataset.fill;
  water.hours = 0;
  choose(6);
  if (water.fill === "drained") water.pond = 0;
  press(fillButtons, b);
  run();
}));
press(rainButtons, rainButtons[water.rain]);

const shakeButtons = [...document.querySelectorAll("[data-shake]")];
const wallButtons = [...document.querySelectorAll("[data-wall]")];
shakeButtons.forEach((b) => b.addEventListener("click", () => {
  choose(8);
  shake(Number(b.dataset.shake));
  run();
}));
wallButtons.forEach((b) => b.addEventListener("click", () => {
  choose(8);
  if (quake.wall === b.dataset.wall) return;
  quake.wall = b.dataset.wall;
  // A rebuilt wall starts sound.
  quake.cracked = 0;
  quake.done = false;
  press(wallButtons, b);
  run();
}));

still.addEventListener("change", () => {
  if (still.matches) { touring = false; drops.length = 0; splashes.length = 0; }
  run();
});
if (lang === "en") {
  drawFit();
  drawWater();
  drawQuake();
  drawHaul();
  drawReadout();
} else applyLang(lang);

// End the one-time entrance after it settles, or immediately when the reader interacts.
function finishEntry() {
  document.body.classList.remove('mp-enter');
  document.removeEventListener('pointerdown', finishEntry, true);
  document.removeEventListener('keydown', finishEntry, true);
}
setTimeout(finishEntry, 1300);
document.addEventListener('pointerdown', finishEntry, { capture: true, once: true });
document.addEventListener('keydown', finishEntry, { capture: true, once: true });
