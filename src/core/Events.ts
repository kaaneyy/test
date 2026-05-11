import { randomEvents } from "../data/jobs.ts";
import { clamp } from "./Rng.ts";

export function maybeTriggerDailyEvent(state) {
  const candidates = randomEvents.filter((event) => state.day >= event.dayMin && !state.randomEventsSeen.includes(event.id));
  if (!candidates.length) return null;
  const event = candidates[0];
  state.randomEventsSeen.push(event.id);
  if (event.reputationImpact) state.stats.publicReputation = clamp(state.stats.publicReputation + event.reputationImpact, 0, 100);
  if (event.brandImageImpact) state.stats.brandImage = clamp(state.stats.brandImage + event.brandImageImpact, 0, 100);
  if (event.supplierTrustImpact) state.stats.supplierTrust = clamp(state.stats.supplierTrust + event.supplierTrustImpact, 0, 100);
  if (event.unlockBank) state.unlocked.bank = true;
  state.ui.toast = `${event.title}: ${event.message}`;
  return event;
}
