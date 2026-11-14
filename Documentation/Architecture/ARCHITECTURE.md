# Architecture

Companion to `BLUEPRINT.md` (the plan) and `NETWORKING.md` (authority and replication).
This document is the code-level map: what owns what, and which direction dependencies flow.

## Module

`NairobiRacing` (Runtime, primary game module) — `IMPLEMENT_PRIMARY_GAME_MODULE`.

Dependencies (`NairobiRacing.Build.cs`): Core, CoreUObject, Engine, InputCore, EnhancedInput,
ChaosVehicles, Chaos, Niagara, UMG, Slate, SlateCore, AudioMixer, MetasoundEngine,
OnlineSubsystem, OnlineSubsystemUtils, Json, JsonUtilities, DeveloperSettings.

Log categories (`NairobiRacing.h`): `LogNairobiRace`, `LogNairobiVehicle`, `LogNairobiAI`,
`LogNairobiTraffic`, `LogNairobiWeather`, `LogNairobiOnline`, `LogNairobiSave`.

## Ownership map

| Class | Base | Authority | Responsibility |
| --- | --- | --- | --- |
| `ANairobiRaceGameMode` | `AGameModeBase` | Server | Countdown, official clock, race completion, spawns grid, greyboxes track, traffic host |
| `ANairobiRaceGameState` | `AGameStateBase` | Replicated | Phase, countdown, server race time, laps, weather snapshot, classified results |
| `ANairobiRacePlayerState` | `APlayerState` | Replicated | Per-racer checkpoint index, lap, best lap, finish time, position, vehicle id, ghost |
| `ANairobiRacePlayerController` | `APlayerController` | Client+server RPC | Input gathering, camera cycling, pause, recovery/finish requests |
| `ANairobiRaceManager` | `AActor` | **Server only** | Checkpoint validation, lap timing, standings, ghost capture, results, audit logs |
| `ANairobiRaceVehiclePawn` | `AWheeledVehiclePawn` | Replicated | Chaos vehicle, input → Chaos, checkpoint probe, recovery, presentation hooks |
| `UNairobiVehicleConfiguration` | `UPrimaryDataAsset` | Data | All vehicle tuning + presentation references |
| `UNairobiVehicleSetupLibrary` | `UBlueprintFunctionLibrary` | — | The only place config is written into Chaos |
| `UNairobiNitroComponent` | `UActorComponent` | Replicated | Nitrous state machine + thrust |
| `UNairobiVehicleRecoveryComponent` | `UActorComponent` | Local detection | Stranded/overturned detection |
| `UNairobiCameraRigComponent` | `USceneComponent` | Local | 5 camera modes, speed framing, look-back, shake |
| `UNairobiVehicleAudioComponent` | `UAudioComponent` | Local | Layered engine audio parameters + horn |
| `ANairobiRivalAIController` | `AAIController` | Server | Racing-line driving for rivals |
| `ANairobiTrafficManager` | `AActor` | Host-only | Pooled traffic lanes, signals, culling |
| `ANairobiTrafficVehicle` | `APawn` | Host-only | Kinematic traffic unit + archetype visuals |
| `UNairobiRaceTrackData` | `UPrimaryDataAsset` | Data | Circuit, racing line, streets, landmarks, grid, validation lengths |
| `ANairobiCheckpointGate` | `AActor` | Replicated | Gate volume + id (verdict lives elsewhere) |
| `ANairobiTrackBuilder` | `AActor` | Host | Greybox roads, blocks, gates from track data |
| `UNairobiWeatherSubsystem` | `UTickableWorldSubsystem` | Server | Weather state, fog/sun/sky, grip propagation |
| `ANairobiHUD` | `AHUD` | Local | Canvas telemetry/status/results |
| `UNairobiSaveSubsystem` | `UGameInstanceSubsystem` | Local | Profile, settings, local laps, ghost |
| `UNairobiProgressionSubsystem` | `UGameInstanceSubsystem` | Local | XP/level from validated results |
| `UNairobiOnlineSubsystem` | `UGameInstanceSubsystem` | Boundary | Auth/session/leaderboard entry points (no provider) |
| `NairobiRacing::Core` | Plain C++ | Shared | Race rules, ghost, leaderboard, lane/signal math, nitro, conversion |

## Data flow: a checkpoint crossing

```
1. Client pawn overlaps ANairobiCheckpointGate (probe volume)
2. Client is autonomous proxy → Server_SubmitCheckpoint(GateId)      [request only]
   (Host/server pawn instead calls the authority path directly)
3. ANairobiRaceVehiclePawn::HandleCheckpointOnAuthority()
      - reads ANairobiRaceGameState::GetServerRaceTimeSeconds()
      - reads GetActorLocation() from the SERVER pawn
4. ANairobiRaceManager::SubmitCheckpoint()
      - converts cm → metres, builds gate definitions from TrackData
      - calls NairobiRacing::Core::SubmitCheckpoint()  [verified rules]
      - rejects: inactive race / unknown gate / wrong order / out of range
      - accepts: advances progress, records lap, promotes ghost, marks finish
5. PlayerState replicas update (checkpoint index, lap, best lap, finish)
6. HUD reads PlayerState; audit log records the event
```

The client cannot supply a time, a position, a lap count or a completion flag.

## Data flow: race start

```
GameMode::PostLogin → RegisterRacer → StartRaceCountdown
  → GameState phase=Countdown, per-second countdown replication
  → BeginRace: phase=Racing, clock=0, RaceManager::InitializeRace (fresh progress)
  → vehicles SetRaceControlEnabled(true)
GameMode::Tick (server): clock += dt → GameState → RaceManager::UpdateStandings
  → ghost sampling at 12.5 Hz
  → all finished? → FinishRace → BuildResults → GameState.SetResults
```

## Determinism and units

- World units: **centimetres**. Rules layer: **metres**; conversion happens at the manager
  boundary (`ToRulesPosition`) and in the save/ghost conversion.
- Yaw: radians in gameplay code, degrees only at UI/rotation boundaries.
- The rules layer is deterministic and std-only; no engine types, no RNG, no time source
  (callers pass server time).

## Conventions

- Prefixes: `A` actors, `U` UObjects/components, `F` structs, `E` enums, `I` interfaces.
- Booleans `bXxx`; constants `constexpr`; no magic numbers in gameplay logic (data assets).
- Headers: `#pragma once`, own header first, then project, then engine, generated last.
- Replication: `GetLifetimeReplicatedProps` + `DOREPLIFETIME`; `OnRep_` only touches
  presentation; server-only mutators guard with `HasAuthority()` and log violations.
- Logs: category + stable `AUDIT event=... key=value` lines for competitive events.
- Every file in `Core/` must stay engine-free. Breaking that rule breaks the CI harness.

## What is intentionally absent

- No per-frame tick on the game mode's rules work beyond clock/standings; traffic ticks at
  20 Hz, AI at frame rate (5 vehicles), culled traffic suspended.
- No `Tick`-based HUD logic beyond drawing.
- No Blueprint-only gameplay rules; Blueprint subclasses may override defaults and visuals.
- No client-side score/lap authority anywhere.
