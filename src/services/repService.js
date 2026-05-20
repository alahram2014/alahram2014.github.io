import { getOwnershipActorId } from './authService.js';

function normalizeId(value) { return String(value || '').trim(); }

function buildOwnershipFilter(ownerId) {
  const id = normalizeId(ownerId);
  if (!id) return {};
  return { or: `(sales_rep_id.eq.${id},created_by_rep_id.eq.${id},rep_id.eq.${id})` };
}

export async function loadRepCustomers(api, session) {
  const ownerId = getOwnershipActorId(session) || session?.id;
  if (!ownerId) return [];
  const filter = buildOwnershipFilter(ownerId);
  return await api.get('customers', {
    select: '*', ...filter, order: 'created_at.desc',
  }).catch(() => []);
}

export async function loadRepOrders(api, session) {
  const ownerId = getOwnershipActorId(session) || session?.id;
  if (!ownerId) return [];
  const customers = await loadRepCustomers(api, session);
  const customerIds = Array.from(new Set((customers || []).map((c) => normalizeId(c.id)).filter(Boolean)));
  const filter = buildOwnershipFilter(ownerId);
  const filters = [`sales_rep_id.eq.${ownerId}`, `rep_id.eq.${ownerId}`];
  if (customerIds.length) filters.push(`customer_id.in.(${customerIds.join(',')})`);
  const rows = await api.get('orders', {
    select: '*', or: `(${filters.join(',')})`, order: 'created_at.desc',
  }).catch(() => []);
  const customerMap = new Map((customers || []).map((c) => [normalizeId(c.id), c.name || c.phone || '']));
  return Array.isArray(rows) ? rows.map((r) => ({ ...r, customer_name: customerMap.get(normalizeId(r.customer_id)) || r.customer_name || '' })) : [];
}

export async function loadRepInvoices(store, api, session) {
  return await loadRepOrders(api, session);
}

export async function createRepCustomer(api, payload, session) {
  const ownerId = getOwnershipActorId(session) || session?.id;
  const enriched = {
    ...payload,
    sales_rep_id: normalizeId(ownerId) || null,
    created_by_rep_id: normalizeId(ownerId) || null,
    owner_user_id: normalizeId(ownerId) || null,
  };
  const rows = await api.post('customers', enriched).catch((e) => { throw e; });
  return Array.isArray(rows) ? rows[0] : rows;
}

export function getOwnershipLabel(customer) {
  if (!customer) return '';
  const repId = customer.sales_rep_id || customer.created_by_rep_id || customer.owner_user_id;
  const repName = customer.sales_rep_name || customer.rep_name || '';
  return repId ? (repName ? `(مندوب: ${repName})` : '(مندوب)') : '(عميل مباشر)';
}
