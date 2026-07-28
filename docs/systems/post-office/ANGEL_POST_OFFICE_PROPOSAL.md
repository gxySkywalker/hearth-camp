# 天使邮局设计提案

> 状态：讨论草案，尚未写入正史，不得直接实施。
> 依赖：CLAUDE.md、WORLD_BIBLE v0.3、VERTICAL_SLICE v0.1、TIME_AND_MAIL_SYSTEM v1
> 修订：2026-07-20

---

## 1. 当前代码能力审计

`letters` 表已存在。`mail:*` IPC 8 个 handler 已就绪。可复用 ensurePeriodicLetters 框架、已读/未读状态、回信、补发机制。待扩展：`letter_type` 值域（仅 daily/weekly）、无 `category`/`sender`、无 attachment、无节日日历、无用户生日表单、无世界事件引擎。

---

## 2. 长期信件 identity 模型

```sql
category TEXT NOT NULL,
subtype TEXT NOT NULL,
occurrence_key TEXT NOT NULL,
sender_key TEXT NOT NULL

UNIQUE(category, subtype, occurrence_key, sender_key)
```

示例：

| category | subtype | occurrence_key | sender_key |
|----------|---------|----------------|------------|
| periodic | daily | 2026-07-20 | angel |
| periodic | weekly | 2026-W30 | angel |
| memorial | birthday | birthday:2026 | town |
| festival | returning_lights_festival | returning_lights_festival:2026:opening | town |
| festival | returning_lights_festival | returning_lights_festival:2026:climax | town |
| world_letter | resident | event:uuid | ada |

---

## 3. 生日系统

月日必填，年份可选。可关闭祝福。修改生日不改变历史信。2月29日→3月1日。启用前历史生日不补。启用后错过补生成。永久保留，无时限。

---

## 4. 节庆补发规则

每个节庆拥有 `festival_started_at` 基线。只生成基线之后发生的节庆信。应用关闭时下次启动补生成，信件归属原节庆日期。同一 identity 幂等跳过。不补基线启用前的历史年份。节庆信永久保留，不因用户没有远征而取消。

---

## 5. 春节（迎岁节）

内置 2026-2040 年公历日期表。不使用网络，日期表临近截止时产生开发构建警告。每封信保存 `festivalRuleVersion` 和 `resolved_date`。

### 节期框架

- 节前准备期（除夕前 2 天）
- 春节当天主信（正月初一）
- 节后余韵（2 天）
- 总视觉周期约 5 天

### 命名

UI 显示「春节 · 迎岁节」。分类：节庆来信。

### 视觉

朱砂红、温暖金色、红绳、灯笼。不直接把城市春节装饰搬进中世纪小镇。

---

## 6. 圣诞节（冬星节）

### 节期框架

- 准备期（12 月 22 日–24 日）
- 冬星节主信（12 月 25 日）
- 冬星夜（12 月 25 日晚，节庆高潮）
- 节后余韵（12 月 26 日）

UI 显示「圣诞节 · 冬星节」。核心夜晚「冬星夜」。默认关闭，需用户主动开启。

视觉：松针绿、酒红、木制星星、温暖灯火、深色蜡封。

---

## 7. 归灯节

### 名称层级

归灯节：完整节庆周期（11月7日–15日）
归灯夜：归灯节最后一晚（11月15日），节庆高潮
余灯日：11月16日，保留少量节庆环境

### 日期（固定公历）

| 日期 | 阶段 |
|------|------|
| 11月4日–6日 | preparation（准备期） |
| 11月7日–14日 | festival（节期） |
| 11月15日 | climax（归灯夜） |
| 11月16日 | afterglow（余灯日） |
| 11月17日 | 恢复普通环境 |

固定日期便于记忆、完全离线、容易测试、不依赖星期排列。归灯夜始终是11月15日。

### 信件生成

| 信件 | 日期 | 类型 | 生成规则 |
|------|------|------|---------|
| 归灯节开始信 | 11月7日 | festival | 一封，可补发，不依赖用户数据 |
| 归灯夜主信 | 11月15日 | festival | 一封，附带永久纪念附页 |
| 节期内 daily/weekly | 11月7日–15日 | periodic | 可选用轻量归灯节信封封边+提灯邮戳，category/subtype 不变 |

节期内最多两封专属节庆信。不每天生成。准备期和余灯期不生成新节庆主信。

### 地点头部文案

| 阶段 | 文案 |
|------|------|
| preparation | 归灯节将近了。小天使正在擦亮去年收起的提灯。 |
| festival | 归灯节 · 11月10日 · 节期第四日。镇上的灯正一盏接一盏亮起来。 |
| climax | 归灯夜 · 11月15日。今晚，每一扇窗都为仍在路上的人留着灯。 |
| afterglow | 归灯节后的清晨 · 11月16日。窗边还留着昨夜没有收起的灯。 |
| 普通 | 深秋 · 窗外的灯刚刚亮起 |

不显示现代倒计时、进度条、活动第N天。

### 数据

subtype: `returning_lights_festival`。phase: `preparation` | `festival` | `climax` | `afterglow` | `none`。

### 纯函数接口（候选）

```ts
getReturningLightsPhase(localDate: LocalCalendarDate): ReturningLightsPhase
getReturningLightsFestivalYear(localDate: LocalCalendarDate): number | null
getReturningLightsVisualTheme(phase: ReturningLightsPhase): ReturningLightsVisualTheme
getReturningLightsLetterEligibility(localDate: LocalCalendarDate, existingLetters: LetterIdentity[]): ReturningLightsLetterEligibility
```

输入明确，输出纯粹，不读数据库，不依赖AI，可单元测试。

### 节庆资产

基础邮局背景 + 阶段 overlay + 小天使 sprite + React UI。不每天生成整张背景。Overlay 透明，与基础背景严格对齐，相同 logical resolution。

### 小天使阶段动作

| 阶段 | 动作 | 帧数 |
|------|------|:---:|
| preparation | 擦灯 / 检查灯芯 | 4 |
| festival | 挂提灯 / 整理深蓝信封 | 6 |
| climax | 点亮主灯 / 递出主节庆信 | 6 |
| afterglow | 收拾信纸 / 看向窗边 | 4 |

### 硬规则

不得每天发节庆信、每天发礼物、显示活动剩余时间、设置签到、设置节庆任务、设置限定XP、设置错过惩罚。节庆持续存在但不持续索取注意力。

---

## 8. 原创节庆命名规范

- 完整周期称「节」
- 关键单日可称「夜」「日」「市集」「仪式」
- 世界名必须像居民真实会说的名称
- 不使用现代「活动季」「主题周」

候选修订：归灯节（高潮归灯夜）、路标节、长昼节（高潮长昼市集）、围炉节或初霜节。

---

## 9. 节庆日历

首次启用时显示设置：「选择你希望小镇一同庆祝的日子」。候选：春节·迎岁节、圣诞节·冬星节、小镇传统节庆、我的生日。每项可独立关闭，调整不改写历史信件。

---

## 10. 节庆礼物 MVP

特别信纸+信封+邮戳+蜡封+纪念附页。信件本身作为永久纪念物。禁止立即领取、过期、限时礼包、学习加成、XP奖励。

---

## 11. 邮局核心体验

"天文台让时间变得可见；天使邮局让时间留下记忆。" 邮局是独立侧栏页面，三层结构：地点头部→木格信匣→展开信纸。不是 Gmail、通知中心、奖励页。

---

## 12. MVP 范围

**必须**：每日/周信、信件列表+详情、已读/未读(纸角+蜡封)、一句回信、查看本期星图、永久保留、独立天使邮局页面。

**首批节庆**：用户生日、春节·迎岁节、归灯节、圣诞节·冬星节。首版视觉：节庆专用信纸+邮戳+蜡封+纪念附页+邮局季节装饰(根据 phase 自动组合)。

**暂缓**：AI润色、完整物品背包、居民信件链、世界事件来信、月度/年度完整页面、用户自定义节日。

---

## 13. 未决问题

category/subtype/occurrence_key/sender_key 最终字段名、migration 时机、2月29日策略(推荐3月1日)、春节日期表年份范围(2026-2040)、节庆日历首次设置时机、小天使是否常驻首屏、邮局背景静态vs分层、外部UI研究优先级、未来实体纪念物迁移方案。

---

## 14. 确认

本轮未修改任何代码、数据库、导航、正史。状态：讨论草案。
