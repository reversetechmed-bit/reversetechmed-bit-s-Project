import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { organizationRouter } from "./routers/organization";
import { operationsRouter } from "./routers/operations";
import { inventoryCountsRouter } from "./routers/inventoryCounts";
import { executionRouter } from "./routers/execution";
import { reportsRouter } from "./routers/reports";
import { traceabilityRouter } from "./routers/traceability";
import { warehouseRouter } from "./routers/warehouse";
import { printLabRouter } from "./routers/printLab";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  organization: organizationRouter,
  operations: operationsRouter,
  inventoryCounts: inventoryCountsRouter,
  execution: executionRouter,
  reports: reportsRouter,
  traceability: traceabilityRouter,
  warehouse: warehouseRouter,
  printLab: printLabRouter,
});

export type AppRouter = typeof appRouter;
