import { getProducts } from '../services/catalogService.js';
import { getOrders, transitionOrder } from '../services/ordersService.js';
import { getCustomers, updateCustomer, assignRep, blockCustomer } from '../services/customerService.js';
import { getReps, updateRep, assignCustomers, toggleRepStatus } from '../services/salesRepService.js';
import { updateInventory, updatePricing, updateVisibility, updateProduct } from '../services/catalogService.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeId(value) {
  return String(value || '').trim();
}

function patchOpsState(store, patch) {
  store.update((draft) => {
    draft.runtime.ops = {
      ...draft.runtime.ops,
      ...patch,
    };
  }, { silent: true });
}

function setRouteMeta(store, section, id = null) {
  const current = store.getState().runtime.ops.runtime;
  patchOpsState(store, {
    runtime: {
      ...current,
      loaded: false,
      loading: true,
      error: null,
      route: section,
      routeEntityId: id,
    },
  });
}

function finishRouteMeta(store, section, id = null, error = null) {
  const current = store.getState().runtime.ops.runtime;
  patchOpsState(store, {
    runtime: {
      ...current,
      loaded: true,
      loading: false,
      error: error || null,
      route: section,
      routeEntityId: id,
      lastHydratedAt: nowIso(),
    },
  });
}

function failRouteMeta(store, section, id = null, error = null) {
  const current = store.getState().runtime.ops.runtime;
  patchOpsState(store, {
    runtime: {
      ...current,
      loaded: false,
      loading: false,
      error: error || 'OPS_ROUTE_LOAD_FAILED',
      route: section,
      routeEntityId: id,
    },
  });
}

async function loadCatalogRoute(store, api) {
  const products = await getProducts(api).catch(() => []);
  patchOpsState(store, {
    catalog: {
      ...store.getState().runtime.ops.catalog,
      loaded: true,
      loading: false,
      error: null,
      loadedAt: nowIso(),
      products,
      product: null,
    },
  });
}

async function loadOrdersRoute(store, api) {
  const orders = await getOrders(api).catch(() => []);
  patchOpsState(store, {
    orders: {
      ...store.getState().runtime.ops.orders,
      loaded: true,
      loading: false,
      error: null,
      loadedAt: nowIso(),
      orders,
      order: null,
    },
  });
}

async function loadCustomersRoute(store, api) {
  const customers = await getCustomers(api).catch(() => []);
  patchOpsState(store, {
    customers: {
      ...store.getState().runtime.ops.customers,
      loaded: true,
      loading: false,
      error: null,
      loadedAt: nowIso(),
      customers,
      customer: null,
    },
  });
}

async function loadRepsRoute(store, api) {
  const reps = await getReps(api).catch(() => []);
  patchOpsState(store, {
    reps: {
      ...store.getState().runtime.ops.reps,
      loaded: true,
      loading: false,
      error: null,
      loadedAt: nowIso(),
      reps,
      rep: null,
    },
  });
}

async function loadReportsRoute(store) {
  const state = store.getState();
  const summary = {
    catalog: Array.isArray(state.runtime?.ops?.catalog?.products) ? state.runtime.ops.catalog.products.length : 0,
    orders: Array.isArray(state.runtime?.ops?.orders?.orders) ? state.runtime.ops.orders.orders.length : 0,
    customers: Array.isArray(state.runtime?.ops?.customers?.customers) ? state.runtime.ops.customers.customers.length : 0,
    reps: Array.isArray(state.runtime?.ops?.reps?.reps) ? state.runtime.ops.reps.reps.length : 0,
    loadedSections: {
      catalog: Boolean(state.runtime?.ops?.catalog?.loaded),
      orders: Boolean(state.runtime?.ops?.orders?.loaded),
      customers: Boolean(state.runtime?.ops?.customers?.loaded),
      reps: Boolean(state.runtime?.ops?.reps?.loaded),
    },
  };

  patchOpsState(store, {
    reports: {
      ...state.runtime.ops.reports,
      loaded: true,
      loading: false,
      error: null,
      loadedAt: nowIso(),
      summary,
    },
  });
}

export async function ensureOpsRouteHydrated(store, api, route = { name: 'ops', params: {} }) {
  const section = normalizeId(route?.params?.section || 'dashboard') || 'dashboard';
  const id = normalizeId(route?.params?.id || null) || null;

  if (section === 'dashboard') {
    const current = store.getState().runtime.ops.runtime;
    patchOpsState(store, {
      runtime: {
        ...current,
        loaded: true,
        loading: false,
        error: null,
        route: section,
        routeEntityId: id,
      },
    });
    return { section, loaded: false };
  }

  const currentSlice = store.getState().runtime?.ops?.[section];
  if (currentSlice?.loaded && !currentSlice?.error && currentSlice?.loadedAt) {
    setRouteMeta(store, section, id);
    finishRouteMeta(store, section, id, null);
    return { section, loaded: true };
  }

  setRouteMeta(store, section, id);

  try {
    if (section === 'catalog') {
      await loadCatalogRoute(store, api);
    } else if (section === 'orders') {
      await loadOrdersRoute(store, api);
    } else if (section === 'customers') {
      await loadCustomersRoute(store, api);
    } else if (section === 'reps') {
      await loadRepsRoute(store, api);
    } else if (section === 'reports') {
      await loadReportsRoute(store);
    } else {
      const current = store.getState().runtime.ops.runtime;
      patchOpsState(store, {
        runtime: {
          ...current,
          loaded: true,
          loading: false,
          error: null,
          route: section,
          routeEntityId: id,
          lastHydratedAt: nowIso(),
        },
      });
      return { section, loaded: false };
    }
    finishRouteMeta(store, section, id, null);
    return { section, loaded: true };
  } catch (error) {
    failRouteMeta(store, section, id, error?.message || 'OPS_ROUTE_LOAD_FAILED');
    return { section, loaded: false, error };
  }
}

export async function runOpsCatalogAction(api, action, productId, value = null) {
  const id = normalizeId(productId);
  if (!id) throw new Error('INVALID_PRODUCT_ID');

  if (action === 'inventory-update') {
    return updateInventory(api, id, { stock_quantity: Number(value ?? 0) || 0 });
  }
  if (action === 'pricing-update') {
    return updatePricing(api, id, { unit_price: Number(value ?? 0) || 0, base_price: Number(value ?? 0) || 0 });
  }
  if (action === 'visibility-toggle') {
    return updateVisibility(api, id, { active: Boolean(value), hidden: !Boolean(value) });
  }
  if (action === 'quick-edit') {
    return updateProduct(api, id, value || {});
  }
  if (action === 'stock-action') {
    return updateInventory(api, id, value || {});
  }

  throw new Error('UNSUPPORTED_CATALOG_ACTION');
}

export async function runOpsCustomerAction(api, action, customerId, value = null) {
  const id = normalizeId(customerId);
  if (!id) throw new Error('INVALID_CUSTOMER_ID');

  if (action === 'assign-rep') {
    return assignRep(api, id, value);
  }
  if (action === 'activate-toggle') {
    return blockCustomer(api, id, !Boolean(value));
  }
  if (action === 'quick-edit') {
    return updateCustomer(api, id, value || {});
  }
  if (action === 'operational-notes') {
    return updateCustomer(api, id, { notes: normalizeId(value) });
  }

  throw new Error('UNSUPPORTED_CUSTOMER_ACTION');
}

export async function runOpsRepAction(api, action, repId, value = null) {
  const id = normalizeId(repId);
  if (!id) throw new Error('INVALID_REP_ID');

  if (action === 'assign-customers') {
    return assignCustomers(api, id, value);
  }
  if (action === 'activate-toggle') {
    return toggleRepStatus(api, id, Boolean(value));
  }
  if (action === 'operational-visibility') {
    return updateRep(api, id, value || {});
  }

  throw new Error('UNSUPPORTED_REP_ACTION');
}

export async function runOpsOrderAction(api, action, orderId, value = null) {
  const id = normalizeId(orderId);
  if (!id) throw new Error('INVALID_ORDER_ID');

  const stateMap = {
    approve: 'reviewing',
    assign: 'preparing',
    confirm: 'preparing',
    prepare: 'preparing',
    ship: 'dispatched',
    deliver: 'delivered',
    cancel: 'cancelled',
    return: 'returned',
  };

  if (action === 'note') {
    return transitionOrder(api, id, { to_state_key: value?.to_state_key || 'reviewing' }, normalizeId(value?.notes || ''));
  }

  const nextState = stateMap[action];
  if (!nextState) throw new Error('UNSUPPORTED_ORDER_ACTION');
  return transitionOrder(api, id, { to_state_key: nextState }, normalizeId(value?.notes || ''));
}
