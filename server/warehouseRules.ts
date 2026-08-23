export function canEngineerSubmit(role: string) {
  return role === "user";
}

export function mustScopeRequestsToRequester(role: string) {
  return role !== "admin";
}

export function canDecideRequest(status: string) {
  return status === "pending";
}

export function isLowStock(quantity: number, minimumStock: number) {
  return quantity <= minimumStock;
}

export function validateDelivery(status: string, physicalQuantity: number, reservedQuantity: number, requestedQuantity: number, custodyQuantity = 0) {
  if (status !== "approved") {
    return { ok: false as const, reason: "Only approved requests can be confirmed as delivered." };
  }
  if (requestedQuantity <= 0 || physicalQuantity - custodyQuantity < requestedQuantity) {
    return { ok: false as const, reason: "There is no longer enough inventory to deliver this request." };
  }
  if (reservedQuantity < requestedQuantity) {
    return { ok: false as const, reason: "The quantity reserved for this approved request is no longer sufficient for delivery." };
  }
  return { ok: true as const, quantityAfter: physicalQuantity - requestedQuantity };
}

export function formatDeliveryDetails(quantity: number, engineerName?: string | null) {
  return `Physically handed over ${quantity} unit(s) to ${engineerName || "the requesting engineer"}.`;
}
