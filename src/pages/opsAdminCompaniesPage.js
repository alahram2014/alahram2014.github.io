import { dom } from '../core/dom.js';

export function renderOpsAdminCompaniesPage(state) {
  const companies = Array.isArray(state.commerce?.catalog?.companies) ? state.commerce.catalog.companies : [];
  const rows = companies.map((company) => {
    const isVisible = company.visible !== false;
    return `
      <tr>
        <td class="ops-cell--small">${company.company_logo ? `<img class="ops-company-logo" src="${dom.escape(company.company_logo)}" alt="${dom.escape(company.company_name)}" loading="lazy">` : '<span class="ops-empty-icon">🏢</span>'}</td>
        <td><strong>${dom.escape(company.company_name)}</strong></td>
        <td class="ops-cell--small">${dom.escape(company.company_id)}</td>
        <td class="ops-cell--small"><span class="badge ${isVisible ? 'badge--success' : 'badge--muted'}">${isVisible ? 'ظاهر' : 'مخفي'}</span></td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-company-toggle-visibility" data-company-id="${dom.escape(company.company_id)}" data-current-visible="${isVisible ? 'true' : 'false'}">${isVisible ? 'إخفاء' : 'إظهار'}</button>
        </td>
      </tr>`;
  });

  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>إدارة الشركات</h2>
            <p>${companies.length} شركة في الكتالوج</p>
          </div>
        </div>
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead>
              <tr>
                <th class="ops-cell--small"></th>
                <th>الاسم</th>
                <th class="ops-cell--small">المعرف</th>
                <th class="ops-cell--small">الحالة</th>
                <th class="ops-cell--actions">إجراءات</th>
              </tr>
            </thead>
            <tbody>${rows.join('') || '<tr><td colspan="5"><div class="empty-state">لا توجد شركات</div></td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>`;
}
