# Mushr

Where and when to go looking for mushrooms, in the public forests of France.

An index from 0 to 100 per forest, from today to six days out, built from the
rain that fell two weeks ago, how damp the ground stayed since, and how warm it
is at root depth. A static web page: no account, no server, no API key.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm test           # model, data — no network, one second
npm run build
npm run preview    # serve the build at http://localhost:4173/mushr/
npm run test:smoke # the built site in a real browser, offline, about five seconds
```

## Two screens

**Browse** — *where should I go?* Pick a department, read the ranking against
the map, open a forest to see what its index is made of.

**Follow** — *did anything move?* The forests you watch, wherever they are, with
what changed since your last visit: "Paimpont went from Fair to Good". No map
here; you already know where those woods are.

## What it does

- **An index per forest**, today to D+6, computed in the browser.
- **The index explained**: every factor with the raw reading behind it, so it
  can be argued with rather than taken on faith.
- **The limiting factor named** — "held back by soil temperature", not three
  bars to interpret.
- **A month of history and the week ahead**, with the rainfall, soil moisture
  and soil temperature the index is built from.
- **Trigger episodes**: past rain that should fruit, and the window it should
  fruit in.
- **What grows there**: which trees a forest is made of, which is what decides
  which mushrooms can grow in it at all.
- **Filters and ranking** by index, trend, area, name, ownership.
- **Nearby forests**, to chain two of them in one outing.

Everything you choose — department, day, filters, followed forests, language —
stays in the browser and never leaves it.

## The index

Five agronomic facts, spelled out in `src/score.js`:

1. **The rain that matters fell one to three weeks ago.** The mycelium takes
   that long to turn water into fruit bodies, so today's rain says almost
   nothing about today's picking. Each rain day is weighted by its age through a
   response kernel — nil before 6 days, strongest at 14, spent by 24.
2. **The ground must have stayed damp since.** The *driest* reading between the
   trigger rain and the day in question decides, not the average: one dry week
   aborts a flush and an average would hide it.
3. **Soil temperature gates everything**, optimum around 12–18 °C at 6 cm,
   dormant below 8 and above 24. Scored per reading and averaged, because the
   response curve is not linear: a day swinging from 6 to 20 °C is not the flat
   13 °C it averages to.
4. **A sharp cooling of the soil is a trigger of its own** — a bounded bonus,
   never a factor, because the absence of a cold snap does not forbid fruiting.
5. **Frost destroys standing fruit bodies.**

They combine as a **weighted geometric mean**, not a sum: Liebig's law of the
minimum, where a single factor at zero zeroes the index. No incubation rain
means no mushrooms however perfect the temperature — and the index says so.

The thresholds are orders of magnitude from the literature, not values
calibrated on French forests. The index ranks days and places; it does not
predict a harvest. Ground truth always wins.

## Structure

```
index.html            the shell
app.css               Tailwind, the theme, and the SVG chart marks
main.js               boot, controls, render loop
src/score.js          the index model — the only business logic
src/weather.js        Open-Meteo client
src/state.js          state, and the selectors every view reads it through
src/map.js            MapLibre, feature state
src/basemap.js        a basemap that shows woodland and little else
src/list.js           the ranking
src/board.js          the follow board
src/detail.js         the panel where the index is argued
src/charts.js         inline SVG, no charting library
src/i18n.js           French and English
public/data/          the static layers
tests/                unit, data, and a real browser
```

`src/score.js` is pure — no DOM, no fetch, no words. That is what keeps it
testable, and what let it move here from an earlier prototype untouched.

## Deployment

Push to `main`. `.github/workflows/deploy.yml` checks, builds and publishes to
GitHub Pages; the site is uploaded from the same job that tested it. Turn it on
once with **Settings → Pages → Source: GitHub Actions**. There are no secrets,
because there are no keys.

## Known limits

- Soil forecasts stop around day +7, which bounds the index to a week. The limit
  is drawn rather than left to guess.
- One sampling point per forest: the slopes and hollows of one massif are not
  distinguished, and forests within about three kilometres share a reading.
- Ownership comes from the ONF, but **picking rules vary by forest and by
  prefectoral order**. Read the signs at the forest entrance.
- **No species identification.** Every harvest must be checked by a pharmacist
  or a mycological society.

## Licence

MIT for the code. The datasets keep their own licences, listed in
`public/data/manifest.json` and credited on the map.
