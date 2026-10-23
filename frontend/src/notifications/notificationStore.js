const TIMEOUT = 6000;
const EMPTY = Object.freeze([]);

// Independent of routing and the DOM; timers run only while a view subscribes.
export function createNotificationStore({ schedule = setTimeout, cancel = clearTimeout, now = () => Date.now() } = {}) {
  const records = new Map();
  const listeners = new Set();
  let snapshot = EMPTY;
  let sequence = 0;
  let hidden = false;

  const emit = () => {
    snapshot = Object.freeze(Array.from(records.values(), (record) => record.notification));
    listeners.forEach((listener) => listener());
  };
  const stopTimer = (record) => {
    if (record.timer !== null) {
      cancel(record.timer);
      record.remaining = Math.max(0, record.remaining - (now() - record.startedAt));
      record.timer = null;
    }
  };
  const dismiss = (id) => {
    const record = records.get(id);
    if (!record) return;
    stopTimer(record);
    records.delete(id);
    emit();
  };
  const startTimer = (record) => {
    if (record.remaining === null || record.timer !== null || record.pauses.size || hidden || !listeners.size) return;
    record.startedAt = now();
    record.timer = schedule(() => dismiss(record.notification.id), record.remaining);
  };
  const add = (type, message) => {
    if (typeof message !== 'string' || !message.trim()) throw new TypeError('A notificação precisa de texto.');
    const notification = Object.freeze({ id: ++sequence, type, message: message.trim() });
    const record = { notification, remaining: type === 'error' ? null : TIMEOUT, timer: null, startedAt: 0, pauses: new Set() };
    records.set(notification.id, record);
    startTimer(record);
    emit();
    return notification.id;
  };
  return {
    notify: Object.freeze({
      success: (message) => add('success', message),
      error: (message) => add('error', message),
      info: (message) => add('info', message),
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      records.forEach(startTimer);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) records.forEach(stopTimer);
      };
    },
    dismiss,
    pause: (id, reason) => {
      const record = records.get(id);
      if (record) { record.pauses.add(reason); stopTimer(record); }
    },
    resume: (id, reason) => {
      const record = records.get(id);
      if (record) { record.pauses.delete(reason); startTimer(record); }
    },
    setHidden: (value) => {
      hidden = value;
      records.forEach(hidden ? stopTimer : startTimer);
    },
  };
}
