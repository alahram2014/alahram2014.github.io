import { dom } from '../core/dom.js';
import { invoiceCard } from '../components/cards.js';

export function renderRepInvoicesPage(state) {
  const orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  if (!orders.length) return '<div class="empty-state">لا توجد فواتير بعد</div>';
  const sorted = [...orders].slice(0, 20);
  return `
    <div class="rep-page rep-invoices-page">
      <section class="page-section">
        <div class="page-section__head">
          <h2>فواتيري</h2>
          <span class="badge">${orders.length}</span>
        </div>
        <div class="rep-invoice-list">
          ${sorted.map(invoiceCard).join('')}
        </div>
      </section>
    </div>
  `;
}
