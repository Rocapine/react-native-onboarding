#!/usr/bin/env node
// Asserts that the plugin's element documentation still matches the zod schemas.
//
//   node scripts/check-element-docs.mjs          # report
//   node scripts/check-element-docs.mjs --list   # dump what it extracted, then report
//
// WHY A CHECKER AND NOT A GENERATOR
//
// The audit recommendation (R-2) was to *generate* the element tables from the
// schemas. Reading the tables changed the plan. Every element finding the audit
// raised — a misnamed gradient prop, `Input.autoFocus` documented as invalid, the
// container lists disagreeing, element types missing from the AI's schema — was a
// failure of MEMBERSHIP or NAMING. Not one was a failure of description.
//
// And description is what those tables mostly are: which optional peer dep an
// element needs, how it degrades when that dep is absent, that a mask's opacity
// means blur strength rather than a colour, which Figma pattern an element exists
// to serve. None of that is derivable from a zod schema, and generating the tables
// would have flattened ~285 lines of hard-won reference into a mechanical dump.
//
// So: the prose stays hand-written, and this asserts the facts around it. Same
// outcome for the drift class, none of the loss.
//
// Truth comes from the SOURCE, not the built dist, so this runs with no install
// and no build step — deliberately, because a check that needs a toolchain is a
// check that gets skipped.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CS = join(ROOT, "packages/onboarding/src/screens");
const PLUGIN = join(ROOT, "claude-plugin");

/* ── source of truth ─────────────────────────────────────────────────── */

/** Slice a balanced `{…}` block starting at the first `{` at or after `from`. */
function block(src, from) {
  const start = src.indexOf("{", from);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start + 1, i);
  }
  return null;
}

/** `key:` names at nesting depth 0 inside a block, comments stripped. */
function topKeys(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const keys = [];
  let depth = 0;
  for (const line of clean.split("\n")) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(line);
    if (m && depth === 0) keys.push(m[1]);
    for (const ch of line) {
      if (ch === "{" || ch === "[" || ch === "(") depth++;
      else if (ch === "}" || ch === "]" || ch === ")") depth--;
    }
  }
  return keys;
}

function readTruth() {
  const types = readFileSync(join(CS, "types.ts"), "utf8");

  // Each element variant is a `z.object({ … type: z.literal("X") … })` in the
  // UIElement union. YStack/XStack share one variant via z.union of literals.
  const variants = [];
  for (const m of types.matchAll(/z\.object\(/g)) {
    const body = block(types, m.index);
    if (!body) continue;
    const typeDecl = /type:\s*(?:z\.union\(\[)?((?:\s*z\.literal\("[^"]+"\),?)+)/.exec(body);
    if (!typeDecl) continue;
    const names = [...typeDecl[1].matchAll(/z\.literal\("([^"]+)"\)/g)].map((x) => x[1]);
    if (!names.length) continue;
    variants.push({
      names,
      isContainer: /^\s*children:/m.test(body),
      propsRef: (/props:\s*(\w+)/.exec(body) || [])[1] ?? null,
      levelKeys: topKeys(body),
    });
  }

  // Every element props schema is `BaseBoxPropsSchema.extend({…})`; the base is
  // `z.object({…})`. Both shapes are parsed the same way.
  const schemas = new Map();
  for (const f of readdirSync(join(CS, "elements")).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(join(CS, "elements", f), "utf8");
    for (const sm of src.matchAll(
      /export const (\w+Schema)\s*=\s*(?:BaseBoxPropsSchema\.extend|z\.object)\(/g,
    )) {
      const body = block(src, sm.index + sm[0].length - 1);
      if (body) schemas.set(sm[1], topKeys(body));
    }
  }

  const base = schemas.get("BaseBoxPropsSchema");
  if (!base) throw new Error("BaseBoxPropsSchema not found — did BaseBoxProps.ts change shape?");
  const levelKeys = new Set(variants.flatMap((v) => v.levelKeys).filter((k) => k !== "props"));
  const baseSet = new Set(base);

  const ownProps = new Map();
  for (const v of variants) {
    const own = schemas.get(v.propsRef);
    // A variant whose props schema didn't resolve would make its inventory row
    // silently empty — the exact vacuous pass this script exists to prevent.
    if (!own) throw new Error(`Could not resolve ${v.propsRef} for ${v.names.join("/")}`);
    // `.extend()` may restate a base prop to narrow it; list it once, as a base prop.
    const trimmed = own.filter((p) => !baseSet.has(p));
    for (const n of v.names) ownProps.set(n, trimmed);
  }

  const elements = [...new Set(variants.flatMap((v) => v.names))].sort();
  if (elements.length < 20) {
    throw new Error(`Only parsed ${elements.length} element types — the union parse is broken`);
  }

  return {
    elements,
    containers: variants.filter((v) => v.isContainer).flatMap((v) => v.names).sort(),
    ownProps,
    base,
    levelKeys,
  };
}

/* ── docs ────────────────────────────────────────────────────────────── */

function pluginFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  walk(PLUGIN);
  return out;
}

const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/**
 * Maximal runs of backticked element names separated only by list punctuation —
 * ``​`YStack`/`XStack`/`ZStack`​`` is one run, and a name mentioned later in prose
 * starts a different one. Enumerations look like runs; prose does not, and that
 * distinction is what keeps this check quiet enough to stay switched on.
 */
function elementRuns(line, elementSet) {
  const runs = [];
  let current = [];
  const re = /`([^`]+)`([^`]*)/g;
  let m;
  while ((m = re.exec(line))) {
    const name = m[1];
    const gap = m[2];
    if (elementSet.has(name)) {
      current.push(name);
      // Only list punctuation may separate two members of the same run.
      if (!/^[\s,/]*(?:and\s*)?$/.test(gap)) {
        runs.push(current);
        current = [];
      }
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

/* ── checks ──────────────────────────────────────────────────────────── */

let failures = 0;
const rel = (p) => relative(ROOT, p);
function pass(label) {
  console.log(`PASS  ${label}`);
}
function fail(label, detail) {
  failures++;
  console.log(`*** FAIL  ${label}`);
  for (const d of [].concat(detail)) console.log(`          ${d}`);
}

const truth = readTruth();
const elementSet = new Set(truth.elements);

if (process.argv.includes("--list")) {
  console.log(`elements (${truth.elements.length}): ${truth.elements.join(" ")}`);
  console.log(`containers (${truth.containers.length}): ${truth.containers.join(" ")}`);
  console.log(`base props: ${truth.base.length}`);
  console.log("");
}

/* A. The reference skill's element table names every element type, and nothing
      that isn't one. This is the table an agent reads to know what exists. */
{
  const label = "compose-screen-builder element table covers every element type";
  const src = readFileSync(join(PLUGIN, "skills/compose-screen-builder/SKILL.md"), "utf8");
  const table = src.slice(src.indexOf("| Type | Purpose |"));
  const end = table.indexOf("\n\n");
  const rows = (end === -1 ? table : table.slice(0, end)).split("\n").slice(2);
  const documented = new Set(
    rows.flatMap((r) => ticks(r.split("|")[1] ?? "")).filter((t) => elementSet.has(t)),
  );
  const missing = truth.elements.filter((t) => !documented.has(t));
  const unknown = rows
    .flatMap((r) => ticks(r.split("|")[1] ?? ""))
    .filter((t) => !elementSet.has(t));
  if (missing.length || unknown.length) {
    fail(label, [
      missing.length ? `missing from the table: ${missing.join(", ")}` : null,
      unknown.length ? `named but not in the schema: ${unknown.join(", ")}` : null,
    ].filter(Boolean));
  } else {
    pass(`${label} (${truth.elements.length})`);
  }
}

/* B. Container enumerations. A run of three or more backticked element names on a
      line that talks about containers, where every name in the run IS a
      container, is that line asserting the container set — so it has to be
      complete. Requiring the whole run to be containers is what distinguishes an
      enumeration from prose: "Every styled UIElement (`Button`, `RadioGroup`, …,
      container stacks)" mentions containers without enumerating them, and a
      looser rule flags it. */
{
  const label = "every container enumeration lists all containers";
  const containerSet = new Set(truth.containers);
  const problems = [];
  for (const file of pluginFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/container/i.test(line)) return;
      for (const run of elementRuns(line, elementSet)) {
        if (run.length < 3 || !run.every((n) => containerSet.has(n))) continue;
        const missing = truth.containers.filter((c) => !run.includes(c));
        if (missing.length) problems.push(`${rel(file)}:${i + 1} omits ${missing.join(", ")}`);
      }
    });
  }
  problems.length
    ? fail(label, problems)
    : pass(`${label} (${truth.containers.length}: ${truth.containers.join(", ")})`);
}

/* C. The prop inventory. This is the one part of the element reference that is
      purely mechanical, so it is GENERATED rather than checked: a complete
      per-element prop list between markers, regenerated by --write and verified
      here. It exists because prose cannot promise completeness — nothing else in
      the plugin tells an agent that `Input` accepts `returnKeyType`, and a prop
      the docs never mention is a prop the model never emits.

      Note on what is NOT checked: the skill's right/wrong table looks
      machine-checkable and isn't. Its "wrong" column mixes three claims — a prop
      that does not exist (`text` on Text), a prop that exists but is deprecated
      (`action` on Button, still in the schema), and a valid prop used with the
      wrong shape (`items` AND `range` together on WheelPicker). Only the first is
      a membership fact. Checking that column against the schemas produced fifteen
      failures, every one of them the checker misreading editorial advice. */
const INVENTORY = join(PLUGIN, "skills/compose-screen-builder/references/element-props.md");
const BEGIN = "<!-- BEGIN:generated-element-props -->";
const END = "<!-- END:generated-element-props -->";

function renderInventory(truth) {
  const lines = [
    `_Generated from \`packages/onboarding/src/screens\` by`,
    `\`scripts/check-element-docs.mjs --write\`. Do not edit between the markers._`,
    "",
    `**Element-level keys** (outside \`props\`, on every element): ` +
      [...truth.levelKeys].sort().map((k) => `\`${k}\``).join(", ") +
      `. \`children\` is required on containers and forbidden elsewhere.`,
    "",
    `**Box props** — accepted by every element, omitted from the per-element lists below:`,
    "",
    truth.base.map((p) => `\`${p}\``).join(" · "),
    "",
    "### Own props, per element",
    "",
    "| Element | Container | Own props (beyond box props) |",
    "|---------|-----------|------------------------------|",
  ];
  const containerSet = new Set(truth.containers);
  for (const name of truth.elements) {
    const own = truth.ownProps.get(name);
    lines.push(
      `| \`${name}\` | ${containerSet.has(name) ? "yes" : "—"} | ` +
        (own.length ? own.map((p) => `\`${p}\``).join(" · ") : "_none_") +
        " |",
    );
  }
  return lines.join("\n");
}

{
  const label = "generated prop inventory is up to date";
  const rendered = renderInventory(truth);
  let src;
  try {
    src = readFileSync(INVENTORY, "utf8");
  } catch {
    src = null;
  }
  const write = process.argv.includes("--write");
  const shell = (body) =>
    `# ComposableScreen element props\n\n` +
    `The complete prop surface, straight from the zod schemas. This file answers "does\n` +
    `this prop exist?" — for what a prop MEANS, when to reach for an element, which\n` +
    `optional peer dep it needs and how it degrades without one, read\n` +
    `\`../SKILL.md\`, which is hand-written on purpose.\n\n` +
    `**Accepted is not the same as recommended.** The schema still takes some\n` +
    `deprecated props (\`Button.action\`, superseded by \`actions\`), and a prop listed\n` +
    `here can still be wrong for the shape you are writing. \`../SKILL.md\`'s\n` +
    `right/wrong table is the authority on which of these to actually use.\n\n` +
    `${BEGIN}\n\n${body}\n\n${END}\n`;

  if (src === null) {
    if (write) {
      mkdirSync(dirname(INVENTORY), { recursive: true });
      writeFileSync(INVENTORY, shell(rendered));
      pass(`${label} (created ${rel(INVENTORY)})`);
    } else {
      fail(label, [`${rel(INVENTORY)} does not exist — run with --write`]);
    }
  } else {
    const b = src.indexOf(BEGIN);
    const e = src.indexOf(END);
    if (b === -1 || e === -1) {
      fail(label, [`${rel(INVENTORY)} is missing the BEGIN/END markers`]);
    } else {
      const next = src.slice(0, b + BEGIN.length) + "\n\n" + rendered + "\n\n" + src.slice(e);
      if (next === src) {
        pass(`${label} (${truth.elements.length} elements, ${truth.base.length} box props)`);
      } else if (write) {
        writeFileSync(INVENTORY, next);
        pass(`${label} (rewrote ${rel(INVENTORY)})`);
      } else {
        fail(label, [
          `${rel(INVENTORY)} is stale — a schema changed.`,
          `Run \`npm run docs:element-props\` and commit the result.`,
        ]);
      }
    }
  }
}

console.log("");
if (failures) {
  console.log(`*** ${failures} check(s) failed.`);
  console.log("The zod schemas in packages/onboarding/src are the source of truth —");
  console.log("fix the docs, not this script, unless the script is misreading the source.");
  process.exit(1);
}
console.log(`Element docs agree with the schemas (${truth.elements.length} elements).`);
