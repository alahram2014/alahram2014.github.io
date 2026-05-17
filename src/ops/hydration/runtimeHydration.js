import { getProducts, getProduct } from '../services/catalogService.js';
import { getCustomers, getCustomer } from '../services/customerService.js';
import { getReps, getRep } from '../services/salesRepService.js';
import { getCompanies, getCompany } from '../services/companyService.js';
import { loadWorkflowRuntime } from '../services/workflowService.js';

let inflight = null;

function patchOps(store, partial) {
  store.patch({ ops: partial });
}

export async function hydrateOpsRuntime(store, api, route = { name: 'ops', params: {} }) {
  if (inflight) return inflight;

  inflight = (async () => {
    patchOps(store, { runtime: { ...(store.getState().ops?.runtime || {}), loading: true, error: null, route: route.params?.section || 'dashboard', routeEntityId: route.params?.id || null } });

    const [products, customers, reps, companies, workflow] = await Promise.all([
      getProducts(api).catch(() => []),
      getCustomers(api).catch(() => []),
      getReps(api).catch(() => []),
      getCompanies(api).catch(() => []),
      loadWorkflowRuntime(api, { force: true }).catch(() => ({ loaded: false, states: [], transitions: [], transitionCapabilities: [], capabilities: [], stateByKey: {}, transitionsByFromKey: {} })),
    ]);

    const section = String(route.params?.section || 'dashboard').trim();
    const id = String(route.params?.id || '').trim();
    const next = {
      runtime: { loaded: true, loading: false, error: null, route: section, routeEntityId: id, lastHydratedAt: new Date().toISOString() },
      catalog: { loaded: true, loading: false, error: null, loadedAt: new Date().toISOString(), products, product: id && section === 'catalog' ? await getProduct(api, id).catch(() => null) : null },
      customers: { loaded: true, loading: false, error: null, loadedAt: new Date().toISOString(), customers, customer: id && section === 'customers' ? await getCustomer(api, id).catch(() => null) : null },
      reps: { loaded: true, loading: false, error: null, loadedAt: new Date().toISOString(), reps, rep: id && section === 'reps' ? await getRep(api, id).catch(() => null) : null },
      companies: { loaded: true, loading: false, error: null, loadedAt: new Date().toISOString(), companies, company: id && section === 'companies' ? await getCompany(api, id).catch(() => null) : null },
      workflows: workflow,
    };

    patchOps(store, next);
    return next;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
