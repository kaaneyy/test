import { calibrationActions, scoreCalibration, summarizeMeasurements } from "../core/Calibration.ts";
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
  return `
    <section class="panel-section calibration-panel">
      <h2>${calibration.instrumentName}</h2>
      <p class="muted">${service.label} | ${profile.label} | Preference: ${modifier.label}</p>
      <div class="score-strip">
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
      <h3>Tools and Actions</h3>
      <div class="action-grid">
        ${calibrationActions.map((action) => `
          <button data-action="calibration-action" data-id="${action.id}" class="${action.shortcut ? "danger-button" : ""}" title="${action.help}">
            ${action.label}
          </button>
        `).join("")}
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
