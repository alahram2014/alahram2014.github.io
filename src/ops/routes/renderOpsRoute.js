import { dom } from '../../core/dom.js';
import { getAllowedTransitions } from '../services/workflowService.js';

function sectionButton(label, section, active, id = null) {
  const attrs = [`data-action="go-ops-route"`, `data-ops-section="${dom.escape(section)}"`];
  if (id) attrs.push(`data-ops-id="${dom.escape(id)}"`);
  return `<button class="btn ${active ? 'btn--primary' : 'btn--ghost'}" type="button" ${attrs.join(' ')}>${dom.escape(label)}</button>`;
}

function renderWorkspaceHeader(title, subtitle, actions = '') {
  return `
    <section class="page-section ops-workspace">
      <div class="page-section__head page-section__head--tight">
        <div>
          <h2>${dom.escape(title)}</h2>
          <p>${dom.escape(subtitle)}</p>
        </div>
        <div class="ops-workspace__actions">${actions}</div>
      </div>
    </section>
  `;
}

function renderCatalog(route, state) {
  const products = state?.ops?.catalog?.products || [];
  const product = state?.ops?.catalog?.product || null;
  const activeId = route.params?.id || null;

  if (activeId) {
    return `
      ${renderWorkspaceHeader('الكتالوج التشغيلي', 'وحدة تشغيل مستقلة للمنتج والتحميل والتعديل', [
        sectionButton('القائمة', 'catalog', false),
        sectionButton('الطلبــات', 'orders', false),
      ].join(''))}
      <section class="page-section">
        <div class="card-grid">
          <article class="card">
            <h3>${dom.escape(product?.product_name || 'منتج غير محمل')}</h3>
            <p>${dom.escape(product?.description || 'Workspace تشغيلي معزول')}</p>
            <ul class="list-plain">
              <li>SKU: ${dom.escape(product?.sku || '-')}</li>
              <li>الشركة: ${dom.escape(product?.company_name || '-')}</li>
              <li>المخزون: ${dom.escape(String(product?.stock_quantity ?? 0))}</li>
              <li>الحالة: ${dom.escape(product?.visibility || 'active')}</li>
            </ul>
          </article>
          <article class="card">
            <h3>التبويبات التشغيلية</h3>
            <div class="ops-tabs">
              <span>General</span><span>Pricing</span><span>Tier Pricing</span><span>Inventory</span><span>Images</span><span>Visibility</span><span>Offers</span><span>Operational Notes</span>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  return `
    ${renderWorkspaceHeader('الكتالوج التشغيلي', 'تحميل كامل من v_catalog_products دون حدود متجر', [
      sectionButton('الطلبات', 'orders', false),
      sectionButton('العملاء', 'customers', false),
      sectionButton('المندوبون', 'reps', false),
    ].join(''))}
    <section class="page-section">
      <div class="card-grid">
        <article class="card">
          <h3>إجمالي المنتجات</h3>
          <strong>${products.length}</strong>
        </article>
        <article class="card">
          <h3>عينة تشغيلية</h3>
          <p>${dom.escape(products[0]?.product_name || 'لا توجد بيانات بعد')}</p>
        </article>
      </div>
    </section>
  `;
}

function renderList(title, items, emptyText, getLabel) {
  return `
    <article class="card">
      <h3>${dom.escape(title)}</h3>
      ${items.length ? `<div class="stack-list">${items.map((item) => `<div class="stack-list__item">${dom.escape(getLabel(item))}</div>`).join('')}</div>` : `<p>${dom.escape(emptyText)}</p>`}
    </article>
  `;
}

function renderSection(route, state, key, title, subtitle, items, emptyText, getLabel) {
  const activeId = route.params?.id || null;
  const currentItem = activeId ? items.find((item) => String(item.id || item[key] || '') === String(activeId)) || null : null;
  const workflow = state?.ops?.workflows || {};
  const transitions = activeId ? getAllowedTransitions(currentItem?.workflow_state_key || currentItem?.status || 'pending') : [];

  return `
    ${renderWorkspaceHeader(title, subtitle, [
      sectionButton('الكتالوج', 'catalog', false),
      sectionButton('الطلبات', 'orders', false),
      sectionButton('التقارير', 'reports', false),
    ].join(''))}
    <section class="page-section">
      <div class="card-grid">
        ${renderList(title, items, emptyText, getLabel)}
        <article class="card">
          <h3>Hydration</h3>
          <p>${dom.escape(currentItem ? `Loaded ${currentItem.id || currentItem[key] || ''}` : 'البيانات محملة ومعزولة')}</p>
          <p>Workflow states: ${workflow.states ? workflow.states.length : 0}</p>
          ${transitions.length ? `<div class="stack-list">${transitions.map((transition) => `<div class="stack-list__item">${dom.escape(transition.from_state_name)} → ${dom.escape(transition.to_state_name)}</div>`).join('')}</div>` : ''}
        </article>
      </div>
    </section>
  `;
}

function renderReports(state) {
  const products = state?.ops?.catalog?.products || [];
  const customers = state?.ops?.customers?.customers || [];
  const reps = state?.ops?.reps?.reps || [];
  return `
    ${renderWorkspaceHeader('التقارير التشغيلية', 'مرحلة foundation فقط دون BI decor', [
      sectionButton('الكتالوج', 'catalog', false),
      sectionButton('العملاء', 'customers', false),
      sectionButton('المندوبون', 'reps', false),
    ].join(''))}
    <section class="page-section">
      <div class="card-grid">
        <article class="card"><h3>المنتجات</h3><strong>${products.length}</strong></article>
        <article class="card"><h3>العملاء</h3><strong>${customers.length}</strong></article>
        <article class="card"><h3>المندوبون</h3><strong>${reps.length}</strong></article>
      </div>
    </section>
  `;
}

export function renderOpsRoute(state) {
  const route = state?.app?.route || { name: 'ops', params: {} };
  const section = String(route.params?.section || 'dashboard').trim();

  if (section === 'catalog') return renderCatalog(route, state);
  if (section === 'orders') return renderSection(route, state, 'order_id', 'الطلبات التشغيلية', 'سير عمل الطلبات كعملية تنفيذية', state?.ops?.orders?.orders || [], 'لا توجد طلبات بعد', (item) => `${item.order_number || item.id || '-'} — ${item.status || 'pending'}`);
  if (section === 'customers') return renderSection(route, state, 'customer_id', 'العملاء التشغيليون', 'Hydration مستقل دون collision مع create mode', state?.ops?.customers?.customers || [], 'لا توجد عملاء بعد', (item) => `${item.name || '-'} — ${item.phone || '-'}`);
  if (section === 'reps') return renderSection(route, state, 'rep_id', 'المندوبون التشغيليون', 'تحميل المندوبين والأنشطة والارتباطات', state?.ops?.reps?.reps || [], 'لا توجد مندوبون بعد', (item) => `${item.name || '-'} — ${item.territory || '-'}`);
  if (section === 'companies') return renderSection(route, state, 'company_id', 'الشركات التشغيلية', 'إدارة الكيانات المرتبطة بالكتالوج', state?.ops?.companies?.companies || [], 'لا توجد شركات بعد', (item) => `${item.company_name || '-'} — ${item.company_id || '-'}`);
  if (section === 'reports') return renderReports(state);

  return `
    ${renderWorkspaceHeader('لوحة ops', 'Runtime معزول لا يعيد استخدام storefront pages', [
      sectionButton('الكتالوج', 'catalog', false),
      sectionButton('الطلبات', 'orders', false),
      sectionButton('العملاء', 'customers', false),
      sectionButton('المندوبون', 'reps', false),
      sectionButton('الشركات', 'companies', false),
      sectionButton('التقارير', 'reports', false),
    ].join(''))}
    <section class="page-section">
      <div class="card-grid">
        <article class="card"><h3>Foundation</h3><p>Isolated operational runtime ready.</p></article>
        <article class="card"><h3>Catalog</h3><p>${dom.escape(String(state?.ops?.catalog?.products?.length || 0))} products loaded.</p></article>
        <article class="card"><h3>Workflow</h3><p>${dom.escape(String(state?.ops?.workflows?.states?.length || 0))} states loaded.</p></article>
      </div>
    </section>
  `;
}
