"use client";
import { useRule } from "@hyperflux/react";
import { ALERTS } from "../lib/data";

export function AlertsWidget() {
  const alertThreshold = useRule<number>("config.dashboard.alert_min_count", {});

  const hasManyAlerts = ALERTS.length >= alertThreshold;

  return (
    <div className={`widget${hasManyAlerts ? " widget-warning" : ""}`}>
      <h2 className="widget-title">
        Alerts
        {hasManyAlerts && <span className="badge badge-warning">{ALERTS.length}</span>}
      </h2>
      {hasManyAlerts && (
        <p className="alert-banner">
          {ALERTS.length} active alerts require attention
        </p>
      )}
      <ul className="alert-list">
        {ALERTS.map((alert) => (
          <li key={alert.id} className={`alert-item alert-${alert.severity}`}>
            <span className={`severity-dot severity-${alert.severity}`} />
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
    </div>
  );
}
