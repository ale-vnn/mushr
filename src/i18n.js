/**
 * French and English, in one dictionary.
 *
 * The model in `score.js` speaks in keys — band names, limiting factors,
 * ownership classes — and this is where keys become words. Nothing here
 * decides anything; it only names what the model decided.
 */

const STRINGS = {
  fr: {
    locale: "fr-FR",
    subtitle: "Conditions de pousse dans les forêts publiques de France",
    "chart.today": "aujourd'hui",
    "panel.mode.browse": "Explorer",
    "panel.mode.follow": "Mon suivi",
    "panel.followEmpty": "Ouvrez un massif depuis l\u2019exploration et cliquez « Suivre ». Il apparaîtra ici quel que soit son département, avec ce qui a changé depuis votre dernière visite.",
    "panel.followLoading": "Chargement des massifs suivis…",
    "follow.changed": "{from} → {to} depuis votre dernière visite",
    "follow.new": "Nouveau dans le suivi",
    "follow.same": "Inchangé depuis votre dernière visite",
    "detail.rainChart": "Pluie quotidienne",
    "detail.moistureChart": "Humidité du sol",
    "detail.soilTempChart": "Température du sol",
    "detail.close": "Fermer",
    "detail.empty": "Choisissez un massif dans la liste ou sur la carte.",
    "unit.mm": "mm",
    "unit.pct": "%",
    "unit.degC": "°C",
    "dept.forests": "{n} massifs",
    "panel.pickOne": "Choisir…",
    "follow.emptyTitle": "Rien à suivre pour l'instant",
    "follow.heading": "{n} massifs suivis",
    "nav.explore.hint": "Classer les massifs d'un département",
    "nav.follow.hint": "Voir ce qui a bougé sur vos massifs",
    "panel.department": "Département",
    "panel.departmentHint": "Choisir un département charge ses massifs.",
    "panel.filters": "Filtres",
    "panel.ownership": "Statut foncier",
    "panel.minArea": "Surface minimale",
    "panel.minScore": "Indice minimum",
    "panel.sort": "Trier par",
    "panel.day": "Jour",
    "panel.results": "Massifs",
    "panel.loading": "Chargement…",
    "panel.noResults": "Aucun massif ne passe les filtres.",
    "panel.pickDepartment": "Choisir un département pour commencer.",
    "sort.score": "Indice",
    "sort.trend": "Progression",
    "sort.area": "Surface",
    "sort.name": "Nom",
    "day.today": "Aujourd'hui",
    "day.todayShort": "auj.",
    "day.tomorrow": "Demain",
    "day.plus": "J+{n}",
    "band.excellent": "Excellent",
    "band.good": "Favorable",
    "band.fair": "Moyen",
    "band.poor": "Faible",
    "band.none": "Nul",
    "band.unknown": "Inconnu",
    "limiting.rain": "la pluie d'incubation",
    "limiting.moisture": "l'humidité du sol",
    "limiting.soilTemp": "la température du sol",
    "limiting.continuity": "l'assèchement depuis la pluie",
    "limiting.frost": "le gel",
    "limiting.prefix": "Bloqué par",
    "ownership.domaniale": "Domaniale",
    "ownership.communale": "Communale",
    "ownership.departementale": "Départementale",
    "ownership.regionale": "Régionale",
    "ownership.autre-publique": "Autre publique",
    "detail.factors": "Facteurs",
    "detail.rain": "Pluie d'incubation",
    "detail.moisture": "Humidité du sol (3-9 cm)",
    "detail.soilTemp": "Température du sol (6 cm)",
    "detail.composition": "Peuplement",
    "detail.broadleaf": "Feuillus",
    "detail.conifer": "Conifères",
    "detail.mixed": "Mixte",
    "detail.open": "Sans couvert",
    "detail.surveyed": "décrit à {n} %",
    "detail.notSurveyed": "Composition non décrite par BD Forêt.",
    "detail.terrain": "Terrain",
    "detail.area": "Surface",
    "detail.elevation": "Altitude",
    "detail.edge": "Lisière",
    "detail.neighbours": "Massifs voisins",
    "detail.history": "31 jours écoulés et semaine à venir",
    "detail.triggers": "Épisodes déclencheurs",
    "detail.triggerLine": "{mm} mm du {start} au {end}, fructification attendue du {flushStart} au {flushEnd}",
    "detail.noTriggers": "Aucune pluie déclenchante dans le mois écoulé.",
    "detail.favourite": "Suivre",
    "detail.unfavourite": "Ne plus suivre",
    "trend.up": "en hausse",
    "trend.down": "en baisse",
    "trend.flat": "stable",
    "trend.peak": "maximum {date}",
    "trend.horizon": "prévision jusqu'au {date}",
    "error.weather": "Météo indisponible : {reason}",
    "wait.title": "Le service météo demande une pause",
    "wait.body": "Open-Meteo limite le nombre de points interrogés par minute, et un département en compte beaucoup. Nouvelle tentative dans {n} s.",
    "wait.soon": "Nouvelle tentative…",
    "blocked.hourly": "Quota horaire atteint",
    "blocked.daily": "Quota du jour atteint",
    "blocked.hourlyBody": "Open-Meteo plafonne le nombre de points interrogés par heure. Les massifs déjà consultés restent lisibles ; les autres reviendront à la prochaine heure.",
    "blocked.dailyBody": "Open-Meteo plafonne le nombre de points interrogés par jour. Les massifs déjà consultés restent lisibles ; les autres reviendront demain.",
    "blocked.retry": "Réessayer",
    "error.data": "Données indisponibles : {reason}",
    "warn.noKey": "Aucune identification d'espèce. Toute récolte doit être vérifiée par un pharmacien ou une société mycologique, et la réglementation de cueillette varie par massif.",
  },
  en: {
    locale: "en-GB",
    subtitle: "Fruiting conditions in the public forests of France",
    "chart.today": "today",
    "panel.mode.browse": "Browse",
    "panel.mode.follow": "Following",
    "panel.followEmpty": "Open a forest from Browse and click “Follow”. It will appear here whatever its department, with what changed since your last visit.",
    "panel.followLoading": "Loading followed forests…",
    "follow.changed": "{from} → {to} since your last visit",
    "follow.new": "New in your list",
    "follow.same": "Unchanged since your last visit",
    "detail.rainChart": "Daily rainfall",
    "detail.moistureChart": "Soil moisture",
    "detail.soilTempChart": "Soil temperature",
    "detail.close": "Close",
    "detail.empty": "Pick a forest from the list or on the map.",
    "unit.mm": "mm",
    "unit.pct": "%",
    "unit.degC": "°C",
    "dept.forests": "{n} forests",
    "panel.pickOne": "Choose…",
    "follow.emptyTitle": "Nothing followed yet",
    "follow.heading": "{n} forests followed",
    "nav.explore.hint": "Rank the forests of a department",
    "nav.follow.hint": "See what moved on the forests you watch",
    "panel.department": "Department",
    "panel.departmentHint": "Picking a department loads its forests.",
    "panel.filters": "Filters",
    "panel.ownership": "Ownership",
    "panel.minArea": "Minimum area",
    "panel.minScore": "Minimum index",
    "panel.sort": "Sort by",
    "panel.day": "Day",
    "panel.results": "Forests",
    "panel.loading": "Loading…",
    "panel.noResults": "No forest passes the filters.",
    "panel.pickDepartment": "Pick a department to start.",
    "sort.score": "Index",
    "sort.trend": "Trend",
    "sort.area": "Area",
    "sort.name": "Name",
    "day.today": "Today",
    "day.todayShort": "now",
    "day.tomorrow": "Tomorrow",
    "day.plus": "D+{n}",
    "band.excellent": "Excellent",
    "band.good": "Good",
    "band.fair": "Fair",
    "band.poor": "Poor",
    "band.none": "None",
    "band.unknown": "Unknown",
    "limiting.rain": "incubation rainfall",
    "limiting.moisture": "soil moisture",
    "limiting.soilTemp": "soil temperature",
    "limiting.continuity": "the dry spell since the rain",
    "limiting.frost": "frost",
    "limiting.prefix": "Held back by",
    "ownership.domaniale": "State",
    "ownership.communale": "Communal",
    "ownership.departementale": "Departmental",
    "ownership.regionale": "Regional",
    "ownership.autre-publique": "Other public",
    "detail.factors": "Factors",
    "detail.rain": "Incubation rainfall",
    "detail.moisture": "Soil moisture (3-9 cm)",
    "detail.soilTemp": "Soil temperature (6 cm)",
    "detail.composition": "Stand",
    "detail.broadleaf": "Broadleaf",
    "detail.conifer": "Conifer",
    "detail.mixed": "Mixed",
    "detail.open": "Unwooded",
    "detail.surveyed": "{n}% surveyed",
    "detail.notSurveyed": "Stand composition not described by BD Forêt.",
    "detail.terrain": "Terrain",
    "detail.area": "Area",
    "detail.elevation": "Elevation",
    "detail.edge": "Edge",
    "detail.neighbours": "Nearby forests",
    "detail.history": "Past 31 days and the week ahead",
    "detail.triggers": "Trigger episodes",
    "detail.triggerLine": "{mm} mm from {start} to {end}, fruiting expected {flushStart} to {flushEnd}",
    "detail.noTriggers": "No trigger rainfall in the past month.",
    "detail.favourite": "Follow",
    "detail.unfavourite": "Unfollow",
    "trend.up": "rising",
    "trend.down": "falling",
    "trend.flat": "flat",
    "trend.peak": "peak {date}",
    "trend.horizon": "forecast to {date}",
    "error.weather": "Weather unavailable: {reason}",
    "wait.title": "The weather service is asking for a pause",
    "wait.body": "Open-Meteo caps how many points can be queried per minute, and a department holds a lot of them. Trying again in {n} s.",
    "wait.soon": "Trying again…",
    "blocked.hourly": "Hourly quota reached",
    "blocked.daily": "Daily quota reached",
    "blocked.hourlyBody": "Open-Meteo caps how many points can be queried per hour. Forests already looked at stay readable; the rest come back next hour.",
    "blocked.dailyBody": "Open-Meteo caps how many points can be queried per day. Forests already looked at stay readable; the rest come back tomorrow.",
    "blocked.retry": "Try again",
    "error.data": "Data unavailable: {reason}",
    "warn.noKey": "No species identification. Every harvest must be checked by a pharmacist or a mycological society, and picking rules vary from one forest to the next.",
  },
};

const LANG_KEY = "mushr.lang";

let lang = "fr";
const listeners = new Set();

/** Translate a key, substituting {placeholders} from `vars`. */
export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/** The BCP 47 tag the current language formats numbers and dates with. */
export const locale = () => STRINGS[lang].locale;

export const getLang = () => lang;

export function setLang(next) {
  if (!STRINGS[next] || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* nothing to do */
  }
  document.documentElement.lang = lang;
  applyStatic();
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn) {
  listeners.add(fn);
}

/**
 * Fill the elements that carry their key in the markup, so the static shell of
 * the page needs no JavaScript of its own.
 */
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

export function initI18n() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && STRINGS[saved]) lang = saved;
  } catch {
    /* the default stands */
  }
  document.documentElement.lang = lang;
  applyStatic();
}
