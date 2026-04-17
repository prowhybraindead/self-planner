"use client";

import { useEffect } from "react";
import { detectRuntimePlatform, isLowEndDevice } from "@/lib/platform";

export function PlatformBootstrap() {
  useEffect(() => {
    const platform = detectRuntimePlatform();
    const lowEnd = isLowEndDevice();
    const html = document.documentElement;
    const body = document.body;

    html.classList.remove("platform-web", "platform-android", "platform-ios");
    body.classList.remove("platform-web", "platform-android", "platform-ios");

    html.classList.add(`platform-${platform}`);
    body.classList.add(`platform-${platform}`);

    html.classList.toggle("platform-lowend", lowEnd);
    body.classList.toggle("platform-lowend", lowEnd);

    let baselineHeight =
      typeof window !== "undefined" ? window.visualViewport?.height ?? window.innerHeight : 0;

    const updateKeyboardState = () => {
      const currentHeight = window.visualViewport?.height ?? window.innerHeight;
      if (currentHeight > baselineHeight) {
        baselineHeight = currentHeight;
      }
      const keyboardOpen = baselineHeight - currentHeight > 120;
      html.classList.toggle("keyboard-open", keyboardOpen);
      body.classList.toggle("keyboard-open", keyboardOpen);
    };

    updateKeyboardState();
    window.visualViewport?.addEventListener("resize", updateKeyboardState);

    return () => {
      html.classList.remove(`platform-${platform}`);
      body.classList.remove(`platform-${platform}`);
      html.classList.remove("platform-lowend");
      body.classList.remove("platform-lowend");
      html.classList.remove("keyboard-open");
      body.classList.remove("keyboard-open");
      window.visualViewport?.removeEventListener("resize", updateKeyboardState);
    };
  }, []);

  return null;
}
