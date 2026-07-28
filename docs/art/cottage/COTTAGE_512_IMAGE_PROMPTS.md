# 炉火小屋图像生成提示词（GPT Image 2）

先生成底图。通过后再生成前景层和炉火动画；三张图必须保持同一镜头、比例、调色与家具位置。

## 1. 小屋底图

```text
Create a crisp 2D pixel-art game interior for a cozy frontier traveler's cottage at night.

Canvas: exactly 512 x 288 pixels, 16:9. Native pixel art only: hard 1-pixel edges, nearest-neighbor look, no anti-aliasing, no blur, no depth-of-field, no painterly texture, no text, no UI, no characters, no animals, no people, no readable symbols.

Camera: fixed straight-on side-view interior, like a classic top-down-adjacent 16-bit life RPG room. Keep a stable 32 px tile grid: 16 columns by 9 rows. The whole room must be readable and leave a large open central walking area.

Style: warm hand-built timber cottage, dark walnut beams, honey-brown plank floor, cream plaster walls, soft amber lamplight, snowy blue night visible through the west window. The mood is safe, quiet, and lived-in: a traveler has returned home after an expedition. Reference the warmth and readability of a creature-companion life RPG and a countryside life sim, but do not imitate any specific game or copyrighted asset.

Composition, exact placement:
- North-west: an empty stone-and-iron hearth with a dark firebox, ash bed, and small copper kettle hook. DO NOT draw flames, sparks, smoke, or glow inside the firebox.
- West wall: one snowy window; under it, a small wooden writing table with a rolled parchment, ink bottle, and quill. The parchment must have no readable writing.
- North-east: a compact cartography desk with an unfurled blank map, compass, ruler, and pinned blank route paper. No legible text.
- East side: a sturdy wooden chest with brass fittings, clearly distinct from the cartography desk.
- South-east: a simple made bed with a folded wool blanket and small bedside stool.
- South-west: a tall bookcase with a few books and empty shelf space; no magical items, no rewards, no floating effects.
- South center: a wooden exterior door. Place a woven russet-and-cream rug directly in front of it so the exit is obvious.
- Center: a large mostly empty woven rug and uninterrupted floor for walking and a following companion.

Important implementation constraints: all furniture must stay within its described zone; leave the central area uncluttered; do not bake in a player, companion, fire animation, interaction icons, labels, shadows of characters, interface panels, or text. Deliver as a fully opaque PNG background.
```

## 2. 前景遮挡层

```text
Create a transparent PNG foreground overlay for the exact same 512 x 288 pixel-art cottage scene described below. Canvas exactly 512 x 288. Transparent everywhere except for the lower front edges of furniture that should visually pass in front of a walking character: a few bed-frame pixels, chest base, desk front edge, bookcase base, and rug fringe. Include only subtle static warm light on the floor around lamps and the empty hearth; do not draw fire, smoke, sparks, characters, animals, UI, text, or icons.

Native pixel art, hard edges, no anti-aliasing, no blur. This layer must align perfectly with the base image: same fixed side-view camera, same 32 px grid, same furniture positions. Preserve transparency outside the sparse foreground pixels.
```

## 3. 四帧炉火动画

```text
Create a transparent pixel-art sprite sheet for a small cottage hearth flame.

Canvas exactly 128 x 32 pixels, four equal 32 x 32 frames arranged horizontally from left to right. Transparent background. Native pixel art with crisp hard edges, no anti-aliasing, no blur, no text, no characters, no UI.

The four frames must loop seamlessly: a low, gentle amber-orange fire suitable for an empty stone hearth, with slight movement of two or three flame tongues and a few tiny contained ember pixels. Frame 1 must transition naturally from frame 4. Keep the flame silhouette within a centered 20 x 22 pixel area in every frame. Use a restrained palette: deep ember red, orange, warm gold, pale cream highlight; no blue flame, no smoke, no magical effects.
```
