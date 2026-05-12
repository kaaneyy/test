import { clamp } from "../core/Rng.ts";

function getShopBounds(state) {
  return {
    width: state.shopBounds?.width || state.branch?.floorWidth || 820,
    height: state.shopBounds?.height || state.branch?.floorHeight || 600,
  };
}

function getInteractables(state) {
  const bounds = getShopBounds(state);
  return [
    { id: "counter", label: "Counter", x: 500, y: 236, radius: 88 },
    { id: "workbench", label: "Workbench", x: bounds.width - 130, y: bounds.height - 160, radius: 96 },
    { id: "storage", label: "Storage", x: 108, y: bounds.height - 170, radius: 82 },
    { id: "door", label: "Door and map", x: bounds.width / 2, y: bounds.height - 40, radius: 96 },
    { id: "ledger", label: "Ledger desk", x: 150, y: 190, radius: 72 },
    { id: "coffee", label: "Coffee lounge", x: 300, y: bounds.height - 76, radius: 92 },
  ];
}

export class ShopScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.keys = new Set();
    this.lastTime = performance.now();
    this.customerBob = 0;
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * scale);
    this.canvas.height = Math.floor(rect.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  update(state) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const p = state.player;
    const bounds = getShopBounds(state);
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
    const len = Math.hypot(dx, dy) || 1;
    const nextX = clamp(p.x + (dx / len) * p.speed * dt, 45, bounds.width - 45);
    const nextY = clamp(p.y + (dy / len) * p.speed * dt, 85, bounds.height - 35);
    const blocked = [
      { x: 500, y: 236, w: 210, h: 110 },
      { x: bounds.width - 130, y: bounds.height - 160, w: 180, h: 120 },
      { x: 108, y: bounds.height - 170, w: 190, h: 180 },
      { x: 120, y: 108, w: 240, h: 120 },
      { x: 420, y: 108, w: 240, h: 120 },
      { x: 232, y: 230, w: 170, h: 70 },
      { x: 232, y: 306, w: 170, h: 70 },
    ];
    const margin = 18;
    const hit = blocked.some((b) => nextX > b.x - b.w / 2 - margin && nextX < b.x + b.w / 2 + margin && nextY > b.y - b.h / 2 - margin && nextY < b.y + b.h / 2 + margin);
    if (!hit) { p.x = nextX; p.y = nextY; }
    if (Math.abs(dx) > Math.abs(dy) && dx !== 0) p.facing = dx > 0 ? "right" : "left";
    else if (dy !== 0) p.facing = dy > 0 ? "down" : "up";
    this.customerBob += dt;
  }

  draw(state) {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const bounds = getShopBounds(state);
    const scale = Math.min(width / bounds.width, height / bounds.height);
    const offsetX = (width - bounds.width * scale) / 2;
    const offsetY = (height - bounds.height * scale) / 2;
    this.lastView = { scale, offsetX, offsetY };
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawFloor(ctx, bounds.width, bounds.height);
    drawShopFixtures(ctx, state, this.customerBob, bounds);
    drawCustomer(ctx, state, this.customerBob);
    drawPlayer(ctx, state.player);
    ctx.restore();
    drawInteractHint(ctx, state, this.getNearbyInteractable(state));
  }

  getShelfSlotFromClick(event, state) {
    if (!this.lastView) return null;
    const rect = this.canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const wx = (sx - this.lastView.offsetX) / this.lastView.scale;
    const wy = (sy - this.lastView.offsetY) / this.lastView.scale;
    const shelves = [
      { slot: 0, x1: 102, y1: 98, x2: 312, y2: 198 },
      { slot: 1, x1: 402, y1: 98, x2: 612, y2: 198 },
      { slot: 2, x1: 214, y1: 220, x2: 358, y2: 270 },
    ];
    const hit = shelves.find((shelf) => wx >= shelf.x1 && wx <= shelf.x2 && wy >= shelf.y1 && wy <= shelf.y2);
    return hit ? hit.slot : null;
  }

  getNearbyInteractable(state) {
    const p = state.player;
    return getInteractables(state).find((item) => Math.hypot(p.x - item.x, p.y - item.y) < item.radius) || null;
  }
}

function drawFloor(ctx, width, height) {
  const grd = ctx.createLinearGradient(0, 0, 0, height);
  grd.addColorStop(0, "#f4efe5");
  grd.addColorStop(1, "#dfd8c9");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#6f472d";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, width - 8, height - 8);
  ctx.strokeStyle = "rgba(80,72,60,.13)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawShopFixtures(ctx, state, t, bounds) {
  drawZones(ctx, bounds);
  drawWall(ctx, bounds);
  drawAisleShelves(ctx, state);
  drawRack(ctx, 120, 108, state.inventory.slice(0, 5));
  drawRack(ctx, 420, 108, state.inventory.slice(5, 10));
  drawDepartmentDisplays(ctx, state, t);
  drawCoffeeLounge(ctx, state, t, bounds);
  drawCounter(ctx);
  drawWorkbench(ctx, state, bounds);
  drawStorage(ctx, bounds);
  drawLedgerDesk(ctx);
  drawDoor(ctx, bounds);
  drawDisclaimerPlaque(ctx);
  drawAmbientAnimation(ctx, state, t);
  drawAmbientVisitors(ctx, state, t);
}

function drawZones(ctx, bounds) {
  ctx.fillStyle = "rgba(232, 244, 236, .58)";
  roundRect(ctx, 24, 84, Math.min(560, bounds.width - 260), bounds.height - 168, 10, true);
  ctx.strokeStyle = "rgba(54, 115, 82, .55)";
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(24, 84, Math.min(560, bounds.width - 260), bounds.height - 168);
  ctx.setLineDash([]);
  ctx.fillStyle = "#42624d";
  ctx.font = "700 11px system-ui";
  ctx.fillText("CUSTOMER FLOOR: browsing aisles, demo space, coffee seating", 42, 102);

  ctx.fillStyle = "rgba(239, 226, 207, .72)";
  roundRect(ctx, bounds.width - 224, bounds.height - 250, 190, 168, 10, true);
  ctx.strokeStyle = "rgba(126, 78, 46, .65)";
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(bounds.width - 224, bounds.height - 250, 190, 168);
  ctx.setLineDash([]);
  ctx.fillStyle = "#744a2d";
  ctx.font = "700 11px system-ui";
  ctx.fillText("STAFF ONLY: setup bench", bounds.width - 202, bounds.height - 228);

  ctx.fillStyle = "rgba(222, 232, 240, .65)";
  roundRect(ctx, 34, bounds.height - 250, 160, 174, 10, true);
  ctx.strokeStyle = "rgba(62, 86, 105, .58)";
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(34, bounds.height - 250, 160, 174);
  ctx.setLineDash([]);
  ctx.fillStyle = "#384f63";
  ctx.font = "700 11px system-ui";
  ctx.fillText("STAFF STORAGE", 64, bounds.height - 234);
}

function drawAisleShelves(ctx, state) {
  drawAccessoryShelf(ctx, 232, 230, "STRINGS");
  drawAccessoryShelf(ctx, 232, 306, "CARE");
  drawAccessoryShelf(ctx, 36, 190, "CASES");
  drawAccessoryShelf(ctx, 382, 382, "PEDALS");
  drawDemoArea(ctx, state);
}

function drawAccessoryShelf(ctx, x, y, label) {
  ctx.fillStyle = "#8d6b4c";
  roundRect(ctx, x, y, 126, 34, 6, true);
  ctx.fillStyle = "#6a4d35";
  ctx.fillRect(x + 8, y + 6, 110, 5);
  ctx.fillStyle = "#f1e3c8";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(x + 14 + i * 20, y + 15, 10, 12);
  }
  ctx.fillStyle = "#fff8e8";
  ctx.font = "9px system-ui";
  ctx.fillText(label, x + 42, y + 29);
}

function drawDemoArea(ctx, state) {
  ctx.fillStyle = "rgba(255, 253, 247, .56)";
  roundRect(ctx, 380, 345, 160, 112, 8, true);
  ctx.strokeStyle = "rgba(78, 103, 92, .45)";
  ctx.strokeRect(390, 355, 140, 92);
  ctx.fillStyle = "#4c6458";
  ctx.font = "10px system-ui";
  ctx.fillText("DEMO / TRYOUT AREA", 410, 374);
  ctx.fillStyle = "#334155";
  ctx.fillRect(420, 398, 42, 28);
  ctx.fillStyle = "#d7b85a";
  ctx.beginPath();
  ctx.arc(500, 410, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffdf7";
  ctx.font = "9px system-ui";
  ctx.fillText(`rep ${Math.round(state.stats.publicReputation)}`, 468, 440);
}

function drawExpansionFloor(ctx, state, bounds) {
  if (bounds.width <= 840) return;
  ctx.fillStyle = "rgba(233, 240, 244, .58)";
  roundRect(ctx, 820, 92, bounds.width - 850, bounds.height - 180, 10, true);
  ctx.strokeStyle = "rgba(70, 86, 102, .45)";
  ctx.strokeRect(832, 104, bounds.width - 874, bounds.height - 204);
  ctx.fillStyle = "#3d5264";
  ctx.font = "700 11px system-ui";
  ctx.fillText("EXPANDED SHOWROOM", 850, 124);
  for (let i = 0; i < 4; i += 1) {
    drawAccessoryShelf(ctx, 850, 160 + i * 72, ["BASS", "BAND", "DRUM", "PIANO"][i]);
  }
  ctx.fillStyle = "#254b5a";
  roundRect(ctx, bounds.width - 230, 134, 150, 82, 8, true);
  ctx.fillStyle = "#eff8f9";
  ctx.font = "11px system-ui";
  ctx.fillText("SECOND DEMO ROOM", bounds.width - 214, 178);
}

function drawWall(ctx, bounds) {
  ctx.fillStyle = "#8b5f3d";
  ctx.fillRect(0, 0, bounds.width, 70);
  ctx.fillStyle = "#6f472d";
  ctx.fillRect(0, 64, bounds.width, 12);
  ctx.fillStyle = "#243746";
  ctx.font = "700 20px system-ui";
  ctx.fillText("FineTune Empire", 28, 43);
  ctx.fillStyle = "#fff7df";
  ctx.font = "12px system-ui";
  ctx.fillText("No real brands. Real-ish consequences.", 220, 43);
}

function drawRack(ctx, x, y, items) {
  ctx.fillStyle = "#5e4633";
  ctx.fillRect(x - 18, y - 10, 210, 18);
  items.forEach((item, index) => {
    const gx = x + index * 34;
    const gy = y + 24;
    const color = ["#b74b38", "#327a73", "#263d68", "#d6a13b", "#5b3d75"][index % 5];
    ctx.strokeStyle = "#2b2520";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx + 11, gy + 2);
    ctx.lineTo(gx + 11, gy + 72);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(gx + 11, gy + 55, 13, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ded4bd";
    ctx.font = "10px system-ui";
    ctx.fillText(String(item.stock), gx + 5, gy + 96);
  });
}

function drawDepartmentDisplays(ctx, state, t) {
  drawPianoDisplay(ctx, 572, 112);
  drawKeyboardDemo(ctx, 626, 230, t);
  drawDrumDisplay(ctx, 300, 405, t);
  drawBandShelf(ctx, 52, 270, state);
  drawOrchestralStand(ctx, 745, 165, t);
}

function drawCoffeeLounge(ctx, state, t, bounds) {
  const y = bounds.height - 126;
  ctx.fillStyle = "rgba(245, 237, 223, .9)";
  roundRect(ctx, 226, y, 144, 94, 10, true);
  ctx.strokeStyle = "#b99b76";
  ctx.strokeRect(236, y + 10, 124, 74);
  ctx.fillStyle = "#6f4e37";
  roundRect(ctx, 236, y + 14, 46, 26, 6, true);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "9px system-ui";
  ctx.fillText("COFFEE", 242, y + 31);
  ctx.fillStyle = "#986a45";
  ctx.beginPath();
  ctx.arc(318, y + 48, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6d4bb";
  ctx.beginPath();
  ctx.arc(318, y + 48, 16, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI / 2 + 0.4;
    const x = 318 + Math.cos(angle) * 38;
    const cy = y + 48 + Math.sin(angle) * 30;
    ctx.fillStyle = "#5c6670";
    ctx.beginPath();
    ctx.arc(x, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3c2d22";
  ctx.font = "10px system-ui";
  ctx.fillText(`cups ${state.coffee.cupsSold}`, 240, y + 74);
  if (state.coffee.loungeBuzz > 35) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.72 + Math.sin(t * 3) * 0.12})`;
    roundRect(ctx, 332, y, 58, 24, 8, true);
    ctx.fillStyle = "#3c2d22";
    ctx.font = "9px system-ui";
    ctx.fillText("nice setup?", 338, y + 15);
  }
}

function drawPianoDisplay(ctx, x, y) {
  ctx.fillStyle = "#171c22";
  roundRect(ctx, x, y, 150, 72, 8, true);
  ctx.fillStyle = "#242b33";
  ctx.beginPath();
  ctx.ellipse(x + 98, y + 34, 62, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3eee1";
  ctx.fillRect(x + 12, y + 48, 98, 12);
  ctx.fillStyle = "#111";
  for (let i = 0; i < 10; i += 1) {
    ctx.fillRect(x + 20 + i * 9, y + 48, 4, 8);
  }
  ctx.fillStyle = "#e2d7c2";
  ctx.font = "10px system-ui";
  ctx.fillText("PIANO ORDERS", x + 28, y + 19);
}

function drawKeyboardDemo(ctx, x, y, t) {
  ctx.fillStyle = "#333b48";
  roundRect(ctx, x, y, 135, 40, 6, true);
  ctx.fillStyle = "#f5f1e8";
  ctx.fillRect(x + 8, y + 20, 112, 12);
  ctx.fillStyle = "#10151b";
  for (let i = 0; i < 12; i += 1) ctx.fillRect(x + 13 + i * 8, y + 20, 3, 8);
  ctx.fillStyle = `rgba(42, 117, 125, ${0.45 + Math.sin(t * 3) * 0.18})`;
  ctx.fillRect(x + 18, y + 8, 22, 6);
  ctx.fillStyle = "#e2d7c2";
  ctx.font = "10px system-ui";
  ctx.fillText("KEYS", x + 82, y + 13);
}

function drawDrumDisplay(ctx, x, y, t) {
  ctx.fillStyle = "#bd4c3c";
  ctx.beginPath();
  ctx.ellipse(x, y, 36, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f3eee1";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#2f6172";
  ctx.beginPath();
  ctx.ellipse(x + 52, y + 8, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#5b5147";
  ctx.beginPath();
  ctx.moveTo(x + 18, y - 28);
  ctx.lineTo(x + 18 + Math.sin(t * 2) * 3, y - 52);
  ctx.moveTo(x + 88, y - 18);
  ctx.lineTo(x + 94, y - 42);
  ctx.stroke();
  ctx.fillStyle = "#d7b85a";
  ctx.beginPath();
  ctx.ellipse(x + 18, y - 54, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 94, y - 44, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBandShelf(ctx, x, y, state) {
  ctx.fillStyle = "#6f5138";
  roundRect(ctx, x, y, 158, 68, 7, true);
  ctx.fillStyle = "#efe5d3";
  ctx.font = "10px system-ui";
  ctx.fillText("BAND & ORCHESTRA", x + 18, y + 16);
  const colors = ["#d6b86b", "#c48d37", "#3e5f7a", "#7a3e49"];
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.ellipse(x + 22 + i * 21, y + 42, 8, 18, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  const bandStock = state.inventory.filter((item) => ["Brass", "Woodwinds", "Orchestral strings"].includes(item.categoryGroup)).reduce((sum, item) => sum + item.stock, 0);
  ctx.fillStyle = "#fffaf0";
  ctx.fillText(`stock ${bandStock}`, x + 105, y + 60);
}

function drawOrchestralStand(ctx, x, y, t) {
  ctx.strokeStyle = "#2b2520";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 18, y + 92);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 18, y + 92);
  ctx.moveTo(x, y + 38);
  ctx.lineTo(x + 34, y + 84);
  ctx.stroke();
  ctx.fillStyle = "#8a4b36";
  ctx.beginPath();
  ctx.ellipse(x + 33, y + 70, 13, 28, Math.sin(t) * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawCounter(ctx) {
  ctx.fillStyle = "#254b5a";
  roundRect(ctx, 390, 250, 220, 80, 8, true);
  ctx.fillStyle = "#16333e";
  ctx.fillRect(402, 260, 196, 16);
  ctx.fillStyle = "#eff8f9";
  ctx.font = "12px system-ui";
  ctx.fillText("COUNTER", 465, 296);
}

function drawWorkbench(ctx, state, bounds) {
  const x = bounds.width - 200;
  const y = bounds.height - 200;
  ctx.fillStyle = "#7d4f35";
  roundRect(ctx, x, y, 145, 88, 8, true);
  ctx.fillStyle = "#37261b";
  ctx.fillRect(x + 18, y + 15, 110, 10);
  ctx.fillStyle = "#1f2933";
  ctx.fillRect(x + 28, y + 35, 72, 10);
  ctx.fillStyle = "#ddd3bd";
  ctx.font = "12px system-ui";
  ctx.fillText("SETUP BENCH", x + 22, y + 73);
  ctx.fillStyle = state.activeCalibration ? "#f4c430" : "#87a96b";
  ctx.beginPath();
  ctx.arc(x + 120, y + 18, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawStorage(ctx, bounds) {
  const y = bounds.height - 230;
  ctx.fillStyle = "#5c6670";
  roundRect(ctx, 45, y, 130, 130, 8, true);
  ctx.fillStyle = "#e1d9c9";
  ctx.font = "12px system-ui";
  ctx.fillText("STORAGE", 80, y + 70);
  ctx.strokeStyle = "#3b424a";
  ctx.strokeRect(62, y + 16, 96, 96);
}

function drawLedgerDesk(ctx) {
  ctx.fillStyle = "#39424e";
  roundRect(ctx, 78, 165, 140, 70, 8, true);
  ctx.fillStyle = "#f1e5c9";
  ctx.fillRect(118, 180, 60, 40);
  ctx.fillStyle = "#25313a";
  ctx.font = "12px system-ui";
  ctx.fillText("LEDGER", 121, 205);
}

function drawDoor(ctx, bounds) {
  const x = bounds.width / 2 - 45;
  const y = bounds.height - 64;
  ctx.fillStyle = "#334155";
  roundRect(ctx, x, y, 90, 48, 8, true);
  ctx.fillStyle = "#f4efe5";
  ctx.font = "12px system-ui";
  ctx.fillText("MAP", x + 32, y + 30);
}

function drawDisclaimerPlaque(ctx) {
  ctx.fillStyle = "rgba(255,255,255,.72)";
  roundRect(ctx, 628, 16, 170, 36, 6, true);
  ctx.fillStyle = "#514438";
  ctx.font = "9px system-ui";
  ctx.fillText("Simulation only.", 642, 31);
  ctx.fillText("Not professional training.", 642, 44);
}

function drawAmbientAnimation(ctx, state, t) {
  ctx.fillStyle = "rgba(255, 250, 240, .65)";
  for (let i = 0; i < 4; i += 1) {
    const x = 225 + i * 92 + Math.sin(t * 0.9 + i) * 4;
    const y = 78 + Math.cos(t * 0.7 + i) * 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 32, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.activePianoInstall) {
    ctx.fillStyle = "rgba(180, 70, 55, .82)";
    ctx.font = "700 11px system-ui";
    ctx.fillText("PIANO CREW OUT", 585, 204);
  }
}

function drawAmbientVisitors(ctx, state, t) {
  const bounds = getShopBounds(state);
  const baseCount = clamp(1 + Math.floor(state.stats.publicReputation / 34) + Math.floor(state.coffee.loungeBuzz / 45), 1, Math.min(5, state.coffee.seating));
  const spots = [
    { x: 286, y: bounds.height - 82, area: "coffee" },
    { x: 342, y: bounds.height - 85, area: "coffee" },
    { x: 266, y: 286, area: "shelf" },
    { x: 430, y: 410, area: "demo" },
    { x: 126, y: 264, area: "band" },
  ];
  for (let i = 0; i < baseCount; i += 1) {
    const spot = spots[i % spots.length];
    const x = spot.x + Math.sin(t * 0.9 + i * 2) * (spot.area === "coffee" ? 4 : 14);
    const y = spot.y + Math.cos(t * 0.8 + i) * (spot.area === "coffee" ? 3 : 8);
    drawTinyVisitor(ctx, x, y, i);
  }
  if (baseCount > 1) {
    ctx.strokeStyle = "rgba(70, 76, 84, .28)";
    ctx.beginPath();
    ctx.moveTo(286, bounds.height - 104);
    ctx.quadraticCurveTo(314, bounds.height - 126 + Math.sin(t * 2) * 4, 342, bounds.height - 104);
    ctx.stroke();
  }
}

function drawTinyVisitor(ctx, x, y, index) {
  const shirts = ["#2f6172", "#8a4b36", "#556b3f", "#6b4f8a", "#9a6a2f"];
  ctx.fillStyle = shirts[index % shirts.length];
  ctx.beginPath();
  ctx.arc(x, y - 12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d1a17d";
  ctx.beginPath();
  ctx.arc(x, y - 18, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirts[(index + 2) % shirts.length];
  roundRect(ctx, x - 7, y - 6, 14, 18, 5, true);
}

function drawCustomer(ctx, state, t) {
  if (!state.activeCustomer) return;
  const x = 506;
  const y = 218 + Math.sin(t * 4) * 2;
  ctx.fillStyle = "#21435d";
  ctx.beginPath();
  ctx.arc(x, y - 14, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c38d68";
  roundRect(ctx, x - 16, y, 32, 42, 12, true);
  ctx.fillStyle = "#182633";
  ctx.font = "11px system-ui";
  ctx.fillText(state.activeCustomer.name, x - 28, y - 34);
}

function drawPlayer(ctx, player) {
  ctx.fillStyle = "#132d46";
  ctx.beginPath();
  ctx.arc(player.x, player.y - 16, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6c58d";
  ctx.beginPath();
  ctx.arc(player.x, player.y - 20, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f855a";
  roundRect(ctx, player.x - 16, player.y - 4, 32, 40, 10, true);
  ctx.fillStyle = "#fff";
  ctx.font = "10px system-ui";
  ctx.fillText("YOU", player.x - 10, player.y + 19);
}

function drawInteractHint(ctx, state, nearby) {
  if (!nearby) return;
  ctx.fillStyle = "rgba(23, 36, 48, .86)";
  roundRect(ctx, 286, 485, 250, 34, 8, true);
  ctx.fillStyle = "#ffffff";
  ctx.font = "13px system-ui";
  ctx.fillText(`Press E: ${nearby.label}`, 352, 507);
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
}
