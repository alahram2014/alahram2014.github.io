import { getOwnershipActorId, isSalesRepSession, hasOperationalAccess, normalizeSessionRecord } from './authService.js';

function normalizeId(value) {
  return String(value ?? '').trim();
}

function isGlobalAuthority(session) {
  return hasOperationalAccess(session) && !isSalesRepSession(session);
}

function canBypassOwnership(session) {
  if (!session) return false;
  const caps = Array.isArray(session.capabilities) ? session.capabilities : [];
  return caps.some((c) => {
    const key = String(c).trim();
    return key === 'dashboard.admin' || key === 'system.manage_users';
  }) || isGlobalAuthority(session);
}

/**
 * Build a server-side ownership filter for API queries.
 * Returns an object suitable for spread into api.get() params.
 * For admins: returns empty (no filter — sees all).
 * For reps: returns or filter with ownership field chain.
 * For customers: returns customer_id filter.
 */
export function buildOwnershipFilter(session, options = {}) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return {};
  if (canBypassOwnership(normalized)) return {};
  if (isSalesRepSession(normalized)) {
    const ownerId = getOwnershipActorId(normalized) || normalized.id;
    if (!ownerId) return {};
    const table = options.table || '';
    if (table === 'customers') {
      return { or: `(owner_id.eq.${ownerId},sales_rep_id.eq.${ownerId},created_by_rep_id.eq.${ownerId},owner_user_id.eq.${ownerId})` };
    }
    return { or: `(owner_id.eq.${ownerId},sales_rep_id.eq.${ownerId},rep_id.eq.${ownerId})` };
  }
  const customerId = normalized.id;
  if (customerId) {
    return { customer_id: `eq.${customerId}` };
  }
  return {};
}

/**
 * Check if a session is authorized to view a specific customer record.
 */
export function canViewCustomer(session, customer) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized || !customer) return false;
  if (canBypassOwnership(normalized)) return true;
  if (isSalesRepSession(normalized)) {
    const ownerId = getOwnershipActorId(normalized) || normalized.id;
    if (!ownerId) return false;
    const fields = ['owner_id', 'sales_rep_id', 'created_by_rep_id', 'owner_user_id'];
    return fields.some((f) => normalizeId(customer[f]) === ownerId);
  }
  return normalizeId(customer.id) === normalizeId(normalized.id)
    || normalizeId(customer.customer_id) === normalizeId(normalized.id);
}

/**
 * Check if a session is authorized to view a specific invoice/order record.
 */
export function canViewInvoice(session, invoice) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized || !invoice) return false;
  if (canBypassOwnership(normalized)) return true;
  if (isSalesRepSession(normalized)) {
    const ownerId = getOwnershipActorId(normalized) || normalized.id;
    if (!ownerId) return false;
    const fields = ['owner_id', 'sales_rep_id', 'rep_id', 'user_id'];
    return fields.some((f) => normalizeId(invoice[f]) === ownerId);
  }
  return normalizeId(invoice.customer_id) === normalizeId(normalized.id);
}

/**
 * Load authorized customers for the given session.
 * Admin: all customers.
 * Rep: owned customers via server-side filter.
 * Customer: own record only.
 */
export async function loadAuthorizedCustomers(api, session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return [];
  const filter = buildOwnershipFilter(normalized, { table: 'customers' });
  const params = { select: '*', order: 'created_at.desc' };
  if (Object.keys(filter).length) Object.assign(params, filter);
  const rows = await api.get('customers', params).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Load authorized invoices/orders for the given session.
 * Admin: all orders (limit 100).
 * Rep: owned orders via server-side filter.
 * Customer: own orders via customer_id.
 */
export async function loadAuthorizedInvoices(api, session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return [];
  const filter = buildOwnershipFilter(normalized);
  const params = { select: '*', order: 'created_at.desc', limit: '100' };
  if (Object.keys(filter).length) Object.assign(params, filter);
  const rows = await api.get('orders', params).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Load authorized customers for manager scope (with customer ID set extraction).
 */
export async function loadAuthorizedManagerCustomers(api, session) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return { customers: [], customerIds: [] };
  if (canBypassOwnership(normalized)) {
    const rows = await api.get('customers', {
      select: '*', order: 'created_at.desc', limit: '100',
    }).catch(() => []);
    const list = Array.isArray(rows) ? rows : [];
    return {
      customers: list,
      customerIds: Array.from(new Set(list.map((c) => normalizeId(c.id)).filter(Boolean))),
    };
  }
  if (isSalesRepSession(normalized)) {
    const customers = await loadAuthorizedCustomers(api, normalized);
    return {
      customers,
      customerIds: Array.from(new Set(customers.map((c) => normalizeId(c.id)).filter(Boolean))),
    };
  }
  return { customers: [], customerIds: [] };
}

/**
 * Load authorized manager orders with ownership enforcement.
 */
export async function loadAuthorizedManagerOrders(api, session, customerIds = []) {
  const normalized = normalizeSessionRecord(session);
  if (!normalized) return [];
  if (canBypassOwnership(normalized)) {
    const rows = await api.get('orders', {
      select: '*', order: 'created_at.desc', limit: '100',
    }).catch(() => []);
    return Array.isArray(rows) ? rows : [];
  }
  if (isSalesRepSession(normalized)) {
    const ownerId = getOwnershipActorId(normalized) || normalized.id;
    if (!ownerId) return [];
    const filters = [`owner_id.eq.${ownerId}`, `sales_rep_id.eq.${ownerId}`, `rep_id.eq.${ownerId}`];
    const validIds = Array.from(new Set((Array.isArray(customerIds) ? customerIds : []).map((id) => normalizeId(id)).filter(Boolean)));
    if (validIds.length) filters.push(`customer_id.in.(${validIds.join(',')})`);
    const rows = await api.get('orders', {
      select: '*', or: `(${filters.join(',')})`, order: 'created_at.desc',
    }).catch(() => []);
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}
