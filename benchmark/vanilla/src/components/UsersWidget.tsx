import { MOCK_USERS } from "@/lib/data";
import Link from "next/link";

export default function UsersWidget() {
  const total = MOCK_USERS.length;
  const active = MOCK_USERS.filter((u) => u.status === "active").length;
  const inactive = MOCK_USERS.filter((u) => u.status === "inactive").length;
  const deactivated = MOCK_USERS.filter((u) => u.status === "deactivated").length;

  return (
    <div className="card">
      <div className="card-title">Users</div>
      <div className="card-value">{total}</div>
      <div className="card-meta">Total registered accounts</div>
      <div className="users-stat">
        <div className="users-stat-item">
          <span className="users-stat-count active">{active}</span>
          <span className="users-stat-label">Active</span>
        </div>
        <div className="users-stat-item">
          <span className="users-stat-count inactive">{inactive}</span>
          <span className="users-stat-label">Inactive</span>
        </div>
        <div className="users-stat-item">
          <span className="users-stat-count deactivated">{deactivated}</span>
          <span className="users-stat-label">Deactivated</span>
        </div>
      </div>
      <div className="mt-4">
        <Link href="/users" className="user-link" style={{ fontSize: 13 }}>
          View all users →
        </Link>
      </div>
    </div>
  );
}
