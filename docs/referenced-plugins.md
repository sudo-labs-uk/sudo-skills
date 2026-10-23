# Plugins sudo references rather than carries

Three sets of skills belong to the sudo workflow but are not in this repo. Each is
installed separately.

| Skill set | Where it comes from | Why it is not here |
|---|---|---|
| Impeccable (design) | `pbakaus/impeccable`, Apache-2.0, shipping at 4.5.2 | Vendoring freezes it at one version and adds attribution work for a skill sudo does not edit. |
| `agent-problem-solving` (`focus`, `frame-problem`, `reframe`, `close-problem`) | A separate agent-problem-solving plugin, MIT | Already an enabled plugin. Copying it here would put two of each skill in front of the same agents. Whether sudo vendors it or depends on it remains open. |
| `cairn` | A separate plugin in the private `Rendiere/cairn` repository, listed beside sudo-skills in the `sudo` marketplace | It is its own product with its own release cycle; the marketplace installs it as `cairn@sudo`. |

An agent running the full workflow needs sudo, Impeccable, and its existing
agent-problem-solving plugin.
