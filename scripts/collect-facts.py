#!/usr/bin/env python3
"""Collect the numbers that appear in the case study from CI output files.

Nothing here is typed in by hand. Each value is read from a file a CI job wrote, and the file it
came from is recorded next to it, so every figure in the PDF can be traced.
"""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent


def need(path: str) -> Path:
    p = root / path
    if not p.exists():
        sys.exit(f"missing {path}: it comes from a CI job")
    return p


unit = json.loads(need("coverage/unit-results.json").read_text())
cov = json.loads(need("coverage/coverage-summary.json").read_text())["total"]["lines"]["pct"]
main = json.loads(need("docs/findings/results-main.json").read_text())
v0 = json.loads(need("docs/findings/results-v0.json").read_text())
pgtap = need("pgtap.txt").read_text()
pgtap_v0 = need("pgtap-v0.txt").read_text()
zap = need("zap.txt").read_text().strip().splitlines()[-1]

pg_total = int(re.search(r"Tests=(\d+)", pgtap).group(1))
zap_nums = {k: int(v) for k, v in re.findall(r"(FAIL-NEW|WARN-NEW|PASS): (\d+)", zap)}

facts = {
    "unit_tests_passed": {"value": unit["numPassedTests"], "source": "coverage/unit-results.json (job quality)"},
    "unit_tests_total": {"value": unit["numTotalTests"], "source": "coverage/unit-results.json (job quality)"},
    "coverage_pct": {"value": round(cov, 1), "source": "coverage/coverage-summary.json (job quality)"},
    "exploits_total": {"value": main["total"], "source": "docs/findings/results-main.json"},
    "exploits_fixed_on_main": {"value": main["matched"], "source": "docs/findings/results-main.json (job exploits-main)"},
    "exploits_land_on_v0": {"value": v0["matched"], "source": "docs/findings/results-v0.json (job exploits-v0)"},
    "pgtap_checks": {"value": pg_total, "source": "pgtap.txt (job exploits-main)"},
    "pgtap_failed_on_v0": {"value": len(re.findall(r"^# Failed test", pgtap_v0, re.M)), "source": "pgtap-v0.txt (job exploits-v0)"},
    "zap_fail": {"value": zap_nums.get("FAIL-NEW", 0), "source": "zap.txt (job exploits-main)"},
    "zap_pass": {"value": zap_nums.get("PASS", 0), "source": "zap.txt (job exploits-main)"},
    "zap_warn": {"value": zap_nums.get("WARN-NEW", 0), "source": "zap.txt (job exploits-main)"},
}
out = root / "docs" / "findings" / "ci-facts.json"
out.write_text(json.dumps(facts, indent=2) + "\n")
for k, v in facts.items():
    print(f"{k:24} {v['value']}")
