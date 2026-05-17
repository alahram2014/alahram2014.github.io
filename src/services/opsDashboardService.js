import { canAccessCustomerManagement, canAccessOperationalDashboard, hasCapability, normalizeUserType } from './authService.js';
import { formatMoney } from './invoiceService.js';
import { getDefaultOperationalModule, getOperationalModules, getOperationalModuleByKey, getOperationalQuickActions, getOperationalRouteForModule, getOperationalModuleLabel, hasOperationalAccess, isOperationalModuleReady } from './managerService.js';
import { getWorkflowStateLabel, normalizeWorkflowStateKey, resolveWorkflowActions } from './workflowService.js';

const PRIORITY_BUCKETS = [
  { key: 'review', title: 'مراجعة', states: ['pending', 'reviewing', 'assigned'] },
  { key: 'prepare', title: 'تحضير', states: ['preparing'] },
  { key: 'dispatch', title: 'شحن', states: ['dispatched', 'shipped'] },
  { key: 'complete', title: 'إغلاق', states: ['delivered', 'collected'] },
  { key: 'returns', title: 'مرتجعات', states: ['returned'] },
  { key: 'cancelled', title: 'ملغاة', states: ['cancelled'] },
];

function normalizeId(value) {
  return String(value || '').trim();
}

function sameDay(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const l = new Date(left);
  const r = new Date(right);
  return l.getFullYear() === r.getFullYear()
    && l.getMonth() === r.getMonth()
    && l.getDate() === r.getDate();
}

function ageHours(timestamp) {
  const value = new Date(timestamp || 0).getTime();
  if (!Number.isFinite(value) || value <= 0) return null;
  return (Date.now() - value) / 36e5;
}

function dedupeById(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = normalizeId(row?.id || row?.order_number || row?.invoice_number || row?.customer_id || row?.rep_id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getOrders(state) {
  const managerScope = state?.runtime?.manager || {};
  const priorityOrders = Array.isArray(managerScope.priorityOrders) && managerScope.priorityOrders.length ? managerScope.priorityOrders : [];
  const teamOrders = Array.isArray(managerScope.teamOrders) ? managerScope.teamOrders : [];
  const invoiceOrders = Array.isArray(state?.commerce?.invoices) ? state.commerce.invoices : [];
  return dedupeById([...priorityOrders, ...teamOrders, ...invoiceOrders]);
}

function getCustomers(state) {
  const managerScope = state?.runtime?.manager || {};
  const teamCustomers = Array.isArray(managerScope.teamCustomers) ? managerScope.teamCustomers : [];
  const commerceCustomers = Array.isArray(state?.commerce?.customers) ? state.commerce.customers : [];
  return dedupeById([...teamCustomers, ...commerceCustomers]);
}

function getReps(state) {
  const managerScope = state?.runtime?.manager || {};
  return Array.isArray(managerScope.teamReps) ? managerScope.teamReps : [];
}

function getSessionCapabilities(session) {
  return (session?.capabilities && Array.isArray(session.capabilities)) ? session.capabilities : [];
}

function getOrderState(order) {
  return normalizeWorkflowStateKey(order?.workflow_state_key || order?.workflow_status || order?.status) || 'pending';
}

function getOrderDate(order) {
  return order?.updated_at || order?.created_at || order?.order_date || order?.date || null;
}

function buildCounters(state) {
  const orders = getOrders(state);
  const customers = getCustomers(state);
  const pendingReview = orders.filter((order) => ['pending', 'reviewing', 'assigned'].includes(getOrderState(order))).length;
  const preparing = orders.filter((order) => getOrderState(order) === 'preparing').length;
  const dispatchedToday = orders.filter((order) => ['dispatched', 'shipped'].includes(getOrderState(order)) && sameDay(new Date(getOrderDate(order) || 0).getTime(), Date.now())).length;
  const delayed = orders.filter((order) => {
    const stateKey = getOrderState(order);
    if (!['pending', 'reviewing', 'assigned', 'preparing'].includes(stateKey)) return false;
    const hours = ageHours(getOrderDate(order));
    return hours !== null && hours >= 48;
  }).length;
  const returnsPending = orders.filter((order) => getOrderState(order) === 'returned').length;
  const followUpCustomers = customers.filter((customer) => {
    const latest = getLatestCustomerOrder(customer, orders);
    if (!latest) return true;
    const hours = ageHours(getOrderDate(latest));
    return hours !== null && hours >= (24 * 30);
  }).length;
  const newOrders = orders.filter((order) => getOrderState(order) === 'pending').length;

  return [
    { key: 'new-orders', label: 'طلبات جديدة', value: newOrders, hint: 'من workflow_state_key' },
    { key: 'pending-review', label: 'تحتاج مراجعة', value: pendingReview, hint: 'محتجزة للتنفيذ' },
    { key: 'preparing', label: 'جاري التحضير', value: preparing, hint: 'في المسار التشغيلي' },
    { key: 'dispatched-today', label: 'خرج للشحن اليوم', value: dispatchedToday, hint: 'حركة يومية' },
    { key: 'delayed', label: 'متأخرة', value: delayed, hint: 'أكثر من 48 ساعة' },
    { key: 'returns', label: 'مرتجعات', value: returnsPending, hint: 'بحاجة إجراء' },
    { key: 'follow-up', label: 'عملاء متابعة', value: followUpCustomers, hint: 'لا يوجد نشاط حديث' },
  ];
}

function getLatestCustomerOrder(customer, orders) {
  const customerId = normalizeId(customer?.id);
  if (!customerId || !Array.isArray(orders)) return null;
  return orders
    .filter((order) => normalizeId(order?.customer_id) === customerId)
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime())[0] || null;
}

function buildQueueItems(state, bucket) {
  const session = state?.auth?.session || {};
  const orders = getOrders(state)
    .map((order) => {
      const stateKey = getOrderState(order);
      const workflow = resolveWorkflowActions(order, session);
      return {
        ...order,
        workflowStateKey: stateKey,
        workflowStateLabel: workflow.currentStateLabel || getWorkflowStateLabel(stateKey),
        workflowActions: workflow,
      };
    })
    .filter((order) => bucket.states.includes(order.workflowStateKey));

  const sorted = orders.sort((left, right) => {
    const leftPriority = bucket.key === 'returns' ? 1 : bucket.states.indexOf(left.workflowStateKey);
    const rightPriority = bucket.key === 'returns' ? 1 : bucket.states.indexOf(right.workflowStateKey);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftDate = new Date(getOrderDate(left) || 0).getTime();
    const rightDate = new Date(getOrderDate(right) || 0).getTime();
    return rightDate - leftDate;
  });

  return sorted.slice(0, 5);
}

function buildQueues(state) {
  return PRIORITY_BUCKETS.map((bucket) => {
    const items = buildQueueItems(state, bucket);
    const count = (getOrders(state) || []).filter((order) => bucket.states.includes(getOrderState(order))).length;
    return {
      ...bucket,
      count,
      items,
      emptyLabel: 'لا توجد عناصر',
    };
  });
}

function isOperationalRole(session) {
  const type = normalizeUserType(session?.userType || session?.user_type || session?.role || null, null);
  return ['admin', 'sales_manager', 'sales_operator', 'hybrid_operator', 'warehouse_operator', 'operations_manager'].includes(type);
}

function buildModuleRail(session) {
  return getOperationalModules(session).map((module) => ({
    ...module,
    disabled: !module.isReady,
    ctaLabel: module.isReady ? 'فتح' : 'قريبًا',
  }));
}

function buildExecutionCards(state) {
  const session = state?.auth?.session || {};
  const orders = getOrders(state);
  const customerMap = Object.fromEntries(getCustomers(state).map((customer) => [normalizeId(customer.id), customer]));
  return orders.slice(0, 8).map((order) => {
    const workflow = resolveWorkflowActions(order, session);
    const firstTransition = Array.isArray(workflow.executableTransitions) ? workflow.executableTransitions[0] : null;
    const customer = customerMap[normalizeId(order.customer_id)];
    const customerName = customer?.name || order.customer_name || order.name || `عميل #${normalizeId(order.customer_id).slice(0, 6) || '—'}`;
    const total = formatMoney(Number(order.total_amount || 0));
    return {
      id: normalizeId(order.id),
      orderNumber: order.order_number || order.invoice_number || order.id,
      customerName,
      total,
      stateLabel: workflow.currentStateLabel || getWorkflowStateLabel(workflow.currentStateKey),
      actionLabel: firstTransition?.to_state_label || 'تنفيذ',
      canExecute: Boolean(firstTransition),
      nextStateKey: firstTransition?.to_state_key || null,
      executableCount: Array.isArray(workflow.executableTransitions) ? workflow.executableTransitions.length : 0,
      workflowStateKey: workflow.currentStateKey,
      repName: order.rep_name || order.sales_rep_name || order.sales_rep_id || '',
    };
  });
}

export function canOpenOpsWorkspace(session = {}) {
  return isOperationalRole(session) || canAccessOperationalDashboard(session) || hasCapability(session, ['dashboard.sales_manager', 'dashboard.admin', 'sales_manager.access']);
}

export function getOpsWorkspaceModule(session = {}, requestedModule = null) {
  const defaultModule = getDefaultOperationalModule(session);
  const moduleKey = normalizeId(requestedModule) || defaultModule;
  const module = getOperationalModuleByKey(moduleKey);
  if (!module) return getOperationalModuleByKey(defaultModule) || null;
  if (module.isReady || module.runtimeReady) return module;
  if (isOperationalModuleReady(defaultModule)) return getOperationalModuleByKey(defaultModule) || module;
  return module;
}

export function createOpsDashboardModel(state) {
  const session = state?.auth?.session || null;
  const routeModule = normalizeId(state?.app?.route?.params?.module || '');
  const module = getOpsWorkspaceModule(session, routeModule);
  const moduleKey = module?.key || getDefaultOperationalModule(session);
  const counters = buildCounters(state);
  const queues = buildQueues(state);
  const quickActions = getOperationalQuickActions(session);
  const moduleRail = buildModuleRail(session);
  const executionCards = buildExecutionCards(state);

  return {
    session,
    canOpen: canOpenOpsWorkspace(session),
    moduleKey,
    module,
    moduleLabel: getOperationalModuleLabel(moduleKey),
    moduleRoute: getOperationalRouteForModule(moduleKey),
    counters,
    queues,
    quickActions,
    moduleRail,
    executionCards,
    priorityOrders: executionCards,
    workflowSummary: state?.runtime?.manager?.summary || {},
    teamCustomers: getCustomers(state),
    teamOrders: getOrders(state),
    teamReps: getReps(state),
    isOperationalRole: isOperationalRole(session),
  };
}
