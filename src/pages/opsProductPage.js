import { dom } from '../core/dom.js';

function unitBadge(unitCode) {
  const labels = { carton: 'كرتونة', pack: 'باكو', half_pack: 'نصف باكو', piece: 'قطعة' };
  return labels[unitCode] || unitCode;
}

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
}

function stockIndicator(stock) {
  if (stock <= 0) return '<span class="badge badge--danger">نفد</span>';
  if (stock < 10) return `<span class="badge badge--warning" title="مخزون منخفض">${stock}</span>`;
  return `<span class="badge badge--success">${stock}</span>`;
}

function filterProducts(products, query) {
  const q = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return products;
  return products.filter((p) => {
    return String(p.product_name || '').toLowerCase().includes(q)
      || String(p.product_id || '').toLowerCase().includes(q)
      || String(p.company_name || '').toLowerCase().includes(q);
  });
}

function renderEditProductPage(state) {
  const data = state.runtime.opsProducts || {};
  const products = Array.isArray(data.products) ? data.products : [];
  const editId = state.ui.opsProductEditId;
  const isNew = editId === '__new__';
  const product = isNew ? null : products.find((p) => String(p.product_id) === String(editId));

  if (!isNew && !product) {
    return '<div class="page-stack"><section class="page-section"><div class="empty-state">المنتج غير موجود</div></section></div>';
  }

  const pid = isNew ? '' : (product?.product_id || '');
  const pname = isNew ? '' : (product?.product_name || '');
  const pcompany = isNew ? '' : (product?.company_id || '');
  const pcategory = isNew ? '' : (product?.category || '');
  const pimage = isNew ? '' : (product?.product_image || '');
  const pvisible = isNew ? true : (product?.isVisible !== false);
  const pactive = isNew ? true : (product?.isActive !== false);
  const tierNames = new Set();

  if (product?.tierPrices) {
    for (const tp of product.tierPrices) {
      if (tp.tier_name) tierNames.add(tp.tier_name);
    }
  }
  if (!tierNames.size) tierNames.add('base');
  const sortedTiers = Array.from(tierNames).sort();

  const unitSections = product ? (product.unitOrder || []).map((uc) => {
    const u = product.units[uc];
    if (!u) return '';
    return `
      <div class="ops-edit-unit">
        <div class="ops-edit-unit__head">
          <strong>${unitBadge(uc)}</strong>
          <label class="ops-field ops-field--inline ops-field--sm">
            <input type="checkbox" data-unit-active="${dom.escape(uc)}" ${u.active !== false ? 'checked' : ''}>
            <span>نشط</span>
          </label>
        </div>
        <div class="ops-edit-unit__body">
          <label class="ops-field ops-field--sm">
            <span>المخزون</span>
            <input type="number" min="0" value="${u.stock}" data-unit-stock="${dom.escape(uc)}" data-product="${dom.escape(pid)}">
          </label>
          ${sortedTiers.map((t) => {
            const price = u.prices?.[t] || 0;
            return `
              <label class="ops-field ops-field--sm">
                <span>${dom.escape(t)}</span>
                <input type="number" min="0" step="0.01" value="${formatPrice(price)}" data-unit-price="${dom.escape(uc)}" data-tier="${dom.escape(t)}" data-product="${dom.escape(pid)}">
              </label>`;
          }).join('')}
        </div>
      </div>`;
  }).join('') : '';

  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>${isNew ? 'إضافة منتج جديد' : 'تعديل المنتج'}</h2>
            <p>${isNew ? 'إنشاء منتج جديد مع الوحدات والتسعير' : `${pname}`}</p>
          </div>
          <button class="btn btn--ghost" type="button" data-action="ops-product-back">رجوع</button>
        </div>
        <form data-form="ops-product-edit" id="opsProductEditForm">
          <input type="hidden" name="product_id" value="${dom.escape(pid)}">
          <div class="ops-edit-grid">
            <div class="ops-edit-col">
              <label class="ops-field">
                <span>اسم المنتج</span>
                <input type="text" name="product_name" value="${dom.escape(pname)}" required>
              </label>
              <label class="ops-field">
                <span>معرف الشركة</span>
                <input type="text" name="company_id" value="${dom.escape(pcompany)}" required>
              </label>
              <label class="ops-field">
                <span>التصنيف</span>
                <input type="text" name="category" value="${dom.escape(pcategory)}">
              </label>
              <label class="ops-field">
                <span>كود المنتج</span>
                <input type="text" name="product_code" value="${dom.escape(pid)}" ${isNew ? '' : 'readonly'} placeholder="${isNew ? 'سيتم إنشاؤه تلقائياً' : ''}">
              </label>
            </div>
            <div class="ops-edit-col">
              <label class="ops-field">
                <span>رابط الصورة</span>
                <input type="url" name="product_image" value="${dom.escape(pimage)}" data-action="ops-product-image-preview">
              </label>
              ${pimage ? `<div class="ops-image-preview"><img src="${dom.escape(pimage)}" alt="معاينة" style="max-width:120px;max-height:120px;border-radius:8px"></div>` : ''}
              <div class="ops-field-group">
                <label class="ops-field ops-field--inline">
                  <input type="checkbox" name="visible" ${pvisible ? 'checked' : ''}>
                  <span>ظاهر</span>
                </label>
                <label class="ops-field ops-field--inline">
                  <input type="checkbox" name="status_active" ${pactive ? 'checked' : ''}>
                  <span>نشط</span>
                </label>
              </div>
            </div>
          </div>

          <div class="ops-section-divider"><span>الوحدات والتسعير</span></div>
          <div id="opsEditUnits">${unitSections || '<div class="empty-state">لا توجد وحدات. أضف وحدة جديدة أدناه.</div>'}</div>

          <div class="ops-section-divider"><span>إضافة وحدة جديدة</span></div>
          <div class="ops-add-unit-row">
            <label class="ops-field ops-field--sm">
              <span>الوحدة</span>
              <select id="opsNewUnitCode">
                <option value="carton">كرتونة</option>
                <option value="pack">باكو</option>
                <option value="half_pack">نصف باكو</option>
                <option value="piece">قطعة</option>
              </select>
            </label>
            ${sortedTiers.map((t) => `
              <label class="ops-field ops-field--sm">
                <span>سعر ${dom.escape(t)}</span>
                <input type="number" min="0" step="0.01" value="0" id="opsNewUnitPrice_${dom.escape(t)}" data-tier="${dom.escape(t)}">
              </label>
            `).join('')}
            <label class="ops-field ops-field--sm">
              <span>المخزون</span>
              <input type="number" min="0" value="0" id="opsNewUnitStock">
            </label>
            <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-add-unit" data-product-id="${dom.escape(pid)}">إضافة</button>
          </div>

          <div class="ops-edit-actions">
            <button class="btn btn--ghost" type="button" data-action="ops-product-back">إلغاء</button>
            <button class="btn btn--primary" type="submit">${isNew ? 'إنشاء المنتج' : 'حفظ التعديلات'}</button>
          </div>
        </form>
      </section>
    </div>`;
}

export function renderOpsProductPage(state) {
  const data = state.runtime.opsProducts || { loaded: false, loading: false, products: [], error: null };

  if (state.ui.opsProductEditId) {
    return renderEditProductPage(state);
  }

  if (data.loading && !data.loaded) {
    return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة المنتجات</h2><p>جارٍ تحميل المنتجات…</p></div></div><div class="empty-state">جارٍ التحميل…</div></section></div>`;
  }

  if (data.error && !data.loaded) {
    return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة المنتجات</h2><p>تعذر التحميل</p></div></div><div class="empty-state empty-state--error">${dom.escape(data.error)}</div></section></div>`;
  }

  const products = Array.isArray(data.products) ? data.products : [];
  const searchQuery = state.ui.opsProductSearch || '';
  const filtered = filterProducts(products, searchQuery);

  const rows = filtered.map((p) => {
    const unitSummaries = p.unitOrder.map((uc) => {
      const u = p.units[uc];
      if (!u) return '';
      return `<span class="ops-unit-pill">${unitBadge(uc)} ${stockIndicator(u.stock)}</span>`;
    }).join('');

    return `
      <tr class="${p.isActive ? '' : 'row--inactive'}">
        <td class="ops-cell--small">${p.product_image ? `<img class="ops-product-thumb" src="${dom.escape(p.product_image)}" alt="" loading="lazy">` : '<span class="ops-empty-icon">📦</span>'}</td>
        <td>
          <strong class="ops-product-name">${dom.escape(p.product_name)}</strong>
          <small class="ops-company-name">${dom.escape(p.company_name || '')}</small>
        </td>
        <td class="ops-cell--code"><code>${dom.escape(p.product_id)}</code></td>
        <td class="ops-cell--units">${unitSummaries}</td>
        <td class="ops-cell--small"><span class="badge ${p.totalStock > 0 ? 'badge--success' : 'badge--danger'}">${p.totalStock}</span></td>
        <td class="ops-cell--small">
          <span class="badge ${p.isActive ? 'badge--success' : 'badge--danger'}">${p.isActive ? 'نشط' : 'موقوف'}</span>
          <span class="badge ${p.isVisible ? '' : 'badge--muted'}">${p.isVisible ? 'ظاهر' : 'مخفي'}</span>
        </td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-edit-page" data-product-id="${dom.escape(p.product_id)}">تعديل</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-toggle-status" data-product-id="${dom.escape(p.product_id)}" data-current-status="${dom.escape(p.status)}">${p.isActive ? 'إيقاف' : 'تفعيل'}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-toggle-visibility" data-product-id="${dom.escape(p.product_id)}" data-current-visible="${p.isVisible ? 'true' : 'false'}">${p.isVisible ? 'إخفاء' : 'إظهار'}</button>
          <button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="ops-product-delete" data-product-id="${dom.escape(p.product_id)}" data-product-name="${dom.escape(p.product_name)}">حذف</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>إدارة المنتجات</h2>
            <p>${data.loaded ? `${filtered.length} منتج` + (searchQuery ? ` (مبحث عن "${dom.escape(searchQuery)}")` : '') : ''}</p>
          </div>
          <div class="ops-header-row">
            <div class="ops-search-wrap">
              <input class="ops-search-input" type="search" placeholder="ابحث باسم المنتج أو الكود أو الشركة" value="${dom.escape(searchQuery)}" data-role="ops-product-search" autocomplete="off">
            </div>
            <button class="btn btn--primary" type="button" data-action="ops-product-create-page">إضافة منتج</button>
          </div>
        </div>
        ${!filtered.length ? '<div class="empty-state">' + (searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات') + '</div>' : `
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead>
              <tr>
                <th class="ops-cell--small"></th>
                <th>المنتج / الشركة</th>
                <th class="ops-cell--code">الكود</th>
                <th class="ops-cell--units">المخزون</th>
                <th class="ops-cell--small">إجمالي</th>
                <th class="ops-cell--small">الحالة</th>
                <th class="ops-cell--actions">إجراءات</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </section>
    </div>`;
}