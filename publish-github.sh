#!/usr/bin/env zsh
# GitHub 镜像仓一键发布（Gitee 已发：https://gitee.com/tomlen/debugkit）
# 用法：先 export GH_TOKEN=<github personal access token（repo 权限）>，再跑本脚本
set -e
cd "$(dirname "$0")"

if [ -z "$GH_TOKEN" ]; then
  echo "❌ 缺 GH_TOKEN。去 https://github.com/settings/tokens 生成（勾 repo 权限），然后："
  echo "   GH_TOKEN=ghp_xxx $0"
  exit 1
fi

# 1. 建仓（幂等：已存在则跳过）
echo "→ 创建/检查 GitHub 仓库 tomlen045/debugkit ..."
HTTP=$(curl -s -o /tmp/gh_create.json -w '%{http_code}' \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d '{"name":"debugkit","description":"Debug forensics & closure discipline skill — run before you report / one anomaly one case / claims carry evidence. Works with OpenCode, Claude Code, Codex, Cursor, Hermes.","has_wiki":false,"private":false}')
if [ "$HTTP" = "201" ]; then echo "  ✅ 已创建"
elif [ "$HTTP" = "422" ]; then echo "  ℹ 已存在，跳过"
else echo "  ❌ 失败($HTTP): $(cat /tmp/gh_create.json | head -c 300)"; exit 1; fi

# 2. 推送（SSH 443 绕墙 + 密钥，绕过 ghproxy insteadOf——铁律）
if ! git remote get-url github >/dev/null 2>&1; then
  git remote add github git@ssh.github.com:tomlen045/debugkit.git
fi
echo "→ 推送 main ..."
GIT_SSH_COMMAND="ssh -p 443 -i $HOME/.ssh/id_ed25519_github -o StrictHostKeyChecking=accept-new" \
  git push -u github main

# 3. About 描述 + topics（star 转化的搜索权重项）
echo "→ 设置 About 与 topics ..."
curl -s -o /dev/null -X PATCH \
  -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/tomlen045/debugkit \
  -d '{"description":"Debug forensics & closure discipline skill — run before you report, one anomaly one case, claims carry evidence. OpenCode / Claude Code / Codex / Cursor / Hermes.","homepage":""}'
curl -s -o /dev/null -X PUT \
  -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/tomlen045/debugkit/topics \
  -d '{"names":["skill","agent","debugging","sre","claude-code","opencode","skills","postmortem","ai-agents"]}'

# 4. 验证
echo "→ 验证 ..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' https://github.com/tomlen045/debugkit)
[ "$CODE" = "200" ] && echo "✅ GitHub 发布完成: https://github.com/tomlen045/debugkit" || echo "⚠ 网页返回 $CODE（新仓库索引可能延迟，稍后刷新）"
