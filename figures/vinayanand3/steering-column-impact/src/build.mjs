// Builds the steering column figure: the FMVSS 203 impact test (run to SAE
// J944) set up on the column, drawn with the anatomy kit from the numbers in
// spec.json (an excerpt of the steering-system-explorer spec) and the test's own.
//
//   node build.mjs            dark page
//   node build.mjs --light    light page
//   node build.mjs --audit    also prove the geometry, at rest and at the extremes
//
// Writes steering-column-impact.html (or steering-column-impact-light.html)
// next to itself.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import * as T from "../../../../.skill/kit/tube.mjs";
import { DATA, COLUMN, DETENTS, U, TEST, poseOf, tiltRipplePct } from "./model.mjs";
import { benchParts, trackOf } from "./geom.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = fileURLToPath(new URL("../../../../.skill/kit", import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

const W = 900;
const H = 700;
const AZIMUTH = 105;
const ELEVATION = 30;

// Fit the camera to the bench, the block's head and everything the wheel can reach.
const TRACK = trackOf(G, DATA);
const reach = (() => {
  const pts = [];
  const a = (COLUMN.angleDeg * Math.PI) / 180;
  const HUB = [-60, 0, 150];
  const rim = (COLUMN.wheelDiameterMm / 2) * U + 4;
  for (const x of [TRACK.plateX, 104]) for (const y of [-82, 82]) for (const z of [-17, 0]) pts.push([x, y, z]);
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    pts.push([HUB[0] + Math.cos(t) * rim * Math.sin(a + 0.09), Math.sin(t) * rim, HUB[2] + Math.cos(t) * rim * Math.cos(a + 0.09) + 6]);
  }
  const top = TRACK.top;
  for (const x of [TRACK.rest, TRACK.contact + 0.788 * COLUMN.strokeMm * U + 70]) for (const y of [-57, 57]) pts.push([x, y, top]);
  return pts;
})();
const P = k.fitProjection(reach, W, H, { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION });

// neighbouring chunks of one tube never count as overlaps, the closed rim's
// last and first chunks included
let rimLast = -1;
const SKIP = (a, b) => A.sameRun(a, b) || (a.route === "col.rim" && b.route === "col.rim" && Math.min(a.chunk, b.chunk) === 0 && Math.max(a.chunk, b.chunk) === rimLast);

// what each group slides along: the column down its axis, the block and the
// piston tube straight ahead
const MOVES = { "": [0, 0, 0], block: [1, 0, 0], carriage: [1, 0, 0] };
// the bellows stretches between the moving head and the fixed jacket: its
// middle moves half as far as the column
const HALF_SLIDE = 0.5;

/** Draw the bench at one pose; with `audit`, record every part's true shape. */
function benchAt(pose, audit) {
  const R = A.recorder(P);
  const { items, routes, ...meta } = benchParts(k, G, T, P, DATA, pose, audit ? A : null);
  for (const { name, points, r, closed, owner } of routes) R.route(name, points, r, { owner, closed });
  rimLast = Math.max(...items.filter((item) => item.route === "col.rim").map((item) => item.chunk));
  for (const item of items) {
    const shapes = item.route ? item.shapes : item.shapes.map((shape) => R.solid(shape));
    const placed = R.put({ name: item.name, at: item.at, svg: item.svg, shapes, key: item.key, route: item.route, chunk: item.chunk, piece: item.group, move: item.group === "bellows" ? G.mul3(meta.d, HALF_SLIDE) : MOVES[item.group] ?? meta.d });
    placed.dyn = Boolean(item.dyn);
  }
  return { R, meta };
}

// The page draws in one order, so solve it over every place the column, the
// piston tube and the block pass through: telescoped out, the launch, the free
// flight, and each step of the column's stroke with the block following it.
// Shares are world units along each group's line; tilt is a rotation and is
// checked at the extremes below.
const FULL_OUT = COLUMN.telescopeMm * U, L = TRACK.launch, F = TRACK.fly;
const STROKES = [0, 0.25, 0.5, 0.75, 1].map((f) => f * COLUMN.strokeMm);
const SLIDES = [
  0,
  { label: "telescoped out", shares: { column: -FULL_OUT, bellows: -FULL_OUT, carriage: 0, block: 0 } },
  { label: "launching", shares: { column: 0, carriage: L / 2, block: L / 2 } },
  { label: "released", shares: { column: 0, carriage: L, block: L } },
  ...STROKES.map((m) => ({ label: `stroke ${m} mm`, shares: { column: m * U, bellows: m * U, carriage: L, block: L + F + TRACK.strokeTravel(m) } })),
];
const REST = poseOf({});
const { R, meta } = benchAt(REST, true);
{
  // the bellows changes shape rather than sliding, so its pairs are measured
  // where it really is (at rest here, at each extreme below), and every other
  // pair across the slides
  const all = R.items.slice();
  const bellows = (item) => item.name === "col.bellows";
  const slid = A.overlapsOf(all, P, { states: SLIDES, skip: (a, b) => SKIP(a, b) || bellows(a) || bellows(b) });
  const still = A.overlapsOf(all, P, { states: [0], skip: (a, b) => SKIP(a, b) || !(bellows(a) || bellows(b)) });
  // and where it really is at the far ends of its travel, mapped back onto
  // the rest items with the state's shares
  const index = new Map(all.map((item, i) => [item.name, i]));
  const ends = [[SLIDES[1], poseOf({ telescope: COLUMN.telescopeMm })], [SLIDES[SLIDES.length - 1], { ...poseOf({ stroke: COLUMN.strokeMm }), carriage: L, block: L + F + TRACK.strokeTravel(COLUMN.strokeMm) }]];
  const far = ends.flatMap(([state, pose]) => {
    const { R: Rx } = benchAt(pose, true);
    const xs = Rx.items;
    return A.overlapsOf(xs, P, { states: [0], skip: (a, b) => SKIP(a, b) || !(bellows(a) || bellows(b)) }).pairs
      .filter((pair) => index.has(xs[pair.a].name) && index.has(xs[pair.b].name))
      .map((pair) => ({ ...pair, a: index.get(xs[pair.a].name), b: index.get(xs[pair.b].name), state }));
  });
  const overlaps = { ...slid, pairs: [...slid.pairs, ...still.pairs, ...far] };
  const solved = A.orderKeys(all, overlaps);
  all.forEach((item, index) => (item.key = solved.keys[index]));
  R.settled = { items: all, overlaps, solved, states: SLIDES };
}
const items = R.items.slice().sort((a, b) => a.key - b.key);
// slots for parts that only exist part-way through a crash, each kept just
// behind the part it passes behind (checked at full stroke below)
const LATE = { "col.earR-in": ["col.lower-jacket-top", "col.earR"] };
for (const [name, behind] of Object.entries(LATE)) items.splice(items.findIndex((item) => item.name === behind[0]), 0, { name, svg: "", pin: behind });
const ORDER = items.map((item) => item.name);

// The page re-sorts as parts move, as the solver assumes: each moving part's
// key rises by its lift (its line of travel dotted with the view) times how
// far it has gone. A pinned slot sits just behind its part.
const V = A.cameraBasis(P).V;
const LIFT = Object.fromEntries(Object.entries(MOVES).map(([group, move]) => [group, G.dot3(move, V)]));
LIFT.column = G.dot3(meta.d, V);
LIFT.bellows = LIFT.column * HALF_SLIDE;
const KEYS = items.map((item) => (item.pin ? { pin: item.pin } : { key: +item.key.toFixed(4), group: item.piece || "" }));
const sharesOf = (pose) => ({ column: (pose.slideMm ?? 0) * U, bellows: (pose.slideMm ?? 0) * U, block: pose.block ?? 0, carriage: pose.carriage ?? 0 });
function pageOrder(shares) {
  const at = new Map();
  ORDER.forEach((name, i) => !KEYS[i].pin && at.set(name, KEYS[i].key + (LIFT[KEYS[i].group] ?? 0) * (shares[KEYS[i].group] ?? 0)));
  ORDER.forEach((name, i) => KEYS[i].pin && at.set(name, Math.min(...KEYS[i].pin.map((p) => at.get(p))) - 1e-4));
  return new Map([...at.entries()].sort((a, b) => a[1] - b[1]).map(([name], i) => [name, i]));
}

// ---- page ----------------------------------------------------------------
const groups = items.map((item) => `<g data-n="${item.name}">${item.svg}</g>`).join("");
const LABEL =
  "The FMVSS 203 steering impact test, set up on this steering column. On a base plate, a post and crossbeam carry the instrument-panel bracket and its shear capsules clamped round the lower jacket, a stand holds the lower column and the first universal joint, and a pillow block takes the intermediate shaft. The column runs down and forward at 38 degrees, with a load cell between the column and the wheel. Behind the wheel stands the SAE J944 body block: a plywood backboard cut to a body outline on a 2x6 base, with a rubber torso and head in a leather vest bound on with tape, an accelerometer and two eye hooks on its back, and a velocity wand on its side. A pneumatic accelerator on a frame of two posts and a crossbeam holds it by a hub on its back; an air receiver with a gauge feeds it, and a laser fork on a post reads the block's speed just before it strikes the wheel.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: `<g class="cl-art">${groups}</g>` });

const kmh = TEST.speedKmh, lbf = Math.round(TEST.limitN / 4.4482216);
const caption =
  `FMVSS 203 (49 CFR 571.203), run to SAE J944. The column is held on a fixture as rigid as the car, at its design angle of ${COLUMN.angleDeg}° within 1°, with a load cell between the column and the wheel. ` +
  `A torso-shaped body block of ${Math.round(TEST.blockKg)} kg (75 lb), set so that its reference line sits as far above the rim's lower edge as a point 0.75 in above the driver's seating reference point, is pushed by a pneumatic accelerator through a hub on its back and released to fly level and straight ahead (NHTSA TP-203-02). ` +
  `It strikes the wheel at ${kmh} km/h (15 mph; NHTSA's lab aims for 14.75 ± 0.15 mph, read by a laser within 3 in of the wheel), carrying ${Math.round(TEST.energyJ)} J. The force on its chest must stay under ${TEST.limitN.toLocaleString("en-US")} N (${lbf.toLocaleString("en-US")} lbf), except for spikes totalling ${TEST.limitMs} ms. ` +
  `The column gives way by sliding its upper jacket into the lower one and folding the energy-absorbing bellows; the drawing runs the spec's full ${COLUMN.strokeMm} mm stroke, not a measured result. ` +
  `Cars that meet FMVSS 208's frontal crash test with airbags are exempt from this test. Motion is slowed 25 times. Drag to try the driver's tilt (${COLUMN.tiltRangeDeg}° in ${COLUMN.tiltDetents} detents) and telescope (${COLUMN.telescopeMm} mm); the test always runs at the design position.`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Steering column · FMVSS 203 impact",
  hint: "Drag to tilt and telescope · tap to run the test",
  readout: "block 0.0 km/h · stroke 0 mm",
  keys: [
    { mark: "lit", label: "EA bellows" },
    { mark: "raised", label: "column and body block" },
    { mark: "flat", label: "test rig" },
  ],
  caption,
  body: `<div class="cl-stage" tabindex="0" role="application" aria-label="The FMVSS 203 steering impact test on this column. Up and down arrows tilt the wheel through its detents, left and right arrows telescope it, C or a tap runs the test, R resets.">${svg}</div>`,
});

const CSS = `
.cl-stage{position:relative;outline:none;touch-action:none;cursor:grab}
.cl-stage:active{cursor:grabbing}
.cl-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-mid);border-radius:8px}
.iso-plate-corner[data-readout]{font-variant-numeric:tabular-nums}
@media (max-width:560px){.iso-plate-corner{font-size:9px;letter-spacing:.02em}.iso-plate-corner[data-corner=hint]{max-width:60%}}
`;

const strip = (file) => readFileSync(join(KIT, file), "utf8");
const namesOf = (src) => [...src.matchAll(/^export (?:function|const) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
const kitSrc = strip("iso-kit.mjs");
const latheSrc = strip("lathe.mjs");
const tubeSrc = strip("tube.mjs");
const geomSrc = readFileSync(join(HERE, "geom.mjs"), "utf8");
const kNs = `const k = (() => {\n${kitSrc.replace(/^export /gm, "")}\nreturn { ${namesOf(kitSrc).join(", ")} };\n})();\n`;
const gNs = `const G = (() => {\nconst { cameraOf, iso, pathOf } = k;\n${latheSrc.replace(/^import .*$/m, "").replace(/^export /gm, "")}\nreturn { ${namesOf(latheSrc).join(", ")} };\n})();\n`;
const tNs = `const T = (() => {\nconst { iso, pathOf } = k;\n${tubeSrc.replace(/^import .*$/gm, "").replace(/^export /gm, "")}\nreturn { ${namesOf(tubeSrc).join(", ")} };\n})();\n`;
const geom = geomSrc.replace(/^export \{[^}]*\};?\s*$/m, "");
const TRAVEL = Array.from({ length: 41 }, (_, i) => TRACK.strokeTravel((i / 40) * COLUMN.strokeMm));
const LIVE_DATA = { ...DATA, P, ORDER, KEYS, LIFT, W, H, track: { launch: TRACK.launch, fly: TRACK.fly, travel: TRAVEL } };
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(LIVE_DATA));

const page = k.pageHtml({ title: "Steering impact test", theme: THEME, body: `<style>${CSS}</style>${plate}`, script: kNs + gNs + tNs + geom + live, width: 960 });
const name = THEME === "light" ? "steering-column-impact-light.html" : "steering-column-impact.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${R.solids.length} solids`);

// ---- audit: rest, then the extremes the reader can reach -----------------
if (process.argv.includes("--audit")) {
  let failed = 0;
  console.log("\n== rest");
  A.auditOrExit(R, P);
  failed += process.exitCode ? 1 : 0;
  const hit = (strokeMm) => ({ ...poseOf({ stroke: strokeMm }), carriage: L, block: L + F + TRACK.strokeTravel(strokeMm) });
  const extremes = {
    "tilt up, pulled out": poseOf({ tilt: 5, telescope: COLUMN.telescopeMm }),
    "tilt down, pushed in": poseOf({ tilt: -5 }),
    "released from the piston tube": { ...poseOf({}), carriage: L, block: L },
    "contact": hit(0),
    "full stroke": hit(COLUMN.strokeMm),
  };
  for (const [label, pose] of Object.entries(extremes)) {
    process.exitCode = 0;
    console.log(`\n== ${label}`);
    const { R: Rx } = benchAt(pose, true);
    A.settle(Rx, P, { skip: SKIP });
    if (pose.block > L + F - 1e-6) {
      // the block is meant to touch the rim here: that one pair is the test
      const result = A.audit(Rx, P);
      const touch = (c) => c.tube === "col.rim" && String(c.other).startsWith("block.");
      const contact = result.clearance.filter(touch);
      result.clearance = result.clearance.filter((c) => !touch(c));
      // and it flies free: nothing holds it but the wheel it strikes
      const flying = result.supports.loose.filter((name) => name.startsWith("block."));
      result.supports.loose = result.supports.loose.filter((name) => !name.startsWith("block."));
      if (flying.length) console.log(`  in free flight, as the test requires: ${flying.length} block parts`);
      console.log(A.report(result));
      for (const c of contact) console.log(`  in contact, as the test intends: ${c.tube} × ${c.other}   ${c.clearance.toFixed(2)}`);
      const count = A.failures(result);
      console.log(count ? `audit failed: ${count} problem${count === 1 ? "" : "s"}` : "audit passed");
      failed += count ? 1 : 0;
    } else {
      A.auditOrExit(Rx, P);
      failed += process.exitCode ? 1 : 0;
    }
    // every overlap at this pose must agree with the order the page draws in here
    const rank = pageOrder(sharesOf(pose));
    const { overlaps, items: xi } = Rx.settled;
    let flips = 0;
    for (const pair of overlaps.pairs) {
      const [a, b] = [xi[pair.a], xi[pair.b]];
      const aFront = pair.front[0].area >= overlaps.least, bFront = pair.front[1].area >= overlaps.least;
      if (aFront === bFront) continue;                    // a contact, or a cycle the audit reports
      const [near, far] = aFront ? [a, b] : [b, a];
      if (rank.get(near.name) < rank.get(far.name)) {
        flips++;
        console.log(`  order flip: ${near.name} is in front of ${far.name} here, but the page draws it first   ${Math.max(pair.front[0].area, pair.front[1].area).toFixed(1)} px²`);
      }
    }
    console.log(`order flips against the page's order: ${flips}`);
    failed += flips ? 1 : 0;
  }
  process.exitCode = failed ? 1 : 0;
  console.log(failed ? `\naudit failed in ${failed} pose check(s)` : "\nall poses passed");
}
