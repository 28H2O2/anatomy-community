// Moving parts of the solenoid figures, drawn from the same functions in the build and in the page.
// Every function takes the kit (`k`), the lathe module (`G`), the projection and the dimensions `D`.
// No imports: the build inlines this file into the page with `export ` stripped.

export const DIMS = {
  ZA: 34, // axis height above the bench top (mm)
  rP: 8.0, // plunger radius (Ø16)
  pole: 18, // pole face x (the stop washer sits on it)
  washer: 0.25, // nonmagnetic stop washer thickness (mm)
  lip: 41.2, // +x face of the brass guide-sleeve flange, the spring seat
  plungerLen: 38,
  collar: [29, 30.2, 12.4], // spring collar washer: s0, s1, radius (plunger-local s from its inner face)
  clip: [30.2, 31, 10.6], // e-clip
  pin: 35, // cross pin position along the plunger
  clevis: [31.5, 44.5], // ribbon clevis side plates, s0..s1
  spring: { r: 10.8, wire: 0.45, turns: 5.5 },
  post: [76, 82], // stop post x range
  screwZ: -9, // stop screw height relative to the axis
  drum: [104, -9], // constant-force spring drum centre (x, y); the ribbon leaves it at y = 0
};

// x of the plunger's inner face for a gap g (mm), which is pole face + g (the washer is inside g)
export const innerOf = (D, g) => D.pole + g;

// a half-disc polygon (the y <= 0 half) in the axis frame, whose u is +z and v is +y
export function halfPoly(r, n = 44) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (Math.PI * i) / n;
    out.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return out;
}
export const axisFrame = (G, x, z) => G.frameOf([x, 0, z], [1, 0, 0], [0, 0, 1], [0, 1, 0]);

// one cylindrical step of a turned part: whole (lathe disc) or the half behind the cut plane y = 0
export function stepSolid(G, P, cut, s0, s1, r, z, x0 = 0) {
  const F = axisFrame(G, x0, z);
  return cut ? G.prismOf(F, halfPoly(r), s0, s1, P) : G.disc(s0, s1, r, F, P);
}
// the cut face of an annulus (or a solid when rIn = 0) in the plane y = 0, as one path
export function cutFace(k, P, s0, s1, rIn, rOut, z, x0 = 0) {
  const at = (s, r) => k.iso([x0 + s, 0, z + r], P);
  if (rIn <= 0) return k.pathOf([at(s0, -rOut), at(s1, -rOut), at(s1, rOut), at(s0, rOut)], true);
  return k.pathOf([at(s0, rIn), at(s1, rIn), at(s1, rOut), at(s0, rOut)], true) + k.pathOf([at(s0, -rOut), at(s1, -rOut), at(s1, -rIn), at(s0, -rIn)], true);
}

// the plunger assembly at inner-face x = xi: body pieces either side of the collar, collar, clip.
// Returns svg strings in painter's order slots: `behind` (before the spring's front half), `cut` (cut faces).
export function plungerSvg(k, G, P, D, xi, { cut, z = D.ZA, from = D.lip, cls = "m-plunger", cone = 0 }) {
  const S = (paths, c, extra = {}) => k.solidSvg(paths, { tone: "hi", className: c, ...extra });
  const r = D.rP;
  const c0 = xi + D.collar[0], c1 = xi + D.collar[1], e1 = xi + D.clip[1], tip = xi + D.plungerLen;
  const a0 = Math.max(from, xi + 0.6);
  let body = "";
  // piece A: from the sleeve lip (or the inner face when exploded) to the collar
  if (from < xi + 0.6) body += S(stepSolid(G, P, cut, xi, xi + 0.6, r - 0.6, z), cls);
  if (c0 > a0) body += S(stepSolid(G, P, cut, a0, c0, r, z), cls, { lit: true });
  body += S(stepSolid(G, P, cut, c0, c1, D.collar[2], z), "m-zinc");
  body += S(stepSolid(G, P, cut, c1, e1, D.clip[2], z), "m-dark");
  body += S(stepSolid(G, P, cut, e1, tip - 0.6, r, z), cls, { lit: true });
  body += S(stepSolid(G, P, cut, tip - 0.6, tip, r - 0.6, z), cls);
  let faces = "";
  if (cut) {
    const pt = (x, w) => k.iso([x, 0, z + w], P);
    if (cone > 0) faces += `<path class="cut c-plunger" d="${k.pathOf([pt(xi, r), pt(c0, r), pt(c0, -r), pt(xi, -r), pt(xi + cone, -3), pt(xi + cone, 3)], true)}"/>`;
    else faces += `<path class="cut c-plunger" d="${cutFace(k, P, xi, c0, 0, r, z)}"/>`;
    faces += `<path class="cut c-zinc" d="${cutFace(k, P, c0, c1, 0, D.collar[2], z)}"/>`;
    faces += `<path class="cut c-dark" d="${cutFace(k, P, c1, e1, 0, D.clip[2], z)}"/>`;
    faces += `<path class="cut c-plunger" d="${cutFace(k, P, e1, tip, 0, r, z)}"/>`;
    // the cross-pin hole, sectioned
    const ph = (s, w) => k.iso([xi + s, 0, z + w], P);
    faces += `<path class="cut c-pin" d="${k.pathOf([ph(D.pin - 1.25, -r), ph(D.pin + 1.25, -r), ph(D.pin + 1.25, r), ph(D.pin - 1.25, r)], true)}"/>`;
    faces += cone > 0 ? `<path class="cut-edge" d="${k.pathOf([pt(xi, r), pt(tip, r), pt(tip, -r), pt(xi, -r), pt(xi + cone, -3), pt(xi + cone, 3)], true)}"/>` : `<path class="cut-edge" d="${cutFace(k, P, xi, tip, 0, r, z)}"/>`;
  }
  return { body, faces };
}

// compression spring between x0 (lip) and x1 (collar), split for painter's order
export function springSvg(k, P, D, x0, x1, z = D.ZA) {
  const c = k.coil(x0 + 0.05, x1 - 0.05, [0, z], D.spring.r, D.spring.turns, "x", P, 28);
  return c;
}

// the ribbon clevis on the plunger tip, the cross pin and the stop tab; `back` is drawn before the plunger
export function clevisSvg(k, G, P, D, xi, z = D.ZA) {
  const S = (paths, c, extra = {}) => k.solidSvg(paths, { tone: "hi", className: c, ...extra });
  const x0 = xi + D.clevis[0], x1 = xi + D.clevis[1];
  const plate = (y0, y1) => S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.4 }, z - 5, 10, P, 2, 0.2), "m-zinc");
  const back = plate(-9.6, -8.8) + S(G.disc(-10.4, -9.6, 2.0, G.frameOf([xi + D.pin, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), "m-dark");
  let front = plate(8.8, 9.6);
  // cross bar the ribbon is riveted to, and the stop tab under it
  front += S(k.slabOf({ x: x1 - 1, y: -9.6, w: 1, d: 19.2, r: 0.3 }, z - 5, 10, P, 2, 0.2), "m-zinc");
  front += S(k.slabOf({ x: x1 - 1, y: -3, w: 1, d: 6, r: 0.3 }, z - 13, 8, P, 2, 0.2), "m-zinc");
  // cross-pin head and its retaining clip on the near plate
  const F = G.frameOf([xi + D.pin, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  front += S(G.disc(9.6, 10.6, 2.0, F, P), "m-dark");
  front += k.dotsSvg([k.iso([xi + D.pin, 10.6, z], P)], { size: 0.5, tone: "mid" });
  return { back, front, face: x1 };
}

// the stop screw from its tip (touching the tab at rest) through the post, with a lock nut and knurled head
export function stopScrewSvg(k, G, P, D, tipX, z = D.ZA) {
  const zs = z + D.screwZ;
  const F = axisFrame(G, 0, zs);
  const S = (paths, c, extra = {}) => k.solidSvg(paths, { tone: "hi", className: c, ...extra });
  const len = 24;
  const end = tipX + len;
  const near = S(G.disc(tipX, D.post[0], 1.5, F, P), "m-zinc", { inner: k.lineSvg(threadOf(k, G, P, F, tipX + 0.8, D.post[0] - 0.2), { tone: "lo" }) });
  const far = S(G.disc(D.post[1], D.post[1] + 1.8, 2.9, F, P, { steps: 6 }), "m-zinc") + S(G.disc(D.post[1] + 1.8, Math.max(D.post[1] + 2.4, end - 4.5), 1.5, F, P), "m-zinc") + S(G.disc(Math.max(D.post[1] + 2.4, end - 4.5), end, 3.2, F, P), "m-dark", { inner: k.lineSvg(knurlX(k, G, P, F, Math.max(D.post[1] + 2.4, end - 4.5), end, 3.2), { tone: "lo" }) });
  return { near, far };
}
export function threadOf(k, G, P, F, s0, s1) {
  let d = "";
  for (let s = s0; s < s1; s += 0.9) d += G.arcOf(F, s, 1.5, P, { least: 0.05 });
  return d;
}
export function knurlX(k, G, P, F, s0, s1, r) {
  return G.ribsOf(F, s0 + 0.3, s1 - 0.3, r, 28, P).replace ? G.ribsOf(F, s0 + 0.3, s1 - 0.3, r, 28, P) : "";
}

// the constant-force ribbon from the clevis cross bar to the drum's tangent point, in the plane y = 0
export function ribbonSvg(k, P, D, x0, z = D.ZA) {
  const x1 = D.drum[0];
  const at = (x, w) => k.iso([x, 0.1, z + w], P);
  const face = k.pathOf([at(x0, -3), at(x1, -3), at(x1, 3), at(x0, 3)], true);
  const top = k.pathOf([at(x0, 3), at(x1, 3)]);
  return `<g class="m-ribbon"><path class="rb-face" d="${face}"/><path class="iso-line" data-tone="mid" d="${top}"/><path class="iso-line iso-edge" data-tone="hi" d="${face}"/></g>` + k.dotsSvg([k.iso([x0 + 1.6, 0.2, z - 1.4], P), k.iso([x0 + 1.6, 0.2, z + 1.4], P)], { size: 0.55, tone: "hi" });
}

// marks on the drum's top flange that turn as ribbon pays out
export function drumMarks(k, P, D, turn, z) {
  const [cx, cy] = D.drum;
  let d = "";
  for (let n = 0; n < 3; n++) {
    const a = turn + (n * Math.PI * 2) / 3;
    d += k.pathOf([k.iso([cx + Math.cos(a) * 2.2, cy + Math.sin(a) * 2.2, z], P), k.iso([cx + Math.cos(a) * 10.6, cy + Math.sin(a) * 10.6, z], P)]);
  }
  return d;
}

// the conical tip of the pole (cut face, and the stop washer on its flat), for the cone face options
export function poleTipSvg(k, G, P, D, cone, z = D.ZA, dx = 0, body = false) {
  if (!(cone > 0)) return "";
  const x0 = dx + D.pole;
  const pt = (x, w) => k.iso([x, 0, z + w], P);
  const poly = [pt(x0, 8.1), pt(x0 + cone, 3), pt(x0 + cone, -3), pt(x0, -8.1)];
  let out = "";
  if (body) for (const [a, b, r] of [[0, 0.34, 7.2], [0.34, 0.67, 5.6], [0.67, 1, 4]]) out += k.solidSvg(stepSolid(G, P, true, a * cone, b * cone, r, z, x0), { tone: "hi", className: "m-iron-dk" });
  out += `<path class="cut c-iron" d="${k.pathOf(poly, true)}"/><path class="cut-edge" d="${k.pathOf(poly, true)}"/>`;
  const w = [pt(x0 + cone, 2.6), pt(x0 + cone + D.washer, 2.6), pt(x0 + cone + D.washer, -2.6), pt(x0 + cone, -2.6)];
  out += `<path class="cut c-brass" d="${k.pathOf(w, true)}"/><path class="cut-edge" d="${k.pathOf(w, true)}"/>`;
  return out;
}

// marks across the wound ribbon coil that turn with the drum: ribbon paid out over the drum radius.
// Each mark fades toward the coil's limbs instead of stopping.
export function coilMarks(k, P, D, turn, z0, z1, r = 9) {
  const [cx, cy] = D.drum;
  const view = k.towardViewer(P);
  let out = "";
  for (let n = 0; n < 12; n++) {
    const a = turn + (n * Math.PI * 2) / 12;
    const facing = Math.cos(a) * view[0] + Math.sin(a) * view[1];
    if (facing <= 0.05) continue;
    const alpha = Math.min(1, (facing - 0.05) / 0.45);
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    out += `<path class="iso-line" data-tone="mid" opacity="${alpha.toFixed(2)}" d="${k.pathOf([k.iso([x, y, z0], P), k.iso([x, y, z1], P)])}"/>`;
  }
  return out;
}
