export interface Vec2 {
  x: number;
  z: number;
}

export interface StreetSegment {
  id: string;
  name: string;
  swahiliTag: string;
  axis: 'ns' | 'ew';
  /** Fixed coordinate: x for north-south streets, z for east-west streets */
  coord: number;
  start: number;
  end: number;
  width: number;
  hasMedian: boolean;
  speedLimitKmh: number;
  description: string;
}

export interface Roundabout {
  id: string;
  name: string;
  x: number;
  z: number;
  outerRadius: number;
  islandRadius: number;
}

export interface NairobiLandmark {
  id: string;
  name: string;
  shortName: string;
  district: string;
  street: string;
  x: number;
  z: number;
  /** Safe road-side arrival / checkpoint coordinate */
  waypointX: number;
  waypointZ: number;
  /** World-space collider footprint if solid structure */
  colliderHalfW: number;
  colliderHalfD: number;
  height: number;
  color: string;
  summary: string;
  wayfindingTip: string;
  lat: number;
  lng: number;
}

export interface BuildingCollider {
  id: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  height: number;
  label?: string;
}

export interface WayfindingGuidance {
  currentStreet: string;
  targetLandmark: NairobiLandmark;
  distanceMeters: number;
  bearingDeltaRad: number;
  instruction: string;
  nextTurnStreet: string;
  distToTurnMeters: number;
  arrived: boolean;
}

export const WORLD_BOUNDS = {
  minX: -245,
  maxX: 235,
  minZ: -245,
  maxZ: 275,
};

export const NAIROBI_STREETS: StreetSegment[] = [
  {
    id: 'uhuru-hwy',
    name: 'Uhuru Highway (A104)',
    swahiliTag: 'Barabara Kuu ya Uhuru',
    axis: 'ns',
    coord: -95,
    start: -240,
    end: 265,
    width: 26,
    hasMedian: true,
    speedLimitKmh: 80,
    description: 'Primary arterial spine separating Uhuru Park from Nairobi CBD under the Expressway.',
  },
  {
    id: 'moi-ave',
    name: 'Moi Avenue',
    swahiliTag: 'Barabara ya Moi',
    axis: 'ns',
    coord: 55,
    start: -225,
    end: 165,
    width: 20,
    hasMedian: false,
    speedLimitKmh: 50,
    description: 'Historic CBD commercial boulevard linking Globe Roundabout, Archives, and Nairobi Railway Station.',
  },
  {
    id: 'tom-mboya',
    name: 'Tom Mboya Street',
    swahiliTag: 'Mtaa wa Tom Mboya',
    axis: 'ns',
    coord: 135,
    start: -205,
    end: 155,
    width: 18,
    hasMedian: false,
    speedLimitKmh: 45,
    description: 'Bustling eastern CBD matatu corridor passing Odeon, Fire Station, and Afya Centre.',
  },
  {
    id: 'university-way',
    name: 'University Way',
    swahiliTag: 'Njia ya Chuo Kikuu',
    axis: 'ew',
    coord: -180,
    start: -175,
    end: 165,
    width: 20,
    hasMedian: true,
    speedLimitKmh: 50,
    description: 'Northern CBD avenue connecting Central Park, University of Nairobi, and Globe Cinema Roundabout.',
  },
  {
    id: 'kenyatta-ave',
    name: 'Kenyatta Avenue',
    swahiliTag: 'Barabara ya Kenyatta',
    axis: 'ew',
    coord: -45,
    start: -185,
    end: 170,
    width: 24,
    hasMedian: true,
    speedLimitKmh: 60,
    description: 'Grand palm-lined civic boulevard cutting straight from Uhuru Highway to Moi Avenue.',
  },
  {
    id: 'city-hall-way',
    name: 'City Hall Way',
    swahiliTag: 'Njia ya Ukumbi wa Jiji',
    axis: 'ew',
    coord: 35,
    start: -95,
    end: 135,
    width: 18,
    hasMedian: false,
    speedLimitKmh: 45,
    description: 'Civic square corridor framing KICC, Supreme Court, City Hall, and Parliament Buildings.',
  },
  {
    id: 'haile-selassie',
    name: 'Haile Selassie Avenue',
    swahiliTag: 'Barabara ya Haile Selassie',
    axis: 'ew',
    coord: 115,
    start: -175,
    end: 185,
    width: 22,
    hasMedian: true,
    speedLimitKmh: 55,
    description: 'Southern CBD artery passing Times Tower, Central Bank, Railways Station, and Muthurwa.',
  },
  {
    id: 'mombasa-langata',
    name: "Mombasa / Lang'ata Road",
    swahiliTag: 'Barabara ya Mombasa',
    axis: 'ew',
    coord: 220,
    start: -225,
    end: 215,
    width: 26,
    hasMedian: true,
    speedLimitKmh: 80,
    description: 'Southern highway corridor curving past Nyayo National Stadium toward JKIA and Wilson Airport.',
  },
];

export const NAIROBI_ROUNDABOUTS: Roundabout[] = [
  {
    id: 'rb-kenyatta',
    name: 'Kenyatta Ave Roundabout',
    x: -95,
    z: -45,
    outerRadius: 21,
    islandRadius: 8.5,
  },
  {
    id: 'rb-haile',
    name: 'Haile Selassie Roundabout',
    x: -95,
    z: 115,
    outerRadius: 20,
    islandRadius: 8,
  },
  {
    id: 'rb-nyayo',
    name: 'Nyayo Stadium (Bunyala) Roundabout',
    x: -95,
    z: 220,
    outerRadius: 23,
    islandRadius: 9.5,
  },
  {
    id: 'rb-globe',
    name: 'Globe Cinema / Univ. Way Roundabout',
    x: 55,
    z: -180,
    outerRadius: 18,
    islandRadius: 7,
  },
  {
    id: 'rb-railways',
    name: 'Railways Roundabout',
    x: 55,
    z: 115,
    outerRadius: 18,
    islandRadius: 7,
  },
];

export const NAIROBI_LANDMARKS: NairobiLandmark[] = [
  {
    id: 'kicc',
    name: 'KICC (Kenyatta Int. Convention Centre)',
    shortName: 'KICC Tower',
    district: 'City Square',
    street: 'City Hall Way / Harambee Ave',
    x: -18,
    z: 10,
    waypointX: -18,
    waypointZ: 35,
    colliderHalfW: 16,
    colliderHalfD: 16,
    height: 76,
    color: '#c26d47',
    summary: '28-story terracotta cylindrical tower & conical amphitheater—Nairobi’s most recognizable skyline anchor.',
    wayfindingTip: 'Turn off Uhuru Highway onto Kenyatta Ave or City Hall Way; the terracotta cylinder is visible from anywhere in CBD.',
    lat: -1.2886,
    lng: 36.8233,
  },
  {
    id: 'times-tower',
    name: 'Times Tower (KRA Headquarters)',
    shortName: 'Times Tower',
    district: 'Southern CBD',
    street: 'Haile Selassie Avenue',
    x: -22,
    z: 80,
    waypointX: -22,
    waypointZ: 110,
    colliderHalfW: 14,
    colliderHalfD: 14,
    height: 92,
    color: '#38bdf8',
    summary: 'Stepped glass-and-granite skyscraper rising 140m above Haile Selassie Avenue.',
    wayfindingTip: 'Head south on Uhuru Highway to Haile Selassie Roundabout, then turn east toward Moi Avenue.',
    lat: -1.2904,
    lng: 36.8242,
  },
  {
    id: 'parliament',
    name: 'Parliament Buildings & Clock Tower',
    shortName: 'Parliament',
    district: 'Parliament Road',
    street: 'City Hall Way / Parliament Rd',
    x: -58,
    z: 10,
    waypointX: -58,
    waypointZ: 35,
    colliderHalfW: 14,
    colliderHalfD: 14,
    height: 44,
    color: '#e7dec8',
    summary: 'Kenya’s legislative complex featuring the illuminated stone Clock Tower and copper-green roof.',
    wayfindingTip: 'Located directly between Uhuru Highway and KICC along City Hall Way.',
    lat: -1.2896,
    lng: 36.8199,
  },
  {
    id: 'uhuru-park',
    name: 'Uhuru Park & Nyayo Monument',
    shortName: 'Uhuru Park',
    district: 'West CBD Edge',
    street: 'Uhuru Highway / Kenyatta Ave',
    x: -146,
    z: 18,
    waypointX: -102,
    waypointZ: 18,
    colliderHalfW: 6,
    colliderHalfD: 6,
    height: 28,
    color: '#10b981',
    summary: 'Iconic recreational park with boating lake, jacaranda groves, and the central marble obelisk.',
    wayfindingTip: 'Borders the entire western side of Uhuru Highway between Kenyatta Ave and Haile Selassie.',
    lat: -1.2901,
    lng: 36.8159,
  },
  {
    id: 'nyayo-stadium',
    name: 'Nyayo National Stadium',
    shortName: 'Nyayo Stadium',
    district: 'Bunyala / Mombasa Rd',
    street: "Uhuru Hwy / Lang'ata Rd",
    x: -158,
    z: 256,
    waypointX: -95,
    waypointZ: 220,
    colliderHalfW: 32,
    colliderHalfD: 22,
    height: 22,
    color: '#ef4444',
    summary: '30,000-seat national sports arena anchoring the southern gateway where Uhuru Hwy meets Mombasa Road.',
    wayfindingTip: 'Take Uhuru Highway straight south beneath the Nairobi Expressway to the Bunyala / Nyayo Roundabout.',
    lat: -1.3041,
    lng: 36.8244,
  },
  {
    id: 'archives',
    name: 'Kenya National Archives',
    shortName: 'National Archives',
    district: 'Downtown CBD',
    street: 'Moi Avenue',
    x: 82,
    z: -12,
    waypointX: 55,
    waypointZ: -12,
    colliderHalfW: 13,
    colliderHalfD: 15,
    height: 22,
    color: '#f59e0b',
    summary: 'Famous downtown rendezvous point on Moi Avenue opposite Hilton Hotel, facing Tom Mboya Street.',
    wayfindingTip: 'Drive east along Kenyatta Avenue to Moi Avenue and turn right (south).',
    lat: -1.2849,
    lng: 36.8261,
  },
  {
    id: 'railway-station',
    name: 'Nairobi Railway Station',
    shortName: 'Railways Station',
    district: 'Railways',
    street: 'Moi Ave / Haile Selassie',
    x: 68,
    z: 156,
    waypointX: 55,
    waypointZ: 122,
    colliderHalfW: 20,
    colliderHalfD: 14,
    height: 18,
    color: '#b91c1c',
    summary: '1899 red-roofed colonial rail terminus at the southern end of Moi Avenue.',
    wayfindingTip: 'Follow Moi Avenue south to the Haile Selassie Roundabout.',
    lat: -1.2909,
    lng: 36.8286,
  },
  {
    id: 'afya-centre',
    name: 'Afya Centre',
    shortName: 'Afya Centre',
    district: 'Eastern CBD',
    street: 'Tom Mboya St / Haile Selassie',
    x: 162,
    z: 86,
    waypointX: 135,
    waypointZ: 86,
    colliderHalfW: 13,
    colliderHalfD: 13,
    height: 54,
    color: '#16a34a',
    summary: 'Distinctive green-and-gold cylindrical tower marking the major eastern matatu terminus.',
    wayfindingTip: 'Head east on Haile Selassie Ave past Moi Avenue to reach Tom Mboya Street.',
    lat: -1.2889,
    lng: 36.8295,
  },
  {
    id: 'jamia-mosque',
    name: 'Jamia Mosque',
    shortName: 'Jamia Mosque',
    district: 'Central CBD',
    street: 'Banda St / Kenyatta Ave',
    x: 14,
    z: -95,
    waypointX: 14,
    waypointZ: -50,
    colliderHalfW: 16,
    colliderHalfD: 14,
    height: 30,
    color: '#e2e8f0',
    summary: 'Historic white-marble mosque with silver domes and twin minarets just north of Kenyatta Avenue.',
    wayfindingTip: 'One block north of Kenyatta Avenue between Uhuru Highway and Moi Avenue.',
    lat: -1.2836,
    lng: 36.8211,
  },
  {
    id: 'uon-towers',
    name: 'University of Nairobi Towers',
    shortName: 'UoN Towers',
    district: 'University Way',
    street: 'University Way / Harry Thuku',
    x: -28,
    z: -215,
    waypointX: -28,
    waypointZ: -180,
    colliderHalfW: 16,
    colliderHalfD: 14,
    height: 62,
    color: '#64748b',
    summary: 'Modern high-rise academic tower overlooking Central Park and University Way.',
    wayfindingTip: 'Turn east off Uhuru Highway onto University Way toward Globe Roundabout.',
    lat: -1.2797,
    lng: 36.8171,
  },
];

/** Ordered circuit race route showcasing Nairobi's signature roads & landmarks */
export const CIRCUIT_CHECKPOINT_IDS: string[] = [
  'kicc',
  'archives',
  'afya-centre',
  'times-tower',
  'nyayo-stadium',
  'uhuru-park',
];

export const FINISH_LINE = {
  id: 'finish-line',
  name: 'Nairobi GP Finish Line',
  shortName: 'Finish Line',
  district: 'Uhuru Hwy Home Straight',
  street: 'Uhuru Highway (A104)',
  x: -95,
  z: -14,
  heading: 0, // Northbound (-Z) toward Kenyatta Ave Roundabout
} as const;

export const FINISH_LINE_LANDMARK: NairobiLandmark = {
  id: FINISH_LINE.id,
  name: FINISH_LINE.name,
  shortName: FINISH_LINE.shortName,
  district: FINISH_LINE.district,
  street: FINISH_LINE.street,
  x: FINISH_LINE.x,
  z: FINISH_LINE.z,
  waypointX: FINISH_LINE.x,
  waypointZ: FINISH_LINE.z,
  colliderHalfW: 0,
  colliderHalfD: 0,
  height: 9,
  color: '#10b981',
  summary: 'Checkered Nairobi Grand Prix Finishing Arch spanning Uhuru Highway.',
  wayfindingTip: 'Sprint north up Uhuru Highway past Uhuru Park to cross the checkered Finish Line.',
  lat: -1.2874,
  lng: 36.8172,
};

export function isAtFinishLine(x: number, z: number): boolean {
  return Math.abs(x - FINISH_LINE.x) <= 16 && Math.abs(z - FINISH_LINE.z) <= 13;
}

export const PLAYER_SPAWN = {
  x: -168,
  z: -50.5, // Left-hand eastbound lane of Kenyatta Avenue
  heading: Math.PI / 2, // Facing +X (East down Kenyatta Ave toward Uhuru Hwy & KICC)
};

export interface VehiclePreset {
  id: 'rally' | 'nganya' | 'safari';
  name: string;
  subtitle: string;
  plate: string;
  maxSpeed: number; // m/s (game units/s) -> kmh = speed * 3.6
  accel: number;
  handling: number;
  driftGrip: number;
  primaryColor: number;
  accentColor: number;
  badgeColor: string;
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'rally',
    name: 'Safari Rally GT',
    subtitle: 'Twin-turbo AWD tarmac coupe · 230 km/h',
    plate: 'KDR 254N',
    maxSpeed: 64,
    accel: 46,
    handling: 2.95,
    driftGrip: 0.9,
    primaryColor: 0xea580c,
    accentColor: 0xfacc15,
    badgeColor: '#ea580c',
  },
  {
    id: 'nganya',
    name: 'Nganya 111 Turbo',
    subtitle: 'Widebody Nairobi street matatu · High Nitro',
    plate: 'KDM 111G',
    maxSpeed: 59,
    accel: 42,
    handling: 2.55,
    driftGrip: 0.84,
    primaryColor: 0xf59e0b,
    accentColor: 0x06b6d4,
    badgeColor: '#f59e0b',
  },
  {
    id: 'safari',
    name: 'Savannah V8 Cruiser',
    subtitle: 'Armored twin-V8 diplomatic interceptor',
    plate: 'KDL 001A',
    maxSpeed: 57,
    accel: 44,
    handling: 2.65,
    driftGrip: 0.88,
    primaryColor: 0x059669,
    accentColor: 0xf8fafc,
    badgeColor: '#10b981',
  },
];

/** Static urban blocks (solid AABB colliders) positioned cleanly inside city blocks, never blocking roads */
export const CBD_BUILDING_BLOCKS: BuildingCollider[] = [
  // North-West block (between Uhuru Hwy x=-95, Moi x=55, Univ Way z=-180, Kenyatta z=-45)
  { id: 'blk-teleposta', x: -55, z: -95, halfW: 16, halfD: 16, height: 68, label: 'Teleposta Towers' },
  { id: 'blk-nation', x: -18, z: -135, halfW: 16, halfD: 15, height: 52, label: 'Nation Centre' },
  { id: 'blk-hazina', x: 18, z: -140, halfW: 14, halfD: 14, height: 48, label: 'Hazina Towers' },
  { id: 'blk-jamia', x: 14, z: -95, halfW: 16, halfD: 14, height: 28, label: 'Jamia Mosque' },
  { id: 'blk-serena', x: -148, z: -102, halfW: 18, halfD: 16, height: 24, label: 'Nairobi Serena' },

  // North-East block (between Moi x=55, Tom Mboya x=135, Univ Way z=-180, Kenyatta z=-45)
  { id: 'blk-khoja', x: 95, z: -145, halfW: 15, halfD: 15, height: 26, label: 'Khoja Mosque' },
  { id: 'blk-odeon', x: 95, z: -95, halfW: 16, halfD: 16, height: 34, label: 'Odeon Corner' },

  // Central CBD block (between Kenyatta z=-45, City Hall z=35, Uhuru x=-95, Moi x=55)
  { id: 'blk-parliament', x: -58, z: 10, halfW: 14, halfD: 14, height: 40, label: 'Parliament' },
  { id: 'blk-kicc', x: -18, z: 10, halfW: 16, halfD: 16, height: 74, label: 'KICC' },
  { id: 'blk-cityhall', x: 18, z: 5, halfW: 13, halfD: 13, height: 26, label: 'City Hall' },

  // East CBD block (between Kenyatta z=-45, City Hall z=35, Moi x=55, Tom Mboya x=135)
  { id: 'blk-archives', x: 88, z: -12, halfW: 13, halfD: 15, height: 24, label: 'National Archives' },
  { id: 'blk-hilton', x: 100, z: 15, halfW: 14, halfD: 12, height: 38, label: 'Hilton Plaza' },

  // South CBD block (between City Hall z=35, Haile Selassie z=115, Uhuru x=-95, Moi x=55)
  { id: 'blk-nyayohouse', x: -62, z: 75, halfW: 14, halfD: 14, height: 58, label: 'Nyayo House' },
  { id: 'blk-times', x: -22, z: 80, halfW: 14, halfD: 14, height: 90, label: 'Times Tower' },
  { id: 'blk-cbk', x: 18, z: 78, halfW: 15, halfD: 15, height: 42, label: 'Central Bank' },

  // South-East block (Moi x=55, Tom Mboya x=135, City Hall z=35, Haile Selassie z=115)
  { id: 'blk-cooperative', x: 95, z: 78, halfW: 15, halfD: 15, height: 50, label: 'Co-op House' },
  { id: 'blk-afya', x: 165, z: 86, halfW: 13, halfD: 13, height: 54, label: 'Afya Centre' },

  // North of University Way & South of Haile Selassie
  { id: 'blk-uon', x: -28, z: -215, halfW: 16, halfD: 14, height: 60, label: 'UoN Towers' },
  { id: 'blk-railways', x: 68, z: 158, halfW: 20, halfD: 14, height: 18, label: 'Railway Station' },
  { id: 'blk-nyayo-stadium', x: -158, z: 256, halfW: 32, halfD: 22, height: 22, label: 'Nyayo Stadium' },
];

/** Expressway concrete viaduct pier colliders along x = -122 */
export const EXPRESSWAY_PIERS: BuildingCollider[] = (() => {
  const piers: BuildingCollider[] = [];
  for (let z = -220; z <= 185; z += 45) {
    // Skip exact street intersections so Kenyatta Ave (-45), Univ Way (-180), Haile Selassie (115) remain wide open
    if (Math.abs(z - -45) < 18 || Math.abs(z - -180) < 18 || Math.abs(z - 115) < 18) {
      continue;
    }
    piers.push({
      id: `pier-${z}`,
      x: -122,
      z,
      halfW: 2.2,
      halfD: 2.2,
      height: 8.5,
    });
  }
  return piers;
})();

export const ALL_OBSTACLE_COLLIDERS: BuildingCollider[] = [
  ...CBD_BUILDING_BLOCKS,
  ...EXPRESSWAY_PIERS,
];

/**
 * Ordered street waypoints guiding AI racers cleanly around Nairobi's 6-checkpoint CBD circuit.
 * Avoids all building footprints and skirts roundabouts cleanly.
 */
export const CIRCUIT_RACING_WAYPOINTS: Array<{
  x: number;
  z: number;
  checkpointId?: string;
  isFinishLine?: boolean;
  maxSpeed?: number;
}> = [
  // Start on Kenyatta Ave heading East past Uhuru Hwy roundabout
  { x: -118, z: -50.5, maxSpeed: 54 },
  { x: -95, z: -61, maxSpeed: 36 }, // Skirts north edge of Kenyatta roundabout
  { x: -68, z: -49, maxSpeed: 56 },
  { x: 52, z: -49, maxSpeed: 42 }, // Fast blast down Kenyatta Ave to Moi Ave
  { x: 52, z: 32, maxSpeed: 38 }, // Turn south onto Moi Ave -> City Hall Way
  { x: -18, z: 35, checkpointId: 'kicc', maxSpeed: 44 }, // Checkpoint 1: KICC!
  { x: 55, z: 32, maxSpeed: 42 }, // Back east to Moi Ave
  { x: 55, z: -12, checkpointId: 'archives', maxSpeed: 48 }, // Checkpoint 2: National Archives!
  { x: 58, z: -45, maxSpeed: 38 },
  { x: 132, z: -42, maxSpeed: 42 }, // East to Tom Mboya Street
  { x: 135, z: 86, checkpointId: 'afya-centre', maxSpeed: 45 }, // Checkpoint 3: Afya Centre!
  { x: 132, z: 115, maxSpeed: 38 },
  { x: 65, z: 112, maxSpeed: 36 },
  { x: -22, z: 110, checkpointId: 'times-tower', maxSpeed: 50 }, // Checkpoint 4: Times Tower!
  { x: -78, z: 112, maxSpeed: 35 },
  { x: -95, z: 132, maxSpeed: 48 }, // Turn south onto Uhuru Highway
  { x: -95, z: 200, maxSpeed: 56 },
  { x: -95, z: 220, checkpointId: 'nyayo-stadium', maxSpeed: 36 }, // Checkpoint 5: Nyayo Stadium!
  { x: -78, z: 215, maxSpeed: 35 },
  { x: -90, z: 132, maxSpeed: 54 }, // Blast North up Uhuru Highway!
  { x: -80, z: 115, maxSpeed: 38 },
  { x: -95, z: 18, checkpointId: 'uhuru-park', maxSpeed: 56 }, // Checkpoint 6: Uhuru Park!
  { x: FINISH_LINE.x, z: FINISH_LINE.z, isFinishLine: true, maxSpeed: 62 }, // Checkered Finish Line on Uhuru Hwy!
];

/**
 * Finds a safe, open road coordinate and heading near `(x, z)` facing toward `(targetX, targetZ)`
 * for instant Track Recovery (`[R]`).
 */
export function findNearestStreetPose(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
): { x: number; z: number; heading: number } {
  let bestX = PLAYER_SPAWN.x;
  let bestZ = PLAYER_SPAWN.z;
  let bestDist = Infinity;

  for (const s of NAIROBI_STREETS) {
    if (s.axis === 'ns') {
      const clampedZ = Math.max(s.start + 12, Math.min(s.end - 12, z));
      const d = Math.hypot(x - s.coord, z - clampedZ);
      if (d < bestDist) {
        bestDist = d;
        bestX = s.coord;
        bestZ = clampedZ;
      }
    } else {
      const clampedX = Math.max(s.start + 12, Math.min(s.end - 12, x));
      const d = Math.hypot(x - clampedX, z - s.coord);
      if (d < bestDist) {
        bestDist = d;
        bestX = clampedX;
        bestZ = s.coord;
      }
    }
  }

  // Nudge out of any roundabout central island
  for (const rb of NAIROBI_ROUNDABOUTS) {
    const dx = bestX - rb.x;
    const dz = bestZ - rb.z;
    const d = Math.hypot(dx, dz);
    if (d < rb.islandRadius + 4) {
      const ang = d > 0.01 ? Math.atan2(dz, dx) : 0;
      bestX = rb.x + Math.cos(ang) * (rb.islandRadius + 5.5);
      bestZ = rb.z + Math.sin(ang) * (rb.islandRadius + 5.5);
    }
  }

  const heading = Math.atan2(targetX - bestX, -(targetZ - bestZ));
  return { x: bestX, z: bestZ, heading };
}

/**
 * Determine which Nairobi street or roundabout the player is currently on.
 */
export function getStreetNameAt(x: number, z: number): string {
  for (const rb of NAIROBI_ROUNDABOUTS) {
    const dx = x - rb.x;
    const dz = z - rb.z;
    if (dx * dx + dz * dz <= (rb.outerRadius + 4) * (rb.outerRadius + 4)) {
      return rb.name;
    }
  }

  let bestName = 'Nairobi CBD';
  let bestDist = Infinity;

  for (const s of NAIROBI_STREETS) {
    if (s.axis === 'ns') {
      if (z >= s.start - 10 && z <= s.end + 10) {
        const d = Math.abs(x - s.coord);
        if (d <= s.width * 0.72 && d < bestDist) {
          bestDist = d;
          bestName = s.name;
        }
      }
    } else {
      if (x >= s.start - 10 && x <= s.end + 10) {
        const d = Math.abs(z - s.coord);
        if (d <= s.width * 0.72 && d < bestDist) {
          bestDist = d;
          bestName = s.name;
        }
      }
    }
  }

  if (bestName === 'Nairobi CBD') {
    if (x < -115 && z > -150 && z < 110) return 'Uhuru Park Grounds';
    if (x < -115 && z <= -150) return 'Central Park / Museum Hill';
    if (z > 130 && x > -80 && x < 40) return 'Railways Golf & Station Yard';
  }
  return bestName;
}

export function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Computes live turn-by-turn Nairobi GPS guidance toward a chosen landmark.
 * Heading convention: 0 = North (-Z), +PI/2 = East (+X), PI = South (+Z), -PI/2 = West (-X).
 */
export function computeWayfindingGuidance(
  x: number,
  z: number,
  heading: number,
  target: NairobiLandmark,
): WayfindingGuidance {
  const currentStreet = getStreetNameAt(x, z);
  const dx = target.waypointX - x;
  const dz = target.waypointZ - z;
  const distanceMeters = Math.hypot(dx, dz);
  const arrived = distanceMeters <= 25;

  // Target bearing in same heading convention: atan2(dx, -dz)
  const targetBearing = Math.atan2(dx, -dz);
  const bearingDeltaRad = normalizeAngle(targetBearing - heading);

  // Pick a helpful next street clue based on dominant axis difference
  let nextTurnStreet = target.street;
  let distToTurnMeters = distanceMeters;

  if (Math.abs(dx) > 25 && Math.abs(dz) > 25) {
    // Recommend aligning with major N-S or E-W corridor first
    if (Math.abs(dx) > Math.abs(dz)) {
      const nearestEw = NAIROBI_STREETS.filter((s) => s.axis === 'ew').reduce((best, s) =>
        Math.abs(s.coord - z) < Math.abs(best.coord - z) ? s : best,
      );
      nextTurnStreet = nearestEw.name;
      distToTurnMeters = Math.max(10, Math.abs(dx));
    } else {
      const nearestNs = NAIROBI_STREETS.filter((s) => s.axis === 'ns').reduce((best, s) =>
        Math.abs(s.coord - x) < Math.abs(best.coord - x) ? s : best,
      );
      nextTurnStreet = nearestNs.name;
      distToTurnMeters = Math.max(10, Math.abs(dz));
    }
  }

  let instruction = `Continue straight toward ${target.shortName}`;
  if (arrived) {
    instruction = `Arrived at ${target.shortName}`;
  } else if (bearingDeltaRad > 0.45 && bearingDeltaRad < 2.4) {
    instruction = `Bear right toward ${nextTurnStreet}`;
  } else if (bearingDeltaRad < -0.45 && bearingDeltaRad > -2.4) {
    instruction = `Bear left toward ${nextTurnStreet}`;
  } else if (Math.abs(bearingDeltaRad) >= 2.4) {
    instruction = `U-turn toward ${target.shortName}`;
  }

  return {
    currentStreet,
    targetLandmark: target,
    distanceMeters,
    bearingDeltaRad,
    instruction,
    nextTurnStreet,
    distToTurnMeters,
    arrived,
  };
}
