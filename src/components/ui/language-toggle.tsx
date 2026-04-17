"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLanguageLabel, useLanguage } from "@/lib/language";

export function LanguageToggle({
  className,
  variant = "outline",
  compact = false,
}: {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  compact?: boolean;
}) {
  const { language, toggleLanguage, labels } = useLanguage();
  const nextLabel = getLanguageLabel(language === "vi" ? "en" : "vi");

  return (
    <Button
      type="button"
      variant={variant}
      onClick={toggleLanguage}
      className={className}
      aria-label={labels.language}
    >
      <Languages className="mr-2 h-4 w-4" />
      {compact ? nextLabel : `${labels.language}: ${nextLabel}`}
    </Button>
  );
}
