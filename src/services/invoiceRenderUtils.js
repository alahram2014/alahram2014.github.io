import { dom } from '../core/dom.js';
import { formatMoney } from './invoiceService.js';

export function safeText(value, fallback = '') {
  return dom.escape(String(value ?? fallback));
}

export function safeCurrency(amount) {
  const num = Number(amount || 0);
  if (!isFinite(num)) return `${formatMoney(0)} ج.م`;
  return `${formatMoney(num)} ج.م`;
}

export function safeDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(d);
  } catch { return '—'; }
}

export function safeTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-EG', { timeStyle: 'short' }).format(d);
  } catch { return '—'; }
}

export function safeTableCell(content) {
  return `<td>${content}</td>`;
}

export function safeTableHeader(label) {
  return `<th>${safeText(label)}</th>`;
}

export function renderGroupHeader(companyName) {
  return `<tr class="invoice-detail__group-header"><td colspan="5"><span class="invoice-detail__group-line"></span><strong>${safeText(companyName || 'شركة')}</strong></td></tr>`;
}

export function renderItemRow(item) {
  const qty = Number(item.qty || 1);
  const unitPrice = Number(item.price || 0);
  const lineTotal = qty * unitPrice;
  return `<tr>
    <td>${safeText(item.product_name_snapshot || item.product_name || item.title || item.name)}</td>
    <td>${safeText(item.unit_name_snapshot || item.unitLabel || item.unit || 'قطعة')}</td>
    <td>${qty}</td>
    <td>${safeCurrency(unitPrice)}</td>
    <td>${safeCurrency(lineTotal)}</td>
  </tr>`;
}

export function renderCompanyGroup(group) {
  let html = renderGroupHeader(group.companyName);
  for (const item of group.items) {
    html += renderItemRow(item);
  }
  return html;
}

export function renderInvoiceHeader(invoice, invoiceNum) {
  const dateStr = safeDate(invoice.created_at);
  const timeStr = safeTime(invoice.created_at);
  const customerName = invoice.customer_name_snapshot || invoice.customer_name || '';
  return `
    <div class="invoice-detail__company">شركة الأهرام للتجارة والتوزيع</div>
    <div class="invoice-detail__header">
      <div class="invoice-detail__header-main">
        <h2 class="invoice-detail__title">فاتورة ضريبية</h2>
        <p class="invoice-detail__customer">${safeText(customerName)}</p>
      </div>
      <div class="invoice-detail__header-meta">
        <div class="invoice-detail__meta-block">
          <span>رقم الفاتورة</span>
          <strong>${safeText(String(invoiceNum))}</strong>
        </div>
        <div class="invoice-detail__meta-block">
          <span>التاريخ</span>
          <strong>${safeText(dateStr)}</strong>
        </div>
        <div class="invoice-detail__meta-block">
          <span>الوقت</span>
          <strong>${safeText(timeStr)}</strong>
        </div>
      </div>
    </div>`;
}

export function renderInvoiceItemsTable(groupedItems) {
  if (!groupedItems || !groupedItems.length) {
    return `<div class="invoice-detail__table-wrap">
      <table class="invoice-detail__table">
        <thead><tr><th>اسم الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody><tr><td colspan="5"><div class="empty-state">لا توجد أصناف في هذه الفاتورة</div></td></tr></tbody>
      </table>
    </div>`;
  }
  let tableBody = '';
  for (const group of groupedItems) {
    tableBody += renderCompanyGroup(group);
  }
  return `<div class="invoice-detail__table-wrap">
    <table class="invoice-detail__table">
      <thead>
        <tr><th>اسم الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>${tableBody}</tbody>
    </table>
  </div>`;
}

export function renderInvoiceTotals(totalAmount) {
  return `<div class="invoice-detail__total">
    <span>إجمالي المبلغ المستحق</span>
    <strong>${safeCurrency(totalAmount)}</strong>
  </div>`;
}

export function renderInvoiceActions(invoiceDataEncoded, isPending = false, invoiceId = '') {
  const pendingActions = isPending ? `
    <button class="btn btn--danger" type="button" data-action="delete-invoice" data-invoice-id="${dom.escape(invoiceId)}">حذف الفاتورة</button>
  ` : '';
  return `<div class="invoice-detail__actions">
    <button class="btn btn--primary" type="button" data-action="download-invoice-pdf" data-invoice-data="${dom.escape(invoiceDataEncoded)}">تحميل PDF</button>
    ${pendingActions}
    <button class="btn btn--ghost" type="button" data-action="go-invoices">عودة إلى الفواتير</button>
  </div>`;
}

export function renderInvoiceLoading() {
  return `<div class="invoice-detail"><div class="empty-state"><div class="invoice-detail__loading">جارٍ تحميل الفاتورة…</div></div></div>`;
}

export function renderInvoiceEmpty() {
  return `<div class="invoice-detail"><div class="empty-state">الفاتورة غير متاحة</div></div>`;
}

export function groupItemsByCompany(items) {
  const groups = [];
  const map = {};
  for (const item of Array.isArray(items) ? items : []) {
    const companyId = String(item.company_id_snapshot || item.company_id || '0');
    if (!map[companyId]) {
      map[companyId] = { companyId, companyName: item.company_name_snapshot || item.company_name || '', items: [] };
      groups.push(map[companyId]);
    }
    map[companyId].items.push(item);
  }
  return groups;
}
