# Upstream

This skill is a vendored copy of third-party work.

- Upstream: https://github.com/mattpocock/skills
- Path: `skills/engineering/tdd`
- Commit: `49dd158d1076134a641b33efb035946536778336` (2026-10-09T11:56:49+01:00)
- Licence: MIT, in `LICENSE` beside this file. Copyright (c) 2026 Matt Pocock.

Sudo Labs holds this as a pinned copy so the set cannot drift under a session.
When `sudo-labs-uk/skills` exists as a fork of the upstream, this directory is
replaced by a merge from it; the commit above is the merge base.

## What Sudo Labs changed

One line changed: instead of asking the user for the interface and the seams, the agent proposes them and confirms them as one question through sudo's `ask` skill. Skill names carry their Claude Code plugin prefix, such as `sudo-skills:grilling`, beside the bare name the OpenClaw gateway uses. Otherwise the file is byte-identical to the upstream commit named above.
