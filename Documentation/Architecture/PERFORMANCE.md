# Performance and graphics scalability

**Current measurement status: none.** This environment has no GPU, no display and no
Unreal install, so every number below is a *budget to validate*, not a result. Nothing in
this document may be quoted as measured performance.

## 1. Budgets (1080p, High preset, 60 FPS)

| Metric | Budget | Notes |
| --- | --- | --- |
| Frame time | 16.6 ms | 99th percentile ≤ 20 ms (frame pacing matters more than average) |
| Game thread | ≤ 8.0 ms | Includes 5 Chaos vehicles + AI + 24 active traffic |
| Render thread | ≤ 10.0 ms | |
| GPU | ≤ 14.0 ms | Worst case: rain at night in the CBD |
| Draw calls | ≤ 3,000 | HISM for street furniture and trees |
| Visible primitives | ≤ 2.5 M | Nanite where it pays |
| Texture pool | ≤ 2.5 GB (High) | Streaming budget enforced |
| Active traffic actors | ≤ 24 within 120 m | Pooled, 20 Hz, distance-culled |
| Particles | Bounded emitters, ≤ 2,000 live | Niagara cull distance + fixed bounds |
| Network (Gate 5) | ≤ 32 KB/s up per client | See NETWORKING.md |

## 2. Measurement plan (on a UE machine)

1. Capture a repeatable benchmark route: CBD start → Kenyatta Ave → Moi Ave → Uhuru Hwy,
   with traffic enabled and 4 AI rivals.
2. Scenes: clear day, rain day, night, fog, plus a "worst case" (rain night + full grid).
3. Tools: `stat unit`, `stat gpu`, `stat scenerendering`, `stat rhi`, `stat game`,
   `stat physics`, Unreal Insights (CPU/GPU/bookmarks), Niagara debugger, `memreport -full`,
   and the network profiler once multiplayer exists.
4. Record: average, 99th percentile frame time, GPU/CPU breakdown, peak memory, actor and
   draw-call counts, shader compilation hitches.
5. Store results in `Documentation/Performance/BASELINES.md` (to be created with real data).

## 3. Simulation scalability

- **Vehicles:** 5 Chaos vehicles (player + 4 rivals). Physics substepping is enabled
  (0.008333 s, 6 substeps) for stability; measure the cost before raising it.
- **Traffic:** kinematic and pooled. Only agents within 12,000 cm of a player are simulated;
  the rest are suspended and hidden. Update rate 20 Hz.
- **AI:** 4 rival controllers at frame rate, each a cheap pure-pursuit + curvature lookup;
  no behaviour trees, no perception queries per tick.
- **Ghost replay:** one interpolated ghost, ≤ 6000 samples, binary search per frame.
- **HUD:** Canvas draw of text/rects; no per-frame string churn beyond a handful of formats.

## 4. Rendering scalability

| Feature | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Global illumination | Off | Lumen (software) | Lumen | Lumen + HW RT optional |
| Reflections | SSR | SSR + Lumen | Lumen | Lumen high quality |
| Shadows | Medium, 1 cascade | High | Virtual shadow maps | Virtual, higher resolution |
| Anti-aliasing | FXAA/TAA | TAA | TSR | TSR |
| Nanite | Off | On (limited) | On | On |
| Foliage density | 40% | 70% | 100% | 120% |
| Effects quality | Low | Medium | High | Epic |
| Resolution scale | 70% | 85% | 100% | 100–120% |
| Rain particles | 25% | 50% | 100% | 130% |

`FNairobiGraphicsSettings` already carries preset, Lumen/Nanite/RT toggles, shadow/effects
quality, resolution scale and frame-rate limit. **Applying these at runtime is not yet
implemented** (needs a settings applier that maps to scalability cvars and Lumen/Nanite
project settings). Until then the ini defaults apply.

Default preset policy: detect GPU tier and default to Medium on mainstream hardware, High on
upper-midrange; never default to Ultra. Lower presets must remain visually coherent, not
"broken but fast".

## 5. Known cost drivers and mitigations

| Driver | Risk | Mitigation |
| --- | --- | --- |
| Lumen at night with wet roads | Highest GPU cost scene | Quality-scaled Lumen, wet roughness tuned, no full-screen rain refraction |
| Virtual shadow maps + moving vehicles | Shadow invalidation spikes | Cache static city shadows, limit dynamic shadow casters |
| Traffic draw calls | Many small actors | Merged meshes per archetype, HISM for parked vehicles, cull distance |
| Niagara rain + tyre spray | Overdraw | Fixed bounds, GPU sim where available, cull distance, particle budget |
| Nanite on foliage cards | Poor fit | Standard LODs for foliage; Nanite for architecture only |
| Texture streaming hitches | Traversal stutter | Prestream around the circuit, pool sized per preset, virtual textures for city facades |
| Shader compilation | First-encounter stutters | Precompile PSOs for vehicles/materials in the packaged build |

## 6. World streaming (city scale)

The CBD circuit fits in a single level today (roughly 500 × 500 m of playable area). For a
larger Nairobi (free-roam to Westlands/JKIA), adopt World Partition with a 128 m cell size,
data layers for traffic/effects, and level streaming around the circuit. That is a Gate 4+
decision; the current builder is a single-level greybox.

## 7. Definition of "performance done" for a gate

A gate only passes performance review with recorded numbers on named hardware, in the four
weather scenes, with traffic on. "It ran on my machine" is not a result; neither is a
compiled build.
