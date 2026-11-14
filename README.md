# Nairobi Racing

A native **Unreal Engine 5 C++ racing game** set in Nairobi, Kenya — built by migrating the
original React/Three.js prototype into a real standalone game architecture.

The Nairobi identity is the point: Uhuru Highway, Kenyatta Avenue, Moi Avenue, KICC,
Times Tower, Nyayo Stadium, left-hand matatu traffic, and a CBD street circuit that keeps
the prototype's landmarks and checkpoints in their relative positions.

> **Status: Gate 1 (native project foundation) complete as source; Unreal compilation not
> yet performed.** This environment has no Unreal Engine, no MSVC/.NET and not enough disk
> for an engine install, so every Unreal-facing `.cpp` is written and architecturally
> wired but **unverified by a compiler**. What *was* compiled, executed and verified here:
> the engine-free race-rule core (108 checks), the preserved legacy suite (15/15), the map
> migration (7 tables, validated) and the data-table contract (42 checks).
> Read [TOOLCHAIN_STATUS](Documentation/Environment/TOOLCHAIN_STATUS.md) before claiming anything runs.

## Repository layout

```text
NairobiRacing.uproject        Unreal 5.8 project (Chaos Vehicles, Enhanced Input, Niagara, MetaSounds)
Source/
  NairobiRacing/              Single runtime game module
    Core/                     Shared types + engine-free, unit-tested race rules
    GameModes/                Race game mode, replicated game state, player state/controller
    Vehicles/                 Chaos vehicle pawn + data-driven vehicle configuration
    VehiclePhysics/           Chaos setup, nitrous, recovery
    Race/                     Server-authoritative checkpoint/lap/standings manager
    AI/                       Racing-line rival controllers
    Traffic/                  Nairobi traffic director + traffic vehicles
    World/                    Track data asset, checkpoint gates, procedural greybox builder
    Weather/                  Server-authoritative weather + handling grip
    Camera/                   Chase/bumper/hood/aerial/cockpit rig
    Audio/                    Layered, parameter-driven vehicle audio
    UI/                       Canvas HUD (UMG widgets land in Gate 4)
    Online/                   Online service boundary (no provider configured yet)
    Progression/              XP and driver level
    SaveSystem/               Native save profile, local records, ghost laps
    Tests/                    Unreal automation tests
Config/                       Engine/game/input ini
Content/                      Data/ (migrated CSV), Maps, Vehicles, Environment, Audio, ...
LegacyWebPrototype/           The original React/Three.js app, preserved as migration reference
Documentation/                Architecture, migration, assets, testing, release
Tools/                        Migration exporter, data validator, sim harness, editor scripts
```

## Quick start (no Unreal required)

```bash
./Tools/verify_project.sh
```

Runs the compiled rule tests, the legacy prototype suite, regenerates and diffs the
migrated map data, then validates the DataTable contracts.

```bash
npx tsx Tools/Migration/export_track_data.ts   # regenerate Content/Data/** from the legacy map
./Tools/SimHarness/run_tests.sh                # compile + run the engine-free rules
cd LegacyWebPrototype && npx tsx --test src/game/nairobiLogic.test.ts
```

## Quick start (Windows + Unreal Engine 5.8)

1. Install UE 5.8 and Visual Studio 2022 (Game development with C++).
2. `git lfs install && git lfs pull`, then generate project files and build
   `NairobiRacingEditor` (Development | Win64).
3. Run `py "<ProjectDir>/Tools/Unreal/create_startup_map.py"` in the editor to create the
   binary startup map (maps cannot be authored outside the editor).
4. Create `DA_NairobiCircuit` and import `Content/Data/Track/*.csv` as DataTables
   (property names already match), then assign it to the game mode.
5. Press Play — the greybox circuit, checkpoint gates and traffic build from data.

Full detail, including every manual step and its reason, is in
[TOOLCHAIN_STATUS](Documentation/Environment/TOOLCHAIN_STATUS.md).

## Driving controls (defaults)

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Throttle / brake-reverse | W / S (also ↑/↓) | Right trigger |
| Steer | A / D (also ←/→) | Left stick X |
| Handbrake / drift | Space | Face button left |
| Nitrous | Left Shift | Left shoulder |
| Change camera | C | Right shoulder |
| Recover to road | R | Face button top |
| Look back | B | Right stick click |
| Pause (standalone) | P | Start |

Enhanced Input assets are the shipping path; the legacy axis mappings in
`Config/DefaultInput.ini` keep the project drivable before those assets exist.

## Documentation

| Document | Contents |
| --- | --- |
| [Implementation blueprint](Documentation/Architecture/BLUEPRINT.md) | The 15-point technical plan, milestones, infrastructure, risks |
| [Architecture](Documentation/Architecture/ARCHITECTURE.md) | Module/class map, data flow, authority boundaries, conventions |
| [Migration map](Documentation/Migration/MIGRATION_MAP.md) | Full prototype audit and feature-by-feature disposition |
| [Networking](Documentation/Architecture/NETWORKING.md) | Server authority, validation, prediction, backend decision |
| [Performance](Documentation/Architecture/PERFORMANCE.md) | Budgets, scalability profiles, profiling plan |
| [Risks](Documentation/Architecture/RISKS.md) | Known technical risks and unresolved decisions |
| [Asset standards](Documentation/AssetPipeline/ASSET_STANDARDS.md) | Naming, LODs, textures, licensing, temporary-asset policy |
| [Asset manifest](Documentation/AssetPipeline/ASSET_MANIFEST.csv) | Every required asset, source, licence, status |
| [Test plan](Documentation/Testing/TEST_PLAN.md) | Automated/manual matrices, what passes today, what is blocked |
| [Release checklist](Documentation/RELEASE_CHECKLIST.md) | Gate definitions and shipping checklist |
| [Toolchain status](Documentation/Environment/TOOLCHAIN_STATUS.md) | What was actually compiled/executed, what was not |

## What is deliberately not claimed

- No Unreal build has succeeded yet in this environment (no engine available).
- No editor session, Play-In-Editor run, packaged build, or screenshot exists.
- No multiplayer session has been run; the online layer is an explicit, documented boundary.
- All 3D art in the repository is engine-primitive greybox placeholder, clearly labelled as such.
- The migrated vehicle presets are tuning *starting points*, not validated Chaos handling.

## Legacy prototype

The original web prototype lives untouched (apart from the move) in
`LegacyWebPrototype/` and still runs with `npm install && npm run dev`. It is the migration
reference for map geometry, weather profiles, traffic archetypes and feature behaviour.
