import { dom } from '../core/dom.js';
import { formatMoney, formatStatus } from '../services/invoiceService.js';
import { getWorkflowStateLabel } from '../services/workflowService.js';

function renderCustomerList(customers, session) {
  if (!Array.isArray(customers) || !customers.length) {
    return '<div class="empty-state">لا يوجد عملاء بعد</div>';
  }
  return `
    <div class="rep-customer-list">
      ${customers.map((customer) => {
        const ownershipLabel = customer.sales_rep_id || customer.created_by_rep_id
          ? '<span class="chip chip--rep">مندوب</span>'
          : '<span class="chip chip--direct">عميل مباشر</span>';
        return `
          <article class="rep-customer-card" data-action="select-customer" data-customer-id="${dom.escape(String(customer.id))}">
            <div class="rep-customer-card__head">
              <strong>${dom.escape(customer.name || customer.business_name || '—')}</strong>
              ${ownershipLabel}
            </div>
            <div class="rep-customer-card__meta">
              ${customer.phone ? `<span>📞 ${dom.escape(customer.phone)}</span>` : ''}
              ${customer.address ? `<span>📍 ${dom.escape(customer.address)}</span>` : ''}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderInvoiceList(invoices) {
  if (!Array.isArray(invoices) || !invoices.length) {
    return '<div class="empty-state">لا توجد فواتير</div>';
  }
  const sorted = [...invoices].slice(0, 10);
  return `
    <div class="rep-invoice-list">
      ${sorted.map((invoice) => `
        <article class="rep-invoice-card" data-action="view-invoice" data-invoice-id="${dom.escape(String(invoice.id))}">
          <div class="rep-invoice-card__head">
            <strong>طلب #${dom.escape(String(invoice.order_number || invoice.invoice_number || invoice.id || ''))}</strong>
            <span class="chip">${dom.escape(formatStatus(invoice.workflow_state_key || invoice.workflow_status || invoice.status))}</span>
          </div>
          <div class="rep-invoice-card__meta">
            <span>${dom.escape(invoice.customer_name || '—')}</span>
            <span>${dom.escape(formatMoney(Number(invoice.total_amount || 0)))} ج.م</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderRepStats(customers, invoices) {
  const totalCustomers = Array.isArray(customers) ? customers.length : 0;
  const totalInvoices = Array.isArray(invoices) ? invoices.length : 0;
  const pendingInvoices = Array.isArray(invoices)
    ? invoices.filter((inv) => {
        const key = (inv.workflow_state_key || inv.workflow_status || inv.status || '').toLowerCase();
        return ['pending', 'reviewing'].includes(key);
      }).length
    : 0;

  return `
    <div class="rep-stats-grid">
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${totalCustomers}</strong>
        <span class="rep-stat-card__label">عملائي</span>
      </div>
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${totalInvoices}</strong>
        <span class="rep-stat-card__label">فواتيري</span>
      </div>
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${pendingInvoices}</strong>
        <span class="rep-stat-card__label">قيد التنفيذ</span>
      </div>
    </div>
  `;
}

export function renderRepDashboardPage(state) {
  const session = state.auth.session;
  const customers = Array.isArray(state.commerce.customers) ? state.commerce.customers : [];
  const invoices = Array.isArray(state.commerce.invoices) ? state.commerce.invoices : [];
  const sessionName = dom.escape(session?.name || session?.username || 'المندوب');

  return `
    <div class="page-stack rep-dashboard">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>👋 مرحبًا، ${sessionName}</h2>
            <p>لوحة المندوب — متجرك وطلباتك</p>
          </div>
        </div>
        ${renderRepStats(customers, invoices)}
      </section>

      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>إجراءات سريعة</h2>
            <p>أقصر طريق للمهام الأكثر تكرارًا</p>
          </div>
        </div>
        <div class="rep-actions-grid">
          <button class="btn btn--primary" type="button" data-action="go-customers">👥 عملائي</button>
          <button class="btn btn--primary" type="button" data-action="go-checkout">🛒 طلب جديد</button>
          <button class="btn btn--primary" type="button" data-action="go-invoices">📦 فواتيري</button>
          <button class="btn btn--ghost" type="button" data-action="open-customer-modal">➕ إضافة عميل</button>
        </div>
      </section>

      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>عملائي</h2>
            <p>قائمة العملاء المرتبطين</p>
          </div>
          <span class="badge">${String(customers.length)}</span>
        </div>
        ${renderCustomerList(customers, session)}
      </section>

      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>آخر الفواتير</h2>
            <p>أحدث ١٠ طلبات وفواتير</p>
          </div>
          <span class="badge">${String(invoices.length)}</span>
        </div>
        ${renderInvoiceList(invoices)}
      </section>
    </div>
  `;
}
