/**
 * The detail sheet: where the index gets argued.
 *
 * It opens with the verdict — the figure, the band, and the one factor holding
 * it back named in words, because that is the sentence someone acts on. Under
 * it sit the three series the index is built from, so a reader can see for
 * themselves why the number is what it is rather than take it on faith.
 *
 * Section headings are plain sentence-case words, and the facts under them are
 * written as fragments a person would say out loud.
 */

import { esc, num } from "./html.js";
import { t, locale } from "./i18n.js";
import { limiting, detectTriggers } from "./score.js";
import { scoreChart, seriesChart } from "./charts.js";
import { departmentName } from "./departments.js";
import { entryFor, trajectoryFor, forestById, state, TODAY_INDEX, CHART_FROM } from "./state.js";
import { isFavourite } from "./store.js";

const date = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short" });

const pct = (v) => `${Math.round(v * 100)} %`;

const section = (title, body) =>
  body
    ? `<section data-section class="border-t border-line px-6 py-5">` +
      `<h3 class="mb-3 text-sm font-semibold text-soft">${title}</h3>${body}</section>`
    : "";

/** A factor, with the raw reading that produced it. */
const factorRow = (label, share, reading) =>
  `<tr>` +
  `<th scope="row" class="py-1.5 pr-3 text-left font-normal text-soft">${label}</th>` +
  `<td class="w-2/5 py-1.5">` +
  `<span class="block h-2 rounded-full bg-line"><span class="block h-full rounded-full bg-primary" style="width:${(share * 100).toFixed(0)}%"></span></span>` +
  `</td>` +
  `<td class="py-1.5 pl-3 text-right tnum">${pct(share)}</td>` +
  `<td class="py-1.5 pl-3 text-right tnum text-faint">${reading}</td>` +
  `</tr>`;

function composition(forest) {
  if (!forest.species?.length)
    return `<p class="text-sm text-faint">${t("detail.notSurveyed")}</p>`;

  const cover = [
    ["broadleaf", forest.broadleaf_pct],
    ["conifer", forest.conifer_pct],
    ["mixed", forest.mixed_pct],
    ["open", forest.open_pct],
  ].filter(([, v]) => v > 0);

  return (
    `<div class="flex h-2.5 overflow-hidden rounded-full">` +
    cover
      .map(([k, v]) => `<span class="bg-${k}" style="width:${v}%" title="${t(`detail.${k}`)} ${v} %"></span>`)
      .join("") +
    `</div>` +
    `<p class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.8125rem] text-soft">` +
    cover
      .map(
        ([k, v]) =>
          `<span class="flex items-center gap-1.5">` +
          `<span class="size-2 shrink-0 bg-${k}"></span>${t(`detail.${k}`)} ${v} %</span>`,
      )
      .join("") +
    `</p>` +
    `<p class="mt-1 text-[0.8125rem] text-faint">${t("detail.surveyed", { n: forest.surveyed_pct })}</p>` +
    `<ul class="mt-3 space-y-1 text-[0.9375rem]">` +
    forest.species
      .map(
        (s) =>
          `<li class="flex justify-between gap-3"><span>${esc(s.name)}</span>` +
          `<span class="tnum text-faint">${s.pct} %</span></li>`,
      )
      .join("") +
    `</ul>`
  );
}

function triggers(forest) {
  const episodes = detectTriggers(forest.series.slice(0, TODAY_INDEX + 1)).slice(-3).reverse();
  if (!episodes.length)
    return `<p class="text-sm text-faint">${t("detail.noTriggers")}</p>`;
  return (
    `<ul class="space-y-2 text-[0.9375rem]">` +
    episodes
      .map(
        (e) =>
          `<li class="border-l-2 border-rain pl-2.5">${esc(
            t("detail.triggerLine", {
              mm: num(e.mm, 0, "", locale()),
              start: date(e.start),
              end: date(e.end),
              flushStart: date(e.flushStart),
              flushEnd: date(e.flushEnd),
            }),
          )}</li>`,
      )
      .join("") +
    `</ul>`
  );
}

function trend(forest) {
  const path = trajectoryFor(forest);
  if (!path) return "";
  const bits = [t(`trend.${path.direction}`)];
  if (path.peak) bits.push(t("trend.peak", { date: date(path.peak.date) }));
  if (path.horizon) bits.push(t("trend.horizon", { date: date(path.horizon.date) }));
  return `<p class="mt-2 text-sm text-faint">${esc(bits.join(", "))}</p>`;
}

const fact = (label, value) =>
  `<div class="flex justify-between gap-3 py-1">` +
  `<dt class="text-soft">${label}</dt><dd class="tnum">${value}</dd></div>`;

export function detailHTML(id) {
  const forest = forestById(id);
  if (!forest) return "";

  const entry = entryFor(forest);
  const key = entry ? entry.band.key : "unknown";
  const hold = entry ? limiting(entry) : null;
  const d = entry?.detail;
  const chart = { from: CHART_FROM };
  const following = isFavourite(forest.id);

  return (
    `<article data-detail>` +

    `<div data-detail-head class="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-panel px-6 py-4">` +
    `<div class="min-w-0 flex-1">` +
    `<h2 class="text-xl leading-tight font-semibold">${esc(forest.name)}</h2>` +
    `<p class="mt-1 text-sm text-soft">${esc(departmentName(forest.dept))}</p>` +
    `</div>` +
    `<button id="favBtn" data-id="${esc(forest.id)}" data-dept="${esc(forest.dept)}" ` +
    `class="shrink-0 rounded-sm border px-2.5 py-1 text-[0.8125rem] ` +
    `${following ? "border-primary bg-primary/10 text-primary" : "border-line-strong text-soft hover:border-line-strong"}">` +
    `${following ? "★" : "☆"} ${following ? t("detail.unfavourite") : t("detail.favourite")}</button>` +
    `<button id="closeDetail" title="${t("detail.close")}" ` +
    `class="shrink-0 rounded-sm border border-line-strong px-2 py-1 text-[0.8125rem] text-soft hover:border-line-strong">✕</button>` +
    `</div>` +

    `<div class="flex items-start gap-6 px-6 py-6">` +
    `<span data-detail-score class="index-figure text-[5rem] band-${key}">${entry?.score ?? "–"}</span>` +
    `<div class="min-w-0 flex-1 pt-1">` +
    `<p class="text-xl leading-none font-semibold band-${key}">${t(`band.${key}`)}</p>` +
    (hold
      ? `<p class="mt-2.5 text-base">${t("limiting.prefix")} <strong class="font-medium">${t(`limiting.${hold.key}`)}</strong></p>`
      : "") +
    trend(forest) +
    `</div></div>` +

    section(t("detail.history"), scoreChart(forest.scores, TODAY_INDEX, chart)) +

    (d
      ? section(
          t("detail.factors"),
          `<table data-factors class="w-full text-[0.9375rem]"><tbody>` +
            factorRow(t("detail.rain"), entry.factors.rain, num(d.incubationRain, 0, "mm", locale())) +
            factorRow(t("detail.moisture"), entry.factors.moisture, num(d.moisture * 100, 0, "%", locale())) +
            factorRow(t("detail.soilTemp"), entry.factors.soilTemp, num(d.soilTemp, 1, "°C", locale())) +
            `</tbody></table>`,
        )
      : "") +

    section(t("detail.rainChart"), seriesChart(forest.series, TODAY_INDEX, "precip", { ...chart, unit: t("unit.mm") })) +
    section(t("detail.moistureChart"), seriesChart(forest.series, TODAY_INDEX, "moisture", { ...chart, unit: t("unit.pct"), scale: 100, mark: "line" })) +
    section(t("detail.soilTempChart"), seriesChart(forest.series, TODAY_INDEX, "soilTemp", { ...chart, unit: t("unit.degC"), mark: "line" })) +

    section(t("detail.triggers"), triggers(forest)) +
    section(t("detail.composition"), composition(forest)) +

    section(
      t("detail.terrain"),
      `<dl class="text-[0.9375rem]">` +
        fact(t("detail.area"), num(forest.area_ha, 0, "ha", locale())) +
        fact(t("detail.elevation"), forest.elevation_m == null ? "–" : num(forest.elevation_m, 0, "m", locale())) +
        fact(t("detail.edge"), num(forest.edge_m_per_ha, 1, "m/ha", locale())) +
        `</dl>`,
    ) +

    (forest.neighbours?.length && state.mode === "browse"
      ? section(
          t("detail.neighbours"),
          `<ul class="space-y-1 text-[0.9375rem]">` +
            forest.neighbours
              .map(
                (n) =>
                  `<li class="flex justify-between gap-3">` +
                  `<button type="button" data-goto="${esc(n.id)}" class="text-left underline decoration-line-strong underline-offset-2 hover:decoration-text">` +
                  `${esc(forestById(n.id)?.name ?? n.id)}</button>` +
                  `<span class="tnum shrink-0 text-faint">${num(n.km, 1, "km", locale())}</span></li>`,
              )
              .join("") +
            `</ul>`,
        )
      : "") +

    `<p class="border-t border-line bg-raised px-6 py-4 text-sm leading-relaxed text-soft">` +
    `${t("warn.noKey")}</p>` +
    `</article>`
  );
}
