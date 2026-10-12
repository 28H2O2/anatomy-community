// Fig 2: dragging a block up a construction ramp, as at Ollantaytambo. The static ramp and the shared, animated hauling parts.
// World units are 10 cm (the scene is about 1:100). The ramp climbs towards -x at RAMP_DEG, away
// from the viewer, who sees its valley side (a fieldstone retaining wall, +y) and its foot (+x).

const DEG = Math.PI / 180;

export function rampFigure(k, G, M) {
  const SLOPE = M.RAMP_DEG * DEG;
  const [COS, SIN, TAN] = [Math.cos(SLOPE), Math.sin(SLOPE), Math.tan(SLOPE)];
  const WIDTH = 460; // fitted to the scene, which is about 1.5 times as wide as it is tall
  const HEIGHT = 330;
  const RAMP = { x0: 0, x1: 190, w: 60, z0: 3 }; // a 6 m wide ramp, 19 m of it, 30 cm high at its foot
  const zs = (x) => RAMP.z0 + (RAMP.x1 - x) * TAN; // the ramp's surface, highest at x0
  const PLATE = { x: -14, y: -12, w: 228, d: 98, r: 8 };
  const PLATE_H = 8;
  const FOOT_H = 4;
  // The block: 2.0 × 1.4 × 1.35 m of granite, about 10 t, its back end 1 m up from the ramp's foot.
  const BLOCK = { x: 180, len: 20, y0: 23, y1: 37, h: 13.5 };
  const BLOCK_KG = 10000;
  const PULL = M.dragOf(BLOCK_KG, M.RAMP_DEG);
  const CREW = 220;
  const PER_FIGURE = 10;
  const FIGURES = Math.round(CREW / PER_FIGURE);

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RAMP.x0, 0, zs(RAMP.x0)], [55, 12, zs(55) + 19], [118, 48, zs(118) + 19]],
    WIDTH,
    HEIGHT,
    { pad: 14, azimuth: 40 },
  );
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const depth = (p) => k.depthOf(p, P);
  const poly = (points) => k.pathOf(points.map(at), true);
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // The bench plate, as in Fig 1: feet, seam, screws, a ruler (50 cm minor, 1 m major) and a label.
  function plate() {
    const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
    const feet = k.corners(PLATE, 18).sort((a, b) => depth([...a, 0]) - depth([...b, 0]));
    for (const [x, y] of feet) {
      out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 4.6, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "lo" }));
    const screws = k.corners(PLATE, 8);
    out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
    const strip = { x: 0, y: PLATE.y + PLATE.d - 11, w: 190, d: 5.5, r: 0.8 };
    out.push(S(k.slabOf(strip, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(strip.x + 5, strip.x + 185, 5, 2, strip.y, 0.5, [1.6, 3], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(D([at([strip.x + 2, strip.y + 2.75, 0.5]), at([strip.x + strip.w - 2, strip.y + 2.75, 0.5])], { size: 0.4 }));
    const label = { x: 198, y: 4, w: 8, d: 52, r: 1 };
    out.push(S(k.slabOf(label, 0, 0.7, P, 4), { tone: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(label, 1.2), 0.7, P, 4), { tone: "faint" }));
    out.push(k.faceTextSvg(k.topMatrix([label.x + 5.4, label.y + 26], 0.7, P, "y"), "Ollantaytambo", { size: 2.6, tone: "lo", anchor: "middle" }));
    out.push(D([at([label.x + 4, label.y + 3, 0.7]), at([label.x + 4, label.y + label.d - 3, 0.7])], { size: 0.35 }));
    return out.join("");
  }

  // Rough stones laid in rows on a face, as polygons; uv maps (u, v) on the face to the world.
  function stones(uv, [u0, u1], [v0, v1], { rows = [4, 6.5], widths = [6, 11] } = {}) {
    const out = [];
    let row = 0;
    for (let v = v0 + 0.3; v < v1; row++) {
      const h = rows[0] + rnd() * (rows[1] - rows[0]);
      let u = u0 + 0.3 - (row % 2) * 3;
      while (u < u1) {
        const w = widths[0] + rnd() * (widths[1] - widths[0]);
        const ua = Math.max(u0 + 0.3, u), ub = Math.min(u1 - 0.3, u + w);
        if (ub - ua > 2) {
          const cu = (ua + ub) / 2, cv = v + h / 2, hu = (ub - ua) / 2, hv = h / 2;
          const n = 5 + Math.floor(rnd() * 3);
          out.push(
            poly(
              Array.from({ length: n }, (_, i) => {
                const a = ((i + rnd() * 0.6) / n) * Math.PI * 2;
                const c = Math.cos(a), sn = Math.sin(a);
                const f = 1 / Math.max(Math.abs(c), Math.abs(sn));
                const m = 0.84 + rnd() * 0.16;
                return uv(cu + c * f * hu * m, cv + sn * f * hv * m);
              }),
            ),
          );
        }
        u += w + 0.5;
      }
      v += h + 0.5;
    }
    return out.join("");
  }

  // The ramp: earth fill behind a fieldstone retaining wall on the valley side, packed gravel on top.
  const along = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  function ramp() {
    const out = [];
    const section = [[RAMP.x0, 0], [RAMP.x1, 0], [RAMP.x1, zs(RAMP.x1)], [RAMP.x0, zs(RAMP.x0)]];
    out.push(S(G.prismOf(along, section, 0, RAMP.w, P), { tone: "lo", crease: "lo" }));
    // The retaining wall's stones, clipped to the sloping face.
    const face = poly([[RAMP.x0, RAMP.w, 0], [RAMP.x1, RAMP.w, 0], [RAMP.x1, RAMP.w, zs(RAMP.x1)], [RAMP.x0, RAMP.w, zs(RAMP.x0)]]);
    out.push(`<clipPath id="ramp-wall"><path d="${face}"/></clipPath><g clip-path="url(#ramp-wall)"><path class="mp-stone" d="${stones((u, v) => [u, RAMP.w, v], [RAMP.x0, RAMP.x1], [0, zs(RAMP.x0)])}"/></g>`);
    // Packed gravel on the running surface, and the curb along the valley edge.
    const grit = [];
    for (let x = RAMP.x0 + 1.6; x < RAMP.x1 - 1; x += 3.4) for (let y = 1.4; y < RAMP.w - 4; y += 3.4) grit.push(at([x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2, zs(x) + 0.05]));
    out.push(D(grit, { size: 0.32, tone: "faint" }));
    const curb = [];
    for (let x = RAMP.x0; x < RAMP.x1 - 0.1; ) {
      const w = Math.min(7 + rnd() * 4, RAMP.x1 - x);
      const sec = [[x + 0.15, zs(x + 0.15)], [x + w - 0.15, zs(x + w - 0.15)], [x + w - 0.15, zs(x + w - 0.15) + 1.6], [x + 0.15, zs(x + 0.15) + 1.6]];
      curb.push(S(G.prismOf(along, sec, RAMP.w - 3, RAMP.w, P), { tone: "mid", crease: "lo" }));
      x += w;
    }
    out.push(curb.join(""));
    // Polish and scratches where earlier blocks were dragged up the middle.
    const marks = [26, 34].map((y) => k.fadeLineSvg([[130, y, zs(130) + 0.06], [RAMP.x1, y, zs(RAMP.x1) + 0.06]].map(at), { tone: "faint", fade: [0.2, 0.2] })).join("");
    out.push(marks);
    return out.join("");
  }

  const parts = makeRampParts(k, G, M, P);
  const body = [plate(), `<g data-part="ramp">${ramp()}</g>`,
    `<g data-ramp-moving>${parts.scene(BLOCK_KG, CREW, 0, 0)}</g>`];
  return { body, WIDTH, HEIGHT, P, numbers: { kg: BLOCK_KG, kn: PULL / 1000, crew: CREW, figures: FIGURES, per: PER_FIGURE, deg: M.RAMP_DEG } };
}

// Called by the build and the browser. The ramp is static; these shapes change only with pose.
export function makeRampParts(k, G, M, P) {
  const DEG = Math.PI / 180;
  const SLOPE = M.RAMP_DEG * DEG;
  const COS = Math.cos(SLOPE), SIN = Math.sin(SLOPE), TAN = Math.tan(SLOPE);
  const zs = (x) => 3 + (190 - x) * TAN;
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const depth = (p) => k.depthOf(p, P);
  const poly = (points) => k.pathOf(points.map(at), true);
  // Dimensions grow with the cube root of mass at constant granite density.
  function pose(kg, crew, pull, step) {
    const size = Math.cbrt(kg / 10000);
    const BLOCK = { x: 180, len: 20 * size, y0: 30 - 7 * size, y1: 30 + 7 * size, h: 13.5 * size };
    const LASH = BLOCK.len - 3 * size;
    const HAND = 8.6;
    const LANES = [12, 30, 48];
    const perFigure = M.rampPerFigure(kg);
    const FIGURES = Math.ceil(crew / perFigure);
    // The block, tilted with the ramp, rough-hewn, with a boss left on its valley face. u runs uphill
    // from its back end, v up from the ramp.
    const blockFrame = G.frameOf([BLOCK.x, BLOCK.y0, zs(BLOCK.x)], [0, 1, 0], [-COS, 0, SIN], [SIN, 0, COS]);
    const onBlock = (u, v, y) => [BLOCK.x - u * COS + v * SIN, y, zs(BLOCK.x) + u * SIN + v * COS];
    function block() {
      const { len, h } = BLOCK;
      const ring = [[0.6, 0], [len - 0.8, 0.1], [len, 1.2], [len + 0.4, h * 0.55], [len - 0.6, h], [len * 0.55, h + 0.5], [0.8, h - 0.2], [-0.3, h * 0.45]];
      const out = [`<path class="iso-halo" d="${poly([onBlock(-1, 0.05, BLOCK.y0 - 1), onBlock(len + 1, 0.05, BLOCK.y0 - 1), onBlock(len + 1, 0.05, BLOCK.y1 + 1), onBlock(-1, 0.05, BLOCK.y1 + 1)])}" style="filter:blur(2px)"/>`];
      out.push(S(G.prismOf(blockFrame, ring, 0, BLOCK.y1 - BLOCK.y0, P), { tone: "hi", lit: true }));
      const boss = [[5, 3.4], [7.6, 3.4], [7.6, 6], [5, 6]].map(([u, v]) => [u * size, v * size]);
      out.push(S(G.prismOf(blockFrame, boss, BLOCK.y1 - BLOCK.y0, BLOCK.y1 - BLOCK.y0 + 1.4 * size, P), { tone: "hi", lit: true }));
      // A rope lashed round it near its uphill end: over the top and down the valley face.
      const u = LASH;
      const lash = [onBlock(u, h + 0.35, BLOCK.y0 + 0.4), onBlock(u, h + 0.35, BLOCK.y1 - 0.3), onBlock(u, h - 0.4, BLOCK.y1 + 0.05), onBlock(u, 0.4, BLOCK.y1 + 0.05)];
      out.push(L(k.pathOf(lash.map(at)), { tone: "mid", className: "mp-rope" }));
      return out.join("");
    }

    // A hauler: a plain mannequin in a stride, facing uphill (-x) and leaning into the rope. Hands at
    // the rope, given in world.
    function person(x, y, { lean = 12 + 22 * pull, hands = null, shade = true, stride = step } = {}) {
      const g = zs(x);
      const fwd = [-Math.sin(lean * DEG), 0, Math.cos(lean * DEG)];
      const hip = [x + 0.6, y, g + 8.4];
      const neck = G.add3(hip, G.mul3(fwd, 6.6));
      const head = G.add3(neck, G.mul3(fwd, 2.1));
      const limb = (a, b, r, tone) => S(G.disc(0, G.len3(G.sub3(b, a)), r, G.frameAlong(a, G.sub3(b, a)), P), { tone, crease: "none" });
      const feet = [[x + 2.4 + 1.3 * stride, y - 0.9], [x - 2.4 - 1.3 * stride, y + 0.9]].map(([fx, fy]) => [fx, fy, zs(fx) + 0.4]);
      const hand = hands || [G.add3(neck, [-1.5, 0, -5])];
      const shoulders = [-1.3, 1.3].map((dy) => G.add3(neck, [0.3, dy, -0.6]));
      const parts = [];
      if (shade) parts.push([-1e9, `<path class="iso-halo" d="${k.cylinder(x, y, 3.2, g, 0.1, P, 16).fill}" style="filter:blur(1.5px)"/>`]);
      feet.forEach((f, i) => {
        const knee = G.lerp3(f, hip, 0.5);
        knee[0] -= 0.8 + (i ? 0 : stride);
        parts.push([depth(f), limb(f, knee, 0.7, "lo") + limb(knee, hip, 0.8, "lo")]);
      });
      parts.push([depth(G.lerp3(hip, neck, 0.5)), limb(hip, neck, 1.75, "mid")]);
      shoulders.forEach((s, i) => parts.push([depth(s) + (i ? 0.01 : -0.01), limb(s, hand[Math.min(i, hand.length - 1)], 0.55, "mid")]));
      parts.push([depth(head), S(G.sphereOf(head, 1.4, P), { tone: "mid" })]);
      return parts.sort((a, b) => a[0] - b[0]).map((p) => p[1]).join("");
    }

    // Ropes run from the lashing, over the block's uphill edge, to three teams at hand height.
    const tie = (y) => onBlock(BLOCK.len - 0.6, BLOCK.h + 0.35, y);
    function lane(yRope, count, start, laneIndex) {
      if (!count) return "";
      const items = [];
      const xs = Array.from({ length: count }, (_, i) => start - i * 7);
      const by = 30 + (yRope - 30) * 0.25 * size;
      const from = tie(by);
      const knot = onBlock(LASH, BLOCK.h + 0.35, by);
      const end = xs[xs.length - 1] - 3;
      // A slack rope sags in world space. Every grip lies on this same rope curve.
      const begin = xs[0] + 5;
      const ropeAt = (x) => {
        const f = (begin - x) / (begin - end);
        return [x, yRope, zs(x) + HAND - (1 - pull) * 2.1 * Math.sin(Math.PI * f)];
      };
      const rope = [knot, from, ...Array.from({ length: 25 }, (_, i) => ropeAt(begin + (end - begin) * i / 24))];
      xs.forEach((x, i) => {
        const side = i % 2 ? 1 : -1;
        const y = yRope + side * 2.6;
        const grip = [ropeAt(x - 1.2), ropeAt(x - 2.6)];
        const index = i * 3 + laneIndex;
        const people = Math.min(perFigure, Math.max(0, crew - index * perFigure));
        // Final partial figure is explicitly counted in the legend and its accessible description.
        items.push({ near: side > 0, d: depth([x, y, zs(x)]), svg: `<g data-hauler data-people="${people}" opacity="${people / perFigure < 1 ? 0.6 : 1}">${person(x, y, { hands: grip })}</g>` });
      });
      const far = items.filter((it) => !it.near).sort((a, b) => a.d - b.d).map((it) => it.svg).join("");
      const near = items.filter((it) => it.near).sort((a, b) => a.d - b.d).map((it) => it.svg).join("");
      return far + L(k.pathOf(rope.map(at)), { tone: "mid", className: "mp-rope" }) + near;
    }

    // Two men behind with long levers under the block's back edge, prying it on.
    function levers() {
      return [27, 33]
        .map((y) => {
          const tip = onBlock(0.4, 0.4, y);
          const top = [BLOCK.x + 13, y, zs(BLOCK.x + 13) + 11 - 3 * pull];
          const pole = S(G.disc(0, G.len3(G.sub3(tip, top)), 0.75, G.frameAlong(top, G.sub3(tip, top)), P), { tone: "mid", crease: "none" });
          return person(BLOCK.x + 17, y, { lean: 16 + 16 * pull, hands: [top, G.lerp3(top, tip, 0.12)], stride: 0 }) + pole;
        })
        .join("");
    }

    // Paint the farther lane before the nearer lanes; every rope is between its far and near hands.
    const counts = LANES.map((_, i) => Math.floor(FIGURES / 3) + (i < FIGURES % 3 ? 1 : 0));
    const start = BLOCK.x - BLOCK.len * COS - 12;
    return { levers: levers(), block: block(), crew: LANES.map((y, i) => lane(y, counts[i], start - i * 3, i)).join("") };
  }
  return { pose, scene: (...args) => {
    const art = pose(...args);
    return `<g data-ramp-levers>${art.levers}</g><g data-ramp-block>${art.block}</g><g data-ramp-crew>${art.crew}</g>`;
  } };
}
