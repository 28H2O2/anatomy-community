
const D = __DATA__;
const P = D.P;
const TURN = Math.PI * 2;
const stage = document.querySelector(".wt-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const status = stage.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
HAIR.stud = D.hairStud;
const state = createState(9);
state.rotor = D.rotorRest;
window.__watch = state;

const turners = D.parts
  .map((p) => {
    const el = svg.querySelector(`[data-part="${p.part}"]`);
    if (!el) return null;
    const groups = el.dataset.m ? [[el, el.dataset.m]] : [...el.children].filter((c) => c.dataset.m).map((g) => [g, g.dataset.m]);
    return { ...p, groups, last: NaN };
  })
  .filter(Boolean);
const hairEl = svg.querySelector('[data-part="hairspring"]');
const springEl = svg.querySelector('[data-part="mainspring"]');
const bridleEl = svg.querySelector('[data-part="bridle"]');
const ribsEl = svg.querySelector('[data-part="crown-ribs"]');
const rimEl = svg.querySelector('[data-part="rim"]');
const revEls = [svg.querySelector('[data-part="revA"]'), svg.querySelector('[data-part="revB"]')];
let engaged = 0;
const rimPaths = {
  fill: rimEl.querySelector(".iso-fill"),
  shades: [0, 1, 2, 3].map((i) => rimEl.querySelector(`.iso-shade[data-shade="${i}"]`)),
  top: rimEl.querySelector(".iso-top"),
  crease: rimEl.querySelector(".iso-crease"),
  edge: rimEl.querySelector(".iso-edge"),
};

let theta = 0;
let forkSide = 1;
let clickLift = 0;

function angleOf(drive) {
  const e = state.escape;
  const a = state.arbor;
  switch (drive) {
    case "escape": return e * TURN;
    case "fourth": return (-e / 16) * TURN;
    case "third": return (e / 120) * TURN;
    case "centre": return (-e / 960) * TURN;
    case "drum": return state.drum * TURN;
    case "arbor": return a * TURN;
    case "crownwheel": return -a * (40 / 26) * TURN;
    case "red2": return -a * (40 / 15) * TURN;
    case "red1": return a * 14 * TURN;
    case "revPinion": return -a * 70 * TURN;
    case "rotor": return state.rotor;
    case "revA": return -state.rotor / 2;
    case "revB": return state.rotor / 2;
    case "balls": return state.rotor / 2;
    case "balance": return theta;
    case "fork": return forkSide * D.forkSwing;
    case "click": return clickLift;
  }
  return 0;
}

const screenCCW = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s < 0 ? pts.slice().reverse() : pts;
};
const dOf = (pts, closed) => pathOf(pts, closed);

// Heavy rim as a prism whose inner wall is never drawn: the rotor plate covers it.
function drawRim(angle) {
  const { ring, innerFrom } = rimRing(0, 0, angle);
  const n = ring.length;
  const top = ring.map(([x, y]) => iso([x, y, D.rim.z1], P));
  const bot = ring.map(([x, y]) => iso([x, y, D.rim.z0], P));
  const [vx, vy] = towardViewer(P);
  const { sinA, cosA } = cameraOf(P);
  const kind = [];
  const tone = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % n];
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy) || 1;
    const nx = dy / L;
    const ny = -dx / L;
    const inner = i >= innerFrom && i < n - 1;
    kind.push(inner ? "inner" : nx * vx + ny * vy > 1e-9 ? "wall" : "back");
    tone.push(Math.min(3, Math.max(0, Math.floor(((nx * -sinA + ny * cosA + 1) / 2) * 4))));
  }
  const fill = [dOf(screenCCW(top), true)];
  const shades = [[], [], [], []];
  const crease = [];
  const edge = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (kind[i] === "wall") {
      const quad = dOf(screenCCW([top[i], top[j], bot[j], bot[i]]), true);
      fill.push(quad);
      shades[tone[i]].push(quad);
      crease.push(dOf([top[i], top[j]]));
      edge.push(dOf([bot[i], bot[j]]));
    } else if (kind[i] === "inner") crease.push(dOf([top[i], top[j]]));
    else edge.push(dOf([top[i], top[j]]));
    const prev = kind[(i + n - 1) % n];
    if ((prev === "wall") !== (kind[i] === "wall")) edge.push(dOf([top[i], bot[i]]));
  }
  rimPaths.fill.setAttribute("d", fill.join(""));
  shades.forEach((list, i) => rimPaths.shades[i].setAttribute("d", list.join("")));
  rimPaths.top.setAttribute("d", dOf(screenCCW(top), true));
  rimPaths.crease.setAttribute("d", crease.join(""));
  rimPaths.edge.setAttribute("d", edge.join(""));
}

let springKey = "";
let crownKey = NaN;
let hairKey = NaN;
function draw() {
  const calm = still.matches;
  theta = calm || !state.running ? 0 : ((state.amplitude * Math.PI) / 180) * Math.sin(state.phase);
  const esc = escapementOf(state.phase, Math.max(state.amplitude, 1));
  forkSide = state.running || state.amplitude > 1 ? esc.side : forkSide;
  const tooth = (state.arbor * 40) % 1;
  clickLift = -0.11 * tooth * (1 - smooth(0.88, 1, tooth));
  for (const t of turners) {
    const a = t.base + angleOf(t.drive);
    if (Math.abs(a - t.last) < 1e-5) continue;
    t.last = a;
    const deg = ` rotate(${(a * 180 / Math.PI).toFixed(3)})`;
    for (const [g, m] of t.groups) g.setAttribute("transform", m + deg);
  }
  if (theta !== hairKey) {
    hairKey = theta;
    hairEl.setAttribute("d", polyD(hairspringPoints(theta)));
  }
  const key = `${state.wind.toFixed(4)}|${state.arbor.toFixed(4)}|${(state.drum + state.slip).toFixed(4)}`;
  if (key !== springKey) {
    springKey = key;
    const s = mainspringPoints(state.wind, state.arbor);
    springEl.setAttribute("d", polyD(s.points));
    bridleEl.setAttribute("d", polyD(bridlePoints(s.end)));
    bridleEl.toggleAttribute("data-slipping", state.slipping > 0.05);
  }
  if (state.crown !== crownKey) {
    crownKey = state.crown;
    const [s0, s1, r, count] = D.stem.ribs;
    ribsEl.innerHTML = fadedSvg(G.ribsOf(D.stem.F, s0, s1, r, count, P, { fade: [0.1, 0.55], seams: true, phase: state.crown * TURN }), { tone: "lo" });
  }
  drawRim(state.rotor);
  const drive = Math.abs(state.spin) > 0.05 ? (state.spin > 0 ? 1 : 2) : 0;
  if (drive !== engaged) {
    engaged = drive;
    revEls.forEach((el, i) => el.toggleAttribute("data-engaged", drive === i + 1));
  }
  say();
}

// ---------------------------------------------------------------- input and the idle tour
let grab = null;
let crowning = false;
let crownUntil = 0;
let letting = false;
let slow = false;
let touring = !still.matches;
let tourClock = -1.4;
let idleTimer = 0;
let winding = 0;
let last = 0;
let frame = 0;
let visible = false;

const viewPoint = (event) => {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};
// Plan angle round the centre of the point under the pointer, on the rotor's plane.
function planAngle(event) {
  const p = viewPoint(event);
  const o = iso([0, 0, D.rim.z1], P);
  const ex = iso([1, 0, D.rim.z1], P);
  const ey = iso([0, 1, D.rim.z1], P);
  const a = ex[0] - o[0], b = ex[1] - o[1], c = ey[0] - o[0], d = ey[1] - o[1];
  const det = a * d - b * c;
  const sx = p.x - o[0], sy = p.y - o[1];
  const x = (d * sx - c * sy) / det;
  const y = (-b * sx + a * sy) / det;
  return Math.atan2(y, x);
}
function takeOver() {
  touring = false;
  slowTour = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(function resume() {
    if (pinnedStep) {
      idleTimer = setTimeout(resume, 3600);
      return;
    }
    if (!still.matches) {
      touring = true;
      tourClock = -1.4;
      run();
    }
  }, 3600);
}
let slowTour = false;
const speed = () => (slow || slowTour ? 1 / 8 : 1);

stage.addEventListener("pointerdown", (event) => {
  takeOver();
  if (event.target.closest('[data-part="crown"]')) {
    crowning = true;
    crownUntil = Infinity;
  } else {
    const a = planAngle(event);
    grab = { id: event.pointerId, angle: a, target: state.rotor, offset: state.rotor - a };
    stage.setAttribute("data-grab", "");
    try { stage.setPointerCapture(event.pointerId); } catch {}
  }
  run();
});
stage.addEventListener("pointermove", (event) => {
  if (!grab || event.pointerId !== grab.id) return;
  const a = planAngle(event);
  let d = a - grab.angle;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  grab.angle = a;
  grab.target += d;
  takeOver();
  run();
});
const release = () => {
  grab = null;
  stage.removeAttribute("data-grab");
  if (crownUntil === Infinity) {
    crowning = false;
    crownUntil = 0;
  }
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const key = event.key;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    takeOver();
    state.spin += (key === "ArrowLeft" ? 1 : -1) * (event.shiftKey ? 16 : 9);
  } else if (key === " ") {
    takeOver();
    slow = !slow;
    announce(slow ? "slow motion, one eighth speed" : "real time");
  } else if (key === "w" || key === "W" || key === "Enter") {
    takeOver();
    crowning = true;
    crownUntil = key === "Enter" ? clock + 1.2 : Infinity;
  } else if (key === "r" || key === "R") {
    takeOver();
    letting = true;
    announce("letting the mainspring down");
  } else if (key === "Escape") {
    takeOver();
    slow = false;
    crowning = false;
    letting = false;
    windToFull = false;
    pinnedStep = null;
    showStep();
  } else return;
  event.preventDefault();
  run();
});
stage.addEventListener("keyup", (event) => {
  if ((event.key === "w" || event.key === "W") && crownUntil === Infinity) {
    crowning = false;
    crownUntil = 0;
  }
});

// Tour: wrist swings (gravity pulls the rotor's heavy side round), slow motion on the escapement,
// winding at the crown, then a few seconds of running.
const TOUR = 27;
function tourAt(t) {
  if (t < 0) return { wrist: 0, slow: false, crown: false, roll: 0 };
  const u = t % TOUR;
  return {
    wrist: u < 9 ? 1 : 0,
    slow: u >= 9.5 && u < 15.5,
    crown: u >= 16 && u < 21.5,
    roll: 1.25 * Math.sin((TURN * u) / 2.1) + 0.9 * Math.sin((TURN * u) / 3.4 + 1.1),
  };
}

let clock = 0;
function torqueNow(tour) {
  if (grab) return (rotor, spin) => 520 * (grab.target - rotor) - 44 * spin;
  if (tour && tour.wrist) {
    const down = tour.roll;
    return (rotor) => -70 * Math.sin(rotor - down);
  }
  return () => 0;
}

function tick(now) {
  const real = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += real;
  const tour = touring ? tourAt((tourClock += real)) : null;
  slowTour = Boolean(tour && tour.slow);
  if (tour) crowning = tour.crown;
  if (crownUntil !== Infinity && crownUntil && clock > crownUntil) {
    crowning = false;
    crownUntil = 0;
  }
  const dt = real * speed();
  const before = state.arbor;
  rotorFor(state, dt, torqueNow(tour));
  const byRotor = state.arbor - before;
  if (windToFull) {
    crowning = true;
    crownUntil = Infinity;
    if (state.slipping > 0.5) {
      windToFull = false;
      crownUntil = clock + 1.6;
    }
  }
  if (crowning) windBy(state, (windToFull ? 0.6 : 0.32) * dt, true);
  if (letting) {
    const step = Math.min(state.wind, 0.9 * dt);
    state.wind -= step;
    state.arbor -= step;
    state.crown -= step / CROWN_RATIO;
    if (state.wind <= 0) letting = false;
  }
  runFor(state, dt);
  winding = Math.max(byRotor > 1e-7 ? 1 : 0, winding - real * 2);
  tourStep = tour && tourClock >= 0 ? (tour.wrist ? "rotor" : tour.slow ? "escapement" : tour.crown ? "crown" : "train") : null;
  tourFocus = tour && (tour.slow || tour.crown) ? tourStep : null;
  showStep();
  draw();
  const calm = still.matches;
  const busy = grab || crowning || letting || windToFull || Math.abs(state.spin) > 0.02;
  frame = visible && (!calm || busy || touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;

// ---------------------------------------------------------------- steps of the explanation
const movement = svg.querySelector(".wt-movement");
const items = [...movement.children].filter((n) => n.classList.contains("it"));
const steps = [...document.querySelectorAll(".wt-step")];
const liveReserve = [...document.querySelectorAll('[data-live="reserve"]')];
const liveAmp = [...document.querySelectorAll('[data-live="amp"]')];
let hoverStep = null;
let pinnedStep = null;
let tourStep = null;
let tourFocus = null;
let shown = "";
let windToFull = false;
function showStep() {
  const s = hoverStep || pinnedStep || tourFocus;
  const key = `${s}|${s === tourFocus && !hoverStep && !pinnedStep}|${pinnedStep}|${tourStep}`;
  if (key === shown) return;
  shown = key;
  if (s) svg.setAttribute("data-focus", s);
  else svg.removeAttribute("data-focus");
  svg.toggleAttribute("data-soft", Boolean(s) && s === tourFocus && !hoverStep && !pinnedStep);
  for (const it of items) it.toggleAttribute("data-on", Boolean(s) && (it.dataset.steps || "").split(" ").includes(s));
  steps.forEach((el) => {
    el.setAttribute("aria-pressed", String(el.dataset.step === pinnedStep));
    el.toggleAttribute("data-active", el.dataset.step === tourStep);
  });
}
function demo(step) {
  takeOver();
  crowning = false;
  crownUntil = 0;
  windToFull = false;
  slow = step === "escapement";
  if (step === "rotor" || step === "reduction") state.spin += 11;
  if (step === "reversers") {
    state.spin += 10;
    setTimeout(() => { if (pinnedStep === "reversers") state.spin -= 18; run(); }, 1300);
  }
  if (step === "spring" || step === "crown") {
    crowning = true;
    crownUntil = clock + 2.5;
  }
  if (step === "bridle") windToFull = true;
  run();
}
function endDemo() {
  slow = false;
  crowning = false;
  crownUntil = 0;
  windToFull = false;
}
steps.forEach((el) => {
  el.addEventListener("pointerenter", () => { hoverStep = el.dataset.step; showStep(); });
  el.addEventListener("pointerleave", () => { hoverStep = null; showStep(); });
  el.addEventListener("focus", () => { hoverStep = el.dataset.step; showStep(); });
  el.addEventListener("blur", () => { hoverStep = null; showStep(); });
  const act = () => {
    const s = el.dataset.step;
    pinnedStep = pinnedStep === s ? null : s;
    if (pinnedStep) demo(s);
    else endDemo();
    showStep();
  };
  el.addEventListener("click", act);
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      act();
    }
  });
});

// ---------------------------------------------------------------- readout
let lastPhase = "";
let announceTimer = 0;
function phaseOf() {
  if (letting) return "letting down";
  if (state.slipping > 0.05) return "full · bridle slipping";
  if (crowning) return "winding by crown";
  if (winding > 0.05) return "winding by rotor";
  if (!state.running) return state.amplitude > 1 ? "stopping" : "stopped";
  return "running";
}
function say() {
  const phase = phaseOf();
  const amp = state.running || state.amplitude > 1 ? ` · ${Math.round(state.amplitude)}°` : "";
  const text = `${phase} · reserve ${hm(reserveOf(state))}${amp}${speed() < 1 ? " · ×1/8" : ""}`;
  if (readout.textContent !== text) readout.textContent = text;
  const reserve = hm(reserveOf(state));
  const ampText = String(Math.round(state.amplitude));
  for (const el of liveReserve) if (el.textContent !== reserve) el.textContent = reserve;
  for (const el of liveAmp) if (el.textContent !== ampText) el.textContent = ampText;
  if (phase !== lastPhase) {
    lastPhase = phase;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => announce(`${phase}, ${hm(reserveOf(state)).replace(" h ", " hours ")} minutes of reserve`), 700);
  }
}
function announce(text) {
  status.textContent = text;
}
stage.addEventListener("focus", () => announce(`${phaseOf()}, ${hm(reserveOf(state)).replace(" h ", " hours ")} minutes of reserve`));
draw();
