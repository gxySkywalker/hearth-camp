# 成长轨迹（Growth Arc）项目交接文档 v0.7.0

> 更新日期：2026-07-26
> 面向下一次 Codex 会话。当前任务在此处暂停；本交接仅记录状态，**没有待提交的代码改动**。

---

## 0. 新会话必须先做什么

在改代码、改文案、改美术或安装任何新工具之前，按顺序完整阅读：

1. `docs/WORLD_BIBLE.md` —— 世界观、主题与玩家体验。
2. `docs/COMPANION_PRODUCTION_RULES.md` —— 伙伴不是工具、命名/三阶段/美术规则。
3. `docs/COMPANION_SPRITE_ATLAS_SPEC.md` —— 图集尺寸、方向、基线与裁切合同。
4. 八份伙伴档案：
   - `docs/COMPANION_MOSS_SPROUT_PROFILE.md`
   - `docs/COMPANION_NIGHTLIGHT_CAT_PROFILE.md`
   - `docs/COMPANION_RIVER_OTTER_PROFILE.md`
   - `docs/COMPANION_IRON_BADGER_PROFILE.md`
   - `docs/COMPANION_DUSK_OWL_PROFILE.md`
   - `docs/COMPANION_CLOUD_RABBIT_PROFILE.md`
   - `docs/COMPANION_EMBER_DRAKE_PROFILE.md`
   - 栗子设定以 `docs/WORLD_BIBLE.md`、`electron/game.cjs` 与既有资源为准。
5. `docs/EXPEDITION_LOOT.md` —— 当前掉落和相遇数值的唯一说明。
6. 邮局相关：`docs/TIME_AND_MAIL_SYSTEM.md`、`docs/mail-system-v0.7.md`、`docs/ANGEL_POST_OFFICE_PROPOSAL.md`。
7. 本文档与根目录 `README.md`、`CHANGELOG.md`。

禁止跳过世界观与伙伴规则后直接“优化”数值、改名、重构伙伴，或以效率工具的思路改写玩家可见内容。

---

## 1. 项目定位与不可违反原则

**成长轨迹**是本地优先、单人游玩的像素生活 RPG / 旅途记录游戏。Electron 只是技术载体；玩家应该感到自己住在温暖的中世纪边境世界中，出发、归来，并被世界和同行者记住。

核心循环：

```text
炉火小屋（家） → 小镇与道路 → 出征探索 → 伙伴同行与世界发现 → 回到小屋 → 邮局与冒险日志保存经历
```

设计红线：

- 玩家是旅人，不是被管理或被考核的人。
- 世界不是仪表盘；离开没有惩罚，归来应被温柔接住。
- 伙伴是共同生活、共同经历的朋友，不是装备、战斗单位、效率加成、资源机器或每日打卡对象。
- 伙伴可以影响互动文本、共同记忆、环境观察和小屋存在感；不能承担掉率、经验、速度、战斗或自动化收益。
- 邮局将真实事实整理成信；不得虚构玩家未发生的经历、地点或 NPC。
- 玩家可见文案使用旅途词汇（出征、归程、足迹、星轨、路标等），避免“效率、统计、专注、KPI”等产品语言。

---

## 2. 当前版本与已完成内容

### 版本

- 当前发布版本：**v0.7.0 — 旅途生态与星图修复**（2026-07-24）。
- `package.json`：`0.7.0`。
- 已发布 Release：`v0.7.0`。
- 本次交接没有升级版本、修改发布物或提交代码。

### 已完成系统

- Electron + React 19 + TypeScript + Vite + PixiJS；`sql.js` 本地 SQLite，数据不上传。
- 炉火小屋：角色移动、碰撞、家具热点、壁炉、同行伙伴与 PixiJS 小屋表现。
- 出征：正计时、暂停/休眠恢复、多路标结算、返程结果、冒险日志与知识遗物。
- 伙伴营地：同行图鉴、个体性格/习惯/小毛病、共同记忆、改名和三阶段成长。
- 天使邮局：欢迎/每日/每周/归灯节/生日信；DeepSeek 与 OpenAI 的 Key 使用 Windows DPAPI 保存。配置测试、每日与每周 AI 润色共用请求链路。
- 天文台：日/周视图、24 小时星图、热力图与柱图；已修复异步数据到达和标签切换导致的偶发空白。
- 出征物品：普通、罕见、稀有、珍稀四级；背包使用的像素确认窗口和悬浮说明已统一。
- 美术：八位伙伴均有三阶段营地肖像、四方向运行时图集和 PixiJS 阶段尺寸表现。

### 已完成伙伴（八位）

| 成长线 | 情感位置 | 环境与视觉核心 |
| --- | --- | --- |
| 栗子：炉尾 → 栗鬃 → 炭尾 / 松影 / 月爪 | 被等待的归处 | 炉火、旧路、犬型低重心、栗色与旧铜铃 |
| 枝绒 → 苔亚 → 森冠 | 陌生之处慢慢熟悉 | 林缘与雨后苔石；修长狐型、苔绿叶纹 |
| 灯团 → 星烛 → 夜璃 | 夜里安静地同处 | 窗边/夜路；深靛猫型、暖金灯尾与星点 |
| 涟牙 → 漪爪 → 湾澜 | 沿途流过的时间值得记住 | 河湾浅滩；圆润水獭、水纹与扁尾 |
| 小石獾 → 岩甲獾 → 铠獾王 | 先把脚下站稳 | 石阶山脚；低重心獾型、岩层背毛和宽爪 |
| 暮羽子 → 咕夜枭 → 冥翔鹰鸮 | 未出口的念头也可留在夜色里 | 钟塔与夜间高处；宽圆鸮型、旧纸眼周、书页式展翼 |
| 小丘 → 云丘兔 → 风茸旅兔 | 远方很宽，慢一点也不会错过 | 晒暖丘陵；垂耳、短绒尾、云灰浅麦；成长后在小屋中视觉尺寸更大 |
| 小火牙 → 赤翼龙 → 余烬古龙 | 对辽阔未知保持敬意 | 边境群山；深铜灰褐鳞片、克制余烬亮点；后两阶段飞行 |

这些伙伴的情感、环境、身体符号和动作语言已经刻意错开，当前没有应被合并或重命名的重复设计。除非用户明确授权，不得修改其名字、成长线、生态位、核心情感或已冻结美术方向。

---

## 3. 出征掉落与相遇：当前真正规则

权威详细表见 `docs/EXPEDITION_LOOT.md`。摘要：

- 正式远征从 5 分钟开始结算；5–44/45–89/90+ 分钟固定普通物品为 1/2/3 件。
- 按 `docs/EXPEDITION_LOOT.md` 逐项计数为 **12 件**：4 普通、2 罕见、4 稀有、2 珍稀。`README.md` 与 v0.7.0 更新日志仍写“11 件”，这是文档口径冲突；下次涉及掉落前应以 `electron/game.cjs` 实际表为准并统一文档，不能自行猜测删除哪件物品。
- 可立即生效：莓果旅行面包（当前同行伙伴羁绊 +1）、河岸圆石（涟牙系 +3）、风丘羽毛（暮羽子系 +3）、古龙鳞片（小火牙系 +3）、月银罗盘、星辉玻璃、旅者银铃。
- 收藏/未来内容不可误消耗：铜币、地图碎片、药草束、蜜色琥珀碎片、古塔残页。
- 银铃**使用时立即从背包消失**，后台增加新伙伴总相遇概率 +10 个百分点；直至真实遇见一位新伙伴才清除状态，不是在相遇后才消耗银铃。
- 基础总相遇概率依时长为 0.01% / 0.1% / 0.5% / 1% / 3% / 5%；连续 5 次未相遇后每次额外 +1 个百分点；无必定相遇；总上限 50%；相遇成功后恢复基础概率。尚未遇见的伙伴在本次可遇见对象中等权抽取。

改动掉落或相遇逻辑前，必须同时检查 `electron/game.cjs`、`electron/database.cjs`、`src/types.ts`、物品展示/使用 UI、测试及 `docs/EXPEDITION_LOOT.md`，防止“文档已写、游戏未生效”。

---

## 4. 技术架构与关键入口

```text
electron/main.cjs      Electron 窗口、IPC、AI 请求
electron/preload.cjs   contextBridge：window.growthArc
electron/database.cjs  SQLite、迁移、持久化、邮局和物品状态
electron/game.cjs      伙伴定义、掉落与相遇随机逻辑
src/                   React 页面、组件、PixiJS
assets/art/            源图草稿、运行时图集、manifest
scripts/               精灵裁切/生成与资源验证
docs/                  世界观、规则、系统和交接文档
```

特别重要：

- 前端为 ESM；`electron/*.cjs` 为 CommonJS。不要混用模块方式。
- `src/types.ts` 是 preload API 的类型合同。增加 IPC 时必须同步改 main、preload、types 和调用点。
- 数据库没有传统迁移编号，使用 `PRAGMA table_info` + 幂等 `ALTER TABLE`。任何存档结构变动必须兼容旧库。
- API Key 只能使用 Electron `safeStorage` / Windows DPAPI，不能进 SQLite、localStorage、日志或 Git。
- 掉落 RNG 需要保持确定性与既有存档兼容；不要随意替换算法。
- React hooks 必须在所有 early return 之前，改动后要实际打开 Electron 页面做烟雾测试。
- 图表处理异步请求时要取消/忽略过期请求，并在 DOM 容器已挂载且尺寸有效后初始化图表。

### 伙伴美术合同

- 原始图必须保留在 `assets/art/drafts/<species>-forms/`。
- 运行时资源在 `assets/art/characters/companions/`，每阶段营地肖像加 `walk_32` 与 `walk_48`。
- 运行时 sheet 固定 4×4：front、back、left、right 四行，每行四帧。
- 处理脚本：`scripts/prepare-cloud-rabbit-forms.mjs`、`scripts/prepare-ember-drake-forms.mjs`，以及同类既有脚本；资源清单：`assets/art/manifest.json`；校验：`scripts/validate-art-assets.mjs`。
- 清背景时只能移除与边缘连通的底色；缩放使用 nearest-neighbor；统一脚底基线、避免模糊与自由拉伸。
- 飞行伙伴（暮羽子系、小火牙后两阶段）在 PixiJS 中应略悬空，不能画成落地走路。

---

## 5. 运行、验证与发布

必须在项目目录执行命令：

```powershell
cd 'D:\study learning'
npm run dev
```

验证基线：

```powershell
npm test
npm run art:validate
npm run build
```

当前更新日志记录 v0.7.0 时为 231 项自动化测试、美术资源校验和生产构建通过。Vite 主 chunk 体积警告目前只是构建性能提示，不阻塞运行或打包；除非用户要求性能专项，不要为了消除警告而冒险大规模拆包。

发布 Windows 安装包：`npm run dist`。发布前检查 `README.md`、`CHANGELOG.md`、版本号与 GitHub Release 标题/正文一致。Git 状态必须由下一会话在可用 Git 环境确认；本会话的终端没有可用 `git` 命令，故**不能断言工作树是否干净**。

---

## 6. 已知风险与待办优先级

### 当前不应继续的事项

- 不重构已完成八位伙伴，不重新命名，不改变羁绊成长阈值或生态位。
- 不自行扩展交易、地图解锁、疾病、药汤、火炉合成、NPC 送礼：它们目前是明确保留的未来内容。
- 不擅自改天使邮局的生命周期、AI 调用链或世界状态边界。
- 不把 Vite chunk 警告当作功能错误处理。

### 需要先确认再做的事项

1. **Sprite Forge 评估后的试点（未安装、未接入）**：
   - 已调研仓库，实际地址为 `https://github.com/0x0funky/agent-sprite-forge`（owner 首字符为数字 `0`）。
   - 结论：可作为“生成 → 去背景/对齐 → 拆帧”的辅助生产工具，**不能无缝替代**本项目的伙伴设计、三阶段一致性、营地肖像和 4×4 图集合同。
   - 如用户明确同意安装，先用一个非生产试点生成单个 idle/walk sheet；然后通过项目适配脚本输出固定 4×4、32/48 atlas、manifest，并运行视觉 QA 与资源校验。不要直接覆盖现有正式资源。
   - 它需要额外的 Python/Pillow/numpy 环境和本地 skill 安装，属于环境变更，必须先征得用户同意。
2. 若继续修复远征归来弹窗，先阅读根目录 `HANDOFF_EXPEDITION_REGRESSION.md`。该文件记录过一次“结算后弹窗未出现”的排查上下文；更新日志称该问题曾修复，需先复现确认，不能仅凭旧交接文件再次改动。
3. 每次 UI 改动都要检查：无浏览器原生 `confirm/prompt/alert`、背包物品有统一 tooltip/确认弹窗、伙伴阶段名与物种名不会重复。

---

## 7. 建议下一步

下一次会话应先由用户选择方向；默认建议是**先不改生产资产**，把 Sprite Forge 做成隔离试验，确认输出是否能稳定满足本项目的像素清晰度、方向顺序、基线和角色一致性，再决定是否纳入流程。

任何新功能都遵循：先读规则 → 说明实施范围 → 小改动 → 自动测试 → Electron 实机烟雾测试 → 更新对应文档。不得因上下文不足而猜测或批量重构。
