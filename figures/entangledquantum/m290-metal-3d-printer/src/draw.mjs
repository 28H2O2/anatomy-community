import { slabOf, cylinder, extrude, solidSvg, lineSvg, dotsSvg, planOutline, sideSeam, segment, iso, insetPlan, corners, onTop, knurl, pathOf } from "../../../../.skill/kit/iso-kit.mjs";

export const C = {
  bed: 220,
  floor: 30,
  well: { x: 320, y: 270, w: 250, d: 250, r: 2 },
  disp: { x: 320, y: 100, w: 250, d: 155, r: 2 },
  coll: { x: 320, y: 540, w: 250, d: 70, r: 2 },
  centre: [445, 395],
  root: 8,
  slice: 4,
  rod: [445, 395],
  drod: [445, 177],
  lens: [445, 395, 470],
  plateT: 14,
  heaterT: 10,
  platformT: 14,
  layer: 4,
  hMax: 88,
  stock: 150,
  recoatFrom: 92,
  recoatTo: 628,
};

export function speckles(plan, z, count, seed) {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out = [];
  for (let i = 0; i < count; i++) out.push([plan.x + 6 + next() * (plan.w - 12), plan.y + 6 + next() * (plan.d - 12), z]);
  return out;
}

export function section(height) {
  const [cx, cy] = C.centre;
  if (height < C.root) return [[cx - 74, cy - 34], [cx + 74, cy - 34], [cx + 74, cy + 34], [cx - 74, cy + 34]];
  const f = Math.min(1, (height - C.root) / (C.hMax - C.root));
  const chord = 136 - 36 * f, thick = 0.13, camber = 0.05, twist = ((-28 + 56 * f) * Math.PI) / 180;
  const upper = [], lower = [];
  for (let i = 0; i <= 16; i++) {
    const x = (1 - Math.cos((i / 16) * Math.PI)) / 2;
    const half = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    const mean = x < 0.4 ? (camber / 0.16) * (0.8 * x - x * x) : (camber / 0.36) * (0.2 + 0.8 * x - x * x);
    upper.push([x, mean + half]);
    lower.push([x, mean - half]);
  }
  const outline = upper.concat(lower.reverse().slice(1, -1));
  const c = Math.cos(twist), s = Math.sin(twist);
  return outline.map(([x, y]) => [cx + ((x - 0.4) * chord) * c - y * chord * s, cy + ((x - 0.4) * chord) * s + y * chord * c]);
}

export function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function hatch(polygon, angle, spacing, half) {
  const [cx, cy] = C.centre, c = Math.cos(angle), sn = Math.sin(angle);
  const turn = ([x, y], sign) => [cx + (x - cx) * c + sign * (y - cy) * sn, cy - sign * (x - cx) * sn + (y - cy) * c];
  const local = polygon.map((point) => turn(point, 1));
  const lines = [];
  const ys = local.map((p) => p[1]);
  let flip = false;
  for (let offset = Math.min(...ys) + spacing / 2; offset < Math.max(...ys); offset += spacing) {
    const cuts = [];
    for (let i = 0, j = local.length - 1; i < local.length; j = i++) {
      const a = local[j], b = local[i];
      if ((a[1] - offset) * (b[1] - offset) < 0) cuts.push(a[0] + ((b[0] - a[0]) * (offset - a[1])) / (b[1] - a[1]));
    }
    cuts.sort((m, n) => m - n);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      if (cuts[i + 1] - cuts[i] < 1) continue;
      const p0 = turn([cuts[i] + 0.6, offset], -1), p1 = turn([cuts[i + 1] - 0.6, offset], -1);
      lines.push(flip ? { a: p1, b: p0, half } : { a: p0, b: p1, half });
      flip = !flip;
    }
  }
  return lines;
}

export function trackPath(a, b, half, z, P) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * half, ny = (dx / length) * half;
  return onTop([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], z, P, true);
}

export function buildWell(P, hb, tracks, pores, flash, fused) {
  const zp = C.bed - hb;
  const plate = insetPlan(C.well, 2);
  const out = [];
  const platformTop = zp - C.plateT - C.heaterT;
  out.push(solidSvg(cylinder(C.rod[0], C.rod[1], 9, C.floor, Math.max(1, platformTop - C.platformT - C.floor), P, 28), { tone: "mid" }));
  out.push(solidSvg(cylinder(C.rod[0], C.rod[1], 20, C.floor, 6, P, 36), { tone: "mid" }));
  out.push(solidSvg(slabOf(plate, platformTop - C.platformT, C.platformT, P, 3, 0.6), { tone: "mid" }));
  out.push(solidSvg(slabOf(insetPlan(plate, 4), platformTop, C.heaterT, P, 3, 0.4), { tone: "mid", inner: lineSvg(sideSeam(insetPlan(plate, 4), platformTop + C.heaterT / 2, P, 3), { tone: "faint" }) }));
  out.push(solidSvg(slabOf(plate, zp - C.plateT, C.plateT, P, 3, 0.8), { tone: "hi" }));
  out.push(dotsSvg(corners(plate, 9).map((point) => iso([point[0], point[1], zp], P)), { size: 0.55, tone: "mid" }));
  if (hb > 0.01) {
    for (let z = 0; z < fused - 0.01; z += C.slice) {
      const top = Math.min(fused, z + C.slice);
      out.push(solidSvg(extrude(section((z + top) / 2), zp + z, top - z, P, { convex: false }), { tone: "hi", lit: true, crease: "faint" }));
    }
    for (const pore of pores) {
      if (pore.z > zp + fused - 0.5) continue;
      const [x, y] = iso([pore.x, pore.y, pore.z], P);
      out.push(`<circle class="m-pore" data-kind="${pore.kind}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${pore.r.toFixed(2)}"/>`);
    }
    out.push(`<g class="m-powder">${solidSvg(slabOf(C.well, zp, hb, P, 3), { tone: "lo", crease: "faint" })}</g>`);
  }
  out.push(dotsSvg(speckles(C.well, C.bed, 70, 7).map((point) => iso(point, P)), { size: 0.45, tone: "faint" }));
  for (const track of tracks) out.push(`<path class="m-track" d="${trackPath(track.a, track.b, track.half, C.bed, P)}"/>`);
  if (flash) out.push(`<path class="m-hot" d="${trackPath(flash.a, flash.b, flash.half, C.bed, P)}"/>`);
  return out.join("");
}

export function dispenser(P, stock) {
  const zd = C.bed - stock;
  const plan = insetPlan(C.disp, 2);
  const out = [];
  out.push(solidSvg(cylinder(C.drod[0], C.drod[1], 8, C.floor, Math.max(1, zd - C.platformT - C.floor), P, 28), { tone: "mid" }));
  out.push(solidSvg(cylinder(C.drod[0], C.drod[1], 18, C.floor, 6, P, 36), { tone: "mid" }));
  out.push(solidSvg(slabOf(plan, zd - C.platformT, C.platformT, P, 3, 0.6), { tone: "mid" }));
  out.push(`<g class="m-powder">${solidSvg(slabOf(C.disp, zd, stock, P, 3), { tone: "lo", crease: "faint" })}</g>`);
  out.push(dotsSvg(speckles(C.disp, C.bed, 46, 3).map((point) => iso(point, P)), { size: 0.45, tone: "faint" }));
  return out.join("");
}

export function collector(P, fill) {
  return solidSvg(slabOf(insetPlan(C.coll, 2), C.floor + 10, fill, P, 3), { tone: "lo", crease: "faint" }) + dotsSvg(speckles(insetPlan(C.coll, 2), C.floor + 10 + fill, 18, 11).map((point) => iso(point, P)), { size: 0.45, tone: "faint" });
}

export function beam(P, spot, on, pool, ke) {
  if (!on) return "";
  const from = iso(C.lens, P);
  const to = iso([spot[0], spot[1], C.bed], P);
  const out = [];
  out.push(`<path class="m-cone" d="M${(from[0] - 3).toFixed(1)} ${from[1].toFixed(1)}L${(from[0] + 3).toFixed(1)} ${from[1].toFixed(1)}L${to[0].toFixed(1)} ${to[1].toFixed(1)}Z"/>`);
  out.push(lineSvg(segment(C.lens, [spot[0], spot[1], C.bed], P), { tone: "lit" }));
  out.push(dotsSvg([from], { size: 0.8, tone: "hi" }));
  out.push(`<circle class="m-glow" cx="${to[0].toFixed(1)}" cy="${to[1].toFixed(1)}" r="${(2.2 + pool / 40).toFixed(2)}"/>`);
  out.push(`<circle class="m-pool" cx="${to[0].toFixed(1)}" cy="${to[1].toFixed(1)}" r="${(0.9 + pool / 120).toFixed(2)}"/>`);
  const sparks = Math.round(Math.max(0, ke - 0.7) * 5);
  for (let i = 0; i < sparks; i++) {
    const angle = (i / Math.max(1, sparks)) * Math.PI * 2 + spot[0] * 0.37 + spot[1] * 0.11;
    const reach = 5 + ((i * 7) % 9);
    const lift = 4 + ((i * 5) % 11);
    const [x, y] = iso([spot[0] + Math.cos(angle) * reach, spot[1] + Math.sin(angle) * reach, C.bed + lift], P);
    out.push(`<circle class="m-spark" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.7"/>`);
  }
  return out.join("");
}

export function recoater(P) {
  const y = 0;
  const out = [];
  out.push(solidSvg(slabOf({ x: 276, y: y - 22, w: 36, d: 44, r: 2 }, 232, 30, P, 3, 0.8), { tone: "mid" }));
  out.push(dotsSvg([[282, y - 16], [306, y - 16], [306, y + 16], [282, y + 16]].map(([x, yy]) => iso([x, yy, 262], P)), { size: 0.5, tone: "mid" }));
  out.push(solidSvg(slabOf({ x: 312, y: y - 7, w: 254, d: 14, r: 1 }, 244, 14, P, 3, 0.6), { tone: "mid" }));
  out.push(dotsSvg([330, 400, 470, 540].map((x) => iso([x, y, 258], P)), { size: 0.45, tone: "lo" }));
  out.push(solidSvg(slabOf({ x: 318, y: y - 4, w: 248, d: 8, r: 0.6 }, 228, 16, P, 3), { tone: "mid" }));
  out.push(solidSvg(slabOf({ x: 320, y: y - 1.2, w: 244, d: 2.4, r: 0.3 }, 220.4, 7.6, P, 2), { tone: "hi", crease: "none" }));
  out.push(solidSvg(cylinder(294, y, 7, 262, 8, P, 24), { tone: "mid" }));
  out.push(lineSvg(knurl(294, y, 7, 262, 270, 22, P), { tone: "lo" }));
  return out.join("");
}

export const HEAD = { exit: [360, 250, 604], splitter: [360, 274, 604], mirrorX: [360, 338, 604], mirrorY: [442, 395, 604], lensTop: [445, 395, 590], floor: 562, aimX: 1.089, gain: 0.006 };

export function mirrorAngles(spot) {
  const at = spot || C.centre;
  return [HEAD.aimX + HEAD.gain * (at[0] - C.centre[0]), (3 * Math.PI) / 4 + 2 * HEAD.gain * (at[1] - C.centre[1])];
}

export function quad(points, P, kind) {
  return `<path class="m-mirror" data-kind="${kind}" d="${pathOf(points.map((point) => iso(point, P)), true)}"/>`;
}

export function scanHead(P, spot, on, parts) {
  const [ax, ay] = mirrorAngles(spot);
  const mx = HEAD.mirrorX, my = HEAD.mirrorY;
  const out = [parts.galvoX];
  const dx = Math.cos(ax) * 12, dy = Math.sin(ax) * 12;
  out.push(quad([[mx[0] - dx, mx[1] - dy, mx[2] - 8], [mx[0] + dx, mx[1] + dy, mx[2] - 8], [mx[0] + dx, mx[1] + dy, mx[2] + 8], [mx[0] - dx, mx[1] - dy, mx[2] + 8]], P, "x"));
  out.push(parts.galvoY, parts.ftheta);
  const ty = Math.cos(ay) * 12, tz = Math.sin(ay) * 12;
  out.push(quad([[my[0] - 10, my[1] - ty, my[2] - tz], [my[0] + 10, my[1] - ty, my[2] - tz], [my[0] + 10, my[1] + ty, my[2] + tz], [my[0] - 10, my[1] + ty, my[2] + tz]], P, "y"));
  if (on && spot) {
    const route = [HEAD.exit, HEAD.splitter, mx, my, [my[0], my[1], HEAD.lensTop[2]]];
    out.push(lineSvg(pathOf(route.map((point) => iso(point, P))), { tone: "lit" }));
    out.push(dotsSvg(route.map((point) => iso(point, P)), { size: 0.85, tone: "hi" }));
  }
  return out.join("");
}

export const LIVE_FUNCTIONS = [speckles, section, inside, hatch, trackPath, buildWell, dispenser, collector, beam, mirrorAngles, quad, scanHead];
