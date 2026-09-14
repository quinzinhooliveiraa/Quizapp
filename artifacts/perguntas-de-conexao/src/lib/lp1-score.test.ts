import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLp1Score } from "./lp1-score";

test("classifies the lightest answers as perto", () => {
  const score = computeLp1Score({
    stage: "novo",
    theme: "porto-seguro",
    pain: "sei-la",
    "s04-rotina": "pouco",
    "s05-silencio": "calmo",
    "s07-perguntas": "frequente",
    objecao: "nao-sei-comecar",
    "s14-falta": "nada",
    "s16-proximidade": "5",
  });

  assert.equal(score.band, "perto");
});

test("classifies the heaviest answers as distante", () => {
  const score = computeLp1Score({
    stage: "muitos-anos",
    theme: "livro-aberto",
    pain: "afastamento",
    "s04-rotina": "tudo",
    "s05-silencio": "pesado",
    "s07-perguntas": "raramente",
    objecao: "ele-nao-topa",
    "s14-falta": "curiosidade",
    "s16-proximidade": "1",
  });

  assert.equal(score.band, "distante");
});

test("ignores missing or unknown answers without throwing", () => {
  assert.deepEqual(computeLp1Score({}), { value: 0, band: "perto" });
  assert.deepEqual(
    computeLp1Score({ pain: "not-in-the-table", missing: "" }),
    { value: 0, band: "perto" },
  );
});