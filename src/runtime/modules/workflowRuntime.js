import {
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
} from '../../services/workflowService.js';

export async function hydrateWorkflowRuntimeSnapshot(api, options = {}) {
  return loadWorkflowRuntime(api, options);
}

export function createWorkflowRuntimeFacade() {
  return {
    hydrateWorkflowRuntimeSnapshot,
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
