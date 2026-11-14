# Nairobi Racing — implementation blueprint

Target: **Unreal Engine 5.8, C++, Windows PC first**, simcade handling, Nairobi identity,
server-authoritative online racing as a release goal. This document is the technical plan
delivered before the rewrite; the status column states exactly what exists today.

**Status legend:** `DONE` = implemented in source · `VERIFIED` = compiled and executed in
this environment · `UNVERIFIED` = written but never compiled here · `TODO` = not started.

| Area | Status |
| --- | --- |
| Engine-free race rules | **VERIFIED** (108 checks) |
| Map-data migration | **VERIFIED** (7 tables, 42 checks) |
| Legacy feature audit | **VERIFIED** |
| Unreal C++ foundation | **UNVERIFIED** (no engine in this environment) |
| Editor map, assets, multiplayer | **TODO** (blocked, see §14) |

---

## 1. Proposed Unreal C++ architecture

Five layers with one rule: **presentation never owns competitive truth.**

```
        ┌────────────────────────────────────────────────────────────┐
        │ Presentation: HUD/UMG · Camera rig · Audio · VFX · Materials│
        └───────────────▲───────────────────────────┬────────────────┘
                        │ replicated state          │ input intent
        ┌───────────────┴───────────────────────────▼────────────────┐
        │ Game framework: GameMode · GameState · PlayerState · PC     │
        └───────────────▲───────────────────────────┬────────────────┘
                        │ verdicts / results        │ checkpoint claims
        ┌───────────────┴───────────────────────────▼────────────────┐
        │ Race rules (server-only): RaceManager + engine-free Core    │
        └───────────────▲───────────────────────────┬────────────────┘
                        │ authoritative transforms  │ driver input
        ┌───────────────┴───────────────────────────▼────────────────┐
        │ Simulation: Chaos Vehicles · AI controllers · Traffic       │
        └───────────────▲───────────────────────────┬────────────────┘
                        │ data assets / tables      │ persistence
        ┌───────────────┴───────────────────────────▼────────────────┐
        │ Data & services: TrackData · SaveGame · Progression · Online│
        └────────────────────────────────────────────────────────────┘
```

Key decisions:

- **One runtime module** (`NairobiRacing`) with folder-level separation rather than many
  modules. Modules become worthwhile when compile-time isolation pays for itself; at this
  size, folders do. The engine-free core is a folder, not a module, so it can also be
  compiled by a plain C++ harness (that is how it got verified here).
- **`NairobiRacing::Core` contains no UObject/Engine types.** Competitive rules live there
  so they can be unit-tested without the editor and reused by server tooling. UE classes
  wrap it; they never reimplement a rule.
- **Data assets over hardcoded constants.** Track layout, vehicle tuning, weather and race
  configuration are assets/tables. Gameplay code reads them.
- **Server authority by default.** Mutating functions check `HasAuthority()` and log when
  a client attempts to write. Client RPCs are requests, never results.
- **Blueprints are for designers**, not architecture: visual assets, animation blueprints,
  designer-tunable defaults, UMG widgets in Gate 4.

## 2. Project and folder structure

```text
NairobiRacing.uproject
Source/
  NairobiRacing.Target.cs / NairobiRacingEditor.Target.cs
  NairobiRacing/
    NairobiRacing.Build.cs / .h / .cpp        module + log categories
    Core/        NairobiTypes.h, NairobiDataRows.h, NairobiTrackRules.{h,cpp}
    GameModes/   RaceGameMode, RaceGameState, RacePlayerState, RacePlayerController
    Vehicles/    RaceVehiclePawn, VehicleConfiguration
    VehiclePhysics/ SetupLibrary, NitroComponent, VehicleRecoveryComponent
    Race/        RaceManager (authority)
    AI/          RivalAIController
    Traffic/     TrafficManager, TrafficVehicle
    World/       RaceTrackData, CheckpointGate, TrackBuilder
    Weather/     WeatherSubsystem
    Camera/      CameraRigComponent
    Audio/       VehicleAudioComponent
    UI/          HUD
    Online/      OnlineSubsystem (boundary)
    Progression/ ProgressionSubsystem
    SaveSystem/  SaveSubsystem, ProfileSaveGame
    Tests/       Unreal automation tests
Config/          DefaultEngine.ini, DefaultGame.ini, DefaultInput.ini
Content/
  Maps/ Vehicles/ Environment/ Materials/ Textures/ Audio/ Animations/ VFX/ UI/
  Data/Track/ (migrated CSVs)  Data/Vehicles/
Documentation/   Architecture/ AssetPipeline/ Testing/ Migration/ Environment/
LegacyWebPrototype/  preserved React/Three.js app
Tools/           Migration/, SimHarness/, Unreal/, verify_project.sh
```

## 3. Unreal plugins and tools required

| Plugin | Why |
| --- | --- |
| **ChaosVehiclesPlugin** | Four-wheel vehicle simulation, engine/gearbox, suspension, tyre friction |
| **EnhancedInput** | Shipping input path; runtime remapping, gamepad + keyboard + mouse |
| **Niagara** | Rain, tyre smoke, spray, sparks, dust, exhaust |
| **MetasoundEngine / AudioModulation** | Layered engine audio with RPM/load parameters and mixing buses |
| **OnlineSubsystemUtils** | Session/net driver plumbing for dedicated servers |
| **OnlineSubsystemSteam** (disabled) | Candidate platform session backend once provider is chosen |
| **ModelingToolsEditorMode** (editor only) | Level greyboxing in-editor |

Toolchain: UE 5.8, Visual Studio 2022 (MSVC v143, Windows 10/11 SDK), Git LFS, Python
(editor scripting), Node.js (migration tooling only, not shipped). Blender or an equivalent
DCC tool is required for Gate 3 vehicles/environment — not available in this environment.

## 4. Vehicle physics implementation strategy

**Foundation:** `UChaosWheeledVehicleMovementComponent` via `AWheeledVehiclePawn`. The
legacy 2D integrator is not ported.

- **Data-driven tuning:** `UNairobiVehicleConfiguration` holds mass, torque curve, RPM
  limits, final drive, gear ratios, shift RPM/time, max steer angle, steering response,
  high-speed steer reduction, downforce, drag, tyre grip scale, nitrous force and audio/VFX
  references. `UNairobiVehicleSetupLibrary::ApplyConfiguration` is the single bridge to
  Chaos, so an engine field rename is a one-file fix.
- **Handling goals:** responsive turn-in, readable weight transfer, controllable slides and
  recoverable mistakes — a simcade, not a tyre-curve simulator. Achieved with downforce,
  grip scale, differential/steering taper and suspension tuning in the asset.
- **Drifting:** handbrake reduces rear grip via Chaos; assists are tuning, not hidden forces.
- **Nitrous:** `UNairobiNitroComponent` applies force along the chassis forward vector and
  uses the verified `StepNitro` state machine (3.5 s active, 6 s cooldown).
- **Weather:** `ApplySurfaceGrip()` scales tyre friction from the weather profile
  (rain 0.62, fog 0.84), so braking distance and drift behaviour change.
- **Surface types:** collision/landscape physical materials map to the same grip scale.
- **Recovery:** stranded detection (overturned, or throttle held with no movement) plus a
  server-side reset to the nearest racing-line point.
- **Presentation:** skeletal chassis, wheel bones driven by an animation blueprint from
  speed/steer (approximation today; per-wheel Chaos wheel state is the Gate 3 upgrade),
  brake/reverse lights, exhaust and tyre-smoke Niagara hooks.
- **What is NOT claimed:** no vehicle has been driven in-editor yet, so handling is not
  validated. The presets are start points, not tuned cars.

## 5. Environment and asset-production strategy

- **Modular kit** for Nairobi CBD: road segments (2/3/4-lane), junctions, roundabout rings,
  curbs, sidewalks, medians, lane markings, crossing furniture, street lights, signals,
  matatu stages, bollards, trees/palms, parkland.
- **Signature landmarks** get bespoke treatment (accurate silhouette and proportions):
  KICC cylinder + cone, Times Tower stepped massing, Parliament/clock tower, Nyayo Stadium
  bowl, Railway Station roof, Afya Centre cylinder, Jamia Mosque domes/minarets.
- **Instancing + LODs** everywhere: HISM for repeated furniture/trees, static-mesh LODs,
  Nanite only where it pays (not for foliage cards or traffic proxies).
- **Collision:** simple static-mesh collision for roads/kerbs/walls; complex-as-simple for
  landmarks; decorative props no collision or query-only.
- **Truthful placeholders:** the current C++ builder uses engine cubes. It is labelled as
  greybox in code, docs and the asset manifest and is *not* presented as finished art.
- **Asset manifest** (`ASSET_MANIFEST.csv`) lists every required asset with source, licence,
  LODs, variants and status; nothing enters the game without a manifest row.

## 6. Nairobi map-data migration plan

Executed today (see `MIGRATION_MAP.md` §14–15 and `TRACK_DATA_MANIFEST.json`):

1. Keep `LegacyWebPrototype` as the migration source of truth.
2. Convert metres → centimetres and (X east, Z south) → (X north, Y east) per point.
3. Emit DataTable CSVs for checkpoints, racing line, streets, landmarks, roundabouts,
   city blocks and vehicle configs, with headers matching `FNairobi*Row` property names.
4. Assert invariants in the exporter (spawn lands on Kenyatta Ave; every circuit checkpoint
   present; finish last) and re-validate on every CI run.
5. Designers import the CSVs into DataTables, then populate `UNairobiRaceTrackData`
   (arrays + grid slots) and assign it to the game mode.
6. Road geometry is generated from the racing line/street spans; landmark footprints from
   the landmark/city-block tables.

Open decision: whether to replace the derived layout with licensed/OSM survey data for
greater road accuracy. The current data preserves *relative* positions, distances and the
circuit, which is the requirement; it is not a survey.

## 7. AI and traffic implementation strategy

**Rivals** (`ANairobiRivalAIController`): pure-pursuit steering on the racing line, corner
speed from measured curvature, throttle/brake blending, skill scaling per rival, stuck
detection with recovery. They drive real Chaos vehicles — no teleporting, no invented
standings. Gate 4 adds overtaking/avoidance, rubber-banding policy (if any) and difficulty
presets. Progress/standings come from the server's race manager, not the AI's own claims.

**Traffic** (`ANairobiTrafficManager`): pooled archetype vehicles (matatu, boda boda, City
Hoppa bus, saloon, safari) on left-hand lanes derived from the street tables; 16 s signal
cycle shared through the verified core; following distance; matatu stage stops; distance-
based activation (12,000 cm radius); 20 Hz updates. Traffic is ambience and carries no
race authority. Physics-driven traffic near the player (so impacts feel correct) is a Gate 4
improvement.

## 8. UI and camera migration strategy

**Cameras:** `UNairobiCameraRigComponent` with chase, bumper, hood, aerial and cockpit;
speed-sensitive arm length/FOV, spring-arm collision avoidance, look-back, optional impact
shake. Input switches modes at runtime.

**UI:** native only — React is not embedded.
- **Now:** `ANairobiHUD` draws speed, gear, RPM, nitrous, position, lap, race time, best
  lap, checkpoint count, countdown and classified results via Canvas. This guarantees an
  in-race HUD exists before UMG content.
- **Gate 4:** UMG widgets for main menu, vehicle select/garage, race setup, loading, HUD,
  pause, settings, results, leaderboards, profile, lobby/matchmaking status. The HUD
  documents exactly which fields the widgets must show.
- **Input:** Enhanced Input assets for shipping, legacy mappings as a fallback; full
  keyboard/mouse + gamepad, remappable actions, accessible defaults.

## 9. Multiplayer and backend design

Target: **dedicated-server, server-authoritative races**, configurable player limit
(`UNairobiOnlineSubsystem::MaxSupportedPlayers`, default policy 8–12, never hardcoded as
"4"). Clients predict locally; the server owns checkpoints, laps, positions, results.

Backend boundary (`UNairobiOnlineSubsystem`) covers auth, profiles, matchmaking,
leaderboards, race results, progression and ownership. **No provider is chosen or
committed yet** — that is a deliberate Gate 5 decision based on cost and platform
requirements, documented in `NETWORKING.md`. The client contains no credentials.

No claim of working multiplayer is made: no session has ever been run.

## 10. Security and anti-cheat foundations

Already encoded:

- Checkpoint claims are validated server-side against **the server's** pawn transform,
  strict gate order and gate radius (`SubmitCheckpoint`).
- Lap times are never accepted from a client; the official clock is server time.
- Lap plausibility rejects times below the track's physical envelope.
- Results are authored only by `ANairobiRaceManager::BuildResults()`.
- Progression refuses unvalidated results.
- Structured audit logs for checkpoint rejection, finish, flagged laps.
- Online subsystem refuses direct client submissions of official records.

Gate 5 adds: token handling, rate limiting, session ownership checks, input sanity limits
(max steering/throttle deltas, teleport detection), reconnect policy, audit log shipping.
Obscured client code is not treated as anti-cheat.

## 11. Performance budgets and graphics scalability

Initial budgets (to be validated by measurement, not assumption):

| Budget | Target (1080p, High, 60 FPS) |
| --- | --- |
| Frame time | ≤ 16.6 ms; 99th percentile ≤ 20 ms |
| Game thread | ≤ 8 ms |
| Render thread | ≤ 10 ms |
| GPU | ≤ 14 ms |
| Draw calls | ≤ 3,000 visible |
| Vehicles simulated | 5 racers + ≤ 24 active traffic |
| Traffic AI updates | 20 Hz, distance-culled |
| Texture pool | ≤ 2.5 GB (High) |
| Network | ≤ 32 KB/s per client up, ≤ 8 KB/s down (Gate 5 target) |

Presets: **Low** (no Lumen, no Nanite-heavy, reduced shadows/foliage, 70% res),
**Medium** (Lumen off or software, TAA, medium shadows), **High** (Lumen + virtual shadows,
TSR, 100% res), **Ultra** (HW RT optional, max effects, higher res scale). Defaults are
chosen from profile data on representative scenes, never by assumption. Weather profiles
must not silently double GPU cost (rain particles + wet materials are budgeted).

## 12. Testing and release strategy

- **Engine-free rules** — compiled and executed in CI (108 checks today).
- **Unreal automation tests** — `NairobiRacing.*` tests in `Source/NairobiRacing/Tests`
  (written, never run: no engine here).
- **Legacy suite** — 15/15 pass, protecting the migration reference.
- **Data validation** — 42 checks that CSVs match row structs and conversion invariants.
- **Manual editor tests** — driving, collisions, AI, traffic, weather, cameras, audio,
  settings; documented in `TEST_PLAN.md`.
- **Multiplayer tests** — latency/packet-loss simulation, reconnects, validation abuse.
- **Release tests** — clean build, Development/Shipping packages, second-machine run,
  input devices, long-session stability, crash recovery.

CI runs the verifiable jobs on GitHub-hosted Ubuntu. Unreal build + automation tests are a
conditional self-hosted Windows job (`UE_ROOT` variable) that is **skipped, not faked**,
when no engine runner is configured.

## 13. Milestone plan

| Gate | Deliverable | Status |
| --- | --- | --- |
| **1. Foundation** | Valid `.uproject`, module/build rules, class scaffolding, config, migrated data, architecture docs, engine-free rules verified | Source complete; **Unreal compile + startup map blocked** on an engine (scripts provided) |
| **2. Vertical slice** | One Chaos vehicle, steering/wheels, camera, collisions, small Nairobi test route, HUD, pause, start→drive→finish | C++ written; **not editor-verified**; needs UE machine + art placeholders |
| **3. Visual quality** | Production vehicle asset, improved environment section, materials/lighting, effects, layered audio | Not started (requires artists/DCC tools) |
| **4. Racing gameplay** | Circuit + free drive, AI rivals, traffic, checkpoints, lap timing, results, weather, UMG, local saves | Rules/AI/traffic/weather/save C++ written; UMG + tuning outstanding |
| **5. Multiplayer** | Dedicated-server build, sessions, multiple clients, server-authoritative progression, validated results, persistent records | Architecture + boundary only; provider decision open |
| **6. Production readiness** | Performance measurements, security review, stability, packaged build, release checklist, known issues | Not started |

The next actionable step on a UE machine is Gate 1 acceptance: compile, create the startup
map, assign the track asset, then Gate 2 play-testing.

## 14. Infrastructure, asset, software and licensing requirements

| Requirement | Needed for | Status |
| --- | --- | --- |
| Unreal Engine 5.8 | Everything native | **Unavailable here** |
| Windows 11 + VS 2022 (C++ workload) | Compile, cook, package | **Unavailable here** (Linux container) |
| ≥ 250 GB free SSD | Engine + DDC + cooked builds | **Unavailable** (9.7 GB free) |
| GPU + display for PIE | Visual verification | **Unavailable** (headless) |
| Blender/Substance or commissioned art | Gate 3 vehicles/environment | **Unavailable** |
| Audio recording/licensed SFX library | Engine/foley layers | Not sourced |
| Licensed reference or survey data (optional) | Map accuracy | Decision open |
| Online backend provider + dedicated hosts | Gate 5 | Decision open |
| A `LICENSE` for the repository | Distribution | **Missing** |
| Trademark review (rival names) | Shipping | **Must fix** |

## 15. Technical risks and unresolved decisions

Full version in `RISKS.md`. Highest-impact items:

1. **Chaos API drift** across 5.x versions (engine setup/transmission fields). Contained in
   one file; a small compile fix is expected on first build.
2. **Vehicle networking.** Chaos vehicles are not fully predicted/replicated out of the box.
   Plans: server-authoritative sim + client prediction with reconciliation, or a
   `NetworkPrediction`-based model. This is the largest Gate 5 risk and must be benchmarked
   under latency before promising competitive online racing.
3. **Scope of simulation for traffic** vs. the 60 FPS budget; physics traffic near the
   player may need a hybrid kinematic/dynamic scheme.
4. **Asset cost.** Production vehicles and a modular Nairobi kit are artist-weeks, not
   agent-hours. The project is architecturally ready but art-blocked.
5. **Map fidelity.** Current layout is the prototype's approximation. OSM/licensed data is
   an open decision with licensing implications.
6. **Naming/trademarks.** Legacy rival labels reference real models and must be replaced.
7. **Single-module compile times** will grow; splitting `NairobiRacingCore` into its own
   module is the planned response when build times exceed ~90 s incremental.
