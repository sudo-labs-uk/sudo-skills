// The installer. Someone running it has not read the source, so every target
// follows the same four rules: back up what it changes, change only the keys
// sudo owns, do nothing on a second run, and write nothing under --dry-run.
//
// And one rule of sudo's own: skills are linked, never copied, so an edit in
// this repo reaches every agent without a second install.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync,
  readdirSync, lstatSync, readlinkSync, symlinkSync, renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  skillNames, linkSkills, installClaudeCode, installOpenClaw,
  agentCoverage, gatewayAgents, installStatus, PLUGIN_ID, VERSION,
} from "../lib/install.js";

const CORE = path.resolve(import.meta.dirname, "..");
const temp = (tag) => mkdtempSync(path.join(tmpdir(), `sudo-${tag}-`));
const backupOf = (result) => {
  const found = result.wrote.find((w) => w.includes(".bak-"));
  assert.ok(found, `no backup among ${result.wrote.join(", ")}`);
  return found;
};
const json = (f) => JSON.parse(readFileSync(f, "utf8"));

/** A gateway config holding entries sudo does not own. */
function gateway({ agents = true } = {}) {
  const dir = temp("gw");
  const file = path.join(dir, "openclaw.json");
  // Written with four-space indentation on purpose: sudo re-serializes the file,
  // so a fixture in sudo's own format would let a formatting change pass unseen.
  writeFileSync(file, `${JSON.stringify({
    agents: {
      defaults: { workspace: path.join(dir, "workspace") },
      list: [{ id: "main" }, { id: "etch", workspace: path.join(dir, "workspace-etch") }, { id: "icon", workspace: path.join(dir, "workspace-icon") }],
    },
    plugins: {
      entries: { brave: { enabled: true, config: { key: "keep me", retries: 3 } } },
      load: { paths: ["/opt/skills/agent-problem-solving"] },
    },
  }, null, 4)}\n`);
  if (agents) for (const w of ["workspace", "workspace-etch", "workspace-icon"]) mkdirSync(path.join(dir, w), { recursive: true });
  return { dir, file };
}

// ------------------------------------------------------------- the skill set

test("the skill set is every directory holding a SKILL.md", () => {
  const names = skillNames(CORE);
  for (const expected of ["ask", "audit", "code-review", "codebase-design", "cut-release", "design-is", "domain-modeling", "grill-with-docs", "grilling", "humanizer", "implement-spec", "improve-skill", "no-slop", "pathfinder", "pr", "show-me", "stop-slop", "sudo-setup", "tdd", "to-spec", "to-tickets", "verify"]) {
    assert.ok(names.includes(expected), `${expected} missing from ${names.join(", ")}`);
  }
});

test("every vendored skill carries its licence and provenance", () => {
  const vendored = [
    "code-review", "codebase-design", "design-is", "domain-modeling", "grill-with-docs", "grilling", "humanizer",
    "implement-spec", "no-slop", "pathfinder", "pr", "show-me", "stop-slop", "tdd", "to-spec", "to-tickets",
  ];
  for (const name of vendored) {
    const dir = path.join(CORE, "skills", name);
    assert.ok(existsSync(path.join(dir, "UPSTREAM.md")), `${name} has no provenance record`);
    assert.ok(existsSync(path.join(dir, "LICENSE")), `${name} has provenance but no licence`);
  }
  for (const name of ["design-is", "pathfinder"]) {
    assert.ok(existsSync(path.join(CORE, "skills", name, "NOTICE")), `${name} has no Apache notice`);
  }
});

test("every skill that puts a question to the user routes it through ask", () => {
  for (const name of ["grilling", "grill-with-docs", "to-spec", "to-tickets", "design-is", "code-review", "tdd", "sudo-setup", "cut-release"]) {
    const body = readFileSync(path.join(CORE, "skills", name, "SKILL.md"), "utf8");
    assert.match(body, /`ask` skill/, `${name} asks the user without the ask skill`);
  }
  const grilling = readFileSync(path.join(CORE, "skills", "grilling", "SKILL.md"), "utf8");
  assert.doesNotMatch(grilling, /Ask the whole frontier/, "grilling still asks a round at a time");
  const setup = readFileSync(path.join(CORE, "skills", "sudo-setup", "SKILL.md"), "utf8");
  assert.doesNotMatch(setup, /in one message/, "sudo-setup still asks everything in one message");
});

// -------------------------------------------------------------- Claude Code

test("Claude Code gets a link to every skill, pointing back at this repo", () => {
  const dir = temp("cc");
  const r = installClaudeCode({ core: CORE, configDir: dir });
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  const linked = readdirSync(path.join(dir, "skills")).sort();
  assert.deepEqual(linked, skillNames(CORE));
  for (const name of linked) {
    const link = path.join(dir, "skills", name);
    assert.ok(lstatSync(link).isSymbolicLink(), `${name} is a copy, not a link`);
    assert.equal(readlinkSync(link), path.join(CORE, "skills", name));
  }
});

test("Claude Code records which release is installed", () => {
  const dir = temp("cc");
  installClaudeCode({ core: CORE, configDir: dir });
  const record = json(path.join(dir, "sudo-install.json"));
  assert.equal(record.plugin, PLUGIN_ID);
  assert.equal(record.version, VERSION);
  assert.equal(record.core, CORE);
});

test("a second Claude Code run changes nothing and says so", () => {
  const dir = temp("cc");
  installClaudeCode({ core: CORE, configDir: dir });
  const again = installClaudeCode({ core: CORE, configDir: dir });
  assert.equal(again.ok, true);
  assert.equal(again.changed, false);
  assert.deepEqual(again.wrote, []);
});

test("a Claude Code dry run reports the links and writes nothing", () => {
  const dir = temp("cc");
  const r = installClaudeCode({ core: CORE, configDir: dir, dryRun: true });
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  assert.ok(r.wrote.length > skillNames(CORE).length - 1);
  assert.equal(existsSync(path.join(dir, "skills")), false);
  assert.equal(existsSync(path.join(dir, "sudo-install.json")), false);
});

test("a skill name already taken by something else stops the install", () => {
  const dir = temp("cc");
  mkdirSync(path.join(dir, "skills", "verify"), { recursive: true });
  writeFileSync(path.join(dir, "skills", "verify", "SKILL.md"), "someone else's\n");
  const r = installClaudeCode({ core: CORE, configDir: dir });
  assert.equal(r.ok, false);
  assert.match(r.reason, /verify/);
  // Nothing was half-installed beside it.
  assert.deepEqual(readdirSync(path.join(dir, "skills")), ["verify"]);
  assert.equal(readFileSync(path.join(dir, "skills", "verify", "SKILL.md"), "utf8"), "someone else's\n");
});

// ----------------------------------------------------------------- OpenClaw

test("OpenClaw gets one load path and one entry, and keeps everyone else's", () => {
  const { file } = gateway();
  const before = readFileSync(file, "utf8");
  const r = installOpenClaw({ core: CORE, configFile: file, agents: ["main", "etch", "icon"] });
  assert.equal(r.ok, true);
  const after = json(file);
  assert.deepEqual(after.plugins.entries.brave, { enabled: true, config: { key: "keep me", retries: 3 } }, "another plugin's entry changed");
  assert.deepEqual(after.agents, json(backupOf(r)).agents, "the agents section changed");
  assert.ok(after.plugins.load.paths.includes("/opt/skills/agent-problem-solving"));
  assert.ok(after.plugins.load.paths.includes(CORE));
  assert.deepEqual(after.plugins.entries.sudo.config.agents, ["main", "etch", "icon"]);
  assert.equal(after.plugins.entries.sudo.config.release, VERSION);
  assert.equal(after.plugins.entries.sudo.enabled, true);
  // The file it changed has a backup holding exactly what was there before.
  assert.equal(readFileSync(backupOf(r), "utf8"), before);
});

test("a second OpenClaw run changes nothing and says so", () => {
  const { file } = gateway();
  installOpenClaw({ core: CORE, configFile: file, agents: ["main", "etch", "icon"] });
  const snapshot = readFileSync(file, "utf8");
  const again = installOpenClaw({ core: CORE, configFile: file, agents: ["main", "etch", "icon"] });
  assert.equal(again.changed, false);
  assert.deepEqual(again.wrote, []);
  assert.equal(readFileSync(file, "utf8"), snapshot);
});

test("a re-run with no agents keeps the agent filter, and keeps a disabled entry off", () => {
  const { file } = gateway();
  installOpenClaw({ core: CORE, configFile: file, agents: ["etch"] });
  const data = json(file);
  data.plugins.entries.sudo.enabled = false;
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  installOpenClaw({ core: CORE, configFile: file });
  const after = json(file);
  assert.deepEqual(after.plugins.entries.sudo.config.agents, ["etch"]);
  assert.equal(after.plugins.entries.sudo.enabled, false);
});

test("an OpenClaw dry run writes nothing", () => {
  const { file } = gateway();
  const before = readFileSync(file, "utf8");
  const r = installOpenClaw({ core: CORE, configFile: file, agents: ["main"], dryRun: true });
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  assert.equal(readFileSync(file, "utf8"), before);
  assert.equal(readdirSync(path.dirname(file)).filter((f) => f.includes(".bak-")).length, 0);
});

test("a gateway config that is not there, or not JSON, stops the install", () => {
  const dir = temp("gw");
  const missing = installOpenClaw({ core: CORE, configFile: path.join(dir, "openclaw.json"), agents: ["main"] });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /no gateway config/);

  const broken = path.join(dir, "broken.json");
  writeFileSync(broken, "{ not json\n");
  const r = installOpenClaw({ core: CORE, configFile: broken, agents: ["main"] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /could not be read as JSON/);
  assert.equal(readFileSync(broken, "utf8"), "{ not json\n");
});

// ------------------------------------------------------------- the agents

test("one gateway entry covers all three agents, with the workspace each runs in", () => {
  const { dir, file } = gateway();
  const agents = gatewayAgents({ configFile: file, ids: ["main", "etch", "icon"] });
  assert.deepEqual(agents.map((a) => a.id), ["main", "etch", "icon"]);
  assert.equal(agents[0].workspace, path.join(dir, "workspace"), "main runs in the default workspace");
  assert.equal(agents[1].workspace, path.join(dir, "workspace-etch"));

  const before = agentCoverage({ core: CORE, configFile: file, ids: ["main", "etch", "icon"] });
  assert.deepEqual(before.map((r) => r.covered), [false, false, false]);

  installOpenClaw({ core: CORE, configFile: file, agents: ["main", "etch", "icon"] });
  const after = agentCoverage({ core: CORE, configFile: file, ids: ["main", "etch", "icon"] });
  assert.deepEqual(after.map((r) => r.covered), [true, true, true]);
  // Every agent reads the same checkout, so an edit here needs no second install.
  assert.deepEqual([...new Set(after.map((r) => r.via))], [CORE]);
  assert.deepEqual([...new Set(after.map((r) => r.release))], [VERSION]);
});

test("an agent outside the entry's filter is not covered", () => {
  const { file } = gateway();
  installOpenClaw({ core: CORE, configFile: file, agents: ["etch", "icon"] });
  const rows = agentCoverage({ core: CORE, configFile: file, ids: ["main", "etch", "coach"] });
  assert.deepEqual(rows.map((r) => [r.agent, r.covered]), [["main", false], ["etch", true], ["coach", false]]);
});

test("a disabled entry covers nobody", () => {
  const { file } = gateway();
  installOpenClaw({ core: CORE, configFile: file, agents: ["main"] });
  const data = json(file);
  data.plugins.entries.sudo.enabled = false;
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  assert.equal(agentCoverage({ core: CORE, configFile: file, ids: ["main"] })[0].covered, false);
});

test("the installer writes nothing into any agent workspace", () => {
  const { dir, file } = gateway();
  installOpenClaw({ core: CORE, configFile: file, agents: ["main", "etch", "icon"] });
  for (const w of ["workspace", "workspace-etch", "workspace-icon"]) {
    assert.deepEqual(readdirSync(path.join(dir, w)), [], `${w} was written into`);
  }
});

// ------------------------------------------------------------------- status

test("status reads what is in place from the files themselves", () => {
  const { file } = gateway();
  const cc = temp("cc");
  const before = installStatus({ core: CORE, configFile: file, configDir: cc, ids: ["main", "etch"] });
  assert.equal(before.find((r) => r.runtime === "openclaw").installed, false);
  assert.equal(before.find((r) => r.runtime === "claude-code").installed, false);

  installOpenClaw({ core: CORE, configFile: file, agents: ["main", "etch"] });
  installClaudeCode({ core: CORE, configDir: cc });
  const after = installStatus({ core: CORE, configFile: file, configDir: cc, ids: ["main", "etch"] });
  assert.equal(after.find((r) => r.runtime === "openclaw").installed, true);
  assert.equal(after.find((r) => r.runtime === "openclaw").release, VERSION);
  assert.equal(after.find((r) => r.runtime === "claude-code").installed, true);
  const agents = after.filter((r) => r.runtime === "agent");
  assert.deepEqual(agents.map((r) => [r.agent, r.installed]), [["main", true], ["etch", true]]);
});

// ------------------------------------------------------- linking, on its own

test("linkSkills refuses a link that points somewhere else and writes nothing", () => {
  const dir = temp("link");
  mkdirSync(dir, { recursive: true });
  const r = linkSkills(CORE, dir);
  assert.equal(r.changed, true);
  assert.deepEqual(r.conflicts, []);
  const second = linkSkills(CORE, dir);
  assert.equal(second.changed, false);
});

// ------------------------------------------- what an install must not break

test("a link pointing at something else stops the install, and nothing is written", () => {
  const dir = temp("link");
  const elsewhere = temp("other");
  symlinkSync(elsewhere, path.join(dir, "verify"));
  const r = linkSkills(CORE, dir);
  assert.equal(r.changed, false);
  assert.deepEqual(r.wrote, []);
  assert.equal(r.conflicts.length, 1);
  assert.match(r.conflicts[0], /verify is a link to/);
  assert.deepEqual(readdirSync(dir), ["verify"], "nothing else was linked beside it");
  assert.equal(readlinkSync(path.join(dir, "verify")), elsewhere);
});

test("a link to another checkout of sudo is replaced by one to this checkout", () => {
  const dir = temp("link");
  const old = temp("old-checkout");
  mkdirSync(path.join(old, "skills", "verify"), { recursive: true });
  writeFileSync(path.join(old, "package.json"), '{"name":"sudo-skills"}\n');
  symlinkSync(path.join(old, "skills", "verify"), path.join(dir, "verify"));
  const r = linkSkills(CORE, dir);
  assert.equal(r.ok ?? true, true);
  assert.deepEqual(r.conflicts, []);
  assert.equal(readlinkSync(path.join(dir, "verify")), path.join(CORE, "skills", "verify"));
});

test("a relative link is judged against its own directory, not the current one", () => {
  const dir = temp("link");
  mkdirSync(path.join(dir, "elsewhere"), { recursive: true });
  symlinkSync("./elsewhere", path.join(dir, "verify"));
  const r = linkSkills(CORE, dir);
  assert.equal(r.changed, false);
  assert.match(r.conflicts[0], /verify is a link to/);
});

test("a load path already in place keeps its position, so no other plugin is reordered", () => {
  const { file } = gateway();
  const data = json(file);
  data.plugins.load.paths = [CORE, "/opt/skills/agent-problem-solving"];
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  installOpenClaw({ core: CORE, configFile: file, agents: ["main"] });
  assert.deepEqual(json(file).plugins.load.paths, [CORE, "/opt/skills/agent-problem-solving"]);
});

test("another checkout of sudo is dropped from the load paths, and a stranger's sudo directory is kept", () => {
  const { file } = gateway();
  const old = temp("old-checkout");
  writeFileSync(path.join(old, "package.json"), '{"name":"sudo-skills"}\n');
  const stranger = temp("stranger");
  mkdirSync(path.join(stranger, "sudo"), { recursive: true });
  writeFileSync(path.join(stranger, "sudo", "package.json"), '{"name":"someone-elses-sudo"}\n');
  const data = json(file);
  data.plugins.load.paths = [old, path.join(stranger, "sudo")];
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  installOpenClaw({ core: CORE, configFile: file, agents: ["main"] });
  assert.deepEqual(json(file).plugins.load.paths, [path.join(stranger, "sudo"), CORE]);
});

test("a plugins key of the wrong shape stops the install rather than being overwritten", () => {
  for (const [key, value] of [["plugins", "nope"], ["load", 7], ["paths", "one-path"]]) {
    const { file } = gateway();
    const data = json(file);
    if (key === "plugins") data.plugins = value;
    else if (key === "load") data.plugins.load = value;
    else data.plugins.load.paths = value;
    const before = `${JSON.stringify(data, null, 2)}\n`;
    writeFileSync(file, before);
    const r = installOpenClaw({ core: CORE, configFile: file, agents: ["main"] });
    assert.equal(r.ok, false, `${key} was accepted`);
    assert.match(r.reason, /will not overwrite it/);
    assert.equal(readFileSync(file, "utf8"), before);
  }
});

test("a config that is a symlink is followed, so the real file keeps receiving changes", () => {
  const { dir, file } = gateway();
  const real = path.join(dir, "dotfiles-openclaw.json");
  renameSync(file, real);
  symlinkSync(real, file);
  const r = installOpenClaw({ core: CORE, configFile: file, agents: ["main"] });
  assert.equal(r.ok, true);
  assert.ok(lstatSync(file).isSymbolicLink(), "the link was replaced by a plain file");
  assert.equal(json(real).plugins.entries.sudo.config.release, VERSION);
});

test("a first install gets the default agent list, and a named one overrides it", () => {
  const { file } = gateway();
  installOpenClaw({ core: CORE, configFile: file, agentsDefault: ["main", "etch", "icon"] });
  assert.deepEqual(json(file).plugins.entries.sudo.config.agents, ["main", "etch", "icon"]);
  installOpenClaw({ core: CORE, configFile: file, agents: ["etch"], agentsDefault: ["main", "etch", "icon"] });
  assert.deepEqual(json(file).plugins.entries.sudo.config.agents, ["etch"]);
  // The default never widens the filter the second run narrowed.
  installOpenClaw({ core: CORE, configFile: file, agentsDefault: ["main", "etch", "icon"] });
  assert.deepEqual(json(file).plugins.entries.sudo.config.agents, ["etch"]);
});
