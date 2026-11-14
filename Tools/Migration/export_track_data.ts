/**
 * Nairobi map-data migration.
 *
 * Reads the preserved legacy Web prototype (LegacyWebPrototype/src/game/nairobiMap.ts)
 * as the single source of truth and emits Unreal DataTable-compatible CSV plus a JSON
 * manifest. Coordinate conversion is centralised here and verified before writing:
 *
 *   Legacy (three.js, metres): X = east, Z = south, Y = up, heading 0 = north (-Z)
 *   Unreal (centimetres)     : X = north (+X), Y = east (+Y), Z = up
 *
 *   Unreal.X = -Legacy.Z * 100
 *   Unreal.Y =  Legacy.X * 100
 *   Unreal.Z =  Legacy.Y * 100
 *   Yaw      =  Legacy.heading   (both measure 0 as north)
 *
 * Run: npx tsx Tools/Migration/export_track_data.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CBD_BUILDING_BLOCKS,
  CIRCUIT_CHECKPOINT_IDS,
  CIRCUIT_RACING_WAYPOINTS,
  NAIROBI_LANDMARKS,
  NAIROBI_ROUNDABOUTS,
  NAIROBI_STREETS,
  PLAYER_SPAWN,
  FINISH_LINE,
  VEHICLE_PRESETS,
} from '../../LegacyWebPrototype/src/game/nairobiMap.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CM = 100;

const errors: string[] = [];

function assertTrue(condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

function toUU(value: number): number {
  return Number(value.toFixed(1));
}

function unrealX(legacyZ: number): number {
  return toUU(-legacyZ * CM);
}

function unrealY(legacyX: number): number {
  return toUU(legacyX * CM);
}

function csvValue(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(relativePath: string, header: string[], rows: Array<Array<string | number | boolean>>): void {
  const lines = [header.join(','), ...rows.map((row) => row.map(csvValue).join(','))];
  const target = resolve(ROOT, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${lines.join('\n')}\n`, 'utf8');
  console.log(`  wrote ${relativePath} (${rows.length} rows)`);
}

// ---------------------------------------------------------------------------
// Conversion invariants (fail the migration rather than emit bad data)
// ---------------------------------------------------------------------------
assertTrue(PLAYER_SPAWN.heading === Math.PI / 2, 'Player spawn heading is expected to face east (+X)');
const spawnUX = unrealX(PLAYER_SPAWN.z);
const spawnUY = unrealY(PLAYER_SPAWN.x);
// Kenyatta Avenue in Unreal runs along +Y at X = 4500 (legacy z = -45).
assertTrue(Math.abs(spawnUX - 5050) < 1, `Spawn Unreal.X expected 5050 cm, got ${spawnUX}`);
assertTrue(Math.abs(spawnUY - -16800) < 1, `Spawn Unreal.Y expected -16800 cm, got ${spawnUY}`);

// ---------------------------------------------------------------------------
// Checkpoints: pairing circuit order with the waypoint that carries the gate
// ---------------------------------------------------------------------------
const checkpointRows: Array<Array<string | number | boolean>> = [];
const exportedCheckpointIds: string[] = [];

CIRCUIT_CHECKPOINT_IDS.forEach((landmarkId, index) => {
  const landmark = NAIROBI_LANDMARKS.find((entry) => entry.id === landmarkId);
  if (!landmark) {
    errors.push(`Unknown landmark in CIRCUIT_CHECKPOINT_IDS: ${landmarkId}`);
    return;
  }
  const waypoint = CIRCUIT_RACING_WAYPOINTS.find((entry) => entry.checkpointId === landmarkId);
  const legacyX = waypoint ? waypoint.x : landmark.waypointX;
  const legacyZ = waypoint ? waypoint.z : landmark.waypointZ;

  exportedCheckpointIds.push(landmarkId);
  checkpointRows.push([
    `CP_${String(index + 1).padStart(2, '0')}_${landmarkId.replaceAll('-', '_').toUpperCase()}`,
    index + 1,
    unrealX(legacyZ),
    unrealY(legacyX),
    1600,
    false,
    landmarkId,
    Math.round(landmark.lat * 1e6),
    Math.round(landmark.lng * 1e6),
  ]);
});

checkpointRows.push([
  'CP_99_FINISH_LINE',
  exportedCheckpointIds.length + 1,
  unrealX(FINISH_LINE.z),
  unrealY(FINISH_LINE.x),
  1600,
  true,
  FINISH_LINE.id,
  0,
  0,
]);

assertTrue(checkpointRows.length === CIRCUIT_CHECKPOINT_IDS.length + 1, 'Checkpoint table must contain every circuit gate plus the finish line');

// ---------------------------------------------------------------------------
// AI racing line: closed loop, used by spline-driven rivals and lap plausibility
// ---------------------------------------------------------------------------
const waypointRows: Array<Array<string | number | boolean>> = [];
let circuitLengthMeters = 0;

CIRCUIT_RACING_WAYPOINTS.forEach((waypoint, index) => {
  waypointRows.push([
    `WP_${String(index).padStart(2, '0')}`,
    index,
    unrealX(waypoint.z),
    unrealY(waypoint.x),
    waypoint.checkpointId ?? '',
    waypoint.isFinishLine === true,
    waypoint.maxSpeed ?? 45,
  ]);

  const next = CIRCUIT_RACING_WAYPOINTS[(index + 1) % CIRCUIT_RACING_WAYPOINTS.length];
  circuitLengthMeters += Math.hypot(next.x - waypoint.x, next.z - waypoint.z);
});

// ---------------------------------------------------------------------------
// Streets, landmarks, roundabouts, city blocks
// ---------------------------------------------------------------------------
// Streets run along one Unreal axis: north-south streets along +X, east-west along +Y.
// FixAxisCm is the perpendicular centreline; StartAlongCm/EndAlongCm bound the drivable span.
const streetRows = NAIROBI_STREETS.map((street) => {
  const isNorthSouth = street.axis === 'ns';
  return [
    street.id.replaceAll('-', '_').toUpperCase(),
    street.name,
    street.swahiliTag,
    isNorthSouth,
    isNorthSouth ? unrealY(street.coord) : unrealX(street.coord),
    isNorthSouth ? unrealX(street.start) : unrealY(street.start),
    isNorthSouth ? unrealX(street.end) : unrealY(street.end),
    street.width * CM,
    street.hasMedian,
    street.speedLimitKmh,
  ];
});

const landmarkRows = NAIROBI_LANDMARKS.map((landmark) => [
  landmark.id.replaceAll('-', '_').toUpperCase(),
  landmark.name,
  landmark.shortName,
  landmark.district,
  unrealX(landmark.z),
  unrealY(landmark.x),
  unrealX(landmark.waypointZ),
  unrealY(landmark.waypointX),
  landmark.colliderHalfW * CM,
  landmark.colliderHalfD * CM,
  landmark.height * CM,
  Math.round(landmark.lat * 1e6),
  Math.round(landmark.lng * 1e6),
]);

const roundaboutRows = NAIROBI_ROUNDABOUTS.map((roundabout) => [
  roundabout.id.replaceAll('-', '_').toUpperCase(),
  roundabout.name,
  unrealX(roundabout.z),
  unrealY(roundabout.x),
  roundabout.outerRadius * CM,
  roundabout.islandRadius * CM,
]);

const buildingRows = CBD_BUILDING_BLOCKS.map((block) => [
  block.id.replaceAll('-', '_').toUpperCase(),
  block.label ?? '',
  unrealX(block.z),
  unrealY(block.x),
  block.halfW * CM,
  block.halfD * CM,
  block.height * CM,
]);

// ---------------------------------------------------------------------------
// Vehicles: legacy presets retained as tuning starting points (not final physics)
// ---------------------------------------------------------------------------
const suggestedMassKg: Record<string, number> = {
  rally: 1380,
  nganya: 2050,
  safari: 2320,
};

const vehicleRows = VEHICLE_PRESETS.map((preset) => {
  const topSpeedKph = Math.round(preset.maxSpeed * 3.6);
  const mass = suggestedMassKg[preset.id] ?? 1500;
  const peakTorqueNm = Math.round(preset.accel * mass * 0.35);
  return [
    preset.id.replaceAll('-', '_').toUpperCase(),
    preset.name,
    preset.subtitle,
    preset.plate,
    preset.id,
    topSpeedKph,
    preset.maxSpeed,
    preset.accel,
    preset.handling,
    preset.driftGrip,
    mass,
    peakTorqueNm,
    'NeedsEditorTuning',
  ];
});

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
console.log('Nairobi map-data migration');
writeCsv(
  'Content/Data/Track/DT_Checkpoints.csv',
  ['Name', 'Id', 'CenterX', 'CenterY', 'RadiusCm', 'bIsFinishLine', 'LandmarkId', 'LatitudeE6', 'LongitudeE6'],
  checkpointRows,
);
writeCsv(
  'Content/Data/Track/DT_RacingLine.csv',
  ['Name', 'Order', 'X', 'Y', 'CheckpointId', 'bIsFinishLine', 'MaxSpeedKph'],
  waypointRows,
);
writeCsv(
  'Content/Data/Track/DT_Streets.csv',
  ['Name', 'DisplayName', 'SwahiliTag', 'bNorthSouth', 'FixAxisCm', 'StartAlongCm', 'EndAlongCm', 'WidthCm', 'bHasMedian', 'SpeedLimitKph'],
  streetRows,
);
writeCsv(
  'Content/Data/Track/DT_Landmarks.csv',
  ['Name', 'DisplayName', 'ShortName', 'District', 'X', 'Y', 'WaypointX', 'WaypointY', 'ColliderHalfWCm', 'ColliderHalfDCm', 'HeightCm', 'LatitudeE6', 'LongitudeE6'],
  landmarkRows,
);
writeCsv(
  'Content/Data/Track/DT_Roundabouts.csv',
  ['Name', 'DisplayName', 'X', 'Y', 'OuterRadiusCm', 'IslandRadiusCm'],
  roundaboutRows,
);
writeCsv(
  'Content/Data/Track/DT_CityBlocks.csv',
  ['Name', 'DisplayLabel', 'X', 'Y', 'HalfWidthCm', 'HalfDepthCm', 'HeightCm'],
  buildingRows,
);
writeCsv(
  'Content/Data/Vehicles/DT_VehicleConfigs.csv',
  ['Name', 'DisplayName', 'Subtitle', 'Plate', 'LegacyPresetId', 'TopSpeedKph', 'LegacyMaxSpeedMps', 'LegacyAccel', 'LegacyHandling', 'LegacyDriftGrip', 'SuggestedMassKg', 'SuggestedPeakTorqueNm', 'TuningStatus'],
  vehicleRows,
);

const manifest = {
  generatedFrom: 'LegacyWebPrototype/src/game/nairobiMap.ts',
  coordinateSystem: {
    legacy: 'three.js metres: +X east, +Z south, +Y up, heading 0 = north (-Z)',
    unreal: 'centimetres: +X north, +Y east, +Z up, yaw 0 = +X',
    conversion: 'Unreal.X = -Legacy.Z * 100; Unreal.Y = Legacy.X * 100; Yaw = Legacy.heading',
  },
  counts: {
    checkpoints: checkpointRows.length,
    racingLinePoints: waypointRows.length,
    streets: streetRows.length,
    landmarks: landmarkRows.length,
    roundabouts: roundaboutRows.length,
    cityBlocks: buildingRows.length,
    vehicles: vehicleRows.length,
  },
  circuitLengthMeters: Number(circuitLengthMeters.toFixed(1)),
  spawn: {
    legacy: { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, heading: PLAYER_SPAWN.heading },
    unreal: { x: spawnUX, y: spawnUY, yaw: PLAYER_SPAWN.heading },
  },
  finishLine: {
    legacy: { x: FINISH_LINE.x, z: FINISH_LINE.z, heading: FINISH_LINE.heading },
    unreal: { x: unrealX(FINISH_LINE.z), y: unrealY(FINISH_LINE.x), yaw: FINISH_LINE.heading },
  },
};

const manifestPath = resolve(ROOT, 'Documentation/Migration/TRACK_DATA_MANIFEST.json');
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`  circuit length: ${manifest.circuitLengthMeters} m`);
console.log(`  spawn (Unreal cm): X=${spawnUX} Y=${spawnUY} yaw=${PLAYER_SPAWN.heading.toFixed(4)}`);
console.log(`  wrote Documentation/Migration/TRACK_DATA_MANIFEST.json`);

if (errors.length > 0) {
  console.error('\nMIGRATION FAILED:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('MIGRATION OK: all conversion invariants satisfied.');
