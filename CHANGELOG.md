# Changelog

版本号唯一事实源。格式参考语义化版本； BREAKING 变更必须在此说明迁移路径。

## 0.2.0 - 2026-09-20

- 脚本实现：dbg.mjs 五命令（ls / doctor / stats / scout / nextid），单文件零依赖
- 不变量 D0-D5 全部落地并有正反测试；自测 18 项全绿
- 修复：macOS /var ↔ /private/var 符号链接导致 project.json key 与 git 路径对不上（locate 统一 realpathSync 归一）
- 修复：ls 在存在损坏案卷时被空案卷早退分支拦截，告警不可见
- nextid --reserve 建档写壳（status=open），撞号自动加序号

## 0.1.0 - 2026-09-20

- 初版：SKILL.md 路由器 + 四动作 references（open / evidence / fix / close）+ 数据 schema（D0-D5）+ 四模板
- 三铁律：跑在报案前 / 一异常一卷宗 / 结论必带证据
- 复发特别程序：先复盘（根因错/被回退/条件漏了三选一）再动代码
