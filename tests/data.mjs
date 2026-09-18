/**
 * Does the copy of the datasets still match its own manifest?
 *
 * `public/data/` is a copy of what the mushr-data pipeline produces. Copies
 * drift: a department file goes missing, a rebuild changes the field list, the
 * tiles are updated and the indicators are not. None of that breaks the build,
 * and all of it breaks the application in front of someone.
 *
 * So the manifest is treated as the contract and checked against the files on
 * disk. No network, no browser.
 *
 *   npm run test:data
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";

const ROOT = new URL("../public/data/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, ROOT), "utf8"));

const manifest = read("manifest.json");
const layers = Object.fromEntries(manifest.layers.map((l) => [l.role, l]));
const departments = layers.indicators.departments;

test("the manifest describes the two layers and how they join", () => {
  assert.equal(manifest.join.key, "id");
  assert.ok(layers.representation, "a representation layer");
  assert.ok(layers.indicators, "an indicator layer");
  assert.ok(Object.keys(manifest.fields).length > 5, "the fields are described");
});

test("the tiles are present and are PMTiles", () => {
  const file = new URL(layers.representation.file, ROOT);
  assert.ok(existsSync(file), `${layers.representation.file} exists`);
  const head = readFileSync(file).subarray(0, 7).toString("latin1");
  assert.equal(head, "PMTiles", "the magic bytes say so");
});

test("every department the manifest lists is on disk, at the size it claims", () => {
  for (const [code, meta] of Object.entries(departments)) {
    const file = new URL(`indicators/${code}.json`, ROOT);
    assert.ok(existsSync(file), `indicators/${code}.json exists`);
    assert.equal(statSync(file).size, meta.bytes, `indicators/${code}.json is the size claimed`);
  }
});

test("no department file is on disk that the manifest does not list", () => {
  const onDisk = readdirSync(new URL("indicators/", ROOT))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
  assert.deepEqual(onDisk.sort(), Object.keys(departments).sort());
});

test("each department holds the forests it claims, and they carry the fields", () => {
  const described = new Set(Object.keys(manifest.fields));
  let total = 0;
  for (const [code, meta] of Object.entries(departments)) {
    const records = Object.values(read(`indicators/${code}.json`));
    assert.equal(records.length, meta.forests, `${code} holds ${meta.forests} forests`);
    total += records.length;
    for (const key of Object.keys(records[0])) {
      assert.ok(described.has(key), `${code}: the manifest describes "${key}"`);
    }
  }
  assert.equal(total, layers.indicators.records, "the total matches the manifest");
});

test("every department carries an extent the map can frame", () => {
  for (const [code, meta] of Object.entries(departments)) {
    const [w, s, e, n] = meta.bbox ?? [];
    assert.ok(w < e && s < n, `${code}: the extent is the right way round`);
    assert.ok(w >= -6 && e <= 10 && s >= 41 && n <= 52, `${code}: the extent is in France`);
  }
});

test("what the application reads is named, not guessed", () => {
  // These are the fields the views index by hand; a rebuild that renamed one
  // would leave blanks on screen rather than fail anywhere.
  for (const key of ["name", "ownership", "area_ha", "lat", "lon", "elevation_m", "neighbours"]) {
    assert.ok(key in manifest.fields, `the manifest still describes "${key}"`);
  }
});
