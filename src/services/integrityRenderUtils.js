import { dom } from '../core/dom.js';
import { getConfidenceLevel } from './integrityService.js';

function safeText(value, fallback) {
  return dom.escape(String(value ?? fallback ?? ''));
}

export function renderVisitTrustBadge(visit) {
  if (!visit || visit.visit_confidence_score == null) return '';
  var level = getConfidenceLevel(visit.visit_confidence_score);
  var label = level.label === 'موثوقة' ? 'زيارة موثوقة' : level.label === 'متوسطة' ? 'ثقة متوسطة' : 'ثقة منخفضة';
  return '<span class="chip ' + level.cls + ' trust-badge">' + safeText(label) + ' (' + visit.visit_confidence_score + ')</span>';
}

export function renderVisitDistanceBadge(visit) {
  if (!visit || visit.visit_distance_meters == null) return '';
  var status = visit.visit_distance_status || 'unknown';
  var cls = status === 'trusted' ? 'chip--success' : status === 'warning' ? 'chip--warning' : 'chip--error';
  var label = status === 'trusted' ? 'موقع موثوق' : status === 'warning' ? 'موقع قريب' : 'موقع بعيد';
  return '<span class="chip ' + cls + '">' + safeText(label) + ' (' + visit.visit_distance_meters + 'م)</span>';
}

export function renderCustomerLocationStatus(customer) {
  var hasLoc = customer && (customer.location_lat || customer.lat || customer.latitude || customer.location_lng || customer.lng || customer.longitude);
  if (!hasLoc) {
    return '<div class="loc-warning"><span class="loc-warning-icon">⚠️</span><span>هذا العميل لا يحتوي على موقع</span><button class="btn btn--xs btn--ghost" type="button" data-action="capture-customer-location">تحديد الموقع</button></div>';
  }
  return '';
}

export function renderIntegrityFlags(flags) {
  if (!Array.isArray(flags) || !flags.length) return '';
  var items = flags.map(function(f) {
    return '<div class="integrity-flag"><span class="flag-icon">🚩</span><div><strong>' + safeText(f.label) + '</strong><small>' + safeText(f.hint) + '</small></div></div>';
  }).join('');
  return '<div class="integrity-flags">' + items + '</div>';
}

export function renderSuspiciousVisitsTable(visits, customerMap) {
  if (!Array.isArray(visits) || !visits.length) return '';
  var suspicious = visits.filter(function(v) {
    return (v.visit_confidence_score != null && v.visit_confidence_score < 50) ||
      (v.visit_flags && v.visit_flags.length > 0);
  });
  if (!suspicious.length) return '';
  var rows = suspicious.slice(0, 20).map(function(v) {
    var cid = String(v.customer_id || '');
    var cname = (customerMap && customerMap[cid]) || 'عميل';
    return '<tr><td>' + safeText(v.rep_name || 'مندوب') + '</td><td>' + safeText(cname) + '</td><td>' + renderVisitTrustBadge(v) + '</td><td>' + (v.visit_distance_meters != null ? v.visit_distance_meters + 'م' : '—') + '</td><td>' + (v.visit_flags ? safeText(v.visit_flags) : '—') + '</td></tr>';
  }).join('');
  return '<section class="page-section ops-section"><div class="page-section__head"><div><h2>زيارات مشبوهة</h2><p>زيارات منخفضة الثقة تحتاج مراجعة</p></div><span class="badge badge--error">' + suspicious.length + '</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>المندوب</th><th>العميل</th><th>الثقة</th><th>المسافة</th><th>ملاحظات</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

export function renderIntegritySummary(visits) {
  if (!Array.isArray(visits) || !visits.length) return '';
  var trusted = 0;
  var medium = 0;
  var low = 0;
  var flagged = 0;
  visits.forEach(function(v) {
    var score = v.visit_confidence_score;
    if (score == null) return;
    if (score >= 80) trusted++;
    else if (score >= 50) medium++;
    else low++;
    if (v.visit_flags) flagged++;
  });
  return '<div class="integrity-summary">' +
    '<div class="integrity-stat"><strong>' + trusted + '</strong><span>موثوقة</span></div>' +
    '<div class="integrity-stat"><strong>' + medium + '</strong><span>متوسطة</span></div>' +
    '<div class="integrity-stat"><strong>' + low + '</strong><span>منخفضة</span></div>' +
    '<div class="integrity-stat"><strong>' + flagged + '</strong><span>بها إشارات</span></div>' +
    '</div>';
}
