import { dom } from '../core/dom.js';
import { formatMoney } from './invoiceService.js';

function safeText(value, fallback) {
  return dom.escape(String(value ?? fallback ?? ''));
}

function rankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '#' + rank;
}

export function renderRankingBoard(rankings, currentRepId) {
  if (!Array.isArray(rankings) || !rankings.length) return '';
  var rows = rankings.slice(0, 10).map(function(p) {
    var isCurrent = normalizeId(p.repId) === normalizeId(currentRepId);
    var cls = isCurrent ? ' rank-row--current' : '';
    var emoji = p.rank <= 3 ? rankEmoji(p.rank) : '<span class="rank-num">' + p.rank + '</span>';
    return '<div class="rank-row' + cls + '">' +
      '<span class="rank-pos">' + emoji + '</span>' +
      '<span class="rank-name">' + safeText(p.repName) + '</span>' +
      '<span class="rank-stat">' + safeText(formatMoney(p.totalSales)) + ' ج.م</span>' +
      '<span class="rank-stat">' + p.completedVisits + '</span>' +
      '<span class="rank-stat rank-score">' + p.score + '</span>' +
      '</div>';
  }).join('');
  return '<section class="page-section"><div class="page-section__head"><div><h2>ترتيب المندوبين</h2><p>حسب الأداء التشغيلي اليوم</p></div><span class="badge">' + rankings.length + ' مندوب</span></div><div class="ranking-board"><div class="rank-row rank-row--header"><span class="rank-pos">#</span><span class="rank-name">المندوب</span><span class="rank-stat">المبيعات</span><span class="rank-stat">الزيارات</span><span class="rank-stat rank-score">النقاط</span></div>' + rows + '</div></section>';
}

export function renderMyPerformanceCard(perf) {
  if (!perf) return '';
  var rankStr = perf.rank ? rankEmoji(perf.rank) : '—';
  var nextTarget = '';
  if (perf.rank && perf.rank > 1) {
    nextTarget = '<p class="perf-hint">تبقى <strong>' + (perf.completedVisits < 10 ? (10 - perf.completedVisits) + ' زيارات' : '') + '</strong> للوصول للمركز الثاني</p>';
  }
  return '<div class="my-performance-card">' +
    '<div class="perf-header"><span class="perf-rank">ترتيبك اليوم: ' + rankStr + '</span></div>' +
    '<div class="perf-stats">' +
    '<div class="perf-stat"><strong>' + perf.orderCount + '</strong><span>طلباتك</span></div>' +
    '<div class="perf-stat"><strong>' + perf.completedVisits + '</strong><span>زياراتك</span></div>' +
    '<div class="perf-stat"><strong>' + safeText(formatMoney(perf.totalSales)) + ' ج.م</strong><span>مبيعاتك</span></div>' +
    '<div class="perf-stat"><strong>' + perf.score + '</strong><span>نقاط الأداء</span></div>' +
    '</div>' +
    '<div class="perf-score-bar"><div class="perf-score-fill" style="width:' + perf.score + '%"></div></div>' +
    nextTarget +
    '</div>';
}

export function renderDailyGoal(customers, visits, perf) {
  var target = getDailyGoal(customers);
  var completed = (perf ? perf.completedVisits : 0);
  var remaining = Math.max(0, target - completed);
  var pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  return '<div class="daily-goal-card">' +
    '<div class="goal-header"><span>🎯</span><strong>هدف اليوم: زيارة ' + target + ' عميل</strong></div>' +
    (remaining > 0 ? '<p class="goal-remaining">تبقى <strong>' + remaining + '</strong> زيارات للوصول للهدف</p>' : '<p class="goal-remaining goal-met">🎉 تم تحقيق الهدف اليومي!</p>') +
    '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
}

function getDailyGoal(customers) {
  var total = Array.isArray(customers) ? customers.length : 0;
  return Math.max(5, Math.round(total * 0.4));
}

export function renderBadges(badges) {
  if (!Array.isArray(badges) || !badges.length) return '';
  var items = badges.map(function(b) {
    return '<div class="badge-item"><span class="badge-icon">🏅</span><div><strong>' + safeText(b.label) + '</strong><small>' + safeText(b.hint) + '</small></div></div>';
  }).join('');
  return '<div class="badges-row">' + items + '</div>';
}

export function renderCoverageAlerts(alerts) {
  if (!Array.isArray(alerts) || !alerts.length) return '';
  var items = alerts.map(function(a) {
    return '<div class="coverage-alert"><span class="coverage-alert-icon">⚠️</span><span>' + safeText(a.message) + '</span></div>';
  }).join('');
  return '<div class="coverage-alerts">' + items + '</div>';
}

export function renderTeamPerformanceTable(rankings) {
  if (!Array.isArray(rankings) || !rankings.length) return '';
  var rows = rankings.map(function(p) {
    var emoji = p.rank <= 3 ? rankEmoji(p.rank) : '<span class="rank-num">' + p.rank + '</span>';
    var trend = getTrend(p);
    return '<tr><td><span class="rank-pos-sm">' + emoji + '</span> ' + safeText(p.repName) + '</td><td>' + p.score + '</td><td>' + p.completedVisits + '</td><td>' + p.orderCount + '</td><td>' + safeText(formatMoney(p.totalSales)) + ' ج.م</td><td>' + trend + '</td></tr>';
  }).join('');
  return '<section class="page-section ops-section"><div class="page-section__head"><div><h2>أداء الفريق</h2><p>ترتيب المندوبين حسب الأداء التشغيلي</p></div><span class="badge">' + rankings.length + '</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>المندوب</th><th>النقاط</th><th>زيارات</th><th>طلبات</th><th>مبيعات</th><th>الاتجاه</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

function getTrend(perf) {
  if (perf.rank <= 1) return '<span class="chip chip--success">↑ مستقر</span>';
  if (perf.score >= 70) return '<span class="chip chip--primary">↑ جيد</span>';
  if (perf.score >= 40) return '<span class="chip chip--warning">→ متوسط</span>';
  return '<span class="chip chip--error">↓ ضعيف</span>';
}

function normalizeId(value) {
  return String(value ?? '').trim();
}
