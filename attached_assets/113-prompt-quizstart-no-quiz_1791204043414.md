# Prompt 113 — QuizStart (Meta) dispara na tela do quiz, não no clique da LP

*Otimizador, 05/10/2026. Origem: Qualidade (05/10). O evento `QuizStart` só dispara em `trackCtaClick("quiz_start")` (clique em "Começar o teste" na LP). Quem entra direto em `/quiz` (link da bio no Beacons desde 02/10 e anúncio de sábado) nunca dispara; no Gerenciador de Eventos o QuizStart parou há ~3 dias e o QuizComplete segue (ele dispara dentro do quiz). Sem QuizStart a Meta não tem o evento do meio do funil para otimizar nem para montar público. Código conferido em `codigo/Quizapp` (`git pull` sem novidades, HEAD `a725695`).*

**Conta:** não muda preço, oferta nem texto; só corrige a medição. Risco baixo (um `useEffect` novo + remover 6 linhas). Efeito: QuizStart volta a contar 1 por visitante em todas as entradas (LP, bio, anúncio). Número do QuizStart no Meta vai subir de repente (volta ao real), não é "melhora de conversão".

**Arquivo:** só `artifacts/perguntas-de-conexao/src/App.tsx`. **Não toca em 104a, 104c, 111, 112 nem em preço/oferta/checkout/e-mail.** Não mexe em `meta-pixel.ts`, nem no back.

Cole isto no agente do Replit:

---
Em `artifacts/perguntas-de-conexao/src/App.tsx`:

1. **Tirar o disparo do clique da LP.** No hook `useLpTracking` (função que recebe `eventType`, ~linha 6106), apague só o bloco `if (eventType === "quiz_start") { trackMetaPixelEvent("QuizStart", {}, createMetaEventId("QuizStart"), true); }`. **Mantenha** o `fetch` para `/api/track/page-event` e as chamadas `trackCtaClick("quiz_start")` (~9344 e ~9376): o funil interno do admin continua contando o clique. Só o pixel Meta sai dali.

2. **Disparar no quiz.** No componente `Lp1Quiz` (só é usado em `TrackedQuiz`, rota `/quiz`), adicione um `useEffect` logo antes do effect que grava `lp1-quiz-step`:
   - Chave `const QUIZ_START_PIXEL_KEY = "pdc-meta-quiz-start-sent"` em `sessionStorage`.
   - Função `fire()`: se `sessionStorage.getItem(chave) === "true"` → retorna. Se `!isMetaTrackingAllowed()` → retorna **sem gravar a trava** (assim tenta de novo quando o consentimento for dado). Senão chama `trackMetaPixelEvent("QuizStart", {}, createMetaEventId("QuizStart"), true)` e grava a trava `"true"`.
   - Chame `fire()` ao montar e também escute `window.addEventListener(META_CONSENT_CHANGE_EVENT, fire)` (já importado no arquivo); remova o listener no cleanup. Motivo: quem chega pelo anúncio vê o banner de cookies na primeira tela e só aceita depois; sem o listener o evento seria perdido.
   - `sessionStorage` dentro de try/catch (se falhar, dispare mesmo assim; vale usar também um `useRef` para não repetir na mesma montagem).
   - Respeita o que já existe: `isMetaTrackingAllowed()` já exige consentimento "accepted" e exclui `/admin`, `?internal=1` e `pdc_internal=1`. Não crie outra regra de consentimento.
   - Não depende do `step`: dispara na primeira montagem do quiz, mesmo se a pessoa voltar com o step salvo (a trava de sessão evita repetir).

3. Não mude mais nada: nada de preço, oferta, checkout, e-mail, `QuizComplete`, `trackLp1QuizAnswer`, `meta-pixel.ts` ou back-end. `pnpm run typecheck` sem erro.

**Commit:** `113: QuizStart (Meta) dispara na tela do quiz, 1x por sessão, e sai do clique da LP`

### AO TERMINAR: responda com esta lista, item por item
1. Bloco do pixel removido de `useLpTracking`, `fetch` para `/api/track/page-event` e os `trackCtaClick("quiz_start")` intactos: **FEITO** ou **NÃO FEITO** (arquivo e linha).
2. `useEffect` novo em `Lp1Quiz` com trava em `sessionStorage`: **FEITO** ou **NÃO FEITO** (cole o trecho).
3. Sem consentimento não grava a trava e dispara quando o consentimento muda (`META_CONSENT_CHANGE_EVENT`): **FEITO** ou **NÃO FEITO**.
4. Usa só `isMetaTrackingAllowed()` (nenhuma regra de consentimento nova): **FEITO** ou **NÃO FEITO**.
5. `grep -n "QuizStart" App.tsx` mostra só 1 disparo (no `Lp1Quiz`): **FEITO** (cole o grep) ou **NÃO FEITO**.
6. Typecheck limpo, só `App.tsx` alterado: **FEITO** ou **NÃO FEITO**.

---
## Depois do deploy (Quinzinho + Qualidade)
1. Chame a Qualidade ("colei o 113"). Ela confere no pacote JS e testa sem poluir a Meta (navegador com `pdc_internal=1` não dispara; o teste real do pixel precisa de um aparelho seu sem a marca interna).
2. Teste seu, 2 min: no celular, abra `perguntasdeconexao.com.br/quiz` direto, aceite os cookies, e confira no Gerenciador de Eventos (Test Events ou "Atividade recente") 1 `QuizStart`. Recarregue a página: não deve contar de novo.
3. Em 24h o QuizStart deve voltar a aparecer no Gerenciador de Eventos. Se o número ficar muito maior que o de cliques na LP, é esperado (agora conta bio e anúncio).
