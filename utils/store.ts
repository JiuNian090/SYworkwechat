'use strict';
const { STORAGE_KEYS } = require('./storage');

interface StoreState {
  cloudInitialized: boolean;
  cloudUserId: string;
  cloudAccount: string;
  cloudUserInfo: any;
  username: string;
  avatarType: string;
  avatarEmoji: string;
  shifts: Record<string, any>;
  shiftTemplates: any[];
  customWeeklyHours: number;
  customHours: number;
  chartType: string;
  savedAccounts: any[];
  autoRestoreMap: Record<string, any>;
}

interface StoreAPI {
  getState(): StoreState;
  getState(keys: string): any;
  getState(keys: string[]): Partial<StoreState>;
  setState(updates: Partial<StoreState>, persistKeys?: string[]): void;
  removeState(keys: string[], persistKeys?: string[]): void;
  subscribe(key: string, callback: (newVal: any, prevVal: any) => void): () => void;
  subscribe(key: null, callback: (newVal: StoreState, prevVal: StoreState) => void): () => void;
  persistToStorage(storageMap: Record<string, string>): void;
}

function loadFromStorage(): Record<string, any> {
  const state: Record<string, any> = {};
  for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
    try {
      const value = wx.getStorageSync(storageKey as string);
      if (value !== '') state[key] = value;
    } catch (e) {}
  }
  return state;
}

function createStore(initialState: StoreState): StoreAPI {
  const state: Record<string, any> = { ...initialState, ...loadFromStorage() };
  const listeners: Record<string, Record<number, (newVal: any, prevVal: any) => void>> = {};
  let listenerId = 0;

  function getState(): StoreState;
  function getState(keys: string): any;
  function getState(keys: string[]): Partial<StoreState>;
  function getState(keys?: string | string[]): StoreState | any | Partial<StoreState> {
    if (!keys) return state;
    if (typeof keys === 'string') return state[keys];
    const result: Record<string, any> = {};
    keys.forEach(k => { result[k] = state[k]; });
    return result;
  }

  function setState(updates: Partial<StoreState>, persistKeys?: string[]): void {
    const prevState = { ...state };
    Object.assign(state, updates);

    if (persistKeys) {
      persistKeys.forEach(storageKey => {
        const value = (updates as Record<string, any>)[storageKey];
        if (value !== undefined) {
          try { wx.setStorageSync(STORAGE_KEYS[storageKey] || storageKey, value); } catch (e) {}
        }
      });
    }

    Object.keys(updates).forEach(key => {
      if (listeners[key]) {
        Object.values(listeners[key]).forEach(cb => {
          try { cb(state[key], prevState[key]); } catch (e) {}
        });
      }
    });

    if (listeners['*']) {
      Object.values(listeners['*']).forEach(cb => {
        try { cb(state, prevState); } catch (e) {}
      });
    }
  }

  function removeState(keys: string[], persistKeys?: string[]): void {
    const updates: Record<string, any> = {};
    const prevState = { ...state };
    keys.forEach(key => { state[key] = undefined; updates[key] = undefined; });

    if (persistKeys) {
      persistKeys.forEach(storageKey => {
        try { wx.removeStorageSync(STORAGE_KEYS[storageKey] || storageKey); } catch (e) {}
      });
    }

    keys.forEach(key => {
      if (listeners[key]) {
        Object.values(listeners[key]).forEach(cb => {
          try { cb(state[key], prevState[key]); } catch (e) {}
        });
      }
    });

    if (listeners['*']) {
      Object.values(listeners['*']).forEach(cb => {
        try { cb(state, prevState); } catch (e) {}
      });
    }
  }

  function subscribe(key: string, callback: (newVal: any, prevVal: any) => void): () => void;
  function subscribe(key: null, callback: (newVal: StoreState, prevVal: StoreState) => void): () => void;
  function subscribe(key: string | null, callback: ((newVal: any, prevVal: any) => void) | ((newVal: StoreState, prevVal: StoreState) => void)): () => void {
    const id = ++listenerId;
    const eventKey = key || '*';
    if (!listeners[eventKey]) listeners[eventKey] = {};
    listeners[eventKey][id] = callback as (newVal: any, prevVal: any) => void;
    return () => { delete listeners[eventKey][id]; };
  }

  function persistToStorage(storageMap: Record<string, string>): void {
    const persistKeys = Object.keys(storageMap);
    const updates: Record<string, any> = {};
    persistKeys.forEach(key => {
      updates[key] = state[key];
    });
    setState(updates, persistKeys);
  }

  return { getState, setState, removeState, subscribe, persistToStorage };
}

const store = createStore({
  cloudInitialized: false,
  cloudUserId: '',
  cloudAccount: '',
  cloudUserInfo: null,
  username: '',
  avatarType: 'text',
  avatarEmoji: '',
  shifts: {},
  shiftTemplates: [],
  customWeeklyHours: 35,
  customHours: 35,
  chartType: 'line',
  savedAccounts: [],
  autoRestoreMap: {}
});

module.exports = { store, STORAGE_KEYS };

export {};
