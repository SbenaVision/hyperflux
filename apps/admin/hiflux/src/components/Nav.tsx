"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRule } from "@hyperflux/react";
import { StatsBar } from "./StatsBar";

export function Nav() {
  const pathname = usePathname();
  const appTitle       = useRule<string>("hiflux.ui.app_title", {});
  const rulesLabel     = useRule<string>("hiflux.ui.nav_rules_label", {});
  const legacyLabel    = useRule<string>("hiflux.ui.nav_legacy_label", {});
  const lifecycleLabel = useRule<string>("hiflux.ui.nav_lifecycle_label", {});
  const routeRules     = useRule<string>("hiflux.config.route_rules", {});
  const routeLegacy    = useRule<string>("hiflux.config.route_legacy", {});
  const routeLifecycle = useRule<string>("hiflux.config.route_lifecycle", {});

  return (
    <nav className="hf-nav">
      <span className="hf-nav-brand">{appTitle}</span>
      <ul className="hf-nav-links">
        <li>
          <Link
            href={routeRules ?? "/rules"}
            className={pathname.startsWith(routeRules ?? "/rules") ? "hf-nav-link active" : "hf-nav-link"}
          >
            {rulesLabel}
          </Link>
        </li>
        <li>
          <Link
            href={routeLegacy ?? "/legacy"}
            className={pathname.startsWith(routeLegacy ?? "/legacy") ? "hf-nav-link active" : "hf-nav-link"}
          >
            {legacyLabel}
          </Link>
        </li>
        <li>
          <Link
            href={routeLifecycle ?? "/lifecycle"}
            className={pathname.startsWith(routeLifecycle ?? "/lifecycle") ? "hf-nav-link active" : "hf-nav-link"}
          >
            {lifecycleLabel}
          </Link>
        </li>
      </ul>
      <StatsBar />
    </nav>
  );
}
