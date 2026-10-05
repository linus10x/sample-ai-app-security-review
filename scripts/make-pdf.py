#!/usr/bin/env python3
"""Build docs/portfolio/case-study.pdf (one US Letter page) from case-study.md and the CI facts."""
import base64
import json
import re
import subprocess
import tempfile
from pathlib import Path

import markdown

root = Path(__file__).resolve().parent.parent
portfolio = root / "docs" / "portfolio"
facts = {k: v["value"] for k, v in json.loads((root / "docs" / "findings" / "ci-facts.json").read_text()).items()}

text = (portfolio / "case-study.md").read_text()
img = "data:image/png;base64," + base64.b64encode((portfolio / "img-1.png").read_bytes()).decode()
text = text.replace("{{img1}}", img)
for key, value in facts.items():
    text = text.replace("{{" + key + "}}", str(value))
left = re.findall(r"\{\{(\w+)\}\}", text)
assert not left, f"unfilled placeholders: {left}"

body = markdown.markdown(text, extensions=["md_in_html"])
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Security review of an AI-built Next.js, Supabase, Stripe app</title>
<style>
  @page {{ size: Letter; margin: 0.6in; }}
  body {{ font:10pt/1.38 system-ui,-apple-system,Segoe UI,sans-serif; color:#1b2430; margin:0; }}
  h1 {{ font-size:17pt; line-height:1.15; margin:0 0 2px; color:#1f5f4a; }}
  p em {{ color:#5b6675; }}
  h2 {{ font-size:11pt; margin:11px 0 3px; border-bottom:1px solid #d9dee5; padding-bottom:2px; }}
  p, ul {{ margin:3px 0; }} ul {{ padding-left:17px; }} li {{ margin:1.5px 0; }}
  code {{ font-size:9pt; background:#f3f5f7; padding:0 3px; border-radius:3px; }}
  .diagram {{ float:right; width:42%; margin:4px 0 6px 14px; }}
  .diagram img {{ width:100%; display:block; border:1px solid #d9dee5; }}
  .footer {{ clear:both; margin-top:12px; padding-top:6px; border-top:1px solid #d9dee5; font-size:9.5pt; color:#1b2430; }}
</style></head><body>{body}</body></html>"""
tmp = Path(tempfile.mkdtemp()) / "case-study.html"
tmp.write_text(html)
subprocess.run(["node", "scripts/print-pdf.mjs", str(tmp), str(portfolio / "case-study.pdf")], check=True, cwd=root)
print("wrote docs/portfolio/case-study.pdf")
