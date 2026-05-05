"use client";
import { USERS, getActiveUserCount } from "../lib/data";

export function UsersWidget() {
  const activeCount = getActiveUserCount();
  const total = USERS.length;

  return (
    <div className="widget">
      <h2 className="widget-title">Users</h2>
      <div className="widget-stat">{activeCount}</div>
      <p className="widget-sub">Active users out of {total} total</p>
      <div className="status-breakdown">
        {(["active", "inactive", "deactivated"] as const).map((status) => {
          const count = USERS.filter((u) => u.status === status).length;
          return (
            <div key={status} className="status-row">
              <span className={`status-dot status-${status}`} />
              <span className="status-label">{status}</span>
              <span className="status-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
