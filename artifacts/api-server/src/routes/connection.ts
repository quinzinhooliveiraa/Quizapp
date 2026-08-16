import { Router, type IRouter } from "express";
import {
  CreateInviteBody,
  CreateInviteParams,
  CreateCheckoutBody,
  CreateCheckoutResponse,
  CreateQuestionSessionBody,
  CreateQuestionSessionResponse,
  ReceiveAbacatePayWebhookBody,
  ReceiveAbacatePayWebhookResponse,
  GetAccessPreviewResponse,
  GetInviteParams,
  GetQuestionSessionParams,
  GetQuestionSessionResponse,
  ListQuestionThemesResponse,
  ListQuestionsQueryParams,
  ListQuestionsResponse,
  ReceiveCheckoutWebhookBody,
  ReceiveCheckoutWebhookResponse,
} from "@workspace/api-zod";
import {
  questions as connectionQuestions,
  themes as connectionThemes,
  type ConnectionQuestion,
} from "@workspace/connection-content";
import {
  db,
  invitesTable,
  processedEventsTable,
  sessionsTable,
} from "@workspace/db";
import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  createAbacateCheckout,
  fetchAbacateCheckoutStatus,
  verifyAbacateSignature,
} from "../lib/abacatepay";

type Theme = {
  id: string;
  title: string;
  description: string;
  count: number;
  audience: "todos" | "casais" | "18+";
  kind: "tema" | "vibe";
};

type Question = ConnectionQuestion;

const legacyThemes: Theme[] = [
  {
    id: "porto-seguro",
    title: "Porto Seguro",
    description: "As conversas que parecem casa.",
    count: 5,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "livro-aberto",
    title: "Livro Aberto",
    description: "Sem filtro, cara a cara.",
    count: 5,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "faisca",
    title: "Faísca",
    description: "O lado mais provocante de vocês dois.",
    count: 2,
    audience: "casais",
    kind: "vibe",
  },
  {
    id: "voce-nao-sabia",
    title: "Você Não Sabia",
    description: "Descobertas que ainda cabem entre vocês.",
    count: 2,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "em-voz-alta",
    title: "Em Voz Alta",
    description: "A vida que os dois querem construir.",
    count: 4,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "la-atras",
    title: "Lá Atrás",
    description: "O que formou quem você é hoje.",
    count: 4,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "luzes-baixas",
    title: "Luzes Baixas",
    description: "Para quando a noite pede mais coragem.",
    count: 2,
    audience: "18+",
    kind: "vibe",
  },
  {
    id: "modo-leve",
    title: "Modo Leve",
    description: "Pra rir e não levar tão a sério.",
    count: 2,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "mesmo-longe",
    title: "Mesmo Longe",
    description: "Pra quando a rotina ou a distância afastam.",
    count: 2,
    audience: "casais",
    kind: "vibe",
  },
  {
    id: "perto-de-novo",
    title: "Perto de Novo",
    description: "Esquentar o espaço entre vocês.",
    count: 2,
    audience: "casais",
    kind: "vibe",
  },
  {
    id: "proximo-passo",
    title: "Próximo Passo",
    description: "Pra onde essa história está indo.",
    count: 2,
    audience: "casais",
    kind: "vibe",
  },
  {
    id: "fora-da-rotina",
    title: "Fora da Rotina",
    description: "Sacudir o de sempre, tentar algo novo.",
    count: 2,
    audience: "todos",
    kind: "vibe",
  },
  {
    id: "viagens",
    title: "Viagens",
    description: "Lugares que já foram nossos, e os que ainda vão ser.",
    count: 2,
    audience: "todos",
    kind: "tema",
  },
  {
    id: "carreira-dinheiro",
    title: "Carreira & Dinheiro",
    description: "Como vocês pensam o lado prático da vida a dois.",
    count: 2,
    audience: "casais",
    kind: "tema",
  },
];

const legacyQuestions = [
  { id: "ps1", themeId: "porto-seguro", intensity: "gentle", text: "O que faz você se sentir realmente à vontade perto de alguém?" },
  { id: "ps2", themeId: "porto-seguro", intensity: "gentle", text: "Qual detalhe pequeno do nosso primeiro encontro você ainda lembra?" },
  { id: "ps3", themeId: "porto-seguro", intensity: "honest", text: "Que assunto você gostaria que a gente conversasse mais?" },
  { id: "ps4", themeId: "porto-seguro", intensity: "honest", text: "Em que momento recente você se sentiu cuidado por mim?" },
  { id: "ps5", themeId: "porto-seguro", intensity: "deep", text: "O que você gostaria que eu entendesse sem você precisar pedir?" },
  { id: "la1", themeId: "livro-aberto", intensity: "honest", text: "O que costuma passar pela sua cabeça quando você se sente distante de mim?" },
  { id: "la2", themeId: "livro-aberto", intensity: "deep", text: "Qual medo seu você acha que poucas pessoas conhecem?" },
  { id: "la3", themeId: "livro-aberto", intensity: "deep", text: "Em que situação você mais precisa de acolhimento, mas finge que está tudo bem?" },
  { id: "la4", themeId: "livro-aberto", intensity: "honest", text: "O que eu faço que ajuda você a voltar para si?" },
  { id: "la5", themeId: "livro-aberto", intensity: "deep", text: "Existe alguma parte da sua história que você ainda está aprendendo a contar?" },
  { id: "faisca1", themeId: "faisca", intensity: "honest", text: "Que gesto meu ainda faz seu dia mudar de temperatura?" },
  { id: "faisca2", themeId: "faisca", intensity: "deep", text: "O que você gostaria que a gente reservasse mais vezes só para nós dois?" },
  { id: "vns1", themeId: "voce-nao-sabia", intensity: "gentle", text: "Que gosto, mania ou talento seu eu provavelmente ainda não descobri?" },
  { id: "vns2", themeId: "voce-nao-sabia", intensity: "honest", text: "Que pergunta você gostaria que eu fizesse sobre você hoje?" },
  { id: "ev1", themeId: "em-voz-alta", intensity: "gentle", text: "Como seria um dia comum perfeito para nós daqui a alguns anos?" },
  { id: "ev2", themeId: "em-voz-alta", intensity: "honest", text: "Que sonho seu você quer proteger, mesmo quando a vida fica corrida?" },
  { id: "ev3", themeId: "em-voz-alta", intensity: "deep", text: "O que você não quer repetir na família que pretende construir?" },
  { id: "ev4", themeId: "em-voz-alta", intensity: "deep", text: "Que tipo de pessoa você quer se tornar ao lado de quem ama?" },
  { id: "laa1", themeId: "la-atras", intensity: "gentle", text: "Qual momento nosso você gostaria de guardar em uma fotografia?" },
  { id: "laa2", themeId: "la-atras", intensity: "honest", text: "Qual foi uma vez em que você se sentiu escolhido por mim?" },
  { id: "laa3", themeId: "la-atras", intensity: "deep", text: "Que experiência mudou a forma como você entende o amor?" },
  { id: "laa4", themeId: "la-atras", intensity: "honest", text: "Que lembrança da sua família ajuda a explicar quem você é hoje?" },
  { id: "lb1", themeId: "luzes-baixas", intensity: "honest", text: "Que clima entre nós faz você esquecer por alguns minutos o resto do mundo?" },
  { id: "lb2", themeId: "luzes-baixas", intensity: "deep", text: "O que você teria curiosidade de experimentar comigo, sem pressa e sem cobrança?" },
  { id: "ml1", themeId: "modo-leve", intensity: "gentle", text: "Qual seria o nome de um reality show sobre a nossa rotina?" },
  { id: "ml2", themeId: "modo-leve", intensity: "gentle", text: "Que coisa boba sempre consegue fazer você rir?" },
  { id: "mlg1", themeId: "mesmo-longe", intensity: "honest", text: "Que ritual simples ajudaria a gente a se sentir perto nos dias corridos?" },
  { id: "mlg2", themeId: "mesmo-longe", intensity: "deep", text: "O que você mais sente falta quando a distância entra na conversa?" },
  { id: "pdn1", themeId: "perto-de-novo", intensity: "gentle", text: "O que poderia trazer de volta uma sensação boa entre nós esta semana?" },
  { id: "pdn2", themeId: "perto-de-novo", intensity: "honest", text: "Que parte da nossa história você gostaria de visitar com novos olhos?" },
  { id: "pp1", themeId: "proximo-passo", intensity: "gentle", text: "Qual próximo passo faria sentido para nós sem parecer uma obrigação?" },
  { id: "pp2", themeId: "proximo-passo", intensity: "deep", text: "O que você gostaria que a gente estivesse celebrando daqui a um ano?" },
  { id: "fdr1", themeId: "fora-da-rotina", intensity: "gentle", text: "Se amanhã não houvesse agenda, o que você gostaria de fazer comigo?" },
  { id: "fdr2", themeId: "fora-da-rotina", intensity: "honest", text: "Que convite inesperado você aceitaria receber de mim?" },
  { id: "via1", themeId: "viagens", intensity: "gentle", text: "Qual lugar você gostaria de conhecer comigo sem precisar esperar a ocasião perfeita?" },
  { id: "via2", themeId: "viagens", intensity: "honest", text: "Que viagem nossa você repetiria, e o que faria diferente desta vez?" },
  { id: "cd1", themeId: "carreira-dinheiro", intensity: "honest", text: "Que sonho profissional você gostaria que a gente construísse lado a lado?" },
  { id: "cd2", themeId: "carreira-dinheiro", intensity: "deep", text: "Como vocês gostariam de conversar sobre dinheiro quando a vida apertar?" },
];

const themes = connectionThemes;
const questions: Question[] = connectionQuestions;

const packageConfig = {
  couple: { name: "Pacote Casal", limit: 1 },
  family: { name: "Pacote Família", limit: 5 },
} as const;

const router: IRouter = Router();

router.get("/questions/themes", (_req, res): void => {
  res.json(ListQuestionThemesResponse.parse(themes));
});

router.get("/questions", (req, res): void => {
  const parsed = ListQuestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = questions.filter((question) => {
    const themeMatches = parsed.data.theme ? question.themeId === parsed.data.theme : true;
    return themeMatches;
  });
  res.json(ListQuestionsResponse.parse(result));
});

router.get("/access/preview", (_req, res): void => {
  res.json(GetAccessPreviewResponse.parse({
    role: "visitor",
    hasAccess: false,
    canInvite: false,
    packageName: null,
    invitesUsed: 0,
    invitesLimit: 0,
  }));
});

router.post("/access/sessions", async (req, res): Promise<void> => {
  if (process.env.ALLOW_DEMO_ACCESS !== "true") {
    res.status(403).json({ error: "Acesso direto desativado. Use /checkout/create." });
    return;
  }
  const parsed = CreateQuestionSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const config = packageConfig[parsed.data.packageId];
  const [session] = await db.insert(sessionsTable).values({
    id: crypto.randomUUID(),
    buyerName: parsed.data.buyerName,
    packageId: parsed.data.packageId,
    packageName: config.name,
    inviteLimit: config.limit,
    invitesUsed: 0,
    accessGranted: true,
  }).returning();
  res.status(201).json(CreateQuestionSessionResponse.parse(session));
});

router.post("/checkout/create", async (req, res): Promise<void> => {
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (
    !parsed.success
    || parsed.data.packageId !== "couple"
    || !parsed.data.buyerName.trim()
  ) {
    res.status(400).json({ error: "Dados de checkout inválidos" });
    return;
  }

  const productId = process.env.ABACATEPAY_PRODUCT_ID_CASAL;
  if (!productId) {
    res.status(500).json({ error: "Produto da Abacate Pay não configurado" });
    return;
  }

  const config = packageConfig[parsed.data.packageId];
  const sessionId = crypto.randomUUID();
  const [session] = await db.insert(sessionsTable).values({
    id: sessionId,
    buyerName: parsed.data.buyerName.trim(),
    buyerEmail: parsed.data.buyerEmail,
    packageId: parsed.data.packageId,
    packageName: config.name,
    inviteLimit: config.limit,
    invitesUsed: 0,
    accessGranted: false,
  }).returning();

  try {
    const { checkoutUrl, billId } = await createAbacateCheckout({
      sessionId,
      productId,
      buyerName: session.buyerName,
      buyerEmail: parsed.data.buyerEmail,
    });
    res.status(201).json(CreateCheckoutResponse.parse({ sessionId, checkoutUrl, billId }));
  } catch (error) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
    req.log.error({ err: error, sessionId }, "Failed to create Abacate Pay checkout");
    res.status(502).json({
      error: "Não foi possível iniciar o pagamento. Tenta de novo em instantes.",
    });
  }
});

router.post("/checkout/abacatepay-webhook", async (req, res): Promise<void> => {
  const signature = req.header("X-Webhook-Signature");
  req.log.info({
    webhook: {
      headers: {
        signature: signature ? `${signature.slice(0, 12)}…` : undefined,
      },
      body: req.body,
    },
  }, "Abacate webhook incoming");

  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  const parsed = ReceiveAbacatePayWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Payload de webhook inválido" });
    return;
  }

  const signatureValid = !!rawBody && verifyAbacateSignature(rawBody, signature);
  const event = parsed.data.event;
  const eventId = parsed.data.id;
  const billId = typeof parsed.data.data.id === "string" ? parsed.data.data.id : null;
  const sessionIdFromBody = parsed.data.data.metadata?.sessionId ?? parsed.data.data.externalId;
  let sessionId = typeof sessionIdFromBody === "string" ? sessionIdFromBody : null;
  let paymentConfirmed = signatureValid && event === "checkout.completed" && !!sessionId;

  if (!paymentConfirmed && billId) {
    const checkout = await fetchAbacateCheckoutStatus(billId);
    if (checkout?.status === "PAID") {
      const metadataSessionId = checkout.metadata?.sessionId;
      if (typeof metadataSessionId === "string") sessionId = metadataSessionId;
      paymentConfirmed = !!sessionId;
    }
  }

  if (!paymentConfirmed) {
    res.status(401).json({ error: "Não foi possível confirmar o pagamento" });
    return;
  }

  if (eventId) {
    const result = await db.transaction(async (tx) => {
      const [processedEvent] = await tx.insert(processedEventsTable)
        .values({ id: eventId })
        .onConflictDoNothing()
        .returning();
      if (!processedEvent) return "duplicate" as const;

      if (typeof sessionId === "string") {
        await tx.update(sessionsTable)
          .set({ accessGranted: true })
          .where(eq(sessionsTable.id, sessionId));
      }
      return "processed" as const;
    });
    if (result === "duplicate") {
      res.json(ReceiveAbacatePayWebhookResponse.parse({
        accepted: true,
        message: "Evento já processado",
      }));
      return;
    }
  } else if (typeof sessionId === "string") {
    await db.update(sessionsTable)
      .set({ accessGranted: true })
      .where(eq(sessionsTable.id, sessionId));
  }

  res.json(ReceiveAbacatePayWebhookResponse.parse({
    accepted: true,
    message: "Webhook recebido",
  }));
});

router.get("/access/sessions/:sessionId", async (req, res): Promise<void> => {
  const parsed = GetQuestionSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db.select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, parsed.data.sessionId))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }

  if (!session.accessGranted) {
    const bill = req.query.bill;
    const billId = typeof bill === "string" ? bill : undefined;
    if (billId) {
      const checkout = await fetchAbacateCheckoutStatus(billId);
      if (checkout?.status === "PAID" && checkout.metadata?.sessionId === session.id) {
        await db.update(sessionsTable)
          .set({ accessGranted: true })
          .where(eq(sessionsTable.id, session.id));
        session.accessGranted = true;
      }
    }
  }

  res.json(GetQuestionSessionResponse.parse(session));
});

router.post("/access/sessions/:sessionId/invites", async (req, res): Promise<void> => {
  const params = CreateInviteParams.safeParse(req.params);
  const body = CreateInviteBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados do convite inválidos" });
    return;
  }
  const [session] = await db.select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.sessionId))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }
  if (session.invitesUsed >= session.inviteLimit) {
    res.status(409).json({ error: "O limite de convites deste pacote foi atingido" });
    return;
  }
  const token = crypto.randomBytes(12).toString("base64url");
  const baseUrl = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "")
    || (process.env.REPLIT_DOMAINS?.split(",")[0]
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost");
  const invite = await db.transaction(async (tx) => {
    const [updatedSession] = await tx.update(sessionsTable)
      .set({ invitesUsed: sql`${sessionsTable.invitesUsed} + 1` })
      .where(and(
        eq(sessionsTable.id, session.id),
        sql`${sessionsTable.invitesUsed} < ${sessionsTable.inviteLimit}`,
      ))
      .returning();
    if (!updatedSession) return null;

    const [createdInvite] = await tx.insert(invitesTable).values({
      token,
      guestName: body.data.guestName,
      sessionId: session.id,
      inviteUrl: `${baseUrl}/invite/${token}`,
      isUsed: false,
    }).returning();
    return createdInvite;
  });
  if (!invite) {
    res.status(409).json({ error: "O limite de convites deste pacote foi atingido" });
    return;
  }
  res.status(201).json(invite);
});

router.get("/access/invites/:token", async (req, res): Promise<void> => {
  const parsed = GetInviteParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [invite] = await db.select()
    .from(invitesTable)
    .where(eq(invitesTable.token, parsed.data.token))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "Convite não encontrado ou expirado" });
    return;
  }
  const [session] = await db.select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, invite.sessionId))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }
  res.json({
    role: "guest",
    hasAccess: session.accessGranted,
    canInvite: false,
    guestName: invite.guestName,
    packageName: session.packageName,
  });
});

router.post("/checkout/webhook", async (req, res): Promise<void> => {
  if (process.env.ALLOW_DEMO_ACCESS !== "true") {
    res.status(403).json({ error: "Webhook de demonstração desativado." });
    return;
  }
  const parsed = ReceiveCheckoutWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const config = packageConfig[parsed.data.packageId];
  const result = await db.transaction(async (tx) => {
    const [processedEvent] = await tx.insert(processedEventsTable)
      .values({ id: parsed.data.eventId })
      .onConflictDoNothing()
      .returning();
    if (!processedEvent) return { status: "duplicate" as const, session: null };

    const [session] = await tx.insert(sessionsTable).values({
      id: parsed.data.paymentReference,
      buyerName: parsed.data.buyerName,
      buyerEmail: parsed.data.buyerEmail,
      packageId: parsed.data.packageId,
      packageName: config.name,
      inviteLimit: config.limit,
      invitesUsed: 0,
      accessGranted: true,
    }).onConflictDoUpdate({
      target: sessionsTable.id,
      set: { accessGranted: true },
    }).returning();
    return { status: "processed" as const, session };
  });
  if (result.status === "duplicate") {
    res.json({ accepted: true, accessId: parsed.data.paymentReference, message: "Evento já processado" });
    return;
  }
  res.json(ReceiveCheckoutWebhookResponse.parse({
    accepted: true,
    accessId: result.session.id,
    message: "Pagamento confirmado e acesso liberado",
  }));
});

export default router;