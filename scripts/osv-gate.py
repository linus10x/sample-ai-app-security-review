#!/usr/bin/env python3
"""Fail if osv-scanner's JSON report holds a vulnerability with CVSS 7.0 or higher (High and Critical)."""
import json
import sys

report = json.load(open(sys.argv[1]))
worst = 0.0
found = []
for result in report.get("results", []):
    for pkg in result.get("packages", []):
        for group in pkg.get("groups", []):
            try:
                score = float(group.get("max_severity") or 0)
            except ValueError:
                score = 0.0
            worst = max(worst, score)
            if score >= 7.0:
                found.append(f'{pkg["package"]["name"]}@{pkg["package"]["version"]} {group.get("ids")} cvss={score}')
print(f"osv-gate: {len(found)} high or critical, worst cvss {worst}")
for line in found:
    print("  " + line)
sys.exit(1 if found else 0)
