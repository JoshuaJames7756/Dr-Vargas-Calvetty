import { describe, expect, it } from "vitest";
import { actionsFor } from "./actions";

const keys = (s: Parameters<typeof actionsFor>[0]) => actionsFor(s).map((a) => a.key);

describe("actionsFor", () => {
  it("una solicitud pendiente se puede confirmar o rechazar", () => {
    expect(keys("PENDING")).toContain("confirm");
    expect(keys("PENDING")).toContain("reject");
    expect(keys("PENDING")).not.toContain("complete");
  });
  it("estados finales no ofrecen acciones", () => {
    for (const s of ["REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"] as const) {
      expect(keys(s)).toEqual([]);
    }
  });
  it("las acciones irreversibles piden confirmacion", () => {
    for (const a of actionsFor("PENDING")) if (a.key === "reject") expect(a.confirm).toBeTruthy();
    for (const a of actionsFor("CONFIRMED")) if (a.key === "cancel" || a.key === "no_show") expect(a.confirm).toBeTruthy();
  });
});
