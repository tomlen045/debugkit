# close（结案与复发）

## 结案门槛（全绿才许 close）

1. `fix.verify` 有实跑输出（cmd + output + ts）——"应该好了"不算（硬规则 8）
2. **用户实测确认**（对话中明确说了"好了/正常了/解决了"）→ `fix.verify.userConfirmed = true`
3. 根因链完整：`rootcause.chain` 从首证据到验证用证据 id 串起来；`oneLiner` 一句话能讲给同事听
4. 跑 `dbg.mjs doctor <case-id>` 退出码 0（D1-D5 全绿）

## 结案动作（顺序执行）

1. 写 `report.md` 结案报告（按 `templates/case-report.md`）：症状 / 根因链（证据 id）/ 修复 / 验证输出 / 排除项清单 / 耗时
2. findings.md 里值得跨案复用的（环境坑、根因模式、好用的取证命令）→ 摘进 `.debugkit/knowledge.md`
3. `cases/<case-id>/` 移入 `cases/archive/`
4. case.json：status=closed、rootcause 补全、lastActiveAt 刷新
5. 输出结案回执：`结案 <case-id>（历时 <N>）：〈根因一句话〉｜复发 <n> 次｜归档完毕`

## 复发（reopen）

触发：closed/verifying 案卷的症状再次出现（用户口述"又坏了/老毛病"，或新报异常与旧案症状指纹匹配）。

1. 从 archive/ 找回案卷（`dbg.mjs scout <症状关键词>` 检索症状/digest/oneLiner）
2. `reopenHistory[]` 追加 `{ts, from: closed|verifying, reason}`；status → reopened；移回活层
3. **冻结修复动作，先过复发特别程序**（见 fix.md）：根因错了？修复被回退了？条件漏了？——查清前禁止改代码
4. 修复路线按 fix.md 复发特别程序走；postmortem 未写完之前，每次用户催"赶紧修"都先复述"为什么复发"的排查进度

## status 口径

- `dbg.mjs ls`：open/reopened 在前（按 severity、lastActiveAt 排），verifying 次之（标注"等你确认"），closed 计数一行带过
- `dbg.mjs stats`：结案数、平均历时、复发率（reopenHistory 非空的 closed / closed 总数）、top 复发根因分类——数字归脚本，解读归模型
