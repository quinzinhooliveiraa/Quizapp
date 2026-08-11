import { Router, type IRouter } from "express";
import {
  CreateInviteBody,
  CreateInviteParams,
  CreateQuestionSessionBody,
  CreateQuestionSessionResponse,
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
import crypto from "node:crypto";

type Theme = {
  id: string;
  title: string;
  description: string;
  count: number;
};

type Question = {
  id: string;
  themeId: string;
  text: string;
  intensity: "gentle" | "honest" | "deep";
};

type Session = {
  id: string;
  buyerName: string;
  packageId: string;
  packageName: string;
  inviteLimit: number;
  invitesUsed: number;
  accessGranted: boolean;
};

type Invite = {
  token: string;
  guestName: string;
  sessionId: string;
  inviteUrl: string;
  isUsed: boolean;
};

const themes: Theme[] = [
  {
    id: "beginning",
    title: "Começar de verdade",
    description: "Perguntas leves para sair do automático e abrir espaço.",
    count: 12,
  },
  {
    id: "vulnerability",
    title: "Vulnerabilidade",
    description: "Para falar do que geralmente fica guardado.",
    count: 14,
  },
  {
    id: "future",
    title: "O que vem pela frente",
    description: "Desejos, medos e a vida que vocês imaginam juntos.",
    count: 12,
  },
  {
    id: "memories",
    title: "Memórias que ficam",
    description: "Histórias, detalhes e momentos que aproximam.",
    count: 10,
  },
];

const questions: Question[] = [
  { id: "b1", themeId: "beginning", intensity: "gentle", text: "Qual foi um detalhe pequeno do nosso primeiro encontro que você ainda lembra?" },
  { id: "b2", themeId: "beginning", intensity: "gentle", text: "Em que momento você percebeu que gostava de conversar comigo?" },
  { id: "b3", themeId: "beginning", intensity: "honest", text: "O que faz você se sentir realmente à vontade perto de alguém?" },
  { id: "b4", themeId: "beginning", intensity: "honest", text: "Que assunto você gostaria que a gente conversasse mais?" },
  { id: "b5", themeId: "beginning", intensity: "deep", text: "O que você gostaria que eu entendesse sem você precisar pedir?" },
  { id: "v1", themeId: "vulnerability", intensity: "honest", text: "O que costuma passar pela sua cabeça quando você se sente distante de mim?" },
  { id: "v2", themeId: "vulnerability", intensity: "deep", text: "Qual medo seu você acha que poucas pessoas conhecem?" },
  { id: "v3", themeId: "vulnerability", intensity: "deep", text: "Em que situação você mais precisa de acolhimento, mas costuma fingir que está tudo bem?" },
  { id: "v4", themeId: "vulnerability", intensity: "honest", text: "O que eu faço que ajuda você a voltar para si?" },
  { id: "v5", themeId: "vulnerability", intensity: "deep", text: "Existe alguma parte da sua história que você ainda está aprendendo a contar?" },
  { id: "f1", themeId: "future", intensity: "gentle", text: "Como seria um dia comum perfeito para nós daqui a alguns anos?" },
  { id: "f2", themeId: "future", intensity: "honest", text: "Que sonho seu você quer proteger, mesmo quando a vida fica corrida?" },
  { id: "f3", themeId: "future", intensity: "deep", text: "O que você não quer repetir na família que pretende construir?" },
  { id: "f4", themeId: "future", intensity: "deep", text: "Que tipo de pessoa você quer se tornar ao lado de quem ama?" },
  { id: "m1", themeId: "memories", intensity: "gentle", text: "Qual momento nosso você gostaria de guardar em uma fotografia?" },
  { id: "m2", themeId: "memories", intensity: "honest", text: "Qual foi uma vez em que você se sentiu escolhido por mim?" },
  { id: "m3", themeId: "memories", intensity: "deep", text: "Que experiência mudou a forma como você entende o amor?" },
  { id: "m4", themeId: "memories", intensity: "honest", text: "Que lembrança da sua família ajuda a explicar quem você é hoje?" },
];

const sessions = new Map<string, Session>();
const invites = new Map<string, Invite>();
const processedEvents = new Set<string>();

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

router.post("/access/sessions", (req, res): void => {
  const parsed = CreateQuestionSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const config = packageConfig[parsed.data.packageId];
  const session: Session = {
    id: crypto.randomUUID(),
    buyerName: parsed.data.buyerName,
    packageId: parsed.data.packageId,
    packageName: config.name,
    inviteLimit: config.limit,
    invitesUsed: 0,
    accessGranted: true,
  };
  sessions.set(session.id, session);
  res.status(201).json(CreateQuestionSessionResponse.parse(session));
});

router.get("/access/sessions/:sessionId", (req, res): void => {
  const parsed = GetQuestionSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const session = sessions.get(parsed.data.sessionId);
  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }
  res.json(GetQuestionSessionResponse.parse(session));
});

router.post("/access/sessions/:sessionId/invites", (req, res): void => {
  const params = CreateInviteParams.safeParse(req.params);
  const body = CreateInviteBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados do convite inválidos" });
    return;
  }
  const session = sessions.get(params.data.sessionId);
  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }
  if (session.invitesUsed >= session.inviteLimit) {
    res.status(409).json({ error: "O limite de convites deste pacote foi atingido" });
    return;
  }
  const token = crypto.randomBytes(12).toString("base64url");
  const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0]
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost";
  const invite: Invite = {
    token,
    guestName: body.data.guestName,
    sessionId: session.id,
    inviteUrl: `${baseUrl}/invite/${token}`,
    isUsed: false,
  };
  invites.set(token, invite);
  session.invitesUsed += 1;
  res.status(201).json(invite);
});

router.get("/access/invites/:token", (req, res): void => {
  const parsed = GetInviteParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const invite = invites.get(parsed.data.token);
  if (!invite) {
    res.status(404).json({ error: "Convite não encontrado ou expirado" });
    return;
  }
  const session = sessions.get(invite.sessionId);
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

router.post("/checkout/webhook", (req, res): void => {
  const parsed = ReceiveCheckoutWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (processedEvents.has(parsed.data.eventId)) {
    res.json({ accepted: true, accessId: parsed.data.paymentReference, message: "Evento já processado" });
    return;
  }
  processedEvents.add(parsed.data.eventId);
  const config = packageConfig[parsed.data.packageId];
  const session: Session = {
    id: parsed.data.paymentReference,
    buyerName: parsed.data.buyerName,
    packageId: parsed.data.packageId,
    packageName: config.name,
    inviteLimit: config.limit,
    invitesUsed: 0,
    accessGranted: true,
  };
  sessions.set(session.id, session);
  res.json(ReceiveCheckoutWebhookResponse.parse({
    accepted: true,
    accessId: session.id,
    message: "Pagamento confirmado e acesso liberado",
  }));
});

export default router;