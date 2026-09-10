# 76 — Backend do quiz: consertar a cauda do diagnóstico + recomendar 1 baralho

Dois consertos independentes. O primeiro é a causa-raiz do diagnóstico que se
contradiz; o segundo devolve o gatilho "qual baralho comprar".

---

# PARTE A — a cauda do diagnóstico que se contradiz

**A causa (confirmada no código):** o diagnóstico da LP1 reaproveita o motor da
LP3. Em `lib/lp1-diagnosis.ts`, as 3 respostas da LP1 são traduzidas pras 5 da
LP3, e `intensity` vira `vulnerability`/`routine`. Aí, em `lib/lp3-narrative.ts`,
a função `getPersonalizations` adiciona caudas negativas **mesmo quando o
diagnóstico é positivo** ("beginning" = casal no começo, "healthy" = tá tudo
bem). Por isso "vocês estão no começo" ganha "talvez sejam pequenas coisas
acumuladas" — um casal novo não tem nada acumulado.

**Conserto** — arquivo `lib/lp3-narrative.ts`:

**A1.** Trocar a assinatura e o corpo de `getPersonalizations`:

Localizar:
```ts
function getPersonalizations(answers: Lp3Answers): string[] {
  const personalizations: string[] = [];

  if (answers.routine === "Cada um acaba no celular") {
```
Trocar por:
```ts
function getPersonalizations(
  answers: Lp3Answers,
  narrativeType: Lp3NarrativeType,
): string[] {
  const personalizations: string[] = [];
  const isPositive =
    narrativeType === "beginning" || narrativeType === "healthy";

  if (answers.routine === "Cada um acaba no celular") {
```

**A2.** Ainda em `getPersonalizations`, adicionar `&& !isPositive` nas duas
caudas negativas. Localizar:
```ts
  if (answers.routine === "A gente fala principalmente da rotina") {
    personalizations.push(
      "As conversas continuam acontecendo, mas muitas delas parecem precisar resolver alguma coisa.",
    );
  }
```
Trocar a primeira linha por:
```ts
  if (answers.routine === "A gente fala principalmente da rotina" && !isPositive) {
```
E localizar:
```ts
  if (answers.vulnerability === "Algumas coisas") {
    personalizations.push(
      "Talvez não seja uma única conversa. Talvez sejam pequenas coisas acumuladas.",
    );
  }
```
Trocar a primeira linha por:
```ts
  if (answers.vulnerability === "Algumas coisas" && !isPositive) {
```

**A3.** Atualizar `selectLp3Narrative` pra passar o narrativeType. Localizar:
```ts
export function selectLp3Narrative(answers: Lp3Answers): Lp3Narrative {
  const narrative = narrativeDefinitions[getNarrativeKey(answers)];

  return {
    ...narrative,
    personalizations: getPersonalizations(answers),
  };
}
```
Trocar por:
```ts
export function selectLp3Narrative(answers: Lp3Answers): Lp3Narrative {
  const narrativeType = getNarrativeKey(answers);
  const narrative = narrativeDefinitions[narrativeType];

  return {
    ...narrative,
    personalizations: getPersonalizations(answers, narrativeType),
  };
}
```

**Conferir:** faça o quiz escolhendo "Namorando" + "Aquecer, sem susto". O
diagnóstico "Vocês estão no começo" NÃO pode mais terminar com "pequenas coisas
acumuladas" nem "precisam resolver alguma coisa". Fazendo com "Juntos há muitos
anos" as caudas continuam aparecendo (aí fazem sentido).

*(Choice p.12-13 🟩 — o diagnóstico só persuade enquanto parece ser sobre ELES.)*

---

# PARTE B — o resultado volta a recomendar UM baralho

Hoje o diagnóstico personaliza mas não fecha com "seu baralho é X" — perdeu o
gatilho de "qual comprar" em vez de "se compro" (Choice p.14). O dado já existe:
cada narrativa tem um `themeId`, e `diagnosis.themeId` chega no componente. Só
falta mostrar.

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`, componente `Lp1Diagnosis`.

**B1.** Adicionar um mapa de nomes de baralho perto do topo do arquivo (junto de
outros `const` de nível de módulo, ex.: antes de `function Lp1Diagnosis`):
```ts
const LP1_THEME_NAMES: Record<string, string> = {
  "porto-seguro": "Porto Seguro",
  "livro-aberto": "Livro Aberto",
  "voce-nao-sabia": "Você Não Sabia",
  "em-voz-alta": "Em Voz Alta",
  "la-atras": "Lá Atrás",
  "modo-leve": "Modo Leve",
  viagens: "Viagens",
  "carreira-dinheiro": "Carreira & Dinheiro",
  "depois-da-tempestade": "Depois da Tempestade",
  faisca: "Faísca",
  "mesmo-longe": "Mesmo Longe",
};
```

**B2.** Dentro de `Lp1Diagnosis`, renderizar a recomendação **logo antes** do
parágrafo da âncora ("Isso é um gostinho: 3 de 459…"). Localizar:
```jsx
        <p className="lp1-diagnosis-anchor">
          Isso é um gostinho: 3 de 459 perguntas. As outras 456 abrem quando o
          baralho for de vocês.
        </p>
```
Inserir ANTES dele:
```jsx
        <p className="lp1-diagnosis-recommendation">
          Seu baralho pra começar:{" "}
          <strong>{LP1_THEME_NAMES[diagnosis.themeId] ?? "Porto Seguro"}</strong>
        </p>
```

**B3.** CSS (`index.css`), pra não ficar sem estilo:
```css
.lp1-diagnosis-recommendation {
  margin: 0.4rem 0 0;
  font-size: 1rem;
  color: #c4acff;
}
.lp1-diagnosis-recommendation strong { color: #f9f8fb; }
```

**Conferir:** no fim do quiz aparece "Seu baralho pra começar: [nome]", e o nome
muda conforme as respostas (ex.: intensidade "Provocar/apimentar" → "Faísca";
"muitos anos"+rotina → "Porto Seguro").

*(Choice p.14 🟩 — ativar "qual comprar", não "se compro".)*
