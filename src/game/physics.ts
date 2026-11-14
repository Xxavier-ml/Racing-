import {
  ALL_OBSTACLE_COLLIDERS,
  NAIROBI_ROUNDABOUTS,
  PLAYER_SPAWN,
  VEHICLE_PRESETS,
  WORLD_BOUNDS,
  type BuildingCollider,
  type VehiclePreset,
} from './nairobiMap';
import type { ControlSettings } from './controlSettings';
import { getWeatherProfile, type WeatherCondition } from './weather';

export interface PlayerInput {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  boost: boolean;
}

export type NitroPhase = 'ready' | 'active' | 'cooldown';

export const NITRO_ACTIVE_DURATION = 3.5; // seconds of high-output Nitrous speed surge
export const NITRO_COOLDOWN_DURATION = 6.0; // seconds required to recharge Nitrous before next trigger

export interface PlayerVehicleState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number; // 0 = -Z (North), +PI/2 = +X (East)
  steerAngle: number; // visual front-wheel angle
  wheelSpin: number;
  speed: number; // signed forward speed (m/s)
  kmh: number;
  rpm: number; // 900..8500
  gear: string;
  nitro: number; // 0..100 (100 = ready, drains 100->0 when active, refills 0->100 on cooldown)
  nitroPhase: NitroPhase;
  nitroTimer: number; // seconds left in active burst or cooldown
  isDrifting: boolean;
  isBoosting: boolean;
  isBraking: boolean;
  driftScoreActive: number;
  totalDriftScore: number;
  bodyRoll: number;
  bodyPitch: number;
  engineTemp: number; // 0..100 thermal intensity (maps to 65°C..125°C)
  presetId: VehiclePreset['id'];
}

export interface StepPhysicsResult {
  impactSpeed: number;
  collided: boolean;
  impactX: number;
  impactZ: number;
}

export function createInitialPlayerState(presetId: VehiclePreset['id'] = 'rally'): PlayerVehicleState {
  return {
    x: PLAYER_SPAWN.x,
    z: PLAYER_SPAWN.z,
    vx: 0,
    vz: 0,
    heading: PLAYER_SPAWN.heading,
    steerAngle: 0,
    wheelSpin: 0,
    speed: 0,
    kmh: 0,
    rpm: 950,
    gear: 'N',
    nitro: 100,
    nitroPhase: 'ready',
    nitroTimer: 0,
    isDrifting: false,
    isBoosting: false,
    isBraking: false,
    driftScoreActive: 0,
    totalDriftScore: 0,
    bodyRoll: 0,
    bodyPitch: 0,
    engineTemp: 12,
    presetId,
  };
}

export function getPreset(id: VehiclePreset['id']): VehiclePreset {
  return VEHICLE_PRESETS.find((p) => p.id === id) ?? VEHICLE_PRESETS[0];
}

const GEAR_THRESHOLDS = [12, 22, 33, 44, 55, 75];

export function computeGear(forwardSpeed: number): string {
  if (forwardSpeed < -1.0) return 'R';
  const abs = Math.abs(forwardSpeed);
  if (abs < 0.7) return 'N';
  if (abs < GEAR_THRESHOLDS[0]) return '1';
  if (abs < GEAR_THRESHOLDS[1]) return '2';
  if (abs < GEAR_THRESHOLDS[2]) return '3';
  if (abs < GEAR_THRESHOLDS[3]) return '4';
  if (abs < GEAR_THRESHOLDS[4]) return '5';
  return '6';
}

export function computeRpm(forwardSpeed: number, throttle: boolean, isBoosting: boolean): number {
  const abs = Math.abs(forwardSpeed);
  if (abs < 0.7) {
    return throttle ? 4200 : 950;
  }
  let prev = 0;
  for (let i = 0; i < GEAR_THRESHOLDS.length; i++) {
    const top = GEAR_THRESHOLDS[i];
    if (abs < top || i === GEAR_THRESHOLDS.length - 1) {
      const ratio = Math.min(1, Math.max(0, (abs - prev) / Math.max(1, top - prev)));
      const base = 2400 + ratio * 5400 + (throttle ? 450 : 0) + (isBoosting ? 550 : 0);
      return Math.round(Math.min(8500, Math.max(1100, base)));
    }
    prev = top * 0.72;
  }
  return 7800;
}

/**
 * Pure racing simulation step for the player's car in Nairobi.
 * Supports automatic cruise drive (with manual Accelerate & Brake overrides),
 * configurable steering/accelerate/brake sensitivities, 6-speed RPM curve,
 * controlled power-slide drifting, twin-turbo nitro, and wall-grazing collisions.
 */
export function stepVehiclePhysics(
  state: PlayerVehicleState,
  input: PlayerInput,
  dt: number,
  extraColliders: readonly BuildingCollider[] = ALL_OBSTACLE_COLLIDERS,
  controlSettings?: Partial<ControlSettings>,
  weatherCondition: WeatherCondition = 'clear',
): StepPhysicsResult {
  const preset = getPreset(state.presetId);
  const weather = getWeatherProfile(weatherCondition);
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);

  const steeringSens = THREE_CLAMP(controlSettings?.steeringSensitivity ?? 1.0, 0.5, 1.8);
  const accelSens = THREE_CLAMP(controlSettings?.accelSensitivity ?? 1.0, 0.6, 1.6);
  const brakeSens = THREE_CLAMP(controlSettings?.brakeSensitivity ?? 1.0, 0.6, 1.6);
  const autoDrive = controlSettings?.autoDrive ?? false;
  const cruiseRatio = THREE_CLAMP(controlSettings?.cruiseSpeedRatio ?? 0.56, 0.35, 0.75);

  const fx = Math.sin(state.heading);
  const fz = -Math.cos(state.heading);
  const rx = Math.cos(state.heading);
  const rz = Math.sin(state.heading);

  let forwardVel = state.vx * fx + state.vz * fz;
  let lateralVel = state.vx * rx + state.vz * rz;

  // Temporary Nitrous Boost state machine: Ready -> Active (3.5s speed surge) -> Cooldown (6.0s recharge)
  if (state.nitroPhase === 'ready' && input.boost) {
    state.nitroPhase = 'active';
    state.nitroTimer = NITRO_ACTIVE_DURATION;
    // Punchy nitrous launch kick if car was rolling slowly or stopped
    if (forwardVel < 6) {
      forwardVel = Math.max(forwardVel, 6);
    }
  } else if (state.nitroPhase === 'active') {
    state.nitroTimer = Math.max(0, state.nitroTimer - clampedDt);
    if (state.nitroTimer <= 0) {
      state.nitroPhase = 'cooldown';
      state.nitroTimer = NITRO_COOLDOWN_DURATION;
      state.nitro = 0;
    } else {
      state.nitro = Math.round((state.nitroTimer / NITRO_ACTIVE_DURATION) * 100);
    }
  } else if (state.nitroPhase === 'cooldown') {
    state.nitroTimer = Math.max(0, state.nitroTimer - clampedDt);
    if (state.nitroTimer <= 0) {
      state.nitroPhase = 'ready';
      state.nitroTimer = 0;
      state.nitro = 100;
    } else {
      state.nitro = Math.round((1 - state.nitroTimer / NITRO_COOLDOWN_DURATION) * 100);
    }
  }

  const canBoost = state.nitroPhase === 'active';
  state.isBoosting = canBoost;

  const boostMult = canBoost ? 1.42 : 1.0;
  const maxFwd = preset.maxSpeed * boostMult;
  const maxRev = -22;

  state.isBraking = input.brake && forwardVel > 1.0;

  // Punchy low-end launch torque curve (feels snappy off the line!)
  const lowEndTorque = forwardVel >= 0 && forwardVel < 22 ? 1.32 - (forwardVel / 22) * 0.32 : 1.0;

  if (input.throttle) {
    const wetTractionScale = weatherCondition === 'rainy' ? 0.92 : 1.0;
    forwardVel += preset.accel * lowEndTorque * boostMult * accelSens * wetTractionScale * clampedDt;
  } else if (canBoost && !input.brake) {
    // Active Nitrous button press surges car forward even without holding Accelerate simultaneously
    const wetTractionScale = weatherCondition === 'rainy' ? 0.92 : 1.0;
    forwardVel += preset.accel * 1.18 * boostMult * accelSens * wetTractionScale * clampedDt;
  } else if (input.brake) {
    if (forwardVel > 1.5) {
      forwardVel -= 58 * brakeSens * weather.brakeMultiplier * clampedDt; // ABS brakes affected by wet tarmac
    } else {
      forwardVel -= 26 * brakeSens * weather.brakeMultiplier * clampedDt; // Reverse
    }
  } else if (autoDrive) {
    // Automatic forward cruise: car drives smoothly so player can Steer, Accelerate, or Brake
    const targetCruise = preset.maxSpeed * cruiseRatio;
    if (forwardVel < targetCruise) {
      forwardVel = Math.min(
        targetCruise,
        forwardVel + preset.accel * 0.68 * accelSens * clampedDt,
      );
    } else {
      forwardVel = Math.max(targetCruise, forwardVel * Math.exp(-0.55 * clampedDt));
    }
  }

  // Rolling drag & aerodynamic resistance
  if (!input.throttle && !input.brake && !autoDrive && !canBoost) {
    forwardVel *= Math.exp(-1.15 * clampedDt);
    if (Math.abs(forwardVel) < 0.08) forwardVel = 0;
  } else {
    forwardVel *= Math.exp(-0.18 * clampedDt);
  }

  forwardVel = Math.max(maxRev, Math.min(maxFwd, forwardVel));

  // Steering (scaled smoothly by steeringSensitivity)
  const steerDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const targetSteerAngle = steerDir * Math.min(0.62, 0.46 * Math.sqrt(steeringSens));
  state.steerAngle += (targetSteerAngle - state.steerAngle) * Math.min(1, 14 * steeringSens * clampedDt);

  const absFwd = Math.abs(forwardVel);
  const speedFactor = absFwd < 0.25 ? 0 : Math.min(1, Math.max(0.22, absFwd / 5.2));
  const highSpeedTaper = 1 - 0.3 * Math.min(1, absFwd / preset.maxSpeed);
  const reverseFlip = forwardVel >= -0.4 ? 1 : -1;

  // Initiate drift via handbrake [Space] OR aggressive high-speed cornering (easier slip on wet roads)
  const slipRatio = Math.abs(lateralVel) / Math.max(8, Math.abs(forwardVel));
  const slipThreshold = weatherCondition === 'rainy' ? 0.2 : 0.28;
  const isDrifting =
    Math.abs(forwardVel) > 13 &&
    ((input.drift && Math.abs(steerDir) > 0) || slipRatio > slipThreshold);
  state.isDrifting = isDrifting;

  if (isDrifting) {
    const pts = Math.round(Math.abs(forwardVel) * 4.5 * clampedDt);
    state.driftScoreActive += pts;
  } else if (state.driftScoreActive > 0) {
    state.totalDriftScore += state.driftScoreActive;
    state.driftScoreActive = 0;
  }

  const turnRate =
    steerDir *
    preset.handling *
    steeringSens *
    (input.drift ? 1.38 : 1.0) *
    (weatherCondition === 'rainy' ? 0.9 : 1.0) *
    speedFactor *
    highSpeedTaper *
    reverseFlip;

  state.heading += turnRate * clampedDt;

  // Recompute basis after heading rotation
  const nfx = Math.sin(state.heading);
  const nfz = -Math.cos(state.heading);
  const nrx = Math.cos(state.heading);
  const nrz = Math.sin(state.heading);

  // Lateral grip damping scaled by weather gripMultiplier (rain makes tires slide wider!)
  const gripDamping = (input.drift ? 2.1 : 10.5 * preset.driftGrip) * weather.gripMultiplier;
  lateralVel *= Math.exp(-gripDamping * clampedDt);
  if (input.drift) {
    forwardVel *= Math.exp(-0.4 * clampedDt);
  }

  state.vx = nfx * forwardVel + nrx * lateralVel;
  state.vz = nfz * forwardVel + nrz * lateralVel;

  state.x += state.vx * clampedDt;
  state.z += state.vz * clampedDt;

  // Dynamic suspension weight transfer (squat on launch/NOS, dive on braking, roll in corners)
  const lateralG = (steerDir * Math.min(1, Math.abs(forwardVel) / 30)) + THREE_CLAMP(lateralVel * 0.03, -0.5, 0.5);
  const targetRoll = THREE_CLAMP(lateralG * 0.09, -0.11, 0.11);
  const targetPitch = canBoost ? -0.045 : input.throttle ? -0.028 : state.isBraking ? 0.048 : 0;
  state.bodyRoll += (targetRoll - state.bodyRoll) * Math.min(1, 11 * clampedDt);
  state.bodyPitch += (targetPitch - state.bodyPitch) * Math.min(1, 12 * clampedDt);
  state.wheelSpin += forwardVel * clampedDt * 2.5;

  // Resolve collisions with smooth wall-grazing instead of dead-stopping
  let maxImpact = 0;
  let collided = false;
  let impactX = state.x;
  let impactZ = state.z;
  const carRadius = 2.05;

  for (const box of extraColliders) {
    const closestX = Math.max(box.x - box.halfW, Math.min(state.x, box.x + box.halfW));
    const closestZ = Math.max(box.z - box.halfD, Math.min(state.z, box.z + box.halfD));
    const dx = state.x - closestX;
    const dz = state.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < carRadius * carRadius) {
      const dist = Math.sqrt(distSq);
      let nx = 0;
      let nz = 0;
      let overlap = 0;

      if (dist > 0.0001) {
        nx = dx / dist;
        nz = dz / dist;
        overlap = carRadius - dist;
      } else {
        const penX = box.halfW - Math.abs(state.x - box.x);
        const penZ = box.halfD - Math.abs(state.z - box.z);
        if (penX < penZ) {
          nx = state.x >= box.x ? 1 : -1;
          overlap = penX + carRadius;
        } else {
          nz = state.z >= box.z ? 1 : -1;
          overlap = penZ + carRadius;
        }
      }

      state.x += nx * overlap;
      state.z += nz * overlap;
      impactX = closestX;
      impactZ = closestZ;

      const vn = state.vx * nx + state.vz * nz;
      if (vn < 0) {
        const impact = -vn;
        if (impact > maxImpact) maxImpact = impact;
        collided = true;
        // Project velocity smoothly along wall tangent with light bounce
        state.vx -= 1.2 * vn * nx;
        state.vz -= 1.2 * vn * nz;
        state.vx *= 0.88;
        state.vz *= 0.88;
      }
    }
  }

  // Roundabout central monument islands
  for (const rb of NAIROBI_ROUNDABOUTS) {
    const dx = state.x - rb.x;
    const dz = state.z - rb.z;
    const minDist = rb.islandRadius + carRadius - 0.3;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      state.x = rb.x + nx * minDist;
      state.z = rb.z + nz * minDist;
      impactX = rb.x + nx * rb.islandRadius;
      impactZ = rb.z + nz * rb.islandRadius;
      const vn = state.vx * nx + state.vz * nz;
      if (vn < 0) {
        if (-vn > maxImpact) maxImpact = -vn;
        collided = true;
        state.vx -= 1.18 * vn * nx;
        state.vz -= 1.18 * vn * nz;
      }
    }
  }

  // Outer perimeter clamp
  if (state.x < WORLD_BOUNDS.minX) {
    state.x = WORLD_BOUNDS.minX;
    if (state.vx < 0) {
      maxImpact = Math.max(maxImpact, -state.vx);
      state.vx *= -0.35;
      collided = true;
    }
  } else if (state.x > WORLD_BOUNDS.maxX) {
    state.x = WORLD_BOUNDS.maxX;
    if (state.vx > 0) {
      maxImpact = Math.max(maxImpact, state.vx);
      state.vx *= -0.35;
      collided = true;
    }
  }

  if (state.z < WORLD_BOUNDS.minZ) {
    state.z = WORLD_BOUNDS.minZ;
    if (state.vz < 0) {
      maxImpact = Math.max(maxImpact, -state.vz);
      state.vz *= -0.35;
      collided = true;
    }
  } else if (state.z > WORLD_BOUNDS.maxZ) {
    state.z = WORLD_BOUNDS.maxZ;
    if (state.vz > 0) {
      maxImpact = Math.max(maxImpact, state.vz);
      state.vz *= -0.35;
      collided = true;
    }
  }

  const finalFx = Math.sin(state.heading);
  const finalFz = -Math.cos(state.heading);
  state.speed = state.vx * finalFx + state.vz * finalFz;
  state.kmh = Math.round(Math.abs(state.speed) * 3.6);
  state.gear = computeGear(state.speed);
  state.rpm = computeRpm(state.speed, input.throttle, state.isBoosting);

  // Dynamic Engine Temperature: climbs during sustained acceleration/boost/drift, cools when coasting/braking
  if (input.throttle || state.isBoosting) {
    const heatGain =
      (input.throttle ? 10.5 * accelSens : 0) +
      (state.isBoosting ? 16.5 : 0) +
      (state.isDrifting ? 4.5 : 0);
    state.engineTemp = THREE_CLAMP(state.engineTemp + heatGain * clampedDt, 0, 100);
  } else if (autoDrive && !input.brake) {
    // Passive auto-drive cruise settles gently around warm 34% operating temp (~85°C)
    const targetCruiseTemp = 34;
    if (state.engineTemp < targetCruiseTemp) {
      state.engineTemp = Math.min(targetCruiseTemp, state.engineTemp + 3.0 * clampedDt);
    } else {
      state.engineTemp = Math.max(targetCruiseTemp, state.engineTemp - 5.2 * clampedDt);
    }
  } else {
    const airflowBonus = Math.min(3.0, Math.abs(state.speed) * 0.06);
    const coolRate = (input.brake ? 11.5 : 7.5) + airflowBonus;
    state.engineTemp = Math.max(10, state.engineTemp - coolRate * clampedDt);
  }

  return {
    impactSpeed: maxImpact,
    collided,
    impactX,
    impactZ,
  };
}

function THREE_CLAMP(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
