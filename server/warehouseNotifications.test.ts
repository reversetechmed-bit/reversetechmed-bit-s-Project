import { describe, expect, it } from "vitest";
import { buildDecisionNotification, buildHandoverNotification } from "./warehouseNotifications";

describe("warehouse notification generation", () => {
  it("creates an addressed approval and rejection notification for the requesting user", () => {
    expect(buildDecisionNotification({ decision: "approved", partId: 3, partName: "ABS Filament", requestId: 18, recipientUserId: 7 })).toMatchObject({ type: "request_approved", requestId: 18, recipientUserId: 7, body: "تم اعتماد ABS Filament وبانتظار التسليم الفعلي." });
    expect(buildDecisionNotification({ decision: "rejected", decisionNote: "Reserved for a client order", partId: 3, partName: "ABS Filament", requestId: 18, recipientUserId: 7 })).toMatchObject({ type: "request_rejected", recipientUserId: 7, body: "تم رفض ABS Filament. ملاحظة: Reserved for a client order" });
  });

  it("creates a handover notification that references the generated invoice", () => {
    expect(buildHandoverNotification({ partId: 9, partName: "Medical enclosure", requestId: 22, recipientUserId: 4, invoiceNumber: "RT-HO-20260818-00022" })).toMatchObject({ type: "handover_completed", requestId: 22, recipientUserId: 4, body: "تم تسليم Medical enclosure يدويًا. الفاتورة RT-HO-20260818-00022 متاحة الآن." });
  });
});
