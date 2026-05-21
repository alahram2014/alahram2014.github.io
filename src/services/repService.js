import { getOwnershipActorId } from './authService.js';
import { loadAuthorizedCustomers, loadAuthorizedInvoices } from './ownershipService.js';

function normalizeId(value) { return String(value || '').trim(); }

export async function loadRepCustomers(api, session) {
  return loadAuthorizedCustomers(api, session);
}

export async function loadRepOrders(api, session) {
  const customers = await loadRepCustomers(api, session);
  const customerMap = new Map((customers || []).map((c) => [normalizeId(c.id), c.name || c.phone || '']));
  const rows = await loadAuthorizedInvoices(api, session);
  return Array.isArray(rows) ? rows.map((r) => ({
    ...r,
    customer_name: customerMap.get(normalizeId(r.customer_id)) || r.customer_name || '',
  })) : [];
}

export async function loadRepInvoices(store, api, session) {
  return await loadRepOrders(api, session);
}

export async function createRepCustomer(api, payload, session) {
  const ownerId = getOwnershipActorId(session) || session?.id;
  const normalizedOwnerId = normalizeId(ownerId) || null;
  const enriched = {
    ...payload,
    sales_rep_id: normalizedOwnerId,
    created_by_rep_id: normalizedOwnerId,
    owner_user_id: normalizedOwnerId,
    owner_id: normalizedOwnerId,
  };
  const rows = await api.post('customers', enriched).catch((e) => { throw e; });
  return Array.isArray(rows) ? rows[0] : rows;
}

export function getOwnershipLabel(customer) {
  if (!customer) return '';
  const repId = customer.owner_id || customer.sales_rep_id || customer.created_by_rep_id || customer.owner_user_id;
  const repName = customer.sales_rep_name || customer.rep_name || '';
  return repId ? (repName ? `(مندوب: ${repName})` : '(مندوب)') : '(عميل مباشر)';
}
