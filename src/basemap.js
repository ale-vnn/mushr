/**
 * A basemap that shows woodland and keeps quiet about everything else.
 *
 * An off-the-shelf basemap draws a country: roads, buildings, labels, land use
 * in a dozen shades. Every one of those strokes competes with the subject. So
 * the style is written by hand from the OpenMapTiles schema that OpenFreeMap
 * serves, and it keeps four things:
 *
 *   land       the paper of the page, so the map and the panels are one surface
 *   water      a shade cooler, because a lake is a hole and not a feature
 *   woodland   all of it, private forest included — three quarters of the
 *              forest of France, none of which is in the ONF layer. The map
 *              then answers two questions at once: where the woods are, and
 *              which of them you may pick in.
 *   boundaries departments as hairlines, since the application is scoped by
 *              department and a border you cannot see is not a border
 *
 * Roads are present but barely: enough to recognise where you are and to judge
 * whether a massif is reachable, drawn lighter than the woodland so they never
 * take the eye.
 *
 * OpenFreeMap needs no key and sets no quota.
 */

const OFM = "https://tiles.openfreemap.org";

// The map's half of the theme. A MapLibre style is JSON and cannot read a CSS
// custom property, so these five values are stated twice — here and in app.css.
export const MAP_COLOURS = {
  land: "#f2f4f1",
  water: "#dce6ea",
  waterLine: "#c6d5db",
  wood: "#c9d6c2",
  woodEdge: "#b3c4ab",
  road: "#e6e9e3",
  roadMinor: "#ecefe9",
  boundary: "#c0cabd",
  label: "#5c6b60",
  labelHalo: "#f2f4f1",
};

export function basemapStyle() {
  return {
    version: 8,
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      basemap: {
        type: "vector",
        url: `${OFM}/planet`,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
          '<a href="https://openfreemap.org/">OpenFreeMap</a>',
      },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": MAP_COLOURS.land } },
      {
        id: "water",
        type: "fill",
        source: "basemap",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": MAP_COLOURS.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "basemap",
        "source-layer": "waterway",
        minzoom: 8,
        paint: { "line-color": MAP_COLOURS.waterLine, "line-width": 0.8 },
      },
      {
        id: "wood",
        type: "fill",
        source: "basemap",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: {
          "fill-color": MAP_COLOURS.wood,
          // Woodland fades in with zoom: at national scale it would be a single
          // smear, and the point is to read shapes.
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 0.9, 12, 1],
        },
      },
      {
        id: "wood-edge",
        type: "line",
        source: "basemap",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        minzoom: 9,
        paint: { "line-color": MAP_COLOURS.woodEdge, "line-width": 0.6 },
      },
      {
        id: "road",
        type: "line",
        source: "basemap",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
        minzoom: 7,
        paint: {
          "line-color": [
            "match", ["get", "class"],
            "motorway", MAP_COLOURS.road,
            "trunk", MAP_COLOURS.road,
            MAP_COLOURS.roadMinor,
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 12, 2.4],
        },
      },
      {
        id: "boundary-department",
        type: "line",
        source: "basemap",
        "source-layer": "boundary",
        filter: ["all", ["<=", ["get", "admin_level"], 6], [">=", ["get", "admin_level"], 4]],
        paint: {
          "line-color": MAP_COLOURS.boundary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 1.1],
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "boundary-country",
        type: "line",
        source: "basemap",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 2],
        paint: { "line-color": MAP_COLOURS.boundary, "line-width": 1.4 },
      },
      {
        id: "place",
        type: "symbol",
        source: "basemap",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
        minzoom: 7,
        layout: {
          "text-field": ["coalesce", ["get", "name:fr"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 12, 13],
          "text-max-width": 8,
          "text-padding": 8,
        },
        paint: {
          "text-color": MAP_COLOURS.label,
          "text-halo-color": MAP_COLOURS.labelHalo,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
