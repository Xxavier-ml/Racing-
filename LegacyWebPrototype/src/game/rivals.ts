import {
  CIRCUIT_CHECKPOINT_IDS,
  CIRCUIT_RACING_WAYPOINTS,
  FINISH_LINE_LANDMARK,
  NAIROBI_LANDMARKS,
  PLAYER_SPAWN,
  getStreetNameAt,
  normalizeAngle,
} from './nairobiMap';
import type { PlayerVehicleState } from './physics';

export interface RivalRacer {
  id: string;
  name: string;
  carLabel: string;
  primaryColor: number;
  accentColor: number;
  plate: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  waypointIdx: number;
  checkpointsCleared: number;
  finished: boolean;
  finishTime: number | null;
  laneBias: number;
  isBraking: boolean;
  isBoosting: boolean;
  wheelSpin: number;
}

export interface RaceStandingEntry {
  id: string;
  name: string;
  isPlayer: boolean;
  checkpointsCleared: number;
  distToNext: number;
  finished: boolean;
  finishTime: number | null;
}

export type RelativeDirection = 'AHEAD' | 'LEFT' | 'RIGHT' | 'BEHIND';

export interface RivalDirectionTracker {
  id: string;
  shortName: string;
  color: string;
  distanceMeters: number;
  bearingDeltaRad: number;
  directionLabel: RelativeDirection;
  streetName: string;
  checkpointsCleared: number;
  isAheadInRace: boolean;
  isLeader: boolean;
}

export interface CircuitTurnHint {
  direction: RelativeDirection;
  streetName: string;
  distanceMeters: number;
  bearingDeltaRad: number;
  isWrongWay: boolean;
}

const RIVAL_ROSTER: Array<{
  id: string;
  name: string;
  carLabel: string;
  primaryColor: number;
  accentColor: number;
  plate: string;
  maxSpeed: number;
  accel: number;
  laneBias: number;
  gridOffsetX: number;
  gridOffsetZ: number;
}> = [
  {
    id: 'rival-1',
    name: 'Wanjiku · Westlands GT',
    carLabel: 'Westlands Apex GT',
    primaryColor: 0x2563eb,
    accentColor: 0xf8fafc,
    plate: 'KDK 777R',
    maxSpeed: 57,
    accel: 39,
    laneBias: -2.2,
    gridOffsetX: 11,
    gridOffsetZ: -2.6,
  },
  {
    id: 'rival-2',
    name: 'Omondi · Mombasa Turbo',
    carLabel: 'Mombasa Midnight Evo',
    primaryColor: 0xdc2626,
    accentColor: 0x111827,
    plate: 'KDJ 404M',
    maxSpeed: 55.5,
    accel: 37,
    laneBias: 2.0,
    gridOffsetX: 6,
    gridOffsetZ: 3.4,
  },
  {
    id: 'rival-3',
    name: 'Kamau · Ngong Hill WRX',
    carLabel: 'Ngong Stage Rally',
    primaryColor: 0x7c3aed,
    accentColor: 0xfacc15,
    plate: 'KDH 088N',
    maxSpeed: 54,
    accel: 36,
    laneBias: -1.1,
    gridOffsetX: 2,
    gridOffsetZ: -3.2,
  },
  {
    id: 'rival-4',
    name: 'Achieng · Thika Supra',
    carLabel: 'Thika Superhighway',
    primaryColor: 0x0d9488,
    accentColor: 0xf97316,
    plate: 'KDN 237T',
    maxSpeed: 52.5,
    accel: 35,
    laneBias: 1.5,
    gridOffsetX: -4,
    gridOffsetZ: 3.0,
  },
];

export function createRivalRacers(): RivalRacer[] {
  return RIVAL_ROSTER.map((r) => ({
    id: r.id,
    name: r.name,
    carLabel: r.carLabel,
    primaryColor: r.primaryColor,
    accentColor: r.accentColor,
    plate: r.plate,
    x: PLAYER_SPAWN.x + r.gridOffsetX,
    z: PLAYER_SPAWN.z + r.gridOffsetZ,
    vx: 0,
    vz: 0,
    heading: PLAYER_SPAWN.heading,
    speed: 0,
    maxSpeed: r.maxSpeed,
    accel: r.accel,
    waypointIdx: 0,
    checkpointsCleared: 0,
    finished: false,
    finishTime: null,
    laneBias: r.laneBias,
    isBraking: false,
    isBoosting: false,
    wheelSpin: 0,
  }));
}

export function stepRivalRacers(
  rivals: RivalRacer[],
  player: PlayerVehicleState,
  elapsedTime: number,
  dt: number,
): { playerCollisionImpact: number } {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  let playerCollisionImpact = 0;

  for (let i = 0; i < rivals.length; i++) {
    const r = rivals[i];
    if (r.finished) {
      r.speed *= Math.exp(-2.0 * clampedDt);
      r.x += Math.sin(r.heading) * r.speed * clampedDt;
      r.z += -Math.cos(r.heading) * r.speed * clampedDt;
      r.wheelSpin += r.speed * clampedDt * 2.4;
      continue;
    }

    const wp = CIRCUIT_RACING_WAYPOINTS[r.waypointIdx];
    const nextWp = CIRCUIT_RACING_WAYPOINTS[(r.waypointIdx + 1) % CIRCUIT_RACING_WAYPOINTS.length];

    // Lateral racing line offset perpendicular to segment
    const segDx = nextWp.x - wp.x;
    const segDz = nextWp.z - wp.z;
    const segLen = Math.max(1, Math.hypot(segDx, segDz));
    const perpX = -segDz / segLen;
    const perpZ = segDx / segLen;

    const targetX = wp.x + perpX * r.laneBias;
    const targetZ = wp.z + perpZ * r.laneBias;

    const dx = targetX - r.x;
    const dz = targetZ - r.z;
    const dist = Math.hypot(dx, dz);

    // Advance waypoint / checkpoint / Finish Line
    if (dist < 14) {
      if (wp.checkpointId) {
        const expectedCp = CIRCUIT_CHECKPOINT_IDS[r.checkpointsCleared];
        if (wp.checkpointId === expectedCp) {
          r.checkpointsCleared++;
        }
      } else if (wp.isFinishLine && r.checkpointsCleared >= CIRCUIT_CHECKPOINT_IDS.length) {
        r.finished = true;
        r.finishTime = elapsedTime;
      }
      if (!r.finished) {
        r.waypointIdx = (r.waypointIdx + 1) % CIRCUIT_RACING_WAYPOINTS.length;
      }
    }

    const desiredHeading = Math.atan2(dx, -dz);
    const angleErr = normalizeAngle(desiredHeading - r.heading);
    const turnStep = Math.max(-3.1 * clampedDt, Math.min(3.1 * clampedDt, angleErr * 5.2 * clampedDt));
    r.heading = normalizeAngle(r.heading + turnStep);

    // Corner braking + straightaway boost
    const cornerCap = wp.maxSpeed ?? r.maxSpeed;
    const sharpTurnCap = Math.abs(angleErr) > 0.55 ? 28 : cornerCap;
    const targetSpeed = Math.min(r.maxSpeed, sharpTurnCap);
    r.isBraking = r.speed > targetSpeed + 4;
    r.isBoosting = !r.isBraking && r.speed > 42 && Math.abs(angleErr) < 0.12;

    const accelRate = r.isBraking ? 38 : r.accel * (r.isBoosting ? 1.15 : 1.0);
    if (r.speed < targetSpeed) {
      r.speed = Math.min(targetSpeed, r.speed + accelRate * clampedDt);
    } else {
      r.speed = Math.max(targetSpeed, r.speed - accelRate * clampedDt);
    }

    r.vx = Math.sin(r.heading) * r.speed;
    r.vz = -Math.cos(r.heading) * r.speed;
    r.x += r.vx * clampedDt;
    r.z += r.vz * clampedDt;
    r.wheelSpin += r.speed * clampedDt * 2.4;

    // Rival <-> Player physical racing rub/bump
    const pdx = player.x - r.x;
    const pdz = player.z - r.z;
    const minSep = 3.85;
    const distSq = pdx * pdx + pdz * pdz;
    if (distSq < minSep * minSep && distSq > 0.0001) {
      const pdist = Math.sqrt(distSq);
      const nx = pdx / pdist;
      const nz = pdz / pdist;
      const overlap = minSep - pdist;
      player.x += nx * overlap * 0.65;
      player.z += nz * overlap * 0.65;
      r.x -= nx * overlap * 0.35;
      r.z -= nz * overlap * 0.35;

      const relVx = player.vx - r.vx;
      const relVz = player.vz - r.vz;
      const vn = relVx * nx + relVz * nz;
      if (vn < 0) {
        playerCollisionImpact = Math.max(playerCollisionImpact, -vn);
        player.vx -= 0.9 * vn * nx;
        player.vz -= 0.9 * vn * nz;
        r.speed *= 0.92;
      }
    }
  }

  return { playerCollisionImpact };
}

export function computePlayerRacePosition(
  playerX: number,
  playerZ: number,
  playerCheckpointsCleared: number,
  rivals: readonly RivalRacer[],
): { position: number; totalRacers: number } {
  const playerFinished = playerCheckpointsCleared > CIRCUIT_CHECKPOINT_IDS.length;
  const playerTargetLm =
    playerCheckpointsCleared >= CIRCUIT_CHECKPOINT_IDS.length
      ? FINISH_LINE_LANDMARK
      : (NAIROBI_LANDMARKS.find((l) => l.id === CIRCUIT_CHECKPOINT_IDS[playerCheckpointsCleared]) ??
        NAIROBI_LANDMARKS[0]);
  const playerDist = Math.hypot(playerTargetLm.waypointX - playerX, playerTargetLm.waypointZ - playerZ);

  let aheadCount = 0;
  for (const r of rivals) {
    if (playerFinished) {
      if (r.finished) aheadCount++;
      continue;
    }
    if (r.finished) {
      aheadCount++;
      continue;
    }
    if (r.checkpointsCleared > playerCheckpointsCleared) {
      aheadCount++;
    } else if (r.checkpointsCleared === playerCheckpointsCleared) {
      const rivalTargetLm =
        r.checkpointsCleared >= CIRCUIT_CHECKPOINT_IDS.length
          ? FINISH_LINE_LANDMARK
          : (NAIROBI_LANDMARKS.find((l) => l.id === CIRCUIT_CHECKPOINT_IDS[r.checkpointsCleared]) ??
            NAIROBI_LANDMARKS[0]);
      const rivalDist = Math.hypot(rivalTargetLm.waypointX - r.x, rivalTargetLm.waypointZ - r.z);
      if (rivalDist < playerDist) {
        aheadCount++;
      }
    }
  }

  return {
    position: aheadCount + 1,
    totalRacers: rivals.length + 1,
  };
}

export function classifyRelativeDirection(bearingDeltaRad: number): RelativeDirection {
  const abs = Math.abs(bearingDeltaRad);
  if (abs <= 0.58) return 'AHEAD';
  if (abs >= 2.45) return 'BEHIND';
  return bearingDeltaRad > 0 ? 'RIGHT' : 'LEFT';
}

/**
 * Computes real-time direction identifiers showing where rival racers went
 * (relative bearing, turn side, distance, and current Nairobi street).
 */
export function computeRivalDirectionTrackers(
  playerX: number,
  playerZ: number,
  playerHeading: number,
  playerCheckpointsCleared: number,
  rivals: readonly RivalRacer[],
): RivalDirectionTracker[] {
  // Determine current race leader among rivals
  let leaderId = '';
  let bestRankScore = -Infinity;
  for (const r of rivals) {
    const score = r.finished ? 10000 - (r.finishTime ?? 0) : r.checkpointsCleared * 1000 + r.waypointIdx * 10;
    if (score > bestRankScore) {
      bestRankScore = score;
      leaderId = r.id;
    }
  }

  return rivals
    .map((r) => {
      const dx = r.x - playerX;
      const dz = r.z - playerZ;
      const distanceMeters = Math.round(Math.hypot(dx, dz));
      const worldBearing = Math.atan2(dx, -dz);
      const bearingDeltaRad = normalizeAngle(worldBearing - playerHeading);
      const directionLabel = classifyRelativeDirection(bearingDeltaRad);
      const streetName = getStreetNameAt(r.x, r.z);
      const shortName = r.name.split('·')[0].trim();
      const isAheadInRace =
        r.finished ||
        r.checkpointsCleared > playerCheckpointsCleared ||
        (r.checkpointsCleared === playerCheckpointsCleared && distanceMeters > 6);

      return {
        id: r.id,
        shortName,
        color: '#' + r.primaryColor.toString(16).padStart(6, '0'),
        distanceMeters,
        bearingDeltaRad,
        directionLabel,
        streetName,
        checkpointsCleared: r.checkpointsCleared,
        isAheadInRace,
        isLeader: r.id === leaderId,
      };
    })
    .sort((a, b) => {
      if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
      if (a.isAheadInRace !== b.isAheadInRace) return a.isAheadInRace ? -1 : 1;
      return a.distanceMeters - b.distanceMeters;
    });
}

/**
 * Finds the next circuit turn / waypoint along the street network for the active checkpoint
 * so a lagging driver gets exact street-following direction cues around CBD blocks.
 */
export function getCircuitNextTurnHint(
  playerX: number,
  playerZ: number,
  playerHeading: number,
  playerCheckpointsCleared: number,
): CircuitTurnHint {
  const onFinalSprint = playerCheckpointsCleared >= CIRCUIT_CHECKPOINT_IDS.length;
  const cpWaypointIdx = onFinalSprint
    ? CIRCUIT_RACING_WAYPOINTS.findIndex((w) => w.isFinishLine)
    : CIRCUIT_RACING_WAYPOINTS.findIndex(
        (w) => w.checkpointId === CIRCUIT_CHECKPOINT_IDS[playerCheckpointsCleared],
      );
  const endSearchIdx = cpWaypointIdx >= 0 ? cpWaypointIdx : CIRCUIT_RACING_WAYPOINTS.length - 1;
  const startSearchIdx = Math.max(0, endSearchIdx - 4);

  let closestIdx = endSearchIdx;
  let closestDist = Infinity;
  for (let i = startSearchIdx; i <= endSearchIdx; i++) {
    const wp = CIRCUIT_RACING_WAYPOINTS[i];
    const d = Math.hypot(wp.x - playerX, wp.z - playerZ);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }

  // If already close to closestIdx, preview the upcoming corner/finish waypoint
  const targetIdx =
    closestDist < 28 && closestIdx < endSearchIdx ? closestIdx + 1 : closestIdx;
  const bestWp = CIRCUIT_RACING_WAYPOINTS[targetIdx];

  const dx = bestWp.x - playerX;
  const dz = bestWp.z - playerZ;
  const distanceMeters = Math.round(Math.hypot(dx, dz));
  const bearingDeltaRad = normalizeAngle(Math.atan2(dx, -dz) - playerHeading);

  return {
    direction: classifyRelativeDirection(bearingDeltaRad),
    streetName: bestWp.isFinishLine ? 'FINISH LINE · Uhuru Hwy' : getStreetNameAt(bestWp.x, bestWp.z),
    distanceMeters,
    bearingDeltaRad,
    isWrongWay: Math.abs(bearingDeltaRad) > 2.35,
  };
}

