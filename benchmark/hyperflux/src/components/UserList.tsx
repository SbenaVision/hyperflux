"use client";
import Link from "next/link";
import { useRule } from "@hyperflux/react";
import { USERS } from "../lib/data";
import { formatCurrency, daysSince } from "../lib/utils";

export function UserList() {
  const highValueThreshold = useRule<number>("config.users.high_value_threshold", {});
  const inactiveDaysWarning = useRule<number>("config.users.inactive_days_warning", {});
  const highValueBadge = useRule<string>("copy.users.high_value_badge", {});
  const inactiveWarning = useRule<string>("copy.users.inactive_warning", {});

  return (
    <div className="user-list-wrap">
      <table className="user-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Revenue</th>
            <th>Last Login</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {USERS.map((user) => {
            const isHighValue = user.revenue >= highValueThreshold;
            const isInactiveLong =
              user.status === "inactive" && daysSince(user.lastLogin) >= inactiveDaysWarning;

            return (
              <tr key={user.id} className={isInactiveLong ? "row-warning" : ""}>
                <td>
                  {user.name}
                  {isHighValue && (
                    <span className="badge badge-high-value">{highValueBadge}</span>
                  )}
                </td>
                <td>{user.email}</td>
                <td>
                  <span className={`status-pill status-${user.status}`}>{user.status}</span>
                </td>
                <td>{formatCurrency(user.revenue)}</td>
                <td>
                  {user.lastLogin}
                  {isInactiveLong && (
                    <span className="inline-warning" title={inactiveWarning}>
                      ⚠
                    </span>
                  )}
                </td>
                <td>{user.role}</td>
                <td>
                  <Link href={`/users/${user.id}`} className="table-link">
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
