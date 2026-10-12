const D = __DATA__;
const P = D.P;
const KIT = { iso, pathOf, solidSvg, lineSvg, dotsSvg, fadedSvg, translateAlong };
const MV = makeMoving(KIT, G, P, M, { pinZ, camPolygon, camAngle, lift });
const svg = document.querySelector(".iso-stage svg");
const $ = (s) => svg.querySelector(s);
const el = {
  back: { crank: $('[data-m="crank-back"]'), piston: $('[data-m="piston-back"]'), cam: $('[data-m="cam-back"]') },
  front: { crank: $('[data-m="crank-front"]'), piston: $('[data-m="piston-front"]'), cam: $('[data-m="cam-front"]') },
  valve: {}, follower: {}, spring: {},
  fly: $('[data-part="flywheel"]'), drive: $('[data-part="drive"]'), gas: $('[data-part="gas"]'),
  flowIn: $('[data-part="flow-in"]'), flowEx: $('[data-part="flow-ex"]'), puffs: $('[data-part="puffs"]'),
  cap: $('[data-part="raincap"]'), spark: $('[data-part="spark"]'),
};
for (const w of ["in", "ex"]) for (const pass of ["back", "front"]) {
  el.valve[w + pass] = $(`[data-m="valve-${w}-${pass}"]`);
  el.follower[w + pass] = $(`[data-m="follower-${w}-${pass}"]`);
  el.spring[w + pass] = $(`[data-m="spring-${w}-${pass}"]`);
}
const readout = document.querySelector("[data-readout]");
const fix = (s, pass) => s.replaceAll('id="cl-', `id="cl${pass}-`).replaceAll("url(#cl-", `url(#cl${pass}-`);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const f1 = (v) => Math.round(v * 10) / 10;
const at = (p) => iso(p, P);

// crop the viewBox to the drawing (its own bbox, padded), so it fills its frame
{
  const b = svg.getBBox();
  const pad = MODE === "short" ? 6 : 14;
  D.W = b.width + 2 * pad; D.H = b.height + 2 * pad;
  svg.setAttribute("viewBox", `${(b.x - pad).toFixed(1)} ${(b.y - pad).toFixed(1)} ${D.W.toFixed(1)} ${D.H.toFixed(1)}`);
}
// short page: size the figure (88% of the width, top 22% left free for a title)
if (MODE === "short") {
  const fit = () => {
    const vw = innerWidth, vh = innerHeight;
    let w = vw * 0.9;
    let h = (w * D.H) / D.W;
    const room = vh * 0.775;
    if (h > room) { h = room; w = (h * D.W) / D.H; }
    document.documentElement.style.setProperty("--fw", w + "px");
    document.documentElement.style.setProperty("--ft", Math.max(vh * 0.215, vh * 0.6 - h / 2) + "px");
  };
  fit();
  addEventListener("resize", fit);
}

let lastTheta = null, rpsS = 0, flowPhase = 0; const avg = {};
let glow = 0, sparkAge = 9, lastCycle = null, lastEx = null, puffs = [], capOpen = 0;
function pathPoint(pts, u) {
  const lens = [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); total += l; }
  let s = u * total;
  for (let i = 0; i < lens.length; i++) { if (s <= lens[i]) { const t = s / lens[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; } s -= lens[i]; }
  return pts[pts.length - 1];
}
const portPts = [...D.portIn].reverse(); // from the throttle toward the valve

function render(theta, t, dt) {
  const lifts = { in: lift(theta, "in"), ex: lift(theta, "ex") };
  for (const pass of ["back", "front"]) {
    const w1 = MV.web(theta, -MV.CR.webOut, -MV.CR.webIn, "w1"), pin = MV.crankPinPart(theta), rod = MV.rod(theta), w2 = MV.web(theta, MV.CR.webIn, MV.CR.webOut, "w2");
    el[pass].crank.innerHTML = fix(w1[pass] + pin[pass] + rod[pass] + w2[pass], pass);
    el[pass].piston.setAttribute("transform", translateAlong(P, [0, 0, D.ZC + pinZ(theta)]));
    el[pass].cam.innerHTML = fix(MV.cam(theta)[pass], pass);
    for (const w of ["in", "ex"]) {
      const tr = translateAlong(P, [0, 0, -lifts[w]]);
      el.valve[w + pass].setAttribute("transform", tr);
      el.follower[w + pass].setAttribute("transform", tr);
    }
  }
  for (const w of ["in", "ex"]) { const sp = MV.spring(w, lifts[w]); el.spring[w + "back"].innerHTML = sp.back; el.spring[w + "front"].innerHTML = sp.front; }
  el.drive.innerHTML = MV.drive(theta);
  el.fly.innerHTML = MV.flywheel(theta);

  // ---- speed: above ~1.5 rev/s the per-stroke effects blend into steady, gently pulsing levels (no frame-to-frame flicker) ----
  if (lastTheta !== null && dt > 0) rpsS += ((theta - lastTheta) / 360 / dt - rpsS) * (1 - Math.exp(-dt / 0.2));
  lastTheta = theta;
  const hb = sm(0.8, 2.2, rpsS);
  const lp = (key, v, tau = 0.4) => (avg[key] = avg[key] === undefined || dt <= 0 ? v : avg[key] + (v - avg[key]) * (1 - Math.exp(-dt / tau)));
  const blend = (key, v, gain, cap, tau = 0.4) => { const m = lp(key, v, tau); return v + (Math.min(cap, m * gain) - v) * hb; };
  const pulse = 0.88 + 0.12 * Math.sin(t * Math.PI * 2 * 1.4);
  // ---- the charge ----
  const c = mod(theta, 720);
  const crown = crownZ(theta);
  const vol = D.DECK - crown + 9.5; // mm of column over the crown
  const mistRaw = c >= 700 ? sm(700, 760, c) : c < 220 ? sm(-20, 160, c) : c < 352 ? 1 : 1 - sm(352, 380, c);
  const burnNow = c >= 348 && c < 600 ? sm(348, 366, c) * Math.exp(-Math.max(0, c - 372) / 85) : 0;
  const heatRaw = c >= 350 && c < 640 ? sm(350, 372, c) * (1 - sm(470, 600, c)) : 0;
  const smokeRaw = c >= 360 ? sm(470, 545, c) * (1 - sm(565, 712, c)) : 0;
  glow = Math.max(burnNow, glow * Math.exp(-dt / 0.07));
  const mist = blend("mist", mistRaw, 1.1, 0.55), smoke = blend("smoke", smokeRaw, 1.2, 0.45), heat = blend("heat", heatRaw, 1.2, 0.6, 0.9) * (1 - hb + hb * pulse);
  const glowOut = blend("glow", glow, 2.6, 0.7, 0.9) * (1 - hb + hb * pulse);
  const sparkCycle = Math.floor((theta - M.SPARK) / 720);
  if (lastCycle !== null && sparkCycle !== lastCycle) sparkAge = 0;
  lastCycle = sparkCycle;
  sparkAge += dt;
  const dens = Math.min(1, 80 / vol);
  const top = D.SEAT + 2;
  const col = (x, z) => at([x, 0, z]);
  const box = pathOf([col(-41, crown), col(41, crown), col(41, top), col(-41, top)], true);
  let g = "";
  if (mist > 0.01) g += `<path d="${box}" fill="var(--en-mist)" opacity="${(mist * (0.16 + 0.42 * dens)).toFixed(3)}"/>`;
  if (smoke > 0.01) g += `<path d="${box}" fill="var(--en-smoke)" opacity="${(smoke * (0.12 + 0.25 * dens)).toFixed(3)}"/>`;
  if (glowOut > 0.01) {
    const [cx, cy] = D.chamberC;
    const r = (14 + 46 * Math.min(1, glowOut * 1.4)) * D.K;
    g += `<ellipse cx="${f1(cx)}" cy="${f1(cy + r * 0.2)}" rx="${f1(r * 1.25)}" ry="${f1(r)}" fill="url(#g-burn)" opacity="${Math.min(1, glowOut * 1.15).toFixed(3)}"/>`;
    g += `<path d="${box}" fill="var(--en-burn-mid)" opacity="${(glowOut * 0.3).toFixed(3)}"/>`;
  }
  if (heat > 0.01) g += `<path d="${box}" fill="var(--en-burn-rim)" opacity="${(heat * 0.3).toFixed(3)}"/>`;
  // the gas fills only the bore's back half; fade it in over the crown's cut line so no hard edge shows
  const A0 = col(-40, crown), A1 = col(40, crown);
  let nx = -(A1[1] - A0[1]), ny = A1[0] - A0[0];
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (ny > 0) { nx = -nx; ny = -ny; }
  const mid = col(0, crown), fadeLen = 16 * D.K;
  el.gas.innerHTML = `<linearGradient id="gas-fade" gradientUnits="userSpaceOnUse" x1="${f1(mid[0])}" y1="${f1(mid[1])}" x2="${f1(mid[0] + nx * fadeLen)}" y2="${f1(mid[1] + ny * fadeLen)}"><stop offset="0" stop-color="#fff" stop-opacity="0.15"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="gas-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="5000" height="5000"><path d="${box}" fill="url(#gas-fade)"/></mask><g mask="url(#gas-mask)">${g}</g>`;
  // spark at the electrode, eased (never a pop)
  const sp = sparkAge < 0.4 ? sm(0, 0.03, sparkAge) * Math.exp(-sparkAge / 0.09) : 0;
  el.spark.innerHTML = sp > 0.01 ? `<circle cx="${f1(D.plugTip[0])}" cy="${f1(D.plugTip[1])}" r="${f1(7 * D.K * (0.7 + sp))}" fill="url(#g-spark)" opacity="${sp.toFixed(3)}"/>` : "";

  // ---- intake mist along the port, exhaust out of the bowl ----
  flowPhase += dt * 1.6 * Math.min(rpsS, 0.9);
  const flow = flowPhase;
  let fi = "";
  const oi = blend("oi", lifts.in / M.LIFT, 1.2, 0.6);
  if (oi > 0.01) for (let i = 0; i < 9; i++) {
    const u = mod(i / 9 + flow, 1);
    const [x, y] = pathPoint(portPts, u);
    const a = oi * sm(0, 0.15, u) * (1 - sm(0.85, 1, u));
    fi += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(11 * D.K)}" fill="url(#g-mist)" opacity="${a.toFixed(3)}"/>`;
  }
  el.flowIn.innerHTML = fi;
  let fe = "";
  const oe = blend("oe", lifts.ex / M.LIFT, 1.2, 0.6);
  if (oe > 0.01) for (let i = 0; i < 5; i++) {
    const u = mod(i / 5 + flow, 1);
    const x = D.bowl[0][0] + (D.bowl[1][0] - D.bowl[0][0]) * u, y = D.bowl[0][1] + (D.bowl[1][1] - D.bowl[0][1]) * u;
    fe += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1((10 - 4 * u) * D.K)}" fill="url(#g-smoke)" opacity="${(oe * (1 - u) * 0.9).toFixed(3)}"/>`;
  }
  el.flowEx.innerHTML = fe;

  // ---- stack: a puff per exhaust stroke, and the rain cap lifts with the flow ----
  const exCycle = Math.floor((theta - 560) / 720);
  if (lastEx !== null && exCycle !== lastEx) puffs.push({ born: t, seed: exCycle });
  lastEx = exCycle;
  puffs = puffs.filter((p) => t - p.born < 2.2);
  let pu = "";
  for (const p of puffs) {
    const age = t - p.born;
    const rise = 34 * Math.sqrt(age) + 10 * age;
    const drift = 9 * age + 3 * Math.sin(p.seed * 1.7);
    const r = (8 + 16 * Math.sqrt(age)) * D.K;
    const a = sm(0, 0.12, age) * (1 - sm(0.3, 2.2, age)) * 0.75;
    const [x, y] = D.stackTop;
    pu += `<circle cx="${f1(x + drift * D.K)}" cy="${f1(y - rise * D.K)}" r="${f1(r)}" fill="url(#g-smoke)" opacity="${a.toFixed(3)}"/>`;
  }
  el.puffs.innerHTML = pu;
  capOpen = Math.max(oe, capOpen * Math.exp(-dt / 0.12));
  const h = at(D.hinge);
  el.cap.setAttribute("transform", `rotate(${f1(-capOpen * 28)} ${f1(h[0])} ${f1(h[1])})`);
  return { c, lifts };
}

const STROKE = ["intake", "compression", "power", "exhaust"];
if (MODE === "short") {
  window.__events = eventsOf(TOUR.length);
  const t0 = performance.now();
  let last = t0;
  const tick = (now) => {
    const t = Math.min(TOUR.length, (now - t0) / 1000);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    render(crankAt(t), t, dt);
    requestAnimationFrame(tick);
  };
  render(crankAt(0), 0, 0);
  requestAnimationFrame(tick);
} else {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let theta = THETA0, rps = 0.3, target = 0.3, last = 0, frame = 0, visible = false, clock = 0;
  const stage = document.querySelector(".iso-stage");
  const tick = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    clock += dt;
    rps += (target - rps) * (1 - Math.exp(-dt / 0.6));
    theta += rps * 360 * dt;
    const { c, lifts } = render(theta, clock, dt);
    const text = `${STROKE[Math.floor(c / 180)]} · ${Math.round(c)}° · ${Math.round(rps * 60)} rpm · valves ${lifts.in.toFixed(1)} / ${lifts.ex.toFixed(1)} mm`;
    if (readout && readout.textContent !== text) readout.textContent = text;
    frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
  };
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; run(); }).observe(stage);
  stage.addEventListener("pointermove", (e) => { const b = svg.getBoundingClientRect(); const s = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)); target = 0.15 * Math.pow(40, s); });
  stage.addEventListener("pointerleave", () => { target = 0.3; });
  render(theta, 0, 0);
}
