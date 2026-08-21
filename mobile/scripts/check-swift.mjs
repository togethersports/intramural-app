/*
  Parses every Swift file in the watch target against a real Swift grammar
  and reports syntax errors with line numbers.

  Why this exists: Swift compiles only on a Mac, and most of this repo's
  work happens where there isn't one. Reviewing Swift by eye catches design
  problems and misses typos, which is exactly backwards — a typo costs a
  twenty-minute cloud build to discover. This closes that loop in a second.

  It is NOT a compiler. It checks that the source *parses*; it knows nothing
  about types, member names, or platform availability. A file that passes
  here can still fail to build. What it buys is that the failure will be
  something interesting rather than a missing brace.

  Deliberately not a dependency in package.json: it needs a native build,
  it is only useful when touching the watch target, and a broken postinstall
  on someone's Mac would cost more than this saves. Install it when you want
  it:

    npm i --no-save tree-sitter tree-sitter-swift
    node scripts/check-swift.mjs

  One known false positive to be aware of before you "fix" code for it:
  the grammar rejects `if let x = try? await f() { }`, which is valid Swift.
  Bind on its own line and use `if let x { }`.
*/

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TARGET = join(dirname(fileURLToPath(import.meta.url)), "..", "targets", "watch");

let Parser, Swift;
try {
  Parser = (await import("tree-sitter")).default;
  Swift = (await import("tree-sitter-swift")).default;
} catch {
  console.error("Needs the parser. Run:\n  npm i --no-save tree-sitter tree-sitter-swift");
  process.exit(2);
}

const parser = new Parser();
parser.setLanguage(Swift);

let failures = 0;
for (const file of readdirSync(TARGET).filter((f) => f.endsWith(".swift")).sort()) {
  const tree = parser.parse(readFileSync(join(TARGET, file), "utf8"));
  const errors = [];
  // Don't descend into an error subtree — one real mistake generates a
  // cascade of children, and the first line is the one worth reading.
  const walk = (node) => {
    if (node.type === "ERROR" || node.isMissing) {
      errors.push({
        line: node.startPosition.row + 1,
        text: node.text.slice(0, 70).replace(/\s+/g, " "),
      });
      return;
    }
    for (let i = 0; i < node.childCount; i++) walk(node.child(i));
  };
  walk(tree.rootNode);

  failures += errors.length;
  console.log(`${file.padEnd(24)} ${errors.length === 0 ? "ok" : `${errors.length} syntax errors`}`);
  for (const e of errors.slice(0, 8)) console.log(`    ${file}:${e.line}  ${e.text}`);
}

console.log(
  failures === 0
    ? "\nEvery file parses. This is not a compile — types and availability are still unchecked."
    : `\n${failures} syntax errors.`,
);
process.exit(failures === 0 ? 0 : 1);
