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
    title: input.decision === "approved" ? "Your request was approved" : "Your request was rejected",
    body: input.decision === "approved"
      ? `${input.partName} is approved and awaiting physical handover.`
      : `${input.partName} was rejected.${input.decisionNote ? ` Note: ${input.decisionNote}` : ""}`,
    partId: input.partId,
    requestId: input.requestId,
    recipientUserId: input.recipientUserId,
  };
}

export function buildHandoverNotification(input: { partId: number; partName: string; requestId: number; recipientUserId: number; invoiceNumber: string }) {
  return {
    type: "handover_completed" as const,
    title: "Your handover is complete",
    body: `${input.partName} was handed over manually. Invoice ${input.invoiceNumber} is now available.`,
    partId: input.partId,
    requestId: input.requestId,
    recipientUserId: input.recipientUserId,
  };
}
