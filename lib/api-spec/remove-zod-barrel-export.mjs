import { readFile, writeFile } from "node:fs/promises";

const indexPath = new URL("../api-zod/src/index.ts", import.meta.url);
const source = await readFile(indexPath, "utf8");
const cleaned = source.replace(
  /^export \* from ["']\.\/generated\/types["'];\r?\n?/m,
  "",
);

if (cleaned !== source) {
  await writeFile(indexPath, cleaned);
}