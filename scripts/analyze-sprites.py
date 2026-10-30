"""Read atlas alpha channels and record each figure's bounds; never modify images."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
atlases = []
for path in sorted((root / "dist/assets").glob("founders-*.png")):
    image = Image.open(path).convert("RGBA")
    w, h = image.size
    mask = bytearray(1 if a > 40 else 0 for a in image.getchannel("A").tobytes())
    # Two silhouettes touch along a 14-pixel seam in this atlas; split only the analysis mask.
    if path.name == "founders-02.png":
        for x in range(650, w):
            mask[955 * w + x] = 0
    components = []
    for start in range(w * h):
        if not mask[start]:
            continue
        mask[start] = 0
        stack = [start]
        l = r = start % w
        t = b = start // w
        area = 0
        while stack:
            p = stack.pop()
            x, y = p % w, p // w
            l, r, t, b = min(l, x), max(r, x), min(t, y), max(b, y)
            area += 1
            for q in (p - w, p + w, p - 1 if x else -1, p + 1 if x < w - 1 else -1):
                if 0 <= q < w * h and mask[q]:
                    mask[q] = 0
                    stack.append(q)
        if area > 1000:
            components.append((area, l, t, r, b))
    figures = sorted(components, reverse=True)[:15]
    assert len(figures) == 15, (path, len(figures))
    frames = [[None] * 3 for _ in range(5)]
    for area, l, t, r, b in figures:
        row = min(4, int((t + b) / 2 / h * 5))
        col = min(2, int((l + r) / 2 / w * 3))
        assert frames[row][col] is None, (path, row, col)
        l, t, r, b = max(0, l - 2), max(0, t - 2), min(w - 1, r + 2), min(h - 1, b + 2)
        if path.name == "founders-02.png" and col == 2:
            if row == 2:
                b = min(b, 954)
            elif row == 3:
                t = max(t, 956)
        frames[row][col] = {"x": l, "y": t, "w": r - l + 1, "h": b - t + 1}
    atlases.append(frames)
    print(path.name, image.size, "15 figures")
assert len(atlases) == 4, f"Need 4 atlases, found {len(atlases)}"
(root / "dist/sprite-frames.js").write_text("export const SPRITE_FRAMES=" + json.dumps(atlases, separators=(",", ":")) + ";\n")
