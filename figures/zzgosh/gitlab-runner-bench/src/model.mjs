// The truth the figure shows: a GitLab pipeline whose jobs are picked up by
// runners that poll the coordinator, run the job and report back.
//
// - Every push creates one pipeline for that commit. Its status (pending,
//   running, passed, canceled) belongs to the commit, as in GitLab's commit list.
// - Stages run in order; the jobs of one stage run in parallel (no `needs:`).
//   A stage's jobs go from `created` to `pending` once every job of the stage
//   before it has passed.
// - A runner never receives a push. It asks: `POST /api/v4/jobs/request`,
//   every `check_interval` (3 s by default) while it has a free slot.
//   GitLab answers 201 with the oldest pending job whose tags are all among the
//   runner's tags, or 204 when there is none.
// - The runner runs the job in its executor, streams the log back
//   (`PATCH /api/v4/jobs/:id/trace`) and reports the final state
//   (`PUT /api/v4/jobs/:id`). Each runner here has `concurrent = 1`.
// - Every job here is `interruptible: true`, so with the default auto-cancel
//   (`on_new_commit: conservative`) a newer commit on the branch cancels the
//   older pipeline, running jobs included; a runner learns it from the
//   reply to its next trace update and aborts.

export const CHECK_INTERVAL = 3;
export const STAGES = ["build", "test", "deploy"];
export const JOBS = [
  { name: "compile", stage: 0, tags: ["docker"], dur: 4.2 },
  { name: "unit", stage: 1, tags: ["docker"], dur: 5.6 },
  { name: "lint", stage: 1, tags: ["docker"], dur: 3.2 },
  { name: "e2e", stage: 1, tags: ["docker"], dur: 4.8 },
  { name: "deploy", stage: 2, tags: ["prod"], dur: 3.4 },
];
export const RUNNERS = [
  { name: "runner-a", tags: ["docker"], firstPoll: 0.6 },
  { name: "runner-b", tags: ["docker", "prod"], firstPoll: 2.1 },
];

// Timings of the machine itself (not GitLab's): how long the moves take.
export const TRIP = 0.5; // one way along the API cable
export const DRIVE = 1.3; // carriage between pickup and executor
export const LIFT = 0.32; // gantry quill up or down
export const SPAN = 150; // gantry speed, units per second
export const REST = 4; // pause after a passed pipeline before the next push
export const SWEEP = 0.14; // job lamps reset one after another when a pipeline is created
export const KEEP = 5; // commits kept on the rack

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fits = (job, runner) => job.tags.every((tag) => runner.tags.includes(tag));
// A short SHA that is the same for the same pipeline number on every load.
export const shaOf = (number) => {
  let h = (number * 2654435761) >>> 0;
  let out = "";
  for (let i = 0; i < 7; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    out += "0123456789abcdef"[h & 15];
  }
  return out;
};

// `place` gives the gantry the world points it travels to:
// { slot(index) -> [x, y], seat(runnerIndex) -> [x, y], up, atSlot, atSeat }.
export function createSim(place) {
  const sim = {
    t: 0,
    number: 11,
    state: "running",
    restAt: 0,
    createdAt: 0,
    pushes: 0,
    commits: [
      { number: 9, sha: shaOf(9), status: "passed" },
      { number: 10, sha: shaOf(10), status: "canceled" },
      { number: 11, sha: shaOf(11), status: "passed" },
    ],
    jobs: JOBS.map((job, index) => ({ ...job, index, state: "created", prev: "passed", where: "slot", runner: -1 })),
    runners: RUNNERS.map((runner, index) => ({
      ...runner,
      index,
      online: true,
      state: "idle",
      nextPoll: runner.firstPoll,
      job: -1,
      pipe: 0, // the pipeline the runner's job belongs to
      pulse: null, // { dir: "up" | "down", at: 0..1, kind: "ask" | "job" | "none" }
      drive: 0, // 0 at pickup, 1 at executor
      backFrom: 1,
      phaseAt: 0,
    })),
    gantry: { x: place.slot(0)[0], y: place.slot(0)[1], z: place.up, legs: [], queue: [], task: null, holding: -1 },
    last: "",
  };
  const commit = () => sim.commits[sim.commits.length - 1];

  const startPipeline = () => {
    sim.number += 1;
    sim.state = "running";
    sim.createdAt = sim.t;
    sim.commits.push({ number: sim.number, sha: shaOf(sim.number), status: "pending" });
    if (sim.commits.length > KEEP + 1) sim.commits.shift();
    for (const job of sim.jobs) {
      job.prev = job.state === "passed" ? "passed" : job.state === "created" ? "created" : "canceled";
      Object.assign(job, { state: "created", runner: -1 });
    }
    unlock();
  };

  const unlock = () => {
    for (let stage = 0; stage < STAGES.length; stage++) {
      const jobs = sim.jobs.filter((job) => job.stage === stage);
      if (jobs.some((job) => job.state === "created")) {
        for (const job of jobs) if (job.state === "created") job.state = "pending";
        return;
      }
      if (!jobs.every((job) => job.state === "passed")) return;
    }
    if (sim.state === "running") {
      sim.state = "passed";
      sim.restAt = sim.t;
      commit().status = "passed";
      sim.last = `pipeline #${sim.number} passed`;
    }
  };

  // A newer commit cancels this pipeline: queued hand-offs are dropped and
  // every runner holding one of its jobs aborts and brings the job back.
  const cancel = () => {
    commit().status = "canceled";
    const g = sim.gantry;
    for (const runner of sim.runners) {
      if (runner.job < 0) continue;
      if (runner.state === "assigned") {
        const queued = g.queue.findIndex((task) => task.kind === "deliver" && task.runner === runner.index);
        if (queued >= 0) {
          g.queue.splice(queued, 1);
          runner.job = -1;
          runner.state = "idle";
          runner.nextPoll = sim.t + 0.4;
        }
      } else if (runner.state === "loaded" || runner.state === "running") {
        runner.state = "back";
        runner.backFrom = runner.drive;
        runner.phaseAt = sim.t;
      }
    }
  };

  // The gantry is the coordinator's hand: it carries the job to a runner's
  // pickup seat and back. Its legs are straight moves eased end to end.
  const leg = (to, after) => {
    const g = sim.gantry;
    const from = g.legs.length ? g.legs[g.legs.length - 1].to : [g.x, g.y, g.z];
    const flat = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const dur = flat > 0.01 ? Math.max(0.35, flat / SPAN) : LIFT;
    g.legs.push({ from, to, dur, at: 0, after });
  };
  const transfer = (fromXY, fromZ, toXY, toZ, onGrip, onDrop) => {
    leg([fromXY[0], fromXY[1], place.up]);
    leg([fromXY[0], fromXY[1], fromZ], onGrip);
    leg([fromXY[0], fromXY[1], place.up]);
    leg([toXY[0], toXY[1], place.up]);
    leg([toXY[0], toXY[1], toZ], onDrop);
    leg([toXY[0], toXY[1], place.up]);
  };
  const runTask = (task) => {
    const g = sim.gantry;
    g.task = task;
    const job = sim.jobs[task.job];
    const runner = sim.runners[task.runner];
    if (task.kind === "deliver") {
      transfer(place.slot(job.index), place.atSlot, place.seat(runner.index), place.atSeat,
        () => { g.holding = job.index; job.where = "gantry"; },
        () => { g.holding = -1; job.where = "runner"; runner.state = "loaded"; runner.phaseAt = sim.t; });
    } else {
      transfer(place.seat(runner.index), place.atSeat, place.slot(job.index), place.atSlot,
        () => { g.holding = job.index; job.where = "gantry"; runner.job = -1; runner.state = "idle"; runner.nextPoll = sim.t + 0.4; },
        () => { g.holding = -1; job.where = "slot"; });
    }
  };

  // A job can be handed out only while its puck is home and nobody holds it.
  const free = (job) => job.where === "slot" && !sim.runners.some((runner) => runner.job === job.index);
  const poll = (runner) => {
    const job = sim.jobs.find((candidate) => candidate.state === "pending" && free(candidate) && fits(candidate, runner));
    if (!job) return "none";
    job.state = "running";
    job.runner = runner.index;
    runner.job = job.index;
    runner.pipe = sim.number;
    if (commit().status === "pending") commit().status = "running";
    sim.last = `${runner.name} picked ${job.name}`;
    return "job";
  };

  const stepRunner = (runner, dt) => {
    if (runner.pulse) {
      runner.pulse.at += dt / TRIP;
      if (runner.pulse.at >= 1) {
        if (runner.pulse.dir === "up") {
          runner.pulse = { dir: "down", at: 0, kind: poll(runner) };
        } else {
          const kind = runner.pulse.kind;
          runner.pulse = null;
          if (kind === "job" && runner.pipe === sim.number) {
            runner.state = "assigned";
            sim.gantry.queue.push({ kind: "deliver", job: runner.job, runner: runner.index });
          } else {
            // A job canceled while its answer was on the way is never fetched.
            runner.job = -1;
            runner.state = "idle";
            runner.nextPoll = sim.t + (kind === "job" ? 0.4 : CHECK_INTERVAL);
          }
        }
      }
      return;
    }
    if (runner.state === "idle" && runner.online && sim.t >= runner.nextPoll) {
      runner.state = "polling";
      runner.pulse = { dir: "up", at: 0, kind: "ask" };
    } else if (runner.state === "loaded") {
      if (runner.pipe !== sim.number) {
        runner.state = "back";
        runner.backFrom = runner.drive;
        runner.phaseAt = sim.t;
        return;
      }
      runner.drive = smooth((sim.t - runner.phaseAt) / DRIVE);
      if (sim.t - runner.phaseAt >= DRIVE) {
        runner.state = "running";
        runner.phaseAt = sim.t;
      }
    } else if (runner.state === "running") {
      const job = sim.jobs[runner.job];
      if (sim.t - runner.phaseAt >= job.dur) {
        job.state = "passed";
        sim.last = `${runner.name} reported ${job.name} passed`;
        runner.state = "back";
        runner.backFrom = 1;
        runner.phaseAt = sim.t;
        unlock();
      }
    } else if (runner.state === "back") {
      const dur = DRIVE * Math.max(0.25, runner.backFrom);
      runner.drive = runner.backFrom * (1 - smooth((sim.t - runner.phaseAt) / dur));
      if (sim.t - runner.phaseAt >= dur) {
        runner.drive = 0;
        runner.state = "done";
        sim.gantry.queue.push({ kind: "return", job: runner.job, runner: runner.index });
      }
    }
  };

  const stepGantry = (dt) => {
    const g = sim.gantry;
    if (!g.legs.length) {
      g.task = null;
      // Returns first: they free a runner and cost the coordinator nothing.
      const next = g.queue.findIndex((task) => task.kind === "return");
      const pick = next >= 0 ? next : g.queue.length ? 0 : -1;
      if (pick >= 0) runTask(g.queue.splice(pick, 1)[0]);
      return;
    }
    const current = g.legs[0];
    current.at += dt / current.dur;
    const k = smooth(current.at);
    [g.x, g.y, g.z] = current.from.map((value, axis) => value + (current.to[axis] - value) * k);
    if (current.at >= 1) {
      g.legs.shift();
      current.after?.();
    }
  };

  sim.step = (dt) => {
    // Fixed sub-steps keep every threshold exact whatever the frame rate.
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 120);
      left -= h;
      sim.t += h;
      stepGantry(h);
      for (const runner of sim.runners) stepRunner(runner, h);
      if (sim.state === "passed" && sim.t - sim.restAt >= REST) {
        startPipeline();
        sim.last = `pushed ${commit().sha} · pipeline #${sim.number} created`;
      }
    }
  };
  sim.push = () => {
    sim.pushes += 1;
    const old = sim.state === "running" ? sim.number : 0;
    if (old) cancel();
    startPipeline();
    sim.last = `pushed ${commit().sha} · pipeline #${sim.number} created` + (old ? ` · #${old} canceled` : "");
  };
  sim.toggle = (index) => {
    const runner = sim.runners[index];
    runner.online = !runner.online;
    sim.last = `${runner.name} ${runner.online ? "resumed" : "paused"}`;
    if (runner.online && runner.state === "idle") runner.nextPoll = Math.min(runner.nextPoll, sim.t + 0.2);
  };
  // What a job's lamp shows: after a push the lamps reset to the new pipeline one by one.
  sim.lamp = (job) => (sim.t < sim.createdAt + 0.25 + SWEEP * job.index ? job.prev : job.state);
  sim.stage = () => {
    for (let stage = 0; stage < STAGES.length; stage++) {
      if (sim.jobs.some((job) => job.stage === stage && job.state !== "passed")) return stage;
    }
    return -1;
  };
  sim.readout = () => {
    const head = `#${sim.number} ${commit().sha}`;
    const stage = sim.stage();
    if (stage < 0) return `${head} · passed`;
    const jobs = sim.jobs.filter((job) => job.stage === stage);
    const pending = jobs.filter((job) => job.state === "pending");
    const running = jobs.filter((job) => job.state === "running");
    const stuck = pending.find((job) => !sim.runners.some((runner) => runner.online && fits(job, runner)));
    if (stuck) return `${head} · ${stuck.name} stuck: no ${stuck.tags.join(",")} runner`;
    const parts = [`${head} · ${STAGES[stage]}`];
    if (running.length) parts.push(`${running.length} running`);
    if (pending.length) parts.push(`${pending.length} pending`);
    return parts.join(" · ");
  };
  sim.fits = fits;
  startPipeline();
  sim.createdAt = -10;
  sim.last = `pipeline #${sim.number} created`;
  return sim;
}
