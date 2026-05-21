import { storageKeys, saveJSON, removeValue, loadJSON } from '../core/storage.js';

export async function createCustomer(api, payload) {
  const rows = await api.post('customers', payload).catch((error) => {
    throw error;
  });

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
