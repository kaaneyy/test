import { staffAuditTypes } from "../data/business.ts";
import { addLedger } from "./Economy.ts";
import { clamp } from "./Rng.ts";

export function runStaffAudit(state, auditId) {
  const audit = staffAuditTypes.find((item) => item.id === auditId);
  if (!audit) return { ok: false, message: "Audit type not found." };
  const last = state.audits.find((item) => item.auditId === auditId);
  if (last && state.day - last.day < audit.cooldownDays) {
    return { ok: false, message: `${audit.label} is still on cooldown.` };
  }
  if (state.cash < audit.cost) return { ok: false, message: `Need $${audit.cost} for ${audit.label}.` };
  addLedger(state, "quality-audit", audit.label, -audit.cost);
  state.audits.unshift({ auditId, label: audit.label, day: state.day });
  const effects = audit.effects || {};
  if (effects.honor) state.stats.industryHonor = clamp(state.stats.industryHonor + effects.honor, 0, 100);
  if (effects.publicReputation) state.stats.publicReputation = clamp(state.stats.publicReputation + effects.publicReputation, 0, 100);
  if (effects.legalRisk) state.stats.legalRisk = clamp(state.stats.legalRisk + effects.legalRisk, 0, 100);
  if (effects.staffMorale) state.stats.staffMorale = clamp(state.stats.staffMorale + effects.staffMorale, 0, 100);
  if (effects.toolCondition) state.stats.toolCondition = clamp(state.stats.toolCondition + effects.toolCondition, 0, 100);
  if (effects.calibrationAccuracy) state.stats.calibrationAccuracy = clamp(state.stats.calibrationAccuracy + effects.calibrationAccuracy, 0, 100);
  if (effects.cleanliness) state.stats.storeCleanliness = clamp(state.stats.storeCleanliness + effects.cleanliness, 0, 100);
  for (const employee of state.employees) {
    if (effects.mistakeReduction) employee.mistakeRate = Math.max(0.02, employee.mistakeRate - effects.mistakeReduction);
    if (effects.upsellRiskReduction) employee.shortcutTendency = Math.max(0.01, employee.shortcutTendency - effects.upsellRiskReduction);
  }
  return { ok: true, message: `${audit.label} completed.` };
}

export function getAuditTypes() {
  return staffAuditTypes;
}
