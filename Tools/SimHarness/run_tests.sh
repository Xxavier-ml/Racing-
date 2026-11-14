#!/usr/bin/env bash
# Compiles and runs the engine-free NairobiRacing::Core rules harness.
# Works on any machine with a C++20 compiler; Unreal Engine is not required.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="${ROOT}/Saved/SimHarness"
mkdir -p "${BUILD_DIR}"

CXX="${CXX:-g++}"
OUT="${BUILD_DIR}/nairobi_core_tests"

echo "==> Compiling NairobiRacing::Core rules with ${CXX}"
"${CXX}" -std=c++20 -O2 -Wall -Wextra -Werror \
	-I "${ROOT}/Source/NairobiRacing" \
	"${ROOT}/Source/NairobiRacing/Core/NairobiTrackRules.cpp" \
	"${ROOT}/Tools/SimHarness/main.cpp" \
	-o "${OUT}"

echo "==> Running harness"
"${OUT}"
