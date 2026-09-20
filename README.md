# debugkit

简体中文 | [English](README_EN.md)

调试现场的取证与结案纪律——为**任何能读文件并执行 shell 命令的编码代理**设计（OpenCode、Claude Code、Codex、Cursor、Hermes 等支持 SKILL.md 规范的框架均可）。自动识别意图，无需指定动作词。

## 解决什么问题

* AI 修 bug 爱瞎改 → **跑在报案前**：没跑过最小复现，不许给结论、不许改代码
* "修好了"全凭感觉 → **结论必带证据**：每条根因和修复宣告都挂实跑输出（证据 id E1,E2,…）
* 三个 bug 一个案卷，修 A 碰坏 B → **一异常一卷宗**：症状变化强制另立新案
* 同一个 bug 三次复发 → **复发特别程序**：先写复盘（根因错/被回退/条件漏了三选一），查清前冻结修复
* 排查结论随会话蒸发 → **案卷跨会话留存**：证据、假设排除项、根因链全部落盘 `.debugkit/`

## 快速使用

| 你说 | 它做 |
| --- | --- |
| "这个接口偶发 500" | 立案：查重 → 占号建档 → 采集首条证据 → 当场跑一次复现 |
| （贴报错日志） | 取证：证据入库 → 更新假设表 → 报一句"支持/排除谁" |
| "我觉得是数据库的问题" | 假设入表（需你确认）→ 设计取证命令验证它 |
| "修好了" | 结案验证：无实跑证据 → 拒绝记录，先跑复现脚本 |
| 你实测："好了" | 结案：写根因链 + 结案报告 → 归档 |
| 你实测："没好" | 修复宣告作废，错误结论也是证据，回取证 |
| "老毛病又犯了" | 复发：重开旧案 → 复发计数+1 → **先查为何复发，禁止直接再补丁** |

## 设计要点

* **证据只追加不修改**——写错的证据标记 superseded 保留原条目；伪造/脑补证据 = 立即停止
* **假设三态只进不退**——open → confirmed / ruled_out，改判必须挂新证据 id
* **排除项是案卷最值钱的部分**——"不是数据库"（E2）帮下个人省两小时
* **facts 归脚本，judgment 归模型**——`dbg.mjs` 全部只读（唯一写入口 nextid --reserve 占号），修复动作由编排层落笔，绕不开确认门槛
* **案卷不进 git**——`.git/info/exclude` 硬保证，代码真相在 git，调试叙事在 markdown
* **复发率是团队健康度指标**——`dbg.mjs stats` 出结案率/复发率/平均历时，复发常客自动排行

## 脚本

```
scripts/dbg.mjs — 单文件零依赖（node ≥18，拷贝即用）
  ls                    案卷盘点（在办在前，verifying 标"等你确认"，损坏大声报）
  doctor [case-id]      按 D0-D5 体检，退出码 0=全绿 / 1=有差异
  stats                 结案数 / 复发率 / 平均历时 / 复发常客
  scout <关键词>        跨案卷检索（含归档），复发关联靠它
  nextid [--reserve] <slug>   占号（默认只读；--reserve 建档写壳）
```

不变量 D0-D5 的唯一定义在 `references/data.md`（脚本只实现 spec，不得私改语义）。自测：`node scripts/dbg.test.mjs`（18 项，覆盖全部不变量正反例 + 复发链路集成）。

## 结构

```
debugkit/
├── SKILL.md            # 路由器：意图识别 + 动作路由 + 硬规则
├── scripts/
│   ├── dbg.mjs         # 唯一 CLI：ls / doctor / stats / scout / nextid
│   └── dbg.test.mjs    # 自测（18 项，全绿退出码 0）
├── references/         # 按动作按需加载
│   ├── data.md         # 案卷 schema + 不变量 D0-D5 唯一定义
│   ├── open.md         # 立案（查重/占号/首证据/分级）
│   ├── evidence.md     # 取证管道 + 假设纪律 + 三板斧优先级
│   ├── fix.md          # 修复前置检查 + 复发特别程序
│   └── close.md        # 结案门槛 + 复发处理 + status 口径
└── templates/          # case-report / findings / session-log / regression-postmortem
```

## 兼容性

* OpenCode（`~/.config/opencode/skills`）、Claude Code（`~/.claude/skills`）扫描式技能目录 symlink 即装
* Codex、Cursor 等：`npx skills add <repo>`
* 无技能机制的框架：把 SKILL.md 路径告诉 agent 即可

## 版本

见 [CHANGELOG.md](CHANGELOG.md)（版本号唯一事实源，README 不复写）。
