import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { employeeProfiles, type User, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSupabaseAccessToken, isSupabaseAccount } from "../supabaseAuth";
import { sdk } from "./sdk";
import type { WarehouseRole } from "../warehousePermissions";

export type AuthenticatedWarehouseUser = User & { warehouseRole?: WarehouseRole };

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedWarehouseUser | null;
};

async function authenticateSupabaseRequest(req: CreateExpressContextOptions["req"]): Promise<AuthenticatedWarehouseUser | null> {
  const token = getSupabaseAccessToken(req.headers.authorization);
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const account = await response.json() as { id: string; email?: string; user_metadata?: { full_name?: string; name?: string; requested_role?: unknown } };
    if (!isSupabaseAccount(account)) return null;

    const db = await getDb();
    if (!db) return null;
    const [existing] = await db.select().from(users).where(eq(users.openId, account.id)).limit(1);
    const [employee] = await db.select().from(employeeProfiles).where(eq(employeeProfiles.email, account.email)).limit(1);
    // Every Supabase account must remain tied to an active, non-suspended employee profile.
    if (existing?.deletedAt || !employee || !employee.isActive || (employee.suspendedUntil && employee.suspendedUntil > new Date()) || (employee.accessRevokedAt && existing?.createdAt && existing.createdAt <= employee.accessRevokedAt) || (employee.userId && employee.userId !== existing?.id)) return null;
    const role = employee.warehouseRole === "admin" ? "admin" : "user";
    const requestedRole = role;
    if (existing) {
      await db.update(users).set({ name: employee.fullName, email: account.email, role, requestedRole, lastSignedIn: new Date() }).where(eq(users.id, existing.id));
      if (!employee.userId || employee.initialPasswordHash) await db.update(employeeProfiles).set({ userId: existing.id, initialPasswordHash: null }).where(eq(employeeProfiles.id, employee.id));
      const [refreshed] = await db.select().from(users).where(eq(users.id, existing.id)).limit(1);
      return { ...(refreshed ?? existing), warehouseRole: employee.warehouseRole };
    }

    await db.insert(users).values({
      openId: account.id,
      name: employee.fullName,
      email: account.email,
      loginMethod: "supabase",
      role,
      requestedRole,
      lastSignedIn: new Date(),
    });
    const [created] = await db.select().from(users).where(eq(users.openId, account.id)).limit(1);
    if (created && employee && !employee.userId) await db.update(employeeProfiles).set({ userId: created.id, initialPasswordHash: null }).where(eq(employeeProfiles.id, employee.id));
    return created ? { ...created, warehouseRole: employee.warehouseRole } : null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthenticatedWarehouseUser | null = null;

  user = await authenticateSupabaseRequest(opts.req);
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req) as AuthenticatedWarehouseUser;
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
