"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { House, Heart, ChatCircle, UserCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/feed", label: "Discover", icon: House, matchTag: null },
  { href: "/feed?tag=best_humans", label: "Likes", icon: Heart, matchTag: "best_humans" },
  { href: "/feed?tag=just_matched", label: "Matches", icon: ChatCircle, matchTag: "just_matched" },
  { href: "/dashboard", label: "Profile", icon: UserCircle, matchTag: "dashboard" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tag = searchParams?.get("tag") ?? null;

  function isActive(href: string, matchTag: string | null): boolean {
    if (matchTag === "dashboard") return pathname === "/dashboard";
    if (pathname !== "/feed") return pathname === href.split("?")[0];
    if (matchTag === null) return tag === null;
    return tag === matchTag;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-md md:relative md:bottom-auto md:border-t-0 md:border-b md:bg-transparent"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-around px-2 safe-area-pb md:h-12 md:justify-center md:gap-8">
        {NAV_ITEMS.map(({ href, label, icon: Icon, matchTag }) => {
          const active = isActive(href, matchTag);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              <Icon
                size={22}
                weight={active ? "fill" : "regular"}
                className={cn(active && "text-primary")}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
