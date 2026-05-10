let dashboardLifecycle = 0;

export function bumpDashboardLifecycle() {
  dashboardLifecycle += 1;
}

export function getDashboardLifecycleSnapshot() {
  return dashboardLifecycle;
}
