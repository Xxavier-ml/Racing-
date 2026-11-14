# Release checklist

A gate is only "passed" when every item is evidence-backed. Checked means **verified**, not
"should work".

## Gate 1 — Native project foundation

- [x] Valid `NairobiRacing.uproject` (JSON parsed in CI) with Chaos Vehicles, Enhanced Input,
      Niagara, MetaSounds enabled
- [x] Game + editor targets and module build rules
- [x] Class scaffolding for every architectural role (game modes, vehicle, race, AI, traffic,
      weather, camera, audio, UI, online, progression, save)
- [x] Engine-free competitive rules compiled and tested (108 checks)
- [x] Nairobi map data migrated with validated coordinate conversion (7 tables, 42 checks)
- [x] Architecture documentation (`ARCHITECTURE.md`, `BLUEPRINT.md`, `NETWORKING.md`,
      `PERFORMANCE.md`, `MIGRATION_MAP.md`, `RISKS.md`)
- [x] CI for everything that does not need an engine
- [ ] **Successful C++ development build on a UE 5.8 machine** — blocked: no engine here
- [ ] **Startup map created and opened** — blocked: `.umap` needs the editor (script ready)
- [ ] Track data asset (`DA_NairobiCircuit`) authored and assigned — requires editor

Gate 1 is therefore **not passed**. Foundation source is complete; engine validation is not.

## Gate 2 — Playable vertical slice

- [ ] One Chaos vehicle drives with keyboard and gamepad
- [ ] Steering, wheel animation, camera modes work in PIE
- [ ] Collisions with roads/buildings behave
- [ ] Nairobi test route drivable start → checkpoints → finish
- [ ] HUD + pause/resume functional
- [ ] No crash during a 10-minute session
- [ ] Handling reviewed by a human and tuned

## Gate 3 — Visual quality

- [ ] Production vehicle asset imported (not placeholder), LODs + physics asset correct
- [ ] Environment section replaced with modular Nairobi art
- [ ] Materials/lighting reviewed at Low and Ultra
- [ ] Tyre/exhaust/collision Niagara in place within particle budget
- [ ] Layered engine/traffic/ambience audio implemented and mixed
- [ ] **Scene visually reviewed in Unreal Editor** (not just compiled)

## Gate 4 — Racing gameplay

- [ ] Circuit + free-drive modes complete
- [ ] AI rivals race without teleporting; results honest
- [ ] Traffic: left-hand lanes, signals, spacing, no overlap
- [ ] Checkpoints/lap timing/standings/results verified in PIE
- [ ] Weather changes handling and visuals
- [ ] UMG menus, HUD, results, settings
- [ ] Local saves (settings, best laps, ghost) survive restart
- [ ] Keyboard/mouse/gamepad settings persisted

## Gate 5 — Multiplayer

- [ ] Dedicated server build runs headless
- [ ] 2+ real clients complete one race
- [ ] Server-authoritative checkpoints/results verified
- [ ] 150 ms RTT + 5% loss session completes fairly
- [ ] Disconnect/reconnect policy verified
- [ ] Malicious checkpoint/lap submissions rejected and logged
- [ ] Persistent online results stored server-side only
- [ ] Bandwidth measured within budget

## Gate 6 — Production readiness

- [ ] Performance measured on named hardware in 4 weather scenes (numbers in repo)
- [ ] Security review of RPCs, secrets and admin paths
- [ ] Long-session and server-soak stability
- [ ] Development + Shipping packages built
- [ ] Clean-machine install/start verified
- [ ] Known-issues report written
- [ ] **Licence file present** and third-party licences listed
- [ ] **Trademark review passed** (no real manufacturer names/logos)
- [ ] No credentials in the packaged build or repository

## Cross-cutting blockers to resolve before any public release

1. Add a `LICENSE` for the repository (currently undefined).
2. Remove/replace legacy rival names referencing real vehicle models.
3. Record licence provenance for every audio asset and font.
4. Confirm the engine version actually used for the shipping build (5.8 target).
5. Decide map data source (derived layout vs. licensed/OSM survey).
6. Choose and cost the online provider before promising online play.
