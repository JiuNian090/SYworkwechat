const STORAGE_KEYS = {
  cloudUserId: 'cloudUserId',
  cloudAccount: 'cloudAccount',
  cloudUserInfo: 'cloudUserInfo',
  username: 'username',
  avatarType: 'avatarType',
  avatarEmoji: 'avatarEmoji',
  shifts: 'shifts',
  shiftTemplates: 'shiftTemplates',
  customWeeklyHours: 'customWeeklyHours',
  customHours: 'customHours',
  chartType: 'statisticsChartType',
  savedAccounts: 'savedAccounts',
  autoRestoreMap: 'autoRestoreMap'
};

function loadFromStorage() {
  const state = {};
  for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
    try {
      const value = wx.getStorageSync(storageKey);
      if (value !== '') state[key] = value;
    } catch (e) {}
  }
  return state;
}

function createStore(initialState) {
  let state = { ...initialState, ...loadFromStorage() };
  const listeners = {};
  let listenerId = 0;

  function getState(keys) {
    if (!keys) return state;
    if (typeof keys === 'string') return state[keys];
    const result = {};
    keys.forEach(k => { result[k] = state[k]; });
    return result;
  }

  function setState(updates, persistKeys) {
    const prevState = { ...state };
    Object.assign(state, updates);

    if (persistKeys) {
      persistKeys.forEach(storageKey => {
        const value = updates[storageKey];
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

  function subscribe(key, callback) {
    const id = ++listenerId;
    const eventKey = key || '*';
    if (!listeners[eventKey]) listeners[eventKey] = {};
    listeners[eventKey][id] = callback;
    return () => { delete listeners[eventKey][id]; };
  }

  function persistToStorage(storageMap) {
    const persistKeys = Object.keys(storageMap);
    const updates = {};
    persistKeys.forEach(key => {
      updates[key] = state[key];
    });
    setState(updates, persistKeys);
  }

  return { getState, setState, subscribe, persistToStorage };
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

function connectPage(pageConfig, mapStateToData) {
  const originalOnLoad = pageConfig.onLoad;
  const originalOnUnload = pageConfig.onUnload;
  const unsubscribers = [];

  pageConfig.onLoad = function (options) {
    if (mapStateToData) {
      const dataFromState = mapStateToData(store.getState());
      if (Object.keys(dataFromState).length > 0) {
        this.setData(dataFromState);
      }
      const fields = Object.keys(dataFromState);
      fields.forEach(field => {
        const unsub = store.subscribe(field, (newVal) => {
          this.setData({ [field]: newVal });
        });
        unsubscribers.push(unsub);
      });
    }
    if (originalOnLoad) originalOnLoad.call(this, options);
  };

  pageConfig.onUnload = function () {
    unsubscribers.forEach(fn => fn());
    unsubscribers.length = 0;
    if (originalOnUnload) originalOnUnload.call(this);
  };

  return pageConfig;
}

module.exports = { store, connectPage, STORAGE_KEYS };
