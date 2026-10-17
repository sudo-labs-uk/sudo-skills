---
name: verify
description: "Verify what a user actually sees after a UI change: drive the running app, capture each state as a screenshot, and report what matched the acceptance criteria and what did not."
disable-model-invocation: true
---

# Verify

A passing test suite says the code does what the tests say. It does not say the
user can see it. This skill looks.

Run it after a change that touches anything user-visible, before the review.

## Process

1. Name the states to check, from the ticket's acceptance criteria: one per
   criterion that a user could see, plus the empty, loading and error state of
   anything new, and every width the repo already supports.

2. Get the app running. Use the repo's own command. If it will not start, stop
   here and report that, rather than reviewing the code instead.

3. Drive each state with the browser tooling available, and capture a
   screenshot of each. Reach the state the way a user would, through the UI, not
   by setting it directly.

4. Read each screenshot yourself. Check the text is not clipped or overlapping,
   the control is reachable, the state is the one you asked for, and the layout
   holds at every width.

5. Report one row per state: what you did, what you saw, which criterion it
   covers, and pass or fail. Attach the screenshots. A criterion you could not
   reach is a fail with the reason, never a silent omission.

## Rules

- A screenshot you did not look at is not evidence.
- Never report a state you did not reach.
- Where no browser access is available, say so plainly and report the states as
  unverified. Do not substitute a reading of the code.
