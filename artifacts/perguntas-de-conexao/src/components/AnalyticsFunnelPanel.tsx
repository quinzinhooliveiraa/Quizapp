import {
  Activity,
  ArrowDownRight,
  BarChart3,
  Check,
  CreditCard,
  Eye,
  Gauge,
  LayoutList,
  Monitor,
  MousePointer2,
  Smartphone,
  Tablet,
  Timer,
  Users,
  Waves,
} from "lucide-react";
import "./analytics-funnel.css";

export type AnalyticsLandingPageId = "v1" | "v2" | "lp3" | "all";
export type AnalyticsViewMode = "funnel" | "list";

export type AnalyticsFunnelData = {
  lpId: AnalyticsLandingPageId;
  from: string;
  to: string;
  views: number;
  ctaClicks: number;
  checkoutsStarted: number;
  purchasesConfirmed: number;
  avgTimeOnPageSeconds: number | null;
  topExitSections: Array<{ section: string; count: number }>;
  deviceBreakdown: {
    views: { mobile: number; desktop: number; tablet: number };
    ctaClicks: { mobile: number; desktop: number; tablet: number };
    checkoutsStarted: { mobile: number; desktop: number; tablet: number };
    purchasesConfirmed: { mobile: number; desktop: number; tablet: number };
  };
  checkoutsByCtaSource: Array<{ source: string; count: number }>;
  visitors: { unique: number; new: number; recurring: number };
  avgLcpMs: number | null;
};

type AnalyticsFunnelPanelProps = {
  data: AnalyticsFunnelData;
  viewMode: AnalyticsViewMode;
  onViewModeChange: (mode: AnalyticsViewMode) => void;
};

type Stage = {
  key: "views" | "ctaClicks" | "checkoutsStarted" | "purchasesConfirmed";
  label: string;
  icon: typeof Eye;
};

const STAGES: Stage[] = [
  { key: "views", label: "Visitas", icon: Eye },
  { key: "ctaClicks", label: "Clicaram comprar", icon: MousePointer2 },
  { key: "checkoutsStarted", label: "Iniciaram checkout", icon: CreditCard },
  { key: "purchasesConfirmed", label: "Pagaram", icon: Check },
];

const DEVICE_COLUMNS = [
  { key: "mobile", label: "Celular", icon: Smartphone },
  { key: "desktop", label: "Desktop", icon: Monitor },
  { key: "tablet", label: "Tablet", icon: Tablet },
] as const;

const LANDING_LABELS: Record<AnalyticsLandingPageId, string> = {
  v1: "Reacender a chama",
  v2: "Perguntas que aproximam",
  lp3: "Oferta essencial",
  all: "Todas as landing pages",
};

const SOURCE_LABELS: Record<string, string> = {
  hero_quiz: "Quiz no topo",
  hero_comprar: "Comprar no topo",
  lp3_offer: "Oferta da página",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "—";
  return `${((value / total) * 100).toFixed(1).replace(".", ",")}%`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "Sem dados";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`;
}

function formatLcp(milliseconds: number | null) {
  if (milliseconds == null) return "Sem dados";
  return `${Math.round(milliseconds)} ms`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function formatDateRange(from: string, to: string) {
  if (!from && !to) return "Período não informado";
  if (from === to || !to) return formatDate(from);
  return `${formatDate(from)} — ${formatDate(to)}`;
}

function humanize(value: string) {
  const knownLabel = SOURCE_LABELS[value];
  if (knownLabel) return knownLabel;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function wavePath(center: number, y: number, width: number, height: number) {
  const left = center - width / 2;
  const right = center + width / 2;
  return [
    `M ${left} ${y + 12}`,
    `C ${left + width * 0.16} ${y - 3}, ${left + width * 0.3} ${y + 14}, ${center} ${y + 4}`,
    `C ${right - width * 0.3} ${y - 5}, ${right - width * 0.15} ${y + 17}, ${right} ${y + 8}`,
    `L ${right} ${y + height - 12}`,
    `C ${right - width * 0.17} ${y + height + 3}, ${right - width * 0.33} ${y + height - 14}, ${center} ${y + height - 4}`,
    `C ${left + width * 0.3} ${y + height + 4}, ${left + width * 0.15} ${y + height - 17}, ${left} ${y + height - 10}`,
    "Z",
  ].join(" ");
}

function EmptyDiagnostic({ children }: { children: string }) {
  return (
    <div className="analytics-funnel-empty" data-testid="empty-analytics-diagnostic">
      <span className="analytics-funnel-empty-line" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function DeviceValue({
  value,
  total,
  testId,
}: {
  value: number;
  total: number;
  testId: string;
}) {
  return (
    <span className="analytics-funnel-device-value" data-testid={testId}>
      <strong>{formatNumber(value)}</strong>
      <small>{formatPercent(value, total)}</small>
    </span>
  );
}

function AnalyticsFunnelPanel({
  data,
  viewMode,
  onViewModeChange,
}: AnalyticsFunnelPanelProps) {
  const hasViews = data.views > 0;
  const maxExitCount = Math.max(...data.topExitSections.map((item) => item.count), 0);
  const maxSourceCount = Math.max(
    ...data.checkoutsByCtaSource.map((item) => item.count),
    0,
  );
  const visitorSplitTotal = data.visitors.new + data.visitors.recurring;
  const heroExitCount = data.topExitSections
    .filter((item) => item.section.toLowerCase().includes("hero"))
    .reduce((total, item) => total + item.count, 0);
  const unpaidCheckouts = Math.max(
    data.checkoutsStarted - data.purchasesConfirmed,
    0,
  );
  const deviceRows = STAGES.map((stage) => ({
    ...stage,
    values: data.deviceBreakdown[stage.key],
  }));

  return (
    <section className="analytics-funnel-panel" aria-labelledby="analytics-funnel-title">
      <header className="analytics-funnel-header">
        <div className="analytics-funnel-heading">
          <div className="analytics-funnel-kicker">
            <Activity size={14} strokeWidth={2.4} aria-hidden="true" />
            Leitura de conversão
          </div>
          <h2 id="analytics-funnel-title">O caminho até a compra</h2>
          <p>
            {LANDING_LABELS[data.lpId]} <span aria-hidden="true">·</span>{" "}
            {formatDateRange(data.from, data.to)}
          </p>
        </div>
        <div className="analytics-funnel-view-switch" aria-label="Modo de visualização">
          <button
            type="button"
            className={`analytics-funnel-view-button${viewMode === "funnel" ? " is-active" : ""}`}
            aria-pressed={viewMode === "funnel"}
            onClick={() => onViewModeChange("funnel")}
            data-testid="button-analytics-view-funnel"
          >
            <Waves size={15} aria-hidden="true" />
            Funil
          </button>
          <button
            type="button"
            className={`analytics-funnel-view-button${viewMode === "list" ? " is-active" : ""}`}
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            data-testid="button-analytics-view-list"
          >
            <LayoutList size={15} aria-hidden="true" />
            Lista
          </button>
        </div>
      </header>

      <div className="analytics-funnel-overview">
        <div className="analytics-funnel-overview-intro">
          <span className="analytics-funnel-overview-dot" aria-hidden="true" />
          <span>
            {hasViews
              ? `${formatNumber(data.views)} visitas observadas neste período`
              : "Nenhuma visita observada neste período"}
          </span>
        </div>
        <strong className="analytics-funnel-overview-rate">
          {formatPercent(data.purchasesConfirmed, data.views)}{" "}
          <span>de visita a pagamento</span>
        </strong>
      </div>

      <div className="analytics-funnel-kpi-grid">
        <article className="analytics-funnel-kpi">
          <span className="analytics-funnel-kpi-label">
            <Timer size={14} aria-hidden="true" />
            Tempo médio na tela
          </span>
          <strong>{formatDuration(data.avgTimeOnPageSeconds)}</strong>
          <small>entre as saídas registradas</small>
        </article>
        <article className="analytics-funnel-kpi">
          <span className="analytics-funnel-kpi-label">
            <ArrowDownRight size={14} aria-hidden="true" />
            Saíram no topo
          </span>
          <strong>{formatPercent(heroExitCount, data.views)}</strong>
          <small>{formatNumber(heroExitCount)} saídas no hero</small>
        </article>
        <article className="analytics-funnel-kpi is-alert">
          <span className="analytics-funnel-kpi-label">
            <CreditCard size={14} aria-hidden="true" />
            Iniciaram e não pagaram
          </span>
          <strong>{formatNumber(unpaidCheckouts)}</strong>
          <small>checkouts sem confirmação</small>
        </article>
      </div>

      {viewMode === "funnel" ? (
        <div className="analytics-funnel-visual" data-testid="analytics-funnel-visual">
          <svg
            className="analytics-funnel-svg"
            viewBox="0 0 1000 314"
            role="img"
            aria-labelledby="analytics-funnel-svg-title analytics-funnel-svg-description"
          >
            <title id="analytics-funnel-svg-title">Funil de conversão em quatro etapas</title>
            <desc id="analytics-funnel-svg-description">
              Visitas, cliques para comprar, checkouts iniciados e pagamentos confirmados,
              com percentuais relativos ao número de visitas.
            </desc>
            <defs>
              <linearGradient id="analytics-funnel-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8952b8" />
                <stop offset="52%" stopColor="#c26cac" />
                <stop offset="100%" stopColor="#ef8fa3" />
              </linearGradient>
              <linearGradient id="analytics-funnel-wave-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#c8a4ef" stopOpacity="0.68" />
                <stop offset="100%" stopColor="#ffb0b0" stopOpacity="0.74" />
              </linearGradient>
            </defs>
            <line
              x1="500"
              y1="18"
              x2="500"
              y2="300"
              className="analytics-funnel-center-line"
              aria-hidden="true"
            />
            {STAGES.map((stage, index) => {
              const value = data[stage.key];
              const width = value > 0 ? Math.max(30, 500 * (value / Math.max(data.views, 1))) : 0;
              const y = 12 + index * 74;
              return (
                <g key={stage.key} className="analytics-funnel-svg-stage">
                  {width > 0 && (
                    <>
                      <path
                        d={wavePath(500, y, width, 57)}
                        fill="url(#analytics-funnel-wave-gradient)"
                        className="analytics-funnel-wave"
                      />
                      <path
                        d={wavePath(500, y + 5, width * 0.94, 17)}
                        fill="url(#analytics-funnel-wave-highlight)"
                        className="analytics-funnel-wave-highlight"
                      />
                    </>
                  )}
                  <text x="34" y={y + 30} className="analytics-funnel-svg-label">
                    {stage.label}
                  </text>
                  <text x="34" y={y + 49} className="analytics-funnel-svg-percent">
                    {formatPercent(value, data.views)} do topo
                  </text>
                  <text x="966" y={y + 39} textAnchor="end" className="analytics-funnel-svg-value">
                    {formatNumber(value)}
                  </text>
                </g>
              );
            })}
          </svg>
          {!hasViews && (
            <div className="analytics-funnel-visual-empty">
              <span>O funil ganha forma quando a primeira visita chegar.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="analytics-funnel-list-view" data-testid="analytics-funnel-list-view">
          {STAGES.map((stage, index) => {
            const StageIcon = stage.icon;
            const value = data[stage.key];
            const nextValue = STAGES[index + 1] ? data[STAGES[index + 1].key] : null;
            return (
              <div className="analytics-funnel-list-row" key={stage.key} data-testid={`row-analytics-stage-${stage.key}`}>
                <span className="analytics-funnel-list-index">0{index + 1}</span>
                <span className="analytics-funnel-list-icon" aria-hidden="true">
                  <StageIcon size={17} />
                </span>
                <span className="analytics-funnel-list-copy">
                  <strong>{stage.label}</strong>
                  <small>
                    {nextValue != null
                      ? `${formatPercent(nextValue, value)} seguem para a próxima etapa`
                      : "Etapa final do caminho"}
                  </small>
                </span>
                <strong className="analytics-funnel-list-number">{formatNumber(value)}</strong>
                <span className="analytics-funnel-list-percent">
                  {formatPercent(value, data.views)} <small>do topo</small>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="analytics-funnel-diagnostics">
        <div className="analytics-funnel-section-heading">
          <div>
            <span className="analytics-funnel-section-kicker">Sinais para investigar</span>
            <h3>Diagnósticos da jornada</h3>
          </div>
          <span className="analytics-funnel-section-rule" aria-hidden="true" />
        </div>

        <div className="analytics-funnel-diagnostics-grid">
          <article className="analytics-funnel-card analytics-funnel-card-source">
            <div className="analytics-funnel-card-heading">
              <div>
                <span className="analytics-funnel-card-overline">Intenção</span>
                <h4>De onde vêm os checkouts</h4>
              </div>
              <ArrowDownRight size={18} aria-hidden="true" />
            </div>
            {data.checkoutsByCtaSource.length === 0 ? (
              <EmptyDiagnostic>Sem cliques de compra atribuídos ainda.</EmptyDiagnostic>
            ) : (
              <div className="analytics-funnel-bars">
                {data.checkoutsByCtaSource.map((item) => (
                  <div className="analytics-funnel-bar-row" key={item.source}>
                    <div className="analytics-funnel-bar-label">
                      <span>{humanize(item.source)}</span>
                      <strong>{formatNumber(item.count)}</strong>
                    </div>
                    <div className="analytics-funnel-bar-track">
                      <span
                        style={{
                          width: `${maxSourceCount > 0 ? (item.count / maxSourceCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="analytics-funnel-card analytics-funnel-card-exits">
            <div className="analytics-funnel-card-heading">
              <div>
                <span className="analytics-funnel-card-overline">Fricção</span>
                <h4>Onde a atenção se perde</h4>
              </div>
              <BarChart3 size={18} aria-hidden="true" />
            </div>
            {data.topExitSections.length === 0 ? (
              <EmptyDiagnostic>Sem saídas identificadas ainda.</EmptyDiagnostic>
            ) : (
              <div className="analytics-funnel-exit-list">
                {data.topExitSections.map((item, index) => (
                  <div className="analytics-funnel-exit-row" key={item.section}>
                    <span className="analytics-funnel-exit-rank">0{index + 1}</span>
                    <div className="analytics-funnel-exit-copy">
                      <div>
                        <strong>{humanize(item.section)}</strong>
                        <span>{formatNumber(item.count)} saídas</span>
                      </div>
                      <div className="analytics-funnel-exit-track">
                        <span
                          style={{
                            width: `${maxExitCount > 0 ? (item.count / maxExitCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="analytics-funnel-card analytics-funnel-card-devices">
            <div className="analytics-funnel-card-heading">
              <div>
                <span className="analytics-funnel-card-overline">Contexto</span>
                <h4>Dispositivo por etapa</h4>
              </div>
              <Smartphone size={18} aria-hidden="true" />
            </div>
            <div className="analytics-funnel-device-table-wrap">
              <table className="analytics-funnel-device-table">
                <thead>
                  <tr>
                    <th scope="col">Etapa</th>
                    {DEVICE_COLUMNS.map((device) => {
                      const DeviceIcon = device.icon;
                      return (
                        <th scope="col" key={device.key}>
                          <span title={device.label}>
                            <DeviceIcon size={13} aria-hidden="true" />
                            <span className="analytics-funnel-device-heading-label">{device.label}</span>
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {deviceRows.map((row) => {
                    const total = row.values.mobile + row.values.desktop + row.values.tablet;
                    return (
                      <tr key={row.key}>
                        <th scope="row">{row.label}</th>
                        {DEVICE_COLUMNS.map((device) => (
                          <td key={device.key}>
                            <DeviceValue
                              value={row.values[device.key]}
                              total={total}
                              testId={`text-analytics-device-${row.key}-${device.key}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <article className="analytics-funnel-card analytics-funnel-card-performance">
            <div className="analytics-funnel-card-heading">
              <div>
                <span className="analytics-funnel-card-overline">Ritmo</span>
                <h4>Velocidade percebida</h4>
              </div>
              <Gauge size={18} aria-hidden="true" />
            </div>
            <div className="analytics-funnel-performance-metrics">
              <div>
                <Timer size={15} aria-hidden="true" />
                <span>Tempo médio na página</span>
                <strong data-testid="text-analytics-average-time">
                  {formatDuration(data.avgTimeOnPageSeconds)}
                </strong>
              </div>
              <div>
                <Gauge size={15} aria-hidden="true" />
                <span>LCP médio</span>
                <strong data-testid="text-analytics-average-lcp">{formatLcp(data.avgLcpMs)}</strong>
              </div>
            </div>
            <p className="analytics-funnel-card-note">
              Métricas de velocidade aparecem quando houver dados suficientes de navegação.
            </p>
          </article>

          <article className="analytics-funnel-card analytics-funnel-card-visitors">
            <div className="analytics-funnel-card-heading">
              <div>
                <span className="analytics-funnel-card-overline">Frequência</span>
                <h4>Novos versus recorrentes</h4>
              </div>
              <Users size={18} aria-hidden="true" />
            </div>
            <div className="analytics-funnel-visitor-total">
              <strong data-testid="text-analytics-unique-visitors">{formatNumber(data.visitors.unique)}</strong>
              <span>visitantes únicos</span>
            </div>
            <div className="analytics-funnel-visitor-track" aria-hidden="true">
              <span
                className="is-new"
                style={{
                  width: `${visitorSplitTotal > 0 ? (data.visitors.new / visitorSplitTotal) * 100 : 0}%`,
                }}
              />
              <span
                className="is-recurring"
                style={{
                  width: `${visitorSplitTotal > 0 ? (data.visitors.recurring / visitorSplitTotal) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="analytics-funnel-visitor-legend">
              <div>
                <span className="analytics-funnel-legend-dot is-new" aria-hidden="true" />
                <span>Novos</span>
                <strong data-testid="text-analytics-new-visitors">{formatNumber(data.visitors.new)}</strong>
                <small>{formatPercent(data.visitors.new, visitorSplitTotal)}</small>
              </div>
              <div>
                <span className="analytics-funnel-legend-dot is-recurring" aria-hidden="true" />
                <span>Recorrentes</span>
                <strong data-testid="text-analytics-recurring-visitors">
                  {formatNumber(data.visitors.recurring)}
                </strong>
                <small>{formatPercent(data.visitors.recurring, visitorSplitTotal)}</small>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default AnalyticsFunnelPanel;