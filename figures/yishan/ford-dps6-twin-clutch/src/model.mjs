// Ford PowerShift DPS6 (Getrag 6DCT250): the numbers every part of the figure is driven by.
// Ratios: 2012–14 Focus (Ford/ATRA DPS6 power-flow pages). Final drives: MY2014 Focus,
// 3.85 on the 1-2-5-6 output shaft and 4.28 on the 3-4-R output shaft.

export const RATIO = { R: 3.507, 1: 3.917, 2: 2.429, 3: 1.436, 4: 1.021, 5: 0.867, 6: 0.702 };
export const FD = { A: 3.85, B: 4.28 };
export const SHAFT = { R: "B", 1: "A", 2: "A", 3: "B", 4: "B", 5: "A", 6: "A" };
// Clutch 1 drives the core shaft (1-3-5); clutch 2 drives the hollow shaft (2-4-6-R).
export const CLUTCH = { R: 2, 1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2 };
export const DRUM_OF = { R: "even", 1: "odd", 2: "even", 3: "odd", 4: "even", 5: "odd", 6: "even" };
export const GEARS = ["R", "1", "2", "3", "4", "5", "6"];

// 215/50 R17: 431.8 mm rim + 2 × 107.5 mm sidewall.
export const TYRE_R = 0.3234;
export const IDLE = 800;
export const LAUNCH_RPM = 1250;
export const UP_RPM = 2800;
export const DOWN_RPM = 1300;

// Shift drums: each turns 61.44 times slower than its brushless motor. Detent angles on the
// even drum follow the Ford manual (R 10°, 2nd 100°, 4th 190°), and the odd drum mirrors it.
export const MOTOR_TO_DRUM = 61.44;
export const DETENT = {
  odd: { N: 10, 1: 100, 3: 190, 5: 280 },
  even: { R: 10, 2: 100, 4: 190, 6: 280 },
};
// Each synchro sleeve sits between two gears on one output shaft, so neighbouring gears are
// always on different sleeves and the next gear can be engaged while this one still drives.
// lo/hi: which gear the sleeve meets when it slides toward −x / +x.
export const SLEEVES = {
  B1: { shaft: "B", drum: "even", lo: "R", hi: "4" },
  A1: { shaft: "A", drum: "even", lo: "6", hi: "2" },
  B2: { shaft: "B", drum: "odd", lo: null, hi: "3" },
  A2: { shaft: "A", drum: "odd", lo: "5", hi: "1" },
};

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const wrap = (deg) => ((deg % 360) + 360) % 360;
const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Groove profile: where the drum's groove puts a sleeve, −1…1, for a drum angle.
// A detent holds the sleeve home for ±14°, the ramp runs out by ±38°, and in between it is neutral.
export function sleeveAt(id, drumDeg) {
  const sleeve = SLEEVES[id];
  let offset = 0;
  for (const [gear, deg] of Object.entries(DETENT[sleeve.drum])) {
    const side = gear === sleeve.lo ? -1 : gear === sleeve.hi ? 1 : 0;
    if (!side) continue;
    offset += side * (1 - smooth((near(drumDeg, deg) - 14) / 24));
  }
  return offset;
}
export const engagedOn = (drum, drumDeg) => {
  for (const [id, sleeve] of Object.entries(SLEEVES)) {
    if (sleeve.drum !== drum) continue;
    const at = sleeveAt(id, drumDeg);
    if (at > 0.97) return sleeve.hi;
    if (at < -0.97) return sleeve.lo;
  }
  return null;
};

export const wheelRpm = (kmh) => ((kmh / 3.6) / (2 * Math.PI * TYRE_R)) * 60;
export const outputRpm = (shaft, kmh) => wheelRpm(kmh) * FD[shaft];
// Input-shaft speed that a gear forces when it is locked to its output shaft.
export const inputRpmIn = (gear, kmh) => outputRpm(SHAFT[gear], kmh) * RATIO[gear] * (gear === "R" ? -1 : 1);
export const kmhAt = (gear, rpm) => (rpm / 60 / (RATIO[gear] * FD[SHAFT[gear]])) * 2 * Math.PI * TYRE_R * 3.6;
export const overall = (gear) => RATIO[gear] * FD[SHAFT[gear]];
export { smooth, wrap, near };
