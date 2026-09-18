/**
 * The pure logic, checked without a network.
 *
 * The smoke test needs a browser, a built site and a weather service with quota
 * left. These need none of that, so they run in a second and they run when
 * Open-Meteo is busy — which is exactly when a mistake in the model would
 * otherwise go unnoticed.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { groupByCell } from "../src/weather.js";
import { MODEL, ramp, trapezoid, band, BANDS, scoreForDay, detectTriggers, addDays } from "../src/score.js";

// ------------------------------------------------------------- grid grouping

test("points in one cell are asked for once", () => {
  const points = [
    { lat: 48.2, lon: -1.55 },
    { lat: 48.21, lon: -1.56 }, // ~1.3 km away: same cell
    { lat: 49.0, lon: -1.55 }, // far: its own cell
  ];
  const { ask, index } = groupByCell(points, 0.03);
  assert.equal(ask.length, 2, "two cells for three points");
  assert.equal(index[0], index[1], "neighbours share a block");
  assert.notEqual(index[0], index[2], "distant points do not");
});

test("every point keeps a block, and the blocks exist", () => {
  const points = Array.from({ length: 50 }, (_, i) => ({
    lat: 47 + i * 0.011,
    lon: 2 + i * 0.007,
  }));
  const { ask, index } = groupByCell(points, 0.03);
  assert.equal(index.length, points.length);
  for (const i of index) assert.ok(i >= 0 && i < ask.length, "index points at a real block");
});

test("the point standing in for a cell is one of the points in it", () => {
  const points = [
    { lat: 48.2, lon: -1.55 },
    { lat: 48.205, lon: -1.552 },
  ];
  const { ask, index } = groupByCell(points, 0.03);
  assert.equal(ask.length, 1);
  assert.deepEqual(ask[index[0]], { lat: 48.2, lon: -1.55 });
});

test("a finer grid merges less", () => {
  const points = [
    { lat: 48.2, lon: -1.55 },
    { lat: 48.22, lon: -1.55 },
  ];
  assert.equal(groupByCell(points, 0.05).ask.length, 1);
  assert.equal(groupByCell(points, 0.005).ask.length, 2);
});

// ------------------------------------------------------------------ the model

test("ramps and trapezoids hold at their bounds", () => {
  assert.equal(ramp(0, 10, 40), 0);
  assert.equal(ramp(40, 10, 40), 1);
  assert.equal(ramp(25, 10, 40), 0.5);
  const t = MODEL.soilTemp;
  assert.equal(trapezoid(t.dead, t), 0, "dormant at the cold edge");
  assert.equal(trapezoid(t.hot, t), 0, "dormant at the hot edge");
  assert.equal(trapezoid((t.min + t.max) / 2, t), 1, "full on the plateau");
});

test("bands cover the whole range in order", () => {
  assert.equal(band(100).key, "excellent");
  assert.equal(band(0).key, "none");
  assert.equal(band(null).key, "unknown");
  for (const b of BANDS) assert.equal(band(b.min).key, b.key, `${b.key} starts at its own floor`);
});

/** A series of `n` days, every field constant unless overridden per day. */
function series(n, base, overrides = {}) {
  return Array.from({ length: n }, (_, i) => ({
    date: addDays("2026-08-01", i),
    ...base,
    ...(overrides[i] ?? {}),
  }));
}

const IDEAL = { precip: 0, tmin: 10, soilTemp: 15, soilTempFit: 1, moisture: 0.3, moistureDeep: 0.35 };

test("no incubation rain means no index, however perfect the rest", () => {
  const s = series(40, IDEAL);
  const entry = scoreForDay(s, 39);
  assert.equal(entry.score, 0, "Liebig: one factor at zero zeroes the whole thing");
  assert.equal(entry.factors.rain, 0);
});

test("rain in the response window produces an index", () => {
  const wet = Object.fromEntries(
    [25, 26, 27].map((i) => [i, { precip: 20 }]), // about two weeks before day 39
  );
  const entry = scoreForDay(series(40, IDEAL, wet), 39);
  assert.ok(entry.score > 40, `an index of ${entry.score} from a real episode`);
});

test("rain too recent to have worked does not count", () => {
  const justNow = Object.fromEntries([37, 38, 39].map((i) => [i, { precip: 20 }]));
  assert.equal(scoreForDay(series(40, IDEAL, justNow), 39).score, 0);
});

test("frost in the last days destroys the index", () => {
  const wet = Object.fromEntries([25, 26, 27].map((i) => [i, { precip: 20 }]));
  const frozen = { ...wet, 38: { tmin: MODEL.frost.threshold - 1 } };
  assert.ok(scoreForDay(series(40, IDEAL, wet), 39).score > 0);
  assert.equal(scoreForDay(series(40, IDEAL, frozen), 39).score, 0);
});

test("a dry spell since the trigger rain costs index", () => {
  const wet = Object.fromEntries([25, 26, 27].map((i) => [i, { precip: 20 }]));
  const dried = { ...wet };
  for (let i = 30; i < 36; i++) dried[i] = { moisture: 0.05, moistureDeep: 0.1 };
  const wetScore = scoreForDay(series(40, IDEAL, wet), 39).score;
  const dryScore = scoreForDay(series(40, IDEAL, dried), 39).score;
  assert.ok(dryScore < wetScore, `${dryScore} below ${wetScore}`);
});

test("days without their own response window cannot be scored", () => {
  assert.equal(scoreForDay(series(40, IDEAL), MODEL.kernel.max - 1), null);
  assert.notEqual(scoreForDay(series(40, IDEAL), MODEL.kernel.max), null);
});

test("trigger episodes are found, and their flush window follows the rain", () => {
  const s = series(20, IDEAL, { 5: { precip: 12 }, 6: { precip: 15 } });
  const [episode] = detectTriggers(s);
  assert.equal(episode.mm, 27);
  assert.equal(episode.start, s[5].date);
  assert.equal(episode.end, s[6].date);
  assert.equal(episode.flushStart, addDays(s[6].date, MODEL.trigger.flush[0]));
});

test("a drizzle is not an episode", () => {
  assert.deepEqual(detectTriggers(series(20, IDEAL, { 5: { precip: 2 } })), []);
});
