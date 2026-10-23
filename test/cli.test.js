// The command line. Two things it must never do: widen an agent filter the
// operator narrowed, and treat a mistyped flag as nothing, because a typo of
// --dry-run would then be a real install reported as a rehearsal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const CORE = path.resolve(import.meta.dirname, "..");
const CLI = path.join(CORE, "bin", "sudo-skills.mjs");

/** A machine with its own Claude Code directory and its own gateway config. */
function machine() {
  const root = mkdtempSync(path.join(tmpdir(), "sudo-cli-"));
  const claude = path.join(root, "claude");
  const state = path.join(root, "openclaw");
  mkdirSync(claude, { recursive: true });
  mkdirSync(state, { recursive: true });
  writeFileSync(path.join(state, "openclaw.json"), `${JSON.stringify({
    agents: { defaults: { workspace: path.join(root, "workspace") }, list: [{ id: "main" }, { id: "etch" }, { id: "icon" }] },
    plugins: { entries: { brave: { enabled: true } }, load: { paths: [] } },
  }, null, 2)}\n`);
  mkdirSync(path.join(root, "workspace"), { recursive: true });
  return { root, claude, config: path.join(state, "openclaw.json"), env: { ...process.env, CLAUDE_CONFIG_DIR: claude, OPENCLAW_STATE_DIR: state } };
}

const run = (m, ...args) => spawnSync(process.execPath, [CLI, ...args], { env: m.env, encoding: "utf8" });
const entry = (m) => JSON.parse(readFileSync(m.config, "utf8")).plugins.entries.sudo;

test("a plain install after a narrowed one keeps the narrower agent list", () => {
  const m = machine();
  assert.equal(run(m, "install", "openclaw", "--agents", "etch").status, 0);
  assert.deepEqual(entry(m).config.agents, ["etch"]);

  const again = run(m, "install", "openclaw");
  assert.equal(again.status, 0);
  assert.deepEqual(entry(m).config.agents, ["etch"], "a plain re-run widened the filter");
  assert.match(again.stdout, /already installed, nothing to change/);
});

test("a mistyped flag stops the run instead of being ignored", () => {
  for (const bad of ["--dryrun", "--dry_run", "--dry-run=true", "--verbose"]) {
    const m = machine();
    const r = run(m, "install", bad);
    assert.equal(r.status, 2, `${bad} did not stop the run`);
    assert.match(r.stderr, /unknown option|takes no value/);
    assert.equal(existsSync(path.join(m.claude, "skills")), false, `${bad} installed anyway`);
    assert.equal(entry(m), undefined);
  }
});

test("--agents=etch is read the same as --agents etch", () => {
  const m = machine();
  assert.equal(run(m, "install", "openclaw", "--agents=etch").status, 0);
  assert.deepEqual(entry(m).config.agents, ["etch"]);
});

test("a dry run writes nothing and reports what the install would leave", () => {
  const m = machine();
  const before = readFileSync(m.config, "utf8");
  const r = run(m, "install", "--dry-run");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /dry run, nothing will be written/);
  assert.match(r.stdout, /main: reads .*\/skills via the gateway entry/);
  assert.equal(readFileSync(m.config, "utf8"), before);
  assert.equal(existsSync(path.join(m.claude, "skills")), false);
  assert.equal(readdirSync(path.join(m.root, "workspace")).length, 0);
});

test("a dry run against a disabled entry says the install keeps it disabled", () => {
  const m = machine();
  run(m, "install", "openclaw");
  const data = JSON.parse(readFileSync(m.config, "utf8"));
  data.plugins.entries.sudo.enabled = false;
  writeFileSync(m.config, `${JSON.stringify(data, null, 2)}\n`);
  const r = run(m, "install", "openclaw", "--dry-run");
  assert.match(r.stdout, /the entry is disabled, and this install keeps it disabled/);
});

test("install writes the gateway entry and no Claude Code skills, and a second run changes nothing", () => {
  const m = machine();
  const first = run(m, "install");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(existsSync(path.join(m.claude, "skills")), false, "Claude Code got bare skill links");
  assert.equal(entry(m).enabled, true);
  assert.deepEqual(entry(m).config.agents, ["main", "etch", "icon"]);

  const second = run(m, "install");
  assert.equal(second.status, 0);
  assert.equal((second.stdout.match(/already installed, nothing to change/g) ?? []).length, 1);
});

test("asking for the claude-code target points at the plugin install", () => {
  const m = machine();
  const r = run(m, "install", "claude-code");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /claude plugin install sudo-skills@sudo/);
  assert.equal(existsSync(path.join(m.claude, "skills")), false);
});
