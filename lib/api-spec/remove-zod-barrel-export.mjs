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

// Orval v8 emits the Zod v4 shorthand `z.int()`, while this workspace still
// uses Zod v3. Keep the generated contract compatible without editing generated
// files by hand.
const generatedApiPath = new URL("../api-zod/src/generated/api.ts", import.meta.url);
const generatedApi = await readFile(generatedApiPath, "utf8");
const compatibleApi = generatedApi.replace(/\bzod\.int\(\)/g, "zod.number().int()");
if (compatibleApi !== generatedApi) {
  await writeFile(generatedApiPath, compatibleApi);
}