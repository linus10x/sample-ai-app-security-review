#!/usr/bin/env python3
"""Render docs/findings/REPORT.md to HTML.

Before rendering it checks the report against the real exploit results: every finding must have
landed on v0-as-shipped and must be stopped on main. If the results are missing or disagree with
the report, it refuses to render, so the report cannot claim a retest that did not happen.
"""
import json
import re
import sys
from pathlib import Path

import markdown

root = Path(__file__).resolve().parent.parent
findings = root / "docs" / "findings"
report_md = findings / "REPORT.md"

ids = [f"F{n:02d}" for n in range(1, 11)]


def load(label: str) -> dict:
    path = findings / f"results-{label}.json"
    if not path.exists():
        sys.exit(f"missing {path}: run the exploit jobs first (make audit)")
    return {f["id"]: f for f in json.loads(path.read_text())["findings"]}


v0, main = load("v0"), load("main")
problems = []
for fid in ids:
    if v0.get(fid, {}).get("outcome") != "fail":
        problems.append(f"{fid}: exploit did not land on v0-as-shipped")
    if main.get(fid, {}).get("outcome") != "pass":
        problems.append(f"{fid}: exploit not stopped on main")

text = report_md.read_text()
for fid in ids:
    if not re.search(rf"\| {fid} \|.*Fixed, retest passed \|", text):
        problems.append(f"{fid}: report table does not say 'Fixed, retest passed'")
if problems:
    sys.exit("report and results disagree:\n  " + "\n  ".join(problems))

body = markdown.markdown(text, extensions=["tables", "fenced_code", "md_in_html"])
html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Findings report: Cedar Supply Portal</title>
<style>
  :root {{ --ink:#1b2430; --muted:#5b6675; --line:#d9dee5; --brand:#1f5f4a; }}
  body {{ font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; color:var(--ink); max-width:920px; margin:0 auto; padding:24px; }}
  h1 {{ font-size:26px; margin:0 0 8px; color:var(--brand); }}
  h2 {{ font-size:19px; margin:28px 0 8px; border-bottom:1px solid var(--line); padding-bottom:4px; }}
  h3 {{ font-size:16px; margin:22px 0 6px; }}
  table {{ border-collapse:collapse; width:100%; margin:10px 0; }}
  th, td {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); }}
  th {{ background:#f3f5f7; }}
  code {{ background:#f3f5f7; padding:1px 4px; border-radius:3px; font-size:13px; }}
  ul {{ padding-left:20px; }}
  #summary {{ scroll-margin-top:0; }}
</style></head><body>
{body}
</body></html>
"""
out = findings / "REPORT.html"
out.write_text(html)
print(f"rendered {out.relative_to(root)}: all {len(ids)} findings reproduced on v0 and stopped on main")
