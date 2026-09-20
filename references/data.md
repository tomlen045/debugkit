# 数据结构与案卷 schema

## 目录布局

```
.debugkit/
├── project.json            # 项目身份（key / repoRoot / git 标志）— 见 D0
├── cases/
│   ├── <case-id>/          # 活案卷
│   │   ├── case.json       # 案卷主档（唯一事实源）
│   │   ├── report.md       # 排查叙事（时间线，人读的）
│   │   └── findings.md     # 排查笔记（结论、排除项、复用知识）
│   └── archive/            # 已结案卷归层（close 时移入）
└── knowledge.md            # 跨案卷沉淀：复用的根因模式、环境坑（可选）
```

## 不变量（D1-D5）—— doctor 检查、修复的唯一 spec

`scripts/dbg.mjs doctor`（只读）按此逐条检查，退出码 0=全绿 / 1=有差异；修复由编排层落笔。

| # | 不变量 | 违反时的修复动作 |
| --- | --- | --- |
| D0 | project.json 存在且 key 与当前仓库一致；不一致 → 环境变了，报告并询问 | 报告，不自动改 |
| D1 | case.json 的 evidence 表内 id 唯一且连续递增（E1,E2,…）；重号/跳号 = 手写污染 | 列差异交用户确认后重排 |
| D2 | 每个 hypothesis 必有 `status ∈ {open, confirmed, ruled_out}`；confirmed 必须挂证据 id；ruled_out 必须挂证据 id | 缺挂 → 列出，由用户补判 |
| D3 | status=closed 的案卷必有 rootcause 链（证据 id 串联）且 fix 里有实跑验证条目 | 缺 → 降回 verifying，报告 |
| D4 | reopened 案卷的 reopen_history 非空且每次 entry 带原因 | 缺 → 列出，由用户补记 |
| D5 | 案卷目录与 case.json 一一对应（有目录无 json = 手动误建，有 json 无目录 = 损坏） | 空目录删除 / 损坏列名大声报 |

## case.json（唯一事实源）

```json
{
  "id": "login-500-20260920",
  "title": "登录接口偶发 500",
  "symptom": "POST /api/login 约5%概率返回500，日志见 NullPointerException",
  "status": "open",
  "severity": "high",
  "createdAt": "2026-09-20T10:00:00+08:00",
  "lastActiveAt": "2026-09-20T14:30:00+08:00",
  "repro": {
    "cmd": "bash scripts/repro-login.sh",
    "note": "5次里1次500",
    "lastRunAt": "2026-09-20T14:00:00+08:00",
    "lastOutputDigest": "HTTP 500, NPE at AuthFilter.java:88"
  },
  "evidence": [
    {
      "id": "E1",
      "ts": "2026-09-20T10:05:00+08:00",
      "kind": "log",
      "cmd": "grep -c 'NullPointerException' logs/app.log",
      "output": "47",
      "digest": "NPE集中出现，全部来自AuthFilter",
      "superseded": false
    }
  ],
  "hypotheses": [
    {
      "id": "H1",
      "text": "并发下 sessionMap 被并发修改导致 NPE",
      "status": "confirmed",
      "evidence": "E3",
      "createdAt": "2026-09-20T11:00:00+08:00"
    },
    {
      "id": "H2",
      "text": "数据库连接池耗尽",
      "status": "ruled_out",
      "evidence": "E2",
      "createdAt": "2026-09-20T10:40:00+08:00"
    }
  ],
  "fix": {
    "approach": "sessionMap 换 ConcurrentHashMap",
    "changedFiles": ["src/auth/AuthFilter.java"],
    "verify": {
      "cmd": "bash scripts/repro-login.sh",
      "output": "20/20 全部200",
      "ts": "2026-09-20T14:20:00+08:00",
      "userConfirmed": false
    }
  },
  "rootcause": {
    "chain": "E1 → H2(ruled_out) → H1(confirmed) → fix.verify",
    "oneLiner": "AuthFilter 里的 HashMap 在并发登录时被并发修改，偶发 NPE 变成 500"
  },
  "reopenHistory": []
}
```

status 取值：`open` / `verifying` / `closed` / `reopened`。

- `open` = 立案未结；`verifying` = 修复已做、实跑已过、**等用户实测确认**
- `closed` = 用户确认好了 + 根因链完整 + 归档进 `cases/archive/`
- `reopened` = closed/verifying 后症状复现；`reopenHistory[]` 每次一条 `{ts, from, reason}`；复发 ≥2 时强制先写 regression-postmortem 再动代码

## 字段规则

- `evidence[].kind` ∈ `log / cmd / diff / doc`；`output` 存关键输出（长输出存文件路径）；`superseded: true` 的证据保留不删，仅作废
- `hypotheses[].status` 三态**只进不退**：open → confirmed / ruled_out；改判 = 新增证据 + 改状态 + 旧证据保留
- `fix.verify` 只有一条槽位——再次修复覆盖旧条目，旧条目挪进 `reopenHistory` 最后一条的 `staleFix` 字段
- `reopenHistory[].reason` 必填，自由文本但必须回答"为什么当时以为好了"
- 复发率统计口径：`reopenHistory.length ≥ 1` 的 closed 案卷数 / closed 总数（`dbg.mjs stats` 输出，judgment 归模型）
