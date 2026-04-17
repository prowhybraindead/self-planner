export type RuntimePlatform = "web" | "android" | "ios";

function getCapacitorPlatform(): string | null {
  if (typeof window === "undefined") return null;
  const cap = (window as typeof window & { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() ?? null;
}

export function detectRuntimePlatform(): RuntimePlatform {
  if (typeof window === "undefined") return "web";

  const capPlatform = getCapacitorPlatform();
  if (capPlatform === "android") return "android";
  if (capPlatform === "ios") return "ios";

  const ua = window.navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

export function isAndroidRuntime(): boolean {
  return detectRuntimePlatform() === "android";
}

export function isCapacitorNativeRuntime(): boolean {
  const platform = getCapacitorPlatform();
  return platform === "android" || platform === "ios";
}

export function isLowEndDevice(): boolean {
  if (typeof window === "undefined") return false;
  const memory = (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = window.navigator.hardwareConcurrency ?? 4;
  return memory <= 4 || cores <= 4;
}
