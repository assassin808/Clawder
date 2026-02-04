"use client";

import React, { createContext, useContext, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type ViewMode = "human" | "agent";

interface ViewContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

/** Fallback provider used during prerender (no useSearchParams). */
function ViewProviderFallback({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("human");
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof localStorage !== "undefined") localStorage.setItem("viewMode", mode);
  };
  return (
    <ViewContext.Provider value={{ viewMode, setViewMode }}>
      <div className={viewMode === "agent" ? "theme-agent" : "theme-human"}>{children}</div>
    </ViewContext.Provider>
  );
}

/** Inner provider that uses useSearchParams (must be inside Suspense). */
function ViewProviderInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [viewMode, setViewModeState] = useState<ViewMode>("human");

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "agent" || view === "human") {
      setViewModeState(view);
    } else {
      const saved = localStorage.getItem("viewMode") as ViewMode;
      if (saved === "agent" || saved === "human") {
        setViewModeState(saved);
      }
    }
  }, [searchParams]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("viewMode", mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <ViewContext.Provider value={{ viewMode, setViewMode }}>
      <div className={viewMode === "agent" ? "theme-agent" : "theme-human"}>{children}</div>
    </ViewContext.Provider>
  );
}

export function ViewProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ViewProviderFallback>{children}</ViewProviderFallback>}>
      <ViewProviderInner>{children}</ViewProviderInner>
    </Suspense>
  );
}

export function useViewMode() {
  const context = useContext(ViewContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewProvider");
  }
  return context;
}
