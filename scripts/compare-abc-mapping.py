#!/usr/bin/env python3
"""Compare a mapping JSON result against fixtures/abc-expected.json.

Usage:
  python3 scripts/compare-abc-mapping.py path/to/mapping-result.json
"""
import json
import sys
from pathlib import Path

TOLERANCE = 1.0  # Rs rounding


def flatten(obj, prefix=""):
    out = {}
    if isinstance(obj, dict):
        if "current" in obj and len(obj) <= 2:
            out[prefix] = obj.get("current", 0)
        else:
            for k, v in obj.items():
                if k == "meta":
                    continue
                p = f"{prefix}.{k}" if prefix else k
                out.update(flatten(v, p))
    return out


def main():
    if len(sys.argv) < 2:
        print("Usage: compare-abc-mapping.py <mapping-result.json>", file=sys.stderr)
        sys.exit(1)

    expected_path = Path(__file__).resolve().parent.parent / "fixtures" / "abc-expected.json"
    expected = flatten(json.loads(expected_path.read_text()))
    actual = flatten(json.loads(Path(sys.argv[1]).read_text()))

    ok = 0
    fail = 0
    for key, exp in sorted(expected.items()):
        act = actual.get(key)
        if act is None:
            print(f"MISSING  {key}: expected {exp}")
            fail += 1
            continue
        if abs(float(act) - float(exp)) <= TOLERANCE:
            ok += 1
        else:
            print(f"MISMATCH {key}: expected {exp}, got {act}")
            fail += 1

    print(f"\n{ok} matched, {fail} mismatched/missing (tolerance Rs {TOLERANCE})")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
