import { NAIROBI_STREETS } from './nairobiMap';
import type { PlayerVehicleState } from './physics';

export type TrafficArchetype = 'matatu' | 'bodaboda' | 'cityhoppa' | 'saloon' | 'safari';

export interface TrafficAgent {
  id: string;
  archetype: TrafficArchetype;
  streetId: string;
  axis: 'ns' | 'ew';
  /** +1 moves toward positive coord (+Z or +X); -1 moves toward negative coord (-Z or -X) */
  dir: 1 | -1;
  laneCoord: number; // Fixed axis coordinate in left-hand Kenyan lane
  progress: number; // Current coordinate along street axis
  minBound: number;
  maxBound: number;
  x: number;
  z: number;
  heading: number;
  baseSpeed: number;
  currentSpeed: number;
  length: number;
  radius: number;
  routeNumber?: string;
  liveryIndex: number;
  stopTimer: number;
  braking: boolean;
}

export interface SignalPhase {
  /** 'ns-green' | 'ns-amber' | 'ew-green' | 'ew-amber' */
  state: 'ns-green' | 'ns-amber' | 'ew-green' | 'ew-amber';
  timer: number;
}

export function createSignalPhase(): SignalPhase {
  return { state: 'ns-green', timer: 0 };
}

export function stepSignalPhase(signal: SignalPhase, dt: number): SignalPhase {
  const cycle = 16; // 6s NS green, 2s NS amber, 6s EW green, 2s EW amber
  signal.timer = (signal.timer + dt) % cycle;
  if (signal.timer < 6) signal.state = 'ns-green';
  else if (signal.timer < 8) signal.state = 'ns-amber';
  else if (signal.timer < 14) signal.state = 'ew-green';
  else signal.state = 'ew-amber';
  return signal;
}

/**
 * Computes the Kenyan LEFT-HAND lane coordinate for a street & travel direction.
 * Heading:
 *  - NS dir = -1 (North, -Z): left is -X => coord - offset
 *  - NS dir = +1 (South, +Z): left is +X => coord + offset
 *  - EW dir = +1 (East, +X):  left is -Z => coord - offset
 *  - EW dir = -1 (West, -X):  left is +Z => coord + offset
 */
export function getLeftHandLaneCoord(
  axis: 'ns' | 'ew',
  streetCoord: number,
  dir: 1 | -1,
  streetWidth: number,
  laneOffsetIndex: 0 | 1 = 0,
): number {
  const baseOffset = Math.max(3.6, streetWidth * 0.24) + laneOffsetIndex * 2.5;
  if (axis === 'ns') {
    return dir === -1 ? streetCoord - baseOffset : streetCoord + baseOffset;
  }
  return dir === 1 ? streetCoord - baseOffset : streetCoord + baseOffset;
}

export function getHeadingForAxisDir(axis: 'ns' | 'ew', dir: 1 | -1): number {
  if (axis === 'ns') {
    return dir === -1 ? 0 : Math.PI;
  }
  return dir === 1 ? Math.PI / 2 : -Math.PI / 2;
}

const MATATU_ROUTES = ['111', '46', '237', '125', '33', '100', '44'];

/**
 * Deterministically populates Nairobi CBD streets with authentic Kenyan traffic:
 * Matatus, Boda-Bodas, City Hoppa buses, Saloon taxis, and Safari Land Cruisers.
 */
export function createTrafficFleet(): TrafficAgent[] {
  const agents: TrafficAgent[] = [];
  const archetypes: TrafficArchetype[] = [
    'matatu',
    'saloon',
    'bodaboda',
    'matatu',
    'cityhoppa',
    'safari',
    'bodaboda',
    'saloon',
  ];

  let idx = 0;
  for (const street of NAIROBI_STREETS) {
    const span = street.end - street.start;
    const countPerDir = street.width >= 24 ? 3 : 2;

    for (const dir of [1, -1] as const) {
      for (let k = 0; k < countPerDir; k++) {
        const archetype = archetypes[idx % archetypes.length];
        const laneSlot: 0 | 1 = archetype === 'bodaboda' ? 1 : 0;
        const laneCoord = getLeftHandLaneCoord(street.axis, street.coord, dir, street.width, laneSlot);
        const frac = (k + 0.35 + ((idx % 3) * 0.12)) / countPerDir;
        const progress = street.start + 18 + (span - 36) * Math.min(0.95, frac);

        const baseSpeed =
          archetype === 'bodaboda'
            ? 19 + (idx % 4)
            : archetype === 'matatu'
              ? 17 + (idx % 3) * 1.5
              : archetype === 'cityhoppa'
                ? 12.5
                : archetype === 'safari'
                  ? 15
                  : 15.5 + (idx % 3);

        const length =
          archetype === 'cityhoppa'
            ? 8.4
            : archetype === 'matatu'
              ? 5.2
              : archetype === 'bodaboda'
                ? 2.1
                : 4.4;

        const radius =
          archetype === 'cityhoppa'
            ? 2.4
            : archetype === 'bodaboda'
              ? 1.0
              : 1.9;

        const x = street.axis === 'ns' ? laneCoord : progress;
        const z = street.axis === 'ns' ? progress : laneCoord;

        agents.push({
          id: `tf-${street.id}-${dir === 1 ? 'p' : 'n'}-${k}`,
          archetype,
          streetId: street.id,
          axis: street.axis,
          dir,
          laneCoord,
          progress,
          minBound: street.start + 6,
          maxBound: street.end - 6,
          x,
          z,
          heading: getHeadingForAxisDir(street.axis, dir),
          baseSpeed,
          currentSpeed: baseSpeed * 0.7,
          length,
          radius,
          routeNumber: archetype === 'matatu' ? MATATU_ROUTES[idx % MATATU_ROUTES.length] : undefined,
          liveryIndex: idx % 4,
          stopTimer: 0,
          braking: false,
        });
        idx++;
      }
    }
  }

  return agents;
}

const MAJOR_NS_COORDS = [-95, 55, 135];
const MAJOR_EW_COORDS = [-180, -45, 35, 115, 220];

export function stepTrafficFleet(
  agents: TrafficAgent[],
  signal: SignalPhase,
  player: PlayerVehicleState,
  dt: number,
): { playerCollisionImpact: number } {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  let playerCollisionImpact = 0;

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    let targetSpeed = a.baseSpeed;
    a.braking = false;

    // 1. Traffic signal obedience at major CBD intersections
    const isGreen =
      a.axis === 'ns'
        ? signal.state === 'ns-green'
        : signal.state === 'ew-green';

    if (!isGreen) {
      const junctionCoords = a.axis === 'ns' ? MAJOR_EW_COORDS : MAJOR_NS_COORDS;
      for (const jc of junctionCoords) {
        const distAhead = (jc - a.progress) * a.dir;
        // Stop just before the zebra crossing (14m to 26m ahead of junction center)
        if (distAhead > 13 && distAhead < 27) {
          targetSpeed = 0;
          a.braking = true;
          break;
        }
      }
    }

    // 2. Matatu stage brief passenger pick-up simulation near Tom Mboya / Moi Ave
    if (a.archetype === 'matatu' && a.stopTimer > 0) {
      a.stopTimer -= clampedDt;
      targetSpeed = 0;
      a.braking = true;
    }

    // 3. Vehicle-following gap check in same street & direction
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue;
      const b = agents[j];
      if (b.streetId === a.streetId && b.dir === a.dir && Math.abs(b.laneCoord - a.laneCoord) < 2.2) {
        const gap = (b.progress - a.progress) * a.dir;
        const safeGap = (a.length + b.length) * 0.5 + 7;
        if (gap > 0 && gap < safeGap) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, b.currentSpeed * 0.75));
          a.braking = true;
        }
      }
    }

    // 4. Slow down if player is directly in front
    const dxP = player.x - a.x;
    const dzP = player.z - a.z;
    const distPSq = dxP * dxP + dzP * dzP;
    if (distPSq < 18 * 18) {
      const fwdX = Math.sin(a.heading);
      const fwdZ = -Math.cos(a.heading);
      const aheadDot = dxP * fwdX + dzP * fwdZ;
      const sideDot = Math.abs(dxP * -fwdZ + dzP * fwdX);
      if (aheadDot > 0 && aheadDot < 15 && sideDot < 3.2) {
        targetSpeed = 0;
        a.braking = true;
      }
    }

    const rate = targetSpeed < a.currentSpeed ? 14 : 7;
    a.currentSpeed += (targetSpeed - a.currentSpeed) * Math.min(1, rate * clampedDt);
    a.progress += a.dir * a.currentSpeed * clampedDt;

    // Wrap cleanly along street bounds
    if (a.dir === 1 && a.progress > a.maxBound) {
      a.progress = a.minBound;
    } else if (a.dir === -1 && a.progress < a.minBound) {
      a.progress = a.maxBound;
    }

    // Gentle boda-boda weaving within lane shoulder
    let lateralOffset = 0;
    if (a.archetype === 'bodaboda') {
      lateralOffset = Math.sin(a.progress * 0.08 + a.liveryIndex) * 0.8;
    }

    if (a.axis === 'ns') {
      a.x = a.laneCoord + lateralOffset;
      a.z = a.progress;
    } else {
      a.x = a.progress;
      a.z = a.laneCoord + lateralOffset;
    }

    // 5. Player <-> Traffic collision resolution
    const cdx = player.x - a.x;
    const cdz = player.z - a.z;
    const minSep = a.radius + 1.95;
    const cDistSq = cdx * cdx + cdz * cdz;
    if (cDistSq < minSep * minSep && cDistSq > 0.0001) {
      const dist = Math.sqrt(cDistSq);
      const nx = cdx / dist;
      const nz = cdz / dist;
      const overlap = minSep - dist;
      player.x += nx * overlap;
      player.z += nz * overlap;

      const relVx = player.vx - Math.sin(a.heading) * a.currentSpeed;
      const relVz = player.vz - -Math.cos(a.heading) * a.currentSpeed;
      const vn = relVx * nx + relVz * nz;
      if (vn < 0) {
        playerCollisionImpact = Math.max(playerCollisionImpact, -vn);
        player.vx -= 1.15 * vn * nx;
        player.vz -= 1.15 * vn * nz;
        player.vx *= 0.85;
        player.vz *= 0.85;
        a.currentSpeed *= 0.35;
      }
    }
  }

  return { playerCollisionImpact };
}
