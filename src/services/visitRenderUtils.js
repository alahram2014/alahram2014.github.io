import { dom } from '../core/dom.js';
import { formatMoney } from './invoiceService.js';

function safeText(value, fallback) {
  return dom.escape(String(value ?? fallback ?? ''));
}

function visitStatusLabel(status) {
  var labels = {
    in_progress: 'جارٍ',
    completed: 'مكتملة',
    ordered: 'تم الطلب',
    no_order: 'بدون طلب',
    customer_closed: 'العميل مغلق',
    postponed: 'مؤجلة',
    follow_up_required: 'متابعة مطلوبة',
    cancelled: 'ملغية',
  };
  return labels[status] || status || '—';
}

function visitStatusClass(status) {
  var cls = {
    in_progress: 'chip--progress',
    completed: 'chip--success',
    ordered: 'chip--primary',
    no_order: 'chip--muted',
    customer_closed: 'chip--error',
    postponed: 'chip--warning',
    follow_up_required: 'chip--warning',
    cancelled: 'chip--error',
  };
  return cls[status] || '';
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch (e) { return '—'; }
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(d);
  } catch (e) { return '—'; }
}

export function renderVisitBadge(visit) {
  if (!visit) return '';
  var status = visit.visit_status || 'in_progress';
  return '<span class="chip ' + visitStatusClass(status) + '">' + safeText(visitStatusLabel(status)) + '</span>';
}

export function renderStartVisitButton(customerId, activeVisit) {
  if (activeVisit) {
    var sameCustomer = String(activeVisit.customer_id) === String(customerId);
    if (sameCustomer) {
      return '<div class="visit-active-bar"><span class="chip chip--progress">زيارة جارية</span></div>';
    }
    return '';
  }
  return '<button class="btn btn--xs btn--ghost visit-start-btn" type="button" data-action="start-visit" data-customer-id="' + dom.escape(String(customerId)) + '" title="بدء زيارة">بدء زيارة</button>';
}

export function renderEndVisitButton(visitId) {
  return '<div class="visit-end-bar">' +
    '<button class="btn btn--sm btn--primary" type="button" data-action="end-visit" data-visit-id="' + dom.escape(String(visitId)) + '" data-end-status="completed">إنهاء الزيارة</button>' +
    '<button class="btn btn--sm btn--ghost" type="button" data-action="end-visit" data-visit-id="' + dom.escape(String(visitId)) + '" data-end-status="customer_closed">العميل مغلق</button>' +
    '<button class="btn btn--sm btn--ghost" type="button" data-action="end-visit" data-visit-id="' + dom.escape(String(visitId)) + '" data-end-status="follow_up_required">متابعة</button>' +
    '</div>';
}

export function renderVisitTimeline(timeline) {
  if (!timeline || !timeline.length) return '<div class="empty-state">لا توجد زيارات اليوم</div>';

  var customerCache = {};
  function resolveCustomer(visit, fallback) {
    var cid = String(visit.customer_id || '');
    if (customerCache[cid]) return customerCache[cid];
    var name = visit.customer_name || fallback || 'عميل';
    customerCache[cid] = name;
    return name;
  }

  var html = '<div class="timeline">';
  for (var i = 0; i < timeline.length; i++) {
    var entry = timeline[i];
    var time = formatTime(entry.at);
    if (entry.type === 'visit_start') {
      var v = entry.visit;
      var name = resolveCustomer(v, 'عميل');
      html += '<div class="timeline__entry timeline__entry--start">' +
        '<span class="timeline__time">' + safeText(time) + '</span>' +
        '<span class="timeline__dot"></span>' +
        '<span class="timeline__text"><strong>بدء زيارة</strong> — ' + safeText(name) + '</span>' +
        '</div>';
    } else if (entry.type === 'order_created') {
      var o = entry.order;
      html += '<div class="timeline__entry timeline__entry--order">' +
        '<span class="timeline__time">' + safeText(time) + '</span>' +
        '<span class="timeline__dot"></span>' +
        '<span class="timeline__text">إنشاء فاتورة <strong>' + safeText(String(o.order_number || o.invoice_number || o.id || '')) + '</strong> — ' + safeText(formatMoney(o.total_amount)) + ' ج.م</span>' +
        '</div>';
    } else if (entry.type === 'visit_end') {
      var ve = entry.visit;
      var endName = resolveCustomer(ve, 'عميل');
      var dur = ve.duration_minutes ? ve.duration_minutes + ' د' : '';
      html += '<div class="timeline__entry timeline__entry--end">' +
        '<span class="timeline__time">' + safeText(time) + '</span>' +
        '<span class="timeline__dot"></span>' +
        '<span class="timeline__text"><strong>إنهاء الزيارة</strong> — ' + safeText(endName) + (dur ? ' (' + safeText(dur) + ')' : '') + '</span>' +
        '</div>';
    }
  }
  html += '</div>';
  return html;
}

export function renderVisitStats(stats) {
  return '<div class="visit-stats-grid">' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + stats.total + '</strong><span class="visit-stat-card__label">إجمالي الزيارات</span></div>' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + stats.completed + '</strong><span class="visit-stat-card__label">تمت</span></div>' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + stats.inProgress + '</strong><span class="visit-stat-card__label">جارية</span></div>' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + stats.ordered + '</strong><span class="visit-stat-card__label">طلبات</span></div>' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + safeText(formatMoney(stats.totalOrderValue)) + ' ج.م</strong><span class="visit-stat-card__label">قيمة الطلبات</span></div>' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + stats.followUp + '</strong><span class="visit-stat-card__label">متابعة</span></div>' +
    '<div class="visit-stat-card"><strong class="visit-stat-card__value">' + stats.closed + '</strong><span class="visit-stat-card__label">مغلق</span></div>' +
    '</div>';
}

export { formatTime, formatDate };
