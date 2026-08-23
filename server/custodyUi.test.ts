import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const projectRoot = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(new URL(path, `file://${projectRoot}/`).pathname, "utf8");

describe("custody and component-type user interfaces", () => {
  it("offers dispense and custody choices without manually collecting the requester name", () => {
    const source = read("client/src/components/DispensingRequestDialog.tsx");
    expect(source).toContain('type FulfillmentType = "dispense" | "custody"');
    expect(source).toContain("اسم الموظف يُؤخذ تلقائيًا من الحساب الحالي");
    expect(source).not.toContain('id="request-recipient"');
  });

  it("surfaces physical, reserved, custody, and inside-warehouse availability in inventory", () => {
    const source = read("client/src/pages/Inventory.tsx");
    expect(source).toContain("part.quantity - part.reservedQuantity - part.custodyQuantity");
    expect(source).toContain("متاح داخل المخزن");
    expect(source).toContain('label: "عُهدة"');
  });

  it("includes editable and safely deletable component types", () => {
    const source = read("client/src/pages/ComponentTypes.tsx");
    expect(source).toContain("componentTypes.update.useMutation");
    expect(source).toContain("componentTypes.remove.useMutation");
    expect(source).toContain("الحذف متاح فقط إذا لم يكن النوع مرتبطًا بأي قطعة مخزون");
  });
});
