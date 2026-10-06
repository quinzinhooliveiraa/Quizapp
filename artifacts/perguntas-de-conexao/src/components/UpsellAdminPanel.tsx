import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { apiBaseUrl } from "@/config";

type SummaryValue = string | number | null;
type UpsellOrder = {
  id: string;
  createdAt: string;
  product: "noites30" | "noites7" | string;
  method: "pix" | "card" | string | null;
  status: string;
  buyerEmail: string | null;
  amountCents?: number;
};
type SummaryResponse = {
  summary?: Record<string, SummaryValue>;
  metrics?: Record<string, SummaryValue>;
  latestOrders?: UpsellOrder[];
  orders?: UpsellOrder[];
};

const labels: Record<string, string> = {
  upsellSeen: "Viram a oferta de 30 noites",
  upsell_seen: "Viram a oferta de 30 noites",
  upsellDeclined: "Recusaram a oferta de 30 noites",
  upsell_declined: "Recusaram a oferta de 30 noites",
  downsellSeen: "Viram a oferta de 7 noites",
  downsell_seen: "Viram a oferta de 7 noites",
  downsellDeclined: "Recusaram a oferta de 7 noites",
  downsell_declined: "Recusaram a oferta de 7 noites",
  noites30PixPaid: "30 Noites pagas · Pix",
  noites30CardPaid: "30 Noites pagas · cartão",
  noites7PixPaid: "7 Noites pagas · Pix",
  noites7CardPaid: "7 Noites pagas · cartão",
  pixGenerated: "Pix gerados",
  pixPaid: "Pix pagos",
  refunded: "Reembolsados",
  grossRevenueCents: "Receita bruta",
  medianDecisionMs: "Mediana até a decisão",
  medianDecisionSeconds: "Mediana até a decisão (s)",
};

const productLabel = (product: string) => product === "noites30" ? "30 Noites" : product === "noites7" ? "7 Noites" : product;
const methodLabel = (method: string | null) => method === "pix" ? "Pix" : method === "card" ? "Cartão" : method || "—";
const statusLabel = (status: string) => ({ paid: "Pago", pending: "Pendente", refunded: "Reembolsado", failed: "Falhou" }[status] || status);
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const metricLabel = (key: string) => labels[key] || key.replace(/([A-Z])/g, " $1").replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
const metricValue = (key: string, value: SummaryValue) => {
  if (value === null) return "—";
  if (/revenue|receita/i.test(key) && typeof value === "number") return money(value);
  if (/medianDecisionMs/.test(key) && typeof value === "number") return `${Math.round(value / 1000)} s`;
  return String(value);
};

export default function UpsellAdminPanel({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/upsell/summary?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) throw new Error("summary");
      const result = await response.json() as SummaryResponse;
      setData(result);
    } catch {
      setError("Não foi possível carregar os dados das Noites.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  async function markRefunded(orderId: string) {
    if (saving) return;
    setSaving(orderId);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/upsell/orders/${encodeURIComponent(orderId)}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refunded: true }),
      });
      if (!response.ok) throw new Error("refund-status");
      setMessage("Pedido marcado como reembolsado.");
      await load();
    } catch {
      setMessage("Não foi possível atualizar este pedido.");
    } finally {
      setSaving(null);
    }
  }

  const summary = data?.summary || data?.metrics || (data
    ? Object.entries(data).reduce<Record<string, SummaryValue>>((result, [key, value]) => {
        if (key !== "latestOrders" && key !== "orders" && (typeof value === "string" || typeof value === "number" || value === null)) {
          result[key] = value;
        }
        return result;
      }, {})
    : {});
  const orders = (data?.latestOrders || data?.orders || []).slice(0, 30);

  return (
    <section className="admin-section upsell-admin-panel" aria-labelledby="upsell-admin-title">
      <div className="admin-section-heading">
        <div><p className="admin-eyebrow">programa complementar</p><h2 id="upsell-admin-title">30 Noites de Conexão</h2></div>
        <button type="button" className="upsell-admin-refresh" onClick={() => void load()} disabled={loading} aria-label="Atualizar dados"><RotateCcw size={16} /></button>
      </div>
      <div className="upsell-admin-warning"><AlertTriangle size={18} /><p>Marcar um pedido como reembolsado <strong>não devolve o dinheiro</strong>. O reembolso em si é feito no Stripe/AbacatePay.</p></div>
      {loading ? <div className="upsell-admin-skeleton" aria-label="Carregando dados"><i /><i /><i /><i /></div> : error ? (
        <div className="upsell-admin-error"><p>{error}</p><button type="button" onClick={() => void load()}>Tentar novamente</button></div>
      ) : (
        <>
          <div className="upsell-admin-table-wrap">
            <table className="upsell-admin-table"><thead><tr><th>Métrica</th><th>Resultado</th></tr></thead><tbody>
              {Object.entries(summary).map(([key, value]) => <tr key={key}><th scope="row">{metricLabel(key)}</th><td>{metricValue(key, value)}</td></tr>)}
              {Object.keys(summary).length === 0 && <tr><td colSpan={2}>Ainda não há dados de resumo.</td></tr>}
            </tbody></table>
          </div>
          <h3 className="upsell-admin-orders-title">Últimos pedidos</h3>
          <div className="upsell-admin-table-wrap">
            <table className="upsell-admin-table upsell-admin-order-table"><thead><tr><th>Data</th><th>Produto</th><th>Método</th><th>Status</th><th>E-mail</th><th>Ação</th></tr></thead><tbody>
              {orders.map((order) => <tr key={order.id}>
                <td>{new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{productLabel(order.product)}{typeof order.amountCents === "number" ? ` · ${money(order.amountCents)}` : ""}</td>
                <td>{methodLabel(order.method)}</td><td><span className={`upsell-admin-status status-${order.status}`}>{statusLabel(order.status)}</span></td><td>{order.buyerEmail || "—"}</td>
                <td>{order.status === "paid" ? <button type="button" className="upsell-admin-refund" onClick={() => void markRefunded(order.id)} disabled={saving === order.id}>{saving === order.id ? "Atualizando…" : "Marcar reembolsado"}</button> : "—"}</td>
              </tr>)}
              {orders.length === 0 && <tr><td colSpan={6}>Nenhum pedido encontrado.</td></tr>}
            </tbody></table>
          </div>
          {message && <p className="upsell-admin-message" role="status"><Check size={15} />{message}</p>}
        </>
      )}
    </section>
  );
}
