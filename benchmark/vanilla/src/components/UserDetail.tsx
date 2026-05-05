"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "@/lib/types";
import { formatCurrency, formatDate, daysSince } from "@/lib/utils";

// Hardcoded business logic — benchmark targets
const MIN_PASSWORD_LENGTH = 12;
// Save button label hardcoded — benchmark will change this
const SAVE_BUTTON_LABEL = "Submit";

interface UserDetailProps {
  user: User;
}

export default function UserDetail({ user }: UserDetailProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim() || !email.includes("@")) next.email = "Valid email required.";
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      // Hardcoded min password length: 12
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (password && password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // In a real app: call API
    setSaved(true);
    setPassword("");
    setConfirmPassword("");
    setTimeout(() => setSaved(false), 3000);
  }

  const days = daysSince(user.lastLogin);

  return (
    <div>
      <Link href="/users" className="back-link">
        ← Back to Users
      </Link>

      {saved && (
        <div className="toast toast-success">
          ✓ Profile updated successfully.
        </div>
      )}

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">{formatCurrency(user.revenue)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Status</span>
          <span className={`badge badge-${user.status}`} style={{ fontSize: 14 }}>
            {user.status}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last Login</span>
          <span className="stat-value" style={{ fontSize: 15 }}>
            {formatDate(user.lastLogin)}
            {days > 90 && (
              <span className="warning-text" style={{ marginLeft: 8, fontSize: 12 }}>
                ⚠ {days}d ago
              </span>
            )}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Member Since</span>
          <span className="stat-value" style={{ fontSize: 15 }}>
            {formatDate(user.createdAt)}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Role</span>
          <span className="stat-value" style={{ fontSize: 15, textTransform: "capitalize" }}>
            {user.role}
          </span>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        {/* Hardcoded profile form labels */}
        <div className="form-field">
          <label className="form-label" htmlFor="field-name">
            Full Name
          </label>
          <input
            id="field-name"
            className="form-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="field-email">
            Email Address
          </label>
          <input
            id="field-email"
            className="form-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="field-id">
            User ID
          </label>
          <input
            id="field-id"
            className="form-input"
            type="text"
            value={user.id}
            disabled
          />
          <span className="form-hint">Read-only identifier.</span>
        </div>

        <div className="section-divider" />

        <div className="form-field">
          <label className="form-label" htmlFor="field-password">
            New Password
          </label>
          <input
            id="field-password"
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
          />
          {/* Hardcoded minimum password length hint */}
          <span className="form-hint">
            Minimum {MIN_PASSWORD_LENGTH} characters.
          </span>
          {errors.password && <span className="form-error">{errors.password}</span>}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="field-confirm">
            Confirm New Password
          </label>
          <input
            id="field-confirm"
            className="form-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
          {errors.confirmPassword && (
            <span className="form-error">{errors.confirmPassword}</span>
          )}
        </div>

        <div className="form-actions">
          {/* Save button label — hardcoded as "Submit" (benchmark target) */}
          <button type="submit" className="btn btn-primary">
            {SAVE_BUTTON_LABEL}
          </button>
          <Link href="/users" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
