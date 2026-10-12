// Shapes that change every frame, in each part's own plan coordinates. Shared by the build
// (rest pose) and the page (inlined), so both draw the same springs and rotor rim.

const TAU = Math.PI * 2;
const r2 = (v) => Math.round(v * 100) / 100;
export const polyD = (points, closed = false) =>
  points.length ? `M${points.map(([x, y]) => `${r2(x)} ${r2(y)}`).join("L")}${closed ? "Z" : ""}` : "";

// Mainspring seen through the barrel cover. `wind` is turns past let-down; the inner end follows the
// arbor and the outer end (with its slipping bridle) follows the drum, so `coils = 8 + wind` between them.
// Let down, six coils lie against the wall; fully wound, all but half a coil wrap the arbor.
export const SPRING = { arbor: 8.6, wall: 35.2, pitch: 1.12, down: 8, full: 6.5 };
export function mainspringPoints(wind, arborTurns) {
  const { arbor, wall, pitch, down, full } = SPRING;
  const coils = down + wind;
  const w = Math.max(0, Math.min(1, wind / full));
  const outer = 6 * (1 - w) + 0.5 * w;
  const inner = Math.max(0, coils - 1 - outer);
  const r1 = arbor + inner * pitch;
  const r2o = wall - outer * pitch;
  const start = arborTurns * TAU;
  const total = coils * TAU;
  const points = [];
  let phi = 0;
  while (phi <= total + 1e-9) {
    let radius;
    if (phi < inner * TAU) radius = arbor + (pitch * phi) / TAU;
    else if (phi < (inner + 1) * TAU) {
      const t = (phi - inner * TAU) / TAU;
      radius = r1 + (r2o - r1) * t * t * (3 - 2 * t);
    } else radius = r2o + (pitch * (phi - (inner + 1) * TAU)) / TAU;
    const angle = start - phi;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
    if (phi >= total) break;
    phi = Math.min(total, phi + 2.4 / Math.max(radius, 6));
  }
  return { points, end: start - total };
}
// The bridle: a short stiffer strip on the outer end, pressed against the drum wall.
export function bridlePoints(endAngle) {
  const { wall } = SPRING;
  const points = [];
  for (let i = 0; i <= 14; i++) {
    const a = endAngle + (i / 14) * 1.05;
    points.push([(wall - 0.35) * Math.cos(a), (wall - 0.35) * Math.sin(a)]);
  }
  return points;
}

// Hairspring: inner end on the collet turns with the balance, outer end held at the stud.
export const HAIR = { inner: 3.6, outer: 14.2, coils: 11, stud: 2.25 };
export function hairspringPoints(theta) {
  const { inner, outer, coils, stud } = HAIR;
  const points = [];
  const steps = 420;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const angle = stud - TAU * coils * (1 - u) + theta * (1 - u);
    const radius = inner + (outer - inner) * u + 0.42 * (theta / TAU) * Math.sin(Math.PI * u);
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

// Rotor's heavy rim: a half ring centred on the rotor's direction, as a floor ring (world x, y).
export const RIM = { inner: 80, outer: 95.5, z0: 30.6, z1: 34.8, span: Math.PI };
export function rimRing(cx, cy, angle) {
  const { inner, outer, span } = RIM;
  const out = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const a = angle - span / 2 + (span * i) / n;
    out.push([cx + outer * Math.cos(a), cy + outer * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = angle - span / 2 + (span * i) / n;
    out.push([cx + inner * Math.cos(a), cy + inner * Math.sin(a)]);
  }
  return { ring: out, innerFrom: n + 1 };
}
