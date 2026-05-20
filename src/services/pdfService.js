export function generateInvoicePDF(invoice, groupedItems, companies) {
  const companyNames = new Map(
    (Array.isArray(companies) ? companies : [])
      .map((c) => [String(c.company_id || c.id), c.company_name || c.name || ''])
  );

  const now = new Date(invoice.created_at || Date.now());
  const dateStr = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(now);
  const timeStr = new Intl.DateTimeFormat('ar-EG', { timeStyle: 'short' }).format(now);
  const invoiceNumber = invoice.order_number || invoice.invoice_number || invoice.id;
  const total = Number(invoice.total_amount || 0);

  let tableRows = '';
  for (const group of groupedItems) {
    const companyName = companyNames.get(String(group.companyId)) || group.companyName || 'شركة';
    tableRows += `<tr class="company-group-header"><td colspan="5"><strong>${escapeHtml(companyName)}</strong></td></tr>`;
    for (const item of group.items) {
      const lineTotal = Number(item.qty || 1) * Number(item.price || 0);
      tableRows += `<tr>
        <td>${escapeHtml(item.product_name_snapshot || item.product_name || item.title || item.name || '')}</td>
        <td>${escapeHtml(item.unit_name_snapshot || item.unitLabel || item.unit || 'قطعة')}</td>
        <td>${Number(item.qty || 1)}</td>
        <td>${formatNum(Number(item.price || 0))} ج.م</td>
        <td>${formatNum(lineTotal)} ج.م</td>
      </tr>`;
    }
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة #${escapeHtml(String(invoiceNumber))}</title>
<style>
  @page { margin: 2cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 12pt; color: #222; line-height: 1.6; padding: 20px; }
  .invoice-header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0052cc; }
  .invoice-header h1 { font-size: 18pt; color: #0052cc; margin-bottom: 4px; }
  .invoice-header .meta { font-size: 10pt; color: #666; }
  .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 6px; page-break-inside: avoid; }
  .invoice-info div span { display: block; font-size: 9pt; color: #888; }
  .invoice-info div strong { display: block; font-size: 11pt; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead { display: table-header-group; }
  tbody { display: table-row-group; }
  tfoot { display: table-footer-group; }
  th { background: #0052cc; color: #fff; padding: 10px 8px; font-size: 10pt; text-align: center; }
  td { padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 10pt; text-align: center; }
  tbody tr { page-break-inside: avoid; }
  .company-group-header td { background: #eef4ff; font-weight: bold; text-align: right; padding: 6px 12px; font-size: 10pt; border-bottom: 2px solid #0052cc; }
  .company-group-header { page-break-inside: avoid; }
  .total-row td { font-weight: bold; font-size: 12pt; border-top: 2px solid #0052cc; background: #f0f5ff; padding: 12px 8px; }
  .total-row { page-break-inside: avoid; }
  .footer { text-align: center; margin-top: 30px; font-size: 9pt; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="invoice-header">
  <h1>فاتورة شراء</h1>
  <div class="meta">فاتورة رقم ${escapeHtml(String(invoiceNumber))}</div>
</div>
<div class="invoice-info">
  <div><span>اسم العميل</span><strong>${escapeHtml(String(invoice.customer_name_snapshot || invoice.customer_name || invoice.name || ''))}</strong></div>
  <div><span>التاريخ</span><strong>${escapeHtml(dateStr)}</strong></div>
  <div><span>الوقت</span><strong>${escapeHtml(timeStr)}</strong></div>
</div>
<table>
  <thead><tr><th>اسم الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot><tr class="total-row"><td colspan="4" style="text-align:left;">إجمالي مبلغ الفاتورة</td><td>${formatNum(total)} ج.م</td></tr></tfoot>
</table>
<div class="footer">تم إنشاؤه بواسطة متجر الأهرام للتجارة والتوزيع</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { try { printWindow.print(); } catch (e) { void e; } }, 500);
}

function formatNum(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(value || 0)));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
