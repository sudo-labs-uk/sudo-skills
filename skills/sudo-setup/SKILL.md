---
name: sudo-setup
description: "Configure a repo for the sudo skills: the Linear team the specs go to, the GitHub repo the tickets go to, and the stack. Run once per repo, before the other skills."
disable-model-invocation: true
---

# Sudo setup

Write this repo's configuration for where specs and tickets go. Specs go to Linear.
Tickets go to GitHub. That split is fixed; the team and the repo are not.

## Process

1. Read what the repo already says, so you ask only what you cannot see:
   `git remote -v` for the GitHub repo, `docs/agents/issue-tracker.md` for an
   existing configuration, and any `.env` or secrets file for a Linear key.

2. Ask, in one message, for whatever is still missing:
   - the Linear team the specs belong to (key or name)
   - the GitHub repo the tickets belong to, as `owner/name`
   - whether this repo runs the fixed stack: Neon for the database, Clerk for
     users, secretdrop for handing a secret to a machine

3. Write `docs/agents/issue-tracker.md` from the template below. If the file
   already exists, show the user the difference before overwriting it.

4. Create any of the five triage labels the GitHub repo lacks:
   `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
   `wontfix` (`gh label create`).

5. Tell the user which skills now read the file, and that they can edit it
   directly rather than running this again.

<tracker-template>

# Issue tracker

Specs live in Linear. Tickets live in GitHub. One tracker for the shape of the
work, one for the units of it.

## Specs: Linear

- Team: `<team key>`
- The key is in the environment as `LINEAR_API_KEY`. Call the GraphQL API at
  `https://api.linear.app/graphql` directly; there is no CLI.
- Create a spec: `issueCreate` with the team id, the title and the body.
- Read a spec: `issue(id:)` for its title, description and comments.
- Apply `ready-for-agent` as a Linear label.

## Tickets: GitHub

- Repo: `<owner/name>`
- Use the `gh` CLI, which infers the repo inside a clone.
- Create: `gh issue create --title "..." --body "..."` with a heredoc body.
- Read: `gh issue view <n> --json number,title,body,labels,comments`.
- Sub-issue of a parent: `gh issue create --parent <n>`, or
  `gh issue edit <parent> --add-sub-issue <child>`.
- Blocking edge:
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`,
  where the database id comes from `gh api repos/<owner>/<repo>/issues/<n> --jq .id`.
- Label: `gh issue edit <n> --add-label "..."`.
- Every ticket body links the Linear spec it came from.

## When a skill says "publish the spec"

Create a Linear issue in the team above.

## When a skill says "publish the tickets"

Create GitHub issues in the repo above.

## Stack

Neon for the database, Clerk for users, secretdrop for handing a secret to a
machine. An alternative needs a reason written down; it is not the default.

</tracker-template>
