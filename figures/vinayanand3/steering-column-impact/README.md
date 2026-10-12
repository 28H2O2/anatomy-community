# Steering Column Impact Test

Interactive visualization of an automotive steering column undergoing an
FMVSS 203 body-block impact, demonstrating tilt, telescope, and energy
absorption.

- **The test:** FMVSS 203 (49 CFR 571.203 S5.1(a)), run to SAE J944. A 75 lb
  body block flies level into the wheel at 24 km/h, and the force on its chest
  may not pass 11,120 N except for intervals totalling 3 ms or less.
- **The body block** is drawn to SAE J944's figures: a 37 in plywood body
  outline on a 2x6 base, with a rubber torso and head, its reference line set
  0.75 in above the seating reference point against the rim's lower edge.
- **The rig** follows NHTSA's lab procedure TP-203-02: a pneumatic
  accelerator, a laser speed trap within 3 in of the wheel, a load cell between
  the column and the wheel, and an accelerometer at the block's centre of
  gravity.
- **The column** comes from `src/spec.json`, an excerpt of the derived spec of
  [steering-system-explorer](https://github.com/vinayanand3/steering-system-explorer):
  its 40° design angle, five tilt detents over 10°, 55 mm of telescope and an
  80 mm collapse stroke.

Drag to tilt and telescope; tap to run the test in slow motion. The stroke
shown is the spec's full 80 mm, not a computed crash result.
