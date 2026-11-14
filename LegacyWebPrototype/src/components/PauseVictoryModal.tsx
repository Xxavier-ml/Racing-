import { Flag, Home, Map as MapIcon, Play, RotateCcw, SlidersHorizontal, Trash2, Trophy } from 'lucide-react';
import type { LapLeaderboardEntry } from '../game/leaderboard';
import type { GameMode, GamePhase } from './NairobiCanvas';

interface PauseVictoryModalProps {
  phase: Extract<GamePhase, 'paused' | 'gameover'>;
  mode: GameMode;
  elapsedTime: number;
  topSpeedKmh: number;
  checkpointsCleared: number;
  totalCheckpoints: number;
  racePosition: number;
  totalRacers: number;
  driftScore: number;
  leaderboard: LapLeaderboardEntry[];
  lastRecordedEntryId: string | null;
  lastRecordedRank: number | null;
  onClearLeaderboard: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}

function formatFinishTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1ST';
  if (n === 2) return '2ND';
  if (n === 3) return '3RD';
  return `${n}TH`;
}

export function PauseVictoryModal({
  phase,
  mode,
  elapsedTime,
  topSpeedKmh,
  checkpointsCleared,
  totalCheckpoints,
  racePosition,
  totalRacers,
  driftScore,
  leaderboard,
  lastRecordedEntryId,
  lastRecordedRank,
  onClearLeaderboard,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenGuide,
  onOpenSettings,
}: PauseVictoryModalProps) {
  const isVictory = phase === 'gameover';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className="race-panel race-result-panel w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl p-6 md:p-7"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            {isVictory ? (
              racePosition === 1 ? (
                <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
              ) : (
                <Flag className="w-6 h-6 text-emerald-400 shrink-0" />
              )
            ) : (
              <Play className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <h2
              id="modal-heading"
              className="text-2xl font-bold text-white truncate"
              style={{ fontFamily: 'Chakra Petch, sans-serif' }}
            >
              {isVictory
                ? racePosition === 1
                  ? 'NAIROBI GP CHAMPION'
                  : 'CHECKERED FLAG'
                : 'RACE PAUSED'}
            </h2>
          </div>

          {isVictory && lastRecordedRank !== null && (
            <span className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
              {lastRecordedRank === 1 ? 'New Track Record!' : `Top 5 · #${lastRecordedRank}`}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-300 mb-5">
          {isVictory
            ? `Finished ${ordinal(racePosition)} of ${totalRacers} across all six Nairobi CBD & Expressway checkpoints.`
            : 'Simulation paused. Resume racing or open the interactive Nairobi street directory.'}
        </p>

        {/* 4 Tabular-Nums Motorsport Telemetry Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          {mode === 'circuit' ? (
            <div className="bg-black/45 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Standing</div>
              <div className="text-base font-bold font-mono text-amber-400 tabular-nums mt-0.5">
                {ordinal(racePosition)}
                <span className="text-xs font-normal text-slate-400">/{totalRacers}</span>
              </div>
            </div>
          ) : (
            <div className="bg-black/45 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Landmarks</div>
              <div className="text-base font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                {checkpointsCleared}/{totalCheckpoints}
              </div>
            </div>
          )}

          <div className="bg-black/45 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Lap Time</div>
            <div className="text-base font-bold font-mono text-white tabular-nums mt-0.5">
              {formatFinishTime(elapsedTime)}
            </div>
          </div>

          <div className="bg-black/45 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Top Speed</div>
            <div className="text-base font-bold font-mono text-cyan-400 tabular-nums mt-0.5">
              {topSpeedKmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
            </div>
          </div>

          <div className="bg-black/45 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Style Score</div>
            <div className="text-base font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
              {driftScore} <span className="text-[10px] font-normal text-slate-400">PTS</span>
            </div>
          </div>
        </div>

        {/* Top 5 LocalStorage Circuit Leaderboard (shown prominently on race completion, and in pause if records exist) */}
        {(isVictory || leaderboard.length > 0) && (
          <div className="mb-5 bg-black/45 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Top 5 Circuit Lap Times
                </span>
              </div>
              {leaderboard.length > 0 && (
                <button
                  type="button"
                  onClick={onClearLeaderboard}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
                  title="Clear saved lap times"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-xs text-slate-400 py-2 text-center">
                Complete the 6-checkpoint Nairobi circuit to record your first lap time.
              </div>
            ) : (
              <div data-testid="leaderboard-list" className="space-y-1.5">
                {leaderboard.map((entry, idx) => {
                  const isCurrent = entry.id === lastRecordedEntryId;
                  const rankColors = [
                    'text-amber-400',
                    'text-slate-200',
                    'text-orange-400',
                    'text-slate-400',
                    'text-slate-500',
                  ];
                  return (
                    <div
                      key={entry.id}
                      data-testid="leaderboard-row"
                      className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg border text-xs ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-400/60 text-white'
                          : 'bg-white/[0.03] border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`font-mono font-bold w-5 shrink-0 ${rankColors[idx] ?? 'text-slate-400'}`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center gap-1.5">
                            <span className="truncate">{entry.vehicleName}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-bold uppercase shrink-0">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ordinal(entry.racePosition)} · {entry.topSpeedKmh} km/h · {entry.driftScore} PTS
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                        {formatFinishTime(entry.lapTimeSeconds)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5">
          {!isVictory ? (
            <button
              type="button"
              onClick={onResume}
              className="race-button-primary w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Race</span>
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="race-button-primary w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Race Again</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {!isVictory && (
              <button
                type="button"
                onClick={onRestart}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenGuide}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold cursor-pointer ${
                isVictory ? 'col-span-1' : ''
              }`}
            >
              <MapIcon className="w-4 h-4 text-emerald-400" />
              <span>City Map</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-sm font-semibold cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>Sensitivity</span>
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-sm font-semibold cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Garage</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
