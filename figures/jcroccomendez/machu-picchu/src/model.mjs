// The fitting model: one granite block is lowered onto its seat, read, lifted, and the seat (cut into the
// top of the stone below, as Protzen found) is pounded down until the bed joint closes.
// World units are 3 cm. Joint gaps are drawn EXAG times wider than true so they can be seen.

export const UNIT_MM = 30;
export const EXAG = 12;
export const PASSES = 6;
export const GAP0_MM = 9; // the first trial: the seat is 9 mm high in the middle, the block 9 mm clear at its ends
export const KEEP = 0.5; // each round of pounding halves the high spots
export const TOUCH_MM = 0.25; // what still counts as contact (the dust line a lowered stone leaves)
export const BLADE_MM = 0.5; // a thin bronze blade: once the gap is below this, nothing enters
export const LIFT = 6; // units the lever raises the block (18 cm)

// Block 32 × 24 × 16 units = 0.96 × 0.72 × 0.48 m of granite at 2,650 kg/m³.
export const BLOCK_M3 = 0.96 * 0.72 * 0.48;
export const BLOCK_KG = Math.round(BLOCK_M3 * 2650);
export const ARMS = [13.5, 54]; // short and long arm of the pole, units
export const RATIO = ARMS[1] / ARMS[0];
// Raising one end of the block carries about half its weight.
export const PUSH_N = Math.round((BLOCK_KG * 9.81) / 2 / RATIO);

export const gapOf = (pass) => GAP0_MM * KEEP ** pass;
// The seat is a shallow hump under a flat block: gap(x) = g·t². It touches where g·t² < TOUCH_MM.
export const contactOf = (gap) => Math.min(1, Math.sqrt(TOUCH_MM / gap));
export const visOf = (gapMm) => (gapMm * EXAG) / UNIT_MM;

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// How high the block's bed stands above the course top, in units. Seated, it rests on the seat's hump
// (gap g); lifted, it is LIFT above where it last sat (rest), so pounding the seat does not move it.
export const raiseOf = (gap, rest, lift) => visOf(gap) + (lift / LIFT) * (LIFT + visOf(rest) - visOf(gap));

// u runs 0 → PASSES. Within a pass: lower, sit and read, lift, pound the high spots on the seat.
export const PHASES = { lower: [0, 0.25], sit: [0.25, 0.45], lift: [0.45, 0.65], dress: [0.65, 1] };
export const STRIKES = 3; // hammer blows per round of dressing in the tour

export function stateAt(u) {
  const t = Math.max(0, Math.min(PASSES, u));
  const pass = Math.min(PASSES - 1, Math.floor(t));
  const f = t - pass;
  const last = pass === PASSES - 1;
  let lift = 0;
  let phase = "sit";
  let gap = gapOf(pass);
  let rest = gapOf(pass);
  let marks = 0;
  let strike = -1;
  if (f < PHASES.lower[1]) {
    phase = "lower";
    lift = LIFT * (1 - ease(f / PHASES.lower[1]));
    rest = gapOf(Math.max(0, pass - 1));
  } else if (f < PHASES.sit[1] || last) {
    phase = "sit";
  } else if (f < PHASES.lift[1]) {
    phase = "lift";
    lift = LIFT * ease((f - PHASES.lift[0]) / (PHASES.lift[1] - PHASES.lift[0]));
    marks = 1;
  } else {
    phase = "dress";
    lift = LIFT;
    const d = (f - PHASES.dress[0]) / (PHASES.dress[1] - PHASES.dress[0]);
    strike = d * STRIKES;
    const done = ease(Math.min(1, d * 1.15));
    marks = 1 - done;
    gap = gapOf(pass) * (1 - done) + gapOf(pass + 1) * done;
  }
  return { pass, phase, lift, gap, rest, contact: contactOf(gapOf(pass)), marks, strike, blade: gapOf(pass) > BLADE_MM };
}

// ---- The terrace in the rain -------------------------------------------------------------
// A 1.68 m terrace wall holds back its fill. Rain soaks in; how fast it leaves depends on the fill.
// Inca fill (rubble and gravel under sand) drains in minutes; a clay fill hardly drains at all,
// so the water table climbs and the water pushes on the wall as well as the soil.

export const WALL_M = (56 * UNIT_MM) / 1000;
export const RAINS = [
  { name: "dry", mmh: 0 },
  { name: "rain", mmh: 10 },
  { name: "storm", mmh: 50 },
];
export const FILLS = {
  drained: { n: 0.35, c: 6 }, // c: outflow per hour per metre of water table (rubble and gravel)
  clay: { n: 0.45, c: 0.002 }, // clay: almost nothing leaves
};
export const SIM_HOURS_PER_S = 2;
const KA = 1 / 3; // active earth pressure coefficient, friction angle 30°
const GAMMA = 18; // kN/m³, moist fill
const GAMMA_SAT = 20; // kN/m³, saturated fill
const GAMMA_W = 9.81; // kN/m³, water

// Horizontal thrust on one metre of wall, in kN, with the water table hw metres above its base.
export function thrustOf(hw) {
  const H = WALL_M;
  const w = Math.max(0, Math.min(H, hw));
  const dry = H - w;
  const sub = GAMMA_SAT - GAMMA_W;
  return KA * (GAMMA * dry * dry / 2 + GAMMA * dry * w + sub * w * w / 2) + GAMMA_W * w * w / 2;
}
export const THRUST_DRY = thrustOf(0);
export const THRUST_SAT = thrustOf(WALL_M);

// One step of the water budget. rain in m/h, dt in hours. Returns the new state.
export function stepWater({ hw, pond }, rain, fill, dt) {
  const { n, c } = FILLS[fill];
  const out = c * hw;
  let next = hw + ((rain - out) / n) * dt;
  let p = pond;
  if (next >= WALL_M) {
    p += (next - WALL_M) * n;
    next = WALL_M;
  }
  if (next < 0) next = 0;
  if (rain === 0 || next < WALL_M) p = Math.max(0, p - 0.01 * dt - Math.max(0, out - rain) * dt);
  return { hw: next, pond: Math.min(0.05, p), out: c * next };
}

// ---- Earthquakes -------------------------------------------------------------------------
// The bench plate is a shake table. Ground motion is a damped sine at 2.5 Hz whose peak
// acceleration is the quake's PGA, so the displacement amplitude is A = a / ω². Motion is drawn
// EXAG times larger. In a dry-laid wall each block slips a little against its neighbours
// (a fraction SLIP of the ground motion, more in higher courses) and settles back; a mortared
// wall cannot slip, so above CRACK g its joints crack instead. Slip and cracking are a model.

export const QUAKES = [
  { name: "moderate", pga: 0.15 },
  { name: "strong", pga: 0.35 },
];
export const QUAKE = { hz: 2.5, rise: 0.6, decay: 1.8, length: 7, exag: 8, slip: 0.3, crack: 0.25 };

export function quakeAt(t, pga) {
  if (t < 0 || t > QUAKE.length) return { env: 0, disp: 0, acc: 0, amp: 0, w: 0 };
  // Rise, ring down, and fade to exactly zero over the last second so nothing is left displaced.
  const tail = Math.min(1, Math.max(0, QUAKE.length - t));
  const env = Math.min(1, t / QUAKE.rise) ** 2 * Math.exp(-Math.max(0, t - QUAKE.rise) / QUAKE.decay) * tail * tail * (3 - 2 * tail);
  const w = 2 * Math.PI * QUAKE.hz;
  const amp = (pga * 9.81) / (w * w);
  return { env, disp: amp * env * Math.sin(w * t), acc: pga * env * Math.abs(Math.sin(w * t)), amp, w };
}

// ---- Hauling stone -----------------------------------------------------------------------
// With no carts or draught animals, stone was dragged by people on ropes. Keeping a stone sliding
// up a slope θ takes its weight times (sin θ + μ cos θ). Friction and the pull of one person are a model.

export const SPARE_M3 = 0.66 * 0.42 * 0.36; // the spare stone, 22 × 14 × 12 units
export const SPARE_KG = Math.round(SPARE_M3 * 2650);
export const MU_DRAG = 0.5; // stone dragged over earth
export const PULL_N = 300; // what one person keeps up on a rope
export const RAMP_DEG = 10; // the Ollantaytambo ramps run at 8 to 12 degrees
export const HAUL_MAX = 12; // units the spare stone can be dragged on the terrace (36 cm)
export const ROPE_L = 12; // units of rope from the stone to the hauler's hands

export const dragOf = (kg, deg = 0) => {
  const a = (deg * Math.PI) / 180;
  return kg * 9.81 * (Math.sin(a) + MU_DRAG * Math.cos(a));
};
export const crewOf = (newtons) => Math.ceil(newtons / PULL_N);

// ---- Fig 2: illustrative, rhythmic ramp haul ---------------------------------------------
// Force uses the same drag law as Fig 1. Cadence and speed are illustrative, not historical data.
export const RAMP_BLOCKS = [900, 10000, 50000];
export const RAMP_TRAVEL = 5 / Math.cos(RAMP_DEG * Math.PI / 180); // metres along 5 m of ramp in plan
export const RAMP_CYCLE = 2.4; // illustrative seconds per coordinated tug
export const RAMP_STEP = 0.32; // illustrative metres per successful tug
export const rampTeams = (kg) => kg === 900 ? [10, 15, 20, 30] : kg === 50000 ? [500, 750, 1100, 1500] : [100, 150, 220, 300];
export const rampPerFigure = (kg) => kg === 50000 ? 50 : 10;
export function rampLoad(kg, crew) {
  const required = dragOf(kg, RAMP_DEG);
  const available = crew * PULL_N;
  return { required, available, needed: crewOf(required), missing: Math.max(0, crewOf(required) - crew), enough: available >= required };
}
export function rampPose(seconds, enough) {
  const phase = (seconds % RAMP_CYCLE) / RAMP_CYCLE;
  const pull = ease((phase - 0.14) / 0.18) * (1 - ease((phase - 0.68) / 0.22));
  const step = enough ? Math.sin(ease((phase - 0.28) / 0.4) * Math.PI) : 0;
  return { phase, pull, step, stage: phase < 0.28 ? "tension" : phase < 0.68 ? (enough ? "pulling" : "stalled") : "rest" };
}
export function advanceRamp(state, dt) {
  const load = rampLoad(state.kg, state.crew);
  const next = { ...state };
  if (state.reset >= 0) {
    next.reset += dt;
    // Hide before rewinding the physical position; fade in at the foot afterwards.
    if (state.reset < 0.6 && next.reset >= 0.6) { next.distance = 0; next.seconds = 0; }
    if (next.reset >= 1.2) next.reset = -1;
    return next;
  }
  next.seconds += dt;
  if (load.enough) {
    const progress = (t) => Math.floor(t / RAMP_CYCLE) + ease(((t % RAMP_CYCLE) / RAMP_CYCLE - 0.28) / 0.4);
    const surplus = Math.min(1.35, load.available / load.required);
    next.distance = Math.min(RAMP_TRAVEL, state.distance + RAMP_STEP * surplus * (progress(next.seconds) - progress(state.seconds)));
    if (next.distance >= RAMP_TRAVEL) next.reset = 0;
  }
  return next;
}
export function rampOpacity(state) {
  return state.reset < 0 ? 1 : state.reset < 0.6 ? 1 - ease(state.reset / 0.6) : ease((state.reset - 0.6) / 0.6);
}
