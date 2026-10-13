const k = { extrude, cylinder, slabOf };
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (part) => svg.querySelector('[data-part="' + part + '"]');
const carriageEl = $("carriage");
const leverEl = $("lever");
const bandEl = $("band");
const starEl = $("star");
const rockerEl = $("rocker");
const ribbonEl = $("ribbon");
const vibratorEl = $("vibrator");
const hammerEl = $("hammer");
const postsEl = $("posts");
const basketEl = $("basket");
const flyingEl = $("flying");
const spaceEl = $("space");
const sheetEl = $("sheet");
const sheetEdgeEl = $("sheet-edge");
const clipEl = $("paper-clip");
const textEl = $("text");
const freshEl = $("fresh");
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const restEls = BARS.map((bar) => svg.querySelector('[data-bar="' + bar.i + '"]'));
const keyEls = KEYS.map((_, i) => svg.querySelector('[data-key="' + i + '"]'));
const leverEls = KEYS.map((_, i) => svg.querySelector('[data-lever="' + i + '"]'));
const still = matchMedia("(prefers-reduced-motion: reduce)");

const keyIndex = new Map(KEYS.map((key, i) => [key.ch, i]));
const SHIFT_KEY = keyIndex.get("Shift");
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pulse = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));

// The model: where the carriage is, what is on the paper, what is moving.
const state = {
  col: 0, line: 0, lines: [""], X: xOfCol(0), Xgoal: xOfCol(0), returning: false,
  star: 0, starGoal: 0, feed: 0, feedGoal: 0, drop: 0, shifted: 0,
  fresh: null, bellAt: -9, clock: 0,
};
const strokes = [];
const queue = [];
const keyDepth = KEYS.map(() => 0);
let frame = 0, previous = 0, visible = false, touring = !still.matches, idleTimer = 0, lastStart = -9;
let tour = { phrase: 0, index: 0, wait: 1.2, step: "type" };

function enqueue(kind, extra = {}) { queue.push({ kind, ...extra }); run(); }
function typeChar(ch) {
  const lower = ch.toLowerCase();
  if (ch === " ") return enqueue("space");
  const index = keyIndex.get(lower);
  if (index === undefined || KEYS[index].bar < 0) return;
  enqueue("char", { ch, key: index, bar: KEYS[index].bar, upper: ch !== lower });
}

function begin(item) {
  const s = { ...item, t: 0, printed: false, stepped: false };
  if (s.kind === "char" || s.kind === "space" || s.kind === "back") {
    if (s.kind !== "back" && state.col >= COLS) { say("margem: devolva o carro"); s.locked = true; }
  }
  if (s.kind === "back") s.key = keyIndex.get("Backspace");
  if (s.kind === "return") { say("carro devolvido · linha " + (state.line + 2)); }
  strokes.push(s);
  lastStart = state.clock;
}
const DURATION = { char: 0.34, space: 0.24, back: 0.26, return: 0.9 };

function startReturn() { state.returning = true; state.retAt = state.clock; state.retX = state.X; state.retStar = state.star; }
function stepCarriage(by) {
  state.col = Math.max(0, Math.min(COLS, state.col + by));
  state.Xgoal = xOfCol(state.col);
  state.starGoal += by;
  if (by > 0 && state.col === BELL_AT) { state.bellAt = state.clock; say("sino: faltam seis espaços"); }
}
function print(s) {
  const line = state.lines[state.line];
  const padded = line.length < state.col ? line + " ".repeat(state.col - line.length) : line;
  const under = padded[state.col];
  // a typewriter overstrikes: keep both letters where one was already typed
  const next = padded.slice(0, state.col) + (under && under !== " " ? under : s.ch) + padded.slice(state.col + 1);
  state.lines[state.line] = next;
  if (under && under !== " ") state.over = (state.over || []).concat([{ line: state.line, col: state.col, ch: s.ch }]);
  state.fresh = { col: state.col, line: state.line, ch: s.ch, at: state.clock };
  writeText();
}

function update(dt) {
  const calm = still.matches;
  state.clock += dt;
  if (queue.length && (!strokes.length || state.clock - lastStart > 0.17) && !strokes.some((s) => s.kind === "return")) begin(queue.shift());
  let lift = 0, rock = 0, drop = 0;
  for (const s of strokes) {
    s.t += dt;
    const t = calm ? 9 : s.t;
    if (s.kind === "char") {
      if (s.upper) drop = Math.max(drop, pulse(t, 0, 0.05, 0.26, 0.32));
      if (!s.locked) {
        lift = Math.max(lift, pulse(t, 0.02, 0.1, 0.15, 0.27));
        rock = Math.max(rock, pulse(t, 0.05, 0.11, 0.2, 0.25));
        if (!s.printed && t >= 0.11) { s.printed = true; print(s); }
        if (!s.stepped && t >= 0.22) { s.stepped = true; stepCarriage(1); }
      }
    } else if (s.kind === "space") {
      rock = Math.max(rock, pulse(t, 0.02, 0.06, 0.12, 0.16));
      if (!s.locked && !s.stepped && t >= 0.13) { s.stepped = true; stepCarriage(1); }
    } else if (s.kind === "back") {
      if (!s.stepped && t >= 0.06) { s.stepped = true; stepCarriage(-1); }
    } else if (s.kind === "return") {
      if (!s.stepped && t >= 0.12) {
        s.stepped = true;
        state.line++; state.lines.push(""); state.feedGoal = state.line * LS;
        state.starGoal -= state.col; state.col = 0; state.Xgoal = xOfCol(0); startReturn();
        writeText();
      }
    }
  }
  for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].t >= DURATION[strokes[i].kind] || calm) strokes.splice(i, 1);
  if (calm && strokes.length === 0) { lift = 0; rock = 0; }
  state.lift = lift; state.rock = rock;
  state.drop = calm ? drop : state.drop + (drop - state.drop) * (1 - Math.exp(-dt / 0.025));
  // the drawband pulls the carriage in a few milliseconds; a hand pushes it back more slowly
  if (state.returning) {
    const u = calm ? 1 : smooth(0, 0.55, state.clock - state.retAt);
    state.X = state.retX + (state.Xgoal - state.retX) * u;
    state.star = state.retStar + (state.starGoal - state.retStar) * u;
    if (u >= 1) state.returning = false;
  } else {
    state.X = calm ? state.Xgoal : state.X + (state.Xgoal - state.X) * (1 - Math.exp(-dt / 0.018));
    if (Math.abs(state.X - state.Xgoal) < 0.02) state.X = state.Xgoal;
    state.star = calm ? state.starGoal : state.star + (state.starGoal - state.star) * (1 - Math.exp(-dt / 0.018));
    if (Math.abs(state.star - state.starGoal) < 0.002) state.star = state.starGoal;
  }
  state.feed = calm ? state.feedGoal : state.feed + (state.feedGoal - state.feed) * (1 - Math.exp(-dt / 0.05));
  if (Math.abs(state.feed - state.feedGoal) < 0.01) state.feed = state.feedGoal;
  // keys: down when their stroke is young
  for (let i = 0; i < KEYS.length; i++) {
    let want = 0;
    for (const s of strokes) {
      const t = calm ? 9 : s.t;
      if (s.key === i) want = Math.max(want, pulse(t, 0, 0.05, 0.16, 0.24));
      if (s.upper && i === SHIFT_KEY) want = Math.max(want, pulse(t, 0, 0.04, 0.26, 0.32));
    }
    keyDepth[i] = want;
  }
  state.space = 0;
  for (const s of strokes) if (s.kind === "space") state.space = Math.max(state.space, pulse(calm ? 9 : s.t, 0, 0.05, 0.1, 0.18));
}

function phiOf(t) {
  if (t < 0.11) { const e = t / 0.11; return PHI_REST + (PHI_HIT - PHI_REST) * e * e; }
  const u = Math.min(1, (t - 0.11) / 0.21);
  return PHI_HIT + (PHI_REST - PHI_HIT) * (1 - Math.pow(1 - u, 3));
}

const drawn = { X: null, star: null, rock: null, lift: null, drop: null, feed: null, keys: KEYS.map(() => -1), space: -1, flying: "", hammer: -1 };
function draw() {
  if (drawn.X !== state.X) {
    const t = translateAlong(P, [state.X, 0, 0]);
    carriageEl.setAttribute("transform", t);
    leverEl.setAttribute("transform", t);
    bandEl.setAttribute("d", bandPath(state.X));
    drawn.X = state.X;
  }
  if (drawn.star !== state.star) { starEl.innerHTML = starWheel((-state.star * 2 * Math.PI) / STAR_TEETH); drawn.star = state.star; }
  if (drawn.rock !== state.rock) { rockerEl.innerHTML = rocker((state.rock * 7 * Math.PI) / 180); drawn.rock = state.rock; }
  const lift = state.lift * RIB.lift;
  if (drawn.lift !== lift) {
    ribbonEl.innerHTML = ribbon(lift);
    vibratorEl.setAttribute("transform", translateAlong(P, [0, 0, lift]));
    drawn.lift = lift;
  }
  const drop = state.drop * SHIFT;
  if (drawn.drop !== drop) {
    basketEl.setAttribute("transform", translateAlong(P, [0, 0, -drop]));
    postsEl.innerHTML = posts(drop);
    drawn.drop = drop;
  }
  if (drawn.feed !== state.feed) {
    const d = paperRect(PAPER_TOP0 + state.feed);
    sheetEl.setAttribute("d", d); sheetEdgeEl.setAttribute("d", d); clipEl.setAttribute("d", d);
    textEl.setAttribute("transform", "translate(0 " + (-state.feed).toFixed(2) + ")");
    freshEl.setAttribute("transform", "translate(0 " + (-state.feed).toFixed(2) + ")");
    drawn.feed = state.feed;
  }
  // flying typebars, drawn in their own slot above the resting ones
  const flying = strokes.filter((s) => s.kind === "char" && !s.locked && s.t < DURATION.char);
  const hidden = new Set(flying.map((s) => s.bar));
  restEls.forEach((el, i) => { const off = hidden.has(i); if (el.hasAttribute("data-off") !== off) { el.toggleAttribute("data-off", off); el.style.display = off ? "none" : ""; } });
  const html = flying.map((s) => {
    const bar = BARS[s.bar];
    const { body, slug } = typebar(bar, phiOf(still.matches ? 0.4 : s.t), 0, P);
    return S(body, { tone: "hi", lit: true }) + S(slug, { tone: "hi", lit: true });
  }).join("");
  if (html !== drawn.flying) { flyingEl.innerHTML = html; drawn.flying = html; }
  for (let i = 0; i < KEYS.length; i++) {
    if (drawn.keys[i] === keyDepth[i]) continue;
    const down = keyDepth[i] * TRAVEL;
    keyEls[i].setAttribute("transform", translateAlong(P, [0, 0, -down]));
    keyEls[i].toggleAttribute("data-down", keyDepth[i] > 0.5);
    leverEls[i].innerHTML = keyLever(KEYS[i], down);
    drawn.keys[i] = keyDepth[i];
  }
  if (drawn.space !== state.space) { spaceEl.setAttribute("transform", translateAlong(P, [0, 0, -state.space * 8])); drawn.space = state.space; }
  const ring = still.matches ? 0 : pulse(state.clock - state.bellAt, 0, 0.04, 0.06, 0.18);
  if (drawn.hammer !== ring) { hammerEl.innerHTML = hammer(ring); drawn.hammer = ring; }
  // the newest letter stays lit for a moment
  if (state.fresh) {
    const age = state.clock - state.fresh.at;
    const alpha = still.matches ? 0 : Math.max(0, 1 - age / 0.9);
    freshEl.style.opacity = alpha.toFixed(2);
    if (alpha === 0) state.fresh = null;
  }
  const mm = (state.col * 2.54).toFixed(1).replace(".", ",");
  const text = speaking > state.clock ? sayText : "col " + state.col + " · " + mm + " mm · linha " + (state.line + 1);
  if (readout.textContent !== text) readout.textContent = text;
}
let speaking = 0, sayText = "";
function say(text) { sayText = text; speaking = state.clock + 1.2; status.textContent = text; }

const esc = (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c);
function lineSvg2(text, n, cls) {
  const xs = [];
  let chars = "";
  [...text].forEach((ch, c) => { if (ch !== " ") { xs.push((LM + c * PITCH + 0.1).toFixed(2)); chars += esc(ch); } });
  if (!chars) return "";
  const z = ZP - 2.9 + (state.line - n) * LS;
  return '<text class="' + cls + '" font-size="' + LS + '" x="' + xs.join(" ") + '" y="' + (-z).toFixed(2) + '">' + chars + "</text>";
}
function writeText() {
  let html = state.lines.map((text, n) => lineSvg2(text, n, "tw-type")).join("");
  for (const o of state.over || []) html += lineSvg2(" ".repeat(o.col) + o.ch, o.line, "tw-type");
  textEl.innerHTML = html;
  textEl.setAttribute("transform", "translate(0 " + (-state.feed).toFixed(2) + ")");
  if (state.fresh) {
    const z = ZP - 2.9 + (state.line - state.fresh.line) * LS;
    freshEl.setAttribute("x", (LM + state.fresh.col * PITCH + 0.1).toFixed(2));
    freshEl.setAttribute("y", (-z).toFixed(2));
    freshEl.textContent = state.fresh.ch;
  }
}
function newSheet() {
  Object.assign(state, { col: 0, line: 0, lines: [""], Xgoal: xOfCol(0), starGoal: 0, feed: 0, feedGoal: 0, fresh: null, over: [] });
  startReturn();
  freshEl.textContent = "";
  writeText();
}

function tourStep(dt) {
  tour.wait -= dt;
  if (tour.wait > 0 || queue.length) return;
  const phrase = PHRASES[tour.phrase];
  if (tour.step === "type") {
    if (tour.index < phrase.length) {
      const ch = phrase[tour.index++];
      typeChar(ch);
      tour.wait = 0.16 + Math.random() * 0.14 + (ch === " " ? 0.06 : 0);
    } else { tour.step = "return"; tour.wait = 1.0; }
  } else if (tour.step === "return") {
    enqueue("return");
    tour.phrase++; tour.index = 0; tour.step = tour.phrase < PHRASES.length ? "type" : "rest"; tour.wait = 1.4;
  } else if (tour.step === "rest") {
    newSheet(); tour = { phrase: 0, index: 0, wait: 1.6, step: "type" };
  }
}

function tick(now) {
  const dt = (previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60);
  previous = now;
  if (touring) tourStep(dt);
  update(dt);
  draw();
  const busy = touring || queue.length || strokes.length || state.X !== state.Xgoal || state.feed !== state.feedGoal || state.star !== state.starGoal || state.fresh || state.drop > 0.001 || state.clock - state.bellAt < 0.3 || speaking > state.clock;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { previous = 0; frame = requestAnimationFrame(tick); } }
function takeOver() {
  if (touring) { touring = false; queue.length = 0; strokes.length = 0; newSheet(); }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (still.matches) return; newSheet(); tour = { phrase: 0, index: 0, wait: 1.2, step: "type" }; touring = true; run(); }, 12000);
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  if (key === "Tab") return;
  if (key === "Enter") { event.preventDefault(); takeOver(); enqueue("return"); return; }
  if (key === "Backspace") { event.preventDefault(); takeOver(); enqueue("back"); return; }
  if (key === "Escape") { event.preventDefault(); takeOver(); strokes.length = 0; queue.length = 0; newSheet(); run(); return; }
  if (key.length === 1) {
    const plain = key.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const ch = key.toLowerCase() === "ç" ? key : plain;
    event.preventDefault();
    takeOver();
    typeChar(ch);
  }
});
svg.addEventListener("click", (event) => {
  const keyNode = event.target.closest("[data-key]");
  if (keyNode) {
    takeOver();
    const key = KEYS[Number(keyNode.dataset.key)];
    if (key.ch === "Backspace") enqueue("back");
    else if (key.bar >= 0) typeChar(key.ch);
    stage.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest('[data-part="space"]')) { takeOver(); typeChar(" "); stage.focus({ preventScroll: true }); return; }
  if (event.target.closest('[data-part="lever"]')) { takeOver(); enqueue("return"); stage.focus({ preventScroll: true }); }
});
writeText();
draw();
