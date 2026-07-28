# 天使邮局静态原型

> 状态：静态原型，已验证布局与交互。最终 PNG 资产尚未生成。
> 日期：2026-07-20

---

## 实际审计

| 指标 | 值 |
|------|-----|
| 侧栏宽度 | 232px |
| 内容区最大宽度 | min(1120px, calc(100% - 58px)) |
| 邮局页面宽度 | 1120px |
| 1366×768 available | ~1134px × ~660px (减去 page padding 38px + 导航) |
| Windows 125% | 1093×614 logical, 布局自适应 |
| 主字体 | Fusion Pixel SC (标题/正文) |
| 像素缩放 | 2× nearest-neighbor(PNG→CSS background-size) |

## 新增/修改文件

| 文件 | 用途 |
|------|------|
| `src/pages/PostOfficePage.tsx` | 邮局页面(含 Header/Cubby/Letter 三区) |
| `src/lib/mailMock.ts` | 静态 mock 数据(14封样例信) |
| `src/App.tsx` | 新增 mail 导航 + 路由 |
| `src/types.ts` | PageId 新增 'mail' |
| `src/world.css` | +45 行 邮局专用 CSS |

## 页面结构

```
PostOfficePage
├─ mail-header (148px, 暖木建筑背景 + 窗口 + 暖灯 + 邮袋 + 小天使占位)
│  ├─ 标题: 天使邮局
│  ├─ 四季文案
│  └─ 未读/无未读提示
├─ mail-workspace (grid: 274px + 1fr)
│  ├─ mail-cubby (左栏)
│  │  ├─ 分类 tabs (新到/每日/每周/节庆/纪念/远方/所有)
│  │  └─ 信封列表 (56px 行高, 蜡封+日期+标题+发信人)
│  └─ mail-letter-panel (右栏)
│     └─ mail-letter-paper (奶油纸底, 660px 最大宽)
│        ├─ 元信息(分类+日期)
│        ├─ 发信人+标题
│        ├─ 正文
│        ├─ 事实附页(窄条)
│        ├─ 蜡封+邮戳
│        ├─ 回信输入
│        └─ 查看本期星图→
└─ empty states (空分类/无选中信)
```

## Mock 数据

14 封样例信覆盖 6 个分类。信类型：daily 5封、weekly 3封、festival 2封(归灯节)、memorial 1封(生日)、world 1封(居民艾达)、new 2封(最新未读)。

## 实现的静态交互

- 分类切换(过滤)
- 信封选择(selected)
- 首次打开未读信→mark read(蜡封 broken)
- 回信输入(本地 session state)
- 回信保存提示("已收好")
- 左栏独立滚动
- 右栏独立滚动
- 查看星图→跳转天文台
- 空状态显示
- 键盘 focus-visible

## Asset Pack 01 最终规格

| # | 资产 | Logical | Actual(2×) | 透明 | 帧 | 优先级 |
|---|------|---------|-----------|:---:|:--:|:---:|
| 1 | 邮局头部背景 | 512×112 | 1024×224 | ❌ | 1 | P0 |
| 2 | 木格信匣 | 128×176 | 256×352 | ✅ | 1 | P1 |
| 3 | 基础信封 atlas | 256×64 | 512×128 | ✅ | 4 | P0 |
| 4 | 奶油信纸框 | 320×480 | 640×960 | ❌ | 1 | P1 |
| 5 | 小天使 idle | 192×48 | 384×96 | ✅ | 4 | P0 |
| 6 | 蜡封+邮戳 atlas | 96×48 | 192×96 | ✅ | 4 | P1 |

P0 = 必须首轮生成。P1 = 可延后。

目录：`assets/art/environments/post_office/`

## 响应式与缩放结果

- 1366×768 100%: ✅ 左右布局正常，头部不遮挡
- 125%: ✅ 自适应，无横向溢出
- < 900px: 回退单列(左栏 max-height 200px)
- reduced-motion: ✅ 无动画依赖

## 已知问题

1. 占位 sprite 使用纯色块(未生成正式 PNG)
2. 窗口/暖灯/邮袋使用 CSS 色块(待替换)
3. 蜡封使用 CSS border-radius 圆圈(待替换为像素蜡封 PNG)
4. 邮戳使用空色块
5. 小天使未实现 sprite 动画

## 测试结果

- `npm test`: 125/125 ✅
- `npx tsc --noEmit`: ✅
- `npm run build`: ✅

## 下一阶段

1. 生成 Asset Pack 01 PNG
2. 替换 CSS 占位为真实 pixel art
3. 接入 mail:* IPC(替换 mock 数据)
4. 实现真实未读状态(IPC getUnreadCount)
5. 实现回信持久化(IPC saveReply)
6. 实现 ensurePeriodic 触发
7. 小天使 CSS sprite 动画

## 确认

- ✅ 未修改数据库
- ✅ 未创建 migration
- ✅ 未修改 IPC
- ✅ 未实现生日/节庆
- ✅ 未修改正史
- ✅ 当前为静态原型
