import { addLedger } from "./Economy.ts";
import { clamp, round } from "./Rng.ts";

export function createWarrantyRecord(state, sale, totals, setupResult, calibration) {
  const serviceDays = sale.serviceId?.includes("stage") ? 45 : sale.serviceId?.includes("collector") ? 30 : 14;
  const coverage = Math.max(40, totals.total * (0.12 + (setupResult.risks.discoverySeverity || 0) * 0.25));
  const record = {
    id: `warranty-${sale.id}`,
    saleId: sale.id,
    customerLabel: sale.customerLabel,
    instrumentName: sale.instrumentName,
    startDay: state.day,
    expiresDay: state.day + serviceDays,
    coverage: round(coverage, 2),
    documentationQuality: calibration.documentationQuality || 0,
    risk: round((setupResult.risks.discoverySeverity || 0) + (calibration.dishonestActions.length ? 0.35 : 0), 2),
    status: "active",
  };
  state.warranties.push(record);
  state.stats.warrantyLiability = clamp(state.stats.warrantyLiability + record.coverage * record.risk, 0, 10000);
  return record;
}

export function openWarrantyClaim(state, defect) {
  const warranty = state.warranties.find((item) => item.instrumentName === defect.instrumentName && item.status === "active" && item.expiresDay >= state.day);
  const inWarranty = Boolean(warranty);
  const claim = {
    id: `claim-${state.day}-${state.warrantyClaims.length}`,
    day: state.day,
    customerLabel: defect.customerLabel,
    instrumentName: defect.instrumentName,
    severity: defect.severity,
    dishonest: defect.dishonest,
    inWarranty,
    estimatedCost: round((defect.value || 300) * (0.08 + defect.severity * 0.18), 2),
    status: "open",
    warrantyId: warranty?.id || null,
  };
  state.warrantyClaims.unshift(claim);
  return claim;
}

export function resolveWarrantyClaim(state, claimId, resolution = "honor") {
  const claim = state.warrantyClaims.find((item) => item.id === claimId);
  if (!claim || claim.status !== "open") return { ok: false, message: "Warranty claim not found." };
  if (resolution === "deny") {
    claim.status = "denied";
    state.stats.publicReputation = clamp(state.stats.publicReputation - 3 - claim.severity * 6, 0, 100);
    state.stats.industryHonor = clamp(state.stats.industryHonor - 4 - (claim.dishonest ? 8 : 0), 0, 100);
    state.stats.legalRisk = clamp(state.stats.legalRisk + 3 + claim.severity * 5, 0, 100);
    return { ok: true, message: "Claim denied. Cash is safe today; trust is not." };
  }
  const cost = Math.min(state.cash, claim.estimatedCost);
  addLedger(state, "warranty-claim", `Warranty claim: ${claim.instrumentName}`, -cost);
  claim.status = "resolved";
  state.stats.publicReputation = clamp(state.stats.publicReputation + 1.5, 0, 100);
  state.stats.industryHonor = clamp(state.stats.industryHonor + (claim.dishonest ? 0 : 2), 0, 100);
  state.stats.legalRisk = clamp(state.stats.legalRisk - 2, 0, 100);
  state.stats.warrantyLiability = clamp(state.stats.warrantyLiability - cost, 0, 10000);
  return { ok: true, message: `Warranty honored for $${round(cost, 2)}.` };
}

export function expireWarranties(state) {
  for (const warranty of state.warranties) {
    if (warranty.status === "active" && warranty.expiresDay < state.day) {
      warranty.status = "expired";
    }
  }
}
