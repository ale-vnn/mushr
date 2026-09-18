/**
 * The ranked list — the reason the page exists.
 *
 * A row carries one large numeral and three short lines: what the forest is,
 * what holds its index back, and the shape of its month. The numeral is set in
 * the display serif at a size nothing else on the page reaches, because the
 * whole question is "which wood, how good, right now" and a reader should be
 * able to answer it while scrolling past.
 *
 * In follow mode a fourth line appears — what changed since the last visit —
 * which is the only reason the follow list exists.
 */

import { esc, num } from "./html.js";
import { t, locale } from "./i18n.js";
import { limiting } from "./score.js";
import { sparkline } from "./charts.js";
import { state, visibleForests, entryFor, bandOf, TODAY_INDEX, CHART_FROM } from "./state.js";

function row(forest) {
  const entry = entryFor(forest);
  const key = bandOf(forest).key;
  const hold = entry ? limiting(entry) : null;
  const selected = state.selected === forest.id;

  // "Communale, 29 ha" reads as a sentence fragment; the same facts joined by
  // middle dots read as machine output.
  const what = [
    t(`ownership.${forest.ownership}`),
    num(forest.area_ha, 0, "ha", locale()),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    `<li data-forest data-id="${esc(forest.id)}">` +
    `<button type="button" class="flex w-full items-start gap-4 border-b border-line py-4 pr-4 pl-3.5 text-left ` +
    `edge-band-${key} hover:bg-raised ${selected ? "bg-raised" : ""}">` +
    `<span data-score class="index-figure w-14 shrink-0 text-[2.625rem] band-${key}">` +
    `${entry?.score ?? "–"}</span>` +
    `<span class="min-w-0 flex-1">` +
    `<span data-name class="block text-base leading-snug font-semibold">${esc(forest.name)}</span>` +
    `<span class="mt-1 block text-sm text-soft">${esc(what)}</span>` +
    (hold
      ? `<span class="mt-1 block text-sm text-faint">` +
        `${t("limiting.prefix")} ${t(`limiting.${hold.key}`)}</span>`
      : "") +
    `<span data-spark class="mt-2.5 block">${sparkline(forest.scores, TODAY_INDEX, { from: CHART_FROM, height: 32 })}</span>` +
    `</span></button></li>`
  );
}

/**
 * What a spent quota looks like on screen.
 *
 * A per-minute ceiling is something the application waits out by itself, so it
 * shows a countdown and says nothing else. An hourly or daily one is not worth
 * spinning on, so it explains what happened and hands back a button.
 */
export function quotaHTML() {
  const waiting = state.status === "waiting";
  const scope = state.quota === "daily" ? "daily" : "hourly";
  return (
    `<div class="px-4 py-5">` +
    `<p class="text-[0.9375rem] font-semibold">` +
    `${waiting ? t("wait.title") : t(`blocked.${scope}`)}</p>` +
    `<p data-wait class="mt-2 text-sm leading-relaxed text-soft">` +
    `${waiting ? waitBody() : t(`blocked.${scope}Body`)}</p>` +
    (waiting
      ? ""
      : `<button id="retryBtn" class="mt-3 rounded-md border border-primary px-3 py-1.5 ` +
        `text-sm font-semibold text-primary hover:bg-primary/10">${t("blocked.retry")}</button>`) +
    `</div>`
  );
}

/** Seconds left before the automatic retry, as a sentence. */
export const waitBody = () => {
  const left = Math.max(0, Math.ceil((state.retryAt - Date.now()) / 1000));
  return left > 0 ? t("wait.body", { n: left }) : t("wait.soon");
};

const notice = (text, tone = "text-soft") =>
  `<p class="px-4 py-5 text-sm leading-relaxed ${tone}">${text}</p>`;

export function listHTML() {
  if (state.status === "loading") return notice(t("panel.loading"));
  if (state.status === "waiting" || state.status === "blocked") return quotaHTML();
  if (state.status === "error")
    return notice(esc(t("error.data", { reason: state.error })), "text-band-poor");
  if (state.status === "idle") return notice(t("panel.pickDepartment"));

  const forests = visibleForests();
  if (!forests.length) return notice(t("panel.noResults"));
  return `<ul>${forests.map(row).join("")}</ul>`;
}
