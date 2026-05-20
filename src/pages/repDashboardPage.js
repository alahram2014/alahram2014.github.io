import { dom } from '../core/dom.js';
import { invoiceCard } from '../components/cards.js';
import { getOwnershipLabel } from '../services/repService.js';

function renderCustomerList(customers) {
  if (!Array.isArray(customers) || !customers.length) {
    return '<div class="empty-state">لا يوجد عملاء بعد</div>';
  }
  return `
    <div class="rep-customer-list">
      ${customers.slice(0, 5).map((customer) => `
        <article class="rep-customer-card" data-action="select-customer" data-customer-id="${dom.escape(String(customer.id))}">
          <div class="rep-customer-card__head">
            <strong>${dom.escape(customer.name || customer.business_name || '—')}</strong>
            <span class="chip chip--rep">مندوب</span>
            <button class="btn btn--xs btn--ghost" type="button" data-action="go-rep-customer-invoices" data-customer-id="${dom.escape(String(customer.id))}" data-customer-name="${dom.escape(customer.name || customer.business_name || '')}" title="فواتير العميل">📄</button>
          </div>
          <div class="rep-customer-card__meta">
            ${customer.phone ? `<span>${dom.escape(customer.phone)}</span>` : ''}
            <span class="rep-ownership-label">${dom.escape(getOwnershipLabel(customer))}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderInvoiceList(orders) {
  if (!Array.isArray(orders) || !orders.length) {
    return '<div class="empty-state">لا توجد فواتير</div>';
  }
  const sorted = [...orders].slice(0, 10);
  return `
    <div class="rep-invoice-list">
      ${sorted.map(invoiceCard).join('')}
    </div>
  `;
}

function renderRepStats(customers, orders) {
  const totalCustomers = Array.isArray(customers) ? customers.length : 0;
  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const pendingOrders = Array.isArray(orders)
    ? orders.filter((inv) => {
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
        <strong class="rep-stat-card__value">${totalOrders}</strong>
        <span class="rep-stat-card__label">فواتيري</span>
      </div>
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${pendingOrders}</strong>
        <span class="rep-stat-card__label">قيد التنفيذ</span>
      </div>
    </div>
  `;
}

export function renderRepDashboardPage(state) {
  const session = state.auth.session;
  const customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  const orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  const sessionName = dom.escape(session?.name || session?.username || 'المندوب');
  return `
    <div class="page-stack rep-dashboard">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>مرحبًا، ${sessionName}</h2>
            <p>لوحة المندوب — عملائي وطلباتي</p>
          </div>
        </div>
        ${renderRepStats(customers, orders)}
      </section>
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>إجراءات سريعة</h2>
            <p>أقصر طريق للمهام الأكثر تكرارًا</p>
          </div>
        </div>
        <div class="rep-actions-grid">
          <button class="btn btn--primary" type="button" data-action="go-rep-customers">عملائي</button>
          <button class="btn btn--primary" type="button" data-action="go-checkout">طلب جديد</button>
          <button class="btn btn--primary" type="button" data-action="go-rep-invoices">فواتيري</button>
          <button class="btn btn--ghost" type="button" data-action="open-customer-modal">إضافة عميل</button>
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
        ${renderCustomerList(customers)}
      </section>
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>آخر الفواتير</h2>
            <p>أحدث ١٠ طلبات وفواتير</p>
          </div>
          <span class="badge">${String(orders.length)}</span>
        </div>
        ${renderInvoiceList(orders)}
      </section>
    </div>
  `;
}
