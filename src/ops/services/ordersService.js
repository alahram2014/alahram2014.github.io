import { firstRow, normalizeId, paginateAll, toNumber, toBoolean } from './_utils.js';
import { getWorkflowSnapshot, getAllowedTransitions } from './workflowService.js';

function normalizeOrderRow(row) {
  const orderId = normalizeId(row?.id ?? row?.order_id ?? '');
  return {
    id: orderId,
    order_id: orderId,
    order_number: normalizeId(row?.order_number ?? row?.invoice_number ?? ''),
    customer_id: normalizeId(row?.customer_id ?? ''),
    sales_rep_id: normalizeId(row?.sales_rep_id ?? row?.rep_id ?? ''),
    status: normalizeId(row?.status ?? row?.workflow_state_key ?? 'pending'),
    workflow_state_key: normalizeId(row?.workflow_state_key ?? row?.status ?? 'pending'),
    total_amount: toNumber(row?.total_amount ?? row?.grand_total ?? 0),
    notes: normalizeId(row?.notes ?? ''),
    transition_history: Array.isArray(row?.transition_history) ? row.transition_history : [],
    raw: row,
  };
}

export async function getOrders(api, params = {}) {
  const rows = await paginateAll(api, 'orders', {
    select: '*',
    order: 'created_at.desc',
    ...params,
  }, 200);
  return rows.map(normalizeOrderRow);
}

export async function getOrder(api, orderId) {
  const id = normalizeId(orderId);
  if (!id) return null;
  const rows = await paginateAll(api, 'orders', { select: '*', id: `eq.${id}`, limit: '1' }, 50).catch(() => []);
  return firstRow(rows.map(normalizeOrderRow));
}

export async function transitionOrder(api, orderId, transition, notes = '') {
  const id = normalizeId(orderId);
  if (!id) throw new Error('INVALID_ORDER_ID');
  const nextState = normalizeId(transition?.to_state_key || transition?.to_state || transition?.state_key || transition?.next_state_key || transition);
  if (!nextState) throw new Error('INVALID_TRANSITION');
  const historyEntry = {
    order_id: id,
    transition_key: normalizeId(transition?.id || transition?.transition_id || ''),
    from_state_key: normalizeId(transition?.from_state_key || ''),
    to_state_key: nextState,
    notes: normalizeId(notes),
  };
  const [orderRows] = await Promise.all([
    api.patch('orders', { status: nextState, workflow_state_key: nextState }, { id: `eq.${id}` }),
    api.post('order_transitions', historyEntry).catch(() => null),
  ]).catch((error) => { throw error; });
  return firstRow(Array.isArray(orderRows) ? orderRows.map(normalizeOrderRow) : [normalizeOrderRow(orderRows)]);
}

export async function assignOrder(api, orderId, payload = {}) {
  const id = normalizeId(orderId);
  if (!id) throw new Error('INVALID_ORDER_ID');
  const rows = await api.patch('orders', payload, { id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export async function addOperationalNote(api, orderId, note = '') {
  const id = normalizeId(orderId);
  if (!id) throw new Error('INVALID_ORDER_ID');
  const nextNote = normalizeId(note);
  const rows = await api.patch('orders', { notes: nextNote }, { id: `eq.${id}` }).catch((error) => { throw error; });
  return firstRow(Array.isArray(rows) ? rows : [rows]);
}

export function getOrderTransitions(order) {
  const workflow = getWorkflowSnapshot();
  return getAllowedTransitions(order?.workflow_state_key || order?.status || 'pending');
}
