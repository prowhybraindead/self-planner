"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type AppSelectGroup = {
  label: string;
  options: AppSelectOption[];
};

interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: AppSelectOption[];
  groups?: AppSelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  searchPlaceholder?: string;
}

export function AppSelect({
  value,
  onValueChange,
  options,
  groups,
  placeholder = "Select...",
  disabled = false,
  id,
  className,
  searchPlaceholder = "Type to filter...",
}: AppSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const flatOptions = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((group) => group.options);
    }
    return options ?? [];
  }, [groups, options]);

  const normalize = React.useCallback((text: string) => text.trim().toLowerCase(), []);

  const filteredGroups = React.useMemo(() => {
    if (!groups || groups.length === 0) return [];
    const query = normalize(searchQuery);
    if (!query) return groups;

    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => {
          const haystack = `${option.label} ${option.value}`.toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, normalize, searchQuery]);

  const filteredOptions = React.useMemo(() => {
    if (!options) return [];
    const query = normalize(searchQuery);
    if (!query) return options;

    return options.filter((option) => {
      const haystack = `${option.label} ${option.value}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [normalize, options, searchQuery]);

  const visibleOptions = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return filteredGroups.flatMap((group) => group.options);
    }
    return filteredOptions;
  }, [filteredGroups, filteredOptions, groups]);

  const selected = flatOptions.find((option) => option.value === value);

  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  React.useEffect(() => {
    const selectedIndex = visibleOptions.findIndex(
      (option) => option.value === value && !option.disabled
    );
    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex);
      return;
    }

    const firstEnabledIndex = visibleOptions.findIndex((option) => !option.disabled);
    setHighlightedIndex(firstEnabledIndex >= 0 ? firstEnabledIndex : 0);
  }, [value, visibleOptions]);

  const closeDropdown = React.useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeDropdown, open]);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.setSelectionRange(
        searchInputRef.current.value.length,
        searchInputRef.current.value.length
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  const moveHighlight = React.useCallback(
    (direction: 1 | -1) => {
      if (visibleOptions.length === 0) return;

      let next = highlightedIndex;
      for (let i = 0; i < visibleOptions.length; i += 1) {
        next = (next + direction + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[next]?.disabled) {
          setHighlightedIndex(next);
          break;
        }
      }
    },
    [highlightedIndex, visibleOptions],
  );

  const commitHighlighted = React.useCallback(() => {
    const option = visibleOptions[highlightedIndex];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    closeDropdown();
  }, [closeDropdown, highlightedIndex, onValueChange, visibleOptions]);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveHighlight(1);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveHighlight(-1);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        commitHighlighted();
      } else {
        setOpen(true);
      }
      return;
    }

    const isTyping =
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey;

    if (isTyping) {
      event.preventDefault();
      if (!open) {
        setSearchQuery(event.key);
        setOpen(true);
      } else {
        setSearchQuery((prev) => `${prev}${event.key}`);
      }
    }
  };

  let runningIndex = -1;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onKeyDown={onTriggerKeyDown}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            if (prev) {
              setSearchQuery("");
            }
            return !prev;
          });
        }}
        className={cn(
          "h-11 w-full rounded-xl border border-sky-200/20 bg-slate-950/65 px-3.5 text-left text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.22)] transition-all",
          "hover:border-sky-300/40 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/55",
          "disabled:cursor-not-allowed disabled:opacity-55",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("block truncate pr-7", !selected && "text-dark-400")}>
          {selected?.label ?? placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sky-200/85">
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div
          className="absolute z-[70] mt-1.5 w-full overflow-hidden rounded-xl border border-sky-200/25 bg-[#051026]/96 shadow-2xl shadow-black/45 backdrop-blur-xl"
          role="listbox"
        >
          <div className="border-b border-white/10 p-1.5">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveHighlight(1);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveHighlight(-1);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitHighlighted();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeDropdown();
                }
              }}
              className="h-9 w-full rounded-lg border border-white/15 bg-white/5 px-2.5 text-sm text-white outline-none placeholder:text-dark-400 focus:border-sky-300/50"
              placeholder={searchPlaceholder}
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto p-1.5">
            {visibleOptions.length === 0 ? (
              <p className="px-2 py-3 text-xs text-dark-300">No matching options</p>
            ) : groups && groups.length > 0
              ? filteredGroups.map((group) => (
                  <div key={group.label} className="mb-1 last:mb-0">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
                      {group.label}
                    </p>
                    {group.options.map((option) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const isSelected = option.value === value;
                      const isHighlighted = index === highlightedIndex;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          data-index={index}
                          disabled={option.disabled}
                          className={cn(
                            "mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition last:mb-0",
                            isSelected
                              ? "bg-sky-400/22 text-sky-100"
                              : isHighlighted
                                ? "bg-white/8 text-white"
                                : "text-slate-200 hover:bg-white/6",
                            option.disabled && "cursor-not-allowed opacity-45",
                          )}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => {
                            if (option.disabled) return;
                            onValueChange(option.value);
                            closeDropdown();
                          }}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              : filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-index={index}
                      disabled={option.disabled}
                      className={cn(
                        "mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition last:mb-0",
                        isSelected
                          ? "bg-sky-400/22 text-sky-100"
                          : isHighlighted
                            ? "bg-white/8 text-white"
                            : "text-slate-200 hover:bg-white/6",
                        option.disabled && "cursor-not-allowed opacity-45",
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => {
                        if (option.disabled) return;
                        onValueChange(option.value);
                        closeDropdown();
                      }}
                    >
                      <span>{option.label}</span>
                    </button>
                  );
                })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
