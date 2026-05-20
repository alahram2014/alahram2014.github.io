import { formatMoney } from './invoiceService.js';
import { getOwnershipActorId, isSalesRepSession, normalizeUserType } from './authService.js';
import { publishDomainEvent } from './domainEventService.js';

function normalizeUnitCode(value) {
  const unit = String(value || '').trim();
  if (['carton', 'pack', 'half_pack', 'piece'].includes(unit)) return unit;
  return unit || 'piece';
}

function normalizeOrderItem(item, tier) {
  const qty = Math.max(1, Number(item.qty || 1));
  const basePrice = Number(item.base_price ?? item.basePrice ?? item.price ?? 0);
  const finalPrice = Number(item.final_price ?? item.finalPrice ?? item.price ?? 0);
  const unit = normalizeUnitCode(item.unit_code || item.unit || item.unit_name);
  const productId = String(item.product_id || item.id || item.offer_id || '').trim();
  const sourceType = String(item.type || 'product').trim().toLowerCase();
  const normalizedType = ['flash', 'deal', 'offer'].includes(sourceType) ? 'product' : (sourceType || 'product');

  if (!productId) {
    throw new Error('INVALID_PRODUCT_ID');
  }
  if (!finalPrice || finalPrice <= 0) {
    throw new Error('INVALID_FINAL_PRICE');
  }

  return {
    product_id: productId,
    type: normalizedType,
    source_type: sourceType || 'product',
    qty,
    price: finalPrice,
    unit,
    product_name_snapshot: item.name || item.title || item.product_name || '',
    company_id_snapshot: item.company_id || item.companyId || '',
    company_name_snapshot: item.companyName || item.company_name || '',
    unit_name_snapshot: item.unitLabel || item.unit || 'قطعة',
    offer_id_snapshot: item.offer_id || null,
    offer_kind_snapshot: sourceType === 'flash' ? 'flash' : sourceType === 'deal' ? 'deal' : null,
    unit_code: unit,
    tier_name: item.tier_name || item.tierName || tier?.tier_name || 'base',
    base_price_snapshot: basePrice,
    final_price_snapshot: finalPrice,
    pricing_source_snapshot: item.pricing_source || 'runtime',
    applied_discount_percent_snapshot: Number(item.discount_percent || 0),
    line_total: Number(item.line_total ?? finalPrice * qty),
    currency_code: 'EGP',
    reserved_qty: qty,
    fulfilled_qty: 0,
    rejected_qty: 0,
  };
}

export function validateCheckout(state, tier, totals) {
  const session = state.auth.session;
  const userType = normalizeUserType(session?.user_type || session?.userType || 'customer', 'customer');
  const flashItems = (state.commerce.cart || []).filter((item) => item.type === 'flash');
  const flashState = state.runtime?.flashState;

  if (!session) return { ok: false, code: 'NO_SESSION', message: 'يجب تسجيل الدخول أولاً' };
  if (!state.commerce.cart.length) return { ok: false, code: 'EMPTY_CART', message: 'السلة فارغة' };
  if (!tier) return { ok: false, code: 'NO_TIER', message: 'اختر الشريحة أولاً' };
  if (isSalesRepSession(session) && !state.auth.selectedCustomer) return { ok: false, code: 'NO_CUSTOMER', message: 'اختر العميل أولاً' };
  if (flashItems.length && flashState?.status !== 'active') return { ok: false, code: 'FLASH_EXPIRED', message: 'عرض الساعة انتهى ولا يمكن إرساله' };
  if (Number(totals.grand || 0) <= 0) return { ok: false, code: 'INVALID_TOTAL', message: 'إجمالي الطلب غير صالح' };
  if (Number(totals.grand) < Number(tier.min_order || 0)) {
    return { ok: false, code: 'MIN_ORDER', message: `متبقي ${formatMoney(Number(tier.min_order || 0) - Number(totals.grand))} للوصول للحد الأدنى` };
  }
  return { ok: true };
}

export async function submitOrder(api, state, tier, totals) {
  const session = state.auth.session;
  if (!session?.id) throw new Error('INVALID_SESSION');

  const userType = normalizeUserType(session?.user_type || session?.userType || 'customer', 'customer');
  const isCustomerSession = userType === 'customer';
  const customer = state.auth.selectedCustomer || (isCustomerSession ? session : null);
  const salesRepId = getOwnershipActorId(session) || customer?.sales_rep_id || customer?.rep_id || null;

  if (!customer?.id) throw new Error('INVALID_CUSTOMER');

  const items = state.commerce.cart.map((item) => normalizeOrderItem(item, tier));

const normalizedUserType = isSalesRepSession(session) ? 'rep' : 'customer';

  const orderPayload = {
  customer_id: customer?.id || session.id,
  sales_rep_id: salesRepId || null,
  rep_id: salesRepId || null,
  owner_id: customer?.owner_id || salesRepId || null,
  customer_name_snapshot: customer?.name || session.name || '',
  total_amount: Number(Number(totals.grand || 0).toFixed(2)),
  status: 'submitted',
  user_type: normalizedUserType,
};

console.log('FINAL ORDER PAYLOAD', orderPayload);

  const orderRows = await api.post('orders', orderPayload);
  const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;
  if (!order?.id) throw new Error('ORDER_CREATE_FAILED');

  const normalizedItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    type: item.type,
    qty: item.qty,
    price: item.price,
    unit: item.unit,
    product_name_snapshot: item.product_name_snapshot,
    company_id_snapshot: item.company_id_snapshot,
    company_name_snapshot: item.company_name_snapshot,
    unit_name_snapshot: item.unit_name_snapshot,
    unit_code: item.unit_code,
    tier_name: item.tier_name,
    base_price_snapshot: item.base_price_snapshot,
    final_price_snapshot: item.final_price_snapshot,
    pricing_source_snapshot: item.pricing_source_snapshot,
    applied_discount_percent_snapshot: item.applied_discount_percent_snapshot,
    line_total: item.line_total,
    currency_code: item.currency_code,
    reserved_qty: item.reserved_qty,
    fulfilled_qty: item.fulfilled_qty,
    rejected_qty: item.rejected_qty,
  }));

  if (normalizedItems.length) await api.post('order_items', normalizedItems);
  publishDomainEvent('order.created', {
    order_id: order.id,
    order_number: order.order_number || order.invoice_number || order.id,
    customer_id: order.customer_id,
    sales_rep_id: order.sales_rep_id,
    owner_id: order.owner_id,
    workflow_state_key: order.workflow_state_key || 'pending',
  });
  return { order, items: normalizedItems, customer };
}

export async function restoreInvoiceToCart(api, invoiceId) {
  if (!invoiceId) throw new Error('INVALID_INVOICE_ID');
  const items = await api.get('order_items', {
    select: 'product_id,type,qty,price,unit,product_name_snapshot,company_id_snapshot,company_name_snapshot,unit_name_snapshot,unit_code,tier_name,base_price_snapshot,final_price_snapshot,pricing_source_snapshot,applied_discount_percent_snapshot,line_total,currency_code',
    order_id: `eq.${invoiceId}`,
  }).catch(() => []);
  const list = Array.isArray(items) ? items : [];
  return list.map(function(item) {
    return {
      id: item.product_id,
      product_id: item.product_id,
      type: item.type || 'product',
      qty: item.qty || 1,
      price: item.final_price_snapshot || item.price || 0,
      unit: item.unit || item.unit_code || 'piece',
      unitLabel: item.unit_name_snapshot || '',
      name: item.product_name_snapshot || '',
      title: item.product_name_snapshot || '',
      companyId: item.company_id_snapshot || '',
      companyName: item.company_name_snapshot || '',
      unit_code: item.unit_code || 'piece',
      tier_name: item.tier_name || 'base',
      base_price: item.base_price_snapshot || 0,
      final_price: item.final_price_snapshot || item.price || 0,
      pricing_source: item.pricing_source_snapshot || 'runtime',
      discount_percent: item.applied_discount_percent_snapshot || 0,
      line_total: item.line_total || 0,
      currency_code: item.currency_code || 'EGP',
      source_type: item.type || 'product',
    };
  });
}

export async function saveEditedInvoice(api, invoiceId, state, tier, totals) {
  if (!invoiceId) throw new Error('INVALID_INVOICE_ID');
  const invoice = (state.commerce.invoices || []).find(function(inv) { return String(inv.id) === String(invoiceId); });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (!isOrderEditable(invoice)) throw new Error('INVOICE_NOT_EDITABLE');
  const session = state.auth.session;
  const customer = state.auth.selectedCustomer || null;
  if (!customer) throw new Error('NO_CUSTOMER');
  const cartItems = Array.isArray(state.commerce.cart) ? state.commerce.cart : [];
  if (!cartItems.length) throw new Error('EMPTY_CART');
  const normalizedItems = cartItems.map(function(item) {
    const n = normalizeOrderItem(item, tier);
    return {
      order_id: invoiceId,
      product_id: n.product_id,
      type: n.type,
      qty: n.qty,
      price: n.price,
      unit: n.unit,
      product_name_snapshot: n.product_name_snapshot,
      company_id_snapshot: n.company_id_snapshot,
      company_name_snapshot: n.company_name_snapshot,
      unit_name_snapshot: n.unit_name_snapshot,
      unit_code: n.unit_code,
      tier_name: n.tier_name,
      base_price_snapshot: n.base_price_snapshot,
      final_price_snapshot: n.final_price_snapshot,
      pricing_source_snapshot: n.pricing_source_snapshot,
      applied_discount_percent_snapshot: n.applied_discount_percent_snapshot,
      line_total: n.line_total,
      currency_code: n.currency_code,
      reserved_qty: n.qty,
      fulfilled_qty: 0,
      rejected_qty: 0,
    };
  });
  await api.del('order_items', { order_id: `eq.${invoiceId}` }).catch(function(e) { throw e; });
  if (normalizedItems.length) await api.post('order_items', normalizedItems);
  const updatePayload = {
    total_amount: Number(Number(totals.grand || 0).toFixed(2)),
    customer_name_snapshot: customer?.name || session?.name || invoice.customer_name_snapshot || '',
  };
  await api.patch('orders', updatePayload, { id: `eq.${invoiceId}` }).catch(function(e) { throw e; });
  publishDomainEvent('invoice_updated_before_review', {
    invoice_id: invoiceId,
    order_number: invoice.order_number || invoice.invoice_number || invoiceId,
    customer_id: customer?.id || invoice.customer_id,
    actor: session?.id || '',
    owner_id: invoice.owner_id || '',
    sales_rep_id: invoice.sales_rep_id || '',
    timestamp: new Date().toISOString(),
  });
  return { invoiceId: invoiceId, total: totals.grand, items: normalizedItems };
}

export async function deleteOrder(api, orderId) {
  if (!orderId) throw new Error('INVALID_ORDER_ID');
  const invoice = null;
  await api.del('order_items', { order_id: `eq.${orderId}` }).catch(function(e) { throw e; });
  const result = await api.del('orders', { id: `eq.${orderId}` }).catch(function(e) { throw e; });
  return result;
}

export function isOrderEditable(order) {
  const s = String(order?.workflow_state_key || order?.workflow_status || order?.status || '').trim();
  return s === 'pending' || s === '';
}
