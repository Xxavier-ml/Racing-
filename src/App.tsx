import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CIRCUIT_CHECKPOINT_IDS,
  NAIROBI_LANDMARKS,
  VEHICLE_PRESETS,
  type NairobiLandmark,
  type VehiclePreset,
} from './game/nairobiMap';
import {
  clearLeaderboard,
  loadLeaderboard,
  saveLapResult,
  type LapLeaderboardEntry,
} from './game/leaderboard';
import {
  loadControlSettings,
  saveControlSettings,
  type ControlSettings,
} from './game/controlSettings';
import {
  clearBestLapGhost,
  loadBestLapGhost,
  saveBestLapGhost,
  type GhostLapRecording,
  type GhostSample,
} from './game/ghost';
import { cycleWeatherCondition, type WeatherCondition } from './game/weather';
import {
  NairobiCanvas,
  type CameraViewMode,
  type GameMode,
  type GamePhase,
  type HudTelemetry,
  type NairobiCanvasHandle,
} from './components/NairobiCanvas';
import { TitleOverlay } from './components/TitleOverlay';
import { GameHud } from './components/GameHud';
import { PauseVictoryModal } from './components/PauseVictoryModal';
import { NairobiGuideDrawer } from './components/NairobiGuideDrawer';
import { ControlSettingsModal } from './components/ControlSettingsModal';

export default function App() {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const canvasRef = useRef<NairobiCanvasHandle | null>(null);

  const [phase, setPhase] = useState<GamePhase>(autostart ? 'playing' : 'title');
  const [mode, setMode] = useState<GameMode>('circuit');
  const [presetId, setPresetId] = useState<VehiclePreset['id']>('rally');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [muted, setMuted] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)')?.matches),
  );
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [controlSettings, setControlSettings] = useState<ControlSettings>(() => loadControlSettings());
  const [weather, setWeather] = useState<WeatherCondition>('clear');
  const [contextLost, setContextLost] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState<HudTelemetry | null>(null);
  const [arrivalBanner, setArrivalBanner] = useState<NairobiLandmark | null>(null);
  const [finalStats, setFinalStats] = useState({
    elapsedTime: 0,
    topSpeedKmh: 0,
    checkpointsCleared: 0,
    racePosition: 1,
    totalRacers: 5,
    totalDriftScore: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LapLeaderboardEntry[]>(() => loadLeaderboard());
  const [bestGhost, setBestGhost] = useState<GhostLapRecording | null>(() => loadBestLapGhost());
  const [lastLapRecord, setLastLapRecord] = useState<{
    entryId: string;
    rank: number | null;
  } | null>(null);

  const bannerTimerRef = useRef<number | null>(null);
  const pausedByGuideRef = useRef<boolean>(false);
  const pausedBySettingsRef = useRef<boolean>(false);

  // Sync game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const handleOpenSettings = useCallback(() => {
    if (phase === 'playing') {
      pausedBySettingsRef.current = true;
      setPhase('paused');
    }
    setSettingsOpen(true);
  }, [phase]);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
    if (pausedBySettingsRef.current) {
      pausedBySettingsRef.current = false;
      setPhase('playing');
    }
  }, []);

  const handleUpdateControlSettings = useCallback((next: ControlSettings) => {
    const clean = saveControlSettings(next);
    setControlSettings(clean);
  }, []);

  const handleCycleWeather = useCallback(() => {
    setWeather((prev) => cycleWeatherCondition(prev));
  }, []);

  // Toggle on-screen virtual pedals [V] and Controls & Sensitivity [O]
  useEffect(() => {
    if (guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!e.repeat && e.code === 'KeyV' && phase === 'playing' && !settingsOpen) {
        setShowTouchControls((prev) => !prev);
      } else if (!e.repeat && e.code === 'KeyO' && (phase === 'playing' || phase === 'title')) {
        if (settingsOpen) {
          handleCloseSettings();
        } else {
          handleOpenSettings();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, guideOpen, settingsOpen, handleOpenSettings, handleCloseSettings]);

  const handleStart = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.dataset.state = 'playing';
    setGuideOpen(false);
    setArrivalBanner(null);
    setLastLapRecord(null);
    canvasRef.current?.resetRun(presetId, mode, autostart);
    setPhase('playing');
  }, [presetId, mode, autostart]);

  const handleRestart = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.dataset.state = 'playing';
    setGuideOpen(false);
    setArrivalBanner(null);
    setLastLapRecord(null);
    canvasRef.current?.resetRun(presetId, mode, autostart);
    setPhase('playing');
  }, [presetId, mode, autostart]);

  // Enter / Space handshake on Title Screen
  useEffect(() => {
    if (phase !== 'title' || guideOpen || settingsOpen) return;
    const onTitleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleStart();
      }
    };
    window.addEventListener('keydown', onTitleKey);
    return () => window.removeEventListener('keydown', onTitleKey);
  }, [phase, guideOpen, settingsOpen, handleStart]);

  const handleTogglePause = useCallback(() => {
    if (settingsOpen) {
      handleCloseSettings();
      return;
    }
    if (guideOpen) {
      setGuideOpen(false);
      if (pausedByGuideRef.current) {
        pausedByGuideRef.current = false;
        setPhase('playing');
      }
      return;
    }
    setPhase((prev) => {
      if (prev === 'playing') {
        setFinalStats({
          elapsedTime: telemetry?.elapsedTime ?? 0,
          topSpeedKmh: telemetry?.topSpeedKmh ?? 0,
          checkpointsCleared: telemetry?.checkpointIndex ?? 0,
          racePosition: telemetry?.racePosition ?? 1,
          totalRacers: telemetry?.totalRacers ?? 5,
          totalDriftScore: telemetry?.totalDriftScore ?? 0,
        });
        return 'paused';
      }
      if (prev === 'paused') return 'playing';
      return prev;
    });
  }, [guideOpen, settingsOpen, handleCloseSettings, telemetry]);

  const handleToggleGuide = useCallback(() => {
    setGuideOpen((wasOpen) => {
      const nextOpen = !wasOpen;
      if (nextOpen && phase === 'playing') {
        pausedByGuideRef.current = true;
        setPhase('paused');
      } else if (!nextOpen && pausedByGuideRef.current) {
        pausedByGuideRef.current = false;
        setPhase('playing');
      }
      return nextOpen;
    });
  }, [phase]);

  const handleCloseGuide = useCallback(() => {
    setGuideOpen(false);
    if (pausedByGuideRef.current) {
      pausedByGuideRef.current = false;
      setPhase('playing');
    }
  }, []);

  const handleCheckpointReached = useCallback(
    (
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
    ) => {
      setArrivalBanner(landmark);
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }
      bannerTimerRef.current = window.setTimeout(() => {
        setArrivalBanner(null);
      }, 3600);

      if (finishedCircuit) {
        const vehicle = VEHICLE_PRESETS.find((v) => v.id === presetId) ?? VEHICLE_PRESETS[0];
        const saved = saveLapResult({
          lapTimeSeconds: snapshot.elapsedTime,
          presetId,
          vehicleName: vehicle.name,
          topSpeedKmh: snapshot.topSpeedKmh,
          driftScore: snapshot.totalDriftScore,
          racePosition: snapshot.racePosition,
        });
        setLeaderboard(saved.entries);
        const ghostRes = saveBestLapGhost({
          lapTimeSeconds: snapshot.elapsedTime,
          presetId,
          vehicleName: vehicle.name,
          samples: snapshot.ghostSamples,
        });
        if (ghostRes.saved && ghostRes.recording) {
          setBestGhost(ghostRes.recording);
        }
        setLastLapRecord({ entryId: saved.savedEntry.id, rank: saved.rank });
        setFinalStats({
          elapsedTime: snapshot.elapsedTime,
          topSpeedKmh: snapshot.topSpeedKmh,
          checkpointsCleared: nextIndex,
          racePosition: snapshot.racePosition,
          totalRacers: snapshot.totalRacers,
          totalDriftScore: snapshot.totalDriftScore,
        });
        setPhase('gameover');
      }
    },
    [presetId],
  );

  const handleClearLeaderboard = useCallback(() => {
    clearLeaderboard();
    clearBestLapGhost();
    setLeaderboard([]);
    setBestGhost(null);
    setLastLapRecord(null);
  }, []);

  const handleNextLandmark = useCallback(() => {
    const curId = telemetry?.guidance.targetLandmark.id ?? CIRCUIT_CHECKPOINT_IDS[0];
    const idx = NAIROBI_LANDMARKS.findIndex((l) => l.id === curId);
    const next = NAIROBI_LANDMARKS[(idx + 1) % NAIROBI_LANDMARKS.length];
    canvasRef.current?.setTargetLandmark(next.id);
  }, [telemetry]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0f1419]">
      {/* Isolated WebGL 3D Nairobi Canvas */}
      <NairobiCanvas
        ref={canvasRef}
        phase={phase}
        mode={mode}
        presetId={presetId}
        muted={muted}
        controlSettings={controlSettings}
        bestGhost={bestGhost}
        weather={weather}
        onTelemetry={setTelemetry}
        onCheckpointReached={handleCheckpointReached}
        onTogglePause={handleTogglePause}
        onToggleGuide={handleToggleGuide}
        onToggleMute={() => setMuted((m) => !m)}
        onCycleWeather={handleCycleWeather}
        onCameraChange={setCameraMode}
        onContextLossChange={setContextLost}
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1419] p-6 text-center">
          <div className="max-w-md border border-white/15 rounded-xl p-6 bg-[#151c24]">
            <h2 className="text-lg font-bold text-white">3D Renderer Paused</h2>
            <p className="text-sm text-slate-300 mt-2">
              The graphics context was interrupted. Reload the page to restore the Nairobi 3D circuit.
            </p>
          </div>
        </div>
      )}

      {phase === 'title' && !settingsOpen && (
        <TitleOverlay
          selectedPreset={presetId}
          selectedMode={mode}
          bestLap={leaderboard[0] ?? null}
          autoDrive={controlSettings.autoDrive}
          onSelectPreset={setPresetId}
          onSelectMode={setMode}
          onStart={handleStart}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {phase === 'playing' && !guideOpen && !settingsOpen && (
        <GameHud
          telemetry={telemetry}
          mode={mode}
          cameraMode={cameraMode}
          weather={weather}
          muted={muted}
          showTouchControls={showTouchControls}
          autoDrive={controlSettings.autoDrive}
          arrivalBanner={arrivalBanner}
          onCycleCamera={() => canvasRef.current?.cycleCamera()}
          onCycleWeather={handleCycleWeather}
          onToggleTouchControls={() => setShowTouchControls((prev) => !prev)}
          onOpenSettings={handleOpenSettings}
          onRecoverRoad={() => canvasRef.current?.recoverToRoad()}
          onToggleGuide={handleToggleGuide}
          onToggleMute={() => setMuted((m) => !m)}
          onTogglePause={handleTogglePause}
          onHonkHorn={() => canvasRef.current?.honkHorn()}
          onNextLandmark={handleNextLandmark}
          onTriggerNitrous={() => canvasRef.current?.triggerNitrous()}
          onVirtualControl={(key, active) => canvasRef.current?.setVirtualControl(key, active)}
        />
      )}

      {(phase === 'paused' || phase === 'gameover') && !guideOpen && !settingsOpen && (
        <PauseVictoryModal
          phase={phase}
          mode={mode}
          elapsedTime={
            phase === 'gameover' ? finalStats.elapsedTime : (telemetry?.elapsedTime ?? finalStats.elapsedTime)
          }
          topSpeedKmh={Math.max(telemetry?.topSpeedKmh ?? 0, finalStats.topSpeedKmh)}
          checkpointsCleared={
            phase === 'gameover'
              ? finalStats.checkpointsCleared
              : (telemetry?.checkpointIndex ?? finalStats.checkpointsCleared)
          }
          totalCheckpoints={CIRCUIT_CHECKPOINT_IDS.length}
          racePosition={
            phase === 'gameover'
              ? finalStats.racePosition
              : (telemetry?.racePosition ?? finalStats.racePosition)
          }
          totalRacers={
            phase === 'gameover'
              ? finalStats.totalRacers
              : (telemetry?.totalRacers ?? finalStats.totalRacers)
          }
          driftScore={
            phase === 'gameover'
              ? finalStats.totalDriftScore
              : (telemetry?.totalDriftScore ?? finalStats.totalDriftScore)
          }
          leaderboard={leaderboard}
          lastRecordedEntryId={lastLapRecord?.entryId ?? null}
          lastRecordedRank={lastLapRecord?.rank ?? null}
          onClearLeaderboard={handleClearLeaderboard}
          onResume={() => setPhase('playing')}
          onRestart={handleRestart}
          onReturnTitle={() => {
            setArrivalBanner(null);
            setLastLapRecord(null);
            canvasRef.current?.resetRun(presetId, mode, true);
            setPhase('title');
          }}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenSettings={handleOpenSettings}
        />
      )}

      <ControlSettingsModal
        open={settingsOpen}
        settings={controlSettings}
        onChange={handleUpdateControlSettings}
        onClose={handleCloseSettings}
      />

      <NairobiGuideDrawer
        open={guideOpen}
        activeLandmarkId={telemetry?.guidance.targetLandmark.id ?? CIRCUIT_CHECKPOINT_IDS[0]}
        playerPos={telemetry ? { x: telemetry.x, z: telemetry.z } : null}
        onClose={handleCloseGuide}
        onSelectDestination={(id) => {
          canvasRef.current?.setTargetLandmark(id);
          if (phase === 'title') {
            handleStart();
            canvasRef.current?.setTargetLandmark(id);
          } else if (pausedByGuideRef.current) {
            pausedByGuideRef.current = false;
            setPhase('playing');
          }
        }}
        onTeleportToLandmark={(id) => {
          if (phase === 'title') {
            handleStart();
          } else if (pausedByGuideRef.current) {
            pausedByGuideRef.current = false;
            setPhase('playing');
          }
          canvasRef.current?.teleportToLandmark(id);
        }}
      />
    </main>
  );
}
