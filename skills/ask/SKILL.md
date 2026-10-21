---
name: ask
description: How a sudo skill puts a decision to the user. One question per turn, sent through the interactive control of the surface the session runs on. Use whenever a skill needs an answer from the user.
---

# Ask one question at a time

Every question a sudo skill puts to the user goes out this way, and so does any question an agent asks on its own account.

## The rules

1. **One question per turn.** Ask it, then stop and wait. Never put two questions in one message, even when both could be asked now. Keep the rest queued and ask the next one after this one is answered.
2. **Numbered options.** Give two to four options where the question has them. A question that is truly open (a name, a number, a description) goes out with no options. Put your recommended answer first and say in one line why you recommend it. The user can always answer in their own words instead.
3. **Pick the next question again after each answer.** An answer can settle or reshape the questions still queued, so work out the next one from where things now stand, not from the original list.
4. **Facts are yours, decisions are theirs.** Look facts up yourself (files, tools, a sub-agent). Ask the user only for decisions.

## Delivery depends on where the session runs

- **Claude Code** (terminal, desktop or IDE): call the `AskUserQuestion` tool with exactly one question. Put the recommended option first and add "(Recommended)" to the end of its label.
- **Telegram through OpenClaw**: write the question in the message text, then the options as a numbered list ("1. … 2. …"). Attach inline buttons whose labels are only the numbers ("1", "2", …), plus one "💬 Chat about this" button. Long labels get cut off on a phone, which is why the options live in the text. Send it with the message tool, then end the turn without repeating the question in your reply text.

  The working button shape is one `buttons` block in `presentation`, each button a plain `label` and `value` with no `action` field. Give each question an id and use values like `q3_1`, `q3_2` and `q3_chat`. A tapped button comes back as the user's next turn carrying that value.

  ```json
  {"blocks": [{"type": "buttons", "buttons": [
    {"label": "1", "value": "q3_1"}, {"label": "2", "value": "q3_2"},
    {"label": "💬 Chat about this", "value": "q3_chat"}]}]}
  ```
- **Anywhere else**: write the question and a numbered list of options, and end with "Reply with a number."

When a button or interactive control can't be sent, fall back to the numbered list in plain text. Do not fall back to asking several questions at once.
