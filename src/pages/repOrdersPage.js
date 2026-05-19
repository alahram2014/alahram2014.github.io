import { dom } from '../core/dom.js';
import { formatMoney } from '../services/invoiceService.js';

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
          ${orders.slice(0, 50).map((o) => `
            <article class="rep-order-card" data-action="view-invoice" data-invoice-id="${dom.escape(String(o.id))}">
              <div class="rep-order-card__head">
                <strong>طلب #${dom.escape(String(o.order_number || o.id))}</strong>
                <span class="chip">${dom.escape(o.customer_name || '—')}</span>
              </div>
              <div class="rep-order-card__meta">
                <span>${dom.escape(formatMoney(Number(o.total_amount || 0)))} ج.م</span>
                <span>${dom.escape(o.workflow_state_key || o.workflow_status || o.status || '—')}</span>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}
