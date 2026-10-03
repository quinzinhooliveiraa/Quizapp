import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { isAdminSession } from "./feedback";

// Escritório: o Mac do Joaquim envia o estado da empresa (agentes do Claude) e a aba
// "Escritório" do admin lê. Tudo guardado em 2 linhas de app_settings, sem migração.
const router: IRouter = Router();
const KEY_ESTADO = "escritorio_estado";
const KEY_ACOES = "escritorio_acoes";
const MAX_BYTES = 200_000;

async function readSetting(key: string): Promise<{ value: any; updatedAt: Date | null }> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
  if (!row) return { value: null, updatedAt: null };
  try {
    return { value: JSON.parse(row.value), updatedAt: row.updatedAt };
  } catch {
    return { value: null, updatedAt: row.updatedAt };
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  await db
    .insert(appSettingsTable)
    .values({ key, value: text, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: text, updatedAt: new Date() } });
}

function tokenOk(header: unknown): boolean {
  const expected = process.env.ESCRITORIO_TOKEN || "";
  if (!expected || typeof header !== "string") return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Mac -> servidor. Devolve as ações feitas no celular (tarefa marcada, ideia) e limpa a fila.
router.post("/escritorio/sync", async (req, res): Promise<void> => {
  if (!tokenOk(req.headers["x-escritorio-token"])) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const estado = req.body?.estado;
  if (!estado || typeof estado !== "object" || JSON.stringify(estado).length > MAX_BYTES) {
    res.status(400).json({ error: "invalid_state" });
    return;
  }
  const { value: acoes } = await readSetting(KEY_ACOES);
  const lista = Array.isArray(acoes) ? acoes : [];
  // o Mac ainda não aplicou os checks da fila: aplica aqui para o check do celular não "voltar"
  if (Array.isArray(estado.tarefas)) {
    for (const a of lista) {
      if (a?.tipo === "tarefa") estado.tarefas = estado.tarefas.map((t: any) => (t?.id === a.id ? { ...t, feito: a.feito } : t));
    }
  }
  await writeSetting(KEY_ESTADO, estado);
  if (lista.length) await writeSetting(KEY_ACOES, []);
  res.json({ ok: true, acoes: lista });
});

// Admin lê o estado (a aba faz isso a cada 2 s enquanto está aberta).
router.get("/admin/escritorio", async (req, res): Promise<void> => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!(await isAdminSession(sessionId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const { value, updatedAt } = await readSetting(KEY_ESTADO);
  res.set("Cache-Control", "no-store");
  res.json({ estado: value || {}, recebidoEm: updatedAt });
});

// Admin marca tarefa ou manda ideia pelo celular: entra na fila que o Mac busca no próximo sync.
router.post("/admin/escritorio/acao", async (req, res): Promise<void> => {
  const body = req.body || {};
  if (!(await isAdminSession(body.sessionId))) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  let acao: Record<string, unknown> | null = null;
  if (body.tipo === "tarefa" && typeof body.id === "string") {
    acao = { tipo: "tarefa", id: body.id.slice(0, 100), feito: Boolean(body.feito), at: new Date().toISOString() };
  } else if (body.tipo === "ideia" && typeof body.texto === "string" && body.texto.trim()) {
    acao = { tipo: "ideia", texto: body.texto.trim().slice(0, 2000), at: new Date().toISOString() };
  }
  if (!acao) {
    res.status(400).json({ error: "invalid_action" });
    return;
  }
  const { value: acoes } = await readSetting(KEY_ACOES);
  const lista = (Array.isArray(acoes) ? acoes : []).concat([acao]).slice(-100);
  await writeSetting(KEY_ACOES, lista);
  // reflete a tarefa marcada no estado já salvo, para o celular ver na hora
  if (acao.tipo === "tarefa") {
    const { value: estado } = await readSetting(KEY_ESTADO);
    if (estado && Array.isArray(estado.tarefas)) {
      estado.tarefas = estado.tarefas.map((t: any) => (t?.id === acao!.id ? { ...t, feito: acao!.feito } : t));
      await writeSetting(KEY_ESTADO, estado);
    }
  }
  res.json({ ok: true });
});

export default router;