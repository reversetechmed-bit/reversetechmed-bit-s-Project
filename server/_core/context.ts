import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { employeeProfiles, type User, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSupabaseAccessToken, isSupabaseAccount } from "../supabaseAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function authenticateSupabaseRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
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
    if (existing) {
      const requestedRole = account.user_metadata?.requested_role === "admin" ? "admin" : "user";
      const [employee] = await db.select().from(employeeProfiles).where(eq(employeeProfiles.email, account.email)).limit(1);
      const role = requestedRole === "admin" || employee?.warehouseRole === "admin" ? "admin" : "user";
      await db.update(users).set({ name: account.user_metadata?.full_name || account.user_metadata?.name || existing.name, email: account.email, role, requestedRole, lastSignedIn: new Date() }).where(eq(users.id, existing.id));
      if (employee && !employee.userId) await db.update(employeeProfiles).set({ userId: existing.id }).where(eq(employeeProfiles.id, employee.id));
      const [refreshed] = await db.select().from(users).where(eq(users.id, existing.id)).limit(1);
      return refreshed ?? existing;
    }

    const [employee] = await db.select().from(employeeProfiles).where(eq(employeeProfiles.email, account.email)).limit(1);
    const requestedRole = account.user_metadata?.requested_role === "admin" ? "admin" : "user";
    const role = requestedRole === "admin" || employee?.warehouseRole === "admin" ? "admin" : "user";
    await db.insert(users).values({
      openId: account.id,
      name: account.user_metadata?.full_name || account.user_metadata?.name || null,
      email: account.email,
      loginMethod: "supabase",
      role,
      requestedRole,
      lastSignedIn: new Date(),
    });
    const [created] = await db.select().from(users).where(eq(users.openId, account.id)).limit(1);
    if (created && employee && !employee.userId) await db.update(employeeProfiles).set({ userId: created.id }).where(eq(employeeProfiles.id, employee.id));
    return created ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  user = await authenticateSupabaseRequest(opts.req);
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
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
