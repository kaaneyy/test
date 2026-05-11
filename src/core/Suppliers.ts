import { addLedger, getInventoryItem } from "./Economy.ts";
import { clamp, round } from "./Rng.ts";

export function placeSupplierOrder(state, itemId, quantity = 1) {
  const item = getInventoryItem(state, itemId);
  if (!item) return { ok: false, message: "Inventory item not found." };
  const qty = Math.max(1, Number(quantity) || 1);
  const freightBase = 18 + item.weightKg * 1.2 + item.spaceUnits * 2.5;
  const freight = freightBase * qty * (1 - (state.logistics?.freightDiscount || 0));
  const cost = item.cost * qty + freight;
  if (state.cash < cost) return { ok: false, message: `Need $${round(cost, 2)} to place this supplier order.` };
  const leadReduction = state.logistics?.leadTimeReduction || 0;
  const leadDays = Math.max(1, item.leadTimeDays - leadReduction);
  addLedger(state, "inventory-purchase", `Supplier order: ${qty} x ${item.name}`, -cost, { supplier: item.supplier });
  state.supplierOrders.push({
    id: `order-${state.day}-${state.supplierOrders.length}`,
    itemId,
    itemName: item.name,
    quantity: qty,
    supplier: item.supplier,
    placedDay: state.day,
    arrivalDay: state.day + leadDays,
    cost: round(cost, 2),
    freight: round(freight, 2),
    status: "ordered",
  });
  state.stats.supplierTrust = clamp(state.stats.supplierTrust + 0.8, 0, 100);
  return { ok: true, message: `${qty} x ${item.name} ordered. ETA day ${state.day + leadDays}.` };
}

export function processSupplierOrders(state) {
  const arrived = [];
  for (const order of state.supplierOrders) {
    if (order.status === "ordered" && order.arrivalDay <= state.day) {
      const item = getInventoryItem(state, order.itemId);
      if (item) item.stock += order.quantity;
      order.status = "received";
      arrived.push(order);
      addLedger(state, "supplier-delivery", `Received supplier order: ${order.itemName}`, 0, { accountingOnly: true });
    }
  }
  state.supplierOrders = state.supplierOrders.filter((order) => order.status !== "received");
  state.logistics.warehouseUsed = state.inventory.reduce((sum, item) => sum + item.spaceUnits * item.stock, 0);
  return arrived;
}
