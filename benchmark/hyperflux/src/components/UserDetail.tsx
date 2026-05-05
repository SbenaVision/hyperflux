"use client";
import { useRule } from "@hyperflux/react";
import type { User } from "../lib/types";
import { formatCurrency, formatDate, daysSince } from "../lib/utils";

interface UserDetailProps {
  user: User;
}

export function UserDetail({ user }: UserDetailProps) {
  const minPasswordLength = useRule<number>("config.auth.min_password_length", {});
  const saveButtonLabel = useRule<string>("copy.settings.save_button", {});

  return (
    <div className="user-detail">
      <div className="detail-header">
        <div className="detail-avatar">{user.name.charAt(0)}</div>
        <div>
          <h1 className="detail-name">{user.name}</h1>
          <p className="detail-email">{user.email}</p>
          <span className={`status-pill status-${user.status}`}>{user.status}</span>
          <span className={`role-pill role-${user.role}`}>{user.role}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h2 className="detail-card-title">Account Info</h2>
          <dl className="detail-dl">
            <dt>User ID</dt>
            <dd>{user.id}</dd>
            <dt>Created</dt>
            <dd>{formatDate(user.createdAt)}</dd>
            <dt>Last Login</dt>
            <dd>
              {user.lastLogin}{" "}
              <span className="muted">({daysSince(user.lastLogin)} days ago)</span>
            </dd>
          </dl>
        </div>

        <div className="detail-card">
          <h2 className="detail-card-title">Revenue</h2>
          <div className="detail-revenue">{formatCurrency(user.revenue)}</div>
          <p className="muted">Lifetime revenue</p>
        </div>

        <div className="detail-card">
          <h2 className="detail-card-title">Security</h2>
          <dl className="detail-dl">
            <dt>Minimum password length</dt>
            <dd>{minPasswordLength} characters</dd>
          </dl>
          <form
            className="detail-form"
            onSubmit={(e) => {
              e.preventDefault();
              alert("Changes saved (demo)");
            }}
          >
            <label htmlFor="new-password" className="form-label">
              Reset Password
            </label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              placeholder={`Min ${minPasswordLength} characters`}
              minLength={minPasswordLength}
            />
            <button type="submit" className="btn btn-primary">
              {saveButtonLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
