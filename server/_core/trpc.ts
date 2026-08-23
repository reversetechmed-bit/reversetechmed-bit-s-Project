import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { effectiveWarehouseRole, hasWarehousePermission, type WarehousePermission } from "../warehousePermissions";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export function warehousePermissionProcedure(permission: WarehousePermission) {
  return t.procedure.use(requireUser).use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      const role = effectiveWarehouseRole({ appRole: ctx.user.role, warehouseRole: ctx.user.warehouseRole });
      if (!hasWarehousePermission(role, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية تنفيذ هذا الإجراء في المخزن." });
      return next({ ctx: { ...ctx, user: ctx.user } });
    }),
  );
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
