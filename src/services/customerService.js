import { storageKeys, saveJSON, removeValue, loadJSON } from '../core/storage.js';
import { getOwnershipActorId } from './authService.js';

function matchesCustomerOwner(row, ownerId) {
  const target = String(ownerId || '').trim();
  if (!target) return true;
  const candidates = [
    row?.sales_rep_id,
    row?.created_by,
    row?.created_by_rep_id,
    row?.owner_user_id,
  ].map((value) => String(value || '').trim());
  return candidates.some((value) => value && value === target);
}

export async function loadRepCustomers(api, repId) {
  const ownerId = String(getOwnershipActorId({ sales_rep_id: repId, id: repId }) || repId || '').trim();
  if (!ownerId) return [];
  const rows = await api.get('customers', {
    select: '*',
    order: 'created_at.desc',
    limit: '100',
  }).catch(() => []);
  return Array.isArray(rows) ? rows.filter((row) => matchesCustomerOwner(row, ownerId)) : [];
}

export async function createCustomer(api, payload) {
  const rows = await api.post('customers', payload).catch((error) => { throw error; });
  return Array.isArray(rows) ? rows[0] : rows;
}

export function persistSelectedCustomer(customer) {
  if (!customer) {
    removeValue(storageKeys.selectedCustomer);
    return;
  }
  saveJSON(storageKeys.selectedCustomer, customer);
}

export function loadSelectedCustomer() {
  return loadJSON(storageKeys.selectedCustomer, null);
}


function cleanPatchPayload(payload = {}) {
  return Object.fromEntries(Object.entries(payload || {}).filter(([, value]) => value !== undefined));
}

export async function updateCustomer(api, customerId, payload = {}) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('INVALID_CUSTOMER_ID');
  const rows = await api.patch('customers', cleanPatchPayload(payload), { id: `eq.${id}` });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function toggleCustomerActive(api, customerId, isActive) {
  return updateCustomer(api, customerId, { is_active: Boolean(isActive) });
}

export async function assignCustomerRep(api, customerId, salesRepId) {
  return updateCustomer(api, customerId, { sales_rep_id: String(salesRepId || '').trim() || null });
}
