/**
 * The follow board: the forests you watch, and what changed since last time.
 *
 * This is not the ranking with a filter on it. The two modes answer different
 * questions, so they get different screens.
 *
 *   Explore  "where should I go?" — a ranking against a map, because the answer
 *            depends on where things are.
 *   Follow   "did anything move?" — a board with no map at all, because you
 *            already know where these woods are. The map would be furniture.
 *
 * So the board is wide cards rather than list rows: each one carries its index,
 * its band, the week ahead and the sentence that matters — what it was when you
 * last looked, and what it is now.
 */

import { esc, num } from "./html.js";
import { t, locale } from "./i18n.js";
import { limiting } from "./score.js";
import { scoreChart } from "./charts.js";
import { departmentName } from "./departments.js";
import { state, visibleForests, entryFor, bandOf, TODAY_INDEX, CHART_FROM } from "./state.js";
import { quotaHTML } from "./list.js";

function change(id) {
  const c = state.changes[id];
  if (!c) return "";
  if (!c.from)
    return `<span data-change class="rounded-sm bg-moisture/15 px-1.5 py-0.5 text-sm text-moisture">${t("follow.new")}</span>`;
  if (c.from === c.to)
    return `<span data-change class="text-sm text-faint">${t("follow.same")}</span>`;
  return (
    `<span data-change class="rounded-sm bg-primary/15 px-1.5 py-0.5 text-sm font-semibold text-primary">` +
    esc(t("follow.changed", { from: t(`band.${c.from}`), to: t(`band.${c.to}`) })) +
    `</span>`
  );
}

function card(forest) {
  const entry = entryFor(forest);
  const key = bandOf(forest).key;
  const hold = entry ? limiting(entry) : null;
  const selected = state.selected === forest.id;

  return (
    `<li data-forest data-id="${esc(forest.id)}">` +
    `<button type="button" class="flex w-full flex-col gap-4 rounded-lg border bg-panel p-5 text-left ` +
    `${selected ? "border-primary" : "border-line hover:border-line-strong"}">` +

    `<span class="flex items-start gap-5">` +
    `<span data-score class="index-figure shrink-0 text-[3.75rem] band-${key}">${entry?.score ?? "–"}</span>` +
    `<span class="min-w-0 flex-1">` +
    `<span data-name class="block text-lg leading-snug font-semibold">${esc(forest.name)}</span>` +
    `<span class="mt-1 block text-sm text-soft">${esc(departmentName(forest.dept))}, ` +
    `${num(forest.area_ha, 0, "ha", locale())}</span>` +
    `<span class="mt-2 block band-${key} text-base font-semibold">${t(`band.${key}`)}</span>` +
    `</span></span>` +

    `<span class="flex flex-wrap items-center gap-2">${change(forest.id)}` +
    (hold
      ? `<span class="text-sm text-soft">${t("limiting.prefix")} ${t(`limiting.${hold.key}`)}</span>`
      : "") +
    `</span>` +

    // With no map to share the screen, a card can afford the whole chart rather
    // than a sparkline — the month behind and the week ahead is the answer to
    // "did anything move".
    `<span data-spark class="block">${scoreChart(forest.scores, TODAY_INDEX, { from: CHART_FROM, height: 88 })}</span>` +
    `</button></li>`
  );
}

const notice = (title, body) =>
  `<div class="mx-auto max-w-md px-6 py-20 text-center">` +
  `<p class="text-xl font-semibold">${title}</p>` +
  (body ? `<p data-wait class="mt-3 text-[0.9375rem] leading-relaxed text-soft">${body}</p>` : "") +
  `</div>`;

export function boardHTML() {
  if (state.status === "loading") return notice(t("panel.followLoading"), "");
  if (state.status === "waiting" || state.status === "blocked")
    return `<div class="mx-auto max-w-md py-16">${quotaHTML()}</div>`;
  if (state.status === "error")
    return notice(t("error.data", { reason: state.error }), "");
  if (!state.forests.length) return notice(t("follow.emptyTitle"), t("panel.followEmpty"));

  const forests = visibleForests();
  return (
    `<div class="mx-auto max-w-6xl px-6 py-7">` +
    `<h2 class="mb-4 text-sm text-soft">${t("follow.heading", { n: forests.length })}</h2>` +
    `<ul class="grid gap-5 md:grid-cols-2">${forests.map(card).join("")}</ul>` +
    `</div>`
  );
}

