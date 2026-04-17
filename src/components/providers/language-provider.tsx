"use client";

import React from "react";
import { LanguageProvider as CoreLanguageProvider } from "@/lib/language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <CoreLanguageProvider>{children}</CoreLanguageProvider>;
}
