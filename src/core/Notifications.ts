export function pushNotification(state, type, title, message) {
  const notification = {
    id: `note-${Date.now()}-${Math.floor(state.rng.next() * 10000)}`,
    day: state.day,
    type,
    title,
    message,
    createdAt: Date.now(),
  };
  state.notifications.unshift(notification);
  state.notifications = state.notifications.slice(0, 6);
  return notification;
}

export function pruneNotifications(state, maxAgeMs = 12000) {
  const now = Date.now();
  state.notifications = state.notifications.filter((item) => now - item.createdAt < maxAgeMs).slice(0, 6);
}
