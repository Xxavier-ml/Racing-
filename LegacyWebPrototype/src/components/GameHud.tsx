import { useState } from 'react';
import {
  ArrowUp,
  Camera,
  CloudFog,
  CloudRain,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Flame,
  Gamepad2,
  Map as MapIcon,
  Maximize2,
  Megaphone,
  Minimize2,
  Navigation,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Thermometer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CBD_BUILDING_BLOCKS,
  CIRCUIT_CHECKPOINT_IDS,
  CIRCUIT_RACING_WAYPOINTS,
  FINISH_LINE,
  NAIROBI_LANDMARKS,
  NAIROBI_ROUNDABOUTS,
  NAIROBI_STREETS,
  type NairobiLandmark,
} from '../game/nairobiMap';
import {
  NITRO_ACTIVE_DURATION,
  NITRO_COOLDOWN_DURATION,
  type PlayerInput,
} from '../game/physics';
import type { RelativeDirection } from '../game/rivals';
import { getWeatherProfile, type WeatherCondition } from '../game/weather';
import type { CameraViewMode, GameMode, HudTelemetry } from './NairobiCanvas';

interface GameHudProps {
  telemetry: HudTelemetry | null;
  mode: GameMode;
  cameraMode: CameraViewMode;
  weather: WeatherCondition;
  muted: boolean;
  showTouchControls: boolean;
  autoDrive: boolean;
  arrivalBanner: NairobiLandmark | null;
  onCycleCamera: () => void;
  onCycleWeather: () => void;
  onToggleTouchControls: () => void;
  onOpenSettings: () => void;
  onRecoverRoad: () => void;
  onToggleGuide: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onHonkHorn: () => void;
  onNextLandmark: () => void;
  onTriggerNitrous: () => void;
  onVirtualControl: (key: keyof PlayerInput, active: boolean) => void;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1ST';
  if (n === 2) return '2ND';
  if (n === 3) return '3RD';
  return `${n}TH`;
}

const GAUGE_MIN_DEG = 145;
const GAUGE_SWEEP_DEG = 250;
const GAUGE_MAX_KMH = 320;
const SPEED_TICKS = Array.from({ length: 33 }, (_, i) => i * 10);

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg <= startDeg + 0.25) return '';
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function GameHud({
  telemetry,
  mode,
  cameraMode,
  weather,
  muted,
  showTouchControls,
  autoDrive,
  arrivalBanner,
  onCycleCamera,
  onCycleWeather,
  onToggleTouchControls,
  onOpenSettings,
  onRecoverRoad,
  onToggleGuide,
  onToggleMute,
  onTogglePause,
  onHonkHorn,
  onNextLandmark,
  onTriggerNitrous,
  onVirtualControl,
}: GameHudProps) {
  const [minimapExpanded, setMinimapExpanded] = useState(false);

  const weatherProfile = getWeatherProfile(weather);
  const gripPercent = Math.round(weatherProfile.gripMultiplier * 100);
  const guidance = telemetry?.guidance;
  const distRounded = guidance ? Math.round(guidance.distanceMeters) : 0;
  const bearingDeg = guidance ? Math.round((guidance.bearingDeltaRad * 180) / Math.PI) : 0;
  const kmh = telemetry ? telemetry.kmh : 0;
  const rpm = telemetry ? telemetry.rpm : 950;
  const nitroPct = telemetry ? Math.round(telemetry.nitro) : 100;
  const nitroPhase = telemetry?.nitroPhase ?? 'ready';
  const nitroTimer = telemetry?.nitroTimer ?? 0;
  const nitroProgressPct =
    nitroPhase === 'active'
      ? Math.max(0, Math.min(100, Math.round((nitroTimer / NITRO_ACTIVE_DURATION) * 100)))
      : nitroPhase === 'cooldown'
        ? Math.max(0, Math.min(100, Math.round((1 - nitroTimer / NITRO_COOLDOWN_DURATION) * 100)))
        : 100;
  const onFinalSprint = Boolean(telemetry?.onFinalSprint);
  const engineTemp = telemetry ? Math.round(telemetry.engineTemp) : 12;
  const engineTempCelsius = Math.round(65 + engineTemp * 0.6);
  const engineTempState =
    engineTemp >= 88 ? 'PEAK HEAT' : engineTemp >= 68 ? 'HOT' : engineTemp >= 40 ? 'WARM' : 'COOL';
  const countdown = telemetry?.countdownStage ?? -1;

  const circuitRoutePoints = CIRCUIT_RACING_WAYPOINTS.map((wp) => `${wp.x},${wp.z}`).join(' ');
  const rivalTrackers = telemetry?.rivalTrackers ?? [];
  const leftWingRival = rivalTrackers.find(
    (r) => r.directionLabel === 'LEFT' && r.distanceMeters >= 28,
  );
  const rightWingRival = rivalTrackers.find(
    (r) => r.directionLabel === 'RIGHT' && r.distanceMeters >= 28,
  );
  const activeTurnDir: RelativeDirection =
    telemetry?.circuitTurnHint?.direction ??
    (bearingDeg > 30 ? 'RIGHT' : bearingDeg < -30 ? 'LEFT' : Math.abs(bearingDeg) > 140 ? 'BEHIND' : 'AHEAD');
  const isWrongWay = Boolean(
    telemetry?.circuitTurnHint?.isWrongWay || (mode === 'free' && Math.abs(bearingDeg) > 135),
  );
  const turnActionLabel = isWrongWay
    ? 'WRONG WAY · U-TURN'
    : activeTurnDir === 'RIGHT'
      ? 'TURN RIGHT'
      : activeTurnDir === 'LEFT'
        ? 'TURN LEFT'
        : activeTurnDir === 'BEHIND'
          ? 'U-TURN'
          : 'STRAIGHT';
  const activeTurnStreet =
    telemetry?.circuitTurnHint?.streetName ?? guidance?.nextTurnStreet ?? 'Kenyatta Avenue';
  const activeTurnDist =
    telemetry?.circuitTurnHint?.distanceMeters ?? Math.round(guidance?.distToTurnMeters ?? distRounded);

  // Dynamic Circular Velocity Gauge + Inner RPM Micro-Ring Math
  const speedRatio = Math.min(1, Math.max(0, kmh / GAUGE_MAX_KMH));
  const speedAngleDeg = GAUGE_MIN_DEG + GAUGE_SWEEP_DEG * speedRatio;
  const rpmRatio = Math.min(1, Math.max(0, (rpm - 800) / 7700));
  const rpmAngleDeg = GAUGE_MIN_DEG + GAUGE_SWEEP_DEG * rpmRatio;

  const speedTrackPath = describeArc(100, 100, 84, GAUGE_MIN_DEG, GAUGE_MIN_DEG + GAUGE_SWEEP_DEG);
  const speedFillPath = describeArc(100, 100, 84, GAUGE_MIN_DEG, speedAngleDeg);
  const redlineTrackPath = describeArc(
    100,
    100,
    84,
    GAUGE_MIN_DEG + GAUGE_SWEEP_DEG * (240 / GAUGE_MAX_KMH),
    GAUGE_MIN_DEG + GAUGE_SWEEP_DEG,
  );
  const rpmTrackPath = describeArc(100, 100, 44, GAUGE_MIN_DEG, GAUGE_MIN_DEG + GAUGE_SWEEP_DEG);
  const rpmFillPath = describeArc(100, 100, 44, GAUGE_MIN_DEG, rpmAngleDeg);

  const activeInputs = telemetry?.activeInputs;
  const countdownProgress = telemetry?.countdownProgress ?? 1;
  const countdownScale =
    countdown >= 0 ? 1 + (countdown === 0 ? 0.14 : Math.max(0, countdownProgress - 0.5) * 0.45) : 1;

  const bindPad = (key: keyof PlayerInput) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onVirtualControl(key, true);
    },
    onPointerUp: () => onVirtualControl(key, false),
    onPointerCancel: () => onVirtualControl(key, false),
  });

  return (
    <div className="race-hud-screen fixed inset-0 z-10 pointer-events-none p-2.5 sm:p-3.5 md:p-5 flex flex-col justify-between">
      {/* Top Row: Minimap Overlay (Left) | Race Telemetry & Direction Strip (Center, wraps cleanly below on <lg) | Utility Buttons (Right) */}
      <div className="flex flex-wrap lg:flex-nowrap items-start justify-between gap-2 sm:gap-3">
        {/* Top-Left: Enhanced City Layout & Upcoming Checkpoints Minimap Overlay + Turn-by-Turn GPS */}
        <div
          className={`order-1 flex items-start gap-2 sm:gap-2.5 pointer-events-auto min-w-0 lg:shrink-0 ${
            minimapExpanded ? 'flex-col' : 'flex-row'
          }`}
        >
          <div
            data-testid="minimap-overlay"
            className={`race-glass-panel rounded-xl bg-[#0c1117]/94 border border-white/15 p-1.5 shadow-xl shrink-0 flex flex-col transition-all duration-150 ${
              minimapExpanded
                ? 'w-56 h-64 sm:w-60 sm:h-68 md:w-68 md:h-76'
                : 'w-24 h-28 sm:w-32 sm:h-36 md:w-40 md:h-44 [@media(max-height:480px)]:w-24 [@media(max-height:480px)]:h-24'
            }`}
          >
            <div className="flex items-center justify-between gap-1 px-1 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-300 truncate">
                {mode === 'circuit'
                  ? onFinalSprint
                    ? 'NAIROBI MAP · 🏁 FINISH'
                    : `NAIROBI MAP · CP ${Math.min((telemetry?.checkpointIndex ?? 0) + 1, telemetry?.totalCheckpoints ?? 6)}/${telemetry?.totalCheckpoints ?? 6}`
                  : 'NAIROBI CITY MAP'}
              </span>
              <button
                type="button"
                tabIndex={-1}
                data-testid="minimap-expand-btn"
                aria-label={minimapExpanded ? 'Shrink minimap' : 'Expand minimap'}
                title={minimapExpanded ? 'Compact Minimap' : 'Expand Minimap'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMinimapExpanded((prev) => !prev);
                }}
                className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer shrink-0"
              >
                {minimapExpanded ? (
                  <Minimize2 className="w-3 h-3" />
                ) : (
                  <Maximize2 className="w-3 h-3" />
                )}
              </button>
            </div>

            <svg
              viewBox="-235 -250 470 530"
              className="w-full flex-1 rounded-lg overflow-hidden"
              role="img"
              aria-label="Nairobi CBD live GPS minimap"
            >
              {/* City Base & Green Parks */}
              <rect x="-235" y="-250" width="470" height="530" rx="12" fill="#11171f" />
              <rect x="-220" y="-160" width="108" height="290" rx="8" fill="#163526" />
              <ellipse cx="-164" cy="48" rx="22" ry="38" fill="#0f3a52" />

              {/* CBD City Building Block Silhouettes */}
              {CBD_BUILDING_BLOCKS.map((blk) => (
                <rect
                  key={blk.id}
                  x={blk.x - blk.halfW}
                  y={blk.z - blk.halfD}
                  width={blk.halfW * 2}
                  height={blk.halfD * 2}
                  rx="2.5"
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
              ))}

              {/* Street Corridors */}
              {NAIROBI_STREETS.map((s) =>
                s.axis === 'ns' ? (
                  <line
                    key={s.id}
                    x1={s.coord}
                    y1={s.start}
                    x2={s.coord}
                    y2={s.end}
                    stroke="#3b495e"
                    strokeWidth={s.width * 0.72}
                    strokeLinecap="round"
                  />
                ) : (
                  <line
                    key={s.id}
                    x1={s.start}
                    y1={s.coord}
                    x2={s.end}
                    y2={s.coord}
                    stroke="#3b495e"
                    strokeWidth={s.width * 0.72}
                    strokeLinecap="round"
                  />
                ),
              )}

              {/* Circuit Route Polyline */}
              {mode === 'circuit' && (
                <polyline
                  points={circuitRoutePoints}
                  fill="none"
                  stroke="#22d3ee"
                  strokeOpacity="0.58"
                  strokeWidth="4.5"
                  strokeDasharray="8 6"
                  strokeLinejoin="round"
                />
              )}

              {/* Nairobi Expressway Viaduct Corridor */}
              <polyline
                points="-122,-240 -122,242 200,242"
                fill="none"
                stroke="#f59e0b"
                strokeOpacity="0.32"
                strokeWidth="3.5"
                strokeDasharray="8 6"
              />

              {/* Roundabouts */}
              {NAIROBI_ROUNDABOUTS.map((rb) => (
                <circle
                  key={rb.id}
                  cx={rb.x}
                  cy={rb.z}
                  r={rb.outerRadius * 0.65}
                  fill="#3b495e"
                  stroke="#64748b"
                  strokeWidth="2"
                />
              ))}

              {/* Compact City Street Name Anchors when expanded or legible */}
              {minimapExpanded && (
                <g fontSize="13" fontWeight="700" fill="#94a3b8" textAnchor="middle">
                  <text x="-95" y="-120" transform="rotate(-90 -95 -120)">UHURU HWY</text>
                  <text x="-8" y="-42">KENYATTA AVE</text>
                  <text x="55" y="60" transform="rotate(-90 55 60)">MOI AVE</text>
                  <text x="15" y="119">HAILE SELASSIE</text>
                </g>
              )}

              {/* Ordered Circuit Checkpoints (Cleared / Active / Upcoming) */}
              {mode === 'circuit' ? (
                CIRCUIT_CHECKPOINT_IDS.map((cpId, idx) => {
                  const lm = NAIROBI_LANDMARKS.find((l) => l.id === cpId);
                  if (!lm) return null;
                  const curIdx = telemetry?.checkpointIndex ?? 0;
                  const isCleared = idx < curIdx;
                  const isActive = idx === curIdx;
                  return (
                    <g
                      key={cpId}
                      data-testid={isActive ? 'minimap-active-checkpoint' : 'minimap-upcoming-checkpoint'}
                      transform={`translate(${lm.waypointX}, ${lm.waypointZ})`}
                    >
                      {isActive && (
                        <circle
                          r="20"
                          fill="#f59e0b"
                          fillOpacity="0.28"
                          stroke="#facc15"
                          strokeWidth="2"
                        />
                      )}
                      <circle
                        r={isActive ? 12 : 9.5}
                        fill={isCleared ? '#065f46' : isActive ? '#f59e0b' : '#0f172a'}
                        stroke={isCleared ? '#34d399' : isActive ? '#ffffff' : '#38bdf8'}
                        strokeWidth="2.2"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="11.5"
                        fontWeight="800"
                        fill={isActive ? '#0f172a' : isCleared ? '#6ee7b7' : '#e0f2fe'}
                      >
                        {isCleared ? '✓' : idx + 1}
                      </text>
                    </g>
                  );
                })
              ) : (
                NAIROBI_LANDMARKS.map((lm) => {
                  const isTarget = guidance?.targetLandmark.id === lm.id;
                  return (
                    <g
                      key={lm.id}
                      transform={`translate(${lm.waypointX}, ${lm.waypointZ})`}
                    >
                      {isTarget && <circle r="17" fill="#f59e0b" fillOpacity="0.28" />}
                      <circle
                        r={isTarget ? 9.5 : 5.5}
                        fill={isTarget ? '#f59e0b' : '#38bdf8'}
                        stroke="#0f172a"
                        strokeWidth="1.8"
                      />
                    </g>
                  );
                })
              )}

              {/* Dedicated Checkered Finish Line Marker (Circuit Race Mode) */}
              {mode === 'circuit' && (
                <g
                  data-testid="minimap-finish-marker"
                  transform={`translate(${FINISH_LINE.x}, ${FINISH_LINE.z})`}
                >
                  {onFinalSprint && (
                    <circle
                      r="22"
                      fill="#10b981"
                      fillOpacity="0.28"
                      stroke="#facc15"
                      strokeWidth="2.4"
                    />
                  )}
                  <rect
                    x="-11"
                    y="-7"
                    width="22"
                    height="14"
                    rx="3"
                    fill="#0f172a"
                    stroke={onFinalSprint ? '#34d399' : '#facc15'}
                    strokeWidth="2"
                  />
                  {/* Mini checkered squares */}
                  <rect x="-8" y="-4.5" width="4" height="4.5" fill="#ffffff" />
                  <rect x="0" y="-4.5" width="4" height="4.5" fill="#ffffff" />
                  <rect x="-4" y="0" width="4" height="4.5" fill="#ffffff" />
                  <rect x="4" y="0" width="4" height="4.5" fill="#ffffff" />
                </g>
              )}

              {/* Traffic dots */}
              {telemetry?.trafficPositions.map((t, i) => (
                <circle
                  key={`t-${i}`}
                  cx={t.x}
                  cy={t.z}
                  r={t.archetype === 'matatu' ? 4 : 2.8}
                  fill={t.archetype === 'matatu' ? '#facc15' : '#64748b'}
                />
              ))}

              {/* AI Rival Racers */}
              {telemetry?.rivalPositions.map((r, i) => (
                <g key={`r-${i}`}>
                  {i === 0 && (
                    <circle cx={r.x} cy={r.z} r="10.5" fill="none" stroke="#facc15" strokeWidth="1.8" />
                  )}
                  <circle
                    cx={r.x}
                    cy={r.z}
                    r="6.5"
                    fill={r.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              ))}

              {/* Best-Lap Ghost Vehicle Marker */}
              {telemetry?.ghostPosition && (
                <g
                  data-testid="minimap-ghost-marker"
                  transform={`translate(${telemetry.ghostPosition.x}, ${telemetry.ghostPosition.z}) rotate(${
                    (telemetry.ghostPosition.heading * 180) / Math.PI
                  })`}
                >
                  <circle
                    r="13"
                    fill="#38bdf8"
                    fillOpacity="0.18"
                    stroke="#7dd3fc"
                    strokeWidth="1.5"
                    strokeDasharray="3 2.5"
                  />
                  <polygon
                    points="0,-13 9,9 0,4 -9,9"
                    fill="#38bdf8"
                    fillOpacity="0.72"
                    stroke="#e0f2fe"
                    strokeWidth="1.8"
                  />
                </g>
              )}

              {/* Active GPS Route Line from Player to Target Checkpoint */}
              {telemetry && guidance && (
                <line
                  x1={telemetry.x}
                  y1={telemetry.z}
                  x2={guidance.targetLandmark.waypointX}
                  y2={guidance.targetLandmark.waypointZ}
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeDasharray="7 5"
                  strokeOpacity="0.82"
                />
              )}

              {/* Player Vehicle Arrow & Forward Cone */}
              {telemetry && (
                <g
                  data-testid="minimap-player-marker"
                  transform={`translate(${telemetry.x}, ${telemetry.z}) rotate(${
                    (telemetry.heading * 180) / Math.PI
                  })`}
                >
                  <polygon
                    points="0,-32 14,-8 -14,-8"
                    fill="#10b981"
                    fillOpacity="0.22"
                  />
                  <polygon
                    points="0,-16 11,11 0,5 -11,11"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                  />
                </g>
              )}
            </svg>
          </div>

          <div className="race-glass-panel bg-[#0c1117]/92 border border-white/15 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 [@media(max-height:480px)]:py-1 shadow-lg w-[138px] sm:w-[205px] lg:w-[215px] shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 truncate">
                {guidance?.currentStreet ?? 'Kenyatta Avenue'}
              </span>
              <span className="font-mono text-xs text-slate-200 tabular-nums shrink-0">
                {distRounded} m
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-amber-400"
                  style={{ transform: `rotate(${bearingDeg}deg)` }}
                >
                  <path fill="currentColor" d="M12 2L4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {guidance?.targetLandmark.shortName ?? 'KICC Tower'}
                </div>
                <div className="text-xs text-slate-300 truncate">
                  {guidance?.instruction ?? 'Drive East on Kenyatta Ave'}
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate">{guidance?.targetLandmark.street}</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onNextLandmark();
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold whitespace-nowrap cursor-pointer"
              >
                Next [N]
              </button>
            </div>
          </div>
        </div>

        {/* Center-Top: Motorsport Position / Split / Combo Cluster (lg+) + Direction Identifiers (All Viewports) */}
        <div className="order-3 lg:order-2 basis-full lg:basis-auto min-w-0 flex flex-col items-center gap-1.5 sm:gap-2">
          <div className="race-glass-panel hidden lg:flex bg-[#0c1117]/92 border border-white/15 rounded-xl px-5 py-2 shadow-xl items-center gap-5">
            {mode === 'circuit' && (
              <>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">POS</div>
                  <div
                    className="text-2xl font-bold text-amber-400 leading-none tabular-nums"
                    style={{ fontFamily: 'Chakra Petch, sans-serif' }}
                  >
                    {ordinal(telemetry?.racePosition ?? 1)}
                    <span className="text-sm text-slate-400 font-normal">/{telemetry?.totalRacers ?? 5}</span>
                  </div>
                </div>
                <div className="h-7 w-px bg-white/10" />
              </>
            )}

            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                {mode === 'circuit' ? (onFinalSprint ? 'FINAL SPRINT' : 'CHECKPOINT') : 'LANDMARK'}
              </div>
              <div
                className={`text-xl font-bold leading-none tabular-nums ${
                  onFinalSprint ? 'text-emerald-300' : 'text-white'
                }`}
                style={{ fontFamily: 'Chakra Petch, sans-serif' }}
              >
                {mode === 'circuit'
                  ? onFinalSprint
                    ? '6/6 → 🏁'
                    : `${telemetry?.checkpointIndex ?? 0}/${telemetry?.totalCheckpoints ?? 6}`
                  : `${NAIROBI_LANDMARKS.length} SITES`}
              </div>
            </div>

            <div className="h-7 w-px bg-white/10" />

            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">TIME</div>
              <div
                className="text-xl font-bold text-emerald-300 leading-none font-mono tabular-nums"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {formatTimer(telemetry?.elapsedTime ?? 0)}
              </div>
            </div>

            {(telemetry?.totalDriftScore ?? 0) + (telemetry?.driftScoreActive ?? 0) > 0 && (
              <>
                <div className="h-7 w-px bg-white/10" />
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">STYLE PTS</div>
                  <div
                    className="text-xl font-bold text-sky-400 leading-none tabular-nums"
                    style={{ fontFamily: 'Chakra Petch, sans-serif' }}
                  >
                    {Math.round((telemetry?.totalDriftScore ?? 0) + (telemetry?.driftScoreActive ?? 0))}
                  </div>
                </div>
              </>
            )}

            {mode === 'circuit' && telemetry?.ghostLapTime != null && (
              <>
                <div className="h-7 w-px bg-white/10" />
                <div data-testid="hud-ghost-badge" className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-cyan-300">GHOST</div>
                  <div
                    className="text-base font-bold text-cyan-200 leading-none font-mono tabular-nums"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {formatTimer(telemetry.ghostLapTime)}
                  </div>
                </div>
              </>
            )}

            <div className="h-7 w-px bg-white/10" />
            <div data-testid="weather-status-badge" className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                {weatherProfile.shortLabel}
              </div>
              <div
                className={`text-xs font-bold leading-tight whitespace-nowrap ${
                  weather === 'rainy'
                    ? 'text-sky-300'
                    : weather === 'foggy'
                      ? 'text-slate-200'
                      : 'text-amber-300'
                }`}
              >
                {gripPercent}% GRIP · {weatherProfile.visibilityMeters}m
              </div>
            </div>
          </div>

          {/* Direction Identifier Bar: Next Turn / Wrong-Way / Finish Line + Where Rival Pack Went (Visible on ALL viewports) */}
          <div
            data-testid="direction-identifier-bar"
            className={`race-direction-strip border rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 [@media(max-height:480px)]:py-0.5 shadow-lg flex items-center gap-2 sm:gap-2.5 flex-wrap justify-center max-w-[96vw] lg:max-w-[520px] ${
              isWrongWay
                ? 'bg-rose-950/94 border-rose-400/75 text-rose-100'
                : onFinalSprint
                  ? 'bg-emerald-950/94 border-emerald-400/70 text-emerald-100'
                  : 'bg-[#0c1117]/92 border-white/15'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold whitespace-nowrap ${
                isWrongWay
                  ? 'text-rose-200'
                  : onFinalSprint
                    ? 'text-emerald-300'
                    : 'text-cyan-300'
              }`}
            >
              {onFinalSprint && !isWrongWay ? (
                <Flag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : activeTurnDir === 'RIGHT' && !isWrongWay ? (
                <CornerUpRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : activeTurnDir === 'LEFT' && !isWrongWay ? (
                <CornerUpLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : isWrongWay || activeTurnDir === 'BEHIND' ? (
                <RotateCcw className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="uppercase tracking-wider">
                {turnActionLabel}:{' '}
                {activeTurnStreet
                  .replace(' Roundabout', ' Rdbt')
                  .replace(' Avenue', ' Ave')}
              </span>
              <span className="font-mono text-[10px] sm:text-[11px] text-slate-300 tabular-nums">
                ({activeTurnDist}m)
              </span>
            </div>

            {mode === 'circuit' && rivalTrackers.length > 0 && (
              <>
                <div className="h-3.5 w-px bg-white/15 hidden sm:block" />
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    PACK
                  </span>
                  {rivalTrackers.slice(0, 2).map((rt) => (
                    <div
                      key={rt.id}
                      data-testid="rival-direction-pill"
                      className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] sm:text-[11px] whitespace-nowrap"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: rt.color }}
                      />
                      <Navigation
                        className="w-3 h-3 text-amber-400 shrink-0 transition-transform duration-100"
                        style={{ transform: `rotate(${Math.round((rt.bearingDeltaRad * 180) / Math.PI)}deg)` }}
                      />
                      <span className="font-semibold text-slate-100">{rt.shortName}</span>
                      <span className="font-mono text-[10px] text-amber-300 tabular-nums">
                        {rt.distanceMeters}m
                      </span>
                      <span className="text-[10px] text-slate-400 hidden xl:inline">
                        · {rt.streetName
                          .replace(' Highway (A104)', ' Hwy')
                          .replace(' Avenue', ' Ave')
                          .replace(' Street', ' St')
                          .replace(' Roundabout', ' Rdbt')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Live Drift / Near Miss / Landmark Arrival Toast */}
          {telemetry && telemetry.driftScoreActive > 15 && (
            <div className="px-4 py-1 rounded-md bg-amber-500 text-slate-950 font-bold text-xs tracking-wider uppercase shadow-lg">
              POWER SLIDE +{Math.round(telemetry.driftScoreActive)}
            </div>
          )}
          {telemetry && telemetry.nearMissPopupTimer > 0 && (
            <div className="px-4 py-1 rounded-md bg-sky-400 text-slate-950 font-bold text-xs tracking-wider uppercase shadow-lg">
              NEAR MISS! +150 PTS · +NITRO
            </div>
          )}
          {arrivalBanner && (
            <div className="bg-[#0c1117]/94 border border-emerald-400/50 rounded-xl px-5 py-2.5 shadow-xl max-w-md text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Checkpoint Cleared · {arrivalBanner.district}
              </div>
              <div className="text-base font-bold text-white">{arrivalBanner.name}</div>
            </div>
          )}
        </div>

        {/* Top-Right Utility Controls + Mobile Weather Impact Readout */}
        <div className="order-2 lg:order-3 flex flex-col items-end gap-1.5 pointer-events-auto shrink-0">
          <div className="flex flex-wrap justify-end items-center gap-1 sm:gap-1.5 max-w-[144px] sm:max-w-[230px] lg:max-w-[330px] 2xl:max-w-none">
            <button
              type="button"
              tabIndex={-1}
              data-testid="weather-toggle-btn"
              aria-label={`Weather condition: ${weatherProfile.label}. Click to switch`}
              title={`Weather: ${weatherProfile.label} [T]`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleWeather();
              }}
              className={`h-8 lg:h-9 px-2 lg:px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors bg-[#0c1117]/94 hover:bg-[#1a222b] ${
                weather === 'rainy'
                  ? 'border-sky-400/70 text-sky-300'
                  : weather === 'foggy'
                    ? 'border-slate-300/70 text-slate-100'
                    : 'border-white/15 text-amber-300'
              }`}
            >
              {weather === 'rainy' ? (
                <CloudRain className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              ) : weather === 'foggy' ? (
                <CloudFog className="w-3.5 h-3.5 text-slate-200 shrink-0" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="hidden sm:inline">{weatherProfile.shortLabel}</span>
              <span className="hidden xl:inline text-[10px] opacity-75">[T]</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={`Camera mode (${cameraMode})`}
              title={`Camera: ${cameraMode} [C]`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="h-8 lg:h-9 px-2 lg:px-2.5 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-slate-100 flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="hidden lg:inline capitalize">{cameraMode}</span>
            </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Open controls and sensitivity settings"
            title="Controls & Sensitivity [O]"
            data-testid="hud-settings-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            className="h-8 lg:h-9 px-2 lg:px-2.5 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-slate-100 flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden xl:inline">Sensitivity [O]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle on-screen pedals"
            title="On-Screen Racing Controls [V]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouchControls();
            }}
            className={`w-8 h-8 lg:w-9 lg:h-9 rounded-lg border flex items-center justify-center cursor-pointer shrink-0 ${
              showTouchControls
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-[#0c1117]/92 hover:bg-[#1a222b] border-white/15 text-slate-100'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Reset car to road"
            title="Track Recovery [R]"
            onClick={(e) => {
              e.currentTarget.blur();
              onRecoverRoad();
            }}
            className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Open Nairobi Map & Guide"
            title="Nairobi Map & AI Guide [G]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleGuide();
            }}
            className="h-8 lg:h-9 px-2 lg:px-2.5 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-slate-100 flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <MapIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden lg:inline">City Map [G]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Honk Matatu Horn"
            title="Matatu Horn [H]"
            onClick={(e) => {
              e.currentTarget.blur();
              onHonkHorn();
            }}
            className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-amber-400 flex items-center justify-center cursor-pointer shrink-0"
          >
            <Megaphone className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title="Toggle Audio [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game"
              title="Pause [Esc / P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-[#0c1117]/92 hover:bg-[#1a222b] border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer shrink-0"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            data-testid="weather-compact-badge"
            className={`lg:hidden rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow ${
              weather === 'rainy'
                ? 'bg-sky-950/90 border-sky-400/50 text-sky-200'
                : weather === 'foggy'
                  ? 'bg-slate-800/90 border-slate-300/45 text-slate-100'
                  : 'bg-[#0c1117]/90 border-white/15 text-amber-300'
            }`}
          >
            {weatherProfile.shortLabel} · {gripPercent}% GRIP · {weatherProfile.visibilityMeters}m
          </div>
        </div>
      </div>

      {/* Screen-Edge Off-Axis Rival Direction Identifiers (when racers turn out of sight) */}
      {mode === 'circuit' && countdown < 0 && leftWingRival && (
        <div
          data-testid="edge-direction-left"
          className="fixed left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center gap-2 bg-[#0c1117]/92 border border-amber-400/50 rounded-lg px-2.5 py-1.5 shadow-lg"
        >
          <span className="text-amber-400 font-bold text-sm">◀</span>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: leftWingRival.color }}
          />
          <div className="leading-tight">
            <div className="text-[11px] font-bold text-white">
              {leftWingRival.shortName} · {leftWingRival.distanceMeters}m
            </div>
            <div className="text-[10px] text-amber-300">{leftWingRival.streetName}</div>
          </div>
        </div>
      )}

      {mode === 'circuit' && countdown < 0 && rightWingRival && (
        <div
          data-testid="edge-direction-right"
          className="fixed right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center gap-2 bg-[#0c1117]/92 border border-amber-400/50 rounded-lg px-2.5 py-1.5 shadow-lg"
        >
          <div className="leading-tight text-right">
            <div className="text-[11px] font-bold text-white">
              {rightWingRival.shortName} · {rightWingRival.distanceMeters}m
            </div>
            <div className="text-[10px] text-amber-300">{rightWingRival.streetName}</div>
          </div>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: rightWingRival.color }}
          />
          <span className="text-amber-400 font-bold text-sm">▶</span>
        </div>
      )}

      {/* Immersive 3-2-1-GO Race Start Visual Countdown Overlay (floats over center without pushing bottom controls on short landscape viewports) */}
      {countdown >= 0 && (
        <div
          data-testid="race-countdown-overlay"
          className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none select-none"
        >
          <div
            className={`bg-[#0b1016]/94 border-2 rounded-2xl px-5 py-3 md:px-9 md:py-5 shadow-2xl text-center min-w-[230px] md:min-w-[290px] ${
              countdown === 0
                ? 'border-emerald-400 shadow-emerald-500/25'
                : countdown === 1
                  ? 'border-rose-500 shadow-rose-500/25'
                  : 'border-amber-400/80 shadow-amber-500/20'
            }`}
          >
            {/* 5-Pod Starting Gantry Lights */}
            <div className="flex items-center justify-center gap-2.5 md:gap-3 mb-2 md:mb-3 px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-black/60 border border-white/10">
              {[1, 2, 3, 4, 5].map((pod) => {
                const litRedCount = countdown === 3 ? 2 : countdown === 2 ? 4 : countdown === 1 ? 5 : 0;
                const isGreen = countdown === 0;
                const isRed = !isGreen && pod <= litRedCount;
                return (
                  <span
                    key={pod}
                    className={`w-4 h-4 md:w-5 md:h-5 rounded-full border transition-all duration-150 ${
                      isGreen
                        ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.95)]'
                        : isRed
                          ? 'bg-red-500 border-red-200 shadow-[0_0_16px_rgba(239,68,68,0.95)]'
                          : 'bg-slate-800 border-white/15'
                    }`}
                  />
                );
              })}
            </div>

            {/* Scaled Countdown Digit / GO! */}
            <div
              className={`text-5xl md:text-7xl font-bold tracking-wider leading-none transition-transform duration-100 ${
                countdown === 0
                  ? 'text-emerald-400'
                  : countdown === 1
                    ? 'text-rose-400'
                    : 'text-amber-400'
              }`}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                transform: `scale(${countdownScale.toFixed(3)})`,
              }}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </div>

            {/* Beat Progress Bar */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-none ${
                  countdown === 0
                    ? 'bg-emerald-400'
                    : countdown === 1
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                }`}
                style={{ width: `${Math.round(countdownProgress * 100)}%` }}
              />
            </div>

            <div className="mt-2.5 text-xs font-bold uppercase tracking-widest">
              {countdown === 0 ? (
                <span className="text-emerald-300">
                  {autoDrive
                    ? 'AUTO-DRIVE ENGAGED · W ACCEL · S BRAKE'
                    : 'FULL THROTTLE · NAIROBI GP LIVE'}
                </span>
              ) : activeInputs?.throttle ? (
                <span className="text-amber-300">REVVING {rpm} RPM · LAUNCH BOOST ARMED</span>
              ) : (
                <span className="text-slate-300">
                  {autoDrive
                    ? 'AUTO-DRIVE ARMED · HOLD W / ↑ TO ACCEL'
                    : 'HOLD W / ↑ TO ACCELERATE'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row: Opposite-Sides Steering Split — Left Thumb ◀ (Far Left) | Speedometer | Right Thumb ▶ (Far Right) */}
      <div className="flex items-end justify-between gap-2 sm:gap-3 w-full">
        {/* FAR LEFT SIDE: Steer Left (◀) at bottom-left corner, Brake & Drift raised above */}
        <div
          data-testid="left-controls-cluster"
          className="flex flex-col items-start gap-4 pointer-events-auto select-none shrink-0"
        >
          {showTouchControls ? (
            <>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Brake or Reverse"
                  {...bindPad('brake')}
                  className={`h-9 sm:h-11 px-2.5 sm:px-4 rounded-xl border font-bold text-[11px] sm:text-xs uppercase cursor-pointer transition-colors flex items-center gap-1 ${
                    activeInputs?.brake
                      ? 'bg-rose-500 text-white border-rose-300'
                      : 'bg-[#0c1117]/92 hover:bg-rose-950/60 border-rose-400/50 text-rose-300'
                  }`}
                >
                  <span>▼</span>
                  <span>BRAKE</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Handbrake Drift"
                  {...bindPad('drift')}
                  className={`h-9 sm:h-11 px-2.5 sm:px-3.5 rounded-xl border font-bold text-[11px] sm:text-xs uppercase tracking-wider cursor-pointer transition-colors ${
                    activeInputs?.drift
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-[#0c1117]/92 hover:bg-[#1a222b] border-white/20 text-amber-400'
                  }`}
                >
                  DRIFT
                </button>
                {autoDrive && (
                  <span
                    data-testid="hud-autodrive-badge"
                    className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-[#0c1117]/92 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold uppercase tracking-wider shadow"
                  >
                    AUTO-DRIVE
                  </span>
                )}
              </div>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Steer Left"
                {...bindPad('left')}
                className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl border-2 font-bold text-2xl sm:text-3xl cursor-pointer transition-colors shadow-xl ${
                  activeInputs?.left
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-[#0c1117]/94 hover:bg-[#1a222b] border-white/25 text-white'
                }`}
              >
                ◀
              </button>
            </>
          ) : (
            <div className="flex flex-col items-start gap-2.5 bg-[#0c1117]/92 border border-white/15 rounded-2xl p-2 sm:p-2.5 text-[11px] font-semibold shadow-xl">
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Brake or Reverse"
                  {...bindPad('brake')}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    activeInputs?.brake
                      ? 'bg-rose-500 text-white border-rose-300'
                      : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/45 text-rose-300'
                  }`}
                >
                  S / ▼ BRAKE
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Handbrake Drift"
                  {...bindPad('drift')}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    activeInputs?.drift
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-white/5 text-amber-300 border-white/15 hover:bg-white/10'
                  }`}
                >
                  SPACE DRIFT
                </button>
                {autoDrive && (
                  <span
                    data-testid="hud-autodrive-badge"
                    className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider"
                  >
                    AUTO-DRIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Steer Left"
                  {...bindPad('left')}
                  className={`h-11 sm:h-12 px-4 sm:px-5 rounded-xl border-2 font-bold text-sm cursor-pointer transition-colors ${
                    activeInputs?.left
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-white/10 text-white border-white/25 hover:bg-white/15'
                  }`}
                >
                  ◀ A / LEFT
                </button>
                <span className="text-slate-400 hidden lg:inline">T Weather · R Reset · O Tune</span>
              </div>
            </div>
          )}
        </div>

        {/* SPEEDOMETER CLUSTER: Compact on narrow portrait screens, shifted right-inboard on md+ so center chase car stays unobstructed */}
        <div className="mx-auto md:ml-auto md:mr-4 lg:mr-5 shrink-0 bg-[#0a0f16]/94 border border-white/15 rounded-2xl p-1.5 sm:p-2 lg:px-4 lg:py-3 shadow-2xl flex items-center gap-3">
          {/* Circular Speedometer Dial */}
          <div
            data-testid="circular-speed-gauge"
            aria-label={`Speedometer: ${kmh} km/h`}
            className="relative w-[84px] h-[84px] sm:w-28 sm:h-28 md:w-28 md:h-28 [@media(max-height:480px)]:w-20 [@media(max-height:480px)]:h-20 lg:w-40 lg:h-40 shrink-0"
          >
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
              <defs>
                <radialGradient id="dialFaceGrad" cx="50%" cy="46%" r="54%">
                  <stop offset="0%" stopColor="#162231" />
                  <stop offset="72%" stopColor="#0c121b" />
                  <stop offset="100%" stopColor="#070a0f" />
                </radialGradient>
                <linearGradient id="speedSweepGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="48%" stopColor="#f59e0b" />
                  <stop offset="82%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
                <linearGradient id="nitroSweepGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="55%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
                <linearGradient id="rpmMicroGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="70%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {/* Outer Machined Bezel & Dial Plate */}
              <circle
                cx="100"
                cy="100"
                r="95"
                fill="url(#dialFaceGrad)"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="2"
              />
              <circle
                cx="100"
                cy="100"
                r="89"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />

              {/* Background Velocity Track + High-Speed Redline Segment */}
              <path
                d={speedTrackPath}
                fill="none"
                stroke="#1e293b"
                strokeWidth="8.5"
                strokeLinecap="round"
              />
              <path
                d={redlineTrackPath}
                fill="none"
                stroke="rgba(244,63,94,0.28)"
                strokeWidth="8.5"
                strokeLinecap="round"
              />

              {/* Dynamic Velocity Glow & Primary Arc */}
              {speedFillPath && (
                <>
                  <path
                    d={speedFillPath}
                    fill="none"
                    stroke={telemetry?.isBoosting ? '#38bdf8' : kmh >= 240 ? '#f43f5e' : '#f59e0b'}
                    strokeOpacity="0.24"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  <path
                    d={speedFillPath}
                    fill="none"
                    stroke={telemetry?.isBoosting ? 'url(#nitroSweepGrad)' : 'url(#speedSweepGrad)'}
                    strokeWidth="8.5"
                    strokeLinecap="round"
                  />
                </>
              )}

              {/* Inner RPM Micro-Ring */}
              <path
                d={rpmTrackPath}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              {rpmFillPath && (
                <path
                  d={rpmFillPath}
                  fill="none"
                  stroke="url(#rpmMicroGrad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              )}

              {/* Graduated Tick Marks & Radial Speed Numerals */}
              {SPEED_TICKS.map((tickVal) => {
                const ratio = tickVal / GAUGE_MAX_KMH;
                const ang = GAUGE_MIN_DEG + GAUGE_SWEEP_DEG * ratio;
                const isMajor = tickVal % 40 === 0;
                const isMid = !isMajor && tickVal % 20 === 0;
                const isRedZone = tickVal >= 240;
                const isLit = kmh >= tickVal && kmh > 0;

                const outerR = 77;
                const innerR = isMajor ? 68 : isMid ? 71 : 73.5;
                const p1 = polarToCartesian(100, 100, outerR, ang);
                const p2 = polarToCartesian(100, 100, innerR, ang);
                const labelPos = isMajor ? polarToCartesian(100, 100, 58.5, ang) : null;

                return (
                  <g key={tickVal}>
                    <line
                      x1={p1.x.toFixed(2)}
                      y1={p1.y.toFixed(2)}
                      x2={p2.x.toFixed(2)}
                      y2={p2.y.toFixed(2)}
                      stroke={
                        isLit
                          ? telemetry?.isBoosting
                            ? '#7dd3fc'
                            : isRedZone
                              ? '#fb7185'
                              : '#fde68a'
                          : isRedZone
                            ? 'rgba(244,63,94,0.55)'
                            : isMajor
                              ? 'rgba(226,232,240,0.65)'
                              : 'rgba(148,163,184,0.32)'
                      }
                      strokeWidth={isMajor ? 2.2 : isMid ? 1.4 : 1}
                      strokeLinecap="round"
                    />
                    {labelPos && (
                      <text
                        x={labelPos.x.toFixed(2)}
                        y={labelPos.y.toFixed(2)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={
                          isLit
                            ? '#ffffff'
                            : isRedZone
                              ? '#fda4af'
                              : 'rgba(148,163,184,0.85)'
                        }
                        fontSize="9"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {tickVal}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Sweeping Mechanical Velocity Needle */}
              <g
                style={{
                  transform: `rotate(${speedAngleDeg.toFixed(2)}deg)`,
                  transformOrigin: '100px 100px',
                  transition: 'transform 75ms linear',
                }}
              >
                <polygon
                  points="86,98 175,99.3 175,100.7 86,102"
                  fill={telemetry?.isBoosting ? '#38bdf8' : '#ef4444'}
                />
                <polygon points="105,98.9 173,99.6 173,100.4 105,101.1" fill="#ffffff" fillOpacity="0.88" />
              </g>

              {/* Center Machined Pivot Cap */}
              <circle cx="100" cy="100" r="10.5" fill="#0f172a" stroke="#475569" strokeWidth="2" />
              <circle
                cx="100"
                cy="100"
                r="4.5"
                fill={telemetry?.isBoosting ? '#38bdf8' : '#f59e0b'}
              />
            </svg>

            {/* Integrated Digital Velocity Readout in Lower Dial Throat */}
            <div className="absolute inset-x-0 bottom-2.5 flex flex-col items-center pointer-events-none">
              <span
                data-testid="speed-gauge-value"
                className={`text-2xl md:text-[28px] font-bold leading-none tabular-nums ${
                  telemetry?.isBoosting
                    ? 'text-sky-300'
                    : kmh >= 220
                      ? 'text-amber-300'
                      : 'text-white'
                }`}
                style={{ fontFamily: 'Chakra Petch, sans-serif' }}
              >
                {kmh}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-0.5">
                KM/H
              </span>
            </div>
          </div>

          {/* Companion Telemetry Stack: Gear, RPM, NOS, Engine Temp & Traction State */}
          <div className="hidden lg:flex flex-col justify-between min-w-[122px] gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">RPM</div>
                <div className="font-mono text-xs font-bold text-slate-200 tabular-nums">
                  {rpm}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">GEAR</div>
                <div
                  className="text-3xl font-bold leading-none text-amber-400 tabular-nums"
                  style={{ fontFamily: 'Chakra Petch, sans-serif' }}
                >
                  {telemetry?.gear ?? 'N'}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>NITROUS [SHIFT]</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    nitroPhase === 'active'
                      ? 'text-amber-300'
                      : nitroPhase === 'cooldown'
                        ? 'text-slate-400'
                        : 'text-sky-300'
                  }`}
                >
                  {nitroPhase === 'active'
                    ? `${nitroTimer.toFixed(1)}s`
                    : nitroPhase === 'cooldown'
                      ? `COOL ${nitroTimer.toFixed(1)}s`
                      : `${nitroPct}%`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    nitroPhase === 'active'
                      ? 'bg-amber-400'
                      : nitroPhase === 'cooldown'
                        ? 'bg-slate-400'
                        : 'bg-sky-400'
                  }`}
                  style={{ width: `${nitroProgressPct}%` }}
                />
              </div>
            </div>

            {/* Dynamic Engine Temperature Gauge */}
            <div data-testid="engine-temp-gauge">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Thermometer
                    className={`w-3 h-3 ${
                      engineTemp >= 80
                        ? 'text-rose-400'
                        : engineTemp >= 45
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  />
                  <span>ENG TEMP</span>
                </span>
                <span
                  data-testid="engine-temp-value"
                  className={`font-mono font-bold tabular-nums ${
                    engineTemp >= 80
                      ? 'text-rose-400'
                      : engineTemp >= 45
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                  }`}
                >
                  {engineTempCelsius}°C
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  data-testid="engine-temp-fill"
                  className={`h-full transition-[width] duration-75 ${
                    engineTemp >= 85
                      ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500'
                      : engineTemp >= 45
                        ? 'bg-gradient-to-r from-emerald-400 to-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(4, engineTemp)}%` }}
                />
              </div>
            </div>

            <div
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border text-center ${
                engineTemp >= 88
                  ? 'bg-rose-500/20 border-rose-400/60 text-rose-300 animate-pulse'
                  : nitroPhase === 'active'
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                    : telemetry?.isDrifting
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : onFinalSprint
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                        : 'bg-emerald-500/15 border-emerald-400/35 text-emerald-400'
              }`}
            >
              {engineTemp >= 88
                ? `ENG ${engineTempState}`
                : nitroPhase === 'active'
                  ? `NITRO SURGE ${nitroTimer.toFixed(1)}s`
                  : telemetry?.isDrifting
                    ? 'POWER SLIDE'
                    : onFinalSprint
                      ? 'FINAL SPRINT 🏁'
                      : 'TRACTION GRIP'}
            </div>
          </div>
        </div>

        {/* FAR RIGHT SIDE: Steer Right (▶) at bottom-right corner, Timed NITROUS Boost & Accelerate raised above */}
        <div
          data-testid="right-controls-cluster"
          className="pointer-events-auto select-none flex flex-col items-end gap-4 shrink-0"
        >
          {showTouchControls ? (
            <>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="nitrous-btn"
                  data-nitro-phase={nitroPhase}
                  aria-label="Trigger Nitrous Boost"
                  disabled={nitroPhase === 'cooldown' || countdown > 0}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerNitrous();
                  }}
                  className={`relative overflow-hidden h-9 sm:h-11 px-2.5 sm:px-3.5 rounded-xl border font-bold text-[11px] sm:text-xs uppercase flex items-center gap-1.5 transition-colors ${
                    nitroPhase === 'active'
                      ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.6)] cursor-default'
                      : nitroPhase === 'cooldown' || countdown > 0
                        ? 'bg-[#0c1117]/92 border-slate-600/60 text-slate-400 cursor-not-allowed opacity-85'
                        : 'bg-[#0c1117]/94 hover:bg-sky-950/80 border-sky-400/70 text-sky-300 cursor-pointer shadow-lg'
                  }`}
                >
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      nitroPhase === 'active' ? 'text-slate-950' : nitroPhase === 'cooldown' ? 'text-slate-500' : 'text-sky-400'
                    }`}
                  />
                  <span className="tabular-nums whitespace-nowrap">
                    {nitroPhase === 'active'
                      ? `ACTIVE ${nitroTimer.toFixed(1)}s`
                      : nitroPhase === 'cooldown'
                        ? `COOL ${nitroTimer.toFixed(1)}s`
                        : 'NITROUS'}
                  </span>
                  <span
                    className={`absolute left-0 bottom-0 h-1 transition-[width] duration-75 ${
                      nitroPhase === 'active'
                        ? 'bg-slate-950/60'
                        : nitroPhase === 'cooldown'
                          ? 'bg-amber-400/80'
                          : 'bg-sky-400'
                    }`}
                    style={{ width: `${nitroProgressPct}%` }}
                  />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Accelerate"
                  {...bindPad('throttle')}
                  className={`h-9 sm:h-11 px-3 sm:px-5 rounded-xl border font-bold text-[11px] sm:text-xs uppercase cursor-pointer transition-colors flex items-center gap-1 ${
                    activeInputs?.throttle
                      ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                      : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300/70 text-slate-950'
                  }`}
                >
                  <span>▲</span>
                  <span>ACCEL</span>
                </button>
              </div>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Steer Right"
                {...bindPad('right')}
                className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl border-2 font-bold text-2xl sm:text-3xl cursor-pointer transition-colors shadow-xl ${
                  activeInputs?.right
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-[#0c1117]/94 hover:bg-[#1a222b] border-white/25 text-white'
                }`}
              >
                ▶
              </button>
            </>
          ) : (
            <div className="flex flex-col items-end gap-2.5 bg-[#0c1117]/92 border border-white/15 rounded-2xl p-2 sm:p-2.5 text-[11px] font-semibold shadow-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="nitrous-btn"
                  data-nitro-phase={nitroPhase}
                  aria-label="Trigger Nitrous Boost"
                  disabled={nitroPhase === 'cooldown' || countdown > 0}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerNitrous();
                  }}
                  className={`relative overflow-hidden px-3 py-1.5 rounded-lg border font-bold uppercase flex items-center gap-1.5 transition-colors ${
                    nitroPhase === 'active'
                      ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.55)] cursor-default'
                      : nitroPhase === 'cooldown' || countdown > 0
                        ? 'bg-slate-900/90 border-slate-600/60 text-slate-400 cursor-not-allowed opacity-85'
                        : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/60 text-sky-200 cursor-pointer'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span className="tabular-nums whitespace-nowrap">
                    {nitroPhase === 'active'
                      ? `ACTIVE ${nitroTimer.toFixed(1)}s`
                      : nitroPhase === 'cooldown'
                        ? `COOL ${nitroTimer.toFixed(1)}s`
                        : 'NITROUS [SHIFT]'}
                  </span>
                  <span
                    className={`absolute left-0 bottom-0 h-0.5 transition-[width] duration-75 ${
                      nitroPhase === 'active'
                        ? 'bg-slate-950/60'
                        : nitroPhase === 'cooldown'
                          ? 'bg-amber-400'
                          : 'bg-sky-400'
                    }`}
                    style={{ width: `${nitroProgressPct}%` }}
                  />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Accelerate"
                  {...bindPad('throttle')}
                  className={`hidden sm:flex px-3.5 py-1.5 rounded-lg border font-bold uppercase cursor-pointer items-center gap-1 transition-colors ${
                    activeInputs?.throttle
                      ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                      : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300/70 text-slate-950'
                  }`}
                >
                  <span>W / ▲ ACCEL</span>
                </button>
              </div>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Steer Right"
                {...bindPad('right')}
                className={`h-11 sm:h-12 px-4 sm:px-5 rounded-xl border-2 font-bold text-sm cursor-pointer transition-colors ${
                  activeInputs?.right
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-white/10 text-white border-white/25 hover:bg-white/15'
                }`}
              >
                RIGHT / D ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
