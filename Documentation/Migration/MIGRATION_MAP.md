# Migration map — web prototype → native Unreal game

This document is the Phase 0 audit and the permanent record of what happened to every
part of the original application. The prototype itself is preserved unmodified (aside from
being moved) in `LegacyWebPrototype/`.

## 1. Existing application architecture (audit)

| Layer | Files | What it actually is |
| --- | --- | --- |
| Shell / state machine | `src/App.tsx` (443 lines) | React state machine: `title → playing → paused → gameover`, mode/vehicle/camera/weather selection, leaderboard + ghost persistence, settings and guide drawers. |
| Render + simulation loop | `src/components/NairobiCanvas.tsx` (1320) | Owns the Three.js scene, RAF loop, input, cameras, checkpoint logic, rival/traffic stepping, ghost playback, audio triggers, telemetry callback into React. |
| Pure simulation | `src/game/physics.ts` (447), `rivals.ts` (428), `traffic.ts` (296), `weather.ts` (100), `ghost.ts` (228), `leaderboard.ts` (132), `controlSettings.ts` (85) | Deterministic TypeScript logic with no DOM dependency; `nairobiMap.ts` (791) is the world database. |
| Rendering content | `src/three/nairobiWorld.ts` (1851), `vehicles.ts` (979), `textures.ts` (429) | Procedural Three.js geometry and canvas textures. No external 3D models or image assets. |
| UI | `GameHud.tsx` (1690), `TitleOverlay.tsx`, `PauseVictoryModal.tsx`, `NairobiGuideDrawer.tsx` (773), `ControlSettingsModal.tsx` | DOM/Tailwind interface. |
| Audio | `src/game/audio.ts` (224) | WebAudio oscillator-based engine/horn synthesis. |
| Server | `server.ts` (293) | Express: serves the Vite build, `/api/health`, and `/api/nairobi/explore` — a Gemini "Nairobi city guide" endpoint using `GEMINI_API_KEY`. |
| Tests | `src/game/nairobiLogic.test.ts` (584) | 15 `node:test` cases over the pure game logic. |

Total JS/TS: ~12,000 lines across 23 source files.

## 2. Game modes and features

- **Circuit race**: 6 checkpoints in fixed order + finish line on Uhuru Highway, 4 AI
  rivals, lap time, race position, drift score, top speed, victory/pause modal.
- **Free drive**: traffic interaction, landmark destination selection, turn-by-turn
  wayfinding, teleport-to-landmark, track recovery.
- **Weather**: clear / rainy / foggy, each with grip, braking, fog, sun and sky parameters.
- **Cameras**: chase, bumper, hood, aerial (plus look-back).
- **Assists**: auto-drive cruise, steering/throttle/brake sensitivity, touch controls.
- **Meta**: top-5 local leaderboard, best-lap ghost replay, control settings, HUD telemetry.

## 3. Vehicle presets (as audited)

| Preset | Max speed | Accel param | Handling | Drift grip | Notes |
| --- | --- | --- | --- | --- | --- |
| `rally` — Safari Rally GT | 64 m/s (230 km/h) | 46 | 2.95 | 0.90 | Twin-turbo AWD coupe |
| `nganya` — Nganya 111 Turbo | 59 m/s (212 km/h) | 42 | 2.55 | 0.84 | Widebody matatu |
| `safari` — Savannah V8 Cruiser | 57 m/s (205 km/h) | 44 | 2.65 | 0.88 | Armoured V8 |

The "accel" and "handling" numbers are not physical units. They exist only inside the
arcade integrator (`forwardVel += accel * dt`, `heading += handling * dt`). **They cannot
be carried into Chaos as-is**, and this migration does not pretend otherwise: the CSV
marks all three rows `NeedsEditorTuning` and carries suggested mass/torque so a human can
tune on a real surface.

## 4. Movement and collision logic (audit)

`stepVehiclePhysics()` is a 2D arcade integrator: forward/lateral velocity decomposition,
exponential drag, speed-clamped steering with a high-speed taper, handbrake-driven lateral
grip reduction (drift), 6-speed thresholds at 12/22/33/44/55/75 m/s, synthetic RPM curve,
3.5 s nitrous with a 6 s cooldown and a 1.42× multiplier, engine-temperature model, circle
vs AABB resolution with tangential wall grazing, roundabout island push-out and world
bounds clamping.

There is **no suspension, no tyre model, no mass transfer and no vertical axis**. Calling
this "realistic physics" would be false. In the native game it is replaced by Chaos
Vehicles; the arcade *feel* is preserved through tuning (nitrous timings, drift-friendly
grip, responsive steering) rather than by porting the formulas.

## 5. AI rivals (audit)

Four rivals follow 23 ordered waypoints with a per-rival lane bias, speed caps per point,
checkpoint counting, finish detection and a standings sort. They are kinematic — they do
not collide with the world and their speed is set directly. In the native game they become
real Chaos vehicles driven by AI controllers (no teleporting, no invented standings).

## 6. Traffic (audit)

8 streets × 2 directions × 2–3 vehicles = 52 agents. Archetypes: matatu, boda boda, City
Hoppa bus, saloon, safari. Left-hand lane placement, a 16 s signal cycle (6 s green / 2 s
amber per axis), matatu stage stops, following distance, player-in-front braking, lane
bias weaving for boda bodas, and wrap-around at street ends.

## 7. Nairobi map data and landmarks

- **Streets (8)**: Uhuru Highway A104, Moi Avenue, Tom Mboya Street, University Way,
  Kenyatta Avenue, City Hall Way, Haile Selassie Avenue, Mombasa/Lang'ata Road.
- **Roundabouts (5)**: Kenyatta Ave, Haile Selassie, Nyayo Stadium (Bunyala), Globe
  Cinema/University Way, Railways.
- **Landmarks (10)**: KICC, Times Tower, Parliament, Uhuru Park, Nyayo National Stadium,
  Kenya National Archives, Nairobi Railway Station, Afya Centre, Jamia Mosque, UoN Towers.
- **Circuit checkpoints (6)**: KICC → Archives → Afya Centre → Times Tower → Nyayo
  Stadium → Uhuru Park, then the finish line on Uhuru Highway at `(-95, -14)`.
- **City blocks (20)** with collider footprints; **expressway piers** every 45 m at x = −122.
- **Spawn**: Kenyatta Avenue eastbound lane `(-168, -50.5)`, heading +π/2 (east).

## 8. Environment generation (audit)

`nairobiWorld.ts` builds all geometry procedurally: road ribbons, lane markings, curbs,
median, buildings with window emissive textures, KICC's cylinder and cone, Times Tower's
stepped massing, the expressway viaduct and piers, trees, street furniture, skyline ring,
plus canvas-generated tarmac/concrete/glass textures and a rain particle system.

This is the source of the *layout and silhouette intent*, not an asset library. In Unreal
it becomes modular environment assets authored to those proportions; the current C++ builder
is an explicitly temporary greybox.

## 9. UI screens and interaction flows (audit)

Title (mode + vehicle + best lap + start) → HUD (speed/rpm/gear/nitro/position/lap/
checkpoints/guidance/rival arrows/mini-map/touch pedals) → pause/victory modal
(stats + top-5 leaderboard + restart/return) → guide drawer (landmark list, wayfinding,
teleport) → control settings modal. Keyboard: Enter/Space start, P/Esc pause, C camera,
R recover, V touch controls, O settings, W weather, M mute, H horn, Shift nitrous, B look back.

## 10. Tests and commands (audit)

15 tests covering spawn safety, wayfinding, left-hand lanes, traffic archetypes/signals,
steering/drift/boost/collision, rival progression/standings, recovery, leaderboard
ordering, auto-drive, engine temperature, direction IDs, ghost interpolation, weather,
nitrous timing and finish-line behaviour.

There is **no `test` script in package.json**; the suite is run with the Node test runner:

```bash
cd LegacyWebPrototype
npx tsx --test src/game/nairobiLogic.test.ts     # 15/15 pass (verified in this environment)
```

`npm run lint` is `tsc --noEmit`; `npm run build` is `vite build`.

## 11. Build and deployment (audit)

Vite + React 19 + Tailwind 4, served by `tsx server.ts` (Express 4) on port 3000.
`/api/nairobi/explore` calls Gemini 3.8 Flash with Maps/Search grounding and requires
`GEMINI_API_KEY`; `.env.example` documents `GEMINI_API_KEY` and `APP_URL`. The project was
built for an AI Studio-style host, not for desktop distribution.

## 12. Licences, dependencies and asset restrictions

- **No `LICENSE` file exists in the repository.** The code's redistribution terms are
  therefore undefined; this must be resolved before any public release (see release
  checklist).
- Runtime dependencies: React, React DOM, Three.js, Express, `@google/genai`, Tailwind,
  `motion`, `lucide-react`, `dotenv`. Dev: Vite, TypeScript, tsx, esbuild, types.
- No third-party 3D models, textures, audio files or fonts are committed — everything
  visual/audible is generated procedurally, so there is no inherited asset licence.
- **Trademark exposure to fix:** rival labels in `rivals.ts` include real manufacturer
  model names ("Supra", "Evo", "WRX", "M35"). These are descriptive/personal-project
  references, not licensed branding, and must not ship. The native roster uses original
  names (see `ASSET_STANDARDS.md`).
- The Gemini integration is a server-side capability; a packaged game must never carry
  `GEMINI_API_KEY`. That feature is intentionally not migrated into the client.

## 13. Feature disposition

| Prototype feature | Disposition | Where it lives now |
| --- | --- | --- |
| Nairobi street/landmark/city-block data | **Preserved as data** | `Content/Data/Track/*.csv` → `UNairobiRaceTrackData` |
| Circuit checkpoint order + finish line | **Preserved** | `DT_Checkpoints.csv`, validated by `NairobiTrackRules` |
| Race rules (order, laps, standings) | **Reimplemented + hardened** | `Core/NairobiTrackRules`, `ANairobiRaceManager` |
| Arcade vehicle integrator | **Intentionally replaced** | Chaos Vehicles + `UNairobiVehicleConfiguration` |
| Nitrous timing/cooldown | **Preserved exactly** | `NairobiRacing::Core::StepNitro` (3.5 s / 6 s, harness-tested) |
| Drift feel and stability assists | **Redesigned as tuning** | Grip scale, handbrake, downforce, steering taper in the data asset |
| 4 rival racers | **Reimplemented** | `ANairobiRivalAIController` driving real vehicles |
| Traffic archetypes + left-hand lanes + signals | **Preserved in behaviour, rebuilt in engine** | `ANairobiTrafficManager`, lane/signal math in the core |
| Weather profiles (clear/rain/fog) | **Preserved and extended** | `UNairobiWeatherSubsystem` (+cloudy/night, server-authoritative) |
| Weather affecting grip/braking | **Preserved and enforced** | Chaos tyre friction via `ApplySurfaceGrip` |
| 4 camera modes | **Reimplemented, +cockpit/look-back** | `UNairobiCameraRigComponent` |
| Best-lap ghost | **Preserved** | Core ghost sampling + `UNairobiSaveSubsystem` |
| Local top-5 leaderboard | **Preserved locally; official board deferred to backend** | Save profile + `InsertLeaderboardRecord` |
| HUD telemetry | **Reimplemented natively** | `ANairobiHUD` (Canvas) → UMG in Gate 4 |
| Title/pause/victory/settings screens | **Redesigned as native UMG** (deferred) | Gate 4; Canvas HUD is the current fallback |
| Wayfinding / teleport / landmark guide | **Postponed to free-roam polish** | Track data already carries waypoints + lat/long |
| Gemini Nairobi city guide | **Dropped** | Not part of the racing game; requires a server API key and an external service |
| Auto-drive cruise assist | **Dropped** | Trivialises the driving model; not appropriate for a racing game |
| React/Three.js UI and rendering | **Not migrated** | Prototype retained for reference only |
| Express server | **Not migrated** | Not needed by a native game |

## 14. Coordinate conversion

```text
Legacy (three.js, metres):  +X east, +Z south, +Y up, heading 0 = north (−Z)
Unreal (centimetres):       +X north, +Y east, +Z up, yaw 0 = +X

Unreal.X = −Legacy.Z × 100
Unreal.Y =  Legacy.X × 100
Unreal.Z =  Legacy.Y × 100
Yaw      =  Legacy.heading        (both measure 0 as north, positive towards east)
```

No mirroring or blind scaling is applied: positions are transformed per point and then
verified. `Tools/Migration/export_track_data.ts` asserts that the spawn becomes
`(5050, −16800) cm` with yaw `+π/2`, and the validator re-checks it on every CI run.
`NairobiRacing::Core::LegacyCoordinates` holds the same conversion for runtime use, and the
harness tests it (north must become +X).

Streets are exported as an axis + span rather than a centre point, because Unreal needs to
know which axis a street runs along: north-south streets run along +X (`FixAxisCm` is the
Y centreline), east-west streets run along +Y (`FixAxisCm` is the X centreline).

## 15. Data mapping

| Legacy constant | Unreal destination |
| --- | --- |
| `NAIROBI_STREETS` | `DT_Streets.csv` → `FNairobiStreetRow` → `UNairobiRaceTrackData::Streets` |
| `NAIROBI_ROUNDABOUTS` | `DT_Roundabouts.csv` → `FNairobiRoundaboutRow` |
| `NAIROBI_LANDMARKS` | `DT_Landmarks.csv` → `FNairobiLandmarkRow` |
| `CIRCUIT_CHECKPOINT_IDS` + `FINISH_LINE` | `DT_Checkpoints.csv` (ordered, finish last) |
| `CIRCUIT_RACING_WAYPOINTS` | `DT_RacingLine.csv` → `RacingLineCm` (closed loop) |
| `CBD_BUILDING_BLOCKS`, `EXPRESSWAY_PIERS` | `DT_CityBlocks.csv` (piers regenerated from the same spacing in the builder) |
| `PLAYER_SPAWN`, `FINISH_LINE` | `UNairobiRaceTrackData::FreeDriveSpawnCm`, `GridSlots`, validated manifest |
| `VEHICLE_PRESETS` | `DT_VehicleConfigs.csv` (`NeedsEditorTuning`) → `UNairobiVehicleConfiguration` |
| `WEATHER_PROFILES` | `UNairobiWeatherSubsystem::BuildWeatherState` |
| `NITRO_ACTIVE_DURATION` / `NITRO_COOLDOWN_DURATION` | `NairobiRacing::Core::NitroActiveSeconds` / `NitroCooldownSeconds` |
| `MATATU_ROUTES`, archetype speeds/lengths | `ANairobiTrafficVehicle::ApplyArchetypeVisuals` + traffic manager |

## 16. Migration risks recorded

1. **Scale feel**: the prototype's streets are ~18–26 m wide and its cars ~4.4 m long; once
   proper Chaos vehicles exist, corner radii at these widths may feel tight. The racing
   line must be validated in-editor and possibly widened (documented decision, not silently
   changed).
2. **Landmark accuracy**: silhouettes are approximations from the prototype's procedural
   massing, not surveyed geometry. Recognisable proportions are prioritised over GIS
   accuracy; licensed map data is an open decision.
3. **Checkpoint radii**: exported at 16 m (prototype tolerance). With real vehicle physics
   this may be generous; tuning is an editor task.
4. **Traffic density vs. flow**: 52 agents in an 8-street CBD is dense. The native manager
   pools and culls, but density must be tuned against the 60 FPS budget.
5. **Vehicle naming**: legacy rival names contain real model trademarks and must not ship.
