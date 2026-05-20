import { dom } from '../core/dom.js';
import { formatMoney, formatStatus } from '../services/invoiceService.js';
import { getWorkflowStateLabel } from '../services/workflowService.js';

function formatDate(raw) {
  if (!raw) return '—';
  try { return new Date(raw).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

function statusBadge(stateKey) {
  const label = getWorkflowStateLabel(stateKey);
  const tones = { pending: 'badge--warning', reviewing: 'badge--warning', preparing: 'badge--warning', dispatched: 'badge--muted', delivered: 'badge--success', collected: 'badge--success', returned: 'badge--danger', cancelled: 'badge--danger' };
  const tone = tones[stateKey] || 'badge--muted';
  return `<span class="badge ${tone}">${dom.escape(label)}</span>`;
}

export function renderAdminOrdersModule(state) {
  const orders = Array.isArray(state.runtime?.manager?.teamOrders) ? state.runtime.manager.teamOrders : [];
  const loading = state.runtime?.loading?.manager !== false && !state.runtime?.lifecycle?.managerReady;
  if (loading) return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة الطلبات</h2><p>جارٍ التحميل…</p></div></div><div class="empty-state">جارٍ التحميل…</div></section></div>`;
  const rows = orders.slice(0, 100).map((order) => {
    const stateKey = order.workflow_state_key || order.workflow_status || order.status || 'pending';
    return `
      <tr>
        <td><strong>#${dom.escape(String(order.order_number || order.invoice_number || order.id || ''))}</strong></td>
        <td>${dom.escape(order.customer_name || order.customer?.name || '—')}</td>
        <td>${dom.escape(order.rep_name || order.sales_rep_name || '—')}</td>
        <td>${statusBadge(stateKey)}</td>
        <td>${dom.escape(formatMoney(Number(order.total_amount || 0)))} ج.م</td>
        <td>${formatDate(order.created_at)}</td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-order-view" data-order-id="${dom.escape(String(order.id))}">عرض</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-order-transition" data-order-id="${dom.escape(String(order.id))}">حالة</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head"><div><h2>إدارة الطلبات</h2><p>${orders.length} طلب</p></div></div>
        ${!orders.length ? '<div class="empty-state">لا توجد طلبات</div>' : `
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead><tr><th>الطلب</th><th>العميل</th><th>المندوب</th><th>الحالة</th><th>المبلغ</th><th>التاريخ</th><th class="ops-cell--actions">إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </section>
    </div>`;
}

export function renderAdminCustomersModule(state) {
  const customers = Array.isArray(state.runtime?.manager?.teamCustomers) ? state.runtime.manager.teamCustomers : [];
  const loading = state.runtime?.loading?.manager !== false && !state.runtime?.lifecycle?.managerReady;
  if (loading) return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة العملاء</h2><p>جارٍ التحميل…</p></div></div><div class="empty-state">جارٍ التحميل…</div></section></div>`;
  const rows = customers.slice(0, 100).map((customer) => {
    const ownershipLabel = customer.owner_id || customer.sales_rep_id || customer.created_by_rep_id
      ? '<span class="badge badge--info">مندوب</span>'
      : '<span class="badge badge--success">مباشر</span>';
    return `
      <tr>
        <td><strong>${dom.escape(customer.name || customer.business_name || '—')}</strong></td>
        <td>${dom.escape(customer.phone || '—')}</td>
        <td>${ownershipLabel}</td>
        <td>${dom.escape(customer.sales_rep_name || customer.rep_name || '—')}</td>
        <td>${formatDate(customer.created_at)}</td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-customer-view" data-customer-id="${dom.escape(String(customer.id))}">عرض</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-customer-orders" data-customer-id="${dom.escape(String(customer.id))}">طلباته</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head"><div><h2>إدارة العملاء</h2><p>${customers.length} عميل</p></div></div>
        ${!customers.length ? '<div class="empty-state">لا يوجد عملاء</div>' : `
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>النوع</th><th>المندوب</th><th>التاريخ</th><th class="ops-cell--actions">إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </section>
    </div>`;
}

export function renderAdminRepsModule(state) {
  const reps = Array.isArray(state.runtime?.manager?.teamReps) ? state.runtime.manager.teamReps : [];
  const loading = state.runtime?.loading?.manager !== false && !state.runtime?.lifecycle?.managerReady;
  if (loading) return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة المندوبين</h2><p>جارٍ التحميل…</p></div></div><div class="empty-state">جارٍ التحميل…</div></section></div>`;
  const rows = reps.slice(0, 100).map((rep) => {
    const isActive = rep.is_active !== false && rep.is_blocked !== true;
    return `
      <tr class="${isActive ? '' : 'row--inactive'}">
        <td><strong>${dom.escape(rep.name || rep.username || '—')}</strong></td>
        <td>${dom.escape(rep.phone || '—')}</td>
        <td>${dom.escape(rep.region || '—')}</td>
        <td>${dom.escape(rep.default_tier_name || '—')}</td>
        <td><span class="badge ${isActive ? 'badge--success' : 'badge--danger'}">${isActive ? 'نشط' : 'موقوف'}</span></td>
        <td>${formatDate(rep.created_at)}</td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-rep-view" data-rep-id="${dom.escape(String(rep.id))}">عرض</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-rep-customers" data-rep-id="${dom.escape(String(rep.id))}">عملاؤه</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head"><div><h2>إدارة المندوبين</h2><p>${reps.length} مندوب</p></div></div>
        ${!reps.length ? '<div class="empty-state">لا يوجد مندوبين</div>' : `
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>المنطقة</th><th>الشريحة</th><th>الحالة</th><th>التاريخ</th><th class="ops-cell--actions">إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </section>
    </div>`;
}

export function renderAdminPricingModule(state) {
  const tiers = Array.isArray(state.commerce?.catalog?.tiers) ? state.commerce.catalog.tiers : [];
  const rows = tiers.map((tier) => {
    const isDefault = tier.is_default || tier.tier_name === 'base';
    return `
      <tr class="${isDefault ? '' : ''}">
        <td><strong>${dom.escape(tier.tier_name || tier.name || '—')}</strong></td>
        <td>${isDefault ? '<span class="badge badge--primary">افتراضي</span>' : '<span class="badge badge--muted">شريحة</span>'}</td>
        <td>${tier.min_order ? `${dom.escape(formatMoney(Number(tier.min_order)))} ج.م` : '—'}</td>
        <td>${tier.label ? dom.escape(String(tier.label)) : '—'}</td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="admin-pricing-view" data-tier-name="${dom.escape(tier.tier_name || tier.name || '')}">عرض</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head"><div><h2>إدارة التسعير</h2><p>${tiers.length} شريحة سعرية</p></div></div>
        ${!tiers.length ? '<div class="empty-state">لا توجد شرائح سعرية</div>' : `
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead><tr><th>الشريحة</th><th>النوع</th><th>الحد الأدنى</th><th>الوصف</th><th class="ops-cell--actions"></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </section>
    </div>`;
}
