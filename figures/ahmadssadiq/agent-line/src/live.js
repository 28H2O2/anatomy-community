// The live page: one loop over one simulation. Everything shown is read from the model.
const { L, shift, AGENTS, TOOLS, REST, BIT_ANGLES, scriptOf, readoutOf, spokenOf, tabOf, keyOf, chartOf } = core;

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const live = stage.querySelector(".al-live");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const part = (name) => svg.querySelector(`[data-part="${name}"]`);
const parts = (name) => [...svg.querySelectorAll(`[data-part="${name}"]`)];
const trays = parts("tray").sort((a, b) => Number(a.dataset.tool) - Number(b.dataset.tool));
const pens = parts("pen");
const traces = parts("trace");
const ruling = part("ruling");
const cart = part("cart");
const cardSolid = part("card").querySelector(".iso-solid");
const bridgeSolid = part("bridge").querySelector(".iso-solid");
const ram = part("ram");
const stamp = part("stamp");
const neck = part("neck");
const head = part("head");
const keyDots = parts("key-dot");
const stampDots = parts("stamp-dot");
const plateDots = parts("plate-dot");
const tab = part("tab");
const tabFill = tab.querySelector(".iso-fill");
const tabShades = [...tab.querySelectorAll(".iso-shade")];
const tabTop = tab.querySelector(".iso-top");
const tabCrease = tab.querySelector(".iso-crease");
const tabBevel = tab.querySelector(".iso-bevel");
const tabEdge = tab.querySelector(".iso-edge");

const TOUR_FIRST = 1400;
const TOUR_BACK = 3600;
const TOUR_GAP = 0.9;
const LOG_KEEP = L.HISTORY + 1.5;
const NUDGE = 1.6;
const QUEUE_MOST = 3;
const TOUR_TOOLS = [1, 3, 0, 2];

const sim = { now: 0, running: false, job: null, script: null, start: 0, rest: -10, queue: [], log: [], made: 0, tool: 1, bad: false, nudge: [0, 0, 0, 0] };
const shown = { tall: -1, key: -1, agent: -1, phase: "", lit: null, text: "" };
let frame = 0;
let last = 0;
let visible = false;
let engaged = false;
let tourFrom = 0;

const bitOf = (agent, index) => (agent >> (3 - index)) & 1;
const round1 = (value) => Math.round(value * 10) / 10;
const put = (node, name, value) => {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
};
const follow = (current, target, dt, seconds, snap) => {
  if (snap) return target;
  const next = current + (target - current) * (1 - Math.exp(-dt / seconds));
  return Math.abs(target - next) < 1e-3 ? target : next;
};
const nextAgent = () => AGENTS[(sim.made + 1) % AGENTS.length];

function makeJob(tool, bad) {
  sim.made += 1;
  return { id: sim.made, agent: AGENTS[sim.made % AGENTS.length], tool, bad };
}

function begin(calm) {
  const job = sim.queue.shift();
  if (!job) return;
  const script = scriptOf(job);
  sim.job = job;
  sim.script = script;
  sim.start = sim.now;
  sim.running = true;
  for (const event of script.events) sim.log.push({ ...event, at: sim.start + event.at });
  if (calm) {
    sim.now = sim.start + script.duration;
    sim.running = false;
    sim.rest = sim.now;
  }
}

function draw(dt) {
  const job = sim.job;
  const pose = sim.script ? (sim.running ? sim.script.at(sim.now - sim.start) : sim.script.at(sim.script.duration)) : REST;
  const agent = job ? job.agent : nextAgent();

  put(cart, "transform", shift(pose.x));
  put(stamp, "opacity", `${Math.round(pose.stamp * 100) / 100}`);
  if (shown.lit !== pose.lamp) {
    shown.lit = pose.lamp;
    cardSolid.toggleAttribute("data-lit", !pose.lamp);
    bridgeSolid.toggleAttribute("data-lit", pose.lamp);
  }

  const tall = Math.round(pose.tall * 200) / 200;
  if (shown.tall !== tall) {
    shown.tall = tall;
    const paths = tabOf(tall);
    put(tabFill, "d", paths.fill);
    paths.shades.forEach((d, index) => put(tabShades[index], "d", d));
    put(tabTop, "d", paths.top);
    put(tabCrease, "d", paths.crease);
    put(tabBevel, "d", paths.bevel || "");
    put(tabEdge, "d", paths.outline);
  }

  sim.nudge = sim.nudge.map((value, index) => follow(value, !sim.running && index === sim.tool ? NUDGE : 0, dt, 0.15, dt === 0));
  for (let index = 0; index < TOOLS; index++) {
    const out = job && index === job.tool && sim.running ? pose.drawer * L.DRAWER_STROKE : 0;
    put(trays[index], "transform", shift(0, out + sim.nudge[index]));
  }

  put(ram, "transform", shift(0, 0, pose.ram * L.RAM_RISE));
  const turn = Math.round(pose.key * 200) / 200;
  if (shown.key !== turn) {
    shown.key = turn;
    const key = keyOf(turn);
    put(neck, "d", key.neck);
    put(head, "d", key.head);
    key.dots.forEach(([x, y], index) => {
      put(keyDots[index], "cx", `${round1(x)}`);
      put(keyDots[index], "cy", `${round1(y)}`);
    });
  }
  if (shown.agent !== agent) {
    shown.agent = agent;
    for (let index = 0; index < 4; index++) {
      const level = bitOf(agent, index) ? "" : "0.1";
      for (const dots of [keyDots, stampDots, plateDots]) dots[index].style.opacity = level;
    }
  }

  const chart = chartOf(sim.log, sim.now);
  chart.traces.forEach((d, index) => put(traces[index], "d", d));
  put(ruling, "d", chart.ruling);
  chart.push.forEach((value, index) => put(pens[index], "transform", shift(value)));

  const next = { tool: sim.tool, bad: sim.bad };
  const text = readoutOf(job, pose.phase, sim.script, next, sim.running);
  if (shown.text !== text) {
    shown.text = text;
    readout.textContent = text;
  }
  const key = `${job ? job.id : 0}:${pose.phase}:${sim.running}`;
  if (shown.phase !== key) {
    shown.phase = key;
    live.textContent = spokenOf(job, pose.phase, sim.script, next);
  }
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  const tourOn = !calm && !engaged;
  if (tourOn && performance.now() >= tourFrom && !sim.running && sim.queue.length === 0 && sim.now - sim.rest > TOUR_GAP) {
    const index = sim.made;
    sim.queue.push(makeJob(TOUR_TOOLS[index % TOUR_TOOLS.length], index % 3 === 1));
  }
  if (!sim.running && sim.queue.length) begin(calm);
  if (!calm) sim.now += dt;
  if (sim.running && sim.now - sim.start >= sim.script.duration) {
    sim.running = false;
    sim.rest = sim.now;
  }
  sim.log = sim.log.filter((event) => sim.now - event.at < LOG_KEEP);
  draw(calm ? 0 : dt);
  const recent = sim.log.some((event) => sim.now - event.at < L.HISTORY + 0.5);
  const easing = sim.nudge.some((value, index) => value !== (!sim.running && index === sim.tool ? NUDGE : 0));
  frame = visible && (sim.running || sim.queue.length > 0 || recent || tourOn || easing) ? requestAnimationFrame(tick) : 0;
}

const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const later = () => {
  tourFrom = performance.now() + TOUR_BACK;
  setTimeout(run, TOUR_BACK + 40);
};
const wake = () => {
  later();
  run();
};
const enqueue = (tool) => {
  sim.tool = tool;
  if (sim.queue.length < QUEUE_MOST) {
    sim.queue.push(makeJob(tool, sim.bad));
    sim.bad = false;
  }
  wake();
};
const choose = (tool) => {
  sim.tool = (tool + TOOLS) % TOOLS;
  wake();
  draw(0);
};

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) {
      tourFrom = performance.now() + TOUR_FIRST;
      setTimeout(run, TOUR_FIRST + 40);
      run();
    }
  },
  { rootMargin: "120px 0px" },
).observe(stage);

stage.addEventListener("pointerenter", (event) => {
  if (event.pointerType === "mouse") engaged = true;
});
stage.addEventListener("pointerleave", (event) => {
  if (event.pointerType !== "mouse") return;
  engaged = false;
  later();
});
stage.addEventListener("pointerdown", (event) => {
  const target = event.target.closest && event.target.closest("[data-tool]");
  enqueue(target ? Number(target.dataset.tool) : sim.tool);
});
stage.addEventListener("focus", () => {
  engaged = true;
});
stage.addEventListener("blur", () => {
  engaged = false;
  later();
});
stage.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (!event.repeat) enqueue(sim.tool);
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    choose(sim.tool + 1);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    choose(sim.tool - 1);
  } else if (event.key === "b" || event.key === "B") {
    event.preventDefault();
    sim.bad = !sim.bad;
    wake();
    draw(0);
  } else if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    choose(Number(event.key) - 1);
  }
});

draw(0);
