import { dom } from '../core/dom.js';

function unitBadge(unitCode) {
  const labels = { carton: 'كرتونة', pack: 'باكو', half_pack: 'نصف باكو', piece: 'قطعة' };
  return labels[unitCode] || unitCode;
}

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
}

function stockIndicator(stock, hasLowStock) {
  if (stock <= 0) return '<span class="badge badge--danger">نفد</span>';
  if (hasLowStock) return `<span class="badge badge--warning" title="مخزون منخفض">${stock}</span>`;
  return `<span class="badge badge--success">${stock}</span>`;
}

function renderUnitOperations(product, unitCode, unit) {
  const tierPrices = Object.entries(unit.prices || {}).filter(([, v]) => v > 0);
  return `
    <div class="ops-unit-ops">
      <div class="ops-unit-ops__stock">
        <input class="ops-inline-input" type="number" min="0" value="${unit.stock}" data-ops-stock="${dom.escape(product.product_id)}:${dom.escape(unitCode)}" data-product-id="${dom.escape(product.product_id)}" data-unit-code="${dom.escape(unitCode)}" aria-label="المخزون">
        <button class="btn btn--ghost btn--xs" type="button" data-action="ops-product-save-stock" data-product-id="${dom.escape(product.product_id)}" data-unit-code="${dom.escape(unitCode)}">حفظ</button>
      </div>
      ${tierPrices.length ? `<div class="ops-unit-ops__prices">${tierPrices.map(([tier, price]) => `
        <div class="ops-tier-price-row">
          <span class="ops-tier-label">${dom.escape(tier)}</span>
          <input class="ops-inline-input ops-inline-input--price" type="number" min="0" step="0.01" value="${formatPrice(price)}" data-ops-price="${dom.escape(product.product_id)}:${dom.escape(unitCode)}:${dom.escape(tier)}" data-product-id="${dom.escape(product.product_id)}" data-unit-code="${dom.escape(unitCode)}" data-tier-name="${dom.escape(tier)}" aria-label="سعر ${dom.escape(tier)}">
          <button class="btn btn--ghost btn--xs" type="button" data-action="ops-product-save-price" data-product-id="${dom.escape(product.product_id)}" data-unit-code="${dom.escape(unitCode)}" data-tier-name="${dom.escape(tier)}">حفظ</button>
        </div>`).join('')}</div>` : ''}
    </div>`;
}

export function renderOpsProductPage(state) {
  const data = state.runtime.opsProducts || { loaded: false, loading: false, products: [], error: null };

  if (data.loading && !data.loaded) {
    return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة المنتجات</h2><p>جارٍ تحميل المنتجات…</p></div></div><div class="empty-state">جارٍ التحميل…</div></section></div>`;
  }

  if (data.error && !data.loaded) {
    return `<div class="page-stack"><section class="page-section"><div class="page-section__head"><div><h2>إدارة المنتجات</h2><p>تعذر التحميل</p></div></div><div class="empty-state empty-state--error">${dom.escape(data.error)}</div></section></div>`;
  }

  const products = Array.isArray(data.products) ? data.products : [];

  const rows = products.map((p) => {
    const unitOps = p.unitOrder.map((unitCode) => {
      const u = p.units[unitCode];
      if (!u) return '';
      const prices = Object.entries(u.prices || {}).filter(([, v]) => v > 0).map(([tier, price]) => `${dom.escape(tier)}: ${formatPrice(price)}`).join(', ');
      const summary = `<div class="ops-unit-row"><span class="ops-unit-code">${unitBadge(u.unit_code)}</span>${prices ? `<span class="ops-unit-prices">${prices}</span>` : ''}<span class="ops-unit-stock">${stockIndicator(u.stock, u.stock > 0 && u.stock < 10)}</span></div>`;
      const ops = renderUnitOperations(p, unitCode, u);
      return `<div class="ops-unit-block">${summary}${ops}</div>`;
    }).join('');

    return `
      <tr class="${p.isActive ? '' : 'row--inactive'}">
        <td class="ops-cell--small">${p.product_image ? `<img class="ops-product-thumb" src="${dom.escape(p.product_image)}" alt="${dom.escape(p.product_name)}" loading="lazy">` : '<span class="ops-empty-icon">📦</span>'}</td>
        <td>
          <strong class="ops-product-name">${dom.escape(p.product_name)}</strong>
          <small class="ops-company-name">${dom.escape(p.company_name || '')}</small>
        </td>
        <td class="ops-cell--small">${dom.escape(p.category || '—')}</td>
        <td class="ops-cell--units">${unitOps}</td>
        <td class="ops-cell--small">
          <span class="badge ${p.isActive ? 'badge--success' : 'badge--danger'}">${p.isActive ? 'نشط' : 'موقوف'}</span>
          <span class="badge ${p.isVisible ? '' : 'badge--muted'}">${p.isVisible ? 'ظاهر' : 'مخفي'}</span>
        </td>
        <td class="ops-cell--actions">
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-toggle-status" data-product-id="${dom.escape(p.product_id)}" data-current-status="${dom.escape(p.status)}">${p.isActive ? 'إيقاف' : 'تفعيل'}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-toggle-visibility" data-product-id="${dom.escape(p.product_id)}" data-current-visible="${p.isVisible ? 'true' : 'false'}">${p.isVisible ? 'إخفاء' : 'إظهار'}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="ops-product-edit" data-product-id="${dom.escape(p.product_id)}" data-product-name="${dom.escape(p.product_name)}" data-product-status="${dom.escape(p.status)}" data-product-visible="${p.isVisible ? 'true' : 'false'}" data-product-image="${dom.escape(p.product_image || '')}" data-product-category="${dom.escape(p.category || '')}" data-company-id="${dom.escape(p.company_id || '')}">تعديل</button>
          <button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="ops-product-delete" data-product-id="${dom.escape(p.product_id)}" data-product-name="${dom.escape(p.product_name)}">حذف</button>
        </td>
      </tr>`;
  });

  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>إدارة المنتجات</h2>
            <p>${data.loaded ? `${products.length} منتج` : ''}</p>
          </div>
          <button class="btn btn--primary" type="button" data-action="ops-product-create">إضافة منتج</button>
        </div>
        ${!products.length ? '<div class="empty-state">لا توجد منتجات</div>' : `
        <div class="ops-table-wrapper">
          <table class="ops-table">
            <thead>
              <tr>
                <th class="ops-cell--small"></th>
                <th>المنتج</th>
                <th class="ops-cell--small">التصنيف</th>
                <th class="ops-cell--units">الوحدات / المخزون / التسعير</th>
                <th class="ops-cell--small">الحالة</th>
                <th class="ops-cell--actions">إجراءات</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </section>
    </div>

    <div class="ops-modal-overlay" id="opsProductModal" style="display:none">
      <div class="ops-modal ops-modal--wide">
        <div class="ops-modal__head">
          <h3 id="opsProductModalTitle">إدارة المنتج</h3>
          <button class="btn btn--ghost" type="button" data-action="ops-product-modal-close">✕</button>
        </div>
        <form data-form="ops-product" id="opsProductForm">
          <input type="hidden" name="product_id" id="opsProductId">
          <div class="ops-modal__grid">
            <div class="ops-modal__col">
              <label class="ops-field">
                <span>اسم المنتج</span>
                <input type="text" name="product_name" id="opsProductName" required>
              </label>
              <label class="ops-field">
                <span>معرف الشركة</span>
                <input type="text" name="company_id" id="opsProductCompanyId" required>
              </label>
              <label class="ops-field">
                <span>التصنيف</span>
                <input type="text" name="category" id="opsProductCategory">
              </label>
              <label class="ops-field">
                <span>رابط الصورة</span>
                <input type="url" name="product_image" id="opsProductImage" data-action="ops-product-image-preview">
              </label>
              <div class="ops-image-preview" id="opsImagePreview" style="display:none">
                <img id="opsImagePreviewImg" alt="معاينة الصورة" style="max-width:120px;max-height:120px;border-radius:8px">
              </div>
              <div class="ops-field-group">
                <label class="ops-field ops-field--inline">
                  <input type="checkbox" name="visible" id="opsProductVisible" checked>
                  <span>ظاهر في الكتالوج</span>
                </label>
                <label class="ops-field ops-field--inline">
                  <input type="checkbox" name="status_active" id="opsProductActive" checked>
                  <span>نشط</span>
                </label>
              </div>
            </div>
            <div class="ops-modal__col" id="opsProductUnitPrices"></div>
          </div>
          <div class="ops-modal__actions">
            <button class="btn btn--ghost" type="button" data-action="ops-product-modal-close">إلغاء</button>
            <button class="btn btn--primary" type="submit">حفظ</button>
          </div>
        </form>
      </div>
    </div>`;
}
