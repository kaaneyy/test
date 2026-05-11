import { addLedger, createPendingInvoice } from "./Economy.ts";
import { finalizePianoInstall, scorePianoInstall, startPianoInstall } from "./Piano.ts";
import { applyIncident, applyServiceOutcome } from "./Reputation.ts";
import { clamp, round } from "./Rng.ts";

export function availableOutsideJobs(state) {
  return state.outsideJobs.filter((job) => state.day >= job.unlockDay);
}

export function acceptOutsideJob(state, jobId) {
  const job = state.outsideJobs.find((item) => item.id === jobId);
  if (!job) return { ok: false, message: "Outside job not found." };
  if (state.activeOutsideJob) return { ok: false, message: "Finish the current outside job first." };
  if (state.cash < job.travelCost) return { ok: false, message: "Not enough cash for travel and materials." };
  addLedger(state, "delivery-fuel", `Travel cost: ${job.title}`, -job.travelCost);
  state.hour += Math.floor(job.durationHours / 2);
  state.activeOutsideJob = {
    ...structuredClone(job),
    completedChecklist: [],
    shortcutsTaken: [],
    quality: 40,
    documentation: 20,
    accepted: false,
  };
  if (job.pianoProfileId) startPianoInstall(state, job);
  state.ui.panel = "outside-job";
  return { ok: true, message: `Accepted ${job.title}. Payment arrives only after completion and acceptance.` };
}

export function toggleJobChecklist(state, checklistId) {
  const job = state.activeOutsideJob;
  if (!job) return;
  if (job.completedChecklist.includes(checklistId)) {
    job.completedChecklist = job.completedChecklist.filter((id) => id !== checklistId);
  } else {
    job.completedChecklist.push(checklistId);
  }
}

export function toggleJobShortcut(state, shortcutId) {
  const job = state.activeOutsideJob;
  if (!job) return;
  if (job.shortcutsTaken.includes(shortcutId)) {
    job.shortcutsTaken = job.shortcutsTaken.filter((id) => id !== shortcutId);
  } else {
    job.shortcutsTaken.push(shortcutId);
  }
}

export function completeOutsideJob(state) {
  const job = state.activeOutsideJob;
  if (!job) return { ok: false, message: "No outside job is active." };
  const properCount = job.checklist.length;
  const doneCount = job.completedChecklist.length;
  const doneItems = job.checklist.filter((item) => job.completedChecklist.includes(item.id));
  const quality = doneItems.reduce((sum, item) => sum + (item.quality || 0), 40);
  const documentation = doneItems.reduce((sum, item) => sum + (item.documentation || 0), 20);
  const shortcuts = job.shortcuts.filter((item) => job.shortcutsTaken.includes(item.id));
  const shortcutSeverity = shortcuts.reduce((sum, item) => sum + item.severity, 0);
  const dishonest = shortcuts.some((item) => item.dishonest);
  const pianoResult = job.pianoProfileId ? finalizePianoInstall(state) || scorePianoInstall(state) : null;
  const procedureScore = pianoResult
    ? clamp(pianoResult.score - shortcutSeverity * 12, 0, 100)
    : clamp((doneCount / properCount) * 100 - shortcutSeverity * 28, 0, 100);
  const acceptanceScore = clamp(procedureScore * 0.62 + quality * 0.22 + documentation * 0.16 - (dishonest ? 18 : 0), 0, 100);
  const accepted = pianoResult ? pianoResult.accepted && acceptanceScore >= 70 : acceptanceScore >= (job.advanced ? 72 : 58);

  if (accepted) {
    if (job.invoiceTermsDays) {
      createPendingInvoice(state, job.title, job.payment, job.invoiceTermsDays, 0.18);
      state.ui.toast = `${job.title} accepted. Invoice issued; payment due day ${state.day + job.invoiceTermsDays}.`;
    } else {
      addLedger(state, "installation-revenue", `Outside job accepted: ${job.title}`, job.payment);
      state.ui.toast = `${job.title} accepted. Payment received after sign-off.`;
    }
    applyServiceOutcome(state, {
      satisfaction: acceptanceScore,
      technicalQuality: procedureScore,
      dishonest,
      legalRiskAdd: dishonest ? 4 : 0,
    });
    state.reviews.unshift({
      day: state.day,
      customerLabel: job.location,
      instrumentName: job.title,
      score: Math.round(acceptanceScore),
      text: job.successReview,
    });
  } else {
    const failure = job.failureIncident || {
      title: `${job.title} complaint`,
      description: job.failureReview,
      publicReputationDrop: Math.round(5 + shortcutSeverity * 5),
      industryHonorDrop: Math.round(8 + shortcutSeverity * 8),
      legalRiskAdd: Math.round(5 + shortcutSeverity * 6),
      refundAmount: Math.min(job.payment * 0.45, job.payment - 1),
    };
    applyIncident(state, failure);
    state.ui.toast = `${job.title} failed acceptance. Payment withheld and reputation takes the hit.`;
  }

  const result = {
    ok: accepted,
    accepted,
    score: round(acceptanceScore, 1),
    procedureScore: round(procedureScore, 1),
    shortcutSeverity: round(shortcutSeverity, 2),
    dishonest,
    message: accepted ? "Job accepted and paid." : "Job rejected or publicly failed.",
  };
  state.activeOutsideJob = null;
  state.activePianoInstall = null;
  return result;
}
