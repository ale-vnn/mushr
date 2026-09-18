/**
 * Application state, and the selectors every view reads it through.
 *
 * One load feeds everything: the list, the map and the detail panel read the
 * same `state.forests`, the same scores and the same day offset. They are three
 * renderings of one thing, not three features.
 *
 * There are two ways in. **Browse** loads one department. **Follow** loads the
 * departments of the forests you picked, wherever they are, and reports what
 * changed since your last visit. Both end up with the same shape in
 * `state.forests`, which is why the views know nothing about the difference.
 */

import { loadDepartment } from "./data.js";
import { fetchConditions, RateLimited, PAST_DAYS, FORECAST_DAYS, HISTORY_DAYS } from "./weather.js";
import { buildSeries, scoreSeries, trajectory, band } from "./score.js";
import { getPrefs, setPrefs, readCache, writeCache, getLastSeen, rememberSeen } from "./store.js";

export { PAST_DAYS, FORECAST_DAYS, HISTORY_DAYS };

// Today sits right after the past days Open-Meteo was asked for.
export const TODAY_INDEX = PAST_DAYS;
// Where the charts start: a month of history, and the forecast after it.
export const CHART_FROM = TODAY_INDEX - HISTORY_DAYS;

export const state = {
  mode: getPrefs().mode ?? "browse",
  dept: null,
  forests: [],
  status: "idle", // idle | loading | waiting | blocked | ready | error
  error: null,
  retryAt: null, // epoch ms, while status is "waiting"
  quota: null, // "minutely" | "hourly" | "daily", while waiting or blocked
  dayOffset: getPrefs().day ?? 0,
  selected: getPrefs().selected ?? null,
  changes: {}, // forest id -> { from, to } since the last visit, follow mode only
};

// One load at a time. Flicking through departments used to leave every request
// in flight, each one spending quota on a result nobody would read.
let inFlight = null;
let retryTimer = null;
let lastWork = null;

const views = new Set();

export const onRender = (fn) => views.add(fn);
export const render = () => views.forEach((fn) => fn());

// ------------------------------------------------------------------ loading

/**
 * Indicators plus weather for one department, cached for an hour.
 *
 * One Open-Meteo request covers a whole department — the API takes a list of
 * coordinates and answers with one block per point, so this is one round trip
 * rather than one per forest.
 */
async function scoredDepartment(code, signal) {
  const forests = await loadDepartment(code);
  const key = `${code}:${forests.length}`;
  const cached = readCache(key);
  const answer = cached?.series ?? (await fetchConditions(forests, { signal }));
  if (!cached) writeCache(key, answer);
  return forests.map((forest, i) => {
    const series = buildSeries(answer.blocks[answer.index[i]]);
    return { ...forest, dept: code, series, scores: scoreSeries(series) };
  });
}

/**
 * Run a load, turning a quota ceiling into a wait rather than a failure.
 *
 * Any load supersedes the one before it: the previous request is aborted and a
 * pending retry dropped, so changing your mind costs nothing.
 */
async function run(work) {
  inFlight?.abort();
  clearTimeout(retryTimer);
  const controller = (inFlight = new AbortController());

  lastWork = work;
  state.status = "loading";
  state.error = null;
  state.retryAt = null;
  state.quota = null;
  render();

  try {
    await work(controller.signal);
    state.status = "ready";
  } catch (error) {
    if (controller.signal.aborted) return; // superseded; the new load owns the state
    state.forests = [];
    if (error instanceof RateLimited) {
      state.quota = error.scope;
      if (error.retryAfterMs > 0) {
        state.status = "waiting";
        state.retryAt = Date.now() + error.retryAfterMs;
        retryTimer = setTimeout(() => run(work), error.retryAfterMs);
      } else {
        state.status = "blocked";
      }
    } else {
      state.status = "error";
      state.error = error.message || String(error);
    }
  }
  render();
}

/** Try the last load again, for the button a blocked quota puts on screen. */
export function retry() {
  if (lastWork) run(lastWork);
}

export async function selectDepartment(code) {
  if (!code) return;
  state.mode = "browse";
  state.dept = code;
  state.selected = null;
  state.changes = {};
  setPrefs({ mode: "browse", dept: code, selected: null });
  await run(async (signal) => {
    state.forests = await scoredDepartment(code, signal);
  });
}

/**
 * The forests you follow, wherever they are.
 *
 * Favourites are ids and nothing else, and an id does not say which department
 * it belongs to. The map from id to department comes from the departments
 * already loaded, so a followed forest is remembered with its department the
 * first time it is followed — see `noteDepartment`.
 */
export async function loadFollowed() {
  const prefs = getPrefs();
  state.mode = "follow";
  state.dept = null;
  state.selected = null;
  setPrefs({ mode: "follow", selected: null });

  const wanted = prefs.favourites;
  if (!wanted.length) {
    state.forests = [];
    state.changes = {};
    state.status = "ready";
    render();
    return;
  }

  await run(async (signal) => {
    const codes = [...new Set(wanted.map((id) => prefs.followDepts?.[id]).filter(Boolean))];
    // In series, not in parallel: several departments at once is the surest way
    // to trip the minutely quota, and the board is not worth a stampede.
    const loaded = [];
    for (const code of codes) loaded.push(await scoredDepartment(code, signal));
    const byId = new Map(loaded.flat().map((f) => [f.id, f]));
    state.forests = wanted.map((id) => byId.get(id)).filter(Boolean);

    // What changed since the last visit, before recording what is shown now.
    state.changes = Object.fromEntries(
      state.forests.map((f) => {
        const to = band(entryFor(f, 0)?.score ?? null).key;
        return [f.id, { from: getLastSeen(f.id), to }];
      }),
    );
    rememberSeen(Object.fromEntries(state.forests.map((f) => [f.id, state.changes[f.id].to])));
  });
}

/** Remember which department a followed forest lives in, so it can be reloaded. */
export function noteDepartment(id, dept) {
  const prefs = getPrefs();
  setPrefs({ followDepts: { ...(prefs.followDepts || {}), [id]: dept } });
}

// ---------------------------------------------------------------- selectors

export function entryFor(forest, offset = state.dayOffset) {
  return forest.scores?.[TODAY_INDEX + offset] ?? null;
}

export const scoreOf = (forest) => entryFor(forest)?.score ?? null;
export const bandOf = (forest) => band(scoreOf(forest));

export const trajectoryFor = (forest) =>
  forest.scores ? trajectory(forest.scores, TODAY_INDEX, FORECAST_DAYS) : null;

export const slopeOf = (forest) => trajectoryFor(forest)?.slope ?? -Infinity;

export function matchesFilters(forest) {
  // The follow list is a list you built by hand; filtering it would be the
  // application second-guessing an explicit choice.
  if (state.mode === "follow") return true;
  const p = getPrefs();
  if (!p.ownership.includes(forest.ownership)) return false;
  if (forest.area_ha < p.minArea) return false;
  const score = scoreOf(forest);
  if (p.minScore > 0 && (score == null || score < p.minScore)) return false;
  return true;
}

const SORTS = {
  score: (a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1),
  trend: (a, b) => slopeOf(b) - slopeOf(a),
  area: (a, b) => b.area_ha - a.area_ha,
  name: (a, b) => a.name.localeCompare(b.name),
};

export function visibleForests() {
  const sort = SORTS[getPrefs().sort] ?? SORTS.score;
  return state.forests.filter(matchesFilters).sort(sort);
}

export const forestById = (id) => state.forests.find((f) => f.id === id) ?? null;

export function setDay(offset) {
  state.dayOffset = offset;
  setPrefs({ day: offset });
  render();
}

export function setSelected(id) {
  state.selected = state.selected === id ? null : id;
  setPrefs({ selected: state.selected });
  render();
}
