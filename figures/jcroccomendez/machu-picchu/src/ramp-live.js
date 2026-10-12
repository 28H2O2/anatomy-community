// Fig 2 has its own loop, so a hidden figure never advances or spends time drawing.
const rampLive = (() => {
  const { P } = __RAMP_DATA__;
  const stage = document.querySelector('[data-ramp-stage]');
  const svg = stage.querySelector('svg');
  const moving = svg.querySelector('[data-ramp-moving]');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const k = { iso, pathOf, solidSvg, lineSvg, depthOf, cylinder };
  const parts = makeRampParts(k, GG, { RAMP_DEG, rampPerFigure }, P);
  const fields = new Map();
  const $ = (key) => { if (!fields.has(key)) fields.set(key, document.querySelector(`[data-ramp-${key}]`)); return fields.get(key); };
  const teams = $('teams'), toggle = $('toggle');
  const massButtons = [...document.querySelectorAll('[data-ramp-mass]')];
  let language = 'en', active = location.hash === '#fig-2', visible = false;
  let state = { kg: 10000, crew: 220, seconds: 0, distance: 0, reset: -1 };
  let playing = !media.matches, frame = 0, last = 0, rendered = -1, readKey = '';
  let levers, crew, generation = 0;
  let preparedKey = '10000:220', prefix = 'ramp-initial', definitions;
  let requestedKey = '', readyPoses = new Set([0]), queue = [], commitScheduled = false;
  const baseCache = new Map();
  const selectionKey = () => `${state.kg}:${state.crew}`;
  // Input tasks take priority over adding another pose. Each task inserts at most one pose.
  const background = (callback) => {
    if (globalThis.scheduler?.postTask) scheduler.postTask(callback, { priority: 'background' });
    else setTimeout(callback, 0);
  };
  const POSES = 24;
  const t = () => TEXT[language].fig2;
  const number = (value, digits = 0) => num(language, value, digits);
  const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };

  // Adopt the server-built rest pose without recalculating or reparsing the drawing on tab click.
  function adoptInitialPose() {
    definitions = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const addUse = (part, name) => {
      const art = moving.querySelector(`[data-ramp-${part}]`);
      art.removeAttribute(`data-ramp-${part}`);
      art.id = `${prefix}-${name}-0`;
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute(`data-ramp-${part}`, '');
      use.setAttribute('href', `#${art.id}`);
      art.replaceWith(use);
      definitions.append(art);
      return use;
    };
    levers = addUse('levers', 'l');
    crew = addUse('crew', 'c');
    moving.prepend(definitions);
    moving.dataset.poseId = prefix;
    moving.dataset.figures = '22';
    moving.dataset.posesReady = '1';
  }

  function commitPose(message) {
    if (message.version !== generation || `${message.kg}:${message.crew}` !== selectionKey()) return;
    const { index, art } = message;
    if (index === 0 && preparedKey !== selectionKey()) {
      prefix = `ramp-${generation}`;
      moving.innerHTML = `<defs><g id="${prefix}-l-0">${art.levers}</g><g id="${prefix}-c-0">${art.crew}</g></defs><use data-ramp-levers href="#${prefix}-l-0"/><g data-ramp-block>${art.block}</g><use data-ramp-crew href="#${prefix}-c-0"/>`;
      definitions = moving.querySelector('defs');
      levers = moving.querySelector('[data-ramp-levers]');
      crew = moving.querySelector('[data-ramp-crew]');
      moving.dataset.poseId = prefix;
      preparedKey = selectionKey();
      readyPoses = new Set([0]);
      moving.dataset.figures = String(Math.ceil(state.crew / rampPerFigure(state.kg)));
      stage.removeAttribute('data-building');
      stage.setAttribute('aria-busy', 'false');
    } else if (!readyPoses.has(index)) {
      definitions.insertAdjacentHTML('beforeend', `<g id="${prefix}-l-${index}">${art.levers}</g><g id="${prefix}-c-${index}">${art.crew}</g>`);
      readyPoses.add(index);
    }
    moving.dataset.posesReady = String(readyPoses.size);
    rendered = -1;
    draw();
    run();
  }

  function receivePose(message) {
    if (message.version !== generation) return;
    if (message.index === 0) {
      const key = `${message.kg}:${message.crew}`;
      baseCache.delete(key);
      baseCache.set(key, message.art);
      if (baseCache.size > 6) baseCache.delete(baseCache.keys().next().value);
    }
    queue.push(message);
    scheduleCommit();
  }
  function scheduleCommit() {
    if (commitScheduled || !queue.length) return;
    commitScheduled = true;
    background(() => {
      commitScheduled = false;
      const message = queue.shift();
      if (message) commitPose(message);
      scheduleCommit();
    });
  }

  // Geometry is built one pose per background task, so input and painting continue between poses.
  function startFallback(version, kg, count) {
    const crewSize = state.crew;
    const enough = rampLoad(kg, crewSize).enough;
    const order = [0, 10, ...Array.from({ length: count }, (_, i) => i).filter((i) => i !== 0 && i !== 10)];
    let next = 0;
    function buildNext() {
      if (version !== generation || next === order.length) return;
      const index = order[next++];
      const pose = rampPose(index / count * RAMP_CYCLE, enough);
      const art = parts.pose(kg, crewSize, pose.pull, pose.step);
      if (index !== 0) delete art.block;
      receivePose({ version, kg, crew: crewSize, index, art });
      background(buildNext);
    }
    background(buildNext);
  }
  function prepareParts() {
    if (requestedKey === selectionKey()) return;
    requestedKey = selectionKey();
    const version = ++generation;
    queue = [];
    if (preparedKey !== requestedKey) {
      stage.setAttribute('data-building', '');
      stage.setAttribute('aria-busy', 'true');
      const cached = baseCache.get(requestedKey);
      if (cached) receivePose({ version, kg: state.kg, crew: state.crew, index: 0, art: cached });
    } else {
      stage.removeAttribute('data-building');
      stage.setAttribute('aria-busy', 'false');
    }
    // Let the pressed button and readout paint before starting even the asynchronous preparation.
    requestAnimationFrame(() => background(() => {
      if (version !== generation) return;
      stage.dataset.renderer = 'fallback';
      startFallback(version, state.kg, POSES);
    }));
  }

  function buildTeams() {
    const counts = rampTeams(state.kg);
    // Preserve the focused crew button when only its selection or language changes.
    if (teams.dataset.options !== counts.join(',')) {
      teams.innerHTML = counts.map((count) => `<button type="button" data-ramp-crew-size="${count}"></button>`).join('');
      teams.dataset.options = counts.join(',');
    }
    [...teams.children].forEach((button) => {
      const count = Number(button.dataset.rampCrewSize);
      setText(button, number(count));
      button.setAttribute('aria-pressed', String(count === state.crew));
      button.setAttribute('aria-label', `${number(count)} ${t().people}`);
    });
  }

  function reset() {
    state = { ...state, seconds: 0, distance: 0, reset: -1 };
    last = 0;
    draw();
    run();
  }

  function refresh(next = language) {
    language = next;
    buildTeams();
    massButtons.forEach((button) => {
      const kg = Number(button.dataset.rampMass);
      button.setAttribute('aria-pressed', String(kg === state.kg));
      button.textContent = `${number(kg / 1000, kg === 900 ? 1 : 0)} t`;
    });
    draw();
  }

  function draw() {
    const load = rampLoad(state.kg, state.crew);
    const pose = rampPose(state.seconds, load.enough);
    const index = media.matches ? (load.enough ? 0 : 10) : Math.min(POSES - 1, Math.floor(pose.phase * POSES));
    const availableIndex = readyPoses.has(index) ? index : [...readyPoses].filter((i) => i <= index).sort((a, b) => b - a)[0] ?? 0;
    if (preparedKey === selectionKey() && availableIndex !== rendered) {
      levers.setAttribute('href', `#${moving.dataset.poseId}-l-${availableIndex}`);
      crew.setAttribute('href', `#${moving.dataset.poseId}-c-${availableIndex}`);
      rendered = availableIndex;
    }
    const plan = state.distance * Math.cos(RAMP_DEG * Math.PI / 180) * 10;
    moving.setAttribute('transform', translateAlong(P, [-plan, 0, plan * Math.tan(RAMP_DEG * Math.PI / 180)]));
    moving.setAttribute('opacity', rampOpacity(state));
    stage.dataset.distance = state.distance.toFixed(5);
    stage.dataset.seconds = state.seconds.toFixed(5);
    stage.dataset.phase = state.reset >= 0 ? 'reset' : pose.stage;
    const status = load.enough ? t().enough : fmt(t().missing, { count: number(load.missing) });
    const phaseText = media.matches ? t().reduced : state.reset >= 0 ? t().phases.reset : !playing ? t().paused : t().phases[pose.stage];
    setText($('status'), `${status} · ${phaseText}`);
    setText($('distance'), number(state.distance, 2));
    const seconds = Math.floor(state.seconds);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    setText($('travel'), fmt(t().travel, { m: number(state.distance, 2), time }));
    const per = rampPerFigure(state.kg);
    setText($('legend'), fmt(t().legend, { crew: number(state.crew), per }) + (state.crew % per ? fmt(t().partial, { count: state.crew % per }) : ''));
    setText($('summary'), fmt(t().summary, { t: number(state.kg / 1000, state.kg === 900 ? 1 : 0), deg: RAMP_DEG, needed: number(load.needed) }));
    $('small').hidden = state.kg !== 900;
    setText($('small'), fmt(t().smallNote, { flat: crewOf(dragOf(900)), ramp: load.needed }));
    setText($('required'), `${number(load.required / 1000, 1)} kN`);
    setText($('available'), `${number(load.available / 1000, 1)} kN`);
    const max = Math.max(load.required, load.available);
    $('required-bar').style.width = `${load.required / max * 100}%`;
    $('available-bar').style.width = `${load.available / max * 100}%`;
    $('force').setAttribute('aria-label', `${t().forceLabel}: ${t().required} ${number(load.required / 1000, 1)} kN; ${t().available} ${number(load.available / 1000, 1)} kN`);
    toggle.hidden = media.matches;
    setText(toggle, playing ? t().pause : t().play);
    toggle.setAttribute('aria-pressed', String(playing));
    // At most one accessible update per second; the visual meter may update every frame.
    const key = `${language}|${state.kg}|${state.crew}|${seconds}|${playing}`;
    if (key !== readKey) {
      readKey = key;
      svg.setAttribute('aria-label', fmt(t().description, { t: number(state.kg / 1000, state.kg === 900 ? 1 : 0), crew: number(state.crew), per, m: number(state.distance, 2), status }));
    }
  }

  function tick(now) {
    frame = 0;
    if (!active || !visible || !playing || media.matches || document.hidden || preparedKey !== selectionKey()) { last = 0; return; }
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
    last = now;
    state = advanceRamp(state, dt);
    draw();
    run();
  }
  function run() {
    if (!frame && active && visible && playing && !media.matches && !document.hidden && preparedKey === selectionKey()) frame = requestAnimationFrame(tick);
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; }
  function setActive(next) { active = next; if (!active) stop(); else { prepareParts(); draw(); run(); } }
  function playPause() { if (media.matches) { tug(); return; } playing = !playing; stop(); draw(); run(); }
  function tug() {
    playing = false;
    stop();
    if (state.reset >= 0) reset();
    // Explicit input advances one entire tug even under reduced motion.
    const until = (Math.floor(state.seconds / RAMP_CYCLE) + 1) * RAMP_CYCLE - state.seconds;
    state = advanceRamp(state, until);
    draw();
  }
  teams.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ramp-crew-size]');
    if (!button) return;
    const next = Number(button.dataset.rampCrewSize);
    if (next === state.crew) return;
    state.crew = next;
    stop(); prepareParts(); refresh(); reset();
  });
  massButtons.forEach((button) => button.addEventListener('click', () => {
    const kg = Number(button.dataset.rampMass);
    if (kg === state.kg) return;
    state.kg = kg;
    state.crew = rampTeams(kg)[2];
    stop(); prepareParts(); refresh(); reset();
  }));
  toggle.addEventListener('click', playPause);
  $('tug').addEventListener('click', tug);
  $('reset').addEventListener('click', reset);
  stage.addEventListener('keydown', (event) => {
    if (event.key === ' ') { event.preventDefault(); playPause(); }
    if (event.key === 'Enter') { event.preventDefault(); tug(); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); }
  });
  media.addEventListener('change', () => { playing = !media.matches; stop(); draw(); run(); });
  document.addEventListener('visibilitychange', () => { stop(); run(); });
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (!visible) stop(); else run(); }).observe(stage);
  adoptInitialPose();
  if (active) prepareParts();
  refresh();
  return { refresh, setActive };
})();
