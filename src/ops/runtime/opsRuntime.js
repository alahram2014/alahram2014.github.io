import { ensureOpsRouteHydrated } from './routeHydration.js';
import { shouldBlockCheckout } from '../guards/checkoutGuard.js';

export function createOpsRuntime() {
  return {
    hydrate: ensureOpsRouteHydrated,
    shouldBlockCheckout,
  };
}
