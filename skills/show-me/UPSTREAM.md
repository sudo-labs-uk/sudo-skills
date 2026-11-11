# Upstream

This skill is a vendored copy of third-party work.

- Upstream: https://github.com/humanlayer/skills
- Path: `plugins/show-me/skills/show-me`
- Commit: `653b6411c1f70c275a18e37673b042ff99f67ceb` (2026-10-08T14:54:25-07:00)
- Licence: MIT, in `LICENSE` beside this file. Copyright (c) 2026 HumanLayer.

## What Sudo Labs changed

`SKILL.md` has three changes; every other file is byte-identical to the upstream commit
named above.

- The `disable-model-invocation: true` line is removed, and the description gains a
  "Use when" sentence, so an agent can reach the skill on its own when a diagram would
  answer the question faster than prose.
- The HTML bullet no longer runs upstream's `open path/to/show-me-{description}.html`
  step; it defers to the section added below.
- A "render it where the user is" section routes Mermaid diagrams and HTML pages by
  the surface the session runs on: an Artifact in the Claude desktop app, claude.ai or
  a remote shell, a browser pane in cmux, the default browser elsewhere. It carries a
  Mermaid page template, a check that the diagram drew in cmux, and a rule that the
  reply names where the view opened.
