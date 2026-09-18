/**
 * Boot: build the map, wire the controls, render on every change.
 *
 * No framework and no router. One `render()` redraws the list and the detail
 * sheet from the state, and the map is repainted from the same source. At a few
 * hundred forests per department this is fast enough that anything cleverer
 * would only be harder to read.
 *
 * Every preference — department, day, filters, sort, followed forests,
 * language, tab — goes to localStorage and comes back on the next visit.
 * Nothing leaves the browser.
 */

// Latin subsets only. The full packages carry Greek, Cyrillic and Vietnamese,
// which a French and English application ships for nobody. Self-hosted rather
// than linked from Google Fonts, which would send every visitor's IP address to
// a third party — the one thing this application promises not to do.
// One family, latin subset only — 24 kB. Self-hosted rather than linked from
// Google Fonts, which would send every visitor's IP address to a third party:
// the one thing this application promises not to do.
import "@fontsource-variable/manrope/wght.css";
import "./app.css";

import { initI18n, applyStatic, setLang, getLang, onLangChange, t, locale } from "./src/i18n.js";
import { loadManifest, departmentCodes, departmentCount, departmentBBox } from "./src/data.js";
import { departmentName } from "./src/departments.js";
import { initMap, onForestClick, paint, fitBBox, flyTo, view, mapReady } from "./src/map.js";
import {
  state, onRender, render, selectDepartment, loadFollowed, noteDepartment,
  setDay, setSelected, visibleForests, bandOf, forestById, retry, FORECAST_DAYS, TODAY_INDEX,
} from "./src/state.js";
import { getPrefs, setPrefs, toggleFavourite, isFavourite } from "./src/store.js";
import { listHTML, waitBody } from "./src/list.js";
import { boardHTML } from "./src/board.js";
import { detailHTML } from "./src/detail.js";

const $ = (sel) => document.querySelector(sel);

const OWNERSHIP = ["domaniale", "communale", "departementale", "regionale", "autre-publique"];

// ------------------------------------------------------------------ controls

/**
 * The department picker, named.
 *
 * "35 (29)" asks the reader to work out which number is a department and which
 * a count. The name does that work instead.
 */
function buildDepartments(codes) {
  const saved = getPrefs().dept;
  $("#dept").innerHTML =
    `<option value="">${t("panel.pickOne")}</option>` +
    codes
      .map(
        (c) =>
          `<option value="${c}" ${c === saved ? "selected" : ""}>` +
          `${c} ${departmentName(c)} — ${t("dept.forests", { n: departmentCount(c) })}</option>`,
      )
      .join("");
}

/**
 * The day strip, dated.
 *
 * "J+4" is arithmetic the reader has to do; a weekday and a date is the thing
 * they are actually planning around.
 */
function buildDayStrip() {
  const today = new Date();
  $("#dayStrip").innerHTML = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    // Today gets a word rather than its weekday, because "is it worth going
    // now" is a different question from "is it worth going on Sunday".
    const dow =
      i === 0
        ? t("day.todayShort")
        : day.toLocaleDateString(locale(), { weekday: "short" }).replace(".", "");
    return (
      `<button type="button" class="day-btn" data-day="${i}">` +
      `<span class="dow">${dow}</span>` +
      `<span class="dom">${day.getDate()}</span></button>`
    );
  }).join("");
}

function buildOwnership() {
  const box = $("#ownership");
  const prefs = getPrefs();
  box.querySelectorAll("label").forEach((el) => el.remove());
  box.insertAdjacentHTML(
    "beforeend",
    OWNERSHIP.map(
      (o) =>
        `<label class="flex items-center gap-2 text-sm"><input type="checkbox" value="${o}" ` +
        `class="accent-primary" ${prefs.ownership.includes(o) ? "checked" : ""}>` +
        `${t(`ownership.${o}`)}</label>`,
    ).join(""),
  );
}

function buildFilters() {
  const prefs = getPrefs();
  const sort = $("#sort");
  sort.value = prefs.sort;
  sort.addEventListener("change", () => {
    setPrefs({ sort: sort.value });
    render();
  });

  for (const key of ["minArea", "minScore"]) {
    const input = $(`#${key}`);
    input.value = prefs[key];
    const sync = () => {
      $(`#${key}Out`).textContent = input.value;
    };
    sync();
    input.addEventListener("input", sync);
    input.addEventListener("change", () => {
      setPrefs({ [key]: Number(input.value) });
      render();
    });
  }
}

/**
 * The two screens.
 *
 * Browse is a ranking against a map, because "where should I go" depends on
 * where things are. Follow is a board with no map at all, because you already
 * know where those woods are — the map would be furniture. Switching modes
 * therefore changes what is on screen, not just what is in the list.
 */
/** Build the map the first time one is needed, and wire it once. */
let mapBoot = null;
function ensureMap(bounds) {
  mapBoot ??= initMap("map", { bounds }).then(() => {
    onForestClick((id) => {
      if (forestById(id)) setSelected(id);
    });
  });
  return mapBoot;
}

async function setMode(mode) {
  if (mode === state.mode && state.status !== "idle") return;
  if (mode === "follow") {
    await loadFollowed();
    return;
  }
  const dept = getPrefs().dept || $("#dept").value;
  await ensureMap(departmentBBox(dept));
  if (dept) {
    fitBBox(departmentBBox(dept));
    await selectDepartment(dept);
  } else {
    state.mode = "browse";
    state.status = "idle";
    setPrefs({ mode: "browse" });
    render();
  }
}

// -------------------------------------------------------------------- render

function draw() {
  const following = state.mode === "follow";

  // Whole screens swap, not just a list.
  $("#rail").classList.toggle("hidden", following);
  $("#map").classList.toggle("hidden", following);
  $("#deptField").classList.toggle("hidden", following);
  $("#board").classList.toggle("hidden", !following);

  // Only the live screen holds markup: leaving the other one populated would
  // keep a hidden copy of every row in the document, and anything querying the
  // page would find both.
  $("#board").innerHTML = following ? boardHTML() : "";
  $("#list").innerHTML = following ? "" : listHTML();

  const detail = $("#detail");
  detail.innerHTML = state.selected ? detailHTML(state.selected) : "";
  // The sheet takes its width from the layout, so it leaves entirely when empty
  // rather than standing there as a blank column. Below md it covers the screen
  // instead, which is what the responsive classes on it express.
  detail.classList.toggle("hidden", !state.selected);

  $("#dayStrip")
    .querySelectorAll("[data-day]")
    .forEach((b) => b.classList.toggle("is-active", Number(b.dataset.day) === state.dayOffset));
  document
    .querySelectorAll(".mode-btn")
    .forEach((b) => b.classList.toggle("is-active", b.dataset.mode === state.mode));

  const count = getPrefs().favourites.length;
  const badge = $("#followCount");
  badge.textContent = count;
  badge.hidden = count === 0;

  if (!following && state.status === "ready") paint(visibleForests(), bandOf, state.selected);
}

// --------------------------------------------------------------------- start

async function start() {
  initI18n();
  buildDayStrip();
  buildOwnership();
  buildFilters();
  applyStatic();

  const syncLang = () =>
    document
      .querySelectorAll("[data-lang]")
      .forEach((b) => b.classList.toggle("is-active", b.dataset.lang === getLang()));
  syncLang();
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  onLangChange(() => {
    syncLang();
    buildDayStrip();
    buildOwnership();
    buildDepartments(departmentCodes());
    render();
  });

  // Move the map first, then load. The extent comes from the manifest, so the
  // frame is right before the weather request has even gone out.
  $("#dept").addEventListener("change", (e) => {
    fitBBox(departmentBBox(e.target.value));
    selectDepartment(e.target.value);
  });
  $("#dayStrip").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-day]");
    if (btn) setDay(Number(btn.dataset.day));
  });
  $("#ownership").addEventListener("change", () => {
    setPrefs({ ownership: [...$("#ownership").querySelectorAll("input:checked")].map((i) => i.value) });
    render();
  });
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  // The list, the board, the detail sheet and the map all select the same way.
  const selectFrom = (e) => {
    const row = e.target.closest("[data-id]");
    if (!row) return;
    setSelected(row.dataset.id);
    if (state.mode === "browse") flyTo(forestById(row.dataset.id));
  };
  const clicked = (e) => {
    if (e.target.closest("#retryBtn")) return retry();
    selectFrom(e);
  };
  $("#list").addEventListener("click", clicked);
  $("#board").addEventListener("click", clicked);
  $("#detail").addEventListener("click", (e) => {
    const fav = e.target.closest("#favBtn");
    if (fav) {
      // A followed forest has to remember its department, or the follow list
      // cannot reload it: a favourite is an id, and an id says nothing about
      // where it lives.
      if (toggleFavourite(fav.dataset.id)) noteDepartment(fav.dataset.id, fav.dataset.dept);
      render();
      return;
    }
    if (e.target.closest("#closeDetail")) {
      setSelected(state.selected);
      return;
    }
    const goto = e.target.closest("[data-goto]");
    if (goto) {
      setSelected(goto.dataset.goto);
      flyTo(forestById(goto.dataset.goto));
    }
  });

  onRender(draw);

  // The countdown ticks without redrawing the screen around it: only the
  // sentence changes, so only the sentence is rewritten.
  setInterval(() => {
    if (state.status !== "waiting") return;
    document.querySelectorAll("[data-wait]").forEach((el) => (el.textContent = waitBody()));
  }, 1000);

  try {
    await loadManifest();
    buildDepartments(departmentCodes());
  } catch (error) {
    $("#list").innerHTML =
      `<p class="px-3 py-4 text-sm text-band-poor">${t("error.data", { reason: error.message })}</p>`;
    return;
  }

  const prefs = getPrefs();

  if (prefs.mode === "follow") {
    // The saved mode is honoured even with nothing in it: an empty board says
    // how to fill it, where falling back to Browse would just look like the
    // application forgetting. Follow shows no map, so none is built — MapLibre
    // arrives if and when the reader switches.
    await loadFollowed();
    return;
  }

  // The map is created already framed on the saved department, so it never
  // loads the national view only to leave it.
  await ensureMap(prefs.dept ? departmentBBox(prefs.dept) : null);
  if (prefs.dept) {
    await selectDepartment(prefs.dept);
  } else {
    draw();
  }
}

start();

// A handle for the browser smoke test. It exposes what the modules already
// export and changes no behaviour.
window.__mushr = { state, TODAY_INDEX, isFavourite, view, mapReady, departmentBBox };
