# Toolchain status and environment verification

Verified on the development container used for this migration. Commands and their real
outputs are reproduced here; nothing in this document is aspirational.

## What this environment has

| Requirement | Status | Evidence |
| --- | --- | --- |
| Unreal Engine 5.8 | **MISSING** | No engine install. `which UnrealEditor UnrealBuildTool` → nothing; no `UE_5*` directory found. |
| .NET / UnrealBuildTool runtime | **MISSING** | `dotnet --version` → `command not found`; `mono` not installed. |
| C++ compiler | Present | `g++ (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0` |
| CMake / Ninja | **MISSING** | `cmake --version`, `ninja --version` → command not found. |
| Git LFS | Present | `/usr/bin/git-lfs` |
| Node.js / npm | Present | `node`, `npm` on PATH (used for the migration and legacy suite) |
| Python 3 | Present | `python3` on PATH |
| Disk | **INSUFFICIENT for UE** | `df -h /workspace` → 16 G total, 9.7 G available |
| Display / GPU | **NONE** | Headless container; no editor, no Play-In-Editor, no rendering |
| Asset tools (Blender/Maya/Substance) | **MISSING** | Not installed and not requestable here |

Unreal Engine 5.8 plus a Windows toolchain (Visual Studio 2022 with the C++ game
development workload, Windows 10/11 SDK) needs roughly 100–150 GB of disk for the engine,
derived data cache and cooked builds. This container cannot host it, so **no Unreal
compilation was performed**.

## What was therefore actually executed

These are real runs, not intentions:

```text
$ ./Tools/SimHarness/run_tests.sh
==> Compiling NairobiRacing::Core rules with g++
==> Running harness
[ RUN  ] BasicMath ... [ RUN  ] LegacyCoordinateConversion
NairobiRacing::Core harness
checks: 108, failures: 0
RESULT: PASS

$ npx tsx --test LegacyWebPrototype/src/game/nairobiLogic.test.ts
tests 15 / pass 15 / fail 0

$ npx tsx Tools/Migration/export_track_data.ts
wrote DT_Checkpoints.csv (7 rows)
wrote DT_RacingLine.csv (23 rows)
wrote DT_Streets.csv (8 rows)
wrote DT_Landmarks.csv (10 rows)
wrote DT_Roundabouts.csv (5 rows)
wrote DT_CityBlocks.csv (20 rows)
wrote DT_VehicleConfigs.csv (3 rows)
circuit length: 1326.3 m
spawn (Unreal cm): X=5050 Y=-16800 yaw=1.5708
MIGRATION OK: all conversion invariants satisfied.

$ node Tools/Migration/validate_exports.mjs
Data validation PASSED: 42 checks across 7 tables.
```

## Status vocabulary used in this repository

| Term | Meaning |
| --- | --- |
| **Implemented** | Source exists and is wired into the architecture. |
| **Compiled** | Built by a compiler in this environment (only the engine-free core). |
| **Executed** | Tests ran and passed here (core harness, legacy suite, data validation). |
| **Editor-verified** | Seen working inside Unreal Editor. **Nothing is in this category.** |
| **Unverified** | Written but never compiled or run: every Unreal-facing `.cpp`. |

## Exact steps to close the gap on a Windows developer machine

1. Install Unreal Engine 5.8 through the Epic Games Launcher (or build from source).
   A 5.4–5.7 install can be used by editing `EngineAssociation` in
   `NairobiRacing.uproject`; the APIs used here are stable across those versions except
   where noted in `Documentation/Architecture/RISKS.md`.
2. Install Visual Studio 2022 with **Game development with C++** (MSVC v143, Windows SDK).
3. Install Git LFS (`git lfs install`) and clone. Run `git lfs pull`.
4. Right-click `NairobiRacing.uproject` → **Generate Visual Studio project files**.
5. Build the `NairobiRacingEditor` target in `Development | Win64`.
   Expect first-compile errors only in the Chaos setup block
   (`NairobiVehicleSetupLibrary.cpp`) if the engine version renamed a field — see RISKS.
6. In the editor: **Window → Output Log → Python** and run
   `py "<ProjectDir>/Tools/Unreal/create_startup_map.py"` (creates the binary `.umap`,
   which cannot be produced outside the editor).
7. Create `Content/Data/Track/DA_NairobiCircuit` (a `UNairobiRaceTrackData` asset) and
   import the CSVs from `Content/Data/Track` into DataTables, then populate the asset's
   `Checkpoints`, `RacingLineCm`, `Streets`, `Landmarks`, `CityBlocks` arrays.
   The property names and headers already match (`FNairobi*Row`).
8. Assign that asset to `ANairobiRaceGameMode::TrackData` in
   `Config/DefaultGame.ini` (`[/Script/NairobiRacing.NairobiRaceGameMode]` section) or in
   a Blueprint subclass of the game mode.
9. Press Play. The greybox circuit, gates and traffic appear procedurally.

Steps 6–8 are the honest "Gate 1 completion" actions that require a human at an Unreal
Editor; they are scripted/automated wherever the editor API allows.
