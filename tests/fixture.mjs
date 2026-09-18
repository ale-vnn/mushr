/**
 * A weather answer, made up on purpose.
 *
 * The browser test used to call Open-Meteo for real. That made twenty of its
 * twenty-four assertions depend on a free, metered service reached from a
 * shared address — so on a continuous integration runner they would usually
 * skip, and the test would pass while checking almost nothing.
 *
 * The application caches its weather in localStorage. Seeding that cache with a
 * made-up answer removes the third party entirely: the test then runs offline,
 * in about a second, and returns the same numbers every time — which is what
 * lets it assert an exact index rather than "more than forty".
 *
 * The shape is Open-Meteo's, because that is what `buildSeries` reads. The
 * weather is not: it is one clean rain episode two weeks back over damp,
 * mild ground, which is the case worth having a known answer for.
 */

import { readFileSync } from "node:fs";
import { groupByCell, PAST_DAYS, FORECAST_DAYS } from "../src/weather.js";

const iso = (d) => d.toLocaleDateString("sv-SE"); // sv-SE writes YYYY-MM-DD

/** One block, in the shape Open-Meteo answers with. */
function block(days, seed) {
  const daily = { time: [], precipitation_sum: [], temperature_2m_min: [] };
  const hourly = {
    time: [],
    soil_temperature_6cm: [],
    soil_moisture_3_to_9cm: [],
    soil_moisture_9_to_27cm: [],
  };

  days.forEach((date, i) => {
    // The rain that matters fell between 12 and 15 days ago: inside the
    // response kernel, which peaks at 14.
    const lag = PAST_DAYS - i;
    const wet = lag >= 12 && lag <= 15;
    daily.time.push(date);
    daily.precipitation_sum.push(wet ? 6 + (seed % 3) : lag % 9 === 0 ? 1.2 : 0);
    daily.temperature_2m_min.push(7 + ((i + seed) % 4));

    for (let h = 0; h < 24; h += 3) {
      hourly.time.push(`${date}T${String(h).padStart(2, "0")}:00`);
      // A diurnal swing around 15 °C, which sits on the thermal plateau.
      hourly.soil_temperature_6cm.push(15 + 3 * Math.sin(((h - 6) / 24) * 2 * Math.PI));
      hourly.soil_moisture_3_to_9cm.push(lag > 15 ? 0.20 : 0.22);
      hourly.soil_moisture_9_to_27cm.push(0.33);
    }
  });

  return { daily, hourly };
}

/**
 * The cache entry for one department, ready to be written to localStorage.
 * Returns `{ key, value }` for `mushr.conditions.v3`.
 */
export function departmentCache(code, root = new URL("../public/data/", import.meta.url)) {
  const forests = Object.values(
    JSON.parse(readFileSync(new URL(`indicators/${code}.json`, root), "utf8")),
  );
  const { ask, index } = groupByCell(forests);

  const today = new Date();
  const days = [];
  for (let offset = -PAST_DAYS; offset < FORECAST_DAYS; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    days.push(iso(d));
  }

  return {
    key: `${code}:${forests.length}`,
    value: { at: Date.now(), series: { blocks: ask.map((_, i) => block(days, i)), index } },
  };
}
