"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="nav-brand">HyperFlux Admin</div>
      <ul className="nav-links">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={pathname.startsWith(link.href) ? "nav-link nav-link-active" : "nav-link"}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="nav-user">admin@example.com</div>
    </nav>
  );
}
