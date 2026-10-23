# Upstream

This skill is a vendored copy of third-party work.

- Upstream: https://github.com/mattpocock/skills
- Path: `skills/engineering/implement-spec`
- Commit: `49dd158d1076134a641b33efb035946536778336` (2026-10-09T11:56:49+01:00)
- Licence: MIT, in `LICENSE` beside this file. Copyright (c) 2026 Matt Pocock.

Sudo Labs holds this as a pinned copy so the set cannot drift under a session.
When `sudo-labs-uk/skills` exists as a fork of the upstream, this directory is
replaced by a merge from it; the commit above is the merge base.

## What Sudo Labs changed

The setup skill named is `/sudo-skills:sudo-setup` rather than `/setup-matt-pocock-skills`,
and the Skill tool is called with `sudo-skills:tdd` and `sudo-skills:code-review`, the
names those skills carry inside the `sudo-skills` plugin.

Everything else is byte-identical to the upstream commit named above.
