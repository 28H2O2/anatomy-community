// The steering column's behaviour, read from the derived spec (spec.json): the one
// source for the figure's geometry, motion, readout and caption.
//
// Engineering axes as in the spec: x forward, y left, z up, mm. The figure
// draws the column in its own plane (y = 0) at world scale U units per mm.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// spec.json is an excerpt of spec/steering_spec.json from
// github.com/vinayanand3/steering-system-explorer: only the fields read here.
const S = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "spec.json"), "utf8"));
const C = S.column;

export const U = 0.32;                                   // world units per mm

export const COLUMN = {
  angleDeg: C.axis_angle_from_horizontal_deg,            // below horizontal (= A18)
  tiltRangeDeg: C.tilt_range_deg,
  tiltDetents: C.tilt_detents,
  tiltStepDeg: C.tilt_step_deg,
  telescopeMm: C.telescope_range_mm,
  strokeMm: C.ea_collapse_stroke_mm,
  hubToUj1Mm: C.length_hub_to_ujoint1_mm,
  stations: C.stations_from_hub_mm,                      // mm from the hub along the axis
  wheelDiameterMm: S.inputs.W9_steering_wheel_diameter_mm,
  rimSectionMm: S.inputs.rim_section_radius_mm,
  beta1Deg: S.intermediate_shaft.beta1_deg,              // column to upper intermediate shaft
};

/**
 * The driver package the test is set from: the seating reference point and
 * the rim's ring centre, in the spec's vehicle axes (mm).
 */
const J = S.driver_package_j1100;
export const PACKAGE = { sgrpMm: J.SgRP_mm, ringMm: S.column.wheel_centre_mm };

/**
 * The regulatory test, FMVSS 203 (49 CFR 571.203 S5.1(a)), run to SAE J944
 * JUN80, the edition the rule incorporates by reference:
 *  - a torso-shaped body block of 75 +5 -0 lb (J944 5.1.2), its centre of
 *    gravity 21.7 in below the top of the head (5.1.3), drawn to J944
 *    Figs. 2-4 (its outline is in geom.mjs);
 *  - in free flight at impact, moving level and straight ahead, without
 *    rotating (5.3);
 *  - its reference line set as far above the rim's lower edge as a point
 *    0.75 in above the driver's seating reference point (6.1);
 *  - the column on a fixture at least as rigid as the car, at its design
 *    angle within 1 deg (5.4, 6.2), with any load cell between the column and
 *    the wheel (5.5);
 *  - at 24 km/h, and the force on the chest may not pass 11,120 N except for
 *    intervals totalling 3 ms or less (FMVSS 203 S5.1(a));
 *  - vehicles that meet FMVSS 208's frontal crash test by means other than
 *    belts (airbags) are exempt (S2).
 * NHTSA's lab procedure TP-203-02 adds the rig: a pneumatic accelerator
 * that pushes the block by a hub on its back and lets it fly free, two speed
 * readings (the last by laser within 3 in of the wheel), a 3-axis load cell
 * about 4.5 in across, and a triaxial accelerometer at the block's centre of
 * gravity.
 */
const IN = 25.4;
export const TEST = {
  blockKg: 75 * 0.45359237,
  speedKmh: 24,
  limitN: 11120,
  limitMs: 3,
  refAboveSgrpMm: 0.75 * IN,
  cgBelowHeadMm: 21.7 * IN,
};
TEST.energyJ = 0.5 * TEST.blockKg * (TEST.speedKmh / 3.6) ** 2;

/** The five tilt detents, lowest first: -5, -2.5, 0, +2.5, +5 degrees. */
export const DETENTS = Array.from({ length: COLUMN.tiltDetents }, (_, i) =>
  -COLUMN.tiltRangeDeg / 2 + i * COLUMN.tiltStepDeg);

/**
 * Where the moving parts are for a driver setting and a crash stroke, as the
 * spec builds the column: the tilt head and the upper jacket slide together
 * inside the body-fixed lower jacket. Telescope (0 to the spec's range) pulls
 * them out toward the driver; the crash stroke pushes them in toward the dash.
 */
export function poseOf({ tilt = 0, telescope = 0, stroke = 0 }) {
  return { tilt, slideMm: stroke - telescope, telescope, stroke };
}

/**
 * The tilt joint is a single Cardan joint working at the tilt angle, and
 * nothing phases against it, so the shaft below runs unevenly: its speed
 * swings between cos(beta) and 1/cos(beta) of the wheel's, twice a turn.
 * Returned as the +/- swing in percent, the figure the viewer's plot quotes.
 */
export const tiltRipplePct = (tiltDeg) => (1 / Math.cos(Math.abs(tiltDeg) * Math.PI / 180) - 1) * 100;

export const DATA = { U, COLUMN, DETENTS, PACKAGE, TEST };
