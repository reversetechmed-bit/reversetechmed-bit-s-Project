export function buildDecisionNotification(input: {
  decision: "approved" | "rejected";
  decisionNote?: string;
  partId: number;
  partName: string;
  requestId: number;
  recipientUserId: number;
}) {
  return {
    type: input.decision === "approved" ? "request_approved" as const : "request_rejected" as const,
    title: input.decision === "approved" ? "تم اعتماد طلبك" : "تم رفض طلبك",
    body: input.decision === "approved"
      ? `تم اعتماد ${input.partName} وبانتظار التسليم الفعلي.`
      : `تم رفض ${input.partName}.${input.decisionNote ? ` ملاحظة: ${input.decisionNote}` : ""}`,
    partId: input.partId,
    requestId: input.requestId,
    recipientUserId: input.recipientUserId,
  };
}

export function buildHandoverNotification(input: { partId: number; partName: string; requestId: number; recipientUserId: number; invoiceNumber: string }) {
  return {
    type: "handover_completed" as const,
    title: "تم تسليم طلبك",
    body: `تم تسليم ${input.partName} يدويًا. الفاتورة ${input.invoiceNumber} متاحة الآن.`,
    partId: input.partId,
    requestId: input.requestId,
    recipientUserId: input.recipientUserId,
  };
}
