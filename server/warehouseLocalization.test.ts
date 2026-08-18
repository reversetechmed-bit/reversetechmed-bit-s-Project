import { describe, expect, it } from "vitest";
import { categoryMeta, requestStatusMeta } from "../client/src/lib/warehouse";

describe("warehouse Arabic interface metadata", () => {
  it("exposes the four engineering categories with Arabic labels", () => {
    expect(categoryMeta.Medical.label).toBe("طبي");
    expect(categoryMeta.Embedded.label).toBe("إمبيديد");
    expect(categoryMeta.Electronics.label).toBe("إلكترونيات");
    expect(categoryMeta.Boards.label).toBe("لوحات");
  });

  it("uses Arabic lifecycle labels for each dispensing request status", () => {
    expect(requestStatusMeta.pending.label).toBe("بانتظار المراجعة");
    expect(requestStatusMeta.approved.label).toBe("مُعتمد");
    expect(requestStatusMeta.rejected.label).toBe("مرفوض");
    expect(requestStatusMeta.delivered.label).toBe("تم التسليم");
  });
});
