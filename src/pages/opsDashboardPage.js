import { dom } from '../core/dom.js';
import { createOpsDashboardModel } from '../services/opsDashboardService.js';
import { getOperationalModuleByKey, isOperationalModuleReady } from '../services/managerService.js';
import { renderCustomersPage } from './customerPages.js';
import { renderOpsAdminCompaniesPage } from './opsAdminCompaniesPage.js';
import { renderOpsProductPage } from './opsProductPage.js';
import { renderTeamPerformanceTable } from '../services/performanceRenderUtils.js';
import { renderSuspiciousVisitsTable, renderIntegritySummary } from '../services/integrityRenderUtils.js';
import { computeTeamPerformance } from '../services/performanceService.js';

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

function renderPriorityBadge(level) {
  const levels = { critical: 'حرج', high: 'عالية', medium: 'متوسطة', normal: 'عادية' };
  const cls = level === 'critical' ? 'badge--error' : level === 'high' ? 'badge--warning' : '';
  return `<span class="badge ${cls}">${levels[level] || level}</span>`;
}

function renderQueueItem(item) {
  const transitions = Array.isArray(item.workflowActions?.executableTransitions) ? item.workflowActions.executableTransitions : [];
  const blocked = !transitions.length;

  return `
    <article class="ops-queue-card__item">
      <div class="ops-queue-card__item-head">
        <strong>طلب #${dom.escape(String(item.orderNumber || item.id || '—'))}</strong>
        <span class="chip chip--state">${dom.escape(item.stateLabel || '—')}</span>
      </div>
      <div class="ops-queue-card__item-customer">
        <strong>${dom.escape(item.customerName || '—')}</strong>
        ${item.repName ? `<span class="chip chip--rep">مندوب: ${dom.escape(item.repName)}</span>` : ''}
      </div>
      <div class="ops-queue-card__item-meta">
        <span class="chip">${dom.escape(item.total || '0')} ج.م</span>
        <span class="chip">${dom.escape(String(item.itemCount || 0))} صنف</span>
        ${item.orderAgeLabel ? `<span class="chip chip--age">${dom.escape(item.orderAgeLabel)}</span>` : ''}
        ${item.priorityLevel ? renderPriorityBadge(item.priorityLevel) : ''}
      </div>
      <div class="ops-queue-card__item-actions">
        ${blocked
          ? `<div class="blocked-action"><span class="badge badge--muted">${dom.escape(item.noActionReason || 'غير متاح')}</span></div>`
          : transitions.map((t) =>
              `<button class="btn btn--primary btn--sm" type="button" data-action="workflow-transition" data-order-id="${dom.escape(String(item.id || ''))}" data-next-state-key="${dom.escape(String(t.to_state_key || ''))}">${dom.escape(t.to_state_label || 'تنفيذ')}</button>`
            ).join('')
        }
        <button class="btn btn--ghost btn--sm" type="button" data-action="view-invoice" data-invoice-id="${dom.escape(String(item.id || ''))}">عرض</button>
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
          <p>السطوح المتاحة حسب الصلاحيات</p>
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
        ${cards.map((card) => {
          const transitions = Array.isArray(card.executableTransitions) ? card.executableTransitions : [];
          const blocked = !transitions.length;

          return `
            <article class="ops-execution-card">
              <div class="ops-execution-card__head">
                <div>
                  <h3>طلب #${dom.escape(String(card.orderNumber || card.id || '—'))}</h3>
                  <p>
                    <strong>${dom.escape(card.customerName || '—')}</strong>
                    ${card.repName ? `<span class="chip chip--rep">مندوب: ${dom.escape(card.repName)}</span>` : ''}
                  </p>
                </div>
                <span class="chip chip--state">${dom.escape(card.stateLabel || '—')}</span>
              </div>
              <div class="ops-execution-card__meta">
                <span class="chip">${dom.escape(card.total || '0')} ج.م</span>
                <span class="chip">${dom.escape(String(card.itemCount || 0))} صنف</span>
                ${card.orderAgeLabel ? `<span class="chip chip--age">${dom.escape(card.orderAgeLabel)}</span>` : ''}
                ${card.priorityLevel ? renderPriorityBadge(card.priorityLevel) : ''}
              </div>
              <div class="ops-execution-card__footer">
                ${blocked
                  ? `<div class="blocked-action"><span class="badge badge--muted">${dom.escape(card.noActionReason || 'غير متاح')}</span></div>`
                  : transitions.map((t) =>
                      `<button class="btn btn--primary btn--sm" type="button" data-action="workflow-transition" data-order-id="${dom.escape(String(card.id || ''))}" data-next-state-key="${dom.escape(String(t.to_state_key || ''))}">${dom.escape(t.to_state_label || 'تنفيذ')}</button>`
                    ).join('')
                }
                <button class="btn btn--ghost btn--sm" type="button" data-action="view-invoice" data-invoice-id="${dom.escape(String(card.id || ''))}">عرض الفاتورة</button>
              </div>
            </article>`;
        }).join('')}
      </div>
    </section>
  `;
}


function renderModuleSurface(state, model) {
  const moduleKey = String(model.module?.key || model.moduleKey || '').trim();
  if (moduleKey === 'customers') {
    return renderCustomersPage(state);
  }
  if (moduleKey === 'companies') {
    return renderOpsAdminCompaniesPage(state);
  }
  if (moduleKey === 'catalog' || moduleKey === 'products') {
    return renderOpsProductPage(state);
  }
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

function renderTeamCoverage(coverage) {
  if (!Array.isArray(coverage) || !coverage.length) return '';
  var rows = coverage.map(function(rep) {
    return '<tr><td>' + dom.escape(rep.repName) + '</td><td>' + rep.visits + '</td><td>' + rep.completed + '</td><td>' + rep.ordered + '</td><td>' + rep.closed + '</td><td>' + rep.followUp + '</td><td>' + rep.orders + '</td><td><span class="chip">' + rep.coverage + '%</span></td></tr>';
  }).join('');
  return '<section class="page-section ops-section">' +
    '<div class="page-section__head"><div><h2>تغطية المندوبين</h2><p>زيارات اليوم وإنتاجية الفريق</p></div><span class="badge">' + coverage.length + ' مندوب</span></div>' +
    '<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>المندوب</th><th>زيارات</th><th>مكتملة</th><th>طلبات</th><th>مغلق</th><th>متابعة</th><th>فواتير</th><th>التغطية</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</section>';
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

  if (moduleSurface && model.module?.key !== 'sales-manager' && model.module?.key !== 'sales') {
    return moduleSurface;
  }

  if (model.module && !isReady && model.module.key !== 'sales-manager' && model.module.key !== 'sales') {
    return renderSafePlaceholder(model);
  }

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

      ${renderQuickActions(quickActions)}
      ${renderQueues(model.queues)}
      ${renderExecutionCards(model.executionCards)}
      ${renderTeamCoverage(model.visitCoverage)}
      ${renderIntegritySummary(model.teamVisits)}
      ${renderTeamPerformanceTable(model.teamPerformance)}
      ${renderSuspiciousVisitsTable(model.suspiciousVisits)}
      ${renderModules(model.moduleRail)}
    </div>
  `;
}
