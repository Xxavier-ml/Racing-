#!/usr/bin/env bash
# Full local verification for the parts of the project that do not require Unreal Engine.
# CI runs the same steps (.github/workflows/ci.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

fail() { echo "FAIL: $*" >&2; exit 1; }
section() { echo; echo "=============================================================="; echo "$*"; echo "=============================================================="; }

section "1/6 Project structure"
for path in \
  "NairobiRacing.uproject" \
  "Source/NairobiRacing.Target.cs" \
  "Source/NairobiRacingEditor.Target.cs" \
  "Source/NairobiRacing/NairobiRacing.Build.cs" \
  "Source/NairobiRacing/Core/NairobiTrackRules.h" \
  "Source/NairobiRacing/GameModes/NairobiRaceGameMode.h" \
  "Config/DefaultEngine.ini" \
  "Config/DefaultInput.ini" \
  "Content/Data/Track/DT_Checkpoints.csv" \
  "LegacyWebPrototype/src/game/nairobiMap.ts"; do
  [[ -f "${path}" ]] || fail "missing required file: ${path}"
  echo "  ok ${path}"
done

python3 - <<'PY'
import json, sys
with open("NairobiRacing.uproject", encoding="utf-8") as handle:
    project = json.load(handle)
assert project["Modules"][0]["Name"] == "NairobiRacing", "module name mismatch"
enabled = {p["Name"] for p in project["Plugins"] if p.get("Enabled")}
for required in ("ChaosVehiclesPlugin", "EnhancedInput", "Niagara", "MetasoundEngine"):
    assert required in enabled, f"required plugin not enabled: {required}"
print("  ok NairobiRacing.uproject is valid JSON with the required plugins")
PY

section "2/6 Structural audit of Unreal C++"
./Tools/check_cpp_structure.py

section "3/6 Engine-free race rules (compiled + executed)"
./Tools/SimHarness/run_tests.sh

section "4/6 Legacy prototype suite (preserved migration reference)"
(
  cd LegacyWebPrototype
  npx -y tsx --test src/game/nairobiLogic.test.ts
)

section "5/6 Map-data regeneration is deterministic"
npx -y tsx Tools/Migration/export_track_data.ts >/dev/null
if ! git diff --quiet -- Content/Data Documentation/Migration/TRACK_DATA_MANIFEST.json; then
  git --no-pager diff --stat -- Content/Data Documentation/Migration/TRACK_DATA_MANIFEST.json
  fail "generated track data is out of date; commit the regenerated tables"
fi
echo "  ok generated CSV/JSON match the committed files"

section "6/6 Data-table contract validation"
node Tools/Migration/validate_exports.mjs

echo
echo "ALL VERIFIABLE CHECKS PASSED."
echo "Unreal compilation, editor play-in-editor and packaged builds are NOT covered here"
echo "(no engine in this environment). See Documentation/Environment/TOOLCHAIN_STATUS.md."
