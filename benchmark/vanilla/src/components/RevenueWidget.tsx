import { MOCK_REVENUE } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export default function RevenueWidget() {
  const latest = MOCK_REVENUE[MOCK_REVENUE.length - 1];
  const prev = MOCK_REVENUE[MOCK_REVENUE.length - 2];
  const pctChange = (((latest.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1);
  const isUp = latest.revenue >= prev.revenue;

  const maxRevenue = Math.max(...MOCK_REVENUE.map((r) => r.revenue));

  return (
    <div className="card">
      <div className="card-title">Revenue</div>
      <div className="card-value">{formatCurrency(latest.revenue)}</div>
      <div className="card-meta">
        {isUp ? "▲" : "▼"} {pctChange}% vs previous month
      </div>
      <div className="revenue-bars">
        {MOCK_REVENUE.map((r) => {
          const heightPct = (r.revenue / maxRevenue) * 100;
          return (
            <div className="revenue-bar-wrap" key={r.month}>
              <div
                className="revenue-bar"
                style={{ height: `${heightPct}%` }}
                title={`${r.month}: ${formatCurrency(r.revenue)}`}
              />
              <span className="revenue-bar-label">
                {r.month.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
