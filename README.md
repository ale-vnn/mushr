# Mushr

Where and when to go looking for mushrooms in the public forests of France: an
index from 0 to 100 per forest, today to six days out, computed from rain, soil
moisture and soil temperature. A static page, no account, no server, no API key.

## Run it

```bash
npm install
npm run dev         # http://localhost:3000
npm test            # unit and data checks, no network
npm run build
npm run test:smoke  # built site in Chrome, run by hand
```

## Usage

- **Browse**: pick a department, read the ranking on the map, open a forest to
  see what its index is made of.
- **Follow**: the forests you watch, and what changed since your last visit.

Works on a phone. Preferences stay in the browser.

## The index

Rain from one to three weeks ago, ground that stayed damp since, and soil
temperature, combined as a weighted geometric mean: one factor at zero zeroes
the index. Frost cancels it. The model lives in `src/score.js`.

It ranks days and places; it does not predict a harvest.

## Deployment

Push to `main`: GitHub Actions checks, builds and publishes to GitHub Pages.

## Limits

- Forecasts stop around day +7.
- Picking rules vary by forest: read the signs on site.
- **No species identification**: have every harvest checked by a pharmacist or
  a mycological society.

## Licence

MIT for the code. Datasets keep their own licences, listed in
`public/data/manifest.json` and credited on the map.
