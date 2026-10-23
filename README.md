# sudo

![What sudo is built on: a grafted tree. The stack it assumes is the soil, a pinned copy of a skill flow is the rootstock, five third-party skills are grafted onto it, sudo's carried and separately referenced skills grow in the canopy, and a dashed arrow marks the planned fork sync.](docs/images/what-sudo-is-built-on.svg)

sudo holds the skills three agents use for product work. They read this directory,
so editing a skill here changes what each agent runs in its next session.

Any agent running a sudo skill can propose a change to it. The `improve-skill` skill
turns a lesson from a session into a pull request against `main`, made from a worktree
so the shared checkout every agent reads is never edited in place. A change reaches the
agents once the maintainer merges it and the checkout pulls.

Matt Pocock's skill flow is the rootstock, copied at a pinned upstream commit. Five
skills from other makers are grafted onto it and keep their own licences. sudo's own
skills are the new growth at the top. The stack sudo assumes is the ground. A fork
and a reviewed upstream-sync command are planned; the diagram marks that path as
planned rather than shipped.

## Install

```sh
node bin/sudo-skills.mjs install --dry-run   # report, write nothing
node bin/sudo-skills.mjs install             # Claude Code and the OpenClaw gateway
node bin/sudo-skills.mjs status              # what is installed where
```

The installer writes to two targets. It creates a symlink per skill in
`~/.claude/skills` for Claude Code, plus a `sudo-install.json` naming the release.
For the OpenClaw gateway it writes one load path pointing at this checkout and one
entry listing the agents. That single entry gives the skills to every listed agent, so
the installer writes nothing into any agent workspace.

The installer changes nothing when run a second time and reports that result. It
creates a dated backup beside any file it edits and changes only the keys it owns.
Every other plugin's entry, every other load path and its position, and any disabled
`sudo` entry all survive. It stops rather than overwriting a skill name already taken,
and it stops if it cannot parse the gateway config.

Disable separately installed copies of `humanizer` or `no-slop` before installing
sudo. The installer catches a duplicate under `~/.claude/skills`, but a separately
loaded plugin can expose the same name without using that directory.

Passing `--agents` sets which agents the entry is for. A plain re-run keeps whatever
list is already there and cannot widen one that was narrowed. The installer writes the
gateway config as two-space JSON, so a config in another layout comes back reindented.

## The skills

Seven come from Matt Pocock's set (MIT): `grill-with-docs`, `to-spec`, `to-tickets`,
`implement-spec`, `tdd`, `code-review`, `pr`. sudo's copies write specs to Linear
and open tickets as GitHub issues that reference the spec.

Five are copied from other makers. `design-is` and `pathfinder` come from
claude-mem (Apache-2.0), `show-me` from HumanLayer (MIT). Two more cover prose:
`humanizer` (MIT) removes AI writing patterns from a draft, and `no-slop` (MIT)
tests each sentence for clarity. The planned product-work sequence will require both
passes before a spec, ticket, PR body or repository document is published. Each
skill's `UPSTREAM.md` lists what sudo changed, if anything.

Five are sudo's own: `sudo-setup` configures a repo's Linear team and GitHub repo
once, `verify` drives the running app and screenshots what a user sees, `audit` checks
a finished change against its ticket's acceptance criteria from a fresh session,
`cut-release` tags and publishes, and `improve-skill` turns a lesson about any of
these skills into a pull request on this repo.

Impeccable, `agent-problem-solving` and `cairn` are installed separately. See
[docs/referenced-plugins.md](docs/referenced-plugins.md) for the reason in each case.

## Vendored work

Every vendored skill directory carries its upstream licence and an `UPSTREAM.md`
naming the repo, the path, the commit it was taken at, and what sudo changed.
The two Apache-2.0 skills also carry the upstream `NOTICE`. The seven Pocock skill
directories record the commit that a future fork will use as its merge base.

## Tests

```sh
npm test
```

The tests check the links point back at this checkout, and that a second run and a dry
run both write nothing. They also check what the installer must preserve: another
plugin's entry and load-path order survive with a backup beside the file, a disabled
entry stays disabled, an agent filter survives a plain re-run, a symlink config stays a
symlink, and a skill directory created by someone else is never replaced. An
unparseable config stops the install before any write. The command-line flags have
their own tests; a mistyped `--dry-run` must stop the run rather than installing. A
provenance test checks that every known vendored skill carries its licence and upstream
record, including the two Apache notices.
