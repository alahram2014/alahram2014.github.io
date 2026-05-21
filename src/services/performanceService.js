import { formatMoney } from './invoiceService.js';

var TODAY_RANGE_DAYS = 30;

function todayStart() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  var then = new Date(dateStr);
  if (isNaN(then.getTime())) return 999;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

function isToday(dateStr) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  var now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

export function computeRepPerformance(repId, visits, orders, customers, period) {
  period = period || 'today';

  var filteredOrders = (Array.isArray(orders) ? orders : []).filter(function(o) {
    if (period === 'today') return isToday(o.created_at) || isToday(o.updated_at);
    return true;
  });

  var totalSales = filteredOrders.reduce(function(sum, o) { return sum + Number(o.total_amount || 0); }, 0);
  var orderCount = filteredOrders.length;

  var completedVisits = (Array.isArray(visits) ? visits : []).filter(function(v) {
    var s = (v.visit_status || '').toLowerCase();
    return s === 'completed' || s === 'ordered';
  }).length;

  var totalVisits = (Array.isArray(visits) ? visits : []).length;

  var conversionRate = totalVisits > 0 ? (completedVisits / totalVisits) : 0;

  var customerList = Array.isArray(customers) ? customers : [];
  var totalCustomers = customerList.length;
  var visitedCustomerIds = {};
  (Array.isArray(visits) ? visits : []).forEach(function(v) { visitedCustomerIds[normalizeId(v.customer_id)] = true; });
  var visitedCount = Object.keys(visitedCustomerIds).length;
  var customerCoverage = totalCustomers > 0 ? (visitedCount / totalCustomers) : 0;

  var inactiveCustomers = customerList.filter(function(c) {
    var lastActivity = c.last_visit_at || c.updated_at || c.created_at || null;
    return daysSince(lastActivity) >= 12;
  }).length;

  var salesScore = normalizeScore(totalSales, 100000);
  var visitScore = normalizeScore(completedVisits, 20);
  var conversionScore = conversionRate * 100;
  var coverageScore = customerCoverage * 100;
  var inactivePenalty = totalCustomers > 0 ? (inactiveCustomers / totalCustomers) * 100 : 0;

  var score = (salesScore * 0.4) + (visitScore * 0.2) + (conversionScore * 0.15) + (coverageScore * 0.1) - (inactivePenalty * 0.05);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    repId: repId,
    totalSales: totalSales,
    orderCount: orderCount,
    totalVisits: totalVisits,
    completedVisits: completedVisits,
    conversionRate: Math.round(conversionRate * 100),
    customerCoverage: Math.round(customerCoverage * 100),
    totalCustomers: totalCustomers,
    visitedCustomers: visitedCount,
    inactiveCustomers: inactiveCustomers,
    score: score,
  };
}

export function normalizeScore(value, max) {
  if (max <= 0) return 0;
  var v = Math.min(1, Math.max(0, value / max));
  return v * 100;
}

export function rankReps(performanceList) {
  var sorted = (Array.isArray(performanceList) ? performanceList : []).slice().sort(function(a, b) {
    return b.score - a.score;
  });
  return sorted.map(function(p, i) {
    p.rank = i + 1;
    return p;
  });
}

export function getDailyGoal(customers) {
  var total = Array.isArray(customers) ? customers.length : 0;
  var target = Math.max(5, Math.round(total * 0.4));
  return target;
}

export function getBadges(perf) {
  var badges = [];
  if (perf.conversionRate >= 80) badges.push({ key: 'fastest', label: 'أسرع مندوب', hint: 'أعلى نسبة تحويل' });
  if (perf.completedVisits >= 10) badges.push({ key: 'visit_king', label: 'ملك الزيارات', hint: 'أعلى تغطية زيارات' });
  if (perf.inactiveCustomers === 0 && perf.totalCustomers > 0) badges.push({ key: 'coverage', label: 'تغطية كاملة', hint: 'كل العملاء مغطون' });
  if (perf.orderCount >= 5) badges.push({ key: 'growth', label: 'أفضل نمو', hint: 'حجم طلبات مرتفع' });
  if (perf.totalSales >= 50000) badges.push({ key: 'top_seller', label: 'أفضل مبيعات', hint: 'إجمالي مبيعات ممتاز' });
  return badges;
}

export function getCoverageAlerts(customers) {
  var alerts = [];
  var customerList = Array.isArray(customers) ? customers : [];
  var stale = customerList.filter(function(c) {
    var last = c.last_visit_at || c.updated_at || c.created_at || null;
    return daysSince(last) >= 12;
  });
  if (stale.length > 0) {
    alerts.push({ count: stale.length, message: 'لديك ' + stale.length + ' عملاء لم تتم زيارتهم منذ 12 يوم' });
  }
  return alerts;
}

export function computeTeamPerformance(teamReps, teamVisits, teamOrders, teamCustomers) {
  if (!Array.isArray(teamReps) || !teamReps.length) return { rankings: [], performanceMap: {} };

  var repCustomerMap = {};
  (Array.isArray(teamCustomers) ? teamCustomers : []).forEach(function(c) {
    var rid = normalizeId(c.owner_id || c.sales_rep_id || c.created_by_rep_id || '');
    if (!repCustomerMap[rid]) repCustomerMap[rid] = [];
    repCustomerMap[rid].push(c);
  });

  var perfList = teamReps.map(function(rep) {
    var rid = normalizeId(rep.id);
    var repVisits = (Array.isArray(teamVisits) ? teamVisits : []).filter(function(v) { return normalizeId(v.rep_id) === rid; });
    var repOrders = (Array.isArray(teamOrders) ? teamOrders : []).filter(function(o) {
      return normalizeId(o.owner_id || o.rep_id || o.sales_rep_id || '') === rid;
    });
    var repCustomers = repCustomerMap[rid] || [];
    var perf = computeRepPerformance(rid, repVisits, repOrders, repCustomers, 'today');
    perf.repName = rep.name || rep.username || 'مندوب';
    return perf;
  });

  var rankings = rankReps(perfList);
  var perfMap = {};
  rankings.forEach(function(p) { perfMap[normalizeId(p.repId)] = p; });
  return { rankings: rankings, performanceMap: perfMap };
}
