import { existsSync } from "node:fs";
import { resolve as pathResolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const SRC = pathResolve(process.cwd(), "src");
const EXTS = ["", ".ts", ".tsx", ".js", ".mjs"];

function tryResolve(candidate) {
  for (const ext of EXTS) {
    if (existsSync(candidate + ext)) {
      return pathToFileURL(candidate + ext).href;
    }
    if (existsSync(candidate + "/index" + ext)) {
      return pathToFileURL(candidate + "/index" + ext).href;
    }
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  // @/ path alias
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2).replace(/\//g, sep);
    const resolved = tryResolve(pathResolve(SRC, rel));
    if (resolved) return nextResolve(resolved, context);
  }

  // Extensionless relative imports (e.g. "../domain/expenseRules" → "../domain/expenseRules.ts")
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentDir = context.parentURL
      ? pathResolve(fileURLToPath(context.parentURL), "..")
      : process.cwd();
    const resolved = tryResolve(pathResolve(parentDir, specifier));
    if (resolved) return nextResolve(resolved, context);
  }

  return nextResolve(specifier, context);
}
