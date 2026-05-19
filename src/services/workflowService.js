// ============================================================
// Backend-driven workflow runtime
// All transition logic sourced from Supabase views:
//   v_workflow_resolved
//   v_workflow_states_snapshot
// Mutation via: workflow_execute_transition() RPC
// ============================================================

// ---------------------------------------------------------------------------
// LEGACY FALLBACK — active only before backend registry loads
// Remove after all legacy data is migrated and backend views are stable
// ---------------------------------------------------------------------------
const FALLBACK = {
  stateKeys: [
    'pending', 'reviewing', 'preparing', 'dispatched',
    'delivered', 'collected', 'returned', 'cancelled',
  ],
  stateLabels: {
    pending: 'طلب جديد',
    reviewing: 'تحت المراجعة',
    preparing: 'جاري التحضير',
    dispatched: 'خرج للشحن',
    delivered: 'تم التسليم',
    collected: 'تم التحصيل',
    returned: 'مرتجع',
    cancelled: 'ملغي',
  },
  legacyArabic: {
    'قيد التنفيذ': 'pending',
    'جاري التجهيز': 'preparing',
    'تم الشحن': 'dispatched',
    'تم التوصيل': 'delivered',
    'ملغي': 'cancelled',
    'تم التحصيل': 'collected',
    'مرتجع': 'returned',
  },
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizeWorkflowStateKey(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (registry.stateByKey[lower]) return lower;

  for (const [key, state] of Object.entries(registry.stateByKey)) {
    if (state.display_name && normalizeText(state.display_name) === raw) return key;
  }

  if (FALLBACK.stateKeys.includes(lower)) return lower;
  if (FALLBACK.legacyArabic[raw]) return FALLBACK.legacyArabic[raw];
  if (FALLBACK.legacyArabic[lower]) return FALLBACK.legacyArabic[lower];

  return null;
}

function createEmptyWorkflowRegistry() {
  return {
    loaded: false,
    loading: false,
    error: null,
    loadedAt: null,
    states: [],
    stateByKey: {},
    stateById: {},
    transitions: [],
    transitionsByFromKey: {},
    transitionCapabilities: [],
    capabilities: [],
    capabilityById: {},
    capabilityByKey: {},
  };
}

let registry = createEmptyWorkflowRegistry();

// ---- Internal helpers -----------------------------------------------------

function buildStateMap(rows) {
  const states = rows.map((row) => {
    const stateKey = normalizeWorkflowStateKey(row.state_key) || normalizeText(row.state_key);
    return {
      ...row,
      state_key: stateKey,
      display_name: row.display_name || FALLBACK.stateLabels[stateKey] || stateKey,
      is_initial: Boolean(row.is_initial),
      is_terminal: Boolean(row.is_terminal),
    };
  }).filter((row) => row.state_key);

  const stateById = {};
  const stateByKey = {};
  for (const state of states) {
    if (state.id) stateById[state.id] = state;
    stateByKey[state.state_key] = state;
  }

  return { states, stateByKey, stateById };
}

function buildTransitionMap(rows, stateByKey) {
  const transitions = [];
  const transitionsByFromKey = {};
  for (const row of rows) {
    const fromState = stateByKey[row.from_state_key];
    const toState = stateByKey[row.to_state_key];
    if (!fromState || !toState) continue;

    const caps = Array.isArray(row.required_capabilities) ? row.required_capabilities : [];
    const capabilityKeys = caps.map((c) => c.capability_key).filter(Boolean);
    const capabilityIds = caps.map((c) => c.capability_id).filter(Boolean);

    const transition = {
      id: row.transition_id,
      from_state_key: fromState.state_key,
      from_state_label: fromState.display_name,
      to_state_key: toState.state_key,
      to_state_label: toState.display_name,
      capability_ids: capabilityIds,
      capability_keys: capabilityKeys,
      capabilities: caps,
    };

    transitions.push(transition);
    const bucket = transitionsByFromKey[fromState.state_key] || [];
    bucket.push(transition);
    transitionsByFromKey[fromState.state_key] = bucket;
  }

  return { transitions, transitionsByFromKey };
}

function buildRegistryFromTables({ statesRows, transitionsRows, transitionCapabilityRows, capabilitiesRows }) {
  const { states, stateByKey, stateById } = buildStateMap(
    Array.isArray(statesRows) ? statesRows : []
  );

  const capabilities = Array.isArray(capabilitiesRows) ? capabilitiesRows.map((row) => ({
    ...row,
    capability_key: normalizeText(row.capability_key),
    display_name: row.display_name || normalizeText(row.capability_key),
    domain_key: normalizeText(row.domain_key),
  })).filter((row) => row.capability_key) : [];

  const capabilityById = {};
  const capabilityByKey = {};
  for (const capability of capabilities) {
    if (capability.id) capabilityById[capability.id] = capability;
    capabilityByKey[capability.capability_key] = capability;
  }

  const transitionCapabilityMap = new Map();
  for (const row of Array.isArray(transitionCapabilityRows) ? transitionCapabilityRows : []) {
    const transitionId = normalizeText(row.transition_id);
    const capabilityId = normalizeText(row.capability_id);
    if (!transitionId || !capabilityId) continue;
    const list = transitionCapabilityMap.get(transitionId) || [];
    list.push(capabilityId);
    transitionCapabilityMap.set(transitionId, list);
  }

  const transitions = [];
  const transitionsByFromKey = {};
  for (const row of Array.isArray(transitionsRows) ? transitionsRows : []) {
    const fromState = row.from_state_id ? stateById[row.from_state_id] : null;
    const toState = row.to_state_id ? stateById[row.to_state_id] : null;
    if (!fromState || !toState) continue;

    const capabilityIds = transitionCapabilityMap.get(normalizeText(row.id)) || [];
    const capabilityKeys = capabilityIds
      .map((capabilityId) => capabilityById[capabilityId]?.capability_key || null)
      .filter(Boolean);

    const transition = {
      id: row.id,
      from_state_id: row.from_state_id,
      to_state_id: row.to_state_id,
      from_state_key: fromState.state_key,
      from_state_label: fromState.display_name,
      to_state_key: toState.state_key,
      to_state_label: toState.display_name,
      capability_ids: capabilityIds,
      capability_keys: capabilityKeys,
      capabilities: capabilityIds.map((capabilityId) => capabilityById[capabilityId]).filter(Boolean),
    };

    transitions.push(transition);
    const bucket = transitionsByFromKey[fromState.state_key] || [];
    bucket.push(transition);
    transitionsByFromKey[fromState.state_key] = bucket;
  }

  return {
    loaded: true,
    loading: false,
    error: null,
    loadedAt: new Date().toISOString(),
    states,
    stateByKey,
    stateById,
    transitions,
    transitionsByFromKey,
    transitionCapabilities: Array.isArray(transitionCapabilityRows) ? transitionCapabilityRows : [],
    capabilities,
    capabilityById,
    capabilityByKey,
  };
}

// ---- Public state loading -------------------------------------------------

export async function loadWorkflowStates(api) {
  const rows = await api.get('v_workflow_states_snapshot', {
    select: 'id,state_key,display_name,is_initial,is_terminal,sort_order',
    order: 'sort_order.asc',
  }).catch(() => null);

  if (Array.isArray(rows)) {
    const stateMap = buildStateMap(rows);
    registry.states = stateMap.states;
    registry.stateByKey = stateMap.stateByKey;
    registry.stateById = stateMap.stateById;
    return {
      states: stateMap.states.map((s) => ({ ...s })),
      stateByKey: { ...stateMap.stateByKey },
      stateById: { ...stateMap.stateById },
    };
  }

  const fallback = await api.get('workflow_states', {
    select: 'id,state_key,display_name,is_initial,is_terminal',
    order: 'display_name.asc',
  }).catch(() => []);

  const stateMap = buildStateMap(fallback);
  registry.states = stateMap.states;
  registry.stateByKey = stateMap.stateByKey;
  registry.stateById = stateMap.stateById;

  return {
    states: stateMap.states.map((s) => ({ ...s })),
    stateByKey: { ...stateMap.stateByKey },
    stateById: { ...stateMap.stateById },
  };
}

// ---- Public transition loading --------------------------------------------

export async function loadWorkflowTransitions(api) {
  if (!registry.stateByKey || !Object.keys(registry.stateByKey).length) {
    const stateData = await loadWorkflowStates(api);
    if (!stateData || !stateData.states.length) {
      return { transitions: [], transitionsByFromKey: {} };
    }
  }

  const rows = await api.get('v_workflow_resolved', {
    select: 'transition_id,from_state_key,to_state_key,required_capabilities,required_capability_count',
  }).catch(() => null);

  if (Array.isArray(rows)) {
    const transitionMap = buildTransitionMap(rows, registry.stateByKey);
    registry.transitions = transitionMap.transitions;
    registry.transitionsByFromKey = transitionMap.transitionsByFromKey;
    return {
      transitions: transitionMap.transitions.map((t) => ({ ...t })),
      transitionsByFromKey: Object.fromEntries(
        Object.entries(transitionMap.transitionsByFromKey).map(([k, v]) => [k, v.map((t) => ({ ...t }))])
      ),
    };
  }

  const [transitionsRows, transitionCapabilityRows, capabilitiesRows] = await Promise.all([
    api.get('workflow_transitions', {
      select: 'id,from_state_id,to_state_id',
    }).catch(() => []),
    api.get('workflow_transition_capabilities', {
      select: 'transition_id,capability_id',
    }).catch(() => []),
    api.get('capabilities', {
      select: 'id,capability_key,display_name,domain_key,is_active',
      order: 'display_name.asc',
    }).catch(() => []),
  ]);

  const fullRegistry = buildRegistryFromTables({
    statesRows: registry.states,
    transitionsRows,
    transitionCapabilityRows,
    capabilitiesRows,
  });

  registry.transitions = fullRegistry.transitions;
  registry.transitionsByFromKey = fullRegistry.transitionsByFromKey;
  registry.transitionCapabilities = fullRegistry.transitionCapabilities;
  registry.capabilities = fullRegistry.capabilities;
  registry.capabilityById = fullRegistry.capabilityById;
  registry.capabilityByKey = fullRegistry.capabilityByKey;

  return {
    transitions: fullRegistry.transitions.map((t) => ({ ...t })),
    transitionsByFromKey: Object.fromEntries(
      Object.entries(fullRegistry.transitionsByFromKey).map(([k, v]) => [k, v.map((t) => ({ ...t }))])
    ),
  };
}

// ---- Runtime loader -------------------------------------------------------

export async function loadWorkflowRuntime(api, { force = false } = {}) {
  if (registry.loaded && !force) {
    return getWorkflowSnapshot();
  }

  registry = {
    ...registry,
    loading: true,
    error: null,
  };

  const stateData = await loadWorkflowStates(api);
  if (stateData && stateData.states.length) {
    const transitionData = await loadWorkflowTransitions(api);
    const hasTransitions = transitionData && transitionData.transitions.length > 0;
    registry.loaded = true;
    registry.loading = false;
    registry.loadedAt = new Date().toISOString();
    if (!hasTransitions) {
      registry.transitions = [];
      registry.transitionsByFromKey = {};
    }
    return getWorkflowSnapshot();
  }

  // Legacy individual-table fallback
  const [statesRows, transitionsRows, transitionCapabilityRows, capabilitiesRows] = await Promise.all([
    api.get('workflow_states', {
      select: 'id,state_key,display_name,is_initial,is_terminal',
      order: 'display_name.asc',
    }).catch(() => []),
    api.get('workflow_transitions', {
      select: 'id,from_state_id,to_state_id',
    }).catch(() => []),
    api.get('workflow_transition_capabilities', {
      select: 'transition_id,capability_id',
    }).catch(() => []),
    api.get('capabilities', {
      select: 'id,capability_key,display_name,domain_key,is_active',
      order: 'display_name.asc',
    }).catch(() => []),
  ]);

  registry = buildRegistryFromTables({
    statesRows,
    transitionsRows,
    transitionCapabilityRows,
    capabilitiesRows,
  });

  return getWorkflowSnapshot();
}

export function getWorkflowSnapshot() {
  return {
    loaded: registry.loaded,
    loading: registry.loading,
    error: registry.error,
    loadedAt: registry.loadedAt,
    states: registry.states.map((state) => ({ ...state })),
    transitions: registry.transitions.map((transition) => ({
      ...transition,
      capabilities: transition.capabilities.map((capability) => ({ ...capability })),
    })),
    transitionCapabilities: registry.transitionCapabilities.map((row) => ({ ...row })),
    capabilities: registry.capabilities.map((capability) => ({ ...capability })),
    stateByKey: Object.fromEntries(Object.entries(registry.stateByKey).map(([key, value]) => [key, { ...value }])),
    transitionsByFromKey: Object.fromEntries(Object.entries(registry.transitionsByFromKey).map(([key, value]) => [key, value.map((transition) => ({
      ...transition,
      capabilities: transition.capabilities.map((capability) => ({ ...capability })),
    }))])),
  };
}

export function getWorkflowStateLabel(stateKey) {
  const normalized = normalizeWorkflowStateKey(stateKey);
  if (!normalized) {
    return normalizeText(stateKey);
  }
  return registry.stateByKey[normalized]?.display_name || FALLBACK.stateLabels[normalized] || normalized;
}

export function getAllowedTransitions(stateKey) {
  const normalized = normalizeWorkflowStateKey(stateKey) || normalizeText(stateKey);
  const transitions = registry.transitionsByFromKey[normalized] || [];
  return transitions.map((transition) => ({
    ...transition,
    capabilities: transition.capabilities.map((capability) => ({ ...capability })),
  }));
}

// ---- New: getAvailableTransitions -----------------------------------------

export function getAvailableTransitions(currentStateKey) {
  return getAllowedTransitions(currentStateKey);
}

// ---- Capability resolution -------------------------------------------------

export function normalizeCapabilityList(userCapabilities = []) {
  const list = Array.isArray(userCapabilities)
    ? userCapabilities
    : typeof userCapabilities === 'string'
      ? userCapabilities.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

  return Array.from(new Set(list.map((value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') return normalizeText(value.capability_key || value.key || value.name);
    return '';
  }).filter(Boolean)));
}

export function canUserExecuteTransition(transition, session = {}) {
  if (!transition) return false;
  const userCaps = normalizeCapabilityList(session?.capabilities || session?.system_user?.capabilities || []);
  const requiredCaps = Array.isArray(transition.capability_keys) ? transition.capability_keys : [];
  if (!requiredCaps.length) return true;
  return requiredCaps.some((key) => userCaps.includes(key));
}

export function resolveWorkflowActions(order, session = {}) {
  const currentStateKey = normalizeWorkflowStateKey(order?.workflow_state_key || order?.workflow_status || order?.status) || 'pending';
  const allowedTransitions = getAllowedTransitions(currentStateKey);
  const sessionCaps = normalizeCapabilityList(session?.capabilities || session?.system_user?.capabilities || []);
  const sessionWithCaps = { ...session, capabilities: sessionCaps };

  const mappedTransitions = allowedTransitions.map((transition) => ({
    ...transition,
    canExecute: canUserExecuteTransition(transition, sessionWithCaps),
  }));

  return {
    currentStateKey,
    currentStateLabel: getWorkflowStateLabel(currentStateKey),
    isTerminal: Boolean(registry.stateByKey[currentStateKey]?.is_terminal),
    isInitial: Boolean(registry.stateByKey[currentStateKey]?.is_initial),
    allowedTransitions: mappedTransitions,
    executableTransitions: mappedTransitions.filter((t) => t.canExecute),
    executableTransitionKeys: mappedTransitions.filter((t) => t.canExecute).map((transition) => transition.to_state_key),
    capabilities: sessionCaps,
  };
}

// ---- Transition mutation ---------------------------------------------------

export async function applyWorkflowTransition(api, orderId, nextStateKey, { legacyWorkflowStatus = null } = {}) {
  const normalized = normalizeWorkflowStateKey(nextStateKey);
  if (!normalized) {
    throw new Error('INVALID_WORKFLOW_STATE');
  }

  try {
    const result = await api.post('rpc/workflow_execute_transition', {
      p_order_id: orderId,
      p_to_state_key: normalized,
      p_note: null,
    });
    if (result && (result.success || result.id || result.order_id)) return result;
  } catch (_rpcError) {
    // RPC not available — fall through to direct PATCH
  }

  const payload = {
    workflow_state_key: normalized,
  };

  if (legacyWorkflowStatus) {
    payload.workflow_status = legacyWorkflowStatus;
  }

  const rows = await api.patch('orders', payload, {
    id: `eq.${String(orderId || '').trim()}`,
  });

  return Array.isArray(rows) && rows.length ? rows[0] : rows;
}

// ---- Facade ----------------------------------------------------------------

export function createWorkflowRuntimeFacade() {
  return {
    loadWorkflowRuntime,
    loadWorkflowStates,
    loadWorkflowTransitions,
    getWorkflowSnapshot,
    getWorkflowStateLabel,
    getAllowedTransitions,
    getAvailableTransitions,
    normalizeWorkflowStateKey,
    normalizeCapabilityList,
    canUserExecuteTransition,
    resolveWorkflowActions,
    applyWorkflowTransition,
  };
}
