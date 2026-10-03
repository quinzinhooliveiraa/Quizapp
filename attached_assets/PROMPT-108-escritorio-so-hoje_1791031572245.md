# Prompt 108: escritório mostra só as tarefas de hoje + check do celular não volta (cole tudo isto no Replit)

Faça SÓ estas 2 mudanças. Não mexa em mais nada (funil, preço, checkout, outras rotas ficam como estão). Depois faça o deploy.

## 1. `artifacts/api-server/src/routes/escritorio.ts` — rota `POST /escritorio/sync`
Hoje ela grava o estado que o Mac mandou ANTES de olhar a fila de ações. Se o Joaquim marcou uma tarefa no celular, o Mac ainda não sabia disso e o check some por alguns segundos.

Troque este trecho:
```ts
  await writeSetting(KEY_ESTADO, estado);
  const { value: acoes } = await readSetting(KEY_ACOES);
  const lista = Array.isArray(acoes) ? acoes : [];
```
por:
```ts
  const { value: acoes } = await readSetting(KEY_ACOES);
  const lista = Array.isArray(acoes) ? acoes : [];
  // o Mac ainda não aplicou os checks da fila: aplica aqui para o check do celular não "voltar"
  if (Array.isArray(estado.tarefas)) {
    for (const a of lista) {
      if (a?.tipo === "tarefa") estado.tarefas = estado.tarefas.map((t: any) => (t?.id === a.id ? { ...t, feito: a.feito } : t));
    }
  }
  await writeSetting(KEY_ESTADO, estado);
```
(O resto da rota continua igual: limpa a fila e devolve `acoes` para o Mac.)

## 2. `artifacts/perguntas-de-conexao/src/pages/EscritorioTab.tsx` — mostrar só hoje
Na linha que monta `const tarefas = (live?.tarefas || []).filter(...)`, troque o filtro
`.filter((t) => !(t.feito && t.dia < t0))`
por
`.filter((t) => t.dia === t0 || (!t.feito && t.dia && t.dia < t0))`
(= tarefas de hoje + atrasadas não feitas; os dias futuros somem.)

E troque o texto `O CEO manda as tarefas do dia toda manhã.` por `Nada para hoje. O CEO manda as tarefas do dia toda manhã (seg a sex).`

## Como conferir
Abra /admin → Escritório no celular: só aparecem as tarefas de hoje. Marque uma: ela fica marcada (não volta), e em ~5 s aparece marcada também no escritório do Mac (localhost:4747).
