import type { User, Alert, RevenueData, PricingRule } from "./types";

// Helper: days ago from today (2026-05-05)
function daysAgo(n: number): string {
  const d = new Date("2026-05-05");
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export const MOCK_USERS: User[] = [
  {
    id: "u1",
    name: "Alice Nguyen",
    email: "alice.nguyen@example.com",
    status: "active",
    revenue: 48200,
    lastLogin: daysAgo(1),
    role: "admin",
    createdAt: daysAgo(400),
  },
  {
    id: "u2",
    name: "Brian Kowalski",
    email: "brian.kowalski@example.com",
    status: "active",
    revenue: 21500,
    lastLogin: daysAgo(3),
    role: "user",
    createdAt: daysAgo(360),
  },
  {
    id: "u3",
    name: "Carmen Ortiz",
    email: "carmen.ortiz@example.com",
    status: "active",
    revenue: 15750,
    lastLogin: daysAgo(7),
    role: "user",
    createdAt: daysAgo(320),
  },
  {
    id: "u4",
    name: "David Chen",
    email: "david.chen@example.com",
    status: "inactive",
    revenue: 9800,
    lastLogin: daysAgo(95),
    role: "user",
    createdAt: daysAgo(500),
  },
  {
    id: "u5",
    name: "Elena Vasquez",
    email: "elena.vasquez@example.com",
    status: "active",
    revenue: 32100,
    lastLogin: daysAgo(2),
    role: "user",
    createdAt: daysAgo(280),
  },
  {
    id: "u6",
    name: "Frank Delacroix",
    email: "frank.delacroix@example.com",
    status: "deactivated",
    revenue: 500,
    lastLogin: daysAgo(120),
    role: "user",
    createdAt: daysAgo(600),
  },
  {
    id: "u7",
    name: "Grace Park",
    email: "grace.park@example.com",
    status: "active",
    revenue: 11200,
    lastLogin: daysAgo(5),
    role: "user",
    createdAt: daysAgo(210),
  },
  {
    id: "u8",
    name: "Henry Okonkwo",
    email: "henry.okonkwo@example.com",
    status: "inactive",
    revenue: 4300,
    lastLogin: daysAgo(100),
    role: "user",
    createdAt: daysAgo(450),
  },
  {
    id: "u9",
    name: "Isabella Romano",
    email: "isabella.romano@example.com",
    status: "active",
    revenue: 27600,
    lastLogin: daysAgo(1),
    role: "user",
    createdAt: daysAgo(175),
  },
  {
    id: "u10",
    name: "James Fitzgerald",
    email: "james.fitzgerald@example.com",
    status: "active",
    revenue: 50000,
    lastLogin: daysAgo(4),
    role: "admin",
    createdAt: daysAgo(550),
  },
  {
    id: "u11",
    name: "Keiko Tanaka",
    email: "keiko.tanaka@example.com",
    status: "deactivated",
    revenue: 1200,
    lastLogin: daysAgo(110),
    role: "user",
    createdAt: daysAgo(700),
  },
  {
    id: "u12",
    name: "Liam O'Brien",
    email: "liam.obrien@example.com",
    status: "active",
    revenue: 8900,
    lastLogin: daysAgo(12),
    role: "user",
    createdAt: daysAgo(140),
  },
  {
    id: "u13",
    name: "Maya Patel",
    email: "maya.patel@example.com",
    status: "inactive",
    revenue: 3400,
    lastLogin: daysAgo(92),
    role: "user",
    createdAt: daysAgo(380),
  },
  {
    id: "u14",
    name: "Nathan Adeyemi",
    email: "nathan.adeyemi@example.com",
    status: "active",
    revenue: 18800,
    lastLogin: daysAgo(6),
    role: "user",
    createdAt: daysAgo(230),
  },
  {
    id: "u15",
    name: "Olivia Marchetti",
    email: "olivia.marchetti@example.com",
    status: "active",
    revenue: 13400,
    lastLogin: daysAgo(9),
    role: "user",
    createdAt: daysAgo(195),
  },
];

// 4 alerts — meets the >= 3 threshold that shows AlertsWidget
export const MOCK_ALERTS: Alert[] = [
  {
    id: "a1",
    message: "Unusual login activity detected for user frank.delacroix@example.com",
    severity: "high",
    timestamp: new Date("2026-05-05T08:14:00").toISOString(),
  },
  {
    id: "a2",
    message: "Revenue anomaly: 3 accounts exceeded $40k threshold this month",
    severity: "medium",
    timestamp: new Date("2026-05-04T17:30:00").toISOString(),
  },
  {
    id: "a3",
    message: "Scheduled maintenance window starting in 48 hours",
    severity: "low",
    timestamp: new Date("2026-05-04T09:00:00").toISOString(),
  },
  {
    id: "a4",
    message: "5 accounts inactive for over 90 days — review recommended",
    severity: "medium",
    timestamp: new Date("2026-05-03T12:45:00").toISOString(),
  },
];

export const MOCK_REVENUE: RevenueData[] = [
  { month: "2025-11", revenue: 182000 },
  { month: "2025-12", revenue: 196000 },
  { month: "2026-01", revenue: 174000 },
  { month: "2026-02", revenue: 210000 },
  { month: "2026-03", revenue: 225000 },
  { month: "2026-04", revenue: 241000 },
];

export const MOCK_PRICING_RULES: PricingRule[] = [
  {
    id: "p1",
    name: "Base Plan",
    type: "flat",
    value: 99,
    condition: "All users",
    enabled: true,
  },
  {
    id: "p2",
    name: "Pro Plan",
    type: "flat",
    value: 299,
    condition: "Users with revenue > $10,000",
    enabled: true,
  },
  {
    id: "p3",
    name: "VIP Discount",
    type: "percentage",
    value: 0.05, // 5% — hardcoded VIP discount rate
    condition: "Users with revenue > $40,000",
    enabled: true,
  },
  {
    id: "p4",
    name: "Annual Discount",
    type: "percentage",
    value: 0.15,
    condition: "Annual billing selected",
    enabled: true,
  },
  {
    id: "p5",
    name: "Startup Credit",
    type: "flat",
    value: 50,
    condition: "Account age < 90 days",
    enabled: false,
  },
];

// Simulated logged-in admin user
export const CURRENT_USER: User = MOCK_USERS[0]; // Alice Nguyen, role: "admin"
