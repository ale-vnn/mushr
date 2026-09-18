/**
 * The static side of the data, produced by the mushr-data pipeline.
 *
 * Two layers that join on `id`, and never mix:
 *
 *   data/forests.pmtiles         the outlines, as vector tiles. The map reads
 *                                them by HTTP range request and only ever
 *                                fetches the tiles on screen.
 *   data/indicators/<dept>.json  everything measurable about each forest,
 *                                indexed by id, one file per department.
 *
 * That split is why picking a department costs one small fetch instead of a
 * national download, and why colouring the map by a different indicator never
 * reloads a single outline.
 *
 * `data/manifest.json` describes the fields, the sources and the departments;
 * it is the only file the application has to know the name of.
 */

const ROOT = `${import.meta.env.BASE_URL}data`;

export const TILES_URL = `${ROOT}/forests.pmtiles`;

let manifest = null;
const departments = new Map(); // dept code -> { id -> indicators }

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

export async function loadManifest() {
  manifest ??= await getJSON(`${ROOT}/manifest.json`);
  return manifest;
}

/** Department codes that hold at least one forest, in natural order. */
export function departmentCodes() {
  return Object.keys(departmentTable()).sort();
}

const departmentTable = () =>
  manifest?.layers?.find((l) => l.departments)?.departments ?? {};

export const departmentCount = (code) => departmentTable()[code]?.forests ?? 0;

/**
 * The extent of a department's forests, as [west, south, east, north].
 *
 * Produced by the pipeline from the outlines themselves, so it frames the
 * massifs and not the dots that stand for them — and it is known before the
 * department is loaded, which is what lets the map move the moment you choose.
 */
export const departmentBBox = (code) => departmentTable()[code]?.bbox ?? null;

/** Field descriptions, straight from the manifest: labels, units, sources. */
export const fields = () => manifest?.fields ?? {};

/**
 * Load one department's indicators, cached for the session.
 *
 * Returns an array of forests rather than the raw index, because every caller
 * wants to sort and filter them; `id` is folded into each record so a forest
 * carries its own key once it leaves the map.
 */
export async function loadDepartment(code) {
  if (!departments.has(code)) {
    const index = await getJSON(`${ROOT}/indicators/${code}.json`);
    departments.set(
      code,
      Object.entries(index).map(([id, record]) => ({ id, ...record })),
    );
  }
  return departments.get(code);
}
