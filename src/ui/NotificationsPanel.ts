export function renderNotifications(state) {
  return `
    <div class="notification-stack" aria-live="polite">
      ${state.notifications.slice(0, 4).map((note) => `
        <div class="popup-note ${note.type}">
          <strong>${note.title}</strong>
          <span>${note.message}</span>
        </div>
      `).join("")}
    </div>
  `;
}
