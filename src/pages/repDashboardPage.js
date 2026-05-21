import { dom } from '../core/dom.js';
import { formatMoney } from '../services/invoiceService.js';
import { renderStartVisitButton } from '../services/visitRenderUtils.js';
import { renderVisitTrustBadge, renderVisitDistanceBadge, renderCustomerLocationStatus } from '../services/integrityRenderUtils.js';
import { computeRepPerformance, getDailyGoal } from '../services/performanceService.js';

function safe(value, fallback) {
  return dom.escape(String(value ?? fallback ?? ''));
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch (e) { return '—'; }
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  var then = new Date(dateStr);
  if (isNaN(then.getTime())) return 999;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

function confidenceLevel(score) {
  if (score == null) return { label: '—', cls: '' };
  if (score >= 80) return { label: 'موثوق', cls: 'badge--success' };
  if (score >= 50) return { label: 'متوسط', cls: 'badge--warning' };
  return { label: 'ضعيف', cls: 'badge--error' };
}

function priorityBadge(days) {
  if (days <= 1) return { label: 'عالية', cls: 'badge--success' };
  if (days <= 7) return { label: 'متوسطة', cls: 'badge--warning' };
  return { label: 'منخفضة', cls: 'badge--muted' };
}

function customerLastActivity(customer) {
  return customer.last_visit_at || customer.updated_at || customer.created_at || null;
}

function convertRate(orders, visits) {
  var vLen = Array.isArray(visits) ? visits.length : 0;
  if (vLen === 0) return 0;
  var completed = visits.filter(function(v) { var s = (v.visit_status || '').toLowerCase(); return s === 'completed' || s === 'ordered'; }).length;
  return vLen > 0 ? Math.round((completed / vLen) * 100) : 0;
}

function section(title, subtitle, content, extra) {
  return '<section class="ops-section">' +
    '<div class="ops-section__head">' +
    '<div><h3>' + safe(title) + '</h3>' + (subtitle ? '<p>' + safe(subtitle) + '</p>' : '') + '</div>' +
    (extra || '') +
    '</div>' + content + '</section>';
}

function renderLiveOpBar(state) {
  var session = state.auth.session;
  var customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  var orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  var visits = Array.isArray(state.runtime.rep.visits) ? state.runtime.rep.visits : [];
  var activeVisit = state.runtime.rep.activeVisit || null;
  var todayOrders = orders.filter(function(o) {
    if (!o.created_at) return false;
    var d = new Date(o.created_at);
    var now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  var totalSales = todayOrders.reduce(function(s, o) { return s + Number(o.total_amount || 0); }, 0);
  var conv = convertRate(todayOrders, visits);
  var done = visits.filter(function(v) { var s = (v.visit_status || '').toLowerCase(); return s === 'completed' || s === 'ordered'; }).length;

  var visitHtml = '';
  if (activeVisit) {
    var cid = activeVisit.customer_id || '';
    var ac = customers.find(function(c) { return String(c.id) === String(cid); });
    var cname = ac ? (ac.name || ac.business_name || '') : '';
    var dur = activeVisit.duration_minutes ? activeVisit.duration_minutes + ' د' : (activeVisit.started_at ? Math.floor((Date.now() - new Date(activeVisit.started_at).getTime()) / 60000) + ' د' : '—');
    var conf = activeVisit.visit_confidence_score != null ? renderVisitTrustBadge(activeVisit) : '';
    var dist = activeVisit.visit_distance_meters != null ? renderVisitDistanceBadge(activeVisit) : '';
    visitHtml = '<div class="ops-live-bar__visit">' +
      '<div class="ops-live-visit__head">' +
      '<span class="ops-live-indicator"></span><strong class="ops-live-visit__label">زيارة جارية الآن</strong>' +
      '</div>' +
      '<div class="ops-live-visit__body">' +
      '<div class="ops-live-visit__customer"><strong>' + safe(cname || activeVisit.customer_id) + '</strong></div>' +
      '<div class="ops-live-visit__meta"><span>⏱ ' + safe(dur) + '</span>' + conf + dist + '</div>' +
      '<div class="ops-live-visit__actions">' +
      '<button class="btn btn--sm btn--primary" type="button" data-action="go-checkout">➕ طلب جديد</button>' +
      '<button class="btn btn--sm btn--ghost" type="button" data-action="end-visit" data-visit-id="' + safe(activeVisit.id) + '" data-end-status="completed">إنهاء الزيارة</button>' +
      '</div>' +
      '</div></div>';
  }

  return '<div class="ops-live-bar">' +
    visitHtml +
    '<div class="ops-live-bar__stats">' +
    '<div class="ops-live-stat"><strong>' + done + '</strong><span>زيارات اليوم</span></div>' +
    '<div class="ops-live-stat"><strong>' + todayOrders.length + '</strong><span>طلبات اليوم</span></div>' +
    '<div class="ops-live-stat"><strong>' + safe(formatMoney(totalSales)) + '</strong><span>مبيعات</span></div>' +
    '<div class="ops-live-stat"><strong>' + conv + '%</strong><span>تحويل</span></div>' +
    '</div>' +
    '<div class="ops-live-bar__actions">' +
    '<button class="btn btn--sm btn--primary" type="button" data-action="go-rep-customers">👥 عملائي</button>' +
    '<button class="btn btn--sm btn--ghost" type="button" data-action="go-checkout">🛒 طلب جديد</button>' +
    '</div>' +
    '</div>';
}

function renderPerfStrip(state) {
  var session = state.auth.session;
  var customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  var orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  var visits = Array.isArray(state.runtime.rep.visits) ? state.runtime.rep.visits : [];
  var sessionId = session?.id || '';
  var perf = visits.length || orders.length ? computeRepPerformance(sessionId, visits, orders, customers, 'today') : null;
  if (!perf) return '';

  var rankings = Array.isArray(state.runtime.rep.rankings) ? state.runtime.rep.rankings : [];
  var rank = rankings.find(function(r) { return String(r.repId) === String(sessionId); });
  var rankStr = rank ? '#' + rank.rank : '—';

  return '<div class="ops-perf-strip">' +
    '<div class="ops-perf-cell"><strong>' + safe(formatMoney(perf.totalSales)) + '</strong><span>المبيعات</span></div>' +
    '<div class="ops-perf-cell"><strong>' + perf.totalVisits + '</strong><span>الزيارات</span></div>' +
    '<div class="ops-perf-cell"><strong>' + perf.conversionRate + '%</strong><span>التحويل</span></div>' +
    '<div class="ops-perf-cell"><strong>' + perf.customerCoverage + '%</strong><span>التغطية</span></div>' +
    '<div class="ops-perf-cell"><strong>' + rankStr + '</strong><span>الترتيب</span></div>' +
    '</div>';
}

function renderCompetition(state) {
  var rankings = Array.isArray(state.runtime.rep.rankings) ? state.runtime.rep.rankings : [];
  if (!rankings.length) return '';
  var sessionId = state.auth.session?.id || '';
  var currentRep = rankings.find(function(r) { return String(r.repId) === String(sessionId); });

  var rows = rankings.slice(0, 5).map(function(p) {
    var isCurrent = String(p.repId) === String(sessionId);
    var medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '<span class="ops-rank-num">' + p.rank + '</span>';
    var gap = currentRep && !isCurrent && currentRep.rank > p.rank ? '<span class="ops-rank-gap">-' + (p.score - currentRep.score) + '</span>' : '';
    return '<div class="ops-rank-row' + (isCurrent ? ' ops-rank-row--me' : '') + '">' +
      '<span class="ops-rank-pos">' + medal + '</span>' +
      '<span class="ops-rank-name">' + safe(p.repName) + '</span>' +
      '<span class="ops-rank-score">' + p.score + '</span>' +
      '<span class="ops-rank-sales">' + safe(formatMoney(p.totalSales)) + '</span>' +
      '<span class="ops-rank-conv">' + (p.conversionRate || 0) + '%</span>' +
      gap +
      '</div>';
  }).join('');

  return section('المنافسة', 'ترتيب الأداء التشغيلي', '<div class="ops-rank-grid">' +
    '<div class="ops-rank-header"><span>#</span><span>المندوب</span><span>النقاط</span><span>المبيعات</span><span>التحويل</span></div>' + rows + '</div>',
    rankings.length ? '<span class="badge">' + rankings.length + ' مندوب</span>' : '');
}

function renderCustomerQueue(state) {
  var customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  var visits = Array.isArray(state.runtime.rep.visits) ? state.runtime.rep.visits : [];
  var orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  var activeVisit = state.runtime.rep.activeVisit || null;
  if (!customers.length) return '';

  var visitByCustomer = {};
  visits.forEach(function(v) { visitByCustomer[String(v.customer_id)] = v; });
  var lastOrderByCustomer = {};
  orders.forEach(function(o) {
    var cid = String(o.customer_id || o.user_id || '');
    if (cid && (!lastOrderByCustomer[cid] || o.created_at > lastOrderByCustomer[cid].created_at)) {
      lastOrderByCustomer[cid] = o;
    }
  });

  var sorted = customers.slice().sort(function(a, b) {
    var aDays = daysSince(customerLastActivity(a));
    var bDays = daysSince(customerLastActivity(b));
    return aDays - bDays;
  });

  var cards = sorted.slice(0, 20).map(function(c) {
    var cid = String(c.id);
    var visit = visitByCustomer[cid];
    var lastOrder = lastOrderByCustomer[cid];
    var lastActivity = customerLastActivity(c);
    var days = daysSince(lastActivity);
    var prio = priorityBadge(days);
    var locStatus = renderCustomerLocationStatus(c);
    var conf = visit && visit.visit_confidence_score != null ? renderVisitTrustBadge(visit) : '';
    var distance = visit && visit.visit_distance_meters != null ? renderVisitDistanceBadge(visit) : '';

    return '<div class="ops-queue-item">' +
      '<div class="ops-queue-item__head">' +
      '<div class="ops-queue-item__info">' +
      '<strong class="ops-queue-item__name">' + safe(c.name || c.business_name || '—') + '</strong>' +
      '<span class="ops-queue-item__phone">' + safe(c.phone || '') + '</span>' +
      '</div>' +
      '<span class="badge ' + prio.cls + '">' + prio.label + '</span>' +
      '</div>' +
      '<div class="ops-queue-item__meta">' +
      '<span>آخر نشاط: ' + (days <= 1 ? 'اليوم' : safe(days) + ' يوم') + '</span>' +
      (lastOrder ? '<span>آخر فاتورة: ' + safe(formatMoney(lastOrder.total_amount)) + ' ج.م</span>' : '') +
      conf + distance +
      '</div>' +
      '<div class="ops-queue-item__actions">' +
      renderStartVisitButton(c.id, activeVisit) +
      (lastOrder ? '<button class="btn btn--xs btn--ghost" type="button" data-action="view-invoice" data-invoice-id="' + safe(lastOrder.id) + '" title="عرض الفاتورة">📄</button>' : '') +
      '<button class="btn btn--xs btn--ghost" type="button" data-action="go-rep-customer-invoices" data-customer-id="' + safe(c.id) + '" data-customer-name="' + safe(c.name || c.business_name || '') + '" title="فواتير العميل">📋</button>' +
      '</div>' +
      (locStatus ? '<div class="ops-queue-item__loc">' + locStatus + '</div>' : '') +
      '</div>';
  }).join('');

  return section('قائمة العملاء التشغيلية', 'حسب أولوية النشاط', '<div class="ops-queue">' + cards + '</div>',
    '<span class="badge">' + customers.length + '</span>');
}

function renderOpTimeline(state) {
  var timeline = Array.isArray(state.runtime.rep.timeline) ? state.runtime.rep.timeline : [];
  if (!timeline.length) return '';

  var items = timeline.map(function(entry) {
    var time = formatTime(entry.at);
    var text = '';
    var cls = '';
    if (entry.type === 'visit_start') {
      text = 'بدء زيارة';
      cls = 'ops-tl--start';
    } else if (entry.type === 'order_created') {
      var orderNum = entry.order ? (entry.order.order_number || entry.order.invoice_number || entry.order.id || '') : '';
      text = 'فاتورة #' + safe(orderNum) + ' — ' + safe(formatMoney(entry.order ? entry.order.total_amount : 0)) + ' ج.م';
      cls = 'ops-tl--order';
    } else if (entry.type === 'visit_end') {
      var dur = entry.visit && entry.visit.duration_minutes ? entry.visit.duration_minutes + ' د' : '';
      text = 'إنهاء الزيارة' + (dur ? ' (' + safe(dur) + ')' : '');
      cls = 'ops-tl--end';
    } else {
      return '';
    }
    return '<div class="ops-tl-item ' + cls + '">' +
      '<span class="ops-tl-time">' + safe(time) + '</span>' +
      '<span class="ops-tl-dot"></span>' +
      '<span class="ops-tl-text">' + safe(text) + '</span>' +
      '</div>';
  }).filter(Boolean).join('');

  if (!items) return '';
  return section('التسلسل الزمني', 'أحداث اليوم التشغيلية', '<div class="ops-timeline">' + items + '</div>', '');
}

function renderTarget(state) {
  var customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  var visits = Array.isArray(state.runtime.rep.visits) ? state.runtime.rep.visits : [];
  if (!customers.length) return '';
  var target = getDailyGoal(customers);
  var completed = visits.filter(function(v) { var s = (v.visit_status || '').toLowerCase(); return s === 'completed' || s === 'ordered'; }).length;
  var remaining = Math.max(0, target - completed);
  var pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

  return section('هدف اليوم', '', '<div class="ops-target">' +
    '<div class="ops-target__head"><strong>زيارة ' + target + ' عميل</strong></div>' +
    '<div class="ops-target__bar"><div class="ops-target__fill" style="width:' + pct + '%"></div></div>' +
    '<div class="ops-target__meta">' +
    '<span>' + completed + ' زيارة من أصل ' + target + '</span>' +
    (remaining > 0 ? '<span class="ops-target__remain">تبقى ' + remaining + ' زيارات</span>' : '<span class="ops-target__done">🎉 تم تحقيق الهدف</span>') +
    '</div>' +
    '</div>', '');
}

export function renderRepDashboardPage(state) {
  var loading = state.runtime.rep.loading;
  var loaded = state.runtime.rep.loaded;
  var session = state.auth.session;
  var sessionName = safe(session?.name || session?.username || 'المندوب');

  if (!loaded && loading) {
    return '<div class="ops-loading"><div class="skeleton-shell">' +
      Array(4).fill('<div class="skeleton-block skeleton-block--card"></div>').join('') +
      '</div></div>';
  }

  return '<div class="ops-workspace">' +
    '<div class="ops-workspace__head"><h2>' + sessionName + '</h2><span class="ops-workspace__sub">لوحة التشغيل الميداني</span></div>' +
    renderLiveOpBar(state) +
    renderTarget(state) +
    renderPerfStrip(state) +
    renderCompetition(state) +
    renderCustomerQueue(state) +
    renderOpTimeline(state) +
    '<div class="ops-workspace__footer">' +
    '<button class="btn btn--ghost" type="button" data-action="go-rep-customers">كل العملاء</button>' +
    '<button class="btn btn--ghost" type="button" data-action="go-rep-invoices">كل الفواتير</button>' +
    '<button class="btn btn--ghost" type="button" data-action="open-customer-modal">+ إضافة عميل</button>' +
    '</div>' +
    '</div>';
}
