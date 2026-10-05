#!/usr/bin/env python3
"""Render the three portfolio images, each exactly 1000x750.

img-1  architecture with trust boundaries and the finding ids (mermaid-cli)
img-2  the findings summary table, a screenshot of the rendered report (Playwright)
img-3  the two CI exploit jobs side by side, drawn from the real results files (Playwright)
Every image is fitted onto a 1000x750 canvas with Pillow, never stretched.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
out_dir = root / "docs" / "portfolio"
findings = root / "docs" / "findings"
out_dir.mkdir(parents=True, exist_ok=True)
W, H = 1000, 750
tmp = Path(tempfile.mkdtemp())


def run(*cmd, **kw):
    subprocess.run(cmd, check=True, cwd=root, **kw)


def fit(src: Path, dest: Path, pad: int = 24):
    """Scale to fit inside the canvas, keep the aspect ratio, centre on white."""
    img = Image.open(src).convert("RGB")
    box_w, box_h = W - 2 * pad, H - 2 * pad
    scale = min(box_w / img.width, box_h / img.height)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), "white")
    canvas.paste(img, ((W - img.width) // 2, (H - img.height) // 2))
    canvas.save(dest, optimize=True)


# img-1 -----------------------------------------------------------------------------------
chrome = subprocess.run(
    ["node", "-e", "console.log(require('playwright').chromium.executablePath())"],
    cwd=root, capture_output=True, text=True, check=True,
).stdout.strip()
pp = tmp / "puppeteer.json"
pp.write_text(json.dumps({"executablePath": chrome, "args": ["--no-sandbox"]}))
big = tmp / "img-1-big.png"
run("npx", "mmdc", "-i", "docs/diagrams/img-1.mmd", "-o", str(big), "-p", str(pp), "-b", "white", "-s", "2")
fit(big, out_dir / "img-1.png")

# img-2 -----------------------------------------------------------------------------------
report = findings / "REPORT.html"
if not report.exists():
    sys.exit("run scripts/render-report.py first")
shot = tmp / "img-2.png"
run("node", "scripts/shoot.mjs", str(report), str(shot), str(W), str(H), "summary")
Image.open(shot).convert("RGB").save(out_dir / "img-2.png", optimize=True)

# img-3 -----------------------------------------------------------------------------------
TITLES = {
    "F01": "Orders readable across orgs", "F02": "Service key in the bundle", "F03": "Unsigned webhook accepted",
    "F04": "Replayed event fulfils twice", "F05": "Price set by the browser", "F06": "Invoice owner not checked",
    "F07": "Import reaches internal hosts", "F08": "Notes run script", "F09": "Errors leak internals", "F10": "No security headers",
}


def column(label: str, heading: str, sub: str, word: str, cls: str) -> str:
    data = {f["id"]: f for f in json.loads((findings / f"results-{label}.json").read_text())["findings"]}
    rows = "".join(
        f'<li class="{cls}"><span class="id">{fid}</span><span class="t">{TITLES[fid]}</span><span class="r">{word}</span></li>'
        for fid in sorted(data)
    )
    return f'<section><h2>{heading}</h2><p>{sub}</p><ul>{rows}</ul></section>'


html = f"""<!doctype html><meta charset="utf-8"><style>
body{{margin:0;width:{W}px;height:{H}px;background:#fff;font:15px system-ui,-apple-system,Segoe UI,sans-serif;color:#1b2430;display:flex;gap:16px;padding:22px;box-sizing:border-box}}
section{{flex:1;border:1px solid #d9dee5;border-radius:8px;padding:14px 14px 10px;display:flex;flex-direction:column}}
h2{{margin:0;font-size:18px}} p{{margin:2px 0 10px;color:#5b6675;font-size:13px}}
ul{{list-style:none;margin:0;padding:0;display:grid;gap:6px;flex:1}}
li{{display:grid;grid-template-columns:38px 1fr 62px;align-items:center;padding:0 10px;border-radius:6px;font-size:14px}}
li.bad{{background:#fdecec;border-left:5px solid #c0392b}} li.good{{background:#e8f5ee;border-left:5px solid #1f7a4d}}
.id{{font-weight:700}} .r{{text-align:right;font-weight:700}}
li.bad .r{{color:#c0392b}} li.good .r{{color:#1f7a4d}}
</style>
{column("v0", "exploits-v0", "Tag v0-as-shipped. Every exploit lands.", "FAIL", "bad")}
{column("main", "exploits-main", "Fixed code. Every exploit is stopped.", "PASS", "good")}"""
page = tmp / "img-3.html"
page.write_text(html)
shot3 = tmp / "img-3.png"
run("node", "scripts/shoot.mjs", str(page), str(shot3), str(W), str(H))
Image.open(shot3).convert("RGB").save(out_dir / "img-3.png", optimize=True)

for n in (1, 2, 3):
    size = Image.open(out_dir / f"img-{n}.png").size
    assert size == (W, H), (n, size)
    print(f"img-{n}.png {size[0]}x{size[1]}")
