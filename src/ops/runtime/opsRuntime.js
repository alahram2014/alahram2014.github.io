import { hydrateOpsRuntime } from '../hydration/runtimeHydration.js';
import { shouldBlockCheckout } from '../guards/checkoutGuard.js';

export function createOpsRuntime() {
  return {
    hydrate: hydrateOpsRuntime,
    shouldBlockCheckout,
  };
}
