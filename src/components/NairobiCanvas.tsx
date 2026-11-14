import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  CIRCUIT_CHECKPOINT_IDS,
  FINISH_LINE_LANDMARK,
  NAIROBI_LANDMARKS,
  computeWayfindingGuidance,
  findNearestStreetPose,
  isAtFinishLine,
  type NairobiLandmark,
  type VehiclePreset,
  type WayfindingGuidance,
} from '../game/nairobiMap';
import type { ControlSettings } from '../game/controlSettings';
import {
  createInitialPlayerState,
  getPreset,
  stepVehiclePhysics,
  type NitroPhase,
  type PlayerInput,
  type PlayerVehicleState,
} from '../game/physics';
import {
  computePlayerRacePosition,
  computeRivalDirectionTrackers,
  createRivalRacers,
  getCircuitNextTurnHint,
  stepRivalRacers,
  type CircuitTurnHint,
  type RivalDirectionTracker,
  type RivalRacer,
} from '../game/rivals';
import {
  createSignalPhase,
  createTrafficFleet,
  stepSignalPhase,
  stepTrafficFleet,
  type SignalPhase,
  type TrafficAgent,
  type TrafficArchetype,
} from '../game/traffic';
import {
  GHOST_SAMPLE_INTERVAL_SEC,
  sampleGhostPoseAtTime,
  type GhostLapRecording,
  type GhostSample,
} from '../game/ghost';
import { NairobiAudioEngine } from '../game/audio';
import type { WeatherCondition } from '../game/weather';
import { createNairobiTexturePack } from '../three/textures';
import {
  buildGhostVehicle,
  buildPlayerVehicle,
  buildRivalVehicle,
  buildTrafficVehicle,
  type GhostVehicleRig,
  type PlayerVehicleRig,
  type RivalVehicleRig,
  type TrafficVehicleRig,
} from '../three/vehicles';
import { buildNairobiWorld } from '../three/nairobiWorld';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'circuit' | 'free';
export type CameraViewMode = 'chase' | 'bumper' | 'hood' | 'aerial';

export interface HudTelemetry {
  x: number;
  z: number;
  heading: number;
  kmh: number;
  rpm: number;
  gear: string;
  nitro: number;
  nitroPhase: NitroPhase;
  nitroTimer: number;
  onFinalSprint: boolean;
  engineTemp: number; // 0..100
  isDrifting: boolean;
  isBoosting: boolean;
  driftScoreActive: number;
  totalDriftScore: number;
  nearMissCount: number;
  nearMissPopupTimer: number;
  countdownStage: number; // 3, 2, 1, 0 (GO!), -1 (hidden)
  countdownProgress: number; // 0..1 within current beat
  activeInputs: PlayerInput;
  racePosition: number;
  totalRacers: number;
  guidance: WayfindingGuidance;
  circuitTurnHint: CircuitTurnHint | null;
  rivalTrackers: RivalDirectionTracker[];
  checkpointIndex: number;
  totalCheckpoints: number;
  elapsedTime: number;
  topSpeedKmh: number;
  rivalPositions: Array<{ x: number; z: number; color: string }>;
  trafficPositions: Array<{ x: number; z: number; archetype: TrafficArchetype }>;
  ghostPosition: { x: number; z: number; heading: number } | null;
  ghostLapTime: number | null;
  weather: WeatherCondition;
}

export interface NairobiCanvasHandle {
  resetRun: (presetId: VehiclePreset['id'], mode: GameMode, skipCountdown?: boolean) => void;
  setTargetLandmark: (landmarkId: string) => void;
  teleportToLandmark: (landmarkId: string) => void;
  recoverToRoad: () => void;
  cycleCamera: () => CameraViewMode;
  setMuted: (muted: boolean) => void;
  honkHorn: () => void;
  triggerNitrous: () => void;
  setVirtualControl: (key: keyof PlayerInput, active: boolean) => void;
}

interface NairobiCanvasProps {
  phase: GamePhase;
  mode: GameMode;
  presetId: VehiclePreset['id'];
  muted: boolean;
  controlSettings: ControlSettings;
  bestGhost: GhostLapRecording | null;
  weather: WeatherCondition;
  onTelemetry: (telemetry: HudTelemetry) => void;
  onCheckpointReached: (
    landmark: NairobiLandmark,
    nextIndex: number,
    finishedCircuit: boolean,
    snapshot: {
      elapsedTime: number;
      topSpeedKmh: number;
      racePosition: number;
      totalRacers: number;
      totalDriftScore: number;
      ghostSamples: GhostSample[];
    },
  ) => void;
  onTogglePause: () => void;
  onToggleGuide: () => void;
  onToggleMute: () => void;
  onCycleWeather: () => void;
  onCameraChange: (cam: CameraViewMode) => void;
  onContextLossChange: (lost: boolean) => void;
}

const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const NairobiCanvas = forwardRef<NairobiCanvasHandle, NairobiCanvasProps>(
  function NairobiCanvas(props, ref) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    const inputRef = useRef<PlayerInput>({
      throttle: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      boost: false,
    });
    const virtualInputRef = useRef<PlayerInput>({
      throttle: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      boost: false,
    });
    const lookBackRef = useRef<boolean>(false);
    const nitroPulseRef = useRef<boolean>(false);

    const stateRef = useRef<{
      player: PlayerVehicleState;
      rivals: RivalRacer[];
      traffic: TrafficAgent[];
      signal: SignalPhase;
      cameraMode: CameraViewMode;
      targetLandmarkId: string;
      checkpointIdx: number;
      elapsedTime: number;
      topSpeedKmh: number;
      nearMissCount: number;
      nearMissCooldown: number;
      nearMissPopupTimer: number;
      countdownTimer: number;
      countdownStage: number; // 3, 2, 1, 0, -1
      goBannerTimer: number;
      hitstopTimer: number;
      trauma: number;
      skidAccum: number;
      ghostRecording: GhostSample[];
      lastGhostSampleTime: number;
      latestGhostPose: { x: number; z: number; heading: number } | null;
      audio: NairobiAudioEngine;
      rebuildPlayerMesh?: (presetId: VehiclePreset['id']) => void;
      resetRivalMeshes?: () => void;
    }>({
      player: createInitialPlayerState(props.presetId),
      rivals: createRivalRacers(),
      traffic: createTrafficFleet(),
      signal: createSignalPhase(),
      cameraMode: 'chase',
      targetLandmarkId: CIRCUIT_CHECKPOINT_IDS[0],
      checkpointIdx: 0,
      elapsedTime: 0,
      topSpeedKmh: 0,
      nearMissCount: 0,
      nearMissCooldown: 0,
      nearMissPopupTimer: 0,
      countdownTimer: 0,
      countdownStage: -1,
      goBannerTimer: 0,
      hitstopTimer: 0,
      trauma: 0,
      skidAccum: 0,
      ghostRecording: [],
      lastGhostSampleTime: -1,
      latestGhostPose: null,
      audio: new NairobiAudioEngine(),
    });

    useEffect(() => {
      stateRef.current.audio.setMuted(props.muted);
    }, [props.muted]);

    useEffect(() => {
      const s = stateRef.current;
      if (s.player.presetId !== props.presetId) {
        s.player.presetId = props.presetId;
        s.rebuildPlayerMesh?.(props.presetId);
      }
    }, [props.presetId]);

    useEffect(() => {
      if (props.phase === 'playing') {
        mountRef.current?.focus({ preventScroll: true });
      }
    }, [props.phase]);

    useImperativeHandle(ref, () => ({
      resetRun: (presetId: VehiclePreset['id'], mode: GameMode, skipCountdown = false) => {
        const s = stateRef.current;
        s.player = createInitialPlayerState(presetId);
        s.rivals = createRivalRacers();
        s.traffic = createTrafficFleet();
        s.signal = createSignalPhase();
        s.checkpointIdx = 0;
        s.targetLandmarkId =
          mode === 'circuit' ? CIRCUIT_CHECKPOINT_IDS[0] : NAIROBI_LANDMARKS[0].id;
        s.elapsedTime = 0;
        s.topSpeedKmh = 0;
        s.nearMissCount = 0;
        s.nearMissCooldown = 0;
        s.nearMissPopupTimer = 0;
        s.hitstopTimer = 0;
        s.trauma = 0;
        s.skidAccum = 0;
        s.ghostRecording = [];
        s.lastGhostSampleTime = -1;
        s.latestGhostPose = null;

        if (!skipCountdown) {
          s.countdownTimer = 3.0; // Full 1.0s per 3 -> 2 -> 1 -> GO! beat
          s.countdownStage = 3;
          s.goBannerTimer = 0;
          s.audio.playCountdownTone(false);
        } else {
          s.countdownTimer = 0;
          s.countdownStage = -1;
          s.goBannerTimer = 0;
        }

        s.rebuildPlayerMesh?.(presetId);
        s.resetRivalMeshes?.();
        s.audio.init();
        mountRef.current?.focus({ preventScroll: true });
      },
      setTargetLandmark: (landmarkId: string) => {
        stateRef.current.targetLandmarkId = landmarkId;
      },
      teleportToLandmark: (landmarkId: string) => {
        const lm = NAIROBI_LANDMARKS.find((l) => l.id === landmarkId);
        if (!lm) return;
        const s = stateRef.current;
        s.player.x = lm.waypointX - 20;
        s.player.z = lm.waypointZ;
        s.player.vx = 0;
        s.player.vz = 0;
        s.player.speed = 0;
        s.player.kmh = 0;
        s.player.heading = Math.atan2(lm.waypointX - s.player.x, -(lm.waypointZ - s.player.z));
        s.targetLandmarkId = lm.id;
      },
      recoverToRoad: () => {
        const s = stateRef.current;
        const lm =
          NAIROBI_LANDMARKS.find((l) => l.id === s.targetLandmarkId) ?? NAIROBI_LANDMARKS[0];
        const pose = findNearestStreetPose(s.player.x, s.player.z, lm.waypointX, lm.waypointZ);
        s.player.x = pose.x;
        s.player.z = pose.z;
        s.player.vx = 0;
        s.player.vz = 0;
        s.player.speed = 0;
        s.player.kmh = 0;
        s.player.heading = pose.heading;
      },
      cycleCamera: () => {
        const order: CameraViewMode[] = ['chase', 'bumper', 'hood', 'aerial'];
        const next = order[(order.indexOf(stateRef.current.cameraMode) + 1) % order.length];
        stateRef.current.cameraMode = next;
        propsRef.current.onCameraChange(next);
        return next;
      },
      setMuted: (muted: boolean) => {
        stateRef.current.audio.setMuted(muted);
      },
      honkHorn: () => {
        stateRef.current.audio.playMatatuHorn();
      },
      triggerNitrous: () => {
        if (stateRef.current.countdownTimer === 0 && stateRef.current.player.nitroPhase === 'ready') {
          nitroPulseRef.current = true;
        }
      },
      setVirtualControl: (key: keyof PlayerInput, active: boolean) => {
        virtualInputRef.current[key] = active;
      },
    }));

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setSize(
        container.clientWidth || window.innerWidth,
        container.clientHeight || window.innerHeight,
      );

      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.appendChild(renderer.domElement);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        propsRef.current.onContextLossChange(true);
      };
      const handleContextRestored = () => {
        propsRef.current.onContextLossChange(false);
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        60,
        (container.clientWidth || window.innerWidth) /
          (container.clientHeight || window.innerHeight),
        0.5,
        2400,
      );

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const textures = createNairobiTexturePack(maxAniso);
      const world = buildNairobiWorld(scene, renderer, textures, isSoftwareGl);

      // Player 3D Rig
      let playerRig: PlayerVehicleRig = buildPlayerVehicle(
        getPreset(stateRef.current.player.presetId),
        textures,
      );
      scene.add(playerRig.root);

      stateRef.current.rebuildPlayerMesh = (presetId: VehiclePreset['id']) => {
        scene.remove(playerRig.root);
        playerRig = buildPlayerVehicle(getPreset(presetId), textures);
        scene.add(playerRig.root);
      };

      // AI Rival 3D Rigs
      const rivalRigs: Map<string, RivalVehicleRig> = new Map();
      const buildRivalsScene = () => {
        for (const r of stateRef.current.rivals) {
          if (!rivalRigs.has(r.id)) {
            const rig = buildRivalVehicle(r.primaryColor, r.accentColor, r.plate, textures);
            scene.add(rig.root);
            rivalRigs.set(r.id, rig);
          }
          const rig = rivalRigs.get(r.id)!;
          rig.root.position.set(r.x, 0, r.z);
          rig.root.rotation.y = -r.heading;
        }
      };
      buildRivalsScene();
      stateRef.current.resetRivalMeshes = buildRivalsScene;

      // Ghost Best-Lap 3D Rig
      const ghostRig: GhostVehicleRig = buildGhostVehicle();
      ghostRig.root.visible = false;
      scene.add(ghostRig.root);

      // Traffic 3D Rigs
      const trafficRigs: Map<string, TrafficVehicleRig> = new Map();
      for (const agent of stateRef.current.traffic) {
        const rig = buildTrafficVehicle(agent.archetype, agent.liveryIndex, textures);
        rig.root.position.set(agent.x, 0, agent.z);
        rig.root.rotation.y = -agent.heading;
        scene.add(rig.root);
        trafficRigs.set(agent.id, rig);
      }

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      // Keyboard input listeners on window (supports both e.code and e.key across all layouts)
      const codesHeld = new Set<string>();
      const keysLowerHeld = new Set<string>();
      const syncInput = () => {
        const inp = inputRef.current;
        inp.throttle =
          codesHeld.has('KeyW') ||
          codesHeld.has('ArrowUp') ||
          codesHeld.has('Numpad8') ||
          keysLowerHeld.has('w') ||
          keysLowerHeld.has('arrowup');
        inp.brake =
          codesHeld.has('KeyS') ||
          codesHeld.has('ArrowDown') ||
          codesHeld.has('Numpad2') ||
          keysLowerHeld.has('s') ||
          keysLowerHeld.has('arrowdown');
        inp.left =
          codesHeld.has('KeyA') ||
          codesHeld.has('ArrowLeft') ||
          codesHeld.has('Numpad4') ||
          keysLowerHeld.has('a') ||
          keysLowerHeld.has('arrowleft');
        inp.right =
          codesHeld.has('KeyD') ||
          codesHeld.has('ArrowRight') ||
          codesHeld.has('Numpad6') ||
          keysLowerHeld.has('d') ||
          keysLowerHeld.has('arrowright');
        inp.drift = codesHeld.has('Space') || keysLowerHeld.has(' ');
        inp.boost =
          codesHeld.has('ShiftLeft') ||
          codesHeld.has('ShiftRight') ||
          codesHeld.has('KeyE') ||
          keysLowerHeld.has('shift');
        lookBackRef.current = codesHeld.has('KeyB') || keysLowerHeld.has('b');
      };

      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const lowerKey = e.key ? e.key.toLowerCase() : '';
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
          ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(lowerKey)
        ) {
          if (propsRef.current.phase === 'playing') {
            e.preventDefault();
          }
        }

        if (!e.repeat) {
          if (e.code === 'Escape' || e.code === 'KeyP' || lowerKey === 'p') {
            if (propsRef.current.phase === 'playing' || propsRef.current.phase === 'paused') {
              propsRef.current.onTogglePause();
              return;
            }
          }
          if (e.code === 'KeyM' || lowerKey === 'm') {
            propsRef.current.onToggleMute();
          } else if ((e.code === 'KeyG' || lowerKey === 'g') && propsRef.current.phase === 'playing') {
            propsRef.current.onToggleGuide();
          } else if ((e.code === 'KeyC' || lowerKey === 'c') && propsRef.current.phase === 'playing') {
            const order: CameraViewMode[] = ['chase', 'bumper', 'hood', 'aerial'];
            const next = order[(order.indexOf(stateRef.current.cameraMode) + 1) % order.length];
            stateRef.current.cameraMode = next;
            propsRef.current.onCameraChange(next);
          } else if ((e.code === 'KeyH' || lowerKey === 'h') && propsRef.current.phase === 'playing') {
            stateRef.current.audio.playMatatuHorn();
          } else if ((e.code === 'KeyR' || lowerKey === 'r') && propsRef.current.phase === 'playing') {
            const s = stateRef.current;
            const lm =
              NAIROBI_LANDMARKS.find((l) => l.id === s.targetLandmarkId) ?? NAIROBI_LANDMARKS[0];
            const pose = findNearestStreetPose(s.player.x, s.player.z, lm.waypointX, lm.waypointZ);
            s.player.x = pose.x;
            s.player.z = pose.z;
            s.player.vx = 0;
            s.player.vz = 0;
            s.player.speed = 0;
            s.player.kmh = 0;
            s.player.heading = pose.heading;
          } else if ((e.code === 'KeyN' || lowerKey === 'n') && propsRef.current.phase === 'playing') {
            const curIdx = NAIROBI_LANDMARKS.findIndex(
              (l) => l.id === stateRef.current.targetLandmarkId,
            );
            const nextLm = NAIROBI_LANDMARKS[(curIdx + 1) % NAIROBI_LANDMARKS.length];
            stateRef.current.targetLandmarkId = nextLm.id;
          } else if ((e.code === 'KeyT' || lowerKey === 't') && propsRef.current.phase === 'playing') {
            propsRef.current.onCycleWeather();
          }
        }

        if (e.code) codesHeld.add(e.code);
        if (lowerKey) keysLowerHeld.add(lowerKey);
        syncInput();
      };

      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code) codesHeld.delete(e.code);
        if (e.key) keysLowerHeld.delete(e.key.toLowerCase());
        syncInput();
      };

      const clearInputs = () => {
        codesHeld.clear();
        keysLowerHeld.clear();
        virtualInputRef.current = {
          throttle: false,
          brake: false,
          left: false,
          right: false,
          drift: false,
          boost: false,
        };
        lookBackRef.current = false;
        syncInput();
      };

      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('blur', clearInputs);
      const onVis = () => {
        if (document.hidden) clearInputs();
      };
      document.addEventListener('visibilitychange', onVis);

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(1, entry.contentRect.width);
          const h = Math.max(1, entry.contentRect.height);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      });
      resizeObserver.observe(container);

      let frameId = 0;
      let disposed = false;
      let lastTime = performance.now();
      let hudThrottle = 1.0;
      let titleTourTime = 0;
      let lastWeather: WeatherCondition = propsRef.current.weather;
      let lastNitroPhase: NitroPhase = stateRef.current.player.nitroPhase;

      // Initial chase camera framing looking down Kenyatta Avenue starting grid toward KICC!
      _camCurrentLook.set(-100, 3.5, -48);
      camera.position.set(-182, 6.2, -52);

      const combinedInput: PlayerInput = {
        throttle: false,
        brake: false,
        left: false,
        right: false,
        drift: false,
        boost: false,
      };

      const emitExhaustFlames = (
        x: number,
        z: number,
        heading: number,
        velocityX: number,
        velocityZ: number,
      ) => {
        const rearX = -Math.sin(heading);
        const rearZ = Math.cos(heading);
        const sideX = Math.cos(heading);
        const sideZ = Math.sin(heading);
        for (const side of [-1, 1]) {
          const directionX = rearX + sideX * (Math.random() - 0.5) * 0.06;
          const directionZ = rearZ + sideZ * (Math.random() - 0.5) * 0.06;
          world.spawnExhaustFlame(
            x + rearX * 2.62 + sideX * side * 0.52,
            0.31,
            z + rearZ * 2.62 + sideZ * side * 0.52,
            directionX,
            0.025 + Math.random() * 0.1,
            directionZ,
            velocityX * 0.86 + rearX * 9.5 + (Math.random() - 0.5) * 0.7,
            0.15 + Math.random() * 0.42,
            velocityZ * 0.86 + rearZ * 9.5 + (Math.random() - 0.5) * 0.7,
            0.58 + Math.random() * 0.26,
            0.16 + Math.random() * 0.1,
          );
        }
      };

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl.fenceSync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function tick() {
        if (disposed) return;

        const now = performance.now();
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

        const s = stateRef.current;
        const phase = propsRef.current.phase;
        const mode = propsRef.current.mode;

        combinedInput.throttle = inputRef.current.throttle || virtualInputRef.current.throttle;
        combinedInput.brake = inputRef.current.brake || virtualInputRef.current.brake;
        combinedInput.left = inputRef.current.left || virtualInputRef.current.left;
        combinedInput.right = inputRef.current.right || virtualInputRef.current.right;
        combinedInput.drift = inputRef.current.drift || virtualInputRef.current.drift;
        combinedInput.boost =
          inputRef.current.boost || virtualInputRef.current.boost || nitroPulseRef.current;
        nitroPulseRef.current = false;

        if (propsRef.current.weather !== lastWeather) {
          lastWeather = propsRef.current.weather;
          hudThrottle = 1.0;
        }
        if (s.player.nitroPhase !== lastNitroPhase) {
          lastNitroPhase = s.player.nitroPhase;
          hudThrottle = 1.0;
        }

        if (phase === 'title') {
          // Cinematic low-sweep orbit around the Kenyatta Avenue starting grid & Nairobi skyline!
          titleTourTime += dt;
          stepSignalPhase(s.signal, dt);
          world.updateSignals(s.signal);
          world.updateStartLights(3, false);
          world.updateRouteChevrons(titleTourTime, mode === 'circuit');
          world.updateExpresswayTraffic(dt);
          world.updateWeather(propsRef.current.weather, s.player.x, s.player.z, dt);
          stepTrafficFleet(s.traffic, s.signal, s.player, dt);

          const sweep = Math.sin(titleTourTime * 0.28) * 0.45;
          _camTargetPos.set(
            s.player.x - 10 + Math.cos(sweep) * 10,
            6.5 + Math.sin(titleTourTime * 0.5) * 1.4,
            s.player.z + Math.sin(sweep) * 18,
          );
          _camTargetLook.set(s.player.x + 36, 4.5, s.player.z + 3);
          const damp = 1 - Math.exp(-3.5 * dt);
          camera.position.lerp(_camTargetPos, damp);
          _camCurrentLook.lerp(_camTargetLook, damp);
          camera.lookAt(_camCurrentLook);
          s.audio.updateTelemetry(0, false, false, false);
        } else if (phase === 'playing') {
          world.updateExpresswayTraffic(dt);
          world.updateWeather(propsRef.current.weather, s.player.x, s.player.z, dt);
          stepSignalPhase(s.signal, dt);
          world.updateSignals(s.signal);

          // Handle 3-2-1-GO countdown (1.0s per digit, immediate HUD flush on every stage change)
          const countdownStep = Math.min(0.35, Math.max(0.001, rawDt));
          if (s.countdownTimer > 0) {
            const prevStage = s.countdownStage;
            s.countdownTimer = Math.max(0, s.countdownTimer - countdownStep);
            const nextStage =
              s.countdownTimer > 2.0 ? 3 : s.countdownTimer > 1.0 ? 2 : s.countdownTimer > 0 ? 1 : 0;
            if (nextStage !== prevStage) {
              s.countdownStage = nextStage;
              s.audio.playCountdownTone(nextStage === 0);
              hudThrottle = 1.0; // Flush HUD immediately when 3/2/1/GO changes
            }
            if (s.countdownTimer === 0) {
              s.countdownStage = 0;
              s.goBannerTimer = 0.95;
              hudThrottle = 1.0;
              // Launch RPM burst if holding accelerate, or smooth auto-drive pull-away on GO!
              if (combinedInput.throttle || propsRef.current.controlSettings.autoDrive) {
                const launchSpeed = combinedInput.throttle ? 18 : 10;
                s.player.vx = Math.sin(s.player.heading) * launchSpeed;
                s.player.vz = -Math.cos(s.player.heading) * launchSpeed;
              }
            }
            // Allow live front wheel turn & engine revving + chassis squat on grid
            const steerDir = (combinedInput.right ? 1 : 0) - (combinedInput.left ? 1 : 0);
            const steerSens = propsRef.current.controlSettings.steeringSensitivity;
            s.player.steerAngle +=
              (steerDir * Math.min(0.62, 0.46 * Math.sqrt(steerSens)) - s.player.steerAngle) *
              Math.min(1, 14 * steerSens * dt);
            const targetRpm = combinedInput.throttle ? (combinedInput.boost ? 7600 : 6900) : 1200;
            s.player.rpm += Math.round((targetRpm - s.player.rpm) * Math.min(1, 10 * dt));
            s.player.bodyPitch = combinedInput.throttle ? -0.025 + Math.sin(now * 0.06) * 0.006 : 0;
            if (combinedInput.throttle) {
              s.player.engineTemp = Math.min(100, s.player.engineTemp + 8 * dt);
            } else {
              s.player.engineTemp = Math.max(12, s.player.engineTemp - 5 * dt);
            }
            world.updateStartLights(s.countdownStage, true);
            world.updateRouteChevrons(now * 0.001, mode === 'circuit');
          } else {
            if (s.goBannerTimer > 0) {
              s.goBannerTimer = Math.max(0, s.goBannerTimer - countdownStep);
              if (s.goBannerTimer === 0) {
                s.countdownStage = -1;
                hudThrottle = 1.0;
              }
            }
            world.updateStartLights(0, s.goBannerTimer > 0);

            if (s.hitstopTimer > 0) {
              s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
            } else {
              s.elapsedTime += dt;

              const physRes = stepVehiclePhysics(
                s.player,
                combinedInput,
                dt,
                undefined,
                propsRef.current.controlSettings,
                propsRef.current.weather,
              );
              const trafficRes = stepTrafficFleet(s.traffic, s.signal, s.player, dt);
              const rivalRes =
                mode === 'circuit'
                  ? stepRivalRacers(s.rivals, s.player, s.elapsedTime, dt)
                  : { playerCollisionImpact: 0 };

              if (
                mode === 'circuit' &&
                (s.lastGhostSampleTime < 0 ||
                  s.elapsedTime - s.lastGhostSampleTime >= GHOST_SAMPLE_INTERVAL_SEC)
              ) {
                s.lastGhostSampleTime = s.elapsedTime;
                s.ghostRecording.push({
                  t: Number(s.elapsedTime.toFixed(2)),
                  x: Number(s.player.x.toFixed(2)),
                  z: Number(s.player.z.toFixed(2)),
                  heading: Number(s.player.heading.toFixed(3)),
                });
              }

              const maxImpact = Math.max(
                physRes.impactSpeed,
                trafficRes.playerCollisionImpact,
                rivalRes.playerCollisionImpact,
              );

              if (maxImpact > 7.5) {
                s.trauma = Math.min(1, s.trauma + Math.min(0.85, maxImpact * 0.032));
                s.audio.playCollisionThud(maxImpact);
                if (maxImpact > 17) {
                  s.hitstopTimer = 0.04;
                }
                for (let k = 0; k < 12; k++) {
                  world.spawnParticle(
                    physRes.collided ? physRes.impactX : s.player.x,
                    0.75,
                    physRes.collided ? physRes.impactZ : s.player.z,
                    (Math.random() - 0.5) * 16,
                    3 + Math.random() * 7,
                    (Math.random() - 0.5) * 16,
                    0.5,
                    0.42,
                    1.0,
                    0.72,
                    0.18,
                  );
                }
              }

              // Near-Miss detection against Nairobi traffic at racing speed (> 80 km/h)
              if (s.nearMissCooldown > 0) s.nearMissCooldown = Math.max(0, s.nearMissCooldown - dt);
              if (s.nearMissPopupTimer > 0) s.nearMissPopupTimer = Math.max(0, s.nearMissPopupTimer - dt);
              if (s.player.kmh > 80 && s.nearMissCooldown === 0 && maxImpact === 0) {
                for (const agent of s.traffic) {
                  const nd = Math.hypot(s.player.x - agent.x, s.player.z - agent.z);
                  if (nd < agent.radius + 3.4) {
                    s.nearMissCount++;
                    s.nearMissCooldown = 1.4;
                    s.nearMissPopupTimer = 1.3;
                    if (s.player.nitroPhase === 'cooldown') {
                      s.player.nitroTimer = Math.max(0.05, s.player.nitroTimer - 1.0);
                    }
                    s.player.totalDriftScore += 150;
                    s.audio.playNearMissChime();
                    break;
                  }
                }
              }

              if (s.player.kmh > s.topSpeedKmh) {
                s.topSpeedKmh = s.player.kmh;
              }

              // Tire skidmarks & drift smoke
              if (s.player.isDrifting || (s.player.isBraking && s.player.kmh > 65)) {
                s.skidAccum += Math.abs(s.player.speed) * dt;
                if (s.skidAccum > 0.7) {
                  s.skidAccum = 0;
                  const rx = Math.cos(s.player.heading) * 0.92;
                  const rz = Math.sin(s.player.heading) * 0.92;
                  const backX = -Math.sin(s.player.heading) * 1.35;
                  const backZ = Math.cos(s.player.heading) * 1.35;
                  world.spawnSkidmark(s.player.x + backX - rx, s.player.z + backZ - rz, s.player.heading);
                  world.spawnSkidmark(s.player.x + backX + rx, s.player.z + backZ + rz, s.player.heading);
                }
                const heading = s.player.heading;
                const forwardX = Math.sin(heading);
                const forwardZ = -Math.cos(heading);
                const rightX = Math.cos(heading);
                const rightZ = Math.sin(heading);
                const rearX = -forwardX * 1.85;
                const rearZ = -forwardZ * 1.85;
                const lateralSpeed = s.player.vx * rightX + s.player.vz * rightZ;
                const smokeRate = s.player.isDrifting ? 28 : 10;
                if (Math.random() < 1 - Math.exp(-smokeRate * dt)) {
                  const smokeBase = propsRef.current.weather === 'rainy' ? 0.86 : 0.76;
                  for (const side of [-1, 1]) {
                    world.spawnTireSmoke(
                      s.player.x + rearX + rightX * side * 0.98,
                      0.4 + Math.random() * 0.08,
                      s.player.z + rearZ + rightZ * side * 0.98,
                      s.player.vx * 0.14 - rightX * lateralSpeed * 0.2 - forwardX * 2 +
                        (Math.random() - 0.5) * 0.7,
                      0.72 + Math.random() * 0.58,
                      s.player.vz * 0.14 - rightZ * lateralSpeed * 0.2 - forwardZ * 2 +
                        (Math.random() - 0.5) * 0.7,
                      s.player.isDrifting ? 0.72 + Math.random() * 0.42 : 0.52 + Math.random() * 0.28,
                      s.player.isDrifting ? 1.02 + Math.random() * 0.42 : 0.7 + Math.random() * 0.28,
                      smokeBase,
                      smokeBase + 0.035,
                      smokeBase + 0.07,
                    );
                  }
                }
              }

              // Wet tire water spray rooster-tails during Nairobi Rain
              if (
                propsRef.current.weather === 'rainy' &&
                Math.abs(s.player.speed) > 12 &&
                Math.random() < 0.72
              ) {
                const sideOffset = (Math.random() < 0.5 ? -1 : 1) * 0.9;
                const wx =
                  s.player.x -
                  Math.sin(s.player.heading) * 1.65 +
                  Math.cos(s.player.heading) * sideOffset;
                const wz =
                  s.player.z +
                  Math.cos(s.player.heading) * 1.65 +
                  Math.sin(s.player.heading) * sideOffset;
                world.spawnParticle(
                  wx,
                  0.2,
                  wz,
                  -Math.sin(s.player.heading) * 3.5 + (Math.random() - 0.5) * 2,
                  1.5 + Math.random() * 1.5,
                  Math.cos(s.player.heading) * 3.5 + (Math.random() - 0.5) * 2,
                  0.45,
                  0.26,
                  0.72,
                  0.82,
                  0.92,
                );
              }
            }
          }

          s.audio.updateTelemetry(
            s.countdownTimer > 0 && combinedInput.throttle ? 38 : Math.abs(s.player.speed),
            s.player.isDrifting,
            s.player.isBoosting,
            true,
          );

          const exhaustEmissionChance = 1 - Math.exp(-22 * dt);
          if (s.player.isBoosting && Math.random() < exhaustEmissionChance) {
            emitExhaustFlames(s.player.x, s.player.z, s.player.heading, s.player.vx, s.player.vz);
          }

          // Update player vehicle 3D rig
          playerRig.root.position.set(s.player.x, 0, s.player.z);
          playerRig.root.rotation.y = -s.player.heading;
          playerRig.bodyGroup.rotation.z = -s.player.bodyRoll;
          playerRig.bodyGroup.rotation.x = s.player.bodyPitch;
          playerRig.frontLeftSteer.rotation.y = -s.player.steerAngle;
          playerRig.frontRightSteer.rotation.y = -s.player.steerAngle;
          for (const wg of playerRig.wheelSpinGroups) {
            wg.rotation.x = -s.player.wheelSpin;
          }
          playerRig.brakeLightsMat.emissiveIntensity =
            combinedInput.brake || s.player.isDrifting ? 2.8 : 0.75;
          playerRig.boostFlameLeft.visible = s.player.isBoosting;
          playerRig.boostFlameRight.visible = s.player.isBoosting;
          const playerLeftPulse = 0.5 + 0.5 * Math.sin(s.elapsedTime * 72);
          const playerRightPulse = 0.5 + 0.5 * Math.sin(s.elapsedTime * 79 + 0.9);
          playerRig.boostFlameLeft.scale.set(0.9, 0.9, 0.74 + playerLeftPulse * 0.58);
          playerRig.boostFlameRight.scale.set(0.9, 0.9, 0.74 + playerRightPulse * 0.58);
          playerRig.boostFlameLeft.rotation.x = Math.sin(s.elapsedTime * 31) * 0.035;
          playerRig.boostFlameRight.rotation.x = Math.cos(s.elapsedTime * 35) * 0.035;

          // Sync Rival 3D Rigs
          for (const r of s.rivals) {
            const rig = rivalRigs.get(r.id);
            if (!rig) continue;
            rig.root.visible = mode === 'circuit';
            rig.root.position.set(r.x, 0, r.z);
            rig.root.rotation.y = -r.heading;
            for (const wg of rig.wheelSpinGroups) {
              wg.rotation.x = -r.wheelSpin;
            }
            rig.brakeLightsMat.emissiveIntensity = r.isBraking ? 2.5 : 0.7;
            rig.boostFlameLeft.visible = r.isBoosting;
            rig.boostFlameRight.visible = r.isBoosting;
            const rivalFlamePulse = 0.5 + 0.5 * Math.sin(s.elapsedTime * 74 + r.x * 0.07);
            rig.boostFlameLeft.scale.set(0.9, 0.9, 0.74 + rivalFlamePulse * 0.58);
            rig.boostFlameRight.scale.set(0.9, 0.9, 0.74 + (1 - rivalFlamePulse) * 0.58);
            if (r.isBoosting && Math.random() < exhaustEmissionChance) {
              emitExhaustFlames(
                r.x,
                r.z,
                r.heading,
                Math.sin(r.heading) * r.speed,
                -Math.cos(r.heading) * r.speed,
              );
            }
          }

          // Sync Best-Lap Translucent Ghost Racer
          const activeGhost = propsRef.current.bestGhost;
          if (mode === 'circuit' && activeGhost && s.countdownTimer === 0) {
            const ghostPose = sampleGhostPoseAtTime(activeGhost.samples, s.elapsedTime);
            if (ghostPose) {
              s.latestGhostPose = ghostPose;
              ghostRig.root.visible = true;
              ghostRig.root.position.set(ghostPose.x, 0, ghostPose.z);
              ghostRig.root.rotation.y = -ghostPose.heading;
              ghostRig.haloMat.opacity = 0.28 + 0.16 * Math.sin(s.elapsedTime * 5.2);
              for (const wg of ghostRig.wheelSpinGroups) {
                wg.rotation.x -= dt * 22;
              }
            } else {
              s.latestGhostPose = null;
              ghostRig.root.visible = false;
            }
          } else {
            s.latestGhostPose = null;
            ghostRig.root.visible = false;
          }

          world.sunLight.target.position.set(s.player.x, 0, s.player.z);
          world.sunLight.position.set(s.player.x + 115, 165, s.player.z - 95);

          // Active waypoint, checkpoint, & Finish Line detection
          const onFinalSprint =
            mode === 'circuit' && s.checkpointIdx >= CIRCUIT_CHECKPOINT_IDS.length;
          const targetLm = onFinalSprint
            ? FINISH_LINE_LANDMARK
            : (NAIROBI_LANDMARKS.find((l) => l.id === s.targetLandmarkId) ?? NAIROBI_LANDMARKS[0]);
          const guidance = computeWayfindingGuidance(
            s.player.x,
            s.player.z,
            s.player.heading,
            targetLm,
          );
          world.setBeaconPosition(targetLm.waypointX, targetLm.waypointZ, s.elapsedTime);
          world.setFinishLineActive(onFinalSprint, s.elapsedTime);

          const standing = computePlayerRacePosition(
            s.player.x,
            s.player.z,
            s.checkpointIdx,
            s.rivals,
          );

          const reachedTarget = onFinalSprint
            ? isAtFinishLine(s.player.x, s.player.z) || guidance.arrived
            : guidance.arrived;

          if (reachedTarget) {
            s.audio.playCheckpointChime();
            for (let k = 0; k < (onFinalSprint ? 36 : 20); k++) {
              world.spawnParticle(
                targetLm.waypointX + (Math.random() - 0.5) * (onFinalSprint ? 10 : 2),
                1.5,
                targetLm.waypointZ,
                (Math.random() - 0.5) * 18,
                5 + Math.random() * 10,
                (Math.random() - 0.5) * 18,
                onFinalSprint ? 0.95 : 0.75,
                0.85,
                onFinalSprint && k % 2 === 0 ? 0.16 : 0.98,
                onFinalSprint && k % 2 === 0 ? 0.92 : 0.76,
                0.24,
              );
            }

            if (mode === 'circuit') {
              if (onFinalSprint) {
                s.checkpointIdx = CIRCUIT_CHECKPOINT_IDS.length + 1;
                s.ghostRecording.push({
                  t: Number(s.elapsedTime.toFixed(2)),
                  x: Number(s.player.x.toFixed(2)),
                  z: Number(s.player.z.toFixed(2)),
                  heading: Number(s.player.heading.toFixed(3)),
                });
                propsRef.current.onCheckpointReached(
                  FINISH_LINE_LANDMARK,
                  CIRCUIT_CHECKPOINT_IDS.length,
                  true,
                  {
                    elapsedTime: s.elapsedTime,
                    topSpeedKmh: s.topSpeedKmh,
                    racePosition: standing.position,
                    totalRacers: standing.totalRacers,
                    totalDriftScore: s.player.totalDriftScore + s.player.driftScoreActive,
                    ghostSamples: s.ghostRecording.slice(),
                  },
                );
              } else {
                const nextIdx = s.checkpointIdx + 1;
                s.checkpointIdx = nextIdx;
                if (nextIdx < CIRCUIT_CHECKPOINT_IDS.length) {
                  s.targetLandmarkId = CIRCUIT_CHECKPOINT_IDS[nextIdx];
                } else {
                  s.targetLandmarkId = FINISH_LINE_LANDMARK.id;
                }
                propsRef.current.onCheckpointReached(targetLm, s.checkpointIdx, false, {
                  elapsedTime: s.elapsedTime,
                  topSpeedKmh: s.topSpeedKmh,
                  racePosition: standing.position,
                  totalRacers: standing.totalRacers,
                  totalDriftScore: s.player.totalDriftScore + s.player.driftScoreActive,
                  ghostSamples: [],
                });
              }
            } else {
              const idx = NAIROBI_LANDMARKS.findIndex((l) => l.id === targetLm.id);
              const nextLm = NAIROBI_LANDMARKS[(idx + 1) % NAIROBI_LANDMARKS.length];
              s.targetLandmarkId = nextLm.id;
              propsRef.current.onCheckpointReached(targetLm, idx + 1, false, {
                elapsedTime: s.elapsedTime,
                topSpeedKmh: s.topSpeedKmh,
                racePosition: 1,
                totalRacers: 1,
                totalDriftScore: s.player.totalDriftScore + s.player.driftScoreActive,
                ghostSamples: [],
              });
            }
          }

          // Camera tracking + Rearview look-back [B] + speed FOV kick + trauma shake
          const fx = Math.sin(s.player.heading);
          const fz = -Math.cos(s.player.heading);
          const dirSign = lookBackRef.current ? -1 : 1;

          if (s.cameraMode === 'bumper') {
            _camTargetPos.set(s.player.x + fx * 2.2 * dirSign, 0.95, s.player.z + fz * 2.2 * dirSign);
            _camTargetLook.set(s.player.x + fx * 38 * dirSign, 1.15, s.player.z + fz * 38 * dirSign);
          } else if (s.cameraMode === 'hood') {
            _camTargetPos.set(s.player.x + fx * 0.9 * dirSign, 1.85, s.player.z + fz * 0.9 * dirSign);
            _camTargetLook.set(s.player.x + fx * 34 * dirSign, 1.65, s.player.z + fz * 34 * dirSign);
          } else if (s.cameraMode === 'aerial') {
            _camTargetPos.set(s.player.x - fx * 26, 62, s.player.z - fz * 26);
            _camTargetLook.set(s.player.x + fx * 16, 0, s.player.z + fz * 16);
          } else {
            const camDist = 9.4 + Math.min(3.6, Math.abs(s.player.speed) * 0.055);
            _camTargetPos.set(
              s.player.x - fx * camDist * dirSign,
              3.75 + Math.min(1.2, Math.abs(s.player.speed) * 0.02),
              s.player.z - fz * camDist * dirSign,
            );
            _camTargetLook.set(
              s.player.x + fx * 15 * dirSign,
              1.65,
              s.player.z + fz * 15 * dirSign,
            );
          }

          const camLambda = s.cameraMode === 'bumper' || s.cameraMode === 'hood' ? 28 : 11;
          const camDamp = 1 - Math.exp(-camLambda * dt);
          camera.position.lerp(_camTargetPos, camDamp);
          _camCurrentLook.lerp(_camTargetLook, camDamp);

          if (s.trauma > 0) {
            const shake = s.trauma * s.trauma * 0.55;
            camera.position.x += (Math.random() - 0.5) * shake;
            camera.position.y += (Math.random() - 0.5) * shake * 0.7;
            s.trauma = Math.max(0, s.trauma - 2.4 * dt);
          }

          camera.lookAt(_camCurrentLook);

          const targetFov =
            s.cameraMode === 'aerial'
              ? 55
              : 58 +
                Math.min(13, (Math.abs(s.player.speed) / 60) * 11) +
                (s.player.isBoosting ? 7 : 0);
          if (Math.abs(camera.fov - targetFov) > 0.05) {
            camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-8 * dt));
            camera.updateProjectionMatrix();
          }

          world.updateParticles(dt, camera.quaternion);
          world.updateRouteChevrons(s.elapsedTime, mode === 'circuit');

          // Throttled HUD telemetry (~15Hz, immediate on countdown transitions)
          hudThrottle += dt;
          if (hudThrottle >= 0.065 || s.countdownStage >= 0) {
            if (hudThrottle >= 0.065) hudThrottle = 0;
            const beatRemainder =
              s.countdownStage > 0
                ? s.countdownTimer - (s.countdownStage - 1)
                : s.countdownStage === 0
                  ? s.goBannerTimer / 0.95
                  : 0;
            const rivalTrackers =
              mode === 'circuit'
                ? computeRivalDirectionTrackers(
                    s.player.x,
                    s.player.z,
                    s.player.heading,
                    s.checkpointIdx,
                    s.rivals,
                  )
                : [];
            const circuitTurnHint =
              mode === 'circuit'
                ? getCircuitNextTurnHint(
                    s.player.x,
                    s.player.z,
                    s.player.heading,
                    s.checkpointIdx,
                  )
                : null;
            propsRef.current.onTelemetry({
              x: s.player.x,
              z: s.player.z,
              heading: s.player.heading,
              kmh: s.player.kmh,
              rpm: s.player.rpm,
              gear: s.player.gear,
              nitro: s.player.nitro,
              nitroPhase: s.player.nitroPhase,
              nitroTimer: s.player.nitroTimer,
              onFinalSprint,
              engineTemp: s.player.engineTemp,
              isDrifting: s.player.isDrifting,
              isBoosting: s.player.isBoosting,
              driftScoreActive: s.player.driftScoreActive,
              totalDriftScore: s.player.totalDriftScore,
              nearMissCount: s.nearMissCount,
              nearMissPopupTimer: s.nearMissPopupTimer,
              countdownStage: s.countdownStage,
              countdownProgress: Math.max(0, Math.min(1, beatRemainder)),
              activeInputs: { ...combinedInput },
              racePosition: standing.position,
              totalRacers: standing.totalRacers,
              guidance,
              circuitTurnHint,
              rivalTrackers,
              checkpointIndex: Math.min(s.checkpointIdx, CIRCUIT_CHECKPOINT_IDS.length),
              totalCheckpoints: CIRCUIT_CHECKPOINT_IDS.length,
              elapsedTime: s.elapsedTime,
              topSpeedKmh: s.topSpeedKmh,
              rivalPositions:
                mode === 'circuit'
                  ? s.rivals.map((r) => ({
                      x: r.x,
                      z: r.z,
                      color: '#' + r.primaryColor.toString(16).padStart(6, '0'),
                    }))
                  : [],
              trafficPositions: s.traffic.map((t) => ({
                x: t.x,
                z: t.z,
                archetype: t.archetype,
              })),
              ghostPosition: s.latestGhostPose,
              ghostLapTime:
                mode === 'circuit' && propsRef.current.bestGhost
                  ? propsRef.current.bestGhost.lapTimeSeconds
                  : null,
              weather: propsRef.current.weather,
            });
          }
        } else {
          s.audio.updateTelemetry(0, false, false, false);
        }

        // Sync player & rival positions even when on Title screen
        if (phase === 'title') {
          ghostRig.root.visible = false;
          playerRig.root.position.set(s.player.x, 0, s.player.z);
          playerRig.root.rotation.y = -s.player.heading;
          for (const r of s.rivals) {
            const rig = rivalRigs.get(r.id);
            if (!rig) continue;
            rig.root.visible = mode === 'circuit';
            rig.root.position.set(r.x, 0, r.z);
            rig.root.rotation.y = -r.heading;
          }
        }

        // Sync 3D traffic transforms every frame
        for (const agent of s.traffic) {
          const rig = trafficRigs.get(agent.id);
          if (!rig) continue;
          rig.root.position.set(agent.x, 0, agent.z);
          rig.root.rotation.y = -agent.heading;
          rig.brakeMat.emissiveIntensity = agent.braking ? 2.2 : 0.35;
        }

        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      }

      if (isSoftwareGl) {
        renderer.render(scene, camera);
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', clearInputs);
        document.removeEventListener('visibilitychange', onVis);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
        stateRef.current.audio.dispose();
        world.dispose();
        textures.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    }, []);

    return (
      <div
        ref={mountRef}
        tabIndex={-1}
        onPointerDown={() => mountRef.current?.focus({ preventScroll: true })}
        data-testid="nairobi-webgl-mount"
        className="fixed inset-0 w-full h-full bg-[#0f1419] outline-none"
      />
    );
  },
);
