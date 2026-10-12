// Everything that moves, drawn from the model state. Used by the build (first frame, checks) and inlined in the page.
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { mPrism, mFace, mGroove, mPose, mItems, mSvg, mView, mDot, mHatch, mArc } from "./engine.mjs";
import { LK, lkOutline } from "./model.mjs";

const LKX = {};
const EPS = 1e-4;
// Regions for the plug group: inside the cut housing (seen only through its openings), in front of the cut below the
// housing top, within the lip, and above the plug face.
export const LK_REGIONS = [
  [[[0, 1, 0], 0], [[0, 0, 1], LK.ZTOP]],
  [[[0, -1, 0], -EPS], [[0, 0, 1], LK.FACE]],
  [[[0, 1, 0], 0], [[0, 0, -1], -LK.ZTOP], [[0, 0, 1], LK.FACE]],
  [[[0, 0, -1], -LK.FACE]],
];
const halfDisc = (r, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const b = -Math.PI / 2 + (Math.PI * i) / n; return [r * Math.cos(b), r * Math.sin(b)]; });

// plug-local meshes (built once)
export function lkPlugMeshes() {
  if (LKX.plug) return LKX.plug;
  const { R, ZTOP, FACE, KEYWAY, KEYWAY_Y, LIP_R, PIN_R, Z } = LK;
  const ZF = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
  const dRing = (r) => [...mArc(0, 0, r, 0, -Math.PI, 48), [KEYWAY[0], 0], [KEYWAY[0], -KEYWAY_Y], [KEYWAY[1], -KEYWAY_Y], [KEYWAY[1], 0]];
  const body = mPrism([dRing(R)], ZF, 0, ZTOP, { tone: "hi", skip: (p, q) => Math.abs(p[1]) < 1e-9 && Math.abs(q[1]) < 1e-9 && Math.min(p[0], q[0]) >= KEYWAY[1] - 1e-9 });
  const lip = mPrism([dRing(LIP_R)], ZF, ZTOP, FACE, { tone: "hi" });
  // cut-face bands between the pin holes, hatched
  const bands = [];
  const edges = [0, ...Z.flatMap((z) => [z - PIN_R, z + PIN_R]).sort((a, b) => a - b), ZTOP];
  for (let i = 0; i < edges.length; i += 2) {
    const z0 = edges[i], z1 = edges[i + 1];
    const pts = [[KEYWAY[1], 0, z0], [R, 0, z0], [R, 0, z1], [KEYWAY[1], 0, z1]];
    const nbs = [i === 0 ? [0, 0, -1] : null, [1, 0, 0], i === edges.length - 2 ? false : null, [-1, 0, 0]];
    const hatch = mHatch([[[KEYWAY[1], z0], [R, z0], [R, z1], [KEYWAY[1], z1]]], -Math.PI / 4, 0.95, 0.3).map(([a, b]) => [[a[0], 0, a[1]], [b[0], 0, b[1]]]);
    bands.push(mFace(pts, [0, 1, 0], nbs, { tone: "mid", lines: hatch, lineTone: "lo", fill: "cut" }));
  }
  const holes = { faces: Z.flatMap((z) => mGroove({ o: [0, 0, z], a: [1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] }, KEYWAY[1], R, PIN_R, 12).faces), tone: "lo" };
  LKX.plug = { body, lip, bands: { faces: bands, tone: "mid" }, holes };
  return LKX.plug;
}
export function lkKeyMesh(which) {
  LKX.keys = LKX.keys || [];
  if (LKX.keys[which]) return LKX.keys[which];
  const o = lkOutline(which === 0 ? LK.WRONG : LK.RIGHT, which === 1);
  const F = { o: [0, 0, LK.FACE], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] };
  const mesh = mPrism([o.ring, o.hole], F, -LK.KEY_T, LK.KEY_T, { tone: "hi" });
  // milled groove down the blade (a closed slot) and a rim line on the bow
  const at = (x, s, y) => [x, y, LK.FACE - s];
  const slot = [];
  const x0 = -3.9, x1 = -2.7, s0 = 0.9, s1 = LK.TIP - 2.2;
  const loop = [...mArc(0, 0, 0, 0, 0, 0).slice(0, 0), [x1, s0 + 0.6], [x1, s1], [x0, s1], [x0, s0 + 0.6]];
  const arc = mArc((x0 + x1) / 2, s0 + 0.6, (x1 - x0) / 2, 0, -Math.PI, 8).map(([x, s]) => [x, s]);
  const path = [[x1, s1], [x0, s1], ...arc.reverse()];
  const closed = [...path, [x1, s1]];
  for (const y of [LK.KEY_T, -LK.KEY_T]) {
    const lines = [];
    for (let i = 0; i + 1 < closed.length; i++) lines.push([at(closed[i][0], closed[i][1], y), at(closed[i + 1][0], closed[i + 1][1], y)]);
    const rim = which === 1 ? mArc(-1, -14.5, 8.2, 0, 2 * Math.PI, 48) : [];
    for (let i = 0; i + 1 < rim.length; i++) lines.push([at(rim[i][0], rim[i][1], y), at(rim[i + 1][0], rim[i + 1][1], y)]);
    const cap = mesh.faces.find((f) => Math.abs(f.n[1] - Math.sign(y)) < 1e-6 && f.rings.length === 2);
    cap.lines = lines; cap.lineTone = "lo";
  }
  void loop;
  LKX.keys[which] = mesh;
  return mesh;
}
const PINF = (z) => ({ o: [0, 0, z], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] });
export function lkKeyPin(n, tip) {
  const z = LK.Z[n], L = LK.KEYPIN[n];
  const nose = mPrism([halfDisc(1.02, 16)], PINF(z), tip, tip + 0.5, { tone: "hi" });
  const body = mPrism([halfDisc(LK.PIN_R, 24)], PINF(z), tip + 0.5, tip + L, { tone: "hi" });
  return { faces: [...nose.faces, ...body.faces], tone: "hi", convex: false };
}
export function lkDriver(n) {
  const z = LK.Z[n];
  return mPrism([halfDisc(LK.PIN_R, 24)], PINF(z), 0, LK.DRIVER, { tone: "hi" });
}

// The visible half-ring of a horizontal pin (axis x) at x, as a line ending on the silhouette.
export function lkPinRing(P, x, z, r) {
  const V = mView(P), pts = [];
  for (let i = 0; i <= 24; i++) {
    const b = -Math.PI / 2 + (Math.PI * i) / 24;
    if (0 * 1 + V[1] * Math.cos(b) + V[2] * Math.sin(b) >= -1e-9) pts.push(k.iso([x, r * Math.cos(b), z + r * Math.sin(b)], P));
  }
  return k.pathOf(pts);
}
// A spring along x from x0 to x1 at height z: the halves behind and in front of its axis.
export function lkSpring(P, x0, x1, z, turns = 7.5) {
  const V = mView(P), rho = 1.08, n = Math.round(turns * 28);
  const back = [], front = [];
  let run = [], near = null;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = 2 * Math.PI * turns * u - Math.PI / 2;
    const p = k.iso([x0 + (x1 - x0) * u, rho * Math.cos(a), z + rho * Math.sin(a)], P);
    const f = V[1] * Math.cos(a) + V[2] * Math.sin(a) > 0;
    if (near === null) near = f;
    run.push(p);
    if (f !== near) { (near ? front : back).push(k.pathOf(run)); run = [p]; near = f; }
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

// All the per-frame markup.
export function lkFrame(P, st) {
  const out = {};
  const V = mView(P);
  const phi = st.phi;
  const M = lkPlugMeshes();
  const pose = (m) => mPose(m, phi);
  const regions = (m) => mItems(pose(m), P, { regions: LK_REGIONS });
  const cutFront = mDot([-Math.sin(phi), Math.cos(phi), 0], V) > 1e-6;
  const body = regions(M.body), lip = regions(M.lip), bands = regions(M.bands), holes = regions(M.holes);
  const keyMesh = mPose(lkKeyMesh(st.key), phi, [0, 0, st.ins + st.lift]);
  const key = mItems(keyMesh, P, { regions: LK_REGIONS });
  const pins = st.tips.map((tip, n) => mItems(mPose(lkKeyPin(n, tip), phi), P, { regions: LK_REGIONS }));
  const layer = (ri) => {
    const plug = [mSvg(body[ri]), mSvg(lip[ri])].join("");
    const front = [cutFront ? `<g class="lk-plug">${mSvg(holes[ri])}${mSvg(bands[ri])}</g>` : "", `<g class="lk-key">${mSvg(key[ri])}</g>`, pins.map((p, n) => `<g class="lk-pin${n === 3 && st.key === 0 ? " lk-culprit" : ""}">${mSvg(p[ri])}</g>`).join("")].join("");
    return `<g class="lk-plug">${cutFront ? plug : ""}</g>${front}<g class="lk-plug">${cutFront ? "" : plug}</g>`;
  };
  out.inside = layer(0);
  out.outside = layer(1) + layer(2);
  out.high = mSvg(key[3]);
  // culprit glow on the wrong key's pin 4
  out.alert = "";
  if (st.fail > 0.01) {
    const f = mItems(mPose(lkKeyPin(3, st.tips[3]), phi), P)[0];
    out.alert = `<g class="lk-alert" style="opacity:${st.fail.toFixed(3)}">${f.map((i) => i.svg.replace(/class="iso-(shade|top) lk-f"( data-shade="\d")?/g, 'class="lk-alert-fill"')).join("")}</g>`;
  }
  // drivers and springs
  out.drivers = st.drivers.map((x) => k.translateAlong(P, [x, 0, 0]));
  const springs = st.drivers.map((x, n) => lkSpring(P, x + LK.DRIVER, LK.COVER, LK.Z[n]));
  out.springBack = springs.map((s) => s.back).join("");
  out.springFront = springs.map((s) => s.front).join("");
  // cam, stud and collar under the housing
  const c = Math.cos(phi), s = Math.sin(phi);
  const L = LK.CAM_L;
  const cam = [...mArc(0, 0, 4.9, Math.PI / 2, Math.PI * 1.5, 18), ...mArc(L, 0, 2.7, -Math.PI / 2, Math.PI / 2, 12)].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const stud = [L * c, L * s];
  const mark = [[4.2 * Math.cos(phi + Math.PI * 0.75), 4.2 * Math.sin(phi + Math.PI * 0.75)]];
  out.cam = [
    `<g class="lk-pin">${k.solidSvg(k.cylinder(stud[0], stud[1], 1.35, -5.0, 2.0, P, 20), { tone: "hi" })}</g>`,
    `<g class="lk-cam">${k.solidSvg(k.extrude(cam, -3.0, 2.2, P, { convex: true, bevel: 0.35 }), { tone: "hi" })}</g>`,
    k.dotsSvg([k.iso([stud[0], stud[1], -0.8], P)], { size: 0.9, tone: "hi" }),
    k.lineSvg(k.ring(stud[0], stud[1], 1.35, -0.8, P, 20), { tone: "mid" }),
    k.solidSvg(k.cylinder(0, 0, 4.2, -0.8, 0.8, P, 40), { tone: "hi" }),
    k.lineSvg(k.rise([mark[0][0], mark[0][1]], -0.8, 0, P), { tone: "mid" }),
  ].join("");
  out.bolt = k.translateAlong(P, [0, st.bolt, 0]);
  return out;
}
