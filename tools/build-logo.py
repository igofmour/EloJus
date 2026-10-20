"""Export the EloJus v0.2 mark as SVG. Build-time dependency: fonttools 4.67.0.

Usage: python tools/build-logo.py
The prototype itself has no runtime dependency on this script or fonttools.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "dist" / "assets"
SYMBOL = "M8 8H36V18H18V27H46V8H56V42C56 51 50 56 41 56H30V46H40C44 46 46 44 46 40V37H18V46H24V56H8Z"
FONT = TTFont(ASSETS / "fonts" / "dm-sans-semibold.ttf")
GLYPHS = FONT.getGlyphSet()
CMAP = FONT.getBestCmap()
SCALE = 58 / FONT["head"].unitsPerEm


def svg(title, viewbox, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" fill="none">\n'
            f'  <title>{title}</title>\n{body}\n</svg>\n')


def wordmark(color, offset=0):
    # A single weight and optical spacing keep EloJus read as one name.
    x = offset
    paths = []
    for letter in "EloJus":
        name = CMAP[ord(letter)]
        pen = SVGPathPen(GLYPHS)
        GLYPHS[name].draw(pen)
        paths.append(f'    <path transform="translate({x:.3f} 52) scale({SCALE:.6f} {-SCALE:.6f})" d="{pen.getCommands()}"/>')
        x += FONT["hmtx"].metrics[name][0] * SCALE - 1.5
    return f'  <g fill="{color}">\n' + "\n".join(paths) + '\n  </g>', x + 3


for suffix, color in [("", "#111111"), ("-white", "#FFFFFF")]:
    mark = f'  <path fill="{color}" d="{SYMBOL}"/>'
    (ASSETS / f"elojus-symbol-v2{suffix}.svg").write_text(
        svg("EloJus — E e J conectados", "0 0 64 64", mark), encoding="utf-8")
    letters, width = wordmark(color, 76)
    (ASSETS / f"elojus-logo-v2{suffix}.svg").write_text(
        svg("EloJus", f"0 0 {width:.3f} 64", mark + "\n" + letters), encoding="utf-8")
    letters, width = wordmark(color)
    (ASSETS / f"elojus-wordmark-v2{suffix}.svg").write_text(
        svg("EloJus", f"0 0 {width:.3f} 64", letters), encoding="utf-8")

(ASSETS / "elojus-icon-v2.svg").write_text(svg(
    "EloJus", "0 0 64 64", '  <rect width="64" height="64" rx="10" fill="#111111"/>\n'
    f'  <path fill="#FFFFFF" d="{SYMBOL}"/>'), encoding="utf-8")
print("Exported seven SVG assets with outlined lettering.")
