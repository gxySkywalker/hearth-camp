# 天使邮局 Asset Pack 01 — 图像生成 Prompt

> 用途：GPT Image 2 / 像素生成工具
> 日期：2026-07-20

---

## Prompt 1: 邮局头部基础背景

```
Use case: Angel Post Office page header — warm medieval interior room
Asset type: static environment background (opaque PNG)
Existing world: 炉火营地 cottage interior (warm browns, stone, wood beams, upper-left light source)
Logical resolution: 512 x 112 px
Output resolution: 1024 x 224 px (2x nearest-neighbor)
Perspective: 3/4 top-down, consistent with cottage_room_backdrop
Palette: 32-40 colors — warm wood #392419 #6F4327, cream paper #E9D7AF, honey gold #C79245, lamp glow #E6B65A, deep shadow #2A1A14, window light blue-gray #5A7A8A
Material: wood plank walls, small-pane arched window, brass hanging lamp, canvas mail sacks piled near right side, wooden counter at bottom, scattered envelopes and parchment
Pixel restrictions: hard edges, no anti-aliasing, nearest-neighbor, 2x integer upscale, no gradients, no soft shadows, no rounded corners
Transparency: NO (fully opaque)
Forbidden: text, UI elements, modern objects, characters, bright neon, modern office items, photographs
Output: single opaque PNG at 1024x224 px
Consistency: match cottage_room_backdrop lighting direction (upper-left), same wood grain density, same wall plank thickness
Intended React/CSS usage: background-image on mail-header div, cover, nearest-neighbor
```

---

## Prompt 2: 木格信匣

```
Use case: left sidebar mailbox organizer in Angel Post Office page
Asset type: UI container element (transparent PNG)
Existing world: cottage wooden furniture style
Logical resolution: 128 x 176 px
Output resolution: 256 x 352 px (2x nearest-neighbor)
Perspective: straight-on with slight depth for cubby holes
Palette: warm wood #6F4327, slot shadow #392419, brass nameplate holder #C79245, cream paper peeking from slots #E9D7AF
Material: carved wood with brass label holders, visible paper edges in some slots
Pixel restrictions: hard edges, no anti-aliasing, transparent background, 2x integer scale
Transparency: YES (slot openings and surrounding area transparent, only wood frame rendered)
Forbidden: text on nameplates, modern mailbox design, rounded corners, icons
Output: transparent PNG at 256x352 px
Consistency: same wood tone as cottage furniture
Intended React/CSS usage: background-image on mail-cubby, transparent slots show React-rendered envelope list beneath
```

---

## Prompt 3: 基础信封 atlas (4状态)

```
Use case: envelope list items — unread, read, selected, replied states
Asset type: horizontal sprite strip (transparent PNG)
Existing world: cottage and mail UI
Logical resolution: 256 x 64 px (4 frames of 64x40 each, horizontal strip)
Output resolution: 512 x 128 px (2x nearest-neighbor)
Perspective: 3/4 top-down, upper-left light
Palette: cream paper #E9D7AF, red wax seal #8E3F32, brass detail #C79245, edge shadow #C9A878, fold crease #B89868
Material: parchment envelope with fold lines, wax seal circle (unread: intact red wax / read: broken with crack line / replied: small feather mark on corner)
Pixel restrictions: hard edges, no anti-aliasing, 4 distinct frames clearly separated, transparent background, 2x integer scale
Transparency: YES
Forbidden: text on envelopes, modern mail icons, emoji, rounded corners
Output: transparent PNG sprite strip at 512x128 px
Consistency: same parchment color as letter paper
Intended React/CSS usage: CSS background-image sprite, background-position switches frame per state
```

---

## Prompt 4: 奶油信纸框

```
Use case: letter reading paper frame in right panel
Asset type: decorative frame (opaque PNG)
Existing world: cottage paper aesthetic
Logical resolution: 320 x 480 px
Output resolution: 640 x 960 px (2x nearest-neighbor)
Perspective: flat (straight-on document view)
Palette: cream paper #E9D7AF, subtle aged edge #C9A878, corner wear #B89868
Material: parchment with slightly worn edges, thin decorative line border, small ink mark or crease detail near corners
Pixel restrictions: hard edges, no anti-aliasing, center area remains paper-colored (fully opaque) for text readability
Transparency: NO (opaque, acts as paper background behind React text)
Forbidden: text, modern paper texture, curled/rolled edges, dark stains
Output: opaque PNG at 640x960 px
Intended React/CSS usage: background-image on mail-letter-paper div, fill or contain
```

---

## Prompt 5: 小天使 idle sprite sheet

```
Use case: small angel character idle animation (sorting mail at desk)
Asset type: character sprite sheet (horizontal strip, transparent PNG)
Existing world: cottage companion sprites (32x32 or 48x48 format)
Logical resolution: 192 x 48 px (4 frames of 48x48 each)
Output resolution: 384 x 96 px (2x nearest-neighbor)
Perspective: 3/4 top-down (match companion sprite perspective), upper-left light
Palette: cream wings #F0E6D2, simple robe #D4C4A8, hair #C8B088, small postman cap or headband #6F4327, desk surface #5A3A25
Material: small winged figure in simple post-worker clothes, standing at a mail-sorting desk, gently handling envelopes
Pixel restrictions: 4-frame idle loop (frame 1: hands on desk, frame 2: lift one envelope, frame 3: look at it, frame 4: place it down), hard edges, no anti-aliasing, transparent background
Transparency: YES
Forbidden: religious iconography, cherub style, large elaborate wings, halo, glowing effects, modern office items
Output: transparent PNG sprite strip at 384x96 px
Consistency: same pixel density and edge thickness as cottage companion sprites
Intended React/CSS usage: CSS animation steps(4) on background-position, placed in mail-header-scene
```

---

## Prompt 6: 蜡封与邮戳 atlas

```
Use case: wax seals and postmarks for envelope decoration
Asset type: small icon atlas (transparent PNG)
Logical resolution: 96 x 48 px (4 items of 24x24 each, packed 2x2 grid)
Output resolution: 192 x 96 px (2x nearest-neighbor)
Perspective: flat (straight-on stamp/seal view)
Palette: red wax #8E3F32, gold wax #C79245, ink brown #3D2B22, cream paper background transparent
Material: wax seal (daily/intact red wax) + wax seal (daily/broken with crack) + postmark (daily/star motif circular stamp) + postmark (weekly/seven-star motif circular stamp)
Pixel restrictions: hard edges, circular stamps, no anti-aliasing, 4 items clearly separated in grid
Transparency: YES
Forbidden: text inside stamps (React will overlay text), modern postal imagery, QR codes, barcodes
Output: transparent PNG atlas at 192x96 px
Intended React/CSS usage: CSS background-image with background-position, placed in mail-letter-seals area
```
