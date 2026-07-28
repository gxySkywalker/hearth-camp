# 天使邮局 v0.7 — 模块冻结文档

> 冻结日期: 2026-07-22
> 状态: STABLE — 修改前需明确原因

## 设计目标

天使邮局不是消息列表。它是"世界回应旅人的地方"。

- 每日星笺：玩家远征后自动生成，描述旅途的温暖短笺
- 旅途札记：每完整一周结束后生成，回顾一周足迹
- 节庆来信：归灯节(11/7-16)自动生成节日信
- 纪念来信：生日信(每年一次) + 欢迎信(首次进入)
- 友人来信：预留分类，NPC系统就绪后启用

## 数据流

```
App启动
  ├─ database.init() → migration → seed
  ├─ ensureWelcomeLetter()         ← 首次欢迎信(幂等)
  ├─ ensurePeriodicLetters(now)    ← daily + weekly 扫描
  ├─ ensureEventLetters(now)       ← 节庆节点检查
  ├─ ensureBirthdayLetter(now)     ← 生日检查
  └─ ensureAiNarratives()          ← AI叙事(后台异步)

PostOfficePage (只读)
  └─ mail:list → mail:get → LetterViewer
```

## 数据库表

### letters
| 列 | 类型 | 说明 |
|-----|------|------|
| id | TEXT PK | UUID |
| letter_type | TEXT | daily/weekly/festival/memorial/world |
| period_key | TEXT | 周期标识(UNIQUE with letter_type) |
| period_start/end | INTEGER | UTC毫秒时间戳 |
| subject | TEXT | 标题 |
| fact_json | TEXT | 事实层(不可变) |
| template_body | TEXT | 模板正文 |
| ai_body | TEXT | AI正文(可选) |
| body_source | TEXT | 'template'/'ai' |
| ai_status | TEXT | pending/success/failed/template/skipped |
| ai_retry_count | INTEGER | 重试次数(最多3次) |

### letter_events
| 列 | 类型 | 说明 |
|-----|------|------|
| id | TEXT PK | UUID |
| event_type | TEXT | festival/birthday/welcome |
| event_key | TEXT UNIQUE | returning_lights:2026:opening / birthday:2027 / welcome:first_visit |
| letter_id | TEXT FK | → letters(id) ON DELETE SET NULL |

### settings (邮件相关)
- `world_entered_at_ms` — 玩家首次进入世界的时间
- `last_daily_period_checked` — daily扫描游标
- `last_weekly_period_checked` — weekly扫描游标
- `schema_version` — 迁移版本号

## 生命周期

### Daily
- 触发: App启动 → ensurePeriodicLetters
- 扫描: worldEnteredAt → yesterday (不含今天)
- 条件: shouldGenerateDailyLetter (有效远征或复盘)
- 幂等: UNIQUE(letter_type, period_key)
- 标题: "7月20日的星页"

### Weekly
- 触发: 同上
- 周期: 周一00:00 ~ 周日23:59
- 条件: 完整周结束 + shouldGenerateWeeklyLetter
- 标题: "7月13日—7月19日 · 旅途札记"

### Festival (归灯节)
- 触发: ensureEventLetters
- 节点: 11/7 opening, 11/11 midway, 11/16 climax
- 过滤: year >= playerStartYear
- 幂等: letter_events.event_key UNIQUE

### Birthday
- 触发: ensureBirthdayLetter
- 条件: birthday >= worldEnteredAt AND birthday <= now
- event_key: birthday:{year}
- 幂等: letter_events.event_key UNIQUE

## AI调用流程

```
readApiKey() → secret.bin (DPAPI解密)
  → settings.ai_base_url || provider默认URL
  → fetch(url/chat/completions, { Authorization: Bearer ${key} })
  → 成功: ai_status='success', body_source='ai'
  → 失败: retry++ (最多3次), 降级template_body
```

- AI在createWindow之后异步运行，不阻塞启动
- 无Key用户：不调用AI，使用模板信
- 错误Key：静默降级，不影响使用

## 后续扩展方向

- NPC系统 → 友人来信分类
- 成就系统 → 纪念来信分类
- 冬季节庆 → FESTIVALS配置扩展
- AI prompt版本迭代 → ANGEL_PROMPT_VERSION递增
- 世界状态系统 → getWorldState()接口已就绪
