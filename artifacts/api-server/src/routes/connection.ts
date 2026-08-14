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
  audience: "todos" | "casais" | "18+";
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
    id: "porto-seguro",
    title: "Porto Seguro",
    description: "As conversas que parecem casa.",
    count: 5,
    audience: "todos",
  },
  {
    id: "livro-aberto",
    title: "Livro Aberto",
    description: "Sem filtro, cara a cara.",
    count: 5,
    audience: "todos",
  },
  {
    id: "faisca",
    title: "Faísca",
    description: "O lado mais provocante de vocês dois.",
    count: 2,
    audience: "casais",
  },
  {
    id: "voce-nao-sabia",
    title: "Você Não Sabia",
    description: "Descobertas que ainda cabem entre vocês.",
    count: 2,
    audience: "todos",
  },
  {
    id: "em-voz-alta",
    title: "Em Voz Alta",
    description: "A vida que os dois querem construir.",
    count: 4,
    audience: "todos",
  },
  {
    id: "la-atras",
    title: "Lá Atrás",
    description: "O que formou quem você é hoje.",
    count: 4,
    audience: "todos",
  },
  {
    id: "luzes-baixas",
    title: "Luzes Baixas",
    description: "Para quando a noite pede mais coragem.",
    count: 2,
    audience: "18+",
  },
  {
    id: "modo-leve",
    title: "Modo Leve",
    description: "Pra rir e não levar tão a sério.",
    count: 2,
    audience: "todos",
  },
  {
    id: "mesmo-longe",
    title: "Mesmo Longe",
    description: "Pra quando a rotina ou a distância afastam.",
    count: 2,
    audience: "casais",
  },
  {
    id: "perto-de-novo",
    title: "Perto de Novo",
    description: "Esquentar o espaço entre vocês.",
    count: 2,
    audience: "casais",
  },
  {
    id: "proximo-passo",
    title: "Próximo Passo",
    description: "Pra onde essa história está indo.",
    count: 2,
    audience: "casais",
  },
  {
    id: "fora-da-rotina",
    title: "Fora da Rotina",
    description: "Sacudir o de sempre, tentar algo novo.",
    count: 2,
    audience: "todos",
  },
];

const questions: Question[] = [
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