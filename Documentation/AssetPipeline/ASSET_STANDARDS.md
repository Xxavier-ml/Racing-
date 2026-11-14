# Asset standards

Everything in `Content/` must follow these rules. A missing manifest row means the asset does
not ship.

## 1. Units, scale and axes

- Unreal units: **centimetres**. 1 m = 100 uu. Vehicles are authored at real-world scale.
- Axes: +X forward/north, +Y right/east, +Z up. Vehicle forward is +X, right is +Y.
- Pivots: vehicles at the centre of the wheelbase, ground level. Props at their base centre.
  Buildings at the centre of their footprint, ground level.
- Modular grid: environment pieces snap to **25 cm**; road tiles to 100 cm.
- Vehicle reference dimensions (L × W × H, m): Rally GT 4.4 × 1.85 × 1.28;
  Nganya 5.2 × 2.05 × 2.15; Savannah V8 4.9 × 1.95 × 1.45; City Hoppa bus 8.4 × 2.5 × 3.1;
  boda boda 2.1 × 0.8 × 1.1.

## 2. Naming

| Type | Prefix | Example |
| --- | --- | --- |
| Static mesh | `SM_` | `SM_KICC_Tower_01` |
| Skeletal mesh | `SK_` | `SK_Vehicle_RallyGT` |
| Physics asset | `PHYS_` | `PHYS_Vehicle_RallyGT` |
| Material | `M_` | `M_Road_Tarmac` |
| Material instance | `MI_` | `MI_Road_Tarmac_Wet` |
| Texture | `T_` + usage | `T_Road_Tarmac_BC`, `_N`, `_ORM`, `_R` |
| Blueprint | `BP_` | `BP_NairobiRaceGameMode` |
| Widget blueprint | `WBP_` | `WBP_RaceHud` |
| Niagara system | `NS_` | `NS_TyreSmoke` |
| Sound cue / MetaSound | `SC_` / `MS_` | `MS_Engine_RallyGT` |
| Sound wave | `S_` | `S_TyreSqueal_Loop_01` |
| Data table | `DT_` | `DT_Checkpoints` |
| Data asset | `DA_` | `DA_NairobiCircuit`, `DA_Vehicle_RallyGT` |
| Curve | `C_` | `C_Torque_RallyGT` |
| Animation | `A_` / `AM_` | `A_Vehicle_Steer`, `AM_WheelSpin` |

Suffixes `_01.._NN` for variants, `_LOD0.._LOD3` never appear in asset names (LODs live
inside the mesh).

## 3. Meshes and LODs

| Asset class | LODs | Collision | Nanite |
| --- | --- | --- | --- |
| Hero player vehicles | LOD0–LOD3 (100/60/30/10%) | Custom simple (UCX_) + complex-as-simple off | No (skeletal) |
| Traffic vehicles | LOD0–LOD2 | Simple box per body | No |
| Buildings / landmarks | LOD0–LOD2 | UCX simple per volume | Yes (architecture) |
| Road / kerb / sidewalk | LOD0–LOD1 | Simple box strips | Yes where static |
| Street furniture, trees | LOD0–LOD2 + impostor | UCX for large props; none for small | No |
| Foliage cards | 1–2 + billboard | None | No |

- Triangle targets: player vehicle LOD0 ≤ 120k; traffic LOD0 ≤ 40k; modular building tile
  ≤ 15k; street lamp ≤ 2k.
- Skeletal vehicles need: wheel bones (`Wheel_FL/FR/RL/RR`), suspension bones or sockets
  (`Susp_FL...`), chassis bone, and brake/reverse/head light material parameters.
- All meshes must have correct lightmap/UV sets where static lighting or AO baking is used.

## 4. Materials and textures

- PBR metallic/roughness workflow, `ORM` packed (AO/Roughness/Metallic) where applicable.
- Vehicle paint: base colour + metallic + clearcoat; no baked lighting in base colour.
- Glass: separate material with refraction off (performance), opacity mask where needed.
- Textures: 4096 for hero vehicle body, 2048 for traffic, 2048 for building facades,
  1024 for props, 512 for small decals. Power-of-two only; sRGB off for N/ORM.
- Every material must expose documented parameter names used by gameplay/VFX
  (e.g. `BaseColor`, `Wetness`, `BrakeLight`, `ReverseLight`, `Headlight`).
- Material instances for weather variants rather than duplicating graphs.

## 5. Audio

- 48 kHz, 16-bit minimum; engine loops seamless, no leading silence.
- Layered vehicle sources: idle body, load harmonic, turbo/whine, tyre roll, tyre squeal,
  wind, transmission whine; driven by MetaSound parameters `RPM`, `Load`, `Speed`,
  `TyreSlip`.
- Loudness: dialogue/menu −16 LUFS integrated; engine mix peaks ≤ −6 dBFS; no source clips.
- Spatialisation for world sounds; UI sounds 2D. Provide mono sources for attenuation.

## 6. VFX

- Niagara only. Each system needs fixed bounds, cull distance, and a documented budget
  (spawn rate × lifetime). No unbounded loops; no per-frame material parameter allocation.
- Required systems: rain, tyre spray, tyre smoke, dust, exhaust flame, collision sparks,
  road debris. GPU sim only where the effect justifies it.

## 7. Source control

- Binary assets via **Git LFS** (see `.gitattributes`). `git lfs install` once per clone.
- Never commit `Saved/`, `Intermediate/`, `DerivedDataCache/`, `Binaries/` or cooked builds.
- `.umap`/`.uasset` files are LFS-tracked; CSVs and configs are plain text.

## 8. Licensing and provenance

- Every asset needs: source, licence, author and proof of rights in `ASSET_MANIFEST.csv`.
- No manufacturer logos, badges, or unlicensed real vehicle models. Vehicle names are
  original (Safari Rally GT, Nganya 111 Turbo, Savannah V8 Cruiser).
- Legacy rival labels referencing real model names ("Supra", "Evo", "WRX") must not appear
  in shipped content.
- No paid marketplace asset may enter the project without a recorded licence that permits
  redistribution inside a game build.
- Audio: licensed library or original recordings, with the licence type recorded (e.g.
  "CC0", "paid royalty-free, redistribution permitted in games").
- Fonts: redistribution rights required; prefer engine fonts until licensed.

## 9. Temporary assets

The current repository contains **only engine-primitive greybox** (cubes for roads,
buildings, gates and traffic). Rules:

1. Every placeholder is labelled `Placeholder` in the manifest and in code comments.
2. Placeholders must never be described as finished art in commits or documentation.
3. A placeholder is replaced, not "upgraded in place", when production art arrives.
4. Gate 3 cannot pass while any hero asset is a placeholder.

## 10. Import and validation

- Import paths mirror `Content/`: `Vehicles/<Name>/`, `Environment/<District>/`,
  `Materials/`, `Textures/`, `Audio/`, `UI/`, `VFX/`.
- Before committing an asset: correct scale (measure against a 1.8 m reference), pivots,
  collision, LODs, compression settings, and a manifest row.
- Add a redirect-free naming pass before packaging; no `_New`, `_Copy`, `_Final2` assets.
