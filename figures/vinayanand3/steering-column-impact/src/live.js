// Live column: the driver's tilt and telescope, and the FMVSS 203 impact
// test run in slow motion, all redrawn from benchParts with the same geometry
// the build drew and audited.
const D = __DATA__;
const { COLUMN, DETENTS, U, P, TEST } = D;
const { launch: RUN, fly: FLIGHT, travel: TRAVEL } = D.track;
const OUT = COLUMN.telescopeMm;
const SLOW = 25;                                       // the test runs 25 times slower than life
const figure = document.querySelector(".iso-figure");
const stage = figure.querySelector(".cl-stage");
const readout = figure.querySelector("[data-readout]");
const slots = new Map([...stage.querySelectorAll("g[data-n]")].map((g) => [g.dataset.n, g]));
const art = stage.querySelector(".cl-art");
// keep the parts in depth order as they move: each moving part's key rises
// by its lift times how far it has gone, as the build solved it
let order = D.ORDER.slice();
function resort(shares) {
  const at = new Map();
  D.ORDER.forEach((name, i) => { const k = D.KEYS[i]; if (!k.pin) at.set(name, k.key + (D.LIFT[k.group] ?? 0) * (shares[k.group] ?? 0)); });
  D.ORDER.forEach((name, i) => { const k = D.KEYS[i]; if (k.pin) at.set(name, Math.min(...k.pin.map((p) => at.get(p))) - 1e-4); });
  const next = [...at.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  if (next.every((name, i) => name === order[i])) return;
  order = next;
  art.append(...order.map((name) => slots.get(name)));
}
const drawn = new Map();
for (const [name, g] of slots) drawn.set(name, g.innerHTML);

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const narrow = matchMedia("(max-width: 560px)");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The test's kinematics, in world units and seconds of test time. The
// accelerator's piston tube brings the block to speed over its stroke at a
// steady acceleration; the tube stops and the block flies on, separated, at
// 24 km/h; at the wheel it slows steadily to rest over the travel the
// column's full stroke allows it (the drawing runs the spec's stroke, it does
// not compute one).
const V = (TEST.speedKmh / 3.6) * 1000 * U;            // units per second
const A_LAUNCH = (V * V) / (2 * RUN);
const T_LAUNCH = V / A_LAUNCH;
const T_FLY = FLIGHT / V;
const X_HIT = TRAVEL[TRAVEL.length - 1];
const A_HIT = (V * V) / (2 * X_HIT);
const T_HIT = V / A_HIT;
// the column stroke (mm) that lets the block travel x past contact
function strokeFor(x) {
  for (let i = 1; i < TRAVEL.length; i++) if (x <= TRAVEL[i]) {
    const f = (x - TRAVEL[i - 1]) / (TRAVEL[i] - TRAVEL[i - 1] || 1);
    return ((i - 1 + f) / (TRAVEL.length - 1)) * COLUMN.strokeMm;
  }
  return COLUMN.strokeMm;
}
function testAt(t) {
  if (t < T_LAUNCH) {
    const x = 0.5 * A_LAUNCH * t * t;
    return { carriage: x, block: x, speed: A_LAUNCH * t, stroke: 0 };
  }
  t -= T_LAUNCH;
  if (t < T_FLY) return { carriage: RUN, block: RUN + V * t, speed: V, stroke: 0 };
  t = Math.min(t - T_FLY, T_HIT);
  const x = V * t - 0.5 * A_HIT * t * t;
  return { carriage: RUN, block: RUN + FLIGHT + x, speed: V - A_HIT * t, stroke: strokeFor(x) };
}
const T_END = T_LAUNCH + T_FLY + T_HIT;

// what the reader asked for, and where the parts are now
const goal = { detent: 2, telescope: 0 };
const now = { tilt: 0, telescope: 0, carriage: 0, block: 0, stroke: 0, speed: 0 };
// phase: idle, prep (back to the design position), run, hold, back
let phase = "idle";
let clock = 0;
let touched = performance.now();

function draw() {
  const pose = { tilt: now.tilt, slideMm: now.stroke - now.telescope, telescope: now.telescope, stroke: now.stroke, carriage: now.carriage, block: now.block };
  const { items } = benchParts(k, G, T, P, D, pose, null);
  resort({ column: pose.slideMm * U, bellows: pose.slideMm * U, block: pose.block, carriage: pose.carriage });
  // a part that has folded away (the bellows at full stroke) draws nothing
  const present = new Set(items.map((item) => item.name));
  for (const [name, g] of slots) if (!present.has(name) && drawn.get(name)) (g.innerHTML = ""), drawn.set(name, "");
  for (const item of items) {
    if (drawn.get(item.name) === item.svg) continue;
    const g = slots.get(item.name);
    if (!g) continue;
    g.innerHTML = item.svg;
    drawn.set(item.name, item.svg);
  }
  const t = Math.round(now.tilt * 2) / 2;
  const kmh = (now.speed / (1000 * U)) * 3.6;
  const test = `block ${kmh.toFixed(1)} km/h · stroke ${Math.round(now.stroke)} mm`;
  // a phone has room for the test's numbers only
  readout.textContent = narrow.matches ? test : `tilt ${t > 0 ? "+" : ""}${t.toFixed(1).replace(/\.0$/, "")}° · telescope ${Math.round(now.telescope)} mm · ${test}`;
}

// ---- the idle tour: walk the detents, telescope, then run the test ---------
const TOUR = [
  [1400, () => (goal.detent = 3)],
  [1400, () => (goal.detent = 4)],
  [1400, () => (goal.detent = 1)],
  [1600, () => (goal.telescope = OUT)],
  [1600, () => ((goal.detent = 2), (goal.telescope = 0))],
  [6500, () => runTest()],
];
let step = TOUR.length - 1;
let stepAt = performance.now();
let touring = true;
let paused = false;

// the test runs at the design position (J944 6.2), so the column goes there first
function runTest() {
  if (phase !== "idle") return;
  Object.assign(goal, { detent: 2, telescope: 0 });
  phase = "prep";
}
function reset() {
  if (phase === "idle" || phase === "back") return;
  phase = "back";
}

// ---- frame loop ------------------------------------------------------------
let last = performance.now();
let visible = true;
let running = false;
let holdUntil = 0;
function frame(time) {
  const dt = Math.min(0.05, (time - last) / 1000);
  last = time;
  // the tour waits while the reader works the bench, then starts again from rest
  if (touring && time - touched > 6000 && phase === "idle") {
    if (paused) {
      paused = false;
      Object.assign(goal, { detent: 2, telescope: 0 });
      step = TOUR.length - 1;
      stepAt = time;
    } else if (time - stepAt > TOUR[step][0]) {
      stepAt = time;
      step = (step + 1) % TOUR.length;
      TOUR[step][1]();
    }
  }
  const follow = (from, to, rate) => (reduce.matches ? to : from + (to - from) * (1 - Math.exp(-rate * dt)));
  now.tilt = follow(now.tilt, DETENTS[goal.detent], 9);
  now.telescope = follow(now.telescope, goal.telescope, 7);

  if (phase === "prep" && Math.abs(now.tilt) < 0.02 && now.telescope < 0.1) {
    now.tilt = 0;
    now.telescope = 0;
    phase = "run";
    clock = 0;
  }
  if (phase === "run") {
    clock = reduce.matches ? T_END : Math.min(T_END, clock + dt / SLOW);
    Object.assign(now, testAt(clock));
    if (clock >= T_END) {
      phase = "hold";
      holdUntil = time + 1600;
    }
  }
  if (phase === "hold" && time > holdUntil && touring && !paused) phase = "back";
  if (phase === "back") {
    // the rig is reset: block back on the piston tube, column restored
    now.speed = 0;
    now.block = follow(now.block, 0, 2.6);
    now.carriage = follow(now.carriage, 0, 2.6);
    now.stroke = follow(now.stroke, 0, 2.6);
    if (now.block < 0.05 && now.stroke < 0.05) {
      Object.assign(now, { block: 0, carriage: 0, stroke: 0 });
      phase = "idle";
      stepAt = time;
    }
  }

  draw();
  const settled = phase === "idle" && Math.abs(now.tilt - DETENTS[goal.detent]) < 0.01 && Math.abs(now.telescope - goal.telescope) < 0.05;
  if (visible && (!settled || touring || phase !== "idle")) requestAnimationFrame(frame);
  else running = false;
}
function wake() {
  if (running || !visible) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

// ---- pointer and keys ------------------------------------------------------
const take = () => {
  touched = performance.now();
  paused = true;
  wake();
};
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, detent: goal.detent, telescope: goal.telescope, at: performance.now(), moved: false };
  stage.setPointerCapture(e.pointerId);
  take();
});
stage.addEventListener("pointermove", (e) => {
  if (!drag || phase !== "idle") return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
  if (!drag.moved) return;
  const scale = stage.getBoundingClientRect().width / D.W;
  goal.detent = clamp(drag.detent + Math.round((drag.y - e.clientY) / (26 * scale)), 0, DETENTS.length - 1);
  goal.telescope = clamp(drag.telescope + (drag.x - e.clientX) / (2.2 * scale), 0, OUT);
  take();
});
// a tap runs the test, or resets the rig after one
stage.addEventListener("pointerup", () => {
  if (drag && !drag.moved && performance.now() - drag.at < 400) {
    if (phase === "idle") runTest();
    else reset();
    take();
  }
  drag = null;
});
stage.addEventListener("pointercancel", () => (drag = null));
const adjust = (f) => () => phase === "idle" && f();
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
  const keys = {
    ArrowUp: adjust(() => (goal.detent = clamp(goal.detent + 1, 0, DETENTS.length - 1))),
    ArrowDown: adjust(() => (goal.detent = clamp(goal.detent - 1, 0, DETENTS.length - 1))),
    ArrowLeft: adjust(() => (goal.telescope = clamp(goal.telescope + 5, 0, OUT))),
    ArrowRight: adjust(() => (goal.telescope = clamp(goal.telescope - 5, 0, OUT))),
    c: runTest,
    C: runTest,
    r: reset,
    R: reset,
  };
  if (!keys[e.key]) return;
  e.preventDefault();
  keys[e.key]();
  take();
});

new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  wake();
}).observe(stage);
if (reduce.matches) touring = false;
reduce.addEventListener?.("change", () => {
  touring = !reduce.matches;
  wake();
});
window.__column = { goal, now, runTest, reset, phase: () => phase, stop: () => (touring = false) };
wake();
