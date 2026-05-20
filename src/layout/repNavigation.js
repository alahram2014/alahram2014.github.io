import { dom } from '../core/dom.js';

export function renderRepNavigation(state) {
  const routeName = state?.app?.route?.name || '';
  if (routeName !== 'rep') return '';
  const activeModule = state?.app?.route?.params?.module || 'dashboard';
  const links = [
    { key: 'dashboard', label: 'الرئيسية', action: 'go-rep' },
    { key: 'customers', label: 'عملائي', action: 'go-rep-customers' },
    { key: 'orders', label: 'طلباتي', action: 'go-rep-orders' },
    { key: 'invoices', label: 'فواتيري', action: 'go-rep-invoices' },
    { key: 'checkout', label: 'طلب جديد', action: 'go-checkout' },
  ];
  return `
    <nav class="rep-nav">
      ${links.map((link) => {
        const active = activeModule === link.key;
        return `<button class="rep-nav__link ${active ? 'rep-nav__link--active' : ''}" type="button" data-action="${link.action}">${dom.escape(link.label)}</button>`;
      }).join('')}
    </nav>
  `;
}
