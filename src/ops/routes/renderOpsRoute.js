import { dom } from '../../core/dom.js';

const OPS_SECTIONS = [
  { key: 'dashboard', label: 'الواجهة', description: 'مساحة تشغيل خفيفة' },
  { key: 'catalog', label: 'الكتالوج', description: 'المنتجات والأسعار' },
  { key: 'orders', label: 'الطلبات', description: 'سير تنفيذ الطلبات' },
  { key: 'customers', label: 'العملاء', description: 'ملكية ومتابعة' },
  { key: 'reps', label: 'المندوبون', description: 'التوزيع والتمكين' },
  { key: 'reports', label: 'التقارير', description: 'ملخصات خفيفة' },
];

function navButton(section, active) {
  return `
    <button class="btn ${active ? 'btn--primary' : 'btn--ghost'}" type="button" data-action="go-ops-route" data-ops-section="${dom.escape(section.key)}">
      ${dom.escape(section.label)}
    </button>
  `;
}

function workspaceHeader(title, subtitle, sectionKey) {
  return `
    <section class="page-section ops-workspace">
      <div class="page-section__head page-section__head--tight">
        <div>
          <h2>${dom.escape(title)}</h2>
          <p>${dom.escape(subtitle)}</p>
        </div>
        <div class="ops-workspace__actions">
          ${OPS_SECTIONS.map((section) => navButton(section, section.key === sectionKey)).join('')}
        </div>
      </div>
    </section>
  `;
}

function emptyState(label) {
  return `<div class="empty-state">${dom.escape(label)}</div>`;
}

function renderSummaryCard(title, value, hint = '') {
  return `
    <article class="ops-metric-card">
      <span class="ops-metric-card__label">${dom.escape(title)}</span>
      <strong class="ops-metric-card__value">${dom.escape(String(value))}</strong>
      <span class="ops-metric-card__hint">${dom.escape(hint)}</span>
    </article>
  `;
}

function renderCatalogCard(product) {
  return `
    <article class="card ops-record-card">
      <div class="ops-record-card__head">
        <div>
          <h3>${dom.escape(product.product_name || 'منتج')}</h3>
          <p>${dom.escape(product.company_name || product.category || '')}</p>
        </div>
        <span class="badge">${dom.escape(product.visibility || (product.active ? 'active' : 'inactive'))}</span>
      </div>
      <div class="ops-record-card__meta">
        <span class="chip">SKU ${dom.escape(product.sku || '—')}</span>
        <span class="chip">${dom.escape(String(product.stock_quantity ?? 0))} مخزون</span>
      </div>
      <div class="ops-record-card__actions">
        <button class="btn btn--primary" type="button" data-action="ops-catalog-quick-edit" data-product-id="${dom.escape(String(product.id || ''))}">Quick edit</button>
        <button class="btn btn--ghost" type="button" data-action="ops-catalog-inventory" data-product-id="${dom.escape(String(product.id || ''))}">Inventory</button>
        <button class="btn btn--ghost" type="button" data-action="ops-catalog-pricing" data-product-id="${dom.escape(String(product.id || ''))}">Pricing</button>
        <button class="btn btn--ghost" type="button" data-action="ops-catalog-visibility" data-product-id="${dom.escape(String(product.id || ''))}">Visibility</button>
      </div>
    </article>
  `;
}

function renderOrderCard(order) {
  const stateKey = String(order.workflow_state_key || order.status || 'pending').trim();
  const actionButtons = [
    'approve',
    'assign',
    'confirm',
    'prepare',
    'ship',
    'deliver',
    'cancel',
    'return',
  ].map((action) => `
    <button class="btn ${action === 'ship' ? 'btn--primary' : 'btn--ghost'}" type="button" data-action="ops-order-${action}" data-order-id="${dom.escape(String(order.id || ''))}">
      ${dom.escape(action)}
    </button>
  `).join('');

  return `
    <article class="card ops-record-card">
      <div class="ops-record-card__head">
        <div>
          <h3>${dom.escape(order.order_number || order.id || 'طلب')}</h3>
          <p>${dom.escape(order.customer_name || order.customer_id || '—')}</p>
        </div>
        <span class="badge">${dom.escape(stateKey)}</span>
      </div>
      <div class="ops-record-card__meta">
        <span class="chip">${dom.escape(String(order.total_amount ?? 0))} ج.م</span>
        <span class="chip">${dom.escape(String(order.sales_rep_id || '—'))}</span>
      </div>
      <div class="ops-record-card__actions">${actionButtons}</div>
    </article>
  `;
}

function renderCustomerCard(customer) {
  return `
    <article class="card ops-record-card">
      <div class="ops-record-card__head">
        <div>
          <h3>${dom.escape(customer.name || 'عميل')}</h3>
          <p>${dom.escape(customer.phone || '—')}</p>
        </div>
        <span class="badge">${customer.active && !customer.blocked ? 'active' : 'inactive'}</span>
      </div>
      <div class="ops-record-card__meta">
        <span class="chip">${dom.escape(customer.sales_rep_id || 'بدون مندوب')}</span>
        <span class="chip">${dom.escape(customer.customer_type || 'direct')}</span>
      </div>
      <div class="ops-record-card__actions">
        <button class="btn btn--primary" type="button" data-action="ops-customer-quick-edit" data-customer-id="${dom.escape(String(customer.id || ''))}">Quick edit</button>
        <button class="btn btn--ghost" type="button" data-action="ops-customer-assign-rep" data-customer-id="${dom.escape(String(customer.id || ''))}">Assign rep</button>
        <button class="btn btn--ghost" type="button" data-action="ops-customer-toggle" data-customer-id="${dom.escape(String(customer.id || ''))}">${customer.active && !customer.blocked ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn--ghost" type="button" data-action="ops-customer-notes" data-customer-id="${dom.escape(String(customer.id || ''))}">Notes</button>
      </div>
    </article>
  `;
}

function renderRepCard(rep) {
  return `
    <article class="card ops-record-card">
      <div class="ops-record-card__head">
        <div>
          <h3>${dom.escape(rep.name || 'مندوب')}</h3>
          <p>${dom.escape(rep.phone || '—')}</p>
        </div>
        <span class="badge">${rep.active && !rep.blocked ? 'active' : 'inactive'}</span>
      </div>
      <div class="ops-record-card__meta">
        <span class="chip">${dom.escape(rep.territory || '—')}</span>
        <span class="chip">${dom.escape(rep.notes || '—')}</span>
      </div>
      <div class="ops-record-card__actions">
        <button class="btn btn--primary" type="button" data-action="ops-rep-assign-customers" data-rep-id="${dom.escape(String(rep.id || ''))}">Assign customers</button>
        <button class="btn btn--ghost" type="button" data-action="ops-rep-toggle" data-rep-id="${dom.escape(String(rep.id || ''))}">${rep.active && !rep.blocked ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn--ghost" type="button" data-action="ops-rep-visibility" data-rep-id="${dom.escape(String(rep.id || ''))}">Visibility</button>
      </div>
    </article>
  `;
}

function renderDashboard() {
  return `
    ${workspaceHeader('مركز التشغيل', 'وصول مباشر إلى الوحدات التشغيلية', 'dashboard')}
    <section class="page-section ops-section">
      <div class="ops-metric-grid">
        ${OPS_SECTIONS.filter((section) => section.key !== 'dashboard').map((section) => `
          <button class="ops-module-card is-ready" type="button" data-action="go-ops-route" data-ops-section="${dom.escape(section.key)}">
            <div class="ops-module-card__head">
              <strong>${dom.escape(section.label)}</strong>
              <span class="badge">Open</span>
            </div>
            <p>${dom.escape(section.description)}</p>
            <small>فتح مساحة ${dom.escape(section.label)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderCatalog(state) {
  const items = state?.runtime?.ops?.catalog?.products || [];
  return `
    ${workspaceHeader('الكتالوج', 'تحديث المخزون والأسعار والظهور داخل مساحة مستقلة', 'catalog')}
    <section class="page-section ops-section">
      <div class="ops-metric-grid">
        ${renderSummaryCard('Products', items.length, 'route-local data')}
      </div>
      <div class="ops-record-grid">
        ${items.length ? items.map(renderCatalogCard).join('') : emptyState('لا توجد منتجات محمّلة')}
      </div>
    </section>
  `;
}

function renderOrders(state) {
  const items = state?.runtime?.ops?.orders?.orders || [];
  return `
    ${workspaceHeader('الطلبات', 'إجراءات تنفيذية مباشرة للطلبات', 'orders')}
    <section class="page-section ops-section">
      <div class="ops-metric-grid">
        ${renderSummaryCard('Orders', items.length, 'route-local data')}
      </div>
      <div class="ops-record-grid">
        ${items.length ? items.map(renderOrderCard).join('') : emptyState('لا توجد طلبات محمّلة')}
      </div>
    </section>
  `;
}

function renderCustomers(state) {
  const items = state?.runtime?.ops?.customers?.customers || [];
  return `
    ${workspaceHeader('العملاء', 'الملكية والمتابعة والتفعيل داخل Workspace معزول', 'customers')}
    <section class="page-section ops-section">
      <div class="ops-metric-grid">
        ${renderSummaryCard('Customers', items.length, 'route-local data')}
      </div>
      <div class="ops-record-grid">
        ${items.length ? items.map(renderCustomerCard).join('') : emptyState('لا توجد عملاء محمّلون')}
      </div>
    </section>
  `;
}

function renderReps(state) {
  const items = state?.runtime?.ops?.reps?.reps || [];
  return `
    ${workspaceHeader('المندوبون', 'توزيع العملاء والتمكين التشغيلي', 'reps')}
    <section class="page-section ops-section">
      <div class="ops-metric-grid">
        ${renderSummaryCard('Reps', items.length, 'route-local data')}
      </div>
      <div class="ops-record-grid">
        ${items.length ? items.map(renderRepCard).join('') : emptyState('لا توجد مناديب محمّلون')}
      </div>
    </section>
  `;
}

function renderReports(state) {
  const summary = state?.runtime?.ops?.reports?.summary || {};
  const cards = [
    ['Catalog', summary.catalog || 0, 'catalog slice'],
    ['Orders', summary.orders || 0, 'orders slice'],
    ['Customers', summary.customers || 0, 'customers slice'],
    ['Reps', summary.reps || 0, 'reps slice'],
  ];
  return `
    ${workspaceHeader('التقارير', 'ملخصات خفيفة بدون تحميل datasets كبيرة', 'reports')}
    <section class="page-section ops-section">
      <div class="ops-metric-grid">
        ${cards.map(([title, value, hint]) => renderSummaryCard(title, value, hint)).join('')}
      </div>
    </section>
  `;
}

export function renderOpsRoute(state) {
  const route = state?.app?.route || { name: 'ops', params: {} };
  const section = String(route.params?.section || 'dashboard').trim();

  if (section === 'catalog') return renderCatalog(state);
  if (section === 'orders') return renderOrders(state);
  if (section === 'customers') return renderCustomers(state);
  if (section === 'reps') return renderReps(state);
  if (section === 'reports') return renderReports(state);
  return renderDashboard(state);
}
