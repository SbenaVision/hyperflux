import { describe, it, expect } from "vitest";
import { classifySource, findLegacyDeps } from "../isolation";

describe("classifySource", () => {
  it("classifies hiflux.* as hiflux", () => {
    expect(classifySource("hiflux.ui.app_title")).toBe("hiflux");
    expect(classifySource("hiflux.policy.search_enabled")).toBe("hiflux");
  });

  it("classifies hyperflux-core.* as hyperflux-core", () => {
    expect(classifySource("hyperflux-core.some.rule")).toBe("hyperflux-core");
  });

  it("classifies config.* as legacy-admin", () => {
    expect(classifySource("config.app.maintenance_mode")).toBe("legacy-admin");
  });

  it("classifies copy.* as legacy-admin", () => {
    expect(classifySource("copy.dashboard.page_title")).toBe("legacy-admin");
  });

  it("classifies pricing.* as legacy-admin", () => {
    expect(classifySource("pricing.atm.fee")).toBe("legacy-admin");
  });

  it("classifies admin.* as legacy-admin", () => {
    expect(classifySource("admin.users.list")).toBe("legacy-admin");
  });

  it("classifies unknown paths as legacy-admin", () => {
    expect(classifySource("unknown.some.rule")).toBe("legacy-admin");
  });
});

describe("findLegacyDeps", () => {
  it("finds legacy deps in requires", () => {
    const result = findLegacyDeps(["config.app.x", "hiflux.ui.y"]);
    expect(result).toEqual(["config.app.x"]);
  });

  it("returns empty array when no legacy deps", () => {
    expect(findLegacyDeps(["hiflux.ui.app_title"])).toEqual([]);
  });

  it("finds all legacy namespaces", () => {
    const deps = ["config.x", "copy.y", "pricing.z", "users.a", "admin.b"];
    expect(findLegacyDeps(deps)).toHaveLength(5);
  });

  it("returns empty for empty input", () => {
    expect(findLegacyDeps([])).toEqual([]);
  });
});
