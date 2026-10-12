// The parts whose shape changes while the figure runs: the seat cut into the stone below the block (it is
// pounded flatter each pass), the lever pole (it tilts), the contact marks and the hauling rope. Used by
// build.mjs and, inlined, by the page.

export const GEO = {
  XL: -50, // left end of the terrace
  XC: 120, // the cut
  TERRACE: 62, // top of the upper terrace
  WALL: { front: -30, back: -56 },
  C1: [62, 80], // temple wall, course 1
  C2: [80, 96], // course 2, being laid
  BLOCK: { x0: 6, x1: 38, y0: -55, y1: -31 },
  SEAT: { x0: -2, x1: 48 }, // the course-1 stone the block is fitted onto
  NUB: { x: 19.5, w: 5, d: 3.5, z0: 9, z1: 13 }, // lifting boss on the block's face, z from the bed
  POLE: { x: 22, pivot: [-16, 86.6], r: 2.4, tip: 13.5, tail: 1, long: 54 },
  SPARE: { x: -46, y: -22, w: 22, d: 14, r: 1.6, h: 12 }, // the spare stone on the terrace
  ROPE_X: -34.6, // where the rope is lashed round it, between its bosses
};

export function makeParts(k, G, P) {
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const { BLOCK, NUB, POLE, C2 } = GEO;
  const along = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);

  const XM = (BLOCK.x0 + BLOCK.x1) / 2;
  const HALF = (BLOCK.x1 - BLOCK.x0) / 2;
  const TOP = C2[0] - 0.1; // top of the course below, as the other stones are drawn

  // How far the seat stands above the course top at x: a shallow hump g high in the middle of the
  // block's footprint, down to nothing at its ends. The block is flat, so the gap is g·t².
  const humpOf = (x, g) => {
    const t = (x - XM) / HALF;
    return Math.abs(t) >= 1 ? 0 : (g + 0.1) * (1 - t * t);
  };

  // The block is the template and never changes: flat bed, chamfered corners.
  function block() {
    const [x0, x1, zb, zt, c] = [BLOCK.x0 + 0.12, BLOCK.x1, C2[0], C2[1], 1.1];
    const ring = [[x0 + c, zb], [x1 - c, zb], [x1, zb + c], [x1, zt - c], [x1 - c, zt], [x0 + c, zt], [x0, zt - c], [x0, zb + c]];
    const paths = G.prismOf(along, ring, BLOCK.y0, BLOCK.y1, P);
    const inset = [[x0 + 1.6, zb + 1.6], [x1 - 1.6, zb + 1.6], [x1 - 1.6, zt - 1.6], [x0 + 1.6, zt - 1.6]];
    const pillow = k.pathOf(inset.map(([x, z]) => k.iso([x, BLOCK.y1, z], P)), true);
    return S(paths, { tone: "hi", lit: true, inner: Ln(pillow, { tone: "faint" }) });
  }

  // The seat: the bedding joint is cut into the top of the stone below. Its high middle is what the
  // lowered block touches, and what the hammerstones pound down until it matches the block.
  function seat(g) {
    const ring = [[BLOCK.x1, TOP], [BLOCK.x0, TOP]];
    for (let i = 1; i < 16; i++) {
      const x = BLOCK.x0 + ((BLOCK.x1 - BLOCK.x0) * i) / 16;
      ring.push([x, TOP + humpOf(x, g)]);
    }
    return S(G.prismOf(along, ring, GEO.WALL.back, GEO.WALL.front, P), { tone: "mid", crease: "lo" });
  }

  // The lifting boss: a stub left proud on the face, the pole's tip bears under it.
  function nub() {
    const plan = { x: NUB.x, y: BLOCK.y1 - 0.4, w: NUB.w, d: NUB.d + 0.4, r: 0.8 };
    return S(k.slabOf(plan, C2[0] + NUB.z0, NUB.z1 - NUB.z0, P, 3, 0.4), { tone: "hi", lit: true });
  }

  // The cylinder's upper rim bears on the boss's underside, slightly inside its front edge.
  // Solve that surface contact, not just the pole centreline. The pole slides over the crib
  // as it tilts, retaining its full length while the contact remains on the boss.
  function poleContact(lift) {
    const y = BLOCK.y1 + NUB.d - 0.5;
    const z = C2[0] + NUB.z0 + lift;
    const reach = POLE.pivot[0] - y;
    const height = z - POLE.pivot[1];
    const phi = Math.atan2(height, reach) - Math.asin(POLE.r / Math.hypot(reach, height));
    const s0 = -(reach + POLE.r * Math.sin(phi)) / Math.cos(phi);
    const s1 = s0 + POLE.tip + POLE.tail + POLE.long;
    return { phi, s0, s1, point: [POLE.x, y, z] };
  }
  function pole(lift) {
    const { phi, s0, s1 } = poleContact(lift);
    const pivot = [POLE.x, POLE.pivot[0], POLE.pivot[1]];
    const F = G.frameAlong(pivot, [0, Math.cos(phi), -Math.sin(phi)]);
    const lash = [s1 - 6, s1 - 4.6, s1 - 3.2].map((s) => G.arcOf(F, s, POLE.r, P)).join("");
    const grain = [s0 + 4, s1 - 9].map((s) => G.arcOf(F, s, POLE.r, P)).join("");
    // A wide invisible stroke along the pole is what the reader grabs.
    const grab = k.pathOf([G.pointOf(F, s0 + 2, 0, 0), G.pointOf(F, s1, 0, 0)].map((p) => k.iso(p, P)));
    return (
      S(G.disc(s0, s1, POLE.r, F, P), { tone: "mid", inner: Ln(grain, { tone: "faint" }) + Ln(lash, { tone: "lo" }) }) +
      `<path class="mp-grab" d="${grab}"/>`
    );
  }

  // Packed dust where the lowered block touched its seat: it spreads as the seat is pounded flat.
  function marks(contact, g) {
    const hw = HALF - 1.5;
    const pts = [];
    for (let x = -hw; x <= hw + 1e-6; x += 2.4) {
      if (Math.abs(x) > contact * hw + 0.6) continue;
      // Near the front of the seat, where it shows under the lifted block.
      for (let y = BLOCK.y1 - 0.6; y >= BLOCK.y1 - 9; y -= 2.1) {
        const xx = XM + x + ((y * 7) % 1.1);
        pts.push(k.iso([xx, y, TOP + humpOf(xx, g) + 0.05], P));
      }
    }
    return k.dotsSvg(pts, { size: 0.55, tone: "hi" });
  }

  // The hauling rope: lashed round the spare stone (dragged s units forward), then over the ground to
  // the hands at end. Left alone (no end) it lies slack in a coil; slack, it bows out to one side;
  // pulled taut, it runs straight. A wide invisible dot at its end is what the reader grabs.
  function rope(s, end, length) {
    const { SPARE, TERRACE, ROPE_X: x } = GEO;
    const top = TERRACE + SPARE.h + 0.05;
    const front = SPARE.y + SPARE.d + 0.05 + s;
    const ground = TERRACE + 0.25;
    const lash = [[x, SPARE.y + s + 1.2, top], [x, front - 1.1, top], [x, front, top - 1.1], [x, front, TERRACE + 0.6]];
    let lead;
    let coil = "";
    let tip;
    if (!end) {
      lead = [[x, front, TERRACE + 0.6], [x + 0.6, front + 2.2, ground], [x - 0.4, front + 6, ground], [x - 4, front + 9.5, ground], [x - 8.6, front + 11, ground]];
      coil = [3.1, 2.3, 1.5].map((r, i) => k.ring(x - 11 + i * 0.25, front + 11.4 - i * 0.2, r, ground + i * 0.35, P, 24)).join("");
      tip = [x - 11, front + 11.4];
    } else {
      const [x0, y0] = [x, front + 0.8];
      const dx = end[0] - x0, dy = end[1] - y0;
      const d = Math.hypot(dx, dy) || 1;
      const bow = Math.sqrt(Math.max(0, length * length - d * d)) * 0.35;
      lead = [[x, front, TERRACE + 0.6]];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const off = bow * Math.sin(Math.PI * t);
        lead.push([x0 + dx * t - (dy / d) * off, y0 + dy * t + (dx / d) * off, ground]);
      }
      coil = k.ring(end[0], end[1], 1.1, ground, P, 16);
      tip = end;
    }
    const at = k.iso([tip[0], tip[1], ground], P);
    return (
      Ln(k.pathOf(lash.map((p) => k.iso(p, P))) + k.pathOf(lead.map((p) => k.iso(p, P))) + coil, { tone: "mid", className: "mp-rope" }) +
      `<path class="mp-grab" data-grab="rope" d="M${at[0].toFixed(2)} ${at[1].toFixed(2)}h.01"/>`
    );
  }

  return { block, seat, nub, pole, poleContact, marks, humpOf, rope };
}
