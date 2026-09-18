/**
 * The map: a basemap that shows woodland, and the ONF outlines on top of it.
 *
 * MapLibre GL rather than Leaflet, for one reason: it reads PMTiles natively
 * through a protocol handler, so the 14 000 outlines of France come down as
 * vector tiles by HTTP range request instead of as a 60 MB GeoJSON. It is the
 * open fork, so there is still no token and no account anywhere here.
 *
 * The basemap is written by hand in `basemap.js` rather than taken off the
 * shelf — see that file for why.
 *
 * Colouring goes through MapLibre feature state, not through a rebuilt paint
 * expression. The outlines never change; only the number attached to each one
 * does, once per day change. Feature state is exactly that distinction.
 */

import { TILES_URL } from "./data.js";
import { basemapStyle } from "./basemap.js";

// MapLibre and its stylesheet are a megabyte, and Follow has no map at all. So
// they are fetched when a map is first asked for, not when the page loads —
// which also lets the ranking paint before the engine arrives.
let maplibregl = null;
let pendingFrame = null;

/**
 * The band ramp, as the map draws it.
 *
 * It matches `--band-*` in the stylesheet and has to be repeated here because a
 * MapLibre style is JSON and cannot read a custom property. Changing one means
 * changing the other; there is no third place.
 */
const BAND_COLOURS = {
  excellent: "#00f5a0",
  good: "#a3ff12",
  fair: "#ffd60a",
  poor: "#ff6b35",
  none: "#8a978d",
};

const SOURCE = "forests";
const SOURCE_LAYER = "forests";

// France, for a first visit with nothing chosen yet.
const HOME = { center: [2.4, 46.6], zoom: 4.8 };

let map = null;
let ready = false;

/**
 * Build the map, already looking where it should.
 *
 * `bounds` matters more than it sounds: created on the national view and moved
 * afterwards, the map loads a basemap tile for the whole of France before
 * throwing it away. Starting on the department skips that entirely.
 */
export async function initMap(container, { bounds } = {}) {
  if (map) return map;

  const [gl, pmtiles] = await Promise.all([
    import("maplibre-gl"),
    import("pmtiles"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  maplibregl = gl.default;
  const { PMTiles, Protocol } = pmtiles;

  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  protocol.add(new PMTiles(TILES_URL));

  const style = basemapStyle();
  style.sources[SOURCE] = {
    type: "vector",
    url: `pmtiles://${TILES_URL}`,
    // Feature state needs a stable feature id, and ours is the ONF id.
    promoteId: { [SOURCE_LAYER]: "id" },
    attribution: "Forests &copy; ONF / IGN",
  };
  style.layers.push(
    {
      id: "forest-fill",
      type: "fill",
      source: SOURCE,
      "source-layer": SOURCE_LAYER,
      paint: {
        // A forest outside the loaded department is drawn as a pale outline
        // only: present, giving context, making no claim.
        "fill-color": [
          "case",
          ["!=", ["feature-state", "band"], null],
          [
            "match",
            ["feature-state", "band"],
            "excellent", BAND_COLOURS.excellent,
            "good", BAND_COLOURS.good,
            "fair", BAND_COLOURS.fair,
            "poor", BAND_COLOURS.poor,
            BAND_COLOURS.none,
          ],
          "#aebaa8",
        ],
        // A forest whose index is nil is still a forest you may pick in, so it
        // keeps its outline and lets the woodland underneath show through
        // rather than sitting there as a grey hole.
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false], 0.95,
          ["==", ["feature-state", "band"], "none"], 0.3,
          ["!=", ["feature-state", "band"], null], 0.85,
          0.16,
        ],
      },
    },
    {
      id: "forest-line",
      type: "line",
      source: SOURCE,
      "source-layer": SOURCE_LAYER,
      paint: {
        // The outline is what says "public forest", and it says it whatever the
        // index reads — so it is drawn for every loaded massif, not only the
        // ones with a colour worth showing. Dark, because the fills are
        // electric and need holding down on a pale map.
        "line-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false], "#0b100e",
          ["!=", ["feature-state", "band"], null], "#28352c",
          "#a8b4a5",
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false], 2.6,
          ["!=", ["feature-state", "band"], null], 1.2,
          0.5,
        ],
      },
    },
  );

  map = new maplibregl.Map({
    container,
    ...(bounds
      ? { bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]], fitBoundsOptions: { padding: 48, maxZoom: 10.5 } }
      : HOME),
    attributionControl: { compact: true },
    style,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "bottom-right");

  await new Promise((resolve) => map.on("load", resolve));
  ready = true;
  if (pendingFrame) {
    const { bbox, padding, animate } = pendingFrame;
    pendingFrame = null;
    fitBBox(bbox, { padding, animate });
  }
  return map;
}

/** Notify on a click anywhere on a forest, by id. */
export function onForestClick(handler) {
  map?.on("click", "forest-fill", (e) => {
    const id = e.features?.[0]?.properties?.id;
    if (id) handler(id);
  });
  map?.on("mouseenter", "forest-fill", () => (map.getCanvas().style.cursor = "pointer"));
  map?.on("mouseleave", "forest-fill", () => (map.getCanvas().style.cursor = ""));
}

const applied = new Set();

/**
 * Paint the forests of the loaded department by band, and clear whatever the
 * previous department had painted.
 */
export function paint(forests, bandOf, selected) {
  if (!ready) return;
  for (const id of applied) {
    map.removeFeatureState({ source: SOURCE, sourceLayer: SOURCE_LAYER, id });
  }
  applied.clear();
  for (const forest of forests) {
    map.setFeatureState(
      { source: SOURCE, sourceLayer: SOURCE_LAYER, id: forest.id },
      { band: bandOf(forest).key, selected: forest.id === selected },
    );
    applied.add(forest.id);
  }
}

/**
 * Frame a department from the extent the pipeline measured for it.
 *
 * Preferred over fitting to the loaded forests: the extent is known before the
 * weather request returns, so the map moves the moment a department is chosen
 * rather than a few seconds later, and it frames the massifs themselves rather
 * than the points that stand for them.
 */
export function fitBBox(bbox, { padding = 48, animate = true } = {}) {
  if (!bbox) return;
  // Asked for before the engine finished starting, the frame used to be
  // dropped on the floor: pick a department in the first second and the map
  // stayed on France. It is remembered instead, and applied on load.
  if (!ready) {
    pendingFrame = { bbox, padding, animate: false };
    return;
  }
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding, maxZoom: 10.5, duration: animate ? 700 : 0 },
  );
}

/** Where the map is looking, once it is looking anywhere. Read by the tests. */
export const view = () =>
  ready ? { centre: map.getCenter().toArray(), zoom: map.getZoom() } : null;

/** Whether the engine has finished starting. Read by the tests. */
export const mapReady = () => ready;

export function flyTo(forest) {
  if (!ready || !forest) return;
  map.flyTo({ center: [forest.lon, forest.lat], zoom: 12, duration: 700 });
}
