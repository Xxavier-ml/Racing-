# Test plan

Two categories matter here: tests that **actually run today**, and tests that are
**specified but blocked** because they need an Unreal build or a running server.

## 1. What runs and passes now (verified in this environment)

| Suite | Command | Result |
| --- | --- | --- |
| Engine-free race rules | `./Tools/SimHarness/run_tests.sh` | **108 checks, 0 failures** |
| Preserved legacy prototype | `cd LegacyWebPrototype && npx tsx --test src/game/nairobiLogic.test.ts` | **15/15 pass** |
| Map-data export determinism | `npx tsx Tools/Migration/export_track_data.ts` + `git diff` | No drift |
| DataTable contract | `node Tools/Migration/validate_exports.mjs` | **42 checks pass** |
| Full local gate | `./Tools/verify_project.sh` | All of the above, in order |

Covered by the core harness: checkpoint ordering, duplicate/skip rejection, out-of-range
rejection, finish-line completion, multi-lap best-lap, lap plausibility, standings ordering,
ghost sanitising/interpolation (including shortest-arc yaw), leaderboard insert/trim/
validation, left-hand lane geometry in Unreal axes, signal phases, the nitrous state machine
(3.5 s / 6 s), and legacy→Unreal coordinate conversion.

## 2. Unreal automation tests (written, never run — no engine here)

`Source/NairobiRacing/Tests/NairobiRaceRulesTests.cpp`:

| Test | What it asserts |
| --- | --- |
| `NairobiRacing.Race.CheckpointOrdering` | Skip/duplicate/range rejection, finish acceptance, one lap recorded |
| `NairobiRacing.Race.Standings` | Finish order, same-lap distance ordering, deterministic last place |
| `NairobiRacing.Security.LapPlausibility` | Impossible/absurd lap rejection |
| `NairobiRacing.Vehicle.NitrousStateMachine` | Ready → Active → Cooldown → Ready |

Run in editor: `Automation RunTests NairobiRacing`, or headless:
`UnrealEditor-Cmd.exe NairobiRacing.uproject -ExecCmds="Automation RunTests NairobiRacing;Quit" -unattended -nullrhi -log`.

CI executes these only on a self-hosted Windows runner with `UE_ROOT` set; otherwise the job
is skipped and reported as skipped, never as passed.

## 3. Gameplay test matrix (manual, Gate 2–4)

| # | Procedure | Pass criteria |
| --- | --- | --- |
| G1 | Full throttle from rest on dry tarmac | Smooth acceleration, no wheelspin teleporting, reaches expected gears |
| G2 | 100→0 braking on dry vs rain | Rain stops noticeably longer (weather profile 0.62 grip / 0.76 brake) |
| G3 | Steady 80 km/h slalom | Steering response linear, no oscillation or snap |
| G4 | Handbrake turn at 60 km/h | Rotates with controllable slide, recovers without spin-out |
| G5 | Nitrous from 60 km/h | 3.5 s surge, then cooldown; HUD matches; cannot re-trigger early |
| G6 | Curb/kerb strike | Suspension absorbs, no launch into orbit |
| G7 | Head-on 60 km/h into a building | Vehicle stops/turns realistically, no tunnelling, camera shake fires |
| G8 | Overturn on a roundabout island | Recovery prompt appears; R returns to nearest racing line facing forward |
| G9 | Checkpoint order | HUD advances 1..6 then finish; skipping shows no progress |
| G10 | 3-lap race | Lap counter, best lap, position updates; results after finish |
| G11 | 4 rivals | They lap the circuit without teleporting; standings reflect real progress |
| G12 | Traffic | Left-hand lanes, signal stops, spacing, no overlapping vehicles |
| G13 | Weather cycle | Fog/sun/rain visuals change; grip changes are perceptible |
| G14 | All five cameras | No clipping through geometry; speed framing works; look-back returns |
| G15 | Keyboard + gamepad | Every action reachable; no stuck inputs on focus loss |

## 4. Persistence tests (Gate 4)

| # | Procedure | Pass criteria |
| --- | --- | --- |
| P1 | Change graphics/audio/control settings, restart | Values persist |
| P2 | Finish a race, restart | Local best lap and results persist |
| P3 | Beat a lap, restart | Ghost replays at the new best time |
| P4 | Corrupt the save file | Game loads defaults, logs a warning, does not crash |
| P5 | Inject an invalid lap record | Rejected by validation (verified in core harness) |
| P6 | Ghost with unsorted/duplicate/NaN samples | Sanitised, replay stable (verified in core harness) |

## 5. Multiplayer tests (Gate 5 — none run yet)

| # | Procedure | Pass criteria |
| --- | --- | --- |
| M1 | Two clients join one dedicated server | Both spawn on distinct grid slots |
| M2 | Countdown synchronisation | Phases match across clients within one replication interval |
| M3 | Checkpoint sync | Server progress matches both clients' HUDs |
| M4 | Finish order | Server results identical on all clients |
| M5 | 150 ms RTT / 5% loss | Race completes; corrections visible but fair |
| M6 | Disconnect mid-race | Racer marked disconnected; others continue |
| M7 | Reconnect | Server progress restored, not client-claimed |
| M8 | Spoofed checkpoint (client sends gate 6 first) | Rejected, audit logged, no progress |
| M9 | Impossible lap claim | Rejected by plausibility |
| M10 | Simultaneous finishes | Deterministic, consistent ordering |
| M11 | Server restart mid-race | Clients return to menu, no partial results accepted |
| M12 | 8-client stress | Server tick stable, bandwidth within budget |

## 6. Release tests (Gate 6)

Clean C++ build from a fresh clone → Development package → Shipping package → test on a
second machine with no dev tools → graphics preset changes → keyboard/gamepad/audio settings
→ alt-tab/focus loss → 2-hour session → crash and recovery → dedicated server 24 h soak →
install/uninstall instructions verified.

## 7. CI

`.github/workflows/ci.yml`:

- **verifiable-checks** (ubuntu-latest): harness, legacy suite, migration determinism,
  data contracts, credential scan.
- **unreal-build** (self-hosted Windows, only when `UE_ROOT` is set): editor compile +
  automation tests.
- **unreal-build-status**: reports the skipped engine job explicitly so a green CI badge is
  never mistaken for a validated Unreal build.

## 8. Honest limitations of current testing

- No Unreal code has been compiled; compile errors are possible and expected in the Chaos
  setup block.
- No editor session, no Play-In-Editor, no packaged build, no screenshots.
- No GPU/performance measurement of any kind.
- No networked session, no latency simulation, no reconnect test.
- Audio, VFX and animation behaviour are unverified (no assets exist yet).
