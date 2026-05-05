"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CURRENT_USER } from "@/lib/data";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/users", label: "Users", icon: "👥" },
  { href: "/pricing", label: "Pricing", icon: "💲" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      <div className="app-nav-logo">
        HyperFlux <span>Admin</span>
      </div>
      <ul className="app-nav-links">
        {NAV_LINKS.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={isActive ? "active" : ""}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="app-nav-footer">
        <div className="user-name">{CURRENT_USER.name}</div>
        <div className="user-role">{CURRENT_USER.role}</div>
      </div>
    </nav>
  );
}
