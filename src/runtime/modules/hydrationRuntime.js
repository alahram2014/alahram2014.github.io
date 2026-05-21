export const HYDRATION_PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  IDLE: 4,
};

var hydrationQueue = [[], [], [], [], []];
var hydrationScheduled = false;

function flushHydrationQueue() {
  hydrationScheduled = false;
  for (var level = 0; level < hydrationQueue.length; level++) {
    var tasks = hydrationQueue[level];
    if (tasks.length) {
      hydrationQueue[level] = [];
      for (var i = 0; i < tasks.length; i++) {
        try { tasks[i](); } catch (e) { console.error('[hydration:' + level + ']', e); }
      }
      break;
    }
  }
}

export function scheduleHydration(level, fn) {
  if (typeof fn !== 'function') return;
  hydrationQueue[level].push(fn);
  if (!hydrationScheduled) {
    hydrationScheduled = true;
    if (level <= 1) {
      queueMicrotask(flushHydrationQueue);
    } else if (level <= 2) {
      setTimeout(flushHydrationQueue, 0);
    } else {
      var idleFn = (typeof requestIdleCallback === 'function') ? requestIdleCallback : function(cb) { setTimeout(cb, level === 3 ? 80 : 200); };
      idleFn(flushHydrationQueue);
    }
  }
}
