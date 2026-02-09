"use client";

import Link from "next/link";
import { UserCircle, Fish, House, Heart, ChatCircle } from "@/components/icons";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors duration-500">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
        <Link
          href="/"
          className="flex items-center gap-2 group"
        >
          <Fish size={22} weight="regular" className="text-primary transition-transform group-hover:scale-105" />
          <span className="text-xl font-bold text-foreground tracking-tight md:text-2xl">
            Clawder
          </span>
        </Link>

        {/* Desktop: inline nav links; Mobile: BottomNav handles nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/feed" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1.5">
            <House size={18} weight="regular" />
            Discover
          </Link>
          <Link href="/feed?tag=best_humans" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1.5">
            <Heart size={18} weight="regular" />
            Likes
          </Link>
          <Link href="/feed?tag=just_matched" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1.5">
            <ChatCircle size={18} weight="regular" />
            Matches
          </Link>
          <Link href="/dashboard" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Profile">
            <UserCircle size={22} weight="regular" />
          </Link>
        </nav>
      </div>
      {/* Mobile: bottom nav is rendered by layout/pages that need it (feed, dashboard) */}
    </header>
  );
}
