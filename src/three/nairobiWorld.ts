import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import {
  CBD_BUILDING_BLOCKS,
  CIRCUIT_RACING_WAYPOINTS,
  EXPRESSWAY_PIERS,
  FINISH_LINE,
  NAIROBI_LANDMARKS,
  NAIROBI_ROUNDABOUTS,
  NAIROBI_STREETS,
} from '../game/nairobiMap';
import type { SignalPhase } from '../game/traffic';
import { getWeatherProfile, type WeatherCondition } from '../game/weather';
import type { NairobiTexturePack } from './textures';

export interface SignalLightSet {
  nsRed: THREE.MeshStandardMaterial;
  nsAmber: THREE.MeshStandardMaterial;
  nsGreen: THREE.MeshStandardMaterial;
  ewRed: THREE.MeshStandardMaterial;
  ewAmber: THREE.MeshStandardMaterial;
  ewGreen: THREE.MeshStandardMaterial;
}

export interface ParticleState {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  r: number;
  g: number;
  b: number;
}

export interface NairobiWorldHandle {
  sunLight: THREE.DirectionalLight;
  beaconGroup: THREE.Group;
  beaconRing: THREE.Mesh;
  updateSignals: (signal: SignalPhase) => void;
  updateStartLights: (countdownStage: number, active: boolean) => void;
  updateExpresswayTraffic: (dt: number) => void;
  spawnSkidmark: (x: number, z: number, heading: number) => void;
  spawnParticle: (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    scale: number,
    life: number,
    r: number,
    g: number,
    b: number,
  ) => void;
  updateParticles: (dt: number) => void;
  updateRouteChevrons: (elapsed: number, visible: boolean) => void;
  updateWeather: (condition: WeatherCondition, focusX: number, focusZ: number, dt: number) => void;
  setBeaconPosition: (x: number, z: number, elapsed: number) => void;
  setFinishLineActive: (active: boolean, elapsed: number) => void;
  dispose: () => void;
}

const PARTICLE_POOL_SIZE = 180;
const SKID_POOL_SIZE = 320;
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyEuler = new THREE.Euler();
const _dummyScale = new THREE.Vector3();
const _dummyColor = new THREE.Color();

export function buildNairobiWorld(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  textures: NairobiTexturePack,
  isSoftwareGl: boolean,
): NairobiWorldHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // 1. Studio Environment Map & Golden-Hour Nairobi Sky
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmremGenerator.dispose();
  disposables.push(envRT);

  const sky = new Sky();
  // Keep the atmospheric dome inside NairobiCanvas's camera far plane;
  // otherwise the city silently falls back to the flat fog-color background.
  sky.scale.setScalar(1800);
  scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 6.2;
  skyUniforms['rayleigh'].value = 2.1;
  skyUniforms['mieCoefficient'].value = 0.0055;
  skyUniforms['mieDirectionalG'].value = 0.84;

  const sunVec = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - 17); // Rich Nairobi golden-hour sun elevation
  const theta = THREE.MathUtils.degToRad(142);
  sunVec.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunVec);

  const sceneFog = new THREE.FogExp2(0xd5c5b8, 0.00135);
  scene.fog = sceneFog;
  scene.background = sceneFog.color;

  const hemi = new THREE.HemisphereLight(0x88b4e8, 0x4b4036, 1.15);
  hemi.position.set(0, 90, 0);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xffcf99, 2.75);
  sunLight.position.copy(sunVec).multiplyScalar(220);
  sunLight.castShadow = !isSoftwareGl;
  const shadowSize = isSoftwareGl ? 512 : Math.min(2048, renderer.capabilities.maxTextureSize);
  sunLight.shadow.mapSize.set(shadowSize, shadowSize);
  const d = 135;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.near = 20;
  sunLight.shadow.camera.far = 420;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Cool sky-side fill keeps shaded cars, windows and street furniture readable
  // against the warm late-afternoon key light, without flattening their shape.
  const cityFill = new THREE.DirectionalLight(0x9dcfff, 0.42);
  cityFill.position.set(-sunVec.x * 150, 78, -sunVec.z * 150);
  scene.add(cityFill);
  scene.add(cityFill.target);

  // 2. Textured Ground Basin & Distant Ngong Hills Horizon Ring
  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.grassMap,
      bumpMap: textures.grassBump,
      bumpScale: 0.12,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );

  const basinGeo = trackGeo(new THREE.CircleGeometry(980, 48));
  basinGeo.rotateX(-Math.PI / 2);
  const basin = new THREE.Mesh(basinGeo, grassMat);
  basin.position.y = -0.22;
  basin.receiveShadow = true;
  scene.add(basin);

  const hillMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x324c3a, roughness: 0.94, metalness: 0 }),
  );
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const dist = 620 + (i % 3) * 65;
    const h = 48 + (i % 4) * 28;
    const r = 120 + (i % 3) * 42;
    const hill = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(r, h, 9)), hillMat);
    hill.position.set(Math.cos(ang) * dist, h * 0.4 - 4, Math.sin(ang) * dist);
    hill.scale.set(1.65, 1, 1.15);
    hill.rotation.y = ang;
    scene.add(hill);
  }

  // CBD Interlocking Cabro Sidewalk Ground Slab
  const cbdSlabGeo = trackGeo(new THREE.PlaneGeometry(520, 560));
  cbdSlabGeo.rotateX(-Math.PI / 2);
  const cbdSlabMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.sidewalkMap,
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  const cbdSlab = new THREE.Mesh(cbdSlabGeo, cbdSlabMat);
  cbdSlab.position.set(-5, -0.02, 15);
  cbdSlab.receiveShadow = true;
  scene.add(cbdSlab);

  // 3. Uhuru Park Textured Turf + Boating Lake + Nyayo Monument
  const uhuruParkMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(118, 290)), grassMat);
  uhuruParkMesh.rotation.x = -Math.PI / 2;
  uhuruParkMesh.position.set(-168, 0.012, -15);
  uhuruParkMesh.receiveShadow = true;
  scene.add(uhuruParkMesh);

  const lakeGeo = trackGeo(new THREE.CircleGeometry(28, 28));
  lakeGeo.rotateX(-Math.PI / 2);
  const lakeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 0.95,
    }),
  );
  const lake = new THREE.Mesh(lakeGeo, lakeMat);
  lake.scale.set(0.85, 1, 1.55);
  lake.position.set(-166, 0.04, 24);
  scene.add(lake);

  const monumentBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(5, 6.5, 1.6, 8)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.7 })),
  );
  monumentBase.position.set(-146, 0.8, 18);
  const obelisk = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.6, 1.6, 22, 4)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.4 })),
  );
  obelisk.position.set(-146, 12.5, 18);
  obelisk.rotation.y = Math.PI / 4;
  obelisk.castShadow = true;
  scene.add(monumentBase, obelisk);

  // 4. Nairobi Asphalt Street Network + Yellow/Black Curbs + Dashed Lane Markings
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.asphaltMap,
      bumpMap: textures.asphaltBump,
      bumpScale: 0.09,
      color: 0xffffff,
      roughness: 0.76,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const yellowLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const whiteLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.curbMap,
      color: 0xffffff,
      roughness: 0.65,
    }),
  );
  const medianTurfMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.grassMap,
      color: 0xd9f99d,
      roughness: 0.88,
    }),
  );

  const dashPositions: Array<{ x: number; z: number; ns: boolean }> = [];

  for (const s of NAIROBI_STREETS) {
    const length = s.end - s.start;
    const center = (s.start + s.end) * 0.5;
    const w = s.axis === 'ns' ? s.width : length;
    const dLen = s.axis === 'ns' ? length : s.width;

    const roadGeo = trackGeo(new THREE.PlaneGeometry(w, dLen));
    roadGeo.rotateX(-Math.PI / 2);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(s.axis === 'ns' ? s.coord : center, 0.03, s.axis === 'ns' ? center : s.coord);
    road.receiveShadow = true;
    scene.add(road);

    // Center double yellow / white line
    const lineMat = s.hasMedian ? yellowLineMat : whiteLineMat;
    const lineGeo = trackGeo(
      new THREE.PlaneGeometry(s.axis === 'ns' ? 0.34 : length, s.axis === 'ns' ? length : 0.34),
    );
    lineGeo.rotateX(-Math.PI / 2);
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(s.axis === 'ns' ? s.coord : center, 0.055, s.axis === 'ns' ? center : s.coord);
    scene.add(line);

    // Dashed inner lane stripes for multi-lane realism
    if (s.width >= 20) {
      const laneHalf = s.width * 0.25;
      for (let p = s.start + 14; p <= s.end - 14; p += 11) {
        if (s.axis === 'ns') {
          dashPositions.push({ x: s.coord - laneHalf, z: p, ns: true });
          dashPositions.push({ x: s.coord + laneHalf, z: p, ns: true });
        } else {
          dashPositions.push({ x: p, z: s.coord - laneHalf, ns: false });
          dashPositions.push({ x: p, z: s.coord + laneHalf, ns: false });
        }
      }
    }

    const curbOffset = s.width * 0.5 + 0.3;
    for (const side of [-1, 1]) {
      const cw = s.axis === 'ns' ? 0.5 : length;
      const cd = s.axis === 'ns' ? length : 0.5;
      const curb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cw, 0.18, cd)), curbMat);
      curb.position.set(
        s.axis === 'ns' ? s.coord + side * curbOffset : center,
        0.09,
        s.axis === 'ns' ? center : s.coord + side * curbOffset,
      );
      scene.add(curb);
    }
  }

  // Instanced dashed lane markings
  const dashGeo = trackGeo(new THREE.PlaneGeometry(0.22, 4.4));
  dashGeo.rotateX(-Math.PI / 2);
  const dashInst = new THREE.InstancedMesh(dashGeo, whiteLineMat, Math.max(1, dashPositions.length));
  dashPositions.forEach((dp, i) => {
    _dummyPos.set(dp.x, 0.056, dp.z);
    _dummyEuler.set(0, dp.ns ? 0 : Math.PI / 2, 0);
    _dummyQuat.setFromEuler(_dummyEuler);
    _dummyScale.setScalar(1);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    dashInst.setMatrixAt(i, _dummyMatrix);
  });
  dashInst.instanceMatrix.needsUpdate = true;
  dashInst.computeBoundingSphere();
  scene.add(dashInst);

  // Zebra pedestrian crossings at major CBD intersections
  const majorX = [-95, 55, 135];
  const majorZ = [-180, -45, 35, 115, 220];
  const zebraGeo = trackGeo(new THREE.PlaneGeometry(1.1, 3.4));
  zebraGeo.rotateX(-Math.PI / 2);
  for (const ix of majorX) {
    for (const iz of majorZ) {
      if (ix === 135 && iz === 220) continue;
      for (let s = -6; s <= 6; s += 2.2) {
        const z1 = new THREE.Mesh(zebraGeo, whiteLineMat);
        z1.position.set(ix + s, 0.058, iz - 15);
        const z2 = new THREE.Mesh(zebraGeo, whiteLineMat);
        z2.position.set(ix + s, 0.058, iz + 15);
        scene.add(z1, z2);
      }
    }
  }

  // 4B. Kenyatta Avenue Checkered Start / Finish Racing Arch + 5 Race Countdown Light Pods
  const gantrySteelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.32, metalness: 0.78 }),
  );
  const startLightMats: THREE.MeshStandardMaterial[] = [];
  {
    const sg = new THREE.Group();
    const postL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.35, 7.6, 8)), gantrySteelMat);
    postL.position.set(0, 3.8, -11.5);
    const postR = postL.clone();
    postR.position.z = 11.5;

    const bannerMat = trackMat(
      new THREE.MeshStandardMaterial({ map: textures.checkeredMap, roughness: 0.35, metalness: 0.2 }),
    );
    const banner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 2.2, 23)), bannerMat);
    banner.position.set(0, 7.0, 0);

    // Asphalt checkered start strip right under the arch
    const stripGeo = trackGeo(new THREE.PlaneGeometry(3.2, 22));
    stripGeo.rotateX(-Math.PI / 2);
    const strip = new THREE.Mesh(
      stripGeo,
      trackMat(
        new THREE.MeshStandardMaterial({
          map: textures.checkeredMap,
          roughness: 0.55,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      ),
    );
    strip.position.set(0, 0.06, 0);

    // 5 Race Countdown Lights facing the starting grid (-X)
    const housing = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.65, 1.1, 6.2)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })),
    );
    housing.position.set(0, 5.4, 0);
    sg.add(postL, postR, banner, strip, housing);

    for (let li = 0; li < 5; li++) {
      const lm = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x270909,
          emissive: 0xef4444,
          emissiveIntensity: 0.1,
          roughness: 0.2,
        }),
      );
      startLightMats.push(lm);
      const bulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.32, 10, 10)), lm);
      bulb.position.set(-0.35, 5.4, -2.0 + li * 1.0);
      sg.add(bulb);
    }

    sg.position.set(-148, 0, -45);
    scene.add(sg);
  }

  // 4C. Dedicated Nairobi GP Checkered FINISHING LINE Arch & Tarmac Strip (Uhuru Highway Northbound Home Straight)
  const finishLampMats: THREE.MeshStandardMaterial[] = [];
  const finishPillarMats: THREE.MeshStandardMaterial[] = [];
  {
    const fg = new THREE.Group();
    const towerMat = trackMat(
      new THREE.MeshStandardMaterial({ map: textures.checkeredMap, roughness: 0.4, metalness: 0.2 }),
    );
    const towerL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 8.2, 1.4)), towerMat);
    towerL.position.set(-13.2, 4.1, 0);
    towerL.castShadow = true;
    const towerR = towerL.clone();
    towerR.position.x = 13.2;
    fg.add(towerL, towerR);

    // Emerald & Gold Finish Pylons with glowing strips
    const fStripMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.9,
        roughness: 0.25,
      }),
    );
    finishPillarMats.push(fStripMat);
    const glowL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 7.6, 1.55)), fStripMat);
    glowL.position.set(-12.3, 3.8, 0);
    const glowR = glowL.clone();
    glowR.position.x = 12.3;
    fg.add(glowL, glowR);

    // Overhead Double-Sided FINISH LINE · NAIROBI GP Checkered Banner
    const finBannerMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.finishBannerMap,
        emissive: 0x064e3b,
        emissiveIntensity: 0.35,
        roughness: 0.32,
      }),
    );
    const finBanner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.6, 2.7, 0.7)), finBannerMat);
    finBanner.position.set(0, 7.6, 0);
    fg.add(finBanner);

    // 5 Emerald/Gold Finish Arch Beacons across top truss
    for (let i = -2; i <= 2; i++) {
      const flMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x064e3b,
          emissive: i % 2 === 0 ? 0x34d399 : 0xfacc15,
          emissiveIntensity: 0.6,
          roughness: 0.2,
        }),
      );
      finishLampMats.push(flMat);
      const lamp = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 10, 10)), flMat);
      lamp.position.set(i * 4.5, 9.25, 0);
      fg.add(lamp);
    }

    // Crisp Checkered Tarmac Finish Strip across all lanes of Uhuru Highway
    const finStripGeo = trackGeo(new THREE.PlaneGeometry(25, 4.2));
    finStripGeo.rotateX(-Math.PI / 2);
    const finStrip = new THREE.Mesh(
      finStripGeo,
      trackMat(
        new THREE.MeshStandardMaterial({
          map: textures.checkeredMap,
          roughness: 0.45,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }),
      ),
    );
    finStrip.position.set(0, 0.065, 0);
    fg.add(finStrip);

    fg.position.set(FINISH_LINE.x, 0, FINISH_LINE.z);
    scene.add(fg);
  }

  // 5. Roundabouts (Asphalt apron + Central planted monument island + spire)
  const stoneMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.72 }));
  for (const rb of NAIROBI_ROUNDABOUTS) {
    const ringGeo = trackGeo(new THREE.CircleGeometry(rb.outerRadius, 36));
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, roadMat);
    ring.position.set(rb.x, 0.036, rb.z);
    ring.receiveShadow = true;
    scene.add(ring);

    const island = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(rb.islandRadius, rb.islandRadius + 0.4, 0.5, 28)),
      curbMat,
    );
    island.position.set(rb.x, 0.25, rb.z);
    island.receiveShadow = true;
    scene.add(island);

    const planter = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(rb.islandRadius - 0.6, rb.islandRadius - 0.5, 0.56, 24)),
      medianTurfMat,
    );
    planter.position.set(rb.x, 0.3, rb.z);
    scene.add(planter);

    const plinth = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.4, 2.1, 3.2, 12)), stoneMat);
    plinth.position.set(rb.x, 1.8, rb.z);
    plinth.castShadow = true;
    scene.add(plinth);
  }

  // 6. Elevated Nairobi Expressway Viaduct + Animated Expressway Vehicles + KeNHA Gantries
  const concreteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.82 }));
  const expressDeckMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.72 }));

  const expLen = 470;
  const expDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13.5, 1.3, expLen)), expressDeckMat);
  expDeck.position.set(-122, 8.8, -10);
  expDeck.castShadow = true;
  expDeck.receiveShadow = true;
  scene.add(expDeck);

  for (const side of [-1, 1]) {
    const barrier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.95, expLen)), concreteMat);
    barrier.position.set(-122 + side * 6.5, 9.8, -10);
    scene.add(barrier);
  }

  const expSouthDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(330, 1.3, 13.5)), expressDeckMat);
  expSouthDeck.position.set(40, 8.8, 242);
  expSouthDeck.castShadow = true;
  scene.add(expSouthDeck);

  for (const pier of EXPRESSWAY_PIERS) {
    const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 8.2, 2.6)), concreteMat);
    col.position.set(pier.x, 4.1, pier.z);
    col.castShadow = true;
    const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.5, 1.1, 3.2)), concreteMat);
    cap.position.set(pier.x, 7.8, pier.z);
    scene.add(col, cap);
  }

  // Elevated Expressway traffic stream (8 streamlined cars cruising overhead!)
  const expCars: Array<{ z: number; laneX: number; dir: 1 | -1; speed: number }> = [];
  for (let i = 0; i < 8; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    expCars.push({
      z: -220 + i * 56,
      laneX: dir === -1 ? -125.2 : -118.8,
      dir,
      speed: 22 + (i % 3) * 4,
    });
  }
  const expCarInst = new THREE.InstancedMesh(
    trackGeo(new THREE.BoxGeometry(1.9, 1.1, 4.2)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5 })),
    expCars.length,
  );
  expCarInst.frustumCulled = false;
  expCars.forEach((c, i) => {
    _dummyColor.setHex([0xf8fafc, 0x38bdf8, 0xfacc15, 0xef4444][i % 4]);
    expCarInst.setColorAt(i, _dummyColor);
  });
  if (expCarInst.instanceColor) expCarInst.instanceColor.needsUpdate = true;
  scene.add(expCarInst);

  const addGantry = (x: number, z: number, rotY: number, top: string, bottom: string, code: string) => {
    const g = new THREE.Group();
    const postL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 7.2, 8)), gantrySteelMat);
    postL.position.set(-11.5, 3.6, 0);
    const postR = postL.clone();
    postR.position.x = 11.5;
    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.45, 0.45)), gantrySteelMat);
    beam.position.set(0, 7.0, 0);
    const signTex = textures.makeHighwaySign(top, bottom, code);
    const signMat = trackMat(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 }));
    const board = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.5, 3.2, 0.25)), signMat);
    board.position.set(0, 6.9, 0);
    g.add(postL, postR, beam, board);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  };

  addGantry(-120, -45, Math.PI / 2, 'KENYATTA AVE  ->  KICC', 'MOI AVE  ·  CITY SQUARE', 'A104');
  addGantry(-95, 16, 0, 'UHURU HWY  ·  EXPRESSWAY', 'MOMBASA RD  ·  NYAYO STADIUM', 'A104');
  addGantry(-95, -135, 0, 'UNIVERSITY WAY  ·  MUSEUM HILL', 'WESTLANDS  ·  WAIYAKI WAY', 'A104');
  addGantry(12, 115, Math.PI / 2, 'HAILE SELASSIE AVE', 'TIMES TOWER  ·  RAILWAYS', 'CBD');

  // 6B. 3D Roadside Turn Direction Identifiers at Major Circuit Corners
  const addTurnBoard = (x: number, z: number, rotY: number, arrow: string, label: string) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 4.2, 6)), gantrySteelMat);
    post.position.y = 2.1;
    const signTex = textures.makeTurnSign(arrow, label);
    const signMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0x332200,
        emissiveIntensity: 0.25,
        roughness: 0.35,
      }),
    );
    const plate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 2.2, 0.2)), signMat);
    plate.position.y = 4.4;
    g.add(post, plate);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  };

  addTurnBoard(64, -49, -Math.PI / 2, '>>>', 'MOI AVE · KICC');
  addTurnBoard(64, 38, Math.PI, '<<<', 'CITY HALL · KICC');
  addTurnBoard(144, -45, -Math.PI / 2, '>>>', 'TOM MBOYA · AFYA');
  addTurnBoard(144, 122, 0, '>>>', 'HAILE SELASSIE');
  addTurnBoard(-106, 122, Math.PI / 2, '<<<', 'UHURU HWY · NYAYO');
  addTurnBoard(-82, 22, Math.PI, '^^^', 'FINISH LINE AHEAD');

  // 7. ICONIC MULTI-PART NAIROBI LANDMARKS
  // 7A. KICC
  {
    const kicc = NAIROBI_LANDMARKS.find((l) => l.id === 'kicc')!;
    const g = new THREE.Group();
    const podium = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(30, 5.5, 30)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xb5a695, roughness: 0.78 })),
    );
    podium.position.y = 2.75;
    podium.castShadow = true;
    podium.receiveShadow = true;
    g.add(podium);

    const towerMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.kiccMap,
        color: 0xffffff,
        roughness: 0.58,
        metalness: 0.14,
      }),
    );
    const tower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(9.6, 9.6, 62, 28)), towerMat);
    tower.position.y = 36.5;
    tower.castShadow = true;
    g.add(tower);

    const crown = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(12.2, 9.6, 4.5, 28)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xc26d47, roughness: 0.52 })),
    );
    crown.position.y = 69.5;
    g.add(crown);

    const spire = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.7, 14, 8)),
      gantrySteelMat,
    );
    spire.position.y = 78.5;
    g.add(spire);

    const amphiBase = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(9.5, 8.5, 6, 20)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.7 })),
    );
    amphiBase.position.set(13, 3, 12);
    const amphiRoof = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(10.8, 7.5, 20)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x9c4a2d, roughness: 0.6 })),
    );
    amphiRoof.position.set(13, 9.75, 12);
    amphiRoof.castShadow = true;
    g.add(amphiBase, amphiRoof);

    g.position.set(kicc.x, 0, kicc.z);
    scene.add(g);
  }

  // 7B. Times Tower
  {
    const tt = NAIROBI_LANDMARKS.find((l) => l.id === 'times-tower')!;
    const g = new THREE.Group();
    const ttMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        map: textures.timesTowerMap,
        color: 0xffffff,
        roughness: 0.16,
        metalness: 0.68,
        clearcoat: 0.9,
      }),
    );
    const tier1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 34, 24)), ttMat);
    tier1.position.y = 17;
    tier1.castShadow = true;
    const tier2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(19, 30, 19)), ttMat);
    tier2.position.y = 49;
    tier2.castShadow = true;
    const tier3 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 24, 14)), ttMat);
    tier3.position.y = 76;
    tier3.castShadow = true;
    const crownBand = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(14.5, 2.5, 14.5)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.45 })),
    );
    crownBand.position.y = 89;
    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.5, 16, 8)), gantrySteelMat);
    mast.position.y = 98;
    g.add(tier1, tier2, tier3, crownBand, mast);
    g.position.set(tt.x, 0, tt.z);
    scene.add(g);
  }

  // 7C. Parliament Buildings & Clock Tower
  {
    const parl = NAIROBI_LANDMARKS.find((l) => l.id === 'parliament')!;
    const g = new THREE.Group();
    const parlStone = trackMat(new THREE.MeshStandardMaterial({ color: 0xe7dec8, roughness: 0.72 }));
    const parlWindowMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.5 }),
    );
    const copperRoof = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x2f855a, roughness: 0.55, metalness: 0.25 }),
    );

    const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(28.5, 1.4, 24.5)), stoneMat);
    plinth.position.y = 0.7;
    const core = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 11, 20)), parlWindowMat);
    core.position.y = 6.9;
    core.castShadow = true;
    const cornice = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.2, 1.6, 23.2)), parlStone);
    cornice.position.y = 12.2;

    for (let px = -12; px <= 12; px += 4) {
      for (const pz of [-10.8, 10.8]) {
        const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 10.6, 1.1)), parlStone);
        col.position.set(px, 6.7, pz);
        g.add(col);
      }
    }
    for (let pz = -6; pz <= 6; pz += 4) {
      for (const px of [-12.8, 12.8]) {
        const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 10.6, 1.1)), parlStone);
        col.position.set(px, 6.7, pz);
        g.add(col);
      }
    }

    const roof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(16, 5, 4)), copperRoof);
    roof.position.y = 15.5;
    roof.rotation.y = Math.PI / 4;

    const clockTower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.5, 38, 6.5)), parlStone);
    clockTower.position.set(-6, 19, 6);
    clockTower.castShadow = true;

    const clockMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.parliamentClockMap,
        emissive: 0xfef3c7,
        emissiveMap: textures.parliamentClockMap,
        emissiveIntensity: 0.55,
      }),
    );
    const clockBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.7, 5.2, 6.7)), clockMat);
    clockBand.position.set(-6, 33, 6);

    const towerCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(5.2, 7.5, 4)), copperRoof);
    towerCap.position.set(-6, 41.7, 6);
    towerCap.rotation.y = Math.PI / 4;

    g.add(plinth, core, cornice, roof, clockTower, clockBand, towerCap);
    g.position.set(parl.x, 0, parl.z);
    scene.add(g);
  }

  // 7D. Afya Centre
  {
    const afya = NAIROBI_LANDMARKS.find((l) => l.id === 'afya-centre')!;
    const g = new THREE.Group();
    const afyaMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.afyaMap,
        color: 0xffffff,
        roughness: 0.42,
        metalness: 0.25,
      }),
    );
    const cyl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(11.5, 11.5, 48, 24)), afyaMat);
    cyl.position.y = 24;
    cyl.castShadow = true;
    const cap = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(8.5, 11.5, 5, 24)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.4 })),
    );
    cap.position.y = 50.5;
    g.add(cyl, cap);
    g.position.set(afya.x, 0, afya.z);
    scene.add(g);
  }

  // 7E. Jamia Mosque
  {
    const jm = NAIROBI_LANDMARKS.find((l) => l.id === 'jamia-mosque')!;
    const g = new THREE.Group();
    const whiteWall = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 }));
    const silverDome = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.9 }),
    );

    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(28, 12, 24)), whiteWall);
    base.position.y = 6;
    base.castShadow = true;
    g.add(base);

    for (const dx of [-6, 0, 6]) {
      const dome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(dx === 0 ? 4.8 : 3.2, 16, 12)), silverDome);
      dome.position.set(dx, 12.5, 0);
      g.add(dome);
    }
    for (const mx of [-12, 12]) {
      const min = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 1.4, 24, 12)), whiteWall);
      min.position.set(mx, 12, -9);
      const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.4, 3, 12)), silverDome);
      cap.position.set(mx, 25.5, -9);
      g.add(min, cap);
    }
    g.position.set(jm.x, 0, jm.z);
    scene.add(g);
  }

  // 7F. Nyayo National Stadium
  {
    const nyayo = NAIROBI_LANDMARKS.find((l) => l.id === 'nyayo-stadium')!;
    const g = new THREE.Group();
    const bowlMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.78 }));
    const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 }));

    const bowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(28, 24, 12, 24)), bowlMat);
    bowl.scale.set(1.15, 1, 0.78);
    bowl.position.y = 6;
    bowl.castShadow = true;
    const pitch = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(22, 24)), grassMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.scale.set(1.1, 0.72, 1);
    pitch.position.y = 12.05;
    const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(44, 1.2, 14)), canopyMat);
    canopy.position.set(0, 15.5, -13);
    g.add(bowl, pitch, canopy);

    for (const [fx, fz] of [
      [-26, -15],
      [26, -15],
      [-26, 15],
      [26, 15],
    ]) {
      const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.4, 0.6, 24, 8)), gantrySteelMat);
      pole.position.set(fx, 12, fz);
      const bank = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(4.2, 2.2, 0.8)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef9c3, emissiveIntensity: 0.9 })),
      );
      bank.position.set(fx, 24, fz);
      g.add(pole, bank);
    }
    g.position.set(nyayo.x, 0, nyayo.z);
    scene.add(g);
  }

  // 7G. Nairobi Railway Station
  {
    const rail = NAIROBI_LANDMARKS.find((l) => l.id === 'railway-station')!;
    const g = new THREE.Group();
    const hall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(36, 9, 22)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.75 })),
    );
    hall.position.y = 4.5;
    hall.castShadow = true;
    const redRoof = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(24, 6.5, 4)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.62 })),
    );
    redRoof.scale.set(1.3, 1, 0.85);
    redRoof.rotation.y = Math.PI / 4;
    redRoof.position.y = 12.2;
    g.add(hall, redRoof);
    g.position.set(rail.x, 0, rail.z);
    scene.add(g);
  }

  // 8. CBD Towers & Context Buildings (Podium + Tower + Setback + Rooftop Crown)
  const landmarkIdsHandled = new Set([
    'blk-kicc',
    'blk-times',
    'blk-parliament',
    'blk-afya',
    'blk-jamia',
    'blk-nyayo-stadium',
    'blk-railways',
  ]);
  const bldgMats = textures.buildingMaps.map((m) =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        map: m,
        color: 0xffffff,
        roughness: 0.34,
        metalness: 0.42,
        clearcoat: 0.3,
      }),
    ),
  );
  const rooftopMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 }));
  const beaconRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 }),
  );

  CBD_BUILDING_BLOCKS.forEach((b, idx) => {
    if (landmarkIdsHandled.has(b.id)) return;
    const mat = bldgMats[idx % bldgMats.length];
    const w = b.halfW * 2;
    const dDepth = b.halfD * 2;
    const g = new THREE.Group();

    const podium = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, 6.5, dDepth)), mat);
    podium.position.y = 3.25;
    podium.castShadow = true;
    podium.receiveShadow = true;

    const shaftH = Math.max(8, b.height - 6.5);
    const shaft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w * 0.86, shaftH, dDepth * 0.86)), mat);
    shaft.position.y = 6.5 + shaftH * 0.5;
    shaft.castShadow = true;

    const crown = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w * 0.56, 3.2, dDepth * 0.56)),
      rooftopMat,
    );
    crown.position.y = 6.5 + shaftH + 1.6;

    const spire = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.2, 5.5, 6)), gantrySteelMat);
    spire.position.y = 6.5 + shaftH + 5.8;
    const tip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.32, 6, 6)), beaconRedMat);
    tip.position.y = 6.5 + shaftH + 8.6;

    g.add(podium, shaft, crown, spire, tip);
    g.position.set(b.x, 0, b.z);
    scene.add(g);
  });

  // 9. Multi-Cluster Organic Jacaranda & Flat-Topped Savannah Acacia Trees (InstancedMesh)
  const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4b3629, roughness: 0.92 }));
  const jacarandaMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 }));
  const acaciaMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }));

  const treeCoords: Array<{ x: number; z: number; jacaranda: boolean; scale: number }> = [];
  for (let x = -170; x <= 145; x += 24) {
    if (Math.abs(x - -95) < 24 || Math.abs(x - 55) < 18 || Math.abs(x - 135) < 16) continue;
    treeCoords.push({ x, z: -60, jacaranda: true, scale: 0.92 + (Math.abs(x) % 5) * 0.08 });
    treeCoords.push({ x, z: -30, jacaranda: x % 48 === 0, scale: 0.95 });
  }
  for (let z = -150; z <= 100; z += 22) {
    treeCoords.push({ x: -136, z, jacaranda: z % 44 === 0, scale: 1.05 });
    treeCoords.push({ x: -195, z, jacaranda: false, scale: 1.15 });
  }

  const trunkInst = new THREE.InstancedMesh(
    trackGeo(new THREE.CylinderGeometry(0.24, 0.44, 4.4, 7)),
    trunkMat,
    treeCoords.length,
  );

  // 4 overlapping puff clusters per Jacaranda, 3 tiered flat crowns per Acacia!
  const jacTrees = treeCoords.filter((t) => t.jacaranda);
  const acaTrees = treeCoords.filter((t) => !t.jacaranda);
  const jacInst = new THREE.InstancedMesh(
    trackGeo(new THREE.IcosahedronGeometry(2.15, 1)),
    jacarandaMat,
    Math.max(1, jacTrees.length * 4),
  );
  const acaInst = new THREE.InstancedMesh(
    trackGeo(new THREE.DodecahedronGeometry(2.8, 1)),
    acaciaMat,
    Math.max(1, acaTrees.length * 3),
  );

  const jacOffsets = [
    [0, 5.5, 0, 1.15, 0.78, 1.15],
    [-1.4, 4.9, 1.1, 0.88, 0.72, 0.88],
    [1.5, 5.1, -0.9, 0.92, 0.74, 0.92],
    [0.3, 6.2, 0.8, 0.76, 0.68, 0.76],
  ];
  const acaOffsets = [
    [0, 5.2, 0, 1.55, 0.42, 1.45],
    [-1.6, 4.7, 1.0, 1.1, 0.36, 1.05],
    [1.7, 4.8, -1.1, 1.15, 0.36, 1.1],
  ];

  let ji = 0;
  let ai = 0;
  treeCoords.forEach((t, i) => {
    _dummyPos.set(t.x, 2.2 * t.scale, t.z);
    _dummyQuat.identity();
    _dummyScale.setScalar(t.scale);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    trunkInst.setMatrixAt(i, _dummyMatrix);

    if (t.jacaranda) {
      jacOffsets.forEach(([ox, oy, oz, sx, sy, sz], cIdx) => {
        _dummyPos.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
        _dummyScale.set(sx * t.scale, sy * t.scale, sz * t.scale);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        jacInst.setMatrixAt(ji, _dummyMatrix);
        _dummyColor.setHSL(0.74 + ((i + cIdx) % 4 - 1.5) * 0.015, 0.68, 0.56 + cIdx * 0.03);
        jacInst.setColorAt(ji, _dummyColor);
        ji++;
      });
    } else {
      acaOffsets.forEach(([ox, oy, oz, sx, sy, sz], cIdx) => {
        _dummyPos.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
        _dummyScale.set(sx * t.scale, sy * t.scale, sz * t.scale);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        acaInst.setMatrixAt(ai, _dummyMatrix);
        _dummyColor.setHSL(0.32 + ((i + cIdx) % 3 - 1) * 0.02, 0.46, 0.25 + cIdx * 0.03);
        acaInst.setColorAt(ai, _dummyColor);
        ai++;
      });
    }
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  jacInst.instanceMatrix.needsUpdate = true;
  if (jacInst.instanceColor) jacInst.instanceColor.needsUpdate = true;
  acaInst.instanceMatrix.needsUpdate = true;
  if (acaInst.instanceColor) acaInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  jacInst.computeBoundingSphere();
  acaInst.computeBoundingSphere();
  scene.add(trunkInst, jacInst, acaInst);

  // Streetlamp Poles (InstancedMesh)
  const lampSpots: Array<{ x: number; z: number }> = [];
  for (let z = -220; z <= 240; z += 36) {
    if (Math.abs(z - -45) < 22 || Math.abs(z - 115) < 22 || Math.abs(z - 220) < 25) continue;
    lampSpots.push({ x: -80, z });
    lampSpots.push({ x: 43, z: Math.min(155, z) });
  }
  const poleInst = new THREE.InstancedMesh(
    trackGeo(new THREE.CylinderGeometry(0.14, 0.2, 7.5, 6)),
    gantrySteelMat,
    lampSpots.length,
  );
  const bulbInst = new THREE.InstancedMesh(
    trackGeo(new THREE.BoxGeometry(0.9, 0.22, 0.45)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 0.9 })),
    lampSpots.length,
  );
  lampSpots.forEach((p, i) => {
    _dummyPos.set(p.x, 3.75, p.z);
    _dummyQuat.identity();
    _dummyScale.setScalar(1);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    poleInst.setMatrixAt(i, _dummyMatrix);

    _dummyPos.set(p.x - 0.5, 7.5, p.z);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    bulbInst.setMatrixAt(i, _dummyMatrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  scene.add(poleInst, bulbInst);

  // 10. Animated CBD Traffic Signal Heads
  const signalSet: SignalLightSet = {
    nsRed: trackMat(new THREE.MeshStandardMaterial({ color: 0x450a0a, emissive: 0xef4444, emissiveIntensity: 0 })),
    nsAmber: trackMat(new THREE.MeshStandardMaterial({ color: 0x451a03, emissive: 0xf59e0b, emissiveIntensity: 0 })),
    nsGreen: trackMat(new THREE.MeshStandardMaterial({ color: 0x052e16, emissive: 0x22c55e, emissiveIntensity: 1.5 })),
    ewRed: trackMat(new THREE.MeshStandardMaterial({ color: 0x450a0a, emissive: 0xef4444, emissiveIntensity: 1.5 })),
    ewAmber: trackMat(new THREE.MeshStandardMaterial({ color: 0x451a03, emissive: 0xf59e0b, emissiveIntensity: 0 })),
    ewGreen: trackMat(new THREE.MeshStandardMaterial({ color: 0x052e16, emissive: 0x22c55e, emissiveIntensity: 0 })),
  };

  const signalJunctions = [
    { x: 55, z: -45 },
    { x: 55, z: 35 },
    { x: 135, z: 115 },
    { x: 135, z: -45 },
  ];
  const housingMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 }));
  for (const sj of signalJunctions) {
    const sg = new THREE.Group();
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 6)), gantrySteelMat);
    post.position.y = 2.6;
    const box = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 1.9, 0.9)), housingMat);
    box.position.y = 5.4;
    sg.add(post, box);

    const nsR = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 8)), signalSet.nsRed);
    nsR.position.set(0, 6.0, 0.45);
    const nsA = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 8)), signalSet.nsAmber);
    nsA.position.set(0, 5.4, 0.45);
    const nsG = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 8)), signalSet.nsGreen);
    nsG.position.set(0, 4.8, 0.45);

    const ewR = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 8)), signalSet.ewRed);
    ewR.position.set(0.45, 6.0, 0);
    const ewA = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 8)), signalSet.ewAmber);
    ewA.position.set(0.45, 5.4, 0);
    const ewG = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 8)), signalSet.ewGreen);
    ewG.position.set(0.45, 4.8, 0);

    sg.add(nsR, nsA, nsG, ewR, ewA, ewG);
    sg.position.set(sj.x + 12, 0, sj.z + 12);
    scene.add(sg);
  }

  // 11. Active Racing Checkpoint Gate & Light Pillar
  const beaconGroup = new THREE.Group();
  const beamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const beam = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.2, 4.8, 60, 16, 1, true)), beamMat);
  beam.position.y = 30;

  const ringMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    }),
  );
  const beaconRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(6.8, 0.45, 10, 32)), ringMat);
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = 1.2;

  const pylonL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.8, 8, 0.8)), ringMat);
  pylonL.position.set(-7.2, 4, 0);
  const pylonR = pylonL.clone();
  pylonR.position.x = 7.2;

  beaconGroup.add(beam, beaconRing, pylonL, pylonR);
  scene.add(beaconGroup);

  // 12. Persistent Tire Skidmarks Ring Buffer (InstancedMesh)
  const skidGeo = trackGeo(new THREE.PlaneGeometry(0.38, 1.35));
  skidGeo.rotateX(-Math.PI / 2);
  const skidMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x090a0c,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  const skidInst = new THREE.InstancedMesh(skidGeo, skidMat, SKID_POOL_SIZE);
  skidInst.frustumCulled = false;
  let skidCursor = 0;
  for (let i = 0; i < SKID_POOL_SIZE; i++) {
    _dummyPos.set(0, -100, 0);
    _dummyQuat.identity();
    _dummyScale.setScalar(0.001);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    skidInst.setMatrixAt(i, _dummyMatrix);
  }
  skidInst.instanceMatrix.needsUpdate = true;
  scene.add(skidInst);

  // 13. Pooled Particle Ring Buffer (Zero GC inside rAF)
  const particlePool: ParticleState[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: -100,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    scale: 1,
    r: 1,
    g: 1,
    b: 1,
  }));
  let particleCursor = 0;

  const particleGeo = trackGeo(new THREE.DodecahedronGeometry(0.45, 0));
  const particleMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
  );
  const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
  particleMesh.frustumCulled = false;
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    _dummyPos.set(0, -100, 0);
    _dummyQuat.identity();
    _dummyScale.setScalar(0.001);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    particleMesh.setMatrixAt(i, _dummyMatrix);
    particleMesh.setColorAt(i, _dummyColor.setRGB(1, 1, 1));
  }
  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  scene.add(particleMesh);

  // 14. 3D Glowing Street Route Direction Chevrons (so lagging drivers see every turn!)
  const chevronShape = new THREE.Shape();
  chevronShape.moveTo(0, 2.4);
  chevronShape.lineTo(2.4, -0.6);
  chevronShape.lineTo(1.5, -1.4);
  chevronShape.lineTo(0, 0.7);
  chevronShape.lineTo(-1.5, -1.4);
  chevronShape.lineTo(-2.4, -0.6);
  chevronShape.closePath();

  const chevronGeo = trackGeo(new THREE.ShapeGeometry(chevronShape));
  chevronGeo.rotateX(-Math.PI / 2);
  const chevronMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );

  const routeAnchors = [{ x: -152, z: -50.5 }, ...CIRCUIT_RACING_WAYPOINTS];
  const chevronPlacements: Array<{ x: number; z: number; heading: number }> = [];
  for (let i = 0; i < routeAnchors.length - 1; i++) {
    const a = routeAnchors[i];
    const b = routeAnchors[i + 1];
    const segDx = b.x - a.x;
    const segDz = b.z - a.z;
    const segLen = Math.hypot(segDx, segDz);
    const heading = Math.atan2(segDx, -segDz);
    const steps = Math.max(1, Math.floor(segLen / 24));
    for (let sIdx = 1; sIdx <= steps; sIdx++) {
      const t = sIdx / (steps + 1);
      chevronPlacements.push({
        x: a.x + segDx * t,
        z: a.z + segDz * t,
        heading,
      });
    }
  }

  const chevronInst = new THREE.InstancedMesh(
    chevronGeo,
    chevronMat,
    Math.max(1, chevronPlacements.length),
  );
  chevronInst.frustumCulled = false;
  for (let i = 0; i < chevronPlacements.length; i++) {
    const cp = chevronPlacements[i];
    _dummyPos.set(cp.x, 0.11, cp.z);
    _dummyEuler.set(0, -cp.heading, 0);
    _dummyQuat.setFromEuler(_dummyEuler);
    _dummyScale.setScalar(1);
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    chevronInst.setMatrixAt(i, _dummyMatrix);
    chevronInst.setColorAt(i, _dummyColor.setHex(0x22d3ee));
  }
  chevronInst.instanceMatrix.needsUpdate = true;
  if (chevronInst.instanceColor) chevronInst.instanceColor.needsUpdate = true;
  scene.add(chevronInst);

  // 15. Dynamic 3D Raindrop Streaks Pool (around active camera/player)
  const RAIN_COUNT = 520;
  const rainDrops = Array.from({ length: RAIN_COUNT }, (_, i) => ({
    ox: ((i * 37) % 90) - 45,
    oy: ((i * 19) % 30) + 0.8,
    oz: ((i * 53) % 90) - 45,
    speed: 38 + (i % 7) * 3.5,
  }));
  const rainGeo = trackGeo(new THREE.BoxGeometry(0.065, 2.5, 0.065));
  const rainMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
  );
  const rainInst = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
  rainInst.frustumCulled = false;
  rainInst.visible = false;
  scene.add(rainInst);

  const _targetFogColor = new THREE.Color();
  const _targetSunColor = new THREE.Color();
  const _targetHemiSky = new THREE.Color();
  const _targetHemiGround = new THREE.Color();
  const _rainQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, 0, -0.08));

  return {
    sunLight,
    beaconGroup,
    beaconRing,
    updateSignals: (signal: SignalPhase) => {
      signalSet.nsRed.emissiveIntensity =
        signal.state === 'ew-green' || signal.state === 'ew-amber' ? 1.8 : 0.05;
      signalSet.nsAmber.emissiveIntensity = signal.state === 'ns-amber' ? 1.8 : 0.05;
      signalSet.nsGreen.emissiveIntensity = signal.state === 'ns-green' ? 1.8 : 0.05;

      signalSet.ewRed.emissiveIntensity =
        signal.state === 'ns-green' || signal.state === 'ns-amber' ? 1.8 : 0.05;
      signalSet.ewAmber.emissiveIntensity = signal.state === 'ew-amber' ? 1.8 : 0.05;
      signalSet.ewGreen.emissiveIntensity = signal.state === 'ew-green' ? 1.8 : 0.05;
    },
    updateStartLights: (countdownStage: number, active: boolean) => {
      // countdownStage: 3 -> red, 2 -> red, 1 -> red, 0 -> green GO!
      for (let i = 0; i < startLightMats.length; i++) {
        const m = startLightMats[i];
        if (!active) {
          m.emissive.setHex(0x22c55e);
          m.emissiveIntensity = 0.35;
        } else if (countdownStage === 0) {
          m.emissive.setHex(0x22c55e);
          m.emissiveIntensity = 2.4;
        } else {
          m.emissive.setHex(0xef4444);
          const litCount = 4 - countdownStage; // 1, 2, 3+
          m.emissiveIntensity = i <= litCount ? 2.4 : 0.12;
        }
      }
    },
    updateExpresswayTraffic: (dt: number) => {
      for (let i = 0; i < expCars.length; i++) {
        const c = expCars[i];
        c.z += c.dir * c.speed * dt;
        if (c.z > 220) c.z = -240;
        if (c.z < -240) c.z = 220;
        _dummyPos.set(c.laneX, 10.1, c.z);
        _dummyQuat.identity();
        _dummyScale.setScalar(1);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        expCarInst.setMatrixAt(i, _dummyMatrix);
      }
      expCarInst.instanceMatrix.needsUpdate = true;
    },
    spawnSkidmark: (x: number, z: number, heading: number) => {
      _dummyPos.set(x, 0.052, z);
      _dummyEuler.set(0, -heading, 0);
      _dummyQuat.setFromEuler(_dummyEuler);
      _dummyScale.setScalar(1);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      skidInst.setMatrixAt(skidCursor, _dummyMatrix);
      skidCursor = (skidCursor + 1) % SKID_POOL_SIZE;
      skidInst.instanceMatrix.needsUpdate = true;
    },
    spawnParticle: (x, y, z, vx, vy, vz, scale, life, r, g, b) => {
      const p = particlePool[particleCursor];
      particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = vx;
      p.vy = vy;
      p.vz = vz;
      p.scale = scale;
      p.life = life;
      p.maxLife = life;
      p.r = r;
      p.g = g;
      p.b = b;
    },
    updateParticles: (dt: number) => {
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          _dummyPos.set(0, -100, 0);
          _dummyScale.setScalar(0.001);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          particleMesh.setMatrixAt(i, _dummyMatrix);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 2.2 * dt;
        const frac = p.life / p.maxLife;
        _dummyPos.set(p.x, p.y, p.z);
        _dummyScale.setScalar(p.scale * (0.4 + 0.8 * (1 - frac)));
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        particleMesh.setMatrixAt(i, _dummyMatrix);
        particleMesh.setColorAt(i, _dummyColor.setRGB(p.r, p.g, p.b));
      }
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    },
    updateRouteChevrons: (elapsed: number, visible: boolean) => {
      chevronInst.visible = visible;
      if (!visible || !chevronInst.instanceColor) return;
      for (let i = 0; i < chevronPlacements.length; i++) {
        const wave = 0.5 + 0.5 * Math.sin(elapsed * 4.5 - i * 0.75);
        _dummyColor.setRGB(0.1 + 0.85 * wave, 0.72 + 0.25 * wave, 0.42 - 0.25 * wave);
        chevronInst.setColorAt(i, _dummyColor);
      }
      chevronInst.instanceColor.needsUpdate = true;
    },
    updateWeather: (condition: WeatherCondition, focusX: number, focusZ: number, dt: number) => {
      const wp = getWeatherProfile(condition);
      const blend = 1 - Math.exp(-8.5 * Math.min(0.25, Math.max(0.016, dt)));

      sky.visible = condition === 'clear';
      sceneFog.density += (wp.fogDensity - sceneFog.density) * blend;
      _targetFogColor.setHex(wp.fogColorHex);
      sceneFog.color.lerp(_targetFogColor, blend);

      sunLight.intensity += (wp.sunIntensity - sunLight.intensity) * blend;
      _targetSunColor.setHex(wp.sunColorHex);
      sunLight.color.lerp(_targetSunColor, blend);

      hemi.intensity += (wp.hemiIntensity - hemi.intensity) * blend;
      _targetHemiSky.setHex(wp.hemiSkyHex);
      _targetHemiGround.setHex(wp.hemiGroundHex);
      hemi.color.lerp(_targetHemiSky, blend);
      hemi.groundColor.lerp(_targetHemiGround, blend);

      skyUniforms['turbidity'].value += (wp.skyTurbidity - skyUniforms['turbidity'].value) * blend;
      skyUniforms['rayleigh'].value += (wp.skyRayleigh - skyUniforms['rayleigh'].value) * blend;
      skyUniforms['mieCoefficient'].value +=
        (wp.skyMie - skyUniforms['mieCoefficient'].value) * blend;

      roadMat.roughness += (wp.roadRoughness - roadMat.roughness) * blend;
      roadMat.metalness += (wp.roadMetalness - roadMat.metalness) * blend;

      if (wp.rainIntensity > 0.05) {
        rainInst.visible = true;
        _dummyScale.set(1, 1, 1);
        for (let i = 0; i < RAIN_COUNT; i++) {
          const drop = rainDrops[i];
          drop.oy -= drop.speed * dt;
          if (drop.oy < 0.2) {
            drop.oy = 29 + (i % 6);
          }
          _dummyPos.set(focusX + drop.ox, drop.oy, focusZ + drop.oz);
          _dummyMatrix.compose(_dummyPos, _rainQuat, _dummyScale);
          rainInst.setMatrixAt(i, _dummyMatrix);
        }
        rainInst.instanceMatrix.needsUpdate = true;
      } else {
        rainInst.visible = false;
      }
    },
    setBeaconPosition: (x: number, z: number, elapsed: number) => {
      beaconGroup.position.set(x, 0, z);
      beaconRing.position.y = 1.2 + Math.sin(elapsed * 3.4) * 0.45;
      beaconGroup.rotation.y = elapsed * 0.9;
    },
    setFinishLineActive: (active: boolean, elapsed: number) => {
      const pulse = active ? 2.1 + 1.1 * Math.sin(elapsed * 8.5) : 0.55;
      for (const m of finishLampMats) {
        m.emissiveIntensity = pulse;
      }
      for (const m of finishPillarMats) {
        m.emissiveIntensity = active ? 1.8 : 0.65;
      }
    },
    dispose: () => {
      for (const dItem of disposables) {
        dItem.dispose();
      }
    },
  };
}
