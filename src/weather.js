/**
 * Open-Meteo client.
 *
 * Open-Meteo needs no API key and sends permissive CORS headers, so the browser
 * talks to it directly: no backend, nothing to deploy, nothing to pay for.
 *
 * One request covers every forest: the API accepts comma-separated coordinate
 * lists and answers with one block per point, which keeps a refresh to a single
 * round trip instead of forty.
 */

import { MODEL } from "./score.js";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

// Days of history the charts show.
export const HISTORY_DAYS = 31;
// The index for a given day needs the rain that fell up to `kernel.max` days
// earlier, so the request reaches that much further back than the charts
// display. Without this warm-up the oldest weeks of every chart would be blank
// for want of their own response window.
export const PAST_DAYS = HISTORY_DAYS + MODEL.kernel.max;
// Soil moisture and soil temperature stop being forecast around day +7, and the
// index needs both, so asking for more would only add uncomputable days. This
// count includes today, hence offsets 0 to FORECAST_DAYS - 1.
export const FORECAST_DAYS = 7;

// Only what the model reads. `temperature_2m_max` was requested for a long
// while and used by nothing; Open-Meteo prices a call by its variables, so an
// unread variable is a sixth of the quota spent on nothing.
const DAILY = ["precipitation_sum", "temperature_2m_min"];
const HOURLY = [
  "soil_temperature_6cm",
  "soil_moisture_3_to_9cm",
  "soil_moisture_9_to_27cm",
];

/**
 * Sampling points are snapped onto a grid before they are asked for.
 *
 * Two massifs four kilometres apart do not have different weather: the models
 * that produce soil moisture and soil temperature run on cells of about seven
 * kilometres, so asking twice inside one cell buys a second copy of the same
 * numbers — at full price, since Open-Meteo bills per point.
 *
 * 0.03° is roughly 3.3 by 2.3 km at French latitudes, so two points that share
 * a cell are almost always in the same model cell too. It removes about a fifth
 * of the points nationally and more than a third in the forested departments.
 * Widening it further would start merging points the model really does
 * distinguish, which is why it stops here.
 */
const GRID = 0.03;

/**
 * Group points onto the grid.
 * Returns the points to ask for, and for each original point the index of the
 * one that stands in for it.
 */
export function groupByCell(points, step = GRID) {
  const cells = new Map();
  const ask = [];
  const index = points.map((p) => {
    const key = `${Math.round(p.lat / step)},${Math.round(p.lon / step)}`;
    if (!cells.has(key)) {
      cells.set(key, ask.length);
      ask.push({ lat: p.lat, lon: p.lon });
    }
    return cells.get(key);
  });
  return { ask, index };
}

/**
 * Soil variables come back every three hours rather than every hour.
 *
 * The hourly series exists for one reason: the thermal trapezoid is not linear,
 * so a day swinging from 6 to 20 °C is not the flat 13 °C it averages to, and
 * the fitness has to be scored per reading and averaged afterwards. Eight
 * readings a day still describe that swing.
 *
 * Measured against a full hourly series over 62 days: the daily thermal fitness
 * moves by 0.8 points of a percent on average and 3.1 at worst, which — at a
 * weight of 0.3 in a geometric mean — is at most 0.6 points on an index of 100.
 * The index is shown as a whole number. The payload falls by 64 %.
 */
const RESOLUTION = "hourly_3";

export function buildUrl(points) {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(","),
    longitude: points.map((p) => p.lon).join(","),
    daily: DAILY.join(","),
    hourly: HOURLY.join(","),
    timezone: "Europe/Paris",
    temporal_resolution: RESOLUTION,
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
  });
  return `${ENDPOINT}?${params}`;
}

/**
 * Open-Meteo prices a call by its variables and its locations, so a department
 * of two hundred forests is two hundred calls against a free minutely quota.
 * Flicking through departments hits that ceiling honestly, and the service says
 * so — in English, in its own words, which is not something to put in front of
 * someone looking for mushrooms.
 *
 * So the ceiling gets its own error type. The application waits and retries
 * rather than reporting a failure, because "try again in one minute" is an
 * instruction the application can follow by itself.
 */
export class RateLimited extends Error {
  constructor(scope, retryAfterMs) {
    super(`open-meteo ${scope} quota`);
    this.name = "RateLimited";
    // "minutely" is worth waiting out by itself. "hourly" and "daily" are not:
    // retrying every minute for an hour spends quota to be told the same thing
    // sixty times, so those ask the reader instead.
    this.scope = scope;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Which ceiling was hit, from what the service says about it. */
function quotaScope(body) {
  const reason = body?.reason ?? "";
  if (/minutely/i.test(reason)) return "minutely";
  if (/hourly/i.test(reason)) return "hourly";
  if (/daily/i.test(reason)) return "daily";
  return "minutely"; // a bare 429 is most often the per-minute one
}

const looksRateLimited = (response, body) =>
  response.status === 429 || /limit exceeded/i.test(body?.reason ?? "");

/**
 * Fetch conditions for `points` (objects with `lat` and `lon`).
 *
 * Resolves to `{ blocks, index }`, where `index[i]` is the block standing in for
 * `points[i]`. Several points share a block when they share a grid cell, which
 * is also how it is cached: storing the expanded array would keep the same
 * forecast two or three times over in a five-megabyte store.
 */
export async function fetchConditions(points, { signal } = {}) {
  if (!points.length) return { blocks: [], index: [] };
  const { ask, index } = groupByCell(points);
  const blocks = await fetchPoints(ask, { signal });
  return { blocks, index };
}

async function fetchPoints(points, { signal } = {}) {
  const response = await fetch(buildUrl(points), { signal });
  const body = await response.json().catch(() => null);
  // Open-Meteo reports trouble as {error: true, reason}, sometimes with a 200.
  if (body?.error || !response.ok) {
    if (looksRateLimited(response, body)) {
      const scope = quotaScope(body);
      const header = Number(response.headers.get("retry-after"));
      const wait =
        Number.isFinite(header) && header > 0 ? header * 1000 : scope === "minutely" ? 65000 : 0;
      throw new RateLimited(scope, wait);
    }
    throw new Error(body?.reason || `Open-Meteo HTTP ${response.status}`);
  }
  // A single-point request answers with an object rather than a list.
  const blocks = Array.isArray(body) ? body : [body];
  if (blocks.length !== points.length) {
    throw new Error(
      `Open-Meteo returned ${blocks.length} blocks for ${points.length} points`,
    );
  }
  return blocks;
}
