# 时间与信件系统设计文档

> 状态：已确认的首版技术设计
> 依赖：WORLD_BIBLE v0.3、VERTICAL_SLICE v0.1
> 更新日期：2026-07-20

## 1. 统计口径

### 1.1 只统计 completed session

天文台历史统计和信件事实只统计 `status = 'completed'` 的 session。

running / paused 仅作为当前进行中 overlay 展示，不进入日周历史统计、不进入信件事实。

### 1.2 远征类型拆分

复用 `domain.cjs` 的 `getReturnKind(activeSeconds)`：

```
brief:     0–59s
short:     60–299s
expedition: 300–1799s
deep:      ≥1800s
```

日/周统计返回 `sessionCounts: { brief, short, expedition, deep }`。

### 1.3 日聚合

字段：`totalActiveSeconds, sessionCounts, completedTaskCount, directionBreakdown, longestSessionSeconds`

### 1.4 周聚合

字段：`totalActiveSeconds, dailyActiveSeconds[7], sessionCounts, completedTaskCount, directionBreakdown, longestSessionSeconds, previousWeekTotal`

---

## 2. 信件生成

### 2.1 shouldGenerateDailyLetter

```js
function shouldGenerateDailyLetter(facts) {
  const { sessionCounts = {}, completedTaskCount = 0 } = facts
  const { brief = 0, short = 0, expedition = 0, deep = 0 } = sessionCounts

  if (short > 0 || expedition > 0 || deep > 0) return true

  const hasWrittenReview = typeof facts.hasWrittenReview === 'boolean'
    ? facts.hasWrittenReview : false
  const hasOutcome = facts.hasOutcome === true
  const hasWorldEvent = facts.hasWorldEvent === true
  const hasSpecialEvent = facts.hasSpecialEvent === true

  const hasMeaningfulRecord =
    completedTaskCount > 0 || hasWrittenReview || hasOutcome ||
    hasWorldEvent || hasSpecialEvent

  if (hasMeaningfulRecord) return true
  return false
}
```

### 2.2 shouldGenerateWeeklyLetter

```js
function shouldGenerateWeeklyLetter(facts) {
  const { sessionCounts = {}, completedTaskCount = 0 } = facts
  const { short = 0, expedition = 0, deep = 0 } = sessionCounts

  if (short > 0 || expedition > 0 || deep > 0) return true

  const hasMeaningfulRecord =
    completedTaskCount > 0 || facts.hasWrittenReview === true ||
    facts.hasOutcome === true || facts.hasWorldEvent === true

  if (hasMeaningfulRecord) return true
  return false
}
```

### 2.3 空白日策略

- 无内容 brief 不生成每日信，由周信统计覆盖
- 整周只有空 brief 不生成周信
- 真实时长始终计入天文台

---

## 3. 周期与时区

### 3.1 period_start/end

本地周期边界换算为 UTC milliseconds 存储。

### 3.2 timezone

- `timezone_offset_minutes`：生成时本地 UTC offset
- `timezone_name`：生成时 IANA 时区名（`Intl.DateTimeFormat().resolvedOptions().timeZone`）
- 历史信件不因后续系统时区变更而改变
- period_key 在生成时固定

### 3.3 period_key

- 日：`YYYY-MM-DD`
- 周：`YYYY-MM-DD`（周一日期）

### 3.4 跨日检测

启动时检查 `localDateKey()` 是否变化。每 60 秒定时检查。

### 3.5 时区变更保护

已生成的信件不做任何修改。新信件使用新时区。

---

## 4. 信件数据模型

### 4.1 letters 表 DDL

```sql
CREATE TABLE letters (
  id TEXT PRIMARY KEY,
  letter_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  timezone_offset_minutes INTEGER NOT NULL,
  timezone_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  fact_json TEXT NOT NULL,
  template_body TEXT NOT NULL,
  ai_body TEXT,
  body_source TEXT NOT NULL DEFAULT 'template',
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,
  reply_text TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  generation_version INTEGER NOT NULL DEFAULT 1,
  ai_status TEXT,
  UNIQUE(letter_type, period_key)
);
```

### 4.2 DailyLetterFacts schema

```json
{
  "schemaVersion": 1,
  "periodType": "daily",
  "periodStart": 1752595200000,
  "periodEnd": 1752681600000,
  "timezoneName": "Asia/Shanghai",
  "timezoneOffsetMinutes": 480,
  "totalActiveSeconds": 5400,
  "sessionCounts": { "brief": 0, "short": 1, "expedition": 1, "deep": 0 },
  "completedTasks": [{"id":"uuid-1","title":"看热爱1"}],
  "directionBreakdown": [{"name":"通用学习","seconds":5400}],
  "longestSessionSeconds": 3600,
  "hasOutcome": true,
  "hasWrittenReview": false
}
```

### 4.3 WeeklyLetterFacts schema

```json
{
  "schemaVersion": 1,
  "periodType": "weekly",
  "periodStart": 1752595200000,
  "periodEnd": 1753200000000,
  "timezoneName": "Asia/Shanghai",
  "timezoneOffsetMinutes": 480,
  "totalActiveSeconds": 23400,
  "dailyActiveSeconds": [0,5400,0,7200,3600,0,7200],
  "sessionCounts": {"brief":1,"short":0,"expedition":3,"deep":1},
  "completedTasks": [
    {"id":"uuid-1","title":"看热爱1"},
    {"id":"uuid-3","title":"数据库复习"}
  ],
  "directionBreakdown": [
    {"name":"通用学习","seconds":16200},
    {"name":"编程","seconds":7200}
  ],
  "longestSessionSeconds": 5400,
  "previousPeriodTotalSeconds": 18000
}
```

### 4.4 事实冻结规则

事实层生成时快照。生成后不因任务改名、复盘编辑而更新。后续重命名和编辑不影响旧信。

---

## 5. 本地模板

### 5.1 每日信模板

60–140 字。包含日期、总时长、主要方向、温和收尾。Deterministic seed = hash(letter.id)。

### 5.2 每周信模板

120–240 字。包含周总长、柱状数据、主要方向、代表性路标、与上周中性比较。

### 5.3 subject 生成规则

由本地模板生成时决定并冻结。示例：正常日"今天留下的足迹"，短日"一段短短的归程"，有 review 无 session"记下的一句话"，周信"七月第三周的信"。

不使用"每日专注报告""周度数据总结""AI 日评""效率分析"。

### 5.4 deterministic seed

`hash(letter.id)` 选择模板变体。同封信重复打开不变化。

---

## 6. 补发与幂等

### 6.1 ensurePeriodicLetters

核心函数。在启动后、resume 后、跨日检测时、打开邮局时调用。检查缺失周期，满足生成条件则创建。每个周期最多一封。

### 6.2 mail_started_at / last_periodic_check_at

- `mail_started_at_ms`：首次运行新版时记录。不生成此时间前的信件
- `last_periodic_check_at_ms`：上次检查时间。启动时从此到 now 扫描

### 6.3 旧用户迁移

不补发启用前历史。不生成"昨天的欢迎日报"。正常离线后最多回溯 30 天。

---

## 7. AI 异步润色

### 7.1 授权设置

AI 默认关闭。用户明确开启 `angel_ai_enabled` 后，周期信可调用已配置模型。关闭后信件功能完整。

### 7.2 调用流程

信件先生成本地模板 → 立即可读。AI 在后台异步润色，成功后更新 ai_body + body_source。

### 7.3 body_source 状态机

| 场景 | is_read=0 | is_read=1 |
|------|:---:|:---:|
| 刚生成（本地模板） | body_source='template' | — |
| AI 完成，未读 | 切换为 'ai' | — |
| AI 完成，已读 | 保存 ai_body，不变 | 保持 'template' |
| 当前打开视图 | 不热切换 | 不热切换 |
| AI 失败 | 保持 'template'，ai_status='failed' | 同左 |

template_body 永久保留。首版不提供手动切换按钮。

### 7.4 fallback

AI 不可用时信件正常生成，ai_status = null。

---

## 8. 页面信息架构

### 8.1 天文台

日/周视图分离。日视图展示今日合计、session 列表、方向、观测札记。周视图展示周合计、7 日柱状图、与上周中性对比、代表性路标。

趋势文案使用中性自然语言（"比上周多记录了…""比上周少记录了…"），不使用红涨绿跌 KPI 语言。

### 8.2 天使邮局

两栏布局。左侧 180px 筛选（全部/未读）。右侧完整信纸：subject、周期、正文、少量事实、回信、星图跳转。

日/周通过信封样式、邮戳和日期范围区分。首版不设"周期信"分类。

### 8.3 小屋收信格

门旁墙面木制收信格 sprite。动态纸角 overlay。无未读仍可点击进入邮局。

---

## 9. 路由与迁移

### 9.1 PageId 扩展

新增 `'observatory'` 和 `'mail'`。

### 9.2 ReviewPage 废弃路径

抽取可复用逻辑 → 旧 review 映射到 observatory → 确认无引用后删除 ReviewPage。

---

## 10. 测试

### 10.1 单元

shouldGenerateDailyLetter / shouldGenerateWeeklyLetter 边界、completed-only 统计、sessionCounts 拆分。

### 10.2 集成

ensurePeriodicLetters 幂等、补发顺序、未读/已读状态转换、AI body_source 规则、时区一致性。

### 10.3 手动验收

天文台日/周切换、邮局已读/未读视觉、小屋纸角、1366×768/125%、AI 关闭/失败、跨日补发、Console 无错误。
