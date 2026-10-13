
// ---------- page runtime: one simulation drives every moving part, number and plot ----------
const DATA = __DATA__;
const { P, D, VIEWS, WIRES, KS } = DATA;
const K = { iso, pathOf, solidSvg, lineSvg, dotsSvg, coil, slabOf, circleRing };
const ZA = D.ZA;
const $ = (sel, root = document) => root.querySelector(sel) || document.createElement("div"); // missing parts of the page (the gallery figure) get a harmless stand-in
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const svg = $(".sol-svg");
const stage = svg.closest(".iso-stage");
const plate = stage.closest(".iso-plate");
const dyn = (n) => svg.querySelector(`[data-dyn="${n}"]`);
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (u) => u * u * (3 - 2 * u);
const f1 = (v, n = 2) => (Math.abs(v) < 0.5 * 10 ** -n ? 0 : v).toFixed(n);

const MODE_VIEW = { whole: "full", cut: "sol", explode: "explode", flux: "tight", circuit: DATA.GALLERY ? "circuit" : "full", force: "sol", auto: "sol" };
const state = { raw: { ...DEFAULTS, reverse: false }, fault: "none", mode: "cut", speed: 1 / 50, slow: false, playing: !reduce.matches, auto: true, plot: "it" };
let q = resolve(state.raw, state.fault);
let s = newState();
let cycleT = 0;

// ---------- traces for the time plots ----------
const TRACE = { t: [], i: [], x: [], on: [], span: 0.17 };
let traceNext = 0;
function record() {
  if (s.t < traceNext) return;
  traceNext = s.t + 1e-4;
  TRACE.t.push(s.t); TRACE.i.push(s.i); TRACE.x.push(s.x * 1e3); TRACE.on.push(s.on ? 1 : 0);
  while (TRACE.t.length && TRACE.t[0] < s.t - TRACE.span) { TRACE.t.shift(); TRACE.i.shift(); TRACE.x.shift(); TRACE.on.shift(); }
}

// ---------- drawing the moving parts ----------
let lastKey = "";
function drawDynamic(force = false) {
  const cut = svg.dataset.mode !== "whole";
  const gmm = (q.g0 - s.x) * 1e3;
  const xi = innerOf(D, gmm);
  const rest = innerOf(D, q.g0 * 1e3);
  const key = [cut, xi.toFixed(3), rest.toFixed(3), state.raw.face].join();
  if (key === lastKey && !force) return;
  lastKey = key;
  const cone = coneDepth(state.raw.face);
  const pl = plungerSvg(K, G, P, D, xi, { cut, cone });
  const cl = clevisSvg(K, G, P, D, xi);
  const sp = springSvg(K, P, D, D.lip, xi + D.collar[0]);
  dyn("a").innerHTML = `<g data-part="spring" id="p-spring-b">${lineSvg(sp.back, { tone: "lo", className: "spring spring-back" })}</g><g data-part="clevis">${cl.back}</g><g data-part="plunger" id="p-plunger">${pl.body}</g>`;
  let b = "";
  if (cut) {
    const gp = (x, z) => iso([x, 0, ZA + z], P);
    const c = coneDepth(state.raw.face), r = D.rP - 0.15;
    if (c > 0) b += `<path class="gap-void" d="${pathOf([gp(D.pole, r), gp(xi, r), gp(xi + c, 3), gp(xi + c, -3), gp(xi, -r), gp(D.pole, -r), gp(D.pole + c, -3), gp(D.pole + c, 3)], true)}"/>` + poleTipSvg(K, G, P, D, c);
    else b += `<path class="gap-void" d="${pathOf([gp(D.pole + D.washer, -r), gp(xi, -r), gp(xi, r), gp(D.pole + D.washer, r)], true)}"/>`;
    svg.toggleAttribute("data-cone", c > 0);
    b += `<g data-part="plunger">${pl.faces}</g>`;
  }
  dyn("b").innerHTML = b;
  const scr = stopScrewSvg(K, G, P, D, rest + D.clevis[1]);
  dyn("c").innerHTML = `<g data-part="spring">${lineSvg(sp.front, { tone: "hi", className: "spring", free: "start" })}</g><g data-part="clevis">${cl.front}</g><g data-part="screw">${scr.near}</g>`;
  dyn("d").innerHTML = `<g data-part="screw">${scr.far}</g>`;
  dyn("ribbon").innerHTML = `<g data-part="ribbon">${ribbonSvg(K, P, D, xi + D.clevis[1])}</g>`;
  $('[data-part="drum-marks"]', svg).innerHTML = lineSvg(drumMarks(K, P, D, -(rest - xi) / 9, ZA + 4.0), { tone: "lo" });
  drawFringe(xi);
  if (typeof isolated !== "undefined" && isolated && ["plunger", "spring", "clevis", "screw", "ribbon"].includes(isolated)) drawIsolate();
}
// fringing at the working gap: two short arcs either side, scaled by B (illustrative)
function drawFringe(xi) {
  const el = dyn("fringe");
  if (!el) return;
  const x0 = D.pole + D.washer, x1 = xi;
  if (x1 - x0 < 0.4) { el.innerHTML = ""; return; }
  let d = "";
  for (const sign of [1, -1]) {
    const pts = [];
    for (let n = 0; n <= 12; n++) {
      const u = n / 12;
      const r = D.rP - 0.6 + Math.sin(u * Math.PI) * Math.min(1.6, 0.25 + (x1 - x0) * 0.35);
      pts.push(iso([x0 + (x1 - x0) * u, 0, ZA + sign * r], P));
    }
    d += pathOf(pts);
  }
  el.innerHTML = `<path class="flux fringe" d="${d}"/>`;
}

// ---------- overlays per frame ----------
const fluxEls = $$('[data-layer="flux"] [data-i]', svg);
const ampGroups = $$('[data-layer="amps"] [data-into]', svg);
function drawOverlays(realDt) {
  const mode = state.mode;
  const showFlux = mode === "flux" || mode === "cut" && false;
  const B = Math.abs(s.B);
  const dir = state.raw.reverse ? -1 : 1;
  svg.querySelector('[data-layer="flux"]').style.display = mode === "flux" ? "" : "none";
  for (const el of fluxEls) {
    const i = +el.dataset.i;
    const a = clamp((B - i * 0.18) / 0.3, 0, 1);
    el.style.opacity = a.toFixed(3);
    if (el.dataset.dir) el.style.display = +el.dataset.dir === dir ? "" : "none";
  }
  const fr = dyn("fringe").firstChild;
  if (fr) fr.style.opacity = clamp(B / 0.8, 0, 0.7).toFixed(2);
  svg.querySelector('[data-layer="amps"]').style.display = mode === "flux" || mode === "circuit" ? "" : "none";
  const ia = clamp(s.i / Math.max(0.05, steadyCurrent(q)), 0, 1);
  for (const g of ampGroups) {
    g.style.opacity = (0.15 + 0.85 * ia).toFixed(2);
    const into = (g.dataset.into === "1") === (dir === 1);
    g.querySelector('[data-sym="x"]').style.display = into ? "" : "none";
    g.querySelector('[data-sym="o"]').style.display = into ? "none" : "";
  }
  drawCurrent(realDt);
  drawForces();
}

// current-flow dots on the wires (conventional current, illustrative speed), drawn in each wire's own painter slot
const wirePhase = { supplyPos: 0, supplyNeg: 0, coilPos: 0, coilNeg: 0 };
function along(route, spacing, phase, reverse) {
  const seg = [];
  let total = 0;
  for (let n = 1; n < route.length; n++) { const l = Math.hypot(route[n][0] - route[n - 1][0], route[n][1] - route[n - 1][1], route[n][2] - route[n - 1][2]); seg.push(l); total += l; }
  const pts = [];
  for (let d = ((phase % spacing) + spacing) % spacing; d < total; d += spacing) {
    let at = reverse ? total - d : d, n = 0;
    while (n < seg.length - 1 && at > seg[n]) { at -= seg[n]; n++; }
    const u = seg[n] ? at / seg[n] : 0;
    pts.push([0, 1, 2].map((c) => route[n][c] + (route[n + 1][c] - route[n][c]) * u));
  }
  return pts;
}
const curEl = { supply: svg.querySelector('[data-cur="supply"]'), back: svg.querySelector('[data-cur="back"]'), front: svg.querySelector('[data-cur="front"]') };
function drawCurrent(realDt) {
  if (state.mode !== "circuit") { for (const e of Object.values(curEl)) e.innerHTML = ""; svg.removeAttribute("data-flow"); return; }
  const iPull = Math.max(0.05, steadyCurrent(q));
  const coilI = s.i, supplyI = s.on ? s.i * (q.peakHold && !s.seated ? 1 : q.duty) : 0;
  const speed = (i) => (16 * i) / iPull; // mm per real second, for legibility only
  wirePhase.supplyPos += speed(supplyI) * realDt; wirePhase.supplyNeg += speed(supplyI) * realDt;
  wirePhase.coilPos += speed(coilI) * realDt; wirePhase.coilNeg += speed(coilI) * realDt;
  const dot = (p) => { const c = iso(p, P); return `<circle class="amp" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="1.5"/>`; };
  let sup = "", back = "", front = "";
  if (supplyI > 1e-3) sup = [...along(WIRES.supplyPos, 4, wirePhase.supplyPos, false), ...along(WIRES.supplyNeg, 4, wirePhase.supplyNeg, true)].map(dot).join("");
  if (coilI > 1e-3) for (const p of [...along(WIRES.coilPos, 4, wirePhase.coilPos, true), ...along(WIRES.coilNeg, 4, wirePhase.coilNeg, false)]) { if (p[0] < 0) back += dot(p); else front += dot(p); }
  curEl.supply.innerHTML = sup; curEl.back.innerHTML = back; curEl.front.innerHTML = front;
  svg.toggleAttribute("data-flow", coilI > 1e-3);
  svg.toggleAttribute("data-flyback", !s.on && coilI > 1e-3 && q.flyback !== "none");
}

// force arrows on the plunger, in the cut plane above it; length grows with log(1 + F) for legibility
function arrow(x0, z, F, sign, cls, label) {
  if (F < 0.02) return "";
  const len = 5 + 20 * Math.log10(1 + F);
  const x1 = x0 + sign * len;
  const a = iso([x0, 0, z], P), b = iso([x1, 0, z], P);
  const h1 = iso([x1 - sign * 2.6, 0, z + 1.3], P), h2 = iso([x1 - sign * 2.6, 0, z - 1.3], P);
  return `<path class="force ${cls}" d="${pathOf([a, iso([x1 - sign * 2.2, 0, z], P)])}"/><path class="force-head ${cls}" d="${pathOf([b, h1, h2], true)}"/><circle class="force-head ${cls}" cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="1.6"/>`;
}
function drawForces() {
  const el = dyn("over");
  const legend = $(".flegend", stage);
  if (state.mode !== "force") { el.innerHTML = ""; legend.hidden = true; return; }
  legend.hidden = false;
  const xi = innerOf(D, (q.g0 - s.x) * 1e3);
  const x0 = xi + D.clevis[1];
  const Fs = q.Fpre + q.k * s.x;
  const Fn = s.F - Fs - q.Fload;
  // world -x is pull-in; spring and load push the plunger back out (+x)
  el.innerHTML =
    arrow(x0, ZA + 32, s.F, -1, "f-mag", "F mag " + s.F.toFixed(1) + " N") +
    arrow(x0, ZA + 26, Fs, 1, "f-spring", "F spring " + Fs.toFixed(1) + " N") +
    arrow(x0, ZA + 20, q.Fload, 1, "f-load", "F load " + q.Fload.toFixed(1) + " N") +
    arrow(x0, ZA + 38, Math.abs(Fn), Fn > 0 ? -1 : 1, "f-net", "");
  const held = s.seated && Fn > 0 ? " · reacted by the stop washer" : s.x <= 0 && Fn < 0 ? " · reacted by the stop screw" : "";
  const fr = Math.abs(s.fric) > 0.01 ? `<li><i class="sw f-fric"></i>Friction <b>${Math.abs(s.fric).toFixed(2)} N</b> opposes motion</li>` : "";
  const html = `<li><i class="sw f-mag"></i>Magnetic <b>${s.F.toFixed(2)} N</b> toward the pole</li><li><i class="sw f-spring"></i>Spring <b>${Fs.toFixed(2)} N</b> outward</li><li><i class="sw f-load"></i>Load <b>${q.Fload.toFixed(2)} N</b> outward</li>${fr}<li><i class="sw f-net"></i>Net <b>${Fn.toFixed(2)} N</b>${held}</li><li class="fnote">Arrow length grows with log(1 + F) so small and large forces both read.</li>`;
  if (legend.dataset.h !== html) { legend.dataset.h = html; legend.innerHTML = html; }
}

// ---------- camera: eased viewBox, wheel zoom, drag pan ----------
let vb = [...VIEWS[MODE_VIEW[state.mode]]], vbTo = [...vb];
function setView(name) { vbTo = [...VIEWS[name]]; }
function stepView(dt) {
  const a = reduce.matches ? 1 : 1 - Math.exp(-dt / 0.18);
  let moved = false;
  for (let n = 0; n < 4; n++) { const d = vbTo[n] - vb[n]; if (Math.abs(d) > 0.05) { vb[n] += d * a; moved = true; } else vb[n] = vbTo[n]; }
  svg.setAttribute("viewBox", vb.map((v) => v.toFixed(2)).join(" "));
  return moved;
}
function zoomBy(f, cx = 0.5, cy = 0.5) {
  const [x, y, w, h] = vbTo;
  const nw = clamp(w * f, DATA.W / 8, DATA.W * 1.6), nh = (nw * h) / w;
  vbTo = [x + (w - nw) * cx, y + (h - nh) * cy, nw, nh];
}
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
}, { passive: false });
let drag = null;
stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, vb: [...vbTo], id: e.pointerId, moved: false }; });
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    drag.moved = true;
    try { stage.setPointerCapture(drag.id); } catch (err) {}
  }
  const r = svg.getBoundingClientRect();
  const sx = drag.vb[2] / r.width;
  vbTo = [drag.vb[0] - (e.clientX - drag.x) * sx, drag.vb[1] - (e.clientY - drag.y) * sx, drag.vb[2], drag.vb[3]];
  vb = [...vbTo];
});
const endDrag = () => { drag = null; };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// ---------- exploded view ----------
let ex = 0, exTo = 0;
const exEls = DATA.EX.map((it) => ({ ...it, el: svg.querySelector(`[data-ex="${it.name}"]`) }));
function homeOf(name) {
  if (name === "spring") return D.lip;
  if (name === "plunger" || name === "clevis") return innerOf(D, q.g0 * 1e3);
  return 0;
}
const exCache = {};
function exCone() {
  const c = coneDepth(state.raw.face);
  for (const it of exEls) {
    if (!(it.name in exCache)) exCache[it.name] = it.el.innerHTML;
    if (it.name === "plunger") { const pl = plungerSvg(K, G, P, D, it.dx, { cut: true, z: DATA.ZE, from: it.dx - 1, cone: c }); it.el.innerHTML = pl.body + pl.faces; }
    if (it.name === "pole") it.el.innerHTML = exCache.pole + poleTipSvg(K, G, P, D, c, DATA.ZE, it.dx, true);
  }
}
function stepExplode(dt) {
  const target = exTo;
  ex = reduce.matches ? target : ex + (target - ex) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(ex - target) < 0.001) ex = target;
  const n = exEls.length;
  exEls.forEach((it, i) => {
    const u = ease(clamp(ex * 1.7 - (i / n) * 0.7, 0, 1));
    const back = 1 - u;
    it.el.setAttribute("transform", translateAlong(P, [-(it.dx - homeOf(it.name)) * back, 0, -(DATA.ZE - ZA) * back]));
  });
  svg.toggleAttribute("data-exploded", ex > 0.001);
  return ex !== target;
}

// ---------- modes ----------
function setMode(mode, { keepView = false } = {}) {
  if (mode === "auto") { const f2 = $("#fig2"); if (f2) f2.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" }); mode = state.mode === "auto" ? "cut" : state.mode; }
  state.mode = mode;
  svg.dataset.mode = mode === "whole" ? "whole" : "cut";
  svg.dataset.view = mode;
  exTo = mode === "explode" ? 1 : 0;
  if (mode === "explode") { s.on = false; state.auto = false; syncAuto(); }
  $$("button[data-mode]").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === mode ? "true" : "false"));
  if (!keepView) setView(MODE_VIEW[mode]);
  drawDynamic(true);
  schematic();
}
$$("button[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

// ---------- status, readouts, energy chain ----------
const out = (n) => $(`[data-out="${n}"]`);
const rEl = Object.fromEntries($$("[data-r]").map((e) => [e.dataset.r, e]));
function statusOf() {
  const act = actuation(q);
  if (s.on) {
    if (q.open) return ["bad", "Open winding: voltage applied, no current"];
    if (s.seated && q.blocked) return ["bad", "Stopped by an obstruction: gap not closed"];
    if (s.seated) return ["ok", "Seated on the stop washer, energized" + (q.peakHold && q.duty < 1 ? " (holding at " + Math.round(q.duty * 100) + "% PWM)" : "")];
    if (s.v > 1e-4) return ["move", "Pulling in: magnetic force exceeds spring + load + friction"];
    if (!act.ok && s.i > 0.95 * steadyCurrent(q)) return ["bad", "Insufficient electromagnetic force"];
    if (s.stuck && s.x > 1e-6) return ["bad", "Stuck: static friction holds the plunger"];
    return ["rise", "Current rising; spring still holds the plunger"];
  }
  if (s.v < -1e-4) return ["move", "Spring returning the plunger"];
  if (s.i > 1e-4 && s.x > 1e-6) return ["rise", "Current decaying through the flyback path; plunger still held"];
  if (s.i > 1e-4) return ["rise", "Current decaying through the flyback path"];
  if (s.x > 1e-6) return ["bad", "Stuck: friction holds the plunger off its rest stop"];
  return ["rest", "De-energized · at rest"];
}
let lastStatus = "";
function readouts() {
  const [kind, text] = statusOf();
  if (text !== lastStatus) { lastStatus = text; $(".status").dataset.status = kind; out("status").textContent = text; $(".sol-phase").textContent = text; }
  const Fs = q.Fpre + q.k * s.x, Fn = s.F - Fs - q.Fload + s.fric;
  const Pin = s.on ? (q.peakHold && !s.seated ? 1 : q.duty) * q.V * s.i : 0;
  const set = (k, v) => { if (rEl[k] && rEl[k].textContent !== v) rEl[k].textContent = v; };
  set("V", f1(s.Vc, 1) + " V"); set("i", s.i.toFixed(3) + " A"); set("P", f1(Pin, 1) + " W");
  set("B", f1(s.B * (state.raw.reverse ? -1 : 1), 2) + " T"); set("F", f1(s.F, 2) + " N"); set("Fs", f1(Fs, 2) + " N");
  set("Fn", f1(Fn, 2) + " N"); set("x", f1(s.x * 1e3, 2) + " mm"); set("g", f1((q.g0 - s.x) * 1e3, 2) + " mm"); set("Vds", f1(s.Vds, 1) + " V");
  if (rEl.Vds) rEl.Vds.classList.toggle("hot", s.Vds > q.V + 5);
  if (rEl.T) { set("T", q.T.toFixed(0) + " °C"); set("Rc", q.R.toFixed(1) + " Ω"); rEl.T.classList.toggle("hot", q.T > 100); }
  const ro = (s.on ? "ON" : "OFF") + " · " + s.i.toFixed(2) + " A · " + f1(s.F, 1) + " N · gap " + f1((q.g0 - s.x) * 1e3, 2) + " mm";
  const rd = plate.querySelector("[data-readout]");
  if (rd.textContent !== ro) rd.textContent = ro;
  // energy chain
  const E = s.E, mJ = (v) => (v * 1e3).toFixed(v * 1e3 < 10 ? 2 : 1) + " mJ";
  const loss = E.copper + E.flyback + E.friction + E.impact + E.damping;
  const txt = { supply: mJ(E.supply) + " in", copper: mJ(E.copper) + " heat", mag: mJ(Math.max(0, E.mag)) + " stored", force: f1(s.F, 1) + " N", x: f1(s.x * 1e3, 2) + " mm", work: mJ(E.spring + Math.max(0, q.Fload * s.x)), loss: mJ(loss) };
  for (const [k2, v] of Object.entries(txt)) { const e = $(`[data-e="${k2}"]`); if (e.textContent !== v) e.textContent = v; }
  const on = {
    source: s.on && s.i > 1e-3, winding: s.i > 1e-3, field: s.B > 0.02, force: s.F > 0.05 && (s.v > 1e-5 || s.F > Fs + q.Fload),
    motion: Math.abs(s.v) > 1e-5, work: s.v > 1e-5, loss: (!s.on && s.i > 1e-3) || s.v < -1e-5,
  };
  $$(".chip").forEach((c) => c.toggleAttribute("data-on", !!on[c.dataset.stage]));
  svg.toggleAttribute("data-on", s.on);
  $('[data-act="energize"]').setAttribute("aria-pressed", s.on ? "true" : "false");
  $('[data-act="energize"] .lbl').textContent = s.on ? "De-energize" : "Energize";
  lcd();
}
function lcd() {
  const v = $('[data-part="lcd-v"]', svg), a = $('[data-part="lcd-a"]', svg);
  const tv = q.V.toFixed(1) + "V", ta = (s.on ? s.i * (q.peakHold && !s.seated ? 1 : q.duty) : 0).toFixed(2) + "A";
  if (v.textContent !== tv) v.textContent = tv;
  if (a.textContent !== ta) a.textContent = ta;
}

// ---------- plots ----------
const plotSvg = $(".plot");
function nice(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const stepv = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => span / m <= n) || 10 * mag;
  const ticks = [];
  for (let v = Math.ceil(lo / stepv - 1e-9) * stepv; v <= hi + 1e-9; v += stepv) ticks.push(+v.toFixed(10));
  return ticks;
}
function chart({ xr, yr, xl, yl, series, marks = [], vlines = [], hlines = [] }) {
  const L0 = 52, R0 = 408, T0 = 14, B0 = 210;
  const X = (v) => L0 + ((v - xr[0]) / (xr[1] - xr[0] || 1)) * (R0 - L0);
  const Y = (v) => B0 - ((v - yr[0]) / (yr[1] - yr[0] || 1)) * (B0 - T0);
  let h = `<rect class="pbg" x="${L0}" y="${T0}" width="${R0 - L0}" height="${B0 - T0}"/>`;
  for (const t of nice(xr[0], xr[1], 6)) h += `<line class="pgrid" x1="${X(t)}" x2="${X(t)}" y1="${T0}" y2="${B0}"/><text class="ptick" x="${X(t)}" y="${B0 + 14}" text-anchor="middle">${+t.toFixed(3)}</text>`;
  for (const t of nice(yr[0], yr[1], 5)) h += `<line class="pgrid" x1="${L0}" x2="${R0}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ptick" x="${L0 - 6}" y="${Y(t) + 3.5}" text-anchor="end">${+t.toFixed(3)}</text>`;
  for (const v of vlines) h += `<line class="pv ${v.cls || ""}" x1="${X(v.x)}" x2="${X(v.x)}" y1="${T0}" y2="${B0}"/>`;
  for (const v of hlines) h += `<line class="ph ${v.cls || ""}" x1="${L0}" x2="${R0}" y1="${Y(v.y)}" y2="${Y(v.y)}"/>` + (v.label ? `<text class="plab" x="${R0 - 4}" y="${Y(v.y) - 4}" text-anchor="end">${v.label}</text>` : "");
  for (const sr of series) {
    const pts = sr.x.map((x, n) => [X(x), Y(clamp(sr.y[n], yr[0] - (yr[1] - yr[0]) * 0.02, yr[1] + (yr[1] - yr[0]) * 0.02))]);
    if (pts.length > 1) h += `<path class="pline ${sr.cls}" d="${pts.map((p, n) => (n ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("")}"/>`;
    if (sr.label) { const p = pts[Math.floor(pts.length * (sr.at ?? 0.7))]; if (p) h += `<text class="plab ${sr.cls}" x="${p[0] + 4}" y="${p[1] - 6}">${sr.label}</text>`; }
  }
  for (const m of marks) if (Number.isFinite(m.x) && Number.isFinite(m.y)) h += `<circle class="pmark ${m.cls || ""}" cx="${X(clamp(m.x, xr[0], xr[1]))}" cy="${Y(clamp(m.y, yr[0], yr[1]))}" r="4"/>`;
  h += `<line class="paxis" x1="${L0}" x2="${R0}" y1="${B0}" y2="${B0}"/><line class="paxis" x1="${L0}" x2="${L0}" y1="${T0}" y2="${B0}"/>`;
  h += `<text class="pxl" x="${(L0 + R0) / 2}" y="${B0 + 32}" text-anchor="middle">${xl}</text><text class="pyl" transform="translate(13 ${(T0 + B0) / 2}) rotate(-90)" text-anchor="middle">${yl}</text>`;
  plotSvg.innerHTML = h;
}
const maxOf = (a, floor = 1e-6) => Math.max(floor, ...a.filter(Number.isFinite));
let plotTimer = 0;
function drawPlot() {
  const p = state.plot;
  const iPull = steadyCurrent(q);
  const cap = out("pcap");
  if (p === "it" || p === "xt") {
    const t0 = TRACE.t.length ? TRACE.t[0] : 0;
    const ts = TRACE.t.map((t) => (t - t0) * 1e3);
    const span = Math.max(TRACE.span * 1e3, ts[ts.length - 1] || 0);
    const edges = [];
    for (let n = 1; n < TRACE.on.length; n++) if (TRACE.on[n] !== TRACE.on[n - 1]) edges.push({ x: ts[n], cls: TRACE.on[n] ? "pon" : "poff" });
    if (p === "it") {
      chart({ xr: [0, span], yr: [0, maxOf([iPull * 1.15, ...TRACE.i], 0.05) * 1.05], xl: "time (ms)", yl: "coil current i (A)", series: [{ x: ts, y: TRACE.i, cls: "s-i" }], vlines: edges, hlines: [{ y: iPull, cls: "pref", label: "V/R = " + iPull.toFixed(2) + " A" }] });
      cap.textContent = "Current rises with time constant L/R instead of jumping to V/R. The dip while the plunger travels is the motional back-EMF: the closing gap raises the inductance. After switch-off the current decays through the flyback path.";
    } else {
      chart({ xr: [0, span], yr: [0, Math.max(q.stroke * 1e3 * 1.12, 0.5)], xl: "time (ms)", yl: "plunger travel x (mm)", series: [{ x: ts, y: TRACE.x, cls: "s-x" }], vlines: edges, hlines: [{ y: q.xMax * 1e3, cls: "pref", label: q.blocked ? "obstruction" : "stop washer" }] });
      cap.textContent = "Travel toward the pole. Note the delay after switch-on (current must build first) and the longer delay after switch-off (the flux must decay before the spring wins). Small bounces come from the stops' restitution.";
    }
    return;
  }
  if (p === "tt") {
    const ts = TH.trace.t, Ts = TH.trace.T;
    const t1 = Math.max(10, ts[ts.length - 1] || 0), t0 = Math.max(0, t1 - 30);
    const hl = [{ y: state.raw.T, cls: "pref", label: "ambient " + state.raw.T + " °C" }];
    const Tf = TH.on ? TH.Tfail : failTemp();
    if (Tf != null && Tf < 230) hl.push({ y: Tf, cls: "pfail", label: "pull-in fails above " + Tf.toFixed(0) + " °C" });
    chart({ xr: [t0, t1], yr: [Math.min(state.raw.T, 0) - 5, Math.max(160, ...Ts, (Tf ?? 0) + 20)], xl: "time-lapsed time (min)", yl: "coil temperature (°C)", series: [{ x: ts, y: Ts, cls: "s-t" }], hlines: hl, marks: TH.on ? [{ x: TH.t / 60, y: TH.Tc }] : [] });
    cap.textContent = TH.on ? "One lumped thermal node: C·dT/dt = i²R − (T − T_amb)/R_th, with R_th = 8 K/W and C = 25 J/K (a 200 s time constant), time-lapsed so 1 s is 2 minutes. Copper resistance rises 0.39 %/K, so the current and the force fall as it heats. Above the red line the coil can no longer pull the plunger in from rest." : "Turn on coil self-heating (or run the hot-coil demo) to see the coil warm up. The red line is the temperature above which this coil can no longer pull in from rest.";
    return;
  }
  const c = curves(q, s.i, Math.max(CONST.gStop, q.g0 - s.x));
  if (p === "fg") {
    const opp = c.gaps.map((g) => q.Fpre + q.k * (q.g0 - g * 1e-3) + q.Fload);
    const ymax = Math.min(maxOf(c.fGap) * 1.05, Math.max(30, maxOf(opp) * 3));
    const series = [{ x: c.gaps, y: c.fGap, cls: "s-f", label: "F mag at V/R", at: 0.35 }, { x: c.gaps, y: opp, cls: "s-s", label: "spring + load", at: 0.8 }];
    if (q.sat) series.unshift({ x: c.gaps, y: c.fGapIdeal, cls: "s-ideal", label: "ideal, no saturation", at: 0.12 });
    if (q.face !== "flat") series.unshift({ x: c.gaps, y: c.fGapFlat, cls: "s-flat", label: "flat face", at: 0.55 });
    chart({ xr: [0, q.g0 * 1e3], yr: [0, ymax], xl: "air gap g (mm)", yl: "force (N)", series, marks: [{ x: (q.g0 - s.x) * 1e3, y: s.F }] });
    cap.textContent = "Force at the full pull-in current, against gap. It climbs steeply as the gap closes (about 1/g² in the ideal model, capped by saturation if enabled). The plunger starts only where the blue curve clears the spring + load line at the rest gap; the dot is the present state." + (q.face !== "flat" ? " A conical pole spreads the gap over a larger, slanted surface: it acts like a flat gap of g·sin²α, so the cone pulls harder at long stroke and less hard at the end, flattening the curve (Roters' approximation, valid while the cones overlap)." : "");
  } else if (p === "fi") {
    chart({ xr: [0, c.currents[c.currents.length - 1]], yr: [0, maxOf(c.fI) * 1.08], xl: "coil current i (A)", yl: "magnetic force (N)", series: [{ x: c.currents, y: c.fI, cls: "s-f", label: "at gap " + f1((q.g0 - s.x) * 1e3, 2) + " mm" }], marks: [{ x: s.i, y: s.F }] });
    cap.textContent = "Force against current at the present gap: a parabola (F ∝ i²) while the iron is linear, bending over if saturation is on. Reversing the current gives the same force.";
  } else if (p === "sx") {
    chart({ xr: [0, q.stroke * 1e3], yr: [0, maxOf(c.spring) * 1.15], xl: "plunger travel x (mm)", yl: "spring force (N)", series: [{ x: c.xs, y: c.spring, cls: "s-s", label: "F = preload + k·x" }], marks: [{ x: s.x * 1e3, y: q.Fpre + q.k * s.x }] });
    cap.textContent = "The return spring's force grows linearly as the plunger pulls in and compresses it. Its stored energy at full stroke is the area under this line.";
  } else {
    const lo = Math.min(0, ...c.net), hi = Math.max(1, ...c.net.map((v) => Math.min(v, 60)));
    chart({ xr: [0, q.stroke * 1e3], yr: [lo * 1.1, hi * 1.1], xl: "plunger travel x (mm)", yl: "net force at V/R (N)", series: [{ x: c.xs, y: c.net, cls: "s-n", label: "F mag − spring − load − friction", at: 0.1 }], hlines: [{ y: 0, cls: "pzero" }], marks: [{ x: s.x * 1e3, y: s.F - q.Fpre - q.k * s.x - q.Fload + s.fric }] });
    cap.textContent = "Net force along the stroke with the full pull-in current. Where it is negative at x = 0 the solenoid cannot start; once it is positive the plunger accelerates all the way to the stop, because the magnetic force rises faster than the spring's.";
  }
}
$$("[data-plot]").forEach((b) => b.addEventListener("click", () => { state.plot = b.dataset.plot; $$("[data-plot]").forEach((x) => x.setAttribute("aria-selected", x === b ? "true" : "false")); drawPlot(); }));

// ---------- schematic ----------
const schemSvg = $(".schem");
function schematic() {
  const fb = q.flyback;
  const path = s.on ? "on" : s.i > 1e-4 ? (fb === "none" ? "aval" : "fly") : "none";
  const hc = (on, red) => (on ? (red ? "sc red" : "sc hot") : "sc");
  const coilOn = path !== "none";
  const yC = fb === "clamp";
  schemSvg.innerHTML = `
  <path class="${hc(path === "on")}" d="M44 54V30H250V44"/>
  <path class="${hc(path === "on")}" d="M44 96V146H250V132"/>
  <path class="sc thick" d="M30 64h28M36 72h16M30 80h28M36 88h16"/><path class="sc" d="M44 54v10M44 88v8"/>
  <path class="${hc(coilOn)}" d="M250 44v4c9 0 9 7 0 7c9 0 9 7 0 7c9 0 9 7 0 7c9 0 9 7 0 7v4l6 2.5-12 3.5 12 3.5-12 3.5 6 2v5"/>
  <path class="${hc(path === "on" || path === "aval", path === "aval")}" d="M250 104V112h14v18h-14v2M264 114v14M271 112v20M271 122h-7"/>
  <path class="${hc(path === "fly")}" d="M250 30H340V${yC ? 52 : 58}M340 ${yC ? 92 : 80}V104H250"/>
  <path class="${hc(path === "fly")}" d="M330 ${yC ? 52 : 58}h20M340 ${yC ? 52 : 58}l-9 13h18z" ${fb === "none" ? 'opacity=".25"' : ""}/>
  <path class="${hc(path === "fly")}" d="M340 ${yC ? 52 : 58}V${yC ? 65 : 71}M340 71V80"/>
  ${yC ? `<path class="${hc(path === "fly")}" d="M340 65v6M331 88h18l-9 -13zM331 88l-3 -3M349 88l3 3M340 88v4"/>` : ""}
  ${fb === "none" ? `<path class="sc red" d="M330 58l20 20M350 58l-20 20"/>` : ""}
  <text class="st" x="14" y="24">+${q.V.toFixed(1)} V supply</text>
  <text class="st" x="241" y="58" text-anchor="end">L ≈ ${(inductanceAt(q.g0 - s.x, q) * 1e3).toFixed(1)} mH</text>
  <text class="st" x="241" y="72" text-anchor="end">N = ${Math.round(q.N)} turns</text>
  <text class="st" x="241" y="94" text-anchor="end">R = ${q.R.toFixed(1)} Ω</text>
  <text class="st" x="241" y="126" text-anchor="end">MOSFET ${s.on ? (q.duty < 1 && s.seated && q.peakHold ? "PWM " + Math.round(q.duty * 100) + "%" : "on") : "off"}</text>
  <text class="st" x="358" y="64">${fb === "none" ? "flyback" : "diode"}</text>
  <text class="st" x="358" y="78">${fb === "none" ? "open" : fb === "clamp" ? "+ 33 V" : ""}</text>
  <text class="st" x="14" y="164">i = ${s.i.toFixed(3)} A</text><text class="st ${s.Vds > q.V + 5 ? "red-t" : ""}" x="250" y="164">drain ${s.Vds.toFixed(1)} V</text>`;
  const sc = out("scap");
  const t = path === "on" ? "Switch closed: supply → coil → MOSFET → ground. The coil's inductance slows the rise of current."
    : path === "fly" ? (fb === "clamp" ? "Switch open: the coil drives its current through the diode and 33 V clamp. About 34 V across the coil collapses the current quickly; the drain sees supply + 34 V." : "Switch open: the coil's current freewheels through the diode. Only about 0.8 V opposes it, so it decays slowly (τ = L/R) and the plunger is held longer.")
    : path === "aval" ? "No flyback path: the drain voltage rises until the MOSFET avalanches (60 V here). Fast release, but the field's energy is dumped in the transistor every time it switches off."
    : "No current. The coil, flux and force are all zero; only the spring and load act on the plunger.";
  if (sc.textContent !== t) sc.textContent = t;
}

// ---------- parameters ----------
const SLIDERS = [
  ["V", "Supply voltage", "V"], ["N", "Coil turns", ""], ["R", "Coil resistance (20 °C)", "Ω"], ["g0", "Initial air gap", "mm"],
  ["k", "Spring rate", "N/mm"], ["Fpre", "Spring preload", "N"], ["m", "Plunger mass", "g"], ["Fload", "External load", "N"],
  ["duty", "PWM duty", "%"], ["T", "Coil temperature", "°C"],
];
const slWrap = $(".sliders");
slWrap.innerHTML = SLIDERS.map(([key, label, unit]) => { const [lo, hi, st] = RANGES[key]; return `<label class="sl"><span class="sl-top"><span>${label}</span><output data-v="${key}"></output></span><input type="range" min="${lo}" max="${hi}" step="${st}" data-p="${key}" aria-label="${label}"><span class="sl-range">${lo}–${hi} ${unit}</span></label>`; }).join("") + `<div class="derived" data-out="derived"></div>`;
const UNITS = Object.fromEntries(SLIDERS.map(([k2, , u]) => [k2, u]));
function syncControls() {
  for (const el of $$("[data-p]")) {
    const k2 = el.dataset.p, v = state.raw[k2];
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    const o = $(`[data-v="${k2}"]`);
    if (o) o.textContent = (Number.isInteger(+v) ? v : (+v).toFixed(k2 === "k" ? 1 : 1)) + (UNITS[k2] ? " " + UNITS[k2] : "");
  }
}
function applyParams() {
  const before = q;
  q = resolve({ ...state.raw, T: rawT() }, state.fault);
  if (typeof TH !== "undefined" && TH.on) TH.Tfail = failTemp();
  if (s.x > q.xMax) s.x = q.xMax;
  // a new gap moves the rest position; keep the plunger on its stop when it was there
  if (before && Math.abs(before.g0 - q.g0) > 1e-9 && s.x <= 1e-9) s.x = 0;
  const act = actuation(q);
  const L0 = inductanceAt(q.g0, q), L1 = inductanceAt(CONST.gStop, q);
  const hold = steadyCurrent(q, true), Phold = (q.peakHold ? q.duty : q.duty) * q.V * hold;
  out("derived").innerHTML = `Pull-in current V/R = <b>${act.i.toFixed(2)} A</b> (R at ${q.T.toFixed(0)} °C = ${q.R.toFixed(1)} Ω) · L open ≈ <b>${(L0 * 1e3).toFixed(1)} mH</b>, τ ≈ ${((L0 / q.R) * 1e3).toFixed(2)} ms · L closed ≈ ${(L1 * 1e3).toFixed(0)} mH, τ ≈ ${((L1 / q.R) * 1e3).toFixed(1)} ms · force at rest gap <b>${act.F0.toFixed(2)} N</b> vs. ${act.need.toFixed(2)} N needed · hold power ≈ ${Phold.toFixed(1)} W, steady rise ≈ ${(Phold * CONST.Rth).toFixed(0)} K (illustrative R<sub>th</sub> ${CONST.Rth} K/W)`;
  const warn = [];
  if (!act.ok) warn.push("Insufficient electromagnetic force: at the rest gap the coil can make " + act.F0.toFixed(2) + " N, but preload + load + static friction need " + act.need.toFixed(2) + " N. The plunger will not move.");
  const Bclosed = bOf(act.i, CONST.gStop, q);
  if (!q.sat && Bclosed > 1.5) warn.push("The ideal model predicts " + Bclosed.toFixed(2) + " T in the closed gap. Real soft iron saturates near 1.5–2 T, so the forces shown near the end of the stroke are too high. Turn on iron saturation to see the limit.");
  if (q.flyback === "none") warn.push("No flyback path: each turn-off drives the MOSFET into avalanche at " + CONST.Vbr + " V.");
  const w = out("warn");
  w.hidden = !warn.length;
  w.innerHTML = warn.map((t) => `<p>${t}</p>`).join("");
  syncControls();
  exCone();
  drawDynamic(true);
  drawPlot();
  schematic();
}
$$("[data-p]").forEach((el) => el.addEventListener("input", () => {
  const k2 = el.dataset.p;
  state.raw[k2] = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? (k2 === "pole" ? +el.value : el.value) : +el.value;
  applyParams();
}));
$('[data-act="defaults"]').addEventListener("click", () => { state.raw = { ...DEFAULTS, reverse: false }; state.fault = "none"; syncFaults(); applyParams(); });

// ---------- faults ----------
const FAULT_INFO = {
  none: { name: "No fault", effect: "Normal operation.", cause: "", diag: "" },
  open: { name: "Open winding", effect: "No current, no flux, no motion. The supply shows voltage but no current; the drain sits at the supply voltage whether the MOSFET is on or off.", cause: "A broken turn or lead, often fatigue at the lead exit or a burnt-through winding after overheating.", diag: "Measure coil resistance: it reads open circuit instead of the nominal value. Driver open-load detection flags it." },
  shorted: { name: "Shorted turns", effect: "Higher current and heat (here R falls 50 % and the active turns 30 %). Pull-in may still work, but force per amp drops and the coil runs much hotter, which tends to spread the short.", cause: "Insulation breakdown between turns from heat, vibration or a voltage spike.", diag: "Resistance below specification; current higher than V/R predicts for the nominal coil; the inductance (and the current's rise time) falls. A surge or ring test finds turn-to-turn faults." },
  lowV: { name: "Low supply voltage", effect: "The supply sags to 55 %. Current and force fall with it (force with the square), so the plunger may not pull in at all.", cause: "A weak battery, cranking dips, a high-resistance connection or ground, an undersized harness.", diag: "Measure voltage at the coil terminals under load, not at the source; the voltage-drop test across each connection finds the resistance." },
  hot: { name: "High coil temperature", effect: "At 150 °C copper resistance rises about 51 %, so current and force fall: here the hot coil can no longer pull in. A solenoid that works cold and fails hot is the classic symptom.", cause: "Long energized time at full voltage, high ambient (engine bay), no peak-and-hold, poor heat path.", diag: "Compare resistance hot and cold; check the duty cycle and hold strategy; calculate force with hot resistance and minimum voltage, the worst case." },
  sticky: { name: "Plunger sticking (contamination)", effect: "Static friction rises to 7 N and sliding friction to 4 N. The plunger stays put, or moves late and slowly, and may fail to return.", cause: "Dirt, varnish, corrosion or wear debris in the sleeve; swelling of a plastic sleeve; side load from a misaligned linkage.", diag: "The current trace loses its motion dip (no back-EMF from movement). Check free movement by hand with power off; inspect the sleeve and plunger." },
  gap: { name: "Excessive air gap", effect: "The rest gap opens to 8 mm. Ideal force falls roughly with 1/g², so the starting force collapses.", cause: "Wrong stop setting, worn or missing stop, bent bracket, assembly error.", diag: "Measure the stroke and rest position against the drawing; compare with the force-stroke curve at minimum voltage." },
  preload: { name: "Excessive return spring preload", effect: "Preload rises to 14 N, more than the coil can overcome at the rest gap.", cause: "Wrong or stiffer spring, wrong installed length, a stacked or doubled spring.", diag: "Measure the spring rate and free length; check force needed to move the plunger at rest with a gauge." },
  obstruct: { name: "Mechanical obstruction", effect: "The plunger stops at 40 % of its stroke. The gap stays open, so the holding force and the inductance stay low and the current never shows the full motion.", cause: "Foreign object, a binding linkage, the driven part jammed.", diag: "Travel sensor or the current signature shows incomplete stroke; inspect the linkage and the driven mechanism." },
  flyback: { name: "Driver or flyback protection failure", effect: "The flyback path is open. At turn-off the drain voltage spikes to the MOSFET's avalanche voltage (60 V here). Release is fast, but the transistor absorbs the field's energy every cycle, and the spike couples noise into nearby wiring.", cause: "An open or missing diode, a cracked joint, a failed clamp.", diag: "Scope the drain at turn-off: a clamped spike at V<sub>BR</sub> instead of V + 0.8 V. Check the diode with a meter; look for a hot or failed MOSFET." },
};
const faultList = $(".fault-list");
faultList.innerHTML = Object.entries(FAULT_INFO).map(([k2, f]) => `<button type="button" role="radio" data-fault="${k2}" aria-checked="${k2 === "none"}">${f.name}</button>`).join("");
function syncFaults() {
  $$("[data-fault]").forEach((b) => b.setAttribute("aria-checked", b.dataset.fault === state.fault ? "true" : "false"));
  const f = FAULT_INFO[state.fault];
  out("fault").innerHTML = state.fault === "none" ? `<p class="muted">No fault selected. Each fault keeps your other settings and changes only what its physical cause would change.</p>` : `<h3>${f.name}</h3><dl><dt>What you see</dt><dd>${f.effect}</dd><dt>Likely cause</dt><dd>${f.cause}</dd><dt>Diagnostic</dt><dd>${f.diag}</dd></dl>`;
}
$$("[data-fault]").forEach((b) => b.addEventListener("click", () => { state.fault = b.dataset.fault; syncFaults(); applyParams(); resetSim(); state.auto = true; syncAuto(); }));

// ---------- transport ----------
function energize(on) { if (on && !s.on) { for (const k2 in s.E) s.E[k2] = 0; } s.on = on; }
$('[data-act="energize"]').addEventListener("click", () => { state.auto = false; syncAuto(); energize(!s.on); if (!state.playing) togglePlay(true); });
function togglePlay(v = !state.playing) { state.playing = v; const b = $('[data-act="play"]'); b.textContent = v ? "❚❚" : "▶"; b.setAttribute("aria-label", v ? "Pause" : "Play"); }
$('[data-act="play"]').addEventListener("click", () => togglePlay());
function advance(simDt) {
  const n = Math.min(40000, Math.max(1, Math.round(simDt / 5e-6)));
  const dt = simDt / n;
  for (let i = 0; i < n; i++) {
    if (state.auto) { cycleT += dt; const ph = cycleT % 0.16; const want = ph > 0.01 && ph < 0.085; if (want !== s.on) energize(want); }
    step(s, q, dt);
    TH.P += (s.i * s.i * q.R - TH.P) * Math.min(1, dt / 0.04);
    record();
  }
}
$('[data-act="step"]').addEventListener("click", () => { togglePlay(false); advance(2e-4); frame(0, true); });
function resetSim() { s = newState(); cycleT = 0; TRACE.t.length = TRACE.i.length = TRACE.x.length = TRACE.on.length = 0; traceNext = 0; drawDynamic(true); }
$('[data-act="reset"]').addEventListener("click", () => { resetSim(); readouts(); drawPlot(); });
function syncAuto() { $('[data-act="auto"]').checked = state.auto; }
$('[data-act="auto"]').addEventListener("change", (e) => { state.auto = e.target.checked; if (state.auto) cycleT = 0; });
const speedEl = $('[data-act="speed"]');
function syncSpeed() {
  const v = +speedEl.value;
  state.speed = 10 ** (-3.3 * (1 - v / 100));
  const eff = state.speed * (state.slow ? 0.1 : 1);
  out("speed").textContent = eff >= 0.999 ? "real time" : "×1/" + Math.round(1 / eff);
}
speedEl.addEventListener("input", syncSpeed);
$('[data-act="slow"]').addEventListener("change", (e) => { state.slow = e.target.checked; syncSpeed(); });
$('[data-act="zoom-in"]').addEventListener("click", () => zoomBy(1 / 1.25));
$('[data-act="zoom-out"]').addEventListener("click", () => zoomBy(1.25));
$('[data-act="fit"]').addEventListener("click", () => setView("full"));
$('[data-act="view"]').addEventListener("click", () => setView(MODE_VIEW[state.mode]));
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); $('[data-act="energize"]').click(); }
  if (e.key === "+" || e.key === "=") zoomBy(1 / 1.25);
  if (e.key === "-") zoomBy(1.25);
  if (e.key === "0") setView(MODE_VIEW[state.mode]);
});

// ---------- tooltips: what each part is and does ----------
const PART_INFO = {
  can: ["Return yoke (can)", "Soft-iron tube, 2 mm wall. Carries the flux back from the front plate to the back plate. Stationary."],
  "front-plate": ["Front pole plate", "Soft-iron washer. Flux leaves the plunger radially here and enters the can. Stationary."],
  "back-plate": ["Back plate", "Soft iron, joins the can to the pole. Stationary."],
  pole: ["Stationary pole piece", "Soft-iron core the plunger is pulled toward. Its threaded stud mounts the solenoid to the bracket."],
  washer: ["Stop washer (nonmagnetic)", "0.25 mm brass on the pole face: the mechanical end stop. It leaves a residual gap so the plunger can't magnetically weld to the pole and the force stays finite."],
  bobbin: ["Bobbin", "Insulating nylon spool that carries the winding and positions it round the sleeve. Stationary."],
  winding: ["Copper winding", "N turns of enamelled copper wire. Current here produces the magnetomotive force N·i. Its resistance sets the steady current V/R and the heat i²R."],
  sleeve: ["Guide sleeve and flange", "Nonmagnetic brass tube the plunger slides in (0.15 mm radial clearance); its flange seats the return spring. Nonmagnetic so it doesn't short the gap."],
  plunger: ["Plunger (armature)", "Soft-iron moving part. Pulled toward the pole because that shortens the air gap and lowers the loop's reluctance. Moving."],
  spring: ["Return spring", "Compression spring between the sleeve flange and the plunger collar. Preloaded at rest; compressed further on pull-in; returns the plunger when the force decays."],
  clevis: ["Ribbon clevis and stop tab", "Plated steel yoke pinned through the plunger tip. The load ribbon is riveted to it, and its tab rests on the stop screw. Moving."],
  screw: ["Stop screw", "Sets the rest position, and so the initial air gap. Locked with a nut. Stationary."],
  ribbon: ["Constant-force ribbon", "A prestressed steel strip that rolls onto its drum, so it pulls with nearly the same force at any extension: the external load."],
  "drum-coil": ["Constant-force spring drum", "The ribbon's coil on a free-turning drum. Turns as the plunger pulls the ribbon out."],
  grommet: ["Grommet and leads", "Rubber grommet where the two coil leads leave the can."],
  diode: ["Flyback diode", "Gives the coil's current a path when the MOSFET opens, clamping the coil at about −0.8 V."],
  clamp: ["Clamp (TVS / zener)", "In series with the diode in the 'clamp' setting: lets the coil swing to about −34 V so the current decays faster."],
  stud: ["Mounting stud", "Threaded end of the pole piece, through the bracket with a lock washer and nut."],
};
const tip = $(".tip", stage);
svg.addEventListener("pointermove", (e) => {
  if (drag && (Math.abs(e.clientX - drag.x) > 3 || Math.abs(e.clientY - drag.y) > 3)) { tip.hidden = true; return; }
  const el = e.target.closest("[data-part]");
  const info = el && PART_INFO[el.dataset.part];
  if (!info) { tip.hidden = true; svg.removeAttribute("data-hover"); return; }
  svg.dataset.hover = el.dataset.part;
  tip.innerHTML = `<b>${info[0]}</b><span>${info[1]}</span>`;
  tip.hidden = false;
  const r = stage.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  tip.style.left = clamp(x + 14, 8, r.width - 280) + "px";
  tip.style.top = clamp(y + 14, 8, r.height - 120) + "px";
});
svg.addEventListener("pointerleave", () => { tip.hidden = true; svg.removeAttribute("data-hover"); });
// click a part to isolate it: a paper veil over the bench, the part's own drawing cloned above it
let isolated = null, downAt = null;
const isoLayer = (() => { const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("data-layer", "isolate"); svg.appendChild(g); return g; })();
stage.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; }, true);
svg.addEventListener("click", (e) => {
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  const el = e.target.closest("[data-part]");
  const name = el && PART_INFO[el.dataset.part] ? el.dataset.part : null;
  isolated = name === isolated ? null : name;
  drawIsolate();
});
stage.addEventListener("keydown", (e) => { if (e.key === "Escape" && isolated) { isolated = null; drawIsolate(); } });
function drawIsolate() {
  svg.toggleAttribute("data-isolated", !!isolated);
  if (!isolated) { isoLayer.innerHTML = ""; $(".iso-note", stage).hidden = true; return; }
  const [x, y, w, h] = vb;
  isoLayer.innerHTML = `<rect class="veil" x="${x - w}" y="${y - h}" width="${w * 3}" height="${h * 3}"/>`;
  for (const src of svg.querySelectorAll(`[data-part="${isolated}"]`)) {
    if (src.closest('[data-layer="isolate"]') || src.closest('[style*="display: none"]') || src.closest('[data-only="explode"]') && !svg.hasAttribute("data-exploded")) continue;
    const c = src.cloneNode(true);
    const t = src.closest("[data-ex]");
    if (t && t.getAttribute("transform")) c.setAttribute("transform", t.getAttribute("transform"));
    isoLayer.appendChild(c);
  }
  const info = PART_INFO[isolated];
  isoLayer.insertAdjacentHTML("beforeend", "");
  $(".iso-note", stage).hidden = false;
  $(".iso-note", stage).innerHTML = `<b>${info[0]}</b> isolated · click it again or press Esc to show everything`;
}

// ---------- learning sequence ----------
const STEPS = [
  { t: "Identify every component", d: "Hover over the section to name each part. Iron parts (blue) form one closed loop: pole, plunger, front plate, can and back plate. The copper winding sits on a red nylon bobbin around a brass sleeve. Moving parts are teal (plunger) and plated steel (clevis); everything blue, red, brass and copper is stationary.", go: () => { stopAuto(); energize(false); setMode("cut"); } },
  { t: "Observe the unpowered state", d: "With the coil off there is no current and no flux. The spring's preload holds the plunger out against the stop screw, so the air gap is at its largest (the initial gap you set).", go: () => { stopAuto(); energize(false); setMode("cut"); pickPlot("xt"); } },
  { t: "Energize the winding", d: "Closing the MOSFET puts the supply across the coil. Watch the supply's ammeter and the flow on the wires: current runs supply → coil → MOSFET → ground.", go: () => { stopAuto(); resetSim(); setMode("circuit"); setSpeed(0.004); energize(true); pickPlot("it"); } },
  { t: "Watch the coil current rise", d: "The current climbs toward V/R with time constant L/R rather than jumping, because the field has to be built first. When the plunger starts to move the current dips: the closing gap raises the inductance and the motion generates a back-EMF.", go: () => { stopAuto(); resetSim(); setMode("cut"); setSpeed(0.004); energize(true); pickPlot("it"); } },
  { t: "Flux through the iron path", d: "Flux follows the iron: through the pole, across the working gap, along the plunger, out through the front plate, back along the can and in through the back plate. The lines' opacity follows the computed gap flux density. Current goes into the page at the top of the winding and out at the bottom; reverse the winding sense in the parameters and the flux reverses, but the pull does not.", go: () => { stopAuto(); resetSim(); setMode("flux"); setSpeed(0.006); energize(true); } },
  { t: "Attraction and plunger movement", d: "The magnetic force (blue) grows as the current and flux build. Once it exceeds spring + load + static friction the plunger moves, the gap shrinks, the force climbs steeply and the plunger accelerates into the stop washer.", go: () => { stopAuto(); resetSim(); setMode("force"); setSpeed(0.004); energize(true); pickPlot("fg"); } },
  { t: "Spring resistance and mechanical work", d: "As the plunger travels x it compresses the spring (F = preload + k·x) and draws out the ribbon against its constant load. The work done, the area under those forces, is stored in the spring or delivered to the load; the rest of the field's work ends as impact at the stop.", go: () => { stopAuto(); setMode("force"); pickPlot("nx"); if (!s.on) energize(true); } },
  { t: "Remove electrical power", d: "Opening the MOSFET doesn't stop the current at once: the coil drives it round the flyback diode. The drain voltage rises to just above the supply.", go: () => { stopAuto(); if (!s.seated) { energize(true); advance(0.06); } setMode("circuit"); setSpeed(0.004); energize(false); pickPlot("it"); } },
  { t: "Current decay and spring return", d: "With a plain diode only about 0.8 V opposes the coil, so the current and flux decay slowly and the plunger stays held for several milliseconds before the spring wins. Switch the flyback path to the 33 V clamp and run it again: the release is several times faster, at the cost of a higher drain voltage.", go: () => { stopAuto(); if (!s.seated) { energize(true); advance(0.06); } setMode("cut"); setSpeed(0.004); energize(false); pickPlot("xt"); } },
  { t: "Explore failure and design trade-offs", d: "Try the failure modes below, or push the design: a larger initial gap needs far more current; peak-and-hold cuts the holding power; heat raises resistance and cuts force. Drag the sliders and watch the force–gap plot and the warnings.", go: () => { state.auto = true; syncAuto(); setMode("cut"); pickPlot("fg"); $(".faults").scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" }); } },
];
let stepIx = 0;
const stepList = $(".steps");
stepList.innerHTML = STEPS.map((st, n) => `<li><button type="button" data-step="${n}">${st.t}</button></li>`).join("");
function showStep(n) {
  stepIx = clamp(n, 0, STEPS.length - 1);
  $$("[data-step]").forEach((b) => b.setAttribute("aria-current", +b.dataset.step === stepIx ? "step" : "false"));
  $(".step-text").innerHTML = `<p class="step-n">Step ${stepIx + 1} of ${STEPS.length}</p><h3>${STEPS[stepIx].t}</h3><p>${STEPS[stepIx].d}</p>`;
}
$$("[data-step]").forEach((b) => b.addEventListener("click", () => { showStep(+b.dataset.step); STEPS[stepIx].go(); }));
$('[data-act="prev"]').addEventListener("click", () => showStep(stepIx - 1));
$('[data-act="next"]').addEventListener("click", () => showStep(stepIx + 1));
$('[data-act="show"]').addEventListener("click", () => { STEPS[stepIx].go(); togglePlay(true); stage.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" }); });
function stopAuto() { state.auto = false; syncAuto(); }
function pickPlot(p) { state.plot = p; $$("[data-plot]").forEach((x) => x.setAttribute("aria-selected", x.dataset.plot === p ? "true" : "false")); }
function setSpeed(f) { speedEl.value = String(clamp(100 * (1 + Math.log10(f) / 3.3), 0, 100)); syncSpeed(); }

// ---------- coil self-heating (time-lapsed) ----------
const TH = { on: false, Tc: DEFAULTS.T, P: 0, t: 0, trace: { t: [], T: [] }, lapse: 120, demo: 0, demoWait: 0, Tfail: null };
const rawT = () => (TH.on ? TH.Tc : state.raw.T);
function failTemp() {
  // the coil temperature above which the pull-in force at the rest gap no longer beats preload + load + friction
  const okAt = (T) => actuation(resolve({ ...state.raw, T }, state.fault)).ok;
  if (!okAt(state.raw.T)) return state.raw.T;
  if (okAt(400)) return null;
  let lo = state.raw.T, hi = 400;
  for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; if (okAt(m)) lo = m; else hi = m; }
  return lo;
}
let thRefresh = 0;
function stepHeat(real) {
  if (!TH.on || !state.playing || reduce.matches) return;
  const dt = real * TH.lapse;
  TH.Tc = heatStep(TH.Tc, TH.P, state.raw.T, dt);
  TH.t += dt;
  TH.trace.t.push(TH.t / 60); TH.trace.T.push(TH.Tc);
  while (TH.trace.t.length && TH.trace.t[0] < TH.t / 60 - 30) { TH.trace.t.shift(); TH.trace.T.shift(); }
  thRefresh -= real;
  if (thRefresh <= 0) { thRefresh = 0.2; q = resolve({ ...state.raw, T: TH.Tc }, state.fault); }
  // the demo: hold on until hot, then let the auto cycle try to pull in again
  if (TH.demo === 1 && TH.Tc >= (TH.Tfail ?? 120) + 12) { TH.demo = 2; energize(false); TH.demoWait = 0.8; }
  if (TH.demo === 2 && (TH.demoWait -= real) <= 0) { TH.demo = 3; state.auto = true; syncAuto(); cycleT = 0; }
}
const heatEl = $('[data-act="heat"]');
heatEl.addEventListener("change", () => { TH.on = heatEl.checked; TH.Tc = state.raw.T; TH.t = 0; TH.trace.t.length = TH.trace.T.length = 0; TH.Tfail = failTemp(); TH.demo = 0; applyParams(); });
$('[data-act="soak"]').addEventListener("click", () => {
  TH.on = true; heatEl.checked = true; TH.Tc = state.raw.T; TH.t = 0; TH.trace.t.length = TH.trace.T.length = 0; TH.Tfail = failTemp();
  state.auto = false; syncAuto(); state.raw.peakHold = false; syncControls(); applyParams(); resetSim(); energize(true); TH.demo = 1;
  setMode("cut"); pickPlot("tt"); togglePlay(true);
});

// ---------- main loop ----------
let last = 0;
function frame(now, once = false) {
  const real = last && !once ? Math.min(0.05, (now - last) / 1000) : 0;
  if (!once) last = now;
  if (state.playing && !reduce.matches && real > 0) advance(real * state.speed * (state.slow ? 0.1 : 1));
  stepHeat(real);
  stepView(real || 0.016);
  stepExplode(real || 0.016);
  drawDynamic();
  drawOverlays(state.playing ? real : 0);
  readouts();
  plotTimer -= real;
  if (plotTimer <= 0 || once) { plotTimer = 0.08; drawPlot(); schematic(); }
  if (!once) requestAnimationFrame(frame);
}
syncControls();
syncFaults();
syncSpeed();
showStep(0);
applyParams();
setMode(DATA.GALLERY ? "circuit" : "cut");
vb = [...vbTo];
if (reduce.matches) {
  // one still pose: energized and seated, magnetic view
  state.auto = false; syncAuto(); energize(true); advance(0.06); setMode(DATA.GALLERY ? "circuit" : "flux"); vb = [...vbTo];
}
requestAnimationFrame(frame);
