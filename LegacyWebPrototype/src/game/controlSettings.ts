export const CONTROL_SETTINGS_STORAGE_KEY = 'nairobi-express:control-settings:v1';

export interface ControlSettings {
  autoDrive: boolean;
  cruiseSpeedRatio: number; // 0.35..0.75 of preset maxSpeed
  steeringSensitivity: number; // 0.5..1.8 multiplier
  accelSensitivity: number; // 0.6..1.6 multiplier
  brakeSensitivity: number; // 0.6..1.6 multiplier
}

export const DEFAULT_CONTROL_SETTINGS: ControlSettings = {
  autoDrive: true,
  cruiseSpeedRatio: 0.56,
  steeringSensitivity: 1.0,
  accelSensitivity: 1.0,
  brakeSensitivity: 1.0,
};

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

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

export function sanitizeControlSettings(raw: Partial<ControlSettings> | null | undefined): ControlSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONTROL_SETTINGS };
  return {
    autoDrive: typeof raw.autoDrive === 'boolean' ? raw.autoDrive : DEFAULT_CONTROL_SETTINGS.autoDrive,
    cruiseSpeedRatio:
      typeof raw.cruiseSpeedRatio === 'number' && Number.isFinite(raw.cruiseSpeedRatio)
        ? clamp(Number(raw.cruiseSpeedRatio.toFixed(2)), 0.35, 0.75)
        : DEFAULT_CONTROL_SETTINGS.cruiseSpeedRatio,
    steeringSensitivity:
      typeof raw.steeringSensitivity === 'number' && Number.isFinite(raw.steeringSensitivity)
        ? clamp(Number(raw.steeringSensitivity.toFixed(2)), 0.5, 1.8)
        : DEFAULT_CONTROL_SETTINGS.steeringSensitivity,
    accelSensitivity:
      typeof raw.accelSensitivity === 'number' && Number.isFinite(raw.accelSensitivity)
        ? clamp(Number(raw.accelSensitivity.toFixed(2)), 0.6, 1.6)
        : DEFAULT_CONTROL_SETTINGS.accelSensitivity,
    brakeSensitivity:
      typeof raw.brakeSensitivity === 'number' && Number.isFinite(raw.brakeSensitivity)
        ? clamp(Number(raw.brakeSensitivity.toFixed(2)), 0.6, 1.6)
        : DEFAULT_CONTROL_SETTINGS.brakeSensitivity,
  };
}

export function loadControlSettings(storage: StorageReader | null = resolveStorage()): ControlSettings {
  if (!storage) return { ...DEFAULT_CONTROL_SETTINGS };
  try {
    const raw = storage.getItem(CONTROL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONTROL_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    return sanitizeControlSettings(parsed as Partial<ControlSettings>);
  } catch {
    return { ...DEFAULT_CONTROL_SETTINGS };
  }
}

export function saveControlSettings(
  settings: ControlSettings,
  storage: StorageWriter | null = resolveStorage(),
): ControlSettings {
  const clean = sanitizeControlSettings(settings);
  if (storage) {
    try {
      storage.setItem(CONTROL_SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore quota / private mode storage errors
    }
  }
  return clean;
}
