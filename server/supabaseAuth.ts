export type SupabaseAccount = {
  id?: unknown;
  email?: unknown;
  user_metadata?: { full_name?: string; name?: string; requested_role?: unknown };
};

export function getSupabaseAccessToken(authorization: string | string[] | undefined) {
  return typeof authorization === "string" && authorization.startsWith("Bearer ") && authorization.length > 7
    ? authorization.slice(7)
    : null;
}

export function isSupabaseAccount(value: SupabaseAccount): value is SupabaseAccount & { id: string; email: string } {
  return typeof value.id === "string" && value.id.length > 0 && typeof value.email === "string" && value.email.includes("@");
}
