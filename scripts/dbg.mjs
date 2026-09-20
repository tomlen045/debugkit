#!/usr/bin/env node
// @ts-check
// dbg.mjs — debugkit 唯一 CLI。单文件刻意设计（拷贝即用、无构建、无依赖）。
//
// ── 函数目录（定位用 grep '^function 名字'）──
// 工具层: git / readJson / relTime / locate / loadCases / caseIdList
// 命令层（互不调用）: ls / doctor / stats / scout / nextid
// 分发区: 文件尾 if (cmd === …) 一行一命令
//
// 能力声明（facts 归脚本，judgment 归模型）：ls/doctor/stats/scout 只读；
// 唯一写入口 = nextid --reserve（占号 + 建目录 + 写最小 case.json），绕开编排层确认门槛没有入口。
// 退出码契约：0 = 正常/全绿；1 = doctor 发现差异。
// 不变量 D0-D5 的唯一 spec：references/data.md「不变量」节——脚本不得私改语义，只实现 spec。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const R = (s) => String(s ?? '').trim();
const trunc = (s, n) => (s = String(s ?? ''), s.length > n ? s.slice(0, n - 1) + '…' : s);

/** git 子进程封装。mayFail=true 失败返回 null 不抛。 */
function git(args, cwd, mayFail = true) {
  try {
    return R(execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return mayFail ? null : null;
  }
}

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

function relTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

const SEV = { high: '🔥高', medium: '🟡中', low: '🩹低' };
const STATUS = { open: 'open', verifying: '等确认', closed: '已结案', reopened: '复发' };

function locate() {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd());
  const isGit = !!common;
  // realpath 归一：macOS /var ↔ /private/var 符号链接会让 key 与 git 绝对路径对不上（实测踩过）
  const mainRoot = isGit ? fs.realpathSync(path.dirname(path.resolve(common))) : fs.realpathSync(process.cwd());
  return { isGit, mainRoot, kitDir: path.join(mainRoot, '.debugkit'), casesDir: path.join(mainRoot, '.debugkit', 'cases') };
}

/** 扫描活层 + archive/ 层的全部 case.json；损坏文件进 CORRUPTED 大声报。 */
const CORRUPTED = [];
function loadCases(casesDir) {
  const out = [];
  const layers = [casesDir, path.join(casesDir, 'archive')];
  for (const layer of layers) {
    if (!fs.existsSync(layer)) continue;
    for (const d of fs.readdirSync(layer, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = path.join(layer, d.name, 'case.json');
      if (!fs.existsSync(p)) { if (layer === casesDir) CORRUPTED.push(`${d.name}（缺 case.json）`); continue; }
      let cj = null;
      try { cj = JSON.parse(fs.readFileSync(p, 'utf8')); }
      catch { CORRUPTED.push(`${d.name}（JSON 解析失败）`); continue; }
      if (cj && cj.id) out.push({ case: cj, layer: layer.endsWith('archive') ? 'archive' : 'live', dir: path.join(layer, d.name) });
      else CORRUPTED.push(`${d.name}（缺 id 字段）`);
    }
  }
  return out;
}

const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

/* ---------------- ls：案卷盘点 ---------------- */

function ls() {
  const { kitDir, casesDir } = locate();
  if (!fs.existsSync(kitDir)) { console.log('（本项目还没有 .debugkit/ —— 用一句话描述 bug 即可立案）'); return 0; }
  const all = loadCases(casesDir);
  const live = all.filter(e => e.layer === 'live');
  const order = { reopened: 0, open: 1, verifying: 2 };
  live.sort((a, b) => (order[a.case.status] ?? 9) - (order[b.case.status] ?? 9)
    || String(b.case.lastActiveAt ?? '').localeCompare(String(a.case.lastActiveAt ?? '')));
  if (!live.length && !all.length && !CORRUPTED.length) { console.log('（无案卷——干净得像没写过错代码。有 bug 就一句话描述，立案开查）'); return 0; }
  console.log('id                       状态    级   假设(✓/✗/总) 复发  最后活跃    症状');
  for (const { case: c } of live) {
    const hyp = c.hypotheses ?? [];
    const ok = hyp.filter(h => h.status === 'confirmed').length;
    const out = hyp.filter(h => h.status === 'ruled_out').length;
    const rr = (c.reopenHistory ?? []).length;
    console.log(`${pad(c.id, 24)} ${pad(STATUS[c.status] ?? c.status, 6)} ${pad(SEV[c.severity] ?? '—', 4)} ${pad(`${ok}/${out}/${hyp.length}`, 8)}   ${pad(String(rr), 3)}   ${pad(relTime(c.lastActiveAt), 9)}  ${trunc(c.title ?? c.symptom ?? '', 34)}`);
  }
  const verifying = live.filter(e => e.case.status === 'verifying');
  if (verifying.length) console.log(`\n⏳ ${verifying.map(e => e.case.id).join('、')} 等你实测确认（修好了吗？）`);
  const closed = all.filter(e => e.layer === 'archive' || e.case.status === 'closed');
  if (closed.length) console.log(`🗄 已结案 ${closed.length} 件（scout <关键词> 可检索）`);
  if (CORRUPTED.length) console.log(`\n⚠ 案卷解析失败：${CORRUPTED.join('、')} —— 被跳过，须先修复`);
  if (!all.length && !CORRUPTED.length) console.log('（无案卷——干净得像没写过错代码）');
  else if (!live.length && all.length) console.log('（活层无在办案卷）');
  return 0;
}

/* ---------------- doctor：按 D0-D5 体检（只读） ---------------- */

function doctor(args = []) {
  const { isGit, mainRoot, kitDir, casesDir } = locate();
  const only = args.find(a => !a.startsWith('-'));
  const issues = [];
  const bad = (m) => issues.push(m);

  // D0 项目身份
  const pj = readJson(path.join(kitDir, 'project.json'));
  if (!pj) bad('D0：缺 .debugkit/project.json（debugkit 未初始化）');
  else {
    let key = mainRoot;
    if (isGit) {
      const url = git(['remote', 'get-url', 'origin'], mainRoot);
      if (url) key = url.replace(/^(https?:\/\/|ssh:\/\/|git@)/, '').replace(/\.git$/, '').replace(':', '/');
    }
    if (pj.key !== key) bad(`D0：project.json.key 与当前仓库不一致（${pj.key} ≠ ${key}）——环境变了，人工确认`);
    const exc = isGit ? fs.readFileSync(path.join(mainRoot, '.git', 'info', 'exclude'), 'utf8') : '.debugkit/';
    if (!exc.split('\n').some(l => l.trim() === '.debugkit/')) bad('D0：.git/info/exclude 缺 .debugkit/ ——案卷有进 git 的风险');
  }

  const all = fs.existsSync(casesDir) ? loadCases(casesDir) : [];
  const targets = only ? all.filter(e => e.case.id === only) : all;
  if (only && !targets.length) { console.log(`未找到案卷 ${only}`); return 1; }

  for (const { case: c, layer, dir } of targets) {
    const live = layer === 'live';
    // D1 证据 id 唯一且递增
    const ev = c.evidence ?? [];
    const ids = ev.map(e => e.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) bad(`D1：${c.id} 证据 id 重号 ${dup.join(',')}`);
    for (let i = 0; i < ids.length; i++) {
      const n = Number(String(ids[i]).replace(/^E/, ''));
      if (!(n === i + 1)) { bad(`D1：${c.id} 证据 id 跳号/乱序（${ids.join(',')}，应为 E1..E${ids.length}）`); break; }
    }
    // D2 假设三态 + 证据回挂
    for (const h of (c.hypotheses ?? [])) {
      if (!['open', 'confirmed', 'ruled_out'].includes(h.status)) bad(`D2：${c.id} 假设 ${h.id} 非法 status=${h.status}`);
      if (h.status === 'confirmed' && !(h.evidence && ids.includes(h.evidence))) bad(`D2：${c.id} 假设 ${h.id} confirmed 但未挂证据`);
      if (h.status === 'ruled_out' && !(h.evidence && ids.includes(h.evidence))) bad(`D2：${c.id} 假设 ${h.id} ruled_out 但未挂证据`);
    }
    // D3 closed 必有根因链 + 实跑验证
    if (c.status === 'closed') {
      const rcOk = c.rootcause && typeof c.rootcause.chain === 'string' && c.rootcause.chain.length > 3;
      const vfOk = c.fix?.verify?.cmd && c.fix?.verify?.output;
      if (!rcOk) bad(`D3：${c.id} closed 但 rootcause.chain 缺失`);
      if (!vfOk) bad(`D3：${c.id} closed 但 fix.verify 无实跑记录`);
      if (live) bad(`D3：${c.id} closed 但仍在活层（应移入 archive/）`);
    }
    // D4 reopened 必有历史
    if (c.status === 'reopened' || (c.reopenHistory ?? []).length) {
      const rh = c.reopenHistory ?? [];
      if (!rh.length) bad(`D4：${c.id} reopened 但 reopenHistory 为空`);
      for (const r of rh) if (!r.reason) bad(`D4：${c.id} reopenHistory 有条目缺 reason`);
    }
    // D5 目录对应
    if (!fs.existsSync(dir)) bad(`D5：${c.id} case.json 存在但目录缺失`);
    for (const d of fs.readdirSync(path.dirname(dir), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      if (!fs.existsSync(path.join(path.dirname(dir), d.name, 'case.json'))) bad(`D5：${d.name} 目录存在但缺 case.json（手动误建？）`);
    }
  }

  if (CORRUPTED.length) bad(`损坏案卷：${CORRUPTED.join('、')}（JSON 解析失败，任务会从所有列表消失）`);
  if (issues.length) { console.log(`doctor 发现 ${issues.length} 处差异：`); for (const m of issues) console.log('  ✗ ' + m); return 1; }
  console.log(`doctor 全绿（${all.length} 案卷，D0-D5）`);
  return 0;
}

/* ---------------- stats：结案率与复发率（数字归脚本，解读归模型） ---------------- */

function stats() {
  const { casesDir } = locate();
  const all = loadCases(casesDir);
  const closed = all.filter(e => e.case.status === 'closed');
  const reopened = closed.filter(e => (e.case.reopenHistory ?? []).length > 0);
  const openN = all.filter(e => ['open', 'verifying', 'reopened'].includes(e.case.status)).length;
  let durations = [];
  for (const { case: c } of closed) {
    const t0 = Date.parse(c.createdAt), t1 = Date.parse(c.fix?.verify?.ts);
    if (!Number.isNaN(t0) && !Number.isNaN(t1)) durations.push((t1 - t0) / 3600000);
  }
  const avgH = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  console.log(`案卷总数 ${all.length}｜在办 ${openN}｜已结 ${closed.length}`);
  const rate = closed.length ? `${reopened.length}/${closed.length}（${Math.round(reopened.length / closed.length * 100)}%）` : '0/0（—）';
  console.log(`复发率 ${rate}`);
  if (avgH !== null) console.log(`平均结案历时 ${avgH >= 1 ? avgH.toFixed(1) + ' 小时' : Math.round(avgH * 60) + ' 分钟'}`);
  const patterns = {};
  for (const { case: c } of reopened) {
    const k = trunc(c.rootcause?.oneLiner ?? c.title ?? c.id, 30);
    patterns[k] = (patterns[k] ?? 0) + 1;
  }
  const top = Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) console.log('复发常客：'); for (const [k, n] of top) console.log(`  ${n}次  ${k}`);
  return 0;
}

/* ---------------- scout：跨案卷检索（含 archive） ---------------- */

function scout(args = []) {
  const kw = (args[0] ?? '').toLowerCase();
  if (!kw) { console.log('用法：dbg.mjs scout <关键词>（检索症状/证据摘要/根因）'); return 1; }
  const { casesDir } = locate();
  const all = loadCases(casesDir);
  const hits = all.filter(({ case: c }) => {
    const hay = [c.id, c.title, c.symptom, c.rootcause?.oneLiner,
      ...(c.evidence ?? []).map(e => `${e.digest} ${e.output}`)].join(' ').toLowerCase();
    return hay.includes(kw);
  });
  if (!hits.length) { console.log(`无命中（关键词：${kw}）`); return 0; }
  for (const { case: c, layer } of hits) {
    console.log(`[${layer === 'archive' ? '已结' : STATUS[c.status] ?? c.status}] ${c.id} — ${trunc(c.rootcause?.oneLiner ?? c.title ?? '', 50)}`);
  }
  return 0;
}

/* ---------------- nextid：占号（唯一写入口，须 --reserve） ---------------- */

function nextid(args = []) {
  const reserve = args.includes('--reserve');
  const slug = (args.find(a => !a.startsWith('-') && a !== (args[0] === '--reserve' ? '--reserve' : '')) ?? args.filter(a => !a.startsWith('-'))[0] ?? '').trim();
  const { casesDir } = locate();
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeSlug = R(slug).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'case';
  let n = 1;
  let id = `${safeSlug}-${day}`;
  while (fs.existsSync(path.join(casesDir, id)) || fs.existsSync(path.join(casesDir, 'archive', id))) {
    n += 1; id = `${safeSlug}-${day}-${n}`;
  }
  if (!reserve) { console.log(id); return 0; }
  // --reserve：建目录 + 写最小 case.json（status=open 的壳，由编排层填充）
  const dir = path.join(casesDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const shell = {
    id, title: R(slug) || '（待填症状）', symptom: '', status: 'open', severity: 'medium',
    createdAt: now, lastActiveAt: now,
    repro: { cmd: '', note: '待复现', lastRunAt: null, lastOutputDigest: '' },
    evidence: [], hypotheses: [], fix: {}, rootcause: {}, reopenHistory: [],
  };
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(shell, null, 2) + '\n');
  console.log(id);
  return 0;
}

/* ---------------- 分发区 ---------------- */

const cmd = process.argv[2] ?? 'ls';
const rest = process.argv.slice(3);
if (cmd === 'ls') process.exit(ls());
else if (cmd === 'doctor') process.exit(doctor(rest));
else if (cmd === 'stats') process.exit(stats());
else if (cmd === 'scout') process.exit(scout(rest));
else if (cmd === 'nextid') process.exit(nextid(rest));
else { console.log('dbg.mjs — debugkit 只读工具箱\n  ls              案卷盘点\n  doctor [id]     按 D0-D5 体检（0=全绿 1=有差异）\n  stats           结案率/复发率/平均历时\n  scout <词>      跨案卷检索（含归档）\n  nextid [--reserve] <slug>   占号（--reserve 才写入）'); process.exit(2); }
