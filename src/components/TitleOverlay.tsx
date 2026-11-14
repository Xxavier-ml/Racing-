import { MapPin, Play, SlidersHorizontal, Trophy } from 'lucide-react';
import type { LapLeaderboardEntry } from '../game/leaderboard';
import { VEHICLE_PRESETS, type VehiclePreset } from '../game/nairobiMap';
import type { GameMode } from './NairobiCanvas';

interface TitleOverlayProps {
  selectedPreset: VehiclePreset['id'];
  selectedMode: GameMode;
  bestLap: LapLeaderboardEntry | null;
  autoDrive: boolean;
  onSelectPreset: (id: VehiclePreset['id']) => void;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}

function formatBestLap(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function TitleOverlay({
  selectedPreset,
  selectedMode,
  bestLap,
  autoDrive,
  onSelectPreset,
  onSelectMode,
  onStart,
  onOpenGuide,
  onOpenSettings,
}: TitleOverlayProps) {
  return (
    <div className="race-title-screen fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Left-third asymmetric panel leaving center & right Nairobi skyline open */}
      <div className="race-panel race-title-panel my-auto max-w-md pointer-events-auto rounded-xl p-6 md:p-7">
        <div className="mb-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.24em] text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(87,224,161,0.9)]" />
          <span>Nairobi · Kenya</span>
          <span className="h-px flex-1 bg-gradient-to-r from-white/25 to-transparent" />
          <span className="font-mono text-amber-300">Circuit 01</span>
        </div>
        {/* Bespoke inline SVG Nairobi Express Emblem */}
        <div className="mb-5">
          <svg
            viewBox="0 0 430 86"
            className="w-full h-auto max-w-[360px]"
            role="img"
            aria-label="Nairobi Express: City Circuit"
          >
            {/* Kenyan flag accent bar */}
            <rect x="0" y="6" width="54" height="5" fill="#111827" />
            <rect x="58" y="6" width="54" height="5" fill="#ef4444" />
            <rect x="116" y="6" width="54" height="5" fill="#10b981" />
            {/* Stylized KICC silhouette */}
            <g transform="translate(374, 8)">
              <rect x="10" y="16" width="22" height="54" rx="2" fill="#c26d47" />
              <polygon points="5,16 37,16 32,8 10,8" fill="#ea580c" />
              <rect x="20" y="0" width="2.5" height="9" fill="#facc15" />
              <polygon points="2,70 40,70 30,52 12,52" fill="#9a3412" />
            </g>
            <text
              x="0"
              y="46"
              fill="#f8fafc"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="36"
              letterSpacing="1.5"
            >
              NAIROBI EXPRESS
            </text>
            <text
              x="0"
              y="70"
              fill="#f59e0b"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
              fontSize="13.5"
              letterSpacing="2.4"
            >
              3D STREET CIRCUIT · URBAN NAVIGATOR
            </text>
          </svg>
        </div>

        {/* Mode Toggle */}
        <div className="mb-4">
          <div className="text-xs font-medium text-slate-400 mb-2">Session Mode</div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-black/45 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => onSelectMode('circuit')}
              className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                selectedMode === 'circuit'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              5-Car Street Race
            </button>
            <button
              type="button"
              onClick={() => onSelectMode('free')}
              className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                selectedMode === 'free'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Wayfinder Explore
            </button>
          </div>
        </div>

        {/* Vehicle Selector with compact performance bars */}
        <div className="mb-6">
          <div className="text-xs font-medium text-slate-400 mb-2">Select Machine</div>
          <div className="space-y-2">
            {VEHICLE_PRESETS.map((v) => {
              const active = selectedPreset === v.id;
              const speedPct = Math.round(((v.maxSpeed * 3.6) / 245) * 100);
              const accelPct = Math.round((v.accel / 48) * 100);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectPreset(v.id)}
                  data-selected={active}
                  className={`race-vehicle-card w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors ${
                    active
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : 'bg-black/35 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-8 rounded-sm shrink-0"
                        style={{ backgroundColor: v.badgeColor }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{v.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{v.subtitle}</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold shrink-0">
                      {v.plate}
                    </span>
                  </div>
                  {active && (
                    <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-white/10 text-[10px] font-mono text-slate-300">
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span>TOP SPD</span>
                          <span>{Math.round(v.maxSpeed * 3.6)} KM/H</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${Math.min(100, speedPct)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span>TORQUE</span>
                          <span>{v.accel} M/S²</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${Math.min(100, accelPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {bestLap && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-300 truncate">
                Best Lap · <span className="text-white font-semibold">{bestLap.vehicleName}</span>
              </span>
            </div>
            <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0">
              {formatBestLap(bestLap.lapTimeSeconds)}
            </span>
          </div>
        )}

        {/* Primary CTA + Map Guide + Controls & Sensitivity */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="race-button-primary flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{selectedMode === 'circuit' ? 'Start Race' : 'Start Drive'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenGuide}
              className="race-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>City Map</span>
            </button>
          </div>
          <button
            type="button"
            data-testid="title-settings-btn"
            onClick={onOpenSettings}
            className="race-button-secondary w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Controls & Sensitivity · {autoDrive ? 'Auto-Drive ON' : 'Manual Drive'}
            </span>
          </button>
        </div>
      </div>

      {/* Single flat control hint line at bottom safe margin */}
      <div className="text-center text-xs md:text-sm font-medium text-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
        Auto-Drive Cruise · W/↑ Accelerate · S/↓ Brake · A/D Steer · Space Drift · Shift Nitro · O Sensitivity · G City Map
      </div>
    </div>
  );
}
