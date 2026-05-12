import { brandImageLabels } from "../data/business.ts";
import { clamp, round } from "./Rng.ts";
import { addLedger } from "./Economy.ts";
import { openWarrantyClaim } from "./Warranty.ts";

export function applyServiceOutcome(state, outcome) {
  const satisfaction = outcome.satisfaction || 50;
  const technicalQuality = outcome.technicalQuality || outcome.setupScore || 50;
  const honestyPenalty = outcome.dishonest ? 8 : 0;
  const publicDelta = (satisfaction - 55) / 7 - honestyPenalty * 0.5;
  const honorDelta = (technicalQuality - 58) / 6 - honestyPenalty;
  const brandDelta = (publicDelta + honorDelta) / 2;

  state.stats.publicReputation = clamp(round(state.stats.publicReputation + publicDelta, 1), 0, 100);
  state.stats.industryHonor = clamp(round(state.stats.industryHonor + honorDelta, 1), 0, 100);
  state.stats.brandImage = clamp(round(state.stats.brandImage + brandDelta, 1), 0, 100);
  state.stats.calibrationAccuracy = clamp(round((state.stats.calibrationAccuracy * 3 + technicalQuality) / 4, 1), 0, 100);

  if (outcome.legalRiskAdd) {
    state.stats.legalRisk = clamp(round(state.stats.legalRisk + outcome.legalRiskAdd, 1), 0, 100);
  }
  if (outcome.warrantyLiabilityAdd) {
    state.stats.warrantyLiability = clamp(round(state.stats.warrantyLiability + outcome.warrantyLiabilityAdd, 1), 0, 1000);
  }
  return {
    publicDelta: round(publicDelta, 1),
    honorDelta: round(honorDelta, 1),
    brandDelta: round(brandDelta, 1),
  };
}

export function applyIncident(state, incident) {
  state.stats.publicReputation = clamp(round(state.stats.publicReputation - (incident.publicReputationDrop || 0), 1), 0, 100);
  state.stats.industryHonor = clamp(round(state.stats.industryHonor - (incident.industryHonorDrop || 0), 1), 0, 100);
  state.stats.legalRisk = clamp(round(state.stats.legalRisk + (incident.legalRiskAdd || 0), 1), 0, 100);
  state.stats.brandImage = clamp(round(state.stats.brandImage - ((incident.publicReputationDrop || 0) + (incident.industryHonorDrop || 0)) / 3, 1), 0, 100);
  if (incident.refundAmount) {
    addLedger(state, "refunds", `Refund/settlement: ${incident.title}`, -incident.refundAmount);
  }
  state.incidents.unshift({
    day: state.day,
    ...incident,
  });
  state.reviews.unshift({
    day: state.day,
    customerLabel: "Public incident",
    instrumentName: incident.title,
    score: 8,
    text: incident.description,
  });
}

export function getBrandImageLabel(score) {
  const match = brandImageLabels.find((item) => score >= item.min && score <= item.max);
  return match ? match.label : "Unclear identity";
}

export function processPendingDefects(state) {
  const remaining = [];
  const discovered = [];
  for (const defect of state.pendingDefects) {
    defect.daysOld += 1;
    const knowledgeFactor = 0.35 + defect.customerKnowledge / 100;
    const timeFactor = Math.min(1.4, 0.3 + defect.daysOld * 0.18);
    const reputationFactor = 1.15 - state.stats.publicReputation / 180;
    const chance = defect.severity * knowledgeFactor * defect.publicUseFactor * defect.valueFactor * timeFactor * reputationFactor;
    if (state.rng.chance(Math.min(0.92, chance))) {
      discovered.push(defect);
      openWarrantyClaim(state, defect);
      const dishonestBoost = defect.dishonest ? 1.8 : 1;
      applyServiceOutcome(state, {
        satisfaction: Math.max(0, defect.originalSatisfaction - 35 * defect.severity * dishonestBoost),
        technicalQuality: Math.max(0, 65 - 55 * defect.severity),
        dishonest: defect.dishonest,
        legalRiskAdd: 3 + 12 * defect.severity * dishonestBoost,
        warrantyLiabilityAdd: defect.value * 0.08 * defect.severity,
      });
      if ((defect.customerKnowledge || 0) < 45) {
        state.onlineOrders.unshift({
          id: `repair-${defect.id}-${state.day}`,
          day: state.day,
          itemId: null,
          itemName: defect.instrumentName,
          quantity: 1,
          gross: round(defect.value * 0.22, 2),
          dueDay: state.day + 2,
          status: "posted",
          repair: true,
        });
      }
      state.reviews.unshift({
        day: state.day,
        customerLabel: defect.customerLabel,
        instrumentName: defect.instrumentName,
        score: Math.max(0, Math.round(defect.originalSatisfaction - 45 * defect.severity * dishonestBoost)),
        text: defect.reviewText || "A later inspection found problems the shop should have documented.",
      });
    } else {
      remaining.push(defect);
    }
  }
  state.pendingDefects = remaining;
  return discovered;
}
