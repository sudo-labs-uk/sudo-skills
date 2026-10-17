---
name: audit
description: "Check a finished change against the acceptance criteria written into its ticket, as a fresh agent that took no part in the build, and report evidence per criterion."
disable-model-invocation: true
---

# Audit

An agent that built the change grades its own reading of what the change was
for. This skill is for an agent that did not build it.

Run it in a fresh session, with the ticket and the diff, and nothing inherited
from the build.

## Before you start

If you wrote any part of this change, stop and say so. The audit has to come
from somewhere else.

## Process

1. Read the ticket and list its acceptance criteria verbatim, numbered. Where
   the ticket has none, the audit fails on that: a change with no stated
   criteria cannot be checked, and the ticket needs them first.

2. Read the diff. Note anything in it that no criterion asked for.

3. For each criterion, get one piece of proof and run it yourself:
   - a test run, with the command and its output
   - a screenshot, which you look at
   - a query result
   - the specific lines of the diff, where the criterion is about the code

4. Name every skill that ran during the build, in order, and every step that
   was skipped with the reason given for skipping it. An unexplained skip is a
   finding.

5. Report:
   - one row per criterion: the criterion, the proof, pass or fail
   - the skills that ran, in order
   - the steps skipped, each with its reason
   - anything in the diff no criterion asked for
   - a verdict: pass only when every criterion has proof

## Rules

- A criterion with no proof is a fail. Not a warning.
- Proof is something you ran or looked at, not something you were told.
- Report what you found. Fixing it is the build agent's job.
