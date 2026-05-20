import { dom } from '../core/dom.js';
import { formatMoney, formatStatus } from '../services/invoiceService.js';

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
          ${sorted.map((inv) => `
            <article class="rep-invoice-card" data-action="view-invoice" data-invoice-id="${dom.escape(String(inv.id))}">
              <div class="rep-invoice-card__head">
                <strong>فاتورة #${dom.escape(String(inv.order_number || inv.invoice_number || inv.id))}</strong>
                <span class="chip">${dom.escape(formatStatus(inv.workflow_state_key || inv.workflow_status || inv.status))}</span>
              </div>
              <div class="rep-invoice-card__meta">
                <span>${dom.escape(inv.customer_name || '—')}</span>
                <span>${dom.escape(formatMoney(Number(inv.total_amount || 0)))} ج.م</span>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}
