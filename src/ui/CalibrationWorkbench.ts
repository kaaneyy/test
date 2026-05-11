import { calibrationActions, scoreCalibration, summarizeMeasurements, getCalibrationReadiness, estimateAdjustmentCost } from "../core/Calibration.ts";
import { calibrationProfiles, preferenceModifiers, setupProcedures } from "../data/calibrationProfiles.ts";

export function renderCalibrationWorkbench(state) {
  const calibration = state.activeCalibration;
  if (!calibration) {
    return `
      <section class="panel-section">
        <h2>Calibration Workbench</h2>
        <p>No active setup. Sell a guitar with setup service or open an outside guitar job.</p>
      </section>
    `;
  }
  const customer = state.activeCustomer;
  const preview = scoreCalibration(calibration, customer, state.player.skill.guitarSetup, state.stats.toolCondition);
  const profile = calibrationProfiles[calibration.profileId];
  const modifier = preferenceModifiers[calibration.preferenceId];
  const service = setupProcedures.find((item) => item.id === calibration.serviceId);
  const m = calibration.measurements;
  const readiness = getCalibrationReadiness(calibration);
  const instrumentGroup = calibration.instrumentName.toLowerCase().includes("piano") ? "piano" : calibration.instrumentName.toLowerCase().includes("bass") ? "bass" : "guitar";
  const allowedActions = calibrationActions.filter((action) => {
    if (instrumentGroup === "piano") return !["raise-pickups", "lower-pickups", "clean-electronics"].includes(action.id);
    if (instrumentGroup === "bass") return action.id !== "condition-board";
    return true;
  });
  const quickEventPrompt = instrumentGroup === "piano" ? "Strike the matching key timing" : instrumentGroup === "bass" ? "Lock in groove timing" : "Nail the string bend timing";
  const sale = state.activeSale;
  const adjustmentCost = sale?.adjustmentCost || 0;
  const baseProfit = sale?.totals?.profit || 0;
  const projectedProfit = baseProfit - adjustmentCost;
  return `
    <section class="panel-section calibration-panel">
      <h2>${calibration.instrumentName}</h2>
      <p class="muted">${service.label} | ${profile.label} | Preference: ${modifier.label}</p>
      <div class="score-strip">
        <span>Sale $<strong>${sale?.totals?.total?.toFixed?.(2) || "0.00"}</strong></span>
        <span>Projected profit <strong>$${projectedProfit.toFixed(2)}</strong></span>
        <span>Readiness <strong>${readiness.ready ? "Ready" : "Not ready"}</strong></span>
        <span>Preview setup score <strong>${preview.score}</strong></span>
        <span>Customer impact <strong>${preview.satisfaction}</strong></span>
        <span>Buzz risk <strong>${preview.risks.buzzRisk}</strong></span>
      </div>
      <div class="measurement-grid">
        ${metric("Tuning", `${m.tuningCents.map((v) => `${v > 0 ? "+" : ""}${v}`).join(" / ")} cents`)}
        ${metric("Relief", `${m.reliefMm} mm`, `${profile.reliefMinMm}-${profile.reliefMaxMm} ideal ${profile.reliefIdealMm}`)}
        ${metric("Action Low/High E", `${m.lowEActionMm} / ${m.highEActionMm} mm`, `${profile.lowEActionMinMm}-${profile.lowEActionMaxMm} / ${profile.highEActionMinMm}-${profile.highEActionMaxMm}`)}
        ${metric("Nut Low/High", `${m.nutLowMm} / ${m.nutHighMm} mm`, `${profile.nutLowMinMm}-${profile.nutLowMaxMm} / ${profile.nutHighMinMm}-${profile.nutHighMaxMm}`)}
        ${metric("Intonation", `${m.intonationCents.map((v) => `${v > 0 ? "+" : ""}${v}`).join(" / ")} cents`, `max target ${profile.intonationMaxCents} cents`)}
        ${metric("Pickup Height", m.pickupBassMm === null ? "N/A" : `${m.pickupBassMm} / ${m.pickupTrebleMm} mm`, "bass / treble side")}
        ${metric("Electronics Noise", `${m.electronicsNoise}`, "lower is better")}
        ${metric("Humidity", `${m.humidityPercent}%`, `${profile.humiditySafeMinPercent}-${profile.humiditySafeMaxPercent}% safe`)}
        ${metric("Cleanliness", `${Math.round(m.cleanliness)}/100`)}
        ${metric("Documentation", `${Math.round(calibration.documentationQuality)}/100`)}
      </div>
      <p class="quote">${summarizeMeasurements(calibration)}</p>
      ${readiness.shortcutTaken ? `<p class="quote">Shortcut selected: no further adjustments required before finalize, but quality/reputation risk applies.</p>` : ""}
      ${(!readiness.shortcutTaken && readiness.missingSteps.length) ? `<p class="quote">Missing before sale: ${readiness.missingSteps.join(", ")}.</p>` : ""}
      <h3>Tools and Actions</h3>
      <p class="muted">Educational path: inspect → relief → action → intonation → play test → document. Following this order improves consistency and score.</p>
      <div class="button-row"><button data-action="start-fullscreen-qte">Start full-screen setup QTE</button><button data-action="auto-adjust">Auto complete required steps (premium)</button></div>
      <p class="quote">Mini game: ${quickEventPrompt}. Use <strong>Quick focus event</strong> like a quick-time event during adjustments.</p>
      <div class="action-grid">
        ${allowedActions.map((action) => { const needed = readiness.missingSteps.includes(action.step); const cost = action.shortcut ? 0 : estimateAdjustmentCost(action); return `
          <button data-action="calibration-action" data-id="${action.id}" class="${action.shortcut ? "danger-button" : ""} ${needed ? "needed-action" : ""}" title="${action.help}">
            ${action.label} ${needed ? "• needed" : ""} ($${cost.toFixed(2)})
          </button>
        `; }).join("")}
      </div>
      <div class="score-details">
        <h3>Scoring Notes</h3>
        <p>Relief, action, nut clearance, intonation, tuning stability, pickup height, electronics noise, cleanliness, documentation, play test, tool condition, and staff skill all feed the hidden outcome. Shortcuts create defects that can be discovered later.</p>
        <ul class="fact-list">
          ${Object.entries(preview.components).map(([key, value]) => `<li>${labelize(key)}: ${value}</li>`).join("")}
        </ul>
      </div>
      <div class="sticky-action">
        <button class="primary" data-action="finalize-calibration">Finalize setup and take payment</button>
      </div>
    </section>
  `;
}

function metric(label, value, hint = "") {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
      ${hint ? `<small>${hint}</small>` : ""}
    </div>
  `;
}

function labelize(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
