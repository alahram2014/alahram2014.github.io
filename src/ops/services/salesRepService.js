import { firstRow, normalizeId, paginateAll, toBoolean } from './_utils.js';

function normalizeRepRow(row) {
  const repId = normalizeId(row?.id ?? row?.rep_id ?? row?.sales_rep_id ?? '');
  return {
    id: repId,
    rep_id: repId,
    name: normalizeId(row?.name ?? row?.rep_name ?? ''),
    phone: normalizeId(row?.phone ?? ''),
    active: toBoolean(row?.active ?? true, true),
    blocked: toBoolean(row?.blocked ?? false, false),
    territory: normalizeId(row?.territory ?? ''),
    notes: normalizeId(row?.notes ?? ''),
    raw: row,
  };
}

export async function getReps(api, params = {}) {
  const rows = await paginateAll(api, 'sales_reps', {
    select: '*',
    order: 'created_at.desc',
    ...params,
  }, 200);
  return rows.map(normalizeRepRow);
}

export async function getRep(api, repId) {
  const id = normalizeId(repId);
  if (!id) return null;
  const rows = await paginateAll(api, 'sales_reps', { select: '*', id: `eq.${id}`, limit: '1' }, 50).catch(() => []);
  return firstRow(rows.map(normalizeRepRow));
}

export async function updateRep(api, repId, payload = {}) {
  const id = normalizeId(repId);
  if (!id) throw new Error('INVALID_REP_ID');
  const rows = await api.patch('sales_reps', payload, { id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function assignCustomers(api, repId, customerIds = []) {
  const id = normalizeId(repId);
  if (!id) throw new Error('INVALID_REP_ID');
  const rows = Array.isArray(customerIds) ? customerIds : [customerIds];
  return api.patch('customers', { sales_rep_id: id }, { id: `in.(${rows.map((value) => normalizeId(value)).filter(Boolean).join(',')})` }).catch((error) => { throw error; });
}

export async function toggleRepStatus(api, repId, active = true) {
  return updateRep(api, repId, { active: Boolean(active), blocked: !active });
}
