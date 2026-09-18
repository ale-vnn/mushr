/**
 * Inline SVG charts, no charting library.
 *
 * The charts are small, fixed in shape and read at a glance; a library would
 * add far more weight and API surface than the lines it would save.
 *
 * Two rules hold the set together.
 *
 * **The captions live in HTML, outside the SVG.** An SVG with a viewBox scales
 * its whole coordinate system, text included: handed a column twice as wide it
 * renders a caption at the size of a heading. Kept outside, the captions hold
 * their size at any width — which is what lets a chart be dropped into an
 * arbitrary column.
 *
 * **Colour is a class, never an attribute.** Every mark carries `band-*` or a
 * series class and the stylesheet decides what that looks like, so the palette
 * has exactly one home.
 */

import { esc } from "./html.js";
import { t, locale } from "./i18n.js";

const W = 360; // viewBox width, close to the panel width so bars keep their height

const fmtDay = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), {
        day: "numeric",
        month: "short",
      })
    : "—";

/** Geometry shared by the full-size charts. */
function geometry(n, height) {
  const top = 8; // headroom, so a full bar does not touch the edge
  const plot = height - 2; // baseline, leaving the axis stroke room to draw
  const step = W / n;
  return { top, plot, step, barW: Math.max(1.5, step * 0.68) };
}

const axis = (plot) => `<line class="axis" x1="0" y1="${plot}" x2="${W}" y2="${plot}"/>`;

/** Horizontal rules at a few values, to make heights comparable. */
const grid = (values, scale) =>
  values
    .map((v) => `<line class="grid" x1="0" y1="${scale(v).toFixed(1)}" x2="${W}" y2="${scale(v).toFixed(1)}"/>`)
    .join("");

const todayRule = (x, plot) =>
  `<line class="today" x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${plot}"/>`;

/**
 * A chart and its captions: "today" over the rule, and one at each end of the
 * axis. `now` is the rule's position as a fraction of the width, so the caption
 * follows it whatever the chart is scaled to.
 */
function chartWrap(svg, { now, left = "", right = "", unit = "" }) {
  // Near the right edge the caption has to hang to the left of the rule.
  const flip = now > 0.82;
  return (
    `<figure class="chart-wrap">` +
    `<span class="chart-now" style="left:${(now * 100).toFixed(1)}%${flip ? ";transform:translateX(-100%)" : ""}">${t("chart.today")}</span>` +
    svg +
    `<figcaption class="chart-axis"><span>${left}</span>` +
    (unit ? `<span class="chart-unit">${unit}</span>` : "") +
    `<span>${right}</span></figcaption></figure>`
  );
}

/**
 * The index day by day.
 *
 * Days with no computable index — the first three weeks, which lack their own
 * incubation window — are simply absent. A measured zero still gets a visible
 * stub, so it reads as "no chance here" rather than "no data for this day".
 */
export function scoreChart(scores, todayIndex, { height = 96, from = 0 } = {}) {
  const slice = scores.slice(from);
  const today = todayIndex - from;
  const n = slice.length;
  const { top, plot, step, barW } = geometry(n, height);
  const y = (v) => plot - (v / 100) * (plot - top);

  const bars = slice
    .map((s, i) => {
      if (!s) return "";
      const h = Math.max(2.5, (s.score / 100) * (plot - top));
      const x = i * step + (step - barW) / 2;
      return (
        `<rect class="bar band-${s.band.key}${i > today ? " future" : ""}" ` +
        `x="${x.toFixed(1)}" y="${(plot - h).toFixed(1)}" ` +
        `width="${barW.toFixed(1)}" height="${h.toFixed(1)}">` +
        `<title>${esc(fmtDay(s.date))} — ${s.score} (${esc(t(`band.${s.band.key}`))})</title></rect>`
      );
    })
    .join("");

  const svg =
    `<svg class="chart chart-score" viewBox="0 0 ${W} ${height}" preserveAspectRatio="none" role="img">` +
    axis(plot) +
    grid([30, 50, 70], y) +
    bars +
    todayRule(today * step + step / 2, plot) +
    `</svg>`;

  return chartWrap(svg, {
    now: (today + 0.5) / n,
    left: esc(fmtDay(slice[0]?.date)),
    right: esc(fmtDay(slice[n - 1]?.date)),
  });
}

/**
 * The same series, small enough to sit in a list row.
 *
 * Same mark, same 0-100 scale and same today rule as the full chart, so a
 * glance at a row and a glance at the panel agree. No captions: at this size
 * they would be the chart.
 */
export function sparkline(scores, todayIndex, { height = 30, from = 0 } = {}) {
  const slice = scores.slice(from);
  const today = todayIndex - from;
  const n = slice.length;
  const { top, plot, step, barW } = geometry(n, height);

  const bars = slice
    .map((s, i) => {
      if (!s) return "";
      const h = Math.max(1.5, (s.score / 100) * (plot - top));
      return (
        `<rect class="bar band-${s.band.key}${i > today ? " future" : ""}" ` +
        `x="${(i * step + (step - barW) / 2).toFixed(1)}" y="${(plot - h).toFixed(1)}" ` +
        `width="${barW.toFixed(1)}" height="${h.toFixed(1)}"/>`
      );
    })
    .join("");

  return (
    `<svg class="chart chart-spark" viewBox="0 0 ${W} ${height}" preserveAspectRatio="none" role="img">` +
    bars +
    todayRule(today * step + step / 2, plot) +
    `</svg>`
  );
}

/**
 * A raw daily series under the index that uses it — rainfall, soil moisture,
 * soil temperature.
 *
 * Scaled to its own range rather than to a fixed one: these are evidence, read
 * for their shape, and a fixed range would flatten a dry month into a blank
 * strip. The range is printed in the caption so the shape can still be read as
 * a quantity.
 */
export function seriesChart(series, todayIndex, key, { height = 52, from = 0, unit = "", scale = 1, mark = "bar" } = {}) {
  const slice = series.slice(from);
  const today = todayIndex - from;
  const n = slice.length;
  const { top, plot, step, barW } = geometry(n, height);

  const raw = slice.map((r) => (r[key] == null ? null : r[key] * scale));
  const present = raw.filter((v) => v != null);
  if (!present.length) return "";
  const hi = Math.max(...present);
  const lo = mark === "line" ? Math.min(...present) : 0;
  const span = hi - lo || 1;
  const y = (v) => plot - ((v - lo) / span) * (plot - top);

  const marks =
    mark === "line"
      ? `<path class="series-line series-${key}" d="${raw
          .map((v, i) => (v == null ? null : `${(i * step + step / 2).toFixed(1)},${y(v).toFixed(1)}`))
          .filter(Boolean)
          .map((p, i) => (i === 0 ? `M${p}` : `L${p}`))
          .join(" ")}"/>`
      : raw
          .map((v, i) =>
            v == null || v === 0
              ? ""
              : `<rect class="series-bar series-${key}" x="${(i * step + (step - barW) / 2).toFixed(1)}" ` +
                `y="${y(v).toFixed(1)}" width="${barW.toFixed(1)}" height="${(plot - y(v)).toFixed(1)}"/>`,
          )
          .join("");

  const fmt = (v) =>
    v.toLocaleString(locale(), { maximumFractionDigits: hi < 10 ? 1 : 0 });

  const svg =
    `<svg class="chart chart-series" viewBox="0 0 ${W} ${height}" preserveAspectRatio="none" role="img">` +
    axis(plot) +
    marks +
    todayRule(today * step + step / 2, plot) +
    `</svg>`;

  return chartWrap(svg, {
    now: (today + 0.5) / n,
    left: mark === "line" ? `${fmt(lo)}` : "0",
    right: `${fmt(hi)} ${esc(unit)}`,
  });
}
