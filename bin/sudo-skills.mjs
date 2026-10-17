#!/usr/bin/env node
// sudo-skills — install this repo's skills into the runtimes on this machine.
//
//   sudo-skills install [--agents main,etch,icon] [--dry-run]
//   sudo-skills install --status
//   sudo-skills install claude-code openclaw
//
// The skills are linked, not copied, so an edit in this repo is the skill
// every agent runs on its next session.

import path from "node:path";
import process from "node:process";
import { existsSync } from "node:fs";
import {
  installClaudeCode, installOpenClaw, installStatus, agentCoverage,
  claudeConfigDir, openclawConfigFile, skillNames,
  PLUGIN_ID, VERSION,
} from "../lib/install.js";

const CORE = path.resolve(import.meta.dirname, "..");
const DEFAULT_AGENTS = ["main", "etch", "icon"];
const TARGETS = new Set(["claude-code", "openclaw"]);
const argv = process.argv.slice(2);

const die = (message) => {
  console.error(`sudo-skills: ${message}`);
  process.exit(2);
};

// Flags that stand alone, and flags that take a value. Anything else spelled
// --x stops the run: a mistyped --dry-run that got ignored would be a real
// install reported as a rehearsal.
const SWITCHES = new Set(["dry-run", "status", "help"]);
const VALUED = new Set(["agents"]);

/** One pass over the arguments, so an unknown flag cannot be read as nothing. */
function parse(args) {
  const switches = new Set();
  const values = new Map();
  const words = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      words.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s, 2);
    if (SWITCHES.has(name)) {
      if (inline !== undefined) die(`--${name} takes no value`);
      switches.add(name);
    } else if (VALUED.has(name)) {
      const value = inline ?? args[++i];
      if (!value || value.startsWith("--")) die(`--${name} needs a value`);
      values.set(name, value);
    } else {
      die(`unknown option "${arg}"`);
    }
  }
  return { switches, values, words };
}

const { switches, values, words } = parse(argv);
const has = (name) => switches.has(name);

/** The agents the entry is for, or null when the run did not name any. */
function agentIds() {
  const given = values.get("agents");
  if (!given) return null;
  const ids = given.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) die("--agents needs at least one agent id");
  return ids;
}

/** Which runtimes are on this machine, so `install` with no target works. */
function detect() {
  const found = [];
  if (existsSync(claudeConfigDir())) found.push("claude-code");
  if (existsSync(openclawConfigFile())) found.push("openclaw");
  return found;
}

function report(label, result, dryRun) {
  if (!result.ok) {
    console.log(`${label}: ${result.reason}`);
    return false;
  }
  if (!result.changed) {
    console.log(`${label}: already installed, nothing to change`);
    return true;
  }
  const verb = dryRun ? "would write" : "wrote";
  console.log(`${label}: ${verb} ${result.wrote.length} path${result.wrote.length === 1 ? "" : "s"}`);
  for (const w of result.wrote) console.log(`  ${verb === "wrote" ? "+" : "~"} ${w}`);
  if (result.note) console.log(`  note: ${result.note}`);
  return true;
}

function showStatus() {
  const rows = installStatus({ core: CORE, ids: agentIds() ?? DEFAULT_AGENTS });
  console.log(`${PLUGIN_ID} ${VERSION} at ${CORE}`);
  console.log(`${skillNames(CORE).length} skills: ${skillNames(CORE).join(", ")}`);
  for (const r of rows) {
    const name = r.agent ? `${r.runtime} (${r.agent})` : r.runtime;
    console.log(`\n${name}: ${r.installed ? "installed" : "not installed"}`);
    console.log(`  where: ${r.where}`);
    if (r.release) console.log(`  release: ${r.release}`);
    if (r.agents) console.log(`  agents: ${r.agents.join(", ")}`);
    if (r.problem) console.log(`  problem: ${r.problem}`);
  }
}

function install() {
  const dryRun = has("dry-run");
  const asked = words.slice(1);
  for (const target of asked) if (!TARGETS.has(target)) die(`unknown target "${target}": use claude-code or openclaw`);
  const targets = asked.length ? asked : detect();
  if (!targets.length) die("found no runtime to install into; pass claude-code or openclaw");

  // Only a run that named agents sends them, so a later plain run cannot widen
  // an entry the operator narrowed. The default applies to a first install.
  const named = agentIds();
  const ids = named ?? DEFAULT_AGENTS;
  console.log(`${PLUGIN_ID} ${VERSION} from ${CORE}${dryRun ? " \u2014 dry run, nothing will be written" : ""}`);
  console.log(`${skillNames(CORE).length} skills, linked rather than copied\n`);

  let allOk = true;
  let gateway = null;
  for (const target of targets) {
    if (target === "claude-code") {
      allOk = report("claude-code", installClaudeCode({ core: CORE, dryRun }), dryRun) && allOk;
    } else if (target === "openclaw") {
      gateway = installOpenClaw({ core: CORE, ...(named ? { agents: named } : {}), agentsDefault: DEFAULT_AGENTS, dryRun });
      allOk = report("openclaw", gateway, dryRun) && allOk;
    }
  }
  // One gateway entry carries the skills to every agent named in it, so the
  // agents are reported rather than installed into one at a time. The report
  // comes from the entry this install would leave behind, not from the request.
  if (gateway?.ok) {
    const entry = gateway.entry ?? {};
    const filter = entry.config?.agents ?? null;
    const off = entry.enabled === false;
    console.log(`\nagents${dryRun ? " (after this install)" : ""}:`);
    for (const row of agentCoverage({ core: CORE, ids: filter ?? ids })) {
      const covered = !off && (!filter || filter.includes(row.agent));
      const why = off ? "the entry is disabled, and this install keeps it disabled" : "not named in the entry";
      console.log(`  ${row.agent}: ${covered ? `reads ${CORE}/skills via the gateway entry` : why}`);
      console.log(`    workspace: ${row.workspace} (nothing written there)`);
    }
  }

  if (!allOk) process.exit(1);
}

function help() {
  console.log(`sudo-skills ${VERSION} — install the sudo skills into this machine's runtimes

  sudo-skills install [<target>…]   claude-code, openclaw; both detected when none given
      --agents <a,b,c>              which gateway agents the entry is for (default: ${DEFAULT_AGENTS.join(",")})
      --dry-run                     report the change and write nothing
      --status                      what is installed where
  sudo-skills status                the same report
  sudo-skills help

Skills are linked from ${CORE}/skills, and the gateway entry points at the same
directory, so editing a skill here changes it for every agent with no second
install and no copy in any workspace. Nothing already in a skills directory is
removed or overwritten: a name that is taken stops the install and says so.`);
}

const command = words[0] ?? "help";
if (has("help") || command === "help") help();
else if (command === "status") showStatus();
else if (command === "install") (has("status") ? showStatus() : install());
else die(`unknown command "${command}": use install, status or help`);
