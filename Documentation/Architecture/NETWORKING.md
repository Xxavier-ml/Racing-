# Networking design

Goal: competitive races between real players, **server-authoritative**, with a configurable
player limit. Nothing here has been run: no client has ever connected. This document
separates the model that is implemented in code from what still has to be built and
measured (Gate 5).

## 1. Authority model

| State | Owner | Replicated via | Client may modify? |
| --- | --- | --- | --- |
| Race phase, countdown, official clock | GameMode (server) | `ANairobiRaceGameState` | No |
| Checkpoint index, lap, best lap, finish time, position | RaceManager → PlayerState | `ANairobiRacePlayerState` | No |
| Classified results | RaceManager → GameState | `ANairobiRaceGameState::Results` | No |
| Weather condition and grip | WeatherSubsystem → GameState | `FNairobiWeatherState` | No (client requests ignored + logged) |
| Vehicle transform | Chaos on server; client predicts | `bReplicateMovement` | Prediction only; server corrects |
| Vehicle input | Owning client | `Server_SetDriverInput` (unreliable, ~30 Hz) | Yes (intent) |
| Camera, audio, HUD | Local client | — | Yes (presentation only) |
| Traffic | Host | Not replicated | Not competitive |

`ANairobiRaceManager` refuses to operate without authority and logs an error if one ever
spawns on a client. Competitive truth is never derived from a client message.

## 2. Checkpoint validation

The client's only competitive message is "my vehicle overlapped gate N". The server:

1. checks the race is running and the sender owns the claimed pawn;
2. reads **its own** copy of that pawn's location;
3. asks `NairobiRacing::Core::SubmitCheckpoint` (strict order + gate radius + finish rules);
4. rejects duplicates, skips, out-of-range claims and everything after the flag;
5. writes the new progress to the player state and emits structured audit logs.

Because gate order is strict and the finish gate is last, a client cannot skip a section of
the circuit, nor complete a lap without clearing every gate. Duplicate overlap events are
harmless (rejected as wrong order) rather than double-counted.

## 3. Lap timing and results

- Official time = server clock at acceptance. Client timestamps are never used.
- Lap plausibility: `IsPlausibleLapTime(lap, trackLength, maxSpeed)` rejects laps faster
  than `trackLength / (maxSpeed * 1.5)` and anything over 30 minutes; flags add a 5 s
  penalty and an audit entry.
- Results are produced only by `BuildResults()` from validated progress, sorted by
  `ComputeRacePositions` (finished → progress → distance to next gate → deterministic id).
- A racer who disconnects is unregistered from the manager, cannot block completion, and is
  marked `bDisconnected` in results (explicit policy, not silent removal).

## 4. Vehicle prediction and reconciliation (incomplete — the main Gate 5 risk)

Current implementation: the owning client feeds Chaos locally and streams inputs to the
server at 30 Hz; the server simulates Chaos and replicates the pawn transform. This gives
responsive local control but standard actor correction, which can feel jittery under
latency and is **not yet a competitive-grade vehicle netcode**.

Planned Gate 5 work, in order of preference:

1. **Custom reconciliation**: ring-buffer of local states + inputs; on server correction,
   replay unacknowledged inputs from the authoritative state. Requires deterministic Chaos
   stepping (fixed substeps are already configured: 0.008333 s, 6 max substeps).
2. **`NetworkPrediction` framework** for the vehicle if its Chaos support proves adequate on
   5.8; evaluate before committing.
3. **Interpolation tuning** for remote vehicles: 100 ms buffer, position/rotation smoothing,
   extrapolation cap of 150 ms, teleport detection to snap instead of smear.

Non-negotiable: the server's validated state wins. Visual smoothing may hide corrections;
it may not change outcomes.

## 5. Bandwidth plan

Per client targets (to be measured, not assumed): ≤ 32 KB/s up, ≤ 8 KB/s down for 8 racers.

- Inputs: 5 bytes (steer, throttle, brake, flags) × 30 Hz ≈ 150 B/s.
- Pawn movement replicates through the standard net driver with a 100–150 KB/s cap
  configured in `DefaultEngine.ini`.
- Checkpoints/finish: reliable RPCs, one per gate (≤ 7 per lap per racer).
- No per-frame replication of HUD values: the HUD derives them locally from replicated
  state and local physics.
- Traffic and ambient AI are host-only and never replicated as actors.
- Ghost samples are uploaded once at lap end, sanitised and capped (≤ 6000 samples).

Instrument with `stat net`, the network profiler and per-actor replication stats once a
server exists. Any actor exceeding a 2 KB/s budget must be justified or demoted to local.

## 6. Latency, loss and failure handling

| Condition | Expected behaviour |
| --- | --- |
| 100–150 ms RTT | Inputs feel local; remote cars interpolate; corrections subtle |
| 2–5% packet loss | Unreliable inputs skip frames without stalling; reliable checkpoint messages retry |
| 300 ms RTT | Playable but visibly corrected; matchmaking should prefer regional servers |
| Temporary disconnect | Reconnect allowed during the race; progress is restored from the server's record |
| Permanent disconnect | Unregistered, marked disconnected, remaining racers continue |
| Server restart mid-race | Session ends; clients return to menu with a clear message (no partial results accepted) |
| Simultaneous finishes | Ordered by validated finish time, then deterministic id tie-break |

Reconnection explicitly restores **server-held** progress, never client-claimed progress.

## 7. Backend interface

`UNairobiOnlineSubsystem` is the only client entry point. Intended providers:

| Capability | Contract |
| --- | --- |
| Authentication | Short-lived token, refreshed; never stored in logs or assets |
| Player profile | Display name, level, owned vehicles/skins (server-owned inventory) |
| Matchmaking | Region + skill bucket, player limit from config (2..12) |
| Session | Dedicated server address + join token |
| Race results | Submitted **by the dedicated server**, signed/authenticated |
| Leaderboards | Server-validated entries only; queryable, paginated |
| Progression | XP/unlocks applied server-side from validated results |

Implementation rule: gameplay code depends on these interfaces, never on a vendor SDK
directly. Swapping providers must not touch race or UI code.

**Provider decision is open.** Criteria: dedicated-server support, regional latency,
per-CCU cost at the target player count, leaderboard/auth quality, portability, data
residency. No provider has been selected or paid for, and no keys exist in the repository.

## 8. Dedicated server deployment (planned)

- Build target: `NairobiRacingServer` (`TargetType.Server`) on Windows (Linux once verified).
- Server runs `ANairobiRaceGameMode` headless; `-nullrhi`, no audio, no HUD.
- Configuration via server-only ini/command line; secrets come from the host environment,
  never from the client package or repository.
- Required ports documented per host; logs structured (`AUDIT` lines) and shipped off-box.
- Admin operations (kick, reset race, force weather) exist only server-side with permission
  checks; no admin RPC is exposed to clients.

## 9. Anti-cheat matrix

| Attack | Current mitigation | Gate 5 addition |
| --- | --- | --- |
| Fake checkpoint / skip section | Strict server-side order + radius + server position | Rate limiting per racer |
| Fake lap time | Server clock only; plausibility envelope | Statistical outlier detection |
| Teleport / speed hack | Server position authoritative for gates | Input delta sanity, max speed/accel checks per tick |
| Replay of old messages | Server state machine rejects wrong-order gates | Nonce/sequence per submission |
| Result tampering | Results built server-side only | Signed server→backend submission |
| Leaderboard injection | No client submission path exists | Backend auth + schema validation |
| Session hijack | — (no sessions yet) | Token binding to account + server instance |
| Client memory editing | Not defended (by design, not obscurity) | Server authority is the defence |

## 10. Open decisions

1. Vehicle netcode model (§4) — decide after measuring Chaos determinism under latency.
2. Player limit per race (default 8 vs 12) vs bandwidth and CPU budgets.
3. Backend provider and hosting cost ceiling.
4. Ranked vs casual split, and whether traffic exists in ranked sessions.
5. Reconnect window length and penalty policy for disconnects.
