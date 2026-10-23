# Upstream

This skill is a vendored copy of third-party work.

- Upstream: https://github.com/mattpocock/skills
- Path: `skills/productivity/grilling`
- Commit: `49dd158d1076134a641b33efb035946536778336` (2026-10-09T11:56:49+01:00)
- Licence: MIT, in `LICENSE` beside this file. Copyright (c) 2026 Matt Pocock.

Sudo Labs holds this as a pinned copy so the set cannot drift under a session.
`grill-with-docs` calls it by name.

## What Sudo Labs changed

The upstream asks every open question in one round. This copy asks one question
at a time through sudo's `ask` skill, recomputing the frontier after each answer.
The short description in `agents/openai.yaml` says the same.
