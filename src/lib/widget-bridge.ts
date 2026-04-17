import { isCapacitorNativeRuntime } from "@/lib/platform";

export const WIDGET_SNAPSHOT_KEY = "selfplanner.widget.snapshot.v1";
export const WIDGET_SNAPSHOT_EVENT = "selfplanner:widget-snapshot-updated";

export interface WidgetSnapshot {
  version: 1;
  generated_at: string;
  active_recurring_count: number;
  upcoming_30d_count: number;
  next_payment_name: string | null;
  next_payment_amount_label: string | null;
  next_payment_due_date: string | null;
  primary_fx_pair: string | null;
  primary_fx_value: number | null;
  notes?: string | null;
}

type WidgetPlugin = {
  update?: (payload: { snapshot: WidgetSnapshot }) => Promise<void> | void;
  updateSnapshot?: (payload: { snapshot: string }) => Promise<void> | void;
  requestRefresh?: () => Promise<void> | void;
};

function getWidgetPlugin(): WidgetPlugin | null {
  if (typeof window === "undefined") return null;

  const cap = (window as typeof window & { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  const plugins = cap?.Plugins;
  if (!plugins) return null;

  const plugin = (plugins.SelfPlannerWidget ?? plugins.WidgetBridge) as WidgetPlugin | undefined;
  return plugin ?? null;
}

export function readWidgetSnapshot(): WidgetSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    return null;
  }
}

export async function publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new Event(WIDGET_SNAPSHOT_EVENT));

  if (!isCapacitorNativeRuntime()) return;
  const plugin = getWidgetPlugin();
  if (!plugin) return;

  try {
    if (plugin.updateSnapshot) {
      await plugin.updateSnapshot({ snapshot: JSON.stringify(snapshot) });
      return;
    }
    if (plugin.update) {
      await plugin.update({ snapshot });
    }
  } catch {
    // Ignore native bridge failures; local snapshot is still available.
  }
}

export async function requestWidgetRefresh(): Promise<void> {
  const plugin = getWidgetPlugin();
  if (!plugin?.requestRefresh) return;
  try {
    await plugin.requestRefresh();
  } catch {
    // No-op; refresh is best-effort.
  }
}

