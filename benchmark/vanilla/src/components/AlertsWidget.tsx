"use client";

import { useEffect, useState } from "react";
import { MOCK_ALERTS } from "@/lib/data";
import type { Alert } from "@/lib/types";

// Hardcoded refresh interval — benchmark target
const REFRESH_MS = 30000;

export default function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      // In the real app this would fetch; here we just note the refresh time
      setAlerts(MOCK_ALERTS);
      setLastRefresh(new Date());
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card">
      <div className="card-title">Alerts</div>
      <div className="card-value" style={{ fontSize: 28 }}>
        {alerts.length}
      </div>
      <div className="card-meta" style={{ marginBottom: 16 }}>
        Active alerts requiring attention
      </div>
      <ul className="alerts-list">
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert-item ${alert.severity}`}>
            <span className="alert-severity">{alert.severity}</span>
            <span className="alert-message">{alert.message}</span>
            <span className="alert-time">
              {new Date(alert.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
      </ul>
      <p className="alert-refresh-note">
        Auto-refreshes every {REFRESH_MS / 1000}s · Last:{" "}
        {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
