/**
 * ⑧ DEBUG_MODULE — Structured Error Taxonomy & Audit Logger
 */

const _logs = [];

export const DebugModule = {
  log(type, message, meta = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      meta
    };
    _logs.unshift(entry);
    if (_logs.length > 100) _logs.pop();
  },

  getLogs() {
    return [..._logs];
  }
};
