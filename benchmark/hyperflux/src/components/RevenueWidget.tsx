"use client";
import { REVENUE_DATA, getTotalRevenue } from "../lib/data";
import { formatCurrency } from "../lib/utils";

export function RevenueWidget() {
  const total = getTotalRevenue();
  const latest = REVENUE_DATA[REVENUE_DATA.length - 1];

  return (
    <div className="widget">
      <h2 className="widget-title">Revenue</h2>
      <div className="widget-stat">{formatCurrency(total)}</div>
      <p className="widget-sub">Total across all users</p>
      <div className="revenue-chart">
        {REVENUE_DATA.map((d) => {
          const max = Math.max(...REVENUE_DATA.map((r) => r.revenue));
          const pct = Math.round((d.revenue / max) * 100);
          return (
            <div key={d.month} className="chart-bar-wrap">
              <div
                className={`chart-bar${d.month === latest.month ? " chart-bar-active" : ""}`}
                style={{ height: `${pct}%` }}
                title={`${d.month}: ${formatCurrency(d.revenue)}`}
              />
              <span className="chart-label">{d.month.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
