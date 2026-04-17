"use client";

import { useEffect, useRef } from "react";
import { useState } from "react";
import type { CSSProperties } from "react";
import {
  getUIPreferencesFromStorage,
  UI_PREFERENCES_EVENT,
} from "@/lib/ui-preferences";

type Star = {
  id: number;
  className: string;
  left: string;
  top: string;
  size: string;
  opacity: number;
  animationDuration: string;
  animationDelay: string;
};

type Comet = {
  id: number;
  top: string;
  left: string;
  duration: string;
  delay: string;
  angle: string;
  travelX: string;
  travelY: string;
  length: string;
  thickness: string;
  headSize: string;
  brightness: number;
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

const stars: Star[] = Array.from({ length: 640 }, (_, i) => {
  const base = i + 1;
  const sizeValue = 0.7 + seededRandom(base + 101) * 3.8;
  const className =
    sizeValue > 2.8 ? "star star-large" : sizeValue > 1.6 ? "star star-medium" : "star star-small";

  return {
    id: i,
    className,
    left: `${seededRandom(base + 5) * 100}%`,
    top: `${seededRandom(base + 15) * 100}%`,
    size: `${sizeValue.toFixed(2)}px`,
    opacity: 0.3 + seededRandom(base + 25) * 0.7,
    animationDuration: `${2.8 + seededRandom(base + 35) * 7.4}s`,
    animationDelay: `${seededRandom(base + 45) * 9}s`,
  };
});

const cometSource: Omit<Comet, "id">[] = [];

for (let burstIndex = 0; burstIndex < 3; burstIndex += 1) {
  const burstSeed = 400 + burstIndex * 47;
  const burstTop = 12 + seededRandom(burstSeed) * 58;
  const burstLeft = -20 + seededRandom(burstSeed + 1) * 18;
  const burstDuration = 15 + seededRandom(burstSeed + 2) * 6;
  const burstDelayBase = burstIndex * 6 + seededRandom(burstSeed + 3) * 2.5;

  for (let cometIndex = 0; cometIndex < 3; cometIndex += 1) {
    const localSeed = burstSeed + cometIndex * 13;
    cometSource.push({
      top: `${Math.max(4, Math.min(85, burstTop + (seededRandom(localSeed + 1) - 0.5) * 7)).toFixed(2)}%`,
      left: `${(burstLeft + cometIndex * 4).toFixed(2)}%`,
      duration: `${(burstDuration + seededRandom(localSeed + 5) * 1.8).toFixed(2)}s`,
      delay: `${(burstDelayBase + cometIndex * 0.55).toFixed(2)}s`,
      angle: `${(16 + seededRandom(localSeed + 6) * 14).toFixed(2)}deg`,
      travelX: `${(58 + seededRandom(localSeed + 7) * 24).toFixed(2)}vw`,
      travelY: `${(24 + seededRandom(localSeed + 8) * 30).toFixed(2)}vh`,
      length: `${(160 + seededRandom(localSeed + 9) * 150).toFixed(2)}px`,
      thickness: `${(1 + seededRandom(localSeed + 10) * 1.5).toFixed(2)}px`,
      headSize: `${(4.2 + seededRandom(localSeed + 11) * 3.2).toFixed(2)}px`,
      brightness: 0.72 + seededRandom(localSeed + 12) * 0.28,
    });
  }
}

for (let i = 0; i < 2; i += 1) {
  const base = 700 + i * 29;
  cometSource.push({
    top: `${(10 + seededRandom(base + 1) * 70).toFixed(2)}%`,
    left: `${(-15 + seededRandom(base + 2) * 35).toFixed(2)}%`,
    duration: `${(20 + seededRandom(base + 3) * 9).toFixed(2)}s`,
    delay: `${(4 + seededRandom(base + 4) * 6).toFixed(2)}s`,
    angle: `${(14 + seededRandom(base + 5) * 10).toFixed(2)}deg`,
    travelX: `${(48 + seededRandom(base + 6) * 26).toFixed(2)}vw`,
    travelY: `${(18 + seededRandom(base + 7) * 24).toFixed(2)}vh`,
    length: `${(140 + seededRandom(base + 8) * 120).toFixed(2)}px`,
    thickness: `${(1 + seededRandom(base + 9) * 1.2).toFixed(2)}px`,
    headSize: `${(4 + seededRandom(base + 10) * 2.6).toFixed(2)}px`,
    brightness: 0.66 + seededRandom(base + 11) * 0.24,
  });
}

const comets: Comet[] = cometSource.map((comet, index) => ({
  id: index,
  ...comet,
}));

export function AnimatedBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [preferences, setPreferences] = useState(() => getUIPreferencesFromStorage());

  useEffect(() => {
    const applyFromStorage = () => {
      setPreferences(getUIPreferencesFromStorage());
    };

    window.addEventListener(UI_PREFERENCES_EVENT, applyFromStorage);
    window.addEventListener("storage", applyFromStorage);

    return () => {
      window.removeEventListener(UI_PREFERENCES_EVENT, applyFromStorage);
      window.removeEventListener("storage", applyFromStorage);
    };
  }, []);

  useEffect(() => {
    const factor = preferences.parallax === "strong" ? 1 : 0.5;
    if (rootRef.current) {
      rootRef.current.style.setProperty("--parallax-factor", factor.toString());
    }
  }, [preferences.parallax]);

  useEffect(() => {
    const state = {
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
    };

    let rafId = 0;

    const animate = () => {
      state.currentX += (state.targetX - state.currentX) * 0.08;
      state.currentY += (state.targetY - state.currentY) * 0.08;

      if (rootRef.current) {
        rootRef.current.style.setProperty("--mx", state.currentX.toFixed(4));
        rootRef.current.style.setProperty("--my", state.currentY.toFixed(4));
      }

      rafId = window.requestAnimationFrame(animate);
    };

    const parallaxStrength = preferences.parallax === "strong" ? 1 : 0.55;

    const onMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      state.targetX = Math.max(-1, Math.min(1, x * parallaxStrength));
      state.targetY = Math.max(-1, Math.min(1, y * parallaxStrength));
    };

    const onDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return;
      state.targetX = Math.max(-1, Math.min(1, (event.gamma / 30) * parallaxStrength));
      state.targetY = Math.max(-1, Math.min(1, (event.beta / 45) * parallaxStrength));
    };

    const resetParallax = () => {
      state.targetX = 0;
      state.targetY = 0;
    };

    rafId = window.requestAnimationFrame(animate);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("deviceorientation", onDeviceOrientation);
    window.addEventListener("blur", resetParallax);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("deviceorientation", onDeviceOrientation);
      window.removeEventListener("blur", resetParallax);
    };
  }, [preferences.parallax]);

  const deepCount = preferences.starDensity === "strong" ? 250 : 110;
  const mainCount = preferences.starDensity === "strong" ? 240 : 120;
  const foregroundCount = preferences.starDensity === "strong" ? 150 : 70;
  const sizeBoost = preferences.starDensity === "strong" ? 1.2 : 1;

  const deepStars = stars.slice(0, deepCount);
  const mainStars = stars.slice(deepCount, deepCount + mainCount);
  const foregroundStars = stars.slice(deepCount + mainCount, deepCount + mainCount + foregroundCount);

  const cometList = preferences.starDensity === "strong" ? comets : comets.slice(0, 4);

  return (
    <div ref={rootRef} className="animated-bg" aria-hidden="true">
      <div className="parallax-layer parallax-nebula">
        <div className="nebula nebula-a" />
        <div className="nebula nebula-b" />
        <div className="nebula nebula-c" />
      </div>

      <div className="stars-layer stars-layer-deep parallax-layer parallax-stars-deep">
        {deepStars.map((star) => (
          <span
            key={star.id}
            className={star.className}
            style={{
              left: star.left,
              top: star.top,
              width: `${Number.parseFloat(star.size) * sizeBoost}px`,
              height: `${Number.parseFloat(star.size) * sizeBoost}px`,
              opacity: Math.min(star.opacity * 0.78, 0.92),
              animationDuration: star.animationDuration,
              animationDelay: star.animationDelay,
            }}
          />
        ))}
      </div>

      <div className="stars-layer stars-layer-main parallax-layer parallax-stars-main">
        {mainStars.map((star) => (
          <span
            key={star.id}
            className={star.className}
            style={{
              left: star.left,
              top: star.top,
              width: `${Number.parseFloat(star.size) * sizeBoost}px`,
              height: `${Number.parseFloat(star.size) * sizeBoost}px`,
              opacity: Math.min(star.opacity * 0.95, 1),
              animationDuration: star.animationDuration,
              animationDelay: star.animationDelay,
            }}
          />
        ))}
      </div>

      <div className="stars-layer stars-layer-foreground parallax-layer parallax-stars-foreground">
        {foregroundStars.map((star) => (
          <span
            key={star.id}
            className={star.className}
            style={{
              left: star.left,
              top: star.top,
              width: `${Number.parseFloat(star.size) * sizeBoost}px`,
              height: `${Number.parseFloat(star.size) * sizeBoost}px`,
              opacity: Math.min(star.opacity + 0.32, 1),
              animationDuration: star.animationDuration,
              animationDelay: star.animationDelay,
            }}
          />
        ))}
      </div>

      <div className="parallax-layer parallax-comets">
        {cometList.map((comet) => (
          <span
            key={comet.id}
            className="comet"
            style={
              {
                top: comet.top,
                left: comet.left,
                width: comet.length,
                height: comet.thickness,
                opacity: comet.brightness,
                animationDuration: comet.duration,
                animationDelay: comet.delay,
                "--comet-angle": comet.angle,
                "--comet-travel-x": comet.travelX,
                "--comet-travel-y": comet.travelY,
                "--comet-head-size": comet.headSize,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
