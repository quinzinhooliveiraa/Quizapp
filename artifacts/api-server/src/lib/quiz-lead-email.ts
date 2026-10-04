function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export function buildQuizDiagnosisEmail(params: {
  leadId: string;
  diagnosisLabel: string;
  diagnosisCopy: string;
  region: string;
}) {
  const baseUrl = (
    process.env.PUBLIC_BASE_URL ||
    "https://www.perguntasdeconexao.com.br"
  ).replace(/\/+$/, "");
  const actionUrl =
    params.region === "BR"
      ? `${baseUrl}/retomar/${encodeURIComponent(params.leadId)}`
      : `${baseUrl}/quiz`;
  const optOutUrl = `${baseUrl}/sair/${encodeURIComponent(params.leadId)}`;
  const label = params.diagnosisLabel.replace(/[\r\n]/g, " ").trim();
  const opening =
    "Oi. Aqui é o Joaquim, do Perguntas de Conexão. Pessoa de verdade, não robô.";
  const resultLine =
    `Seu resultado do teste — risco de continuar no automático: ${label}.`;
  const nextStep =
    "A boa notícia? Você não precisa esperar isso virar um problema maior para mudar uma noite.";
  const actionLine =
    params.region === "BR"
      ? "Seu acesso com o preço de oferta está aqui:"
      : "Para ver como começar, volte ao quiz:";
  const disclaimer =
    "Este score de conexão é informal e serve apenas para reflexão. Ele não substitui uma avaliação clínica.";
  const paragraphs = params.diagnosisCopy
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const htmlCopy = paragraphs
    .map(
      (paragraph) =>
        `<p style="font-size:15px;line-height:1.6;color:#4a4550;margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const textContent = [
    opening,
    resultLine,
    ...paragraphs,
    nextStep,
    `${actionLine} ${actionUrl}`,
    disclaimer,
    "Joaquim",
    `Não quer mais receber? Sair da lista: ${optOutUrl}`,
  ].join("\n\n");
  const subject = `Seu diagnóstico: ${label}`;
  const htmlContent = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#17121b;">
      <p style="font-size:14px;color:#6b6070;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;">Perguntas de Conexão</p>
      <h1 style="font-size:24px;font-weight:600;margin:0 0 8px;">${escapeHtml(label)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4a4550;margin:0 0 16px;">${escapeHtml(opening)}</p>
      <p style="font-size:15px;line-height:1.6;color:#4a4550;margin:0 0 16px;">${escapeHtml(resultLine)}</p>
      ${htmlCopy}
      <p style="font-size:15px;line-height:1.6;color:#4a4550;margin:0 0 16px;">${escapeHtml(nextStep)}</p>
      <a href="${escapeHtml(actionUrl)}" style="display:block;text-align:center;background:#8a2f4d;color:#fff;text-decoration:none;border-radius:999px;padding:15px 20px;font-size:16px;font-weight:600;margin:24px 0;">${escapeHtml(actionLine)}</a>
      <p style="font-size:13px;line-height:1.55;color:#8b8290;margin:0 0 16px;">${escapeHtml(disclaimer)}</p>
      <p style="font-size:14px;line-height:1.5;color:#4a4550;margin:0 0 16px;">Joaquim</p>
      <p style="font-size:12px;line-height:1.5;color:#8b8290;margin:24px 0 0;">Não quer mais receber? <a href="${escapeHtml(optOutUrl)}" style="color:#8a2f4d;">Sair da lista</a>.</p>
    </div>
  `;

  return { subject, htmlContent, textContent };
}