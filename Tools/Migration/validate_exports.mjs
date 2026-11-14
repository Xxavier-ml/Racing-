#!/usr/bin/env node
/**
 * Validates the migrated Unreal DataTable CSVs against the conversion contract.
 * Runs without TypeScript tooling, so CI can check committed data cheaply.
 *
 * Usage: node Tools/Migration/validate_exports.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
const checks = [];

function check(condition, message) {
  checks.push(message);
  if (!condition) failures.push(message);
}

function readCsv(relativePath) {
  const text = readFileSync(resolve(ROOT, relativePath), 'utf8').trimEnd();
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  });
  return { header, rows };
}

const EXPECTED = [
  ['Content/Data/Track/DT_Checkpoints.csv', ['Name', 'Id', 'CenterX', 'CenterY', 'RadiusCm', 'bIsFinishLine', 'LandmarkId', 'LatitudeE6', 'LongitudeE6'], 7],
  ['Content/Data/Track/DT_RacingLine.csv', ['Name', 'Order', 'X', 'Y', 'CheckpointId', 'bIsFinishLine', 'MaxSpeedKph'], 23],
  ['Content/Data/Track/DT_Streets.csv', ['Name', 'DisplayName', 'SwahiliTag', 'bNorthSouth', 'FixAxisCm', 'StartAlongCm', 'EndAlongCm', 'WidthCm', 'bHasMedian', 'SpeedLimitKph'], 8],
  ['Content/Data/Track/DT_Landmarks.csv', ['Name', 'DisplayName', 'ShortName', 'District', 'X', 'Y', 'WaypointX', 'WaypointY', 'ColliderHalfWCm', 'ColliderHalfDCm', 'HeightCm', 'LatitudeE6', 'LongitudeE6'], 10],
  ['Content/Data/Track/DT_Roundabouts.csv', ['Name', 'DisplayName', 'X', 'Y', 'OuterRadiusCm', 'IslandRadiusCm'], 5],
  ['Content/Data/Track/DT_CityBlocks.csv', ['Name', 'DisplayLabel', 'X', 'Y', 'HalfWidthCm', 'HalfDepthCm', 'HeightCm'], 20],
  ['Content/Data/Vehicles/DT_VehicleConfigs.csv', ['Name', 'DisplayName', 'Subtitle', 'Plate', 'LegacyPresetId', 'TopSpeedKph', 'LegacyMaxSpeedMps', 'LegacyAccel', 'LegacyHandling', 'LegacyDriftGrip', 'SuggestedMassKg', 'SuggestedPeakTorqueNm', 'TuningStatus'], 3],
];

for (const [path, header, expectedRows] of EXPECTED) {
  const { header: actualHeader, rows } = readCsv(path);
  check(
    actualHeader.join(',') === header.join(','),
    `${path} header matches FNairobi*Row property names`,
  );
  check(rows.length === expectedRows, `${path} has ${expectedRows} rows (found ${rows.length})`);
}

const checkpoints = readCsv('Content/Data/Track/DT_Checkpoints.csv');
const finishRows = checkpoints.rows.filter((row) => row[5].toLowerCase() === 'true');
check(finishRows.length === 1, 'exactly one finish-line checkpoint');
check(checkpoints.rows[checkpoints.rows.length - 1][5].toLowerCase() === 'true', 'finish line is the last checkpoint in order');

const checkpointIds = checkpoints.rows.map((row) => Number(row[1]));
check(new Set(checkpointIds).size === checkpointIds.length, 'checkpoint ids are unique');
check(checkpointIds.every((id) => Number.isFinite(id) && id > 0), 'checkpoint ids are positive integers');

const racingLine = readCsv('Content/Data/Track/DT_RacingLine.csv');
const orders = racingLine.rows.map((row) => Number(row[1]));
check(orders.every((order, index) => order === index), 'racing line order is contiguous from 0');
check(racingLine.rows.filter((row) => row[5].toLowerCase() === 'true').length === 1, 'racing line contains one finish waypoint');

const scaleOk = (value) => Number.isFinite(Number(value)) && Math.abs(Number(value)) < 200000;
check(checkpoints.rows.every((row) => scaleOk(row[2]) && scaleOk(row[3])), 'checkpoint coordinates are plausible centimetres');
check(racingLine.rows.every((row) => scaleOk(row[2]) && scaleOk(row[3])), 'racing-line coordinates are plausible centimetres');

// Spawn must land on Kenyatta Avenue's eastbound lane, facing east in Unreal (+Y).
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'Documentation/Migration/TRACK_DATA_MANIFEST.json'), 'utf8'));
check(manifest.spawn.unreal.x === 5050 && manifest.spawn.unreal.y === -16800, 'spawn converts to Unreal (5050, -16800) cm');
check(Math.abs(manifest.spawn.unreal.yaw - Math.PI / 2) < 1e-6, 'spawn yaw faces east (+Y)');
check(manifest.circuitLengthMeters > 1000 && manifest.circuitLengthMeters < 5000, 'circuit length is plausible for the CBD loop');
check(manifest.counts.checkpoints === 7, 'manifest checkpoint count matches the table');

// Streets must carry real spans in centimetres, not raw legacy metres.
const streets = readCsv('Content/Data/Track/DT_Streets.csv');
for (const row of streets.rows) {
  const [name, , , , , startAlong, endAlong, width] = row;
  const span = Math.abs(Number(endAlong) - Number(startAlong));
  check(span > 10000, `${name} has a drivable span in centimetres (${span})`);
  check(Number(width) >= 1400 && Number(width) <= 4000, `${name} has a plausible road width (${width} cm)`);
}

if (failures.length > 0) {
  console.error(`Data validation FAILED (${failures.length} of ${checks.length} checks):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Data validation PASSED: ${checks.length} checks across 7 tables.`);
