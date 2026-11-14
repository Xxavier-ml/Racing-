# Risk register

| # | Risk | Impact | Likelihood | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | **No Unreal build has been performed** — the environment has no engine, MSVC, .NET or disk | High: source may contain compile errors | Certain (until a UE machine runs it) | All Chaos API usage isolated in `NairobiVehicleSetupLibrary.cpp`; engine-free core compiled+tested here; step-by-step build guide in TOOLCHAIN_STATUS | **Open — blocking** |
| 2 | **Chaos API field drift** between 5.x versions (engine/transmission setup, wheel arrays) | Medium: build breaks | Medium | Single bridge file; keep names aligned with 5.4+; document exact fix location | Open |
| 3 | **Vehicle netcode** is not competitive-grade; Chaos is not predicted out of the box | High: multiplayer quality | High | Gate 5 spike: custom reconciliation vs NetworkPrediction; fixed substeps already set; benchmark under 150 ms RTT before promising ranked play | Open (Gate 5) |
| 4 | **Vehicle handling unvalidated** — no one has driven the car | High: game feel | Certain | Tune on a UE machine; presets marked `NeedsEditorTuning`; keep tuning data-driven | Open (Gate 2) |
| 5 | **Art is placeholder** (engine cubes) | High: visual quality | Certain | Asset manifest + production spec; greybox explicitly labelled; Gate 3 requires artist/DCC work | Open — art-blocked |
| 6 | **No LICENSE file** in the repository | High: redistribution undefined | Certain | Add a licence before any public release; recorded in release checklist | Open |
| 7 | **Trademark exposure** in legacy rival names ("Supra", "Evo", "WRX") | Medium: legal/release blocker | Certain if copied | Do not migrate those names; use original roster names; review all vehicle names before shipping | Mitigated in design, legacy text still exists in the prototype |
| 8 | **Map fidelity** is the prototype's approximation, not survey/OSM data | Medium: "Nairobi" authenticity | Medium | Relative layout, landmarks and circuit preserved; licensed/OSM data is an explicit open decision | Open |
| 9 | **Traffic physics vs. frame budget** — kinematic traffic can feel rigid on contact | Medium: feel | Medium | Distance-based activation already; hybrid dynamic traffic near player is a Gate 4 task | Open |
| 10 | **Single module compile times** will grow | Low/medium: iteration speed | Medium | Extract `NairobiRacingCore` module when incremental builds exceed ~90 s | Monitored |
| 11 | **No map asset committed** — `.umap` is binary and cannot be authored here | Medium: first-run friction | Certain | `Tools/Unreal/create_startup_map.py` + documented 3-step editor setup; game mode builds the circuit procedurally | Mitigated by automation, still manual |
| 12 | **Save data corruption / ghost abuse** | Low/medium | Low | Ghost sanitisation, record validation and leaderboard trim run through verified core | Mitigated |
| 13 | **Weather replication divergence** | Medium: unfair races | Medium | Weather is server-authoritative; client changes ignored and logged; state replicated in game state | Implemented, untested online |
| 14 | **Enhanced Input assets absent** | Low: input remapping | Certain | Legacy mappings keep the game drivable; Enhanced Input is the shipping path | Mitigated |
| 15 | **Backend provider / cost unknown** | Medium: Gate 5 scope | High | Interface-only boundary; decision criteria documented; no vendor lock-in | Open |
| 16 | **Legal review of the Gemini city-guide feature** (legacy) | Low: feature dropped | — | Feature intentionally not migrated; no API key in client | Closed by dropping |
| 17 | **Determinism mismatch** between client prediction and server sim | High if unresolved | Medium | Fixed substeps, server-authoritative verdicts, replay-based reconciliation plan | Open (Gate 5) |
| 18 | **Scope**: vehicles + city art + multiplayer is multi-month work | High | High | Gate discipline; this repo delivers foundation + verified rules first, no false completion claims | Managed |

## Unresolved decisions

1. Engine version baseline: target 5.8 as requested; verify field names on the installed
   engine and record the exact version used in the build notes.
2. Player limit per race (8 vs 12) and whether traffic runs in ranked sessions.
3. Online provider, hosting model and cost ceiling.
4. Whether to replace the derived map with licensed/OSM survey data.
5. Repository licence and the final vehicle/brand naming set.
6. Whether rivals use rubber-banding at all (prefer honest pace differences).
