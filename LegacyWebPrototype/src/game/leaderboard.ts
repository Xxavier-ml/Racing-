import type { VehiclePreset } from './nairobiMap';

export const LEADERBOARD_STORAGE_KEY = 'nairobi-express:top-lap-times:v1';
export const MAX_LEADERBOARD_ENTRIES = 5;

export interface LapLeaderboardEntry {
  id: string;
  lapTimeSeconds: number;
  presetId: VehiclePreset['id'];
  vehicleName: string;
  topSpeedKmh: number;
  driftScore: number;
  racePosition: number;
  recordedAt: string;
}

export type SaveLapInput = Omit<LapLeaderboardEntry, 'id' | 'recordedAt'>;

type StorageReader = Pick<Storage, 'getItem'>;
type StorageReadWriter = Pick<Storage, 'getItem' | 'setItem'>;
type StorageRemover = Pick<Storage, 'removeItem'>;

function resolveStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function isValidEntry(candidate: unknown): candidate is LapLeaderboardEntry {
  if (!candidate || typeof candidate !== 'object') return false;
  const e = candidate as Partial<LapLeaderboardEntry>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.lapTimeSeconds === 'number' &&
    Number.isFinite(e.lapTimeSeconds) &&
    e.lapTimeSeconds > 0 &&
    (e.presetId === 'rally' || e.presetId === 'nganya' || e.presetId === 'safari') &&
    typeof e.vehicleName === 'string' &&
    typeof e.topSpeedKmh === 'number' &&
    Number.isFinite(e.topSpeedKmh) &&
    typeof e.driftScore === 'number' &&
    Number.isFinite(e.driftScore) &&
    typeof e.racePosition === 'number' &&
    Number.isFinite(e.racePosition) &&
    typeof e.recordedAt === 'string'
  );
}

export function sortAndTrimLeaderboard(entries: readonly LapLeaderboardEntry[]): LapLeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (a.lapTimeSeconds !== b.lapTimeSeconds) {
        return a.lapTimeSeconds - b.lapTimeSeconds;
      }
      if (b.driftScore !== a.driftScore) {
        return b.driftScore - a.driftScore;
      }
      return a.recordedAt.localeCompare(b.recordedAt);
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function parseLeaderboardEntries(raw: string | null): LapLeaderboardEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidEntry);
    return sortAndTrimLeaderboard(valid);
  } catch {
    return [];
  }
}

export function loadLeaderboard(storage: StorageReader | null = resolveStorage()): LapLeaderboardEntry[] {
  if (!storage) return [];
  try {
    return parseLeaderboardEntries(storage.getItem(LEADERBOARD_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveLapResult(
  input: SaveLapInput,
  storage: StorageReadWriter | null = resolveStorage(),
): {
  entries: LapLeaderboardEntry[];
  savedEntry: LapLeaderboardEntry;
  rank: number | null;
} {
  const existing = loadLeaderboard(storage);
  const savedEntry: LapLeaderboardEntry = {
    id: `lap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    lapTimeSeconds: Math.max(0.01, Number(input.lapTimeSeconds.toFixed(2))),
    presetId: input.presetId,
    vehicleName: input.vehicleName,
    topSpeedKmh: Math.max(0, Math.round(input.topSpeedKmh)),
    driftScore: Math.max(0, Math.round(input.driftScore)),
    racePosition: Math.max(1, Math.round(input.racePosition)),
    recordedAt: new Date().toISOString(),
  };

  const entries = sortAndTrimLeaderboard([...existing, savedEntry]);
  const idx = entries.findIndex((e) => e.id === savedEntry.id);
  const rank = idx >= 0 ? idx + 1 : null;

  if (storage) {
    try {
      storage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage quota or private browsing errors gracefully
    }
  }

  return { entries, savedEntry, rank };
}

export function clearLeaderboard(storage: StorageRemover | null = resolveStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(LEADERBOARD_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
