---
name: cut-release
description: "Cut a release: check the branch is clean and green, work out the version from what changed, write the notes from the merged work, tag it, and publish."
disable-model-invocation: true
---

# Cut a release

## Process

1. Check the ground. The working tree is clean, you are on the default branch,
   it is up to date with the remote, and CI is green on that commit
   (`gh run list --branch <default> --limit 1`). Any of those failing stops the
   release.

2. List what is in it: `git log <last-tag>..HEAD --oneline`, plus the tickets
   those commits close.

3. Work out the version. A breaking change to anything another repo or agent
   depends on is a major. A new capability is a minor. Everything else is a
   patch. Say which one you picked and why, and confirm it with the user before
   you tag: one question through the `ask` skill, your pick first.

4. Write the notes as what changed for whoever uses this, grouped under Added,
   Changed, Fixed. One line each, no commit hashes, no internal refactors that
   nobody outside the repo can see.

5. Bump the version wherever the repo keeps it, commit that, tag it
   `v<version>`, and push the commit and the tag.

6. Publish the release with the notes (`gh release create`), and report the tag,
   the notes and the tickets it closed.

## Rules

- Never tag a red commit or a dirty tree.
- The notes are for a reader, not a changelog dump.
- Where the repo publishes a package, the publish happens after the tag, never
  before.
