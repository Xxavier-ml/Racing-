export type WeatherCondition = 'clear' | 'rainy' | 'foggy';

export interface WeatherProfile {
  condition: WeatherCondition;
  label: string;
  shortLabel: string;
  gripMultiplier: number;
  brakeMultiplier: number;
  visibilityMeters: number;
  fogDensity: number;
  fogColorHex: number;
  sunIntensity: number;
  sunColorHex: number;
  hemiIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  skyTurbidity: number;
  skyRayleigh: number;
  skyMie: number;
  roadRoughness: number;
  roadMetalness: number;
  rainIntensity: number;
}

export const WEATHER_ORDER: readonly WeatherCondition[] = ['clear', 'rainy', 'foggy'];

export const WEATHER_PROFILES: Record<WeatherCondition, WeatherProfile> = {
  clear: {
    condition: 'clear',
    label: 'Clear Sun',
    shortLabel: 'CLEAR',
    gripMultiplier: 1.0,
    brakeMultiplier: 1.0,
    visibilityMeters: 740,
    fogDensity: 0.00135,
    fogColorHex: 0xd5c5b8,
    sunIntensity: 2.75,
    sunColorHex: 0xffcf99,
    hemiIntensity: 1.15,
    hemiSkyHex: 0x88b4e8,
    hemiGroundHex: 0x4b4036,
    skyTurbidity: 6.2,
    skyRayleigh: 2.1,
    skyMie: 0.0055,
    roadRoughness: 0.76,
    roadMetalness: 0.06,
    rainIntensity: 0,
  },
  rainy: {
    condition: 'rainy',
    label: 'Nairobi Rain',
    shortLabel: 'RAINY',
    gripMultiplier: 0.62,
    brakeMultiplier: 0.76,
    visibilityMeters: 240,
    fogDensity: 0.0095,
    fogColorHex: 0x44556a,
    sunIntensity: 0.75,
    sunColorHex: 0x94a3b8,
    hemiIntensity: 0.95,
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x1e293b,
    skyTurbidity: 14,
    skyRayleigh: 0.55,
    skyMie: 0.025,
    roadRoughness: 0.14,
    roadMetalness: 0.42,
    rainIntensity: 1.0,
  },
  foggy: {
    condition: 'foggy',
    label: 'Highland Fog',
    shortLabel: 'FOGGY',
    gripMultiplier: 0.84,
    brakeMultiplier: 0.88,
    visibilityMeters: 90,
    fogDensity: 0.025,
    fogColorHex: 0xc7d2de,
    sunIntensity: 0.95,
    sunColorHex: 0xe2e8f0,
    hemiIntensity: 1.12,
    hemiSkyHex: 0xcbd5e1,
    hemiGroundHex: 0x525c68,
    skyTurbidity: 18,
    skyRayleigh: 0.4,
    skyMie: 0.06,
    roadRoughness: 0.48,
    roadMetalness: 0.14,
    rainIntensity: 0,
  },
};

export function getWeatherProfile(condition: WeatherCondition): WeatherProfile {
  return WEATHER_PROFILES[condition] ?? WEATHER_PROFILES.clear;
}

export function cycleWeatherCondition(current: WeatherCondition): WeatherCondition {
  const idx = WEATHER_ORDER.indexOf(current);
  return WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
}
