# debugkit

**Debug forensics & closure discipline for coding agents** — for any agent that can read files and run shell commands (OpenCode, Claude Code, Codex, Cursor, Hermes, etc. — anything that speaks the SKILL.md convention). Intent is auto-detected; no magic words required.

[简体中文](README.md) | English

## The problem it solves

* AI agents "fix" bugs by guessing → **run before you report**: no conclusions, no code changes, until a minimal repro has actually been executed
* "Should be fixed now" → **every claim carries evidence**: root causes and fix announcements must cite a real command output (evidence ids E1, E2, …)
* Three bugs shoved into one case → **one anomaly, one case file**: a symptom change forces a new case
* The same bug comes back three times → **regression special procedure**: before touching code again, answer in writing — was the root cause wrong? was the fix reverted? was a condition missed?
* Debugging context evaporates between sessions → **case files persist** in `.debugkit/`: evidence, ruled-out hypotheses, root-cause chains

## Quick start

| You say | It does |
| --- | --- |
| "This API randomly returns 500" | Open a case: dedupe check → reserve id → collect first evidence → run repro once |
| (paste a stack trace) | Collect: evidence into the file → update hypothesis table → report who's supported/ruled out |
| "I think it's the database" | Hypothesis enters the table (with your confirmation) → design a command to verify it |
| "Fixed" | Verify: no repro run on record → refused, go run it |
| You confirm: "it's gone" | Close: root-cause chain + case report → archive |
| "It's back" | Reopen: regression counter +1 → **investigate why before any new patch** |

## Design principles

* **Evidence is append-only** — wrong evidence gets `superseded`, never deleted; fabricated evidence = full stop
* **Hypotheses only move forward** — open → confirmed / ruled_out, re-judgement requires a new evidence id
* **Ruled-out items are the most valuable part** — "not the database (E2)" saves the next person two hours
* **Facts belong to scripts, judgment to the model** — `dbg.mjs` is strictly read-only (the single write entry is id reservation); fixes are written by the orchestrating agent behind confirmation gates
* **Case files never enter git** — enforced via `.git/info/exclude`; code truth lives in git, debug narrative in markdown
* **Re-open rate is a team health metric** — `dbg.mjs stats` reports closure rate / reopen rate / mean time to close

## Script

```
scripts/dbg.mjs — single file, zero dependencies (node ≥ 18, copy and run)
  ls                    case inventory (open first, verifying flagged, corruption called out)
  doctor [case-id]      audit against D0-D5 invariants; exit 0 = green, 1 = drift
  stats                 closures / reopen rate / mean time / repeat offenders
  scout <keyword>       search across cases including archive
  nextid [--reserve] <slug>   reserve a case id (read-only unless --reserve)
```

The authoritative definition of invariants D0-D5 lives in `references/data.md`. Self-tests: `node scripts/dbg.test.mjs` (18 cases covering every invariant, plus a reopen integration flow).

## Layout

```
debugkit/
├── SKILL.md            # router: intent detection + action routing + hard rules
├── scripts/            # dbg.mjs CLI + self-tests
├── references/         # open / evidence / fix / close + data schema
└── templates/          # case-report / findings / session-log / regression-postmortem
```

## Compatibility

* OpenCode (`~/.config/opencode/skills`) and Claude Code (`~/.claude/skills`): symlink and go
* Codex / Cursor and anything SKILL.md-aware: `npx skills add <repo>`
* Anything else: point your agent at SKILL.md

## License

MIT
