export class SeededRng {
  constructor(seed) {
    this.seed = seed || 123456789;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    if (!items.length) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  weighted(items, weightKey) {
    const total = items.reduce((sum, item) => sum + Math.max(0, item[weightKey] || 0), 0);
    if (total <= 0) return this.pick(items);
    let roll = this.range(0, total);
    for (const item of items) {
      roll -= Math.max(0, item[weightKey] || 0);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
