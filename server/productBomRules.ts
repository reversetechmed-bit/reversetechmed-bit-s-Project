export type ProductBomEdge = { productId: number; componentId: number };

/** Detects a direct or indirect product-to-product BOM cycle after replacing one product's sources. */
export function createsProductBomCycle(productId: number, replacementComponentIds: number[], existingEdges: ProductBomEdge[]) {
  const graph = new Map<number, number[]>();
  for (const edge of existingEdges) {
    if (edge.productId === productId) continue;
    graph.set(edge.productId, [...(graph.get(edge.productId) ?? []), edge.componentId]);
  }
  graph.set(productId, replacementComponentIds);

  const visited = new Set<number>();
  const visit = (nodeId: number): boolean => {
    if (nodeId === productId) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    return (graph.get(nodeId) ?? []).some(visit);
  };
  return replacementComponentIds.some(visit);
}
