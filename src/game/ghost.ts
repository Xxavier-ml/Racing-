import { normalizeAngle, type VehiclePreset } from './nairobiMap';

export const GHOST_STORAGE_KEY = 'nairobi-express:best-ghost:v1';
export const GHOST_SAMPLE_INTERVAL_SEC = 0.08;

export interface GhostSample {
  t: number;
  x: number;
  z: number;
  heading: number;
}

export interface GhostPose {
  x: number;
  z: number;
  heading: number;
}

export interface GhostLapRecording {
  lapTimeSeconds: number;
  presetId: VehiclePreset['id'];
  vehicleName: string;
  recordedAt: string;
  samples: GhostSample[];
}

export interface GhostStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

function resolveStorage(customStorage?: GhostStorageLike | null): GhostStorageLike | null {
  if (customStorage !== undefined) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeGhostSamples(samples: GhostSample[]): GhostSample[] {
  const cleaned: GhostSample[] = [];
  let prevT = -1;

  for (const s of samples) {
    if (
      !s ||
      typeof s.t !== 'number' ||
      typeof s.x !== 'number' ||
      typeof s.z !== 'number' ||
      typeof s.heading !== 'number' ||
      !Number.isFinite(s.t) ||
      !Number.isFinite(s.x) ||
      !Number.isFinite(s.z) ||
      !Number.isFinite(s.heading)
    ) {
      continue;
    }

    const t = Math.max(0, Number(s.t.toFixed(2)));
    if (t < prevT) continue;
    prevT = t;

    cleaned.push({
      t,
      x: Number(s.x.toFixed(2)),
      z: Number(s.z.toFixed(2)),
      heading: Number(normalizeAngle(s.heading).toFixed(3)),
    });

    if (cleaned.length >= 6000) break;
  }

  return cleaned;
}

/**
 * Computes interpolated Ghost position & heading at elapsedTime using
 * binary search over recorded time-ordered samples + shortest-arc angle lerp.
 */
export function sampleGhostPoseAtTime(
  samples: GhostSample[],
  elapsedTime: number,
): GhostPose | null {
  if (!samples || samples.length === 0) return null;

  if (elapsedTime <= samples[0].t) {
    return {
      x: samples[0].x,
      z: samples[0].z,
      heading: samples[0].heading,
    };
  }

  const last = samples[samples.length - 1];
  if (elapsedTime >= last.t) {
    return {
      x: last.x,
      z: last.z,
      heading: last.heading,
    };
  }

  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= elapsedTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t;
  const alpha = span > 1e-5 ? Math.max(0, Math.min(1, (elapsedTime - a.t) / span)) : 0;

  return {
    x: a.x + (b.x - a.x) * alpha,
    z: a.z + (b.z - a.z) * alpha,
    heading: normalizeAngle(a.heading + normalizeAngle(b.heading - a.heading) * alpha),
  };
}

export function parseGhostLapRecording(raw: string | null): GhostLapRecording | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GhostLapRecording>;
    if (
      !parsed ||
      typeof parsed.lapTimeSeconds !== 'number' ||
      !Number.isFinite(parsed.lapTimeSeconds) ||
      parsed.lapTimeSeconds <= 0 ||
      !Array.isArray(parsed.samples)
    ) {
      return null;
    }

    const samples = normalizeGhostSamples(parsed.samples as GhostSample[]);
    if (samples.length < 2) return null;

    const presetId: VehiclePreset['id'] =
      parsed.presetId === 'nganya' || parsed.presetId === 'safari' ? parsed.presetId : 'rally';

    return {
      lapTimeSeconds: Number(parsed.lapTimeSeconds.toFixed(2)),
      presetId,
      vehicleName: typeof parsed.vehicleName === 'string' && parsed.vehicleName ? parsed.vehicleName : 'Best Ghost',
      recordedAt:
        typeof parsed.recordedAt === 'string' && parsed.recordedAt
          ? parsed.recordedAt
          : new Date().toISOString(),
      samples,
    };
  } catch {
    return null;
  }
}

export function loadBestLapGhost(customStorage?: GhostStorageLike | null): GhostLapRecording | null {
  const storage = resolveStorage(customStorage);
  if (!storage) return null;
  try {
    return parseGhostLapRecording(storage.getItem(GHOST_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveBestLapGhost(
  candidate: Omit<GhostLapRecording, 'recordedAt'> & { recordedAt?: string },
  customStorage?: GhostStorageLike | null,
): { saved: boolean; recording: GhostLapRecording | null } {
  const storage = resolveStorage(customStorage);
  const existing = loadBestLapGhost(storage);
  const samples = normalizeGhostSamples(candidate.samples);

  if (
    !Number.isFinite(candidate.lapTimeSeconds) ||
    candidate.lapTimeSeconds <= 0 ||
    samples.length < 2
  ) {
    return { saved: false, recording: existing };
  }

  const normalizedLap = Number(candidate.lapTimeSeconds.toFixed(2));
  if (existing && normalizedLap >= existing.lapTimeSeconds) {
    return { saved: false, recording: existing };
  }

  const nextRecording: GhostLapRecording = {
    lapTimeSeconds: normalizedLap,
    presetId: candidate.presetId,
    vehicleName: candidate.vehicleName,
    recordedAt: candidate.recordedAt ?? new Date().toISOString(),
    samples,
  };

  if (storage) {
    try {
      storage.setItem(GHOST_STORAGE_KEY, JSON.stringify(nextRecording));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }

  return { saved: true, recording: nextRecording };
}

export function clearBestLapGhost(customStorage?: GhostStorageLike | null): void {
  const storage = resolveStorage(customStorage);
  if (!storage) return;
  try {
    if (storage.removeItem) {
      storage.removeItem(GHOST_STORAGE_KEY);
    } else {
      storage.setItem(GHOST_STORAGE_KEY, '');
    }
  } catch {
    // Ignore
  }
}
