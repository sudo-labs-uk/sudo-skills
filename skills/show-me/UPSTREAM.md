# Upstream

This skill is a vendored copy of third-party work.

- Upstream: https://github.com/humanlayer/skills
- Path: `plugins/show-me/skills/show-me`
- Commit: `653b6411c1f70c275a18e37673b042ff99f67ceb` (2026-10-08T14:54:25-07:00)
- Licence: MIT, in `LICENSE` beside this file. Copyright (c) 2026 HumanLayer.

## What Sudo Labs changed

`SKILL.md` has two changes; every other file is byte-identical to the upstream commit
named above.

- The `disable-model-invocation: true` line is removed, so an agent can reach the skill
  on its own when a diagram would answer the question faster than prose.
- The HTML bullet publishes the page with the Artifact tool when the session has one,
  and falls back to upstream's write-and-open step when it does not.
