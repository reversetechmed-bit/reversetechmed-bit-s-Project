export const categoryMeta: Record<string, { label: string; arabic: string; accent: string; soft: string }> = {
  Medical: { label: "طبي", arabic: "طبي", accent: "text-sky-700", soft: "bg-sky-50 border-sky-100" },
  Embedded: { label: "إمبيديد", arabic: "إمبيديد", accent: "text-violet-700", soft: "bg-violet-50 border-violet-100" },
  Electronics: { label: "إلكترونيات", arabic: "إلكترونيات", accent: "text-amber-700", soft: "bg-amber-50 border-amber-100" },
  Boards: { label: "لوحات", arabic: "لوحات", accent: "text-emerald-700", soft: "bg-emerald-50 border-emerald-100" },
};

export const requestStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "بانتظار المراجعة", className: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "مُعتمد", className: "bg-sky-50 text-sky-800 border-sky-200" },
  rejected: { label: "مرفوض", className: "bg-rose-50 text-rose-800 border-rose-200" },
  delivered: { label: "تم التسليم", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

export function formatDate(value: Date | string | null | undefined, includeTime = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function initials(name?: string | null) {
  return name?.split(" ").filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "م";
}
