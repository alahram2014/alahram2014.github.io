import { dom } from '../core/dom.js';
import { invoiceCard } from '../components/cards.js';

export function renderRepOrdersPage(state) {
  const orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  if (!orders.length) return '<div class="empty-state">لا توجد طلبات بعد</div>';
  return `
    <div class="rep-page rep-orders-page">
      <section class="page-section">
        <div class="page-section__head">
          <h2>طلباتي</h2>
          <span class="badge">${orders.length}</span>
        </div>
        <div class="rep-order-list">
          ${orders.slice(0, 50).map(invoiceCard).join('')}
        </div>
      </section>
    </div>
  `;
}
