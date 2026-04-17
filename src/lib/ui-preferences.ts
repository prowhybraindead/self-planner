import { isAndroidRuntime } from "@/lib/platform";

export type StarDensityMode = "light" | "strong";
export type ParallaxMode = "light" | "strong";

export interface UIPreferences {
  starDensity: StarDensityMode;
  parallax: ParallaxMode;
}

export const UI_PREFERENCES_KEY = "selfplanner.ui-prefs.v1";
export const UI_PREFERENCES_EVENT = "selfplanner:ui-prefs-change";

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  starDensity: "strong",
  parallax: "strong",
};

function getDefaultUIPreferences(): UIPreferences {
  if (typeof window === "undefined") return DEFAULT_UI_PREFERENCES;
  if (isAndroidRuntime()) {
    return {
      starDensity: "light",
      parallax: "light",
    };
  }
  return DEFAULT_UI_PREFERENCES;
}

export function getUIPreferencesFromStorage(): UIPreferences {
  const defaults = getDefaultUIPreferences();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UIPreferences>;

    const starDensity = parsed.starDensity === "strong" || parsed.starDensity === "light"
      ? parsed.starDensity
      : defaults.starDensity;
    const parallax = parsed.parallax === "strong" || parsed.parallax === "light"
      ? parsed.parallax
      : defaults.parallax;

    return {
      starDensity,
      parallax,
    };
  } catch {
    return defaults;
  }
}

export function saveUIPreferences(preferences: UIPreferences) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
}
