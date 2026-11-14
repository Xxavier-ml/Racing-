#!/usr/bin/env python3
"""
Static structure audit for the Unreal C++ sources.

This is not a compiler. It catches the mistakes that a compiler would catch late and that
are easy to reintroduce by hand: missing GENERATED_BODY, a .generated.h include that is not
last, a .cpp that forgets its own header, unbalanced braces, and Server/Client RPCs without
an _Implementation. It is deliberately conservative and runs in CI alongside the real
engine build job.
"""

import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SOURCE_ROOT = os.path.join(ROOT, "Source", "NairobiRacing")


def cpp_files():
    for dirpath, _, filenames in os.walk(SOURCE_ROOT):
        for name in sorted(filenames):
            if name.endswith((".h", ".cpp")):
                yield os.path.join(dirpath, name)


def strip_literals(text):
    text = re.sub(r"//.*", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    return text


def main():
    issues = []
    files = list(cpp_files())

    if not files:
        print("No C++ sources found under Source/NairobiRacing", file=sys.stderr)
        return 1

    for path in files:
        rel = os.path.relpath(path, ROOT)
        text = open(path, encoding="utf-8").read()
        base = os.path.basename(path)

        if base.endswith(".h"):
            if "UCLASS" in text and "GENERATED_BODY" not in text:
                issues.append(f"{rel}: UCLASS without GENERATED_BODY")
            if re.search(r"\b(UCLASS|USTRUCT|UENUM)\b", text):
                generated = base.replace(".h", ".generated.h")
                if generated not in text:
                    issues.append(f"{rel}: reflected type without {generated}")
                else:
                    includes = re.findall(r'#include "([^"]+)"', text)
                    if includes and includes[-1] != generated:
                        issues.append(f"{rel}: {generated} must be the last include")

        if base.endswith(".cpp"):
            stem = base.replace(".cpp", ".h")
            has_header = os.path.exists(os.path.join(os.path.dirname(path), stem))
            includes = re.findall(r'#include "([^"]+)"', text)
            # Test translation units are standalone and legitimately have no header.
            if has_header and not any(inc.endswith(stem) for inc in includes):
                issues.append(f"{rel}: does not include its own header ({stem})")

        stripped = strip_literals(text)
        if stripped.count("{") != stripped.count("}"):
            issues.append(f"{rel}: brace imbalance")
        if stripped.count("(") != stripped.count(")"):
            issues.append(f"{rel}: parenthesis imbalance")

    # Every Server/Client RPC declared in a header needs an _Implementation in its .cpp.
    for path in files:
        if not path.endswith(".h"):
            continue
        text = open(path, encoding="utf-8").read()
        cpp = path.replace(".h", ".cpp")
        body = open(cpp, encoding="utf-8").read() if os.path.exists(cpp) else ""
        for match in re.finditer(r"UFUNCTION\((Server|Client)[^)]*\)\s*\n\s*void\s+(\w+)\s*\(", text):
            function = match.group(2)
            if f"{function}_Implementation" not in body:
                issues.append(f"{os.path.relpath(path, ROOT)}: RPC {function} lacks _Implementation")

    print(f"Scanned {len(files)} C++ files")
    if issues:
        print(f"STRUCTURAL AUDIT FAILED ({len(issues)} issue(s)):")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    print("STRUCTURAL AUDIT PASSED: reflection macros, generated.h placement, own headers, balance, RPC implementations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
