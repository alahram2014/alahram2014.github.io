import { dom } from '../core/dom.js';
import { formatMoney } from '../services/invoiceService.js';
import { createOpsDashboardModel } from '../services/opsDashboardService.js';
import { getOperationalModuleByKey, isOperationalModuleReady } from '../services/managerService.js';
import { getWorkflowStateLabel, resolveWorkflowActions } from '../services/workflowService.js';

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getOpsSearch(state) {
  return normalize(state?.ui?.search);
}

function renderCounterGrid(counters) {
  return `
    <div class="ops-metric-grid">
      ${counters.map((counter) => `
        <article class="ops-metric-card">
          <span class="ops-metric-card__label">${dom.escape(counter.label)}</span>
          <strong class="ops-metric-card__value">${dom.escape(String(counter.value))}</strong>
          <span class="ops-metric-card__hint">${dom.escape(counter.hint || '')}</span>
        </article>
      `).join('')}
    </div>
  `;
}

function renderQuickActions(actions) {
  return `
    <section class="page-section ops-section">
      <div class="page-section__head">
        <div>
          <h2>تنفيذ سريع</h2>
          <p>أقصر طريق للمهام الأكثر تكرارًا</p>
        </div>
        <span class="badge">Execution-first</span>
      </div>
      <div class="ops-quick-actions">
        ${actions.map((action) => `
          <button class="ops-action-card ${action.enabled === false ? 'is-disabled' : ''}" type="button" data-action="${dom.escape(action.action)}" ${action.enabled === false ? 'disabled' : ''}${action.module ? ` data-module="${dom.escape(action.module)}"` : ''}>
            <span class="ops-action-card__icon">${dom.escape(action.icon || '•')}</span>
            <span class="ops-action-card__body">
              <strong>${dom.escape(action.label)}</strong>
              <small>${dom.escape(action.description || '')}</small>
            </span>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderQueueItem(item) {
  const transitions = Array.isArray(item.workflowActions?.executableTransitions) ? item.workflowActions.executableTransitions : [];
  const primary = transitions[0] || null;
  return `
    <article class="ops-queue-card__item">
      <div class="ops-queue-card__item-head">
        <strong>طلب #${dom.escape(String(item.orderNumber || item.id || '—'))}</strong>
        <span class="chip">${dom.escape(item.stateLabel || '—')}</span>
      </div>
      <p>${dom.escape(item.customerName || '—')}</p>
      <div class="ops-queue-card__item-meta">
        <span class="chip">${dom.escape(item.total || '0')} ج.م</span>
        <span class="chip">${dom.escape(String(transitions.length || 0))} إجراء</span>
      </div>
      <div class="ops-queue-card__item-actions">
        ${primary ? `<button class="btn btn--primary" type="button" data-action="workflow-transition" data-order-id="${dom.escape(String(item.id || ''))}" data-next-state-key="${dom.escape(String(primary.to_state_key || ''))}">ابدأ ${dom.escape(primary.to_state_label || 'التنفيذ')}</button>` : '<span class="badge">لا توجد إجراءات</span>'}
        <button class="btn btn--ghost" type="button" data-action="view-invoice" data-invoice-id="${dom.escape(String(item.id || ''))}">عرض</button>
      </div>
    </article>
  `;
}

function renderQueues(queues) {
  return `
    <section class="page-section ops-section">
      <div class="page-section__head">
        <div>
          <h2>الطوابير التشغيلية</h2>
          <p>أولوية عالية أولًا وفق workflow_state_key</p>
        </div>
        <span class="badge">Priority queue</span>
      </div>
      <div class="ops-queue-grid">
        ${queues.map((queue) => `
          <article class="ops-queue-card">
            <div class="ops-queue-card__head">
              <div>
                <h3>${dom.escape(queue.title)}</h3>
                <p>${dom.escape(queue.description || '')}</p>
              </div>
              <span class="badge">${dom.escape(String(queue.count || 0))}</span>
            </div>
            <div class="ops-queue-card__body">
              ${queue.items.length ? queue.items.map(renderQueueItem).join('') : `<div class="empty-state">${dom.escape(queue.emptyLabel || 'لا توجد عناصر')}</div>`}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderModules(modules) {
  return `
    <section class="page-section ops-section">
      <div class="page-section__head">
        <div>
          <h2>الوحدات التشغيلية</h2>
          <p>السطوح المتاحة حسب الدور والقدرة التشغيلية</p>
        </div>
      </div>
      <div class="ops-module-grid">
        ${modules.map((module) => `
          <button class="ops-module-card ${module.isReady ? 'is-ready' : 'is-locked'}" type="button" ${module.isReady ? `data-action="go-ops-module" data-module="${dom.escape(module.key)}"` : 'disabled'}>
            <div class="ops-module-card__head">
              <strong>${dom.escape(module.label)}</strong>
              <span class="badge">${dom.escape(module.statusLabel || (module.isReady ? 'جاهز' : 'قريبًا'))}</span>
            </div>
            <p>${dom.escape(module.description || '')}</p>
            <small>${dom.escape(module.ctaLabel || (module.isReady ? 'فتح' : 'قريبًا'))}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSectionShell(title, subtitle, badge, body) {
  return `
    <div class="page-stack ops-workspace">
      <section class="page-section ops-section">
        <div class="page-section__head">
          <div>
            <h2>${dom.escape(title)}</h2>
            <p>${dom.escape(subtitle)}</p>
          </div>
          ${badge ? `<span class="badge">${dom.escape(badge)}</span>` : ''}
        </div>
        ${body}
      </section>
    </div>
  `;
}

function getCustomerRows(state) {
  const customers = Array.isArray(state.runtime?.manager?.teamCustomers) && state.runtime.manager.teamCustomers.length
    ? state.runtime.manager.teamCustomers
    : (state.commerce?.customers || []);
  return customers;
}

function getProductRows(state) {
  const index = state?.commerce?.catalog?.productIndex || {};
  return Object.values(index).sort((left, right) => String(left.product_name || '').localeCompare(String(right.product_name || ''), 'ar'));
}

function getCompanyRows(state) {
  return Array.isArray(state?.commerce?.catalog?.companies) ? state.commerce.catalog.companies : [];
}

function getRepRows(state) {
  return Array.isArray(state?.runtime?.manager?.teamReps) ? state.runtime.manager.teamReps : [];
}

function renderSelectTransitions(order) {
  const transitions = Array.isArray(order.workflowActions?.executableTransitions) ? order.workflowActions.executableTransitions : [];
  if (!transitions.length) return '<span class="badge">لا توجد حالات متاحة</span>';
  return `
    <form class="ops-transition-form" data-role="workflow-transition-form">
      <select class="ops-transition-form__select" data-role="workflow-next-state">
        ${transitions.map((transition) => `<option value="${dom.escape(transition.to_state_key || '')}">${dom.escape(transition.to_state_label || transition.to_state_key || '')}</option>`).join('')}
      </select>
      <button class="btn btn--primary" type="button" data-action="workflow-transition" data-order-id="${dom.escape(String(order.id || ''))}">تأكيد</button>
    </form>
  `;
}

function renderOrdersSurface(state, model) {
  const session = state?.auth?.session || {};
  const query = getOpsSearch(state);
  const orders = (model.priorityOrders && model.priorityOrders.length ? model.priorityOrders : model.teamOrders)
    .filter((order) => {
      if (!query) return true;
      return [order.orderNumber || order.order_number || order.invoice_number || order.id, order.customerName || order.customer_name || order.name, order.repName || order.sales_rep_name || order.sales_rep_id, order.stateLabel || order.workflowStateKey || order.workflow_state_key || order.status]
        .map(normalize)
        .some((value) => value.includes(query));
    })
    .slice(0, 20)
    .map((order) => ({
      ...order,
      workflowActions: resolveWorkflowActions(order, session),
    }));
  const rows = orders.map((order) => `
    <tr>
      <td>${dom.escape(String(order.orderNumber || order.order_number || order.invoice_number || order.id || '—'))}</td>
      <td>
        <strong>${dom.escape(order.customerName || order.customer_name || order.name || '—')}</strong><br />
        <small>${dom.escape(order.repName || order.sales_rep_name || order.sales_rep_id || '')}</small>
      </td>
      <td><span class="badge">${dom.escape(order.stateLabel || getWorkflowStateLabel(order.workflowStateKey || order.workflow_state_key || order.status))}</span></td>
      <td>${dom.escape(formatMoney(Number(order.total_amount || order.total || 0)))} ج.م</td>
      <td>${renderSelectTransitions(order)}</td>
    </tr>
  `).join('');

  return renderSectionShell('الطلبات التشغيلية', 'دورة الطلبات التنفيذية مع حالات قابلة للاختيار والتأكيد', 'Orders', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث برقم الطلب أو اسم العميل أو المندوب" />
      </label>
      <div class="ops-toolbar__summary">
        <span class="badge">${dom.escape(String(orders.length))} طلب</span>
        <span class="badge">${dom.escape(String(model.counters.find((item) => item.key === 'delayed')?.value || 0))} متأخرة</span>
      </div>
      <button class="btn btn--ghost" type="button" data-action="go-checkout">فتح الإرسال</button>
    </div>
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>العميل / المندوب</th>
            <th>الحالة</th>
            <th>الإجمالي</th>
            <th>التنفيذ</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5"><div class="empty-state">لا توجد طلبات تشغيلية</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderCustomersSurface(state, model) {
  const query = getOpsSearch(state);
  const filteredCustomers = getCustomerRows(state).filter((customer) => {
    if (!query) return true;
    return [customer.name, customer.phone, customer.region, customer.address, customer.customer_type].map(normalize).some((value) => value.includes(query));
  }).slice(0, 50);
  const rows = filteredCustomers.map((customer) => {
    const latestOrder = (model.teamOrders || []).filter((order) => String(order.customer_id || '') === String(customer.id || '')).sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0] || null;
    const totalOrders = (model.teamOrders || []).filter((order) => String(order.customer_id || '') === String(customer.id || '')).length;
    return `
      <tr>
        <td>
          <strong>${dom.escape(customer.name || '—')}</strong><br />
          <small>${dom.escape(customer.customer_type || 'direct')}</small>
        </td>
        <td>${dom.escape(customer.phone || '—')}</td>
        <td>${dom.escape(customer.region || customer.address || '—')}</td>
        <td>${dom.escape(String(totalOrders))}</td>
        <td>${dom.escape(latestOrder?.order_number || latestOrder?.invoice_number || latestOrder?.id || '—')}</td>
        <td>${dom.escape(customer.is_active === false ? 'موقوف' : 'نشط')}</td>
        <td>
          <button class="btn btn--ghost" type="button" data-action="open-customer-modal">إضافة</button>
        </td>
      </tr>
    `;
  }).join('');

  return renderSectionShell('العملاء التشغيليون', 'عرض العملاء المرتبطين مع آخر حركة وملكية', 'Customers', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث باسم العميل أو الهاتف أو المنطقة" />
      </label>
      <div class="ops-toolbar__summary">
        <span class="badge">${dom.escape(String(getCustomerRows(state).length))} عميل</span>
      </div>
      <button class="btn btn--primary" type="button" data-action="open-customer-modal">إنشاء عميل</button>
    </div>
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>العميل</th>
            <th>الهاتف</th>
            <th>المنطقة / العنوان</th>
            <th>الطلبات</th>
            <th>آخر طلب</th>
            <th>الحالة</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7"><div class="empty-state">لا توجد بيانات عملاء</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderRepsSurface(state, model) {
  const query = getOpsSearch(state);
  const customerCounts = new Map();
  for (const customer of getCustomerRows(state)) {
    const key = String(customer.sales_rep_id || customer.created_by_rep_id || customer.created_by || customer.owner_user_id || '').trim();
    if (!key) continue;
    customerCounts.set(key, (customerCounts.get(key) || 0) + 1);
  }
  const orderCounts = new Map();
  for (const order of model.teamOrders || []) {
    const key = String(order.sales_rep_id || order.rep_id || order.created_by_rep_id || '').trim();
    if (!key) continue;
    orderCounts.set(key, (orderCounts.get(key) || 0) + 1);
  }

  const rows = getRepRows(state).filter((rep) => {
    if (!query) return true;
    return [rep.name, rep.phone, rep.username, rep.region].map(normalize).some((value) => value.includes(query));
  }).slice(0, 50).map((rep) => `
    <tr>
      <td><strong>${dom.escape(rep.name || '—')}</strong><br /><small>${dom.escape(rep.username || rep.phone || '')}</small></td>
      <td>${dom.escape(rep.phone || '—')}</td>
      <td>${dom.escape(rep.region || '—')}</td>
      <td>${dom.escape(String(customerCounts.get(String(rep.id || '').trim()) || 0))}</td>
      <td>${dom.escape(String(orderCounts.get(String(rep.id || '').trim()) || 0))}</td>
      <td>${dom.escape(rep.is_blocked ? 'موقوف' : rep.is_active === false ? 'غير نشط' : 'نشط')}</td>
      <td><button class="btn btn--ghost" type="button" data-action="go-customers">عرض عملائه</button></td>
    </tr>
  `).join('');

  return renderSectionShell('المناديب التشغيليون', 'متابعة الحضور الرقمي والطلبات والعملاء المرتبطين', 'Reps', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث باسم المندوب أو الهاتف" />
      </label>
      <div class="ops-toolbar__summary">
        <span class="badge">${dom.escape(String(getRepRows(state).length))} مندوب</span>
      </div>
    </div>
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>المندوب</th>
            <th>الهاتف</th>
            <th>المنطقة</th>
            <th>عملاء</th>
            <th>طلبات</th>
            <th>الحالة</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7"><div class="empty-state">لا توجد بيانات مناديب</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderCatalogSurface(state) {
  const query = getOpsSearch(state);
  const rows = getProductRows(state).filter((product) => {
    if (!query) return true;
    return [product.product_name, product.product_id, product.company_name, product.company_id, product.category].map(normalize).some((value) => value.includes(query));
  }).slice(0, 50).map((product) => `
    <tr>
      <td><strong>${dom.escape(product.product_name || '—')}</strong><br /><small>${dom.escape(product.product_id || '')}</small></td>
      <td>${dom.escape(product.company_name || product.company_id || '—')}</td>
      <td>${dom.escape(product.category || '—')}</td>
      <td>${dom.escape(String(product.visible !== false ? 'ظاهر' : 'مخفي'))}</td>
      <td>${dom.escape(String(product.status || '—'))}</td>
      <td>${dom.escape(formatMoney(Number(product.final_price || 0)))} ج.م</td>
      <td><button class="btn btn--ghost" type="button" data-action="open-product" data-product-id="${dom.escape(product.product_id)}">تعديل</button></td>
    </tr>
  `).join('');

  return renderSectionShell('الكتالوج التشغيلي', 'مراجعة المنتجات والظهور والسعر التشغيلي', 'Catalog', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث باسم المنتج أو الكود أو الشركة" />
      </label>
      <div class="ops-toolbar__summary">
        <span class="badge">${dom.escape(String(getProductRows(state).length))} منتج</span>
      </div>
    </div>
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الشركة</th>
            <th>التصنيف</th>
            <th>الظهور</th>
            <th>الحالة</th>
            <th>السعر</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7"><div class="empty-state">لا توجد منتجات</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderCompaniesSurface(state) {
  const query = getOpsSearch(state);
  const rows = getCompanyRows(state).filter((company) => {
    if (!query) return true;
    return [company.company_name, company.company_id, company.region].map(normalize).some((value) => value.includes(query));
  }).slice(0, 50).map((company) => `
    <tr>
      <td><strong>${dom.escape(company.company_name || '—')}</strong><br /><small>${dom.escape(company.company_id || '')}</small></td>
      <td>${dom.escape(company.visible !== false ? 'ظاهر' : 'مخفي')}</td>
      <td>${dom.escape(company.allow_discount === false ? 'لا' : 'نعم')}</td>
      <td>${dom.escape(company.region || '—')}</td>
      <td><button class="btn btn--ghost" type="button" data-action="go-ops-module" data-module="catalog">المنتجات</button></td>
    </tr>
  `).join('');

  return renderSectionShell('الشركات التشغيلية', 'عرض الشركات والتحكم في الظهور', 'Companies', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث باسم الشركة أو الكود" />
      </label>
      <div class="ops-toolbar__summary">
        <span class="badge">${dom.escape(String(getCompanyRows(state).length))} شركة</span>
      </div>
    </div>
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>الشركة</th>
            <th>الظهور</th>
            <th>خصم</th>
            <th>المنطقة</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5"><div class="empty-state">لا توجد شركات</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderReportsSurface(state, model) {
  const query = getOpsSearch(state);
  const rows = model.teamOrders.filter((order) => {
    if (!query) return true;
    return [order.orderNumber || order.order_number || order.id, order.customer_name || order.customerName, order.repName || order.sales_rep_name, order.workflowStateKey || order.workflow_state_key || order.status].map(normalize).some((value) => value.includes(query));
  }).slice(0, 12).map((order) => `
    <tr>
      <td>${dom.escape(String(order.orderNumber || order.order_number || order.id || '—'))}</td>
      <td>${dom.escape(order.customer_name || order.customerName || '—')}</td>
      <td>${dom.escape(order.repName || order.sales_rep_name || order.sales_rep_id || '—')}</td>
      <td>${dom.escape(order.workflowStateKey || order.workflow_state_key || order.status || 'pending')}</td>
      <td>${dom.escape(formatMoney(Number(order.total_amount || 0)))} ج.م</td>
    </tr>
  `).join('');

  return renderSectionShell('التقارير التشغيلية', 'قراءة سريعة للأداء اليومي', 'Reports', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث برقم الطلب أو العميل أو المندوب" />
      </label>
    </div>
    ${renderCounterGrid(model.counters)}
    <div class="ops-table-wrap ops-table-wrap--spaced">
      <table class="ops-table">
        <thead>
          <tr>
            <th>الطلب</th>
            <th>العميل</th>
            <th>المندوب</th>
            <th>الحالة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5"><div class="empty-state">لا توجد تقارير</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderWorkflowSurface(state, model) {
  const query = getOpsSearch(state);
  const filteredPriority = (model.priorityOrders || []).filter((order) => {
    if (!query) return true;
    return [order.orderNumber || order.order_number || order.id, order.customerName || order.customer_name || order.name, order.stateLabel || order.workflowLabel || order.workflow_state_key || order.status].map(normalize).some((value) => value.includes(query));
  });
  return renderSectionShell('سير العمل', 'الطوابير والحالات التنفيذية مع التبديل المؤكد', 'Workflow', `
    <div class="ops-toolbar">
      <label class="ops-search-field">
        <span class="sr-only">بحث</span>
        <input class="input ops-search-input" type="search" data-role="ops-search" value="${dom.escape(state?.ui?.search || '')}" placeholder="ابحث برقم الطلب أو العميل أو الحالة" />
      </label>
    </div>
    ${renderQueues(model.queues)}
    <div class="ops-table-wrap ops-table-wrap--spaced">
      <table class="ops-table">
        <thead>
          <tr><th>الطلب</th><th>العميل</th><th>الحالة</th><th>الإجمالي</th><th>الإجراء</th></tr>
        </thead>
        <tbody>${filteredPriority.slice(0, 8).map((order) => `
          <tr>
            <td>${dom.escape(String(order.orderNumber || order.id || '—'))}</td>
            <td>${dom.escape(order.customerName || '—')}</td>
            <td><span class="badge">${dom.escape(order.stateLabel || order.workflowLabel || '—')}</span></td>
            <td>${dom.escape(formatMoney(Number(order.total || order.total_amount || 0)))} ج.م</td>
            <td>${renderSelectTransitions({ ...order, workflowActions: order.workflowActions || resolveWorkflowActions(order, state.auth.session || {}) })}</td>
          </tr>
        `).join('') || '<tr><td colspan="5"><div class="empty-state">لا توجد طوابير</div></td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderDashboardHome(state, model) {
  const isReady = model.module ? isOperationalModuleReady(model.module.key) : false;
  return `
    <div class="page-stack ops-workspace">
      <section class="page-section ops-section">
        <div class="page-section__head">
          <div>
            <h2>مركز التشغيل</h2>
            <p>${dom.escape(model.module?.description || 'سطح تنفيذ يومي مستقل')}</p>
          </div>
          <span class="badge ${isReady ? 'badge--success' : ''}">${dom.escape(model.module?.label || model.moduleLabel || 'مركز التشغيل')}</span>
        </div>
        ${renderCounterGrid(model.counters)}
      </section>

      ${renderQuickActions(model.quickActions)}
      ${renderQueues(model.queues)}
      ${renderExecutionCards(model.executionCards)}
      ${renderModules(model.moduleRail)}
    </div>
  `;
}

function renderExecutionCards(cards) {
  return `
    <section class="page-section ops-section">
      <div class="page-section__head">
        <div>
          <h2>بطاقات التنفيذ</h2>
          <p>أولويات التنفيذ اليومية</p>
        </div>
        <span class="badge">${dom.escape(String(cards.length || 0))} طلب</span>
      </div>
      <div class="ops-execution-list">
        ${cards.map((card) => `
          <article class="ops-execution-card">
            <div class="ops-execution-card__head">
              <div>
                <h3>طلب #${dom.escape(String(card.orderNumber || card.id || '—'))}</h3>
                <p>${dom.escape(card.customerName || '—')}</p>
              </div>
              <span class="badge">${dom.escape(card.stateLabel || '—')}</span>
            </div>
            <div class="ops-execution-card__meta">
              <span class="chip">${dom.escape(card.total || '0')} ج.م</span>
              <span class="chip">${dom.escape(String(card.executableCount || 0))} إجراء</span>
            </div>
            <div class="ops-execution-card__footer">
              ${card.canExecute ? `<button class="btn btn--primary" type="button" data-action="workflow-transition" data-order-id="${dom.escape(String(card.id || ''))}" data-next-state-key="${dom.escape(String(card.nextStateKey || ''))}">ابدأ ${dom.escape(card.actionLabel || 'التنفيذ')}</button>` : '<span class="badge">لا توجد إجراءات متاحة</span>'}
              <button class="btn btn--ghost" type="button" data-action="view-invoice" data-invoice-id="${dom.escape(String(card.id || ''))}">عرض الفاتورة</button>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderModuleSurface(state, model) {
  const moduleKey = String(model.module?.key || model.moduleKey || '').trim();
  if (moduleKey === 'orders') return renderOrdersSurface(state, model);
  if (moduleKey === 'customers' || moduleKey === 'sales') return renderCustomersSurface(state, model);
  if (moduleKey === 'reps') return renderRepsSurface(state, model);
  if (moduleKey === 'catalog') return renderCatalogSurface(state, model);
  if (moduleKey === 'companies') return renderCompaniesSurface(state, model);
  if (moduleKey === 'reports') return renderReportsSurface(state, model);
  if (moduleKey === 'workflow') return renderWorkflowSurface(state, model);
  return null;
}

function renderSafePlaceholder(model) {
  const descriptor = model.module || getOperationalModuleByKey(model.moduleKey) || { label: model.moduleLabel || 'الوحدة التشغيلية', description: 'وحدة تشغيلية' };
  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>${dom.escape(descriptor.label || model.moduleLabel || 'الوحدة التشغيلية')}</h2>
            <p>${dom.escape(descriptor.description || 'وحدة تشغيلية')}</p>
          </div>
          <span class="badge">قريبًا</span>
        </div>
        <div class="empty-state">الوصول متاح، لكن هذه الوحدة ليست جاهزة بعد. المعروض هنا آمن ومحدود.</div>
      </section>
    </div>
  `;
}

export function renderOpsDashboardPage(state) {
  const model = createOpsDashboardModel(state);

  if (!model.canOpen) {
    return `
      <div class="page-stack">
        <section class="page-section">
          <div class="page-section__head">
            <div>
              <h2>مركز التشغيل</h2>
              <p>هذا المسار مخصص للحسابات التشغيلية المصرح لها</p>
            </div>
            <span class="badge">مقيد</span>
          </div>
          <div class="empty-state">لا توجد صلاحية تشغيلية كافية لفتح هذه المساحة.</div>
        </section>
      </div>
    `;
  }

  const isReady = model.module ? isOperationalModuleReady(model.module.key) : false;
  const moduleSurface = renderModuleSurface(state, model);
  const quickActions = model.quickActions.map((action) => {
    if (action.action === 'go-ops-module' && action.module) {
      return { ...action, action: 'go-ops-module', module: action.module };
    }
    return action;
  });

  if (moduleSurface && model.module?.key !== 'sales-manager') {
    return moduleSurface;
  }

  if (model.module && !isReady && model.module.key !== 'sales-manager') {
    return renderSafePlaceholder(model);
  }

  return renderDashboardHome(state, { ...model, quickActions });
}
