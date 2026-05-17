import { firstRow, normalizeId, paginateAll, toBoolean } from './utils.js';

function normalizeCustomerRow(row) {
  const customerId = normalizeId(row?.id ?? row?.customer_id ?? '');
  return {
    id: customerId,
    customer_id: customerId,
    name: normalizeId(row?.name ?? row?.customer_name ?? ''),
    phone: normalizeId(row?.phone ?? ''),
    sales_rep_id: normalizeId(row?.sales_rep_id ?? row?.rep_id ?? ''),
    customer_type: normalizeId(row?.customer_type ?? 'direct'),
    active: toBoolean(row?.active ?? true, true),
    blocked: toBoolean(row?.blocked ?? false, false),
    notes: normalizeId(row?.notes ?? ''),
    raw: row,
  };
}

export async function getCustomers(api, params = {}) {
  const rows = await paginateAll(api, 'customers', {
    select: '*',
    order: 'created_at.desc',
    ...params,
  }, 200);
  return rows.map(normalizeCustomerRow);
}

export async function getCustomer(api, customerId) {
  const id = normalizeId(customerId);
  if (!id) return null;
  const rows = await paginateAll(api, 'customers', { select: '*', id: `eq.${id}`, limit: '1' }, 50).catch(() => []);
  return firstRow(rows.map(normalizeCustomerRow));
}

export async function createCustomer(api, payload = {}) {
  const rows = await api.post('customers', payload).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function updateCustomer(api, customerId, payload = {}) {
  const id = normalizeId(customerId);
  if (!id) throw new Error('INVALID_CUSTOMER_ID');
  const rows = await api.patch('customers', payload, { id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function assignRep(api, customerId, repId) {
  return updateCustomer(api, customerId, { sales_rep_id: normalizeId(repId) });
}

export async function blockCustomer(api, customerId, blocked = true) {
  return updateCustomer(api, customerId, { blocked: Boolean(blocked), active: !blocked });
}
