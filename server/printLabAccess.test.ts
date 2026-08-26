import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function userContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 41,
      openId: `print-lab-${role}`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "supabase",
      role,
      requestedRole: role,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("3D Printing Lab access", () => {
  it("rejects an ordinary user before any lab database operation", async () => {
    const caller = appRouter.createCaller(userContext("user"));
    await expect(caller.printLab.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
