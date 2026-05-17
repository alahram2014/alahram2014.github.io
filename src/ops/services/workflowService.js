import { normalizeId, paginateAll, toBoolean } from './_utils.js';

let registry = {
  loaded: false,
  loading: false,
  error: null,
  loadedAt: null,
  states: [],
  transitions: [],
  transitionCapabilities: [],
  capabilities: [],
  stateByKey: {},
  transitionsByFromKey: {},
};

function normalizeStateRow(row) {
  const key = normalizeId(row?.state_key ?? row?.workflow_state_key ?? '');
  return {
    id: normalizeId(row?.id ?? ''),
    state_key: key,
    display_name: normalizeId(row?.display_name ?? key),
    is_initial: toBoolean(row?.is_initial ?? false, false),
    is_terminal: toBoolean(row?.is_terminal ?? false, false),
  };
}

function normalizeCapabilityRow(row) {
  return {
    id: normalizeId(row?.id ?? ''),
    capability_key: normalizeId(row?.capability_key ?? row?.key ?? ''),
    display_name: normalizeId(row?.display_name ?? ''),
    domain_key: normalizeId(row?.domain_key ?? ''),
    is_active: toBoolean(row?.is_active ?? true, true),
  };
}

function buildRegistry({ statesRows = [], transitionsRows = [], transitionCapabilityRows = [], capabilitiesRows = [] }) {
  const states = statesRows.map(normalizeStateRow).filter((row) => row.state_key);
  const stateByKey = Object.fromEntries(states.map((state) => [state.state_key, state]));
  const capabilities = capabilitiesRows.map(normalizeCapabilityRow).filter((row) => row.capability_key);
  const capabilityById = Object.fromEntries(capabilities.map((capability) => [capability.id, capability]));

  const transitions = [];
  const transitionsByFromKey = {};

  for (const row of Array.isArray(transitionsRows) ? transitionsRows : []) {
    const fromState = states.find((state) => state.id === normalizeId(row?.from_state_id ?? '')) || null;
    const toState = states.find((state) => state.id === normalizeId(row?.to_state_id ?? '')) || null;
    if (!fromState || !toState) continue;
    const transitionId = normalizeId(row?.id ?? '');
    const capabilityIds = Array.isArray(transitionCapabilityRows)
      ? transitionCapabilityRows.filter((link) => normalizeId(link?.transition_id ?? '') === transitionId).map((link) => normalizeId(link?.capability_id ?? '')).filter(Boolean)
      : [];
    const transition = {
      id: transitionId,
      from_state_id: fromState.id,
      to_state_id: toState.id,
      from_state_key: fromState.state_key,
      to_state_key: toState.state_key,
      from_state_name: fromState.display_name,
      to_state_name: toState.display_name,
      capabilities: capabilityIds.map((capabilityId) => capabilityById[capabilityId]).filter(Boolean),
    };
    transitions.push(transition);
    (transitionsByFromKey[fromState.state_key] ||= []).push(transition);
  }

  return {
    loaded: true,
    loading: false,
    error: null,
    loadedAt: new Date().toISOString(),
    states,
    transitions,
    transitionCapabilities: Array.isArray(transitionCapabilityRows) ? transitionCapabilityRows : [],
    capabilities,
    stateByKey,
    transitionsByFromKey,
  };
}

export async function loadWorkflowRuntime(api, { force = false } = {}) {
  if (registry.loaded && !force) return getWorkflowSnapshot();
  registry = { ...registry, loading: true, error: null };

  const [statesRows, transitionsRows, transitionCapabilityRows, capabilitiesRows] = await Promise.all([
    api.get('workflow_states', { select: 'id,state_key,display_name,is_initial,is_terminal', order: 'display_name.asc' }).catch(() => []),
    api.get('workflow_transitions', { select: 'id,from_state_id,to_state_id' }).catch(() => []),
    api.get('workflow_transition_capabilities', { select: 'transition_id,capability_id' }).catch(() => []),
    api.get('capabilities', { select: 'id,capability_key,display_name,domain_key,is_active', order: 'display_name.asc' }).catch(() => []),
  ]);

  registry = buildRegistry({ statesRows, transitionsRows, transitionCapabilityRows, capabilitiesRows });
  return getWorkflowSnapshot();
}

export function getWorkflowSnapshot() {
  return {
    loaded: registry.loaded,
    loading: registry.loading,
    error: registry.error,
    loadedAt: registry.loadedAt,
    states: registry.states.map((state) => ({ ...state })),
    transitions: registry.transitions.map((transition) => ({ ...transition, capabilities: transition.capabilities.map((capability) => ({ ...capability })) })),
    transitionCapabilities: registry.transitionCapabilities.map((row) => ({ ...row })),
    capabilities: registry.capabilities.map((capability) => ({ ...capability })),
    stateByKey: Object.fromEntries(Object.entries(registry.stateByKey).map(([key, value]) => [key, { ...value }])),
    transitionsByFromKey: Object.fromEntries(Object.entries(registry.transitionsByFromKey).map(([key, value]) => [key, value.map((transition) => ({ ...transition, capabilities: transition.capabilities.map((capability) => ({ ...capability })) }))])),
  };
}

export function getAllowedTransitions(stateKey) {
  const key = normalizeId(stateKey || 'pending') || 'pending';
  return (registry.transitionsByFromKey[key] || []).map((transition) => ({
    ...transition,
    capabilities: transition.capabilities.map((capability) => ({ ...capability })),
  }));
}
