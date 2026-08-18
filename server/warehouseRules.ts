export function canEngineerSubmit(role: string) {
  return role === "user";
}

export function canDecideRequest(status: string) {
  return status === "pending";
}

export function isLowStock(quantity: number, minimumStock: number) {
  return quantity < minimumStock;
}

export function validateDelivery(status: string, availableQuantity: number, requestedQuantity: number) {
  if (status !== "approved") {
    return { ok: false as const, reason: "Only approved requests can be confirmed as delivered." };
  }
  if (requestedQuantity <= 0 || availableQuantity < requestedQuantity) {
    return { ok: false as const, reason: "There is no longer enough inventory to deliver this request." };
  }
  return { ok: true as const, quantityAfter: availableQuantity - requestedQuantity };
}

export function formatDeliveryDetails(quantity: number, engineerName?: string | null) {
  return `Physically handed over ${quantity} unit(s) to ${engineerName || "the requesting engineer"}.`;
}
