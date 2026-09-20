# Changelog

版本号唯一事实源。格式参考语义化版本； BREAKING 变更必须在此说明迁移路径。

## 0.2.1 - 2026-09-20

- 修复：archive/ 容器目录被误当案卷报"解析失败"（实战演示时发现）
- 修复：stats 平均结案历时对无效时间戳算出负值，现过滤无效时长
- 实战检验：完整走通立案→取证→修复→结案流程（见 screenshots/），并据此修出 2 个产品 bug——狗粮第一碗

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
