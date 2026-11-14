import * as THREE from 'three';
import type { VehiclePreset } from '../game/nairobiMap';
import type { TrafficArchetype } from '../game/traffic';
import type { NairobiTexturePack } from './textures';

export interface PlayerVehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheelSpinGroups: THREE.Group[];
  brakeLightsMat: THREE.MeshStandardMaterial;
  boostFlameLeft: THREE.Group;
  boostFlameRight: THREE.Group;
}

export interface RivalVehicleRig {
  root: THREE.Group;
  wheelSpinGroups: THREE.Group[];
  brakeLightsMat: THREE.MeshStandardMaterial;
  boostFlameLeft: THREE.Group;
  boostFlameRight: THREE.Group;
}

export interface TrafficVehicleRig {
  root: THREE.Group;
  brakeMat: THREE.MeshStandardMaterial;
}

export interface GhostVehicleRig {
  root: THREE.Group;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  wheelSpinGroups: THREE.Group[];
}

function createAlloyWheel(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  caliperMat: THREE.Material,
): { steerOrMount: THREE.Group; spinGroup: THREE.Group } {
  const mount = new THREE.Group();
  const spinGroup = new THREE.Group();
  mount.add(spinGroup);

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  spinGroup.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width + 0.025, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  spinGroup.add(rim);

  // 5-spoke star bars so wheel rotation is visibly crisp!
  const spokeGeo = new THREE.BoxGeometry(width + 0.04, radius * 1.18, radius * 0.14);
  for (let s = 0; s < 3; s++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (s * Math.PI) / 3;
    spinGroup.add(spoke);
  }

  // Brake caliper sitting stationary inside mount
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.45, radius * 0.36, radius * 0.34),
    caliperMat,
  );
  caliper.position.set(0, radius * 0.15, radius * 0.25);
  mount.add(caliper);

  return { steerOrMount: mount, spinGroup };
}

function createSimpleWheel(radius: number, width: number, tireMat: THREE.Material, rimMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  g.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width + 0.03, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  g.add(rim);
  return g;
}

const boostFlameOuterGeo = new THREE.ConeGeometry(0.18, 0.98, 14, 4);
boostFlameOuterGeo.rotateX(Math.PI / 2);
const boostFlameCoreGeo = new THREE.ConeGeometry(0.105, 0.72, 12, 4);
boostFlameCoreGeo.rotateX(Math.PI / 2);
const boostFlameHotGeo = new THREE.ConeGeometry(0.055, 0.46, 10, 3);
boostFlameHotGeo.rotateX(Math.PI / 2);

const boostFlameOuterMat = new THREE.MeshBasicMaterial({
  color: 0xf97316,
  transparent: true,
  opacity: 0.62,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
const boostFlameCoreMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.86,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
const boostFlameHotMat = new THREE.MeshBasicMaterial({
  color: 0xfff3c4,
  transparent: true,
  opacity: 0.96,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});

function createBoostJet(side: number): THREE.Group {
  const jet = new THREE.Group();
  jet.position.set(side * 0.52, 0.3, 2.72);

  const outer = new THREE.Mesh(boostFlameOuterGeo, boostFlameOuterMat);
  const core = new THREE.Mesh(boostFlameCoreGeo, boostFlameCoreMat);
  const hotCore = new THREE.Mesh(boostFlameHotGeo, boostFlameHotMat);
  core.position.z = 0.08;
  hotCore.position.z = 0.12;
  outer.renderOrder = 2;
  core.renderOrder = 3;
  hotCore.renderOrder = 4;
  jet.add(outer, core, hotCore);
  jet.visible = false;
  return jet;
}

function addContactShadow(parent: THREE.Group, w: number, l: number, tex: THREE.Texture): void {
  const geo = new THREE.PlaneGeometry(w, l);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.position.y = 0.02;
  parent.add(shadow);
}

/**
 * Builds an aerodynamic sculpted GT / Rally coupe chassis via beveled ExtrudeGeometry.
 * Local forward = -Z.
 */
function buildSculptedCoupeParts(
  bodyGroup: THREE.Group,
  paintMat: THREE.Material,
  accentMat: THREE.Material,
  glassMat: THREE.Material,
  trimMat: THREE.Material,
  chromeMat: THREE.Material,
): void {
  // Side profile in X-Y plane (X becomes Z after rotateY(-PI/2): negative = front)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.22, 0.24);
  hullShape.lineTo(-2.28, 0.56); // Front nose lip
  hullShape.lineTo(-1.82, 0.78); // Sculpted hood front
  hullShape.lineTo(-0.92, 0.88); // Base of windshield
  hullShape.lineTo(-0.22, 1.32); // Roofline front
  hullShape.lineTo(0.85, 1.32); // Fastback roof rear
  hullShape.lineTo(1.75, 0.94); // Rear decklid
  hullShape.lineTo(2.24, 0.88); // Tail lip
  hullShape.lineTo(2.26, 0.34); // Rear diffuser top
  hullShape.lineTo(1.88, 0.22); // Rear underside
  hullShape.lineTo(-1.88, 0.22); // Front underside
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.78,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.rotateY(-Math.PI / 2);
  hullGeo.translate(0.89, 0, 0);
  const hull = new THREE.Mesh(hullGeo, paintMat);
  hull.castShadow = true;
  bodyGroup.add(hull);

  // Dark cockpit glass greenhouse inset cleanly over the upper cabin
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-0.94, 0.87);
  glassShape.lineTo(-0.24, 1.29);
  glassShape.lineTo(0.82, 1.29);
  glassShape.lineTo(1.62, 0.94);
  glassShape.closePath();

  const glassGeo = new THREE.ExtrudeGeometry(glassShape, {
    depth: 1.54,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  glassGeo.rotateY(-Math.PI / 2);
  glassGeo.translate(0.77, 0.03, 0);
  const greenhouse = new THREE.Mesh(glassGeo, glassMat);
  bodyGroup.add(greenhouse);

  // Painted roof cap over glass so A/B/C pillars frame the windshield & side glass
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 1.08), paintMat);
  roofCap.position.set(0, 1.40, 0.31);
  bodyGroup.add(roofCap);

  // Flared fender arches & dark wheel well liners
  for (const [fx, fz] of [
    [-0.95, -1.36],
    [0.95, -1.36],
    [-0.96, 1.36],
    [0.96, 1.36],
  ]) {
    const flare = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.96), paintMat);
    flare.position.set(fx, 0.62, fz);
    bodyGroup.add(flare);

    const well = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.86), trimMat);
    well.position.set(fx * 0.88, 0.45, fz);
    bodyGroup.add(well);
  }

  // Twin flush racing stripes along hood & roof
  for (const sx of [-0.22, 0.22]) {
    const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.86), accentMat);
    hoodStripe.position.set(sx, 0.915, -1.36);
    hoodStripe.rotation.x = 0.11;
    bodyGroup.add(hoodStripe);

    const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.98), accentMat);
    roofStripe.position.set(sx, 1.435, 0.31);
    bodyGroup.add(roofStripe);
  }

  // Side aero skirts & carbon front splitter with endplate canards
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.07, 0.44), trimMat);
  splitter.position.set(0, 0.24, -2.18);
  bodyGroup.add(splitter);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.0), trimMat);
    skirt.position.set(side * 0.98, 0.28, 0);
    bodyGroup.add(skirt);

    // Aerodynamic wing mirrors
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.16), paintMat);
    mirror.position.set(side * 1.02, 0.96, -0.68);
    bodyGroup.add(mirror);
  }

  // Front aggressive grille intake + carbon rear diffuser
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.22, 0.12), trimMat);
  grille.position.set(0, 0.42, -2.31);
  bodyGroup.add(grille);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.18, 0.24), trimMat);
  diffuser.position.set(0, 0.29, 2.24);
  bodyGroup.add(diffuser);

  // Twin chrome exhaust tips
  const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 10);
  pipeGeo.rotateX(Math.PI / 2);
  for (const px of [-0.52, 0.52]) {
    const pipe = new THREE.Mesh(pipeGeo, chromeMat);
    pipe.position.set(px, 0.28, 2.34);
    bodyGroup.add(pipe);
  }

  // Swan-neck carbon GT rear wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.07, 0.36), accentMat);
  wing.position.set(0, 1.24, 2.04);
  wing.castShadow = true;
  bodyGroup.add(wing);

  for (const px of [-0.62, 0.62]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.2), trimMat);
    pylon.position.set(px, 1.06, 2.04);
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.42), trimMat);
    endplate.position.set(px < 0 ? -0.98 : 0.98, 1.24, 2.04);
    bodyGroup.add(pylon, endplate);
  }
}

/**
 * Builds the player's multi-part sculpted 3D Nairobi racer.
 * Local forward direction = -Z. Bottom-center grounded at y = 0.
 */
export function buildPlayerVehicle(
  preset: VehiclePreset,
  textures: NairobiTexturePack,
): PlayerVehicleRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  addContactShadow(root, 3.2, 5.6, textures.contactShadowMap);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: preset.primaryColor,
    roughness: 0.18,
    metalness: 0.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: preset.accentColor,
    roughness: 0.28,
    metalness: 0.55,
  });

  const cabinGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x09111e,
    roughness: 0.06,
    metalness: 0.85,
    clearcoat: 1.0,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.72,
    metalness: 0.2,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x151515,
    roughness: 0.88,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    roughness: 0.18,
    metalness: 0.92,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.35,
    metalness: 0.4,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 2.0,
    roughness: 0.08,
  });

  const brakeLightsMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
    roughness: 0.15,
  });

  const plateMat = new THREE.MeshStandardMaterial({
    map: textures.makeLicensePlate(preset.plate),
    roughness: 0.38,
    metalness: 0.12,
  });

  if (preset.id === 'nganya') {
    // Sculpted Widebody Nairobi Nganya Street Racer
    const matatuMat = new THREE.MeshPhysicalMaterial({
      map: textures.matatuLiveries[0],
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.25,
      clearcoat: 0.85,
    });
    const vanShape = new THREE.Shape();
    vanShape.moveTo(-2.32, 0.26);
    vanShape.lineTo(-2.36, 0.95);
    vanShape.lineTo(-2.05, 1.85);
    vanShape.lineTo(2.15, 1.88);
    vanShape.lineTo(2.34, 1.72);
    vanShape.lineTo(2.36, 0.3);
    vanShape.closePath();
    const vanGeo = new THREE.ExtrudeGeometry(vanShape, {
      depth: 1.86,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    vanGeo.rotateY(-Math.PI / 2);
    vanGeo.translate(0.93, 0, 0);
    const hull = new THREE.Mesh(vanGeo, matatuMat);
    hull.castShadow = true;
    bodyGroup.add(hull);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.72, 0.12), cabinGlassMat);
    windshield.position.set(0, 1.42, -2.24);
    windshield.rotation.x = 0.3;
    bodyGroup.add(windshield);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.1, 0.36), trimMat);
    splitter.position.set(0, 0.24, -2.35);
    bodyGroup.add(splitter);

    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.18, 4.05), accentMat);
    roofCap.position.set(0, 1.98, 0.12);
    bodyGroup.add(roofCap);

    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.1, 0.44), accentMat);
    rearWing.position.set(0, 2.2, 2.16);
    bodyGroup.add(rearWing);
  } else if (preset.id === 'safari') {
    // Sculpted Armored Savannah V8 Interceptor SUV
    const suvShape = new THREE.Shape();
    suvShape.moveTo(-2.28, 0.32);
    suvShape.lineTo(-2.32, 0.85);
    suvShape.lineTo(-1.35, 1.05);
    suvShape.lineTo(-0.8, 1.72);
    suvShape.lineTo(1.85, 1.72);
    suvShape.lineTo(2.24, 0.98);
    suvShape.lineTo(2.26, 0.34);
    suvShape.closePath();

    const suvGeo = new THREE.ExtrudeGeometry(suvShape, {
      depth: 1.84,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    suvGeo.rotateY(-Math.PI / 2);
    suvGeo.translate(0.92, 0, 0);
    const suvBody = new THREE.Mesh(suvGeo, paintMat);
    suvBody.castShadow = true;
    bodyGroup.add(suvBody);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.52, 2.7), cabinGlassMat);
    glassBand.position.set(0, 1.38, 0.35);
    bodyGroup.add(glassBand);

    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.12, 2.2), trimMat);
    rack.position.set(0, 1.84, 0.42);
    bodyGroup.add(rack);

    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.42, 0.22), rimMat);
    bullBar.position.set(0, 0.64, -2.42);
    bodyGroup.add(bullBar);

    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16), tireMat);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(0, 1.02, 2.38);
    bodyGroup.add(spareTire);
  } else {
    // Sculpted Twin-Turbo Safari Rally GT Coupe
    buildSculptedCoupeParts(bodyGroup, paintMat, accentMat, cabinGlassMat, trimMat, rimMat);
  }

  // Sharp LED Headlights + Full-Width Racing Tail-Light Bar + Kenyan Plate
  for (const hx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.09), headlightMat);
    hl.position.set(hx, 0.64, -2.28);
    bodyGroup.add(hl);
  }

  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.08), brakeLightsMat);
  tailBar.position.set(0, 0.72, 2.29);
  bodyGroup.add(tailBar);

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.14), plateMat);
  plate.position.set(0, 0.52, 2.36);
  bodyGroup.add(plate);

  // Twin layered nitro afterburners: warm outer sheath, cyan plasma and a hot white core.
  const boostFlameLeft = createBoostJet(-1);
  const boostFlameRight = createBoostJet(1);
  bodyGroup.add(boostFlameLeft, boostFlameRight);

  // 4 Alloy Wheels with Brake Calipers & Steering Front Pivots
  const wheelRadius = preset.id === 'safari' ? 0.44 : 0.38;
  const wheelWidth = 0.3;
  const wheelSpinGroups: THREE.Group[] = [];

  const attachWheel = (x: number, z: number, isFront: boolean) => {
    const { steerOrMount, spinGroup } = createAlloyWheel(
      wheelRadius,
      wheelWidth,
      tireMat,
      rimMat,
      caliperMat,
    );
    wheelSpinGroups.push(spinGroup);
    steerOrMount.position.set(x, wheelRadius, z);
    root.add(steerOrMount);
    return isFront ? steerOrMount : null;
  };

  const frontLeftSteer = attachWheel(-0.98, -1.36, true)!;
  const frontRightSteer = attachWheel(0.98, -1.36, true)!;
  attachWheel(-0.98, 1.36, false);
  attachWheel(0.98, 1.36, false);

  return {
    root,
    bodyGroup,
    frontLeftSteer,
    frontRightSteer,
    wheelSpinGroups,
    brakeLightsMat,
    boostFlameLeft,
    boostFlameRight,
  };
}

/**
 * Builds an AI Rival Racing Car matching player visual detail.
 */
export function buildRivalVehicle(
  primaryColor: number,
  accentColor: number,
  plateText: string,
  textures: NairobiTexturePack,
): RivalVehicleRig {
  const root = new THREE.Group();
  addContactShadow(root, 3.2, 5.6, textures.contactShadowMap);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    roughness: 0.18,
    metalness: 0.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3, metalness: 0.5 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x09111e, roughness: 0.08, metalness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.72, metalness: 0.2 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, roughness: 0.18, metalness: 0.9 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 1.8,
  });
  const brakeLightsMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.8,
  });
  const plateMat = new THREE.MeshStandardMaterial({ map: textures.makeLicensePlate(plateText), roughness: 0.4 });

  buildSculptedCoupeParts(root, paintMat, accentMat, glassMat, trimMat, rimMat);

  for (const hx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.09), headlightMat);
    hl.position.set(hx, 0.64, -2.28);
    root.add(hl);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.08), brakeLightsMat);
  tailBar.position.set(0, 0.72, 2.29);
  root.add(tailBar);

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.14), plateMat);
  plate.position.set(0, 0.52, 2.36);
  root.add(plate);

  const boostFlameLeft = createBoostJet(-1);
  const boostFlameRight = createBoostJet(1);
  root.add(boostFlameLeft, boostFlameRight);

  const wheelSpinGroups: THREE.Group[] = [];
  for (const [wx, wz] of [
    [-0.98, -1.36],
    [0.98, -1.36],
    [-0.98, 1.36],
    [0.98, 1.36],
  ]) {
    const { steerOrMount, spinGroup } = createAlloyWheel(0.38, 0.3, tireMat, rimMat, caliperMat);
    wheelSpinGroups.push(spinGroup);
    steerOrMount.position.set(wx, 0.38, wz);
    root.add(steerOrMount);
  }

  return {
    root,
    wheelSpinGroups,
    brakeLightsMat,
    boostFlameLeft,
    boostFlameRight,
  };
}

/**
 * Builds a glowing translucent Ghost racer for racing against the player's best lap.
 */
export function buildGhostVehicle(): GhostVehicleRig {
  const root = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.25,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x7dd3fc,
    emissiveIntensity: 1.0,
    roughness: 0.2,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0c4a6e,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.1,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  buildSculptedCoupeParts(root, shellMat, accentMat, glassMat, trimMat, accentMat);
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.renderOrder = 2;
    }
  });

  // Translucent Ghost tail light bar & headlights
  for (const hx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.09), accentMat);
    hl.position.set(hx, 0.64, -2.28);
    hl.renderOrder = 2;
    root.add(hl);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.08), accentMat);
  tailBar.position.set(0, 0.72, 2.29);
  tailBar.renderOrder = 2;
  root.add(tailBar);

  // Subtle holographic underglow ring for instant depth readability on bright asphalt
  const haloGeo = new THREE.RingGeometry(2.3, 2.65, 32);
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.y = 0.05;
  haloMesh.renderOrder = 1;
  root.add(haloMesh);

  const wheelSpinGroups: THREE.Group[] = [];
  for (const [wx, wz] of [
    [-0.98, -1.36],
    [0.98, -1.36],
    [-0.98, 1.36],
    [0.98, 1.36],
  ]) {
    const spin = createSimpleWheel(0.38, 0.3, trimMat, wheelMat);
    spin.position.set(wx, 0.38, wz);
    spin.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.renderOrder = 2;
      }
    });
    wheelSpinGroups.push(spin);
    root.add(spin);
  }

  return {
    root,
    haloMesh,
    haloMat,
    wheelSpinGroups,
  };
}

/**
 * Builds sculpted composite 3D meshes for authentic Kenyan local traffic archetypes.
 */
export function buildTrafficVehicle(
  archetype: TrafficArchetype,
  liveryIndex: number,
  textures: NairobiTexturePack,
): TrafficVehicleRig {
  const root = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb4b8c2, roughness: 0.28, metalness: 0.85 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1524, roughness: 0.08, metalness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.72 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef3c7,
    emissiveIntensity: 1.4,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.45,
  });

  if (archetype === 'bodaboda') {
    addContactShadow(root, 1.2, 2.4, textures.contactShadowMap);
    const frameMat = new THREE.MeshStandardMaterial({
      color: liveryIndex % 2 === 0 ? 0xdc2626 : 0x1d4ed8,
      roughness: 0.32,
      metalness: 0.55,
    });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.65 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 1.72), frameMat);
    body.position.set(0, 0.68, 0);
    root.add(body);

    const wF = createSimpleWheel(0.32, 0.14, tireMat, rimMat);
    wF.position.set(0, 0.32, -0.68);
    const wR = createSimpleWheel(0.32, 0.14, tireMat, rimMat);
    wR.position.set(0, 0.32, 0.68);
    root.add(wF, wR);

    const riderTorso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.34), vestMat);
    riderTorso.position.set(0, 1.24, 0.1);
    riderTorso.rotation.x = 0.22;
    root.add(riderTorso);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), helmetMat);
    helmet.position.set(0, 1.72, -0.02);
    root.add(helmet);

    const headLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), headlightMat);
    headLamp.position.set(0, 0.96, -0.84);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.06), brakeMat);
    tail.position.set(0, 0.84, 0.9);
    root.add(headLamp, tail);

    return { root, brakeMat };
  }

  if (archetype === 'cityhoppa') {
    addContactShadow(root, 3.1, 9.2, textures.contactShadowMap);
    const busMat = new THREE.MeshPhysicalMaterial({
      color: liveryIndex % 2 === 0 ? 0x0284c7 : 0x0f766e,
      roughness: 0.35,
      metalness: 0.25,
      clearcoat: 0.6,
    });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.38, 8.2), busMat);
    hull.position.set(0, 1.6, 0);
    hull.castShadow = true;
    root.add(hull);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.39, 0.28, 8.24), stripeMat);
    stripe.position.set(0, 1.15, 0);
    root.add(stripe);

    const windows = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.88, 7.65), glassMat);
    windows.position.set(0, 2.1, -0.08);
    root.add(windows);

    // Roof AC unit & front bumper
    const acPod = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 2.6), trimMat);
    acPod.position.set(0, 2.92, 0.3);
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 0.25), trimMat);
    frontBumper.position.set(0, 0.45, -4.15);
    root.add(acPod, frontBumper);

    for (const z of [-2.6, 2.4]) {
      const wL = createSimpleWheel(0.48, 0.3, tireMat, rimMat);
      wL.position.set(-1.12, 0.48, z);
      const wR = createSimpleWheel(0.48, 0.3, tireMat, rimMat);
      wR.position.set(1.12, 0.48, z);
      root.add(wL, wR);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.08), brakeMat);
    tail.position.set(0, 0.85, 4.12);
    root.add(tail);

    return { root, brakeMat };
  }

  if (archetype === 'matatu') {
    addContactShadow(root, 2.8, 5.8, textures.contactShadowMap);
    const liveryTex = textures.matatuLiveries[liveryIndex % textures.matatuLiveries.length];
    const bodyMat = new THREE.MeshPhysicalMaterial({
      map: liveryTex,
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.25,
      clearcoat: 0.8,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });

    const matShape = new THREE.Shape();
    matShape.moveTo(-2.45, 0.3);
    matShape.lineTo(-2.48, 0.95);
    matShape.lineTo(-2.12, 1.92);
    matShape.lineTo(2.38, 1.94);
    matShape.lineTo(2.48, 1.75);
    matShape.lineTo(2.48, 0.32);
    matShape.closePath();

    const matGeo = new THREE.ExtrudeGeometry(matShape, {
      depth: 1.88,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    matGeo.rotateY(-Math.PI / 2);
    matGeo.translate(0.94, 0, 0);
    const body = new THREE.Mesh(matGeo, bodyMat);
    body.castShadow = true;
    root.add(body);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.72, 0.1), glassMat);
    windshield.position.set(0, 1.46, -2.35);
    windshield.rotation.x = 0.28;
    root.add(windshield);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.14, 4.15), roofMat);
    roof.position.set(0, 2.02, 0.12);
    root.add(roof);

    for (const hx of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), headlightMat);
      hl.position.set(hx, 0.68, -2.52);
      root.add(hl);
    }

    for (const z of [-1.45, 1.45]) {
      const wL = createSimpleWheel(0.38, 0.24, tireMat, rimMat);
      wL.position.set(-0.96, 0.38, z);
      const wR = createSimpleWheel(0.38, 0.24, tireMat, rimMat);
      wR.position.set(0.96, 0.38, z);
      root.add(wL, wR);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 0.08), brakeMat);
    tail.position.set(0, 0.78, 2.52);
    root.add(tail);

    return { root, brakeMat };
  }

  // Sculpted Saloon Taxi or Safari Land Cruiser (no flat 2-box stacks!)
  addContactShadow(root, 2.7, 5.0, textures.contactShadowMap);
  const isSafari = archetype === 'safari';
  const carColors = [0xf8fafc, 0x64748b, 0x334155, 0x0f172a];
  const color = isSafari ? 0xd6c7a9 : carColors[liveryIndex % carColors.length];
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: isSafari ? 0.38 : 0.2,
    metalness: 0.42,
    clearcoat: isSafari ? 0.35 : 0.9,
  });

  const shape = new THREE.Shape();
  if (isSafari) {
    shape.moveTo(-2.15, 0.32);
    shape.lineTo(-2.18, 0.84);
    shape.lineTo(-1.3, 1.0);
    shape.lineTo(-0.75, 1.68);
    shape.lineTo(1.8, 1.68);
    shape.lineTo(2.14, 0.96);
    shape.lineTo(2.16, 0.34);
    shape.closePath();
  } else {
    shape.moveTo(-2.12, 0.24);
    shape.lineTo(-2.16, 0.58);
    shape.lineTo(-1.25, 0.8);
    shape.lineTo(-0.6, 1.32);
    shape.lineTo(0.85, 1.32);
    shape.lineTo(1.6, 0.88);
    shape.lineTo(2.12, 0.82);
    shape.lineTo(2.14, 0.26);
    shape.closePath();
  }

  const carGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.72,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  carGeo.rotateY(-Math.PI / 2);
  carGeo.translate(0.86, 0, 0);
  const hull = new THREE.Mesh(carGeo, bodyMat);
  hull.castShadow = true;
  root.add(hull);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.56, isSafari ? 0.5 : 0.44, isSafari ? 2.35 : 1.75),
    glassMat,
  );
  glass.position.set(0, isSafari ? 1.36 : 1.08, 0.22);
  root.add(glass);

  if (isSafari) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.1, 2.0), trimMat);
    rack.position.set(0, 1.78, 0.38);
    root.add(rack);
  } else if (liveryIndex % 2 === 0) {
    const taxiBand = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.14, 4.18),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }),
    );
    taxiBand.position.set(0, 0.56, 0);
    root.add(taxiBand);
  }

  for (const hx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), headlightMat);
    hl.position.set(hx, 0.62, -2.2);
    root.add(hl);
  }

  const wr = isSafari ? 0.42 : 0.34;
  for (const z of [-1.28, 1.28]) {
    const wL = createSimpleWheel(wr, 0.24, tireMat, rimMat);
    wL.position.set(-0.92, wr, z);
    const wR = createSimpleWheel(wr, 0.24, tireMat, rimMat);
    wR.position.set(0.92, wr, z);
    root.add(wL, wR);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.08), brakeMat);
  tail.position.set(0, 0.68, 2.18);
  root.add(tail);

  return { root, brakeMat };
}
