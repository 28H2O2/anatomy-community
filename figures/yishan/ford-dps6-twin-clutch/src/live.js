
const D = __DATA__;
__MODEL__
const SLOW = 400; // shafts are drawn this many times slower than real
const SHIFT_TIME = 1.0; // clutch crossover, about four times slower than the real ~0.25 s
const DRUM_RATE = 170; // drum °/s (real ≈ 600°/s)
const ACCEL = 2.6 * 3.6; // km/h per s
const BRAKE = 3.4 * 3.6;
const NAMES = { R: "R", 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th" };

const root = document.querySelector(".dp");
const stage = root.querySelector(".dp-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const live = root.querySelector("[data-live]");
const tourButton = root.querySelector("[data-tour]");
const gearButtons = [...root.querySelectorAll("[data-gear]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---- refs
const movers = {};
for (const el of svg.querySelectorAll("[data-mv]")) (movers[el.dataset.mv] ??= []).push(el);
const powered = [...svg.querySelectorAll("[data-pw]")].map((el) => ({ tag: el.dataset.pw, solids: [...el.querySelectorAll(".iso-solid")] }));
const spins = D.SPIN.map((s) => ({ ...s, groups: [...svg.querySelectorAll(`[data-sp="${CSS.escape(s.id)}"]`)], angle: 0, shown: 0 }));
const grooves = { odd: [], even: [] };
for (const el of svg.querySelectorAll("[data-groove]")) grooves[el.dataset.groove][+el.dataset.j] = el;
const sleevesOf = { odd: [], even: [] };
for (const [id, s] of Object.entries(SLEEVES)) sleevesOf[s.drum].push(id);
for (const drum of ["odd", "even"]) sleevesOf[drum].sort((a, b) => D.SLV[a] - D.SLV[b]);

// ---- screen helpers (the projection is linear)
const screen = ([x, y, z]) => [D.O[0] + D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.O[1] + D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z];
const shift = (dx) => `translate(${(D.EX[0] * dx).toFixed(2)} ${(D.EX[1] * dx).toFixed(2)})`;
function aboutY(pivot, beta) {
  // Rotation about the y axis through `pivot`, as a screen affine map for points in that x–z plane.
  const [a, b] = [D.EX, D.EZ];
  const det = a[0] * b[1] - b[0] * a[1];
  const inv = [[b[1] / det, -b[0] / det], [-a[1] / det, a[0] / det]];
  const c = Math.cos(beta), s = Math.sin(beta);
  const rot = [[c, s], [-s, c]];
  const B = [[a[0], b[0]], [a[1], b[1]]];
  const mul = (m, n) => [[m[0][0] * n[0][0] + m[0][1] * n[1][0], m[0][0] * n[0][1] + m[0][1] * n[1][1]], [m[1][0] * n[0][0] + m[1][1] * n[1][0], m[1][0] * n[0][1] + m[1][1] * n[1][1]]];
  const T = mul(mul(B, rot), inv);
  const sp = screen(pivot);
  const e = sp[0] - (T[0][0] * sp[0] + T[0][1] * sp[1]);
  const f = sp[1] - (T[1][0] * sp[0] + T[1][1] * sp[1]);
  return `matrix(${T[0][0].toFixed(4)} ${T[1][0].toFixed(4)} ${T[0][1].toFixed(4)} ${T[1][1].toFixed(4)} ${e.toFixed(2)} ${f.toFixed(2)})`;
}

// ---- state
const S = {
  v: 0, // km/h, negative in reverse
  target: "1", // the gear the driver asked for
  stop: true, // driver wants to stand still
  gear: "1", // gear on the closed (or launching) clutch
  c: { 1: 0, 2: 0 }, // clutch engagement
  drum: { odd: DETENT.odd[1], even: DETENT.even[2] },
  drumGoal: { odd: DETENT.odd[1], even: DETENT.even[2] },
  engine: IDLE,
  hand: null, // { from, to, t, rpmFrom }
  litKey: "",
};
const parity = (g) => DRUM_OF[g];
const otherDrum = (drum) => (drum === "odd" ? "even" : "odd");
const subRpm = { core: 0, hollow: 0 };
function shaftSpeeds() {
  const wheel = wheelRpm(S.v);
  const out = { A: wheel * FD.A, B: wheel * FD.B };
  const lockedOdd = engagedOn("odd", S.drum.odd);
  const lockedEven = engagedOn("even", S.drum.even);
  subRpm.core = lockedOdd ? out[SHAFT[lockedOdd]] * RATIO[lockedOdd] : S.c[1] * S.engine;
  subRpm.hollow = lockedEven ? out[SHAFT[lockedEven]] * RATIO[lockedEven] * (lockedEven === "R" ? -1 : 1) : S.c[2] * S.engine;
  return { wheel, out, lockedOdd, lockedEven };
}
const inputOf = (g) => (CLUTCH[g] === 1 ? subRpm.core : subRpm.hollow);
const rpmIn = (g, v) => Math.abs(inputRpmIn(g, v));

function targetSpeed() {
  if (S.stop) return 0;
  if (S.target === "R") return -kmhAt("R", 1700);
  return kmhAt(S.target, 2300);
}
// The gear the idle drum should hold ready.
function nextFor(g) {
  if (g === "R") return "1";
  const n = +g;
  const want = targetSpeed();
  if (S.target === "R") return n === 1 ? "R" : String(n - 1);
  if (S.stop) return n > 1 ? String(n - 1) : "2";
  if (+S.target > n || (+S.target === n && want > S.v + 0.5)) return String(Math.min(6, n + 1));
  if (+S.target < n) return String(n - 1);
  return String(Math.min(6, n + 1));
}
function say(text) {
  if (live.textContent !== text) live.textContent = text;
}

function step(dt, calm) {
  // Driver.
  const want = targetSpeed();
  const dv = want - S.v;
  const launching = Math.abs(S.v) < 0.05 && !S.stop && S.hand === null && parity(S.gear) !== undefined;
  const sameWay = (S.gear === "R") === (want < 0) || Math.abs(want) < 0.01;
  let rate = dv > 0 ? ACCEL : BRAKE;
  if (Math.sign(S.v) !== 0 && Math.sign(want) !== Math.sign(S.v) && Math.abs(want) > 0.01) rate = BRAKE;
  if (!sameWay && Math.abs(S.v) < 0.05) rate = 0; // wait for the reverse/forward hand-over first
  S.v += Math.sign(dv) * Math.min(Math.abs(dv), rate * Math.min(1, Math.abs(dv) / 4 + 0.15) * dt);
  if (calm) S.v = sameWay ? want : 0;

  // TCM: decide the next gear.
  let desired = S.gear;
  if (S.target === "R" && S.gear !== "R" && Math.abs(S.v) < 0.5) desired = "R";
  else if (S.target !== "R" && S.gear === "R" && Math.abs(S.v) < 0.5) desired = "1";
  else if (S.gear !== "R") {
    const n = +S.gear;
    const goal = S.stop ? 1 : +S.target;
    const cruising = Math.abs(want - S.v) < 2;
    if (n < goal && (rpmIn(S.gear, S.v) >= UP_RPM || (cruising && rpmIn(String(n + 1), S.v) >= 1400))) desired = String(n + 1);
    if (n > goal && rpmIn(String(n - 1), S.v) <= (S.stop ? 1700 : 2600)) desired = String(n - 1);
    if (S.stop && n > 1 && rpmIn(S.gear, S.v) < DOWN_RPM) desired = String(n - 1);
  }

  // Drums: the active drum holds its gear; the idle drum turns to the gear we will need next.
  const active = parity(S.gear);
  const idle = otherDrum(active);
  const ready = desired !== S.gear ? desired : nextFor(S.gear);
  if (S.hand === null) {
    S.drumGoal[active] = DETENT[active][S.gear];
    if (parity(ready) === idle) S.drumGoal[idle] = DETENT[idle][ready];
  }
  for (const drum of ["odd", "even"]) {
    const goal = S.drumGoal[drum];
    const d = goal - S.drum[drum];
    const moving = drum !== active || S.hand !== null;
    if (moving || Math.abs(d) < 0.01) S.drum[drum] += calm ? d : Math.sign(d) * Math.min(Math.abs(d), DRUM_RATE * dt * Math.min(1, Math.abs(d) / 20 + 0.25));
  }

  // Start a hand-over once the idle drum has the new gear home.
  if (S.hand === null && desired !== S.gear && engagedOn(parity(desired), S.drum[parity(desired)]) === desired) {
    S.hand = { from: S.gear, to: desired, t: 0, rpmFrom: S.engine };
    say(`${NAMES[desired]} already engaged on the ${CLUTCH[desired] === 1 ? "core" : "hollow"} shaft · clutch ${CLUTCH[S.gear]} opens as clutch ${CLUTCH[desired]} closes`);
  }

  const speeds = shaftSpeeds();
  if (S.hand) {
    const h = S.hand;
    h.t = calm ? SHIFT_TIME : h.t + dt;
    const s = smooth(h.t / SHIFT_TIME);
    const standing = Math.abs(S.v) < 0.5;
    S.c[CLUTCH[h.from]] = standing ? Math.min(S.c[CLUTCH[h.from]], 1 - s) : 1 - s;
    S.c[CLUTCH[h.to]] = standing ? 0 : s;
    const target = Math.max(IDLE, rpmIn(h.to, S.v));
    S.engine = h.rpmFrom + (target - h.rpmFrom) * smooth((h.t / SHIFT_TIME - 0.25) / 0.75);
    if (h.t >= SHIFT_TIME) {
      S.gear = h.to;
      S.hand = null;
      say(`in ${NAMES[S.gear]} on clutch ${CLUTCH[S.gear]}`);
    }
  } else {
    const k = CLUTCH[S.gear];
    const locked = rpmIn(S.gear, S.v);
    S.c[k === 1 ? 2 : 1] = 0;
    if (S.stop && Math.abs(S.v) < 7) {
      S.c[k] = Math.max(0, S.c[k] - dt * 2.5);
      if (calm) S.c[k] = 0;
      S.engine = Math.max(IDLE, locked * S.c[k] + IDLE * (1 - S.c[k]));
    } else if (locked < LAUNCH_RPM && !S.stop) {
      // Launch: the clutch slips, holding the engine near 1,250 rpm until the shaft catches up.
      S.c[k] = Math.max(0.35, locked / LAUNCH_RPM);
      S.engine = LAUNCH_RPM;
    } else {
      S.c[k] = Math.min(1, S.c[k] + dt * 3);
      if (calm) S.c[k] = 1;
      S.engine = Math.max(IDLE, locked);
    }
  }
  return speeds;
}

// ---- drawing
function grooveD(drum, id, side) {
  const y = D.DRUM.y[drum], z = D.DRUM.z, r = D.DRUM.r;
  // Sample the visible half exactly from limb to limb, so each groove ends on the drum's outline.
  const mid = Math.atan2(D.V[2], D.V[1]);
  const N = 48;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const psi = mid - Math.PI / 2 + 0.03 + ((Math.PI - 0.06) * i) / N;
    const deg = S.drum[drum] + (-90 - (psi * 180) / Math.PI);
    const x = D.SLV[id] + D.TRAVEL * sleeveAt(id, deg) + side;
    pts.push(screen([x, y + r * Math.cos(psi), z + r * Math.sin(psi)]));
  }
  const runs = [pts];
  return runs.map((pts) => "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L")).join("");
}
const speedOf = (source, speeds) => {
  if (source === "engine") return S.engine;
  if (source === "core") return subRpm.core;
  if (source === "hollow") return subRpm.hollow;
  if (source === "A" || source === "B") return speeds.out[source];
  if (source === "diff") return speeds.wheel;
  if (source === "idler") return subRpm.hollow * (D.idlerTeeth[0] / D.idlerTeeth[1]);
  if (source[0] === "d") {
    const g = source.slice(1);
    return inputOf(g) / RATIO[g];
  }
  return 0;
};
const DEG = Math.PI / 180;
function draw(dt, speeds) {
  for (const sp of spins) {
    let angle;
    if (sp.source.startsWith("drum")) angle = S.drum[sp.source.slice(4)] * DEG;
    else if (sp.source.startsWith("motor")) angle = -S.drum[sp.source.slice(5)] * DEG * (14 / 3.8);
    else {
      sp.angle += sp.sign * (speedOf(sp.source, speeds) / 60) * Math.PI * 2 / SLOW * dt;
      angle = sp.angle;
    }
    const pitch = (Math.PI * 2) / sp.teeth;
    const ph = Math.floor((((angle / pitch) % 1) + 1) % 1 * D.NPH) % D.NPH;
    if (ph !== sp.shown) {
      sp.groups[sp.shown]?.style.setProperty("display", "none");
      sp.groups[ph]?.style.removeProperty("display");
      sp.shown = ph;
    }
  }
  for (const drum of ["odd", "even"]) {
    sleevesOf[drum].forEach((id, i) => {
      grooves[drum][i * 2]?.setAttribute("d", grooveD(drum, id, -1.1));
      grooves[drum][i * 2 + 1]?.setAttribute("d", grooveD(drum, id, 1.1));
      const t = shift(D.TRAVEL * sleeveAt(id, S.drum[drum]));
      for (const el of movers[id] ?? []) el.setAttribute("transform", t);
    });
  }
  for (const n of [1, 2]) {
    const c = S.c[n];
    const L = D.LEVER[n];
    const reach = L.pivotZ - L.tipZ;
    const t = aboutY([L.x, L.y, L.pivotZ], Math.asin((2 * c) / reach));
    for (const el of movers[`lever${n}`] ?? []) el.setAttribute("transform", t);
    for (const el of movers[`brg${n}`] ?? []) el.setAttribute("transform", shift(-2 * c));
    const pp = n === 1 ? -1.4 * (1 - c) : 1.4 * (1 - c);
    for (const el of movers[`pp${n}`] ?? []) el.setAttribute("transform", shift(pp));
  }
  // Power path.
  const showing = S.hand && S.hand.t > SHIFT_TIME / 2 ? S.hand.to : S.gear;
  const driving = S.c[CLUTCH[showing]] > 0.3 || (S.hand && S.hand.t > SHIFT_TIME / 2);
  const sleeve = Object.entries(SLEEVES).find(([, s]) => s.lo === showing || s.hi === showing)[0];
  const tags = driving ? [`c${CLUTCH[showing]}`, CLUTCH[showing] === 1 ? "core" : "hollow", `g${showing}`, `d${showing}`, `s${sleeve}`, ...(showing === "R" ? ["idler"] : [])] : [];
  const key = tags.join(" ");
  if (key !== S.litKey) {
    S.litKey = key;
    const set = new Set(tags);
    for (const { tag, solids } of powered) for (const el of solids) set.has(tag) ? el.setAttribute("data-lit", "") : el.removeAttribute("data-lit");
  }
  const name = S.hand ? `${NAMES[S.hand.from]}→${NAMES[S.hand.to]}` : NAMES[S.gear];
  const slipping = !S.hand && S.c[CLUTCH[S.gear]] > 0.02 && S.c[CLUTCH[S.gear]] < 0.98;
  const clutches = S.hand ? ` · K1 ${Math.round(S.c[1] * 100)}% K2 ${Math.round(S.c[2] * 100)}%` : slipping ? ` · K${CLUTCH[S.gear]} slipping` : S.c[1] + S.c[2] < 0.02 ? " · both open" : "";
  const text = `${name} · ${Math.abs(S.v).toFixed(0)} km/h · ${Math.round(S.engine / 10) * 10} rpm${clutches}`;
  if (readout.textContent !== text) readout.textContent = text;
  for (const b of gearButtons) b.toggleAttribute("data-on", b.dataset.gear === S.target && !S.stop);
}

// ---- tour and input
const TOUR = [
  { stop: true, hold: 2.0 },
  { target: "6", until: () => S.gear === "6" && Math.abs(targetSpeed() - S.v) < 1, hold: 2.5 },
  { target: "3", until: () => S.gear === "3" && Math.abs(targetSpeed() - S.v) < 1, hold: 2 },
  { stop: true, until: () => Math.abs(S.v) < 0.1, hold: 1.5 },
  { target: "R", until: () => S.gear === "R" && Math.abs(targetSpeed() - S.v) < 0.5, hold: 2 },
  { stop: true, until: () => Math.abs(S.v) < 0.1, hold: 1.5 },
];
let touring = !still.matches;
let tourStep = 0;
let tourHeld = 0;
function applyStep(st) {
  S.stop = !!st.stop;
  if (st.target) S.target = st.target;
  else if (S.stop && S.target === "R" && Math.abs(S.v) < 0.1) S.target = "1";
}
applyStep(TOUR[0]);
function tour(dt) {
  const st = TOUR[tourStep];
  if (!st.until || st.until()) tourHeld += dt;
  if (tourHeld >= st.hold) {
    tourStep = (tourStep + 1) % TOUR.length;
    tourHeld = 0;
    applyStep(TOUR[tourStep]);
  }
}
let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) tour(dt);
  const speeds = step(dt, calm);
  draw(dt, speeds);
  const busy = touring || S.hand || Math.abs(S.v) > 0.01 || Math.abs(targetSpeed() - S.v) > 0.01 || S.drum.odd !== S.drumGoal.odd || S.drum.even !== S.drumGoal.even;
  frame = visible && (busy || !calm) ? requestAnimationFrame(tick) : 0;
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

function choose(g) {
  touring = false;
  tourButton.removeAttribute("data-on");
  S.stop = false;
  S.target = g;
  say(`driving to ${NAMES[g]}`);
  stage.setAttribute("aria-valuetext", `Driving in ${NAMES[g]}`);
  run();
}
function toggleTour() {
  touring = !touring;
  tourButton.toggleAttribute("data-on", touring);
  if (touring) {
    tourStep = 0;
    tourHeld = 0;
    applyStep(TOUR[0]);
  }
  run();
}
tourButton.toggleAttribute("data-on", touring);
for (const b of gearButtons) b.addEventListener("click", () => choose(b.dataset.gear));
tourButton.addEventListener("click", toggleTour);
stage.addEventListener("keydown", (event) => {
  const key = event.key.toUpperCase();
  if (GEARS.includes(key)) {
    event.preventDefault();
    choose(key);
  } else if (key === " ") {
    event.preventDefault();
    toggleTour();
  } else if (event.key === "Escape") {
    touring = false;
    S.stop = true;
    run();
  }
});
shaftSpeeds();
draw(0, shaftSpeeds());
