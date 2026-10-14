// The agent line: layout, model and the geometry that changes per frame.
// One factory, shared by the build (Node) and the page (inlined), so the readout,
// the motion and the drawing all read the same numbers. `k` is the kit.

export function createCore(k) {
  const L = {
    WIDTH: 600,
    HEIGHT: 312,
    VIEW_AZIMUTH: 50,
    BASE: { x: -150, y: -48, w: 300, d: 118, r: 9 },
    BASE_H: 9,
    FOOT_H: 5,
    RAIL_Y: 7,
    RAIL_W: 3.5,
    RAIL_X0: -140,
    RAIL_X1: 140,
    RAIL_H: 3,
    CART_W: 30,
    CART_D: 23,
    CART_Z: 3,
    CART_H: 3.2,
    CARD_W: 24,
    CARD_D: 17,
    CARD_H: 1.4,
    TAB_X: [-11, -6, -1, 4, 9],
    TAB_Y: -8,
    TAB_W: 2.6,
    TAB_D: 1.8,
    TAB_NORMAL: [4, 5, 4, 5, 4],
    TAB_TALL: 14,
    BAD_TAB: 2,
    ZONE: [6, 2.2],
    HOME_X: -123,
    TOOL_X: [-101, -82, -63, -44],
    GATE_X: -8,
    JAM_X: -13.6,
    PRESS_X: 56,
    OUT_X: 118,
    TRAY_Z: 2.5,
    TRAY_H: 4,
    DRAWER_STROKE: 7,
    BRIDGE_Z: 17.5,
    BRIDGE_H: 5.5,
    POST_FACE_Y: -16,
    LOCK_Z: 17.5,
    RAM_RISE: 9,
    PAPER_X: -126,
    PAPER_W: 252,
    PAPER_Y: 38,
    PAPER_D: 22,
    PAPER_Z: 0.8,
    PEN_Y: 38.6,
    SPEED: 5,
    RULING: 4,
  };
  L.CART_TOP = L.CART_Z + L.CART_H;
  L.CARD_TOP = L.CART_TOP + L.CARD_H;
  L.TRAY_TOP = L.TRAY_Z + L.TRAY_H;
  L.RAM_X = L.PRESS_X + L.ZONE[0];
  L.RAM_Y = L.ZONE[1];
  L.PEN_X = [-72, L.GATE_X, L.RAM_X, L.OUT_X];
  L.HISTORY = L.PAPER_D / L.SPEED;

  // ─── Camera ────────────────────────────────────────────────────────────────
  const P = k.fitProjection(
    [...k.boxCorners(L.BASE, -L.BASE_H - L.FOOT_H, 0), [56, -27, 40], [70, 11, 40]],
    L.WIDTH,
    L.HEIGHT,
    { pad: 26, azimuth: L.VIEW_AZIMUTH },
  );
  const at = (point) => k.iso(point, P);
  const shift = (x = 0, y = 0, z = 0) => k.translateAlong(P, [x, y, z]);

  // ─── Model: a job is a pure function of time ───────────────────────────────
  // Four-bit agent identities: the same pattern is on the plate, the key and the stamp.
  const AGENTS = [3, 5, 6, 9];
  const TOOLS = L.TOOL_X.length;

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const smooth = (value) => {
    const u = clamp01(value);
    return u * u * (3 - 2 * u);
  };

  function track(keys) {
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let index = 0; index < keys.length - 1; index++) {
        const [t0, v0] = keys[index];
        const [t1, v1] = keys[index + 1];
        if (t < t1) return t1 > t0 ? v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0)) : v1;
      }
      return keys[keys.length - 1][1];
    };
  }

  const drive = (from, to) => 0.45 + Math.abs(to - from) / 75;

  // The time a smoothstep move from `a` to `b` (starting at t0, lasting d) passes `where`.
  function crossing(t0, d, a, b, where) {
    const want = clamp01((where - a) / (b - a));
    let low = 0;
    let high = 1;
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2;
      if (smooth(mid) < want) low = mid;
      else high = mid;
    }
    return t0 + d * ((low + high) / 2);
  }

  function scriptOf(job) {
    const x = [[0, L.HOME_X]];
    const drawer = [[0, 0]];
    const tall = [[0, 0]];
    const key = [[0, 0]];
    const ram = [[0, 1]];
    const stamp = [[0, 0]];
    const lamp = [];
    const phases = [[0, "planning"]];
    const events = [{ at: 0.15, pen: 0, size: 3 }];
    let t = 0.3;

    const move = (from, to, scale = 1) => {
      const d = drive(from, to) * scale;
      x.push([t, from], [t + d, to]);
      const started = t;
      t += d;
      return { started, d };
    };

    // 1. The planner picks a tool: the cart stops at its drawer and the drawer opens.
    const stop = L.TOOL_X[job.tool];
    move(L.HOME_X, stop);
    phases.push([t, "tool"]);
    drawer.push([t, 0], [t + 0.45, 1], [t + 0.8, 1], [t + 1.25, 0]);
    events.push({ at: t + 0.45, pen: 0, size: 6 });
    if (job.bad) tall.push([t + 0.7, 0], [t + 1.2, 1]);
    t += 1.45;

    // 2. The gate. A card with a field that doesn't fit stops at the bridge, goes back, is repaired.
    let from = stop;
    phases.push([t, "checking"]);
    if (job.bad) {
      move(stop, L.JAM_X);
      events.push({ at: t, pen: 1, size: 9, hold: 0.9 });
      lamp.push([t, t + 1.05]);
      phases.push([t, "rejected"]);
      t += 1.15;
      move(L.JAM_X, L.HOME_X, 0.85);
      phases.push([t, "repair"]);
      tall.push([t, 1], [t + 0.5, 0]);
      t += 0.75;
      from = L.HOME_X;
    }
    const run = move(from, L.PRESS_X);
    const cross = crossing(run.started, run.d, from, L.PRESS_X, L.GATE_X);
    events.push({ at: cross, pen: 1, size: 5 });
    phases.push([cross, "passed"]);

    // 3. The press: the key turns, the ram comes down, the seal is stamped, the ram goes back.
    phases.push([t, "sealing"]);
    key.push([t, 0], [t + 0.45, 1], [t + 1.5, 1], [t + 1.9, 0]);
    ram.push([t + 0.5, 1], [t + 0.8, 0], [t + 0.95, 0], [t + 1.4, 1]);
    stamp.push([t + 0.78, 0], [t + 0.92, 1]);
    events.push({ at: t + 0.8, pen: 2, size: 7 });
    t += 2;

    // 4. Out of the line, then the cart goes home and takes a fresh card.
    move(L.PRESS_X, L.OUT_X);
    phases.push([t, "delivered"]);
    events.push({ at: t, pen: 3, size: 4 });
    t += 0.6;
    move(L.OUT_X, L.HOME_X, 0.8);
    stamp.push([t, 1], [t + 0.3, 0]);
    t += 0.4;

    const xs = track(x);
    const ds = track(drawer);
    const ts = track(tall);
    const ks = track(key);
    const rs = track(ram);
    const ss = track(stamp);

    return {
      duration: t,
      events,
      at(time) {
        let phase = "planning";
        for (const [begin, name] of phases) if (time >= begin) phase = name;
        return {
          x: xs(time),
          drawer: ds(time),
          tall: ts(time),
          lamp: lamp.some(([a, b]) => time >= a && time < b),
          key: ks(time),
          ram: rs(time),
          stamp: ss(time),
          phase,
        };
      },
    };
  }

  const REST = { x: L.HOME_X, drawer: 0, tall: 0, lamp: false, key: 0, ram: 1, stamp: 0, phase: "planning" };

  // A pen's deflection (world units, along the paper) from the events logged for it.
  const RISE = 0.12;
  const FALL = 0.45;

  function deflection(log, pen, time) {
    let sum = 0;
    for (const event of log) {
      if (event.pen !== pen) continue;
      const age = time - event.at;
      if (age < 0) continue;
      const hold = event.hold || 0;
      if (age < RISE) sum += event.size * smooth(age / RISE);
      else if (age < RISE + hold) sum += event.size;
      else {
        const value = event.size * Math.exp(-(age - RISE - hold) / FALL);
        if (value > 0.01) sum += value;
      }
    }
    return sum;
  }

  const pad = (value, width) => String(value).padStart(width, "0");
  const tagOf = (job) => `#${pad(job.id, 4)} · agent ${pad(job.agent, 2)}`;

  function readoutOf(job, phase, script, next, running = true) {
    const queued = `tool ${next.tool + 1} next${next.bad ? " · bad card" : ""}`;
    if (!job) return `idle · ${queued}`;
    if (!running) return `${script ? script.events.length : 0} events traced · ${queued}`;
    const tag = tagOf(job);
    switch (phase) {
      case "planning":
        return `${tag} · planning`;
      case "tool":
        return `${tag} · tool ${job.tool + 1} called`;
      case "checking":
        return `${tag} · checking schema`;
      case "rejected":
        return `${tag} · schema failed`;
      case "repair":
        return `${tag} · repairing output`;
      case "passed":
        return `${tag} · schema ok`;
      case "sealing":
        return `${tag} · sealing`;
      default:
        return `${tag} · ${script ? script.events.length : 0} events traced`;
    }
  }

  function spokenOf(job, phase, script, next) {
    if (!job) return `Idle. Tool ${next.tool + 1} is next${next.bad ? ", with a malformed card" : ""}.`;
    const who = `Job ${job.id}, agent ${job.agent}`;
    switch (phase) {
      case "planning":
        return `${who}: planning.`;
      case "tool":
        return `${who}: calling tool ${job.tool + 1}.`;
      case "checking":
        return `${who}: checking the output against the schema.`;
      case "rejected":
        return `${who}: the output does not fit the schema and is sent back.`;
      case "repair":
        return `${who}: output repaired, trying again.`;
      case "passed":
        return `${who}: output fits the schema.`;
      case "sealing":
        return `${who}: sealing with the agent's key.`;
      default:
        return `${who}: delivered. ${script ? script.events.length : 0} events traced.`;
    }
  }

  // ─── Geometry that changes per frame ───────────────────────────────────────
  const tabPlan = (index) => ({ x: L.TAB_X[index], y: L.TAB_Y, w: L.TAB_W, d: L.TAB_D, r: 0.5 });

  // The one field that can come out malformed, rebuilt at its current height.
  function tabOf(tallness) {
    const base = L.TAB_NORMAL[L.BAD_TAB];
    return k.slabOf(tabPlan(L.BAD_TAB), L.CARD_TOP, base + (L.TAB_TALL - base) * tallness, P, 2, 0.3);
  }

  // The key, drawn flat on the lock plate and turned about the lock axis.
  const BIT_ANGLES = [45, 135, 225, 315].map((degrees) => (degrees * Math.PI) / 180);
  const KEY_Y = L.POST_FACE_Y + 0.7 + 0.5;
  const KEY_HEAD = 5.4;

  function keyPoint(turn, a, b) {
    const theta = (turn * Math.PI) / 2;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return at([L.RAM_X + a * c - b * s, KEY_Y, L.LOCK_Z + a * s + b * c]);
  }

  function keyOf(turn) {
    const neck = [keyPoint(turn, 1, -0.8), keyPoint(turn, 3.4, -0.8), keyPoint(turn, 3.4, 0.8), keyPoint(turn, 1, 0.8)];
    const head = [];
    for (let step = 0; step < 20; step++) {
      const angle = (step / 20) * Math.PI * 2;
      head.push(keyPoint(turn, KEY_HEAD + 2.6 * Math.cos(angle), 2.6 * Math.sin(angle)));
    }
    const dots = BIT_ANGLES.map((angle) => {
      const around = angle - Math.PI / 4;
      return keyPoint(turn, KEY_HEAD + 1.3 * Math.cos(around), 1.3 * Math.sin(around));
    });
    return { neck: k.pathOf(neck, true), head: k.pathOf(head, true), dots };
  }

  // What the pens have drawn so far: one trace per pen, running off the front of the
  // paper, plus the ruling that scrolls with it.
  const SAMPLES = 46;

  function chartOf(log, now) {
    const traces = [];
    const push = [];
    L.PEN_X.forEach((x, pen) => {
      const points = [];
      for (let sample = 0; sample < SAMPLES; sample++) {
        const age = (sample / (SAMPLES - 1)) * (L.HISTORY + 0.4);
        points.push(at([x + deflection(log, pen, now - age), L.PEN_Y + age * L.SPEED, L.PAPER_Z]));
      }
      traces.push(k.pathOf(points));
      push.push(deflection(log, pen, now));
    });
    const lines = [];
    const offset = (now * L.SPEED) % L.RULING;
    for (let row = 0; L.PAPER_Y + offset + row * L.RULING < L.PAPER_Y + L.PAPER_D + 0.01; row++) {
      const y = L.PAPER_Y + offset + row * L.RULING;
      if (y < L.PAPER_Y + 0.4) continue;
      lines.push(k.onTop([[L.PAPER_X, y], [L.PAPER_X + L.PAPER_W, y]], L.PAPER_Z, P));
    }
    return { traces, ruling: lines.join(""), push };
  }

  return { L, P, at, shift, AGENTS, TOOLS, REST, BIT_ANGLES, scriptOf, deflection, readoutOf, spokenOf, tagOf, tabOf, keyOf, chartOf };
}
