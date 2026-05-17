import { isSalesRepSession } from '../../services/authService.js';

export function shouldBlockCheckout(session, selectedCustomer) {
  return Boolean(isSalesRepSession(session) && !selectedCustomer);
}

export function getCheckoutBlockMessage(session, selectedCustomer) {
  return shouldBlockCheckout(session, selectedCustomer) ? 'اختر العميل أولًا' : '';
}
