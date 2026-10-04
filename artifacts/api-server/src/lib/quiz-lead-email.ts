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
}) {
  const baseUrl = (
    process.env.PUBLIC_BASE_URL ||
    "https://www.perguntasdeconexao.com.br"
  ).replace(/\/+$/, "");
  const resumeUrl = `${baseUrl}/retomar/${encodeURIComponent(params.leadId)}`;
  const optOutUrl = `${baseUrl}/sair/${encodeURIComponent(params.leadId)}`;
  const label = params.diagnosisLabel.replace(/[\r\n]/g, " ").trim();
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
  const textCopy = paragraphs.join("\n\n");
  const subject = `Seu resultado do teste: ${label}`;
  const htmlContent = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#17121b;">
      <p style="font-size:14px;color:#6b6070;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;">Perguntas de Conexão</p>
      <h1 style="font-size:24px;font-weight:600;margin:0 0 8px;">${escapeHtml(label)}</h1>
      ${htmlCopy}
      <a href="${escapeHtml(resumeUrl)}" style="display:block;text-align:center;background:#8a2f4d;color:#fff;text-decoration:none;border-radius:999px;padding:15px 20px;font-size:16px;font-weight:600;margin:24px 0;">Ver como começar</a>
      <p style="font-size:12px;line-height:1.5;color:#8b8290;margin:24px 0 0;">Se não quiser receber outros e-mails, <a href="${escapeHtml(optOutUrl)}" style="color:#8a2f4d;">descadastre-se aqui</a>.</p>
    </div>
  `;
  const textContent = `Perguntas de Conexão\n\n${label}\n\n${textCopy}\n\nVer como começar: ${resumeUrl}\n\nPara não receber outros e-mails, acesse: ${optOutUrl}`;

  return { subject, htmlContent, textContent };
}