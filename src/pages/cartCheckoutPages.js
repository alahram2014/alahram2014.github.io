import { dom } from '../core/dom.js';
import { formatMoney } from '../services/invoiceService.js';
import { generateInvoicePDF } from '../services/pdfService.js';
import { computeCartTotals, getSelectedTier, getActiveCustomer } from '../state/selectors.js';
import { isSalesRepSession, normalizeSessionRecord } from '../services/authService.js';
import { canViewInvoice } from '../services/ownershipService.js';
import { isOrderEditable } from '../services/orderService.js';
import {
  renderInvoiceHeader, renderInvoiceItemsTable, renderInvoiceTotals,
  renderInvoiceActions, renderInvoiceLoading, renderInvoiceEmpty,
  groupItemsByCompany
} from '../services/invoiceRenderUtils.js';

function renderCartLine(item) {
  const qty = Number(item.qty || 1);
  const unitPrice = Number(item.price || 0);
  const lineTotal = qty * unitPrice;
  return `
    <article class="invoice-line invoice-line--editable">
      <div class="invoice-line__thumb">
        ${item.image ? `<img src="${item.image}" alt="${item.title || ''}" loading="lazy" />` : '<span>•</span>'}
      </div>
      <div class="invoice-line__content">
        <div class="invoice-line__top">
          <div>
            <h3>${item.title || ''}</h3>
            <p>${item.unitLabel || item.unit || ''}</p>
          </div>
          <strong>${formatMoney(lineTotal)} ج.م</strong>
        </div>
        <div class="invoice-line__meta">
          <span>سعر الوحدة ${formatMoney(unitPrice)} ج.م</span>
          <span>الكمية ${qty}</span>
        </div>
        <div class="invoice-line__actions">
          <div class="qty-stepper qty-stepper--invoice ${item.type === 'product' ? '' : 'is-disabled'}">
            ${item.type === 'product' ? `<button type="button" data-action="qty-down" data-key="${item.key}">-</button><input type="number" min="1" value="${qty}" data-role="cart-qty" data-key="${item.key}" /><button type="button" data-action="qty-up" data-key="${item.key}">+</button>` : ''}
          </div>
          <button class="btn btn--ghost" type="button" data-action="remove-item" data-key="${item.key}">حذف</button>
        </div>
      </div>
    </article>
  `;
}

function progressPct(total, minOrder) {
  if (!Number(minOrder)) return 100;
  return Math.max(0, Math.min(100, (Number(total || 0) / Number(minOrder || 1)) * 100));
}


function renderSelectionGuard(state) {
  const session = state?.auth?.session || null;
  const selectedCustomer = state?.auth?.selectedCustomer || null;
  if (!isSalesRepSession(session) || selectedCustomer) return '';
  return `
    <section class="page-section invoice-hero invoice-hero--blocked">
      <div class="invoice-hero__head">
        <div>
          <h2>اختر العميل أولًا</h2>
          <p>لا يمكن إتمام الطلب قبل اختيار عميل مرتبط بالمندوب.</p>
        </div>
      </div>
      <div class="empty-state empty-state--actionable">
        <div>الطلبات التشغيلية للمندوب تحتاج عميلًا محددًا قبل عرض الإجماليات أو متابعة الإرسال.</div>
        <button class="btn btn--primary" type="button" data-action="go-customers">الانتقال إلى العملاء</button>
      </div>
    </section>
  `;
}

function renderInvoiceLayout({ state, totals, tier, customer, itemsHtml, title, subtitle, actionLabel, actionDisabled, actionAttr, footerNote, invoiceId = null, compact = false }) {
  const remaining = Math.max(0, Number(tier.min_order || 0) - Number(totals.grand || 0));
  const progress = progressPct(totals.grand, tier.min_order);
  return `
    <div class="page-stack checkout-page checkout-page--full invoice-page ${compact ? 'invoice-page--compact' : ''}">
      <section class="page-section invoice-hero">
        <div class="invoice-hero__head">
          <div>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
          ${invoiceId ? `<div class="badge">#${invoiceId}</div>` : ''}
        </div>
        <div class="invoice-hero__grid">
          <div class="invoice-hero__block">
            <span>الشريحة</span>
            <strong>${tier.visible_label || tier.tier_name}</strong>
          </div>
          <div class="invoice-hero__block">
            <span>العميل</span>
            <strong>${customer?.name || 'غير محدد'}</strong>
          </div>
          <div class="invoice-hero__block invoice-hero__block--total">
            <span>إجمالي السلة</span>
            <strong>${formatMoney(totals.grand)} ج.م</strong>
          </div>
          ${tier.tier_name && tier.tier_name !== 'base' ? `<div class="invoice-hero__block"><span>المتبقي للشريحة</span><strong>${formatMoney(remaining)} ج.م</strong></div>` : ''}
        </div>
        <div class="checkout-progress"><span style="width:${progress}%"></span></div>
      </section>
      <section class="page-section invoice-lines">
        <div class="page-section__head page-section__head--tight"><div><h2>تفاصيل الطلب</h2><p>كل صنف في سطر مستقل</p></div></div>
        <div class="checkout-items invoice-items">${itemsHtml}</div>
      </section>
      <section class="page-section invoice-action">
        <div class="invoice-action__bar">
          <div>
            <span>${footerNote || 'مراجعة نهائية قبل الإرسال'}</span>
            <strong>${formatMoney(totals.grand)} ج.م</strong>
          </div>
          ${actionAttr ? `<button class="btn btn--primary" type="button" ${actionAttr} ${actionDisabled ? 'disabled' : ''}>${actionLabel}</button>` : ''}
        </div>
      </section>
    </div>
  `;
}

export function renderCartPage(state) {
  const session = state?.auth?.session || null;
  const selectedCustomer = state?.auth?.selectedCustomer || null;
  if (isSalesRepSession(session) && !selectedCustomer) {
    return `
      <div class="page-stack checkout-page checkout-page--full">
        ${renderSelectionGuard(state)}
      </div>
    `;
  }

  const totals = computeCartTotals(state);
  const items = state.commerce.cart;
  const tier = getSelectedTier(state);
  const remaining = Math.max(0, Number(tier.min_order || 0) - Number(totals.grand || 0));
  const progress = progressPct(totals.grand, tier.min_order);
  return `
    <div class="page-stack">
      <section class="page-section">
        <div class="page-section__head"><div><h2>السلة</h2><p>عناصر الطلب الحالية</p></div></div>
        <div class="summary-box summary-box--compact">
          <div><span>الشريحة الحالية</span><strong>${tier.visible_label || tier.tier_name}</strong></div>
          <div><span>الإجمالي</span><strong>${formatMoney(totals.grand)} ج.م</strong></div>
          ${tier.tier_name && tier.tier_name !== 'base' ? `<div><span>المتبقي لتحقيق الشريحة</span><strong>${formatMoney(remaining)} ج.م</strong></div>` : ''}
          <div class="checkout-progress"><span style="width:${progress}%"></span></div>
        </div>
        <div class="cart-list">
          ${items.length ? items.map(renderCartLine).join('') : '<div class="empty-state">السلة فارغة</div>'}
        </div>
      </section>
      <section class="page-section page-section--summary">
        <div class="summary-box">
          <div><span>الشريحة</span><strong>${tier.visible_label || tier.tier_name}</strong></div>
          ${tier.tier_name && tier.tier_name !== 'base' ? `<div><span>المتبقي لتحقيق الشريحة</span><strong>${formatMoney(remaining)} ج.م</strong></div>` : ''}
          <div><span>الإجمالي</span><strong>${formatMoney(totals.grand)} ج.م</strong></div>
          <div><span>المنتجات</span><strong>${formatMoney(totals.products)} ج.م</strong></div>
          <div><span>الصفقات</span><strong>${formatMoney(totals.deals + totals.flash)} ج.م</strong></div>
          <button class="btn btn--primary" type="button" data-action="go-checkout">إتمام الشراء</button>
        </div>
      </section>
    </div>
  `;
}

export function renderCheckoutPage(state) {
  const session = state?.auth?.session || null;
  const selectedCustomer = state?.auth?.selectedCustomer || null;
  if (isSalesRepSession(session) && !selectedCustomer) {
    return `
      <div class="page-stack checkout-page checkout-page--full">
        ${renderSelectionGuard(state)}
      </div>
    `;
  }

  const totals = computeCartTotals(state);
  const tier = getSelectedTier(state);
  const customer = getActiveCustomer(state) || state.auth.session;
  const itemsHtml = (state.commerce.cart || []).length ? (state.commerce.cart || []).map(renderCartLine).join('') : '<div class="empty-state">السلة فارغة</div>';
  const editingId = state.ui.editingInvoiceId;
  return renderInvoiceLayout({
    state,
    totals,
    tier,
    customer,
    itemsHtml,
    title: editingId ? 'تعديل الفاتورة' : 'مراجعة الطلب',
    subtitle: editingId ? 'تعديل الفاتورة الحالية وحفظ التغييرات' : 'نموذج إرسال الطلب على هيئة فاتورة تشغيلية واحدة',
    actionLabel: state.ui.checkoutBusy ? 'جارٍ الحفظ…' : (editingId ? 'حفظ التعديلات' : 'إرسال الطلب'),
    actionDisabled: state.ui.checkoutBusy,
    actionAttr: 'data-action="submit-checkout"',
    footerNote: editingId ? 'سيتم حفظ التعديلات على الفاتورة الحالية' : 'أرسل الطلب بعد مراجعة الكميات والأسعار',
    invoiceId: editingId,
  });
}

export function renderInvoicePage(state) {
  const invoiceId = state.app.route.params.invoiceId || state.ui.selectedInvoiceId;
  const session = normalizeSessionRecord(state.auth.session);
  if (state.runtime.loading.invoices) {
    return renderInvoiceLoading();
  }
  const invoice = (state.commerce.invoices || []).find((item) => String(item.id) === String(invoiceId));
  if (!invoice || (session && !canViewInvoice(session, invoice))) {
    return renderInvoiceEmpty();
  }

  const items = state.commerce.invoiceItemsById?.[String(invoice.id)] || [];
  const groupedItems = groupItemsByCompany(items);
  const totalAmount = Number(invoice.total_amount || 0);
  const invoiceNum = invoice.order_number || invoice.invoice_number || invoice.id;
  const invoiceData = encodeURIComponent(JSON.stringify({ invoice, items, groupedItems }));
  const isPending = isOrderEditable(invoice);

  return `
    <div class="invoice-detail">
      ${renderInvoiceHeader(invoice, invoiceNum)}
      ${renderInvoiceItemsTable(groupedItems)}
      ${renderInvoiceTotals(totalAmount)}
      ${renderInvoiceActions(invoiceData, isPending, invoice.id)}
    </div>
  `;
}
