#!/usr/bin/env bash
set -euo pipefail

# Rebuild the checked-in web subsets with fontTools + Brotli support.
# Full originals stay available for scripts outside these Unicode ranges.
font_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/fonts"
# Also cover address numero signs, minus/infinity signs, select icons and disclosure markers.
unicodes='U+0000-024F,U+0400-045F,U+10A0-10FF,U+1C90-1CBF,U+2000-206F,U+20A0-20CF,U+2116,U+2190-21FF,U+2212,U+221E,U+25B8,U+25BC,U+25BE,U+2D00-2D2F'
for weight in Regular SemiBold Bold; do
  python3 -m fontTools.subset "$font_root/FiraGO-$weight.woff2" \
    --output-file="$font_root/FiraGO-$weight-subset.woff2" \
    --unicodes="$unicodes" --layout-features='*' --flavor=woff2
done

# The checked-in Arial fallback uses x-height matching and FiraGO's hhea
# metrics (identical to its USE_TYPO_METRICS values). Recalculate when the
# originals change. ARIAL_FONT allows the same calculation on another OS.
python3 - "$font_root" "${ARIAL_FONT:-/System/Library/Fonts/Supplemental/Arial.ttf}" <<'PY'
from pathlib import Path
import sys
from fontTools.ttLib import TTFont

root, arial_path = Path(sys.argv[1]), Path(sys.argv[2])
for weight in ('Regular', 'SemiBold', 'Bold'):
    print(f'{weight}: {(root / f"FiraGO-{weight}-subset.woff2").stat().st_size:,} bytes')
if not arial_path.is_file():
    print('Set ARIAL_FONT to an installed Arial.ttf to recalculate fallback metrics.')
    sys.exit(0)
with TTFont(root / 'FiraGO-Regular.woff2') as target, TTFont(arial_path) as fallback:
    upm = target['head'].unitsPerEm
    adjust = (target['OS/2'].sxHeight / upm) / (
        fallback['OS/2'].sxHeight / fallback['head'].unitsPerEm
    )
    print(f'size-adjust: {adjust * 100:.4f}%;')
    print(f'ascent-override: {target["hhea"].ascent / upm / adjust * 100:.4f}%;')
    print(f'descent-override: {-target["hhea"].descent / upm / adjust * 100:.4f}%;')
    print(f'line-gap-override: {target["hhea"].lineGap / upm / adjust * 100:.4f}%;')
PY
