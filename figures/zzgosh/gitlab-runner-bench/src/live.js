
const DATA = __DATA__;
const P = DATA.P;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const status = stage.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const q = (selector) => svg.querySelector(selector);

const sim = createSim({
  slot: (index) => [DATA.slotX[index], DATA.slotY],
  seat: (index) => [DATA.runnerX[index], DATA.homeY],
  up: DATA.up,
  atSlot: DATA.atSlot,
  atSeat: DATA.atSeat,
});

const holders = sim.jobs.map((_, index) => q(`[data-hold-puck="${index}"]`));
const slots = sim.jobs.map((_, index) => q(`[data-slot="${index}"]`));
const seats = sim.runners.map((_, index) => q(`[data-seat="${index}"]`));
const carriages = sim.runners.map((_, index) => q(`[data-carriage="${index}"]`));
const grips = sim.runners.map((_, index) => q(`[data-grip="${index}"]`));
const rams = sim.runners.map((_, index) => q(`[data-ram="${index}"]`));
const needles = sim.runners.map((_, index) => q(`[data-needle="${index}"]`));
const traces = sim.runners.map((_, index) => q(`.gr-trace[data-runner="${index}"]`));
const pulses = sim.runners.map((_, index) => q(`.gr-pulse[data-runner="${index}"]`));
const runnerLamps = sim.runners.map((_, index) => q(`.gr-lamp[data-runner="${index}"]`));
const levers = sim.runners.map((_, index) => q(`[data-lever="${index}"]`));
const switches = sim.runners.map((_, index) => q(`[data-switch="${index}"]`));
const jobLamps = sim.jobs.map((_, index) => q(`.gr-lamp[data-job="${index}"]`));
const quill = q("[data-quill]");
const carry = q("[data-carry]");
const bridge = q("[data-bridge]");
const head = q("[data-head]");
const cardBox = q("[data-cards]");
const pushButton = q("[data-push]");
const cap = q("[data-cap]");
const pushPulse = q("[data-push-pulse]");

const quillSvg = (z) =>
  solidSvg(cylinder(0, 0, 1.8, z + DATA.gripH, DATA.bridgeZ - z - DATA.gripH, P, 16), { tone: "mid", crease: "none" }) +
  solidSvg(cylinder(0, 0, 4.4, z, DATA.gripH, P, 28, 0.3), { tone: "mid", crease: "lo" }) +
  lineSvg(sideArc(0, 0, 4.4, z + 1.2, P, 20), { tone: "faint" });
const ramSvg = (rx, z, lit) =>
  solidSvg(cylinder(rx, DATA.workY, 2.2, z + 2.4, DATA.pressZ - z - 2.4, P, 18), { tone: "hi", crease: "none", lit }) +
  solidSvg(cylinder(rx, DATA.workY, 5.2, z, 2.4, P, 28, 0.4), { tone: "hi", crease: "lo", lit });
const needleAt = (rx, share) => {
  const angle = share * Math.PI * 2;
  const [x, y] = [rx + 15, DATA.workY];
  return lineOnTop([x - Math.sin(angle) * 1.6, y + Math.cos(angle) * 1.6], [x + Math.sin(angle) * 4.3, y - Math.cos(angle) * 4.3], DATA.gaugeTop + 0.1, P);
};

// Points along each cable, by length, so a pulse runs at an even pace.
const cables = DATA.cables.map((points) => {
  const flat = points.map((point) => iso(point, P));
  const lengths = [0];
  for (let i = 1; i < flat.length; i++) lengths.push(lengths[i - 1] + Math.hypot(flat[i][0] - flat[i - 1][0], flat[i][1] - flat[i - 1][1]));
  return { flat, lengths, total: lengths[lengths.length - 1] };
});
const alongCable = (cable, share) => {
  const want = share * cable.total;
  let i = 1;
  while (i < cable.lengths.length - 1 && cable.lengths[i] < want) i++;
  const span = cable.lengths[i] - cable.lengths[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (want - cable.lengths[i - 1]) / span));
  const [a, b] = [cable.flat[i - 1], cable.flat[i]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};

const pushCable = (() => {
  const flat = DATA.pushCable.map((point) => iso(point, P));
  const lengths = [0];
  for (let i = 1; i < flat.length; i++) lengths.push(lengths[i - 1] + Math.hypot(flat[i][0] - flat[i - 1][0], flat[i][1] - flat[i - 1][1]));
  return { flat, lengths, total: lengths[lengths.length - 1] };
})();
// A push travels up the cable; GitLab creates the pipeline when it arrives.
const pushes = [];
const ease = (value, target, dt, seconds) => (dt === 0 ? target : value + (target - value) * (1 - Math.exp(-dt / seconds)));

// Commit cards: one per commit on the rack, newest in front. A new card rises out of its slot.
const cards = new Map();
cardBox.querySelectorAll("[data-card]").forEach((el) => {
  const number = Number(el.dataset.card);
  const slot = sim.commits.length - 1 - sim.commits.findIndex((commit) => commit.number === number);
  cards.set(number, { el, rise: el.querySelector("[data-rise]"), band: el.querySelector(".gr-band"), slot, drop: 0, alpha: 1, status: "" });
});
const cardAt = (slot) => translateAlong(P, [0, DATA.cardFront - slot * DATA.cardPitch, 0]);
function drawCards(dt) {
  const shown = sim.commits.slice(-KEEP);
  shown.forEach((commit, index) => {
    let card = cards.get(commit.number);
    if (!card) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
      el.setAttribute("data-card", String(commit.number));
      el.innerHTML = DATA.card.replace("__STATUS__", commit.status).replace("__SHA__", commit.sha).replace("__NUM__", `#${commit.number}`);
      cardBox.appendChild(el);
      card = { el, rise: el.querySelector("[data-rise]"), band: el.querySelector(".gr-band"), slot: 0, drop: dt === 0 ? 0 : -DATA.cardH, alpha: 1, status: "" };
      cards.set(commit.number, card);
    }
    card.target = shown.length - 1 - index;
  });
  for (const [number, card] of cards) {
    const commit = shown.find((entry) => entry.number === number);
    if (!commit) card.target = KEEP;
    card.slot = ease(card.slot, card.target, dt, 0.16);
    card.drop = ease(card.drop, 0, dt, 0.14);
    if (Math.abs(card.drop) < 0.02) card.drop = 0;
    // The oldest card slides off the back of the rack and fades.
    card.alpha = commit ? 1 : Math.max(0, 1 - Math.max(0, card.slot - (KEEP - 1)) * 1.4);
    if (!commit && (card.alpha <= 0.01 || dt === 0)) {
      card.el.remove();
      cards.delete(number);
      continue;
    }
    card.el.setAttribute("transform", cardAt(card.slot));
    card.rise.setAttribute("transform", card.drop ? translateAlong(P, [0, 0, card.drop]) : "");
    card.el.style.opacity = card.alpha < 1 ? card.alpha.toFixed(2) : "";
    if (commit && card.status !== commit.status) {
      card.band.setAttribute("data-status", commit.status);
      card.status = commit.status;
    }
  }
}

// Ram: eases down onto the job, taps once per script line, eases up when done.
const ram = sim.runners.map(() => ({ z: DATA.ramRest }));
const lever = sim.runners.map((runner) => ({ angle: runner.online ? 26 : -26 }));
const lastState = { jobs: [], runners: [], quillZ: null, ramZ: [], lit: [], lever: [] };
let pressedAt = -10;

function draw(dt) {
  const g = sim.gantry;
  bridge.setAttribute("transform", translateAlong(P, [g.x, 0, 0]));
  head.setAttribute("transform", translateAlong(P, [0, g.y, 0]));
  const move = translateAlong(P, [g.x, g.y, 0]);
  quill.setAttribute("transform", move);
  carry.setAttribute("transform", move);
  const quillZ = Math.round(g.z * 20) / 20;
  if (quillZ !== lastState.quillZ) {
    quill.innerHTML = quillSvg(quillZ);
    lastState.quillZ = quillZ;
  }

  sim.jobs.forEach((job, index) => {
    const holder = holders[index];
    if (job.where === "slot") {
      if (holder.parentNode !== slots[index]) slots[index].appendChild(holder);
      holder.setAttribute("transform", translateAlong(P, [DATA.slotX[index], DATA.slotY, DATA.trayTop]));
    } else if (job.where === "gantry") {
      if (holder.parentNode !== carry) carry.appendChild(holder);
      holder.setAttribute("transform", translateAlong(P, [0, 0, g.z - DATA.puckTop]));
    } else {
      const owner = sim.runners.find((runner) => runner.job === index);
      const seat = seats[owner ? owner.index : 0];
      if (holder.parentNode !== seat) seat.appendChild(holder);
      holder.setAttribute("transform", translateAlong(P, [DATA.runnerX[owner ? owner.index : 0], DATA.homeY, DATA.seatTop]));
    }
    const lit = sim.runners.some((runner) => runner.job === index && runner.state === "running");
    if (lastState.lit[index] !== lit) {
      holder.querySelectorAll(".iso-solid").forEach((solid) => (lit ? solid.setAttribute("data-lit", "") : solid.removeAttribute("data-lit")));
      lastState.lit[index] = lit;
    }
    const lamp = sim.lamp(job);
    if (lastState.jobs[index] !== lamp) {
      jobLamps[index].setAttribute("data-state", lamp);
      lastState.jobs[index] = lamp;
    }
  });

  sim.runners.forEach((runner, index) => {
    const rx = DATA.runnerX[index];
    const travel = translateAlong(P, [0, runner.drive * (DATA.workY - DATA.homeY), 0]);
    carriages[index].setAttribute("transform", travel);
    grips[index].setAttribute("transform", travel);
    const running = runner.state === "running";
    const job = runner.job >= 0 ? sim.jobs[runner.job] : null;
    const elapsed = running ? sim.t - runner.phaseAt : 0;
    let want = DATA.ramRest;
    if (running) {
      const left = job.dur - elapsed;
      want = left < 0.35 ? DATA.ramRest : DATA.atSeat + 1.4 * Math.max(0, Math.sin(elapsed * Math.PI * 1.6)) ** 6;
    }
    ram[index].z = ease(ram[index].z, want, dt, 0.09);
    const ramZ = Math.round(ram[index].z * 20) / 20;
    const key = `${ramZ}|${running}`;
    if (lastState.ramZ[index] !== key) {
      rams[index].innerHTML = ramSvg(rx, ramZ, running);
      lastState.ramZ[index] = key;
    }
    const share = running ? Math.min(1, elapsed / job.dur) : runner.state === "back" || runner.state === "done" ? 1 : 0;
    needles[index].setAttribute("d", needleAt(rx, share));
    traces[index].style.opacity = running ? "1" : "0";

    const pulse = pulses[index];
    if (runner.pulse && !still.matches) {
      const along = runner.pulse.dir === "up" ? runner.pulse.at : 1 - runner.pulse.at;
      const [x, y] = alongCable(cables[index], along);
      pulse.setAttribute("cx", x.toFixed(2));
      pulse.setAttribute("cy", y.toFixed(2));
      pulse.setAttribute("data-kind", runner.pulse.kind);
      pulse.setAttribute("r", runner.pulse.kind === "job" ? "2.2" : "1.7");
      pulse.style.opacity = String(Math.min(1, Math.min(runner.pulse.at, 1 - runner.pulse.at) * 12));
    } else pulse.style.opacity = "0";

    const lampState = !runner.online && runner.state === "idle" ? "paused" : runner.pulse ? "polling" : runner.state === "idle" ? "idle" : "busy";
    if (lastState.runners[index] !== lampState) {
      runnerLamps[index].setAttribute("data-state", lampState);
      lastState.runners[index] = lampState;
    }
    // A toggle snaps over its centre: a quick ease, picked from prebuilt lever angles.
    lever[index].angle = ease(lever[index].angle, runner.online ? 26 : -26, dt, 0.05);
    let frame = 0;
    DATA.leverAngles.forEach((angle, i) => {
      if (Math.abs(angle - lever[index].angle) < Math.abs(DATA.leverAngles[frame] - lever[index].angle)) frame = i;
    });
    if (lastState.lever[index] !== frame) {
      levers[index].innerHTML = DATA.levers[index][frame];
      lastState.lever[index] = frame;
    }
  });

  const leading = pushes[0];
  if (leading && !still.matches) {
    const [x, y] = alongCable(pushCable, leading.at);
    pushPulse.setAttribute("cx", x.toFixed(2));
    pushPulse.setAttribute("cy", y.toFixed(2));
    pushPulse.style.opacity = String(Math.min(1, Math.min(leading.at, 1 - leading.at) * 12));
  } else pushPulse.style.opacity = "0";
  drawCards(dt);
  const age = sim.t - pressedAt;
  const depth = dt === 0 || age < 0 ? 0 : age < 0.06 ? age / 0.06 : Math.max(0, 1 - (age - 0.06) / 0.22);
  cap.setAttribute("transform", depth > 0 ? translateAlong(P, [0, 0, -1.2 * depth]) : "");

  const text = sim.readout();
  if (readout.textContent !== text) readout.textContent = text;
  if (status.textContent !== sim.last) status.textContent = sim.last;
}

let frame = 0;
let last = 0;
let visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  for (const entry of pushes) entry.at += dt / TRIP;
  while (pushes.length && pushes[0].at >= 1) {
    pushes.shift();
    sim.push();
  }
  sim.step(dt);
  draw(dt);
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
// Reduced motion: one still pose. The machine jumps straight to where an action leads:
// the pipeline run to its end, or to where it gets stuck.
const settle = (limit) => {
  const stuck = () => sim.readout().includes("stuck");
  for (let t = 0; t < limit && sim.state !== "passed" && !stuck(); t += 1 / 30) sim.step(1 / 30);
  draw(0);
};
const run = () => {
  if (!frame && visible && !still.matches) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const push = () => {
  if (still.matches) {
    sim.push();
    settle(120);
    return;
  }
  pressedAt = sim.t;
  pushes.push({ at: 0 });
  status.textContent = "git push";
  run();
};
const flip = (index) => {
  sim.toggle(index);
  if (still.matches) settle(120);
  else run();
};
pushButton.addEventListener("click", push);
switches.forEach((el, index) => el.addEventListener("click", () => flip(index)));
stage.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    push();
  } else if (event.key === "1" || event.key === "2") {
    flip(Number(event.key) - 1);
  }
});
new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);
still.addEventListener("change", () => (still.matches ? draw(0) : run()));
window.__sim = sim;
// The still pose: the test stage under way, two jobs on the runners.
if (still.matches) settle(13);
draw(0);
