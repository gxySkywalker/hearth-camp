# 炉火营地（Hearth Camp）项目交接文档 v0.8.0

> 更新日期：2026-07-28
> 面向下一次 Codex 会话。本文记录已发布版本、冻结边界、暂停内容与安全起点。

---

## 0. 新会话的强制起手式

在修改代码、文档、美术、数据或安装工具前，必须按顺序完整阅读：

1. `docs/PROJECT_HANDOFF.md`（本文）
2. `docs/WORLD_BIBLE.md`
3. `docs/companions/COMPANION_PRODUCTION_RULES.md`
4. `docs/companions/COMPANION_SPRITE_ATLAS_SPEC.md`
5. 伙伴档案：
   - `docs/companions/COMPANION_MOSS_SPROUT_PROFILE.md`
   - `docs/companions/COMPANION_NIGHTLIGHT_CAT_PROFILE.md`
   - `docs/companions/COMPANION_RIVER_OTTER_PROFILE.md`
   - `docs/companions/COMPANION_IRON_BADGER_PROFILE.md`
   - `docs/companions/COMPANION_DUSK_OWL_PROFILE.md`
   - `docs/companions/COMPANION_CLOUD_RABBIT_PROFILE.md`
   - `docs/companions/COMPANION_EMBER_DRAKE_PROFILE.md`
   - 栗子以 `docs/WORLD_BIBLE.md`、`electron/game.cjs` 与既有资源为准
6. `docs/systems/expedition/EXPEDITION_LOOT.md`
7. 邮局文档：`docs/systems/post-office/TIME_AND_MAIL_SYSTEM.md`、`docs/systems/post-office/MAIL_SYSTEM_v0.7.md`、`docs/systems/post-office/ANGEL_POST_OFFICE_PROPOSAL.md`
8. 根目录 `README.md` 与 `CHANGELOG.md`

阅读后先向用户复述：世界观、设计红线、当前版本状态、发现的风险、针对下一条需求的计划；得到明确同意后才开始修改。

---

## 1. 项目定位与不可违反的红线

**炉火营地**是本地优先、单人游玩的像素生活 RPG / 旅途记录游戏。技术上是 Electron + React + PixiJS；体验上应是旅人从炉火小屋出发、专注一段真实时间、归来并被世界与伙伴温柔记住。

当前正式核心循环：

```text
炉火小屋（家） → 直接开始远征 → 归程与收获 → 伙伴同行 / 冒险日志 / 天使邮局 → 回到小屋
```

### 世界与伙伴红线

- 玩家是旅人，不是被管理、考核或优化的人；不要用 KPI、效率、打卡工具语言改写玩家体验。
- 世界不是仪表盘；离开没有惩罚，归来应被温柔接住。
- 八位伙伴、美术资源、伙伴生态位、三阶段成长线与羁绊阈值均已冻结。
- 伙伴是朋友和共同生活者，不是装备、数值工具、效率工具、战斗单位、自动化或资源机器。
- 未经用户明确授权，禁止重构、重新命名伙伴，禁止改变羁绊阈值、核心情感、生态位或已冻结美术方向。
- 伙伴可影响记忆、环境观察、互动文本与小屋存在感；不可给予掉率、经验、速度、战斗或自动化收益。

### 世界边界与未来内容

- 不擅自扩展交易、商店、地图解锁、疾病、药汤、合成、NPC 送礼等未来内容。
- 天使邮局负责把真实发生的旅程整理成信：不得虚构玩家未经历的地点、事件或 NPC 私事。
- 不改动天使邮局生命周期、AI 调用链或世界状态边界，除非用户明确指定。
- 玩家可见文案优先使用旅途词汇：出征、归程、足迹、星轨、路标、冒险日志等。

---

## 2. 已发布版本与 GitHub 状态

- 当前正式版本：**v0.8.0 - 炉火营地公开内测版**
- `package.json` 版本：`0.8.0`
- 分支：`master`，发布时同步推送至 `origin`
- GitHub Release：<https://github.com/gxySkywalker/growth-arc/releases/tag/v0.8.0>
- v0.8.0 是公开内测版（不是 draft / prerelease），README 与 Release 说明同步更新。
- Windows x64 NSIS 安装包：`炉火营地 Setup 0.8.0.exe`；SHA-256 见 `docs/releases/v0.8.0.md`。

### v0.8.0 公开内测内容

1. **完整核心循环**：炉火小屋、制图桌、真实远征、结算、背包、掉落、升级、冒险日志与天文台均可用。
2. **伙伴营地**：八位伙伴的生态位、成长形态、羁绊、共同记忆、小屋对话与专属纪念物已接入。
3. **旅途扩展**：商队、吟游诗人、诗集、炉火制作、伙伴生病与地图碎片解锁地点已加入正式循环。
4. **天使邮局与 AI**：每日星笺、每周札记、节日 / 生日来信、可选 AI 润色与安全回退均可用。
5. **文档与命名**：产品正式更名为炉火营地；文档、脚本与品牌资源已分类整理。

### 发布验证记录

在 v0.8.0 发布前已通过：

```powershell
npm test             # 250 tests passed
npm run art:validate # passed
npm run build         # passed
```

Vite 主 chunk 体积警告仍存在，但只是性能提示，不是发布阻塞；用户未要求性能专项时不要为消除该警告进行大规模拆包。

### 发布注意

- 安装包当前未进行商业代码签名；发布页必须提供 SHA-256，并提醒用户只从仓库 Release 页面下载。
- 如未来构建新版本：先在受控 Windows 环境运行 `npm run dist`，验证产物，再将 NSIS 文件作为 Release asset 上传。

---

## 3. 当前正式小屋实现

### 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/pages/CottagePage.tsx` | 小屋页面、伙伴对话、门口直接开始远征 |
| `src/components/PixiCottageScene.tsx` | Pixi 画布、角色/伙伴、昼夜纹理切换、火焰、前景遮挡 |
| `src/lib/cottage-scene.ts` | 移动、碰撞、交互热点、伙伴跟随/让路与位置记忆 |
| `src/lib/cottage-lighting.ts` | 纯函数昼夜边界：06:00–17:59 为 day，其他为 night |
| `src/pixi-cottage-scene.css` | Pixi 小屋与昼夜提示像素 UI |
| `scripts/art/prepare-cottage-day-night-backdrops.mjs` | 将用户提供的 1672×941 日/夜源图归一化为 512×288 运行时底图 |

### 小屋资源

| 资源 | 用途 |
| --- | --- |
| `assets/art/environments/cottage/cottage_room_day_512_v1.png` | 日景运行时底图 |
| `assets/art/environments/cottage/cottage_room_night_512_v1.png` | 夜景运行时底图 |
| `assets/art/environments/cottage/cottage_hearth_fire_4frames_v1.png` | 夜景炉火四帧图集，48×48 × 4 |
| `assets/art/reference/cottage_room_day_source_v1.png` | 用户确认的日景原图，1672×941 |
| `assets/art/reference/cottage_room_night_source_v1.png` | 用户确认的夜景原图，1672×941 |
| `assets/art/manifest.json` | 两张底图、火焰与来源关系的资源合同 |

### 小屋修改时的约束

- 小屋坐标系固定为 512×288；修改底图时必须同步审查 `FOREGROUND_OCCLUSION_SLICES`、家具碰撞区和交互热点。
- 角色与伙伴是实体：同深度不可重叠；前后深度允许自然遮挡。
- 伙伴应使用既有 48px 四方向运行图集，朝向与实际移动方向一致。
- 交互优先级：面向 / 靠近的场景物件优先于伙伴对话；对话必须可用键盘左右切换、确认和退出。
- `Esc` 默认用于从世界场景切换至侧边栏；首次进入小屋可直接移动。
- Fire sprite 只在夜景显示，当前锚点是 `(79, 53)`，运行时尺寸 40×40；如更换底图，先视觉验证炉膛内位置。

---

## 4. 伙伴、远征与数据规则

### 八位伙伴（冻结）

| 成长线 | 情感位置 | 环境与视觉核心 |
| --- | --- | --- |
| 栗子：炉尾 → 栗鬃 → 炭尾 / 松影 / 月爪 | 被等待的归处 | 炉火、旧路、犬型低重心、栗色与旧铜铃 |
| 枝绒 → 苔亚 → 森冠 | 陌生之处慢慢熟悉 | 林缘与雨后苔石；修长狐型、苔绿叶纹 |
| 灯团 → 星烛 → 夜璃 | 夜里安静地同处 | 窗边 / 夜路；深靛猫型、暖金灯尾与星点 |
| 涟牙 → 漪爪 → 湾澜 | 沿途流过的时间值得记住 | 河湾浅滩；圆润水獭、水纹与扁尾 |
| 小石獾 → 岩甲獾 → 铠獾王 | 先把脚下站稳 | 石阶山脚；低重心獾型、岩层背毛和宽爪 |
| 暮羽子 → 咕夜枭 → 冥翔鹰鸮 | 未出口的念头也可留在夜色里 | 钟塔与夜间高处；宽圆鸮型、旧纸眼周、书页式展翼 |
| 小丘 → 云丘兔 → 风茸旅兔 | 远方很宽，慢一点也不会错过 | 晒暖丘陵；垂耳、短绒尾、云灰浅麦 |
| 小火牙 → 赤翼龙 → 余烬古龙 | 对辽阔未知保持敬意 | 边境群山；深铜灰褐鳞片、克制余烬亮点 |

### 伙伴美术合同

- 原始图：`assets/art/drafts/<species>-forms/`。
- 运行时资源：`assets/art/characters/companions/`。
- walk atlas 固定 4×4：front、back、left、right 四行，每行四帧；同时维护 32 与 48 版本。
- 缩放只能用 nearest-neighbor；统一脚底基线；背景清理仅移除与边缘连通的底色。
- 飞行伙伴（暮羽子系、小火牙后两阶段）应略悬空，不应按落地走路呈现。

### 出征与掉落

- 权威说明：`docs/systems/expedition/EXPEDITION_LOOT.md`；实现重点在 `electron/game.cjs`、`electron/database.cjs` 与 `src/types.ts`。
- 已知文档风险：旧 README / v0.7.0 文案曾写 11 件物品，`docs/systems/expedition/EXPEDITION_LOOT.md` 的逐项统计是 12 件。若用户未来要求改掉落，先以实际实现和该权威表复核，再统一文档；禁止猜测删除物品。
- 不要重写既有随机算法或存档语义。

### 数据与 AI

- Electron 主进程：`electron/main.cjs`；数据库与迁移：`electron/database.cjs`；AI：`electron/angel-ai.cjs`。
- 前端为 ESM，`electron/*.cjs` 为 CommonJS；新增 IPC 必须同步 main、preload、`src/types.ts` 与调用端。
- 数据库迁移使用 `PRAGMA table_info` + 幂等 `ALTER TABLE`，必须兼容旧存档。
- API Key 只能经 Electron `safeStorage` / Windows DPAPI 保存；不可进 SQLite、localStorage、日志或 Git。

---

## 5. 已暂停：小镇原型（不得擅自恢复）

用户因画面模糊、眩晕感和 AI 全景图不可控，明确决定**暂停小镇设计与开发**。

### 正式状态

- 当前正式流程不进入小镇：`CottagePage` 的 `expedition` 动作直接调用原有远征。
- 不要再生成小镇图、改小镇碰撞、改相机、接入 Godot，或把小镇重新连回小屋，除非用户明确重新授权。
- 不要删除本地小镇草稿；它们保留为以后复盘材料，但不是正式功能或可发布资产。

### 当前本地未提交的小镇草稿

下列路径是暂停的小镇原型材料，**未包含于 v0.8.0 提交 / Release**：

```text
assets/art/drafts/border-town-topology-*.png
assets/art/drafts/native-town/
assets/art/drafts/town-vertical-slice-*.png
assets/art/environments/town/
docs/TOWN_*.md
scripts/generate-native-town-slice-assets.ps1
src/components/PixiTownScene.tsx
src/lib/town-road-graph.ts
src/lib/town-scene.ts
src/lib/town-terrain.ts
```

还有两份未提交的小屋生图提示 / 布局材料：`docs/art/cottage/COTTAGE_512_IMAGE_PROMPTS.md`、`docs/art/cottage/COTTAGE_512_LAYOUT_SPEC.md`。它们不是运行时依赖，是否纳入未来文档提交须由用户决定。

若未来用户决定重启小镇，必须先做**合理性审查与对抗性评审**，再由用户批准路线。优先方案是原生模块化像素资产、固定网格与单屏垂直切片验证；不要把 GPT Image 全景图反复缩放后直接作为运行时地图。

---

## 6. 开发、验证与发布流程

在项目目录执行：

```powershell
cd 'D:\study learning'
npm run dev
npm test
npm run art:validate
npm run build
```

### Git / GitHub 环境事实

- Git 安装在：`C:\Program Files\Git\cmd\git.exe`，但当前 PowerShell 环境可能未将其加入 PATH。
- `gh` 已登录 `gxySkywalker`，具有 `repo` 权限；读取配置在受限沙箱可能被拒绝，需要经过用户授权的提升权限命令。
- 当前远端：`https://github.com/gxySkywalker/growth-arc.git`。
- 发布前应执行：`git status --short`、`git diff --check`、测试、资源校验、构建；有混合工作树时必须显式暂存，不得 `git add -A`。
- 只有用户明确要求时才提交、推送、创建 release 或上传安装包。

### Release 风格

Release 标题格式：`vX.Y.Z - 中文主题`。正文应沿用 v0.7.0 / v0.7.1 风格：

1. 一句世界观内的简短引言；
2. `---` 分隔；
3. 带 emoji 的玩家可感知分区；
4. 最后用“升级说明”写存档兼容与未发布边界；
5. 不把内部技术交接、过多构建细节或未完成原型写进开头。

---

## 7. 下一会话的安全起点

当前没有被授权的下一项代码任务。下一位 Codex 应：

1. 先完成第 0 节规定的阅读与状态复述；
2. 询问 / 等待用户给出具体新需求；
3. 如果用户仅询问、审查或报告状态，不写代码；
4. 若用户要求修改，先确认其不触碰冻结伙伴、邮局边界或暂停小镇；
5. 小改动后执行匹配的测试与构建，并只更新必要文档；
6. 除非用户要求发布，否则不要碰 GitHub、版本号、Release 或本地未提交的小镇草稿。

---

## 8. 本次交接时的工作树提醒

v0.8.0 已经提交并发布；第 5 节所列小镇 / 提示词草稿仍未跟踪、未提交。

下一会话在进行任何 Git 操作前，必须先检查 `git status --short`，向用户明确区分：

- 已发布的 v0.8.0；
- 当前需求产生的后续本地修改；
- 已暂停且不应误提交的小镇草稿。
