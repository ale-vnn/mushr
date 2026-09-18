/**
 * Fruiting index for forest mushrooms.
 *
 * The model rests on five agronomic facts:
 *
 *  1. Fruiting is triggered by a rain episode, and the mycelium needs roughly
 *     one to three weeks to turn that water into fruit bodies. So the rain that
 *     matters for today fell about two weeks ago, not today. A rain day counts
 *     according to how long ago it fell, through a response kernel.
 *  2. The litter and topsoil must have stayed damp since. A trigger rain
 *     followed by a dry spell aborts the flush, unless the deeper soil still
 *     holds enough water to carry the mycelium through.
 *  3. Soil temperature at root depth gates the whole process: below ~8 °C and
 *     above ~24 °C mycelium goes dormant, with an optimum around 12-18 °C.
 *  4. A sharp cooling of the soil is a trigger of its own, on top of the rain.
 *  5. Frost destroys standing fruit bodies.
 *
 * Factors combine as a weighted geometric mean rather than a sum: this is a
 * Liebig law of the minimum, where any single factor at zero zeroes the whole
 * index. No rain means no mushrooms however perfect the temperature.
 *
 * The index is a decision aid, not a prediction: it ranks days and places, and
 * says why. Local ground truth always wins.
 *
 * This module is pure: no DOM, no fetch, no words. It takes an Open-Meteo
 * response and returns numbers and keys. That is what makes it testable, and
 * what let it move from the original application to this one untouched.
 */

export const MODEL = {
  // Bumped whenever the model changes, so cached series are recomputed.
  version: 2,
  // Response kernel: a rain day counts from `min` days after it fell, most at
  // `peak`, and no longer at `max`. `span` keeps the millimetre scale below.
  kernel: { min: 6, peak: 14, max: 24, span: 13 },
  // Kernel-weighted rain over that window (mm).
  rain: { zero: 10, full: 40 },
  // Volumetric soil moisture at 3-9 cm (m3/m3) on the target day.
  moisture: { zero: 0.15, full: 0.28 },
  // Soil temperature at 6 cm (°C): plateau between min and max.
  soilTemp: { dead: 8, min: 12, max: 18, hot: 24 },
  // Dry spell between the trigger rain and the target day. Severity is read
  // from the driest surface value of that interval, between `wet` (no harm)
  // and `dry` (full severity); a deep layer still above `deepWet` relieves
  // `relief` of the penalty, which is capped at `max`.
  continuity: {
    dry: 0.1,
    wet: 0.2,
    deepDry: 0.15,
    deepWet: 0.3,
    max: 0.5,
    relief: 0.5,
  },
  // Soil cooling over `days` (°C): a bounded bonus, never a factor, since the
  // absence of a cold snap does not forbid fruiting.
  shock: { days: 5, zero: 1, full: 4, boost: 0.15 },
  // Frost check over the days up to the target day.
  frost: { window: 3, threshold: -2 },
  weights: { rain: 0.4, moisture: 0.3, soilTemp: 0.3 },
  // A rain episode counts as a trigger from this cumulated total (mm).
  trigger: { wetDay: 3, minTotal: 20, gap: 1, flush: [10, 20], peak: 15 },
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Shift an ISO date by whole days. Noon avoids any DST edge. */
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE"); // sv-SE renders as YYYY-MM-DD
}

/** Rising ramp: 0 at or below `zero`, 1 at or above `full`. */
export function ramp(x, zero, full) {
  return clamp01((x - zero) / (full - zero));
}

/** Trapezoid: 0 outside [dead, hot], 1 on the [min, max] plateau. */
export function trapezoid(x, { dead, min, max, hot }) {
  if (x <= dead || x >= hot) return 0;
  if (x < min) return (x - dead) / (min - dead);
  if (x > max) return (hot - x) / (hot - max);
  return 1;
}

/**
 * Weight of a rain day by its lag, indexed by lag in days.
 *
 * Raised cosine on both sides of the peak, so a rain day enters and leaves the
 * window gradually. A rectangular window makes the index drop by a step the
 * day a downpour ages out of it, which is an artefact of the window, not of
 * the forest.
 *
 * Weights are scaled to sum to `span`, the width of the rectangular window
 * they replace, so the thresholds in `rain` keep their millimetre meaning: a
 * rain spread evenly over the window scores exactly as it did before.
 */
export const KERNEL = buildKernel(MODEL.kernel);

function buildKernel({ min, peak, max, span }) {
  const raw = [];
  for (let lag = 0; lag <= max; lag++) {
    raw[lag] =
      lag <= min || lag >= max
        ? 0
        : lag <= peak
          ? 0.5 * (1 - Math.cos((Math.PI * (lag - min)) / (peak - min)))
          : 0.5 * (1 + Math.cos((Math.PI * (lag - peak)) / (max - peak)));
  }
  const total = raw.reduce((s, w) => s + w, 0);
  return raw.map((w) => (w * span) / total);
}

/**
 * Fold an Open-Meteo response for one location into one row per day.
 * Hourly soil variables are averaged over each civil day; they run out around
 * day +7 of the forecast, so rows past that carry null soil values.
 */
export function buildSeries(point) {
  const d = point.daily;
  const soil = averageHourlyByDay(point.hourly, [
    "soil_temperature_6cm",
    "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm",
  ]);
  const fit = thermalFitByDay(point.hourly);
  return d.time.map((date, i) => ({
    date,
    precip: d.precipitation_sum?.[i] ?? null,
    tmin: d.temperature_2m_min?.[i] ?? null,
    soilTemp: soil[date]?.soil_temperature_6cm ?? null,
    soilTempFit: fit[date] ?? null,
    moisture: soil[date]?.soil_moisture_3_to_9cm ?? null,
    moistureDeep: soil[date]?.soil_moisture_9_to_27cm ?? null,
  }));
}

function averageHourlyByDay(hourly, keys) {
  const out = {};
  if (!hourly?.time) return out;
  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i].slice(0, 10);
    const bucket = (out[day] ??= {});
    for (const k of keys) {
      const v = hourly[k]?.[i];
      if (v == null) continue;
      const acc = (bucket[`_${k}`] ??= { sum: 0, n: 0 });
      acc.sum += v;
      acc.n++;
    }
  }
  for (const day of Object.keys(out)) {
    for (const k of keys) {
      const acc = out[day][`_${k}`];
      out[day][k] = acc ? acc.sum / acc.n : null;
      delete out[day][`_${k}`];
    }
  }
  return out;
}

/**
 * Mean thermal fitness over the hours of each day.
 *
 * The trapezoid is not linear, so the fitness of the mean is not the mean of
 * the fitness: a day swinging between 6 and 20 °C is not the flat 13 °C it
 * averages to. Scoring hour by hour and then averaging is the honest reading,
 * and it is the one thing the hourly series says that the daily mean cannot.
 */
function thermalFitByDay(hourly) {
  const acc = {};
  if (!hourly?.time) return acc;
  for (let i = 0; i < hourly.time.length; i++) {
    const v = hourly.soil_temperature_6cm?.[i];
    if (v == null) continue;
    const day = hourly.time[i].slice(0, 10);
    const bucket = (acc[day] ??= { sum: 0, n: 0 });
    bucket.sum += trapezoid(v, MODEL.soilTemp);
    bucket.n++;
  }
  const out = {};
  for (const [day, { sum, n }] of Object.entries(acc)) out[day] = sum / n;
  return out;
}

const min = (rows, key) => {
  const values = rows.map((r) => r[key]).filter((v) => v != null);
  return values.length ? Math.min(...values) : null;
};

/**
 * Index for `series[i]`. Returns null when the response window or the soil
 * data needed for that day is missing.
 */
export function scoreForDay(series, i) {
  const { kernel, continuity, shock, weights } = MODEL;
  const start = i - kernel.max;
  if (start < 0) return null;
  const row = series[i];
  if (row.moisture == null || row.soilTemp == null) return null;

  // Rain, convolved with the mycelial response kernel.
  const incubationRain = KERNEL.reduce(
    (s, w, lag) => (w === 0 ? s : s + w * (series[i - lag].precip ?? 0)),
    0,
  );

  const factors = {
    rain: ramp(incubationRain, MODEL.rain.zero, MODEL.rain.full),
    moisture: ramp(row.moisture, MODEL.moisture.zero, MODEL.moisture.full),
    // Older cached rows carry no hourly fitness; the daily mean stands in.
    soilTemp: row.soilTempFit ?? trapezoid(row.soilTemp, MODEL.soilTemp),
  };

  // Did the ground stay damp between the trigger rain and today? The driest
  // reading of the interval decides, not its average: one dry week is enough
  // to abort a flush, and an average would hide it.
  const since = series.slice(i - kernel.peak, i + 1);
  const driest = min(since, "moisture");
  const deep = min(since, "moistureDeep");
  const severity =
    driest == null ? 0 : 1 - ramp(driest, continuity.dry, continuity.wet);
  const reserve =
    deep == null ? 0 : ramp(deep, continuity.deepDry, continuity.deepWet);
  const interruption =
    continuity.max * severity * (1 - continuity.relief * reserve);

  const frostRows = series.slice(Math.max(0, i - MODEL.frost.window + 1), i + 1);
  const coldest = Math.min(...frostRows.map((r) => r.tmin ?? 99));
  const frost = coldest < MODEL.frost.threshold ? 1 : 0;

  // Soil cooling over the last few days, a trigger in its own right.
  const before = series[i - shock.days]?.soilTemp;
  const cooling = before == null ? 0 : before - row.soilTemp;
  const boost = shock.boost * ramp(cooling, shock.zero, shock.full);

  // Weighted geometric mean, then multiplicative modifiers.
  const base = Object.entries(weights).reduce(
    (p, [k, w]) => p * Math.pow(factors[k], w),
    1,
  );
  const score = Math.min(
    100,
    100 * base * (1 - interruption) * (1 - frost) * (1 + boost),
  );

  const rounded = Math.round(score);
  return {
    date: row.date,
    score: rounded,
    band: band(rounded),
    factors,
    penalties: { interruption, frost },
    modifiers: { shock: boost },
    detail: {
      incubationRain: Math.round(incubationRain * 10) / 10,
      incubationFrom: series[i - kernel.max + 1].date,
      incubationPeak: series[i - kernel.peak].date,
      incubationTo: series[i - kernel.min - 1].date,
      moisture: Math.round(row.moisture * 1000) / 1000,
      soilTemp: Math.round(row.soilTemp * 10) / 10,
      driest: driest == null ? null : Math.round(driest * 1000) / 1000,
      deep: deep == null ? null : Math.round(deep * 1000) / 1000,
      cooling: Math.round(cooling * 10) / 10,
      coldest: coldest === 99 ? null : Math.round(coldest * 10) / 10,
    },
  };
}

/** Index for every day of the series; entries are null where uncomputable. */
export function scoreSeries(series) {
  return series.map((_, i) => scoreForDay(series, i));
}

/**
 * Rain episodes worth watching, with the window they should fruit in.
 * Consecutive wet days separated by at most `gap` dry days form one episode.
 */
export function detectTriggers(series) {
  const { wetDay, minTotal, gap, flush, peak } = MODEL.trigger;
  const episodes = [];
  let current = null;
  let dryRun = 0;

  series.forEach((row, i) => {
    const wet = (row.precip ?? 0) >= wetDay;
    if (wet) {
      dryRun = 0;
      if (!current) current = { startIndex: i, endIndex: i, mm: 0 };
      current.endIndex = i;
      current.mm += row.precip;
    } else if (current) {
      dryRun++;
      if (dryRun > gap) {
        episodes.push(current);
        current = null;
      }
    }
  });
  if (current) episodes.push(current);

  return episodes
    .filter((e) => e.mm >= minTotal)
    .map((e) => {
      const end = series[e.endIndex].date;
      return {
        start: series[e.startIndex].date,
        end,
        days: e.endIndex - e.startIndex + 1,
        mm: Math.round(e.mm * 10) / 10,
        flushStart: addDays(end, flush[0]),
        flushPeak: addDays(end, peak),
        flushEnd: addDays(end, flush[1]),
      };
    });
}

/**
 * Five bands over the 0-100 index.
 *
 * Keys only, no words: this module is the model, and the model does not know
 * what language the reader speaks. `src/i18n.js` turns a key into a label.
 */
export const BANDS = [
  { min: 70, key: "excellent" },
  { min: 50, key: "good" },
  { min: 30, key: "fair" },
  { min: 12, key: "poor" },
  { min: -1, key: "none" },
];

export function band(score) {
  if (score == null) return { key: "unknown" };
  return BANDS.find((b) => score >= b.min);
}

// -------------------------------------------------------------- readings
//
// Two readings of a scored series that both modes need. They derive from
// `scoreSeries` and add no data: the index already knows what holds it back
// and where it is heading, it just never said so out loud.

/**
 * The one thing holding the index back, named in a few words.
 *
 * The geometric mean means the weakest factor governs, so the minimum of
 * `factors` is the answer in the ordinary case. Two modifiers can bite harder
 * than any factor, and they come first when they do: frost zeroes the index
 * outright, and a dry spell since the trigger rain can cost more than the
 * weakest factor does — both are compared on the same scale, the share of the
 * index each one destroys.
 */
export function limiting(entry) {
  if (!entry) return null;
  if (entry.penalties.frost > 0) return { key: "frost", loss: 1 };
  const [key, value] = Object.entries(entry.factors).sort((a, b) => a[1] - b[1])[0];
  if (entry.penalties.interruption > 1 - value) {
    return { key: "continuity", loss: entry.penalties.interruption };
  }
  return { key, loss: 1 - value };
}

/**
 * Where the index is heading over the forecast window.
 *
 * `slope` is a least-squares fit in index points per day over the days that
 * could be scored — a single subtraction between the first and last day would
 * be at the mercy of either end. `horizon` is the last day the forecast can
 * score at all: soil variables stop around day +7, and a series that simply
 * stops is read as a curve going nowhere rather than as data running out.
 */
export function trajectory(scores, todayIndex, days) {
  const points = [];
  for (let offset = 0; offset < days; offset++) {
    const entry = scores[todayIndex + offset];
    if (entry) points.push({ offset, ...entry });
  }
  if (!points.length) return null;

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.offset, 0) / n;
  const meanY = points.reduce((s, p) => s + p.score, 0) / n;
  const spread = points.reduce((s, p) => s + (p.offset - meanX) ** 2, 0);
  const slope = spread
    ? points.reduce((s, p) => s + (p.offset - meanX) * (p.score - meanY), 0) / spread
    : 0;

  const today = points[0].offset === 0 ? points[0] : null;
  const best = points.reduce((b, p) => (p.score > b.score ? p : b), points[0]);
  const future = points.filter((p) => p.offset > 0);

  return {
    slope,
    // A point a day either way is noise, not a trend.
    direction: slope > 1 ? "up" : slope < -1 ? "down" : "flat",
    today,
    peak: best.offset > 0 ? best : null,
    crossing: today ? (future.find((p) => p.band.key !== today.band.key) ?? null) : null,
    horizon: points[n - 1],
  };
}
