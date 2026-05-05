"use client";

import { useState } from "react";
import Link from "next/link";
import { MOCK_USERS } from "@/lib/data";
import { formatCurrency, formatDate, daysSince } from "@/lib/utils";
import type { User } from "@/lib/types";

// Hardcoded business logic — benchmark targets
const DEFAULT_SORT = "last_active";
const STATUS_FILTERS = ["active", "inactive", "deactivated"] as const;
const HIGH_VALUE_THRESHOLD = 10000;
const INACTIVE_WARNING_DAYS = 90;

type SortKey = "last_active" | "name" | "revenue";
type StatusFilter = (typeof STATUS_FILTERS)[number] | "all";

function sortUsers(users: User[], sort: SortKey): User[] {
  return [...users].sort((a, b) => {
    if (sort === "last_active") {
      return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime();
    }
    if (sort === "name") {
      return a.name.localeCompare(b.name);
    }
    if (sort === "revenue") {
      return b.revenue - a.revenue;
    }
    return 0;
  });
}

export default function UserList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);

  const filtered =
    statusFilter === "all"
      ? MOCK_USERS
      : MOCK_USERS.filter((u) => u.status === statusFilter);

  const sorted = sortUsers(filtered, sort);

  return (
    <div>
      <div className="toolbar">
        <div className="filter-group">
          <span className="filter-label">Filter:</span>
          <button
            className={`filter-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          {/* Hardcoded status filter labels */}
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              className={`filter-btn ${statusFilter === s ? "active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="last_active">Sort: Last Active</option>
          <option value="name">Sort: Name</option>
          <option value="revenue">Sort: Revenue</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Revenue</th>
              <th>Last Active</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--color-text-muted)" }}>
                  No users match this filter.
                </td>
              </tr>
            ) : (
              sorted.map((user) => {
                const days = daysSince(user.lastLogin);
                const isInactiveWarning = days > INACTIVE_WARNING_DAYS;
                const isHighValue = user.revenue > HIGH_VALUE_THRESHOLD;
                return (
                  <tr key={user.id}>
                    <td>
                      <Link href={`/users/${user.id}`} className="user-link">
                        {user.name}
                      </Link>
                      {/* "High Value" badge — hardcoded text, hardcoded threshold */}
                      {isHighValue && (
                        <span className="badge badge-high-value">High Value</span>
                      )}
                    </td>
                    <td style={{ color: "var(--color-text-muted)" }}>{user.email}</td>
                    <td>
                      <span className={`badge badge-${user.status}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{formatCurrency(user.revenue)}</td>
                    <td>
                      {formatDate(user.lastLogin)}
                      {/* "Inactive" warning — hardcoded threshold of 90 days */}
                      {isInactiveWarning && (
                        <span className="warning-text" style={{ marginLeft: 8 }}>
                          ⚠ Inactive
                        </span>
                      )}
                    </td>
                    <td>
                      {user.role === "admin" ? (
                        <span className="badge badge-admin">admin</span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>user</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
        {sorted.length} user{sorted.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}
