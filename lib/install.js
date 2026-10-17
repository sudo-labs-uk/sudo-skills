// The installer.
//
// Every target follows the same four rules, because someone running this has
// not read the source and should not have to trust it:
//   - back up any file that already exists before changing it
//   - change only the keys sudo owns, and leave the rest byte-identical
//   - do nothing on a second run, and say so
//   - with dryRun, report the same thing and write nothing
//
// And one rule of sudo's own: a skill is linked, never copied. Three agents
// read the same directory in this repo, so a skill edited here is the skill
// every agent runs on its next session, with no second install.
//
// A file that cannot be parsed stops the install. Overwriting someone's
// gateway config because we could not read it is the one outcome worth
// refusing.

import {
  readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync,
  readdirSync, symlinkSync, lstatSync, readlinkSync, renameSync, statSync,
  chmodSync, unlinkSync, realpathSync, constants as fsConstants,
} from "node:fs";
import path from "node:path";
import os from "node:os";

export const PLUGIN_ID = "sudo";
/** The file each runtime gets, recording the release it is running. */
export const RECORD_FILE = "sudo-install.json";

const CORE_ROOT = path.resolve(import.meta.dirname, "..");
export const VERSION = JSON.parse(readFileSync(path.join(CORE_ROOT, "package.json"), "utf8")).version;

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(".", "");
const home = (env) => (env.HOME ? path.resolve(env.HOME) : os.homedir());

function ok(wrote, changed = true, extra = {}) {
  return { ok: true, changed, wrote, ...extra };
}
const fail = (reason) => ({ ok: false, changed: false, wrote: [], reason });

/** Read JSON, telling the difference between "not there" and "not readable". */
function readJson(file) {
  if (!existsSync(file)) return { data: {}, existed: false };
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    return { error: `${file} could not be read: ${err.message}` };
  }
  if (!text.trim()) return { data: {}, existed: true };
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return { error: `${file} could not be read as JSON: it is not an object` };
    return { data, existed: true };
  } catch (err) {
    return { error: `${file} could not be read as JSON: ${err.message}` };
  }
}

function backup(file) {
  const base = `${file}.bak-${stamp()}`;
  for (let n = 0; ; n += 1) {
    const target = n ? `${base}-${n}` : base;
    try {
      copyFileSync(file, target, fsConstants.COPYFILE_EXCL);
      return target;
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
    }
  }
}

/**
 * Write through a temp file and a rename, so a reader never sees half a file.
 *
 * A config that is a symlink into a dotfiles repo is followed first. Renaming
 * over the link would leave a plain file here and quietly stop the repo's copy
 * from being the one in use.
 */
function writeJson(target, data, { existed, dryRun }) {
  if (dryRun) return [target];
  const file = existed ? realpathSync(target) : target;
  const text = `${JSON.stringify(data, null, 2)}\n`;
  mkdirSync(path.dirname(file), { recursive: true });
  const wrote = [];
  if (existed) wrote.push(backup(file));
  const mode = existed ? statSync(file).mode & 0o7777 : 0o644;
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, text, { encoding: "utf8", mode, flag: "wx" });
  chmodSync(tmp, mode);
  renameSync(tmp, file);
  wrote.push(file);
  return wrote;
}

// --------------------------------------------------------------- the skills

/** Every directory under skills/ that holds a SKILL.md, in a stable order. */
export function skillNames(core) {
  try {
    return readdirSync(path.join(core, "skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(core, "skills", e.name, "SKILL.md")))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** Is this link one of ours, pointing at some other checkout of sudo? */
function ourLink(target, name, link) {
  // readlink can return a relative path, which means relative to the link's
  // own directory, not to wherever this process happens to be running.
  const resolved = path.resolve(path.dirname(link), target);
  if (!resolved.replaceAll("\\", "/").endsWith(`/skills/${name}`)) return false;
  const root = path.dirname(path.dirname(resolved));
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name === "sudo-skills";
  } catch {
    return false;
  }
}

/**
 * Link each skill into a runtime's skills directory.
 *
 * Nothing already there is ever removed. `verify` and `audit` are names anyone
 * might have used, and an agent keeps skills of its own beside sudo's, so a
 * name that is taken comes back as a conflict rather than a deletion. A link
 * this installer made to another checkout of sudo is replaced; anything else
 * stops the install, and a dry run reports it before any write happens.
 */
export function linkSkills(core, dir, { dryRun = false } = {}) {
  const wrote = [];
  const conflicts = [];
  const plan = [];
  for (const name of skillNames(core)) {
    const target = path.join(core, "skills", name);
    const link = path.join(dir, name);
    let current;
    try {
      current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : "";
    } catch {
      plan.push([target, link, false]);
      wrote.push(link);
      continue;
    }
    if (current === target) continue;
    if (current && ourLink(current, name, link)) {
      plan.push([target, link, true]);
      wrote.push(link);
      continue;
    }
    conflicts.push(current ? `${link} is a link to ${current}` : `${link} already exists and this install did not create it`);
  }
  if (conflicts.length) return { wrote: [], changed: false, conflicts };
  if (dryRun) return { wrote, changed: wrote.length > 0, conflicts: [] };
  if (plan.length) mkdirSync(dir, { recursive: true });
  for (const [target, link, replace] of plan) {
    try {
      if (replace) unlinkSync(link);
      symlinkSync(target, link);
    } catch (err) {
      // Another install got there first between the check and the write. If it
      // landed on the same target, the result is what we wanted anyway.
      if (err?.code !== "EEXIST") throw err;
      let current = "";
      try {
        current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : "";
      } catch {}
      if (current !== target) return { wrote: [], changed: false, conflicts: [`${link} appeared while installing`] };
    }
  }
  return { wrote, changed: wrote.length > 0, conflicts: [] };
}

/** The release record a runtime carries, so every agent can be asked what it runs. */
function writeRecord({ dir, core, dryRun }) {
  const file = path.join(dir, RECORD_FILE);
  const read = readJson(file);
  if (read.error) return { error: read.error };
  const record = { plugin: PLUGIN_ID, version: VERSION, core, installedAt: new Date().toISOString() };
  const was = read.data;
  if (read.existed && was.plugin === record.plugin && was.version === record.version && was.core === record.core) {
    return { wrote: [], changed: false, file };
  }
  return { wrote: writeJson(file, record, { existed: read.existed, dryRun }), changed: true, file };
}

const conflictReason = (conflicts) => `${conflicts.join("; ")}. Move or remove it, then run this again.`;

// ------------------------------------------------------------- Claude Code

export function claudeConfigDir(env = process.env) {
  if (env.CLAUDE_CONFIG_DIR) return path.resolve(env.CLAUDE_CONFIG_DIR);
  return path.join(home(env), ".claude");
}

/** Claude Code reads skills from its own directory, so it gets links and a record. */
export function installClaudeCode({ core, configDir = claudeConfigDir(), dryRun = false } = {}) {
  // The record is read before anything is linked. Failing afterwards would
  // leave the links in place while reporting that the install stopped.
  const existing = readJson(path.join(configDir, RECORD_FILE));
  if (existing.error) return fail(existing.error);
  const skills = linkSkills(core, path.join(configDir, "skills"), { dryRun });
  if (skills.conflicts?.length) return fail(conflictReason(skills.conflicts));
  const record = writeRecord({ dir: configDir, core, dryRun });
  if (record.error) return fail(record.error);
  if (!skills.changed && !record.changed) return ok([], false, { runtime: "claude-code", dir: configDir });
  return ok([...skills.wrote, ...record.wrote], true, { runtime: "claude-code", dir: configDir });
}

// ---------------------------------------------------------------- OpenClaw

export function openclawConfigFile(env = process.env) {
  const root = env.OPENCLAW_STATE_DIR ? path.resolve(env.OPENCLAW_STATE_DIR) : path.join(home(env), ".openclaw");
  return path.join(root, "openclaw.json");
}

/**
 * The gateway loads a plugin rather than running a command, so sudo installs
 * itself as one: a load path pointing at this repo, and one entry naming the
 * agents it is for.
 */
export function installOpenClaw({ core, configFile = openclawConfigFile(), agents = [], agentsDefault = [], dryRun = false } = {}) {
  const read = readJson(configFile);
  if (read.error) return fail(read.error);
  if (!read.existed) return fail(`no gateway config at ${configFile}`);

  const before = JSON.stringify(read.data);
  const data = JSON.parse(before);
  if (data.plugins !== undefined && (typeof data.plugins !== "object" || data.plugins === null || Array.isArray(data.plugins))) {
    return fail(`${configFile} has a plugins key that is not an object; sudo will not overwrite it`);
  }
  const plugins = (data.plugins ??= {});
  if (plugins.load !== undefined && (typeof plugins.load !== "object" || plugins.load === null || Array.isArray(plugins.load))) {
    return fail(`${configFile} has a plugins.load key that is not an object; sudo will not overwrite it`);
  }
  const load = (plugins.load ??= {});
  if (load.paths !== undefined && !Array.isArray(load.paths)) {
    return fail(`${configFile} has a plugins.load.paths that is not a list; sudo will not overwrite it`);
  }
  const paths = load.paths ?? [];
  // Another checkout of sudo is replaced, because two load paths for one plugin
  // id is not a state the gateway can resolve. A checkout is recognised by its
  // package name, not by its directory name: /opt/plugins/sudo belonging to
  // someone else must survive. An already-correct path keeps its position, so a
  // re-run cannot reorder another plugin's load order.
  const otherCheckout = (p) => {
    if (typeof p !== "string" || p === core) return false;
    try {
      return JSON.parse(readFileSync(path.join(p, "package.json"), "utf8")).name === "sudo-skills";
    } catch {
      return false;
    }
  };
  const kept = paths.filter((p) => !otherCheckout(p));
  load.paths = kept.includes(core) ? kept : [...kept, core];

  const entries = (plugins.entries ??= {});
  const was = entries[PLUGIN_ID] ?? null;
  // Merge, never replace. A run that names agents sets the filter. A run that
  // does not keeps whatever filter is there, so a plain re-run cannot widen one
  // the operator narrowed; only a first install falls back to the default, and
  // an entry with no filter at all would load sudo into every agent on the
  // gateway. An entry the operator disabled stays disabled.
  const filter = agents.length ? agents : (was?.config?.agents ?? (agentsDefault.length ? agentsDefault : null));
  entries[PLUGIN_ID] = {
    ...was,
    enabled: was && was.enabled === false ? false : true,
    config: {
      ...was?.config,
      ...(filter ? { agents: filter } : {}),
      release: VERSION,
    },
  };
  // The resulting entry goes back to the caller, so a dry run can report the
  // state this install would leave rather than the state it was asked for.
  const entry = entries[PLUGIN_ID];
  if (JSON.stringify(data) === before) return ok([], false, { runtime: "openclaw", file: configFile, entry });
  const wrote = writeJson(configFile, data, { existed: true, dryRun });
  return ok(wrote, true, { runtime: "openclaw", file: configFile, entry, note: "Restart the gateway to load the change." });
}

// ------------------------------------------------------------- the agents

/**
 * The agents on the gateway, with the workspace each one runs in. An agent
 * without its own workspace runs in the default one.
 */
export function gatewayAgents({ configFile = openclawConfigFile(), ids = [], env = process.env } = {}) {
  const read = readJson(configFile);
  const list = Array.isArray(read.data?.agents?.list) ? read.data.agents.list : [];
  const fallback = read.data?.agents?.defaults?.workspace;
  const resolve = (p) => (typeof p === "string" && p.trim() ? path.resolve(p.trim().replace(/^~(?=$|\/)/, home(env))) : null);
  const wanted = ids.length ? ids : list.map((a) => a?.id).filter(Boolean);
  return wanted.map((id) => {
    const found = list.find((a) => a?.id === id) ?? {};
    return { id, workspace: resolve(found.workspace) ?? resolve(fallback) ?? path.join(path.dirname(configFile), "workspace") };
  });
}

/**
 * Which agents the gateway entry actually reaches, and from where.
 *
 * Nothing is written per agent and nothing is copied into a workspace. The
 * gateway loads this repo once and hands its skills to the agents named in the
 * entry, so one load path covers all three and an edit here reaches each of
 * them on its next session. A copy per workspace would give a session the same
 * skill twice and make this repo stop being the only place to edit it.
 */
export function agentCoverage({ core, configFile = openclawConfigFile(), ids = [], env = process.env } = {}) {
  const read = readJson(configFile);
  const entry = read.error ? null : read.data?.plugins?.entries?.[PLUGIN_ID];
  const paths = read.data?.plugins?.load?.paths ?? [];
  const loaded = Boolean(entry && entry.enabled !== false && paths.includes(core));
  const filter = entry?.config?.agents ?? null;
  return gatewayAgents({ configFile, ids, env }).map(({ id, workspace }) => ({
    agent: id,
    workspace,
    covered: loaded && (!filter || filter.includes(id)),
    release: entry?.config?.release ?? null,
    via: core,
  }));
}

// ------------------------------------------------------------------- status

/** Is every skill in this set linked into dir, pointing at this checkout? */
function skillsLinked(core, dir) {
  const names = skillNames(core);
  if (!names.length) return false;
  return names.every((name) => {
    const link = path.join(dir, name);
    try {
      return lstatSync(link).isSymbolicLink() && readlinkSync(link) === path.join(core, "skills", name);
    } catch {
      return false;
    }
  });
}

/**
 * What is actually in place, read from the files themselves, so `install
 * --status` and a dry run tell the same story.
 */
export function installStatus({ core, configFile = openclawConfigFile(), configDir = claudeConfigDir(), ids = [], env = process.env } = {}) {
  const rows = [];

  const record = readJson(path.join(configDir, RECORD_FILE));
  rows.push({
    runtime: "claude-code",
    where: configDir,
    present: existsSync(configDir),
    installed: skillsLinked(core, path.join(configDir, "skills")),
    release: record.error ? null : (record.data?.version ?? null),
    problem: record.error ?? null,
  });

  const gateway = readJson(configFile);
  const entry = gateway.error ? null : gateway.data?.plugins?.entries?.[PLUGIN_ID];
  const paths = gateway.data?.plugins?.load?.paths ?? [];
  rows.push({
    runtime: "openclaw",
    where: configFile,
    present: gateway.existed === true,
    installed: Boolean(entry && entry.enabled !== false && paths.includes(core)),
    release: entry?.config?.release ?? null,
    agents: entry?.config?.agents ?? null,
    problem: gateway.error ?? null,
  });

  for (const row of agentCoverage({ core, configFile, ids, env })) {
    rows.push({
      runtime: "agent",
      agent: row.agent,
      where: `${row.via} (via the gateway entry)`,
      present: existsSync(row.workspace),
      installed: row.covered,
      release: row.release,
      problem: null,
    });
  }

  return rows;
}
