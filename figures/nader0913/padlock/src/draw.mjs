// Everything that moves, drawn from plState. Used by the build (first frame) and inlined in the page.
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import { mPrism, mFace, mPose, mItems, mSvg, mView, mLight, mBand, mClip, mHatch, mArc } from "./engine.mjs";
import { PL } from "./model.mjs";

const PLX = {};
const plRad = (a) => (a * Math.PI) / 180;
const plZF = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
const plCircle = (r, n = 40) => Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
const plRot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// wheel outline: ten flats (one per digit, centred on k*36 deg) with chamfered corners
function plWheelRing() {
  const R = PL.FLAT / Math.cos(Math.PI / 10), c = PL.CHAMF, pts = [];
  for (let i = 0; i < 10; i++) {
    const a = plRad(18 + 36 * i), p = [R * Math.cos(a), R * Math.sin(a)];
    const a0 = plRad(18 + 36 * (i - 1)), a1 = plRad(18 + 36 * (i + 1));
    const p0 = [R * Math.cos(a0), R * Math.sin(a0)], p1 = [R * Math.cos(a1), R * Math.sin(a1)];
    const L = Math.hypot(p0[0] - p[0], p0[1] - p[1]);
    pts.push([p[0] + ((p0[0] - p[0]) * c) / L, p[1] + ((p0[1] - p[1]) * c) / L], [p[0] + ((p1[0] - p[0]) * c) / L, p[1] + ((p1[1] - p[1]) * c) / L]);
  }
  return pts;
}
// bore with one slot (gate or keyway) pointing along +u, as a ring
function plSlotBore(r, slotR, w, n = 40) {
  const h = w / 2, d = Math.asin(h / r), pts = [];
  for (let i = 0; i <= n; i++) { const a = d + ((2 * Math.PI - 2 * d) * i) / n; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  pts.push([slotR, -h], [slotR, h]);
  return pts;
}
function plInside(rings, p) {
  let ins = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
// material intervals along a ray (local angle a) through a holed section
function plIntervals(rings, a, r0 = 2.0, r1 = 8.4, step = 0.02) {
  const c = Math.cos(a), s = Math.sin(a), out = [];
  let open = null;
  for (let r = r0; r <= r1 + 1e-9; r += step) {
    const ins = plInside(rings, [r * c, r * s]);
    if (ins && open === null) open = r;
    if (!ins && open !== null) { out.push([open, r - step / 2]); open = null; }
  }
  if (open !== null) out.push([open, r1]);
  return out.map(([x, y]) => [Math.round(x * 50) / 50, Math.round(y * 50) / 50]).filter(([x, y]) => y - x > 0.05);
}
function plMeshes() {
  if (PLX.m) return PLX.m;
  const outer = plWheelRing(), bore = plCircle(PL.BORE, 48);
  const wheel = { rings: [outer, bore], mesh: mPrism([outer, bore], plZF, 0, PL.WH, { tone: "hi" }), z: [0, PL.WH], wrap: "pl-wheel" };
  const sb = plSlotBore(PL.SBORE, PL.GATE_R, PL.GATE_W);
  const sleeve = { rings: [bore, sb], mesh: mPrism([plCircle(PL.BORE, 48), sb], plZF, PL.SZ, PL.WH, { tone: "hi" }), z: [PL.SZ, PL.WH], wrap: "pl-brass" };
  // the gate: the three faces of the slot are the red accent
  for (const f of sleeve.mesh.faces) {
    if (f.rings[0].length !== 4 || Math.abs(f.n[2]) > 0.5) continue;
    const m = f.rings[0].reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    const r = Math.hypot(m[0], m[1]);
    if (r > PL.SBORE + 0.08 && r < PL.BORE - 0.2) f.cls = "pl-gate";
  }
  const wb = plSlotBore(PL.WASH_R[0], PL.LUG_R[1] + 0.25, PL.LUG_W + 0.5);
  const wo = plCircle(PL.WASH_R[1], 48);
  const washer = { rings: [wo, wb], mesh: mPrism([wo, wb], plZF, PL.WASH[0], PL.WASH[1], { tone: "hi" }), z: PL.WASH, wrap: "pl-grey", fixed: true };
  // one lug at angle 0, local z of cell 0
  const lug = mPrism([[[PL.LUG_R[0], -PL.LUG_W / 2], [PL.LUG_R[1], -PL.LUG_W / 2], [PL.LUG_R[1], PL.LUG_W / 2], [PL.LUG_R[0], PL.LUG_W / 2]]], plZF, PL.LUG[0], PL.LUG[1], { tone: "hi" });
  PLX.m = { wheel, sleeve, washer, lug };
  return PLX.m;
}
// the shackle: a U tube of 24 facets, at rest, in world space
function plShackle() {
  if (PLX.sh) return PLX.sh;
  const { AX, AY, SX, LEG_R, LEG_TOP, ARC_R, BZ1, INSERT } = PL;
  const cx = (AX + SX) / 2;
  const path = [];
  for (const z of [PL.SLAB - 1, 40, 44, 48, LEG_TOP]) path.push([AX, AY, z]);
  for (let i = 1; i < 36; i++) { const a = (Math.PI * i) / 36; path.push([cx + ARC_R * Math.cos(a), AY, LEG_TOP + ARC_R * Math.sin(a)]); }
  for (const z of [LEG_TOP, 48, 44, BZ1 - INSERT + 0.6]) path.push([SX, AY, z]);
  path.push([SX, AY, BZ1 - INSERT]);
  const N = 32, rings = [], norms = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i], q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)];
    let t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
    const l = Math.hypot(...t); t = t.map((v) => v / l);
    const u = [0, 1, 0];
    const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    const ring = [], nr = [];
    const last = i === path.length - 1;
    const r = last ? LEG_R - 0.5 : LEG_R; // chamfered end of the short leg
    for (let j = 0; j < N; j++) {
      const b = (2 * Math.PI * j) / N, d = [u[0] * Math.cos(b) + v[0] * Math.sin(b), u[1] * Math.cos(b) + v[1] * Math.sin(b), u[2] * Math.cos(b) + v[2] * Math.sin(b)];
      ring.push([p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r]); nr.push(d);
    }
    rings.push(ring); norms.push(nr);
  }
  const faces = [];
  const fn = (i, j) => { const a = norms[i][j], b = norms[i][(j + 1) % N], c = norms[i + 1][j], d = norms[i + 1][(j + 1) % N]; const s = [a[0] + b[0] + c[0] + d[0], a[1] + b[1] + c[1] + d[1], a[2] + b[2] + c[2] + d[2]]; const l = Math.hypot(...s); return s.map((x) => x / l); };
  const down = [0, 0, -1];
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N, jm = (j - 1 + N) % N;
      const a0 = rings[i][j], b0 = rings[i][j1], b1 = rings[i + 1][j1], a1 = rings[i + 1][j];
      const n = fn(i, j);
      const endA = i + 2 === rings.length;
      const bevel = endA ? (() => { const s = fn(i, j); return s; })() : null;
      void bevel;
      faces.push({ rings: [[a0, b0, b1, a1]], n, edges: [
        { a: a0, b: b0, nb: i === 0 ? down : fn(i - 1 < 0 ? 0 : i - 1, j), own: false },
        { a: b0, b: b1, nb: fn(i, j1), own: true },
        { a: b1, b: a1, nb: i + 2 === rings.length ? down : fn(i + 1, j), own: i + 2 === rings.length },
        { a: a1, b: a0, nb: fn(i, jm), own: false }] });
    }
  }
  // end disc of the short leg
  const e = rings[rings.length - 1];
  faces.push({ rings: [e], n: down, edges: e.map((p, j) => ({ a: p, b: e[(j + 1) % N], nb: null, own: true })) });
  PLX.sh = { faces, tone: "hi" };
  return PLX.sh;
}

// shackle centreline frames at rest: { p, u, v, r }
function plShackleFrames() {
  if (PLX.fr) return PLX.fr;
  const { AX, AY, SX, LEG_R, LEG_TOP, ARC_R, BZ1, INSERT } = PL;
  const cx = (AX + SX) / 2, path = [];
  for (const z of [PL.SLAB - 1, 40, 44, 48, LEG_TOP]) path.push([AX, AY, z]);
  for (let i = 1; i < 36; i++) { const a = (Math.PI * i) / 36; path.push([cx + ARC_R * Math.cos(a), AY, LEG_TOP + ARC_R * Math.sin(a)]); }
  for (const z of [LEG_TOP, 48, 44, BZ1 - INSERT + 0.6]) path.push([SX, AY, z]);
  path.push([SX, AY, BZ1 - INSERT]);
  PLX.fr = path.map((p, i) => {
    const q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)];
    let t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
    const l = Math.hypot(...t); t = t.map((x) => x / l);
    const u = [0, 1, 0], v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    return { p, u, v, r: i === path.length - 1 ? LEG_R - 0.5 : LEG_R };
  });
  return PLX.fr;
}
// the shackle drawn with smooth four-tone bands: per segment, runs of equal tone over 144 samples round the tube
function plShackleSvg(P, psi, lift) {
  const { AX, AY, BZ1 } = PL, V = mView(P), Lt = mLight(P), NS = 96;
  const c = Math.cos(plRad(psi)), sn = Math.sin(plRad(psi));
  const rot = (x, y) => [x * c - y * sn, x * sn + y * c];
  const F = plShackleFrames().map(({ p, u, v, r }) => {
    const [x, y] = rot(p[0] - AX, p[1] - AY), [ux, uy] = rot(u[0], u[1]), [vx, vy] = rot(v[0], v[1]);
    return { p: [x + AX, y + AY, p[2] + lift], u: [ux, uy, u[2]], v: [vx, vy, v[2]], r };
  });
  const ring = F.map(({ p, u, v, r }) => Array.from({ length: NS }, (_, j) => {
    const b = (2 * Math.PI * j) / NS, n = [u[0] * Math.cos(b) + v[0] * Math.sin(b), u[1] * Math.cos(b) + v[1] * Math.sin(b), u[2] * Math.cos(b) + v[2] * Math.sin(b)];
    return { q: [p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r], n };
  }));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const clipZ = (poly) => mClip(poly, [0, 0, -1], -BZ1);
  const clipSeg = (a, b) => { if (a[2] < BZ1 && b[2] < BZ1) return null; if (a[2] >= BZ1 && b[2] >= BZ1) return [a, b]; const t = (BZ1 - a[2]) / (b[2] - a[2]); const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, BZ1]; return a[2] < BZ1 ? [m, b] : [a, m]; };
  const P2 = (pts) => k.pathOf(pts.map((q) => k.iso(q, P)), true);
  const items = [];
  // per ring: tone of every sample from that ring's own normals, then the visible runs from one silhouette to the other
  const runsOf = (R) => {
    const key = R.map(({ n }) => (dot(n, V) > 0 ? mBand(dot(n, Lt)) : -1));
    let s0 = key.findIndex((x, j) => x >= 0 && key[(j - 1 + NS) % NS] < 0);
    if (s0 < 0) return [];
    const runs = [];
    for (let j = s0; ; j++) {
      const kk = key[j % NS];
      if (kk < 0) { if (runs.length) runs[runs.length - 1].e = j; break; }
      if (!runs.length || runs[runs.length - 1].k !== kk) { if (runs.length) runs[runs.length - 1].e = j; runs.push({ k: kk, s: j }); }
    }
    return runs;
  };
  const RUNS = ring.map(runsOf), edgeD = [];
  for (let i = 0; i + 1 < F.length; i++) {
    let d = 0, dn = 0;
    const A = ring[i], B = ring[i + 1];
    if (Math.max(F[i].p[2], F[i + 1].p[2]) + PL.LEG_R < BZ1) continue;
    const ra = RUNS[i], rb = RUNS[i + 1];
    let svg = "";
    const pairs = [];
    for (let a = 0, b = 0; a < ra.length || b < rb.length;) {
      if (a < ra.length && b < rb.length && ra[a].k === rb[b].k) { pairs.push([ra[a], rb[b], ra[a].k]); a++; b++; }
      else if (b < rb.length && (a >= ra.length || (b + 1 < rb.length && rb[b + 1].k === ra[a].k))) { const at = a < ra.length ? ra[a].s : ra.length ? ra[ra.length - 1].e : rb[b].s; pairs.push([{ s: at, e: at }, rb[b], rb[b].k]); b++; }
      else { const at = b < rb.length ? rb[b].s : rb.length ? rb[rb.length - 1].e : ra[a].s; pairs.push([ra[a], { s: at, e: at }, ra[a].k]); a++; }
    }
    for (const [r, q, kk] of pairs) {
      const pts = [];
      for (let j = r.s; j <= r.e; j++) pts.push(A[j % NS].q);
      for (let j = q.e; j >= q.s; j--) pts.push(B[j % NS].q);
      const poly = clipZ(pts);
      if (poly.length > 2) {
        svg += kk === 4 ? `<path class="iso-top lk-f" d="${P2(poly)}"/>` : `<path class="iso-shade lk-f" data-shade="${kk}" d="${P2(poly)}"/>`;
        for (const x of poly) { d += dot(x, V); dn++; }
      }
    }
    const segs = [];
    if (ra.length && rb.length) {
      for (const [ja, jb] of [[ra[0].s, rb[0].s], [ra[ra.length - 1].e, rb[rb.length - 1].e]]) { const sg = clipSeg(A[ja % NS].q, B[jb % NS].q); if (sg) segs.push(sg); }
    }
    if (i + 2 === F.length && rb.length) { // the end of the short leg
      for (let j = rb[0].s; j < rb[rb.length - 1].e; j++) { const sg = clipSeg(B[j % NS].q, B[(j + 1) % NS].q); if (sg) segs.push(sg); }
    }
    if (segs.length) edgeD.push(segs.map(([a, b]) => k.pathOf([k.iso(a, P), k.iso(b, P)])).join(""));
    if (dn) items.push({ depth: d / dn, svg });
  }
  return `<g class="pl-teal">${mSvg(items)}<path class="iso-line iso-edge" data-tone="hi" d="${edgeD.join("")}"/></g>`;
}

const plHalf = (n, c) => [[n[0], n[1], 0], n[0] * c[0] + n[1] * c[1]];
function plRegions() {
  if (PLX.reg) return PLX.reg;
  const c = [PL.AX, PL.AY];
  const d1 = [Math.cos(plRad(PL.B1)), Math.sin(plRad(PL.B1))], d2 = [Math.cos(plRad(PL.B2)), Math.sin(plRad(PL.B2))];
  const vh = [Math.cos(plRad(PL.AZ)), Math.sin(plRad(PL.AZ))];
  const back = plHalf(vh, c), front = plHalf([-vh[0], -vh[1]], c);
  const R1 = [plHalf([-d1[1], d1[0]], c)], R2 = [plHalf([d1[1], -d1[0]], c), plHalf([d2[1], -d2[0]], c)];
  PLX.reg = { back: [[...R1, back], [...R2, back]], front: [[...R1, front], [...R2, front]], whole: { back: [[back]], front: [[front]] }, d1, d2 };
  return PLX.reg;
}

// one cut part of the stack: posed rings, clipped to the kept wheel, capped (hatched) on the gate line
function plCut(P, part, phi, zb, out, wrapOver) {
  const { AX, AY } = PL, R = plRegions();
  const posed = mPose(part.mesh, plRad(phi), [AX, AY, zb]);
  const wrap = wrapOver || part.wrap;
  const [bk, fr] = [mItems(posed, P, { regions: R.back, wrap }), mItems(posed, P, { regions: R.front, wrap })];
  out.back.push(...bk.flat()); out.front.push(...fr.flat());
  const z0 = zb + part.z[0], z1 = zb + part.z[1];
  const n1 = [-R.d1[1], R.d1[0], 0];
  const at1 = (r, z) => [AX + R.d1[0] * r, AY + R.d1[1] * r, z];
  for (const [a, b] of plIntervals(part.rings, plRad(PL.B1 - phi))) {
    const hatch = mHatch([[[a, z0], [b, z0], [b, z1], [a, z1]]], Math.PI / 4, 0.75, 0.3).map(([p, q]) => [at1(p[0], p[1]), at1(q[0], q[1])]);
    const face = mFace([at1(a, z0), at1(b, z0), at1(b, z1), at1(a, z1)], n1, [null, null, null, null], { fill: "cut", lines: hatch, lineTone: "lo" });
    out.caps.push(...mItems({ faces: [face], tone: "hi" }, P, { wrap })[0]);
  }
  // silhouette where the kept wheel ends on the far side of the wedge
  const at2 = (r, z) => k.iso([AX + R.d2[0] * r, AY + R.d2[1] * r, z], P);
  const segs = [];
  for (const [a, b] of plIntervals(part.rings, plRad(PL.B2 - phi))) segs.push(k.pathOf([at2(a, z1), at2(b, z1)]), k.pathOf([at2(b, z0), at2(b, z1)]));
  out.edges.push(`<g class="${wrap}"><path class="iso-line iso-edge" data-tone="hi" d="${segs.join("")}"/></g>`);
}

function plSpring(P, top) {
  const { AX, AY, FLOOR } = PL, V = mView(P), turns = 4.5, r = 2.3, n = 160;
  const back = [], front = [];
  let cur = null, curFront = null;
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * turns * i) / n, z = FLOOR + 0.35 + ((top - 0.35 - FLOOR - 0.35) * i) / n;
    const x = AX + r * Math.cos(a), y = AY + r * Math.sin(a);
    const isF = Math.cos(a) * V[0] + Math.sin(a) * V[1] > 0;
    const p = k.iso([x, y, z], P);
    if (isF !== curFront) { if (cur) (curFront ? front : back).push(cur); cur = cur ? [cur[cur.length - 1]] : []; curFront = isF; }
    cur.push(p);
  }
  if (cur) (curFront ? front : back).push(cur);
  const d = (list) => list.map((pts) => k.pathOf(pts)).join("");
  return { back: `<path class="pl-wire-back" d="${d(back)}"/>`, front: `<path class="pl-wire" d="${d(front)}"/><path class="pl-wire-hi" d="${d(front)}"/>` };
}

// static plate under the stack, split behind / in front of the axis
export function plPlate(P) {
  if (PLX.plate && PLX.plateP === P) return PLX.plate;
  const R = plRegions();
  const rect = [[0.8, PL.BACKY], [15.2, PL.BACKY], [15.2, 6.2], [0.8, 6.2]];
  const hole = plCircle(PL.COLLAR_R + 0.35, 40).map(([x, y]) => [x + PL.AX, y + PL.AY]);
  const mesh = mPrism([rect, hole], plZF, PL.PLATE[0], PL.PLATE[1], { tone: "hi" });
  const b = mItems(mesh, P, { regions: R.whole.back, wrap: "pl-grey" })[0], f = mItems(mesh, P, { regions: R.whole.front, wrap: "pl-grey" })[0];
  PLX.plateP = P;
  PLX.plate = { back: mSvg(b), front: mSvg(f) };
  return PLX.plate;
}

// the gate line: two fine rules on the section plane bracketing the channel the collars must pass through
export function plGuide(P) {
  const { AX, AY, CELL0, PITCH, WH } = PL, d1 = plRegions().d1;
  const at = (r, z) => k.iso([AX + d1[0] * r, AY + d1[1] * r, z], P);
  const z0 = CELL0 + 0.2, z1 = CELL0 + 2 * PITCH + WH + 0.6;
  const rs = [PL.SBORE - 0.05, PL.GATE_R + 0.05];
  const d = rs.map((r) => k.pathOf([at(r, z0), at(r, z1)])).join("");
  const dots = rs.flatMap((r) => [at(r, z0), at(r, z1)]);
  return `<g class="pl-guide"><path class="pl-guide-line" d="${d}"/>${k.dotsSvg(dots, { size: 0.9, tone: "hi" })}</g>`;
}
export function plFrame(P, s, opt = {}) {
  const M = plMeshes(), R = plRegions();
  const { AX, AY, CELL0, PITCH, LIFT } = PL;
  const plate = plPlate(P);
  const cells = [0, 1, 2].map((i) => {
    const zb = CELL0 + i * PITCH, phi = -s.d[i] * PL.STEP + PL.B1 + PL.COMBO[i] * PL.STEP - PL.B1; // gate local angle is built in below
    const o = { back: [], front: [], caps: [], edges: [] };
    const g = PL.B1 + PL.COMBO[i] * PL.STEP; // gate's angle on the wheel at digit 0
    plCut(P, M.wheel, -s.d[i] * PL.STEP, zb, o, "pl-wheel pl-w" + i);
    plCut(P, M.sleeve, g - s.d[i] * PL.STEP, zb, o);
    plCut(P, M.washer, PL.B1, zb, o);
    void phi;
    return o;
  });
  const sp = plSpring(P, PL.COLLAR[0] + s.lift);
  const lugs = [0, 1, 2].map((i) => mItems(mPose(M.lug, plRad(PL.B1 + s.psi), [AX, AY, CELL0 + i * PITCH + s.lift]), P, { wrap: "pl-teal" })[0]).flat();
  const legZ = PL.COLLAR[1] + s.lift;
  const leg = `<g class="pl-teal">${k.solidSvg(k.cylinder(AX, AY, PL.COLLAR_R, PL.COLLAR[0] + s.lift, PL.COLLAR[1] - PL.COLLAR[0], P, 40, 0.25), { tone: "hi" })}${k.solidSvg(k.cylinder(AX, AY, PL.LEG_R, legZ, (opt.legTop || PL.SLAB) - legZ, P, 40), { tone: "hi", crease: "none" })}</g>`;
  const stack = [
    `<g class="pl-spring">${sp.back}</g>`,
    plate.back,
    ...cells.map((c) => mSvg(c.back)),
    leg,
    ...cells.map((c) => mSvg(c.caps)),
    opt.guide ? plGuide(P) : "",
    mSvg(lugs),
    `<g class="pl-spring">${sp.front}</g>`,
    plate.front,
    ...cells.map((c) => mSvg(c.front) + c.edges.join("")),
  ].join("");
  const shackle = plShackleSvg(P, s.psi, s.lift);
  void LIFT;
  return { stack, shackle };
}
