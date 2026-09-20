# open（立案）

## 流程

1. **定位项目**（SKILL.md 第零步），确认 `.debugkit/` 就位（project.json 存在；不存在则先初始化：写 project.json + 补 `.git/info/exclude`）。
2. **查重**：跑 `dbg.mjs ls`，把 open/reopened 案卷的症状一句话列给自己看：
   - 症状高度相似（同接口/同文件/同报错指纹）→ 提示用户"像 <case-id> 的复发"，用户选：重开旧案 / 确认另立
   - 无相似 → 继续立案
3. **取 id**：`dbg.mjs nextid --reserve "<症状短slug>"` → 返回 `<slug>-<YYYYMMDD>` 格式 id 并登记（占号防并行会话撞号；脚本缺失则手工拼，确保目录不存在同名）。
4. **建档**：
   ```bash
   mkdir -p .debugkit/cases/<case-id>
   ```
   按 data.md schema 写 `case.json`（status=open，evidence/hypotheses/reopenHistory 为空数组，repro 先留空）+ 从 `templates/findings.md` 复制 findings.md。
5. **采集第一份证据（立案必做，不许空案过夜）**：
   - 请用户贴报错原文/截图文字/日志片段，原样存入 `evidence[]`（kind=log，digest 一句话概括）
   - 能复现的：和用户一起确定最小复现命令，写进 `repro`，并**当场跑一次**把输出存为 E1
   - 不能复现的（偶发/只在线上）：`repro.note` 写明"待复现"，第一条证据改为日志/监控截图
6. **分级**（与用户一句话确认，拿不准默认 medium）：
   - `high` = 线上在炸 / 阻塞主流程 / 有数据损坏风险 → 后续动作全部优先
   - `medium` = 有绕行方案但难受
   - `low` = 边缘毛病（错别字/样式抖动）
7. **输出立案回执**：`已立案 <case-id>：〈症状一句话〉（<severity>）— 证据 E1 已入库`。

## 禁止事项

- 立案时**禁止**顺手开始修——先立案、先取证、再谈假设（铁律 1：跑在报案前）
- 禁止凭用户描述直接写 hypothesis 进 case.json——描述进 report.md 时间线，假设要等证据
- 症状描述含糊（"就是不对劲"）→ 先问三个问题：报错原文？什么时候开始？改动过什么？答案全进 E1
