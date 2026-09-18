/**
 * Local persistence.
 *
 * Everything lives in this browser: no account, no server, nothing to leak.
 * Foraging spots are the kind of thing people keep to themselves, so the design
 * choice is deliberate rather than incidental.
 *
 * Every access is guarded: localStorage throws in private windows and when the
 * browser is set to block site data, and the application must work without it.
 */

const PREFS_KEY = "mushr.prefs";
const CACHE_KEY = "mushr.conditions.v3";
// Open-Meteo refreshes its models hourly; re-fetching sooner buys nothing.
const CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULTS = {
  dept: null,
  ownership: ["domaniale", "departementale", "communale", "regionale", "autre-publique"],
  minArea: 20,
  minScore: 0,
  sort: "score",
  favourites: [],
  selected: null,
  day: 0, // offset in days from today, 0 = today
  mode: "browse", // browse a department, or follow the forests you picked
  // The band last shown for each followed forest, so the next visit can say
  // what changed. Without a server this is the only alert the application can
  // raise, and it covers the real need: not missing a window for want of
  // opening the page on the right day.
  lastSeen: {},
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked: not worth failing over
  }
}

let prefs = { ...DEFAULTS, ...(read(PREFS_KEY) || {}) };

export const getPrefs = () => prefs;

export function setPrefs(patch) {
  prefs = { ...prefs, ...patch };
  write(PREFS_KEY, prefs);
  return prefs;
}

export const isFavourite = (id) => prefs.favourites.includes(id);

export function toggleFavourite(id) {
  const favourites = isFavourite(id)
    ? prefs.favourites.filter((f) => f !== id)
    : [...prefs.favourites, id];
  setPrefs({ favourites });
  return favourites.includes(id);
}

export const getLastSeen = (id) => prefs.lastSeen[id] ?? null;

/** Remember the bands just shown, so the next visit can report the change. */
export function rememberSeen(entries) {
  setPrefs({ lastSeen: { ...prefs.lastSeen, ...entries } });
}

/**
 * Cached daily series, one entry per department.
 *
 * Keyed by department and forest count so a rebuilt dataset invalidates the
 * entry instead of being silently reused. Following a handful of forests across
 * five departments means five cached blocks, which is why this is a map rather
 * than the single slot it started as.
 */
export function readCache(key) {
  const all = read(CACHE_KEY) || {};
  const entry = all[key];
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) return null;
  return { series: entry.series, at: entry.at };
}

export function writeCache(key, series) {
  const all = read(CACHE_KEY) || {};
  // Drop whatever expired before writing, so the quota is not spent on blocks
  // nobody will read again.
  const now = Date.now();
  for (const [k, v] of Object.entries(all)) {
    if (now - v.at > CACHE_TTL_MS) delete all[k];
  }
  all[key] = { at: now, series };
  write(CACHE_KEY, all);
}
