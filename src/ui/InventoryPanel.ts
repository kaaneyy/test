import { getStockSummary } from "../core/Inventory.ts";

export function renderInventoryPanel(state) {
  const summary = getStockSummary(state);
  const groups = groupInventory(state.inventory);
  return `
    <section class="panel-section">
      <h2>Inventory and Suppliers</h2>
      ${state.ui.selectedShelfSlot !== null && state.ui.selectedShelfSlot !== undefined ? `<p class="quote">Placing to shelf ${Number(state.ui.selectedShelfSlot)+1}. Choose any in-stock instrument.</p>` : ""}
      <div class="stat-grid">
        <div class="stat"><span>Instruments</span><strong>${summary.instrumentCount}</strong></div>
        <div class="stat"><span>Accessories</span><strong>${summary.accessoryCount}</strong></div>
        <div class="stat"><span>Inventory Value</span><strong>$${Math.round(summary.inventoryValue)}</strong></div>
        <div class="stat"><span>Supplier Trust</span><strong>${Math.round(state.stats.supplierTrust)}</strong></div>
      </div>
      <h3>Showcase Shelves (limit 3)</h3>
      <ul class="fact-list">
        ${(state.shelfDisplay || [null,null,null]).map((slot, idx) => `<li>Shelf ${idx+1}: ${slot ? `${slot.name} (bonus +${slot.bonus}, debuff ${slot.debuff}) <button data-action="clear-shelf" data-slot="${idx}">Clear</button>` : `Empty`}</li>`).join("")}
      </ul>
      <h3>Supplier Orders</h3>
      <ul class="fact-list">
        ${state.supplierOrders.map((order) => `<li>${order.quantity} x ${order.itemName} from ${order.supplier}, ETA day ${order.arrivalDay}, freight $${order.freight}.</li>`).join("") || "<li>No supplier orders pending.</li>"}
      </ul>
      <h3>Online Orders</h3>
      <ul class="fact-list">
        ${state.onlineOrders.filter((order) => order.status === "posted").map((order) => `
          <li>${order.quantity} x ${order.itemName}, $${order.gross}, due day ${order.dueDay}.
            <button data-action="fulfill-online-order" data-id="${order.id}">Fulfill</button>
          </li>
        `).join("") || "<li>No online orders waiting.</li>"}
      </ul>
      <h3>Damaged Stock</h3>
      <ul class="fact-list">
        ${state.damagedInventory.filter((item) => item.status === "needs-repair").map((item) => `
          <li>${item.type}: ${item.itemName}, caused by ${item.causedBy}, repair estimate $${item.repairCost}.
            <button data-action="repair-damaged" data-id="${item.id}">Repair stock</button>
          </li>
        `).join("") || "<li>No damaged inventory waiting on repair.</li>"}
      </ul>
      ${Object.entries(groups).map(([group, items]) => `
        <h3>${group}</h3>
        <div class="inventory-list">
          ${items.map((item) => `
            <article class="mini-card ${item.stock <= 0 ? "empty" : ""}">
              <div class="spread"><strong>${item.name}</strong><span>Stock ${item.stock}</span></div>
              <p>${item.category} | ${item.condition} | ${item.qualityTier}</p>
              <p class="muted">Cost $${item.cost}, sell $${item.sellPrice}, lead ${item.leadTimeDays} days, warranty risk ${Math.round(item.warrantyRisk * 100)}%</p>
              <p class="muted">Supplier: ${item.supplier}. Target: ${item.targetCustomerTags.join(", ")}</p>
              <div class="button-row"><button data-action="order-stock" data-id="${item.id}">Order 1</button><button data-action="assign-shelf" data-id="${item.id}" data-slot="${state.ui.selectedShelfSlot ?? 0}">Shelf 1</button><button data-action="assign-shelf" data-id="${item.id}" data-slot="${state.ui.selectedShelfSlot ?? 1}">Shelf 2</button><button data-action="assign-shelf" data-id="${item.id}" data-slot="${state.ui.selectedShelfSlot ?? 2}">Shelf 3</button></div>
            </article>
          `).join("")}
        </div>
      `).join("")}
      <h3>Accessories and Care</h3>
      <div class="inventory-list compact">
        ${state.accessories.map((item) => `
          <article class="mini-card ${item.stock <= 0 ? "empty" : ""}">
            <div class="spread"><strong>${item.name}</strong><span>${item.stock}</span></div>
            <p>${item.category} | $${item.sellPrice}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function groupInventory(items) {
  return items.reduce((groups, item) => {
    const group = item.categoryGroup || (item.category.toLowerCase().includes("guitar") ? "Guitars" : "Other instruments");
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
    return groups;
  }, {});
}
