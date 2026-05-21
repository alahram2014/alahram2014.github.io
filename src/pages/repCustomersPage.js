import { dom } from '../core/dom.js';
import { getOwnershipLabel } from '../services/repService.js';
import { renderStartVisitButton } from '../services/visitRenderUtils.js';
import { renderCustomerLocationStatus } from '../services/integrityRenderUtils.js';

export function renderRepCustomersPage(state) {
  const customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  const activeVisit = state.runtime.rep.activeVisit || null;
  if (!customers.length) return '<div class="empty-state">لا يوجد عملاء بعد</div>';
  return `
    <div class="rep-page rep-customers-page">
      <section class="page-section">
        <div class="page-section__head">
          <h2>عملائي</h2>
          <span class="badge">${customers.length}</span>
        </div>
        <div class="rep-customer-list">
          ${customers.map((c) => `
            <article class="rep-customer-card" data-action="select-customer" data-customer-id="${dom.escape(String(c.id))}">
              <div class="rep-customer-card__head">
                <strong>${dom.escape(c.name || c.business_name || '—')}</strong>
                <span class="chip chip--rep">مندوب</span>
                <button class="btn btn--xs btn--ghost" type="button" data-action="go-rep-customer-invoices" data-customer-id="${dom.escape(String(c.id))}" data-customer-name="${dom.escape(c.name || c.business_name || '')}" title="فواتير العميل">📄</button>
              </div>
              <div class="rep-customer-card__meta">
                ${c.phone ? `<span>${dom.escape(c.phone)}</span>` : ''}
                <span class="rep-ownership-label">${dom.escape(getOwnershipLabel(c))}</span>
              </div>
              <div class="rep-customer-card__actions">
                ${renderStartVisitButton(c.id, activeVisit)}
              </div>
              <div class="rep-customer-card__location">
                ${renderCustomerLocationStatus(c)}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}
