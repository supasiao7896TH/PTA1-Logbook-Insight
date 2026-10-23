/**
 * ② STATE_STORE — Reactive Pub/Sub State Store
 */

const _state = {
  activeTab: 'search', // 'search' | 'silo' | 'washing' | 'sap' | 'overview' | 'equipment' | 'ips'
  theme: 'light',
  months: [],
  daysSummary: [],
  entries: [],
  siloOperations: [],
  washingRoutines: [],
  sapMemos: [],
  regularWork: [],
  filters: {
    monthKey: 'ALL',
    shift: 'ALL',
    bm: 'ALL',
    category: 'ALL',
    tag: 'ALL',
    query: ''
  },
  siloFilters: {
    silo: 'ALL',
    monthKey: 'ALL',
    query: ''
  },
  washingFilters: {
    equipment: 'ALL',
    washNo: 'ALL',
    monthKey: 'ALL',
    query: ''
  },
  sapFilters: {
    status: 'ALL',
    monthKey: 'ALL',
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

  updateSiloFilters(partial) {
    const next = { ..._state.siloFilters, ...partial };
    this.set('siloFilters', next);
  },

  updateWashingFilters(partial) {
    const next = { ..._state.washingFilters, ...partial };
    this.set('washingFilters', next);
  },

  updateSapFilters(partial) {
    const next = { ..._state.sapFilters, ...partial };
    this.set('sapFilters', next);
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
