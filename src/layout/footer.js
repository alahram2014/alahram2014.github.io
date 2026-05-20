import { getSelectedTier } from '../state/selectors.js';
import { computeCartTotals } from '../state/selectors.js';
import { dom } from '../core/dom.js';

export function renderFooter(container, state) {
  const tier = getSelectedTier(state);
  const label = tier?.visible_label || tier?.tier_name || 'اختر شريحتك';
  const totals = computeCartTotals(state);
  const cartAmount = Math.round(Number(totals.grand || 0));

  container.innerHTML = `
    <nav class="footer-nav" aria-label="التنقل السفلي">
      <button type="button" data-action="navigate-home" class="footer-nav__item">الرئيسية</button>
      <button type="button" data-action="go-companies" class="footer-nav__item">الشركات</button>
      <button type="button" data-action="go-checkout" class="footer-nav__item footer-nav__item--strong">إتمام الشراء</button>
      <button type="button" data-action="go-tiers" class="footer-nav__item footer-nav__item--tier">${dom.escape(label)}</button>
      <button type="button" data-action="go-checkout" class="footer-nav__item footer-nav__item--cart">${cartAmount > 0 ? `<span class="footer-cart-amount">${dom.escape(cartAmount.toLocaleString('en-US'))}</span>` : '<span class="footer-cart-icon">🛒</span>'}</button>
    </nav>
  `;
}
