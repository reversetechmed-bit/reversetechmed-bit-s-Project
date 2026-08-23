import { describe, expect, it } from "vitest";
import { barcodeCheckDigit, makeLocationBarcode, makePartBarcode, makeQrPayload, normalizeWarehouseBarcode, validateSerialTransition } from "./warehouseTraceability";

describe("warehouse traceability rules", () => {
  it("creates deterministic, scanner-safe barcodes with a check digit", () => {
    const barcode = makePartBarcode({ id: 42, partNumber: "pcb main / rev 2" });
    expect(barcode).toBe("RTWMS-P-PCB-MAIN-REV-2-000042-4");
    expect(barcode.at(-1)).toBe(barcodeCheckDigit(barcode.slice(0, -2)));
    expect(makeLocationBarcode({ id: 7, code: "A-01-Drawer 2" })).toBe("RTWMS-L-A-01-DRAWER-2-000007-9");
  });

  it("normalizes labels and produces a non-sensitive QR payload", () => {
    expect(normalizeWarehouseBarcode(" rt parts  01 ")).toBe("RT-PARTS-01");
    expect(makeQrPayload("part", "rt-parts-01")).toBe("RTWMS:PART:RT-PARTS-01");
    expect(() => normalizeWarehouseBarcode("!!!")).toThrow("صيغة الباركود");
  });

  it("enforces serial lifecycle transitions and custody holder requirements", () => {
    expect(validateSerialTransition({ from: "in_stock", to: "in_custody" }).ok).toBe(false);
    expect(validateSerialTransition({ from: "in_stock", to: "in_custody", currentHolderId: 9 }).ok).toBe(true);
    expect(validateSerialTransition({ from: "cannibalized", to: "in_stock" }).ok).toBe(false);
    expect(validateSerialTransition({ from: "in_maintenance", to: "in_stock", currentHolderId: 9 }).ok).toBe(false);
  });
});
