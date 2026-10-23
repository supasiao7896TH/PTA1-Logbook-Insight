/**
 * ② STATE_STORE — Reactive Pub/Sub State Store
 */

const _state = {
  activeTab: 'search', // 'search' | 'overview' | 'equipment' | 'ips'
  theme: 'light',
  months: [],
  daysSummary: [],
  entries: [],
  filters: {
    monthKey: 'ALL',
    shift: 'ALL',
    bm: 'ALL',
    category: 'ALL',
    tag: 'ALL',
    query: ''
  },
  ipsDrafts: [],
  selectedDraftId: 'ips-oct-lcv2302',
  ipsMode: 'ips' // 'ips' | 'kaizen'
};

const _listeners = new Map();

export const StateStore = {
  get(key) {
    return _state[key];
  },

  set(key, value) {
    _state[key] = value;
    const subs = _listeners.get(key);
    if (subs) {
      for (const fn of subs) {
        try {
          fn(value, _state);
        } catch (err) {
          console.error(`[StateStore] listener error on "${key}":`, err);
        }
      }
    }
  },

  updateFilters(partial) {
    const next = { ..._state.filters, ...partial };
    this.set('filters', next);
  },

  on(key, fn) {
    if (!_listeners.has(key)) {
      _listeners.set(key, new Set());
    }
    _listeners.get(key).add(fn);
  },

  off(key, fn) {
    const subs = _listeners.get(key);
    if (subs) subs.delete(fn);
  }
};
