# Upstream

This skill is a vendored copy of third-party work.

- Upstream: https://github.com/thedotmack/claude-mem
- Path: `plugin/skills/design-is`
- Commit: `26e839a343616cda19b9ef391469c2dd81b49ca1` (2026-10-16T05:25:20-07:00)
- Licence: Apache License 2.0, in `LICENSE` beside this file. The upstream
  attribution notice is in `NOTICE` beside it: Claude-Mem, Copyright 2026
  Alex Newman.

## What Sudo Labs changed

The `SKILL.md` is byte-identical to the upstream commit named above. Sudo Labs
added this file, `LICENSE` and `NOTICE`, and nothing else.

Note for a session: the skill hands off to `/make-plan` and `/review`, which
are claude-mem's own commands and are not part of sudo. Treat the handoff as a
written plan prompt and carry it into sudo's own next step.
