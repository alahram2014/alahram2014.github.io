import { dom } from '../core/dom.js';
import { invoiceCard } from '../components/cards.js';
import { getOwnershipLabel } from '../services/repService.js';
import { renderVisitStats, renderVisitTimeline, renderEndVisitButton } from '../services/visitRenderUtils.js';
import { renderRankingBoard, renderMyPerformanceCard, renderDailyGoal, renderBadges, renderCoverageAlerts } from '../services/performanceRenderUtils.js';
import { computeRepPerformance, getBadges, getCoverageAlerts } from '../services/performanceService.js';

function renderCustomerList(customers) {
  if (!Array.isArray(customers) || !customers.length) {
    return '<div class="empty-state">لا يوجد عملاء بعد</div>';
  }
  return `
    <div class="rep-customer-list">
      ${customers.slice(0, 5).map((customer) => `
        <article class="rep-customer-card" data-action="select-customer" data-customer-id="${dom.escape(String(customer.id))}">
          <div class="rep-customer-card__head">
            <strong>${dom.escape(customer.name || customer.business_name || '—')}</strong>
            <span class="chip chip--rep">مندوب</span>
            <button class="btn btn--xs btn--ghost" type="button" data-action="go-rep-customer-invoices" data-customer-id="${dom.escape(String(customer.id))}" data-customer-name="${dom.escape(customer.name || customer.business_name || '')}" title="فواتير العميل">📄</button>
          </div>
          <div class="rep-customer-card__meta">
            ${customer.phone ? `<span>${dom.escape(customer.phone)}</span>` : ''}
            <span class="rep-ownership-label">${dom.escape(getOwnershipLabel(customer))}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderInvoiceList(orders) {
  if (!Array.isArray(orders) || !orders.length) {
    return '<div class="empty-state">لا توجد فواتير</div>';
  }
  const sorted = [...orders].slice(0, 10);
  return `
    <div class="rep-invoice-list">
      ${sorted.map(invoiceCard).join('')}
    </div>
  `;
}

function renderRepStats(customers, orders) {
  const totalCustomers = Array.isArray(customers) ? customers.length : 0;
  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const pendingOrders = Array.isArray(orders)
    ? orders.filter((inv) => {
        const key = (inv.workflow_state_key || inv.workflow_status || inv.status || '').toLowerCase();
        return ['pending', 'reviewing'].includes(key);
      }).length
    : 0;
  return `
    <div class="rep-stats-grid">
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${totalCustomers}</strong>
        <span class="rep-stat-card__label">عملائي</span>
      </div>
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${totalOrders}</strong>
        <span class="rep-stat-card__label">فواتيري</span>
      </div>
      <div class="rep-stat-card">
        <strong class="rep-stat-card__value">${pendingOrders}</strong>
        <span class="rep-stat-card__label">قيد التنفيذ</span>
      </div>
    </div>
  `;
}

export function renderRepDashboardPage(state) {
  const session = state.auth.session;
  const customers = Array.isArray(state.runtime.rep.customers) ? state.runtime.rep.customers : [];
  const orders = Array.isArray(state.runtime.rep.orders) ? state.runtime.rep.orders : [];
  const visits = Array.isArray(state.runtime.rep.visits) ? state.runtime.rep.visits : [];
  const timeline = Array.isArray(state.runtime.rep.timeline) ? state.runtime.rep.timeline : [];
  const activeVisit = state.runtime.rep.activeVisit || null;
  const rankings = Array.isArray(state.runtime.rep.rankings) ? state.runtime.rep.rankings : [];
  const sessionId = session?.id || '';
  const sessionName = dom.escape(session?.name || session?.username || 'المندوب');

  var perf = null;
  var badges = [];
  var alerts = [];
  if (visits.length || orders.length) {
    perf = computeRepPerformance(sessionId, visits, orders, customers, 'today');
    perf.repName = session?.name || session?.username || 'مندوب';
    if (rankings.length) {
      var ranked = rankings.find(function(r) { return String(r.repId) === String(sessionId); });
      if (ranked) perf.rank = ranked.rank;
    }
    badges = getBadges(perf);
    alerts = getCoverageAlerts(customers);
  }

  var visitSection = '';
  if (visits.length) {
    var statsHtml = renderVisitStats({ total: visits.length,
      completed: visits.filter(function(v) { var s = (v.visit_status || '').toLowerCase(); return s === 'completed' || s === 'ordered'; }).length,
      inProgress: visits.filter(function(v) { return (v.visit_status || '') === 'in_progress'; }).length,
      ordered: visits.filter(function(v) { return (v.visit_status || '') === 'ordered'; }).length,
      totalOrderValue: orders.reduce(function(sum, o) { return sum + Number(o.total_amount || 0); }, 0),
      followUp: visits.filter(function(v) { return (v.visit_status || '') === 'follow_up_required'; }).length,
      closed: visits.filter(function(v) { return (v.visit_status || '') === 'customer_closed'; }).length,
    });
    visitSection = '<section class="page-section"><div class="page-section__head"><div><h2>زيارات اليوم</h2><p>إحصائيات الزيارات الميدانية</p></div><span class="badge">' + visits.length + '</span></div>' + statsHtml + '</section>';
  }

  var activeVisitSection = '';
  if (activeVisit) {
    activeVisitSection = '<section class="page-section"><div class="page-section__head"><div><h2>الزيارة الحالية</h2><p>' + dom.escape(String(activeVisit.customer_id || '')) + '</p></div></div>' + renderEndVisitButton(activeVisit.id) + '</section>';
  }

  var timelineSection = '';
  if (timeline.length) {
    timelineSection = '<section class="page-section"><div class="page-section__head"><div><h2>الأحداث الزمنية</h2><p>تسلسل زيارات اليوم</p></div><span class="badge">timeline</span></div>' + renderVisitTimeline(timeline) + '</section>';
  }

  var rankingSection = rankings.length ? renderRankingBoard(rankings, sessionId) : '';
  var perfCard = perf ? renderMyPerformanceCard(perf) : '';
  var goalCard = customers.length ? renderDailyGoal(customers, visits, perf) : '';
  var badgesSection = badges.length ? renderBadges(badges) : '';
  var alertsSection = alerts.length ? renderCoverageAlerts(alerts) : '';

  return `
    <div class="page-stack rep-dashboard">
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>مرحبًا، ${sessionName}</h2>
            <p>لوحة المندوب — عملائي وطلباتي</p>
          </div>
        </div>
        ${renderRepStats(customers, orders)}
      </section>
      ${perfCard ? '<section class="page-section">' + perfCard + '</section>' : ''}
      ${badgesSection ? '<section class="page-section"><div class="page-section__head"><div><h2>شارات الأداء</h2><p>إنجازاتك التشغيلية اليوم</p></div></div>' + badgesSection + '</section>' : ''}
      ${alertsSection ? '<section class="page-section">' + alertsSection + '</section>' : ''}
      ${goalCard ? '<section class="page-section">' + goalCard + '</section>' : ''}
      ${rankingSection}
      ${activeVisitSection}
      ${visitSection}
      ${timelineSection}
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>إجراءات سريعة</h2>
            <p>أقصر طريق للمهام الأكثر تكرارًا</p>
          </div>
        </div>
        <div class="rep-actions-grid">
          <button class="btn btn--primary" type="button" data-action="go-rep-customers">عملائي</button>
          <button class="btn btn--primary" type="button" data-action="go-checkout">طلب جديد</button>
          <button class="btn btn--primary" type="button" data-action="go-rep-invoices">فواتيري</button>
          <button class="btn btn--ghost" type="button" data-action="open-customer-modal">إضافة عميل</button>
        </div>
      </section>
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>عملائي</h2>
            <p>قائمة العملاء المرتبطين</p>
          </div>
          <span class="badge">${String(customers.length)}</span>
        </div>
        ${renderCustomerList(customers)}
      </section>
      <section class="page-section">
        <div class="page-section__head">
          <div>
            <h2>آخر الفواتير</h2>
            <p>أحدث ١٠ طلبات وفواتير</p>
          </div>
          <span class="badge">${String(orders.length)}</span>
        </div>
        ${renderInvoiceList(orders)}
      </section>
    </div>
  `;
}
