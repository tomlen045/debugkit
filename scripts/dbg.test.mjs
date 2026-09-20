// dbg.test.mjs — debugkit 自测。node dbg.test.mjs，全绿输出"全部通过"，退出码 0。
// 覆盖：ls / doctor(D0-D5) / stats / scout / nextid 占号与防撞号 / 复发链路。
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DBG = path.join(HERE, 'dbg.mjs');
const TMP0 = fs.mkdtempSync(path.join(os.tmpdir(), 'debugkit-test-'));
const TMP = fs.realpathSync(TMP0); // macOS /var ↔ /private/var 符号链接，与 dbg.mjs locate() 的 realpath 归一保持一致
let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`✓ ${name}`); }
  catch (e) { fail++; console.log(`✗ ${name}\n    ${e.message}`); }
};
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg ?? 'assert'}: 期望 ${b} 实际 ${a}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg ?? 'assert 失败'); };

/** 建一个隔离沙箱：git 仓库 + .debugkit 骨架 + 可选案卷 */
function sandbox() {
  const root = path.join(TMP, `repo-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(root, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  fs.writeFileSync(path.join(root, 'a.txt'), 'hello\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: root });
  fs.mkdirSync(path.join(root, '.debugkit', 'cases'), { recursive: true });
  fs.writeFileSync(path.join(root, '.debugkit', 'project.json'), JSON.stringify({ key: root, repoRoot: root, git: true }));
  fs.appendFileSync(path.join(root, '.git', 'info', 'exclude'), '.debugkit/\n');
  return root;
}
function run(root, args) {
  const r = spawnSync('node', [DBG, ...args], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
}
const writeCase = (root, id, obj, archive = false) => {
  const dir = path.join(root, '.debugkit', 'cases', archive ? 'archive' : '', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify({ id, ...obj }, null, 2));
  return dir;
};
const baseCase = () => ({
  title: '登录偶发500', symptom: 'POST /api/login 5%概率500', status: 'open', severity: 'high',
  createdAt: '2026-09-20T10:00:00+08:00', lastActiveAt: '2026-09-20T10:00:00+08:00',
  repro: { cmd: '', note: '', lastRunAt: null, lastOutputDigest: '' },
  evidence: [{ id: 'E1', ts: '2026-09-20T10:05:00+08:00', kind: 'log', cmd: 'grep -c NPE app.log', output: '47', digest: 'NPE全部来自AuthFilter', superseded: false }],
  hypotheses: [], fix: {}, rootcause: {}, reopenHistory: [],
});

/* ── ls ── */
t('ls：空项目友好提示', () => {
  const root = sandbox();
  const r = run(root, ['ls']);
  eq(r.code, 0); ok(r.out.includes('立案'), '应有立案引导');
});
t('ls：verifying 案卷标注等你确认', () => {
  const root = sandbox();
  writeCase(root, 'c1', { ...baseCase(), status: 'verifying' });
  const r = run(root, ['ls']);
  eq(r.code, 0); ok(r.out.includes('等你实测确认'), '应有等待确认提示');
});
t('ls：corrupted JSON 大声报', () => {
  const root = sandbox();
  fs.mkdirSync(path.join(root, '.debugkit', 'cases', 'broken'), { recursive: true });
  fs.writeFileSync(path.join(root, '.debugkit', 'cases', 'broken', 'case.json'), '{ not json');
  const r = run(root, ['ls']);
  ok(r.out.includes('解析失败') && r.out.includes('broken'), '应点名损坏案卷');
});

/* ── doctor：D0-D5 ── */
t('doctor：全新骨架全绿', () => {
  const root = sandbox();
  eq(run(root, ['doctor']).code, 0);
});
t('D0：exclude 缺失被点名', () => {
  const root = sandbox();
  fs.writeFileSync(path.join(root, '.git', 'info', 'exclude'), '');
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('.debugkit/'), '应提示 exclude 缺失');
});
t('D1：证据 id 跳号被点名', () => {
  const root = sandbox();
  const c = baseCase();
  c.evidence.push({ id: 'E3', ts: 'x', kind: 'cmd', cmd: 'x', output: 'y', digest: 'z', superseded: false });
  writeCase(root, 'skip-id', c);
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('跳号'), '应报跳号');
});
t('D1：证据 id 重号被点名', () => {
  const root = sandbox();
  const c = baseCase();
  c.evidence.push({ id: 'E1', ts: 'x', kind: 'cmd', cmd: 'x', output: 'y', digest: 'z', superseded: false });
  writeCase(root, 'dup-id', c);
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('重号'), '应报重号');
});
t('D2：confirmed 未挂证据被点名', () => {
  const root = sandbox();
  const c = baseCase();
  c.hypotheses = [{ id: 'H1', text: 'x', status: 'confirmed', evidence: null, createdAt: 'x' }];
  writeCase(root, 'h-noev', c);
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('H1'), '应点名假设');
});
t('D2：ruled_out 挂了证据 → 绿', () => {
  const root = sandbox();
  const c = baseCase();
  c.evidence.push({ id: 'E2', ts: 'x', kind: 'cmd', cmd: 'ping db', output: 'ok', digest: '连接池正常', superseded: false });
  c.hypotheses = [{ id: 'H2', text: 'db挂了', status: 'ruled_out', evidence: 'E2', createdAt: 'x' }];
  writeCase(root, 'h-ruled', c);
  eq(run(root, ['doctor']).code, 0);
});
t('D3：closed 缺根因链 → 降档点名', () => {
  const root = sandbox();
  writeCase(root, 'bad-close', { ...baseCase(), status: 'closed', fix: {} });
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('rootcause'), '应点名根因链缺失');
});
t('D3：closed 案卷在活层被点名', () => {
  const root = sandbox();
  writeCase(root, 'live-closed', { ...baseCase(), status: 'closed',
    fix: { verify: { cmd: 'bash repro.sh', output: '20/20', ts: 'x', userConfirmed: true } },
    rootcause: { chain: 'E1 → fix.verify', oneLiner: '并发HashMap' } });
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('活层'), '应提示移入 archive');
});
t('D4：reopened 无历史被点名', () => {
  const root = sandbox();
  writeCase(root, 'no-hist', { ...baseCase(), status: 'reopened', reopenHistory: [] });
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('reopenHistory'), '应点名缺历史');
});
t('D5：空目录被点名', () => {
  const root = sandbox();
  fs.mkdirSync(path.join(root, '.debugkit', 'cases', 'ghost'), { recursive: true });
  const r = run(root, ['doctor']);
  eq(r.code, 1); ok(r.out.includes('ghost'), '应点名幽灵目录');
});

/* ── nextid ── */
t('nextid 默认只读：不建目录', () => {
  const root = sandbox();
  const r = run(root, ['nextid', 'login 500 偶发']);
  eq(r.code, 0);
  ok(!fs.existsSync(path.join(root, '.debugkit', 'cases', r.out.trim())), '不应创建目录');
  ok(/login-500-.+\d{8}$/.test(r.out.trim()), `slug 应规范化：${r.out.trim()}`);
});
t('nextid --reserve：建目录+写壳，撞号自动加序号', () => {
  const root = sandbox();
  const r1 = run(root, ['nextid', '--reserve', 'login-500']);
  const id1 = r1.out.trim();
  ok(fs.existsSync(path.join(root, '.debugkit', 'cases', id1, 'case.json')), '应写壳文件');
  const shell = JSON.parse(fs.readFileSync(path.join(root, '.debugkit', 'cases', id1, 'case.json'), 'utf8'));
  eq(shell.status, 'open'); eq(shell.evidence.length, 0);
  const r2 = run(root, ['nextid', '--reserve', 'login-500']);
  ok(r2.out.trim() !== id1, '第二个同号应避开');
});

/* ── scout / stats ── */
t('scout：命中症状与根因（含 archive 层）', () => {
  const root = sandbox();
  writeCase(root, 'npe-case', { ...baseCase() });
  writeCase(root, 'old-case', { ...baseCase(), status: 'closed',
    rootcause: { chain: 'E1', oneLiner: '缓存雪崩导致登录超时' } }, true);
  const r = run(root, ['scout', '缓存雪崩']);
  eq(r.code, 0); ok(r.out.includes('old-case'), '应命中归档案卷');
  const r0 = run(root, ['scout', 'zzz不存在']);
  eq(r0.code, 0); ok(r0.out.includes('无命中'));
});
t('stats：复发率与结案数', () => {
  const root = sandbox();
  writeCase(root, 'ok-case', { ...baseCase(), status: 'closed',
    fix: { verify: { cmd: 'r', output: 'ok', ts: '2026-09-20T12:00:00+08:00', userConfirmed: true } },
    rootcause: { chain: 'E1', oneLiner: 'x' } }, true);
  writeCase(root, 'rr-case', { ...baseCase(), status: 'closed',
    fix: { verify: { cmd: 'r', output: 'ok', ts: '2026-09-20T12:00:00+08:00', userConfirmed: true } },
    rootcause: { chain: 'E1', oneLiner: 'y' },
    reopenHistory: [{ ts: 'x', from: 'closed', reason: '修复被回退' }] }, true);
  const r = run(root, ['stats']);
  eq(r.code, 0); ok(r.out.includes('复发率 1/2'), `应报 1/2：${r.out}`);
  ok(r.out.includes('50%'), '应算出 50%');
});

/* ── 复发链路（集成） ── */
t('复发案卷：reopened + 历史 → doctor 绿', () => {
  const root = sandbox();
  writeCase(root, 'relapse', { ...baseCase(), status: 'reopened',
    fix: { verify: { cmd: 'r', output: 'ok', ts: 'x', userConfirmed: true } },
    rootcause: { chain: 'E1 → fix.verify', oneLiner: 'y' },
    reopenHistory: [{ ts: '2026-09-21T09:00:00+08:00', from: 'closed', reason: '线上又500，当时复现脚本没覆盖并发' }] });
  eq(run(root, ['doctor']).code, 0);
  const r = run(root, ['ls']);
  ok(r.out.includes('复发'), 'ls 应标复发态');
});

/* ── 收尾 ── */
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
