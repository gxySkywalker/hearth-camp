# 天使邮局视觉蓝图

> 状态：视觉蓝图，待用户确认后实施。
> 依赖：ANGEL_POST_OFFICE_PROPOSAL.md、WORLD_BIBLE v0.3、ART_BIBLE.md
> 修订：2026-07-20

---

## 1. 设计决策

| 决策 | 选择 |
|------|------|
| 归灯节周期 | 11月7日–15日，归灯夜11月15日 |
| 小天使 | 常驻首屏，四阶段分动作 |
| 页面结构 | 方案C：头部18% + 左木格280px + 右信纸 |
| 动画 | 纯CSS transition/keyframes，零外部动画依赖 |

---

## 2. 外部参考研究结论

| 参考 | 借鉴 | MVP用途 | 不采用 |
|------|------|---------|--------|
| Pixel Agents | 三层架构(背景/sprite/UI)、整数缩放、状态机 | 邮局头部结构、小天使动画 | Canvas管线 |
| Pixel Art to CSS | box-shadow小物件、keyframes动画 | 蜡封/纸角/邮戳动画 | 大型背景 |
| Motion | layoutId共享元素模式 | 设计参考(不引入) | 150kB |
| @pixi/react | 精灵批量渲染 | 未来评估 | MVP |
| SNES/Retro | 硬边、focus状态、tabs API | 木格tab设计 | 特定调色板 |
| Ark Pixel | 中文覆盖 | 不更换(Fusion Pixel SC足够) | — |

---

## 3. 页面结构（方案C）

```
┌──────────────────────────────────────────────┐
│ 天使邮局 · 地点头部 (~150px)                  │
│ [背景+小天使+最新未读提示]                    │
├────────────┬─────────────────────────────────┤
│ 木格信匣    │ 展开信纸                         │
│ 280px      │ flex-1                           │
│            │                                  │
│ 新到来信   │ ┌──────────────────────────────┐ │
│ 每日来信   │ │ 七月二十日的星页              │ │
│ 每周来信   │ │                              │ │
│ 节庆来信   │ │ 今天共专注 2小时14分钟...      │ │
│ 纪念来信   │ │                              │ │
│            │ │ [蜡封] [邮戳]                 │ │
│            │ │ 回信: ________                │ │
│            │ │ 查看本期星图 →               │ │
│            │ └──────────────────────────────┘ │
└────────────┴─────────────────────────────────┘
```

---

## 4. 地点头部

### 结构

```
┌──────────────────────────────────────────────┐
│ [基础邮局背景 512×112]                        │
│ [当前节庆 phase overlay]                      │
│ [小天使 sprite 48×48]                         │
│                                               │
│ 天使邮局                                      │
│ 深秋 · 窗外的灯刚刚亮起                        │
│ 有一封信刚刚放进了你的木格。                   │
└──────────────────────────────────────────────┘
```

### 节庆阶段文案

| 阶段 | 日期范围 | 文案 |
|------|---------|------|
| preparation | 11/4–11/6 | 归灯节将近了。小天使正在擦亮去年收起的提灯。 |
| festival | 11/7–11/14 | 归灯节 · 11月10日 · 节期第四日。镇上的灯正一盏接一盏亮起来。 |
| climax | 11/15 | 归灯夜 · 11月15日。今晚，每一扇窗都为仍在路上的人留着灯。 |
| afterglow | 11/16 | 归灯节后的清晨 · 11月16日。窗边还留着昨夜没有收起的灯。 |

### 分层资产

基础层（静态PNG，512×112）：
- 日常邮局背景（暖木墙面+窗口+灯+邮袋）

归灯节覆盖层（透明PNG，512×112，与基础背景严格对齐）：
1. preparation overlay — 一两盏提灯、擦灯工具、少量深靛蓝布饰
2. festival overlay — 多盏窗灯、木格旁小提灯、蜂蜜灯光、深靛蓝边饰
3. climax overlay — 完整灯火、归灯夜专属窗景、主提灯、更明显的蜂蜜金光
4. afterglow overlay — 留下一部分灯、亮度降低

资产组合：基础背景 + phase overlay + 小天使 sprite + React UI。整张不替换。

---

## 5. 小天使

### 技术

CSS sprite sheet，`animation: steps(N)` 逐帧。48×48 logical px（96×96 actual，2×）。

### 基础动作

| 动作 | 帧数 | 触发 |
|------|:---:|------|
| idle (整理桌面) | 4 | 默认 |
| sorting (分类信件) | 6 | 有待发信 |
| stamping (盖邮戳) | 4 | 用户回信后 |

### 归灯节动作

| 阶段 | 动作 | 帧数 |
|------|------|:---:|
| preparation | 擦灯 / 检查灯芯 | 4 |
| festival | 挂提灯 / 整理深蓝信封 | 6 |
| climax | 点亮主灯 / 递出主节庆信 | 6 |
| afterglow | 收拾信纸 / 看向窗边 | 4 |

`prefers-reduced-motion: reduce` 显示静态第一帧。

---

## 6. 木格信匣（左栏 280px）

分类：新到来信 / 每日来信 / 每周来信 / 节庆来信 / 纪念来信 / 远方来信 / 所有来信。

可折叠，默认展开有内容分类。选中信封2px黄铜硬边框。键盘 `focus-visible` outline。

---

## 7. 信封设计系统

### 逻辑规格

64×40 logical px（128×80 actual，2×）。4状态 × 类型变体。

### 统一属性

视角3/4俯视、光源左上、2× nearest-neighbor、硬边2px偏移阴影。

### 状态

| 状态 | 特征 |
|------|------|
| unread | 完整蜡封 + 右上纸角 |
| read | 蜡封已破 + 信封略开 |
| selected | 黄铜2px硬边框 |
| replied | 小羽毛笔标记 |

### 类型变体

| 类型 | 封边 | 蜡封 | 邮戳 |
|------|------|------|------|
| 每日 | — | 红 | 星点 |
| 每周 | 麦金边 | 红 | 七星 |
| 生日 | 奶油金 | 星形 | 蜡烛 |
| 春节 | 朱砂红 | 金 | 灯笼 |
| 归灯节 | 深靛蓝 | 蜂蜜金 | 提灯 |
| 冬星节 | 松绿 | 酒红 | 木星 |

普通周期信在归灯节期间可用轻量归灯节信封封边+提灯小邮戳（不改 subtype）。归灯夜主信用归灯夜特别信封（完整蜂蜜金蜡封+主提灯邮戳+深靛蓝双边线）。

---

## 8. 信纸系统

### 结构

奶油纸背景 `#E9D7AF`，14-16px像素字体，行高1.7，最大宽度560px居中。正文+事实附页+回信框(单行36-42px自动保存)+邮戳蜡封右下角。

### 归灯节信纸

| 用途 | 信纸 |
|------|------|
| 节期内普通daily/weekly | 基础奶油纸 + 深靛蓝细边 + 小提灯角花 |
| 开始信(11/7) | 奶油纸 + 深靛蓝边框 + 未完全点亮的提灯 + 蜂蜜金蜡封 |
| 归灯夜主信(11/15) | 深色外框 + 蜂蜜灯火 + 主提灯邮戳 + 完整节庆边饰(保持正文高对比，不使用大面积深蓝为正文底) |
| 余灯期(11/16) | 普通信纸，不继续使用节庆信纸 |

---

## 9. 信封状态机

closed → selected → opening → opened → reading → replied

- 未读首次打开：250ms CSS `opacity 0→1` + `scale(.98→1)`
- 已读直接展开（跳过动画）
- 切换信件→直接替换
- `prefers-reduced-motion` 全部即时

---

## 10. 动画技术总结

| 组件 | 技术 |
|------|------|
| 列表切换 | CSS transition 150ms |
| 信纸展开 | CSS transition 250ms |
| 蜡封微光 | CSS @keyframes (opacity .6↔.9) |
| 纸角轻跳 | CSS @keyframes (translateY 0↔-2px) |
| 小天使动画 | CSS sprite sheet steps(N) |
| 灯火闪烁 | CSS @keyframes (brightness 1↔.85) |

不引入 Motion、Pixi、Canvas。

---

## 11. 资产规格

### Asset Pack 01：邮局基础环境

| # | 资产 | Logical | Actual(2×) | 帧 | 透明 |
|---|------|---------|-----------|:--:|:---:|
| 1 | 邮局头部背景 | 512×112 | 1024×224 | 1 | ❌ |
| 2 | 木制柜台 | 128×48 | 256×96 | 1 | ✅ |
| 3 | 木格信匣 | 128×176 | 256×352 | 1 | ✅ |
| 4 | 过大邮袋 | 64×56 | 128×112 | 1 | ✅ |
| 5 | 暖灯 | 32×48 | 64×96 | 1 | ✅ |
| 6 | 窗口 | 96×72 | 192×144 | 1 | ❌ |
| 7 | 基础信封atlas | 256×64 | 512×128 | 4 | ✅ |
| 8 | 基础奶油信纸框 | 320×480 | 640×960 | 1 | ❌ |
| 9 | 小天使idle sheet | 192×48 | 384×96 | 4 | ✅ |
| 10 | 小天使蜡封(unread/read) | 48×24 | 96×48 | 2 | ✅ |
| 11 | 每日邮戳 | 24×24 | 48×48 | 1 | ✅ |
| 12 | 每周邮戳 | 24×24 | 48×48 | 1 | ✅ |

### Asset Pack 02：归灯节

| # | 资产 | Logical | Actual(2×) | 帧 | 透明 | 阶段 |
|---|------|---------|-----------|:--:|:---:|------|
| 1 | preparation overlay | 512×112 | 1024×224 | 1 | ✅ | prep |
| 2 | festival overlay | 512×112 | 1024×224 | 1 | ✅ | fest |
| 3 | climax overlay | 512×112 | 1024×224 | 1 | ✅ | clim |
| 4 | afterglow overlay | 512×112 | 1024×224 | 1 | ✅ | after |
| 5 | 小天使擦灯 sheet | 192×48 | 384×96 | 4 | ✅ | prep |
| 6 | 小天使挂灯 sheet | 192×48 | 384×96 | 6 | ✅ | fest |
| 7 | 小天使点灯 sheet | 192×48 | 384×96 | 6 | ✅ | clim |
| 8 | 归灯节普通信封 | 256×64 | 512×128 | 4 | ✅ | fest |
| 9 | 归灯夜主信封 | 64×40 | 128×80 | 1 | ✅ | clim |
| 10 | 归灯节信纸框 | 320×480 | 640×960 | 1 | ❌ | fest |
| 11 | 归灯夜主信纸框 | 320×480 | 640×960 | 1 | ❌ | clim |
| 12 | 提灯邮戳 | 24×24 | 48×48 | 1 | ✅ | fest |
| 13 | 主提灯邮戳 | 24×24 | 48×48 | 1 | ✅ | clim |
| 14 | 蜂蜜金蜡封 | 24×24 | 48×48 | 1 | ✅ | fest |
| 15 | 归灯节纪念附页 | 160×80 | 320×160 | 1 | ✅ | clim |
| 16 | 单独提灯 | 24×32 | 48×64 | 1 | ✅ | — |
| 17 | 窗灯 | 24×32 | 48×64 | 1 | ✅ | — |
| 18 | 深靛蓝布饰 | 48×32 | 96×64 | 1 | ✅ | — |

存放路径：`assets/art/environments/post_office/`。

### 春节和冬星节资产

后续按相同分层overlay模式设计。优先归灯节，春节次之，冬星节再次。

---

## 12. 图像生成 Prompt 新增

### Prompt 7: 归灯节准备期覆盖层

```
Use case: Returning Lights Festival preparation phase overlay (Nov 4-6)
Asset type: transparent overlay PNG
Logical resolution: 512x112 px (2x output 1024x224)
Palette: deep indigo #2A3A50 accents, cream #E9D7AF base transparency, honey gold #C79245 light dots
Material: 1-2 small lanterns placed near window, lamp-cleaning cloth on counter
Pixel restrictions: hard edges, no anti-aliasing, transparent background, align precisely with post_office_base_bg PNG
Transparency: YES (entire background transparent except overlay elements)
Forbidden: text, characters, bright effects, modern decorations
Output: transparent PNG 1024x224 px, 2x nearest-neighbor
Consistency: same logical grid and perspective as post_office_base_bg
```

### Prompt 8: 归灯节节期覆盖层

```
Use case: Returning Lights Festival active phase overlay (Nov 7-14)
Asset type: transparent overlay PNG
Logical resolution: 512x112 px (2x output 1024x224)
Palette: deep indigo #2A3A50 trims, honey gold #C79245 lights, warm amber #E6A840 glow
Material: multiple window lanterns, small lantern near mail cubby, deep indigo fabric trim along edges
Pixel restrictions: hard edges, no anti-aliasing, transparent background
Transparency: YES
Forbidden: text, characters, cartoon effects
Output: transparent PNG 1024x224 px
```

### Prompt 9: 归灯夜高潮覆盖层

```
Use case: Returning Lights Night climax overlay (Nov 15)
Asset type: transparent overlay PNG
Logical resolution: 512x112 px (2x output 1024x224)
Palette: deep indigo #2A3A50, warm honey gold #C79245, brighter lantern glow #E8B860, window scene with full lights
Material: full lantern display, main ceremonial lantern prominent, richest gold lighting, deep indigo border
Pixel restrictions: hard edges, no anti-aliasing, transparent background
Transparency: YES
Output: transparent PNG 1024x224 px
```

### Prompt 10: 归灯节余灯覆盖层

```
Use case: Returning Lights Festival afterglow overlay (Nov 16)
Asset type: transparent overlay PNG
Logical resolution: 512x112 px (2x output 1024x224)
Palette: muted indigo #3A4A60, soft amber #D09840, reduced brightness
Material: some lanterns still present but dimmed, no full decorations
Transparency: YES
Output: transparent PNG 1024x224 px
```

### Prompt 11: 归灯节信封 atlas

```
Use case: Returning Lights Festival envelope sprite sheet
Asset type: sprite atlas (transparent PNG)
Logical resolution: 256x64 px (4 frames of 64x40 each)
Palette: cream #E9D7AF base, deep indigo #2A3A50 border, honey gold #C79245 seal
Material: envelope with deep indigo edge trim, honey gold wax seal, small lantern motif on corner
Pixel restrictions: hard edges, no anti-aliasing, 4 distinct frames
Transparency: YES
Output: transparent PNG 512x128 px (2x)
```

### Prompt 12: 归灯夜主信纸框

```
Use case: Returning Lights Night main letter paper frame
Asset type: decorative frame (opaque PNG)
Logical resolution: 320x480 px (2x output 640x960)
Palette: deep indigo #2A3A50 outer frame, cream #E9D7AF center, honey gold #C79245 corner accents, lantern glow motif
Material: richer festival paper with indigo border, honey gold corner lanterns, main ceremonial postmark area
Pixel restrictions: hard edges, no anti-aliasing, center remains paper-colored for readability
Transparency: NO (opaque, acts as paper background)
Forbidden: text content, unreadable dark background
Output: opaque PNG 640x960 px (2x)
```

---

## 13. 实施顺序

1. 基础结构（CSS布局+导航+PageId `'mail'`）
2. 数据管线（复用 `mail:*` IPC）
3. 左栏列表（信封列表+木格分类+未读CSS）
4. 右栏信纸（信纸组件+回信）
5. 地点头部（静态背景PNG+小天使CSS sprite）
6. 动画（CSS transitions+reduced-motion）
7. 资产生成（Asset Pack 01: 12项基础）
8. 归灯节（Asset Pack 02: 18项+纯函数测试+phase逻辑）
9. 春节（按相同分层框架扩展）
10. 冬星节（按相同分层框架扩展）
11. 生日（节庆信+信纸）

---

## 14. 测试计划

日期边界：

| 日期 | phase |
|------|-------|
| 11月3日 | none |
| 11月4日 | preparation |
| 11月6日 | preparation |
| 11月7日 | festival |
| 11月14日 | festival |
| 11月15日 | climax |
| 11月16日 | afterglow |
| 11月17日 | none |

信件：开始信11/7只一封、主信11/15只一封、离线补发归属原日期、节期内daily保持periodic、节期外daily不用归灯节外观、用户无远征仍生成节庆信、基线启用前不补历史、时区跨日不重复、phase纯函数不依赖系统时间。

---

## 15. 确认

本轮未修改任何代码、数据库、导航、正史。状态：视觉蓝图，待用户确认后实施。
