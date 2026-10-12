// The movement's arithmetic: one pure module used by the build and inlined into the page.
// Numbers are those of a typical 4 Hz automatic of the ETA 2824 class: 28,800 vph, 42 h
// typical power reserve, 50° lift angle, 1:140 between rotor and barrel arbor.

export const BPH = 28800;
export const HZ = BPH / 3600 / 2;
export const LIFT = 50;
export const TEETH = {
  barrel: 84, centrePinion: 13, centre: 80, thirdPinion: 10, third: 75, fourthPinion: 10, fourth: 96, escapePinion: 6, escape: 15,
  rotorPinion: 15, reverser: 30, reverserPinion: 8, red1: 40, red1Pinion: 8, red2: 42, red2Pinion: 15, ratchet: 40, crownWheel: 26, windingPinion: 8,
};
const T = TEETH;

// Hours of running per turn of the barrel drum, and escape-wheel turns per drum turn.
export const HOURS_PER_DRUM = T.barrel / T.centrePinion;
export const ESCAPE_PER_HOUR = (T.centre / T.thirdPinion) * (T.third / T.fourthPinion) * (T.fourth / T.escapePinion);
export const ESCAPE_PER_DRUM = ESCAPE_PER_HOUR * HOURS_PER_DRUM;
export const SPRING_TURNS = 6.5;
export const RESERVE = SPRING_TURNS * HOURS_PER_DRUM;
export const ROTOR_RATIO = (T.reverser / T.rotorPinion) * (T.red1 / T.reverserPinion) * (T.red2 / T.red1Pinion) * (T.ratchet / T.red2Pinion);
export const CROWN_RATIO = (T.windingPinion / T.crownWheel) * (T.crownWheel / T.ratchet);

// Coils of mainspring: 8 lie against the drum wall when let down, 6.5 more wrap on at full wind.
export const COILS_DOWN = 8;
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Torque of a slipping-bridle mainspring, as a share of full: flat-ish, falling away in the last few hours.
export const torqueOf = (wind) => {
  const w = Math.max(0, Math.min(1, wind / SPRING_TURNS));
  return (0.6 + 0.4 * w) * smooth(0, 0.06, w);
};
// Balance amplitude in degrees for that torque; the watch stops below A_STOP and restarts above A_START.
export const A_FULL = 315;
export const A_STOP = 120;
export const A_START = 150;
export const amplitudeOf = (wind) => A_FULL * Math.sqrt(torqueOf(wind));

// Isochronism: the rate drifts a little with amplitude (s/day), as a timing machine would show it.
export const rateOf = (amplitude) => (amplitude < 1 ? 0 : 4 - 0.00035 * (300 - amplitude) ** 2 + 0.03 * (amplitude - 300));

// Escape-wheel position (turns) from the balance phase: half a tooth per beat, moved only while the
// impulse pin is inside the fork (|θ| < LIFT / 2). Fork side flips in the same window.
export function escapementOf(phase, amplitude) {
  const n = Math.round(phase / Math.PI);
  const d = phase - n * Math.PI;
  const w = amplitude > LIFT / 2 ? Math.asin(LIFT / 2 / amplitude) : Math.PI / 2;
  const s = Math.max(0, Math.min(1, (d + w) / (2 * w)));
  const eased = s * s * (3 - 2 * s);
  return { beats: n - 1 + eased, side: (n % 2 === 0 ? 1 : -1) * (1 - 2 * eased) };
}

export function createState(hours = 9) {
  const wind = hours / HOURS_PER_DRUM;
  const amplitude = amplitudeOf(wind);
  return {
    ...createBare(hours), amplitude, running: amplitude >= A_STOP,
  };
}
function createBare(hours) {
  return {
    wind: hours / HOURS_PER_DRUM, arbor: 0, drum: 0, slip: 0, escape: 0, beats: 0,
    rotor: 0, spin: 0, crown: 0, phase: 0, amplitude: 0, running: false, slipping: 0, last: 0,
  };
}

// Wind the arbor by `turns` (always ≥ 0). Past full the bridle slips along the drum wall.
export function windBy(state, turns, byCrown) {
  if (!(turns > 0)) return;
  state.arbor += turns;
  if (byCrown) state.crown += turns / CROWN_RATIO;
  state.wind += turns;
  if (state.wind > SPRING_TURNS) {
    state.slip += state.wind - SPRING_TURNS;
    state.slipping = 1;
    state.wind = SPRING_TURNS;
  }
}

// One step of the going train: balance swings at 4 Hz with an amplitude that follows the torque.
export function runFor(state, dt) {
  const target = amplitudeOf(state.wind);
  if (!state.running && target >= A_START) state.running = true;
  const goal = state.running && target >= A_STOP ? target : 0;
  state.amplitude += (goal - state.amplitude) * (1 - Math.exp(-dt / (goal > state.amplitude ? 1.4 : 0.9)));
  if (state.running && state.amplitude < LIFT && goal === 0) {
    state.running = false;
  }
  if (!state.running && state.amplitude < 1) state.amplitude = 0;
  state.phase += 2 * Math.PI * HZ * dt;
  if (state.running) {
    const { beats } = escapementOf(state.phase, state.amplitude);
    const step = Math.max(0, beats - state.beats);
    state.beats = beats;
    const turns = step / (2 * T.escape);
    state.escape += turns;
    const drum = turns / ESCAPE_PER_DRUM;
    state.drum += drum;
    state.wind = Math.max(0, state.wind - drum);
  } else {
    state.beats = escapementOf(state.phase, Math.max(state.amplitude, 1)).beats;
  }
  state.slipping = Math.max(0, state.slipping - dt * 1.5);
}

// The rotor: a weight on a ball bearing. Either way it turns, the reversers wind the arbor 1/140 turn per turn.
export function rotorFor(state, dt, torque) {
  const load = state.wind >= SPRING_TURNS ? 0.25 : 0.55 + 0.9 * torqueOf(state.wind);
  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 480);
    const friction = Math.sign(state.spin) * Math.min(Math.abs(state.spin) / h, 2.2 + load);
    state.spin += (torque(state.rotor, state.spin) - 0.45 * state.spin - friction) * h;
    const before = state.rotor;
    state.rotor += state.spin * h;
    windBy(state, Math.abs(state.rotor - before) / (2 * Math.PI) / ROTOR_RATIO, false);
    left -= h;
  }
}

export const reserveOf = (state) => state.wind * HOURS_PER_DRUM;
export const hm = (hours) => {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};
