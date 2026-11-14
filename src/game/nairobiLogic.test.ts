import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_OBSTACLE_COLLIDERS,
  FINISH_LINE,
  NAIROBI_LANDMARKS,
  PLAYER_SPAWN,
  computeWayfindingGuidance,
  findNearestStreetPose,
  getStreetNameAt,
  isAtFinishLine,
} from './nairobiMap';
import {
  NITRO_ACTIVE_DURATION,
  NITRO_COOLDOWN_DURATION,
  createInitialPlayerState,
  stepVehiclePhysics,
} from './physics';
import {
  computePlayerRacePosition,
  computeRivalDirectionTrackers,
  createRivalRacers,
  getCircuitNextTurnHint,
  stepRivalRacers,
} from './rivals';
import {
  clearLeaderboard,
  loadLeaderboard,
  parseLeaderboardEntries,
  saveLapResult,
} from './leaderboard';
import {
  loadControlSettings,
  sanitizeControlSettings,
  saveControlSettings,
} from './controlSettings';
import {
  createSignalPhase,
  createTrafficFleet,
  getLeftHandLaneCoord,
  stepSignalPhase,
  stepTrafficFleet,
} from './traffic';
import {
  clearBestLapGhost,
  loadBestLapGhost,
  sampleGhostPoseAtTime,
  saveBestLapGhost,
} from './ghost';
import { cycleWeatherCondition, getWeatherProfile } from './weather';

test('player spawns on Kenyatta Avenue with clear forward path', () => {
  const player = createInitialPlayerState('rally');
  assert.equal(getStreetNameAt(player.x, player.z), 'Kenyatta Avenue');
  // Simulate 1.5 seconds of coasting with zero input: must not collide
  const idle = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
  };
  for (let i = 0; i < 45; i++) {
    const res = stepVehiclePhysics(player, idle, 1 / 30);
    assert.equal(res.collided, false);
  }
  // Also simulate 1.5 seconds straight throttle from spawn: clear road ahead to Uhuru Hwy roundabout
  const accelPlayer = createInitialPlayerState('rally');
  const go = { ...idle, throttle: true };
  for (let i = 0; i < 45; i++) {
    const res = stepVehiclePhysics(accelPlayer, go, 1 / 30);
    assert.equal(res.collided, false);
  }
  assert.ok(accelPlayer.x > PLAYER_SPAWN.x + 15, 'car should advance east down Kenyatta Ave');
});

test('wayfinding guidance points accurately toward KICC and detects arrival', () => {
  const kicc = NAIROBI_LANDMARKS.find((l) => l.id === 'kicc')!;
  const start = createInitialPlayerState('rally');
  const guidance = computeWayfindingGuidance(start.x, start.z, start.heading, kicc);
  assert.equal(guidance.currentStreet, 'Kenyatta Avenue');
  assert.equal(guidance.arrived, false);
  assert.ok(guidance.distanceMeters > 100);

  const arrived = computeWayfindingGuidance(kicc.waypointX + 4, kicc.waypointZ - 3, 0, kicc);
  assert.equal(arrived.arrived, true);
  assert.match(arrived.instruction, /Arrived/);
});

test('left-hand Kenyan lane placement puts northbound on -X and eastbound on -Z', () => {
  const nbX = getLeftHandLaneCoord('ns', -95, -1, 26, 0);
  const sbX = getLeftHandLaneCoord('ns', -95, 1, 26, 0);
  assert.ok(nbX < -95, 'northbound (-Z) keeps left (-X)');
  assert.ok(sbX > -95, 'southbound (+Z) keeps left (+X)');

  const ebZ = getLeftHandLaneCoord('ew', -45, 1, 24, 0);
  const wbZ = getLeftHandLaneCoord('ew', -45, -1, 24, 0);
  assert.ok(ebZ < -45, 'eastbound (+X) keeps left (-Z)');
  assert.ok(wbZ > -45, 'westbound (-X) keeps left (+Z)');
});

test('traffic fleet contains all Nairobi archetypes and advances smoothly', () => {
  const fleet = createTrafficFleet();
  const types = new Set(fleet.map((a) => a.archetype));
  assert.ok(types.has('matatu'));
  assert.ok(types.has('bodaboda'));
  assert.ok(types.has('cityhoppa'));
  assert.ok(types.has('saloon'));
  assert.ok(types.has('safari'));

  const signal = createSignalPhase();
  stepSignalPhase(signal, 7);
  assert.equal(signal.state, 'ns-amber');
  stepSignalPhase(signal, 2);
  assert.equal(signal.state, 'ew-green');

  const player = createInitialPlayerState('rally');
  const snapshotBefore = fleet[0].progress;
  for (let i = 0; i < 30; i++) {
    stepTrafficFleet(fleet, signal, player, 0.033);
  }
  assert.notEqual(fleet[0].progress, snapshotBefore);
});

test('vehicle physics handles steering, drift, boost, RPM, and solid building collisions', () => {
  const player = createInitialPlayerState('rally');
  const boostInput = {
    throttle: true,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: true,
  };
  for (let i = 0; i < 30; i++) {
    stepVehiclePhysics(player, boostInput, 0.03);
  }
  assert.ok(player.kmh > 90, 'car accelerates rapidly under boost (> 90 km/h)');
  assert.ok(player.rpm > 2400, 'RPM climbs under load');
  assert.ok(player.nitro < 100, 'boost consumes nitro');

  // Initiate handbrake drift
  const driftInput = {
    throttle: true,
    brake: false,
    left: false,
    right: true,
    drift: true,
    boost: false,
  };
  for (let i = 0; i < 15; i++) {
    stepVehiclePhysics(player, driftInput, 0.03);
  }
  assert.equal(player.isDrifting, true);
  assert.ok(player.driftScoreActive > 0, 'drifting earns live drift points');

  // Place player next to KICC collider moving into it
  const kiccBlock = ALL_OBSTACLE_COLLIDERS.find((b) => b.id === 'blk-kicc')!;
  player.x = kiccBlock.x - kiccBlock.halfW - 1.5;
  player.z = kiccBlock.z;
  player.vx = 25;
  player.vz = 0;
  const colRes = stepVehiclePhysics(
    player,
    { throttle: false, brake: false, left: false, right: false, drift: false, boost: false },
    0.016,
  );
  assert.equal(colRes.collided, true);
  assert.ok(colRes.impactSpeed > 15);
  assert.ok(player.x <= kiccBlock.x - kiccBlock.halfW - 1.9, 'player pushed outside building');
});

test('AI rival racers advance around Nairobi circuit and update race standings', () => {
  const rivals = createRivalRacers();
  assert.equal(rivals.length, 4);
  const player = createInitialPlayerState('rally');
  const startX = rivals[0].x;

  for (let i = 0; i < 90; i++) {
    stepRivalRacers(rivals, player, i * 0.033, 0.033);
  }
  assert.ok(rivals[0].x > startX + 20, 'rivals accelerate east down Kenyatta Avenue');

  const standingIdle = computePlayerRacePosition(player.x, player.z, 0, rivals);
  assert.equal(standingIdle.totalRacers, 5);
  assert.ok(standingIdle.position > 1, 'idle player drops behind advancing rivals');

  const kicc = NAIROBI_LANDMARKS.find((l) => l.id === 'kicc')!;
  const standingAhead = computePlayerRacePosition(kicc.waypointX, kicc.waypointZ, 5, rivals);
  assert.equal(standingAhead.position, 1, 'player ahead on checkpoints takes 1st place');
});

test('nearest-street recovery puts off-road vehicle safely back on a street facing target', () => {
  const kicc = NAIROBI_LANDMARKS.find((l) => l.id === 'kicc')!;
  const pose = findNearestStreetPose(-118, -10, kicc.waypointX, kicc.waypointZ);
  assert.ok(Math.abs(pose.x - -95) < 10, 'snaps onto Uhuru Highway near Uhuru Park');
});

test('localStorage leaderboard saves, sorts, and trims to top 5 fastest lap times', () => {
  const backing = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (k: string) => backing.get(k) ?? null,
    key: (i: number) => Array.from(backing.keys())[i] ?? null,
    removeItem: (k: string) => {
      backing.delete(k);
    },
    setItem: (k: string, v: string) => {
      backing.set(k, v);
    },
  };

  const times = [64.5, 51.2, 58.9, 46.15, 72.0, 49.8];
  let latestEntries = loadLeaderboard(mockStorage);
  assert.equal(latestEntries.length, 0);

  for (const t of times) {
    const res = saveLapResult(
      {
        lapTimeSeconds: t,
        presetId: 'rally',
        vehicleName: 'Safari Rally GT',
        topSpeedKmh: 210,
        driftScore: 300,
        racePosition: 1,
      },
      mockStorage,
    );
    latestEntries = res.entries;
  }

  assert.equal(latestEntries.length, 5, 'keeps only the top 5 fastest lap times');
  assert.deepEqual(
    latestEntries.map((e) => e.lapTimeSeconds),
    [46.15, 49.8, 51.2, 58.9, 64.5],
    'sorts fastest lap times ascending and drops 72.0s',
  );

  // A slower 6th/7th time should not enter top 5
  const slowRes = saveLapResult(
    {
      lapTimeSeconds: 95.4,
      presetId: 'nganya',
      vehicleName: 'Nganya 111 Turbo',
      topSpeedKmh: 165,
      driftScore: 100,
      racePosition: 4,
    },
    mockStorage,
  );
  assert.equal(slowRes.rank, null);
  assert.equal(loadLeaderboard(mockStorage).length, 5);

  // Corrupted JSON recovers cleanly
  assert.deepEqual(parseLeaderboardEntries('{bad json'), []);
  clearLeaderboard(mockStorage);
  assert.deepEqual(loadLeaderboard(mockStorage), []);
});

test('auto-drive moves car forward automatically and honors brake and sensitivity settings', () => {
  const idle = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
  };

  // Auto-drive ON moves vehicle east down Kenyatta Avenue without holding accelerate
  const cruiseCar = createInitialPlayerState('rally');
  for (let i = 0; i < 45; i++) {
    stepVehiclePhysics(cruiseCar, idle, 1 / 30, ALL_OBSTACLE_COLLIDERS, {
      autoDrive: true,
      cruiseSpeedRatio: 0.56,
    });
  }
  assert.ok(cruiseCar.kmh > 40, 'auto-drive moves car forward without throttle held');
  assert.ok(cruiseCar.x > PLAYER_SPAWN.x + 12, 'auto-drive advances down Kenyatta Ave');

  // Holding brake decelerates an auto-driving car sharply
  const beforeBrakeKmh = cruiseCar.kmh;
  for (let i = 0; i < 20; i++) {
    stepVehiclePhysics(cruiseCar, { ...idle, brake: true }, 1 / 30, ALL_OBSTACLE_COLLIDERS, {
      autoDrive: true,
      brakeSensitivity: 1.4,
    });
  }
  assert.ok(cruiseCar.kmh < beforeBrakeKmh, 'brake slows down auto-driving vehicle');

  // Higher steering sensitivity produces a larger heading change
  const lowSteer = createInitialPlayerState('rally');
  const highSteer = createInitialPlayerState('rally');
  lowSteer.vx = 25;
  highSteer.vx = 25;
  for (let i = 0; i < 15; i++) {
    stepVehiclePhysics(lowSteer, { ...idle, right: true }, 0.03, ALL_OBSTACLE_COLLIDERS, {
      steeringSensitivity: 0.6,
    });
    stepVehiclePhysics(highSteer, { ...idle, right: true }, 0.03, ALL_OBSTACLE_COLLIDERS, {
      steeringSensitivity: 1.6,
    });
  }
  assert.ok(highSteer.heading > lowSteer.heading + 0.15, 'steeringSensitivity scales turn rate');

  // Control settings sanitize & persist
  const clean = sanitizeControlSettings({ steeringSensitivity: 99, accelSensitivity: 0.1 });
  assert.equal(clean.steeringSensitivity, 1.8);
  assert.equal(clean.accelSensitivity, 0.6);
  const bag = new Map<string, string>();
  const store = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => {
      bag.set(k, v);
    },
  };
  saveControlSettings(clean, store);
  assert.equal(loadControlSettings(store).steeringSensitivity, 1.8);
});

test('engine temperature heats up during sustained acceleration and cools when coasting/braking', () => {
  const car = createInitialPlayerState('rally');
  const startTemp = car.engineTemp;
  const accel = {
    throttle: true,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
  };
  for (let i = 0; i < 90; i++) {
    stepVehiclePhysics(car, accel, 1 / 30);
  }
  const hotTemp = car.engineTemp;
  assert.ok(hotTemp > startTemp + 20, 'sustained acceleration heats engine temperature');

  // Coast & brake cools engine temperature back down
  const brakeInput = { ...accel, throttle: false, brake: true };
  for (let i = 0; i < 90; i++) {
    stepVehiclePhysics(car, brakeInput, 1 / 30);
  }
  assert.ok(car.engineTemp < hotTemp - 15, 'coasting and braking cools engine temperature');
});

test('direction identifiers locate rival racers on side streets and compute next circuit turn', () => {
  const player = createInitialPlayerState('rally');
  const rivals = createRivalRacers();
  // Place rival-1 south down Moi Avenue
  rivals[0].x = 55;
  rivals[0].z = 25;
  rivals[0].checkpointsCleared = 1;

  // From spawn far west on Kenyatta Ave, bearing is slightly right within forward cone -> AHEAD
  const fromSpawn = computeRivalDirectionTrackers(
    player.x,
    player.z,
    player.heading,
    0,
    rivals,
  );
  const wanjikuFar = fromSpawn.find((t) => t.id === 'rival-1')!;
  assert.equal(wanjikuFar.isLeader, true);
  assert.equal(wanjikuFar.streetName, 'Moi Avenue');
  assert.equal(wanjikuFar.directionLabel, 'AHEAD');
  assert.ok(wanjikuFar.distanceMeters > 200);

  // Near Moi Ave intersection facing East, rival down Moi Ave is squarely to the RIGHT
  const nearCorner = computeRivalDirectionTrackers(45, -49, Math.PI / 2, 0, rivals);
  assert.equal(nearCorner.find((t) => t.id === 'rival-1')!.directionLabel, 'RIGHT');

  // Near Moi Ave / Kenyatta Ave corner heading East -> next turn hint points RIGHT down Moi Ave
  const turnHint = getCircuitNextTurnHint(50, -49, Math.PI / 2, 0);
  assert.equal(turnHint.direction, 'RIGHT');
});

test('best-lap ghost saves fastest path only and interpolates position and wrapped heading', () => {
  const bag = new Map<string, string>();
  const store = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => {
      bag.set(k, v);
    },
    removeItem: (k: string) => {
      bag.delete(k);
    },
  };

  assert.equal(loadBestLapGhost(store), null);

  const slowSamples = [
    { t: 0, x: -170, z: -49, heading: Math.PI - 0.1 },
    { t: 1.0, x: -130, z: -49, heading: -Math.PI + 0.1 },
  ];
  const firstSave = saveBestLapGhost(
    {
      lapTimeSeconds: 62.4,
      presetId: 'rally',
      vehicleName: 'Safari Rally GT',
      samples: slowSamples,
    },
    store,
  );
  assert.equal(firstSave.saved, true);
  assert.equal(loadBestLapGhost(store)?.lapTimeSeconds, 62.4);

  // Slower lap does NOT overwrite best ghost
  const slowerAttempt = saveBestLapGhost(
    {
      lapTimeSeconds: 68.9,
      presetId: 'nganya',
      vehicleName: 'Nganya 111 Turbo',
      samples: [
        { t: 0, x: 0, z: 0, heading: 0 },
        { t: 1, x: 10, z: 0, heading: 0 },
      ],
    },
    store,
  );
  assert.equal(slowerAttempt.saved, false);
  assert.equal(loadBestLapGhost(store)?.lapTimeSeconds, 62.4);

  // Faster lap DOES replace best ghost
  const fasterAttempt = saveBestLapGhost(
    {
      lapTimeSeconds: 51.25,
      presetId: 'safari',
      vehicleName: 'Savannah V8',
      samples: slowSamples,
    },
    store,
  );
  assert.equal(fasterAttempt.saved, true);
  const loaded = loadBestLapGhost(store)!;
  assert.equal(loaded.lapTimeSeconds, 51.25);

  // Interpolation at midpoint t=0.5 wraps heading smoothly across ±PI -> ~±PI instead of 0
  const midPose = sampleGhostPoseAtTime(loaded.samples, 0.5)!;
  assert.ok(Math.abs(midPose.x - -150) < 0.05);
  assert.ok(Math.abs(Math.abs(midPose.heading) - Math.PI) < 0.05, 'wraps across ±PI via shortest arc');

  clearBestLapGhost(store);
  assert.equal(loadBestLapGhost(store), null);
});

test('dynamic weather cycles clear -> rainy -> foggy -> clear and alters visibility and track grip', () => {
  assert.equal(cycleWeatherCondition('clear'), 'rainy');
  assert.equal(cycleWeatherCondition('rainy'), 'foggy');
  assert.equal(cycleWeatherCondition('foggy'), 'clear');

  const clearP = getWeatherProfile('clear');
  const rainP = getWeatherProfile('rainy');
  const fogP = getWeatherProfile('foggy');

  assert.ok(rainP.gripMultiplier < clearP.gripMultiplier, 'rain reduces track grip');
  assert.ok(rainP.brakeMultiplier < clearP.brakeMultiplier, 'rain lengthens braking distance');
  assert.ok(fogP.visibilityMeters < rainP.visibilityMeters && rainP.visibilityMeters < clearP.visibilityMeters, 'fog reduces visibility sharpest');
  assert.ok(fogP.fogDensity > rainP.fogDensity && rainP.fogDensity > clearP.fogDensity, 'fog density scales inversely with visibility');
  assert.equal(rainP.rainIntensity, 1);

  // Physics braking comparison: dry road stops shorter than wet road
  const dryCar = createInitialPlayerState('rally');
  const wetCar = createInitialPlayerState('rally');
  dryCar.vx = 32;
  wetCar.vx = 32;
  const brakeOnly = {
    throttle: false,
    brake: true,
    left: false,
    right: false,
    drift: false,
    boost: false,
  };
  for (let i = 0; i < 20; i++) {
    stepVehiclePhysics(dryCar, brakeOnly, 0.03, ALL_OBSTACLE_COLLIDERS, undefined, 'clear');
    stepVehiclePhysics(wetCar, brakeOnly, 0.03, ALL_OBSTACLE_COLLIDERS, undefined, 'rainy');
  }
  assert.ok(dryCar.kmh < wetCar.kmh, 'clear asphalt decelerates faster than wet rainy asphalt');

  // Cornering lateral grip comparison: rain generates more lateral slip / lower grip
  const dryTurn = createInitialPlayerState('rally');
  const wetTurn = createInitialPlayerState('rally');
  dryTurn.vx = 30;
  wetTurn.vx = 30;
  dryTurn.vz = 6; // initial lateral slip
  wetTurn.vz = 6;
  const turnInput = { ...brakeOnly, brake: false, throttle: true, right: true };
  for (let i = 0; i < 10; i++) {
    stepVehiclePhysics(dryTurn, turnInput, 0.03, ALL_OBSTACLE_COLLIDERS, undefined, 'clear');
    stepVehiclePhysics(wetTurn, turnInput, 0.03, ALL_OBSTACLE_COLLIDERS, undefined, 'rainy');
  }
  const dryHeadingTravel = Math.abs(dryTurn.heading - Math.PI / 2);
  const wetHeadingTravel = Math.abs(wetTurn.heading - Math.PI / 2);
  assert.ok(wetHeadingTravel < dryHeadingTravel, 'rain reduces steering cornering bite vs clear dry asphalt');
});

test('timed Nitrous boost surges speed for 3.5s, enforces 6.0s cooldown, and re-arms ready state', () => {
  const nitroCar = createInitialPlayerState('rally');
  const normalCar = createInitialPlayerState('rally');
  assert.equal(nitroCar.nitroPhase, 'ready');

  const idle = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
  };

  // Single-frame trigger while ready activates the 3.5s Nitrous surge even without holding throttle
  stepVehiclePhysics(nitroCar, { ...idle, boost: true }, 0.05);
  stepVehiclePhysics(normalCar, { ...idle, throttle: true }, 0.05);
  assert.equal(nitroCar.nitroPhase, 'active');
  assert.equal(nitroCar.isBoosting, true);
  assert.ok(nitroCar.nitroTimer > 3.3 && nitroCar.nitroTimer <= NITRO_ACTIVE_DURATION);

  // Advance ~2.0s during active Nitrous surge
  for (let i = 0; i < 40; i++) {
    stepVehiclePhysics(nitroCar, idle, 0.05);
    stepVehiclePhysics(normalCar, { ...idle, throttle: true }, 0.05);
  }
  assert.equal(nitroCar.nitroPhase, 'active');
  assert.equal(nitroCar.isBoosting, true);
  assert.ok(nitroCar.kmh > normalCar.kmh + 15, 'Nitrous surge outperforms regular full throttle');

  // Advance past remaining ~1.55s to cross 3.5s active boundary -> enters 6.0s cooldown
  for (let i = 0; i < 32; i++) {
    stepVehiclePhysics(nitroCar, idle, 0.05);
  }
  assert.equal(nitroCar.nitroPhase, 'cooldown');
  assert.equal(nitroCar.isBoosting, false);
  assert.ok(nitroCar.nitroTimer > 5.0 && nitroCar.nitroTimer <= NITRO_COOLDOWN_DURATION);

  // Attempting to re-trigger boost during cooldown is ignored
  stepVehiclePhysics(nitroCar, { ...idle, boost: true }, 0.05);
  assert.equal(nitroCar.nitroPhase, 'cooldown');
  assert.equal(nitroCar.isBoosting, false);

  // Advance through full 6.0s cooldown -> returns to ready (100%)
  for (let i = 0; i < 122; i++) {
    stepVehiclePhysics(nitroCar, idle, 0.05);
  }
  assert.equal(nitroCar.nitroPhase, 'ready');
  assert.equal(nitroCar.nitro, 100);
});

test('finish line detection, final sprint direction identifier, wrong-way alert, and rival finish work cleanly', () => {
  // Checkered Finish Line zone check
  assert.equal(isAtFinishLine(FINISH_LINE.x, FINISH_LINE.z), true);
  assert.equal(isAtFinishLine(PLAYER_SPAWN.x, PLAYER_SPAWN.z), false);

  // Wrong-way detection when facing opposite to Kenyatta Ave race flow (West = -PI/2 instead of East = +PI/2)
  const wrongWayHint = getCircuitNextTurnHint(-140, -49, -Math.PI / 2, 0);
  assert.equal(wrongWayHint.isWrongWay, true);
  assert.equal(wrongWayHint.direction, 'BEHIND');

  // After clearing all 6 checkpoints, circuit turn hint routes straight to the Uhuru Hwy Finish Line
  const finalSprintHint = getCircuitNextTurnHint(-95, 18, 0, 6);
  assert.match(finalSprintHint.streetName, /FINISH LINE/);
  assert.equal(finalSprintHint.direction, 'AHEAD');
  assert.equal(finalSprintHint.isWrongWay, false);

  // Rivals crossing Finish Line after checkpoint 6 mark finished
  const rivals = createRivalRacers();
  const player = createInitialPlayerState('rally');
  rivals[0].checkpointsCleared = 6;
  rivals[0].waypointIdx = 22; // Finish Line waypoint index
  rivals[0].x = FINISH_LINE.x;
  rivals[0].z = FINISH_LINE.z + 2;
  stepRivalRacers(rivals, player, 54.2, 0.05);
  assert.equal(rivals[0].finished, true);
  assert.equal(rivals[0].finishTime, 54.2);

  // Player closer to Finish Line beats rival still further back on checkpoint 6
  const standing = computePlayerRacePosition(FINISH_LINE.x, FINISH_LINE.z + 10, 6, rivals);
  assert.equal(standing.position, 2, '1 finished rival ahead, player ahead of other rivals');
});


